// 순위표 점수 검증 (2단계) — 매일 밤 GitHub 자동 작업이 돌린다 (.github/workflows/firebase.yml)
//
// 아직 검증 안 된(status "pending") 기록마다, 함께 올라온 seed + 행동 기록을 게임 규칙 엔진(engine.js)으로
// 처음부터 다시 돌려 본다. 다시 돌린 점수·턴 수가 올라온 값과 같으면 "ok"(✓ 표시), 다르면 조작으로 보고 삭제.
//
//   DRY_RUN=1 node tools/verify-scores.mjs   → 지우거나 고치지 않고 결과만 출력
//
// 인증: 비밀 키 없이 GitHub ↔ 구글 클라우드 신뢰 연동(Workload Identity)으로 받은 임시 자격증명을 쓴다.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT = "either-or-130af";
const DRY = process.env.DRY_RUN === "1";

// engine.js 는 브라우저용 스크립트라 격리된 상자(vm)에서 실행해 Engine 을 꺼낸다 — 게임 화면과 똑같은 코드.
const box = {};
vm.createContext(box);
vm.runInContext(readFileSync(new URL("../engine.js", import.meta.url), "utf8"), box);
const Engine = box.Engine;

initializeApp({ credential: applicationDefault(), projectId: PROJECT });
const db = getFirestore();

const snap = await db.collection("scores").where("status", "==", "pending").get();
let ok = 0, removed = 0, skipped = 0;
const lines = [];
for (const doc of snap.docs) {
  const d = doc.data();
  if (d.v !== Engine.VERSION) {
    // 다른 규칙 버전으로 한 판 — 그 버전 엔진이 있어야 검증 가능. 건드리지 않는다.
    skipped++;
    continue;
  }
  let r;
  try {
    r = Engine.replay({ v: d.v, mode: d.mode, level: d.level, seed: d.seed, slots: d.slots }, d.log);
  } catch (e) {
    r = { ok: false, error: "crash: " + (e && e.message) };
  }
  const good = r.ok && r.score === d.score && r.turn === d.turns;
  if (good) {
    ok++;
    if (!DRY) await doc.ref.update({ status: "ok", verifiedAt: FieldValue.serverTimestamp() });
  } else {
    removed++;
    lines.push(`  ✗ ${doc.id}  "${d.name}"  올라온 점수 ${d.score}/${d.turns}턴  다시 돌린 점수 ${r.score ?? "-"}/${r.turn ?? "-"}턴  ${r.error || ""}`);
    if (!DRY) await doc.ref.delete();
  }
}

console.log(`검증할 기록 ${snap.size}개${DRY ? " (DRY_RUN — 실제로 바꾸지 않음)" : ""}`);
console.log(`  ✓ 통과 ${ok}  ·  ✗ 삭제 ${removed}  ·  건너뜀(다른 버전) ${skipped}`);
if (lines.length) console.log(lines.join("\n"));
