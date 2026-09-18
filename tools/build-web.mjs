// 앱(Capacitor)에 넣을 웹 파일들을 www/ 로 모은다.
// GitHub Pages는 저장소 루트를 그대로 쓰기 때문에, 게임 파일은 루트에 두고
// 앱 빌드할 때만 여기로 복사한다. www/ 는 git에 올리지 않는다.
//
//   npm run build:web
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "www");

// 게임에 필요한 것만. 새 파일을 추가했으면 여기에도 넣을 것.
const FILES = ["index.html", "privacy.html", "delete.html", "i18n.js", "money.js", "engine.js", "leaderboard.js", "manifest.json", "sw.js", "fonts", "icons"];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of FILES) cpSync(join(root, f), join(out, f), { recursive: true });
console.log("www/ ready:", FILES.join(", "));
