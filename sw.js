/* 서비스 워커 — 오프라인에서도 게임이 돌아가게 파일을 폰에 저장해 둔다.
 *
 * 전략:
 *   - 화면(HTML)·코드(JS)·문구·폰트는 "네트워크 먼저" — 온라인이면 항상 최신, 오프라인이면 저장해 둔 걸 쓴다.
 *     (예전엔 JS 를 캐시 먼저로 했다가, 새 화면이 옛 문구 파일을 써서 rank_btn 같은 이름표가 보인 적이 있다)
 *   - 아이콘만 "저장해 둔 것 먼저" — 거의 안 바뀌고 개수가 많아서.
 *   - index.html 이 ?v=버전 을 붙여 부르므로, 캐시에서 찾을 때는 ? 뒤를 무시한다(ignoreSearch).
 *
 * ASSETS 목록을 고쳤으면 VERSION 을 올릴 것. 그래야 옛 캐시가 지워진다.
 */
const VERSION = "v14";   // v14: 앱 구글 로그인
const CACHE = "duljunghana-" + VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./privacy.html",
  "./i18n.js",
  "./engine.js",
  "./leaderboard.js",
  "./money.js",
  "./manifest.json",
  "./fonts/fonts.css",
  "./fonts/noto-sans-kr.woff2",
  "./fonts/baloo2.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-64.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  const url = new URL(req.url);

  // 페이지(게임 화면·개인정보처리방침 등): 네트워크 먼저, 안 되면 그 페이지의 저장본, 없으면 게임 화면
  // (예전엔 어떤 페이지든 index.html 자리에 저장해서, 방침 페이지를 연 뒤 오프라인이면 게임 대신 방침이 떴다)
  if (req.mode === "navigate") {
    const isGame = url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
    const key = isGame ? new URL("./index.html", self.location).href : url.origin + url.pathname;
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(() => caches.match(key).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  const store = (res) => {
    if (res.ok) {
      const copy = res.clone();
      // ?v= 를 떼고 저장 → 오프라인일 때 버전이 달라도 찾을 수 있게
      caches.open(CACHE).then((c) => c.put(url.origin + url.pathname, copy));
    }
    return res;
  };

  // 아이콘: 저장해 둔 것 먼저
  if (url.pathname.includes("/icons/")) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then(store)));
    return;
  }

  // 나머지(코드·문구·폰트): 네트워크 먼저, 안 되면 저장해 둔 것
  e.respondWith(
    fetch(req).then(store).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
