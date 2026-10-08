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
 *   월 테마는 **그 달 색 하나**로 간다(할로윈이면 전부 호박색). 1칸→6칸은 밝기만 다르다.
 *   그래서 크기를 색으로 가리기는 어렵다 — 대신 블록마다 그 달 문양이 깔리고, 트레이에
 *   "4칸 블록"이라고 쓰여 있다. 여섯 색을 뚜렷이 벌린 것은 기본·색약·테스터 셋뿐이다.
 *
 * 화면은 window.Themes 만 쓴다:
 *   Themes.list() / Themes.get(id) / Themes.usable(id) / Themes.monthNow()
 *   Themes.current() — 지금 적용된 id / Themes.apply(id) — 적용하고 저장
 */
(() => {
  const KEY = "duljunghana-v3-theme";
  const THEMES = [
    { id: "base", icon: "🧱", month: 0, c: ["#009E9F", "#A8C5C4", "#3AC781", "#D96A6B", "#E69EBE", "#43C0FD"] },
    { id: "cvd", icon: "👁", month: 0, c: ["#769493", "#00C2FF", "#58AC72", "#D07937", "#DBBCBC", "#7A8DCD"] },
    { id: "m1", icon: "❄️", month: 1, c: ["#0280BF", "#0289CC", "#0291D9", "#029AE6", "#02A2F2", "#03ABFF"] },
    { id: "m2", icon: "🌺", month: 2, c: ["#C25765", "#CE5D6C", "#DA6272", "#E76879", "#F36D7F", "#FF7385"] },
    { id: "m3", icon: "🌼", month: 3, c: ["#947701", "#A68502", "#B99402", "#CBA302", "#DDB202", "#F0C002"] },
    { id: "m4", icon: "🌸", month: 4, c: ["#C2537C", "#CE5984", "#DA5E8B", "#E76393", "#F3689B", "#FF6EA3"] },
    { id: "m5", icon: "🌹", month: 5, c: ["#C25769", "#CE5D70", "#DA6276", "#E7687D", "#F36D83", "#FF738A"] },
    { id: "m6", icon: "💠", month: 6, c: ["#8F65BF", "#996CCC", "#A273D9", "#AC7AE6", "#B680F2", "#BF87FF"] },
    { id: "m7", icon: "🌊", month: 7, c: ["#0283A3", "#0292B6", "#02A0C8", "#02AFDA", "#02BEED", "#03CDFF"] },
    { id: "m8", icon: "🎆", month: 8, c: ["#A86B02", "#BA7602", "#CB8102", "#DC8C02", "#EE9702", "#FFA203"] },
    { id: "m9", icon: "🍁", month: 9, c: ["#C25C30", "#CE6234", "#DA6837", "#E76D3A", "#F3733D", "#FF7940"] },
    { id: "m10", icon: "🎃", month: 10, c: ["#BF5E0A", "#CC650A", "#D96B0B", "#E6710B", "#F2780C", "#FF7E0D"] },
    { id: "m11", icon: "🍂", month: 11, c: ["#C25C0E", "#CE610E", "#DA670F", "#E76D10", "#F37311", "#FF7912"] },
    { id: "m12", icon: "🎄", month: 12, c: ["#018C42", "#029E4A", "#02AF53", "#02C05B", "#02D263", "#02E36B"] },
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
  const RANK_MATS = ["holo", "gold", "silver", "bronze"];   // 좋은 것부터 — 지난달 순위로 받는다
  // 테스터 에디션은 순위와 무관하다. 비공개 테스트에 참여한 사람만 가지며, 순위표에는 나오지 않는다
  // (순위표 줄 박스는 등급만 보여 준다 — 거긴 "이번 달 성적" 자리라서).
  const MATS = ["tester"].concat(RANK_MATS);                // 고르기 목록에 보이는 순서
  // 몇 개까지 입힐지는 막지 않는다. 여섯 칸을 다 같은 재질로 해도 된다 — 보기에 어떨지는 본인이 판단할 일이고,
  // 크기를 알려 주는 다른 단서(트레이의 "4칸 블록" 글자, 그리기 중의 미리보기 색)는 그대로 남는다.
  const MAT_MAX = 6;
  // 등급을 받으면 그보다 낮은 재질도 다 쓸 수 있다(홀로그램이면 금·은·동도).
  function matsOf(tier) {
    const out = [];
    if (own.all || own.owned.indexOf("tester") >= 0) out.push("tester");
    if (own.all) return out.concat(RANK_MATS);
    const i = RANK_MATS.indexOf(tier);
    return i < 0 ? out : out.concat(RANK_MATS.slice(i));
  }

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
    const root = document.documentElement;
    t.c.forEach((hex, i) => root.style.setProperty("--c" + (i + 1), hex));
    // 월 테마에만 문양이 있다. 기본·색약·테스터는 색만 바뀐다.
    if (t.month >= 1) root.setAttribute("data-theme-mark", t.id);
    else root.removeAttribute("data-theme-mark");
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
    MATS, RANK_MATS, MAT_MAX,
    tier: () => myTier,
    setTier(t) { myTier = t; pruneMats(); return myTier; },
    canUse: (m) => matsOf(myTier).indexOf(m) >= 0,
    mats: () => Object.assign({}, mats),
    // 크기(1~6)에 재질을 입힌다. m 이 없으면 뗀다. 같은 재질을 두 곳에 쓰지 않는다.
    // 한 크기에는 재질 하나. 같은 재질을 여러 크기에 써도 된다.
    setMat(size, m) {
      if (m && matsOf(myTier).indexOf(m) < 0) return false;   // 못 쓰는 재질
      if (!m) delete mats[size];
      else mats[size] = m;
      saveMats();
      paintMats();
      return true;
    },
    isAll: () => own.all,
    // 개발자 해금을 빼고 "실제로 가졌는가". 화면 설명이 거짓말하지 않게 하려고 나눠 둔다.
    reallyHas: (id) => own.owned.indexOf(id) >= 0 || ownedYears(id).length > 0,
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
    // 고르기 전에 칠해만 본다. 저장하지 않으므로 revert() 로 되돌아간다.
    preview(id) {
      if (!usable(id)) return false;
      paint(id);
      return true;
    },
    revert() { paint(cur); },
    apply(id) {
      if (!usable(id)) return false;
      cur = id;
      store.set(id);
      paint(id);
      return true;
    },
  };
})();
