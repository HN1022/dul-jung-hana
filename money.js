/* 광고·결제 — 「블록 딜레마」
 *
 * 안드로이드 앱(Capacitor)에서만 동작한다. 웹(아이폰 포함)에서는 아무것도 하지 않는다:
 * 웹은 보관 칸 2개 무료 + 광고 없음.
 *
 * 앱:
 *   - 광고: 하단 배너 + 게임오버 후 전면광고(CONFIG.interstitialEvery 판마다 한 번)
 *   - "광고 제거" (평생, 1회 결제)        → 배너·전면광고 둘 다 사라짐
 *   - "보관 칸 +1" (월 자동 갱신 구독)    → 보관 칸이 1개 → 2개
 *
 * 게임(index.html)은 window.Money 만 쓴다:
 *   Money.isApp / Money.state / Money.onChange(fn) / Money.openShop()
 *   Money.gameEnded() — 게임오버 때 / Money.maybeInterstitial() — 결과 화면에서 다음으로 넘어갈 때
 *
 * ⚠️ 출시 전에 할 일은 인수인계 문서의 "광고·결제 출시 체크리스트" 참고.
 */
(() => {
  const CONFIG = {
    // ---- AdMob ----
    // 실제 AdMob ID (2026-09-18 적용). 내 폰에서 테스트할 때는 절대 광고를 누르지 말 것 — 무효 클릭.
    //    앱 ID 는 android/app/src/main/AndroidManifest.xml 의 APPLICATION_ID 에 있다.
    adsTesting: false,
    bannerId: "ca-app-pub-4373923440824013/2784517335",
    interstitialId: "ca-app-pub-4373923440824013/9158353992",
    // 이어하기 보상형 광고. ⚠️ 지금은 구글 공식 테스트 ID — AdMob 에 보상형 광고 단위를 만들면 실제 ID 로 바꿀 것
    rewardedId: "ca-app-pub-4373923440824013/2930490012",   // 보상형 "이어하기" (2026-09-18 생성)
    interstitialEvery: 2,        // 게임오버 몇 번에 한 번 전면광고를 보여줄지

    // ---- Google Play 상품 ID (Play Console 에서 똑같은 ID 로 만들어야 함) ----
    // 가격은 코드가 아니라 Play Console 에서 정한다: 광고 제거 ₩3,900 / 보관 칸 월 ₩1,300
    removeAdsId: "remove_ads",   // 인앱 상품 (일회성)
    slotSubId: "slot_monthly",   // 구독
    slotSubPlan: "monthly",      // 구독의 기본 요금제(base plan) ID
  };

  const STORE_KEY = "duljunghana-v3-ent";
  const tr = (key, vars) => (window.I18n ? window.I18n.t(key, vars) : key);   // 문구는 i18n.js
  const cap = window.Capacitor;
  const isApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const Purchases = isApp ? cap.Plugins.NativePurchases : null;
  const AdMob = isApp ? cap.Plugins.AdMob : null;

  // 마지막으로 확인한 구매 상태. 켤 때 바로 쓰고(오프라인이어도), 구글에 확인되면 갱신.
  let state = { removeAds: false, slotSub: false };
  try { Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY) || "{}")); } catch (e) {}

  const listeners = [];
  const products = {};             // 상품 ID → 구글이 알려준 상품 정보(가격 문자열 등)
  let busy = false, shopMsg = "";   // i18n.js 의 키
  let adsStarted = false, adsReady = false, bannerShown = false, interstitialReady = false, gamesSinceAd = 0;

  function setState(next) {
    const changed = next.removeAds !== state.removeAds || next.slotSub !== state.slotSub;
    state = next;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
    if (changed) listeners.forEach((fn) => { try { fn(state); } catch (e) {} });
    syncAds();
    renderShop();
  }

  // ---------------- 결제 ----------------
  async function refreshPurchases() {
    if (!Purchases) return;
    try {
      const { purchases = [] } = await Purchases.getPurchases();
      // 안드로이드: purchaseState "1" = 결제 완료 ("2" = 결제 대기 중이라 아직 안 줌)
      const owns = (id) => purchases.some((t) => t.productIdentifier === id
        && (t.purchaseState == null || String(t.purchaseState) === "1")
        && t.isActive !== false);
      setState({ removeAds: owns(CONFIG.removeAdsId), slotSub: owns(CONFIG.slotSubId) });
    } catch (e) {
      // 오프라인·결제 서비스 없음 → 마지막으로 확인한 상태 유지
    }
  }

  async function loadProducts() {
    if (!Purchases) return;
    for (const [id, type] of [[CONFIG.removeAdsId, "inapp"], [CONFIG.slotSubId, "subs"]]) {
      try {
        const res = await Purchases.getProducts({ productIdentifiers: [id], productType: type });
        const p = res && res.products && res.products[0];
        if (p) products[id] = p;
      } catch (e) {}
    }
    renderShop();
  }

  async function buy(id) {
    if (!Purchases || busy) return;
    const sub = id === CONFIG.slotSubId;
    busy = true; shopMsg = ""; renderShop();
    try {
      await Purchases.purchaseProduct(Object.assign(
        { productIdentifier: id, productType: sub ? "subs" : "inapp", autoAcknowledgePurchases: true },
        sub ? { planIdentifier: CONFIG.slotSubPlan } : {}
      ));
      await refreshPurchases();
      const ok = sub ? state.slotSub : state.removeAds;
      shopMsg = ok ? (sub ? "msg_slot_ok" : "msg_ads_ok") : "msg_pending";
    } catch (e) {
      shopMsg = "msg_fail";   // 사용자가 취소한 경우도 여기로 온다
    } finally {
      busy = false; renderShop();
    }
  }

  async function restore() {
    if (!Purchases || busy) return;
    busy = true; shopMsg = ""; renderShop();
    try {
      await Purchases.restorePurchases();
    } catch (e) {}
    await refreshPurchases();
    busy = false;
    shopMsg = state.removeAds || state.slotSub ? "msg_restored" : "msg_none";
    renderShop();
  }

  // ---------------- 광고 ----------------
  function setAdHeight(px) {
    document.documentElement.style.setProperty("--ad-h", Math.max(0, Math.round(px || 0)) + "px");
  }

  function prepareInterstitial() {
    if (!AdMob || state.removeAds) return;
    AdMob.prepareInterstitial({ adId: CONFIG.interstitialId, isTesting: CONFIG.adsTesting })
      .then(() => { interstitialReady = true; })
      .catch(() => { interstitialReady = false; });
  }

  async function startAds() {
    if (!AdMob || adsStarted || state.removeAds) return;
    adsStarted = true;
    try {
      await AdMob.initialize({ initializeForTesting: CONFIG.adsTesting });
      // 유럽 등 동의가 필요한 지역에서만 동의 창이 뜬다
      const info = await AdMob.requestConsentInfo();
      if (info && info.isConsentFormAvailable && info.status === "REQUIRED") await AdMob.showConsentForm();
    } catch (e) {}
    try {
      AdMob.addListener("bannerAdSizeChanged", (size) => setAdHeight(size && size.height));
      AdMob.addListener("interstitialAdDismissed", () => { interstitialReady = false; prepareInterstitial(); });
      AdMob.addListener("interstitialAdFailedToShow", () => { interstitialReady = false; prepareInterstitial(); });
    } catch (e) {}
    adsReady = true;   // 리스너를 다 단 다음에 배너를 띄워야 배너 높이만큼 화면이 올라간다
    prepareInterstitial();
    syncAds();
  }

  function syncAds() {
    if (!AdMob) return;
    if (state.removeAds) {
      if (bannerShown) { bannerShown = false; AdMob.removeBanner().catch(() => {}); }
      setAdHeight(0);
      return;
    }
    if (!adsStarted) { startAds(); return; }
    if (!adsReady) return;
    if (!bannerShown) {
      bannerShown = true;
      AdMob.showBanner({
        adId: CONFIG.bannerId, adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER",
        margin: 0, isTesting: CONFIG.adsTesting,
      }).catch(() => { bannerShown = false; setAdHeight(0); });
    }
  }

  // ---------------- 상점 화면 ----------------
  let shopEl = null;
  function buildShop() {
    shopEl = document.createElement("div");
    shopEl.className = "start shop";
    shopEl.hidden = true;
    shopEl.innerHTML = `
      <div class="startcard">
        <div class="shophead">
          <h2 data-i18n="shop"></h2>
          <button type="button" class="iconbtn" data-act="close" data-i18n-aria="close">✕</button>
        </div>
        <div class="shopitem">
          <div class="shopdesc"><b data-i18n="slot_name"></b><span data-i18n="slot_desc"></span></div>
          <button type="button" class="btn" data-buy="${CONFIG.slotSubId}"></button>
        </div>
        <div class="shopitem">
          <div class="shopdesc"><b data-i18n="ads_name"></b><span data-i18n="ads_desc"></span></div>
          <button type="button" class="btn" data-buy="${CONFIG.removeAdsId}"></button>
        </div>
        <p class="shopmsg" aria-live="polite"></p>
        <div class="shoplinks">
          <button type="button" class="plainbtn" data-act="restore" data-i18n="restore"></button>
          <button type="button" class="plainbtn" data-act="manage" data-i18n="manage"></button>
        </div>
      </div>`;
    shopEl.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.buy) buy(b.dataset.buy);
      else if (b.dataset.act === "close") { if (window.Nav && window.Nav.top() === "shop") window.Nav.back(); else shopEl.hidden = true; }
      else if (b.dataset.act === "restore") restore();
      else if (b.dataset.act === "manage" && Purchases) Purchases.manageSubscriptions().catch(() => {});
    });
    document.body.appendChild(shopEl);
  }

  function renderShop() {
    if (!shopEl) return;
    if (window.I18n) window.I18n.apply(shopEl);
    shopEl.querySelectorAll("[data-buy]").forEach((b) => {
      const id = b.dataset.buy;
      const owned = id === CONFIG.slotSubId ? state.slotSub : state.removeAds;
      const p = products[id];
      b.disabled = busy || owned || !p;
      b.textContent = owned ? tr("owned")
        : !p ? tr("coming")
        : id === CONFIG.slotSubId ? tr("per_month", { p: p.priceString }) : p.priceString;
    });
    shopEl.querySelector(".shopmsg").textContent = busy ? tr("msg_wait") : (shopMsg ? tr(shopMsg) : "");
  }

  function openShop() {
    if (!isApp) return;
    if (!shopEl) buildShop();
    shopMsg = "";
    renderShop();
    if (shopEl.hidden && window.Nav) window.Nav.push("shop", () => { shopEl.hidden = true; });
    shopEl.hidden = false;
    loadProducts();
  }

  // ---------------- 게임에서 부르는 것들 ----------------
  window.Money = {
    isApp,
    get state() { return state; },
    onChange(fn) { listeners.push(fn); },
    openShop,
    gameEnded() { gamesSinceAd++; },
    // 이어하기 전에 보상형 광고. 끝까지 보면 true, 광고가 안 뜨거나 닫으면 false.
    async showRewarded() {
      if (!AdMob || state.removeAds) return false;
      try {
        if (!adsStarted) await startAds();
        await AdMob.prepareRewardVideoAd({ adId: CONFIG.rewardedId, isTesting: CONFIG.adsTesting });
        const reward = await AdMob.showRewardVideoAd();
        return !!reward;
      } catch (e) {
        return false;
      }
    },
    // 결과 화면에서 "한 판 더"/"메뉴"를 누를 때. 광고는 앱 위에 따로 뜨니 기다리지 않는다.
    maybeInterstitial() {
      if (!AdMob || state.removeAds || !interstitialReady) return;
      if (gamesSinceAd < CONFIG.interstitialEvery) return;
      gamesSinceAd = 0;
      interstitialReady = false;
      AdMob.showInterstitial().catch(() => prepareInterstitial());
    },
  };

  if (!isApp) return;
  if (window.I18n) window.I18n.onChange(renderShop);
  refreshPurchases();
  syncAds();
  // 다른 앱(구독 관리 화면 등)에 갔다 돌아오면 구매 상태 다시 확인
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshPurchases(); });
})();
