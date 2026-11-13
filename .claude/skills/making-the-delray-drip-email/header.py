"""Draw the "How's the Market?" banner for the Delray Drip email.

    python .claude/skills/making-the-delray-drip-email/header.py <out.png> \
        --sold 1015 --sold-prev 1005 --days 60 --days-prev 55 \
        --rate 7.60 --rate-prev 6.87 --compared "September 2026"

Matches the banner Matt made by hand through October 2026: 1200 x 486, navy ground, three
figures, each with an arrow and last month's figure. The arrow points the way the figure moved.
Green is good news for a buyer or seller reading it: more sales, fewer days on market, lower
rates. Red is the opposite. A figure that did not move gets a grey dash.
"""
import argparse, os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
S = 3                      # draw at three times the size, then shrink: smooth edges
W, H = 1200, 486
NAVY, WHITE = (0, 39, 58), (255, 255, 255)
GREEN, RED, GREY = (2, 84, 45), (144, 11, 9), (159, 174, 181)
COLS = (262, 600, 940)     # centre of each figure


def font(name, size, weight=None):
    f = ImageFont.truetype(os.path.join(HERE, "fonts", name), int(size * S))
    if weight:
        f.set_variation_by_axes([weight])
    return f


def centred(d, x, y, text, f, fill=WHITE, tracking=0):
    """Text centred on x with its baseline at y."""
    if tracking:
        widths = [d.textlength(c, font=f) + tracking * S for c in text]
        cx = x * S - (sum(widths) - tracking * S) / 2
        for c, w in zip(text, widths):
            d.text((cx, y * S), c, font=f, fill=fill, anchor="ls")
            cx += w
        return sum(widths) / S
    d.text((x * S, y * S), text, font=f, fill=fill, anchor="ms")
    return d.textlength(text, font=f) / S


def arrow(d, x, y, up, colour):
    """The zig-zag trend arrow, about 76 wide and 46 tall, centred on x, y."""
    pts = [(-36, 20), (-12, -4), (4, 12), (34, -18)]
    if not up:
        pts = [(px, -py) for px, py in pts]
    P = [((x + px) * S, (y + py) * S) for px, py in pts]
    d.line(P, fill=colour, width=8 * S, joint="curve")
    tx, ty = pts[-1]
    s = -1 if up else 1                       # the head: two short strokes back from the tip
    for hx, hy in ((tx - 22, ty), (tx, ty - 22 * s)):
        d.line([((x + tx + 3) * S, (y + ty + 3 * s) * S), ((x + hx) * S, (y + hy + 3 * s * (hy == ty)) * S)],
               fill=colour, width=8 * S)


def fmt(v, places):
    return "{:,.{p}f}".format(v, p=places)


def change(now, prev):
    pct = (now - prev) / prev * 100 if prev else 0
    return "%+.2f%%" % pct, pct


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    for k in ("sold", "days", "rate"):
        ap.add_argument("--" + k, type=float, required=True)
        ap.add_argument("--%s-prev" % k, type=float, required=True)
    ap.add_argument("--compared", required=True, help='e.g. "October 2026"')
    ap.add_argument("--area", default="Palm Beach County")
    a = ap.parse_args()

    im = Image.new("RGB", (W * S, H * S), NAVY)
    d = ImageDraw.Draw(im)
    display = lambda size: font("DMSerifDisplay-Regular.ttf", size)
    text = lambda size: font("Lora.ttf", size, 400)

    centred(d, 600, 102, "How’s the Market?", display(45))
    # (figure, last month's, decimals, label, True when a rise is good news)
    figures = [(a.sold, a.sold_prev, 0, "Sold & Closed", True),
               (a.days, a.days_prev, 0, "Average Days on Market", False),
               (a.rate, a.rate_prev, 2, "Interest Rates (%)", False)]
    edges = []
    for x, (now, prev, places, label, rise_is_good) in zip(COLS, figures):
        w = centred(d, x, 226, fmt(now, places), display(126))
        edges.append((x - w / 2, x + w / 2))
        centred(d, x, 270, label, display(30))
        pct_text, pct = change(now, prev)
        if abs(pct) < 0.005:
            d.line([((x - 20) * S, 345 * S), ((x + 20) * S, 345 * S)], fill=GREY, width=6 * S)
        else:
            arrow(d, x, 345 if pct > 0 else 332, pct > 0, GREEN if (pct > 0) == rise_is_good else RED)
        prev_text = fmt(prev, places).replace(",", "") if places == 0 else fmt(prev, places)
        centred(d, x, 393, "prev. %s (%s)" % (prev_text, "no change" if abs(pct) < 0.005 else pct_text), text(27))
    centred(d, 600, 300, a.area, text(17), tracking=0.8)
    centred(d, 600, 433, "Compared to " + a.compared, text(27))
    # the short rules between the figures, midway in each gap
    for (_, right), (left, _) in zip(edges, edges[1:]):
        mid = (right + left) / 2
        d.line([((mid - 34) * S, 197 * S), ((mid + 34) * S, 197 * S)], fill=WHITE, width=int(1.5 * S))

    im.resize((W, H), Image.LANCZOS).save(a.out, optimize=True)
    print("wrote", a.out)


if __name__ == "__main__":
    main()
