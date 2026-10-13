import json, sys, base64
from shapely.geometry import shape, LineString
from shapely.ops import unary_union, polylabel

parts = {n: shape(g) for n, g in json.load(open(sys.argv[1])).items()}
FONTS = sys.argv[3]
NUDGE = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else {}
allg = unary_union(list(parts.values()))
minx, miny, maxx, maxy = allg.bounds
PAD = 24; Wpx = 1100
s = (Wpx - 2 * PAD) / (maxx - minx)
Hpx = int((maxy - miny) * s + 2 * PAD)
T = lambda x, y: ((x - minx) * s + PAD, (maxy - y) * s + PAD)

def path(g):
    o = ''
    for pg in ([g] if g.geom_type == 'Polygon' else g.geoms):
        for ring in [pg.exterior] + list(pg.interiors):
            o += 'M' + 'L'.join('%.1f %.1f' % T(*c) for c in ring.coords[:-1]) + 'Z'
    return o

TWO = {'Washington Heights', 'Morningside Heights', 'Upper West Side', 'Upper East Side', 'Central Park',
       'Hamilton Heights', 'Financial District', 'Lower East Side', 'Battery Park City', 'Greenwich Village',
       'Theater District', 'Garment District', 'Meatpacking District', 'Flatiron District', 'Peter Cooper Village',
       'Stuyvesant Town', 'Hudson Heights', 'Manhattan Valley', 'Lincoln Square', 'Carnegie Hill', 'Hudson Yards',
       'Murray Hill', 'Kips Bay', 'Turtle Bay', 'Midtown East', 'Sutton Place', 'Roosevelt Island', 'Two Bridges',
       'Civic Center', 'Little Italy', "Hell's Kitchen", 'Hudson Square', 'Alphabet City', 'Fort George',
       'Marble Hill', 'Sugar Hill', 'Gramercy Park', 'East Harlem', 'West Village', 'East Village'}
SPLIT = {'Upper West Side': ['Upper', 'West Side'], 'Upper East Side': ['Upper', 'East Side'],
         'Lower East Side': ['Lower', 'East Side'], 'Battery Park City': ['Battery', 'Park City'],
         'Peter Cooper Village': ['Peter Cooper', 'Village']}
ROT = {'Roosevelt Island': -74}

def lines_for(n):
    nm = n.replace("'", '’')
    if n in SPLIT: return SPLIT[n]
    if n in TWO:
        w = nm.split(' ');
        return [' '.join(w[:-1]), w[-1]]
    return [nm]

labels = []
for n, g in parts.items():
    if n in ('Roosevelt Island',): continue
    big = max(g.geoms, key=lambda p: p.area) if g.geom_type == 'MultiPolygon' else g
    c = polylabel(big, tolerance=5)
    cx, cy = T(c.x, c.y)
    def span(line):
        i = big.intersection(line)
        segs = [i] if i.geom_type == 'LineString' else [q for q in getattr(i, 'geoms', []) if q.geom_type == 'LineString']
        for q in segs:
            if q.distance(c) < 1: return q.length * s
        return 0
    wspan = span(LineString([(c.x - 1e4, c.y), (c.x + 1e4, c.y)]))
    hspan = span(LineString([(c.x, c.y - 1e4), (c.x, c.y + 1e4)]))
    if n in ROT: wspan, hspan = hspan, wspan
    lines = lines_for(n)
    longest = max(len(l) for l in lines)
    fs = min(34, 0.8 * wspan / (0.6 * longest), 0.75 * hspan / (1.12 * len(lines)))
    serif = fs >= 17
    if not serif:
        fs = min(15, 0.86 * wspan / (0.62 * longest), 0.85 * hspan / (1.1 * len(lines)))
    nd = NUDGE.get(n, {})
    fs = nd.get('fs', fs); cx += nd.get('dx', 0); cy += nd.get('dy', 0)
    serif = nd.get('serif', serif)
    if 'at' in nd: cx, cy = nd['at']
    lines = nd.get('lines', lines)
    labels.append((n, lines, fs, cx, cy, serif, nd.get('rot', ROT.get(n, 0))))

def font(f, w, file):
    b = base64.b64encode(open(FONTS + '/' + file, 'rb').read()).decode()
    return "@font-face{font-family:'%s';font-weight:%d;src:url(data:font/woff2;base64,%s) format('woff2');}" % (f, w, b)

css = font('Fraunces', 400, 'fraunces-400-latin.woff2') + font('Nunito Sans', 700, 'nunito-sans-700-latin.woff2')
css += (".n{fill:none;stroke:#0B3346;stroke-width:1.5;stroke-linejoin:round}"
        ".o{fill:none;stroke:#0B3346;stroke-width:2.2;stroke-linejoin:round}"
        ".s{font-family:'Fraunces',serif;font-weight:400;fill:#0B2433;text-anchor:middle}"
        ".m{font-family:'Nunito Sans',sans-serif;font-weight:700;fill:#0B2433;text-anchor:middle}")
o = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (Wpx, Hpx, Wpx, Hpx),
     '<style>%s</style>' % css]
cxp, cyp = Wpx * 0.33, Hpx * 0.47
o.append('<defs><clipPath id="land"><path d="%s"/></clipPath>' % path(allg))
o.append('<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="%.0f" cy="%.0f" r="%.0f" '
         'gradientTransform="translate(%.0f %.0f) scale(1 3.2) translate(%.0f %.0f)">' % (cxp, cyp, Wpx * .62, cxp, cyp, -cxp, -cyp) +
         '<stop offset="0" stop-color="#D6E8EC"/><stop offset=".45" stop-color="#7FC3D3"/>'
         '<stop offset=".8" stop-color="#2A9BB6"/><stop offset="1" stop-color="#1A7C98"/></radialGradient>')
o.append('<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A93AE" stop-opacity=".35"/>'
         '<stop offset=".35" stop-color="#2A93AE" stop-opacity="0"/><stop offset=".7" stop-color="#2A93AE" stop-opacity="0"/>'
         '<stop offset="1" stop-color="#1A7C98" stop-opacity=".55"/></linearGradient>')
o.append('<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" '
         'numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 .15  0 0 0 0 .22  0 0 0 .55 -.22"/></filter></defs>')
o.append('<g clip-path="url(#land)"><rect width="%d" height="%d" fill="url(#g)"/><rect width="%d" height="%d" fill="url(#v)"/>'
         '<rect width="%d" height="%d" filter="url(#grain)" opacity=".5"/></g>' % (Wpx, Hpx, Wpx, Hpx, Wpx, Hpx))
for n, g in parts.items(): o.append('<path class="n" d="%s"/>' % path(g))
o.append('<path class="o" d="%s"/>' % path(allg))
for n, lines, fs, cx, cy, serif, rot in labels:
    lh = fs * (1.02 if serif else 1.08)
    y0 = cy - (len(lines) - 1) * lh / 2 + fs * 0.35
    tr = ' transform="rotate(%d %.1f %.1f)"' % (rot, cx, cy) if rot else ''
    o.append('<text class="%s" font-size="%.1f"%s>' % ('s' if serif else 'm', fs, tr) +
             ''.join('<tspan x="%.1f" y="%.1f">%s</tspan>' % (cx, y0 + i * lh, l) for i, l in enumerate(lines)) + '</text>')
o.append('</svg>')
open(sys.argv[2], 'w', encoding='utf-8').write(''.join(o))
for l in sorted(labels, key=lambda t: t[2]): print('%-22s %5.1f %s' % (l[0], l[2], 'serif' if l[5] else 'sans'))
