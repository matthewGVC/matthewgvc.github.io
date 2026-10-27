"""Clean wall masses traced by trace-walls.py: snap near-equal edges together (tolerance 7 px), union
touching pieces, drop nubs thinner than 10 px, and rasterise the result so openings and fixtures can be
measured against the real wall faces.

    import clean_solids as C
    solids = C.clean(raw_solids, (w, h))     # raw_solids from trace-walls.py (plus any pieces added by hand)
    M = C.mask(solids, (w, h))               # boolean wall raster
    C.run(M, x, y, dx, dy)                   # distance from a point to the next wall face (flush fixtures)
    C.band(M, x, y, horiz)                   # (centre, thickness) of the wall through a point (opening t)

Needs shapely (pip install shapely). Added after the 366 N 3rd St 2nd floor, whose raw masses had gaps,
mismatched edges and nubs.
"""
import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import Polygon
from shapely.ops import unary_union

def _cluster(vals, tol):
    vals = sorted(set(round(v, 1) for v in vals)); groups = []
    for v in vals:
        if groups and v - groups[-1][-1] <= tol: groups[-1].append(v)
        else: groups.append([v])
    m = {}
    for g in groups:
        c = round(sum(g) / len(g))
        for v in g: m[v] = c
    return m

def clean(solids, size, tol=7, nub=5):
    xs, ys = [], []
    for s in solids:
        for r in s:
            for x, y in r: xs.append(x); ys.append(y)
    mx, my = _cluster(xs, tol), _cluster(ys, tol)
    polys = []
    for s in solids:
        rings = [[(mx[round(x, 1)], my[round(y, 1)]) for x, y in r] for r in s]
        out = Polygon(rings[0]).buffer(0)
        for h in rings[1:]: out = out.difference(Polygon(h).buffer(0))
        polys.append(out)
    u = unary_union(polys)
    u = u.buffer(-nub, join_style=2).buffer(nub, join_style=2)
    geoms = list(u.geoms) if hasattr(u, 'geoms') else [u]
    res = []
    for g in geoms:
        if g.area < 400: continue
        rings = [[[round(x), round(y)] for x, y in list(g.exterior.coords)[:-1]]]
        for i in g.interiors: rings.append([[round(x), round(y)] for x, y in list(i.coords)[:-1]])
        res.append(rings)
    return res

def mask(solids, size):
    im = Image.new('L', size, 0); d = ImageDraw.Draw(im)
    for s in solids:
        d.polygon([tuple(p) for p in s[0]], fill=255)
        for h in s[1:]: d.polygon([tuple(p) for p in h], fill=0)
    return np.asarray(im) > 0

def run(m, x, y, dx, dy, lim=400):
    """walk from (x,y) in direction until the mask changes; returns distance to first dark pixel (or None)"""
    for i in range(lim):
        X, Y = int(x + dx * i), int(y + dy * i)
        if 0 <= Y < m.shape[0] and 0 <= X < m.shape[1] and m[Y, X]: return i
    return None

def band(m, x, y, horiz, lim=80):
    """centre and thickness of the wall band through (x,y) perpendicular to the wall: horiz walls scan in y"""
    ax = (0, 1) if horiz else (1, 0)
    def at(i): 
        X, Y = int(x + ax[0] * i), int(y + ax[1] * i)
        return m[Y, X]
    if not at(0):
        for k in range(1, lim):
            if at(k): y0 = k; break
            if at(-k): y0 = -k; break
        else: return None
    else: y0 = 0
    lo = y0
    while at(lo - 1): lo -= 1
    hi = y0
    while at(hi + 1): hi += 1
    c = (lo + hi) / 2; t = hi - lo + 1
    return (round((y if horiz else x) + c), t)
