"""Wall masses straight from a picture of a plan: exact by construction, as Matt draws them.

    python -I scripts/floorplan/trace-walls.py <picture> <out.json> [--crop x0,y0,x1,y1] [--min-wall px]
                                               [--dark 110] [--erase x0,y0,x1,y1 ...] [--preview out.png]

Every dark part of the picture at least --min-wall pixels thick is wall (or a column, a chimney mass):
text, fixtures, door swings and window lines are thinner and drop out. Each connected mass becomes one
solid, its outline and its holes (the rooms it wraps), in the picture's own pixels, straightened: edges
within a few degrees of level or plumb are made exactly so, and their corners meet exactly.

out.json: {"size": [w, h], "min_wall": px, "walls": {"thin": px, "thick": px}, "solids": [[ring, ...], ...]}
Paste "solids" into the level of plan.json (they are filled navy, even-odd). The gaps left in the masses
are the doors, windows and openings: add each as a free opening across its gap,
{"type": "window", "a": [x, y], "b": [x, y], "t": <wall thickness there>}.

--erase drops any mass lying wholly inside that box (repeat it): a fixture or a bold label that came
through as wall. --crop keeps only that box (leave out a source's header, logo, compass and footer). --min-wall is
measured by default: a little over twice the picture's commonest stroke (its text and thin linework). --preview
draws the solids in navy over the faded picture, to check them by eye.
"""
import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage.measure import find_contours, label
from skimage.morphology import opening, skeletonize


def args(argv):
    a = {'crop': None, 'min_wall': None, 'dark': 110, 'preview': None, 'erase': []}
    i = 0
    rest = []
    while i < len(argv):
        k = argv[i]
        if k == '--crop':
            a['crop'] = [int(float(v)) for v in argv[i + 1].split(',')]
            i += 2
        elif k == '--erase':
            a['erase'].append([int(float(v)) for v in argv[i + 1].split(',')])
            i += 2
        elif k == '--min-wall':
            a['min_wall'] = float(argv[i + 1])
            i += 2
        elif k == '--dark':
            a['dark'] = float(argv[i + 1])
            i += 2
        elif k == '--preview':
            a['preview'] = argv[i + 1]
            i += 2
        else:
            rest.append(k)
            i += 1
    a['src'], a['out'] = rest[0], rest[1]
    return a


def rdp(pts, tol):
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0]), np.array(pts[-1])
    ab = b - a
    L = math.hypot(*ab)
    if L < 1e-9:
        d = [math.hypot(*(np.array(p) - a)) for p in pts[1:-1]]
    else:
        d = [abs(ab[0] * (a[1] - p[1]) - (a[0] - p[0]) * ab[1]) / L for p in pts[1:-1]]
    i = int(np.argmax(d)) + 1
    if d[i - 1] > tol:
        return rdp(pts[:i + 1], tol)[:-1] + rdp(pts[i:], tol)
    return [pts[0], pts[-1]]


def ring_rdp(ring, tol):
    """simplify a closed ring: split it at its two farthest points, so no corner is lost"""
    far = max(range(len(ring)), key=lambda i: math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]))
    a = rdp(ring[:far + 1], tol)
    b = rdp(ring[far:] + [ring[0]], tol)
    return a[:-1] + b[:-1]


def straighten(ring, slack=math.tan(math.radians(4))):
    """edges within a few degrees of level or plumb made exactly so; their shared corners meet"""
    n = len(ring)
    kind, val = [], []
    for i in range(n):
        (x0, y0), (x1, y1) = ring[i], ring[(i + 1) % n]
        dx, dy = x1 - x0, y1 - y0
        if abs(dy) <= slack * abs(dx):
            kind.append('h'); val.append((y0 + y1) / 2)
        elif abs(dx) <= slack * abs(dy):
            kind.append('v'); val.append((x0 + x1) / 2)
        else:
            kind.append('d'); val.append(None)
    out = []
    for i in range(n):
        p, q = (i - 1) % n, i   # the edges into and out of vertex i
        x, y = ring[i]
        if kind[p] == kind[q] and kind[p] in 'hv' and abs(val[p] - val[q]) < 1.5:
            continue   # two runs of one straight edge: the vertex between them goes
        for e in (p, q):
            if kind[e] == 'h':
                y = val[e]
            elif kind[e] == 'v':
                x = val[e]
        out.append([round(float(x), 1), round(float(y), 1)])
    return out


def main(argv):
    a = args(argv)
    img = Image.open(a['src']).convert('RGB')
    rgb = np.asarray(img, dtype=float)
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    mask = lum < a['dark']
    if a['crop']:
        x0, y0, x1, y1 = a['crop']
        keep = np.zeros_like(mask)
        keep[max(0, y0):y1, max(0, x0):x1] = True
        mask &= keep

    # how thick the dark runs are: twice the distance to the nearest light pixel, along each run's middle
    dt = ndimage.distance_transform_edt(mask)
    th = 2 * dt[skeletonize(mask)]
    th = th[th >= 2]
    if a['min_wall']:
        k = a['min_wall']
    else:
        # most of a plan's drawn length is thin linework (text, door leaves, fixtures, window lines), all
        # about one stroke wide: the commonest thickness. Walls are runs well over twice that.
        hist = np.bincount(np.round(th).astype(int)).astype(float)
        # the thinnest thickness common enough to matter (a twentieth of the drawn length, counting its
        # neighbours): the stroke, whether the walls or the linework make up most of the picture
        near = np.convolve(hist, [1, 1, 1], 'same')
        common = [b for b in range(2, len(hist)) if near[b] >= 0.05 * hist.sum()]
        stroke = float(min(common, key=lambda b: (b, -near[b]))) if common else float(np.argmax(hist[2:]) + 2)
        while stroke + 1 < len(near) and near[int(stroke) + 1] > near[int(stroke)]:
            stroke += 1   # up to that population's peak
        if (th > 2.5 * stroke).mean() >= 0.1:
            k = 2.2 * stroke
        else:   # no thin linework to speak of: the commonest run is the wall itself
            k = 0.8 * stroke
    walls = th[th >= k * 0.9]
    thin = float(np.percentile(walls, 25)) if len(walls) else k
    thick = float(np.percentile(walls, 90)) if len(walls) else k

    # keep only what is at least ~k thick: an opening with a k x k square, a little under the wall
    size = max(2, int(round(k * 0.8)))
    solid = opening(mask, np.ones((size, size), bool))
    lab = label(solid, connectivity=2)
    solids = []
    min_area = 2 * k * k
    for i in range(1, lab.max() + 1):
        comp = lab == i
        if comp.sum() < min_area:
            continue
        ys, xs = np.nonzero(comp)
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        # a small piece that is not a solid block (a bold letter, a faucet bar's stroke) is not wall;
        # a column or a chimney is small too, but as thick as it is wide
        if max(bw, bh) < 0.04 * max(img.size) and 2 * dt[comp].max() < 0.6 * min(bw, bh):
            continue
        if any(ex0 <= x0 and ey0 <= y0 and x1 <= ex1 and y1 <= ey1 for ex0, ey0, ex1, ey1 in a['erase']):
            continue
        sub = np.pad(comp[y0:y1 + 1, x0:x1 + 1], 1)
        rings = []
        for c in find_contours(sub.astype(float), 0.5):
            pts = [[float(p[1]) + x0 - 1, float(p[0]) + y0 - 1] for p in c[:-1]]
            if len(pts) < 4:
                continue
            r = straighten(ring_rdp(pts, max(0.8, k * 0.12)))
            area = 0.5 * abs(sum(r[j][0] * r[(j + 1) % len(r)][1] - r[(j + 1) % len(r)][0] * r[j][1] for j in range(len(r))))
            if len(r) >= 3 and area >= k * k:
                rings.append(r)
        if rings:
            rings.sort(key=lambda r: -max(p[0] for p in r) + min(p[0] for p in r))   # the outline first
            solids.append(rings)

    out = {'size': list(img.size), 'min_wall': round(k, 1), 'walls': {'thin': round(thin, 1), 'thick': round(thick, 1)}, 'solids': solids}
    json.dump(out, open(a['out'], 'w'))
    if a['preview']:
        faded = Image.blend(img, Image.new('RGB', img.size, 'white'), 0.75)
        layer = Image.new('L', img.size, 0)
        dr = ImageDraw.Draw(layer)
        for rings in solids:
            for j, r in enumerate(rings):
                dr.polygon([tuple(p) for p in r], fill=255 if j == 0 else 0)
        faded.paste(Image.new('RGB', img.size, (0, 39, 58)), (0, 0), layer)
        faded.save(a['preview'])
    print('%d wall masses, %d rings; min wall %.1f px, walls %.1f-%.1f px thick' % (len(solids), sum(len(s) for s in solids), k, thin, thick))


if __name__ == '__main__':
    main(sys.argv[1:])
