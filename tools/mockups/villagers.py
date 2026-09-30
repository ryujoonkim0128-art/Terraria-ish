"""Villager sprites + close-up portraits for the Hearthfolk mockups.

Sprites: 28x56 canvas, 3/4 view facing right, ~6 heads tall.
Portraits: 56x64 bust, 3/4 view facing right.

Shared cultural markers on every villager:
  * the madder-red 'knot band' (woven sash / hem / headband)
  * a copper hearth token worn at the neck
  * undyed oat wool + plant dyes (madder, moss, indigo-slate, walnut, ochre)
"""
from pixel import Canvas

BASE = 2  # sprite vertical offset so tall hats keep an outline row

# ---------------------------------------------------------------------------
# Sprite helpers (coordinates are in the 3/4 template; head x10..16, y4..11)
# ---------------------------------------------------------------------------


def sprite(extra_oy=0):
    return Canvas(28, 56, oy=BASE + extra_oy)


def sp_face(c, skin, brow, mouth=True):
    c.rect(11, 4, 15, 4, skin)
    c.rect(10, 5, 16, 10, skin)
    c.rect(11, 11, 15, 11, skin, 1)
    c.px(16, 9, skin, 2)
    c.px(17, 9, skin, 2)          # nose
    c.px(10, 8, skin, 3)
    c.px(10, 9, skin, 2)
    c.px(11, 8, skin, 1)          # ear
    c.px(13, 8, 'eye', 0)
    c.px(15, 8, 'eye', 0)
    c.pts([(12, 7), (13, 7), (15, 7), (16, 7)], brow, 1)
    if mouth:
        c.pts([(14, 10), (15, 10)], skin, 1)
    c.rect(12, 12, 14, 12, skin, 1)   # neck


def sp_legs(c, pants, boots, y0=31):
    c.rect(10, y0, 12, 46, pants)
    c.rect(14, y0, 16, 46, pants)
    c.rect(13, y0, 13, y0 + 2, pants, 1)
    sp_boots(c, boots)


def sp_boots(c, boots):
    c.rect(9, 47, 12, 50, boots)
    c.rect(14, 47, 17, 50, boots)
    c.rect(9, 47, 12, 47, boots, 3)
    c.rect(14, 47, 17, 47, boots, 3)


def skirt(c, mat, y0=23, y1=46, x0=9, x1=17, step=6):
    for y in range(y0, y1 + 1):
        g = (y - y0) // step
        c.rect(x0 - g, y, x1 + g, y, mat)


def sp_brannock():
    """Forgewright. Broad, bald, grey-bearded, leather apron, rolled sleeves."""
    c = sprite()
    S = 'skin_a'
    # shirt + shoulders
    c.rect(7, 13, 19, 13, 'wool_oat')
    c.rect(5, 14, 21, 14, 'wool_oat')
    c.rect(8, 15, 18, 30, 'wool_oat')
    for x0 in (5, 20):
        c.rect(x0, 15, x0 + 1, 18, 'wool_oat')
        c.rect(x0, 19, x0 + 1, 19, 'wool_oat', 3)    # rolled cuff
        c.rect(x0, 20, x0 + 1, 26, S)
        c.rect(x0, 27, x0 + 1, 28, S, 1)             # fists
    c.pts([(5, 23), (20, 22), (21, 24)], S, 1)       # forearm soot
    sp_legs(c, 'walnut', 'leather')
    sp_boots(c, 'leather')
    # apron
    c.rect(10, 16, 16, 22, 'leather')
    c.rect(9, 23, 17, 39, 'leather')
    c.rect(10, 13, 10, 15, 'leather', 1)
    c.rect(16, 13, 16, 15, 'leather', 1)
    c.pts([(11, 30), (14, 33), (12, 36), (15, 27)], 'leather', 1)   # scorch marks
    c.pts([(10, 39), (12, 39), (14, 39), (16, 39)], 'leather', 1)
    # sash over apron + knot tails
    c.band(23, 8, 18)
    c.rect(18, 25, 18, 29, 'madder')
    c.rect(17, 25, 17, 27, 'madder', 1)
    c.px(13, 15, 'copper', 4)                        # hearth token
    # hammer (held head-down)
    c.rect(21, 29, 21, 33, 'wood')
    c.rect(19, 34, 23, 35, 'iron')
    c.px(19, 34, 'iron', 3)
    # head: bald, grey fringe, big beard
    sp_face(c, S, 'hair_grey')
    c.rect(10, 7, 10, 9, 'hair_grey', 2)
    c.px(11, 6, S, 4)                                # scalp shine
    c.px(13, 5, S, 1)                                # soot
    c.rect(12, 10, 16, 10, 'hair_grey', 3)           # moustache
    c.rect(11, 11, 16, 11, 'hair_grey', 2)
    c.rect(12, 12, 16, 12, 'hair_grey', 2)
    c.rect(13, 13, 15, 13, 'hair_grey', 1)
    c.pts([(12, 7), (13, 7), (15, 7), (16, 7), (13, 6), (15, 6)], 'hair_grey', 3)
    return c


def sp_edda():
    """Hearth-elder. Long indigo robe, oat shawl, grey braid, staff."""
    c = sprite()
    S = 'skin_d'
    # staff first (hand drawn over it)
    c.rect(21, 3, 21, 50, 'wood')
    c.pts([(20, 1), (22, 1), (21, 0), (20, 2), (22, 2)], 'wood', 1)
    c.px(21, 1, 'amber', 4)
    c.px(21, 2, 'amber', 2)
    c.rect(21, 4, 21, 5, 'copper', 3)
    # robe
    c.rect(9, 13, 17, 22, 'indigo')
    skirt(c, 'indigo', 23, 46)
    for x0 in (6, 19):
        c.rect(x0, 14, x0 + 1, 26, 'indigo')
    c.rect(6, 27, 7, 28, S, 2)
    c.rect(20, 26, 21, 27, S, 2)
    c.band(42, 5, 21, rows=3)
    for y in range(42, 45):     # trim band to the skirt outline
        g = (y - 23) // 6
        for x in range(5, 22):
            if x < 9 - g or x > 17 + g:
                c.px(x, y, None)
    # shawl
    c.rect(8, 13, 18, 13, 'wool_oat')
    c.rect(7, 14, 19, 18, 'wool_oat')
    for x in range(7, 20, 2):
        c.px(x, 19, 'wool_oat', 1)
    c.band(23, 9, 17)
    c.rect(10, 25, 11, 30, 'madder')
    c.px(11, 25, 'madder', 1)
    # shoes
    c.rect(10, 47, 12, 48, 'leather')
    c.rect(14, 47, 16, 48, 'leather')
    c.px(17, 48, 'leather')
    # necklace + token
    c.pts([(12, 14), (14, 14)], 'amber', 3)
    c.px(13, 14, 'amber', 2)
    c.px(13, 15, 'copper', 4)
    # head
    sp_face(c, S, 'hair_grey')
    c.rect(11, 3, 15, 4, 'hair_grey', 3)
    c.band(5, 10, 16, rows=1)
    c.rect(10, 6, 10, 9, 'hair_grey', 2)
    c.px(11, 6, 'hair_grey', 3)
    for y in range(9, 22):
        c.px(10, y, 'hair_grey', 3 if y % 2 else 1)
    c.px(10, 22, 'copper', 3)
    c.px(12, 10, S, 1)            # cheek line
    c.px(16, 8, S, 1)
    return c


def sp_tavi():
    """Forager. Moss cloak, fur mantle, quiver, bow in hand, leg wraps."""
    c = sprite()
    S = 'skin_b'
    # quiver behind left shoulder
    c.rect(7, 8, 9, 20, 'leather')
    c.pts([(7, 6), (9, 6), (7, 7), (9, 7)], 'madder', 3)
    c.pts([(8, 6), (8, 7)], 'wool_oat', 3)
    # cloak
    c.rect(8, 13, 18, 13, 'moss')
    c.rect(7, 14, 19, 31, 'moss')
    for x in range(7, 20, 2):
        c.px(x, 32, 'moss', 1)
    c.rect(8, 10, 10, 12, 'moss', 1)      # hood bunched at nape
    # tunic
    c.rect(10, 15, 16, 30, 'walnut')
    c.band(23, 10, 16)
    # strap + satchel
    for i, (x, y) in enumerate([(11, 16), (12, 17), (13, 18), (14, 19), (15, 20), (16, 21), (16, 22)]):
        c.px(x, y, 'leather', 1)
    c.rect(15, 24, 18, 28, 'leather')
    c.rect(15, 24, 18, 24, 'leather', 3)
    c.px(17, 26, 'copper', 4)
    # fur mantle
    c.rect(8, 13, 18, 14, 'fur')
    c.pts([(9, 15), (11, 15), (14, 15), (17, 15)], 'fur', 1)
    c.pts([(10, 13), (13, 14), (16, 13)], 'fur', 4)
    c.px(13, 15, 'copper', 4)
    # legs with wraps
    sp_legs(c, 'wool_grey', 'leather', y0=33)
    for y in range(38, 47):
        t = 1 if y % 2 else 2
        c.rect(10, y, 12, y, 'leather', t)
        c.rect(14, y, 16, y, 'leather', t)
    sp_boots(c, 'leather')
    # bow + string, then hand
    for y in range(16, 41):
        x = 20 if y < 19 or y > 37 else (22 if 25 <= y <= 31 else 21)
        c.px(x, y, 'wood')
    c.rect(20, 19, 20, 37, 'wool_oat', 1)
    c.rect(19, 27, 20, 28, S, 2)
    # head
    sp_face(c, S, 'hair_brown')
    c.rect(11, 3, 14, 3, 'hair_brown', 2)
    c.rect(10, 4, 16, 4, 'hair_brown')
    c.rect(10, 5, 15, 5, 'hair_brown', 3)
    c.pts([(10, 6), (11, 6), (12, 6), (14, 6), (10, 7), (10, 8), (11, 7)], 'hair_brown', 2)
    c.px(16, 5, 'hair_brown', 1)
    return c


def sp_orsk():
    """Digger. Stocky, candle cap, quilted ochre jerkin, pick."""
    c = sprite(3)
    S = 'skin_c'
    # pick (behind arm)
    c.rect(21, 7, 21, 26, 'wood')
    c.rect(18, 5, 25, 6, 'iron')
    c.pts([(18, 7), (25, 7)], 'iron', 1)
    c.px(18, 5, 'iron', 4)
    # arms
    c.rect(7, 13, 19, 13, 'ochre')
    c.rect(5, 14, 21, 14, 'wool_grey')
    for x0 in (5, 20):
        c.rect(x0, 15, x0 + 1, 25, 'wool_grey')
        c.rect(x0, 26, x0 + 1, 27, S, 2)
    # jerkin: round shoulders, barrel chest, tapering to the hips
    c.rect(8, 13, 18, 13, 'ochre')
    c.rect(8, 14, 18, 24, 'ochre')
    c.rect(9, 25, 17, 27, 'ochre')
    for y in (16, 19, 22):
        c.rect(9, y, 17, y, 'ochre', 1)
    c.rect(13, 14, 13, 27, 'ochre', 1)
    c.rect(12, 13, 14, 13, 'wool_grey', 3)    # shirt collar
    c.band(24, 8, 18)
    c.rect(18, 25, 18, 28, 'madder')
    c.px(13, 15, 'copper', 4)
    c.oy = BASE
    # legs: shorter, thicker
    c.rect(9, 31, 12, 46, 'walnut')
    c.rect(14, 31, 17, 46, 'walnut')
    c.rect(13, 31, 13, 33, 'walnut', 1)
    c.rect(9, 38, 12, 40, 'leather', 2)
    c.rect(14, 38, 17, 40, 'leather', 2)
    c.pts([(10, 44), (12, 45), (15, 43), (16, 45), (11, 42), (9, 46)], 'ochre', 1)
    sp_boots(c, 'leather')
    c.rect(8, 48, 8, 50, 'leather', 1)
    c.oy = BASE + 3
    # head (lit from his candle: warmer, lighter face tones)
    sp_face(c, S, 'hair_black')
    c.rect(11, 6, 15, 9, S, 4)
    c.rect(11, 10, 11, 11, S, 3)
    c.px(11, 8, S, 2)
    c.rect(11, 2, 15, 2, 'leather', 3)
    c.rect(10, 3, 16, 4, 'leather')
    c.rect(10, 5, 18, 5, 'leather', 1)      # brim reaching forward
    c.px(13, 1, 'copper', 3)
    c.rect(13, -1, 13, 0, 'wax', 3)
    c.px(13, -2, 'flame', 4)
    c.px(13, -3, 'flame', 2)
    c.rect(12, 10, 16, 10, 'hair_black', 2)
    c.rect(11, 11, 16, 11, 'hair_black', 1)
    c.rect(12, 12, 15, 12, 'hair_black', 1)
    c.pts([(12, 7), (13, 7), (15, 7), (16, 7), (12, 6), (15, 6)], 'hair_black', 2)
    c.rect(10, 6, 10, 9, 'hair_black', 1)
    c.px(13, 8, 'eye', 0)
    c.px(15, 8, 'eye', 0)
    c.px(16, 9, S, 3)
    c.px(17, 9, S, 2)
    return c


def sp_maren():
    """Dyer-weaver. Head wrap, moss dress, oat apron, indigo hands, yarn basket."""
    c = sprite()
    S = 'skin_c'
    c.rect(9, 13, 17, 21, 'moss')
    skirt(c, 'moss', 22, 46)
    for x0 in (6, 19):
        c.rect(x0, 14, x0 + 1, 19, 'moss')
        c.rect(x0, 20, x0 + 1, 25, S)
        c.rect(x0, 26, x0 + 1, 27, 'indigo', 3)   # dye-stained hands
    c.rect(8, 13, 18, 14, 'moss')
    # apron
    c.rect(10, 23, 16, 43, 'wool_oat')
    c.band(41, 10, 16, rows=3)
    c.band(21, 9, 17)
    c.rect(9, 23, 9, 27, 'madder')
    # basket of skeins
    c.rect(19, 25, 24, 31, 'ochre')
    for y in range(26, 32):
        for x in range(19, 25):
            c.px(x, y, 'ochre', 1 if (x + y) % 2 else 2)
    c.rect(19, 25, 24, 25, 'wood', 3)
    c.pts([(20, 24), (20, 23)], 'madder', 3)
    c.pts([(21, 24), (22, 24), (22, 23)], 'indigo', 3)
    c.px(23, 24, 'ochre', 4)
    c.rect(19, 26, 20, 26, 'indigo', 3)
    # shoes
    c.rect(10, 47, 12, 48, 'leather')
    c.rect(14, 47, 17, 48, 'leather')
    c.px(13, 13, 'copper', 4)
    # head + wrap
    sp_face(c, S, 'hair_black')
    c.rect(11, 2, 15, 2, 'wool_oat', 3)
    c.rect(10, 3, 16, 4, 'wool_oat')
    c.band(5, 10, 16, rows=1)
    c.rect(8, 5, 10, 9, 'wool_oat')
    c.rect(9, 6, 9, 8, 'wool_oat', 1)
    c.pts([(9, 10), (9, 11), (8, 12), (9, 13)], 'wool_oat', 1)
    c.px(11, 10, 'copper', 4)
    return c


def sp_holt():
    """Warden. Tall, fur-banded cap, madder mantle, quilted gambeson, spear."""
    c = sprite()
    S = 'skin_e'
    # spear
    c.rect(22, 2, 22, 50, 'wood')
    c.pts([(22, -1), (21, 0), (22, 0), (23, 0), (22, 1)], 'iron', 3)
    c.px(22, -1, 'iron', 4)
    c.pts([(21, 2), (21, 3), (23, 2)], 'madder', 3)
    c.oy = BASE - 2
    # arms
    for x0 in (5, 20):
        c.rect(x0, 15, x0 + 1, 25, 'wool_grey')
        c.rect(x0, 22, x0 + 1, 25, 'leather')
        c.rect(x0, 26, x0 + 1, 27, S, 2)
    # gambeson
    c.rect(8, 15, 18, 32, 'wool_grey')
    for x in (10, 13, 16):
        c.rect(x, 18, x, 32, 'wool_grey', 1)
    c.rect(8, 24, 18, 24, 'leather')
    c.px(14, 24, 'copper', 4)
    c.band(25, 8, 18, rows=1)
    # mantle
    c.rect(8, 13, 18, 13, 'madder')
    c.rect(5, 14, 21, 16, 'madder')
    c.band(17, 5, 21, rows=1)
    c.px(15, 14, 'copper', 4)
    c.px(13, 15, 'copper', 3)
    c.oy = BASE
    sp_legs(c, 'indigo', 'leather', y0=31)
    for y in range(40, 47, 2):
        c.rect(10, y, 12, y, 'wool_oat', 1)
        c.rect(14, y, 16, y, 'wool_oat', 1)
    sp_boots(c, 'leather')
    c.rect(20, 24, 21, 25, S, 2)     # hand on spear
    c.oy = BASE - 2
    # head
    sp_face(c, S, 'hair_black')
    c.rect(11, 1, 15, 1, 'indigo', 3)
    c.rect(10, 2, 16, 3, 'indigo')
    c.rect(9, 4, 17, 5, 'fur')
    c.pts([(10, 4), (13, 5), (16, 4)], 'fur', 4)
    c.pts([(9, 5), (12, 4), (15, 5)], 'fur', 1)
    c.rect(10, 6, 10, 10, 'hair_black', 2)
    c.rect(9, 8, 9, 13, 'hair_black', 1)      # queue
    c.rect(13, 10, 16, 10, 'hair_black', 2)   # drooping moustache
    c.pts([(16, 11), (13, 11)], 'hair_black', 1)
    c.px(15, 7, S, 4)                         # scar through brow
    c.px(15, 6, S, 4)
    return c


# ---------------------------------------------------------------------------
# Portrait helpers (absolute coordinates, 56x64)
# ---------------------------------------------------------------------------

JAWS = {
    'square': [(15, 28), (40, 28), (40, 36), (38, 43), (35, 47), (31, 48), (25, 47), (20, 44), (16, 38)],
    'narrow': [(15, 28), (39, 28), (39, 35), (37, 41), (34, 45), (30, 47), (25, 46), (20, 42), (16, 36)],
}
SHOULDERS = [(2, 64), (4, 57), (10, 52), (20, 49), (35, 49), (45, 52), (51, 57), (53, 64)]


def strands(x, y, t):
    # steep 1px strand lines that drift sideways as they fall
    return t - 1 if (x - y // 3) % 4 == 0 else t


def vstrands(x, y, t):
    # vertical beard dashes, offset per column so they don't grid up
    return t - 1 if (y + (x * 5) % 7) % 4 == 0 and x % 2 == 0 else t


def p_neck(c, skin):
    c.fill(c.poly([(21, 40), (34, 40), (35, 56), (20, 56)]), skin, sh=(26, 46, 10, 16), bias=-0.25)


def p_shoulders(c, mat, dither=0.035, bias=0.0, tex=None):
    c.fill(c.poly(SHOULDERS), mat, sh=(24, 60, 28, 16), bias=bias, dither=dither, tex=tex)


def p_head(c, skin, jaw='square'):
    head = c.ell((15, 10, 40, 41))
    from PIL import ImageChops
    head = ImageChops.lighter(head, c.poly(JAWS[jaw]))
    c.fill(head, skin, sh=(29, 27, 15, 20), bias=0.12)
    # cast shadow of the jaw onto the neck
    pm = head.load()
    for x in range(18, 38):
        for y in range(30, 60):
            if pm[x, y] < 128 and pm[x, y - 1] >= 128:
                for k in range(3):
                    c.shift(x, y + k, -2 if k < 2 else -1, only={skin})
                break
    return head


def p_ear(c, skin):
    c.fill(c.poly([(14, 29), (17, 28), (19, 30), (19, 35), (17, 38), (15, 37), (14, 33)]), skin, tone=2)
    for y in range(30, 36):
        c.set(15, y, skin, 3)
    c.set(15, 29, skin, 3)
    for y in range(31, 35):
        c.set(17, y, skin, 1)
    c.set(16, 33, skin, 1)
    c.set(18, 36, skin, 1)


def p_face(c, skin, iris='iris_brown', brow='hair_black', heavy=False, age=0, nose='straight', scar=False):
    # eye sockets
    for y in range(28, 32):
        for x in range(21, 29):
            c.shift(x, y, -1, only={skin})
        for x in range(33, 39):
            c.shift(x, y, -1, only={skin})
    # near eye (viewer-left)
    for x in range(23, 28):
        c.set(x, 29, 'lash')
    c.set(22, 30, 'lash')
    c.set(23, 30, skin, 1)
    c.set(24, 30, 'sclera', 3)
    c.set(25, 30, iris, 2)
    c.set(26, 30, 'eye')
    c.set(27, 30, 'sclera', 1)
    for x in range(23, 28):
        c.set(x, 31, skin, 2)
    # far eye (foreshortened)
    for x in range(34, 38):
        c.set(x, 29, 'lash')
    c.set(34, 30, 'sclera', 2)
    c.set(35, 30, iris, 2)
    c.set(36, 30, 'eye')
    c.set(37, 30, skin, 1)
    for x in range(34, 37):
        c.set(x, 31, skin, 2)
    # brows: low, straight, inner ends pulled down -> a serious set
    bt = 1
    for x in range(21, 28):
        c.set(x, 27, brow, bt + (1 if x < 24 else 0))
    c.set(27, 28, brow, bt)
    c.set(28, 28, brow, bt)
    for x in range(34, 39):
        c.set(x, 27, brow, bt + 1)
    c.set(33, 28, brow, bt)
    if heavy:
        for x in range(22, 27):
            c.set(x, 26, brow, 2)
        for x in range(34, 38):
            c.set(x, 26, brow, 2)
    c.set(29, 28, skin, 1)      # frown crease
    # nose
    for y in range(29, 35):
        c.set(31, y, skin, 4 if y < 33 else 3)
        c.shift(33, y + 1, -1, only={skin})
    c.shift(32, 35, -1, only={skin})
    tipw = (31, 35) if nose != 'broad' else (30, 36)
    for x in range(tipw[0], tipw[1] + 1):
        c.set(x, 36, skin, 3)
    c.set(32, 36, skin, 4)
    c.set(tipw[1], 36, skin, 2)
    if nose == 'hooked':
        c.set(32, 32, skin, 4)
        c.set(33, 33, skin, 3)
    c.set(tipw[1] - 1, 37, skin, 0)             # nostril
    c.set(tipw[0], 37, skin, 1)
    for x in range(tipw[0], tipw[1]):
        c.shift(x, 38, -1, only={skin})
    # mouth: flat line, no smile
    for x in range(28, 35):
        c.set(x, 40, skin, 1)
    for x in range(28, 35):
        c.set(x, 41, skin, 0)
    c.set(27, 42, skin, 1)
    for x in range(30, 34):
        c.set(x, 42, skin, 3)
    for x in range(30, 33):
        c.set(x, 43, skin, 1)
    # cheekbone light
    for (x, y) in [(22, 33), (23, 33), (24, 33), (23, 34), (36, 33)]:
        c.set(x, y, skin, 4 if x < 30 else 3)
    if age >= 1:
        for (x, y) in [(29, 37), (28, 38), (28, 39), (36, 38), (36, 39),
                       (21, 30), (20, 31), (24, 32), (25, 32), (26, 32)]:
            c.set(x, y, skin, 1)
        for x in range(25, 33):
            c.shift(x, 22, -1, only={skin})
    if age >= 2:
        for (x, y) in [(25, 44), (26, 45), (24, 43), (38, 31), (38, 32), (39, 30)]:
            c.set(x, y, skin, 1)
        for x in range(26, 32):
            c.shift(x, 20, -1, only={skin})
        for x in range(30, 34):
            c.set(x, 42, skin, 2)   # thinner lips
    if scar:
        for (x, y) in [(36, 24), (36, 25), (35, 26), (35, 27), (35, 28), (34, 32), (34, 33), (33, 34)]:
            c.set(x, y, skin, 4)
        c.set(35, 27, skin, 4)


def p_token(c, x=28, y=58, cord=True, cord_from=(22, 50), cord_to=(34, 50)):
    if cord:
        for (x0, y0) in (cord_from, cord_to):
            steps = max(abs(x - x0), abs(y - 1 - y0))
            for i in range(steps + 1):
                cx = round(x0 + (x - x0) * i / steps)
                cy = round(y0 + (y - 1 - y0) * i / steps)
                c.set(cx, cy, 'leather', 1)
    c.fill(c.ell((x - 2, y - 2, x + 2, y + 2)), 'copper', sh=(x, y, 3, 3), bias=0.1)
    c.set(x, y, 'amber', 3)


def p_band(c, y0, x0, x1, rows=3, clip=None):
    for r in range(rows):
        for x in range(x0, x1 + 1):
            if clip and c.get(x, y0 + r) not in clip:
                continue
            on = (x % 4 == 2) if r != 1 else (x % 4 in (1, 3))
            if rows == 2:
                on = (x + r) % 3 == 0
            c.set(x, y0 + r, 'wool_oat' if on else 'madder', 3 if on else 2)


def p_brannock():
    c = Canvas(56, 64)
    S = 'skin_a'
    p_neck(c, S)
    p_shoulders(c, 'wool_oat')
    c.fill(c.poly([(22, 49), (34, 49), (28, 60)]), S, sh=(26, 50, 10, 14), bias=-0.2)
    for (x, y) in [(26, 53), (29, 54), (27, 56), (30, 52)]:
        c.set(x, y, 'hair_grey', 1)
    c.fill(c.poly([(12, 52), (17, 50), (21, 64), (15, 64)]), 'leather', sh=(16, 56, 6, 12), bias=0.1)
    c.fill(c.poly([(38, 50), (43, 52), (41, 64), (35, 64)]), 'leather', sh=(40, 56, 6, 12), bias=-0.1)
    c.fill(c.poly([(15, 60), (41, 60), (41, 64), (15, 64)]), 'leather', sh=(26, 66, 20, 10), bias=0.1)
    p_head(c, S, 'square')
    # fringe of grey hair at the back of the skull
    c.fill(c.poly([(15, 21), (18, 20), (20, 25), (21, 34), (19, 40), (15, 40), (14, 30)]),
           'hair_grey', sh=(18, 28, 8, 14), bias=0.15, tex=strands)
    p_ear(c, S)
    p_face(c, S, iris='iris_grey', brow='hair_grey', heavy=True, age=1, nose='broad')
    # scalp shine + soot
    for (x, y) in [(22, 15), (23, 15), (21, 16), (24, 14)]:
        c.set(x, y, S, 4)
    for (x, y) in [(31, 19), (32, 19), (33, 20), (38, 34), (37, 35)]:
        c.set(x, y, S, 1)
    # beard
    beard = c.poly([(19, 36), (22, 39), (26, 39), (29, 38), (36, 38), (40, 36), (40, 43),
                    (38, 50), (34, 55), (28, 57), (22, 54), (19, 46)])
    c.fill(beard, 'hair_grey', sh=(26, 42, 16, 16), bias=0.1, tex=vstrands)
    c.fill(c.poly([(26, 38), (37, 37), (38, 40), (33, 41), (27, 41)]), 'hair_grey', sh=(28, 36, 12, 8), bias=0.25)
    for x in range(30, 35):
        c.set(x, 42, 'hair_grey', 0)
    p_token(c, 28, 59, cord=False)
    return c


def p_edda():
    c = Canvas(56, 64)
    S = 'skin_d'
    # back hair
    c.fill(c.poly([(14, 16), (20, 12), (26, 10), (18, 30), (15, 40), (12, 36)]), 'hair_grey',
           sh=(20, 24, 10, 16), tex=strands)
    p_neck(c, S)
    p_shoulders(c, 'indigo')
    # shawl
    c.fill(c.poly([(2, 64), (4, 57), (10, 52), (20, 49), (26, 55), (30, 58), (35, 50), (45, 52), (51, 57),
                   (53, 64)]), 'wool_oat', sh=(24, 60, 28, 16), dither=0.03)
    # braids over the shoulders
    for (bx, by, n) in [(18, 40, 22), (37, 44, 18)]:
        for i in range(n):
            y = by + i
            t = 3 if (i % 3) == 0 else (2 if i % 3 == 1 else 1)
            c.set(bx, y, 'hair_grey', t)
            c.set(bx + 1, y, 'hair_grey', max(0, t - 1))
            c.set(bx - 1 if i % 3 == 0 else bx + 2, y, 'hair_grey', 1)
    p_head(c, S, 'narrow')
    # hair: centre-parted, pulled back
    c.fill(c.poly([(15, 24), (16, 16), (22, 11), (29, 9), (35, 11), (40, 17), (40, 22), (34, 19), (27, 18),
                   (21, 22), (19, 28), (17, 34), (15, 34)]), 'hair_grey', sh=(26, 20, 15, 14), bias=0.1, tex=strands)
    p_ear(c, S)
    # knot-band headband
    for x in range(16, 41):
        y = 19 + (0 if x > 24 else (1 if x > 19 else 2))
        on = x % 4 == 2
        c.set(x, y, 'wool_oat' if on else 'madder', 3 if on else 2)
        c.set(x, y + 1, 'madder', 1)
    p_face(c, S, iris='iris_grey', brow='hair_grey', age=2, nose='hooked')
    # amber beads + token
    for i, x in enumerate(range(22, 35, 2)):
        y = 53 + (3 - abs(x - 28) // 2)
        c.set(x, y, 'amber', 3 if i % 2 else 4)
        c.set(x + 1, y, 'amber', 1)
    p_token(c, 28, 59, cord=False)
    return c


def p_tavi():
    c = Canvas(56, 64)
    S = 'skin_b'
    # hood bunched behind neck
    c.fill(c.poly([(8, 50), (11, 40), (16, 35), (22, 37), (30, 41), (38, 43), (44, 48), (46, 54), (8, 56)]),
           'moss', sh=(22, 44, 20, 12), bias=0.05)
    for (x, y) in [(13, 42), (14, 44), (15, 46), (40, 47), (41, 49), (18, 40), (19, 42)]:
        c.set(x, y, 'moss', 1)   # hood folds
    p_neck(c, S)
    p_shoulders(c, 'walnut')
    # fur mantle across shoulders
    import random
    rnd = random.Random(3)
    c.fill(c.poly([(2, 60), (6, 53), (13, 50), (20, 50), (27, 56), (34, 50), (44, 51), (51, 56), (53, 62),
                   (40, 58), (28, 62), (12, 59)]), 'fur', sh=(24, 56, 28, 12),
           tex=lambda x, y, t: t - 1 if rnd.random() < 0.28 else (t + 1 if rnd.random() < 0.08 else t))
    p_head(c, S, 'narrow')
    p_ear(c, S)
    p_face(c, S, iris='iris_green', brow='hair_brown')
    # messy hair, fringe falling over the brow
    c.fill(c.poly([(13, 30), (13, 20), (18, 12), (26, 8), (34, 9), (40, 14), (42, 21), (40, 23), (38, 20),
                   (36, 23), (34, 20), (31, 24), (29, 21), (26, 25), (24, 22), (21, 26), (20, 32), (19, 37),
                   (17, 38), (16, 32)]), 'hair_brown', sh=(26, 18, 16, 14), bias=0.1, tex=strands)
    c.fill(c.poly([(19, 26), (21, 26), (21, 35), (20, 36)]), 'hair_brown', tone=1)   # sideburn
    # claw on a cord + token
    c.set(34, 56, 'bone', 3)
    c.set(35, 57, 'bone', 2)
    c.set(35, 58, 'bone', 1)
    p_token(c, 27, 58, cord=True, cord_from=(22, 50), cord_to=(33, 51))
    return c


def p_orsk():
    c = Canvas(56, 64)
    S = 'skin_c'
    p_neck(c, S)
    p_shoulders(c, 'wool_grey')
    # quilted jerkin over shirt
    c.fill(c.poly([(2, 64), (4, 57), (10, 52), (18, 50), (23, 58), (26, 64)]), 'ochre', sh=(20, 60, 24, 14),
           tex=lambda x, y, t: t - 1 if (x + y) % 5 == 0 or (x - y) % 5 == 0 else t)
    c.fill(c.poly([(30, 64), (33, 58), (38, 50), (45, 52), (51, 57), (53, 64)]), 'ochre', sh=(28, 60, 26, 14),
           tex=lambda x, y, t: t - 1 if (x + y) % 5 == 0 or (x - y) % 5 == 0 else t)
    p_band(c, 61, 3, 26, rows=2, clip={'ochre'})
    p_band(c, 61, 30, 53, rows=2, clip={'ochre'})
    p_head(c, S, 'square')
    p_ear(c, S)
    p_face(c, S, iris='iris_brown', brow='hair_black', heavy=True, nose='broad')
    # short black beard
    beard = c.poly([(18, 33), (21, 38), (27, 40), (37, 39), (40, 35), (40, 42), (37, 47), (32, 50), (25, 49),
                    (20, 45), (17, 38)])
    c.fill(beard, 'hair_black', sh=(26, 40, 16, 14), bias=0.2, tex=vstrands)
    for x in range(29, 34):
        c.set(x, 41, 'skin_c', 0)
    for x in range(30, 33):
        c.set(x, 42, 'skin_c', 3)
    # dirt
    for (x, y) in [(24, 24), (25, 25), (37, 26), (22, 35)]:
        c.set(x, y, S, 1)
    # leather candle cap
    c.fill(c.poly([(14, 24), (15, 15), (20, 10), (28, 8), (35, 9), (40, 14), (41, 22), (15, 24)]), 'leather',
           sh=(26, 16, 16, 12), bias=0.1)
    c.fill(c.poly([(12, 22), (44, 21), (47, 23), (44, 25), (14, 25)]), 'leather', sh=(30, 20, 20, 8), bias=-0.1)
    for x in range(18, 40, 3):
        c.set(x, 17, 'leather', 1)
    c.fill(c.poly([(24, 7), (31, 7), (31, 9), (24, 9)]), 'copper', sh=(26, 6, 6, 4))
    c.fill(c.poly([(26, 1), (29, 1), (29, 6), (26, 6)]), 'wax', sh=(26, 2, 4, 6), bias=0.1)
    for (x, y, t) in [(27, 0, 4), (28, 0, 3), (27, 1, 3)]:
        c.set(x, y, 'flame', t)
    p_token(c, 28, 57, cord=True, cord_from=(24, 50), cord_to=(32, 50))
    return c


def p_maren():
    c = Canvas(56, 64)
    S = 'skin_c'
    # wrap knot at the back
    c.fill(c.ell((7, 20, 20, 34)), 'wool_oat', sh=(12, 25, 8, 8))
    c.fill(c.poly([(10, 32), (14, 32), (13, 46), (9, 44)]), 'wool_oat', sh=(10, 36, 6, 10), bias=-0.1)
    p_neck(c, S)
    p_shoulders(c, 'moss')
    # square neckline edged with the knot band
    c.fill(c.poly([(20, 49), (36, 49), (36, 55), (20, 55)]), S, sh=(26, 50, 12, 10), bias=-0.25)
    p_band(c, 55, 17, 39, rows=3)
    c.fill(c.poly([(10, 52), (16, 50), (18, 64), (12, 64)]), 'wool_oat', sh=(14, 56, 6, 12))
    c.fill(c.poly([(40, 50), (46, 52), (44, 64), (38, 64)]), 'wool_oat', sh=(42, 56, 6, 12), bias=-0.1)
    p_head(c, S, 'narrow')
    p_ear(c, S)
    p_face(c, S, iris='iris_brown', brow='hair_black')
    c.set(16, 38, 'copper', 4)
    c.set(16, 39, 'copper', 2)
    # head wrap
    c.fill(c.poly([(14, 30), (14, 18), (19, 11), (27, 8), (35, 9), (40, 14), (41, 22), (35, 21), (26, 21),
                   (20, 24), (19, 29), (17, 30)]), 'wool_oat', sh=(26, 16, 16, 12), bias=0.05,
           tex=lambda x, y, t: t - 1 if (x - 2 * y) % 7 == 0 else t)
    for x in range(19, 42):
        y = 20 if x > 26 else 21 + (1 if x < 22 else 0)
        c.set(x, y, 'madder', 2)
        c.set(x, y - 1, 'madder', 3 if x % 3 else 1)
    c.fill(c.poly([(21, 55), (24, 55), (24, 56)]), 'copper', tone=3)
    p_token(c, 28, 52, cord=False)
    return c


def p_holt():
    c = Canvas(56, 64)
    S = 'skin_e'
    # queue of hair behind
    c.fill(c.poly([(12, 26), (17, 26), (16, 46), (12, 48)]), 'hair_black', sh=(14, 34, 5, 14), tex=strands)
    p_neck(c, S)
    p_shoulders(c, 'wool_grey', tex=lambda x, y, t: t - 1 if x % 4 == 0 else t)
    # madder mantle with knot-band edge
    c.fill(c.poly([(2, 60), (5, 54), (12, 50), (20, 49), (36, 49), (44, 51), (51, 55), (53, 60), (28, 58)]),
           'madder', sh=(24, 56, 28, 12), dither=0.03)
    for x in range(3, 54):
        y = 58 - round(abs(x - 28) * 0.1)
        for yy in (y, y + 1):
            if c.get(x, yy) is not None:
                on = x % 4 == 2 if yy == y else x % 4 in (1, 3)
                c.set(x, yy, 'wool_oat' if on else 'madder', 3 if on else 1)
    c.fill(c.ell((38, 51, 43, 56)), 'copper', sh=(40, 53, 3, 3))
    c.set(40, 53, 'amber', 3)
    p_head(c, S, 'square')
    p_ear(c, S)
    p_face(c, S, iris='iris_brown', brow='hair_black', heavy=True, age=1, nose='hooked', scar=True)
    # long moustache + short chin beard
    c.fill(c.poly([(26, 38), (37, 37), (38, 40), (37, 46), (35, 47), (35, 41), (29, 41), (27, 45), (25, 44)]),
           'hair_black', sh=(30, 36, 10, 10), bias=0.3)
    c.fill(c.poly([(30, 44), (35, 44), (34, 49), (31, 49)]), 'hair_black', sh=(30, 44, 6, 6), bias=0.2,
           tex=vstrands)
    # fur-banded cap
    c.fill(c.poly([(16, 20), (18, 12), (24, 7), (31, 6), (37, 9), (40, 16), (40, 20)]), 'indigo',
           sh=(26, 12, 14, 10), bias=0.1)
    import random
    rnd = random.Random(7)
    c.fill(c.poly([(13, 26), (14, 18), (27, 17), (41, 17), (43, 23), (28, 24), (20, 26)]), 'fur',
           sh=(26, 18, 18, 8), bias=0.1,
           tex=lambda x, y, t: t - 1 if rnd.random() < 0.3 else (t + 1 if rnd.random() < 0.1 else t))
    return c


VILLAGERS = [
    dict(key='brannock', name='BRANNOCK', role='FORGEWRIGHT', sprite=sp_brannock, portrait=p_brannock,
         plate='5a3a2a', mats=['wool_oat', 'leather', 'walnut', 'madder', 'hair_grey', 'skin_a'],
         lines=['DAWN  STOKE THE FORGE', 'DAY   HAMMER, QUENCH', 'DUSK  ALE AT THE HEARTH',
                'IF STRUCK: FIGHTS']),
    dict(key='edda', name='EDDA', role='HEARTH-ELDER', sprite=sp_edda, portrait=p_edda,
         plate='3a3548', mats=['indigo', 'wool_oat', 'madder', 'amber', 'hair_grey', 'skin_d'],
         lines=['DAWN  TEND THE FIRE', 'DAY   COOK, COUNSEL', 'DUSK  TELL OLD STORIES',
                'IF STRUCK: CALLS WARDEN']),
    dict(key='tavi', name='TAVI', role='FORAGER', sprite=sp_tavi, portrait=p_tavi,
         plate='343d2c', mats=['moss', 'fur', 'walnut', 'wool_grey', 'hair_brown', 'skin_b'],
         lines=['DAWN  CHECK SNARES', 'DAY   ROAM THE SURFACE', 'DUSK  SORT HERBS',
                'IF STRUCK: BOW, KEEPS AWAY']),
    dict(key='orsk', name='ORSK', role='DIGGER', sprite=sp_orsk, portrait=p_orsk,
         plate='4a3c24', mats=['ochre', 'wool_grey', 'walnut', 'leather', 'hair_black', 'skin_c'],
         lines=['DAWN  LIGHT CANDLE, DESCEND', 'DAY   DIG, SHORE UP', 'DUSK  CLIMB OUT, WASH',
                'IF STRUCK: SWINGS PICK']),
    dict(key='maren', name='MAREN', role='DYER-WEAVER', sprite=sp_maren, portrait=p_maren,
         plate='44302c', mats=['moss', 'wool_oat', 'madder', 'indigo', 'ochre', 'skin_c'],
         lines=['DAWN  FETCH WATER', 'DAY   DYE VATS, LOOM', 'DUSK  MEND CLOTHES',
                'IF STRUCK: FLEES, HIDES']),
    dict(key='holt', name='HOLT', role='WARDEN', sprite=sp_holt, portrait=p_holt,
         plate='2c3340', mats=['madder', 'wool_grey', 'indigo', 'fur', 'hair_black', 'skin_e'],
         lines=['DAWN  WALK THE RIDGE', 'DAY   WATCH THE STAIR', 'NIGHT LANTERN ROUNDS',
                'IF STRUCK: FIGHTS, RALLIES']),
]
