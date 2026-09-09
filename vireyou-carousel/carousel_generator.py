"""
VIReyou Carousel Generator — оригинальный дизайн из VIReyou_Carousel_Generator.py
Адаптирован для приёма простого JSON формата.
"""
from PIL import Image, ImageDraw, ImageFont
import os, math, random

W, H = 1080, 1350

COLOR_CREAM      = "#F5EFE6"
COLOR_BEIGE      = "#E8DCC8"
COLOR_SAGE       = "#A8B89C"
COLOR_FOREST     = "#3D4A36"
COLOR_BODY       = "#2C3329"
COLOR_TERRACOTTA = "#C49A6C"
COLOR_SOFT_GREEN = "#7F9075"

FONT_DIR = "/usr/share/fonts/truetype"
LORA        = os.path.join(FONT_DIR, "google-fonts/Lora-Variable.ttf")
LORA_ITALIC = os.path.join(FONT_DIR, "google-fonts/Lora-Italic-Variable.ttf")
LATO_REG    = os.path.join(FONT_DIR, "lato/Lato-Regular.ttf")
LATO_MED    = os.path.join(FONT_DIR, "lato/Lato-Medium.ttf")
LATO_BOLD   = os.path.join(FONT_DIR, "lato/Lato-Bold.ttf")
LATO_LIGHT  = os.path.join(FONT_DIR, "lato/Lato-Light.ttf")

_font_cache = {}
def f(path, size):
    key = (path, size)
    if key not in _font_cache:
        try:
            _font_cache[key] = ImageFont.truetype(path, size)
        except OSError:
            # Fallback: find any ttf on the system
            for root, dirs, files in os.walk(FONT_DIR):
                for fname in files:
                    if fname.endswith('.ttf') and 'dejavu' in fname.lower():
                        try:
                            _font_cache[key] = ImageFont.truetype(os.path.join(root, fname), size)
                            return _font_cache[key]
                        except: pass
            _font_cache[key] = ImageFont.load_default()
    return _font_cache[key]

def draw_leaf(draw, cx, cy, size, color, rotation=0):
    pts = []
    for t in range(0, 360, 5):
        rad = math.radians(t)
        x = math.cos(rad) * size
        y = math.sin(rad) * (size * 0.35)
        rr = math.radians(rotation)
        xr = x * math.cos(rr) - y * math.sin(rr)
        yr = x * math.sin(rr) + y * math.cos(rr)
        pts.append((cx + xr, cy + yr))
    draw.polygon(pts, fill=color)

def draw_circle(draw, cx, cy, r, color):
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=color)

def draw_brand_mark(draw, x, y, color, size=28):
    draw.text((x, y), "VIReyou", font=f(LORA, size), fill=color)

def draw_page_indicator(draw, page, total, color):
    text = f"{page} / {total}"
    font = f(LATO_REG, 22)
    try:
        bbox = draw.textbbox((0,0), text, font=font)
        w = bbox[2] - bbox[0]
    except:
        w = len(text) * 12
    draw.text((W//2 - w//2, H-60), text, font=font, fill=color)

def add_grain(img, intensity=4):
    px = img.load()
    random.seed(42)
    for x in range(0, W, 3):
        for y in range(0, H, 3):
            r, g, b = px[x, y][:3]
            noise = random.randint(-intensity, intensity)
            px[x, y] = (
                max(0, min(255, r+noise)),
                max(0, min(255, g+noise)),
                max(0, min(255, b+noise)),
            )
    return img

def wrap_text(text, font, max_width, draw):
    words = text.split()
    lines, line = [], ""
    for w in words:
        test = (line + " " + w).strip()
        try:
            bb = draw.textbbox((0,0), test, font=font)
            tw = bb[2] - bb[0]
        except:
            tw = len(test) * 14
        if tw <= max_width:
            line = test
        else:
            if line: lines.append(line)
            line = w
    if line: lines.append(line)
    return lines

# ── SLIDE RENDERERS ──────────────────────────────────────────────────────────

def render_cover(slide, page, total):
    img = Image.new("RGB", (W, H), COLOR_CREAM)
    d = ImageDraw.Draw(img)
    draw_leaf(d, 950, 130, 90, COLOR_SAGE, rotation=-30)
    draw_leaf(d, 880, 200, 70, COLOR_SOFT_GREEN, rotation=20)
    draw_leaf(d, 1000, 250, 60, COLOR_SAGE, rotation=-50)
    draw_brand_mark(d, 80, 80, COLOR_FOREST, size=32)

    headline = slide.get("headline", "")
    headline_font = f(LORA, 72)
    lines = wrap_text(headline, headline_font, W - 160, d)
    y = 420
    for line in lines:
        d.text((80, y), line, font=headline_font, fill=COLOR_FOREST)
        y += 92

    d.line([(80, y + 30), (250, y + 30)], fill=COLOR_TERRACOTTA, width=3)
    y += 70

    subheadline = slide.get("subheadline", "")
    if subheadline:
        sub_font = f(LATO_LIGHT, 36)
        sub_lines = wrap_text(subheadline, sub_font, W - 160, d)
        for line in sub_lines:
            d.text((80, y), line, font=sub_font, fill=COLOR_BODY)
            y += 48

    d.text((80, 1230), "СВАЙП  →", font=f(LATO_MED, 28), fill=COLOR_FOREST)
    hashtag = slide.get("hashtag", "#VIReyou_bot")
    try:
        hw = d.textlength(hashtag, font=f(LATO_LIGHT, 22))
    except: hw = len(hashtag) * 11
    d.text((W - 80 - hw, 1240), hashtag, font=f(LATO_LIGHT, 22), fill=COLOR_FOREST)
    add_grain(img)
    return img

def render_thesis(slide, page, total):
    img = Image.new("RGB", (W, H), COLOR_BEIGE)
    d = ImageDraw.Draw(img)
    draw_brand_mark(d, 80, 80, COLOR_FOREST)
    d.line([(W//2-40, 280), (W//2+40, 280)], fill=COLOR_TERRACOTTA, width=3)

    quote = slide.get("quote", "")
    body  = slide.get("body", "")

    q_font = f(LORA, 60)
    y = 360
    if quote:
        q_lines = wrap_text(f"«{quote}»", q_font, W - 160, d)
        for line in q_lines:
            try:
                bb = d.textbbox((0,0), line, font=q_font)
                lw = bb[2] - bb[0]
            except: lw = len(line)*30
            d.text((W//2 - lw//2, y), line, font=q_font, fill=COLOR_FOREST)
            y += 82

    if body:
        y += 30
        sub_font = f(LORA_ITALIC, 36)
        b_lines = wrap_text(body, sub_font, W - 160, d)
        for line in b_lines:
            try:
                bb = d.textbbox((0,0), line, font=sub_font)
                lw = bb[2] - bb[0]
            except: lw = len(line)*18
            d.text((W//2 - lw//2, y), line, font=sub_font, fill=COLOR_BODY)
            y += 52

    draw_page_indicator(d, page, total, COLOR_FOREST)
    add_grain(img)
    return img

def render_list(slide, page, total):
    img = Image.new("RGB", (W, H), COLOR_CREAM)
    d = ImageDraw.Draw(img)
    draw_brand_mark(d, 80, 80, COLOR_FOREST)

    heading = slide.get("heading", "")
    h_font = f(LORA, 58)
    h_lines = wrap_text(heading, h_font, W - 160, d)
    y = 200
    for line in h_lines:
        d.text((80, y), line, font=h_font, fill=COLOR_FOREST)
        y += 70
    d.line([(80, y+20), (220, y+20)], fill=COLOR_TERRACOTTA, width=3)
    y += 60

    items = slide.get("items", [])
    n = len(items)
    item_h = 130 if n <= 5 else int(600 / n)
    for it in items:
        draw_circle(d, 100, y+22, 8, COLOR_SOFT_GREEN)
        
        name = it.get("name","")
        n_font = f(LORA, 40)
        n_lines = wrap_text(name, n_font, W - 180, d)
        for nl in n_lines:
            d.text((140, y), nl, font=n_font, fill=COLOR_FOREST)
            y += 48
            
        desc = it.get("desc","")
        if desc:
            d_font = f(LATO_LIGHT, 26)
            d_lines = wrap_text(desc, d_font, W - 180, d)
            for dl in d_lines:
                d.text((140, y), dl, font=d_font, fill=COLOR_BODY)
                y += 34
                
        y += 40

    # Highlight box at bottom
    callout = slide.get("callout", "")
    highlight_y = H - 220
    d.rectangle([(80, highlight_y), (W-80, highlight_y+120)], fill=COLOR_SAGE)
    if callout:
        hl_lines = wrap_text(callout, f(LATO_BOLD, 32), W - 220, d)
        yh = highlight_y + 20
        for line in hl_lines:
            d.text((110, yh), line, font=f(LATO_BOLD, 32), fill="#FFFFFF")
            yh += 46
    draw_page_indicator(d, page, total, COLOR_FOREST)
    add_grain(img)
    return img

def render_antithesis(slide, page, total):
    img = Image.new("RGB", (W, H), COLOR_SAGE)
    d = ImageDraw.Draw(img)
    draw_brand_mark(d, 80, 80, "#FFFFFF")

    myth = slide.get("myth", "")
    fact = slide.get("fact", "")

    not_font = f(LORA_ITALIC, 46)
    y = 260
    not_lines = wrap_text(myth, not_font, W - 160, d)
    for line in not_lines:
        d.text((80, y), line, font=not_font, fill=COLOR_CREAM)
        y += 62

    divider_y = y + 30
    d.line([(80, divider_y), (200, divider_y)], fill="#FFFFFF", width=4)

    yes_font = f(LORA, 58)
    y = divider_y + 60
    yes_lines = wrap_text(fact, yes_font, W - 160, d)
    for line in yes_lines:
        d.text((80, y), line, font=yes_font, fill="#FFFFFF")
        y += 76

    draw_leaf(d, 950, 1150, 80, COLOR_CREAM, rotation=45)
    draw_leaf(d, 880, 1200, 60, COLOR_SOFT_GREEN, rotation=-20)
    draw_page_indicator(d, page, total, COLOR_CREAM)
    add_grain(img, intensity=3)
    return img

def render_final(slide, page, total):
    img = Image.new("RGB", (W, H), COLOR_CREAM)
    d = ImageDraw.Draw(img)
    draw_leaf(d, 120, 200, 70, COLOR_SAGE, rotation=30)
    draw_leaf(d, 200, 250, 50, COLOR_SOFT_GREEN, rotation=-30)

    big_brand = f(LORA, 90)
    try:
        bb = d.textbbox((0,0), "VIReyou", font=big_brand)
        bw = bb[2]-bb[0]
    except: bw = 400
    d.text((W//2 - bw//2, 460), "VIReyou", font=big_brand, fill=COLOR_FOREST)

    tagline = slide.get("tagline", "диалог с организмом")
    tl_font = f(LATO_LIGHT, 32)
    try:
        bb = d.textbbox((0,0), tagline, font=tl_font)
        tw = bb[2]-bb[0]
    except: tw = len(tagline)*16
    d.text((W//2 - tw//2, 590), tagline, font=tl_font, fill=COLOR_BODY)
    d.line([(W//2-40, 670), (W//2+40, 670)], fill=COLOR_TERRACOTTA, width=3)

    cta = slide.get("cta", "")
    cta_font = f(LORA, 46)
    cta_lines = wrap_text(cta, cta_font, W - 220, d)
    y = 720
    for line in cta_lines:
        try:
            bb = d.textbbox((0,0), line, font=cta_font)
            lw = bb[2]-bb[0]
        except: lw = len(line)*23
        d.text((W//2 - lw//2, y), line, font=cta_font, fill=COLOR_FOREST)
        y += 66

    handle = "@VIReyou_bot"
    h_font = f(LATO_MED, 26)
    try:
        bb = d.textbbox((0,0), handle, font=h_font)
        hw = bb[2]-bb[0]
    except: hw = len(handle)*13
    d.text((W//2 - hw//2, 1040), handle, font=h_font, fill=COLOR_TERRACOTTA)
    draw_circle(d, W//2, 1140, 12, COLOR_TERRACOTTA)

    footer = "vireyou.com"
    ft_font = f(LATO_LIGHT, 22)
    try:
        bb = d.textbbox((0,0), footer, font=ft_font)
        fw = bb[2]-bb[0]
    except: fw = len(footer)*11
    d.text((W//2 - fw//2, 1220), footer, font=ft_font, fill=COLOR_BODY)

    draw_leaf(d, 950, 1100, 60, COLOR_SAGE, rotation=-30)
    draw_leaf(d, 880, 1170, 45, COLOR_SOFT_GREEN, rotation=40)
    add_grain(img)
    return img

RENDERERS = {
    "cover":      render_cover,
    "thesis":     render_thesis,
    "list":       render_list,
    "antithesis": render_antithesis,
    "final":      render_final,
}

def generate_carousel(slides, output_dir, palette="cream"):
    os.makedirs(output_dir, exist_ok=True)
    paths = []
    total = len(slides)
    for i, slide in enumerate(slides, 1):
        stype = slide.get("type", "thesis")
        renderer = RENDERERS.get(stype)
        if not renderer:
            continue
        img = renderer(slide, i, total)
        path = os.path.join(output_dir, f"slide_{i:02d}_{stype}.png")
        img.save(path, "PNG", quality=95)
        paths.append(path)
    return paths
