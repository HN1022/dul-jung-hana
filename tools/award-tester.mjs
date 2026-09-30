// 베타 테스터 칭호 주기 — 비공개 테스트에 참여한 사람들에게 한 번만 준다 (.github/workflows/tester-title.yml)
//
// 시즌 칭호(award-titles.mjs)와 달리 등수와 상관없이, 기록을 한 번이라도 올린 사람 모두에게 준다.
//   titles/{uid} = { list: [{ k: "tester" }, ...], pick: 달고 있는 칭호 번호 }
// 화면에는 "베타 테스터"로 보인다(글자는 i18n.js 의 title_tester). 같은 칭호를 두 번 주지 않으니 다시 돌려도 안전.
//
//   UNTIL=2026-10-31 DRY_RUN=1 node tools/award-tester.mjs   → 누구에게 줄지 출력만
//
// UNTIL 은 "이 날(한국 시간)까지 기록을 올린 사람"을 고르는 마감선이다. 안 주면 지금까지 전부.
// 출시하고 나면 절대 다시 돌리지 말 것 — 일반 이용자까지 테스터 칭호를 받는다.
import { Firestore } from "@google-cloud/firestore";

const PROJECT = "either-or-130af";
const UNTIL = process.env.UNTIL || "";
const DRY = process.env.DRY_RUN === "1";
if (UNTIL && !/^\d{4}-\d{2}-\d{2}$/.test(UNTIL)) throw new Error(`UNTIL 은 2026-10-31 같은 모양이어야 해요 (받은 값: "${UNTIL}")`);

// 한국 시간 그 날 23:59:59 까지
const until = UNTIL ? new Date(`${UNTIL}T23:59:59+09:00`) : new Date();

const db = new Firestore({ projectId: PROJECT });
const snap = await db.collection("scores").get();

// uid 마다 한 번씩. 닉네임은 가장 최근에 올린 기록의 것을 쓴다(로그에만 보인다).
const people = new Map();
for (const doc of snap.docs) {
  const d = doc.data();
  const at = d.at && d.at.toDate ? d.at.toDate() : null;
  if (!d.uid || (at && at > until)) continue;
  const cur = people.get(d.uid);
  if (!cur || (at && cur.at && at > cur.at)) people.set(d.uid, { name: d.name, at });
}

console.log(`베타 테스터 칭호 · 대상 ${people.size}명 (${UNTIL ? UNTIL + " 까지" : "지금까지"})${DRY ? " (DRY_RUN — 실제로 주지 않음)" : ""}`);
for (const [uid, p] of people) console.log(`  ${p.name}  (${uid.slice(0, 8)}…)`);
if (DRY) process.exit(0);

let given = 0;
for (const uid of people.keys()) {
  const ref = db.collection("titles").doc(uid);
  await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    const list = cur.exists ? cur.data().list || [] : [];
    if (list.some((t) => t.k === "tester")) return;   // 이미 줌
    list.push({ k: "tester" });
    const pick = cur.exists && typeof cur.data().pick === "number" ? cur.data().pick : 0;
    tx.set(ref, { list, pick });
    given++;
  });
}
console.log(`새로 준 칭호 ${given}개`);
