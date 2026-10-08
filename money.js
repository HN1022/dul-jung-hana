/* 광고 — 「블록 딜레마」
 *
 * 안드로이드 앱(Capacitor)에서만 동작한다. 웹(아이폰 포함)에는 광고가 없다.
 *
 * 앱: 하단 배너 + 게임오버 후 전면광고 + 이어하기 보상형 광고.
 * 전면광고는 CONFIG.interstitialEvery 판 이상 **그리고** 직전 전면광고로부터 CONFIG.interstitialGapMs 이상
 * 지났을 때만 뜬다. 둘 다 만족해야 한다.
 *
 * 인앱 결제(광고 제거·보관 칸 구독)는 2026-09-18 에 뺐다. 한국에서 유료 상품을 팔려면 사업자등록·통신판매업
 * 신고가 필요한데 개인으로 운영하기로 해서. 보관 칸은 누구나 2칸 무료. 다시 넣으려면 git 기록(이 파일의 이전 버전)과
 * 인수인계 문서 참고. ⚠️ Play Console 의 옛 상품 ID remove_ads 는 삭제해서 다시 못 쓴다(slot_monthly 는 비활성).
 *
 * 게임(index.html)은 window.Money 만 쓴다:
 *   Money.isApp / Money.state / Money.onChange(fn) / Money.openShop()
 *   Money.gameEnded() — 게임오버 때 / Money.maybeInterstitial() — 결과 화면에서 다음으로 넘어갈 때
 *   Money.showRewarded() — 이어하기 전 보상형 광고
 */
(() => {
  const CONFIG = {
    // 실제 AdMob ID. 내 폰에서 테스트할 때는 절대 광고를 누르지 말 것 — 무효 클릭.
    //    앱 ID 는 android/app/src/main/AndroidManifest.xml 의 APPLICATION_ID 에 있다.
    adsTesting: false,
    bannerId: "ca-app-pub-4373923440824013/2784517335",
    interstitialId: "ca-app-pub-4373923440824013/9158353992",
    rewardedId: "ca-app-pub-4373923440824013/2930490012",   // 보상형 "이어하기" (2026-09-18 생성)
    // 전면광고는 둘 다 만족해야 뜬다. 2026-10-08 에 "광고가 너무 길다"는 말을 듣고 크게 늦췄다
    // (전 2판에 한 번, 간격 제한 없음 → 5판에 한 번 + 최소 4분). 광고 길이 자체는 광고주가 정하는 거라
    // 우리가 못 줄인다. 대신 마주치는 횟수를 줄였다. 수익은 줄지만 한 판이 짧은 게임이라 이게 맞다.
    interstitialEvery: 5,        // 게임오버 몇 번에 한 번
    interstitialGapMs: 4 * 60 * 1000,   // 직전 전면광고로부터 최소 이만큼 지나야
  };

  const cap = window.Capacitor;
  const isApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const AdMob = isApp ? cap.Plugins.AdMob : null;

  // 예전 결제 상태 자리. 이제 아무것도 사지 않으므로 늘 false (index.html 이 읽는 모양만 유지).
  const state = { removeAds: false, slotSub: false };
  let adsStarted = false, adsReady = false, bannerShown = false, interstitialReady = false, gamesSinceAd = 0;
  // 앱을 켠 순간부터 잰다 — 들어오자마자 전면광고를 맞는 일이 없게.
  let lastInterstitialAt = Date.now();

  function setAdHeight(px) {
    document.documentElement.style.setProperty("--ad-h", Math.max(0, Math.round(px || 0)) + "px");
  }

  function prepareInterstitial() {
    if (!AdMob) return;
    AdMob.prepareInterstitial({ adId: CONFIG.interstitialId, isTesting: CONFIG.adsTesting })
      .then(() => { interstitialReady = true; })
      .catch(() => { interstitialReady = false; });
  }

  async function startAds() {
    if (!AdMob || adsStarted) return;
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
    showBanner();
  }

  function showBanner() {
    if (!AdMob) return;
    if (!adsStarted) { startAds(); return; }
    if (!adsReady || bannerShown) return;
    bannerShown = true;
    AdMob.showBanner({
      adId: CONFIG.bannerId, adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER",
      margin: 0, isTesting: CONFIG.adsTesting,
    }).catch(() => { bannerShown = false; setAdHeight(0); });
  }

  window.Money = {
    isApp,
    get state() { return state; },
    onChange() {},     // 결제가 없어서 상태가 바뀌는 일이 없다
    openShop() {},     // 상점 없음
    gameEnded() { gamesSinceAd++; },
    // 이어하기 전에 보상형 광고. 끝까지 보면 true, 광고가 안 뜨거나 닫으면 false.
    async showRewarded() {
      if (!AdMob) return false;
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
      if (!AdMob || !interstitialReady) return;
      if (gamesSinceAd < CONFIG.interstitialEvery) return;
      if (Date.now() - lastInterstitialAt < CONFIG.interstitialGapMs) return;   // 판수는 찼어도 너무 금방이면 넘긴다
      gamesSinceAd = 0;
      lastInterstitialAt = Date.now();
      interstitialReady = false;
      AdMob.showInterstitial().catch(() => prepareInterstitial());
    },
  };

  if (!isApp) return;
  showBanner();
})();
