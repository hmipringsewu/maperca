"""Builds the "OPEN RECRUITMENT" hero title in the style of the MAPERCA title.

The new title reuses what already exists in design/exec-1de8301c-*.png:
  * the real cut-out letters P (gold), E, R, C and M
  * the grain of the stone/paper texture, harvested from inside the real letters
  * optionally the subtitle line (WITH_SUBTITLE), with the doubled "G" of "PENGGENALAN" removed
Letters the original word does not contain (O, N, U, I, T) are drawn as angular,
slightly irregular polygons, filled with that harvested texture, and given the
same thin dark outline.

Run from the project root:  python design/build_open_recruitment.py
Needs numpy, opencv-python and Pillow.
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design" / "exec-1de8301c-29b0-411a-bbd6-9fb7885177d0.png"
OUT_MASTER = ROOT / "design" / "open-recruitment-judul.png"
OUT_WEB = ROOT / "public" / "images" / "open-recruitment-judul.webp"
SEED = 11
WITH_SUBTITLE = False  # the "MASA PENGENALAN CALON ANGGOTA" line under the title

H = 470  # cap height of the original letters, in source pixels
OUTLINE = np.array([98, 94, 90], np.float32)

rng = np.random.default_rng(SEED)
src = np.array(Image.open(SRC).convert("RGBA"))
alpha = src[..., 3]
rgb = src[..., :3].astype(np.float32)

count, lab, stats, _ = cv2.connectedComponentsWithStats((alpha > 128).astype(np.uint8), connectivity=8)
big = sorted((i for i in range(1, count) if stats[i][3] > 300), key=lambda i: stats[i][0])
small = sorted((i for i in range(1, count) if 150 < stats[i][4] < 3000 and stats[i][3] < 100), key=lambda i: stats[i][0])
assert len(big) == 7, f"expected 7 big letters, found {len(big)}"
assert len(small) == 27, f"expected 27 subtitle glyphs, found {len(small)}"
BIG = dict(zip(["M", "A1", "P", "E", "R", "C", "A2"], big))


def cutout(i: int) -> np.ndarray:
    """One real letter as straight-alpha RGBA, soft edge kept."""
    x, y, w, h = stats[i][:4]
    grown = cv2.dilate((lab == i).astype(np.uint8), np.ones((7, 7), np.uint8))
    layer = src.copy()
    layer[..., 3] = (alpha.astype(np.float32) * grown).astype(np.uint8)
    return layer[max(0, y - 6): y + h + 6, max(0, x - 6): x + w + 6]


# ---- texture harvested from the inside of the real (non-gold) letters --------
PS = 48
inside = np.zeros(alpha.shape, np.uint8)
for name, i in BIG.items():
    if name != "P":
        inside |= (lab == i).astype(np.uint8)
inside = cv2.erode(inside, np.ones((17, 17), np.uint8))
fit = cv2.erode(inside, np.ones((PS, PS), np.uint8))
cand_y, cand_x = np.nonzero(fit)
assert len(cand_y) > 200, "not enough clean interior to harvest texture"


def quilt(h: int, w: int) -> np.ndarray:
    """Cross-fades random real patches; scratches keep their diagonal direction."""
    ramp = np.minimum(1.0, (np.minimum(np.arange(PS), PS - 1 - np.arange(PS)) + 1) / 10.0)
    win = np.outer(ramp, ramp)[..., None].astype(np.float32)
    acc = np.zeros((h + PS, w + PS, 3), np.float32)
    wsum = np.zeros((h + PS, w + PS, 1), np.float32)
    step = 30
    for y in range(0, h, step):
        for x in range(0, w, step):
            k = rng.integers(len(cand_y))
            cy, cx = cand_y[k], cand_x[k]
            patch = rgb[cy - PS // 2: cy + PS // 2, cx - PS // 2: cx + PS // 2]
            acc[y: y + PS, x: x + PS] += patch * win
            wsum[y: y + PS, x: x + PS] += win
    return (acc / np.maximum(wsum, 1e-3))[:h, :w]


# ---- angular letters the original word does not have --------------------------
def glyphs():
    S = 92  # stem
    def box(x0, y0, x1, y1):
        return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

    def chamfered(x0, y0, x1, y1, c):
        return [(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c), (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)]

    W = int(H * 0.62)
    so, sb = 86, 84
    yield "O", W, [chamfered(0, 0, W, H, 46)], [chamfered(so, sb, W - so, H - sb, 20)]
    W = int(H * 0.6)
    yield "U", W, [[(0, 0), (W, 0), (W, H - 46), (W - 46, H), (46, H), (0, H - 46)]], \
        [[(so + 2, -4), (W - so - 2, -4), (W - so - 2, H - sb - 20), (W - so - 22, H - sb), (so + 22, H - sb), (so + 2, H - sb - 20)]]
    W = int(H * 0.62)
    yield "N", W, [box(0, 0, S, H), box(W - S, 0, W, H), [(0, 0), (S * 1.3, 0), (W, H), (W - S * 1.3, H)]], []
    yield "I", S + 6, [box(0, 0, S + 6, H)], []
    W = int(H * 0.64)
    yield "T", W, [box(0, 0, W, sb + 6), box((W - S) / 2, 0, (W + S) / 2, H)], []


def render_glyph(polys_add, polys_sub, width: int, shear: float) -> np.ndarray:
    pad = int(H * shear) + 28
    cw, ch = width + pad * 2, H + 56
    k = 3  # supersample for clean edges
    mask = np.zeros((ch * k, cw * k), np.uint8)

    def prep(poly):
        pts = np.array(poly, np.float32) + rng.normal(0, 3.5, (len(poly), 2)).astype(np.float32)
        pts[:, 0] += (H - pts[:, 1]) * shear  # lean to the right, like the real letters
        pts += np.array([pad, 28], np.float32)
        return (pts * k).astype(np.int32)

    for poly in polys_add:
        cv2.fillPoly(mask, [prep(poly)], 255)
    for poly in polys_sub:
        cv2.fillPoly(mask, [prep(poly)], 0)
    mask = cv2.resize(mask, (cw, ch), interpolation=cv2.INTER_AREA).astype(np.float32)

    # a hand-cut edge: nudge the outline with smooth noise
    dx = cv2.resize(rng.normal(0, 1, (ch // 22 + 2, cw // 22 + 2)).astype(np.float32), (cw, ch), interpolation=cv2.INTER_CUBIC) * 1.3
    dy = cv2.resize(rng.normal(0, 1, (ch // 22 + 2, cw // 22 + 2)).astype(np.float32), (cw, ch), interpolation=cv2.INTER_CUBIC) * 1.3
    gx, gy = np.meshgrid(np.arange(cw, dtype=np.float32), np.arange(ch, dtype=np.float32))
    mask = cv2.remap(mask, gx + dx, gy + dy, cv2.INTER_LINEAR, borderValue=0)

    tex = quilt(ch, cw)
    inner = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=2)
    edge = np.clip((mask - inner) / 255.0, 0, 1)[..., None] * 0.85
    color = tex * (1 - edge) + OUTLINE * edge
    out = np.dstack([np.clip(color, 0, 255), mask]).astype(np.uint8)
    ys, xs = np.nonzero(mask > 8)
    return out[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]


def transform(layer: np.ndarray, scale: float = 1.0, angle: float = 0.0) -> np.ndarray:
    """Scale/rotate straight-alpha RGBA without dark fringes (premultiplied)."""
    f = layer.astype(np.float32)
    f[..., :3] *= f[..., 3:4] / 255.0
    h, w = f.shape[:2]
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, scale)
    nw, nh = int(np.ceil(w * scale + h * 0.1)) + 4, int(np.ceil(h * scale + w * 0.1)) + 4
    m[0, 2] += nw / 2 - w / 2
    m[1, 2] += nh / 2 - h / 2
    warped = cv2.warpAffine(f, m, (nw, nh), flags=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC, borderValue=(0, 0, 0, 0))
    a = warped[..., 3:4]
    warped[..., :3] = np.where(a > 0.5, warped[..., :3] / np.maximum(a / 255.0, 1e-3), 0)
    out = np.clip(warped, 0, 255).astype(np.uint8)
    ys, xs = np.nonzero(out[..., 3] > 8)
    return out[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]


def build_letters():
    made = {}
    for name, width, add, sub in glyphs():
        made[name] = (width, add, sub)
    real = {n: cutout(BIG[k]) for n, k in (("P", "P"), ("E", "E"), ("R", "R"), ("C", "C"), ("M", "M"))}

    def letter(ch: str, scale: float, variant: int) -> np.ndarray:
        if ch in real:
            wobble = (0.0, 1.1, -1.0, 0.7)[variant % 4] if variant else 0.0
            return transform(real[ch], scale, wobble)
        width, add, sub = made[ch]
        shear = float(rng.uniform(0.045, 0.1))
        return transform(render_glyph(add, sub, width, shear), scale, float(rng.uniform(-0.8, 0.8)))

    return letter


def subtitle_without_double_g() -> np.ndarray:
    """MASA PENGGENALAN CALON ANGGOTA -> MASA PENGENALAN CALON ANGGOTA."""
    xs = [stats[i][0] for i in small]
    xe = [stats[i][0] + stats[i][2] for i in small]
    g_first, e_after = 7, 9  # P4 E5 N6 G7 G8 E9: drop the second G (index 8)
    cut_from = (xe[g_first] + xs[g_first + 1]) // 2  # gap between the two G
    cut_to = (xe[g_first + 1] + xs[e_after]) // 2   # gap after the second G
    y0, y1 = 590, 672
    band = src[y0:y1, xs[0] - 10: xe[-1] + 10]
    off = xs[0] - 10
    left, right = band[:, : cut_from - off], band[:, cut_to - off:]
    return np.concatenate([left, right], axis=1)


def place(canvas: Image.Image, layer: np.ndarray, x: int, y_mid: int):
    h = layer.shape[0]
    canvas.alpha_composite(Image.fromarray(layer, "RGBA"), (int(x), int(y_mid - h // 2)))


def main():
    letter = build_letters()
    CW, CH = 2240, 1120
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))

    # line 1: OPEN, at the original letter size
    top = [letter(c, 1.0, 0) for c in "OPEN"]
    gap1 = 16
    total = sum(l.shape[1] for l in top) + gap1 * (len(top) - 1)
    x = (CW - total) // 2
    for l in top:
        place(canvas, l, x, 32 + 270)
        x += l.shape[1] + gap1

    # line 2: RECRUITMENT, smaller, spanning the width
    sc = 0.665
    seen: dict[str, int] = {}
    low = []
    for c in "RECRUITMENT":
        seen[c] = seen.get(c, 0) + 1
        low.append(letter(c, sc, seen[c] - 1))
    gap2 = 12
    total = sum(l.shape[1] for l in low) + gap2 * (len(low) - 1)
    x = (CW - total) // 2
    for l in low:
        place(canvas, l, x, 590 + 160)
        x += l.shape[1] + gap2

    if WITH_SUBTITLE:
        sub_img = Image.fromarray(subtitle_without_double_g(), "RGBA")
        canvas.alpha_composite(sub_img, ((CW - sub_img.width) // 2, 945))

    bbox = canvas.getbbox()
    canvas = canvas.crop((max(0, bbox[0] - 12), max(0, bbox[1] - 12), min(CW, bbox[2] + 12), min(CH, bbox[3] + 12)))
    canvas.save(OUT_MASTER, optimize=True)
    web = canvas.resize((1400, round(canvas.height * 1400 / canvas.width)), Image.Resampling.LANCZOS)
    web.save(OUT_WEB, quality=88, method=6)
    print("master", canvas.size, "web", web.size, OUT_WEB.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
