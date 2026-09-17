/* 서비스 워커 — 오프라인에서도 게임이 돌아가게 파일을 폰에 저장해 둔다.
 *
 * 전략:
 *   - 게임 화면(HTML)은 "네트워크 먼저" — 온라인이면 항상 최신 버전이 뜨고, 오프라인이면 저장해 둔 걸 쓴다.
 *     (개발 중에 고친 게 바로 반영되도록. 캐시 먼저로 하면 옛날 화면이 계속 뜬다.)
 *   - 폰트·아이콘은 "저장해 둔 것 먼저" — 안 바뀌는 파일이라 빠른 게 이득.
 *
 * ASSETS 목록을 고쳤으면 VERSION 을 올릴 것. 그래야 옛 캐시가 지워진다.
 */
const VERSION = "v2";   // v2: 아이콘을 선택 카드 두 장 모양으로 교체
const CACHE = "duljunghana-" + VERSION;

const ASSETS = [
  "./",
  "./index.html",
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

  // 게임 화면: 네트워크 먼저, 안 되면 저장해 둔 것
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((hit) => hit || caches.match("./")))
    );
    return;
  }

  // 나머지(폰트·아이콘): 저장해 둔 것 먼저
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
