# 재질 미리보기 만들기 — 「블록 딜레마」
#
#   python tools/preview-materials.py   →  tools/material-preview.html
#
# 재질은 블록 가운데에 문양을 얹는다. 색은 건드리지 않는다 — 크기를 색으로 알아보는 게 규칙이라서.
# 문양은 index.html 의 CSS 에서 그대로 읽어 온다. 두 군데서 따로 관리하면 반드시 어긋난다.
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
AUTUMN = next(p for p in pal.PALETTES if p[0] == "10월 단풍")[1]

# index.html 에서  :root[data-mat1="gold"] { --mk1: url("...") }  꼴을 뽑는다
css = io.open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
MARKS = dict(re.findall(r':root\[data-mat1="(\w+)"\] \{ --mk1: (url\(".*?"\)); \}', css))
if len(MARKS) != 4:
    raise SystemExit("index.html 에서 문양을 못 찾았어요 (%d개). CSS 모양이 바뀌었는지 확인하세요." % len(MARKS))

NAMES = {"holo": "홀로그램", "gold": "금", "silver": "은", "bronze": "동"}
ORDER = ["holo", "gold", "silver", "bronze"]
TEXT_GRAD = {
    "holo": "linear-gradient(100deg,#FF4FA3,#FFD400,#35FFC0,#35B8FF,#B45CFF,#FF4FA3)",
    "gold": "linear-gradient(100deg,#FFF0A8,#E0A92C,#FFE68A,#B07D18)",
    "silver": "linear-gradient(100deg,#FFFFFF,#AEBBC6,#F0F5F8,#8894A0)",
    "bronze": "linear-gradient(100deg,#FFD3A4,#B9702F,#F0B583,#8A5220)",
}


def grid(title, colors):
    rows = []
    for key in ["none"] + ORDER:
        mark = "none" if key == "none" else MARKS[key]
        cells = "".join(
            '<i style="background:{bg}"><s style="background-image:{mk}"></s><b>{n}</b></i>'.format(
                bg=c, mk=mark, n=k + 1)
            for k, c in enumerate(colors))
        label = "없음" if key == "none" else NAMES[key]
        rows.append('<tr><th>{l}</th><td><div class="row">{c}</div></td></tr>'.format(l=label, c=cells))
    return "<h2>{t}</h2><table>{r}</table>".format(t=title, r="".join(rows))


names = "".join(
    '<li><span class="mt" style="background-image:{g}"><s style="background-image:{mk}"></s>홍길동</span>'
    ' <small>{n}</small></li>'.format(g=TEXT_GRAD[k], mk=MARKS[k], n=NAMES[k])
    for k in ORDER)

html = """<!doctype html><meta charset="utf-8"><title>재질 미리보기</title>
<style>
  body { background:#0F151B; color:#E7EDF3; font-family:system-ui,sans-serif; margin:0; padding:20px 20px 40px; }
  h1 { font-size:20px; margin:0 0 4px; }
  h2 { font-size:15px; margin:22px 0 8px; }
  p.note { color:#8FA3B4; font-size:13px; margin:0 0 6px; }
  table { border-collapse:collapse; }
  th { text-align:left; font-size:13px; color:#8FA3B4; padding:6px 14px 6px 0; white-space:nowrap; }
  .row { display:flex; gap:6px; }
  .row i { width:46px; height:46px; border-radius:8px; position:relative; display:grid; place-items:center;
           box-shadow: inset 0 -3px 0 rgba(0,0,0,.18), inset 0 2px 0 rgba(255,255,255,.25); }
  .row i s { position:absolute; inset:0; background-repeat:no-repeat; background-position:center;
             background-size:58%; filter:drop-shadow(0 1px 1px rgba(0,0,0,.35)); }
  .row i b { position:relative; font-size:11px; color:rgba(0,0,0,.5); align-self:end; margin-bottom:2px; }
  ul { list-style:none; padding:0; margin:8px 0 0; display:flex; gap:22px; flex-wrap:wrap; align-items:center; }
  li small { color:#8FA3B4; font-size:12px; }
  .mt { background-clip:text; -webkit-background-clip:text; color:transparent; font-weight:800; font-size:20px; }
  .mt s { display:inline-block; width:1em; height:1em; margin-right:3px; vertical-align:-0.12em;
          background-repeat:no-repeat; background-position:center; background-size:contain; }
</style>
<h1>재질 미리보기</h1>
<p class="note">재질은 블록 가운데에 문양을 얹는다. 색은 건드리지 않아서 크기 구분이 그대로 남는다.</p>
<p class="note">모양을 재질마다 다르게 했다 — 반짝임(홀로그램) · 별(금) · 마름모(은) · 동그라미(동). 색이 안 보여도 구분된다.</p>
<p class="note">실제로는 한 번에 세 개까지, 본인이 고른 크기에만 입는다. 여기서는 비교하려고 전부 입혔다.</p>
__BASE__
__AUTUMN__
<h2>순위표 닉네임</h2>
<ul>__NAMES__</ul>
"""
html = (html.replace("__BASE__", grid("기본 팔레트", BASE))
            .replace("__AUTUMN__", grid("10월 단풍", AUTUMN))
            .replace("__NAMES__", names))

out = os.path.join(HERE, "material-preview.html")
io.open(out, "w", encoding="utf-8", newline="\n").write(html)
print("만들었습니다: " + out)
