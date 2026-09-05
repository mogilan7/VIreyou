from PIL import Image, ImageDraw, ImageFont
import os, math

W, H = 1080, 1350
PAD = 80

# VIReYou brand palette
BG_CREAM   = "#F5F1EB"
BG_YELLOW  = "#EEECD7"
BG_GREEN   = "#E8EDE3"
BG_WHITE   = "#FAFAF8"
TEXT_DARK  = "#3D4A3E"
ACCENT     = "#B8956A"
LEAF_DARK  = "#5C7A5E"
LEAF_MID   = "#7A9E7E"
LEAF_LIGHT = "#A8C5AA"

PALETTES = {
    "cream":  BG_CREAM,
    "yellow": BG_YELLOW,
    "green":  BG_GREEN,
    "white":  BG_WHITE,
}

FONT_DIR = os.environ.get("VIREYOU_FONT_DIR", "/usr/share/fonts/truetype/")

def _font(style, size):
    candidates = {
        "serif":        ["PlayfairDisplay-Regular.ttf", "Georgia.ttf", "DejaVuSerif.ttf"],
        "serif_bold":   ["PlayfairDisplay-Bold.ttf", "Georgia Bold.ttf", "DejaVuSerif-Bold.ttf"],
        "serif_italic": ["PlayfairDisplay-Italic.ttf", "Georgia Italic.ttf", "DejaVuSerif-Italic.ttf"],
        "sans":         ["Inter-Regular.ttf", "Arial.ttf", "DejaVuSans.ttf"],
        "sans_bold":    ["Inter-Bold.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"],
    }
    for fname in candidates.get(style, candidates["sans"]):
        for root, dirs, files in os.walk(FONT_DIR):
            if fname in files:
                try:
                    return ImageFont.truetype(os.path.join(root, fname), size)
                except:
                    pass
    return ImageFont.load_default()

def _draw_leaves(img, position="top_right"):
    draw = ImageDraw.Draw(img)
    if position == "top_right":
        cx, cy = W - 110, 110
    else:
        cx, cy = W - 130, H - 130

    leaves = [
        (cx - 20, cy - 30, 70, 30, -35, LEAF_DARK),
        (cx + 10, cy + 10,  50, 22, -55, LEAF_MID),
        (cx + 35, cy + 50, 38, 16, -70, LEAF_LIGHT),
    ]
    for lx, ly, lw, lh, angle, color in leaves:
        leaf = Image.new("RGBA", (lw*2, lh*2), (0,0,0,0))
        ld = ImageDraw.Draw(leaf)
        ld.ellipse([0, lh//2, lw*2, lh*3//2], fill=color)
        rotated = leaf.rotate(angle, expand=True)
        img.paste(rotated, (lx - rotated.width//2, ly - rotated.height//2), rotated)

def _header(draw, subtitle="СИЛА МАЛЕНЬКИХ ДЕЙСТВИЙ"):
    draw.text((PAD, 60), "VIReyou", font=_font("sans_bold", 36), fill=TEXT_DARK)
    draw.text((PAD, 100), subtitle, font=_font("sans", 22), fill=ACCENT,
              spacing=4)

def _wrap(text, font, max_w):
    words = text.split()
    lines, line = [], ""
    for w in words:
        test = (line + " " + w).strip()
        try:
            tw = font.getlength(test)
        except:
            tw = len(test) * 12
        if tw <= max_w:
            line = test
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines

def _accent_line(draw, x, y, width=80):
    draw.line([(x, y), (x + width, y)], fill=ACCENT, width=3)

def render_cover(slide, bg):
    img = Image.new("RGBA", (W, H), bg)
    _draw_leaves(img, "top_right")
    draw = ImageDraw.Draw(img)
    _header(draw)

    # Big headline centered vertically
    headline = slide.get("headline", "")
    fn = _font("serif", 82)
    lines = _wrap(headline, fn, W - 2*PAD - 80)
    total_h = len(lines) * 95
    y = (H - total_h) // 2 - 50
    for line in lines:
        draw.text((PAD, y), line, font=fn, fill=TEXT_DARK)
        y += 95

    _accent_line(draw, PAD, y + 20)

    # Bottom bar
    draw.text((PAD, H - 120), "СВАЙП  →", font=_font("sans", 28), fill=TEXT_DARK)
    tag = slide.get("hashtag", "#VIReyou_bot")
    try:
        tw = _font("sans", 28).getlength(tag)
    except:
        tw = len(tag) * 14
    draw.text((W - PAD - tw, H - 120), tag, font=_font("sans", 28), fill=ACCENT)
    return img.convert("RGB")

def render_thesis(slide, bg, slide_num, total):
    img = Image.new("RGBA", (W, H), bg)
    _draw_leaves(img, "top_right")
    draw = ImageDraw.Draw(img)
    _header(draw)

    quote = slide.get("quote", "")
    body = slide.get("body", "")

    if quote:
        fq = _font("serif_italic", 62)
        lines = _wrap(f"«{quote}»", fq, W - 2*PAD - 60)
        y = 280
        for line in lines:
            draw.text((PAD + 30, y), line, font=fq, fill=ACCENT)
            y += 78
        _accent_line(draw, W//2 - 40, y + 20, 80)
        y += 60

    if body:
        fb = _font("serif", 58)
        lines = _wrap(body, fb, W - 2*PAD)
        y = y + 40 if quote else 340
        for line in lines:
            draw.text((PAD, y), line, font=fb, fill=TEXT_DARK)
            y += 72

    draw.text((W//2 - 20, H - 110), f"{slide_num} / {total}", font=_font("sans", 28), fill=TEXT_DARK)
    return img.convert("RGB")

def render_list(slide, bg, slide_num, total):
    img = Image.new("RGBA", (W, H), bg)
    _draw_leaves(img, "top_right")
    draw = ImageDraw.Draw(img)
    _header(draw)

    heading = slide.get("heading", "")
    items = slide.get("items", [])

    fh = _font("serif", 66)
    lines = _wrap(heading, fh, W - 2*PAD - 80)
    y = 200
    for line in lines:
        draw.text((PAD, y), line, font=fh, fill=TEXT_DARK)
        y += 78
    _accent_line(draw, PAD, y + 10)
    y += 50

    fi_title = _font("serif", 46)
    fi_desc  = _font("sans", 34)
    for item in items:
        # Leaf bullet
        leaf_x, leaf_y = PAD, y + 8
        limg = Image.new("RGBA", (40, 20), (0,0,0,0))
        ld = ImageDraw.Draw(limg)
        ld.ellipse([0, 2, 38, 18], fill=LEAF_MID)
        rotated = limg.rotate(-40, expand=True)
        img.paste(rotated, (leaf_x, leaf_y), rotated)

        name = item.get("name", "")
        desc = item.get("desc", "")
        draw.text((PAD + 52, y), name, font=fi_title, fill=TEXT_DARK)
        y += 52
        if desc:
            desc_lines = _wrap(desc, fi_desc, W - PAD - 60)
            for dl in desc_lines:
                draw.text((PAD + 52, y), dl, font=fi_desc, fill="#6B7B6C")
                y += 42
        y += 18

    draw.text((W//2 - 20, H - 110), f"{slide_num} / {total}", font=_font("sans", 28), fill=TEXT_DARK)
    return img.convert("RGB")

def render_antithesis(slide, bg, slide_num, total):
    img = Image.new("RGBA", (W, H), bg)
    _draw_leaves(img, "top_right")
    draw = ImageDraw.Draw(img)
    _header(draw)

    myth = slide.get("myth", "")
    fact = slide.get("fact", "")

    fm = _font("serif_italic", 60)
    y = 240
    myth_lines = _wrap(f"«{myth}»", fm, W - 2*PAD)
    for line in myth_lines:
        draw.text((PAD, y), line, font=fm, fill="#9B8B7A")
        try:
            tw = fm.getlength(line)
        except:
            tw = len(line) * 30
        mid_y = y + 38
        draw.line([(PAD - 5, mid_y), (PAD + tw + 5, mid_y)], fill="#9B8B7A", width=3)
        y += 75

    _accent_line(draw, W//2 - 40, y + 20, 80)
    y += 70

    ff = _font("serif", 66)
    fact_lines = _wrap(fact, ff, W - 2*PAD)
    for line in fact_lines:
        draw.text((PAD, y), line, font=ff, fill=TEXT_DARK)
        y += 80

    draw.text((W//2 - 20, H - 110), f"{slide_num} / {total}", font=_font("sans", 28), fill=TEXT_DARK)
    return img.convert("RGB")

def render_final(slide, bg):
    img = Image.new("RGBA", (W, H), bg)
    _draw_leaves(img, "top_right")
    _draw_leaves(img, "bottom_right")
    draw = ImageDraw.Draw(img)
    _header(draw)

    cta = slide.get("cta", "")
    tagline = slide.get("tagline", "Организм замечает всё")

    fc = _font("serif", 74)
    cta_lines = _wrap(cta, fc, W - 2*PAD)
    total_h = len(cta_lines) * 90
    y = (H - total_h) // 2 - 80
    for line in cta_lines:
        draw.text((PAD, y), line, font=fc, fill=TEXT_DARK)
        y += 90

    _accent_line(draw, W//2 - 40, y + 20, 80)
    y += 60

    draw.text((PAD, y + 10), tagline, font=_font("serif_italic", 44), fill=ACCENT)
    return img.convert("RGB")


RENDERERS = {
    "cover":      lambda s, bg, n, t: render_cover(s, bg),
    "thesis":     render_thesis,
    "list":       render_list,
    "antithesis": render_antithesis,
    "final":      lambda s, bg, n, t: render_final(s, bg),
}

def generate_carousel(slides, output_dir, palette="cream"):
    bg = PALETTES.get(palette, BG_CREAM)
    os.makedirs(output_dir, exist_ok=True)
    paths = []
    total = len(slides)
    for i, slide in enumerate(slides, 1):
        stype = slide.get("type", "thesis")
        renderer = RENDERERS.get(stype)
        if not renderer:
            continue
        img = renderer(slide, bg, i, total)
        path = os.path.join(output_dir, f"slide_{i:02d}_{stype}.png")
        img.save(path, "PNG", quality=95)
        paths.append(path)
    return paths
