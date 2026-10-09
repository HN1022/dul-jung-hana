/* 광고 — 「블록 딜레마」
 *
 * 안드로이드 앱(Capacitor)에서만 동작한다. 웹(아이폰 포함)에는 광고가 없다.
 *
 * 앱: 하단 배너 + 이어하기 보상형 광고. 그게 전부다.
 *
 * ⚠️ 전면광고는 2026-10-08 에 뺐다. 테스터들이 "광고가 너무 길다"고 했고, 60초짜리를 본 사람도 있었다.
 * 한 판이 1~2분인 게임에서 판 사이에 60초를 강제로 보게 하는 건 게임을 그만두게 만든다. 광고 길이는
 * 광고주가 만든 소재라 우리가 못 줄이니, 빈도를 낮추는 걸로는 해결이 안 된다고 보고 아예 없앴다.
 * 남은 광고는 둘 다 안 거슬린다 — 배너는 화면 아래 붙어만 있고, 보상형은 본인이 눌러서 본다.
 * 되살리려면 git 기록(이 커밋의 이전 버전)에 showInterstitial 코드가 그대로 있다.
 * AdMob 의 전면광고 단위 ca-app-pub-4373923440824013/9158353992 도 지우지 않고 남겨 뒀다.
 *
 * 인앱 결제(광고 제거·보관 칸 구독)는 2026-09-18 에 뺐다. 한국에서 유료 상품을 팔려면 사업자등록·통신판매업
 * 신고가 필요한데 개인으로 운영하기로 해서. 보관 칸은 누구나 2칸 무료. 다시 넣으려면 git 기록(이 파일의 이전 버전)과
 * 인수인계 문서 참고. ⚠️ Play Console 의 옛 상품 ID remove_ads 는 삭제해서 다시 못 쓴다(slot_monthly 는 비활성).
 *
 * 게임(index.html)은 window.Money 만 쓴다:
 *   Money.isApp / Money.state / Money.onChange(fn) / Money.openShop()
 *   Money.showRewarded() — 이어하기 전 보상형 광고
 */
(() => {
  const CONFIG = {
    // 실제 AdMob ID. 내 폰에서 테스트할 때는 절대 광고를 누르지 말 것 — 무효 클릭.
    //    앱 ID 는 android/app/src/main/AndroidManifest.xml 의 APPLICATION_ID 에 있다.
    adsTesting: false,
    bannerId: "ca-app-pub-4373923440824013/2784517335",
    rewardedId: "ca-app-pub-4373923440824013/2930490012",   // 보상형 "이어하기" (2026-09-18 생성)
  };

  const cap = window.Capacitor;
  const isApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const AdMob = isApp ? cap.Plugins.AdMob : null;

  // 예전 결제 상태 자리. 이제 아무것도 사지 않으므로 늘 false (index.html 이 읽는 모양만 유지).
  const state = { removeAds: false, slotSub: false };
  let adsStarted = false, adsReady = false, bannerShown = false;

  // 배너가 가릴 만큼 화면 아래에 자리를 비워 둔다(--ad-h → --bottom-gap → 각 화면의 아래 여백).
  // 적응형 배너는 보통 50~60dp 다. 실제 높이는 bannerAdSizeChanged 가 알려 주는데, 그 이벤트가
  // 늦거나 안 올 수도 있다 — 그러면 여백이 0이라 내용이 광고 밑으로 들어간다. 실제로 그랬다.
  // 그래서 배너를 띄우자마자 넉넉히 잡아 두고, 진짜 높이가 오면 그때 맞춘다.
  // 재어 온 높이도 그대로 믿지 않는다. 배너가 화면 맨 아래에 딱 붙지 않고 조금 떠서 깔리는
  // 기기가 있어서, 딱 맞게 비우면 그 틈으로 내용이 비쳤다(2026-10-09 사용자 스크린샷).
  // 그래서 최소치를 두고 여유를 조금 더 얹는다. 자리가 좀 남는 건 괜찮지만 모자라면 글이 가려진다.
  const AD_H_GUESS = 60;
  const AD_H_MIN = 56;    // 적응형 배너가 이보다 낮게 올 일은 없다
  const AD_H_PAD = 8;     // 떠 있는 만큼의 여유
  function setAdHeight(px) {
    const n = Math.round(px || 0);
    const h = n > 0 ? Math.max(n, AD_H_MIN) + AD_H_PAD : 0;
    const root = document.documentElement.style;
    root.setProperty("--ad-h", h + "px");
    // 광고가 떠 있을 때만 아래 안전영역까지 띠로 덮는다(index.html 의 .adslot)
    root.setProperty("--ad-on", h > 0 ? "1" : "0");
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
    } catch (e) {}
    adsReady = true;   // 리스너를 다 단 다음에 배너를 띄워야 배너 높이만큼 화면이 올라간다
    showBanner();
  }

  function showBanner() {
    if (!AdMob) return;
    if (!adsStarted) { startAds(); return; }
    if (!adsReady || bannerShown) return;
    bannerShown = true;
    setAdHeight(AD_H_GUESS);   // 먼저 자리부터 비운다. 광고가 안 뜨면 아래에서 0으로 되돌린다.
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
  };

  if (!isApp) return;
  showBanner();
})();
