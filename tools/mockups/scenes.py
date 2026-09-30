#!/usr/bin/env python3
"""Village scene mockups: the underground Hearthfolk burrow and a seaside village.

    python3 tools/mockups/scenes.py   ->  mockups/villages/*.png + index.html
"""
import base64
import os
import random

from PIL import Image, ImageOps

import villagers as V
from build import glow
from pixel import RAMPS, Canvas, hx, mix, ramp

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'mockups', 'villages')
SCALE = 3

RAMPS.update({
    'sea': ramp('1e3440', '2c4c5a', '3f6a78', '5b8a94', '7eaab0'),
    'sail': ramp('6b6758', '9a9580', 'c2bca3', 'dcd6be', 'ece7d2'),
    'oilskin': ramp('4a3a14', '7a6224', 'a88a3a', 'c6a852', 'dcc27a'),
    'navy': ramp('141a24', '1f2836', '2d3a4c', '415064', '56667a'),
    'tar': ramp('101010', '1c1b1a', '2a2826', '3a3733', '4a4640'),
    'brass': ramp('4a3410', '7a5a1c', 'a8842e', 'c8a64a', 'e0c670'),
    'shell': ramp('6a5550', '9a807a', 'c2a8a0', 'dcc6be', 'ece0da'),
    'coral': ramp('3e1a18', '64302a', '8a4a3c', 'a86450', 'c07e66'),
    'stone': ramp('2a2a2e', '444548', '5e5f60', '7a7a78', '959590'),
    'sand': ramp('6a5a3c', '8e7a52', 'b09a6a', 'c8b482', 'dccb9c'),
    'grass': ramp('1f2e18', '2e4222', '42592e', '58733c', '72904e'),
    'pine': ramp('0f1a14', '16261c', '213526', '2e4632', '3e5a3e'),
    'fish': ramp('3a4448', '5e6a6c', '8a9694', 'aab4b0', 'cfd6d0'),
})


def R(m, t):
    return RAMPS[m][t]


class Scene:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new('RGBA', (w, h), (0, 0, 0, 255))
        self.P = self.img.load()

    def px(self, x, y, col):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.P[x, y] = tuple(col[:3]) + (255,)

    def get(self, x, y):
        return self.P[x, y][:3]

    def rect(self, x0, y0, x1, y1, col):
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            for x in range(max(0, x0), min(self.w, x1 + 1)):
                self.P[x, y] = tuple(col) + (255,)

    def put(self, c, x, y, flip=False):
        im = c.render() if isinstance(c, Canvas) else c
        if flip:
            im = ImageOps.mirror(im)
        self.img.alpha_composite(im, (x, y))

    def line(self, x0, y0, x1, y1, col):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            self.px(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), col)

    def disc(self, cx, cy, r, col):
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r:
                    self.px(x, y, col)


def person(fn, flip=False):
    im = fn().render()
    return ImageOps.mirror(im) if flip else im


def stand(sc, fn, x, floor_top, flip=False):
    """Place a 28x56 villager sprite so its feet rest on floor_top."""
    sc.put(person(fn, flip), x, floor_top - 53)


# ---------------------------------------------------------------------------
# Props (small Canvases so they get the same shading + outline as villagers)
# ---------------------------------------------------------------------------

ICONS = {
    'forge': ["#####", "#####", "..#..", "..#..", "..#.."],
    'hall': [".#.#.", "#####", "#####", ".###.", "..#.."],
    'dye': ["#####", ".###.", ".#.#.", ".###.", "#####"],
    'bunk': ["#....", "##...", "#####", "#...#", "#...#"],
    'store': [".###.", "#####", ".###.", "#####", ".###."],
    'guard': ["#####", "#.#.#", "#####", ".###.", "..#.."],
    'mine': [".###.", "#.#.#", "..#..", "..#..", "..#.."],
    'fish': ["..#..", ".###.", "#####", ".###.", "#.#.#"],
}


def sign(icon):
    c = Canvas(11, 11)
    c.pts([(3, 0), (7, 0), (2, 1), (8, 1)], 'iron', 2)
    c.rect(1, 2, 9, 9, 'wood', 2)
    c.rect(1, 2, 9, 2, 'wood', 3)
    for j, row in enumerate(ICONS[icon]):
        for i, ch in enumerate(row):
            if ch == '#':
                c.px(3 + i, 4 + j, 'wax', 4)
    return c


def lantern():
    c = Canvas(7, 9)
    c.rect(2, 0, 4, 1, 'iron', 1)
    c.rect(1, 2, 5, 7, 'iron', 1)
    c.rect(2, 3, 4, 6, 'flame', 3)
    c.px(3, 4, 'flame', 4)
    return c


def anvil():
    c = Canvas(18, 15)
    c.rect(1, 2, 3, 2, 'iron')
    c.rect(3, 1, 15, 3, 'iron')
    c.rect(3, 1, 15, 1, 'iron', 4)
    c.rect(6, 4, 11, 6, 'iron', 1)
    c.rect(4, 7, 13, 8, 'iron')
    c.rect(5, 9, 12, 13, 'wood')
    return c


def furnace():
    c = Canvas(32, 44)
    c.rect(1, 6, 30, 43, 'stone')
    for y in range(8, 43, 4):
        c.rect(1, y, 30, y, 'stone', 1)
        for x in range(2 + (y // 4 % 2) * 3, 30, 6):
            c.rect(x, y - 3, x, y - 1, 'stone', 1)
    c.rect(9, 20, 22, 36, 'tar', 0)
    c.rect(10, 20, 21, 20, 'stone', 3)
    for y in range(28, 37):
        for x in range(10, 22):
            c.px(x, y, 'flame', min(4, 1 + (y - 26) // 3 + (1 if (x * 3 + y) % 5 == 0 else 0)))
    c.rect(8, 37, 23, 39, 'stone', 3)
    c.rect(4, 0, 27, 5, 'stone', 2)
    return c


def tool_rack():
    c = Canvas(22, 14)
    c.rect(0, 0, 21, 1, 'wood', 3)
    c.rect(3, 2, 3, 11, 'iron', 2)
    c.rect(5, 2, 5, 11, 'iron', 1)
    c.pts([(4, 11), (4, 12)], 'iron', 1)
    c.rect(10, 2, 10, 10, 'wood')
    c.rect(8, 2, 12, 4, 'iron', 3)
    c.rect(16, 2, 18, 9, 'iron', 3)
    c.rect(16, 2, 16, 9, 'iron', 1)
    return c


def barrel(liquid=None, w=10, h=13):
    c = Canvas(w, h)
    c.rect(1, 1, w - 2, h - 1, 'wood')
    for y in (3, h - 3):
        c.rect(1, y, w - 2, y, 'iron', 1)
    if liquid:
        c.rect(2, 1, w - 3, 2, liquid, 3)
    return c


def hearth():
    c = Canvas(36, 46)
    c.rect(9, 0, 26, 9, 'stone', 2)
    c.rect(0, 10, 35, 45, 'stone')
    for y in range(13, 45, 4):
        c.rect(0, y, 35, y, 'stone', 1)
    c.rect(0, 10, 35, 12, 'wood', 3)           # mantel
    c.rect(4, 7, 6, 9, 'copper', 3)            # jug on mantel
    c.rect(28, 8, 31, 9, 'wax', 3)
    c.rect(6, 18, 29, 45, 'tar', 0)
    c.rect(6, 18, 29, 18, 'stone', 3)
    c.rect(17, 19, 17, 25, 'iron', 1)          # pot chain
    c.rect(12, 26, 23, 33, 'iron')
    c.rect(11, 26, 24, 26, 'iron', 3)
    for y in range(36, 43):
        for x in range(9, 27):
            c.px(x, y, 'flame', min(4, (y - 34) // 2 + (1 if (x + y * 2) % 5 == 0 else 0)))
    c.rect(9, 43, 26, 44, 'wood', 1)
    c.pts([(15, 20), (19, 21), (16, 22)], 'sail', 3)   # steam
    return c


def table():
    c = Canvas(48, 15)
    c.rect(0, 5, 47, 7, 'wood')
    c.rect(0, 5, 47, 5, 'wood', 3)
    c.rect(3, 8, 4, 14, 'wood', 1)
    c.rect(43, 8, 44, 14, 'wood', 1)
    c.rect(6, 3, 10, 4, 'wood', 3)
    c.rect(7, 4, 9, 4, 'ochre', 2)
    c.rect(18, 2, 25, 4, 'ochre')              # bread
    c.rect(19, 2, 24, 2, 'ochre', 4)
    c.rect(32, 0, 35, 4, 'copper')             # jug
    c.px(36, 1, 'copper', 1)
    c.rect(39, 3, 43, 4, 'wood', 3)
    return c


def bench(w=18):
    c = Canvas(w, 7)
    c.rect(0, 0, w - 1, 1, 'wood', 3)
    c.rect(1, 2, 2, 6, 'wood', 1)
    c.rect(w - 3, 2, w - 2, 6, 'wood', 1)
    return c


def herbs():
    c = Canvas(5, 9)
    c.rect(2, 0, 2, 2, 'wood', 1)
    c.rect(1, 3, 3, 7, 'moss')
    c.pts([(1, 4), (3, 6), (2, 8)], 'grass', 4)
    return c


def loom():
    c = Canvas(28, 44)
    for x in (1, 25):
        c.rect(x, 2, x + 1, 43, 'wood')
    c.rect(0, 1, 27, 3, 'wood', 3)
    c.rect(1, 22, 26, 23, 'wood', 2)
    c.rect(1, 37, 26, 38, 'wood', 2)
    for x in range(4, 24):
        c.rect(x, 4, x, 21, 'madder' if x % 2 else 'wool_oat', 2 if x % 2 else 3)
    for y in range(24, 37):
        for x in range(3, 25):
            if 28 <= y <= 30:
                on = (x % 4 == 2) if y != 29 else (x % 4 in (1, 3))
                c.px(x, y, 'wool_oat' if on else 'madder', 3 if on else 2)
            else:
                c.px(x, y, 'madder', 2 if (x + y) % 2 else 3)
    return c


def vat(liquid):
    c = Canvas(18, 15)
    c.rect(1, 3, 16, 14, 'wood')
    for y in (6, 12):
        c.rect(1, y, 16, y, 'iron', 1)
    c.rect(2, 3, 15, 4, liquid, 3)
    c.px(6, 3, liquid, 4)
    for i in range(6):
        c.px(11 + i // 2, 5 - i, 'wood', 3)
    return c


def bunk():
    c = Canvas(34, 40)
    for x in (1, 31):
        c.rect(x, 0, x + 1, 39, 'wood')
    for (y, quilt) in ((12, 'indigo'), (34, 'madder')):
        c.rect(1, y, 32, y + 2, 'wood', 1)
        c.rect(3, y - 3, 30, y - 1, 'wool_oat', 3)
        c.rect(3, y - 4, 8, y - 2, 'sail', 4)
        c.rect(10, y - 4, 30, y - 1, quilt)
        for x in range(10, 31):
            if x % 4 == 2:
                c.px(x, y - 3, 'wool_oat', 3)
    return c


def chest():
    c = Canvas(16, 11)
    c.rect(1, 1, 14, 10, 'wood')
    c.rect(1, 1, 14, 3, 'wood', 3)
    c.rect(1, 4, 14, 4, 'iron', 1)
    c.pts([(1, 1), (14, 1), (1, 10), (14, 10)], 'copper', 3)
    c.px(7, 5, 'copper', 4)
    return c


def crate(s=14):
    c = Canvas(s, s)
    c.rect(1, 1, s - 2, s - 2, 'wood')
    for i in range(1, s - 1):
        c.px(i, i, 'wood', 1)
    c.rect(1, 1, s - 2, 1, 'wood', 3)
    return c


def sack():
    c = Canvas(11, 13)
    c.rect(2, 4, 8, 12, 'wool_oat')
    c.rect(1, 6, 9, 11, 'wool_oat')
    c.rect(4, 1, 6, 3, 'wool_oat', 1)
    c.rect(3, 3, 7, 3, 'leather', 2)
    return c


def shelf_jars():
    c = Canvas(26, 11)
    c.rect(0, 8, 25, 9, 'wood', 3)
    for i, (m, h) in enumerate([('amber', 5), ('copper', 4), ('moss', 6), ('amber', 4), ('wax', 5)]):
        x = 1 + i * 5
        c.rect(x, 8 - h, x + 3, 7, m)
        c.rect(x + 1, 7 - h, x + 2, 7 - h, 'wood', 1)
    return c


def ham():
    c = Canvas(7, 13)
    c.rect(3, 0, 3, 3, 'wood', 1)
    c.rect(2, 4, 4, 5, 'madder', 3)
    c.rect(1, 6, 5, 11, 'madder')
    c.pts([(2, 7), (2, 8)], 'madder', 4)
    return c


def spear_rack():
    c = Canvas(22, 44)
    c.rect(0, 40, 21, 42, 'wood', 1)
    c.rect(1, 14, 20, 15, 'wood', 3)
    for x in (4, 10, 16):
        c.rect(x, 5, x, 41, 'wood')
        c.pts([(x, 1), (x - 1, 2), (x, 2), (x + 1, 2), (x, 3), (x, 4)], 'iron', 3)
    return c


def shield():
    c = Canvas(15, 15)
    c.fill(c.ell((1, 1, 13, 13)), 'wood', sh=(6, 6, 7, 7))
    c.band(6, 2, 12, rows=2)
    c.rect(6, 1, 7, 13, 'madder', 2)
    c.fill(c.ell((5, 5, 8, 8)), 'iron', tone=3)
    return c


def mine_cart():
    c = Canvas(26, 20)
    c.rect(2, 5, 23, 14, 'iron')
    c.rect(2, 5, 23, 6, 'iron', 3)
    c.rect(2, 9, 23, 9, 'iron', 1)
    rnd = random.Random(4)
    for x in range(4, 22):
        h = 2 + (3 - abs(x - 13) // 3)
        for y in range(5 - h, 5):
            c.px(x, y, rnd.choice(['stone', 'stone', 'copper', 'amber']), rnd.choice([2, 3]))
    for x in (6, 19):
        c.fill(c.ell((x - 3, 13, x + 3, 19)), 'tar', tone=2)
        c.px(x, 16, 'iron', 3)
    return c


def pine(h):
    c = Canvas(2 * (h // 3) + 5, h + 2)
    cx = c.w // 2
    for y in range(h - 4):
        tier = y % (h // 4)
        half = 1 + tier // 2 + y // 5
        c.rect(cx - half, y + 1, cx + half, y + 1, 'pine', 1 if tier > h // 8 else 2)
        c.px(cx - half, y + 1, 'pine', 3)
    c.rect(cx - 1, h - 4, cx + 1, h + 1, 'wood', 1)
    return c


def fish_small():
    c = Canvas(8, 5)
    c.rect(2, 1, 5, 3, 'fish')
    c.px(1, 2, 'fish', 1)
    c.pts([(6, 1), (6, 3), (7, 0), (7, 4)], 'fish', 1)
    c.px(2, 2, 'eye')
    return c


# ---------------------------------------------------------------------------
# Scene 1: the Hearthfolk burrow
# ---------------------------------------------------------------------------

WALL_HI, WALL_MID, WALL_LO = hx('6a4731'), hx('5b3c29'), hx('4a3122')
SHAFT = hx('352419')


def earth(sc, top):
    rnd = random.Random(11)
    dirt = [hx('3a2a20'), hx('36271d'), hx('3e2d22')]
    rock = [hx('2d2a2b'), hx('2a2728'), hx('312d2d')]
    for y in range(top, sc.h):
        deep = y > 250 + rnd.randint(-4, 4)
        pal = rock if deep else dirt
        for x in range(sc.w):
            sc.P[x, y] = pal[(x * 7 + y * 3 + (rnd.random() < 0.2)) % 3] + (255,)
    for _ in range(sc.w * (sc.h - top) // 260):
        x, y = rnd.randint(0, sc.w - 5), rnd.randint(top + 6, sc.h - 3)
        base = hx('4a4146') if y > 250 else hx('4c3a2e')
        sc.rect(x, y, x + 3, y + 1, base)
        sc.rect(x + 1, y - 1, x + 2, y - 1, mix(base, (255, 255, 255), 0.12))
    # a few copper/amber ore flecks deep down
    for _ in range(28):
        x, y = rnd.randint(180, sc.w - 4), rnd.randint(255, sc.h - 4)
        sc.rect(x, y, x + 1, y, R('copper', 3))
        sc.px(x, y + 1, R('amber', 3))


def carve(sc, x0, y0, x1, y1, r=4, rim=True, stone=False):
    """Clean rounded-top room/tunnel cut into the earth."""
    def inside(x, y, a0, b0, a1, b1, rr):
        if not (a0 <= x <= a1 and b0 <= y <= b1):
            return False
        for cx in (a0 + rr, a1 - rr):
            if y < b0 + rr and ((x < a0 + rr and cx == a0 + rr) or (x > a1 - rr and cx == a1 - rr)):
                return (x - cx) ** 2 + (y - (b0 + rr)) ** 2 <= rr * rr
        return True
    if rim:
        for y in range(y0 - 2, y1 + 3):
            for x in range(x0 - 2, x1 + 3):
                if inside(x, y, x0 - 2, y0 - 2, x1 + 2, y1 + 2, r + 2):
                    sc.px(x, y, hx('24180f'))
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if inside(x, y, x0, y0, x1, y1, r):
                if stone:
                    k = (x * 7 + y * 13) % 11
                    col = R('stone', 1) if k == 0 or (y + x // 9) % 8 == 0 else mix(R('stone', 2), WALL_LO, 0.35)
                elif y > y1 - 18:
                    col = WALL_LO if x % 6 else mix(WALL_LO, (0, 0, 0), 0.2)
                elif y == y1 - 18:
                    col = R('wood', 2)
                else:
                    col = WALL_MID if (y - y0) > 3 else WALL_HI
                sc.px(x, y, col)


def floor(sc, x0, x1, y1):
    for y in range(y1 - 3, y1 + 1):
        t = 3 if y == y1 - 3 else (2 if y < y1 else 1)
        for x in range(x0, x1 + 1):
            sc.px(x, y, R('wood', 1 if (x + (y - y1) * 9) % 16 == 0 else t))


def frame(sc, x0, y0, x1, y1):
    """Ceiling beam resting on two posts: every room is visibly held up."""
    for x in range(x0, x1 + 1):
        sc.px(x, y0, R('wood', 3))
        sc.px(x, y0 + 1, R('wood', 2))
        sc.px(x, y0 + 2, R('wood', 1))
    for px_ in (x0 + 1, x1 - 3):
        for y in range(y0 + 3, y1 - 3):
            sc.px(px_, y, R('wood', 2))
            sc.px(px_ + 1, y, R('wood', 2))
            sc.px(px_ + 2, y, R('wood', 1))
    for px_ in (x0 + 4, x1 - 6):     # corner braces
        for i in range(4):
            sc.px(px_ + (i if px_ == x0 + 4 else 2 - i), y0 + 3 + i, R('wood', 1))


def room(sc, x0, y0, x1, y1, icon, lamp_x=None, stone=False):
    carve(sc, x0, y0, x1, y1, stone=stone)
    frame(sc, x0, y0 + 2, x1, y1)
    floor(sc, x0, x1, y1)
    lx = lamp_x if lamp_x is not None else (x0 + x1) // 2
    before = sc.img.copy()
    glow(sc.img, lx, y0 + 14, min(60, (x1 - x0) // 2 + 10), hx('e08a2a'), 0.45)
    keep = sc.img.crop((x0, y0, x1 + 1, y1 + 1))
    sc.img.paste(before)          # light stays inside the room
    sc.img.paste(keep, (x0, y0))
    sc.P = sc.img.load()
    for y in range(y0 + 5, y0 + 9):
        sc.px(lx, y, R('iron', 1))
    sc.put(lantern(), lx - 3, y0 + 9)
    sc.put(sign(icon), x0 + 6, y0 + 5)


def tunnel(sc, x0, x1, y1, h=24):
    carve(sc, x0 - 3, y1 - h, x1 + 3, y1, r=3, rim=True)
    floor(sc, x0 - 3, x1 + 3, y1)
    for x in range(x0 - 3, x1 + 4):
        sc.px(x, y1 - h, R('wood', 2))
        sc.px(x, y1 - h + 1, R('wood', 1))


def shaft(sc, x0, y_top, y_bot, ladder_top=None, ladder_bot=None):
    """Timber-lined ladder shaft (x0..x0+11)."""
    for y in range(y_top, y_bot + 1):
        sc.px(x0, y, R('wood', 1))
        sc.px(x0 + 11, y, R('wood', 1))
        for x in range(x0 + 1, x0 + 11):
            sc.px(x, y, SHAFT)
    ladder(sc, x0 + 2, ladder_top if ladder_top is not None else y_top - 6, ladder_bot or y_bot)


def ladder(sc, x0, y0, y1):
    for y in range(y0, y1 + 1):
        sc.px(x0, y, R('wood', 3))
        sc.px(x0 + 7, y, R('wood', 1))
        if (y - y0) % 4 == 1:
            for x in range(x0 + 1, x0 + 7):
                sc.px(x, y, R('wood', 2))


def hut(sc, x0, ground):
    """Entrance hut: stone footing on the ground, log walls, shingled roof."""
    w = 50
    for y in range(ground - 6, ground):          # stone footing
        for x in range(x0 - 2, x0 + w + 2):
            joint = (y - ground) % 3 == 0 or (x + (y // 3) * 4) % 8 == 0
            sc.px(x, y, R('stone', 1 if joint else 2))
    for y in range(ground - 30, ground - 6):     # log walls
        t = 3 if (y % 4) == 0 else (2 if y % 4 < 3 else 1)
        for x in range(x0, x0 + w):
            sc.px(x, y, R('wood', t))
    for y in range(ground - 32, ground - 6):     # corner posts
        for x in (x0, x0 + 1, x0 + w - 2, x0 + w - 1):
            sc.px(x, y, R('wood', 1))
    for y in range(ground - 24, ground - 6):     # door (open onto the ladder hatch)
        for x in range(x0 + 20, x0 + 31):
            sc.px(x, y, R('tar', 1) if x not in (x0 + 20, x0 + 30) else R('wood', 3))
    for x in range(x0 + 20, x0 + 31):
        sc.px(x, ground - 25, R('wood', 3))
    for (wx) in (x0 + 7, x0 + 37):               # windows, warm
        sc.rect(wx, ground - 22, wx + 6, ground - 16, R('wood', 3))
        sc.rect(wx + 1, ground - 21, wx + 5, ground - 17, R('flame', 3))
        sc.rect(wx + 3, ground - 21, wx + 3, ground - 17, R('wood', 3))
    apex = ground - 52
    for y in range(apex, ground - 29):           # roof
        half = (y - apex) * 1.3 + 2
        cx = x0 + w / 2
        for x in range(int(cx - half), int(cx + half) + 1):
            t = 1 if (y - apex) % 4 == 3 else 2
            if (x + (y // 4) * 3) % 7 == 0:
                t = 1
            sc.px(x, y, R('coral', t) if y > apex + 1 else R('coral', 3))
    for x in range(x0 - 7, x0 + w + 7):          # eave board
        sc.px(x, ground - 29, R('wood', 1))


def smoke(sc, x, y, n=5, col=hx('8a8a8a')):
    for i in range(n):
        r = 2 + i // 2
        c = mix(col, sc.get(min(sc.w - 1, x + i * 3), max(0, y - i * 7)), 0.25 + i * 0.12)
        sc.disc(x + i * 3 - (i % 2) * 2, y - i * 7, r, c)


def underground():
    W, H = 480, 344
    sc = Scene(W, H)
    G = 64
    # night sky
    for y in range(G):
        col = [hx('121829'), hx('161d31'), hx('1b2338'), hx('212a40')][min(3, y // 16)]
        for x in range(W):
            sc.P[x, y] = col + (255,)
    rnd = random.Random(2)
    for _ in range(70):
        sc.px(rnd.randint(0, W - 1), rnd.randint(0, G - 20), hx('c8c4b0') if rnd.random() < 0.3 else hx('6a6e80'))
    sc.disc(430, 16, 7, hx('d8d2b8'))
    sc.disc(433, 14, 6, hx('1b2338'))
    earth(sc, G)
    for x in range(W):                           # grass cap
        sc.px(x, G, R('grass', 3))
        sc.px(x, G + 1, R('grass', 2))
        sc.px(x, G + 2, R('grass', 1) if x % 3 else R('grass', 2))
        if x % 7 == 0:
            sc.px(x, G - 1, R('grass', 3))
    for (px_, h) in [(6, 34), (150, 40), (178, 30), (238, 44), (400, 36), (456, 42)]:
        sc.put(pine(h), px_, G - h - 1)

    # --- layer 1: guard post, hearth hall, forge, pantry ---
    L1, L1b = 86, 150
    tunnel(sc, 112, 130, L1b)
    tunnel(sc, 284, 302, L1b)
    tunnel(sc, 394, 410, L1b)
    room(sc, 26, L1, 112, L1b, 'guard')
    room(sc, 130, L1, 284, L1b, 'hall', lamp_x=232)
    room(sc, 302, L1, 394, L1b, 'forge', lamp_x=330)
    room(sc, 410, L1, 468, L1b, 'store', lamp_x=440)
    # --- layer 2: bunk room, dye & weave room ---
    L2, L2b = 178, 242
    tunnel(sc, 150, 196, L2b)
    room(sc, 40, L2, 150, L2b, 'bunk', lamp_x=110)
    room(sc, 196, L2, 352, L2b, 'dye', lamp_x=270)
    # --- layer 3: the mine ---
    L3, L3b = 272, 334
    room(sc, 200, L3, 470, L3b, 'mine', lamp_x=300, stone=True)

    # shafts + ladders (drawn after rooms so they cut cleanly through floors)
    shaft(sc, 60, G - 10, L1 + 3, ladder_top=G - 8, ladder_bot=L1b - 4)
    shaft(sc, 84, L1b - 3, L2 + 3, ladder_bot=L2b - 4)
    shaft(sc, 206, L1b - 3, L2 + 3, ladder_bot=L2b - 4)
    shaft(sc, 332, L2b - 3, L3 + 3, ladder_bot=L3b - 4)

    # forge chimney: stone flue from the forge ceiling up through the ground
    for y in range(G - 16, L1 + 3):
        for x in range(368, 376):
            sc.px(x, y, R('stone', 1 if (y % 4 == 0 or x in (368, 375)) else 2))
    sc.rect(366, G - 18, 377, G - 16, R('stone', 3))
    smoke(sc, 372, G - 24)
    hut(sc, 42, G)
    ladder(sc, 62, G - 8, G + 2)                 # ladder rising through the hut door

    # --- props ---
    # guard post
    sc.put(spear_rack(), 30, L1b - 3 - 42)
    sc.put(shield(), 62, L1 + 20)
    sc.put(bench(14), 94, L1b - 10)
    # hearth hall
    sc.put(hearth(), 136, L1b - 3 - 45)
    sc.put(table(), 210, L1b - 3 - 14)
    sc.put(bench(), 200, L1b - 9)
    sc.put(bench(), 240, L1b - 9)
    for hx_ in (180, 190, 256, 266):
        sc.put(herbs(), hx_, L1 + 5)
    # forge
    sc.put(furnace(), 358, L1b - 3 - 43)
    sc.put(anvil(), 334, L1b - 3 - 14)
    sc.put(tool_rack(), 316, L1 + 16)
    sc.put(barrel('sea'), 305, L1b - 3 - 12)
    # pantry
    sc.put(barrel(w=12, h=16), 414, L1b - 3 - 15)
    sc.put(crate(), 428, L1b - 3 - 13)
    sc.put(sack(), 446, L1b - 3 - 12)
    sc.put(crate(10), 430, L1b - 3 - 22)
    sc.put(shelf_jars(), 436, L1 + 18)
    for hx_ in (420, 428):
        sc.put(ham(), hx_, L1 + 4)
    # bunk room
    sc.put(bunk(), 52, L2b - 3 - 39)
    sc.put(bunk(), 100, L2b - 3 - 39)
    sc.put(chest(), 136, L2b - 3 - 10)
    # dye & weave room
    sc.put(vat('madder'), 222, L2b - 3 - 14)
    sc.put(vat('indigo'), 242, L2b - 3 - 14)
    sc.put(loom(), 300, L2b - 3 - 43)
    for i, x in enumerate(range(226, 296, 6)):   # drying skeins on a line
        sc.px(x, L2 + 14, R('wood', 2))
        m = ['madder', 'indigo', 'ochre', 'moss', 'wool_oat'][i % 5]
        sc.rect(x - 1, L2 + 15, x + 1, L2 + 21, R(m, 3))
        sc.rect(x + 1, L2 + 15, x + 1, L2 + 21, R(m, 1))
    for x in range(222, 300):
        if x % 6:
            sc.px(x, L2 + 14, R('wood', 1))
    # mine: timber sets, rails, cart, ore
    for tx in (240, 300, 380, 440):
        for y in range(L3 + 4, L3b - 3):
            sc.px(tx, y, R('wood', 2))
            sc.px(tx + 1, y, R('wood', 1))
    for x in range(204, 468):
        sc.px(x, L3b - 5, R('iron', 3))
        if x % 5 == 0:
            sc.px(x, L3b - 4, R('wood', 1))
    sc.put(mine_cart(), 392, L3b - 5 - 19)
    rnd = random.Random(9)
    for _ in range(18):
        x, y = rnd.randint(410, 466), rnd.randint(L3 + 8, L3b - 12)
        sc.rect(x, y, x + 1, y, R('copper', 3))
        sc.px(x, y + 1, R('amber', 4))

    # --- villagers, each at their job ---
    stand(sc, V.sp_holt, 42, L1b - 3)
    stand(sc, V.sp_edda, 170, L1b - 3, flip=True)
    stand(sc, V.sp_brannock, 310, L1b - 3)
    stand(sc, V.sp_maren, 268, L2b - 3)
    stand(sc, V.sp_orsk, 356, L3b - 3)
    stand(sc, V.sp_tavi, 110, G, flip=True)
    return sc


# ---------------------------------------------------------------------------
# Seaside villagers: the Saltfolk (sea-blue/sail stripe + shell token)
# ---------------------------------------------------------------------------

def stripe(c, y, x0, x1):
    c.band(y, x0, x1, base='sea', thread='sail', rows=1)
    for x in range(x0, x1 + 1):
        c.px(x, y, 'sail' if x % 2 else 'sea', 3 if x % 2 else 2)


def sp_wick():
    """Fisher: oilskin coat and sou'wester."""
    c = V.sprite()
    S = 'skin_e'
    for x0 in (5, 20):
        c.rect(x0, 14, x0 + 1, 25, 'oilskin')
        c.rect(x0, 26, x0 + 1, 27, S, 2)
    c.rect(8, 13, 18, 13, 'oilskin')
    c.rect(7, 14, 19, 22, 'oilskin')
    V.skirt(c, 'oilskin', 23, 36, 8, 18, step=7)
    c.pts([(13, 16), (13, 19), (13, 22), (13, 25)], 'tar', 2)
    stripe(c, 24, 8, 18)
    c.rect(10, 37, 12, 46, 'tar')
    c.rect(14, 37, 16, 46, 'tar')
    c.rect(10, 41, 12, 41, 'tar', 3)
    c.rect(14, 41, 16, 41, 'tar', 3)
    V.sp_boots(c, 'tar')
    c.px(13, 14, 'shell', 4)
    V.sp_face(c, S, 'hair_brown')
    c.pts([(12, 11), (14, 11), (16, 10), (11, 10)], 'hair_brown', 1)
    c.rect(11, 1, 15, 3, 'oilskin')
    c.rect(8, 4, 18, 5, 'oilskin', 3)
    c.rect(8, 6, 10, 10, 'oilskin', 1)
    return c


def sp_nell():
    """Fishmonger: striped apron, coral headscarf, a fish in hand."""
    c = V.sprite()
    S = 'skin_b'
    c.rect(9, 13, 17, 22, 'sea')
    V.skirt(c, 'navy', 23, 46)
    for x0 in (6, 19):
        c.rect(x0, 14, x0 + 1, 18, 'sail')
        c.rect(x0, 19, x0 + 1, 25, S)
        c.rect(x0, 26, x0 + 1, 27, S, 1)
    c.rect(8, 13, 18, 14, 'sail')
    for x in range(10, 17):
        c.rect(x, 17, x, 40, 'sail' if x % 2 else 'sea', 3 if x % 2 else 2)
    stripe(c, 22, 9, 17)
    c.rect(10, 47, 12, 48, 'tar')
    c.rect(14, 47, 17, 48, 'tar')
    c.px(13, 15, 'shell', 4)
    c.rect(20, 28, 20, 35, 'fish', 3)          # fish held by the tail
    c.rect(21, 29, 21, 34, 'fish', 1)
    c.px(20, 34, 'eye')
    V.sp_face(c, S, 'hair_brown')
    c.rect(8, 5, 10, 8, 'hair_brown')
    c.rect(11, 2, 15, 2, 'coral', 3)
    c.rect(10, 3, 16, 5, 'coral')
    c.pts([(9, 5), (9, 6), (8, 7)], 'coral', 1)
    return c


def sp_ottie():
    """Net-mender: old woman in a cabled sea-blue jumper with a net bundle."""
    c = V.sprite()
    S = 'skin_d'
    for x0 in (6, 19):
        c.rect(x0, 14, x0 + 1, 26, 'sea')
        c.rect(x0, 27, x0 + 1, 28, S, 2)
    c.rect(8, 13, 18, 28, 'sea')
    for y in range(15, 28):
        c.px(11 + (y % 2), y, 'sea', 3)
        c.px(15 + (y % 2), y, 'sea', 3)
    stripe(c, 20, 8, 18)
    V.skirt(c, 'navy', 29, 46, 9, 17, step=8)
    c.rect(8, 13, 18, 16, 'coral')
    c.pts([(9, 17), (11, 17), (15, 17), (17, 17)], 'coral', 1)
    for y in range(22, 34):                    # net bundle
        for x in range(16, 25):
            if (x + y) % 3 == 0 or (x - y) % 3 == 0:
                c.px(x, y, 'sail', 3 if (x + y) % 2 else 2)
    c.rect(10, 47, 12, 48, 'tar')
    c.rect(14, 47, 16, 48, 'tar')
    c.px(13, 18, 'shell', 4)
    V.sp_face(c, S, 'hair_grey')
    c.rect(11, 2, 15, 2, 'sail', 4)
    c.rect(10, 3, 16, 5, 'sail', 3)
    c.rect(9, 5, 10, 11, 'sail', 2)
    c.pts([(12, 12), (13, 12)], 'sail', 2)
    c.px(12, 10, S, 1)
    c.px(11, 6, 'hair_grey', 3)
    return c


def sp_aldous():
    """Lighthouse keeper: navy peacoat, brass buttons, lantern."""
    c = V.sprite()
    S = 'skin_a'
    for x0 in (5, 20):
        c.rect(x0, 14, x0 + 1, 25, 'navy')
        c.rect(x0, 26, x0 + 1, 27, S, 2)
    c.rect(8, 13, 18, 13, 'navy')
    c.rect(7, 14, 19, 33, 'navy')
    c.pts([(10, 14), (11, 15), (16, 14), (15, 15)], 'navy', 4)
    for y in (17, 21, 25):
        c.px(11, y, 'brass', 4)
        c.px(15, y, 'brass', 4)
    stripe(c, 29, 7, 19)
    V.sp_legs(c, 'tar', 'tar', y0=34)
    c.px(13, 14, 'shell', 4)
    c.rect(21, 28, 21, 29, 'brass', 1)          # lantern
    c.rect(19, 30, 23, 36, 'brass')
    c.rect(20, 31, 22, 35, 'flame', 3)
    c.px(21, 32, 'flame', 4)
    V.sp_face(c, S, 'hair_grey')
    c.rect(12, 10, 16, 10, 'hair_grey', 3)
    c.rect(11, 11, 16, 12, 'hair_grey', 2)
    c.rect(10, 6, 10, 9, 'hair_grey', 2)
    c.rect(10, 2, 16, 4, 'navy')
    c.rect(10, 5, 18, 5, 'tar', 2)
    c.px(14, 3, 'brass', 4)
    return c


def sp_jory():
    """Boatwright: canvas shirt, braces, tarred trousers, mallet."""
    c = V.sprite()
    S = 'skin_c'
    for x0 in (5, 20):
        c.rect(x0, 14, x0 + 1, 18, 'sail')
        c.rect(x0, 19, x0 + 1, 25, S)
        c.rect(x0, 26, x0 + 1, 27, S, 1)
    c.rect(7, 13, 19, 13, 'sail')
    c.rect(5, 14, 21, 14, 'sail')
    c.rect(8, 15, 18, 30, 'sail')
    c.rect(10, 13, 10, 30, 'coral', 2)
    c.rect(16, 13, 16, 30, 'coral', 2)
    stripe(c, 27, 8, 18)
    V.sp_legs(c, 'tar', 'leather')
    c.pts([(11, 36), (15, 40), (14, 34)], 'sea', 2)   # patches
    c.px(13, 15, 'shell', 4)
    c.rect(21, 28, 21, 33, 'wood')              # mallet
    c.rect(19, 34, 23, 37, 'wood', 3)
    V.sp_face(c, S, 'hair_black')
    c.rect(11, 3, 15, 3, 'hair_black', 2)
    c.rect(10, 4, 16, 5, 'hair_black', 1)
    c.rect(10, 6, 10, 8, 'hair_black', 1)
    c.pts([(11, 11), (12, 11)], 'hair_black', 1)
    return c


# ---------------------------------------------------------------------------
# Scene 2: the seaside village
# ---------------------------------------------------------------------------

def seaside():
    W, H = 480, 300
    sc = Scene(W, H)
    SEA = 200
    sky = [hx('8fb0bb'), hx('9dbcc2'), hx('abc7c6'), hx('bcd1c8'), hx('cfdac6')]
    for y in range(SEA):
        col = sky[min(4, y * 5 // SEA)]
        for x in range(W):
            sc.P[x, y] = col + (255,)
    sc.disc(388, 74, 15, hx('e6dcb4'))
    sc.disc(388, 74, 12, hx('f1e7c0'))
    for (cx, cy, n) in [(150, 40, 5), (300, 28, 4), (440, 120, 3), (40, 170, 3)]:
        for i in range(n):
            sc.disc(cx + i * 7, cy - (3 if i % 2 else 0), 5 + (i % 2) * 2, hx('eae8dc'))
        for x in range(cx - 5, cx + n * 7 + 3):
            sc.px(x, cy + 5, hx('cfd4c8'))
            sc.px(x, cy + 6, hx('cfd4c8'))
    for (gx, gy) in [(210, 60), (222, 52), (340, 110)]:   # gulls
        for dx, dy in [(-2, -1), (-1, 0), (0, 1), (1, 0), (2, -1)]:
            sc.px(gx + dx, gy + dy, hx('3c4548'))
    sc.rect(300, 194, 352, 199, hx('93aeb0'))          # distant islet
    sc.rect(310, 191, 340, 193, hx('93aeb0'))

    def seabed(x):
        return min(282, SEA - 2 + max(0, (x - 236)) * 1.1)

    def ground(x):     # top of solid ground (cliff / beach / seabed)
        if x < 110:
            return 118
        if x < 150:
            t = (x - 110) / 40
            return round(118 + (196 - 118) * (t ** 0.6))
        if x < 236:
            return 196 + (x - 150) // 30
        return round(seabed(x))

    # water
    for y in range(SEA, H):
        d = (y - SEA) / (H - SEA)
        col = mix(R('sea', 3), R('sea', 0), d)
        col = mix(col, (40, 90, 110), 0.25)
        for x in range(W):
            sc.P[x, y] = col + (255,)
    for x in range(W):                                  # surface foam
        sc.px(x, SEA, R('sail', 4) if x % 9 < 4 else R('sea', 4))
        sc.px(x, SEA + 1, R('sea', 4) if x % 9 == 5 else R('sea', 3))
    # land
    for x in range(W):
        g = ground(x)
        for y in range(g, H):
            if x < 150 and y < 200:
                strata = (y + x // 9) % 7 == 0
                col = R('stone', 1 if strata else (3 if x < 12 or y < g + 2 else 2))
            else:
                depth = y - g
                if depth < 6:
                    col = R('sand', 3 if depth == 0 else 2)
                else:   # packed sediment under the sand, with pebbles
                    col = mix(R('sand', 1), R('stone', 1), min(0.6, (depth // 14) * 0.15))
                    if (x * 7 + y * 11) % 53 == 0:
                        col = R('stone', 3)
                if y > SEA and x > 236:
                    col = mix(col, R('sea', 1), 0.25)
            sc.px(x, y, col)
        if x < 112:
            for y in range(118, 122):
                sc.px(x, y, R('grass', 3 if y == 118 else 2))
    for x in range(112, 124, 2):                        # grass lip
        sc.px(x, 119, R('grass', 2))
    # kelp, fish and a crab under the water
    rnd = random.Random(6)
    for kx in (262, 276, 350, 358, 452):
        top = rnd.randint(228, 250)
        for y in range(top, int(seabed(kx)) + 1):
            sc.px(kx + (1 if (y // 4) % 2 else 0), y, R('moss', 2 + (y % 2)))
    for (fx, fy) in [(300, 232), (320, 244), (410, 226)]:
        sc.put(fish_small(), fx, fy)
    cx_, cy_ = 386, int(seabed(386)) - 3
    sc.rect(cx_, cy_, cx_ + 5, cy_ + 2, R('coral', 3))
    for dx in (-1, 6):
        sc.px(cx_ + dx, cy_ - 1, R('coral', 3))

    # lighthouse on the cliff
    base, top = 118, 52
    for y in range(top, base):
        t = (y - top) / (base - top)
        half = round(7 + 4 * t)
        band = ((y - top) // 12) % 2 == 1
        for x in range(52 - half, 52 + half + 1):
            m = 'coral' if band else 'sail'
            tone = 1 if x > 52 + half - 3 else (4 if x < 52 - half + 2 else 3)
            sc.px(x, y, R(m, tone))
    sc.rect(49, 106, 55, 117, R('wood', 1))             # door
    sc.rect(50, 70, 53, 74, R('flame', 3))              # window
    sc.rect(40, 48, 64, 51, R('iron', 1))               # gallery
    for x in range(41, 64, 3):
        sc.rect(x, 44, x, 47, R('iron', 2))
    sc.rect(44, 36, 60, 47, R('brass', 1))
    sc.rect(46, 37, 58, 46, R('flame', 3))
    sc.rect(50, 39, 54, 44, R('flame', 4))
    sc.rect(52, 37, 52, 46, R('brass', 1))
    glow(sc.img, 52, 41, 30, hx('f2d27a'), 0.5)
    for y in range(26, 36):
        half = (y - 26) + 1
        sc.rect(52 - half, y, 52 + half, y, R('coral', 1 if y % 3 == 0 else 2))
    sc.disc(52, 24, 2, R('brass', 3))

    # cliff stair: treads on posts, each post down to solid ground
    s0x, s0y, s1x = 110, 118, 172
    for x in range(s0x, s1x + 1):
        y = round(s0y + (x - s0x) * (196 - s0y) / (s1x - s0x))
        sc.px(x, y, R('wood', 3))
        sc.px(x, y + 1, R('wood', 1))
        if (x - s0x) % 14 == 7:
            for yy in range(y - 9, ground(x)):
                sc.px(x, yy, R('wood', 1))
                sc.px(x + 1, yy, R('wood', 2))
        sc.px(x, y - 9, R('wood', 3))                   # handrail

    # boat shed on the beach
    sx0, sx1, sfl = 180, 232, 197
    for px_ in (sx0, sx1 - 2):
        sc.rect(px_ - 1, sfl - 1, px_ + 3, sfl + 1, R('stone', 2))   # footings
        sc.rect(px_, sfl - 36, px_ + 2, sfl - 2, R('wood', 2))
    sc.rect(sx0 + 3, sfl - 36, sx1 - 3, sfl - 2, R('wood', 1))       # back boards
    for x in range(sx0 + 3, sx1 - 2, 5):
        sc.rect(x, sfl - 36, x, sfl - 2, R('wood', 0))
    for y in range(sfl - 56, sfl - 35):
        half = (y - (sfl - 56)) * 1.35 + 2
        for x in range(int((sx0 + sx1) / 2 - half), int((sx0 + sx1) / 2 + half) + 1):
            sc.px(x, y, R('coral', 1 if (y % 3 == 0) else 2))
    hull = Canvas(40, 14)
    for y in range(1, 12):
        inset = (y * y) // 12
        hull.rect(1 + inset, y, 38 - inset // 2, y, 'wood' if y > 3 else 'sea', 3 if y == 1 else None)
    hull.band(3, 2, 37, base='sea', thread='sail', rows=1)
    sc.put(hull, 186, sfl - 26)
    for tx in (192, 216):                               # trestles
        sc.rect(tx, sfl - 13, tx + 1, sfl - 2, R('wood', 3))
        sc.rect(tx - 2, sfl - 13, tx + 4, sfl - 12, R('wood', 3))

    # pier: deck on piles driven into the seabed, cross-braced
    DECK = 186
    for px_ in range(240, 446, 22):
        bottom = int(seabed(px_)) + 3
        for y in range(DECK + 3, bottom):
            for dx, t in ((0, 3), (1, 2), (2, 1)):
                col = R('wood', t)
                if y > SEA:
                    col = mix(col, R('sea', 1), 0.45)
                sc.px(px_ + dx, y, col)
        if px_ + 22 < 446:
            for i in range(23):
                y = DECK + 6 + i
                col = mix(R('wood', 1), R('sea', 1), 0.45 if y > SEA else 0)
                sc.px(px_ + i, y, col)
                sc.px(px_ + 22 - i, y, col)
    for y in range(DECK, DECK + 4):
        for x in range(236, 448):
            sc.px(x, y, R('wood', 3 if y == DECK else (2 if y < DECK + 3 else 1)))
            if x % 11 == 0 and y > DECK:
                sc.px(x, y, R('wood', 1))

    # fish stall
    for px_ in (250, 290):
        sc.rect(px_, DECK - 60, px_ + 1, DECK - 1, R('wood', 2))
    for x in range(246, 297):
        for y in range(DECK - 66, DECK - 58):
            sc.px(x, y, R('sail', 3) if (x // 5) % 2 else R('sea', 2))
        if x % 5 < 3:
            sc.px(x, DECK - 58, R('sail', 3) if (x // 5) % 2 else R('sea', 2))
    stand(sc, sp_nell, 258, DECK)
    sc.rect(248, DECK - 16, 294, DECK - 1, R('wood', 2))
    sc.rect(248, DECK - 16, 294, DECK - 15, R('wood', 3))
    for fx in (252, 262, 272, 282):
        sc.put(fish_small(), fx, DECK - 20)
    sc.put(sign('fish'), 266, DECK - 78)
    for y in range(DECK - 70, DECK - 66):
        sc.px(271, y, R('iron', 1))

    # net-mender's stilt house
    hx0, hx1 = 330, 396
    for x in range(hx0, hx1 + 1):
        for y in range(DECK - 40, DECK):
            t = 1 if x % 5 == 0 else (3 if x < hx0 + 2 else 2)
            sc.px(x, y, R('sea', t))
    for x in (hx0, hx0 + 1, hx1 - 1, hx1):
        for y in range(DECK - 40, DECK):
            sc.px(x, y, R('sail', 2))
    sc.rect(356, DECK - 22, 366, DECK - 1, R('wood', 1))
    sc.rect(356, DECK - 23, 366, DECK - 23, R('sail', 3))
    sc.disc(343, DECK - 26, 5, R('sail', 3))
    sc.disc(343, DECK - 26, 3, R('flame', 3))
    sc.disc(382, DECK - 26, 5, R('sail', 3))
    sc.disc(382, DECK - 26, 3, R('flame', 3))
    apex = DECK - 68
    for y in range(apex, DECK - 39):
        half = (y - apex) * 1.35 + 2
        for x in range(int(363 - half), int(363 + half) + 1):
            sc.px(x, y, R('coral', 1 if (y - apex) % 4 == 3 or (x + (y // 4) * 3) % 8 == 0 else 2))
    sc.rect(373, apex + 4, 378, apex + 16, R('stone', 2))       # chimney
    smoke(sc, 376, apex, n=4, col=hx('dedcd2'))
    sc.disc(400, DECK - 30, 4, R('coral', 3))                  # buoy
    sc.rect(396, DECK - 31, 404, DECK - 30, R('sail', 4))
    # drying net between two poles
    for px_ in (304, 322):
        sc.rect(px_, DECK - 42, px_ + 1, DECK - 1, R('wood', 2))
    for x in range(306, 322):
        sag = round(4 * (1 - ((x - 314) / 8) ** 2))
        for y in range(DECK - 40 + sag, DECK - 10):
            if (x + y) % 3 == 0 or (x - y) % 3 == 0:
                sc.px(x, y, R('sail', 3))

    # moored boat past the pier end
    boat = Canvas(40, 12)
    for y in range(1, 11):
        inset = (y * y) // 10
        boat.rect(1 + inset, y, 38 - inset, y, 'coral' if y < 4 else 'wood')
    boat.rect(2, 1, 37, 1, 'sail', 4)
    sc.put(boat, 440, SEA - 6)
    sc.rect(458, SEA - 56, 459, SEA - 6, R('wood', 2))
    for y in range(SEA - 52, SEA - 18):
        w = (y - (SEA - 52)) // 2
        sc.rect(461, y, 461 + w // 2 + 2, y, R('sail', 3 if y % 5 else 2))
    sc.line(447, DECK + 1, 444, SEA - 3, R('wood', 1))

    # villagers
    stand(sc, sp_aldous, 60, 118)
    stand(sc, sp_jory, 214, 196)
    stand(sc, sp_ottie, 300, DECK)
    stand(sc, sp_wick, 410, DECK)
    sc.line(431, 147, 450, 124, R('wood', 3))                # rod
    sc.line(450, 124, 452, SEA, R('sail', 2))
    return sc


def main():
    os.makedirs(OUT, exist_ok=True)
    shots = [('01_underground_village.png', 'Hearthfolk burrow (underground)', underground()),
             ('02_seaside_village.png', 'Saltfolk harbour (seaside)', seaside())]
    figs = []
    for name, title, sc in shots:
        big = sc.img.resize((sc.w * SCALE, sc.h * SCALE), Image.NEAREST)
        path = os.path.join(OUT, name)
        big.save(path)
        b64 = base64.b64encode(open(path, 'rb').read()).decode()
        figs.append(f'<figure><figcaption>{title}</figcaption>'
                    f'<img src="data:image/png;base64,{b64}" alt="{title}"></figure>')
        print('wrote', name)
    html = ('<!doctype html><html><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Village Mockups</title><style>'
            ':root{--bg:#141013;--fg:#c1b59a}'
            'body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px monospace}'
            'figure{margin:0 0 24px}figcaption{margin:0 0 8px;letter-spacing:.1em;text-transform:uppercase}'
            'img{width:100%;max-width:1440px;image-rendering:pixelated;display:block}'
            '</style></head><body>' + ''.join(figs) + '</body></html>')
    with open(os.path.join(OUT, 'index.html'), 'w') as f:
        f.write(html)
    print('wrote index.html')


if __name__ == '__main__':
    main()
