#!/usr/bin/env python3
"""Organic village mockups: the Hearthfolk burrow and a medieval fishing village.

Terrain is carved with value noise, lit by dithered light pools (Bayer 4x4),
and every structure sits on something: floors on rock, lofts on posts, piers
on piles, the forge venting through a flue to the surface.

    python3 tools/mockups/villages.py  ->  mockups/villages/*.png + index.html
"""
import base64
import math
import os
from collections import deque

from PIL import Image

import scenes as S
import villagers as V
from pixel import RAMPS, Canvas, hx, mix

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'mockups', 'villages')
SCALE = 2
R = S.R

SOLID, CAVE, SKY, WATER = 0, 1, 2, 3
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def bayer(x, y):
    return (BAYER[y & 3][x & 3] + 0.5) / 16


def hval(i, j, seed):
    h = (i * 374761393 + j * 668265263 + seed * 1442695041) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535


def vnoise(x, y, cell, seed):
    fx, fy = x / cell, y / cell
    i, j = math.floor(fx), math.floor(fy)
    u, v = fx - i, fy - j
    u, v = u * u * (3 - 2 * u), v * v * (3 - 2 * v)
    a, b = hval(i, j, seed), hval(i + 1, j, seed)
    c, d = hval(i, j + 1, seed), hval(i + 1, j + 1, seed)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v


def fbm(x, y, cell, seed, octaves=3):
    t, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        t += vnoise(x, y, cell / (2 ** o), seed + o * 17) * amp
        norm += amp
        amp *= 0.5
    return t / norm


def pick(cols, t, x, y, spread=0.8):
    """Choose from a colour list by t in [0,1] with ordered dithering."""
    k = t * (len(cols) - 1) + (bayer(x, y) - 0.5) * spread
    return cols[max(0, min(len(cols) - 1, round(k)))]


class World:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.k = [[SOLID] * w for _ in range(h)]
        self.layer = S.Scene(w, h)                      # objects: props, timber, people
        self.layer.img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.layer.P = self.layer.img.load()
        self.lights = []

    def carve_fn(self, box, test, kind=CAVE):
        x0, y0, x1, y1 = box
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            for x in range(max(0, x0), min(self.w, x1 + 1)):
                if self.k[y][x] == SOLID and test(x, y):
                    self.k[y][x] = kind

    def blob(self, cx, cy, rx, ry, floor, seed, rough=0.28):
        def test(x, y):
            if y > floor:
                return False
            dx = (x - cx) / rx
            if y <= cy:
                d = dx * dx + ((y - cy) / ry) ** 2
            else:   # squarer bottom -> a wide, walkable floor
                d = dx ** 4 * 0.6 + dx * dx * 0.4 + ((y - cy) / (floor - cy + 3)) ** 4
            return d < 1 + (fbm(x, y, 18, seed) - 0.5) * 2 * rough
        self.carve_fn((cx - rx - 12, cy - ry - 12, cx + rx + 12, floor), test)

    def tunnel(self, ax, ay, bx, by, r, seed, floor=None, floor_fn=None):
        L2 = max(1, (bx - ax) ** 2 + (by - ay) ** 2)

        def test(x, y):
            if floor is not None and y > floor:
                return False
            if floor_fn and y > floor_fn(x):
                return False
            t = max(0, min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2))
            px, py = ax + (bx - ax) * t, ay + (by - ay) * t
            d = math.hypot(x - px, y - py)
            return d < r * (1 + (fbm(x, y, 12, seed) - 0.5) * 0.5)
        pad = r + 8
        self.carve_fn((min(ax, bx) - pad, min(ay, by) - pad, max(ax, bx) + pad, max(ay, by) + pad), test)

    def light(self, x, y, r, i, col=(1.25, 0.95, 0.62)):
        self.lights.append((x, y, r, i, col))

    def dist_to_solid(self, maxd=8):
        """BFS distance from each open cell to the nearest solid cell."""
        D = [[99] * self.w for _ in range(self.h)]
        q = deque()
        for y in range(self.h):
            for x in range(self.w):
                if self.k[y][x] == SOLID:
                    D[y][x] = 0
                    q.append((x, y))
        while q:
            x, y = q.popleft()
            d = D[y][x]
            if d >= maxd:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.w and 0 <= ny < self.h and D[ny][nx] > d + 1:
                    D[ny][nx] = d + 1
                    q.append((nx, ny))
        return D

    def lightmap(self, amb, amb_tint, solid_k=0.35):
        L = [[(amb, amb_tint)] * self.w for _ in range(self.h)]
        add = [[0.0] * self.w for _ in range(self.h)]
        col = [[(0, 0, 0)] * self.w for _ in range(self.h)]
        for (lx, ly, r, i, c) in self.lights:
            for y in range(max(0, ly - r), min(self.h, ly + r + 1)):
                for x in range(max(0, lx - r), min(self.w, lx + r + 1)):
                    d = math.hypot(x - lx, y - ly) / r
                    if d >= 1:
                        continue
                    v = i * (1 - d) ** 1.4
                    if self.k[y][x] == SOLID:
                        v *= solid_k
                    add[y][x] += v
                    o = col[y][x]
                    col[y][x] = (o[0] + c[0] * v, o[1] + c[1] * v, o[2] + c[2] * v)
        for y in range(self.h):
            for x in range(self.w):
                a = add[y][x]
                if a > 0:
                    c = col[y][x]
                    tint = tuple((amb_tint[j] * amb + c[j]) / (amb + a) for j in range(3))
                    L[y][x] = (amb + a, tint)
        return L


def shade(px, x, y, L):
    f, tint = L[y][x]
    q = math.floor(min(1.5, f) * 6 + bayer(x, y)) / 6
    return tuple(max(0, min(255, round(px[j] * q * tint[j]))) for j in range(3))


def compose(world, base, L, lit_kinds, unlit=None):
    """Light the terrain and the object layer, then stack them."""
    out = Image.new('RGBA', (world.w, world.h))
    O, B, Lp = out.load(), base.load(), world.layer.P
    for y in range(world.h):
        for x in range(world.w):
            c = B[x, y][:3]
            if world.k[y][x] in lit_kinds:
                c = shade(c, x, y, L)
            o = Lp[x, y]
            if o[3]:
                c = shade(o[:3], x, y, L)
            O[x, y] = c + (255,)
    if unlit:
        out.alpha_composite(unlit)
    return out


# ---------------------------------------------------------------------------
# Scene 1: the Hearthfolk burrow
# ---------------------------------------------------------------------------

def planks(sc, x0, x1, y):
    for x in range(x0, x1 + 1):
        sc.px(x, y, R('wood', 3))
        sc.px(x, y + 1, R('wood', 2) if x % 13 else R('wood', 1))
        sc.px(x, y + 2, R('wood', 1))


def post(sc, x, y0, y1, w=3):
    for y in range(round(y0), round(y1) + 1):
        for i in range(w):
            sc.px(x + i, y, R('wood', 3 if i == 0 else (1 if i == w - 1 else 2)))


def ladder(sc, x0, y0, y1):
    for y in range(y0, y1 + 1):
        sc.px(x0, y, R('wood', 3))
        sc.px(x0 + 7, y, R('wood', 1))
        if (y - y0) % 4 == 1:
            for x in range(x0 + 1, x0 + 7):
                sc.px(x, y, R('wood', 2))


def floor_span(world, y, x_hint):
    """Open span along row y around x_hint (where a floor can be laid)."""
    x0 = x1 = x_hint
    while x0 > 0 and world.k[y][x0 - 1] == CAVE:
        x0 -= 1
    while x1 < world.w - 1 and world.k[y][x1 + 1] == CAVE:
        x1 += 1
    return x0, x1


def ceiling(world, x, y):
    while y > 0 and world.k[y - 1][x] == CAVE:
        y -= 1
    return y


def underground():
    W, H = 640, 448
    w = World(W, H)
    sc = w.layer

    def ground(x):
        return 72 + round((fbm(x, 0, 60, 3) - 0.5) * 18)
    for x in range(W):
        for y in range(ground(x)):
            w.k[y][x] = SKY

    # --- caves: carved so every floor is flat and every room connects ---
    F1, F2, F3 = 182, 318, 420
    stair = lambda x: 76 + (x - 72) * 1.02          # noqa: E731  entrance stair line
    w.tunnel(66, 52, 176, 150, 30, 5, floor_fn=lambda x: stair(x) + 1)
    w.blob(186, 150, 42, 36, F1, 11)                # guard alcove at the stair foot
    w.blob(338, 140, 104, 50, F1, 12)               # great hall
    w.tunnel(210, 160, 250, 160, 24, 13, floor=F1)
    w.blob(538, 146, 62, 40, F1, 14)                # forge
    w.tunnel(420, 158, 486, 158, 26, 15, floor=F1)
    w.tunnel(560, 118, 566, 40, 5, 16)              # flue fissure to the surface
    w.blob(166, 282, 74, 38, F2, 21)                # sleeping cave
    w.blob(360, 280, 84, 40, F2, 22)                # dye & weave workshop
    w.tunnel(228, 298, 286, 298, 24, 23, floor=F2)
    w.tunnel(314, F1 - 4, 314, 294, 9, 24)          # shaft: hall -> workshop
    w.blob(470, 392, 138, 32, F3, 31, rough=0.38)   # mine gallery
    w.tunnel(414, F2 - 4, 414, 380, 9, 32)          # shaft: workshop -> mine

    # --- terrain base colours ---
    D = w.dist_to_solid()
    base = Image.new('RGBA', (W, H))
    B = base.load()
    dirt = [hx('2a1d15'), hx('35251a'), hx('412e20'), hx('4d3726')]
    rock = [hx('262223'), hx('302b2b'), hx('3a3433'), hx('463e3c')]
    wall = [hx('3a2619'), hx('45301f'), hx('513925'), hx('5c422b')]
    sky = [hx('0f1424'), hx('141a2c'), hx('192036'), hx('1f2740'), hx('27304a')]
    for y in range(H):
        for x in range(W):
            k = w.k[y][x]
            if k == SKY:
                c = pick(sky, y / 80, x, y, 1.0)
            elif k == SOLID:
                deep = y > 300 + (fbm(x, 0, 50, 8) - 0.5) * 50
                n = fbm(x, y, 7, 2)
                c = pick(rock if deep else dirt, n, x, y)
                if fbm(x, y, 3, 9) > 0.72:                   # embedded stones
                    c = hx('3b3436') if deep else hx('3a2c22')
                if D[y][x] == 0 and any(0 <= y + dy < H and 0 <= x + dx < W and w.k[y + dy][x + dx] == CAVE
                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    c = hx('120c09')                         # cave edge line
            else:
                n = fbm(x, y, 6, 4) * 0.8 + ((y // 6) % 2) * 0.12
                c = pick(wall, n, x, y)
                ao = min(D[y][x], 7)
                c = mix(c, hx('120c09'), max(0, 0.5 - ao * 0.07))
            B[x, y] = c + (255,)
    for x in range(W):                                        # grass lip
        g = ground(x)
        if w.k[g][x] == SOLID:
            for dy, t in ((0, 3), (1, 2), (2, 1)):
                B[x, g + dy] = R('grass', t) + (255,)
            if x % 5 == 0:
                B[x, g - 1] = R('grass', 2) + (255,)
    for i in range(90):                                       # stars
        x, y = int(hval(i, 1, 7) * W), int(hval(i, 2, 7) * 50)
        if w.k[y][x] == SKY:
            B[x, y] = (hx('cfcab2') if i % 4 == 0 else hx('5d6278')) + (255,)

    # --- timber: floors, posts, loft, ladders, stairs ---
    for (y, xh, skip) in ((F1, 330, (310, 322)), (F1, 186, None), (F1, 540, None), (F1, 450, None),
                          (F2, 166, None), (F2, 360, (410, 422)), (F2, 257, None)):
        x0, x1 = floor_span(w, y - 3, xh)
        planks(sc, x0, x1, y - 2)
        if skip:
            for x in range(*skip):
                for yy in range(y - 2, y + 1):
                    sc.P[x, yy] = (0, 0, 0, 0)
    # stairs: treads cut along the entrance slope
    for x in range(72, 170, 5):
        y = round(stair(x))
        for i in range(6):
            sc.px(x + i, y, R('wood', 3))
            sc.px(x + i, y + 1, R('wood', 1))
        sc.px(x, y + 2, R('wood', 1))
    post(sc, 72, 42, stair(72) - 1)                           # timber door frame at the mouth
    post(sc, 102, 44, ground(102) - 1)
    for x in range(68, 108):
        sc.px(x, 42, R('wood', 3))
        sc.px(x, 43, R('wood', 1))
    for x in range(64, 112):                                  # little thatched hood over it
        for y in range(34, 42):
            if abs(x - 88) < 24 - (41 - y) * 1.5:
                sc.px(x, y, pick([R('ochre', 1), R('ochre', 2), R('ochre', 3)], (y - 34) / 8, x, y))
    # hall: loft platform on posts, with ladder, storage on top
    planks(sc, 380, 436, 128)
    post(sc, 380, 131, F1 - 3)
    post(sc, 432, 131, F1 - 3)
    post(sc, 380, ceiling(w, 381, 128), 127)                  # the loft post carries the roof too
    ladder(sc, 440, 124, F1 - 3)
    sc.put(S.crate(), 386, 128 - 14)
    sc.put(S.barrel(w=12, h=16), 402, 128 - 16)
    sc.put(S.sack(), 418, 128 - 13)
    for hx_ in (296, 308, 344):
        sc.put(S.herbs(), hx_, ceiling(w, hx_ + 2, 150))
    # ladders in the shafts
    ladder(sc, 312, F1 - 8, F2 - 3)
    ladder(sc, 412, F2 - 8, F3 - 3)
    # forge flue: stone chimney up the fissure, capped above ground
    for y in range(26, 118):
        for x in range(559, 568):
            sc.px(x, y, R('stone', 1 if (y % 4 == 0 or x in (559, 567)) else 2))
    for x in range(557, 570):
        sc.px(x, 24, R('stone', 3))
        sc.px(x, 25, R('stone', 2))
    # mine timber sets + rails
    for tx in (380, 450, 530):
        top = ceiling(w, tx, F3 - 4)
        post(sc, tx, top + 3, F3 - 3)
        post(sc, tx + 26, ceiling(w, tx + 26, F3 - 4) + 3, F3 - 3)
        for x in range(tx, tx + 29):
            sc.px(x, top + 3, R('wood', 3))
            sc.px(x, top + 4, R('wood', 1))
    x0, x1 = floor_span(w, F3 - 3, 470)
    for x in range(x0, x1 + 1):
        sc.px(x, F3 - 1, R('wood', 1) if x % 5 == 0 else R('stone', 1))
        sc.px(x, F3 - 3, R('iron', 3))

    # --- props, each room with one unmistakable job ---
    sc.put(S.spear_rack(), 150, F1 - 2 - 42)
    sc.put(S.shield(), 206, 128)
    sc.put(S.bench(14), 206, F1 - 9)
    sc.put(S.hearth(), 238, F1 - 2 - 45)
    sc.put(S.table(), 296, F1 - 2 - 14)
    sc.put(S.bench(), 288, F1 - 8)
    sc.put(S.bench(), 330, F1 - 8)
    sc.put(S.furnace(), 548, F1 - 2 - 43)
    sc.put(S.anvil(), 522, F1 - 2 - 14)
    sc.put(S.tool_rack(), 500, 134)
    sc.put(S.barrel('sea'), 588, F1 - 2 - 12)
    sc.put(S.bunk(), 110, F2 - 2 - 39)
    sc.put(S.bunk(), 150, F2 - 2 - 39)
    sc.put(S.chest(), 190, F2 - 2 - 10)
    sc.put(S.vat('madder'), 292, F2 - 2 - 14)
    sc.put(S.vat('indigo'), 330, F2 - 2 - 14)
    sc.put(S.loom(), 372, F2 - 2 - 43)
    for i, x in enumerate(range(296, 360, 6)):               # skeins drying on a line
        m = ['madder', 'indigo', 'ochre', 'moss', 'wool_oat'][i % 5]
        sc.rect(x - 1, 262, x + 1, 268, R(m, 3))
        sc.rect(x + 1, 262, x + 1, 268, R(m, 1))
    for x in range(292, 362):
        sc.px(x, 261, R('wood', 1))
    sc.put(S.mine_cart(), 500, F3 - 3 - 19)
    for i in range(40):                                       # ore veins in the gallery walls
        x, y = 350 + int(hval(i, 3, 5) * 260), 350 + int(hval(i, 4, 5) * 70)
        if w.k[y][x] == SOLID:
            sc.px(x, y, R('copper', 3))
            sc.px(x + 1, y, R('amber', 4))
    for (lx, ly) in ((186, 112), (338, 104), (170, 252), (360, 250), (420, 372), (92, 46), (128, 108)):
        top = ceiling(w, lx, ly) if w.k[ly][lx] == CAVE else ly - 4
        for y in range(top, ly):
            sc.px(lx + 3, y, R('iron', 1))
        sc.put(S.lantern(), lx, ly)

    for (px_, h) in ((14, 40), (40, 30), (262, 46), (300, 34), (420, 42), (470, 30), (612, 44)):
        sc.put(S.pine(h), px_, ground(px_ + h // 3) - h - 1)

    # --- villagers at work ---
    S.stand(sc, V.sp_holt, 170, F1 - 2)
    S.stand(sc, V.sp_edda, 274, F1 - 2, flip=True)
    S.stand(sc, V.sp_brannock, 498, F1 - 2)
    S.stand(sc, V.sp_maren, 344, F2 - 2)
    S.stand(sc, V.sp_orsk, 462, F3 - 2)
    S.stand(sc, V.sp_tavi, 214, ground(228), flip=True)

    for (x, y, r, i) in ((189, 116, 80, 0.9), (256, 160, 120, 1.3), (341, 108, 90, 0.8),
                         (566, 164, 110, 1.3), (173, 256, 80, 0.8), (363, 254, 90, 0.9),
                         (423, 376, 80, 0.8), (475, 354, 60, 0.7), (95, 50, 60, 0.7), (131, 112, 60, 0.7)):
        w.light(x, y, r, i)
    L = w.lightmap(0.3, (0.92, 0.86, 0.9))
    # the surface sits under a dim moon, not in cave darkness
    for y in range(H):
        for x in range(W):
            if y < ground(x) + 3 and L[y][x][0] < 0.62:
                L[y][x] = (0.62, (0.82, 0.88, 1.08))
    unlit = Image.new('RGBA', (W, H), (0, 0, 0, 0))           # moon + smoke aren't lit
    U = S.Scene(W, H)
    U.img, U.P = unlit, unlit.load()
    U.disc(590, 20, 7, hx('d8d2b8'))
    U.disc(593, 18, 6, sky[0])
    for i in range(5):
        U.disc(563 + i * 3 - (i % 2) * 2, 18 - i * 6, 2 + i // 2, mix(hx('6a6a70'), sky[0], 0.2 + i * 0.14))
    return compose(w, base, L, (SOLID, CAVE, SKY), unlit)


# ---------------------------------------------------------------------------
# Medieval Saltfolk villagers
# ---------------------------------------------------------------------------

def stripe(c, y, x0, x1):
    for x in range(x0, x1 + 1):
        c.px(x, y, 'sail' if x % 2 else 'sea', 3 if x % 2 else 2)


def sp_wick():
    """Fisher: weld-yellow tunic, sea-blue hood with a shoulder cape, hose, turnshoes."""
    c = V.sprite()
    s = 'skin_e'
    for x0 in (5, 20):
        c.rect(x0, 15, x0 + 1, 25, 'oilskin')
        c.rect(x0, 26, x0 + 1, 27, s, 2)
    c.rect(8, 15, 18, 22, 'oilskin')
    V.skirt(c, 'oilskin', 23, 35, 8, 18, step=7)
    c.rect(8, 24, 18, 24, 'leather', 2)
    stripe(c, 35, 8, 19)
    c.rect(10, 36, 12, 46, 'wool_grey')
    c.rect(14, 36, 16, 46, 'wool_grey')
    c.rect(9, 47, 12, 49, 'leather')
    c.rect(14, 47, 17, 49, 'leather')
    V.sp_face(c, s, 'hair_brown')
    c.pts([(12, 11), (14, 11), (16, 10), (11, 10)], 'hair_brown', 1)
    c.rect(11, 2, 15, 3, 'sea', 3)                   # hood
    c.rect(10, 4, 16, 5, 'sea')
    c.rect(9, 5, 10, 12, 'sea', 1)
    c.rect(8, 12, 18, 14, 'sea')                     # shoulder cape
    c.rect(7, 14, 19, 15, 'sea', 1)
    c.pts([(8, 3), (7, 4), (7, 5)], 'sea', 1)        # liripipe tail
    c.px(13, 16, 'shell', 4)
    return c


def sp_nell():
    """Fishmonger: madder kirtle, linen coif, plain apron, fish in hand."""
    c = V.sprite()
    s = 'skin_b'
    c.rect(9, 13, 17, 22, 'coral')
    V.skirt(c, 'coral', 23, 46)
    for x0 in (6, 19):
        c.rect(x0, 14, x0 + 1, 18, 'coral')
        c.rect(x0, 19, x0 + 1, 25, s)
        c.rect(x0, 26, x0 + 1, 27, s, 1)
    c.rect(10, 17, 16, 41, 'sail')
    stripe(c, 40, 10, 16)
    c.rect(9, 22, 17, 22, 'leather', 2)
    c.rect(10, 47, 12, 48, 'leather')
    c.rect(14, 47, 17, 48, 'leather')
    c.px(13, 15, 'shell', 4)
    c.rect(20, 28, 20, 35, 'fish', 3)
    c.rect(21, 29, 21, 34, 'fish', 1)
    c.px(20, 34, 'eye')
    V.sp_face(c, s, 'hair_brown')
    c.rect(11, 2, 15, 2, 'sail', 4)                  # coif
    c.rect(10, 3, 16, 5, 'sail', 3)
    c.rect(9, 5, 10, 10, 'sail', 2)
    c.rect(11, 12, 15, 12, 'sail', 2)                # chin band
    c.rect(16, 10, 16, 11, 'sail', 2)
    return c


def sp_ottie():
    """Net-mender: old woman, blue wool kirtle, red shawl, linen headcloth, net."""
    c = V.sprite()
    s = 'skin_d'
    for x0 in (6, 19):
        c.rect(x0, 14, x0 + 1, 26, 'sea')
        c.rect(x0, 27, x0 + 1, 28, s, 2)
    c.rect(8, 13, 18, 28, 'sea')
    V.skirt(c, 'navy', 29, 46, 9, 17, step=8)
    stripe(c, 44, 7, 19)
    c.rect(8, 13, 18, 17, 'coral')
    c.pts([(9, 18), (11, 18), (15, 18), (17, 18), (13, 19)], 'coral', 1)
    for y in range(22, 34):
        for x in range(16, 25):
            if (x + y) % 3 == 0 or (x - y) % 3 == 0:
                c.px(x, y, 'sail', 3 if (x + y) % 2 else 2)
    c.rect(10, 47, 12, 48, 'leather')
    c.rect(14, 47, 16, 48, 'leather')
    c.px(13, 20, 'shell', 4)
    V.sp_face(c, s, 'hair_grey')
    c.rect(11, 2, 15, 2, 'sail', 4)
    c.rect(10, 3, 16, 5, 'sail', 3)
    c.rect(9, 5, 10, 12, 'sail', 2)
    c.px(12, 10, s, 1)
    c.px(11, 6, 'hair_grey', 3)
    return c


def sp_aldous():
    """Beacon-keeper: long grey hooded cloak, grey beard, torch."""
    c = V.sprite()
    s = 'skin_a'
    c.rect(21, 20, 21, 34, 'wood')                   # torch
    c.pts([(21, 17), (20, 18), (21, 18), (22, 18), (21, 19)], 'flame', 3)
    c.px(21, 16, 'flame', 4)
    c.rect(7, 13, 19, 13, 'wool_grey')
    c.rect(6, 14, 20, 30, 'wool_grey')
    V.skirt(c, 'wool_grey', 31, 45, 6, 20, step=9)
    c.rect(12, 15, 14, 44, 'navy', 1)                # tunic showing at the front
    c.rect(12, 26, 14, 26, 'leather', 2)
    stripe(c, 44, 6, 21)
    c.rect(20, 25, 21, 26, s, 2)
    c.rect(10, 46, 12, 48, 'leather')
    c.rect(14, 46, 17, 48, 'leather')
    c.px(13, 16, 'shell', 4)
    V.sp_face(c, s, 'hair_grey')
    c.rect(12, 10, 16, 10, 'hair_grey', 3)
    c.rect(11, 11, 16, 12, 'hair_grey', 2)
    c.rect(12, 13, 15, 14, 'hair_grey', 1)
    c.rect(11, 1, 15, 2, 'wool_grey', 3)             # hood up
    c.rect(9, 3, 17, 4, 'wool_grey')
    c.rect(9, 5, 10, 13, 'wool_grey', 1)
    c.rect(17, 5, 17, 8, 'wool_grey', 1)
    return c


def sp_jory():
    """Boatwright: undyed linen tunic, sleeves rolled, leather belt and apron, mallet."""
    c = V.sprite()
    s = 'skin_c'
    for x0 in (5, 20):
        c.rect(x0, 14, x0 + 1, 18, 'sail')
        c.rect(x0, 19, x0 + 1, 25, s)
        c.rect(x0, 26, x0 + 1, 27, s, 1)
    c.rect(7, 13, 19, 13, 'sail')
    c.rect(5, 14, 21, 14, 'sail')
    c.rect(8, 15, 18, 32, 'sail')
    c.rect(10, 18, 16, 36, 'leather')
    c.rect(8, 24, 18, 24, 'leather', 1)
    stripe(c, 25, 8, 18)
    V.sp_legs(c, 'walnut', 'leather', y0=33)
    c.px(13, 15, 'shell', 4)
    c.rect(21, 28, 21, 33, 'wood')
    c.rect(19, 34, 23, 37, 'wood', 3)
    V.sp_face(c, s, 'hair_black')
    c.rect(11, 3, 15, 3, 'hair_black', 2)
    c.rect(10, 4, 16, 5, 'hair_black', 1)
    c.rect(10, 6, 10, 8, 'hair_black', 1)
    c.pts([(11, 11), (12, 11), (14, 11), (15, 11)], 'hair_black', 1)
    return c


# ---------------------------------------------------------------------------
# Scene 2: a medieval fishing village at dusk
# ---------------------------------------------------------------------------

def thatch(sc, cx, y_eave, half, h, seed):
    """Rounded thatched roof: straw rows, dithered, with a heavy overhang."""
    cols = [R('ochre', 1), R('ochre', 2), R('ochre', 3), R('sand', 3)]
    for y in range(y_eave - h, y_eave + 3):
        t = (y - (y_eave - h)) / h
        span = half * min(1, math.sqrt(max(0, t)) * 1.15) + 4
        for x in range(round(cx - span), round(cx + span) + 1):
            n = fbm(x, y * 3, 5, seed)
            k = 1 - (x - cx + span) / (2 * span) * 0.6 - (0.3 if y > y_eave else 0)
            sc.px(x, y, pick(cols, max(0, min(1, k * 0.8 + n * 0.3)), x, y))
        if y % 4 == 0:
            for x in range(round(cx - span), round(cx + span) + 1, 3):
                sc.px(x, y, R('ochre', 1))


def cottage(sc, x0, x1, ground, seed, door_x=None, window=True):
    """Timber frame + lime daub, on a stone sill."""
    top = ground - 40
    for y in range(ground - 4, ground):
        for x in range(x0 - 2, x1 + 3):
            sc.px(x, y, R('stone', 1 if (x + (y // 2) * 3) % 6 == 0 else 2))
    for y in range(top, ground - 4):
        for x in range(x0, x1 + 1):
            sc.px(x, y, pick([R('sail', 2), R('sail', 3), R('sail', 4)], fbm(x, y, 4, seed), x, y))
    for x in (x0, x0 + 1, (x0 + x1) // 2, (x0 + x1) // 2 + 1, x1 - 1, x1):
        for y in range(top, ground - 4):
            sc.px(x, y, R('walnut', 1))
    for y in (top, top + 1, ground - 20):
        for x in range(x0, x1 + 1):
            sc.px(x, y, R('walnut', 1))
    for i in range(18):                                   # diagonal braces
        sc.px(x0 + 2 + i, ground - 21 - i, R('walnut', 2))
    dx = door_x if door_x is not None else x1 - 16
    sc.rect(dx, ground - 22, dx + 9, ground - 5, R('wood', 1))
    sc.rect(dx + 4, ground - 22, dx + 4, ground - 5, R('wood', 0))
    if window:
        wx = x0 + 6
        sc.rect(wx, ground - 16, wx + 7, ground - 9, R('walnut', 1))
        sc.rect(wx + 1, ground - 15, wx + 6, ground - 10, R('flame', 3))
        sc.rect(wx + 3, ground - 15, wx + 4, ground - 10, R('walnut', 1))
    thatch(sc, (x0 + x1) / 2, top + 2, (x1 - x0) / 2 + 6, 26, seed)


def fish_rack(sc, x0, x1, ground):
    for px_ in (x0, x1):
        sc.line(px_ - 4, ground - 1, px_, ground - 30, R('wood', 2))
        sc.line(px_ + 4, ground - 1, px_, ground - 30, R('wood', 1))
    for x in range(x0, x1 + 1):
        sc.px(x, ground - 29, R('wood', 3))
    for i, x in enumerate(range(x0 + 4, x1 - 2, 5)):
        sc.px(x, ground - 28, R('wood', 1))
        sc.rect(x - 1, ground - 27, x + 1, ground - 20 - (i % 2) * 2, R('fish', 3))
        sc.rect(x + 1, ground - 27, x + 1, ground - 20 - (i % 2) * 2, R('fish', 1))


def clinker_boat(sail=True, mast=True):
    c = Canvas(64, 58)
    for y in range(44, 56):
        inset = ((y - 44) ** 2) // 7
        for x in range(2 + inset, 61 - inset):
            c.px(x, y, 'wood', 1 if (y - 44) % 3 == 2 else (3 if (y - 44) % 3 == 0 else 2))
    c.pts([(1, 40), (1, 41), (2, 42), (2, 43), (62, 40), (62, 41), (61, 42), (61, 43)], 'wood', 3)
    if mast:
        c.rect(31, 4, 32, 44, 'wood')
    if sail:
        c.rect(14, 6, 49, 7, 'wood', 1)                    # yard
        for y in range(8, 32):
            for x in range(15, 49):
                stripe_ = ((x - 15) // 6) % 2
                c.px(x, y, 'coral' if stripe_ else 'sail', 2 if y > 26 else 3)
    return c


def seaside():
    W, H = 640, 360
    w = World(W, H)
    sc = w.layer
    SEA = 268

    def land(x):
        if x < 170:
            return 150 + round((fbm(x, 0, 30, 41) - 0.5) * 10)
        if x < 250:
            t = (x - 170) / 80
            return round(150 + (254 - 150) * (t ** 0.7) + (fbm(x, 0, 12, 42) - 0.5) * 8)
        if x < 360:
            return 254 + (x - 250) // 12
        return min(340, 264 + round((x - 360) * 0.55 + (fbm(x, 0, 20, 43) - 0.5) * 8))

    for y in range(H):
        for x in range(W):
            g = land(x)
            if y < g:
                w.k[y][x] = WATER if y >= SEA else SKY
    base = Image.new('RGBA', (W, H))
    B = base.load()
    skyc = [hx('2d3350'), hx('433f5c'), hx('6a4f62'), hx('9a6660'), hx('c4825e'), hx('dca36a')]
    seac = [hx('1a2a3a'), hx('20354a'), hx('2a4458'), hx('35546a'), hx('45687c')]
    rockc = [hx('231e1f'), hx('2f2828'), hx('3b3332'), hx('4a403c'), hx('5a4e46')]
    sandc = [R('sand', 1), R('sand', 2), R('sand', 3)]
    for y in range(H):
        for x in range(W):
            k = w.k[y][x]
            if k == SKY:
                c = pick(skyc, (y / SEA) ** 1.3, x, y, 1.0)
            elif k == WATER:
                c = pick(seac, 1 - (y - SEA) / (H - SEA) * 0.9, x, y, 1.0)
                if y < SEA + 40 and 470 < x < 520 and (x * 3 + y * 7) % 9 < 2:
                    c = hx('c4825e')                          # sun glitter
            else:
                g = land(x)
                if x < 250 and (y < 256 or y - g > 5):
                    n = fbm(x, y, 8, 44) + ((y + x // 7) % 9 == 0) * 0.25
                    c = pick(rockc, n, x, y)
                    if y - g < 3 and x < 175:
                        c = R('grass', 2 if y - g else 3)
                else:
                    c = pick(sandc + [rockc[4]], max(0.0, 0.9 - (y - g) / 70), x, y)
                    if k == SOLID and y > SEA:
                        c = mix(c, seac[1], 0.3)
            B[x, y] = c + (255,)
    for x in range(W):                                        # foam line
        if w.k[SEA][x] == WATER:
            B[x, SEA] = (hx('b4b6ae') if x % 11 < 5 else seac[4]) + (255,)
    for y in range(SEA - 20, SEA):                            # sun sinking into the sea
        for x in range(476, 516):
            if (x - 496) ** 2 + (y - SEA) ** 2 < 19 * 19:
                B[x, y] = hx('f0c47a') + (255,)
    for x in range(400, 470):                                 # a far headland
        for y in range(SEA - 6 + abs(x - 435) // 6, SEA):
            B[x, y] = hx('4b4058') + (255,)

    # cliff steps with a rope rail on stakes
    for i in range(16):
        x = 172 + i * 5
        y = land(x) - 1
        sc.rect(x, y, x + 5, y + 1, R('stone', 3))
        if i % 3 == 0:
            post(sc, x + 2, y - 12, y - 1, w=2)
    for i in range(15):
        x0, x1 = 174 + i * 5, 179 + i * 5
        sc.line(x0, land(x0) - 12, x1, land(x1) - 12, R('ochre', 1))

    # beacon tower
    for y in range(58, 151):
        half = 16 if y > 70 else 18
        for x in range(64 - half, 64 + half + 1):
            joint = (y % 6 == 0) or ((x + (y // 6) * 5) % 10 == 0)
            t = 0.25 + (x - 64 + half) / (2 * half) * 0.6       # lit from the sunset side
            sc.px(x, y, R('stone', 1) if joint else pick([R('stone', 1), R('stone', 2), R('stone', 3)], t, x, y))
    for x in range(45, 84):                                   # crenellations
        if (x // 5) % 2 == 0:
            for y in range(52, 58):
                sc.px(x, y, R('stone', 2 if x < 70 else 3))
    sc.rect(58, 128, 69, 150, R('wood', 1))
    sc.rect(63, 128, 63, 150, R('wood', 0))
    for wy in (80, 104):
        sc.rect(62, wy, 65, wy + 8, R('flame', 3))
    sc.rect(56, 44, 72, 51, R('iron', 1))                     # iron brazier
    for y in range(28, 46):
        for x in range(56, 73):
            half = (y - 26) * 0.45 * (0.6 + fbm(x, y * 2, 4, 45) * 0.8)
            if abs(x - 64) < half:
                sc.px(x, y, R('flame', min(4, 1 + (y - 28) // 4 - (1 if abs(x - 64) > half - 2 else 0))))
    # net-mender's cottage on the clifftop, net drying on a pole
    cottage(sc, 106, 150, land(128), 51)
    post(sc, 158, land(158) - 40, land(158) - 1, w=2)
    for x in range(144, 158):
        for y in range(land(158) - 38, land(158) - 12):
            if (x + y) % 3 == 0 or (x - y) % 3 == 0:
                sc.px(x, y, R('sail', 3))
    # beach: boatwright's half-built hull on trestles, fish racks, stall
    bx, bg = 262, land(262)
    for tx in (266, 300):
        sc.rect(tx, bg - 12, tx + 1, bg - 1, R('wood', 2))
        sc.rect(tx - 3, bg - 13, tx + 4, bg - 12, R('wood', 3))
    hull = clinker_boat(sail=False, mast=False)
    for x in range(34, 62):                                   # unfinished: strakes stop, ribs show
        for y in range(40, 53):
            hull.px(x, y, 'wood', 1) if x % 5 == 0 else hull.px(x, y, None)
    sc.put(hull, bx - 10, bg - 13 - 56)
    cottage(sc, 318, 352, land(335), 52, door_x=326, window=False)   # smokehouse

    # jetty on piles driven into the seabed, cross-braced
    DECK = SEA - 14
    for px_ in range(360, 600, 24):
        bottom = land(px_) + 4
        post(sc, px_, DECK + 3, bottom)
        if px_ + 24 < 600:
            sc.line(px_ + 3, DECK + 5, px_ + 24, DECK + 26, R('wood', 1))
            sc.line(px_ + 24, DECK + 5, px_ + 3, DECK + 26, R('wood', 1))
    planks(sc, 348, 604, DECK)
    for mx in (380, 596):
        post(sc, mx, DECK - 8, DECK - 1, w=3)
    # stall at the jetty head
    post(sc, 402, DECK - 12, DECK - 1, w=2)
    post(sc, 436, DECK - 12, DECK - 1, w=2)
    sc.put(S.barrel(w=10, h=12), 444, DECK - 13)
    fish_rack(sc, 470, 506, DECK)
    boat = clinker_boat()
    sc.put(boat, 566, SEA - 52)
    sc.line(598, DECK - 6, 572, SEA - 8, R('ochre', 1))       # mooring line

    # villagers
    S.stand(sc, sp_aldous, 74, land(88))
    S.stand(sc, sp_ottie, 150, land(160), flip=True)
    S.stand(sc, sp_jory, 222, land(234))
    S.stand(sc, sp_nell, 412, DECK)
    sc.rect(400, DECK - 16, 440, DECK - 13, R('wood', 3))     # counter in front of her
    for fx in (404, 414, 424):
        sc.put(S.fish_small(), fx, DECK - 21)
    S.stand(sc, sp_wick, 530, DECK)
    sc.line(551, DECK - 26, 566, DECK - 60, R('wood', 3))     # rod
    sc.line(566, DECK - 60, 562, SEA, R('sail', 2))

    for (x, y, r, i) in ((64, 36, 150, 1.4), (70, 88, 40, 0.5), (116, land(128) - 12, 40, 0.6),
                         (335, land(335) - 14, 60, 0.9), (72, 70, 30, 0.6)):
        w.light(x, y, r, i)
    w.light(496, SEA - 4, 260, 0.35, (1.2, 0.85, 0.7))         # low sun
    L = w.lightmap(0.62, (0.85, 0.82, 1.0), solid_k=0.8)
    unlit = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    U = S.Scene(W, H)
    U.img, U.P = unlit, unlit.load()
    for i in range(5):                                        # smokehouse smoke
        U.disc(338 + i * 3, land(335) - 70 - i * 8, 3 + i // 2, mix(hx('8a8088'), skyc[3], 0.2 + i * 0.15))
    for (gx, gy) in ((300, 80), (316, 70), (440, 120)):      # gulls
        for dx, dy in ((-2, -1), (-1, 0), (0, 1), (1, 0), (2, -1)):
            U.px(gx + dx, gy + dy, hx('2a2630'))
    return compose(w, base, L, (SOLID, WATER, SKY), unlit)


def main():
    os.makedirs(OUT, exist_ok=True)
    shots = [('01_underground_village.png', 'Hearthfolk burrow', underground()),
             ('02_seaside_village.png', 'Saltfolk fishing village', seaside())]
    figs = []
    for name, title, img in shots:
        big = img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)
        path = os.path.join(OUT, name)
        big.save(path)
        b64 = base64.b64encode(open(path, 'rb').read()).decode()
        figs.append(f'<figure><figcaption>{title}</figcaption>'
                    f'<img src="data:image/png;base64,{b64}" alt="{title}"></figure>')
        print('wrote', name)
    html = ('<!doctype html><html><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Village Mockups</title><style>'
            'body{margin:0;padding:16px;background:#141013;color:#c1b59a;font:14px monospace}'
            'figure{margin:0 0 24px}figcaption{margin:0 0 8px;letter-spacing:.1em;text-transform:uppercase}'
            'img{width:100%;max-width:1280px;image-rendering:pixelated;display:block}'
            '</style></head><body>' + ''.join(figs) + '</body></html>')
    with open(os.path.join(OUT, 'index.html'), 'w') as f:
        f.write(html)
    print('wrote index.html')


if __name__ == '__main__':
    main()
