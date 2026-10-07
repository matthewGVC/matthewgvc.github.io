"""Draw a phone playing one of our films, lying on a mockup's grey surface.

Made for the NJ seller pitch's Marketing page (assets/img/nj/marketing-mockup.jpg):
the phone was laid into Matt's brochure mockup ("Magazine 4.jpg") beside the
magazines. The frame is 18.2s into "14 Ridge (no music).mov" (the Ridge Road
Short) on the GVC - Videos Photos drive:

    ffmpeg -ss 18.2 -i "14 Ridge (no music).mov" -frames:v 1 -q:v 2 frame.jpg
    set BG=wide-bg.png & set CROP=217,360,5063,2700 & set AT=3610,1560 & set OUTMAX=2600
    python scripts/phone_mockup.py frame.jpg assets/img/nj/marketing-mockup.jpg 16 1100

wide-bg.png is Magazine 4.jpg with the "New Jersey, Red Bank 07***" line
blurred and 900px of its surface mirrored onto the right edge (numpy.pad,
mode='reflect') so the scene can run the full page width.

Args: frame, output, angle (degrees, + = counter-clockwise), phone height (px).
Without BG it draws its own grey surface, 2480x2640, phone centred.
BG/CROP/AT: background image, crop box on it, phone centre in crop pixels.
Needs Pillow and numpy.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

frame_path, out_path = sys.argv[1], sys.argv[2]
ANGLE = float(sys.argv[3]) if len(sys.argv) > 3 else -18   # degrees, + = counter-clockwise
PH = int(sys.argv[4]) if len(sys.argv) > 4 else 1950        # phone body height (px)

W, H = 2480, 2640           # same pixel box as the magazine crops
rng = np.random.default_rng(7)

# --- surface: neutral grey, lighter toward the top-right, fine grain ---------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
grad = 138 + 22 * ((xx / W) * 0.55 + (1 - yy / H) * 0.45)
noise = rng.normal(0, 8, (H, W)).astype(np.float32)
noise = (np.array(Image.fromarray(np.clip(noise * 4 + 128, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float32) - 128) / 4 * 1.6
bg = np.clip(grad + noise, 0, 255).astype(np.uint8)
bg = Image.fromarray(bg).convert('RGB')

# --- the phone, drawn upright then rotated -----------------------------------
PW = int(PH / 2.05)                     # modern phone proportions
R = int(PW * 0.15)                      # corner radius
BEZ = int(PW * 0.035)                   # black border round the screen
pad = 200
S = Image.new('RGBA', (PW + 2 * pad, PH + 2 * pad), (0, 0, 0, 0))
d = ImageDraw.Draw(S)
ox, oy = pad, pad
# frame edge (titanium) and body
d.rounded_rectangle((ox, oy, ox + PW, oy + PH), R, fill=(58, 60, 64, 255))
d.rounded_rectangle((ox + 6, oy + 6, ox + PW - 6, oy + PH - 6), R - 6, fill=(18, 18, 20, 255))
# screen
sx0, sy0, sx1, sy1 = ox + BEZ, oy + BEZ, ox + PW - BEZ, oy + PH - BEZ
sw, sh = sx1 - sx0, sy1 - sy0
fr = Image.open(frame_path).convert('RGB')
# cover-fit the 9:16 frame into the taller screen (crops the sides)
sc = max(sw / fr.width, sh / fr.height)
fr = fr.resize((round(fr.width * sc), round(fr.height * sc)), Image.LANCZOS)
fx, fy = (fr.width - sw) // 2, (fr.height - sh) // 2
fr = fr.crop((fx, fy, fx + sw, fy + sh))
mask = Image.new('L', (sw, sh), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), R - BEZ, fill=255)

# player chrome: a soft darkening at the foot, progress bar, play button
ov = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
od = ImageDraw.Draw(ov)
for i in range(int(sh * 0.22)):          # bottom scrim
    a = int(150 * (i / (sh * 0.22)) ** 1.6)
    od.line((0, sh - 1 - int(sh * 0.22) + i, sw, sh - 1 - int(sh * 0.22) + i), fill=(0, 0, 0, a))
bx0, bx1, by = int(sw * 0.07), int(sw * 0.93), int(sh * 0.935)
bt = max(6, sw // 120)
od.rounded_rectangle((bx0, by - bt // 2, bx1, by + bt // 2), bt // 2, fill=(255, 255, 255, 90))
px = bx0 + int((bx1 - bx0) * 0.38)
od.rounded_rectangle((bx0, by - bt // 2, px, by + bt // 2), bt // 2, fill=(255, 255, 255, 235))
od.ellipse((px - bt * 1.6, by - bt * 1.6, px + bt * 1.6, by + bt * 1.6), fill=(255, 255, 255, 255))
cr = int(sw * 0.13)                       # play button
cx, cy = sw // 2, sh // 2
od.ellipse((cx - cr, cy - cr, cx + cr, cy + cr), fill=(0, 0, 0, 95), outline=(255, 255, 255, 215), width=max(4, cr // 18))
t = cr * 0.42
od.polygon([(cx - t * 0.7, cy - t), (cx - t * 0.7, cy + t), (cx + t * 1.0, cy)], fill=(255, 255, 255, 240))
scr = fr.convert('RGBA')
scr.alpha_composite(ov)
# dynamic island
ImageDraw.Draw(scr).rounded_rectangle((sw * 0.36, sh * 0.018, sw * 0.64, sh * 0.018 + sw * 0.085),
                                      int(sw * 0.0425), fill=(0, 0, 0, 255))
S.paste(scr, (sx0, sy0), mask)
# glass sheen: faint diagonal highlight across the top of the screen
sheen = Image.new('L', (sw, sh), 0)
sd = ImageDraw.Draw(sheen)
sd.polygon([(0, 0), (sw * 0.75, 0), (0, sh * 0.5)], fill=26)
sheen = sheen.filter(ImageFilter.GaussianBlur(sw * 0.08))
sheen = Image.composite(sheen, Image.new('L', (sw, sh), 0), mask)
white = Image.new('RGBA', (sw, sh), (255, 255, 255, 0)); white.putalpha(sheen)
S.alpha_composite(white, (sx0, sy0))
# side buttons
d = ImageDraw.Draw(S)
for y0, y1 in ((0.20, 0.25), (0.28, 0.36), (0.38, 0.46)):
    d.rounded_rectangle((ox - 7, oy + PH * y0, ox + 2, oy + PH * y1), 4, fill=(48, 50, 54, 255))
d.rounded_rectangle((ox + PW - 2, oy + PH * 0.27, ox + PW + 7, oy + PH * 0.40), 4, fill=(48, 50, 54, 255))

phone = S.rotate(ANGLE, resample=Image.BICUBIC, expand=True)
import os
if os.environ.get('BG'):
    full = Image.open(os.environ['BG']).convert('RGB')
    bx = [int(v) for v in os.environ['CROP'].split(',')]
    bg = full.crop(bx); W, H = bg.size
    CX, CY = [int(v) for v in os.environ['AT'].split(',')]   # phone centre, in crop pixels
else:
    CX, CY = W // 2, H // 2

# --- shadow: tight contact shadow + wide soft one, falling toward bottom-left -
alpha = phone.split()[3]
def shadow(blur, dx, dy, strength):
    a = alpha.point(lambda v: int(v * strength)).filter(ImageFilter.GaussianBlur(blur))
    return a, dx, dy
cx0 = CX - phone.width // 2
cy0 = CY - phone.height // 2
for blur, dx, dy, st in ((70, -45, 70, 0.45), (14, -10, 16, 0.55)):
    a, ddx, ddy = shadow(blur, dx, dy, st)
    black = Image.new('RGB', phone.size, (20, 20, 20))
    bg.paste(black, (cx0 + ddx, cy0 + ddy), a)
bg.paste(phone, (cx0, cy0), phone)

bg.thumbnail((int(os.environ.get('OUTMAX', 1800)),) * 2, Image.LANCZOS)
bg.save(out_path, quality=86, optimize=True, progressive=True)
print(out_path, bg.size)
