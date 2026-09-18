/* 언어 (한국어 / English) — 「둘 중 하나」
 *
 * 처음엔 폰·브라우저 언어를 따라가고(한국어가 아니면 영어), 시작 화면의 🌐 버튼으로 바꾸면 기억한다.
 *
 * 쓰는 법:
 *   HTML:  <span data-i18n="key">  (글자)   <h1 data-i18n-html="key">  (HTML)   data-i18n-aria="key"  (aria-label)
 *   JS:    I18n.t("key", { n: 3 })   → 문장 안의 {n} 이 3 으로 바뀐다
 *
 * ⚠️ 새 문구를 추가하면 한국어·영어 둘 다 넣고, `python tools/build-fonts.py` 를 다시 돌릴 것(폰트에 글자 추가).
 */
(() => {
  const D = {
    ko: {
      doc_title: "둘 중 하나",
      lang_btn: "🌐 English",
      menu: "메뉴",
      score: "점수",
      best: "최고",
      board: "8×8 보드",

      // 시작 화면
      title: "둘 중 <em>하나</em>",
      sub: "둘 중 하나를 골라 놓고, 가로 줄을 지우는 블록 퍼즐",
      h_size: "블록 크기",
      mode35: "3~5칸",
      mode35_sub: "기본",
      mode16: "1~6칸",
      mode16_sub: "큰 블록 위주",
      h_level: "난이도",
      h_control: "조작",
      ctl_draw: "✏️ 그리기",
      ctl_draw_sub: "보드에 직접 칠하기",
      ctl_drag: "✋ 끌어놓기",
      ctl_drag_sub: "끌어다 놓기",
      best_record: "최고 기록",
      resume: "이어서 하기",
      new_game: "새로 시작",
      shop_btn: "🛒 상점 · 광고 제거 · 보관 칸",
      rules_title: "규칙 보기",
      privacy_link: "개인정보처리방침",
      rules: "크기를 고르면 블록 두 개가 나와요. 그중 하나를 보드에 놓으면 한 턴이 끝나요. <b>✏️ 그리기</b>: 블록을 원하는 방향으로 돌려서 보드 빈칸에 직접 칠하면 손을 뗄 때 놓여요(뒤집은 모양은 안 돼요). <b>✋ 끌어놓기</b>: 블록을 탭하거나 ↻를 눌러 돌리고 보드로 끌어다 놓아요. PC에서는 끄는 중에 R키로도 돌릴 수 있어요. <b>📦 보관</b>: 블록의 📦 버튼을 누르면 보관함에 들어가고, 다음 턴부터 아무 때나 꺼내 놓을 수 있어요. 대신 그 턴은 아무것도 놓지 못하고 크기 선택부터 다시 시작해요(방해 블록 턴은 그대로 흘러가요). 가로 한 줄을 꽉 채우면 사라지고 그 위의 블록들이 내려와요. 가진 블록을 어떻게 돌려도 놓을 곳이 없으면 게임 끝! <b>난이도</b> 1은 방해 없음, 2는 4턴마다 1칸, 3은 3턴마다 2칸, 4는 2턴마다 2칸씩 회색 방해 블록이 빈칸에 떨어져요. 대신 점수가 ×1 · ×1.5 · ×2 · ×3배! 방해 블록은 줄을 공짜로 완성시키지 않아요. 큰 블록은 난이도가 높을수록, 그리고 판이 길어질수록(80턴까지 20턴마다 알림) 더 자주 나와요. 1~6칸 모드는 처음부터 큰 블록 위주예요. 크기 모드·난이도마다 기록이 따로 저장돼요.",
      lv1: "방해 블록 없음 · 점수 ×1",
      lv2: "4턴마다 방해 블록 1칸 · 점수 ×1.5",
      lv3: "3턴마다 방해 블록 2칸 · 점수 ×2",
      lv4: "2턴마다 방해 블록 2칸 · 점수 ×3",

      // 게임 중
      meta: "{mode} · Lv{level}",
      ctl_title_draw: "그리기 (눌러서 끌어놓기로)",
      ctl_title_drag: "끌어놓기 (눌러서 그리기로)",
      warn_soon: "이번에 놓으면 방해 {n}칸!",
      warn_turns: "방해 블록까지 {n}턴",
      grow_max: "블록 크기 최대치!",
      grow: "블록이 점점 커져요",
      turns_passed: "{n}턴 돌파",
      step_size: "<b>1</b>몇 칸짜리 블록을 받을까요?<small>큰 블록일수록 점수 ↑</small>",
      size_label: "{n}칸 블록",
      step_stuck: "<b>!</b>어떻게 돌려도 놓을 곳이 없어요",
      step_drag_many: "<b>2</b>하나를 끌어다 놓으세요<small>탭하면 회전</small>",
      step_drag_one: "<b>2</b>블록을 끌어다 놓으세요<small>탭하면 회전</small>",
      step_draw_many: "<b>2</b>하나를 골라 보드에 그리세요<small>방향은 자유롭게</small>",
      step_draw_one: "<b>2</b>이 블록을 보드에 그리세요<small>방향은 자유롭게</small>",
      rotate: "블록 회전",
      store_title: "보관함에 넣기 (이 턴은 넘어가요)",
      store_aria: "보관함에 넣기",
      no_room: "놓을 곳 없음",
      clear: "지우기",
      hold: "📦 보관",
      add_slot: "보관 칸 추가",
      tap_to_hold: "📦 눌러 보관",
      empty: "비어 있음",
      draw_start: "빈칸을 누르거나 끌어서 칠하세요",
      draw_match: "모양 일치! 손을 떼면 놓여요",
      draw_apart: "칸끼리 붙어 있어야 해요",
      draw_bad: "모양이 달라요 · 다시 그려보세요",
      draw_count: "{n} / {goals}칸",
      lines_1: "한 줄!",
      lines_2: "두 줄!!",
      lines_3: "세 줄!!!",
      lines_4: "네 줄!!!!",
      lines_n: "{n}줄!!!!",
      combo: "연속 ×{n}",
      over_title: "놓을 곳이 없어요",
      over_mode: "{mode} · 난이도 {level}",
      new_record: "신기록!",
      best_n: "최고 기록 {n}",
      again: "한 판 더",

      // 상점 (money.js)
      shop: "상점",
      close: "닫기",
      slot_name: "📦 보관 칸 +1",
      slot_desc: "보관 칸이 2개가 돼요 · 매달 자동 결제, 언제든 해지",
      ads_name: "🚫 광고 제거",
      ads_desc: "배너와 판 사이 광고가 모두 사라져요 · 한 번만 결제",
      restore: "구매 복원",
      manage: "구독 관리",
      owned: "사용 중 ✓",
      coming: "준비 중",
      per_month: "월 {p}",
      msg_slot_ok: "보관 칸이 2개로 늘었어요!",
      msg_ads_ok: "이제 광고가 나오지 않아요!",
      msg_pending: "결제가 확인되면 적용돼요",
      msg_fail: "구매가 완료되지 않았어요",
      msg_restored: "구매 내역을 불러왔어요",
      msg_none: "복원할 구매 내역이 없어요",
      msg_wait: "잠시만요…",
    },

    en: {
      doc_title: "Either Or",
      lang_btn: "🌐 한국어",
      menu: "Menu",
      score: "SCORE",
      best: "BEST",
      board: "8×8 board",

      title: "Either <em>Or</em>",
      sub: "Pick one of two blocks, fill a row, clear it.",
      h_size: "BLOCK SIZE",
      mode35: "3–5 cells",
      mode35_sub: "Classic",
      mode16: "1–6 cells",
      mode16_sub: "Bigger blocks",
      h_level: "DIFFICULTY",
      h_control: "CONTROLS",
      ctl_draw: "✏️ Draw",
      ctl_draw_sub: "Paint it on the board",
      ctl_drag: "✋ Drag",
      ctl_drag_sub: "Drag and drop",
      best_record: "Best",
      resume: "Continue",
      new_game: "New game",
      shop_btn: "🛒 Shop · Remove ads · Hold slot",
      rules_title: "How to play",
      privacy_link: "Privacy Policy",
      rules: "Pick a size and you get two blocks. Place one of them on the board to end your turn. <b>✏️ Draw</b>: paint the block's shape onto empty cells in any rotation — it's placed when you lift your finger (mirror images don't count). <b>✋ Drag</b>: tap the block or press ↻ to rotate it, then drag it onto the board. On a PC you can also press R while dragging. <b>📦 Hold</b>: press a block's 📦 button to keep it for later and place it on any later turn — but holding uses up that turn and you start again from the size choice (stone timers keep counting). Fill a row completely to clear it; everything above drops down. The game ends when none of your blocks fit anywhere in any rotation. <b>Difficulty</b> 1 has no stones. 2 drops 1 grey stone every 4 turns, 3 drops 2 every 3 turns, 4 drops 2 every 2 turns — in exchange for ×1 · ×1.5 · ×2 · ×3 points. Stones never complete a row on their own. Bigger blocks appear more often at higher difficulty and as the game goes on (announced every 20 turns up to 80). 1–6 mode favours big blocks from the start. Records are kept separately for each mode and difficulty.",
      lv1: "No stones · ×1 points",
      lv2: "1 stone every 4 turns · ×1.5 points",
      lv3: "2 stones every 3 turns · ×2 points",
      lv4: "2 stones every 2 turns · ×3 points",

      meta: "{mode} · Lv{level}",
      ctl_title_draw: "Draw (tap to switch to drag)",
      ctl_title_drag: "Drag (tap to switch to draw)",
      warn_soon: "Next move drops {n} stone!",
      warn_turns: "Stones in {n} turns",
      grow_max: "Max block size!",
      grow: "Blocks are getting bigger",
      turns_passed: "{n} turns",
      step_size: "<b>1</b>Pick a block size<small>bigger = more points</small>",
      size_label: "{n}-cell block",
      step_stuck: "<b>!</b>No room for any block",
      step_drag_many: "<b>2</b>Drag one onto the board<small>tap to rotate</small>",
      step_drag_one: "<b>2</b>Drag the block onto the board<small>tap to rotate</small>",
      step_draw_many: "<b>2</b>Draw one of them on the board<small>any rotation</small>",
      step_draw_one: "<b>2</b>Draw this block on the board<small>any rotation</small>",
      rotate: "Rotate block",
      store_title: "Put in hold (uses this turn)",
      store_aria: "Put in hold",
      no_room: "No room",
      clear: "Clear",
      hold: "📦 Hold",
      add_slot: "Add hold slot",
      tap_to_hold: "Tap 📦 to hold",
      empty: "Empty",
      draw_start: "Tap or drag across empty cells",
      draw_match: "Match! Lift to place",
      draw_apart: "Cells must touch",
      draw_bad: "Wrong shape · try again",
      draw_count: "{n} / {goals} cells",
      lines_1: "Line!",
      lines_2: "Double!!",
      lines_3: "Triple!!!",
      lines_4: "Quad!!!!",
      lines_n: "{n} lines!!!!",
      combo: "Combo ×{n}",
      over_title: "No more moves",
      over_mode: "{mode} · Level {level}",
      new_record: "New best!",
      best_n: "Best {n}",
      again: "Play again",

      shop: "Shop",
      close: "Close",
      slot_name: "📦 Hold slot +1",
      slot_desc: "Get 2 hold slots · renews monthly, cancel anytime",
      ads_name: "🚫 Remove ads",
      ads_desc: "No banner and no ads between games · one-time purchase",
      restore: "Restore purchases",
      manage: "Manage subscription",
      owned: "Active ✓",
      coming: "Coming soon",
      per_month: "{p}/mo",
      msg_slot_ok: "You now have 2 hold slots!",
      msg_ads_ok: "Ads are gone for good!",
      msg_pending: "It'll apply once payment is confirmed",
      msg_fail: "Purchase didn't go through",
      msg_restored: "Purchases restored",
      msg_none: "No purchases to restore",
      msg_wait: "One moment…",
    },
  };

  const KEY = "duljunghana-v3-lang";
  let lang = null;
  try { lang = localStorage.getItem(KEY); } catch (e) {}
  if (!D[lang]) lang = /^ko\b/i.test(navigator.language || "") ? "ko" : "en";
  const listeners = [];

  function t(key, vars) {
    let s = D[lang][key];
    if (s == null) s = D.ko[key];
    if (s == null) return key;
    return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : vars[k])) : s;
  }

  function apply(root) {
    root = root || document;
    document.documentElement.lang = lang;
    document.title = t("doc_title");
    root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  }

  function setLang(next) {
    if (!D[next] || next === lang) return;
    lang = next;
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply();
    listeners.forEach((fn) => { try { fn(lang); } catch (e) {} });
  }

  window.I18n = {
    t, apply, setLang,
    get lang() { return lang; },
    toggle() { setLang(lang === "ko" ? "en" : "ko"); },
    onChange(fn) { listeners.push(fn); },
  };
})();
