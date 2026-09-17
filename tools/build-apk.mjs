// 테스트용 APK 빌드: 웹 파일 복사 → Capacitor 동기화 → Gradle 빌드 → 결과를 프로젝트 루트로 복사
//
//   npm run apk
//
// 결과물: 둘중하나-debug.apk (폰에 옮겨서 설치)
//
// cmd에서 `cd android && gradlew.bat` 를 쓰지 않는 이유: 폴더 이름(둘중하나)의 한글을
// cmd가 제대로 못 읽어서 gradlew.bat 을 못 찾는다. 그래서 Gradle은 cmd 없이 Java로 바로 띄운다.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const android = join(root, "android");

function run(cmd, args, cwd, env, shell = true) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell, env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// Gradle 8.14 는 Java 25(Android Studio 내장)로는 안 돌아서 Java 21 을 쓴다.
const env = {};
const programs = join(process.env.LOCALAPPDATA ?? join(os.homedir(), "AppData", "Local"), "Programs");
const jdk = existsSync(programs) && readdirSync(programs).find((d) => d.startsWith("jdk-21"));
if (jdk) env.JAVA_HOME = join(programs, jdk);
if (!process.env.ANDROID_HOME && process.env.LOCALAPPDATA) env.ANDROID_HOME = join(process.env.LOCALAPPDATA, "Android", "Sdk");

run("node", ["tools/build-web.mjs"], root, env);
run("npx", ["cap", "sync", "android"], root, env);
// gradlew.bat 대신 그 안에서 하는 일(Java로 Gradle 래퍼 실행)을 직접 한다 — cmd를 안 거치게.
const java = env.JAVA_HOME ? join(env.JAVA_HOME, "bin", "java.exe") : "java";
run(java, ["-classpath", join(android, "gradle", "wrapper", "gradle-wrapper.jar"),
  "org.gradle.wrapper.GradleWrapperMain", "assembleDebug", "--console=plain"], android, env, false);

const apk = join(android, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const out = join(root, "둘중하나-debug.apk");
copyFileSync(apk, out);
console.log(`\nAPK 완성: ${out}`);
