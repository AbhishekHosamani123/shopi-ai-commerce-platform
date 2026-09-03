#!/usr/bin/env python3
"""
Shopi campaign banner generator — Option C (pre-baked discount bases).

The DISCOUNT text ("<N>% OFF") comes from a pre-generated base image that a
human produced offline with perfect quality control. This script's ONLY
runtime job is to overlay the personalized greeting ("Hey <FirstName>") onto
that base, inside the same measured greeting area, in the template's navy.

The base image per discount value is chosen by the Node service using the
APPROVED campaign discount — this script never computes, clamps or invents
a discount, and it never renders discount text.

Input (argv):
  --name <customer name>        required (first name is used for the greeting)
  --base <path>                  required; the pre-baked discount base image
  --out <path>                   required; output PNG path
  --font-dir <path>              default: fonts/ next to script
  --preview                      include geometry in the JSON output

Output (stdout): JSON with the EXACT rendered values and file hashes so the
caller can audit that the banner matches the approved campaign data.
"""

import argparse
import hashlib
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

# Template version — bump when the base artwork or the greeting box changes.
# v4: Option C — pre-baked discount bases; runtime renders only the name.
BANNER_TEMPLATE_VERSION = "v4"

# ---------------------------------------------------------------------------
# Greeting geometry (measured on the pre-baked base artwork, 1536x1024): the
# reference greeting glyphs occupy x100-638, rows y170-250, with descenders
# reaching y265. The erase/draw zone is padded to y292 so a full-height
# replacement (font 92 incl. descender, bottom ≈ y273) is always erased and
# contained — nothing spills onto the artwork below.
# ---------------------------------------------------------------------------
BASE_W, BASE_H = 1536, 1024

GREETING_BOX = (85, 158, 680, 292)          # erase/draw zone around the glyphs
GREETING_TEXT_ORIGIN = (100, 170)           # top-left where text is drawn
GREETING_COLOR = (5, 27, 56)                # navy from the reference artwork
GREETING_BASE_SIZE = 92                    # matches the reference glyph height
GREETING_SHADOW = (210, 205, 215)           # soft shadow beneath the glyphs

# Text-pixel mask inside the greeting box (navy family; artwork elsewhere).
GREETING_MASK = lambda r, g, b: r < 70 and g < 80 and 30 < b < 110

# Background fill sampled from the clean area around the greeting.
GREETING_BG = (245, 241, 245)

MAX_RENDER_ITERATIONS = 24


def load_font(font_dir, size):
    bold = os.path.join(font_dir, "banner-bold.ttf")
    if os.path.exists(bold):
        return ImageFont.truetype(bold, size)
    return ImageFont.load_default()


def first_name(raw):
    """The greeting uses the customer's FIRST name: 'Aarav Sharma' → 'Hey Aarav'
    (matches the reference design's short greeting and guarantees no overflow)."""
    if not raw or not str(raw).strip():
        return "Valued Customer"
    name = " ".join(str(raw).split())
    return name.split()[0]


def fit_font(draw, text, box_w, box_h, base_size, font_dir, min_ratio=0.45):
    """Shrink the font until the text fits the budget. Returns (font, size)."""
    size = base_size
    for _ in range(MAX_RENDER_ITERATIONS):
        font = load_font(font_dir, size)
        x0, y0, x1, y1 = draw.textbbox((0, 0), text, font=font)
        w, h = x1 - x0, y1 - y0
        if w <= box_w and h <= box_h:
            return font, size
        if size <= max(10, int(base_size * min_ratio)):
            return font, size
        size -= 2
    return load_font(font_dir, size), size


def generate(base_path, out_path, name, font_dir, preview=False):
    img = Image.open(base_path).convert("RGB")
    if img.size != (BASE_W, BASE_H):
        img = img.resize((BASE_W, BASE_H), Image.LANCZOS)

    # ---- Clear the greeting area, then draw the recipient's name ----------
    first = first_name(name)
    greeting = f"Hey {first}"

    px = img.load()
    x0, y0, x1, y1 = GREETING_BOX
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b = px[x, y][:3]
            if GREETING_MASK(r, g, b):
                px[x, y] = GREETING_BG

    draw = ImageDraw.Draw(img)
    # True width budget: origin → box right edge (the erase box is wider than
    # the drawn text start, so measure from the origin to avoid overflow).
    gw = GREETING_BOX[2] - GREETING_TEXT_ORIGIN[0]
    gh = GREETING_BOX[3] - GREETING_TEXT_ORIGIN[1]
    gfont, gsize = fit_font(draw, greeting, gw - 8, gh - 8, GREETING_BASE_SIZE, font_dir)
    draw.text((GREETING_TEXT_ORIGIN[0] + 2, GREETING_TEXT_ORIGIN[1] + 2), greeting, font=gfont, fill=GREETING_SHADOW)
    draw.text(GREETING_TEXT_ORIGIN, greeting, font=gfont, fill=GREETING_COLOR)

    # ---- Save -------------------------------------------------------------
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    img.save(out_path, "PNG", optimize=True)

    with open(out_path, "rb") as f:
        content_hash = hashlib.sha256(f.read()).hexdigest()[:16]
    with open(base_path, "rb") as f:
        base_hash = hashlib.sha256(f.read()).hexdigest()[:16]

    result = {
        "success": True,
        "templateVersion": BANNER_TEMPLATE_VERSION,
        "outPath": os.path.abspath(out_path),
        "width": img.size[0],
        "height": img.size[1],
        "sha256_16": content_hash,
        "baseSha256_16": base_hash,
        # Exact rendered values — the caller validates these against the
        # approved campaign object before allowing the send.
        "renderedName": first,
        "renderedGreeting": greeting,
        "greetingFontSize": gsize,
        "inputNameRaw": str(name) if name else "",
        "inputBasePath": os.path.abspath(base_path),
    }

    if preview:
        result["geometry"] = {"greetingBox": GREETING_BOX}
    return result


def main():
    # NOTE: Python 3.14's argparse raises "ValueError: badly formed help
    # string" when a help/description string contains a literal '%' followed
    # by characters it tries to interpolate (observed on Render's Python
    # 3.14.3 with the '<N>% OFF' help text below). Keep help strings
    # %-sign-free; the overlay logic is unaffected.
    ap = argparse.ArgumentParser(description="Shopi banner name overlay (Option C)")
    ap.add_argument("--name", required=True, help="Campaign recipient customer name")
    ap.add_argument("--base", required=True, help="Pre-baked discount base image (already contains the discount text)")
    ap.add_argument("--font-dir", default=None)
    ap.add_argument("--out", required=True)
    ap.add_argument("--preview", action="store_true")
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    font_dir = args.font_dir or os.path.join(here, "fonts")

    if not os.path.exists(args.base):
        print(json.dumps({"success": False, "error": f"Base image not found: {args.base}"}))
        sys.exit(2)

    try:
        result = generate(args.base, args.out, args.name, font_dir, args.preview)
        print(json.dumps(result))
    except Exception as e:  # surfaced to the Node service, which falls back
        print(json.dumps({"success": False, "error": f"{type(e).__name__}: {e}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
