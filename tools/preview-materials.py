# 재질 미리보기 만들기 — 「블록 딜레마」
#
#   python tools/preview-materials.py   →  tools/material-preview.html
#
# 홀로그램·금·은·동이 블록 색 위에 어떻게 얹히는지 크게 본다.
# 재질은 색을 덮지 않고 광택만 더한다 — 색을 덮으면 크기 구분이 사라져서 게임이 안 된다.
# 그래서 "여섯 색이 여전히 서로 달라 보이는가"를 눈으로 확인하는 것이 이 페이지의 목적이다.
import importlib.util
import io
import os

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("palettes", os.path.join(HERE, "palettes.py"))
pal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pal)

BASE = pal.PALETTES[0][1]        # 기본 팔레트
AUTUMN = next(p for p in pal.PALETTES if p[0] == "10월 단풍")[1]

MATS = [
    ("없음", "none", "normal", "1"),
    ("홀로그램", "linear-gradient(115deg, rgba(255,0,128,.9) 0%, rgba(255,214,0,.9) 18%, rgba(0,255,170,.9) 36%, rgba(0,170,255,.9) 54%, rgba(170,0,255,.9) 72%, rgba(255,0,128,.9) 100%)", "hard-light", ".62"),
    ("금", "linear-gradient(150deg, #FFF3B0 0%, #E8B23A 28%, #8C5A12 52%, #FFE07A 74%, #C8901F 100%)", "soft-light", ".95"),
    ("은", "linear-gradient(150deg, #FFFFFF 0%, #C9D4DC 28%, #6A7884 52%, #F2F6F9 74%, #9AA7B2 100%)", "soft-light", ".95"),
    ("동", "linear-gradient(150deg, #FFD9B0 0%, #C87A3C 30%, #70401A 55%, #EFB37A 78%, #A05F28 100%)", "soft-light", ".95"),
]

NAMEMAT = [
    ("홀로그램", "linear-gradient(100deg, #FF4FA3, #FFD400, #35FFC0, #35B8FF, #B45CFF, #FF4FA3)"),
    ("금", "linear-gradient(100deg, #FFF0A8, #E0A92C, #FFE68A, #B07D18)"),
    ("은", "linear-gradient(100deg, #FFFFFF, #AEBBC6, #F0F5F8, #8894A0)"),
    ("동", "linear-gradient(100deg, #FFD3A4, #B9702F, #F0B583, #8A5220)"),
]


def grid(title, colors):
    rows = []
    for label, img, blend, op in MATS:
        cells = "".join(
            '<i style="background:%s"><s style="background-image:%s;mix-blend-mode:%s;opacity:%s"></s><b>%d</b></i>'
            % (c, img, blend, op, k + 1) for k, c in enumerate(colors))
        rows.append('<tr><th>%s</th><td><div class="row">%s</div></td></tr>' % (label, cells))
    return '<h2>%s</h2><table>%s</table>' % (title, "".join(rows))


names = "".join(
    '<li><span class="mt" style="background-image:%s">홍길동</span> <small>%s</small></li>' % (img, label)
    for label, img in NAMEMAT)

html = """<!doctype html><meta charset="utf-8"><title>재질 미리보기</title>
<style>
  body { background:#0F151B; color:#E7EDF3; font-family:system-ui,sans-serif; margin:0; padding:20px 20px 40px; }
  h1 { font-size:20px; margin:0 0 4px; }
  h2 { font-size:15px; margin:22px 0 8px; }
  p.note { color:#8FA3B4; font-size:13px; margin:0 0 6px; }
  table { border-collapse:collapse; }
  th { text-align:left; font-size:13px; color:#8FA3B4; padding:6px 14px 6px 0; white-space:nowrap; }
  td { padding:5px 0; }
  .row { display:flex; gap:6px; }
  .row i { width:44px; height:44px; border-radius:8px; position:relative; display:grid; place-items:center;
           box-shadow: inset 0 -3px 0 rgba(0,0,0,.18), inset 0 2px 0 rgba(255,255,255,.25); }
  .row i s { position:absolute; inset:0; border-radius:inherit; text-decoration:none; }
  .row i b { position:relative; font-size:12px; color:rgba(0,0,0,.55); }
  ul { list-style:none; padding:0; margin:8px 0 0; display:flex; gap:22px; flex-wrap:wrap; align-items:center; }
  li small { color:#8FA3B4; font-size:12px; }
  .mt { background-clip:text; -webkit-background-clip:text; color:transparent; font-weight:800; font-size:20px; }
</style>
<h1>재질 미리보기</h1>
<p class="note">재질은 색을 덮지 않고 광택만 얹는다. 1~6 숫자가 블록 크기 — 재질을 입혀도 여섯이 서로 달라 보여야 한다.</p>
<p class="note">실제로는 한 번에 세 개까지만, 본인이 고른 크기에만 입는다. 여기서는 비교하려고 전부 입혔다.</p>
%s
%s
<h2>순위표 닉네임</h2>
<ul>%s</ul>
""" % (grid("기본 팔레트", BASE), grid("10월 단풍", AUTUMN), names)

out = os.path.join(HERE, "material-preview.html")
io.open(out, "w", encoding="utf-8", newline="\n").write(html)
print("만들었습니다: " + out)
