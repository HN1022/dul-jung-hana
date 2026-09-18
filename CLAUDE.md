# 「둘 중 하나 / Either Or」 — Claude 작업 규칙

전체 맥락과 계정·설정은 `인수인계-둘중하나.md` 를 먼저 읽을 것.

## 게임 이름을 바꿀 때 (사용자와 약속한 것)
이름 변경은 보이는 글자만 바꾼다. 아래 두 가지는 **절대 바꾸지 않는다** — 바꾸면 기존 사용자의 기록이 사라진다.
- **앱 패키지 ID `com.alwaysone.duljunghana`** (`android/app/build.gradle` 의 `applicationId`·`namespace`, `capacitor.config.json` 의 `appId`).
  바꾸면 다른 앱이 되어 업데이트가 끊기고 폰 저장 기록이 사라진다. 플레이스토어에 올린 뒤에는 변경 자체가 불가.
- **웹 주소 `hn1022.github.io/dul-jung-hana`** (GitHub 저장소 이름). 바꾸면 웹 사용자의 브라우저 저장 기록(최고 점수·진행 중인 판)이 안 보인다.

함께 바꾸지 않는 것: localStorage 키(`duljunghana-…`), Firestore 컬렉션 `scores`, Firebase 프로젝트 ID `either-or-130af`.

바꿔도 되는 곳(이름 변경 시 여기를 고친다): `i18n.js`(doc_title·title·sub·rules), `index.html`(기본 문구, `apple-mobile-web-app-title`),
`manifest.json`(name·short_name), `capacitor.config.json` 의 `appName`, `android/app/src/main/res/values/strings.xml`(app_name·title_activity_main),
`privacy.html`, `admin.html` 제목, 스토어 등록 문구. 한글 문구를 바꾸면 `python tools/build-fonts.py`, `sw.js` 의 VERSION 올리기.

## 규칙(점수·확률·방해 블록)을 바꿀 때
`engine.js` 의 `VERSION` 을 올린다. 화면에서 규칙을 따로 계산하지 말고 엔진 함수만 부른다(밤마다 도는 리플레이 검증이 같은 파일을 쓴다).
