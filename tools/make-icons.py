"""앱 아이콘 생성기 — 「둘 중 하나」

게임의 '둘 중 하나 고르는' 화면을 그대로 담았다: 선택 카드 두 장이 나란히 있고,
안에 블록이 하나씩 들어 있다. 고르는 쪽(앞, 주황 블록)이 살짝 앞으로 나와 있다.

외부 라이브러리 없이 PNG를 직접 써서 만든다. 색이나 모양을 바꾸려면 아래 상수만 고치고 다시 실행:

    python tools/make-icons.py

웹(icons/)과 안드로이드 앱(android/app/src/main/res/)용 이미지를 한 번에 만든다.
"""
import math
import os
import struct
import zlib

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
WEB_OUT = os.path.join(ROOT, "icons")
ANDROID_RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

# ---- 색 (게임 CSS와 같은 값) ----
BG = (0x0F, 0x15, 0x1B)          # --bg (어두운 테마 배경)
CARD_FRONT = (0x21, 0x2C, 0x38)  # 고르는 쪽 카드 — --panel 보다 살짝 밝게
CARD_BACK = (0x1E, 0x28, 0x33)   # --panel 보다 살짝 밝게 — 작게 줄여도 카드가 두 장으로 보이게
BLOCK_FRONT = (0xF2, 0xB6, 0x40)  # --c4, 화면에 나오는 그 노란 블록
BLOCK_BACK = (0x4E, 0x5D, 0x6E)   # 뒤쪽 카드 블록 — 눈에 덜 띄게

SS = 4            # 슈퍼샘플링 배율 (계단현상 제거용)
CELL_GAP = 0.13   # 칸 사이 간격 (칸 크기 대비)
CELL_R = 0.19     # 칸 모서리 둥글기 (칸 크기 대비)

# 카드 안에 들어갈 블록 — 실제 게임에 나오는 모양 그대로. (x, y) 칸 좌표
PIECE_FRONT = [(0, 0), (1, 0), (1, 1), (2, 1)]   # ㄹ자
PIECE_BACK = [(0, 0), (1, 0), (2, 0), (2, 1)]    # ㄱ자

# ---- 배치 (아래 s = 그림 전체 크기 기준 비율) ----
CARD_W, CARD_H = 0.42, 0.62    # 카드 한 장 크기
CARD_R = 0.075                 # 카드 모서리
CARD_DX = 0.195                # 가운데에서 좌우로 밀어내는 거리
TILT = math.radians(7.5)       # 카드 기울기
PIECE_W = 0.82                 # 블록이 카드 폭에서 차지하는 비율


def blend(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = bytearray(w * h * 4)  # RGBA, 투명으로 시작

    def rrect(self, cx, cy, w, h, r, color, angle=0.0, shade=False):
        """가운데가 (cx, cy)인 둥근 사각형. angle 만큼 기울여 그린다.

        shade=True면 위는 밝게 아래는 어둡게 — 게임 블록의 입체감과 같은 처리.
        """
        ca, sa = math.cos(angle), math.sin(angle)
        ex = (abs(w * ca) + abs(h * sa)) / 2
        ey = (abs(w * sa) + abs(h * ca)) / 2
        hw, hh = w / 2, h / 2
        r = min(r, hw, hh)
        for py in range(max(0, int(cy - ey)), min(self.h, int(cy + ey) + 2)):
            for px in range(max(0, int(cx - ex)), min(self.w, int(cx + ex) + 2)):
                dx, dy = px + 0.5 - cx, py + 0.5 - cy
                lx = dx * ca + dy * sa          # 카드 기준 좌표로 되돌리기
                ly = -dx * sa + dy * ca
                if abs(lx) > hw or abs(ly) > hh:
                    continue
                qx = min(max(lx, -hw + r), hw - r)
                qy = min(max(ly, -hh + r), hh - r)
                if (lx - qx) ** 2 + (ly - qy) ** 2 > r * r:
                    continue
                c = color
                if shade:
                    t = (ly + hh) / h
                    if t < 0.18:
                        c = blend(color, (255, 255, 255), 0.28)
                    elif t > 0.82:
                        c = blend(color, (0, 0, 0), 0.22)
                i = (py * self.w + px) * 4
                self.px[i], self.px[i + 1], self.px[i + 2], self.px[i + 3] = c[0], c[1], c[2], 255

    def downsample(self, factor):
        w, h = self.w // factor, self.h // factor
        out = bytearray(w * h * 4)
        area = factor * factor
        for y in range(h):
            for x in range(w):
                r = g = b = a = 0
                for dy in range(factor):
                    row = (y * factor + dy) * self.w
                    for dx in range(factor):
                        i = (row + x * factor + dx) * 4
                        al = self.px[i + 3]
                        r += self.px[i] * al
                        g += self.px[i + 1] * al
                        b += self.px[i + 2] * al
                        a += al
                o = (y * w + x) * 4
                if a:
                    out[o], out[o + 1], out[o + 2] = r // a, g // a, b // a
                out[o + 3] = a // area
        return w, h, out


def write_png(path, w, h, rgba):
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))
    raw = bytearray()
    for y in range(h):
        raw.append(0)                       # 필터 없음
        raw += rgba[y * w * 4:(y + 1) * w * 4]
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)


def draw_card(cv, cx, cy, w, h, angle, card_color, cells, block_color):
    """카드 한 장 + 그 안의 블록."""
    cv.rrect(cx, cy, w, h, w * (CARD_R / CARD_W), card_color, angle)

    cols = max(x for x, _ in cells) + 1
    rows = max(y for _, y in cells) + 1
    cell = (w * PIECE_W) / (cols + (cols - 1) * CELL_GAP)
    gap = cell * CELL_GAP
    pw = cols * cell + (cols - 1) * gap
    ph = rows * cell + (rows - 1) * gap
    ca, sa = math.cos(angle), math.sin(angle)
    for (gx, gy) in cells:
        # 카드 기준 좌표 → 화면 좌표
        lx = -pw / 2 + cell / 2 + gx * (cell + gap)
        ly = -ph / 2 + cell / 2 + gy * (cell + gap)
        cv.rrect(cx + lx * ca - ly * sa, cy + lx * sa + ly * ca,
                 cell, cell, cell * CELL_R, block_color, angle, shade=True)


def make(width, height, radius_frac, content_frac, bg=True):
    """width x height 이미지. content_frac 은 짧은 변 기준 그림 크기.

    radius_frac=0.5 면 원형(안드로이드 round 아이콘), bg=False 면 배경 투명(적응형 아이콘 전경).
    """
    w, h = width * SS, height * SS
    cv = Canvas(w, h)
    short = min(w, h)
    if bg:
        cv.rrect(w / 2, h / 2, w, h, short * radius_frac, BG)

    s = short * content_frac / 0.82    # 0.82 = 기본 아이콘 기준
    mx, my = w / 2, h / 2
    # 뒤쪽(안 고른) 카드를 먼저, 앞쪽(고른) 카드를 그 위에
    draw_card(cv, mx + CARD_DX * s, my - 0.012 * s, CARD_W * s, CARD_H * s,
              TILT, CARD_BACK, PIECE_BACK, BLOCK_BACK)
    draw_card(cv, mx - CARD_DX * s, my + 0.012 * s, CARD_W * s, CARD_H * s,
              -TILT, CARD_FRONT, PIECE_FRONT, BLOCK_FRONT)

    return cv.downsample(SS)


def emit(path, width, height, radius_frac, content_frac, bg=True):
    w, h, rgba = make(width, height, radius_frac, content_frac, bg)
    write_png(path, w, h, rgba)
    print("  %-58s %4dx%-4d %6d bytes" % (os.path.relpath(path, ROOT), w, h, os.path.getsize(path)))


if __name__ == "__main__":
    print("웹:")
    for name, size, rad, content in [
        # 파일명,                  크기, 모서리, 그림 크기
        ("icon-192.png",           192, 0.22, 0.82),
        ("icon-512.png",           512, 0.22, 0.82),
        ("icon-maskable-512.png",  512, 0.00, 0.62),   # 안드로이드가 잘라내도 안전하게
        ("apple-touch-icon.png",   180, 0.00, 0.78),   # iOS가 알아서 둥글게 자름
        ("favicon-64.png",          64, 0.22, 0.88),
    ]:
        emit(os.path.join(WEB_OUT, name), size, size, rad, content)

    if os.path.isdir(ANDROID_RES):
        print("안드로이드:")
        # 밀도별 크기: 런처 아이콘 48dp, 적응형 아이콘 전경 108dp
        for dpi, scale in [("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2), ("xxhdpi", 3), ("xxxhdpi", 4)]:
            d = os.path.join(ANDROID_RES, "mipmap-" + dpi)
            n = round(48 * scale)
            emit(os.path.join(d, "ic_launcher.png"), n, n, 0.22, 0.82)          # 옛 안드로이드용
            emit(os.path.join(d, "ic_launcher_round.png"), n, n, 0.5, 0.74)     # 동그란 아이콘
            f = round(108 * scale)
            # 적응형 아이콘: 폰마다 원·둥근사각형 등으로 잘라내므로 가운데 66dp 안에만 그림
            emit(os.path.join(d, "ic_launcher_foreground.png"), f, f, 0, 0.56, bg=False)

        # 시작 화면: 어두운 배경 가운데에 아이콘 그림
        for orient in ("port", "land"):
            for dpi, (sw, sh) in [("mdpi", (320, 480)), ("hdpi", (480, 800)), ("xhdpi", (720, 1280)),
                                  ("xxhdpi", (960, 1600)), ("xxxhdpi", (1280, 1920))]:
                ww, hh = (sw, sh) if orient == "port" else (sh, sw)
                emit(os.path.join(ANDROID_RES, "drawable-%s-%s" % (orient, dpi), "splash.png"), ww, hh, 0, 0.42)
        emit(os.path.join(ANDROID_RES, "drawable", "splash.png"), 480, 320, 0, 0.42)
