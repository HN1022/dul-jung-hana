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

SURFACES = [(cp.hex_rgb(h), need) for _, h, need in cp.SURFACES]

# 달마다 "이 색들이 많이 보였으면" 하는 기준 색상(0~360). 6개를 순서대로 1칸~6칸에 쓴다.
# 계절 분위기는 이 기준에서 나오고, 구분은 생성기가 책임진다.
# (이름, 기준 색상 6개, 색약을 얼마나 챙길지)
#   cvd=2.0 → 색약 우선. 기본·색약 전용 테마가 이 쪽.
#   cvd=0.0 → 계절감 우선. 월 테마는 본인이 골라 쓰는 거라 안 맞으면 "색약" 테마를 쓰면 된다.
MOODS = [
    # (이름, 기준 색상 6개, 색약 가중치, 색상을 붙드는 세기)
    #   색약 2~3 = 기본·색약 테마. 0 = 월 테마(계절감 우선, 안 맞으면 "색약" 테마를 쓰면 된다).
    #   붙드는 세기가 클수록 이름값을 한다. 개나리는 노랑에 꽉 붙들고, 불꽃놀이는 일부러 풀어 둔다.
    #   한 가지 색으로만 채우면 크기 구분이 깨지므로, 어느 테마든 받쳐 주는 색 두어 개를 섞어 둔다.
    ("기본",         [195, 205, 155,  25, 350, 250], 2.0, 1.0),
    ("색약",         [195, 230, 150,  60,  20, 285], 3.0, 1.0),
    ("1월 설경",     [200, 215, 230, 185, 250, 165], 0.0, 4.0),
    ("2월 동백",     [350, 358, 340, 140,  15, 320], 0.0, 4.0),
    ("3월 개나리",   [ 50,  45,  55,  38,  95,  25], 0.0, 5.5),   # 노랑을 꽉 붙든다
    ("4월 벚꽃",     [335, 345, 325, 350, 290, 110], 0.0, 4.0),
    ("5월 장미",     [352, 340,   5, 325, 125,  20], 0.0, 4.0),
    ("6월 수국",     [265, 280, 250, 215, 300, 185], 0.0, 4.0),
    ("7월 바다",     [195, 205, 185, 215, 170,  45], 0.0, 4.0),
    ("8월 불꽃놀이", [ 20,  50, 120, 200, 280, 330], 0.0, 0.8),   # 원래 여러 색이라 풀어 둔다
    ("9월 단풍",     [ 20,  10,  35,  45,   0,  60], 0.0, 4.5),
    ("10월 할로윈",  [ 28, 290,  95, 310, 352, 262], 0.0, 4.0),
    ("11월 낙엽",    [ 30,  22,  40,  15,  48,   8], 0.0, 4.5),
    ("12월 성탄",    [355,   5, 140, 130,  45, 345], 0.0, 4.0),
]

L_MIN, L_MAX = 46.0, 80.0     # 너무 어두우면 배경에 묻히고, 너무 밝으면 흰색처럼 보인다
C_MIN, C_MAX = 10.0, 62.0     # 채도. 1칸은 일부러 흐리게 둘 수 있어서 하한을 낮게
HUE_PULL = 1.1                # 기준 색상에서 1도 벗어날 때마다 깎는 점수. 높을수록 계절감이 남는다
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


def score(params, hues, cvd=2.0, pull=1.0):
    """클수록 좋다. 가장 가까운 두 색의 거리(세 시야 중 최악)에서 벌점을 뺀다."""
    rgb = [cp.hex_rgb(to_hex(lch_to_rgb(*p))) for p in params]   # 표현 가능한 색으로 한 번 접어서 잰다
    # 각 시야에서 "가장 가까운 두 색의 거리". 목표치까지만 점수로 쳐 주고 그 위는 안 쳐 준다
    # (더 벌리려고 계절감을 버리는 걸 막는다).
    val = 0.0
    for mode, target in ((None, cp.MIN_DE), ("적색맹", CVD_TARGET), ("녹색맹", CVD_TARGET)):
        cs = rgb if mode is None else [cp.simulate(c, mode) for c in rgb]
        w = min(cp.de2000(cs[i], cs[j]) for i in range(6) for j in range(i + 1, 6))
        if mode is None:
            val += min(w, target)
            # 정상 시야 구분은 색약과 무관하게 지켜야 한다. 여기가 무너지면 모두에게 안 보인다.
            if w < cp.MIN_DE:
                val -= 80 * (cp.MIN_DE - w)
        elif cvd > 0:
            val += min(w, target * (cvd / 2.0)) * cvd
            if w < CVD_FLOOR:
                val -= 60 * (CVD_FLOOR - w)      # 하한을 깨면 크게 깎는다
    worst = val
    pen = 0.0
    for (L, C, h), want in zip(params, hues):
        diff = abs((h - want + 180) % 360 - 180)
        pen += HUE_PULL * pull * diff
        col = cp.hex_rgb(to_hex(lch_to_rgb(L, C, h)))
        for surf, need in SURFACES:          # 블록이 올라가는 면마다 전부 확인
            ct = cp.contrast(col, surf)
            if ct < need:
                pen += 300 * (need - ct)
    return worst - pen


def make(name, hues, cvd=2.0, pull=1.0, seed=0, rounds=26000):
    rnd = random.Random(hash(name) & 0xFFFF if seed == 0 else seed)
    # 출발: 기준 색상 그대로, 밝기는 넓게 벌려 둔다(색맹에게는 밝기가 주된 단서라서)
    best = [[L_MIN + (L_MAX - L_MIN) * k / 5, 42.0, float(h)] for k, h in enumerate(hues)]
    rnd.shuffle(best)
    for p, h in zip(best, hues):
        p[2] = float(h)
    cur = [p[:] for p in best]
    cs, bs = score(cur, hues, cvd, pull), score(best, hues, cvd, pull)
    for step in range(rounds):
        t = 1.0 - step / rounds                     # 처음엔 크게, 나중엔 조금씩 흔든다
        cand = [p[:] for p in cur]
        i = rnd.randrange(6)
        cand[i][0] = max(L_MIN, min(L_MAX, cand[i][0] + rnd.gauss(0, 9 * t + 1)))
        cand[i][1] = max(C_MIN, min(C_MAX, cand[i][1] + rnd.gauss(0, 12 * t + 1)))
        cand[i][2] = (cand[i][2] + rnd.gauss(0, 26 * t + 2)) % 360
        s = score(cand, hues, cvd, pull)
        if s > cs:
            cur, cs = cand, s
            if s > bs:
                best, bs = [p[:] for p in cand], s
    return [to_hex(lch_to_rgb(*p)) for p in best], bs


if __name__ == "__main__":
    # 찾는 대로 바로 tools/palettes.py 에 쓴다. 오래 걸리는 작업이라, 중간에 끊겨도
    # 거기까지는 남아 있어야 한다(예전에 파이프 버퍼에 갇힌 채로 통째로 날아간 적이 있다).
    want = " ".join(sys.argv[1:]).strip()
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "palettes.py")
    header = io.open(out_path, encoding="utf-8").read().split("PALETTES = [")[0]
    rows = []

    def flush():
        with io.open(out_path, "w", encoding="utf-8", newline="
") as f:
            f.write(header + "PALETTES = [
" + "".join(rows) + "]
")

    for name, hues, cvd, pull in MOODS:
        if want and want != name:
            continue
        colors = None
        for seed in range(1, 13):           # 씨앗을 바꿔 가며 조건에 맞는 것을 찾는다
            c, _ = make(name, hues, cvd, pull, seed=seed, rounds=12000)
            bad = [x for x in cp.check(name, c) if cvd > 0 or not x.startswith(("[적색맹", "[녹색맹"))]
            if not bad:
                colors = c
                break
        if colors is None:
            print("✗ %s — 조건을 못 맞췄어요. 기준 색상이나 붙드는 세기를 손봐야 합니다." % name, flush=True)
            continue
        rgb = [cp.hex_rgb(x) for x in colors]
        mn = lambda m: min(cp.de2000(*((rgb[i], rgb[j]) if m is None
                                       else (cp.simulate(rgb[i], m), cp.simulate(rgb[j], m))))
                           for i in range(6) for j in range(i + 1, 6))
        rows.append('    ("%s", %s, %s),
' % (name, str(colors).replace("'", '"'), cvd > 0))
        flush()
        print("✓ %-14s 정상 %.1f · 적색맹 %.1f · 녹색맹 %.1f (seed %d)"
              % (name, mn(None), mn("적색맹"), mn("녹색맹"), seed), flush=True)

    print("
tools/palettes.py 에 %d개 썼습니다." % len(rows), flush=True)
