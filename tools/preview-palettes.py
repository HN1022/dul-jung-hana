# 팔레트 미리보기 만들기 — 「블록 딜레마」
#
#   python tools/preview-palettes.py   →  tools/palette-preview.html
#
# 왼쪽은 눈에 보이는 대로, 오른쪽 둘은 적색맹·녹색맹이 보는 대로 같은 색을 다시 그린다.
# 숫자는 그 줄에서 "가장 가까운 두 색의 거리"다. 작을수록 헷갈린다는 뜻.
# 블록 크기를 색으로 알아보는 게 규칙이라, 세 칸 모두에서 6개가 달라 보여야 쓸 수 있는 팔레트다.
import importlib.util
import io
import itertools
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


cp = _load("check-palettes")
PALETTES = _load("palettes").PALETTES

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

MODES = [("보이는 대로", None), ("적색맹", "적색맹"), ("녹색맹", "녹색맹")]


def hexof(rgb):
    return "#" + "".join("%02X" % round(max(0, min(1, c)) * 255) for c in rgb)


def worst(colors, mode):
    cs = [cp.hex_rgb(c) for c in colors]
    if mode:
        cs = [cp.simulate(c, mode) for c in cs]
    return min(cp.de2000(cs[i], cs[j]) for i, j in itertools.combinations(range(6), 2))


rows = []
for name, colors, *rest in PALETTES:
    cells = []
    for label, mode in MODES:
        shown = [c if mode is None else hexof(cp.simulate(cp.hex_rgb(c), mode)) for c in colors]
        w = worst(colors, mode)
        cls = "bad" if w < 8 else ("warn" if w < 11 else "ok")
        blocks = "".join('<i style="background:%s"><b>%d</b></i>' % (c, k + 1) for k, c in enumerate(shown))
        cells.append('<td><div class="row">%s</div><small class="%s">%s · 최소 %.1f</small></td>'
                     % (blocks, cls, label, w))
    rows.append("<tr><th>%s</th>%s</tr>" % (name, "".join(cells)))

html = """<!doctype html><meta charset="utf-8"><title>팔레트 미리보기</title>
<style>
  body { background:#0F151B; color:#E7EDF3; font-family:system-ui,sans-serif; margin:0; padding:20px; }
  h1 { font-size:20px; margin:0 0 4px; }
  p.note { color:#8FA3B4; font-size:13px; margin:0 0 18px; }
  table { border-collapse:collapse; }
  th { text-align:left; font-size:13px; padding:10px 14px 10px 0; white-space:nowrap; vertical-align:top; }
  td { padding:6px 16px 10px 0; vertical-align:top; }
  .row { display:flex; gap:4px; }
  .row i { width:30px; height:30px; border-radius:6px; display:grid; place-items:center;
           box-shadow: inset 0 -3px 0 rgba(0,0,0,.18), inset 0 2px 0 rgba(255,255,255,.25); }
  .row i b { font-size:11px; color:rgba(0,0,0,.55); }
  small { display:block; margin-top:4px; font-size:11px; color:#8FA3B4; }
  small.ok::before { content:"● "; color:#4ED39B; }
  small.warn::before { content:"● "; color:#F2B640; }
  small.bad::before { content:"● "; color:#EE6A50; }
</style>
<h1>월 테마 팔레트</h1>
<p class="note">숫자 = 그 줄에서 가장 가까운 두 색의 거리(CIEDE2000). 참고로 지금 게임의 기본 색은 녹색맹 기준 2.1 이다.</p>
<table>%s</table>
""" % "".join(rows)

out = os.path.join(HERE, "palette-preview.html")
io.open(out, "w", encoding="utf-8", newline="\n").write(html)
print("만들었습니다: " + out)
