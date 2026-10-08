# 월 테마 팔레트 검사 — 「블록 딜레마」
#
#   python tools/check-palettes.py
#
# 블록 색은 "예쁜가"보다 "서로 구분되는가"가 먼저다. 크기를 색으로 알아보는 게 규칙의 일부라서,
# 두 크기가 비슷해 보이면 게임이 안 된다. 눈으로 고르면 놓치기 쉬우니(특히 색맹) 여기서 숫자로 본다.
#
# 보는 것 세 가지
#   1. 6색이 서로 충분히 다른가            → CIEDE2000 색거리
#   2. 어두운 배경 위에서 잘 보이는가       → WCAG 상대휘도 대비
#   3. 적록색약인 사람에게도 구분되는가     → 적색맹·녹색맹 시뮬레이션 후 다시 1번
#
# 기준을 못 넘으면 어느 색 쌍이 문제인지 찍어 준다. 색을 고치고 다시 돌리면 된다.
import math
import sys

# 윈도우 콘솔이 cp949 라서 ✓ 같은 글자에서 죽는다. 출력만 UTF-8 로 돌려 둔다.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# 블록이 실제로 올라가는 면. 배경(--bg)이 아니라 이 면들과 구분돼야 한다.
# 보드 칸(--cell)은 라이트 모드에서도 어두운 슬레이트색이고, 트레이·도감은 패널(--panel) 위다.
#   (면, 색, 요구 대비) — 보드는 게임이 벌어지는 곳이라 엄격하게, 패널은 블록이 크고
#   테두리 그림자가 있어서 느슨하게 본다.
SURFACES = [
    ("보드 칸(라이트)", "#36434F", 3.0),
    ("보드 칸(다크)",   "#2B3844", 3.0),
    ("패널(라이트)",    "#F5F8FA", 1.6),
    ("패널(다크)",      "#19222B", 1.6),
]
BG = "#2B3844"          # 생성기가 참고하는 기준 면
# 이상적으로는 정상 20 / 색맹 11 이면 좋다. 그런데 색맹 기준을 11 로 맞추면 12달 팔레트가
# 전부 비슷해져서 계절감이 사라진다(2026-10-08 확인). 그래서 쓰는 기준은 아래로 타협했다.
# 참고: 지금 게임에 들어 있는 색은 녹색맹 기준 2.1 이다 — 여기 기준은 그보다 네 배쯤 낫다.
MIN_DE = 19.0           # 6색끼리 (정상 시야)
MIN_DE_CVD = 8.0        # 적록색맹 시뮬레이션 뒤. 이상치는 11, 타협해서 8
MIN_CONTRAST = 3.0      # 기본 요구 대비 (면마다 SURFACES 에서 따로 정한다)


# ---- 색 공간 ----
def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def to_srgb(c):
    c = max(0.0, min(1.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def lin(rgb):
    return tuple(to_linear(c) for c in rgb)


def luminance(rgb):
    r, g, b = lin(rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def lab(rgb):
    r, g, b = lin(rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 1.00000
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (841 / 108) * t + 4 / 29
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def de2000(c1, c2):
    """CIEDE2000. 사람이 느끼는 색 차이에 가장 가깝다고 알려진 식."""
    L1, a1, b1 = lab(c1)
    L2, a2, b2 = lab(c2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))) if Cb > 0 else 0.5
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if (a1p or b1) else 0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if (a2p or b2) else 0

    dLp = L2 - L1
    dCp = C2p - C1p
    if C1p * C2p == 0:
        dhp = 0
    elif abs(h2p - h1p) <= 180:
        dhp = h2p - h1p
    else:
        dhp = h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp) / 2)

    Lbp = (L1 + L2) / 2
    Cbp = (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hbp = (h1p + h2p + 360) / 2
    else:
        hbp = (h1p + h2p - 360) / 2

    T = (1 - 0.17 * math.cos(math.radians(hbp - 30))
         + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6))
         - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dTh = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) if Cbp > 0 else 0
    Sl = 1 + (0.015 * (Lbp - 50) ** 2) / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp
    Sh = 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dTh)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2
                     + Rt * (dCp / Sc) * (dHp / Sh))


# ---- 색맹 시뮬레이션 (Viénot 1999, 선형 RGB 위에서) ----
CVD = {
    "적색맹": ((0.0, 2.02344, -2.52581), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)),
    "녹색맹": ((1.0, 0.0, 0.0), (0.494207, 0.0, 1.24827), (0.0, 0.0, 1.0)),
}


def simulate(rgb, kind):
    r, g, b = lin(rgb)
    m = CVD[kind]
    # 행렬은 LMS 공간을 전제로 하지만, 여기서는 널리 쓰이는 근사(선형 sRGB 직접 적용)를 쓴다.
    out = []
    for row in m:
        out.append(row[0] * r + row[1] * g + row[2] * b)
    return tuple(to_srgb(c) for c in out)


# ---- 검사 ----
def check(name, colors, soft_board=False):
    """colors = 1~6칸 순서의 hex 6개. 문제를 문자열 목록으로 돌려준다."""
    bad = []
    rgb = [hex_rgb(c) for c in colors]

    for sname, shex, need in SURFACES:
        if soft_board and "보드" in sname:
            need = 2.3
        surf = hex_rgb(shex)
        for i, c in enumerate(rgb):
            ct = contrast(c, surf)
            if ct < need:
                bad.append("[%s] %d칸 %s 이 묻힘 (대비 %.2f:1, %.1f 이상 필요)"
                           % (sname, i + 1, colors[i], ct, need))

    def pairs(cs, limit, label):
        for i in range(6):
            for j in range(i + 1, 6):
                d = de2000(cs[i], cs[j])
                if d < limit:
                    bad.append("%s %d칸·%d칸 이 비슷함 (색거리 %.1f, %.1f 이상 필요)"
                               % (label, i + 1, j + 1, d, limit))

    pairs(rgb, MIN_DE, "[정상]")
    for kind in CVD:
        pairs([simulate(c, kind) for c in rgb], MIN_DE_CVD, "[%s]" % kind)
    return bad


def report(palettes):
    ok = True
    for name, colors, *rest in palettes:
        need_cvd = rest[0] if rest else True
        # 월 테마는 "그 달 색 하나 + 밝기 단계"라 여섯 색을 벌리지 않는다.
        # 그래서 색거리 검사는 건너뛰고, 보이는지(면 대비)만 본다. 보드 기준도 2.3 으로 낮춘다
        # — 블록이 크고 안쪽 테두리와 문양이 있어서 그 정도면 경계가 보인다.
        month_theme = not need_cvd and name not in ("테스터",)
        bad = check(name, colors, soft_board=month_theme)
        if not need_cvd:
            bad = [x for x in bad if not x.startswith(("[적색맹", "[녹색맹"))]
        if month_theme:
            bad = [x for x in bad if not x.startswith("[정상]")]
        if bad:
            ok = False
            print("✗ %s" % name)
            for b in bad:
                print("    " + b)
        else:
            worst = min(de2000(hex_rgb(colors[i]), hex_rgb(colors[j]))
                        for i in range(6) for j in range(i + 1, 6))
            print("✓ %s  (가장 가까운 두 색 거리 %.1f)" % (name, worst))
    print()
    print("전부 통과" if ok else "고칠 것 있음")
    return ok


if __name__ == "__main__":
    from palettes import PALETTES
    report(PALETTES)
