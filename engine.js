/* 게임 규칙 엔진 — 「블록 딜레마」
 *
 * 게임 화면(index.html)과 밤마다 도는 점수 검증(tools/verify-scores.mjs)이 **이 파일 하나를 같이 쓴다.**
 * 그래서 규칙을 고치면 둘이 자동으로 같이 바뀌고, "화면에서 얻은 점수 = 검증에서 다시 돌린 점수"가 보장된다.
 *
 * 핵심: 무작위는 전부 판마다 정한 seed 에서 나온다(Math.random 을 쓰지 않는다).
 *   같은 seed + 같은 행동 기록(log)이면 누가 어디서 돌려도 똑같은 판이 된다 → 리플레이 검증.
 *
 * 화면 쪽에서 규칙을 따로 계산하지 말 것. 반드시 여기 함수를 부르고 결과를 그리기만 한다.
 * ⚠️ 규칙(점수·확률·방해 블록 등)을 바꾸면 VERSION 을 올릴 것. 예전 버전으로 올라온 기록은
 *    예전 규칙으로 다시 돌려야 하므로, 검증기는 VERSION 이 다르면 그 기록을 건드리지 않는다.
 *
 * 브라우저: window.Engine   ·   Node: require/import 로 module.exports
 */
(function (root) {
  "use strict";
  // 규칙 버전. 1 = 처음 규칙, 2 = 이어하기 추가(그 외 규칙은 1 과 같음).
  // 검증기는 SUPPORTED 에 있는 버전을 모두 다시 돌릴 수 있다(판마다 st.v 에 그 판의 버전이 남는다).
  const VERSION = 2;
  const SUPPORTED = [1, 2];
  // 이어하기: 게임오버(놓을 곳 없음) 때 빈칸에 1~3칸을 직접 그려서 놓고 계속한다. 한 판에 1번.
  // (하루 2번 제한과 광고는 화면·money.js 가 맡는다 — 규칙 쪽은 "판당 1번"만 지킨다)
  const REVIVE_PER_GAME = 1;
  const REVIVE_MAX_CELLS = 3;
  const N = 8;
  const MODES = { "35": { min: 3, max: 5 }, "16": { min: 1, max: 6 } };
  // 방해 블록: every 턴마다 count 칸. mult = 점수 배율
  const LEVELS = {
    1: { every: 0, count: 0, mult: 1 },
    2: { every: 4, count: 1, mult: 1.5 },
    3: { every: 3, count: 2, mult: 2 },
    4: { every: 2, count: 2, mult: 3 },
  };

  // ---- 무작위 (seed 고정) ----
  // mulberry32. 상태는 st.rng(32비트 정수) 하나라서 저장·복원이 쉽다.
  function rand(st) {
    const a = (st.rng + 0x6D2B79F5) | 0;
    st.rng = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (st, a) => a[Math.floor(rand(st) * a.length)];
  function newSeed() {
    try {
      const c = (typeof globalThis !== "undefined" && globalThis.crypto) || null;
      if (c && c.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
    } catch (e) {}
    return Math.floor(Math.random() * 4294967296);
  }

  // ---- 블록 모양 (폴리오미노 1~6칸) ----
  const normalize = (c) => {
    const mx = Math.min(...c.map((p) => p[0])), my = Math.min(...c.map((p) => p[1]));
    return c.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  };
  const orientations = (c) => {
    const out = new Map();
    let cur = c;
    for (let f = 0; f < 2; f++) {
      for (let r = 0; r < 4; r++) {
        cur = cur.map(([x, y]) => [-y, x]);
        const n = normalize(cur);
        out.set(JSON.stringify(n), n);
      }
      cur = cur.map(([x, y]) => [-x, y]);
    }
    return [...out.values()];
  };
  const FREE = { 1: [[[0, 0]]] };
  for (let n = 2; n <= 6; n++) {
    const found = new Map();
    for (const shape of FREE[n - 1]) {
      const has = new Set(shape.map((p) => p.join(",")));
      for (const [x, y] of shape) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (has.has(nx + "," + ny)) continue;
          const keys = orientations([...shape, [nx, ny]]).map((o) => JSON.stringify(o)).sort();
          if (!found.has(keys[0])) found.set(keys[0], JSON.parse(keys[0]));
        }
      }
    }
    FREE[n] = [...found.values()];
  }
  const mk = (size, cells) => ({
    size, cells,
    w: Math.max(...cells.map((p) => p[0])) + 1,
    h: Math.max(...cells.map((p) => p[1])) + 1,
    key: JSON.stringify(cells),
  });
  const rotate = (p) => mk(p.size, normalize(p.cells.map(([x, y]) => [p.h - 1 - y, x])));
  // 그릴 때·놓을 때 네 방향 회전은 인정, 뒤집기(거울상)는 인정 안 함
  function rotations(p) {
    const out = [];
    let q = p;
    for (let r = 0; r < 4; r++) { out.push(q); q = rotate(q); }
    return out;
  }
  // 뒤집기를 다른 블록으로 칠 때의 서로 다른 조각: 1~6칸 → 1, 1, 2, 7, 18, 60 종. 모두 같은 확률.
  const PIECES = {};
  for (let n = 1; n <= 6; n++) {
    const seen = new Set();
    PIECES[n] = [];
    for (const o of FREE[n].map(orientations).flat()) {
      const p = mk(n, o);
      if (seen.has(p.key)) continue;
      const group = [];
      for (const q of rotations(p)) {
        if (!seen.has(q.key)) { seen.add(q.key); group.push(q.cells); }
      }
      PIECES[n].push(group);
    }
  }
  const makePiece = (st, size) => mk(size, pick(st, pick(st, PIECES[size])));

  // ---- 점수 ----
  // 크기가 클수록 가파르게(삼각수). ★ 까다로운 모양(칸 수 / 차지하는 네모 영역 ≤ 5/9)은 1.5배 올림.
  const SIZE_POINTS = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15, 6: 21 };
  const TRICKY_RATIO = 5 / 9;
  const TRICKY_BONUS = 1.5;
  const isTricky = (p) => p.size >= 4 && p.size / (p.w * p.h) <= TRICKY_RATIO + 1e-9;
  const blockPoints = (p) => {
    const base = SIZE_POINTS[p.size] || p.size;
    return isTricky(p) ? Math.ceil(base * TRICKY_BONUS) : base;
  };

  // ---- 크기 선택지 확률 ----
  // 1~6칸 모드는 처음부터 큰 블록 위주. 난이도가 높을수록 + 판이 길어질수록(80턴까지) 큰 블록 쪽으로.
  const BASE_WEIGHTS = {
    "35": { 3: 1, 4: 1, 5: 1 },
    "16": { 1: 1, 2: 2, 3: 4, 4: 6, 5: 7, 6: 7 },
  };
  const LEVEL_PUSH = { 1: 0, 2: 0.4, 3: 0.8, 4: 1.2 };
  const GROWTH_TURNS = 80;
  const GROWTH_MAX = 1.0;
  // 정수로 바꿔 두면 기기마다 소수점 끝자리가 달라도 결과가 같다.
  function sizeWeights(mode, level, turn) {
    const { min, max } = MODES[mode];
    const push = LEVEL_PUSH[level] + GROWTH_MAX * Math.min(1, turn / GROWTH_TURNS);
    const w = {};
    for (let s = min; s <= max; s++) {
      w[s] = Math.round(BASE_WEIGHTS[mode][s] * Math.exp(push * (s - min) / (max - min)) * 1000);
    }
    return w;
  }
  function weightedPick(st, list, weights) {
    const total = list.reduce((sum, s) => sum + weights[s], 0);
    let r = Math.floor(rand(st) * total);
    for (const s of list) { r -= weights[s]; if (r < 0) return s; }
    return list[list.length - 1];
  }

  // ---- 보드 ----
  function fits(board, p, ax, ay) {
    return p.cells.every(([x, y]) => {
      const bx = ax + x, by = ay + y;
      return bx >= 0 && by >= 0 && bx < N && by < N && !board[by * N + bx];
    });
  }
  function anyFit(board, p) {
    for (let ay = 0; ay <= N - p.h; ay++) for (let ax = 0; ax <= N - p.w; ax++) if (fits(board, p, ax, ay)) return true;
    return false;
  }
  const fitsAnyRotation = (board, p) => rotations(p).some((q) => anyFit(board, q));
  function fullRows(b) {
    const idx = [], rows = [];
    for (let r = 0; r < N; r++) {
      let full = true;
      for (let c = 0; c < N; c++) if (!b[r * N + c]) { full = false; break; }
      if (full) { rows.push(r); for (let c = 0; c < N; c++) idx.push(r * N + c); }
    }
    return { lines: rows.length, idx, rows };
  }
  // 지운 줄을 빼고 위 블록들을 아래로 내린다. falls = [[도착 칸, 내려온 줄 수], ...] (애니메이션용)
  function collapse(board, rows) {
    const cleared = new Set(rows);
    const next = Array(N * N).fill(0), falls = [];
    let dest = N - 1;
    for (let r = N - 1; r >= 0; r--) {
      if (cleared.has(r)) continue;
      const shift = dest - r;
      for (let c = 0; c < N; c++) {
        const v = board[r * N + c];
        next[dest * N + c] = v;
        if (v && shift) falls.push([dest * N + c, shift]);
      }
      dest--;
    }
    return { board: next, falls };
  }

  // ---- 한 판의 상태 ----
  // st = { v, mode, level, seed, rng, slots, board, score, streak, turn, turnsLeft,
  //        phase: "size" | "shape" | "over", sizes, shapes, held, log }
  function create(opts) {
    const mode = MODES[opts.mode] ? opts.mode : "35";
    const level = LEVELS[opts.level] ? Number(opts.level) : 1;
    const seed = (opts.seed == null ? newSeed() : opts.seed) >>> 0;
    const slots = opts.slots === 1 ? 1 : 2;
    const st = {
      v: SUPPORTED.indexOf(opts.v) >= 0 ? opts.v : VERSION, mode, level, seed, rng: seed | 0,
      revives: 0,
      slots, slots0: slots,   // slots0 = 시작할 때 보관 칸 수(리플레이의 시작 조건)
      board: Array(N * N).fill(0),
      score: 0, streak: 0, turn: 0, turnsLeft: LEVELS[level].every,
      phase: "size", sizes: [], shapes: [], held: [], log: [],
    };
    drawSizes(st);
    return st;
  }
  // 검증기에 넘길 시작 조건
  const metaOf = (st) => ({ v: st.v || 1, mode: st.mode, level: st.level, seed: st.seed, slots: st.slots0 || st.slots });

  function drawSizes(st) {
    const { min, max } = MODES[st.mode];
    const all = [];
    for (let s = min; s <= max; s++) all.push(s);
    const weights = sizeWeights(st.mode, st.level, st.turn);
    const first = weightedPick(st, all, weights);
    const second = weightedPick(st, all.filter((s) => s !== first), weights);
    st.sizes = [first, second].sort((a, b) => a - b);
    st.shapes = [];
    st.phase = "size";
  }

  const items = (st) => st.phase === "shape"
    ? [...st.shapes.map((p, i) => ({ p, from: "s", i })), ...st.held.map((p, i) => ({ p, from: "h", i }))]
    : [];
  const isStuck = (st) => st.phase === "shape" && !items(st).some((it) => fitsAnyRotation(st.board, it.p));

  // 크기 고르기 → 그 크기의 블록 두 개(서로 회전해서 같은 모양이면 하나)
  function chooseSize(st, s) {
    if (st.phase !== "size" || st.sizes.indexOf(s) < 0) return false;
    st.log.push("c" + s);
    const a = makePiece(st, s);
    const aKeys = new Set(rotations(a).map((q) => q.key));
    let b = makePiece(st, s), tries = 0;
    while (aKeys.has(b.key) && tries++ < 30) b = makePiece(st, s);
    st.shapes = aKeys.has(b.key) ? [a] : [a, b];
    st.phase = "shape";
    if (isStuck(st)) st.phase = "over";
    return true;
  }

  // 화면에서 블록을 돌려 보여줄 때. 규칙과 무관해서 기록하지 않는다(놓을 때 회전을 다시 확인하므로).
  function rotateItem(st, from, i) {
    const arr = from === "h" ? st.held : st.shapes;
    if (arr[i]) arr[i] = rotate(arr[i]);
  }

  const encodeCells = (cells) => cells.map(([x, y]) => "" + x + y).join("");
  const decodeCells = (s) => {
    const out = [];
    for (let k = 0; k + 1 < s.length; k += 2) out.push([Number(s[k]), Number(s[k + 1])]);
    return out;
  };

  // 블록 놓기. cells 는 놓는 방향 그대로의 칸 목록(원점 기준 아니어도 됨), (ax, ay) 는 그 왼쪽 위.
  // 성공하면 화면이 애니메이션을 그릴 수 있게 중간 과정까지 돌려준다. 규칙 위반이면 null.
  function place(st, from, i, cells, ax, ay) {
    if (st.phase !== "shape") return null;
    const arr = from === "h" ? st.held : st.shapes;
    const base = arr[i];
    if (!base) return null;
    const n = normalize(cells);
    const key = JSON.stringify(n);
    if (n.length !== base.size || !rotations(base).some((q) => q.key === key)) return null;
    const p = mk(base.size, n);
    if (!fits(st.board, p, ax, ay)) return null;

    st.log.push("p" + from + i + "." + encodeCells(n) + "." + ax + ay);
    if (from === "h") st.held.splice(i, 1);
    const placedIdx = p.cells.map(([x, y]) => (ay + y) * N + ax + x);
    placedIdx.forEach((k) => { st.board[k] = p.size; });
    const boardPlaced = st.board.slice();

    let gained = blockPoints(p);
    const { lines, idx, rows } = fullRows(st.board);
    let falls = [];
    if (lines) {
      st.streak++;
      gained += 10 * lines * lines * st.streak;
      const c = collapse(st.board, rows);
      st.board = c.board;
      falls = c.falls;
    } else {
      st.streak = 0;
    }
    gained = Math.round(gained * LEVELS[st.level].mult);
    st.score += gained;
    const boardCleared = st.board.slice();
    const garbage = endTurn(st);
    return { p, placedIdx, gained, lines, streak: st.streak, clearIdx: idx, falls, boardPlaced, boardCleared, garbage, turn: st.turn };
  }

  // 이어하기 (규칙 버전 2부터). 게임오버 상태에서 빈칸에 1~3칸(가로·세로로 붙은 모양)을 그려 놓는다.
  // 블록 점수는 없고, 줄을 지우면 줄 점수는 평소처럼. 그다음은 한 턴이 끝난 것과 같다(방해 블록·새 크기 선택).
  const canRevive = (st) => st.v >= 2 && st.phase === "over" && (st.revives || 0) < REVIVE_PER_GAME;
  function connectedCells(cells) {
    const key = (x, y) => x + "," + y;
    const all = new Set(cells.map(([x, y]) => key(x, y)));
    const seen = new Set([key(cells[0][0], cells[0][1])]);
    const stack = [cells[0]];
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(x + dx, y + dy);
        if (all.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); }
      }
    }
    return seen.size === all.size;
  }
  function revive(st, cells, ax, ay) {
    if (!canRevive(st) || !cells || cells.length < 1 || cells.length > REVIVE_MAX_CELLS) return null;
    const n = normalize(cells);
    if (new Set(n.map((c) => c.join(","))).size !== n.length || !connectedCells(n)) return null;
    const p = mk(n.length, n);
    if (!fits(st.board, p, ax, ay)) return null;

    st.log.push("v" + encodeCells(n) + "." + ax + ay);
    st.revives = (st.revives || 0) + 1;
    const placedIdx = p.cells.map(([x, y]) => (ay + y) * N + ax + x);
    placedIdx.forEach((k) => { st.board[k] = p.size; });
    const boardPlaced = st.board.slice();

    let gained = 0;
    const { lines, idx, rows } = fullRows(st.board);
    let falls = [];
    if (lines) {
      st.streak++;
      gained += 10 * lines * lines * st.streak;
      const c = collapse(st.board, rows);
      st.board = c.board;
      falls = c.falls;
    } else {
      st.streak = 0;
    }
    gained = Math.round(gained * LEVELS[st.level].mult);
    st.score += gained;
    const boardCleared = st.board.slice();
    const garbage = endTurn(st);
    return { p, placedIdx, gained, lines, streak: st.streak, clearIdx: idx, falls, boardPlaced, boardCleared, garbage, turn: st.turn };
  }

  // 보관: 그 턴은 아무것도 놓지 않고 넘어간다(방해 블록 턴은 흐른다).
  function store(st, i) {
    if (st.phase !== "shape" || !st.shapes[i] || st.held.length >= st.slots) return null;
    st.log.push("s" + i);
    st.held.push(st.shapes[i]);
    st.shapes = [];
    const garbage = endTurn(st);
    return { garbage, turn: st.turn };
  }

  // 보관 칸 수가 바뀜(앱에서 구독 시작·종료). 이것도 기록해야 리플레이가 맞는다.
  function setSlots(st, n) {
    n = n === 1 ? 1 : 2;
    if (st.slots === n) return;
    st.log.push("k" + n);
    st.slots = n;
  }

  function endTurn(st) {
    st.turn++;
    const garbage = spawnGarbage(st);
    drawSizes(st);
    return garbage;
  }

  function spawnGarbage(st) {
    const L = LEVELS[st.level];
    if (!L.every) return [];
    st.turnsLeft--;
    if (st.turnsLeft > 0) return [];
    st.turnsLeft = L.every;
    const added = [];
    for (let k = 0; k < L.count; k++) {
      // 빈칸이 2개 이상인 줄에만 → 방해 블록이 혼자 줄을 완성하지 않는다
      const options = [];
      for (let r = 0; r < N; r++) {
        const empties = [];
        for (let c = 0; c < N; c++) if (!st.board[r * N + c]) empties.push(r * N + c);
        if (empties.length >= 2) options.push(...empties);
      }
      if (!options.length) break;
      const i = pick(st, options);
      st.board[i] = 9;
      added.push(i);
    }
    return added;
  }

  // ---- 리플레이 (검증용) ----
  // meta = { v, mode, level, seed, slots }, log = st.log 과 같은 형식(배열 또는 ";" 로 이은 문자열)
  // → { ok, score, turn, error }
  function replay(meta, log) {
    if (SUPPORTED.indexOf(meta.v) < 0) return { ok: false, error: "version" };
    const st = create({ v: meta.v, mode: meta.mode, level: meta.level, seed: meta.seed, slots: meta.slots });
    const acts = Array.isArray(log) ? log : String(log || "").split(";").filter(Boolean);
    for (let k = 0; k < acts.length; k++) {
      const a = acts[k];
      let ok = false;
      if (a[0] === "c") ok = chooseSize(st, Number(a.slice(1)));
      else if (a[0] === "s") ok = !!store(st, Number(a.slice(1)));
      else if (a[0] === "k") { const n = Number(a.slice(1)); ok = n === 1 || n === 2; if (ok) setSlots(st, n); }
      else if (a[0] === "v") {
        const parts = a.slice(1).split(".");
        const pos = parts[1] || "";
        ok = pos.length === 2 && !!revive(st, decodeCells(parts[0] || ""), Number(pos[0]), Number(pos[1]));
      }
      else if (a[0] === "p") {
        const parts = a.split(".");
        const from = parts[0][1], i = Number(parts[0].slice(2));
        const cells = decodeCells(parts[1] || "");
        const pos = parts[2] || "";
        ok = (from === "s" || from === "h") && pos.length === 2
          && !!place(st, from, i, cells, Number(pos[0]), Number(pos[1]));
      }
      if (!ok) return { ok: false, error: "bad action #" + k + " " + a, score: st.score, turn: st.turn };
    }
    return { ok: true, score: st.score, turn: st.turn, phase: st.phase };
  }

  // 한 판에서 나올 수 있는 점수의 느슨한 상한(서버 규칙과 같은 식). 이보다 크면 볼 것도 없이 거짓.
  // 턴당: 가장 비싼 블록 32점 + 줄 보너스 10×(최대 6줄)²×연속(≤턴 수), 여기에 난이도 배율.
  const maxScore = (level, turns) => Math.ceil(LEVELS[level].mult * (32 * turns + 360 * turns * (turns + 1) / 2));

  const Engine = {
    VERSION, SUPPORTED, N, MODES, LEVELS, GROWTH_TURNS, REVIVE_MAX_CELLS,
    create, chooseSize, place, store, setSlots, rotateItem, replay, revive, canRevive,
    items, isStuck, fits, anyFit, fitsAnyRotation, fullRows,
    mk, normalize, rotate, rotations, blockPoints, isTricky, SIZE_POINTS,
    encodeCells, decodeCells, newSeed, maxScore, metaOf,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof globalThis !== "undefined" ? globalThis : this);
