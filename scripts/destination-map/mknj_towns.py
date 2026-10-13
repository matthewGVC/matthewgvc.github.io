"""Build tools/nj-footprint/nj-towns.js: municipal (town) outlines for Monmouth and Ocean
counties and their neighbours, for the NJ Footprint town-by-town map.
Source: US Census cartographic boundary file, county subdivisions 1:500k (public domain);
in New Jersey every county subdivision is a municipality. Mercator.
Download once and unzip the .shp and .dbf into scripts/destination-map/cache/ (gitignored):
  https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_34_cousub_500k.zip
Then:  python scripts/destination-map/mknj_towns.py"""
import json, math, os, struct
from collections import Counter
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
BASE = os.path.join(HERE, 'cache', 'cb_2024_34_cousub_500k')


def read_dbf(p):
    b = open(p, 'rb').read()
    n, hl, rl = struct.unpack('<IHH', b[4:12])
    fields = []; o = 32
    while b[o] != 0x0D:
        fields.append((b[o:o + 11].split(b'\0')[0].decode(), b[o + 16])); o += 32
    recs = []; o = hl
    for _ in range(n):
        r = b[o + 1:o + rl]; o += rl; d = {}; k = 0
        for nm, ln in fields:
            d[nm] = r[k:k + ln].decode('utf-8', 'replace').strip(); k += ln
        recs.append(d)
    return recs


def read_shp(p):
    b = open(p, 'rb').read(); o = 100; out = []
    while o < len(b):
        _, cl = struct.unpack('>II', b[o:o + 8]); o += 8; c = b[o:o + cl * 2]; o += cl * 2
        if struct.unpack('<i', c[:4])[0] == 0:
            out.append([]); continue
        np_, npt = struct.unpack('<ii', c[36:44])
        parts = list(struct.unpack('<%di' % np_, c[44:44 + 4 * np_])) + [npt]
        f = struct.unpack('<%dd' % (2 * npt), c[44 + 4 * np_:44 + 4 * np_ + 16 * npt])
        pts = [(f[2 * i], f[2 * i + 1]) for i in range(npt)]
        out.append([pts[parts[i]:parts[i + 1]] for i in range(np_)])
    return out


CORE = {'025': 'Monmouth', '029': 'Ocean'}
NEIGHBOURS = {'023': 'Middlesex', '021': 'Mercer', '005': 'Burlington', '001': 'Atlantic'}
COUNTY = dict(CORE, **NEIGHBOURS)
SUFFIX = {'township': 'Twp', 'borough': 'Boro', 'city': 'City', 'village': 'Village', 'town': 'Town'}


def merc(lon, lat):
    return (math.radians(lon), -math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


recs = read_dbf(BASE + '.dbf'); shapes = read_shp(BASE + '.shp')
towns = [(r, [[merc(*p) for p in ring] for ring in g]) for r, g in zip(recs, shapes)
         if r['COUNTYFP'] in COUNTY and g]
core_pts = [p for r, g in towns if r['COUNTYFP'] in CORE for ring in g for p in ring]
x0, x1 = min(p[0] for p in core_pts), max(p[0] for p in core_pts)
y0, y1 = min(p[1] for p in core_pts), max(p[1] for p in core_pts)
H = 1000; k = H / (y1 - y0); W = round((x1 - x0) * k)
# Neighbouring towns are kept only where they fall near the two counties.
mx, my = (x1 - x0) * .3, (y1 - y0) * .08


def near(g):
    return any(x0 - mx < x < x1 + mx and y0 - my < y < y1 + my for ring in g for x, y in ring)


def px(p):
    return (round((p[0] - x0) * k, 1), round((p[1] - y0) * k, 1))


def path(rings):
    out = []
    for ring in rings:
        q = []
        for p in map(px, ring):
            if not q or q[-1] != p: q.append(p)
        if len(q) > 3: out.append('M' + 'L'.join('%g,%g' % p for p in q[:-1]) + 'Z')
    return ''.join(out)


def inside(x, y, rs):
    c = False
    for r in rs:
        for i in range(len(r) - 1):
            (ax, ay), (bx, by) = r[i], r[i + 1]
            if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax: c = not c
    return c


def seg_d(x, y, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L))
    return math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)


def label_point(rings):
    """Rough pole of inaccessibility: the inside point farthest from any edge."""
    rs = [[px(p) for p in r] for r in rings]
    xs = [p[0] for r in rs for p in r]; ys = [p[1] for r in rs for p in r]
    best = (0, (sum(xs) / len(xs), sum(ys) / len(ys)))
    step = max(max(xs) - min(xs), max(ys) - min(ys)) / 40
    for i in range(41):
        for j in range(41):
            x, y = min(xs) + i * step, min(ys) + j * step
            if not inside(x, y, rs): continue
            d = min(seg_d(x, y, r[n], r[n + 1]) for r in rs for n in range(len(r) - 1))
            if d > best[0]: best = (d, (x, y))
    return [round(best[1][0], 1), round(best[1][1], 1)], round(best[0], 1)


def outline(rings_list):
    """County outline: every edge not shared by two of its own towns, chained into lines."""
    seen = Counter()
    for rings in rings_list:
        for r in rings:
            q = [px(p) for p in r]
            for a, b in zip(q, q[1:]):
                if a != b: seen[(a, b) if a < b else (b, a)] += 1
    edges = [e for e, n in seen.items() if n == 1]
    nxt = {}
    for a, b in edges:
        nxt.setdefault(a, []).append(b); nxt.setdefault(b, []).append(a)
    used = set(); out = []
    for a, b in edges:
        if (a, b) in used or (b, a) in used: continue
        line = [a, b]; used.add((a, b))
        while True:
            cur = line[-1]
            step = next((n for n in nxt[cur] if (cur, n) not in used and (n, cur) not in used), None)
            if step is None: break
            used.add((cur, step)); line.append(step)
        out.append('M' + 'L'.join('%g,%g' % p for p in line))
    return ''.join(out)


kept = [(r, g) for r, g in towns if r['COUNTYFP'] in CORE or near(g)]
# Two towns in one county sharing a short name (Freehold borough and township), or a town named
# like a county (Ocean township), keep a suffix.
dup = Counter((r['COUNTYFP'], r['NAME']) for r, g in kept)
for r, g in kept:
    if r['NAME'] in COUNTY.values(): dup[(r['COUNTYFP'], r['NAME'])] += 1
out_towns = []
for r, g in sorted(kept, key=lambda t: (t[0]['COUNTYFP'], t[0]['NAME'])):
    name = r['NAME']
    if dup[(r['COUNTYFP'], name)] > 1:
        name += ' ' + SUFFIX[r['NAMELSAD'].rsplit(' ', 1)[1]]
    c, room = label_point(g)
    out_towns.append({'name': name, 'full': r['NAMELSAD'], 'county': COUNTY[r['COUNTYFP']],
                      'd': path(g), 'c': c, 'r': room})
outlines = {nm: outline([g for r, g in kept if r['COUNTYFP'] == fp]) for fp, nm in CORE.items()}

data = json.dumps({'width': W, 'height': H, 'core': list(CORE.values()), 'outlines': outlines,
                   'towns': out_towns}, separators=(',', ':')).replace('},{', '},\n{')
js = ('/* Town (municipal) outlines for the NJ Footprint town-by-town map. Generated by\n'
      '   scripts/destination-map/mknj_towns.py from the US Census 1:500k county subdivision file\n'
      '   (public domain); in NJ each county subdivision is a municipality. Mercator, scaled so\n'
      '   Monmouth + Ocean fill a %dx%d box; neighbouring counties spill past it.\n'
      '   Per town: name as printed, full Census name, county, SVG path, label point c, and r,\n'
      '   how far (map units) c sits from the town\'s edge. Do not edit by hand. */\n'
      'window.NJ_TOWNS = %s;\n') % (W, H, data)
open(os.path.join(ROOT, 'tools', 'nj-footprint', 'nj-towns.js'), 'w', encoding='utf-8', newline='\n').write(js)
print(W, H, len(out_towns), 'towns', len(js) // 1024, 'KB')
