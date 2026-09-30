#!/usr/bin/env python3
"""Render the villager mockup sheets into mockups/villagers/.

    pip install pillow
    python3 tools/mockups/build.py
"""
import os
import random

from PIL import Image

from pixel import RAMPS, Canvas, hx, mix, text, text_w
from villagers import VILLAGERS

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'mockups', 'villagers')

INK = hx('c1b59a')
INK_DIM = hx('857a64')
INK_RED = hx('a15c40')
NIGHT = hx('141013')


def save(img, name, scale):
    os.makedirs(OUT, exist_ok=True)
    img.resize((img.width * scale, img.height * scale), Image.NEAREST).save(os.path.join(OUT, name))
    print('wrote', name, img.width * scale, 'x', img.height * scale)


def blank(w, h, col=NIGHT):
    return Image.new('RGBA', (w, h), col + (255,))


def soil(img, x0, y0, x1, y1, seed=1):
    """Dark packed earth with scattered stones, like the burrow reference."""
    rnd = random.Random(seed)
    P = img.load()
    base = [hx('1e1613'), hx('231a16'), hx('281e19')]
    for y in range(y0, y1):
        for x in range(x0, x1):
            P[x, y] = base[(x * 3 + y * 5 + rnd.randint(0, 2)) % 3] + (255,)
    for _ in range((x1 - x0) * (y1 - y0) // 90):
        x, y = rnd.randint(x0, x1 - 3), rnd.randint(y0, y1 - 2)
        P[x, y] = hx('3a3036') + (255,)
        P[x + 1, y] = hx('2e2629') + (255,)


def glow(img, cx, cy, r, col, strength):
    P = img.load()
    for y in range(max(0, cy - r), min(img.height, cy + r + 1)):
        for x in range(max(0, cx - r), min(img.width, cx + r + 1)):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / r
            if d < 1:
                # banded falloff keeps it pixel-art rather than a smooth gradient
                k = strength * (1 - d)
                k = round(k * 4) / 4
                r0, g0, b0, a0 = P[x, y]
                P[x, y] = mix((r0, g0, b0), col, k * 0.5) + (a0,)


def room(img, x0, y0, x1, floor_y):
    """Burrow hall interior: warm clay wall, rounded ceiling, plank floor."""
    P = img.load()
    wall = [hx('3d2419'), hx('45291c'), hx('4f2f1f')]
    rnd = random.Random(5)
    for y in range(y0, floor_y):
        for x in range(x0, x1):
            # rounded top corners
            inset = max(0, 6 - (y - y0))
            if x < x0 + inset or x >= x1 - inset:
                continue
            band = 0 if (y - y0) < 4 else (1 if (y + (x // 7)) % 9 else 2)
            if rnd.random() < 0.05:
                band = max(0, band - 1)
            P[x, y] = wall[band] + (255,)
    # plank floor
    for y in range(floor_y, floor_y + 4):
        for x in range(x0, x1):
            t = 3 if y == floor_y else (2 if y < floor_y + 3 else 1)
            if (x + (y - floor_y) * 11) % 17 == 0:
                t = 1
            P[x, y] = RAMPS['wood'][t] + (255,)
    # support posts
    for px in range(x0 + 1, x1 - 2, (x1 - x0 - 3) // 3):
        for y in range(y0 + 6, floor_y):
            P[px, y] = RAMPS['wood'][2] + (255,)
            P[px + 1, y] = RAMPS['wood'][1] + (255,)
    # lanterns hanging from the ceiling
    for lx in range(x0 + 30, x1 - 10, 56):
        for y in range(y0, y0 + 5):
            P[lx, y] = RAMPS['iron'][1] + (255,)
        glow(img, lx, y0 + 7, 24, hx('e08a2a'), 0.32)
        P[lx, y0 + 5] = RAMPS['iron'][2] + (255,)
        P[lx, y0 + 6] = RAMPS['flame'][4] + (255,)
        P[lx, y0 + 7] = RAMPS['flame'][3] + (255,)
        P[lx - 1, y0 + 6] = RAMPS['iron'][1] + (255,)
        P[lx + 1, y0 + 6] = RAMPS['iron'][1] + (255,)


def lineup():
    slot = 56
    W, H = 6 * slot + 14, 100
    img = blank(W, H)
    soil(img, 0, 0, W, H)
    floor = 76
    room(img, 5, 14, W - 5, floor)
    text(img, 6, 3, 'HEARTHFOLK', INK)
    text(img, 6 + text_w('HEARTHFOLK') + 5, 3, 'VILLAGER LINEUP - 1X SPRITES, 3/4 VIEW', INK_DIM)
    for i, v in enumerate(VILLAGERS):
        spr = v['sprite']().render()
        x = 7 + i * slot + (slot - spr.width) // 2
        img.alpha_composite(spr, (x, floor - 53))
        cx = 7 + i * slot + slot // 2
        text(img, cx - text_w(v['name']) // 2, floor + 7, v['name'], INK)
        text(img, cx - text_w(v['role']) // 2, floor + 14, v['role'], INK_RED)
    save(img, '01_lineup.png', 5)


def plate(img, x, y, w, h, col):
    P = img.load()
    c0 = hx(col)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            edge = xx in (x, x + w - 1) or yy in (y, y + h - 1)
            k = (yy - y) / h
            c = mix(mix(c0, (255, 230, 200), 0.10), mix(c0, NIGHT, 0.45), k)
            if (xx + yy) % 2 and abs(k - 0.5) < 0.08:
                c = mix(c, NIGHT, 0.12)
            P[xx, yy] = (mix(c0, NIGHT, 0.7) if edge else c) + (255,)
    # corner rivets in copper, echoing the hearth token
    for (cx, cy) in ((x + 2, y + 2), (x + w - 3, y + 2), (x + 2, y + h - 3), (x + w - 3, y + h - 3)):
        P[cx, cy] = RAMPS['copper'][3] + (255,)


def portraits():
    cw, ch = 64, 84
    W, H = 3 * cw + 8, 16 + 2 * ch
    img = blank(W, H)
    text(img, 6, 5, 'HEARTHFOLK', INK)
    text(img, 6 + text_w('HEARTHFOLK') + 5, 5, 'DIALOGUE PORTRAITS', INK_DIM)
    for i, v in enumerate(VILLAGERS):
        x = 6 + (i % 3) * cw
        y = 14 + (i // 3) * ch
        plate(img, x, y, 58, 66, v['plate'])
        img.alpha_composite(v['portrait']().render(), (x + 1, y + 1))
        text(img, x, y + 69, v['name'], INK)
        text(img, x, y + 76, v['role'], INK_RED)
    save(img, '02_portraits.png', 4)


def swatches(img, x, y, mats):
    P = img.load()
    for i, m in enumerate(mats):
        for t, col in enumerate(RAMPS[m]):
            for yy in range(y, y + 5):
                for xx in range(x + i * 18 + t * 3, x + i * 18 + t * 3 + 3):
                    P[xx, yy] = col + (255,)


def card(v):
    W, H = 224, 88
    img = blank(W, H)
    # left: portrait
    plate(img, 6, 14, 58, 66, v['plate'])
    img.alpha_composite(v['portrait']().render(), (7, 15))
    # middle: sprite on a strip of floor
    fx0, fy = 70, 79
    P = img.load()
    for x in range(fx0, fx0 + 30):
        for y in range(fy, fy + 3):
            P[x, y] = RAMPS['wood'][3 if y == fy else 1] + (255,)
    spr = v['sprite']().render()
    img.alpha_composite(spr, (fx0 + 1, fy - 53))
    # right: text
    tx = 106
    text(img, 6, 5, v['name'], INK)
    text(img, 6 + text_w(v['name']) + 5, 5, v['role'], INK_RED)
    text(img, W - 6 - text_w('HEARTHFOLK'), 5, 'HEARTHFOLK', INK_DIM)
    text(img, tx, 16, 'ROUTINE', INK_DIM)
    for j, line in enumerate(v['lines'][:-1]):
        text(img, tx, 24 + j * 8, line, INK)
    text(img, tx, 50, v['lines'][-1], INK_RED)
    text(img, tx, 64, 'PALETTE', INK_DIM)
    swatches(img, tx, 71, v['mats'])
    save(img, f"card_{v['key']}.png", 4)


def culture():
    W, H = 236, 100
    img = blank(W, H)
    text(img, 6, 5, 'HEARTHFOLK', INK)
    text(img, 6 + text_w('HEARTHFOLK') + 5, 5, 'SHARED MARKERS', INK_DIM)

    def zoom(c, k):
        r = c.render()
        return r.resize((r.width * k, r.height * k), Image.NEAREST)

    # 1. knot band (3-row hem + 2-row sash weave)
    b = Canvas(18, 7)
    b.band(0, 0, 17, rows=3)
    b.band(4, 0, 17, rows=2)
    b.rect(0, 3, 17, 3, 'madder', 0)
    img.alpha_composite(zoom(b, 3), (6, 16))
    text(img, 6, 42, 'KNOT BAND', INK)
    text(img, 6, 49, 'HEM + SASH WEAVE', INK_DIM)
    text(img, 6, 56, 'EVERY VILLAGER', INK_DIM)
    # 2. hearth token
    t = Canvas(9, 9)
    t.fill(t.ell((1, 1, 7, 7)), 'copper', sh=(4, 4, 4, 4), bias=0.1)
    t.set(4, 4, 'amber', 4)
    t.set(4, 3, 'amber', 3)
    t.set(3, 4, 'amber', 2)
    img.alpha_composite(zoom(t, 3), (78, 16))
    text(img, 72, 42, 'HEARTH TOKEN', INK)
    text(img, 72, 49, 'COPPER + AMBER', INK_DIM)
    text(img, 72, 56, 'WORN AT THE NECK', INK_DIM)
    # 3. dyes
    dyes = [('OAT WOOL', 'wool_oat'), ('MADDER', 'madder'), ('MOSS', 'moss'), ('INDIGO', 'indigo'),
            ('WALNUT', 'walnut'), ('OCHRE', 'ochre'), ('COPPER', 'copper')]
    P = img.load()
    for i, (name, m) in enumerate(dyes):
        y = 16 + i * 10
        for t_, col in enumerate(RAMPS[m]):
            for yy in range(y, y + 6):
                for xx in range(160 + t_ * 4, 164 + t_ * 4):
                    P[xx, yy] = col + (255,)
        text(img, 184, y + 1, name, INK)
    text(img, 6, 70, 'UNDYED WOOL + PLANT DYES.', INK_DIM)
    text(img, 6, 77, 'NO BRIGHT COLOURS - COPPER', INK_DIM)
    text(img, 6, 84, 'AND AMBER ARE THE ONLY SHINE,', INK_DIM)
    text(img, 6, 91, 'SO THE TOKEN ALWAYS READS.', INK_DIM)
    save(img, '03_culture_key.png', 4)


if __name__ == '__main__':
    lineup()
    portraits()
    culture()
    for v in VILLAGERS:
        card(v)
