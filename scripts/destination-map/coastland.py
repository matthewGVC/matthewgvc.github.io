"""Turn OpenStreetMap coastline ways into land polygons and coast lines for a region.

OSM coastline runs with land on its left. Inside a box, each open chain becomes a
piece that enters and leaves the box; pieces are joined along the box edge
(counter-clockwise, which keeps land on the left) to close land polygons.
Closed rings are islands (counter-clockwise) or water holes (clockwise).

    python coastland.py monmouth   ->  <name>_land.json (LAND, COASTS, HOLES as JS) + <name>_land.png
"""
import json, math, os, sys
from PIL import Image, ImageDraw

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
BOX = {'monmouth': (40.05, -74.75, 40.60, -73.80), 'ocean': (39.45, -74.50, 40.14, -73.95)}


def area(r):  # signed, positive = counter-clockwise (x = lon, y = lat)
    return sum(r[i][1] * r[(i + 1) % len(r)][0] - r[(i + 1) % len(r)][1] * r[i][0] for i in range(len(r))) / 2


def rdp(pts, eps):
    if len(pts) < 3: return pts
    (y1, x1), (y2, x2) = pts[0], pts[-1]; dx, dy = x2 - x1, y2 - y1; n = math.hypot(dx, dy); best, bi = 0, 0
    for i in range(1, len(pts) - 1):
        y, x = pts[i]; d = abs(dy * (x - x1) - dx * (y - y1)) / n if n else math.hypot(x - x1, y - y1)
        if d > best: best, bi = d, i
    if best > eps: return rdp(pts[:bi + 1], eps)[:-1] + rdp(pts[bi:], eps)
    return [pts[0], pts[-1]]


def key(p): return (round(p[0], 6), round(p[1], 6))


def merge(ways):
    """join way geometries end to end where the end of one is the start of the next (direction kept)"""
    ways = [list(w) for w in ways if len(w) > 1]
    by_start = {}
    for i, w in enumerate(ways): by_start.setdefault(key(w[0]), []).append(i)
    used = set(); chains = []
    for i in range(len(ways)):
        if i in used: continue
        # walk back to the true start of the chain
        start = i; seen = {i}
        while True:
            prev = [j for j, w in enumerate(ways) if j not in seen and key(w[-1]) == key(ways[start][0])]
            if not prev: break
            start = prev[0]; seen.add(start)
            if key(ways[start][0]) == key(ways[i][-1]) and start == i: break
        chain = list(ways[start]); used.add(start); cur = start
        while True:
            nxt = [j for j in by_start.get(key(chain[-1]), []) if j not in used]
            if not nxt: break
            used.add(nxt[0]); chain += ways[nxt[0]][1:]; cur = nxt[0]
        chains.append(chain)
    return chains


def perim_t(p, box):
    S, W, N, E = box; la, lo = p
    if abs(la - S) < 1e-9: return lo - W
    if abs(lo - E) < 1e-9: return (E - W) + (la - S)
    if abs(la - N) < 1e-9: return (E - W) + (N - S) + (E - lo)
    return 2 * (E - W) + (N - S) + (N - la)


def corner_pts(t0, t1, box):
    """box corner points passed walking counter-clockwise from perimeter position t0 to t1"""
    S, W, N, E = box; w, h = E - W, N - S; Pm = 2 * (w + h)
    corners = [(0, (S, W)), (w, (S, E)), (w + h, (N, E)), (2 * w + h, (N, W)), (Pm, (S, W))]
    out = []; t1 = t1 if t1 >= t0 else t1 + Pm
    for tc, pt in corners + [(tc + Pm, pt) for tc, pt in corners]:
        if t0 < tc < t1 - 1e-12: out.append(pt)
    return out


def clip_seg(a, b, box):
    """Liang-Barsky: the part of segment a->b inside the box, as (t0, t1) fractions, or None"""
    S, W, N, E = box; dx, dy = b[1] - a[1], b[0] - a[0]; t0, t1 = 0.0, 1.0
    for p, q in ((-dx, a[1] - W), (dx, E - a[1]), (-dy, a[0] - S), (dy, N - a[0])):
        if p == 0:
            if q < 0: return None
        else:
            r = q / p
            if p < 0:
                if r > t1: return None
                t0 = max(t0, r)
            else:
                if r < t0: return None
                t1 = min(t1, r)
    return t0, t1


def clip_chain(chain, box):
    """pieces of the chain inside the box; each piece notes whether it enters/exits through the edge"""
    pieces = []; cur = None
    for a, b in zip(chain, chain[1:]):
        c = clip_seg(a, b, box)
        if c is None:
            if cur: pieces.append(cur); cur = None
            continue
        t0, t1 = c
        pa = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0); pb = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
        if cur is None: cur = {'pts': [pa], 'enter': t0 > 0 or a is chain[0] and False}
        if t0 > 0 and cur['pts'][-1] != pa: cur['pts'].append(pa)
        cur['pts'].append(pb)
        if t1 < 1:
            cur['exit'] = True; pieces.append(cur); cur = None
    if cur: pieces.append(cur)
    return pieces


def snap(p, box):
    S, W, N, E = box; la, lo = p
    return (min(max(la, S), N), min(max(lo, W), E))


def build(name):
    box = BOX[name]; S, W, N, E = box
    els = json.load(open(os.path.join(HERE, name + '_coast.json')))['elements']
    ways = [[(g['lat'], g['lon']) for g in e['geometry']] for e in els]
    chains = merge(ways)
    land, holes, coasts, open_pieces = [], [], [], []
    for ch in chains:
        closed = key(ch[0]) == key(ch[-1])
        inside = all(S <= p[0] <= N and W <= p[1] <= E for p in ch)
        if closed and inside:
            a = area([(p[0], p[1]) for p in ch[:-1]])
            if abs(a) < 2e-6: continue  # tiny marsh island / pond
            (land if a > 0 else holes).append(ch)
            coasts.append(ch)
            continue
        for pc in clip_chain(ch, box):
            pts = pc['pts']
            if len(pts) < 2: continue
            on_edge = lambda p: min(abs(p[0] - S), abs(p[0] - N), abs(p[1] - W), abs(p[1] - E)) < 1e-9
            if on_edge(pts[0]) and on_edge(pts[-1]): open_pieces.append(pts)
            coasts.append(pts)
    # join open pieces along the box edge, counter-clockwise
    Pm = 2 * ((E - W) + (N - S)); used = set()
    entries = [(perim_t(p[0], box), i) for i, p in enumerate(open_pieces)]
    for i in range(len(open_pieces)):
        if i in used: continue
        ring = list(open_pieces[i]); used.add(i); cur = i
        for _ in range(len(open_pieces) + 2):
            te = perim_t(ring[-1], box)
            cands = sorted(((t - te) % Pm, j) for t, j in entries)
            nxt = next(((d, j) for d, j in cands), None)
            if nxt is None: break
            d, j = nxt
            ring += corner_pts(te, perim_t(open_pieces[j][0], box), box)
            if j == i or j in used:
                break
            used.add(j); ring += open_pieces[j]
        land.append(ring + [ring[0]])
    return box, land, holes, coasts


def fmt(p): return '[%.4f, %.4f]' % (p[0], p[1])
def line_js(l): return '[' + ', '.join(fmt(p) for p in l) + ']'


if __name__ == '__main__':
    name = sys.argv[1]; box, land, holes, coasts = build(name); S, W, N, E = box
    EPS = float(sys.argv[2]) if len(sys.argv) > 2 else 0.00018
    L = [rdp(r, EPS) for r in land]; H = [rdp(r, EPS) for r in holes]; C = [rdp(c, EPS) for c in coasts if len(c) > 3]
    out = {'LAND': '[' + ',\n          '.join(line_js(r) for r in L) + ']', 'HOLES': '[' + ', '.join(line_js(r) for r in H) + ']',
           'COASTS': '[' + ',\n          '.join(line_js(c) for c in C) + ']'}
    json.dump(out, open(os.path.join(HERE, name + '_land.json'), 'w'))
    print(name, 'land', len(L), 'holes', len(H), 'coasts', len(C), {k: len(v) for k, v in out.items()})
    # picture for checking
    Wp = 1100; Hp = int(Wp * (N - S) / ((E - W) * math.cos(math.radians((N + S) / 2))))
    px = lambda p: ((p[1] - W) / (E - W) * Wp, (N - p[0]) / (N - S) * Hp)
    im = Image.new('RGB', (Wp, Hp), (7, 52, 71)); dr = ImageDraw.Draw(im)
    for r in L: dr.polygon([px(p) for p in r], fill=(231, 228, 220))
    for r in H: dr.polygon([px(p) for p in r], fill=(7, 52, 71))
    for c in C: dr.line([px(p) for p in c], fill=(83, 199, 220), width=1)
    im.save(os.path.join(HERE, name + '_land.png'))
