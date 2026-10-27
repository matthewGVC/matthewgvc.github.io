"""Tests for scripts/floorplan/clean_solids.py: wall cleaning, squared corners and ends, measuring.
Plain Python:  python -I scripts/test-clean-solids.py   (needs shapely, numpy, Pillow)
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'floorplan'))
import clean_solids as C

passed, failed = 0, []
def check(name, got, want):
    global passed
    if got == want: passed += 1
    else: failed.append('%s\n      expected %r\n      got      %r' % (name, want, got))

# a wall 10 px thick measures 10 (the raster fills both edge pixels: hi - lo, not the pixel count)
M = C.mask([[[[10, 20], [50, 20], [50, 30], [10, 30]]]], (60, 60))
check('band: a wall from y 20 to 30 is 10 thick, centred on 25', C.band(M, 30, 25, True), (25, 10))
# a short diagonal between a horizontal and a vertical edge becomes their corner
check('square: a chamfer becomes a corner', C.square([[0, 0], [100, 0], [100, 40], [96, 44], [0, 44]]), [[0, 0], [100, 0], [100, 44], [0, 44]])
# a wall end stepped half way across (a jog) runs straight along its longer edge
check('square: a jog at a wall end straightens', C.square([[365, 148], [542, 148], [542, 140], [548, 131], [548, 116], [358, 116]]),
      [[365, 148], [548, 148], [548, 116], [358, 116]])
# snapping never collapses a wall on a busy plan: many edges a few pixels apart stay apart
snap = C._cluster(list(range(0, 100, 5)), 7)
check('clean: a snapping group never spans more than the tolerance', max(v - k for k, v in snap.items()) <= 7 and max(k - v for k, v in snap.items()) <= 7, True)
# a window cut into a wall: the wall ends square at its ends, and a slanted end is squared off
wall = [[[[0, 0], [200, 0], [200, 20], [130, 20], [124, 26], [0, 26]]]]   # slanted near the window's end
sq = C.square_ends(wall, [{'a': [60, 13], 'b': [120, 13], 't': 26}])
xs = sorted({p[0] for s in sq for r in s for p in r})
check('square_ends: the wall is cut at the window\'s ends', 60 in xs and 120 in xs, True)
check('square_ends: two pieces either side', len(sq), 2)

if failed:
    print('\n'.join(failed)); print('%d passed, %d FAILED' % (passed, len(failed))); sys.exit(1)
print('%d passed' % passed)
