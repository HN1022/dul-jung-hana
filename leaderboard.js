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
  // 구글 로그인(웹) — Google Identity Services 가 쓰는 공개 클라이언트 ID. 승인된 출처: hn1022.github.io, localhost:8123
  const GOOGLE_CLIENT_ID = "204724489972-d4v4ukg3ejq07q65ruvib7dr1kd8hgl9.apps.googleusercontent.com";
  const IDP = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FB.apiKey}`;
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
        a = { uid: j.user_id, idToken: j.id_token, refreshToken: j.refresh_token, exp: now + Number(j.expires_in) * 1000, google: a.google };
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
  const googleInfo = () => (ls.get(AUTH_KEY) || {}).google || null;

  // ---- 구글 연동 ----
  // 지금 기기의 익명 계정에 구글 계정을 "연결"한다 → uid 가 그대로라 지금까지의 순위표 기록이 유지된다.
  // 그 구글 계정이 이미 다른 기기에서 연결돼 있으면 그 계정으로 로그인한다(폰을 바꾼 경우) → 기록이 이어진다.
  async function linkGoogle(googleIdToken) {
    const a = await token();
    const call = (withAnon) => fetch(IDP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({
        postBody: "id_token=" + encodeURIComponent(googleIdToken) + "&providerId=google.com",
        requestUri: location.origin, returnSecureToken: true,
      }, withAnon ? { idToken: a.idToken } : {})),
    }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));
    const errOf = (x) => (x.j && (x.j.errorMessage || (x.j.error && x.j.error.message))) || "";
    let res = await call(true);
    let switched = false;
    if (!res.ok || errOf(res)) {
      if (!/FEDERATED_USER_ID_ALREADY_LINKED|CREDENTIAL_ALREADY_IN_USE/.test(errOf(res))) throw new Error(errOf(res) || "link failed");
      res = await call(false);
      if (!res.ok || errOf(res)) throw new Error(errOf(res) || "sign-in failed");
      switched = res.j.localId !== a.uid;
    }
    const j = res.j;
    ls.set(AUTH_KEY, {
      uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken,
      exp: Date.now() + Number(j.expiresIn || 3600) * 1000,
      google: { email: j.email || "", name: j.displayName || j.fullName || "" },
    });
    if (switched) {
      // 다른 계정으로 들어왔으니 "이미 올린 점수" 기억을 비우고, 그 계정이 선점한 닉네임을 가져온다
      ls.set(SENT_KEY, {});
      const mine = await myClaims().catch(() => []);
      if (mine[0]) setName(mine[0]);
    } else if (getName()) {
      // 연동한 김에 지금 닉네임을 내 것으로 선점
      const c = await claimName(getName()).catch(() => ({ ok: false }));
      if (!c.ok) return { switched, nameTaken: true };
    }
    flush();
    return { switched };
  }

  // ---- 닉네임 선점 (구글 연동한 사람만) ----
  // names/{닉네임 소문자} = { uid, name }. 서버 규칙이 남이 선점한 닉네임으로는 점수를 못 올리게 막는다.
  const nameKey = (n) => String(n).toLowerCase();
  async function nameOwner(name) {
    const r = await fetch(`${DOCS}/names/${encodeURIComponent(nameKey(name))}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("names " + r.status);
    const j = await r.json();
    return (j.fields && j.fields.uid && j.fields.uid.stringValue) || null;
  }
  async function myClaims() {
    const uid = myUid();
    if (!uid) return [];
    const r = await fetch(`${DOCS}:runQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: "names" }],
        where: { fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: uid } } },
        limit: 20,
      } }),
    });
    if (!r.ok) return [];
    return (await r.json()).filter((x) => x.document).map((x) => x.document.fields.name.stringValue);
  }
  async function claimName(name) {
    if (!googleInfo()) return { ok: true };   // 연동 안 한 사람은 선점하지 않는다
    const a = await token();
    const owner = await nameOwner(name);
    if (owner && owner !== a.uid) return { ok: false, reason: "taken" };
    const writes = [];
    if (!owner) {
      writes.push({
        update: { name: `projects/${FB.projectId}/databases/(default)/documents/names/${nameKey(name)}`,
          fields: { uid: fStr(a.uid), name: fStr(name) } },
        currentDocument: { exists: false },
      });
    }
    // 예전에 선점했던 다른 닉네임은 놓아준다
    for (const old of await myClaims()) {
      if (nameKey(old) !== nameKey(name)) writes.push({ delete: `projects/${FB.projectId}/databases/(default)/documents/names/${nameKey(old)}` });
    }
    if (!writes.length) return { ok: true };
    const r = await fetch(`${DOCS}:commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.idToken },
      body: JSON.stringify({ writes }),
    });
    return r.ok ? { ok: true } : { ok: false, reason: "taken" };
  }

  // 닉네임 저장: 모양 검사 → (온라인이면) 남이 선점했는지 확인 → 구글 연동 상태면 선점
  async function saveName(raw) {
    const c = checkName(raw);
    if (!c.ok) return c;
    try {
      if (typeof navigator === "undefined" || navigator.onLine !== false) {
        const owner = await nameOwner(c.name);
        if (owner && owner !== myUid()) return { ok: false, reason: "taken" };
        if (googleInfo()) {
          const cl = await claimName(c.name);
          if (!cl.ok) return cl;
        }
      }
    } catch (e) { /* 오프라인 등 — 일단 저장하고 나중에 올릴 때 서버가 판단 */ }
    setName(c.name);
    return { ok: true, name: c.name };
  }

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
    // 구글 연동으로 선점된 닉네임 목록 → 그 주인이 올린 기록에 🛡 표시
    const owners = {};
    try {
      const nr = await fetch(`${DOCS}:runQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "names" }], limit: 1000 } }),
      });
      if (nr.ok) (await nr.json()).filter((x) => x.document).forEach((x) => {
        owners[nameKey(x.document.fields.name.stringValue)] = x.document.fields.uid.stringValue;
      });
    } catch (e) {}
    return rows.filter((x) => x.document).map((x) => {
      const f = x.document.fields || {};
      const uid = val(f.uid), name = val(f.name);
      return {
        uid, name, score: val(f.score) || 0,
        mode: val(f.mode), level: val(f.level), verified: val(f.status) === "ok",
        owned: !!name && owners[nameKey(name)] === uid,
      };
    });
  }

  // 인터넷이 다시 연결되면 밀린 기록을 보낸다
  if (typeof window !== "undefined") window.addEventListener("online", () => { flush(); });

  window.Board = { checkName, getName, setName, saveName, queue, flush, top, myUid, pendingCount, isPending,
    linkGoogle, googleInfo, GOOGLE_CLIENT_ID };
})();
