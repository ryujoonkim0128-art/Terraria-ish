"""Tiny pixel-art engine used to generate the villager mockups.

A Canvas stores a material name and a tone index per pixel. Materials map to
5-step colour ramps (deep, dark, mid, light, highlight). Tones can be set
explicitly, computed from a sphere-normal light model, or left as None for an
automatic edge-based shade. Rendering adds a selective (colour-tinted) outline.
"""
import math

from PIL import Image, ImageDraw


def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ramp(*cols):
    return [hx(c) for c in cols]


# Muted, earthy palette. Every ramp: deep, dark, mid, light, highlight.
RAMPS = {
    # skin
    'skin_a': ramp('3b2420', '6e4033', '9c6450', 'bf8a6c', 'd6a888'),  # ruddy, weathered
    'skin_b': ramp('33241c', '5e4130', '87603f', 'a98159', 'c19c72'),  # olive
    'skin_c': ramp('22150f', '3e271c', '5c3a28', '7a5136', '93683f'),  # deep brown
    'skin_d': ramp('45302c', '7d5a4f', 'a8816f', 'c8a38c', 'dcbda2'),  # pale, aged
    'skin_e': ramp('382219', '66402f', '916147', 'b07c5c', 'c79777'),  # tan
    # hair
    'hair_grey': ramp('2e2c2c', '4d4a48', '736d68', '9a928a', 'bab1a6'),
    'hair_black': ramp('110e0e', '1e1917', '2e2522', '413630', '54463c'),
    'hair_brown': ramp('1f140f', '36231a', '523628', '6c4a34', '836043'),
    # cloth / materials
    'wool_oat': ramp('3a342c', '5e5546', '857a64', 'a89c82', 'c1b59a'),
    'wool_grey': ramp('26282b', '3c3f43', '55595c', '717473', '8c8e8a'),
    'madder': ramp('2e1514', '4d2320', '6d3328', '8a4632', 'a15c40'),
    'moss': ramp('1b2019', '2c3426', '424c35', '5b6546', '747d58'),
    'indigo': ramp('171a26', '252b3c', '363e53', '4b546a', '626b7e'),
    'walnut': ramp('21170f', '36261a', '503826', '6a4c33', '836243'),
    'ochre': ramp('3a2c14', '5c4721', '7f6532', '9c7f43', 'b39756'),
    'leather': ramp('22170f', '3b2718', '5a3c24', '785233', '916a44'),
    'fur': ramp('2f2820', '4d4337', '6f6352', '90836d', 'ab9f87'),
    'copper': ramp('2e1810', '5c301b', '8e4e2a', 'b87342', 'd89a62'),
    'amber': ramp('4a220a', '7e4410', 'b06e1c', 'd89a36', 'f0c46a'),
    'iron': ramp('1f2023', '3a3c40', '5a5d61', '80837f', 'a5a79f'),
    'wood': ramp('261a11', '3f2c1d', '5c432d', '7a5b3e', '94744f'),
    'wax': ramp('5c5446', '8a8068', 'b5aa8c', 'd4caa9', 'e8e0c2'),
    'flame': ramp('7a2c0c', 'b8561a', 'e08a2a', 'f2b84a', 'fbe39a'),
    'bone': ramp('4a4234', '7a6f58', 'a89c80', 'c8bda0', 'ddd3b8'),
    # single-colour feature materials
    'eye': ramp('1a1412', '1a1412', '1a1412', '1a1412', '1a1412'),
    'lash': ramp('1c1310', '1c1310', '1c1310', '1c1310', '1c1310'),
    'sclera': ramp('7d7266', '958a7c', 'aea293', 'bdb2a2', 'c9bfae'),
    'iris_brown': ramp('24170f', '3d271a', '563a26', '6e4c32', '84603f'),
    'iris_grey': ramp('252a2c', '3c4548', '566266', '6f7c7e', '8a9594'),
    'iris_green': ramp('20241a', '343b28', '4b5538', '626d48', '7a8558'),
}

OUTLINE_TINT = (14, 11, 16)
LIGHT = (lambda v: tuple(c / math.sqrt(sum(k * k for k in v)) for c in v))((-0.5, -0.55, 0.67))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sphere_tone(x, y, cx, cy, rx, ry, bias=0.0, dither=0.0):
    nx = (x + 0.5 - cx) / rx
    ny = (y + 0.5 - cy) / ry
    r2 = nx * nx + ny * ny
    if r2 >= 1:
        k = 1 / math.sqrt(r2)
        nx, ny, nz = nx * k, ny * k, 0.0
    else:
        nz = math.sqrt(1 - r2)
    d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + bias
    if dither:
        d += dither if (x + y) % 2 else -dither
    return sum(d > t for t in (-0.1, 0.25, 0.55, 0.84))


class Canvas:
    def __init__(self, w, h, oy=0):
        self.w, self.h = w, h
        self.ox, self.oy = 0, oy
        self.m = [[None] * w for _ in range(h)]
        self.t = [[None] * w for _ in range(h)]

    def inb(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    # --- offset-aware primitives (used for sprites) ---
    def px(self, x, y, m, t=None):
        x += self.ox
        y += self.oy
        if self.inb(x, y):
            self.m[y][x] = m
            self.t[y][x] = t

    def rect(self, x0, y0, x1, y1, m, t=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, m, t)

    def pts(self, points, m, t=None):
        for x, y in points:
            self.px(x, y, m, t)

    def band(self, y0, x0, x1, base='madder', thread='wool_oat', rows=2):
        """The village's woven 'knot band' motif (sashes, hems, headbands)."""
        for r in range(rows):
            for x in range(x0, x1 + 1):
                if rows == 3:
                    on = (x % 4 == 2) if r != 1 else (x % 4 in (1, 3))
                else:
                    on = (x + r) % 3 == 0
                self.px(x, y0 + r, thread if on else base, 3 if on else (2 if r == 0 else 1))

    # --- absolute primitives (used for portraits) ---
    def get(self, x, y):
        return self.m[y][x] if self.inb(x, y) else None

    def gt(self, x, y):
        return self.t[y][x] if self.inb(x, y) else None

    def set(self, x, y, m, t=None):
        if self.inb(x, y):
            self.m[y][x] = m
            self.t[y][x] = t

    def shift(self, x, y, d, only=None):
        if self.inb(x, y) and self.m[y][x] and (only is None or self.m[y][x] in only):
            t = self.t[y][x]
            t = 2 if t is None else t
            self.t[y][x] = max(0, min(4, t + d))

    def fill(self, mask, m, sh=None, bias=0.0, dither=0.0, tone=None, tex=None):
        pm = mask.load()
        for y in range(self.h):
            for x in range(self.w):
                if pm[x, y] > 127:
                    if tone is not None:
                        t = tone
                    elif sh:
                        t = sphere_tone(x, y, *sh, bias=bias, dither=dither)
                    else:
                        t = None
                    if tex and t is not None:
                        t = max(0, min(4, tex(x, y, t)))
                    self.set(x, y, m, t)

    def poly(self, points):
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).polygon(points, fill=255)
        return im

    def ell(self, box):
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).ellipse(box, fill=255)
        return im

    # --- rendering ---
    def auto_tone(self, x, y):
        m = self.m[y][x]
        r, l, u = self.get(x + 1, y), self.get(x - 1, y), self.get(x, y - 1)
        if r != m:
            return 1
        if u != m:
            return 1 if u is not None else 3
        if l is None:
            return 3
        return 2

    def render(self, outline=True):
        img = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        P = img.load()
        for y in range(self.h):
            for x in range(self.w):
                m = self.m[y][x]
                if m is None:
                    continue
                t = self.t[y][x]
                if t is None:
                    t = self.auto_tone(x, y)
                r = RAMPS[m]
                P[x, y] = r[max(0, min(len(r) - 1, t))] + (255,)
        if outline:
            for y in range(self.h):
                for x in range(self.w):
                    if self.m[y][x] is not None:
                        continue
                    best = None
                    for dx, dy in ((0, 1), (-1, 0), (1, 0), (0, -1)):
                        nm = self.get(x + dx, y + dy)
                        if nm:
                            c = RAMPS[nm][0]
                            if best is None or sum(c) < sum(best):
                                best = c
                    if best:
                        P[x, y] = mix(best, OUTLINE_TINT, 0.55) + (255,)
        return img


# --- 3x5 pixel font -------------------------------------------------------
_F = {
    'A': '.#.#.#####.##.#',
    'B': '##.#.###.#.###.',
    'C': '.###..#..#...##',
    'D': '##.#.##.##.###.',
    'E': '####..##.#..###',
    'F': '####..##.#..#..',
    'G': '.###..#.##.#.##',
    'H': '#.##.#####.##.#',
    'I': '###.#..#..#.###',
    'J': '..#..#..##.#.#.',
    'K': '#.##.###.#.##.#',
    'L': '#..#..#..#..###',
    'M': '#.########.##.#',
    'N': '##.#.##.##.##.#',
    'O': '.#.#.##.##.#.#.',
    'P': '##.#.###.#..#..',
    'Q': '.#.#.##.###..##',
    'R': '##.#.###.#.##.#',
    'S': '.###...#...###.',
    'T': '###.#..#..#..#.',
    'U': '#.##.##.##.####',
    'V': '#.##.##.##.#.#.',
    'W': '#.##.########.#',
    'X': '#.##.#.#.#.##.#',
    'Y': '#.##.#.#..#..#.',
    'Z': '###..#.#.#..###',
    '0': '####.##.##.####',
    '1': '.#.##..#..#.###',
    '2': '##...#.#.#..###',
    '3': '##...#.#...###.',
    '4': '#.##.####..#..#',
    '5': '####..##...###.',
    '6': '.###..####.####',
    '7': '###..#.#..#..#.',
    '8': '####.#####.####',
    '9': '####.####..###.',
    '-': '......###......',
    '.': '.............#.',
    ',': '..........#.#..',
    ':': '....#.....#....',
    '/': '..#..#.#.#..#..',
    "'": '.#..#..........',
    '(': '.#.#..#..#...#.',
    ')': '.#...#..#..#.#.',
    ' ': '...............',
    '+': '....#.###.#....',
    '&': '.#.#.#.#.#.#.##',
}


def text(img, x, y, s, col):
    P = img.load()
    cx = x
    for ch in s.upper():
        g = _F.get(ch, _F[' '])
        for i, b in enumerate(g):
            if b == '#':
                px, py = cx + i % 3, y + i // 3
                if 0 <= px < img.width and 0 <= py < img.height:
                    P[px, py] = col + (255,) if len(col) == 3 else col
        cx += 4
    return cx


def text_w(s):
    return len(s) * 4 - 1
