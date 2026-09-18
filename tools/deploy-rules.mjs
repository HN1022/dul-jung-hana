// firestore.rules 를 Firebase 에 적용한다 — GitHub 자동 작업이 돌린다 (.github/workflows/firebase.yml)
//
// Firebase 규칙 API 로 새 규칙 묶음(ruleset)을 만들고, Firestore 가 그걸 쓰도록 연결(release)한다.
// 인증은 verify-scores.mjs 와 같은 키 없는 연동(Workload Identity).
import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const PROJECT = "either-or-130af";
const API = `https://firebaserules.googleapis.com/v1/projects/${PROJECT}`;
const RELEASE = `projects/${PROJECT}/releases/cloud.firestore`;

const content = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();

const rs = await client.request({
  url: `${API}/rulesets`,
  method: "POST",
  data: { source: { files: [{ name: "firestore.rules", content }] } },
});
const rulesetName = rs.data.name;
console.log("새 규칙 묶음:", rulesetName);

try {
  await client.request({
    url: `${API}/releases/cloud.firestore`,
    method: "PATCH",
    data: { release: { name: RELEASE, rulesetName } },
  });
} catch (e) {
  if (e.response && e.response.status === 404) {
    await client.request({ url: `${API}/releases`, method: "POST", data: { name: RELEASE, rulesetName } });
  } else {
    throw e;
  }
}
console.log("Firestore 규칙 적용 완료");
