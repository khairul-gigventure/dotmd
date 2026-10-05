#!/usr/bin/env python3
"""Render the DotMD PWA icons (180/192/512) in pure Python: dark rounded square, white "M", green dot."""
import math, os, struct, zlib

def render(size, ss=4):
    n = size * ss
    u = n / 100.0
    strokes = [((22*u, 70*u), (22*u, 28*u)), ((22*u, 28*u), (40*u, 52*u)),
               ((40*u, 52*u), (58*u, 28*u)), ((58*u, 28*u), (58*u, 70*u))]
    half, dot, dot_r, corner = 3.5 * u, (78*u, 66*u), 6.5 * u, 22 * u

    def seg(x, y, a, b):
        dx, dy = b[0]-a[0], b[1]-a[1]
        t = max(0, min(1, ((x-a[0])*dx + (y-a[1])*dy) / (dx*dx + dy*dy)))
        return math.hypot(x-(a[0]+t*dx), y-(a[1]+t*dy))

    def pixel(x, y):
        cx, cy = min(max(x, corner), n-1-corner), min(max(y, corner), n-1-corner)
        if (x-cx)**2 + (y-cy)**2 > corner**2:
            return (0, 0, 0, 0)
        if any(seg(x, y, a, b) <= half for a, b in strokes):
            return (255, 255, 255, 255)
        if math.hypot(x-dot[0], y-dot[1]) <= dot_r:
            return (52, 211, 153, 255)
        return (17, 24, 39, 255)

    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0, 0, 0, 0]
            for j in range(ss):
                for i in range(ss):
                    r, g, b, a = pixel(x*ss+i, y*ss+j)
                    acc[0] += r*a; acc[1] += g*a; acc[2] += b*a; acc[3] += a
            if acc[3] == 0:
                row += bytes([0, 0, 0, 0])
            else:
                row += bytes([acc[0]//acc[3], acc[1]//acc[3], acc[2]//acc[3], acc[3]//(ss*ss)])
        rows.append(bytes(row))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xffffffff)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b""))

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "web", "icons")
    os.makedirs(out, exist_ok=True)
    for size in (180, 192, 512):
        with open(os.path.join(out, f"icon-{size}.png"), "wb") as f:
            f.write(render(size))
        print("wrote", size)
