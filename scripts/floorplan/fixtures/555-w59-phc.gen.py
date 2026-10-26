# The generator that wrote 555-w59-phc.json: the worked example for the making-gvc-floorplans skill.
# Traced from tools/showsheet/sample/floorplan.jpg in its own pixels (2250 x 1750); every number was
# read off zoomed views with a 10 px grid (sources.md, "Measuring a picture"), then checked with
# scripts/floorplan/overlay.js until nothing red was left.
#   python -I scripts/floorplan/fixtures/555-w59-phc.gen.py <out plan.json>
import json, math, sys
walls, ops = [], []
def W(a, b, t='exterior', via=None):
    w = {"a": [round(a[0], 2), round(a[1], 2)], "b": [round(b[0], 2), round(b[1], 2)], "type": t}
    if via: w["via"] = [round(via[0], 2), round(via[1], 2)]
    walls.append(w); return len(walls) - 1
def along(w, v):   # fraction along wall w of the coordinate v (x for a horizontal wall, y for a vertical one)
    a, b = walls[w]["a"], walls[w]["b"]
    i = 0 if abs(b[0] - a[0]) > abs(b[1] - a[1]) else 1
    return round((v - a[i]) / (b[i] - a[i]), 4)
def O(w, v0, v1, typ, **k):
    f, t = sorted([along(w, v0), along(w, v1)])
    ops.append(dict(wall=w, **{"from": f, "to": t}, type=typ, **k))
def rounded(pts, corners, r=20, n=6):   # polygon with the listed corner indexes rounded (terrace outline)
    out = []
    for i, p in enumerate(pts):
        if i not in corners: out.append(list(p)); continue
        a, b = pts[i - 1], pts[(i + 1) % len(pts)]
        u = [(a[0] - p[0]) / math.dist(a, p), (a[1] - p[1]) / math.dist(a, p)]
        v = [(b[0] - p[0]) / math.dist(b, p), (b[1] - p[1]) / math.dist(b, p)]
        c = [p[0] + (u[0] + v[0]) * r, p[1] + (u[1] + v[1]) * r]
        a0 = math.atan2(p[1] + u[1] * r - c[1], p[0] + u[0] * r - c[0]); a1 = math.atan2(p[1] + v[1] * r - c[1], p[0] + v[0] * r - c[0])
        d = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        out += [[round(c[0] + r * math.cos(a0 + d * k / n), 1), round(c[1] + r * math.sin(a0 + d * k / n), 1)] for k in range(n + 1)]
    return out

R, D = 74, 74 / math.sqrt(2)
# ---- the envelope: exterior walls, centre lines (16 px walls) ----
arcL = W((574.5, 742), (648.5, 668), via=(648.5 - D, 742 - D)); ops.append({"wall": arcL, "from": 0, "to": 1, "type": "window"})
top = W((648.5, 668), (1681.5, 668))
for x0, x1 in [(671, 726), (726, 781), (1238.5, 1297), (1297, 1356), (1530, 1590), (1590, 1650), (1669, 1681.5)]: O(top, x0, x1, 'window')
O(top, 1180, 1227, 'door', hinge='from', side='left', outside=True)          # to the terrace, opening out
arcR = W((1681.5, 668), (1755.5, 742), via=(1681.5 + D, 742 - D)); ops.append({"wall": arcR, "from": 0, "to": 1, "type": "window"})
right = W((1755.5, 742), (1755.5, 1181.75))
for y0, y1 in [(778.5, 828), (828, 875)]: O(right, y0, y1, 'window')
O(right, 890, 940, 'door', hinge='to', side='left', outside=True)            # bedroom to the terrace, opening out
bath_bottom = W((1755.5, 1181.75), (1381.75, 1181.75))
cl3_right = W((1381.75, 1181.75), (1381.75, 1304))
W((1381.75, 1304), (1197, 1304))                                # CL by the stair, bottom
W((1197, 1304), (1197, 1242))
entry = W((1197, 1242), (1048.25, 1241.5))                      # entry wall and CL bottom
O(entry, 1121, 1166, 'door', hinge='to', side='right', outside=True)          # the front door, opening in
W((1048.25, 1241.5), (1048.25, 1145))                           # CL left
W((1048.25, 1145), (1093, 1145))                                # CL top
clr = W((1095.5, 1117.7), (1095.5, 1241.5))                     # CL right wall, door into the gallery
O(clr, 1173, 1218, 'door', hinge='to', side='left')
W((882.7, 1117.7), (1095.5, 1117.7))                            # built-in wall (kitchen top)
kr = W((882.7, 1117.7), (882.7, 1350.8))                        # kitchen right wall
O(kr, 1163, 1206, 'door', hinge='from', side='right')           # small CL, opening into the kitchen
W((882.7, 1156), (907.6, 1156)); W((907.6, 1156), (907.6, 1213)); W((907.6, 1213), (882.7, 1213))
W((882.7, 1350.8), (943.25, 1350.8))
W((943.25, 1350.8), (943.25, 1532.5))                           # REF and CL back wall
W((943.25, 1532.5), (574.5, 1532.5))                            # kitchen bottom
left = W((574.5, 1532.5), (574.5, 742))
for y0, y1 in [(761, 818), (888, 946.5), (946.5, 1006.5), (1006.5, 1063.5), (1275, 1315), (1315, 1355), (1355, 1395)]: O(left, y0, y1, 'window')
O(left, 1423, 1467, 'door', hinge='from', side='left', outside=True)         # kitchen to the terrace, opening out (hinge at the bottom)

# ---- inside ----
bl = W((1383.5, 713), (1383.5, 1007.5))                         # living room / bedroom (17 px)
O(bl, 713, 755, 'pocket', hinge='to')
bb = W((1383.5, 1007.5), (1755.5, 1007.5), 'interior')          # bedroom bottom (9 px)
O(bb, 1669, 1717, 'door', hinge='to', side='left')              # WIC
W((1379, 1007.5), (1379, 1181.75), 'interior')                  # stair / vestibule
bathl = W((1468.3, 1007.5), (1468.3, 1181.75))                  # vestibule / bath (17 px)
O(bathl, 1031, 1079, 'pocket', hinge='to')
vc = W((1379, 1107.25), (1468.3, 1107.25), 'interior')          # vestibule / CL
O(vc, 1394, 1440, 'door', hinge='from', side='left')
sg = W((1580, 1027), (1580, 1181.75), 'glass')                  # shower screen
O(sg, 1027, 1084, 'door', hinge='from', side='right')
W((1645, 1007.5), (1645, 1181.75), 'interior')                  # shower / WIC
cl3t = W((1197, 1238.5), (1381.75, 1238.5), 'interior')         # stair foot / CL top
O(cl3t, 1213.5, 1257.7, 'door', hinge='from', side='left')
W((892.5, 1350.8), (892.5, 1532.5), 'interior')                 # kitchen closets' front
O(len(walls) - 1, 1438, 1469, 'opening'); O(len(walls) - 1, 1484, 1515, 'opening')
W((892.5, 1433), (943.25, 1433), 'interior'); W((892.5, 1480), (943.25, 1480), 'interior')

solids = [
  [[874, 668], [1171, 668], [1171, 755], [1113, 755], [1113, 734], [1075, 697], [954, 697], [917, 734], [917, 755], [854, 755], [854, 697], [874, 697]],   # chimney breast
  [[1356, 668], [1530, 668], [1530, 676], [1515, 676], [1515, 694], [1483, 694], [1483, 713], [1391.5, 713], [1391.5, 703.5], [1371, 703.5], [1371, 683], [1356, 683]],
  [[574.5, 823], [621, 823], [621, 884], [574.5, 884]],
  [[574.5, 1063.5], [600, 1063.5], [600, 1099], [649, 1099], [649, 1262], [642, 1262], [642, 1210], [600, 1210], [600, 1262], [574.5, 1262]],
  [[574.5, 1478.5], [600, 1478.5], [600, 1532.5], [574.5, 1532.5]],
  [[1731, 750], [1755.5, 750], [1755.5, 771], [1731, 771]],
  [[1731, 963], [1755.5, 963], [1755.5, 1181.75], [1692, 1181.75], [1692, 1133], [1731, 1133]],
  [[1717, 1003], [1731, 1003], [1731, 1012], [1717, 1012]],
  [[1379, 1007.5], [1398, 1007.5], [1398, 1027], [1379, 1027]],
  [[1468.3, 1007.5], [1581, 1007.5], [1581, 1027], [1477, 1027], [1477, 1031], [1468.3, 1031]],
  [[1580, 1007.5], [1645, 1007.5], [1645, 1031], [1580, 1031]],                                   # over the shower
]
# CL door in the kitchen's left mass: a short wall across the closet mouth
cld = W((600, 1258), (649, 1258), 'interior'); O(cld, 603, 640, 'door', hinge='from', side='right')

fixtures = [
  {"type": "fireplace", "at": [1015, 716], "w": 196, "h": 38, "rot": 0},
  {"type": "counter", "at": [744.25, 1502.15], "w": 288.5, "h": 47.3, "rot": 0},
  {"type": "kitchen-sink", "at": [694, 1504], "w": 46, "h": 34, "rot": 0, "bowls": 1},
  {"type": "range", "at": [784.8, 1502.75], "w": 49.6, "h": 42.5, "rot": 0},
  {"type": "refrigerator", "at": [905.75, 1395.25], "w": 63.5, "h": 61.5, "rot": 90},
  {"type": "counter", "at": [734, 1358.3], "w": 144, "h": 82.6, "rot": 0},
  {"type": "counter", "at": [718, 1169.45], "w": 138, "h": 21.9, "rot": 0},
  {"type": "counter", "at": [727.5, 1210.7], "w": 157, "h": 60.6, "rot": 0},
  {"type": "counter", "at": [1504.5, 1164.9], "w": 59, "h": 21, "rot": 0},
  {"type": "toilet", "at": [1513.5, 1143], "w": 38, "h": 64, "rot": 180},
  {"type": "counter", "at": [1556.5, 1156.9], "w": 45, "h": 37, "rot": 0},
  {"type": "round-sink", "at": [1557, 1157], "w": 32, "h": 32, "rot": 180},
  {"type": "shower", "at": [1612.5, 1104.4], "w": 63, "h": 154.75, "rot": 0},
  {"type": "rod", "at": [1666.5, 1094.6], "w": 164, "h": 29, "rot": 90},
]
terrace = rounded([[192.7, 1246.5], [192.7, 356.7], [836.7, 356.7], [836.7, 456.7], [1380.7, 456.7], [1380.7, 356.7], [2020.7, 356.7], [2020.7, 1059], [1843, 1059], [1843, 1116.7], [1755.5, 1116.7]],
                  {1, 2, 5, 6, 7}) + \
  [[1755.5, 742]] + [[round(1681.5 + R * math.cos(math.radians(a)), 1), round(742 + R * math.sin(math.radians(a)), 1)] for a in range(345, 270, -15)] + \
  [[1681.5, 668], [648.5, 668]] + [[round(648.5 + R * math.cos(math.radians(a)), 1), round(742 + R * math.sin(math.radians(a)), 1)] for a in range(255, 180, -15)] + \
  [[574.5, 742], [574.5, 1532.5], [569, 1556], [471, 1556]] + rounded([[471, 1246.5]], set())
areas = [
  {"type": "terrace", "poly": terrace},
  {"type": "stair", "poly": [[1310, 1074], [1375, 1074], [1375, 1238.5], [1310, 1238.5]], "arrow": False, "treads": 10},
]
lines = [
  {"pts": [[898.4, 1090.3], [1082.8, 1090.3], [1082.8, 1110.6], [898.4, 1110.6]], "closed": True},     # BUILT-IN
  {"pts": [[613.5, 1478.5], [613.5, 1525.8]]}, {"pts": [[659.6, 1478.5], [659.6, 1525.8]]},          # DW bay
  {"pts": [[1286.5, 1238.5], [1286.5, 1192], [1310, 1192], [1310, 1238.5]]},                         # box at the stair foot
  {"pts": [[1310, 1074], [1297.5, 1061], [1375, 983.4]]}, {"pts": [[1310, 1074], [1375, 1009]]},     # the stair's turn up
  {"pts": [[1330, 1031], [1342, 1043], [1342, 1105]]}, {"pts": [[1336, 1095], [1342, 1105], [1348, 1095]]},   # UP arrow
  {"pts": [[1311, 1234], [1335, 1221], [1336, 1209], [1342, 1224], [1342, 1213], [1373, 1198]]},     # break line
  {"pts": [[1142, 1281], [1142, 1252]]}, {"pts": [[1136, 1262], [1142, 1252], [1148, 1262]]},       # entry arrow
  {"pts": [[492.5, 1246.5], [492.5, 1556]]},                                                         # terrace planter edge
]
rooms = [
  {"name": "TERRACE", "size": None, "at": [1114, 570], "rot": 0},
  {"name": "LIVING ROOM", "size": "38'5\" x 16'6\"", "at": [998, 935], "rot": 0},
  {"name": "BEDROOM", "size": "17'6\" x 16'0\"", "at": [1579, 851], "rot": 0},
  {"name": "KITCHEN", "size": "17'9\" x 15'0\"", "at": [737, 1440], "rot": 0},
  {"name": "BATH", "at": [1515, 1094], "rot": 0, "box": [1477, 1027, 1580, 1175]},
  {"name": "WIC", "at": [1698, 1060], "rot": 0, "box": [1650, 1012, 1731, 1175]},
]
labels = [{"text": t, "at": a} for t, a in [
  ("FP", [1010, 716]), ("BUILT-IN", [990, 1100.5]), ("UP", [1314, 1018]), ("REF", [912, 1395]), ("DW", [636.5, 1502]),
  ("CL", [622, 1234]), ("CL", [886, 1185]), ("CL", [1073, 1193]), ("CL", [1290, 1272]), ("CL", [1421, 1145]),
  ("CL", [918, 1457]), ("CL", [918, 1505])]]
plan = {"schema": 1, "job": {"label": "555 W59 PHC", "address": "555 West 59th Street, PHC"},
  "sources": [{"file": "Design/floorplan.jpg", "kind": "gvc-old-plan-jpg", "note": "older GVC sheet; traced in its own pixels; header, logo, compass and FIRST FLOOR title left out"}],
  "north": 0,
  "levels": [{"name": None, "walls": walls, "solids": solids, "openings": ops, "fixtures": fixtures, "areas": areas, "rooms": rooms, "labels": labels, "lines": lines}],
  "missing": ["The source says FIRST FLOOR and its stair goes UP, but no upper-floor plan was given, so only this floor is drawn.",
              "The bath's tile pattern and the WIC's colour hangers are decoration in the source and are not part of the house style."],
  "uncertain": ["Kitchen size is printed as 17'9\" x 15' and is written 17'9\" x 15'0\".",
                "The source shows no way into the small hall outside the bath (from the bedroom or the stair); it is drawn as the source has it."]}
json.dump(plan, open(sys.argv[1] if len(sys.argv) > 1 else 'plan.json', 'w'), indent=1)
print(len(walls), 'walls', len(ops), 'openings')
