/* 테마(블록 색) — 「블록 딜레마」
 *
 * 블록 색 여섯 개(--c1 ~ --c6)만 바꾼다. UI 강조색(--accent/--warn/--hot)은 건드리지 않는다.
 * 크기를 색으로 알아보는 게 규칙의 일부라 아무 색이나 쓸 수 없다. 색은 손으로 고르지 말고
 * tools/make-palettes.py 로 뽑고 tools/check-palettes.py 로 검사할 것 — 원본 표는 tools/palettes.py 다.
 *
 * icon: 테마를 알아보는 표시. 🍁 단풍처럼 계절이 바로 보이게 한다.
 * month:  0 = 언제나,  1~12 = 그 달에만(한국 시간),  -1 = 소장해야만(테스터 전용).
 *   월 테마는 그달엔 누구나 쓸 수 있고, 그달에 기록을 올리면 영구 소장해서 아무 때나 쓸 수 있다.
 *   소장 목록은 서버(titles/{uid}.owned)에 "m10-2026" 처럼 연도까지 들어간다. 같은 단풍이어도
 *   해마다 다른 수집품이라 1년 만에 수집이 끝나 버리지 않는다.
 *   base — 기본. cvd — 색약인 사람을 위한 것이라 달 제한 없이 항상 쓸 수 있다.
 *   월 테마는 계절 느낌을 우선해서 뽑았다. 색약까지 챙기면 12달이 다 비슷해져서 그렇게 했고,
 *   대신 안 맞는 사람은 "색약" 테마를 쓰면 된다.
 *
 * 화면은 window.Themes 만 쓴다:
 *   Themes.list() / Themes.get(id) / Themes.usable(id) / Themes.monthNow()
 *   Themes.current() — 지금 적용된 id / Themes.apply(id) — 적용하고 저장
 */
(() => {
  const KEY = "duljunghana-v3-theme";
  const THEMES = [
    { id: "base", icon: "🧱", month: 0, c: ["#009AAC", "#81CFFF", "#52B085", "#EF835D", "#D4B5B7", "#8689B1"] },
    { id: "cvd", icon: "👁", month: 0, c: ["#009E9E", "#00D2FF", "#49B26D", "#C17D4D", "#FF7583", "#96A3D8"] },
    { id: "tester", icon: "🏅", month: -1, c: ["#FF8F68", "#C67E1F", "#FFADBA", "#A9837F", "#D4C1B4", "#EC568A"] },
    { id: "m1", icon: "❄️", month: 1, c: ["#1A9CA0", "#00D7FC", "#B3C7E6", "#A1B6AB", "#009AE3", "#00DEC8"] },
    { id: "m2", icon: "🌺", month: 2, c: ["#FFAECD", "#EC5685", "#99D593", "#8C917F", "#F99C84", "#A69099"] },
    { id: "m3", icon: "🌼", month: 3, c: ["#EFA276", "#FFA6B0", "#9F906C", "#ADBC40", "#E95F56", "#529F69"] },
    { id: "m4", icon: "🌸", month: 4, c: ["#A875DF", "#E55BA1", "#FFA7F9", "#B7BCFF", "#A48B8B", "#71B347"] },
    { id: "m5", icon: "🌿", month: 5, c: ["#D2C64B", "#849A57", "#9C8F80", "#B7C7B5", "#F1AE66", "#32E09D"] },
    { id: "m6", icon: "💠", month: 6, c: ["#5798DC", "#00D6FF", "#C1C3ED", "#A2BDB8", "#918999", "#00A28E"] },
    { id: "m7", icon: "🌊", month: 7, c: ["#79918C", "#00A069", "#81D5CA", "#00B0D5", "#E28C6E", "#7BDB79"] },
    { id: "m8", icon: "🌻", month: 8, c: ["#E9BC94", "#EE5872", "#C37F1C", "#F67C52", "#9C9783", "#FFB1B4"] },
    { id: "m9", icon: "🏵️", month: 9, c: ["#CBBDFF", "#BE70D5", "#7091E9", "#A5909D", "#FFB28C", "#A0A759"] },
    { id: "m10", icon: "🍁", month: 10, c: ["#E6636F", "#D85FB6", "#9F8883", "#FFA98A", "#FFA8C7", "#D0C572"] },
    { id: "m11", icon: "🍂", month: 11, c: ["#FF97D1", "#DBC0BF", "#FFAD65", "#ED5876", "#E36C44", "#9F8876"] },
    { id: "m12", icon: "🎄", month: 12, c: ["#F1B6CB", "#FD6584", "#8D9A8B", "#70B246", "#FFB091", "#CF64BF"] },
  ];
  const byId = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
  // 한국 시간 기준. 시즌·이어하기 횟수와 같은 기준을 쓴다.
  const kst = () => new Date(Date.now() + 9 * 3600e3);
  const monthNow = () => kst().getUTCMonth() + 1;
  const yearNow = () => kst().getUTCFullYear();

  // 서버(titles/{uid})에서 받아 온 소유 상태. 로그인 전이거나 오프라인이면 빈 값이고,
  // 그래도 이번 달 테마와 기본·색약은 쓸 수 있다.
  let own = { owned: [], all: false };
  const ownedYears = (id) => own.owned
    .filter((k) => k.indexOf(id + "-") === 0)
    .map((k) => Number(k.slice(id.length + 1)))
    .filter((y) => y > 2000).sort();

  function usable(id) {
    const t = byId(id);
    if (own.all) return true;                       // 개발자 — 전부 해금
    if (t.month === 0) return true;                 // 기본·색약
    if (t.month === -1) return own.owned.indexOf(id) >= 0;   // 테스터 전용
    if (t.month === monthNow()) return true;        // 이번 달에 열린 테마
    return ownedYears(id).length > 0;               // 예전에 소장했으면 아무 때나
  }

  const store = {
    get() { try { return localStorage.getItem(KEY) || "base"; } catch (e) { return "base"; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} },
  };

  // ---- 재질 ----
  // 지난달 순위로 정해지는 등수 보상. 블록 색을 덮지 않고 그 위에 광택만 얹는다 —
  // 색을 덮으면 크기 구분이 사라져서 게임이 안 된다.
  // 한 번에 세 개까지만 입힌다. 여섯 개를 다 금속으로 하면 질감으로 크기를 가려야 하는데 색보다 훨씬 어렵다.
  const MAT_KEY = "duljunghana-v3-mats";
  const MATS = ["holo", "gold", "silver", "bronze"];   // 좋은 것부터
  const MAT_MAX = 3;
  // 등급을 받으면 그보다 낮은 재질도 다 쓸 수 있다(홀로그램이면 금·은·동도).
  const matsOf = (tier) => (own.all ? MATS.slice() : (MATS.indexOf(tier) < 0 ? [] : MATS.slice(MATS.indexOf(tier))));

  let myTier = null;                 // 지난달 순위에서 나온 내 등급
  let mats = {};                     // { 크기(1~6): 재질id }
  try { mats = JSON.parse(localStorage.getItem(MAT_KEY) || "{}") || {}; } catch (e) { mats = {}; }

  function saveMats() { try { localStorage.setItem(MAT_KEY, JSON.stringify(mats)); } catch (e) {} }
  // 못 쓰게 된 재질(등급이 내려갔다)은 조용히 뗀다.
  function pruneMats() {
    const can = matsOf(myTier);
    Object.keys(mats).forEach((k) => { if (can.indexOf(mats[k]) < 0) delete mats[k]; });
    saveMats();
    paintMats();
  }
  function paintMats() {
    const root = document.documentElement;
    for (let i = 1; i <= 6; i++) root.removeAttribute("data-mat" + i);
    Object.entries(mats).forEach(([size, m]) => root.setAttribute("data-mat" + size, m));
  }
  paintMats();

  function paint(id) {
    const t = byId(id);
    const root = document.documentElement.style;
    t.c.forEach((hex, i) => root.setProperty("--c" + (i + 1), hex));
  }

  let cur = store.get();
  if (!usable(cur)) cur = "base";   // 달이 바뀌어 못 쓰게 된 테마는 조용히 기본으로 돌린다
  paint(cur);

  window.Themes = {
    // 쓸 수 있는 것을 앞으로. 잠긴 건 달 순서대로 뒤에 붙는다.
    list: () => THEMES.slice().sort((a, b) => (usable(b.id) ? 1 : 0) - (usable(a.id) ? 1 : 0)),
    ownedYears,
    yearNow,
    // 재질
    MATS, MAT_MAX,
    tier: () => myTier,
    setTier(t) { myTier = t; pruneMats(); return myTier; },
    canUse: (m) => matsOf(myTier).indexOf(m) >= 0,
    mats: () => Object.assign({}, mats),
    // 크기(1~6)에 재질을 입힌다. m 이 없으면 뗀다. 같은 재질을 두 곳에 쓰지 않는다.
    setMat(size, m) {
      if (m && matsOf(myTier).indexOf(m) < 0) return false;   // 못 쓰는 재질
      if (!m) delete mats[size];
      else {
        Object.keys(mats).forEach((k) => { if (mats[k] === m) delete mats[k]; });   // 한 재질은 한 곳에만
        if (Object.keys(mats).length >= MAT_MAX && !mats[size]) return false;        // 세 개까지
        mats[size] = m;
      }
      saveMats();
      paintMats();
      return true;
    },
    isAll: () => own.all,
    // 서버에서 소유 정보를 받으면 알려 준다. 쓸 수 없게 된 테마를 쓰고 있었다면 기본으로 돌린다.
    setOwned(o) {
      own = { owned: (o && o.owned) || [], all: !!(o && o.all) };
      if (!usable(cur)) { cur = "base"; store.set(cur); paint(cur); }
      return own;
    },
    get: byId,
    usable,
    monthNow,
    current: () => cur,
    apply(id) {
      if (!usable(id)) return false;
      cur = id;
      store.set(id);
      paint(id);
      return true;
    },
  };
})();
