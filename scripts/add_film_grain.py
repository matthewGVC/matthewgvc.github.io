"""Bake a film-grain finish into the Destination Guide's stock photographs.

The Monmouth surf photograph has a natural grain Matt liked, so every other
county photograph gets a matching one: monochrome luminance grain (sigma ~6.5,
softened slightly so it clumps like film), strongest in the midtones and lighter
in deep shadow and bright highlight. It is baked into the JPEG, not applied in
CSS, so it prints the same in every browser.

    python scripts/add_film_grain.py            # grain any listed photo not yet done
    python scripts/add_film_grain.py --list     # show what is done / pending

Each processed file is recorded in assets/img/nj/.grain-done so it is never
grained twice (grain on grain would build up). To re-grain a photo, replace it
with a clean copy and delete its line from that file.
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img', 'nj')
DONE = os.path.join(ROOT, '.grain-done')
PHOTOS = [
    'monmouth-cover.jpg', 'monmouth-boardwalk.jpg', 'monmouth-beach.jpg', 'monmouth-welcome.jpg',
    'ocean-county-cover.jpg', 'ocean-lagoons.jpg', 'ocean-casino-pier.jpg', 'ocean-dunes.jpg', 'ocean-welcome.jpg',
    'middlesex-cover.jpg', 'middlesex-marsh.jpg', 'middlesex-perth-amboy.jpg', 'middlesex-new-brunswick.jpg', 'middlesex-welcome.jpg',
    'back-shore.jpg',
]
# monmouth-surf.jpg already carries real grain and is left alone.
SIGMA = 6.5


def grain(img, seed):
    rng = np.random.default_rng(seed)
    a = np.asarray(img.convert('RGB'), dtype=np.float32)
    h, w, _ = a.shape
    noise = rng.normal(0, 1, (h, w)).astype(np.float32)
    n = Image.fromarray(((noise * 40) + 128).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    noise = (np.asarray(n, dtype=np.float32) - 128) / 40
    noise /= noise.std() or 1
    lum = a.mean(axis=2) / 255
    mask = 1 - 0.65 * (2 * lum - 1) ** 2
    chroma = rng.normal(0, 0.18, (h, w, 3)).astype(np.float32)
    out = a + ((noise * SIGMA) * mask)[..., None] + chroma * SIGMA * mask[..., None]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def main():
    done = set(open(DONE).read().split()) if os.path.exists(DONE) else set()
    if '--list' in sys.argv:
        for p in PHOTOS:
            print(('done   ' if p in done else 'pending'), p, '' if os.path.exists(os.path.join(ROOT, p)) else '(missing)')
        return
    for i, name in enumerate(PHOTOS):
        path = os.path.join(ROOT, name)
        if name in done or not os.path.exists(path):
            continue
        img = Image.open(path)
        grain(img, 1000 + i).save(path, quality=84, optimize=True, progressive=True, subsampling=2)
        done.add(name)
        print('grained', name, os.path.getsize(path) // 1024, 'KB')
    open(DONE, 'w').write('\n'.join(sorted(done)) + '\n')


if __name__ == '__main__':
    main()
