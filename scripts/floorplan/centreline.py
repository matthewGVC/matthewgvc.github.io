"""Centre lines of line art that was drawn as filled outlines (Illustrator "Outline Stroke", an image trace).

    python -I scripts/floorplan/centreline.py <rings.json> <lines.json>

rings.json: {"rings": [[[x, y], ...], ...], "line": thickness}  (one symbol's filled contours, inches)
lines.json: {"lines": [[[x, y], ...], ...]}                       (open or closed centre lines, inches)

The fill is painted even-odd at 40 px to the inch, thinned to a one-pixel skeleton, and the skeleton
walked into polylines: endpoint to junction, junction to junction, and closed loops. Spurs shorter than
the line's own thickness (skeleton noise at corners) are dropped, then each polyline is simplified.
Used by import-symbols.js for "fill-line" symbols, so they can take the house stroke weight.
"""
import json
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw
from skimage.morphology import skeletonize

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


def walk(skel):
    on = set(zip(*np.nonzero(skel)))
    nbrs = {p: [(p[0] + dy, p[1] + dx) for dy, dx in NB if (p[0] + dy, p[1] + dx) in on] for p in on}
    nodes = {p for p, n in nbrs.items() if len(n) != 2}
    used = set()
    lines = []

    def edge_key(a, b):
        return (a, b) if a < b else (b, a)

    def follow(start, nxt):
        path = [start, nxt]
        used.add(edge_key(start, nxt))
        prev, cur = start, nxt
        while cur not in nodes:
            step = [q for q in nbrs[cur] if q != prev and edge_key(cur, q) not in used]
            if not step:
                break
            prev, cur = cur, step[0]
            used.add(edge_key(prev, cur))
            path.append(cur)
            if cur == start:
                break
        return path

    for n in nodes:
        for q in nbrs[n]:
            if edge_key(n, q) not in used:
                lines.append(follow(n, q))
    for p in on:  # loops with no node on them
        for q in nbrs[p]:
            if edge_key(p, q) not in used:
                lines.append(follow(p, q))
    return lines, nodes, nbrs


def rdp(pts, tol):
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0]), np.array(pts[-1])
    ab = b - a
    L = np.hypot(*ab) or 1e-9
    d = [abs(ab[0] * (a[1] - p[1]) - (a[0] - p[0]) * ab[1]) / L for p in pts[1:-1]]
    i = int(np.argmax(d)) + 1
    if d[i - 1] > tol:
        return rdp(pts[:i + 1], tol)[:-1] + rdp(pts[i:], tol)
    return [pts[0], pts[-1]]


def main(src, dst):
    data = json.load(open(src))
    rings, thick = data['rings'], max(data.get('line', 0.5), 0.2)
    mask, x0, y0 = rasterise(rings)
    lines, nodes, nbrs = walk(skeletonize(mask))
    out = []
    for ln in lines:
        length = sum(np.hypot(ln[i + 1][0] - ln[i][0], ln[i + 1][1] - ln[i][1]) for i in range(len(ln) - 1)) / PX
        dead_end = len(nbrs[ln[0]]) == 1 or len(nbrs[ln[-1]]) == 1
        if dead_end and length < thick * 1.5:
            continue  # a spur at a corner, not a line Matt drew
        if length * PX < 3:
            continue  # the pixel-long links inside a junction
        pts = [((c + 0.5) / PX + x0, (r + 0.5) / PX + y0) for r, c in ln]
        closed = ln[0] == ln[-1]
        pts = rdp(pts, 0.6 / PX * 2)
        if closed and pts[0] != pts[-1]:
            pts.append(pts[0])
        out.append([[round(x, 2), round(y, 2)] for x, y in pts])
    json.dump({'lines': out}, open(dst, 'w'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
