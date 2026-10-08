/* 테마(블록 색) — 「블록 딜레마」
 *
 * 블록 색 여섯 개(--c1 ~ --c6)만 바꾼다. UI 강조색(--accent/--warn/--hot)은 건드리지 않는다.
 * 크기를 색으로 알아보는 게 규칙의 일부라 아무 색이나 쓸 수 없다. 색은 손으로 고르지 말고
 * tools/make-palettes.py 로 뽑고 tools/check-palettes.py 로 검사할 것 — 원본 표는 tools/palettes.py 다.
 *
 * icon: 테마를 알아보는 표시. 🍁 단풍처럼 계절이 바로 보이게 한다.
 * month: 0 이면 언제나 쓸 수 있고, 1~12 면 그 달에만 쓸 수 있다(한국 시간 기준).
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
  // 한국 시간 기준 몇 월인지. 시즌·이어하기 횟수와 같은 기준을 쓴다.
  const monthNow = () => new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1;
  const usable = (id) => { const t = byId(id); return t.month === 0 || t.month === monthNow(); };

  const store = {
    get() { try { return localStorage.getItem(KEY) || "base"; } catch (e) { return "base"; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} },
  };

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
