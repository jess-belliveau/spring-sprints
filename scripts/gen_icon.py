#!/usr/bin/env python3
"""
Generate Sprint Series app icon and write build/icon.icns.
Produces two concentric racing arcs (left lane red, right lane blue)
with glowing leader dots — mirrors the in-app track display.
"""

from PIL import Image, ImageDraw, ImageFilter
import math, struct, io, os

# ── Design constants ──────────────────────────────────────────────────────────
SIZE    = 1024
CX = CY = SIZE // 2

BG_COLOR    = (14, 9,  5,  255)   # near-black warm
TRACK_BG    = (30, 20, 12, 255)   # dark warm groove
RIGHT_COLOR = (96, 165, 250, 255) # blue-400  (right lane)
LEFT_COLOR  = (239, 68,  68, 255) # red-500   (left lane)
ACCENT      = (245, 158, 11, 255) # amber-500 (accent)

OUTER_R, OUTER_S = 405, 72   # right-lane ring: centre-radius, stroke
INNER_R, INNER_S = 285, 62   # left-lane ring

RIGHT_SPAN = 262   # degrees of arc for right (blue, leading)
LEFT_SPAN  = 218   # degrees of arc for left  (red,  trailing)

# ── Helpers ───────────────────────────────────────────────────────────────────

def annular_arc_mask(size, cx, cy, outer_r, inner_r, start_deg, span_deg):
    """Return an 'L' mask for a thick arc (annular sector)."""
    end_deg = start_deg + span_deg

    # Full donut ring
    donut = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(donut)
    d.ellipse([cx-outer_r, cy-outer_r, cx+outer_r, cy+outer_r], fill=255)
    d.ellipse([cx-inner_r, cy-inner_r, cx+inner_r, cy+inner_r], fill=0)

    # Sector (pie slice at outer radius)
    sector = Image.new('L', (size, size), 0)
    d2 = ImageDraw.Draw(sector)
    d2.pieslice([cx-outer_r, cy-outer_r, cx+outer_r, cy+outer_r],
                start_deg, end_deg, fill=255)

    # Intersection = annular arc
    from PIL import ImageChops
    return ImageChops.multiply(donut, sector)


def full_ring_mask(size, cx, cy, outer_r, inner_r):
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([cx-outer_r, cy-outer_r, cx+outer_r, cy+outer_r], fill=255)
    d.ellipse([cx-inner_r, cy-inner_r, cx+inner_r, cy+inner_r], fill=0)
    return m


def arc_tip(cx, cy, r, start_deg, span_deg):
    """Screen coordinates of the leading tip of an arc."""
    angle = math.radians(start_deg + span_deg)
    return cx + r * math.cos(angle), cy + r * math.sin(angle)


def paste_colored(img, mask, color):
    layer = Image.new('RGBA', img.size, color)
    img.paste(layer, mask=mask)


def draw_glow(img, x, y, radius, color, alpha=70):
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse([x-radius, y-radius, x+radius, y+radius],
              fill=(color[0], color[1], color[2], alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(radius * 0.55))
    return Image.alpha_composite(img, glow)


def draw_dot(img, x, y, radius, color):
    d = ImageDraw.Draw(img)
    d.ellipse([x-radius, y-radius, x+radius, y+radius], fill=color)


# ── Render 1024×1024 icon ─────────────────────────────────────────────────────

def render(size=1024):
    scale = size / SIZE
    s = lambda v: int(v * scale)

    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    cx = cy = size // 2
    outer_r, outer_s = s(OUTER_R), s(OUTER_S)
    inner_r, inner_s = s(INNER_R), s(INNER_S)

    # Background
    bg = Image.new('RGBA', (size, size), BG_COLOR)
    img = Image.alpha_composite(img, bg)

    # Subtle radial centre glow (makes it feel lit from within)
    centre_glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(centre_glow)
    gr = s(240)
    d.ellipse([cx-gr, cy-gr, cx+gr, cy+gr], fill=(60, 35, 15, 55))
    centre_glow = centre_glow.filter(ImageFilter.GaussianBlur(s(80)))
    img = Image.alpha_composite(img, centre_glow)

    # Track grooves (full rings)
    ring_outer = full_ring_mask(size, cx, cy, outer_r + outer_s//2, outer_r - outer_s//2)
    ring_inner = full_ring_mask(size, cx, cy, inner_r + inner_s//2, inner_r - inner_s//2)
    paste_colored(img, ring_outer, TRACK_BG)
    paste_colored(img, ring_inner, TRACK_BG)

    # Right arc (blue, outer, leading)
    right_mask = annular_arc_mask(size, cx, cy,
                                  outer_r + outer_s//2, outer_r - outer_s//2,
                                  -90, RIGHT_SPAN)
    paste_colored(img, right_mask, RIGHT_COLOR)

    # Left arc (red, inner, trailing)
    left_mask = annular_arc_mask(size, cx, cy,
                                 inner_r + inner_s//2, inner_r - inner_s//2,
                                 -90, LEFT_SPAN)
    paste_colored(img, left_mask, LEFT_COLOR)

    # Leader dots
    rx, ry = arc_tip(cx, cy, outer_r, -90, RIGHT_SPAN)
    lx, ly = arc_tip(cx, cy, inner_r, -90, LEFT_SPAN)

    img = draw_glow(img, rx, ry, s(90), RIGHT_COLOR, alpha=90)
    img = draw_glow(img, lx, ly, s(75), LEFT_COLOR,  alpha=80)
    draw_dot(img, rx, ry, s(46), RIGHT_COLOR)
    draw_dot(img, lx, ly, s(38), LEFT_COLOR)

    # Small accent start-line notch at 12-o'clock on both rings
    d = ImageDraw.Draw(img)
    notch_w = s(6)
    for r_val, s_val in [(outer_r, outer_s), (inner_r, inner_s)]:
        top_x = cx
        top_y = cy - r_val
        d.rectangle([top_x - notch_w//2, top_y - s_val//2,
                     top_x + notch_w//2, top_y + s_val//2],
                    fill=ACCENT)

    return img


# ── ICNS writer ───────────────────────────────────────────────────────────────

ICNS_TYPES = [
    ('icp4', 16),
    ('icp5', 32),
    ('icp6', 64),
    ('ic07', 128),
    ('ic08', 256),
    ('ic09', 512),
    ('ic10', 1024),
]

def make_icns(master_img, out_path):
    chunks = []
    for type_code, px in ICNS_TYPES:
        img = master_img.copy()
        if px != master_img.width:
            img = img.resize((px, px), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        png_data = buf.getvalue()
        header = type_code.encode('ascii') + struct.pack('>I', len(png_data) + 8)
        chunks.append(header + png_data)

    body = b''.join(chunks)
    total = 8 + len(body)
    with open(out_path, 'wb') as f:
        f.write(b'icns' + struct.pack('>I', total) + body)
    print(f'Written {out_path} ({total:,} bytes)')


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    os.makedirs('build', exist_ok=True)
    master = render(1024)
    make_icns(master, 'build/icon.icns')
    master.save('build/icon.png')
    print('Done.')
