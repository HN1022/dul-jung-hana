"""구글 폰트를 파일로 내려받아 오프라인에서도 쓸 수 있게 만든다.

게임 화면에 실제로 쓰이는 글자만 골라서 받기 때문에(서브셋) 용량이 아주 작다.
그래서 **게임에 새로운 한글 문구를 추가했으면 이걸 다시 돌려야 한다**:

    python tools/build-fonts.py

안 돌리면 새로 추가한 글자만 시스템 기본 폰트로 나온다(깨지지는 않음).
"""
import io
import os
import re
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
FONTS = os.path.join(ROOT, "fonts")

# 최신 크롬인 척해야 woff2(가장 작은 형식)를 준다. 옛 UA로 요청하면 ttf를 준다.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

# 숫자 폰트(Baloo 2)에 넣을 글자 — 점수·난이도 숫자용. 넉넉하게 아스키 전부.
LATIN = "".join(chr(c) for c in range(0x20, 0x7F))


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def game_text():
    """게임 HTML에 들어 있는 모든 글자를 모은다."""
    html = ""
    for name in ("index.html", "i18n.js", "money.js"):
        p = os.path.join(ROOT, name)
        if os.path.exists(p):
            html += io.open(p, encoding="utf-8").read()
    if not html:
        raise SystemExit("게임 파일을 찾을 수 없음")
    # 태그 안쪽(속성·스크립트)까지 전부 포함시킨다 — JS 문자열에도 화면 문구가 많다
    chars = {c for c in html if ord(c) > 0x20}
    return "".join(sorted(chars))


def grab(family, weights, text, prefix):
    """구글 폰트에서 지정한 글자만 담긴 woff2를 받아온다.

    요즘 구글 폰트는 대부분 '변수 폰트'라 굵기별 파일이 전부 같다.
    그래서 같은 주소는 한 번만 받고, @font-face 하나로 굵기 범위를 다 덮는다.
    반환값: [(파일명, 최소굵기, 최대굵기), ...]
    """
    url = ("https://fonts.googleapis.com/css2?family="
           + urllib.parse.quote(family) + ":wght@" + ";".join(str(w) for w in weights)
           + "&text=" + urllib.parse.quote(text))
    css = fetch(url).decode("utf-8")
    by_url = {}
    for block in re.findall(r"@font-face\s*\{(.*?)\}", css, re.S):
        w = re.search(r"font-weight:\s*(\d+)", block)
        src = re.search(r"url\((https://[^)]+)\)", block)
        if w and src:
            by_url.setdefault(src.group(1), []).append(int(w.group(1)))
    got = {w for ws in by_url.values() for w in ws}
    missing = set(weights) - got
    if missing:
        raise SystemExit("받지 못한 굵기: %s" % sorted(missing))

    out = []
    single = len(by_url) == 1
    for i, (src, ws) in enumerate(sorted(by_url.items(), key=lambda kv: min(kv[1]))):
        name = "%s.woff2" % prefix if single else "%s-%d.woff2" % (prefix, min(ws))
        data = fetch(src)
        with open(os.path.join(FONTS, name), "wb") as f:
            f.write(data)
        print("  %-20s %6d bytes  (굵기 %s)" % (name, len(data), "·".join(map(str, sorted(ws)))))
        out.append((name, min(ws), max(ws)))
    return out


def main():
    os.makedirs(FONTS, exist_ok=True)
    text = game_text()
    print("게임에 쓰인 글자 %d개" % len(text))

    print("Noto Sans KR (본문):")
    kr = grab("Noto Sans KR", [400, 500, 700, 900], text, "noto-sans-kr")
    print("Baloo 2 (숫자):")
    bl = grab("Baloo 2", [600, 800], LATIN, "baloo2")

    lines = ["/* tools/build-fonts.py 가 만든 파일. 직접 고치지 말 것. */"]
    for family, faces in (("Noto Sans KR", kr), ("Baloo 2", bl)):
        for name, lo, hi in faces:
            lines.append("@font-face {")
            lines.append('  font-family: "%s";' % family)
            lines.append("  font-style: normal;")
            lines.append("  font-weight: %s;" % (lo if lo == hi else "%d %d" % (lo, hi)))
            lines.append("  font-display: swap;")
            lines.append('  src: url("%s") format("woff2");' % name)
            lines.append("}")
    io.open(os.path.join(FONTS, "fonts.css"), "w", encoding="utf-8", newline="").write(
        "\n".join(lines) + "\n")

    total = sum(os.path.getsize(os.path.join(FONTS, f)) for f in os.listdir(FONTS))
    print("합계 %.1f KB" % (total / 1024))


if __name__ == "__main__":
    main()
