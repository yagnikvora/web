"""Generate the browser/app icons from the logo.  python scripts/build-favicon.py

Run from `web/`. Reads public/images/Trinetra.png and writes:

  app/favicon.ico       browser tab, 16-64 multi-resolution
  app/icon.png          PWA / Android, 512
  app/apple-icon.png    iOS home screen, 180

Next picks all three up by filename — there is no metadata config to keep in step.

Two decisions worth knowing:

* Only the EMBLEM is used, not the whole logo. The wordmark and the "ANALYZE · INSIGHT ·
  ADVANTAGE" line are illegible below about 64px, so at tab size they would just add mush
  around a shrunken symbol. Measured from the artwork's own alpha profile: the emblem runs
  to y≈875, the wordmark starts at y≈900.

* The emblem is composited onto a rounded-square plate rather than left transparent. Its
  white and pale-gold elements vanish against a light browser tab, and a bare emblem also
  reads as smaller than neighbouring favicons that fill their box.

  A rounded SQUARE, not a circle: a circle inscribed in a 16px frame throws away the
  corners, which is about 21% of the few pixels a tab strip gives you. The plate is nearly
  full-bleed and the emblem is scaled to fill it, so the icon carries the same visual
  weight as the ones beside it.

  It also carries a thin gold rim. Chrome's dark tab strip is close enough to the brand
  navy that a dark plate dissolves into it and only the gold artwork stays visible — the
  rim draws the icon's silhouette so it reads as a tile on light and dark chrome alike.
"""
import io
import os
from PIL import Image, ImageDraw

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(WEB)

SRC = 'public/images/Trinetra.png'
# The emblem band, as fractions of the source so a re-export at another resolution still
# crops correctly. Bottom stops above the wordmark; sides follow the artwork's alpha bbox.
BAND = (0.135, 0.070, 0.865, 0.630)

INSET = 0.94                  # emblem's share of the plate — near full-bleed
PLATE_EDGE = (12, 17, 26)     # plate corners
PLATE_CORE = (26, 35, 52)     # lifted centre, so it isn't a flat block
RIM = (198, 154, 74)          # brand gold, for the defining outline
RADIUS = 0.22                 # corner radius as a fraction of the icon size

src = Image.open(SRC).convert('RGBA')
W, H = src.size
crop = src.crop((round(BAND[0] * W), round(BAND[1] * H), round(BAND[2] * W), round(BAND[3] * H)))
# Tighten to whatever is actually opaque inside that band.
bb = crop.split()[-1].point(lambda v: 255 if v > 30 else 0).getbbox()
emblem = crop.crop(bb) if bb else crop
print(f'source {src.size} -> band crop {crop.size} -> emblem {emblem.size}')


def icon(size: int) -> Image.Image:
    """Emblem on a rounded plate, drawn at 4x and downsampled for clean edges."""
    ss = size * 4
    card = Image.new('RGBA', (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    r = ss * RADIUS

    # Concentric inset rounded rectangles, faking a centre-out gradient. Cheap, and at icon
    # sizes indistinguishable from a real one.
    steps = 40
    for i in range(steps):
        t = i / steps
        inset = (ss / 2) * t * 0.98
        col = tuple(round(PLATE_EDGE[c] + (PLATE_CORE[c] - PLATE_EDGE[c]) * t) for c in range(3)) + (255,)
        d.rounded_rectangle([inset, inset, ss - 1 - inset, ss - 1 - inset],
                            radius=max(1.0, r - inset * RADIUS), fill=col)

    # Emblem first, then the rim on top so the outline is never overdrawn.
    scale = (ss * INSET) / max(emblem.size)
    e = emblem.resize((max(1, round(emblem.width * scale)), max(1, round(emblem.height * scale))), Image.LANCZOS)

    # Lift the artwork at tab sizes. Downsampling to 16px averages the gold filigree with
    # the dark ground between its strokes, and the result is a muddy blur — the emblem
    # loses most of its brightness to detail that no longer fits. Boosting before the
    # downsample puts that back. Tapered to nothing by 64px, where the detail survives on
    # its own and a boost would only look blown out.
    if size < 64:
        from PIL import ImageEnhance
        k = (64 - size) / 48                       # 1.0 at 16px, 0 at 64px
        rgb, alpha = e.convert('RGB'), e.split()[-1]
        rgb = ImageEnhance.Brightness(rgb).enhance(1 + 0.42 * k)
        rgb = ImageEnhance.Color(rgb).enhance(1 + 0.30 * k)
        e = Image.merge('RGBA', (*rgb.split(), alpha))

    card.alpha_composite(e, ((ss - e.width) // 2, (ss - e.height) // 2))

    # Rim thickness scales with the icon, with a floor so it survives the 16px downsample.
    w = max(ss * 0.028, 3.0)
    d.rounded_rectangle([w / 2, w / 2, ss - 1 - w / 2, ss - 1 - w / 2],
                        radius=r, outline=RIM + (255,), width=round(w))

    return card.resize((size, size), Image.LANCZOS)


def save_ico(sizes: list[int], path: str) -> None:
    """Write a multi-resolution ICO, each entry rendered at its own size.

    Pillow's own `save(sizes=[...])` downsamples ONE image to every entry, which would
    defeat the whole point here — the per-size boost above would never reach the 16px
    entry, because that entry would just be a shrink of the 64px one. Writing the container
    by hand is a header, a directory and a PNG per size.
    """
    import struct
    pngs = []
    for s in sizes:
        buf = io.BytesIO()
        icon(s).save(buf, format='PNG', optimize=True)   # PNG payloads: valid ICO since Vista
        pngs.append(buf.getvalue())

    header = struct.pack('<HHH', 0, 1, len(sizes))       # reserved, type=icon, count
    offset = len(header) + 16 * len(sizes)
    entries, blobs = b'', b''
    for s, png in zip(sizes, pngs):
        entries += struct.pack('<BBBBHHII', s if s < 256 else 0, s if s < 256 else 0,
                               0, 0, 1, 32, len(png), offset)
        blobs += png
        offset += len(png)

    with open(path, 'wb') as f:
        f.write(header + entries + blobs)


icon(512).save('app/icon.png', optimize=True)
icon(180).save('app/apple-icon.png', optimize=True)
# Multi-resolution: a browser downsampling one large PNG to 16px is what makes favicons
# look muddy, so each tab-strip size is drawn for itself.
save_ico([16, 24, 32, 48, 64], 'app/favicon.ico')

for f in ('app/favicon.ico', 'app/icon.png', 'app/apple-icon.png'):
    print(f'{f:<20} {os.path.getsize(f):,} bytes')
