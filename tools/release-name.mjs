// 닉네임 선점 놓아주기 — names/{닉네임 소문자} 를 지워서 다른 사람이 가져갈 수 있게 한다
//
//   NAME=하늘 DRY_RUN=1 node tools/release-name.mjs   → 주인이 누군지 보기만
//   NAME=하늘 node tools/release-name.mjs             → 실제로 놓아주기
//
// 왜 필요한가: 게임에서 닉네임을 바꿔도 옛 이름의 선점은 그대로 남는다(saveName 은 새 이름을
// 선점만 하고 옛 것을 지우지 않는다). 흔한 이름을 쥐고 있을 이유가 없을 때 여기서 놓아준다.
//
// 놓아준 뒤에도 그 이름으로 올렸던 **점수 기록은 그대로 남는다**. 선점만 풀리는 것이다.
// 그래서 다른 사람이 그 이름을 가져가면 순위표에 같은 이름이 둘 보일 수 있다(uid 는 다르다).
import { Firestore } from "@google-cloud/firestore";

const PROJECT = "either-or-130af";
const NAME = process.env.NAME || "";
const DRY = process.env.DRY_RUN === "1";
if (!NAME) throw new Error("NAME 이 있어야 해요 (예: NAME=하늘)");

const db = new Firestore({ projectId: PROJECT });
const key = NAME.toLowerCase();
const ref = db.collection("names").doc(key);
const doc = await ref.get();

if (!doc.exists) {
  console.log(`"${NAME}" 은 선점된 적이 없어요. 할 일이 없습니다.`);
  process.exit(0);
}
const d = doc.data();
console.log(`"${d.name}" (문서 id "${key}") 의 주인: ${d.uid}`);
if (DRY) {
  console.log("DRY_RUN — 지우지 않았습니다.");
  process.exit(0);
}
await ref.delete();
console.log(`놓아줬어요. 이제 다른 사람이 "${d.name}" 을 선점할 수 있습니다.`);
