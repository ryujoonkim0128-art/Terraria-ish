#!/usr/bin/env python3
"""Scene helpers and props shared by the village mockups (see villages.py)."""
import random

from PIL import Image, ImageOps

import villagers as V
from pixel import RAMPS, Canvas, hx, mix, ramp


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
