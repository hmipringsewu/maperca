"""Builds the QR codes that open the Open Recruitment site.

Output goes to design/qr/:
  qr-open-recruitment.svg / .png        plain code, best for small print
  qr-open-recruitment-logo.svg / .png   same address with the HMI emblem in the middle

The modules come from OpenCV's QR encoder, so this needs only numpy,
opencv-python and Pillow. Every file is decoded again at the end to prove it
still opens the address, including shrunk, blurred and tilted copies.

Run from the project root:  python design/build_qr.py
"""
import base64
import io
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "design" / "qr"
EMBLEM = ROOT / "public" / "images" / "hmi-pringsewu.png"
URL = "https://hmipringsewu.github.io/maperca/"
INK = "#18251f"       # the site's ink colour; near-black keeps the contrast scanners need
PAPER = "#ffffff"
QUIET = 4             # modules of empty border the QR standard asks for


def modules(url: str, level: int) -> np.ndarray:
    """Dark modules as a boolean matrix, trimmed to the symbol itself."""
    params = cv2.QRCodeEncoder_Params()
    params.correction_level = level
    img = cv2.QRCodeEncoder.create(params).encode(url)
    dark = img == 0
    ys, xs = np.nonzero(dark)
    m = dark[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
    assert m.shape[0] == m.shape[1], m.shape
    n = m.shape[0]
    assert (n - 17) % 4 == 0, f"unexpected size {n}"
    finder = np.array([[1] * 7, [1, 0, 0, 0, 0, 0, 1], [1, 0, 1, 1, 1, 0, 1], [1, 0, 1, 1, 1, 0, 1],
                       [1, 0, 1, 1, 1, 0, 1], [1, 0, 0, 0, 0, 0, 1], [1] * 7], bool)
    for r, c in ((0, 0), (0, n - 7), (n - 7, 0)):
        assert (m[r: r + 7, c: c + 7] == finder).all(), "finder pattern missing: matrix read wrongly"
    return m


def logo_box(n: int) -> tuple[int, int, int, int]:
    """Centre rectangle (x, y, width, height) in modules left clear for the emblem.
    The emblem is tall and narrow, so the hole is too: fewer lost modules than a square."""
    h = max(7, round(n * 0.25))
    h += (n - h) % 2
    w = max(5, round(h * 0.78))
    w += (n - w) % 2
    return (n - w) // 2, (n - h) // 2, w, h


def in_clear(x: int, y: int, box) -> bool:
    """True for modules inside the hole plus one module of white margin around it."""
    bx, by, bw, bh = box
    return bx - 1 <= x < bx + bw + 1 and by - 1 <= y < by + bh + 1


def svg(m: np.ndarray, logo: bool) -> str:
    n = m.shape[0]
    total = n + 2 * QUIET
    box = logo_box(n) if logo else None
    path = []
    for y in range(n):
        x = 0
        while x < n:
            if m[y, x] and not (box and in_clear(x, y, box)):
                start = x
                while x < n and m[y, x] and not (box and in_clear(x, y, box)):
                    x += 1
                path.append(f"M{start + QUIET} {y + QUIET}h{x - start}v1h-{x - start}z")
            else:
                x += 1
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" width="1000" height="1000" role="img" aria-labelledby="t">',
        f'<title id="t">QR code to {URL}</title>',
        f'<rect width="{total}" height="{total}" fill="{PAPER}"/>',
        f'<path fill="{INK}" shape-rendering="crispEdges" d="{"".join(path)}"/>',
    ]
    if box:
        bx, by, bw, bh = box[0] + QUIET, box[1] + QUIET, box[2], box[3]
        em = Image.open(EMBLEM).convert("RGBA")
        em.thumbnail((240, 360))
        buf = io.BytesIO()
        em.save(buf, "PNG", optimize=True)
        data = base64.b64encode(buf.getvalue()).decode()
        h = bh - 1.2
        w = h * em.width / em.height
        parts.append(f'<image x="{bx + (bw - w) / 2:.3f}" y="{by + (bh - h) / 2:.3f}" width="{w:.3f}" height="{h:.3f}" href="data:image/png;base64,{data}"/>')
    parts.append("</svg>")
    return "".join(parts)


def png(m: np.ndarray, logo: bool, target: int = 2000) -> Image.Image:
    n = m.shape[0]
    total = n + 2 * QUIET
    k = target // total
    im = Image.new("RGB", (total * k, total * k), PAPER)
    d = ImageDraw.Draw(im)
    box = logo_box(n) if logo else None
    for y in range(n):
        for x in range(n):
            if m[y, x] and not (box and in_clear(x, y, box)):
                d.rectangle(((x + QUIET) * k, (y + QUIET) * k, (x + QUIET + 1) * k - 1, (y + QUIET + 1) * k - 1), fill=INK)
    if box:
        bx, by, bw, bh = (box[0] + QUIET) * k, (box[1] + QUIET) * k, box[2] * k, box[3] * k
        em = Image.open(EMBLEM).convert("RGBA")
        h = int(bh - 1.2 * k)
        w = int(h * em.width / em.height)
        em = em.resize((w, h), Image.Resampling.LANCZOS)
        im.paste(em, (bx + (bw - w) // 2, by + (bh - h) // 2), em)
    return im


def decode(img_bgr: np.ndarray) -> str:
    text, _, _ = cv2.QRCodeDetector().detectAndDecode(img_bgr)
    return text


def check(path: Path):
    img = cv2.imread(str(path))
    cases = {"as exported": img}
    for px in (400, 220):
        cases[f"shrunk to {px}px"] = cv2.resize(img, (px, px), interpolation=cv2.INTER_AREA)
    cases["blurred (shrunk to 400px, sigma 2)"] = cv2.GaussianBlur(cases["shrunk to 400px"], (0, 0), 2)
    h, w = img.shape[:2]
    rot = cv2.warpAffine(img, cv2.getRotationMatrix2D((w / 2, h / 2), 12, 0.8), (w, h), borderValue=(255, 255, 255))
    cases["tilted 12 degrees"] = rot
    ok, buf = cv2.imencode(".jpg", cases["shrunk to 400px"], [cv2.IMWRITE_JPEG_QUALITY, 40])
    cases["jpeg quality 40"] = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    bad = []
    for name, im in cases.items():
        got = decode(im)
        status = "ok" if got == URL else f"FAILED (got {got!r})"
        print(f"  {path.name:34s} {name:36s} {status}")
        if got != URL:
            bad.append(name)
    return bad


def svg_to_matrix_check(svg_text: str, m: np.ndarray):
    """Read the exported SVG back and make sure it draws the same modules."""
    n = m.shape[0]
    grid = np.zeros_like(m)
    for x, y, w in re.findall(r"M(\d+) (\d+)h(\d+)v1h-\d+z", svg_text):
        grid[int(y) - QUIET, int(x) - QUIET: int(x) - QUIET + int(w)] = True
    return grid, n


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    failures = []
    for name, level, logo in (("qr-open-recruitment", cv2.QRCodeEncoder_CORRECT_LEVEL_Q, False),
                              ("qr-open-recruitment-logo", cv2.QRCodeEncoder_CORRECT_LEVEL_H, True)):
        m = modules(URL, level)
        s = svg(m, logo)
        (OUT / f"{name}.svg").write_text(s, encoding="utf-8")
        png(m, logo).save(OUT / f"{name}.png", optimize=True)
        print(f"{name}: {m.shape[0]}x{m.shape[0]} modules, level {'H' if logo else 'Q'}")
        grid, n = svg_to_matrix_check(s, m)
        if not logo:
            assert (grid == m).all(), "SVG does not draw the same modules as the matrix"
            print("  svg draws exactly the encoder's modules")
        failures += check(OUT / f"{name}.png")
    if failures:
        raise SystemExit(f"{len(failures)} scan test(s) failed: {failures}")
    print("all scan tests passed")


if __name__ == "__main__":
    main()
