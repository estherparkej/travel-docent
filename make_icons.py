"""앱 아이콘 PNG 생성. 외부 라이브러리 없이 zlib 로 직접 쓴다.

흰 라운드 사각형 위에 파란 지도 핀, 그 안에 흰 파형 다섯 줄.
경계는 거리함수로 재서 한 픽셀 안에서 부드럽게 섞는다(안티앨리어싱).
"""

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent / "docs" / "icons"

WHITE = (255, 255, 255)
BLUE = (11, 107, 250)          # #0B6BFA

# ── 아이콘 안에서의 비율 (0~1) ──────────────────────────────
R_CORNER = 0.2237              # 애플 스퀘어클과 같은 곡률
PIN_CX, PIN_CY, PIN_R = 0.500, 0.430, 0.260
PIN_TIP = 0.837                # 핀 끝이 닿는 높이
BAR_W, BAR_STEP, BAR_CY = 0.0338, 0.0749, 0.452
BAR_H = (0.0845, 0.1850, 0.3030, 0.1850, 0.0845)


def _rounded_rect(px, py, hw, hh, r):
    qx, qy = abs(px) - (hw - r), abs(py) - (hh - r)
    outside = math.hypot(max(qx, 0.0), max(qy, 0.0))
    return outside + min(max(qx, qy), 0.0) - r


def _capsule(px, py, ax, ay, bx, by, r):
    pax, pay = px - ax, py - ay
    bax, bay = bx - ax, by - ay
    dd = bax * bax + bay * bay
    h = 0.0 if dd == 0 else min(1.0, max(0.0, (pax * bax + pay * bay) / dd))
    return math.hypot(pax - bax * h, pay - bay * h) - r


def _triangle(px, py, tri):
    """세 꼭짓점이 이루는 삼각형까지의 부호 있는 거리."""
    (x0, y0), (x1, y1), (x2, y2) = tri
    sign = 1.0 if (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0) >= 0 else -1.0
    edges = (((x0, y0), (x1, y1)), ((x1, y1), (x2, y2)), ((x2, y2), (x0, y0)))
    best, inside = 1e9, True
    for (ax, ay), (bx, by) in edges:
        ex, ey = bx - ax, by - ay
        vx, vy = px - ax, py - ay
        dd = ex * ex + ey * ey
        h = 0.0 if dd == 0 else min(1.0, max(0.0, (vx * ex + vy * ey) / dd))
        best = min(best, math.hypot(vx - ex * h, vy - ey * h))
        if (vx * ey - vy * ex) * sign > 0:
            inside = False
    return -best if inside else best


def draw(size, pad_ratio=0.0, corner=R_CORNER, bg_full=False):
    s = float(size)
    px1 = 1.0 / s                       # 한 픽셀의 크기(비율 단위)
    k = 1.0 - pad_ratio                 # maskable 은 마크를 줄인다

    # 핀 — 원과, 끝점에서 원에 그은 두 접선이 만드는 삼각형의 합집합
    cx = PIN_CX
    cy = 0.5 + (PIN_CY - 0.5) * k
    r = PIN_R * k
    tip = 0.5 + (PIN_TIP - 0.5) * k
    d = tip - cy
    # 끝점에서 원에 그은 두 접선의 접점.
    # 중심에서 볼 때 아래 방향으로부터 β 만큼 벌어진 자리이고, cos β = r / d 다.
    cosb = min(1.0, r / d)
    sinb = math.sqrt(max(1.0 - cosb * cosb, 0.0))
    tri = ((cx, tip),
           (cx - r * sinb, cy + r * cosb),
           (cx + r * sinb, cy + r * cosb))

    bars = []
    for i, hh in enumerate(BAR_H):
        bx = cx + (i - 2) * BAR_STEP * k
        bh = hh * k
        bw = BAR_W * k
        by = 0.5 + (BAR_CY - 0.5) * k
        half = max(bh / 2 - bw / 2, 0.0)
        bars.append((bx, by - half, bx, by + half, bw / 2))

    def cover(dist):                    # 거리 → 덮은 정도 (0~1)
        return min(1.0, max(0.0, 0.5 - dist / px1))

    rows = []
    for y in range(size):
        row = bytearray()
        fy = (y + 0.5) / s
        for x in range(size):
            fx = (x + 0.5) / s

            a_bg = 1.0 if bg_full else cover(_rounded_rect(fx - .5, fy - .5, .5, .5, corner))
            if a_bg <= 0.0:
                row += b"\x00\x00\x00\x00"
                continue

            d_pin = min(math.hypot(fx - cx, fy - cy) - r, _triangle(fx, fy, tri))
            a_pin = cover(d_pin)

            a_bar = 0.0
            if a_pin > 0.0:
                for (ax, ay, bx2, by2, br) in bars:
                    a_bar = max(a_bar, cover(_capsule(fx, fy, ax, ay, bx2, by2, br)))

            # 흰 바탕 → 파란 핀 → 흰 파형 순으로 얹는다
            col = list(WHITE)
            for c in range(3):
                col[c] = col[c] + (BLUE[c] - col[c]) * a_pin
                col[c] = col[c] + (WHITE[c] - col[c]) * a_bar * a_pin
            row += bytes((int(col[0] + .5), int(col[1] + .5), int(col[2] + .5),
                          int(a_bg * 255 + .5)))
        rows.append(row)
    return rows


def png(path, w, h, pixels):
    raw = b"".join(b"\x00" + bytes(r) for r in pixels)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b""))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        png(OUT / f"icon-{size}.png", size, size, draw(size))
        print(f"  icon-{size}.png")
    # maskable: 모서리를 자를 수 있게 꽉 채우고, 마크는 안전 영역 안으로 줄인다
    png(OUT / "maskable-512.png", 512, 512, draw(512, pad_ratio=0.28, bg_full=True))
    print("  maskable-512.png")

    # 사파리 '홈 화면에 추가' 용.
    # iOS 는 이 아이콘의 투명한 부분을 검게 칠한 뒤 자기 모서리를 씌운다.
    # 그래서 모서리를 둥글리지 말고 흰색으로 끝까지 채워야 한다.
    for size in (152, 167, 180):
        png(OUT / f"apple-touch-{size}.png", size, size, draw(size, bg_full=True))
        print(f"  apple-touch-{size}.png")
