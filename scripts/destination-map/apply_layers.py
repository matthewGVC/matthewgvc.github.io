"""Replace a region's map-layer constants in guide-data.js with freshly built ones.
    python apply_layers.py monmouth [LAND ROADS RAIL ROADLABELS PARKS COUNTY BOUNDARIES]
"""
import json, os, re, sys
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
name = sys.argv[1]; keys = sys.argv[2:] or ['LAND', 'ROADS', 'RAIL', 'ROADLABELS', 'PARKS', 'COUNTY', 'BOUNDARIES']
data = {}
lay = os.path.join(HERE, name + '_layers.json'); land = os.path.join(HERE, name + '_land.json')
if os.path.exists(lay): data.update(json.load(open(lay)))
if os.path.exists(land): data['LAND'] = json.load(open(land))['LAND']
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tools', 'destination-guide', 'guide-data.js')
s = open(p, encoding='utf-8').read()
i = s.index('const %s = (function' % name); j = s.index("    return {\n      id: '%s'," % name, i)
block = s[i:j]
for k in keys:
    if k not in data: continue
    pat = re.compile(r'(    const %s = )\[.*?\];\n' % k, re.S)
    assert pat.search(block), k
    block = pat.sub(lambda m: m.group(1) + data[k] + ';\n', block, count=1)
s = s[:i] + block + s[j:]
open(p, 'w', encoding='utf-8').write(s); print('applied', name, keys)
