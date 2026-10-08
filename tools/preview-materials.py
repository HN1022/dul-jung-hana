# 재질·문양 미리보기 만들기 — 「블록 딜레마」
#
#   python tools/preview-materials.py   →  tools/material-preview.html
#
# 보여 주는 것 셋
#   1. 재질(홀로그램·금·은·동)은 블록 **색 자체**가 된다. 세 개까지만 입고, 나머지 세 크기는
#      테마 색 그대로라 크기 구분이 남는다.
#   2. 월 테마 문양은 블록마다 옅게 깔린다. 색은 안 건드린다.
#   3. 순위표는 줄 박스 전체가 그 재질이 되고 이름은 평범하게 둔다.
#
# 색과 문양은 index.html 의 CSS 에서 그대로 읽어 온다. 두 군데서 따로 관리하면 반드시 어긋난다.
import importlib.util
import io
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

spec = importlib.util.spec_from_file_location("palettes", os.path.join(HERE, "palettes.py"))
pal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pal)

BASE = pal.PALETTES[0][1]
HALLOWEEN = next(p for p in pal.PALETTES if p[0] == "10월 할로윈")[1]

css = io.open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()


def grab(pattern, what):
    out = dict(re.findall(pattern, css))
    if not out:
        raise SystemExit("index.html 에서 %s 를 못 찾았어요. CSS 모양이 바뀌었는지 확인하세요." % what)
    return out


MATBG = grab(r':root\[data-mat1="(\w+)"\] \{ --matbg1: (linear-gradient\(.*?\)); \}', "재질 색")
ROWBG = grab(r'\.ranklist li\.mt\.(\w+) \{ background-image: (linear-gradient\(.*?\)); \}', "순위표 재질 색")
# style 속성에 넣을 거라 큰따옴표를 바꿔 둔다 — 안 그러면 속성이 거기서 끊겨 문양이 안 보인다
MARKS = {k: v.replace('"', "&quot;")
         for k, v in grab(r':root\[data-theme-mark="(\w+)"\] \{ --themark: (url\(".*?"\)); \}',
                          "월 테마 문양").items()}

NAMES = {"tester": "테스터 에디션", "holo": "홀로그램", "gold": "금", "silver": "은", "bronze": "동"}
ORDER = ["holo", "gold", "silver", "bronze"]   # 순위표에 나오는 것만 (테스터는 블록 전용)


def blocks(colors, mats, mark):
    """mats = {크기: 재질}. 그 크기는 테마 색 대신 재질이 들어간다."""
    cells = []
    for k, c in enumerate(colors):
        size = k + 1
        bg = MATBG[mats[size]] if size in mats else c
        cells.append('<i style="background:{bg}"><s style="background-image:{mk}"></s>'
                     '<b>{n}</b></i>'.format(bg=bg, mk=mark or "none", n=size))
    return '<div class="row">%s</div>' % "".join(cells)


def section(title, colors, mark):
    rows = [
        ("재질 없음", {}),
        ("은 하나", {5: "silver"}),
        ("금·은", {4: "gold", 5: "silver"}),
        ("홀로그램·금·은 (최대 3개)", {3: "holo", 4: "gold", 5: "silver"}),
        ("테스터 에디션 (순위와 무관)", {4: "tester"}),
    ]
    body = "".join('<tr><th>%s</th><td>%s</td></tr>' % (label, blocks(colors, mats, mark))
                   for label, mats in rows)
    return '<h2>%s</h2><table>%s</table>' % (title, body)


rank = "".join(
    '<li class="rankrow" style="background-image:{g}"><span class="rk">{i}</span>'
    '<span class="nm">홍길동</span><span class="md">3~5칸·Lv3</span>'
    '<b class="sc">1,240</b></li>'.format(g=ROWBG[k], i=i + 1)
    for i, k in enumerate(ORDER))
rank += ('<li class="rankrow plain"><span class="rk">5</span><span class="nm">김철수</span>'
         '<span class="md">3~5칸·Lv3</span><b class="sc">980</b></li>')

html = """<!doctype html><meta charset="utf-8"><title>재질·문양 미리보기</title>
<style>
  body { background:#0F151B; color:#E7EDF3; font-family:system-ui,sans-serif; margin:0; padding:20px 20px 40px; }
  h1 { font-size:20px; margin:0 0 4px; }
  h2 { font-size:15px; margin:22px 0 8px; }
  p.note { color:#8FA3B4; font-size:13px; margin:0 0 6px; }
  table { border-collapse:collapse; }
  th { text-align:left; font-size:13px; color:#8FA3B4; padding:6px 16px 6px 0;
       white-space:nowrap; font-weight:400; }
  .row { display:flex; gap:6px; }
  .row i { width:48px; height:48px; border-radius:8px; position:relative; display:grid; place-items:center;
           box-shadow: inset 0 -3px 0 rgba(0,0,0,.18), inset 0 2px 0 rgba(255,255,255,.25); }
  .row i s { position:absolute; inset:0; background-repeat:no-repeat; background-position:center;
             background-size:52%; opacity:.22; }
  .row i b { position:relative; font-size:11px; color:rgba(0,0,0,.45); align-self:end; margin-bottom:2px; }
  .ranklist { list-style:none; margin:8px 0 0; padding:0; display:flex; flex-direction:column;
              gap:4px; max-width:430px; }
  .rankrow { display:grid; grid-template-columns:2.2em 1fr auto auto; align-items:center; gap:8px;
             padding:9px 12px; border-radius:10px; color:#241A06; font-weight:700; }
  .rankrow.plain { background:#19222B; color:#E7EDF3; }
  .rankrow .rk, .rankrow .md { color:rgba(36,26,6,.62); font-weight:700; }
  .rankrow.plain .rk, .rankrow.plain .md { color:#8FA3B4; }
  .rankrow .md { font-size:11.5px; }
  .rankrow .sc { font-size:18px; font-weight:800; }
</style>
<h1>재질·문양 미리보기</h1>
<p class="note">재질(홀로그램·금·은·동)은 블록 색 자체가 된다. 세 개까지만 — 나머지 세 크기는 테마 색이라 크기 구분이 남는다.</p>
<p class="note">월 테마 문양은 블록마다 옅게 깔린다. 색은 건드리지 않는다. 어느 크기에 어느 재질을 입힐지는 본인이 고른다.</p>
__BASE__
__HALLOWEEN__
<h2>순위표</h2>
<p class="note">등급을 받은 사람은 줄 박스 자체가 그 재질이 된다. 이름은 평범하게 둔다.</p>
<ol class="ranklist">__RANK__</ol>
"""
html = (html.replace("__BASE__", section("기본 테마 (문양 없음)", BASE, None))
            .replace("__HALLOWEEN__", section("10월 할로윈 (호박 문양)", HALLOWEEN, MARKS.get("m10")))
            .replace("__RANK__", rank))

out = os.path.join(HERE, "material-preview.html")
io.open(out, "w", encoding="utf-8", newline="\n").write(html)
print("만들었습니다: " + out)
