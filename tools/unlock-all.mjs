// 개발자 전체 해금 — 한 번만 손으로 돌린다
//
//   UID=...  node tools/unlock-all.mjs          → 그 사람 전부 해금
//   NAME=닉네임 node tools/unlock-all.mjs       → 닉네임으로 uid 를 찾아서
//   UID=... OFF=1 node tools/unlock-all.mjs     → 해금 취소
//
// titles/{uid}.all = true 한 줄을 넣는다. 화면 코드에는 "내 uid 면 특별 취급" 같은 게 하나도 없다 —
// 데이터로만 주면 코드가 깨끗하고, 나중에 다른 사람에게 주거나 거둘 때도 여기만 돌리면 된다.
//
// ⚠️ 받은 사람은 모든 테마와 재질을 쓸 수 있다. 순위표에서 치트처럼 보이지 않게
//    「개발자」 표시를 같이 두는 것이 좋다.
import { Firestore } from "@google-cloud/firestore";

const PROJECT = "either-or-130af";
const OFF = process.env.OFF === "1";
let uid = process.env.UID || "";
const name = process.env.NAME || "";

const db = new Firestore({ projectId: PROJECT });

if (!uid && name) {
  // names/{닉네임 소문자} 에 주인 uid 가 있다 (구글 연동한 사람만 선점할 수 있다)
  const doc = await db.collection("names").doc(name.toLowerCase()).get();
  if (!doc.exists) throw new Error(`닉네임 "${name}" 을 선점한 사람이 없어요. 구글 연동을 먼저 해야 해요.`);
  uid = doc.data().uid;
  console.log(`닉네임 "${name}" → uid ${uid}`);
}
if (!uid) throw new Error("UID 나 NAME 중 하나는 있어야 해요");

const ref = db.collection("titles").doc(uid);
await db.runTransaction(async (tx) => {
  const cur = await tx.get(ref);
  const data = cur.exists ? cur.data() : {};
  tx.set(ref, {
    list: data.list || [],
    pick: typeof data.pick === "number" ? data.pick : 0,
    all: !OFF,
  }, { merge: true });
});
console.log(OFF ? `해금을 거뒀어요: ${uid}` : `전부 해금했어요: ${uid}`);
