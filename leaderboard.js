/* 온라인 순위표 — 「둘 중 하나」
 *
 * Firebase(Firestore)에 점수를 올리고 순위를 읽어 온다. 라이브러리 없이 REST 로만 통신해서
 * 오프라인일 때는 아무것도 안 불러오고, 게임은 지금처럼 그대로 돈다.
 *
 * 흐름:
 *   - 기기마다 익명 로그인(가입 없음) → uid 하나. 닉네임은 이 기기에 저장.
 *   - 게임오버 → 그 판의 점수 + 행동 기록(리플레이)을 "보낼 편지함(outbox)"에 넣고, 인터넷이 되면 보낸다.
 *   - 한 사람은 (크기 모드 × 난이도) 순위표마다 최고 기록 하나만 가진다. 문서 id = uid_모드_난이도
 *   - 서버 규칙(firestore.rules)이 말이 안 되는 점수를 거부하고,
 *     밤마다 GitHub 가 리플레이를 다시 돌려(tools/verify-scores.mjs) 조작된 기록을 지운다.
 *
 * 게임은 window.Board 만 쓴다.
 */
(() => {
  // 웹 앱 설정값: 공개돼도 되는 식별자다(보안은 서버 규칙이 맡는다).
  const FB = {
    apiKey: "AIzaSyCYShLF-w3Hxm3TYqZ_QVs9B29MpUewicw",
    projectId: "either-or-130af",
  };
  const DOCS = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
  const AUTH_KEY = "duljunghana-auth";
  const NAME_KEY = "duljunghana-name";
  const OUTBOX_KEY = "duljunghana-outbox";
  const SENT_KEY = "duljunghana-sent";   // 순위표별로 내가 이미 올린 최고 점수

  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  // ---- 닉네임 ----
  // 2~10자, 한글·영문·숫자·공백·_·- 만. 욕설은 기본적인 것만 거른다.
  const BAD = ["시발", "씨발", "ㅅㅂ", "병신", "ㅂㅅ", "좆", "존나", "개새", "애미", "니미", "fuck", "shit", "bitch", "nigg", "sex", "섹스", "자지", "보지"];
  function checkName(raw) {
    const name = String(raw || "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 10) return { ok: false, reason: "length" };
    if (!/^[0-9A-Za-z가-힣 _\-]+$/.test(name)) return { ok: false, reason: "chars" };
    const flat = name.toLowerCase().replace(/[\s_\-0-9]/g, "");
    if (BAD.some((w) => flat.includes(w))) return { ok: false, reason: "bad" };
    return { ok: true, name };
  }
  const getName = () => ls.get(NAME_KEY) || "";
  const setName = (n) => ls.set(NAME_KEY, n);

  // ---- 익명 로그인 (REST) ----
  async function token() {
    let a = ls.get(AUTH_KEY);
    const now = Date.now();
    if (a && a.idToken && a.exp > now + 60000) return a;
    if (a && a.refreshToken) {
      const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FB.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(a.refreshToken),
      });
      if (r.ok) {
        const j = await r.json();
        a = { uid: j.user_id, idToken: j.id_token, refreshToken: j.refresh_token, exp: now + Number(j.expires_in) * 1000 };
        ls.set(AUTH_KEY, a);
        return a;
      }
    }
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!r.ok) throw new Error("auth " + r.status);
    const j = await r.json();
    a = { uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, exp: now + Number(j.expiresIn) * 1000 };
    ls.set(AUTH_KEY, a);
    return a;
  }
  const myUid = () => (ls.get(AUTH_KEY) || {}).uid || null;

  // ---- 점수 올리기 ----
  const boardId = (mode, level) => mode + "_" + level;
  // 게임오버 때 부른다. 올릴 가치가 있으면(이 순위표에서 내 최고 기록) 편지함에 넣고 보내 본다.
  function queue(G) {
    if (!G || G.unranked || !(G.score > 0) || !(G.turn > 0)) return { queued: false, reason: "none" };
    const id = boardId(G.mode, G.level);
    const sent = ls.get(SENT_KEY) || {};
    const outbox = ls.get(OUTBOX_KEY) || {};
    const bestKnown = Math.max(sent[id] || 0, (outbox[id] && outbox[id].score) || 0);
    if (G.score <= bestKnown) return { queued: false, reason: "lower" };
    outbox[id] = {
      mode: G.mode, level: G.level, score: G.score, turns: G.turn,
      seed: G.seed, slots: G.slots0 || G.slots, v: G.v, log: G.log.join(";"),
    };
    ls.set(OUTBOX_KEY, outbox);
    return { queued: true };
  }
  const pendingCount = () => Object.keys(ls.get(OUTBOX_KEY) || {}).length;
  const isPending = (mode, level) => !!(ls.get(OUTBOX_KEY) || {})[boardId(mode, level)];

  const fStr = (v) => ({ stringValue: String(v) });
  const fInt = (v) => ({ integerValue: String(Math.trunc(v)) });

  let flushing = null;
  // 편지함에 있는 기록을 보낸다. 닉네임이 없으면 기다린다. 인터넷이 없으면 조용히 실패하고 다음에 다시.
  function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      const name = getName();
      const outbox = ls.get(OUTBOX_KEY) || {};
      const ids = Object.keys(outbox);
      if (!name || !ids.length) return { sent: 0 };
      if (typeof navigator !== "undefined" && navigator.onLine === false) return { sent: 0, offline: true };
      const a = await token();
      let sentCount = 0;
      for (const id of ids) {
        const e = outbox[id];
        const docName = `projects/${FB.projectId}/databases/(default)/documents/scores/${a.uid}_${id}`;
        const body = {
          writes: [{
            update: {
              name: docName,
              fields: {
                uid: fStr(a.uid), name: fStr(name), score: fInt(e.score), mode: fStr(e.mode),
                level: fInt(e.level), turns: fInt(e.turns), seed: fInt(e.seed), slots: fInt(e.slots),
                v: fInt(e.v), log: fStr(e.log), status: fStr("pending"),
              },
            },
            updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }],
          }],
        };
        const r = await fetch(`${DOCS}:commit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.idToken },
          body: JSON.stringify(body),
        });
        const cur = ls.get(OUTBOX_KEY) || {};
        if (r.ok || r.status === 403) {
          // 403 = 서버 규칙 거부(이미 더 높은 기록이 있거나, 너무 자주 올림 등) → 다시 보내도 소용없음
          if (r.ok) {
            const sent = ls.get(SENT_KEY) || {};
            sent[id] = Math.max(sent[id] || 0, e.score);
            ls.set(SENT_KEY, sent);
            sentCount++;
          }
          if (cur[id] && cur[id].score === e.score) delete cur[id];
          ls.set(OUTBOX_KEY, cur);
        }
      }
      return { sent: sentCount };
    })().catch((err) => ({ sent: 0, error: String(err && err.message || err) }))
      .finally(() => { flushing = null; });
    return flushing;
  }

  // ---- 순위 읽기 ----
  const val = (f) => {
    if (!f) return null;
    if ("stringValue" in f) return f.stringValue;
    if ("integerValue" in f) return Number(f.integerValue);
    if ("doubleValue" in f) return Number(f.doubleValue);
    if ("timestampValue" in f) return f.timestampValue;
    return null;
  };
  // 점수 높은 순 상위 limit 개. 행동 기록(log)은 크니까 빼고 받는다.
  async function top(limit = 200) {
    const r = await fetch(`${DOCS}:runQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "scores" }],
          select: { fields: ["uid", "name", "score", "mode", "level", "status"].map((fieldPath) => ({ fieldPath })) },
          orderBy: [{ field: { fieldPath: "score" }, direction: "DESCENDING" }],
          limit,
        },
      }),
    });
    if (!r.ok) throw new Error("top " + r.status);
    const rows = await r.json();
    return rows.filter((x) => x.document).map((x) => {
      const f = x.document.fields || {};
      return {
        uid: val(f.uid), name: val(f.name), score: val(f.score) || 0,
        mode: val(f.mode), level: val(f.level), verified: val(f.status) === "ok",
      };
    });
  }

  // 인터넷이 다시 연결되면 밀린 기록을 보낸다
  if (typeof window !== "undefined") window.addEventListener("online", () => { flush(); });

  window.Board = { checkName, getName, setName, queue, flush, top, myUid, pendingCount, isPending };
})();
