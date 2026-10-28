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
        # a group never spans more than tol: chaining near values let a group drift across a whole
        # wall on a busy plan and collapsed the 366 N 3rd first floor's outside walls
        if groups and v - groups[-1][0] <= tol: groups[-1].append(v)
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
        rings = [square([[round(x), round(y)] for x, y in list(g.exterior.coords)[:-1]])]
        for i in g.interiors: rings.append(square([[round(x), round(y)] for x, y in list(i.coords)[:-1]]))
        res.append(rings)
    return res

def square(ring, most=15):
    """square off chamfered corners: a short diagonal edge between a horizontal and a vertical one becomes
    the corner where those two meet. Left in, it drew a white wedge beside a window frame or a shower
    (Matt circled them as open corners, 10-27)"""
    ring = [p for i, p in enumerate(ring) if p != ring[i - 1]]
    changed = True
    while changed and len(ring) > 4:
        changed = False
        n = len(ring)
        for i in range(n):
            a, b = ring[i], ring[(i + 1) % n]
            if a[0] == b[0] or a[1] == b[1] or ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5 > most:
                continue
            p, q = ring[i - 1], ring[(i + 2) % n]
            if p[1] == a[1] and b[0] == q[0]: c = [b[0], a[1]]
            elif p[0] == a[0] and b[1] == q[1]: c = [a[0], b[1]]
            else:
                # a jog: a short diagonal between two parallel edges a few pixels apart (a wall end stepped
                # half way across): both edges move onto the longer one, and the end runs straight
                k = 0 if (p[0] == a[0] and b[0] == q[0]) else 1 if (p[1] == a[1] and b[1] == q[1]) else None
                if k is None or abs(a[k] - b[k]) > 8: continue
                v = a[k] if abs(p[1 - k] - a[1 - k]) >= abs(b[1 - k] - q[1 - k]) else b[k]
                for j in (i - 1, i, (i + 1) % n, (i + 2) % n): ring[j][k] = v
                ring[:] = straight(ring)
                changed = True
                break
            ring[i] = c; del ring[(i + 1) % n]
            changed = True
            break
    return straight(ring)

def straight(ring):
    """drop repeated points and the middle of three in a line"""
    out = [p for i, p in enumerate(ring) if p != ring[i - 1]]
    keep = []
    for i, p in enumerate(out):
        a, b = out[i - 1], out[(i + 1) % len(out)]
        if (a[0] == p[0] == b[0]) or (a[1] == p[1] == b[1]): continue
        keep.append(p)
    return keep

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
    # the raster fills both edge pixels of a wall, so its true thickness is hi - lo (one less than the
    # pixel count); a window measured one pixel thick stood proud of the wall faces (Matt, 10-27)
    c = (lo + hi) / 2; t = hi - lo
    return (round((y if horiz else x) + c), t)

def square_ends(solids, openings, cap=12):
    """square every wall end at an opening (Matt's circled joints, 10-27): the wall mass is cut straight at
    the opening's ends, and the few pixels behind each end are filled where the wall is mostly there already,
    so a jamb's step or a slanted end no longer leaves a notch beside the window or door. openings are the
    free ones, {"a": [x, y], "b": [x, y], "t": thickness}, on horizontal or vertical walls"""
    from shapely.geometry import box
    def poly(s):
        out = Polygon(s[0])
        for h in s[1:]: out = out.difference(Polygon(h))
        return out.buffer(0)
    u = unary_union([poly(s) for s in solids])
    for o in openings:
        (ax, ay), (bx, by), t = o['a'], o['b'], o.get('t') or 0
        if not t or (ax != bx and ay != by): continue
        h = t / 2
        if ay == by:
            x0, x1 = sorted((ax, bx)); cut = box(x0, ay - h, x1, ay + h)
            caps = [box(x0 - cap, ay - h, x0, ay + h), box(x1, ay - h, x1 + cap, ay + h)]
        else:
            y0, y1 = sorted((ay, by)); cut = box(ax - h, y0, ax + h, y1)
            caps = [box(ax - h, y0 - cap, ax + h, y0), box(ax - h, y1, ax + h, y1 + cap)]
        u = u.difference(cut)
        for c in caps:
            if u.intersection(c).area >= 0.5 * c.area: u = u.union(c)
    geoms = list(u.geoms) if hasattr(u, 'geoms') else [u]
    res = []
    for g in geoms:
        if g.area < 400: continue
        rings = [square([[round(x), round(y)] for x, y in list(g.exterior.coords)[:-1]])]
        for i in g.interiors: rings.append(square([[round(x), round(y)] for x, y in list(i.coords)[:-1]]))
        res.append(rings)
    return res

def close(solids, gap=30):
    """join wall masses split by less than 2 x gap px (a round column drawn over a wall, which the tracer
    reads as a white break: Matt marked the breaks in the 366 N 3rd ground floor's stair wall, 10-28).
    Openings are wider than that; run it on the traced walls before adding columns with round holes"""
    def poly(s):
        out = Polygon(s[0])
        for h in s[1:]: out = out.difference(Polygon(h))
        return out.buffer(0)
    u = unary_union([poly(s) for s in solids]).buffer(gap, join_style=2).buffer(-gap, join_style=2)
    geoms = list(u.geoms) if hasattr(u, 'geoms') else [u]
    res = []
    for g in geoms:
        if g.area < 400: continue
        rings = [square([[round(x), round(y)] for x, y in list(g.exterior.coords)[:-1]])]
        for i in g.interiors: rings.append(square([[round(x), round(y)] for x, y in list(i.coords)[:-1]]))
        res.append(rings)
    return res
