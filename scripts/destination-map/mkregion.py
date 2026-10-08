"""Build the Destination Guide map layers for one region.

    python scripts/destination-map/mkregion.py <region> fetch   # Overpass + Census downloads (cached in ./cache)
    python scripts/destination-map/mkregion.py <region> build   # writes cache/<region>_layers.json
    (shorelines: fetch natural=coastline into cache/<region>_coast.json, then coastland.py <region> <eps>)
    python scripts/destination-map/apply_layers.py <region>      # puts the built layers into guide-data.js

Add a region to CFG (county FIPS, bbox a little wider than the map frame, road/rail names, park names).
overpass.kumi.systems is more reliable than overpass-api.de; big relations (a state park) sometimes
need fetching one at a time as 'rel(<id>);out geom;'.
"""
import json, math, os, re, sys, time, urllib.parse, urllib.request, collections

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(CACHE, 'cache')   # downloads live here (gitignored)
os.makedirs(CACHE, exist_ok=True)
GD = os.path.join(CACHE, '..', '..', 'tools', 'destination-guide', 'guide-data.js')
EP = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter']
UA = {'User-Agent': 'GVC-guide/1.0'}

CFG = {
    'monmouth': dict(fips='025', bbox=(40.05, -74.75, 40.60, -73.80), inner=(40.12, 40.50, -74.58, -73.92),
        roads=[('GARDEN STATE PKWY', 'motorway', lambda t: t.get('ref') == 'GSP'),
               ('I-195', 'motorway', lambda t: (t.get('ref') or '').startswith('I 195')),
               ('ROUTE 18', 'highway', lambda t: (t.get('ref') or '').startswith('NJ 18')),
               ('ROUTE 35', 'highway', lambda t: (t.get('ref') or '').startswith('NJ 35') or (t.get('ref') or '') == 'US 9;NJ 35'),
               ('ROUTE 33', 'highway', lambda t: t.get('ref') == 'NJ 33'),
               ('ROUTE 34', 'highway', lambda t: t.get('ref') == 'NJ 34'),
               ('ROUTE 36', 'highway', lambda t: t.get('ref') == 'NJ 36'),
               ('US 9', 'highway', lambda t: t.get('ref') == 'US 9'),
               ('ROUTE 79', 'highway', lambda t: t.get('ref') == 'NJ 79')],
        rail=[('NORTH JERSEY COAST LINE', ('North Jersey Coast Line',))],
        parks='Hartshorne Woods Park|Monmouth Battlefield State Park|Holmdel Park|Manasquan Reservoir|Thompson Park|Allaire State Park|Shark River Park|Tatum Park|Huber Woods Park|Sandy Hook',
        parkids=None),
    'ocean': dict(fips='029', bbox=(39.48, -74.45, 40.14, -73.98), inner=(39.52, 40.10, -74.40, -74.00),
        roads=[('GARDEN STATE PKWY', 'motorway', lambda t: t.get('ref') == 'GSP'),
               ('ROUTE 70', 'highway', lambda t: t.get('ref') == 'NJ 70'),
               ('ROUTE 37', 'highway', lambda t: t.get('ref') == 'NJ 37'),
               ('ROUTE 72', 'highway', lambda t: t.get('ref') == 'NJ 72'),
               ('ROUTE 35', 'highway', lambda t: (t.get('ref') or '').startswith('NJ 35')),
               ('ROUTE 88', 'highway', lambda t: t.get('ref') == 'NJ 88'),
               ('ROUTE 166', 'highway', lambda t: t.get('ref') == 'NJ 166'),
               ('US 9', 'highway', lambda t: (t.get('ref') or '') in ('US 9', 'US 9;NJ 35')),
               ('I-195', 'motorway', lambda t: (t.get('ref') or '').startswith('I 195')),
               ('ROUTE 571', 'minor', lambda t: t.get('ref') == 'CR 571')],
        rail=[('NORTH JERSEY COAST LINE', ('North Jersey Coast Line',))],
        parks='Island Beach State Park|Barnegat Lighthouse State Park|Cattus Island County Park|Double Trouble State Park|Manasquan Reservoir',
        parkids=None),
    'middlesex': dict(fips='023', bbox=(40.25, -74.82, 40.66, -74.10)),
}


def get(url, data=None, tries=8):
    for i in range(tries):
        try:
            u = EP[i % 2] if data is not None and 'overpass' in (url or '') else url
            req = urllib.request.Request(url if 'overpass' not in url else EP[i % 2], data=data, headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=100))
        except Exception as e:
            print('retry', str(e)[:50]); time.sleep(8)


def ovp(ql):
    return get('https://overpass.kumi.systems/api/interpreter', urllib.parse.urlencode({'data': ql}).encode())


def fetch(name):
    for k in ('parks',):
        pth = os.path.join(CACHE, '%s_%s.json' % (name, k))
        if os.path.exists(pth) and os.path.getsize(pth) < 20: os.remove(pth)
    c = CFG[name]; s, w, n, e = c['bbox']; BB = '(%s,%s,%s,%s)' % (s, w, n, e)
    out = lambda k: os.path.join(CACHE, '%s_%s.json' % (name, k))
    def save(k, d):
        if not d:
            print('FAILED', name, k); return
        json.dump(d, open(out(k), 'w')); print(name, k, len(d.get('elements', d.get('features', []))))
    tig = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/'
    q = lambda where, layer: tig + layer + '/query?' + urllib.parse.urlencode({'where': where, 'outFields': 'NAME', 'outSR': 4326, 'f': 'geojson', 'maxAllowableOffset': 0.0003})
    if not os.path.exists(out('county')): save('county', get(q("GEOID='34%s'" % c['fips'], 'State_County/MapServer/11')))
    if not os.path.exists(out('subs')): save('subs', get(q("STATE='34' AND COUNTY='%s'" % c['fips'], 'Places_CouSub_ConCity_SubMCD/MapServer/22')))
    if 'roads' in c and not os.path.exists(out('roads')):
        save('roads', ovp('[out:json][timeout:90];(way["highway"~"^(motorway|trunk)$"]%s;way["highway"="primary"]["ref"~"^(NJ |US |CR 571)"]%s;);out geom tags;' % (BB, BB)))
    if 'rail' in c and not os.path.exists(out('rail')):
        save('rail', ovp('[out:json][timeout:90];way["railway"="rail"]["usage"~"main|branch"]["service"!~"."]%s;out geom tags;' % BB))
    if c.get('parks') and not os.path.exists(out('parksrel')):
        save('parksrel', ovp('[out:json][timeout:90];(rel["name"~"^(%s)"]["leisure"~"park|nature_reserve"]%s;rel["name"~"^(%s)"]["boundary"~"protected_area|national_park"]%s;);out geom;' % (c['parks'], BB, c['parks'], BB)))
    if c.get('parks') and not os.path.exists(out('parks')):
        save('parks', ovp('[out:json][timeout:90];(way["leisure"~"park|nature_reserve"]["name"~"^(%s)"]%s;way["boundary"="protected_area"]["name"~"^(%s)"]%s;);out geom tags;' % (c['parks'], BB, c['parks'], BB)))


# ---------------------------------------------------------------- geometry helpers
K = math.cos(math.radians(40.2))


def rdp(pts, eps):
    if len(pts) < 3: return pts
    (y1, x1), (y2, x2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1; n = math.hypot(dx, dy); best, bi = 0, 0
    for i in range(1, len(pts) - 1):
        y, x = pts[i]
        d = abs(dy * (x - x1) - dx * (y - y1)) / n if n else math.hypot(x - x1, y - y1)
        if d > best: best, bi = d, i
    if best > eps: return rdp(pts[:bi + 1], eps)[:-1] + rdp(pts[bi:], eps)
    return [pts[0], pts[-1]]


def clip_runs(pts, box):
    S, W, N, E = box; runs, cur = [], []
    for p in pts:
        if S <= p[0] <= N and W <= p[1] <= E: cur.append(p)
        else:
            if len(cur) > 1: runs.append(cur)
            cur = []
    if len(cur) > 1: runs.append(cur)
    return runs


def key(p): return (round(p[0], 6), round(p[1], 6))


def merge(ways):
    ways = [list(w) for w in ways if len(w) > 1]
    changed = True
    while changed:
        changed = False; ends = collections.defaultdict(list)
        for i, w in enumerate(ways): ends[key(w[0])].append(i); ends[key(w[-1])].append(i)
        for k, lst in ends.items():
            idx = sorted(set(lst))
            if len(idx) == 2:
                a, b = ways[idx[0]], ways[idx[1]]
                if key(a[-1]) == k and key(b[0]) == k: new = a + b[1:]
                elif key(a[0]) == k and key(b[-1]) == k: new = b + a[1:]
                elif key(a[-1]) == k and key(b[-1]) == k: new = a + b[::-1][1:]
                elif key(a[0]) == k and key(b[0]) == k: new = a[::-1] + b[1:]
                else: continue
                ways = [w for j, w in enumerate(ways) if j not in idx] + [new]; changed = True; break
    return ways


def length(l): return sum(math.hypot(l[i][0] - l[i - 1][0], (l[i][1] - l[i - 1][1]) * K) for i in range(1, len(l)))
def fmt(p): return '[%.4f, %.4f]' % (p[0], p[1])
def line_js(l): return '[' + ', '.join(fmt(p) for p in l) + ']'


def region_pois(name):
    t = open(GD, encoding='utf-8').read(); t = t[t.index('const %s = (function' % name):]
    t = t[:t.index('return {\n      id:')]
    return [(float(a), float(b)) for a, b in re.findall(r"P\(\d+, '[a-z]+', .*?, (\d+\.\d+), (-\d+\.\d+), 'http", t)]


def build(name):
    c = CFG[name]; s, w, n, e = c['bbox']; box = (s, w, n, e)
    ld = lambda k: json.load(open(os.path.join(CACHE, '%s_%s.json' % (name, k))))
    POIS = region_pois(name); PLACED = []
    inner = c.get('inner', (s, n, w, e))

    def best_label(line, text, rail=False):
        best, bi = -1e9, None
        for i in range(3, len(line) - 3):
            la, lo = line[i]
            if not (inner[0] <= la <= inner[1] and inner[2] <= lo <= inner[3]): continue
            a, b = line[i - 3], line[i + 3]
            dev = math.hypot((a[0] + b[0]) / 2 - la, ((a[1] + b[1]) / 2 - lo) * K)
            sc = min(math.hypot(la - p[0], (lo - p[1]) * K) for p in POIS + PLACED) - 4 * dev
            if sc > best: best, bi = sc, i
        if bi is None: return None
        la, lo = line[bi]; PLACED.append((la, lo)); a, b = line[max(bi - 3, 0)], line[min(bi + 3, len(line) - 1)]
        ang = math.degrees(math.atan2(-(b[0] - a[0]), (b[1] - a[1]) * K))
        if ang > 90: ang -= 180
        if ang < -90: ang += 180
        return "{ text: '%s', lat: %.4f, lon: %.4f, rot: %d%s }" % (text, la, lo, round(ang), ', rail: true' if rail else '')

    out = {}
    cg = ld('county')['features'][0]['geometry']['coordinates']
    ring = max((r[0] if isinstance(r[0][0], list) else r) for r in (cg if isinstance(cg[0][0][0], list) else [cg]))
    out['COUNTY'] = '[' + ', '.join(fmt((la, lo)) for lo, la in rdp([(la, lo) for lo, la in ring], 0.0002)) + ']'
    # town borders: every municipality outline, simplified; skip the undefined-water polygon
    rings = []
    for f in ld('subs')['features']:
        if 'not defined' in f['properties']['NAME']: continue
        g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            r = [(la, lo) for lo, la in poly[0]]
            if length(r) > 0.02: rings.append(rdp(r, 0.00025))
    out['BOUNDARIES'] = '[' + ', '.join(line_js(r) for r in rings) + ']'
    # roads
    labels = []
    if 'roads' in c:
        els = ld('roads')['elements']; roads = []
        for text, cls, test in c['roads']:
            ways = [[(g['lat'], g['lon']) for g in e_['geometry']] for e_ in els if test(e_['tags'])]
            runs = []
            for wy in merge(ways): runs += clip_runs(wy, box)
            runs = [rdp(r, 0.00028) for r in runs]; runs = [r for r in runs if length(r) > 0.01]
            if not runs: print('no road', text); continue
            roads.append("{ k: '%s', n: '%s', lines: [%s] }" % (cls, text, ', '.join(line_js(r) for r in runs)))
            lab = best_label(max(runs, key=length), text)
            if lab: labels.append(lab)
        out['ROADS'] = '[' + ',\n          '.join(roads) + ']'
    if 'rail' in c:
        els = ld('rail')['elements']; rl = []
        for text, names in c['rail']:
            ways = [[(g['lat'], g['lon']) for g in e_['geometry']] for e_ in els if e_['tags'].get('name') in names]
            runs = []
            for wy in merge(ways): runs += clip_runs(wy, box)
            runs = [rdp(r, 0.00022) for r in runs if length(r) > 0.006]
            if not runs: print('no rail', text); continue
            rl.append("{ n: '%s', lines: [%s] }" % (text, ', '.join(line_js(r) for r in runs)))
            lab = best_label(max(runs, key=length), text, True)
            if lab: labels.append(lab)
        out['RAIL'] = '[' + ',\n          '.join(rl) + ']'
    out['ROADLABELS'] = '[' + ',\n          '.join(labels) + ']'
    # parks
    if c.get('parks') and (ld('parks') or True):
        pk = []
        for e_ in (ld('parks') or {'elements': []})['elements']:
            if 'geometry' not in e_: continue
            r = [(g['lat'], g['lon']) for g in e_['geometry']]
            if length(r) < 0.02: continue
            r = rdp(r, 0.00015)
            if r[0] != r[-1]: r.append(r[0])
            pk.append('{ name: %s, pts: %s }' % (json.dumps(e_['tags'].get('name')), line_js(r)))
        prel = os.path.join(CACHE, '%s_parksrel.json' % name)
        if os.path.exists(prel) and os.path.getsize(prel) > 20:
            for e_ in json.load(open(prel))['elements']:
                ways = [[(g['lat'], g['lon']) for g in m['geometry']] for m in e_.get('members', []) if m.get('role') == 'outer' and 'geometry' in m]
                for r in merge(ways):
                    if length(r) < 0.02: continue
                    r = rdp(r, 0.00015)
                    if r[0] != r[-1]: r.append(r[0])
                    pk.append('{ name: %s, pts: %s }' % (json.dumps(e_['tags'].get('name')), line_js(r)))
                print('rel park', e_['tags'].get('name'), len(ways))
        out['PARKS'] = '[' + ',\n          '.join(pk) + ']'
    json.dump(out, open(os.path.join(CACHE, name + '_layers.json'), 'w'), indent=1)
    print({k: len(v) for k, v in out.items()})


if __name__ == '__main__':
    name, step = sys.argv[1], sys.argv[2]
    {'fetch': fetch, 'build': build}[step](name)
