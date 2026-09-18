// 순위표 점수 검증 (2단계) — 매일 밤 GitHub 자동 작업이 돌린다 (.github/workflows/firebase.yml)
//
// 아직 검증 안 된(status "pending") 기록마다, 함께 올라온 seed + 행동 기록을 게임 규칙 엔진(engine.js)으로
// 처음부터 다시 돌려 본다. 다시 돌린 점수·턴 수가 올라온 값과 같으면 "ok"(✓ 표시), 다르면 조작으로 보고 삭제.
//
//   DRY_RUN=1 node tools/verify-scores.mjs   → 지우거나 고치지 않고 결과만 출력
//   바로 돌리고 싶으면: GitHub → Actions → "순위표 규칙·검증" → Run workflow (이 파일이나 engine.js 를 고쳐 올려도 돈다)
//
// 인증: 비밀 키 없이 GitHub ↔ 구글 클라우드 신뢰 연동(Workload Identity)으로 받은 임시 자격증명을 쓴다.
import { readFileSync } from "node:fs";
import vm from "node:vm";
// firebase-admin 은 키 없는 연동(external_account) 자격증명을 못 읽어서, 구글 공식 Firestore 도구를 바로 쓴다.
import { Firestore, FieldValue } from "@google-cloud/firestore";

const PROJECT = "either-or-130af";
const DRY = process.env.DRY_RUN === "1";

// engine.js 는 브라우저용 스크립트라 격리된 상자(vm)에서 실행해 Engine 을 꺼낸다 — 게임 화면과 똑같은 코드.
const box = {};
vm.createContext(box);
vm.runInContext(readFileSync(new URL("../engine.js", import.meta.url), "utf8"), box);
const Engine = box.Engine;

const db = new Firestore({ projectId: PROJECT });

// 시즌 없는 기록(시즌 도입 전 앱이 올린 것): 문서 id 에 시즌이 없다 → 올린 날짜(한국 시간)의 시즌으로 옮긴다.
const seasonOf = (date) => new Date(date.getTime() + 9 * 3600e3).toISOString().slice(0, 7);
let moved = 0;
for (const doc of (await db.collection("scores").get()).docs) {
  const d = doc.data();
  if (d.season) continue;
  const season = seasonOf(d.at && d.at.toDate ? d.at.toDate() : new Date());
  if (!DRY) {
    // 같은 사람·순위표·시즌에 새 앱으로 올린 기록이 이미 있으면 더 높은 점수만 남긴다
    const target = db.collection("scores").doc(`${doc.id}_${season}`);
    const cur = await target.get();
    if (!cur.exists || cur.data().score < d.score) await target.set({ ...d, season });
    await doc.ref.delete();
  }
  moved++;
}
if (moved) console.log(`시즌 없는 옛 기록 ${moved}개를 시즌 문서로 옮김${DRY ? " (DRY_RUN)" : ""}`);

const snap = await db.collection("scores").where("status", "==", "pending").get();
let ok = 0, removed = 0, skipped = 0;
const lines = [];
for (const doc of snap.docs) {
  const d = doc.data();
  if (!Engine.SUPPORTED.includes(d.v)) {
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

