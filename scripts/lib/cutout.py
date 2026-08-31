"""Turn a scanned page into a sticker with the paper keyed out.

Old plates and engravings sit on cream paper. Rather than cutting a hard outline,
which looks like a bad selection, this keys the paper to transparent by how far each
pixel departs from it. Ink keeps its own grain and the edges stay soft, so the result
reads as something lifted off the page rather than a pasted rectangle.
"""

import sys
import numpy as np
from PIL import Image


def paper_reference(rgb: np.ndarray) -> np.ndarray:
    """Estimate the paper colour from the border, where art rarely reaches."""
    band = max(4, min(rgb.shape[0], rgb.shape[1]) // 24)
    edges = np.concatenate(
        [
            rgb[:band].reshape(-1, 3),
            rgb[-band:].reshape(-1, 3),
            rgb[:, :band].reshape(-1, 3),
            rgb[:, -band:].reshape(-1, 3),
        ]
    )
    return np.median(edges, axis=0)


def build_alpha(rgb: np.ndarray, gain: float, softness: float) -> np.ndarray:
    paper = paper_reference(rgb)
    paper_lum = float(0.299 * paper[0] + 0.587 * paper[1] + 0.114 * paper[2])

    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    # how much darker than the paper this pixel is
    darkness = np.clip((paper_lum - lum) / max(paper_lum * softness, 1.0), 0.0, 1.0)

    # coloured ink can be as light as the paper, so distance from the paper hue counts too
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    paper_spread = float(paper.max() - paper.min())
    colourfulness = np.clip((spread - paper_spread) / 26.0, 0.0, 1.0)

    alpha = np.clip(np.maximum(darkness, colourfulness) * gain, 0.0, 1.0)
    return alpha


def trim(image: Image.Image, threshold: int = 8) -> Image.Image:
    alpha = np.array(image.getchannel("A"))
    rows = np.where(alpha.max(axis=1) > threshold)[0]
    cols = np.where(alpha.max(axis=0) > threshold)[0]
    if rows.size == 0 or cols.size == 0:
        return image
    pad = 4
    top = max(0, int(rows[0]) - pad)
    bottom = min(image.height, int(rows[-1]) + 1 + pad)
    left = max(0, int(cols[0]) - pad)
    right = min(image.width, int(cols[-1]) + 1 + pad)
    return image.crop((left, top, right, bottom))


def as_card(source: str, destination: str, max_width: int) -> "tuple[int, int]":
    """Keep a photograph or a stamp as the rectangle it actually is.

    Keying a photograph does not cut anything out, because a photograph is dark
    across the whole frame. It only eats holes in the sky. In a real collage a
    print is pasted down whole, so it keeps its edges and gets a paper mat.
    """
    image = Image.open(source).convert("RGB")
    if image.width > max_width:
        ratio = max_width / image.width
        image = image.resize(
            (max_width, max(1, round(image.height * ratio))), Image.LANCZOS
        )

    mat = 5
    out = Image.new(
        "RGBA", (image.width + mat * 2, image.height + mat * 2), (247, 239, 220, 255)
    )
    out.paste(image, (mat, mat))
    out.save(destination, "WEBP", quality=80, method=6)
    return out.width, out.height


def cut_out(
    source: str,
    destination: str,
    gain: float = 1.65,
    softness: float = 0.42,
    max_width: int = 460,
) -> "tuple[int, int]":
    image = Image.open(source).convert("RGB")
    rgb = np.asarray(image).astype(np.float32)

    alpha = build_alpha(rgb, gain, softness)
    out = Image.fromarray(
        np.dstack([np.asarray(image), (alpha * 255).astype(np.uint8)]), "RGBA"
    )
    out = trim(out)

    if out.width > max_width:
        ratio = max_width / out.width
        out = out.resize(
            (max_width, max(1, round(out.height * ratio))), Image.LANCZOS
        )

    out.save(destination, "WEBP", quality=80, method=6)
    return out.width, out.height


if __name__ == "__main__":
    import json

    source, destination = sys.argv[1], sys.argv[2]
    gain = float(sys.argv[3]) if len(sys.argv) > 3 else 1.65
    softness = float(sys.argv[4]) if len(sys.argv) > 4 else 0.42
    max_width = int(sys.argv[5]) if len(sys.argv) > 5 else 460
    mode = sys.argv[6] if len(sys.argv) > 6 else "key"
    if mode == "card":
        width, height = as_card(source, destination, max_width)
    else:
        width, height = cut_out(source, destination, gain, softness, max_width)
    print(json.dumps({"width": width, "height": height}))
