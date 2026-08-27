"""앱 아이콘 PNG 생성. 외부 라이브러리 없이 zlib 로 직접 쓴다."""

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent / "web" / "icons"


def png(path, w, h, pixels):
    raw = b"".join(b"\x00" + bytes(row) for row in pixels)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b""))


def draw(size, pad_ratio=0.0):
    """오렌지 배경에 헤드폰 마크. maskable 용으로 여백을 줄 수 있다."""
    s = size
    rows = []
    r_out = s * 0.225                       # 모서리 반지름
    cx, cy = s / 2, s / 2
    scale = 1 - pad_ratio                   # 글리프만 줄인다

    band = s * 0.075 * scale                # 아치 두께
    arc_r = s * 0.245 * scale               # 아치 반지름
    arc_cy = cy - s * 0.045 * scale
    cup_w = s * 0.088 * scale
    cup_h = s * 0.145 * scale
    cup_dx = arc_r
    cup_top = arc_cy

    for y in range(s):
        row = bytearray()
        for x in range(s):
            # 라운드 사각형 안쪽인지
            dx = max(r_out - x, x - (s - r_out), 0)
            dy = max(r_out - y, y - (s - r_out), 0)
            inside = math.hypot(dx, dy) <= r_out

            if not inside:
                row += bytes((0, 0, 0, 0))
                continue

            # 대각선 파랑 그라데이션 (#0062FF → #35A7FF)
            t = min(1.0, max(0.0, (x + y) / (2.0 * s)))
            R = int(0 + 53 * t)
            G = int(98 + 69 * t)
            B = 255

            fx, fy = x + .5, y + .5
            mark = False

            # 위쪽 아치
            d = math.hypot(fx - cx, fy - arc_cy)
            if fy <= arc_cy and abs(d - arc_r) <= band / 2:
                mark = True

            # 좌우 이어컵 (둥근 사각형)
            for sx in (-1, 1):
                ccx = cx + sx * cup_dx
                ex = abs(fx - ccx) - (cup_w / 2 - cup_w / 2)
                if (abs(fx - ccx) <= cup_w / 2
                        and cup_top <= fy <= cup_top + cup_h):
                    mark = True
                # 컵 아래 둥근 끝
                if math.hypot(fx - ccx, fy - (cup_top + cup_h)) <= cup_w / 2:
                    mark = True
                # 컵 위 둥근 끝
                if math.hypot(fx - ccx, fy - cup_top) <= cup_w / 2:
                    mark = True

            if mark:
                row += bytes((255, 253, 250, 255))
            else:
                row += bytes((R, G, B, 255))
        rows.append(row)
    return rows


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (180, 192, 512):
        png(OUT / f"icon-{size}.png", size, size, draw(size))
        print(f"  icon-{size}.png")
    # maskable: 안전 영역 확보를 위해 글리프를 줄인다
    png(OUT / "maskable-512.png", 512, 512, draw(512, pad_ratio=0.30))
    print("  maskable-512.png")
