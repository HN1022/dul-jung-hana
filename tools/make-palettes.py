# 월 테마 팔레트 생성기 — 「블록 딜레마」
#
#   python tools/make-palettes.py          → 13개(기본 + 12달) 뽑아서 palettes.py 에 쓸 모양으로 출력
#   python tools/make-palettes.py 10월 단풍  → 하나만
#
# 왜 손으로 안 고르고 기계로 찾나:
#   블록 크기를 색으로 알아보는 게 규칙의 일부라, 6색이 서로 또렷하게 달라야 한다.
#   그런데 적록색약·색맹인 사람에게는 빨강과 초록, 노랑과 주황이 거의 같은 색으로 보인다.
#   사람 눈으로 고르면 이걸 못 잡는다 — 실제로 지금 쓰는 기본 색도 녹색맹 기준으로
#   4칸(노랑)과 5칸(빨강)의 색거리가 2.1 밖에 안 된다(사실상 같은 색).
#
# 핵심 아이디어:
#   색맹인 사람에게는 색상환이 거의 "파랑 ↔ 노랑" 한 축으로 눌린다. 그래서 색상만으로는
#   6개를 구분시킬 수 없고, **밝기 차이**를 같이 써야 한다. 생성기가 밝기를 벌려 주는 이유다.
#   (덤으로 색각이 정상인 사람에게도 더 또렷해진다.)
#
# 하는 일:
#   계절 느낌을 낼 기준 색상(hue)에서 출발해서, 조금씩 흔들어 보며
#   "정상·적색맹·녹색맹 세 경우 모두에서 가장 가까운 두 색의 거리"가 최대가 되는 쪽으로 옮긴다.
#   계절 느낌이 너무 날아가지 않게 기준 색상에서 멀어지면 점수를 깎는다.
import importlib.util
import math
import random
import sys

_spec = importlib.util.spec_from_file_location("cp", __file__.replace("make-palettes.py", "check-palettes.py"))
cp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cp)

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BG = cp.hex_rgb(cp.BG)

# 달마다 "이 색들이 많이 보였으면" 하는 기준 색상(0~360). 6개를 순서대로 1칸~6칸에 쓴다.
# 계절 분위기는 이 기준에서 나오고, 구분은 생성기가 책임진다.
MOODS = [
    ("기본",        [210, 250, 160,  45,  15, 290]),
    ("1월 설경",    [205, 230, 190,  50, 340, 275]),
    ("2월 동백",    [200, 235, 150,  45, 355, 300]),
    ("3월 개나리",  [205, 245, 130,  52,  25, 285]),
    ("4월 벚꽃",    [210, 240, 165,  48, 340, 295]),
    ("5월 신록",    [200, 225, 120,  70,  20, 280]),
    ("6월 수국",    [205, 235, 180,  50, 330, 270]),
    ("7월 바다",    [195, 220, 175,  48,  12, 290]),
    ("8월 해바라기",[205, 240, 140,  45,  18, 295]),
    ("9월 들국화",  [210, 250, 155,  55, 335, 285]),
    ("10월 단풍",   [200, 235, 130,  38,   8, 300]),
    ("11월 낙엽",   [205, 230, 115,  40,  18, 290]),
    ("12월 성탄",   [200, 240, 145,  48,   0, 295]),
]

L_MIN, L_MAX = 48.0, 84.0     # 너무 어두우면 배경에 묻히고, 너무 밝으면 흰색처럼 보인다
C_MIN, C_MAX = 10.0, 62.0     # 채도. 1칸은 일부러 흐리게 둘 수 있어서 하한을 낮게
HUE_PULL = 2.2                # 기준 색상에서 1도 벗어날 때마다 깎는 점수. 높을수록 계절감이 남는다
# 색맹 기준을 얼마나 지킬지. 완벽히 맞추면 12달이 전부 비슷해져서 계절감이 사라진다(2026-10-08 확인).
# 그래서 "지금 색(녹색맹 2.1)보다는 확실히 낫게"를 바닥으로 깔고 계절감 쪽에 무게를 준다.
CVD_TARGET = 8.0              # 여기까지는 점수로 끌어올린다
CVD_FLOOR = 6.0               # 이 아래로 내려가면 크게 깎는다 — 타협의 하한선


def lch_to_rgb(L, C, h):
    a = C * math.cos(math.radians(h))
    b = C * math.sin(math.radians(h))
    fy = (L + 16) / 116
    fx, fz = fy + a / 500, fy - b / 200
    g = lambda t: t ** 3 if t ** 3 > 216 / 24389 else (116 * t - 16) / (24389 / 27)
    x, y, z = g(fx) * 0.95047, g(fy), g(fz) * 1.08883
    r = 3.2406 * x - 1.5372 * y - 0.4986 * z
    gg = -0.9689 * x + 1.8758 * y + 0.0415 * z
    bb = 0.0557 * x - 0.2040 * y + 1.0570 * z
    return tuple(cp.to_srgb(c) for c in (r, gg, bb))


def to_hex(rgb):
    return "#" + "".join("%02X" % round(max(0, min(1, c)) * 255) for c in rgb)


def score(params, hues):
    """클수록 좋다. 가장 가까운 두 색의 거리(세 시야 중 최악)에서 벌점을 뺀다."""
    rgb = [cp.hex_rgb(to_hex(lch_to_rgb(*p))) for p in params]   # 표현 가능한 색으로 한 번 접어서 잰다
    # 각 시야에서 "가장 가까운 두 색의 거리". 목표치까지만 점수로 쳐 주고 그 위는 안 쳐 준다
    # (더 벌리려고 계절감을 버리는 걸 막는다).
    val = 0.0
    for mode, target in ((None, cp.MIN_DE), ("적색맹", CVD_TARGET), ("녹색맹", CVD_TARGET)):
        cs = rgb if mode is None else [cp.simulate(c, mode) for c in rgb]
        w = min(cp.de2000(cs[i], cs[j]) for i in range(6) for j in range(i + 1, 6))
        val += min(w, target) * (1.0 if mode is None else 2.0)
        if mode is not None and w < CVD_FLOOR:
            val -= 60 * (CVD_FLOOR - w)      # 하한을 깨면 크게 깎는다
    worst = val
    pen = 0.0
    for (L, C, h), want in zip(params, hues):
        diff = abs((h - want + 180) % 360 - 180)
        pen += HUE_PULL * diff
        ct = cp.contrast(cp.hex_rgb(to_hex(lch_to_rgb(L, C, h))), BG)
        if ct < cp.MIN_CONTRAST:
            pen += 300 * (cp.MIN_CONTRAST - ct)
    return worst - pen


def make(name, hues, seed=0, rounds=26000):
    rnd = random.Random(hash(name) & 0xFFFF if seed == 0 else seed)
    # 출발: 기준 색상 그대로, 밝기는 넓게 벌려 둔다(색맹에게는 밝기가 주된 단서라서)
    best = [[L_MIN + (L_MAX - L_MIN) * k / 5, 42.0, float(h)] for k, h in enumerate(hues)]
    rnd.shuffle(best)
    for p, h in zip(best, hues):
        p[2] = float(h)
    cur = [p[:] for p in best]
    cs, bs = score(cur, hues), score(best, hues)
    for step in range(rounds):
        t = 1.0 - step / rounds                     # 처음엔 크게, 나중엔 조금씩 흔든다
        cand = [p[:] for p in cur]
        i = rnd.randrange(6)
        cand[i][0] = max(L_MIN, min(L_MAX, cand[i][0] + rnd.gauss(0, 9 * t + 1)))
        cand[i][1] = max(C_MIN, min(C_MAX, cand[i][1] + rnd.gauss(0, 12 * t + 1)))
        cand[i][2] = (cand[i][2] + rnd.gauss(0, 26 * t + 2)) % 360
        s = score(cand, hues)
        if s > cs:
            cur, cs = cand, s
            if s > bs:
                best, bs = [p[:] for p in cand], s
    return [to_hex(lch_to_rgb(*p)) for p in best], bs


if __name__ == "__main__":
    want = " ".join(sys.argv[1:]).strip()
    out = []
    for name, hues in MOODS:
        if want and want != name:
            continue
        colors, s = make(name, hues)
        rgb = [cp.hex_rgb(c) for c in colors]
        def mn(mode):
            cs = rgb if mode is None else [cp.simulate(c, mode) for c in rgb]
            return min(cp.de2000(cs[i], cs[j]) for i in range(6) for j in range(i + 1, 6))
        print('    ("%s", %s),   # 정상 %.1f · 적색맹 %.1f · 녹색맹 %.1f'
              % (name, str(colors).replace("'", '"'), mn(None), mn("적색맹"), mn("녹색맹")))
        out.append((name, colors))
    print()
    print("위 줄을 tools/palettes.py 의 PALETTES 에 넣으면 된다.")
