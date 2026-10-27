"""Find gaps and open corners in a drawn plan: white slivers narrower than about half a point between
linework that should meet (a window frame short of its wall, a counter stopping just off a wall face,
a wall corner that doesn't close). Matt circles these on his reviews (10-27).

    node scripts/floorplan/check-joints.js "<plan.json>" tmp/joints        (renders each floor, no labels)
    python -I scripts/floorplan/check-joints.py tmp/joints

Reads every <level>.png the renderer wrote (8x, labels left out) and writes <level>-joints.png beside it,
the floor with each sliver ringed in red, and lists them in plan.json's coordinates. Needs scipy.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

GAP = 0.45     # pt: a white run narrower than this between two dark ones is a sliver
MIN = 6        # px at 8x: smaller specks are anti-aliasing


def slivers(png, zoom):
    a = np.asarray(Image.open(png).convert('L'))
    ink = a < 150
    r = max(1, int(round(GAP * zoom / 2)))
    st = np.ones((2 * r + 1, 2 * r + 1), bool)
    closed = ndimage.binary_closing(ink, structure=st)
    gap = closed & ~ink & (a > 200)          # white, and closed over by linework on both sides
    # only joints at a wall: walls are the masses thicker than 1.2 pt (lines and fixtures are thinner);
    # where lines meet each other at an angle (an X, a hinge, a burner grate) the wedge is normal drawing
    w = int(round(0.6 * zoom))
    wall = ndimage.binary_opening(ink, structure=np.ones((2 * w + 1, 2 * w + 1), bool))
    near_wall = ndimage.binary_dilation(wall, iterations=r + 1)
    lab, n = ndimage.label(gap)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        piece = lab[sl] == i
        size = int(piece.sum())
        # it must run along a wall for most of its length, not just touch one at an end (two parallel
        # lines meeting a wall, a dashed line's last dash, a sliding panel's track are drawing, not joints)
        if size < MIN or (near_wall[sl] & piece).sum() < 0.5 * size:
            continue
        h, wd = piece.shape
        # a sliver runs along the wall: long and thin, not a wedge
        if max(h, wd) < 2.5 * max(1, min(h, wd)) and size > 0.6 * h * wd:
            continue
        if max(h, wd) < 2.5 * min(h, wd):
            continue
        out.append(((sl[1].start + sl[1].stop) / 2, (sl[0].start + sl[0].stop) / 2, size))
    return a, out


def main():
    d = sys.argv[1]
    meta = json.load(open(os.path.join(d, 'meta.json')))
    total = 0
    for lv in meta['levels']:
        a, found = slivers(os.path.join(d, lv['png']), meta['zoom'])
        im = Image.fromarray(a).convert('RGB'); dr = ImageDraw.Draw(im)
        print('%s: %d' % (lv['name'], len(found)))
        for x, y, size in found:
            dr.ellipse([x - 40, y - 40, x + 40, y + 40], outline=(230, 0, 0), width=6)
            px = (x / meta['zoom'] - lv['ox']) / lv['k'], (y / meta['zoom'] - lv['oy']) / lv['k']
            print('  at plan (%d, %d), %d px' % (px[0], px[1], size))
        im.save(os.path.join(d, lv['png'].replace('.png', '-joints.png')))
        total += len(found)
    print('%d slivers' % total)


main()
