"""Centre lines of line art that was drawn as filled outlines (Illustrator "Outline Stroke", an image trace).

    python -I scripts/floorplan/centreline.py <rings.json> <paths.json>

rings.json: {"rings": [[[x, y], ...], ...], "line": thickness, "mirror": false, "merge": 0}  (one
            symbol's filled contours, inches, centred on 0,0; mirror: make it symmetrical about x = 0 from
            its left half; merge: draw lines closer than this many inches as one)
paths.json: {"paths": ["M x y C ... L ... Z", ...]}            (smooth centre lines, inches)
Several symbols' shapes at once: {"groups": [{"rings", "line", "mirror"}, ...]} -> {"groups": [[paths], ...]}

The fill is painted even-odd at 40 px to the inch and thinned to a one-pixel skeleton. The skeleton is
read as a graph: junction pixels close together are one junction, spurs shorter than the line's
thickness (noise at corners) are dropped, and a line ending just short of another is carried onto it,
so every corner and T meets. Lines are chained straight through their junctions, split at sharp
corners, and each run between corners is fitted with as few smooth curves as hold it to the drawing
(Schneider's method), or one straight line when it is straight. Used by import-symbols.js for
"fill-line" symbols, so they take the house stroke weight.
"""
import json
import math
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw
from skimage.morphology import binary_closing, disk, skeletonize

PX = 40.0  # pixels to the inch


def rasterise(rings):
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    x0, y0 = min(xs) - 1, min(ys) - 1
    w, h = int((max(xs) - x0 + 1) * PX) + 2, int((max(ys) - y0 + 1) * PX) + 2
    canvas = Image.new('1', (w, h), 0)
    for ring in rings:  # even-odd: each contour flips what is under it
        layer = Image.new('1', (w, h), 0)
        ImageDraw.Draw(layer).polygon([((x - x0) * PX, (y - y0) * PX) for x, y in ring], fill=1)
        canvas = ImageChops.logical_xor(canvas, layer)
    return np.ascontiguousarray(np.array(canvas.convert("L"), dtype=np.uint8) > 0), x0, y0


NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def graph(skel, merge):
    """the skeleton as junctions and the pixel runs between them: (centres, edges, loops)"""
    on = set(zip(*np.nonzero(skel)))
    nbrs = {p: [(p[0] + dy, p[1] + dx) for dy, dx in NB if (p[0] + dy, p[1] + dx) in on] for p in on}
    nodes = [p for p, n in nbrs.items() if len(n) != 2]
    # junction pixels within `merge` of each other are one junction (union-find)
    parent = {p: p for p in nodes}

    def root(p):
        while parent[p] != p:
            parent[p] = parent[parent[p]]
            p = parent[p]
        return p
    for i, a in enumerate(nodes):
        for b in nodes[i + 1:]:
            if abs(a[0] - b[0]) <= merge and abs(a[1] - b[1]) <= merge and math.hypot(a[0] - b[0], a[1] - b[1]) <= merge:
                parent[root(a)] = root(b)
    groups = {}
    for p in nodes:
        groups.setdefault(root(p), []).append(p)
    cid = {}
    centres = []
    for members in groups.values():
        for p in members:
            cid[p] = len(centres)
        centres.append((sum(p[0] for p in members) / len(members), sum(p[1] for p in members) / len(members)))

    used = set()
    key = lambda a, b: (a, b) if a < b else (b, a)
    edges, loops = [], []
    for n in nodes:
        for q in nbrs[n]:
            if key(n, q) in used:
                continue
            used.add(key(n, q))
            path, prev, cur = [n, q], n, q
            while cur not in cid:
                step = [s for s in nbrs[cur] if s != prev and key(cur, s) not in used]
                if not step:
                    break
                prev, cur = cur, step[0]
                used.add(key(prev, cur))
                path.append(cur)
            if cur in cid:
                inner = [p for p in path if p not in cid]
                if cid[n] == cid[cur] and len(inner) < merge * 2:
                    continue  # a link inside one junction
                edges.append([cid[n], cid[cur], inner])
    for p in on:  # rings with no junction on them
        if p in cid:
            continue
        for q in nbrs[p]:
            if key(p, q) in used:
                continue
            used.add(key(p, q))
            path, prev, cur = [p, q], p, q
            while True:
                step = [s for s in nbrs[cur] if s != prev and key(cur, s) not in used]
                if not step:
                    break
                prev, cur = cur, step[0]
                used.add(key(prev, cur))
                if cur == p:
                    break
                path.append(cur)
            loops.append(path)
    return centres, edges, loops


def plen(pts):
    return sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))


def prune(centres, edges, thick):
    """drop short spurs; then join the two runs at any junction left with only two"""
    changed = True
    while changed:
        changed = False
        deg = [0] * len(centres)
        for a, b, _ in edges:
            deg[a] += 1
            deg[b] += 1
        for e in list(edges):
            a, b, inner = e
            ends = [c for c in (a, b) if deg[c] == 1]
            others = [c for c in (a, b) if deg[c] >= 3]
            if ends and others and len(inner) + 2 < thick * 1.5:
                edges.remove(e)
                changed = True
                break
        if changed:
            continue
        for c in range(len(centres)):
            if deg[c] != 2:
                continue
            two = [e for e in edges if e[0] == c or e[1] == c]
            if len(two) != 2 or two[0] is two[1]:
                continue
            e1, e2 = two
            p1 = e1[2] if e1[1] == c else e1[2][::-1]
            s1 = e1[0] if e1[1] == c else e1[1]
            p2 = e2[2] if e2[0] == c else e2[2][::-1]
            s2 = e2[1] if e2[0] == c else e2[0]
            mid = (int(round(centres[c][0])), int(round(centres[c][1])))
            edges.remove(e1)
            edges.remove(e2)
            edges.append([s1, s2, p1 + [mid] + p2])
            changed = True
            break
    return edges


def runs(centres, edges, loops, thick):
    """each edge as points from its start junction to its end junction, trimmed straight into each.
    A junction sits where its lines, carried on straight, meet (least squares), not at the middle of
    its blob of skeleton pixels, so a corner is a corner"""
    trim = thick * 0.5
    ends = {}
    kept = []
    for a, b, inner in edges:
        ca, cb = centres[a], centres[b]
        pts = [p for p in inner if math.hypot(p[0] - ca[0], p[1] - ca[1]) > trim and math.hypot(p[0] - cb[0], p[1] - cb[1]) > trim]
        if len(pts) < 2:
            pts = inner
        pts = [(float(p[0]), float(p[1])) for p in pts]
        kept.append((a, b, pts))
        for c, seq in ((a, pts), (b, pts[::-1])):
            far = next((q for q in seq if math.hypot(q[0] - seq[0][0], q[1] - seq[0][1]) >= thick), seq[-1])
            d = (seq[0][0] - far[0], seq[0][1] - far[1])
            L = math.hypot(*d)
            if L:
                ends.setdefault(c, []).append((seq[0], (d[0] / L, d[1] / L)))
    at = list(centres)
    for c, lines in ends.items():
        if len(lines) < 2:
            continue
        A = np.zeros((2, 2))
        B = np.zeros(2)
        for p, d in lines:
            M = np.eye(2) - np.outer(d, d)
            A += M
            B += M @ np.array(p)
        if np.linalg.cond(A) < 1e3:
            x = np.linalg.solve(A, B)
            if math.hypot(x[0] - centres[c][0], x[1] - centres[c][1]) < thick:
                at[c] = (float(x[0]), float(x[1]))
    out = [{'a': a, 'b': b, 'pts': [at[a]] + pts + [at[b]]} for a, b, pts in kept]
    return out, [[(float(p[0]), float(p[1])) for p in lp] for lp in loops]


def snap(rs, centres, thick):
    """a free end that stops just short of another line is carried onto it (a lost T or corner)"""
    deg = [0] * len(centres)
    for r in rs:
        deg[r['a']] += 1
        deg[r['b']] += 1
    for r in rs:
        for end in ('a', 'b'):
            if deg[r[end]] != 1:
                continue
            p = r['pts'][0] if end == 'a' else r['pts'][-1]
            q = r['pts'][min(len(r['pts']) - 1, int(thick))] if end == 'a' else r['pts'][max(0, len(r['pts']) - 1 - int(thick))]
            best, bd = None, thick * 1.2
            for o in rs:
                seq = o['pts']
                for i in range(len(seq) - 1):
                    if o is r and (i < thick * 3 if end == 'a' else i > len(seq) - thick * 3):
                        continue
                    hit = closest(p, seq[i], seq[i + 1])
                    d = math.hypot(hit[0] - p[0], hit[1] - p[1])
                    # only forwards, the way the line was heading
                    if d < bd and (hit[0] - q[0]) * (p[0] - q[0]) + (hit[1] - q[1]) * (p[1] - q[1]) > 0:
                        best, bd = hit, d
            if best:
                if end == 'a':
                    r['pts'].insert(0, best)
                else:
                    r['pts'].append(best)
    return rs


def closest(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L))
    return (a[0] + dx * t, a[1] + dy * t)


def chain(rs, centres):
    """join runs straight through their junctions: at each junction the pair that turns least goes on"""
    def heading(r, end):
        seq = r['pts'] if end == 'a' else r['pts'][::-1]
        k = min(len(seq) - 1, 6)
        v = (seq[k][0] - seq[0][0], seq[k][1] - seq[0][1])
        L = math.hypot(*v) or 1
        return (v[0] / L, v[1] / L)
    link = {}
    smooth_on = set()
    at = {}
    for i, r in enumerate(rs):
        at.setdefault(r['a'], []).append((i, 'a'))
        at.setdefault(r['b'], []).append((i, 'b'))
    for c, ends in at.items():
        if len(ends) < 2:
            continue
        pairs = []
        for x in range(len(ends)):
            for y in range(x + 1, len(ends)):
                if ends[x][0] == ends[y][0]:
                    continue
                h1, h2 = heading(rs[ends[x][0]], ends[x][1]), heading(rs[ends[y][0]], ends[y][1])
                pairs.append((h1[0] * h2[0] + h1[1] * h2[1], ends[x], ends[y]))  # -1 = straight on
        pairs.sort()
        taken = set()
        for dot, e1, e2 in pairs:
            if e1 in taken or e2 in taken or dot > 0.5:
                continue
            taken.update([e1, e2])
            link[e1] = e2
            link[e2] = e1
            if dot < -0.85:  # straight on: the line runs through the junction unbroken
                smooth_on.update([(e1, e2), (e2, e1)])
    seen = set()
    chains = []
    other = {'a': 'b', 'b': 'a'}

    def walk(idx, e):
        pieces, closed, first, through = [], False, (idx, e), False
        while True:
            seen.add(idx)
            pieces.append((rs[idx]['pts'] if e == 'a' else rs[idx]['pts'][::-1], through))
            nxt = link.get((idx, other[e]))
            if not nxt:
                break
            through = ((idx, other[e]), nxt) in smooth_on
            if nxt[0] in seen:
                closed = nxt == first
                if closed and through:  # the ring closes straight through its first junction too
                    pieces[0] = (pieces[0][0], True)
                break
            idx, e = nxt
        chains.append((pieces, closed))
    # open chains start at a run end that goes on to nothing; what is left is rings
    for i in range(len(rs)):
        for e in ('a', 'b'):
            if i not in seen and (i, e) not in link:
                walk(i, e)
    for i in range(len(rs)):
        if i not in seen:
            walk(i, 'a')
    return chains


def corners(pts, k, limit, closed=False):
    """indices where the line turns sharper than `limit` degrees, measured over k pixels each way
    (round a ring, pts[0] == pts[-1], the measure wraps)"""
    n = len(pts) - 1 if closed else len(pts)
    if n < 3:
        return []
    k = min(k, max(1, (n - 1) // 3))
    at = (lambda i: pts[i % n]) if closed else (lambda i: pts[i])
    span = range(n) if closed else range(k, n - k)
    ang = [0.0] * n
    for i in span:
        a, b, c = at(i - k), at(i), at(i + k)
        v1 = (b[0] - a[0], b[1] - a[1])
        v2 = (c[0] - b[0], c[1] - b[1])
        d = math.hypot(*v1) * math.hypot(*v2)
        if d:
            ang[i] = math.degrees(math.acos(max(-1, min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / d))))
    out = []
    for i in span:
        near = [ang[j % n] for j in range(i - k, i + k + 1)] if closed else ang[max(0, i - k):i + k + 1]
        if ang[i] > limit and ang[i] == max(near) and (not out or i - out[-1] > k):
            out.append(i)
    if closed and len(out) > 1 and out[0] + n - out[-1] <= k:
        out.pop()
    return out


def smooth(pts, times):
    pts = list(pts)
    for _ in range(times):
        pts = [pts[0]] + [((pts[i - 1][0] + 2 * pts[i][0] + pts[i + 1][0]) / 4, (pts[i - 1][1] + 2 * pts[i][1] + pts[i + 1][1]) / 4) for i in range(1, len(pts) - 1)] + [pts[-1]]
    return pts


# ---- Schneider's curve fitting (Graphics Gems, 1990) ----
def _bez(ctrl, t):
    u = 1 - t
    return np.array(ctrl[0]) * u ** 3 + np.array(ctrl[1]) * 3 * u * u * t + np.array(ctrl[2]) * 3 * u * t * t + np.array(ctrl[3]) * t ** 3


def _unit(v):
    L = np.hypot(*v)
    return v / L if L else v


def fit(pts, tol):
    P = np.array(pts, dtype=float)
    if len(P) < 3:
        return [('L', P[-1])]
    t1 = _unit(P[min(3, len(P) - 1)] - P[0])
    t2 = _unit(P[max(0, len(P) - 4)] - P[-1])
    return _fit(P, t1, t2, tol, 0)


def _param(P):
    d = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
    return d / d[-1] if d[-1] else d


def _gen(P, u, t1, t2):
    A1 = np.outer(3 * (1 - u) ** 2 * u, t1)
    A2 = np.outer(3 * (1 - u) * u ** 2, t2)
    C = np.array([[np.sum(A1 * A1), np.sum(A1 * A2)], [np.sum(A1 * A2), np.sum(A2 * A2)]])
    B = np.outer((1 - u) ** 3 + 3 * (1 - u) ** 2 * u, P[0]) + np.outer(3 * (1 - u) * u ** 2 + u ** 3, P[-1])
    X = np.array([np.sum(A1 * (P - B)), np.sum(A2 * (P - B))])
    det = C[0, 0] * C[1, 1] - C[0, 1] * C[1, 0]
    seg = np.hypot(*(P[-1] - P[0]))
    if abs(det) > 1e-12:
        a1 = (X[0] * C[1, 1] - X[1] * C[0, 1]) / det
        a2 = (C[0, 0] * X[1] - C[1, 0] * X[0]) / det
    else:
        a1 = a2 = seg / 3
    if a1 < seg * 1e-3 or a2 < seg * 1e-3:
        a1 = a2 = seg / 3
    return [P[0], P[0] + t1 * a1, P[-1] + t2 * a2, P[-1]]


def _err(P, ctrl, u):
    d = [np.hypot(*(_bez(ctrl, t) - p)) for p, t in zip(P, u)]
    i = int(np.argmax(d))
    return d[i], i


def _newton(P, ctrl, u):
    out = []
    c = [np.array(x) for x in ctrl]
    for p, t in zip(P, u):
        q = _bez(c, t)
        d1 = [3 * (c[i + 1] - c[i]) for i in range(3)]
        d2 = [2 * (d1[i + 1] - d1[i]) for i in range(2)]
        q1 = d1[0] * (1 - t) ** 2 + d1[1] * 2 * (1 - t) * t + d1[2] * t * t
        q2 = d2[0] * (1 - t) + d2[1] * t
        num = np.dot(q - p, q1)
        den = np.dot(q1, q1) + np.dot(q - p, q2)
        out.append(t - num / den if den else t)
    return np.clip(out, 0, 1)


def _fit(P, t1, t2, tol, depth):
    if len(P) == 2 or depth > 12:
        return [('C', _gen(P, _param(P), t1, t2))]
    u = _param(P)
    ctrl = _gen(P, u, t1, t2)
    err, split = _err(P, ctrl, u)
    if err < tol:
        return [('C', ctrl)]
    if err < tol * 4:
        for _ in range(6):
            u = _newton(P, ctrl, u)
            ctrl = _gen(P, u, t1, t2)
            err, split = _err(P, ctrl, u)
            if err < tol:
                return [('C', ctrl)]
    split = max(1, min(len(P) - 2, split))
    tc = _unit(P[split - 1] - P[split + 1])
    return _fit(P[:split + 1], t1, tc, tol, depth + 1) + _fit(P[split:], -tc, t2, tol, depth + 1)


def straight(pts, tol):
    a, b = pts[0], pts[-1]
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    if L < 1e-9:
        return False
    return all(abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L <= tol for p in pts)


def trace(pts, closed, thick, tol):
    """one chain of points -> (its start, path commands): straight runs as L, curved runs as fitted C.
    A ring starts on one of its corners"""
    k = max(3, int(thick * 0.6))
    cut = corners(pts, k, 35, closed)
    if closed:
        if cut:  # start the ring on a corner
            pts = pts[cut[0]:] + pts[1:cut[0] + 1]
            cut = [0] + [c - cut[0] for c in cut[1:]] + [len(pts) - 1]
        else:
            cut = [0, len(pts) - 1]
    else:
        cut = [0] + cut + [len(pts) - 1]
    cmds = []
    for s, e in zip(cut, cut[1:]):
        piece = pts[s:e + 1]
        if len(piece) < 2:
            continue
        if straight(piece, tol):
            cmds.append(('L', np.array(piece[-1])))
        else:
            cmds.extend(fit(smooth(piece, max(3, int(thick * 0.6))), tol))
    return pts[0], cmds


def centre(rings, line, mirror=False, merge=0):
    """one symbol's filled contours (inches) -> its centre lines as path data (inches)"""
    line = max(line, 0.05)
    thick = line * PX  # the line's thickness in pixels
    mask, x0, y0 = rasterise(rings)
    if mirror:  # a symmetrical symbol: its left half, mirrored, is its right half
        c = (0 - x0) * PX - 0.5
        for j in range(int(math.ceil(c)), mask.shape[1]):
            src = int(round(2 * c - j))
            mask[:, j] = mask[:, src] if 0 <= src < mask.shape[1] else False
    if merge:  # lines closer than `merge` inches (cushions drawn edge to edge) are one line
        mask = binary_closing(mask, disk(max(1, int(merge * PX / 2))))
    centres, edges, loops = graph(skeletonize(mask), max(2, thick * 0.6))
    edges = prune(centres, edges, thick)
    rs, loops = runs(centres, edges, loops, thick)
    rs = snap(rs, centres, thick)
    chains = chain(rs, centres)
    tol = max(0.06 * PX, thick * 0.15)  # how far a fitted line may stray from the drawing
    inch = lambda p: '%g %g' % (round(float(p[1]) / PX + x0 + 0.5 / PX, 2), round(float(p[0]) / PX + y0 + 0.5 / PX, 2))
    out = []
    for pieces, closed in chains + [([(lp + [lp[0]], False)], True) for lp in loops]:
        # joined end to end; where a line runs straight through a junction, the junction point is left
        # out so the curve is not kinked by it
        pts = []
        for p, through in pieces:
            if not pts:
                pts = list(p[1:] if through and closed else p)
            elif through:
                pts = pts[:-1] + list(p[1:])
            else:
                pts.extend(p[1:])
        if closed and pieces[0][1]:
            pts = pts[:-1] + [pts[0]]
        if plen(pts) < max(3, thick * 0.5):
            continue
        start, cmds = trace(pts, closed, thick, tol)
        d = 'M' + inch(start)
        for c, v in cmds:
            d += 'L' + inch(v) if c == 'L' else 'C' + ' '.join(inch(q) for q in v[1:])
        out.append(d + ('Z' if closed else ''))
    return out


def main(src, dst):
    data = json.load(open(src))
    groups = data['groups'] if 'groups' in data else [data]
    out = [centre(g['rings'], g.get('line', 0.5), g.get('mirror'), g.get('merge', 0)) for g in groups]
    json.dump({'groups': out} if 'groups' in data else {'paths': out[0]}, open(dst, 'w'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
