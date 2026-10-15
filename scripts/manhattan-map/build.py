# Manhattan neighbourhoods carved along real OpenStreetMap street centrelines.
# usage: python build.py <neighbourhoods.geojson> <osm_streets.json> <out_parts.json>
import json, sys, math
import numpy as np
from shapely.geometry import shape, box, Polygon, LineString, Point
from shapely.ops import unary_union, split
from shapely import affinity

lat0, lon0 = 40.78, -73.97
k = math.cos(math.radians(lat0)); A = math.radians(29)
def P(lat, lon):
    x = (lon - lon0) * k * 111320; y = (lat - lat0) * 110540
    return (x * math.cos(A) - y * math.sin(A), x * math.sin(A) + y * math.cos(A))
def proj(g):
    g = affinity.affine_transform(g, [k * 111320, 0, 0, 110540, -lon0 * k * 111320, -lat0 * 110540])
    return affinity.rotate(g, 29, origin=(0, 0))

# ---- land
src = json.load(open(sys.argv[1]))
N0 = {}
for f in src['features']:
    p = f['properties']
    if p.get('borough') == 'Manhattan':
        N0[p['neighborhood']] = proj(shape(f['geometry'])).buffer(0)
DROP = {'Ellis Island', 'Liberty Island', 'Governors Island', "Randall's Island", 'Marble Hill', 'Roosevelt Island'}
land = unary_union([g for n, g in N0.items() if n not in DROP]).buffer(0.5, join_style=2).buffer(-0.5, join_style=2)
from shapely.geometry import Polygon as _P0
land = unary_union([_P0(q.exterior) for q in getattr(land, 'geoms', [land])])

# ---- streets
osm = json.load(open(sys.argv[2], encoding='utf-8'))
W = {}
for e in osm['elements']:
    gs = e['geometry']
    if not (40.69 < gs[0]['lat'] < 40.88 and -74.03 < gs[0]['lon'] < -73.90): continue
    W.setdefault(e['tags']['name'], []).append([(g['lat'], g['lon']) for g in gs])
    if e['tags']['name'] == 'Canal Street' and e['tags'].get('highway') != 'primary':
        W.setdefault('Canal Street (surface east)', []).append([(g['lat'], g['lon']) for g in gs])

BIG = 1e5
def line(names, lat=(0, 99), lon=(-99, 99), ext=True, axis=None):
    """Centreline of the named street(s): all carriageways' points, binned along the street."""
    pts = [P(a, b) for n in ([names] if isinstance(names, str) else names) for w in W.get(n, [])
           for a, b in w if lat[0] <= a <= lat[1] and lon[0] <= b <= lon[1]]
    assert pts, names
    X = np.array(pts); c = X.mean(0)
    if axis is None:
        u, s, vt = np.linalg.svd(X - c); d = vt[0]
    else:
        d = np.array(axis, float)
    nrm = np.array([-d[1], d[0]])
    t = (X - c) @ d; q = (X - c) @ nrm
    bins = np.arange(t.min(), t.max() + 40, 40); tt = []; qq = []
    for b0 in bins:
        m = (t >= b0) & (t < b0 + 40)
        if m.any(): tt.append(t[m].mean()); qq.append(np.median(q[m]))
    qq = np.array(qq)
    if len(qq) >= 5:
        sm = np.convolve(np.pad(qq, 2, mode='edge'), np.ones(5) / 5, mode='valid'); qq = sm
    out = np.array([c + d * a + nrm * b for a, b in zip(tt, qq)])
    if ext:
        kk = max(1, min(len(out) - 1, len(out) // 6))
        a = out[0] - out[kk]; a /= np.linalg.norm(a)
        b = out[-1] - out[-1 - kk]; b /= np.linalg.norm(b)
        out = np.vstack([out[0] + a * BIG, out, out[-1] + b * BIG])
    return LineString(out)

FRAME = box(-3e4, -3e4, 3e4, 3e4)
def side(ln, ref):
    """Half of the frame on the side of `ln` containing ref ('N','S','E','W' or an (x,y) point)."""
    if isinstance(ref, str):
        c = ln.interpolate(0.5, normalized=True)
        ref = {'N': (c.x, c.y + 50), 'S': (c.x, c.y - 50), 'E': (c.x + 50, c.y), 'W': (c.x - 50, c.y)}[ref]
        # nudge off the line to the true side using the nearest segment's normal
        p = Point(ref); n = ln.interpolate(ln.project(p)); dx, dy = p.x - n.x, p.y - n.y
        ref = (n.x + dx * 4, n.y + dy * 4)
    parts = split(FRAME, ln).geoms
    hit = [g for g in parts if g.contains(Point(ref))]
    assert len(parts) >= 2 and len(hit) == 1, ('side', len(parts), len(hit))
    return hit[0]

def st(n, *extra, lat=(0, 99), lon=(-99, 99)):
    names = [x for x in ('West %s Street' % n, 'East %s Street' % n) + extra if x in W]
    return line(names, lat, lon, axis=(1, 0))

def av(names, lat=(0, 99), lon=(-99, 99)):
    return line(names, lat, lon, axis=(0, 1))

def N_(l): return side(l, 'N')
def S_(l): return side(l, 'S')
def E_(l): return side(l, 'E')
def W_(l): return side(l, 'W')
def I(*gs):
    r = gs[0]
    for g in gs[1:]: r = r.intersection(g)
    return r

# ---- streets used as borders
s = {}
for n in ['14th', '20th', '23rd', '26th', '30th', '31st', '33rd', '34th', '40th', '41st', '42nd', '53rd', '54th', '60th',
          '49th', '71st', '77th', '79th', '86th', '96th', '98th', '125th', '135th', '145th', '155th', '181st']:
    s[n] = st(n)
s['59th'] = st('59th', 'Central Park South')
s['110th'] = st('110th', 'Central Park North')
s['8th'] = line(['East 8th Street', 'Astor Place'], axis=(1, 0))
s['grand'] = line(['Grand Street'], lon=(-74.0, -73.993))
s['houston'] = line(['West Houston Street', 'East Houston Street', 'Houston Street'], axis=(1, 0))
s['canal'] = line(['Canal Street'], lon=(-74.012, -73.990))
s['chambers'] = line(['Chambers Street'], axis=(1, 0))
s['worth'] = line(['Worth Street'])
s['white'] = line(['White Street'])
s['broome'] = line(['Broome Street'], lon=(-74.005, -73.993))
s['henry'] = line(['Henry Street'], lon=(-73.999, -73.985))
s['ebway'] = line(['East Broadway'])
s['clarkson'] = line(['Clarkson Street'])
s['dyckman'] = line(['Dyckman Street'])
s['gansevoort'] = line(['Gansevoort Street'])
s['parkrow'] = line(['Park Row'])
s['bbridge'] = line(['Brooklyn Bridge'], lat=(40.709, 40.713), lon=(-74.005, -73.999))
a = {}
a['5'] = av(['5th Avenue'], lat=(40.73, 40.82))
a['5n'] = av(['5th Avenue'], lat=(40.785, 40.82))
a['6'] = av(['6th Avenue'], lat=(40.735, 40.766))
a['6s'] = av(['6th Avenue'], lat=(40.718, 40.733))
a['7'] = av(['7th Avenue', '7th Avenue South', 'Varick Street'], lat=(40.722, 40.75))
a['8'] = av(['8th Avenue'], lat=(40.745, 40.77))
a['cpw'] = av(['Central Park West', '8th Avenue'], lat=(40.765, 40.80))
a['amst'] = av(['Amsterdam Avenue'], lat=(40.82, 40.835))
a['bway_mv'] = av(['Broadway'], lat=(40.79, 40.806))
a['bway_up'] = av(['Broadway'], lat=(40.846, 40.868))
a['bway_dt'] = av(['Broadway'], lat=(40.708, 40.722))
a['mad'] = av(['Madison Avenue'], lat=(40.745, 40.753))
a['lex'] = av(['Lexington Avenue'], lat=(40.739, 40.763))
a['3'] = av(['3rd Avenue'], lat=(40.765, 40.79))
a['2'] = av(['2nd Avenue'], lat=(40.755, 40.762))
a['1'] = av(['1st Avenue'], lat=(40.73, 40.75))
a['parks'] = av(['Park Avenue South'], lat=(40.737, 40.745))
a['bowery3'] = line(['Bowery', 'Cooper Square', '3rd Avenue'], lat=(40.716, 40.733))
a['bowery_s'] = line(['Bowery'], lat=(40.714, 40.7245))
a['crosby'] = av(['Crosby Street'])
a['lafayette'] = av(['Lafayette Street'], lat=(40.719, 40.725))
a['baxter'] = av(['Baxter Street'], lat=(40.714, 40.7185))
a['avea'] = av(['Avenue A'])
a['essex'] = av(['Essex Street'])
a['rutgers'] = av(['Rutgers Street'])
a['montgomery'] = av(['Montgomery Street'])
a['stjames'] = line(['Saint James Place'])
a['hudson'] = av(['Hudson Street'], lat=(40.735, 40.741))
a['west'] = line(['West Street'], lat=(40.705, 40.72))
a['mdrive'] = av(['Morningside Drive'])
a['convent'] = av(['Convent Avenue'], lat=(40.81, 40.825))
a['stnick'] = av(['Saint Nicholas Avenue'], lat=(40.815, 40.825))
a['edge'] = av(['Edgecombe Avenue'], lat=(40.825, 40.832))

a['mott'] = av(['Mott Street'], lat=(40.716, 40.72))
s['canal_e'] = line(['Canal Street (surface east)'], lon=(-73.9955, -73.9890))
# ---- carve (boss list, south of 125th St)
done = {}
rest = [land.intersection(S_(s['125th']))]
def take(name, region):
    g = rest[0].intersection(region).buffer(0)
    print('take %-20s %8.1f ha  rest %8.1f' % (name, g.area/1e4, rest[0].area/1e4 - g.area/1e4))
    if g.is_empty: return
    rest[0] = rest[0].difference(region).buffer(0)
    done[name] = unary_union([done[name], g]) if name in done else g

take('Morningside Heights', I(N_(s['110th']), W_(a['mdrive'])))
cnh = I(N_(s['96th']), S_(s['98th']), W_(av(['Lexington Avenue'], lat=(40.783, 40.79))), E_(a['5n']))
take('Carnegie Hill', cnh)
take('East Harlem', I(N_(s['96th']), E_(a['5n'])))
take('Harlem', N_(s['110th']))
take('Central Park', I(N_(s['59th']), E_(a['cpw']), W_(a['5'])))
take('Manhattan Valley', I(N_(s['96th']), E_(a['bway_mv'])))
take('Upper West Side', I(N_(s['71st']), W_(a['cpw'])))
take('Lincoln Square', I(N_(s['59th']), W_(a['cpw'])))
take('Carnegie Hill', I(N_(s['86th']), W_(a['3'])))
take('Yorkville', I(N_(s['79th']), E_(a['3'])))
take('Upper East Side', N_(s['77th']).difference(I(S_(s['79th']), E_(a['3']))))
take('Lenox Hill', N_(s['60th']))
take('Sutton Place', I(N_(s['53rd']), E_(a['1'])))
take('Beekman', I(N_(s['49th']), E_(a['1'])))
take('Turtle Bay', I(N_(s['42nd']), S_(s['53rd']), E_(a['lex'])))
take('Midtown East', I(N_(s['42nd']), E_(a['5'])))
take('Hudson Yards', I(N_(s['30th']), S_(s['41st']), W_(a['8'])))
take('Murray Hill', I(N_(s['34th']), E_(a['mad'])))
take('NoMad', I(N_(s['26th']), S_(s['30th']), E_(a['6']), W_(a['lex'])))
take('Kips Bay', I(N_(s['23rd']), E_(a['lex'])))
take('Chelsea', I(N_(s['14th']), S_(s['34th']), W_(a['6'])))
take("Hell's Kitchen", I(N_(s['41st']), W_(a['8'])))
take('Midtown', N_(s['26th']))
take('Flatiron District', unary_union([I(N_(s['14th']), W_(a['parks'])), N_(s['23rd'])]))
take('Peter Cooper Village', I(N_(s['20th']), E_(a['1'])))
take('Stuyvesant Town', I(N_(s['14th']), E_(a['1'])))
take('Gramercy Park', N_(s['14th']))
take('Meatpacking District', I(N_(s['gansevoort']), W_(a['hudson'])))
take('Hudson Square', I(S_(s['clarkson']), N_(s['canal']), W_(a['7'])))
take('Hudson Square', I(S_(s['houston']), N_(s['canal']), W_(a['6s'])))
take('West Village', I(N_(s['houston']), W_(a['6s'])))
take('NoHo', I(N_(s['houston']), S_(s['8th']), E_(av(['Broadway'], lat=(40.725, 40.731))), W_(a['bowery3'])))
take('Greenwich Village', I(N_(s['houston']), W_(a['bowery3'])))
take('East Village', N_(s['houston']))
take('SoHo', I(N_(s['canal']), W_(a['crosby'])))
take('Nolita', I(N_(s['broome']), W_(a['bowery_s'])))
take('Little Italy', I(N_(s['canal']), W_(a['bowery_s'])).difference(I(S_(s['grand']), E_(a['mott']))))
take('Lower East Side', I(N_(s['canal_e']), E_(a['bowery_s'])))
take('Tribeca', I(N_(s['chambers']), W_(a['bway_dt'])))
take('Battery Park City', I(W_(a['west']), N_(line(['Battery Place'], lat=(40.704, 40.7065), axis=(1, 0)))))
take('Lower East Side', I(E_(a['rutgers']), N_(s['ebway'])))
take('Lower East Side', E_(a['montgomery']))
take('Chinatown', I(E_(a['bway_dt']), N_(s['henry']), N_(s['worth']), W_(a['rutgers'])))
take('Two Bridges', I(E_(a['stjames']), N_(s['bbridge'])))
take('Financial District', rest[0])
for n in list(done):
    g = done[n].buffer(1.5, join_style=2).buffer(-1.5, join_style=2).buffer(-3, join_style=2).buffer(3, join_style=2).intersection(land)
    if g.geom_type == 'MultiPolygon':
        g = unary_union([p for p in g.geoms if p.area > 3000 or p.area > 0.25 * g.area])
    if g.geom_type == 'GeometryCollection':
        g = unary_union([p for p in g.geoms if p.geom_type in ('Polygon', 'MultiPolygon')])
    done[n] = g
from shapely.geometry import Polygon as _Poly, MultiPolygon as _MP
def _fill(g):
    ps = [_Poly(p.exterior) for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon']
    return unary_union(ps)
for n in done: done[n] = _fill(done[n])
area = land.intersection(S_(s['125th']))
left = area.difference(unary_union(list(done.values()))).buffer(0)
for piece in getattr(left, 'geoms', [left]):
    if piece.is_empty or piece.geom_type != 'Polygon': continue
    best = max(done, key=lambda n: done[n].buffer(0.5).intersection(piece.buffer(0.5)).area)
    done[best] = unary_union([done[best], piece]).buffer(0.01).buffer(-0.01)
for n in done:
    done[n] = done[n].intersection(area)
    if done[n].geom_type not in ('Polygon', 'MultiPolygon'):
        done[n] = unary_union([q for q in getattr(done[n], 'geoms', []) if q.geom_type in ('Polygon', 'MultiPolygon')])
for _ in range(2):
    for n in list(done):
        ps = list(getattr(done[n], 'geoms', [done[n]]))
        if len(ps) < 2: continue
        big = max(ps, key=lambda q: q.area)
        for q in ps:
            if q is big or q.area > 1e4: continue
            others = [m for m in done if m != n]
            best = max(others, key=lambda m: done[m].buffer(0.5).intersection(q.buffer(0.5)).area)
            done[best] = unary_union([done[best], q])
            done[n] = done[n].difference(q)
    for n in done:
        g = done[n].buffer(0.02).buffer(-0.02)
        done[n] = unary_union([_Poly(p.exterior) for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and p.area > 50])
    for i, n in enumerate(list(done)):
        for m in list(done)[i + 1:]:
            if done[n].intersection(done[m]).area > 1:
                small, large = (n, m) if done[n].area < done[m].area else (m, n)
                done[large] = done[large].difference(done[small])
for n in done: done[n] = done[n].buffer(-1, join_style=2).buffer(1, join_style=2)
done['Roosevelt Island'] = N0['Roosevelt Island']
json.dump({n: g.__geo_interface__ for n, g in done.items()}, open(sys.argv[3], 'w'))
for n, g in sorted(done.items(), key=lambda t: -t[1].area): print('%-22s %8.1f ha %s' % (n, g.area / 1e4, g.geom_type))
