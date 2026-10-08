// 월 테마 소장 주기 — 한 달이 끝나면 관리자가 GitHub 에서 손으로 돌린다 (.github/workflows/themes.yml)
//
// 그 달에 **검증을 통과한 기록(status: ok)** 을 올린 사람 모두에게 그 달 테마를 영구 소장시킨다.
//   titles/{uid}.owned 에 "m10-2026" 처럼 넣는다. 연도가 붙어 있어서 같은 단풍이어도 해마다 다른 수집품이다.
//   (그 달에는 누구나 그 테마를 쓸 수 있다. 소장은 "그 뒤로도 계속 쓸 수 있다"는 뜻이다.)
//
// 등수와 무관하다 — 등수 보상은 칭호(award-titles.mjs)와 재질(순위에서 바로 계산)이 맡는다.
// 같은 것을 두 번 넣지 않으니 다시 돌려도 안전하다.
//
//   SEASON=2026-10 DRY_RUN=1 node tools/award-themes.mjs   → 누구에게 줄지 출력만
import { Firestore } from "@google-cloud/firestore";

const PROJECT = "either-or-130af";
const SEASON = process.env.SEASON || "";
const DRY = process.env.DRY_RUN === "1";
if (!/^\d{4}-\d{2}$/.test(SEASON)) throw new Error(`SEASON 은 2026-10 같은 모양이어야 해요 (받은 값: "${SEASON}")`);

const [year, month] = SEASON.split("-").map(Number);
const KEY = `m${month}-${year}`;

const db = new Firestore({ projectId: PROJECT });
const snap = await db.collection("scores").where("season", "==", SEASON).get();

// uid 마다 한 번씩. 닉네임은 로그에만 쓴다.
const people = new Map();
for (const doc of snap.docs) {
  const d = doc.data();
  if (d.status !== "ok" || !d.uid) continue;      // 검증 통과한 기록만 인정
  if (!people.has(d.uid)) people.set(d.uid, d.name);
}

console.log(`시즌 ${SEASON} · 테마 "${KEY}" · 받을 사람 ${people.size}명${DRY ? " (DRY_RUN — 실제로 주지 않음)" : ""}`);
for (const [uid, name] of people) console.log(`  ${name}  (${uid.slice(0, 8)}…)`);
if (DRY) process.exit(0);

let given = 0;
for (const uid of people.keys()) {
  const ref = db.collection("titles").doc(uid);
  await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    const data = cur.exists ? cur.data() : {};
    const owned = data.owned || [];
    if (owned.includes(KEY)) return;              // 이미 줌
    owned.push(KEY);
    // 칭호가 아직 없는 사람도 있다. 문서가 없으면 빈 칭호 목록과 함께 만든다.
    tx.set(ref, { list: data.list || [], pick: typeof data.pick === "number" ? data.pick : 0, owned }, { merge: true });
    given++;
  });
}
console.log(`새로 준 테마 ${given}개`);
