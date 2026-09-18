// 시즌 칭호 주기 — 시즌(한 달)이 끝나면 관리자가 GitHub 에서 손으로 돌린다 (.github/workflows/titles.yml)
//
// 그 시즌의 순위표(크기 모드 × 난이도)마다 검증 통과(✓) 기록 1~TOP 등에게 칭호를 준다.
//   titles/{uid} = { list: [{ s: "2026-09", b: "35_1", r: 1 }, ...], pick: 달고 있는 칭호 번호 }
// 화면에는 "26년 9월 1등"처럼 보인다(글자는 i18n.js 의 title_label). 같은 칭호를 두 번 주지 않으니 다시 돌려도 안전.
// 처음 칭호를 받은 사람은 그 칭호를 바로 단다(pick = 0). 이미 칭호가 있으면 고른 것을 그대로 둔다.
//
//   SEASON=2026-09 TOP=3 DRY_RUN=1 node tools/award-titles.mjs   → 누구에게 줄지 출력만
import { Firestore } from "@google-cloud/firestore";

const PROJECT = "either-or-130af";
const SEASON = process.env.SEASON || "";
const TOP = Number(process.env.TOP || 0);
const DRY = process.env.DRY_RUN === "1";
if (!/^\d{4}-\d{2}$/.test(SEASON)) throw new Error(`SEASON 은 2026-09 같은 모양이어야 해요 (받은 값: "${SEASON}")`);
if (!(TOP >= 1 && TOP <= 100)) throw new Error(`TOP 은 1~100 (받은 값: "${process.env.TOP}")`);

const db = new Firestore({ projectId: PROJECT });
const snap = await db.collection("scores").where("season", "==", SEASON).get();

// 순위표별로 모아서 점수 높은 순. 검증 안 된 기록(pending)은 빼고, 같은 점수면 먼저 올린 사람이 위.
const boards = {};
for (const doc of snap.docs) {
  const d = doc.data();
  if (d.status !== "ok") continue;
  (boards[`${d.mode}_${d.level}`] ||= []).push(d);
}
const awards = [];
for (const [b, rows] of Object.entries(boards).sort()) {
  rows.sort((x, y) => y.score - x.score || x.at.toMillis() - y.at.toMillis());
  rows.slice(0, TOP).forEach((d, i) => awards.push({ uid: d.uid, name: d.name, score: d.score, b, r: i + 1 }));
}

console.log(`시즌 ${SEASON} · 순위표별 1~${TOP}등 · 받을 사람 ${awards.length}명${DRY ? " (DRY_RUN — 실제로 주지 않음)" : ""}`);
for (const a of awards) console.log(`  ${a.b.replace("_", "칸 Lv").replace("35", "3~5").replace("16", "1~6")}  ${a.r}등  ${a.name}  ${a.score}점`);
if (DRY) process.exit(0);

let given = 0;
for (const a of awards) {
  const ref = db.collection("titles").doc(a.uid);
  await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    const list = cur.exists ? cur.data().list || [] : [];
    if (list.some((t) => t.s === SEASON && t.b === a.b)) return;   // 이미 줌
    list.push({ s: SEASON, b: a.b, r: a.r });
    const pick = cur.exists && typeof cur.data().pick === "number" ? cur.data().pick : 0;
    tx.set(ref, { list, pick });
    given++;
  });
}
console.log(`새로 준 칭호 ${given}개`);
