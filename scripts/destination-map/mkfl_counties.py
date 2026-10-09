"""Build tools/buyer-package/fl-counties.js: Florida county outlines in the same shape as
tools/nj-footprint/nj-counties.js (width, height, counties:[{fips,name,d,c}]).
Source: US Census county boundaries via us-atlas counties-10m (public domain), Mercator.
Download once to scripts/destination-map/cache/counties-10m.json (gitignored)."""
import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
topo = json.load(open(os.path.join(HERE, 'cache', 'counties-10m.json')))
sx, sy = topo['transform']['scale']; tx, ty = topo['transform']['translate']
arcs = []
for a in topo['arcs']:
    x = y = 0; pts = []
    for dx, dy in a:
        x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)
def ring(idx):
    out = []
    for i in idx:
        p = arcs[i] if i >= 0 else arcs[~i][::-1]
        out.extend(p if not out else p[1:])
    return out
def merc(lon, lat):
    return (math.radians(lon), math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))
geoms = [g for g in topo['objects']['counties']['geometries'] if str(g['id']).startswith('12')]
def polys(g):
    return [g['arcs']] if g['type'] == 'Polygon' else g['arcs']
def area(r):
    return abs(sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))) / 2
shapes = []
for g in geoms:
    rs = []
    for poly in polys(g):
        for k, r in enumerate(poly):
            rs.append((k, [merc(*p) for p in ring(r)]))
    shapes.append((g, rs))
allp = [p for _, rs in shapes for _, r in rs for p in r]
x0, x1 = min(p[0] for p in allp), max(p[0] for p in allp)
y0, y1 = min(p[1] for p in allp), max(p[1] for p in allp)
W = 420; pad = 6
k = (W - 2 * pad) / (x1 - x0); H = round((y1 - y0) * k + 2 * pad)
P = lambda p: ((p[0] - x0) * k + pad, (y1 - p[1]) * k + pad)
names = json.load(open(os.path.join(HERE, 'cache', 'fl-names.json'))) if os.path.exists(os.path.join(HERE, 'cache', 'fl-names.json')) else {}
out = []
for g, rs in shapes:
    d = ''; best = None; ba = 0
    for kind, r in rs:
        pts = [P(p) for p in r]
        a = area(pts)
        if kind == 0 and a < 1.5: continue          # drop specks
        d += 'M' + 'L'.join('%.1f,%.1f' % q for q in pts) + 'Z'
        if kind == 0 and a > ba:
            ba = a; best = pts
    cx = sum(q[0] for q in best) / len(best); cy = sum(q[1] for q in best) / len(best)
    out.append({'fips': str(g['id']), 'name': g['properties']['name'] if 'properties' in g else str(g['id']),
                'd': d, 'c': [round(cx, 1), round(cy, 1)]})
open(os.path.join(ROOT, 'tools', 'buyer-package', 'fl-counties.js'), 'w').write(
 '/* Florida county outlines for the Buyer Package Why page. Source: US Census Bureau county boundaries\n'
 '   via us-atlas (public domain), Mercator. Built by scripts/destination-map/mkfl_counties.py. */\n'
 'window.FL_COUNTIES = ' + json.dumps({'width': W, 'height': H, 'counties': out}, separators=(',', ':')) + ';\n')
print(W, H, len(out), [o['name'] for o in out][:5])
