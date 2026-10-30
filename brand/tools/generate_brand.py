#!/usr/bin/env python3
"""
Converge brand asset generator.

Single source of truth for the Converge visual identity. Emits:
  * logo SVGs (three explored directions plus the chosen system)
  * PNG exports (app icon, adaptive icon layers, splash, favicons)
  * a TypeScript module holding the same vector data for react-native-svg
  * colour tokens for both themes with computed WCAG contrast ratios

Run from the repository root:  python3 brand/tools/generate_brand.py
Requires cairosvg (PNG export) and fonttools (wordmark outlines). Static font
instances are expected in /tmp/fonts - see docs/design/brand.md.
"""
from __future__ import annotations

import json
import math
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FONT_DIR = os.environ.get("CONVERGE_FONT_DIR", "/tmp/fonts")
sys.path.insert(0, HERE)

from wordmark import Wordmark  # noqa: E402

# ---------------------------------------------------------------------------
# 1. COLOUR SYSTEM
# ---------------------------------------------------------------------------

LIGHT = {
    "background": "#F7F4EF",
    "surface": "#FFFFFF",
    "surfaceSunken": "#EFEAE2",
    "surfaceInverse": "#0B1420",
    "primary": "#0E3A4C",
    "primaryPressed": "#092A38",
    "secondary": "#14395E",
    "accent": "#0F7C8C",
    "accentSoft": "#DCEAEC",
    "textPrimary": "#0B1420",
    "textSecondary": "#525C69",
    "textMuted": "#5F6875",
    "onPrimary": "#FFFFFF",
    "onAccent": "#FFFFFF",
    "border": "#E2DCD2",
    "borderStrong": "#C9C1B4",
    "success": "#1E7F5C",
    "warning": "#8A5A0B",
    "error": "#B3261E",
    "info": "#1F5FA8",
}

DARK = {
    "background": "#0B1420",
    "surface": "#121E2C",
    "surfaceSunken": "#0E1723",
    "surfaceInverse": "#F7F4EF",
    "primary": "#7FD9CE",
    "primaryPressed": "#A6E6DE",
    "secondary": "#9CC3EE",
    "accent": "#57C8D8",
    "accentSoft": "#16303A",
    "textPrimary": "#F2F5F8",
    "textSecondary": "#A9B6C4",
    "textMuted": "#8B97A4",
    "onPrimary": "#06222B",
    "onAccent": "#04202A",
    "border": "#24344A",
    "borderStrong": "#35485F",
    "success": "#4ECB8F",
    "warning": "#E3A857",
    "error": "#F2837C",
    "info": "#7FB2F0",
}

BRAND_STATIC = {
    "midnight": "#0B1420",
    "midnightDeep": "#060D15",
    "tealDeep": "#0E3A4C",
    "tealSignal": "#1FB8A6",
    "tealSignalSoft": "#7FD9CE",
    "ivory": "#F7F4EF",
    "ivoryBright": "#FFFDF9",
    "clay": "#C2703F",
    "slate": "#525C69",
}

SEMANTIC_PAIRS = [
    ("background", "textPrimary", 4.5, "AA body"),
    ("background", "textSecondary", 4.5, "AA body"),
    ("background", "textMuted", 4.5, "AA body"),
    ("surface", "textPrimary", 4.5, "AA body"),
    ("surface", "textSecondary", 4.5, "AA body"),
    ("surfaceSunken", "textSecondary", 4.5, "AA body"),
    ("surfaceSunken", "textMuted", 4.5, "AA body"),
    ("primary", "onPrimary", 4.5, "AA body"),
    ("accent", "onAccent", 4.5, "AA body"),
    ("background", "primary", 3.0, "AA large / UI"),
    ("background", "accent", 3.0, "AA large / UI"),
    ("background", "success", 3.0, "AA large / UI"),
    ("background", "warning", 3.0, "AA large / UI"),
    ("background", "error", 3.0, "AA large / UI"),
]


def _srgb(channel: float) -> float:
    return channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4


def luminance(hex_colour: str) -> float:
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * _srgb(r) + 0.7152 * _srgb(g) + 0.0722 * _srgb(b)


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return round((hi + 0.05) / (lo + 0.05), 2)


def contrast_report() -> list[dict]:
    rows = []
    for theme_name, tokens in (("light", LIGHT), ("dark", DARK)):
        for fg, bg, target, level in SEMANTIC_PAIRS:
            ratio = contrast(tokens[fg], tokens[bg])
            rows.append(
                {
                    "theme": theme_name,
                    "foreground": fg,
                    "background": bg,
                    "ratio": ratio,
                    "target": target,
                    "level": level,
                    "passes": ratio >= target,
                }
            )
    return rows


# ---------------------------------------------------------------------------
# 2. LOGO GEOMETRY
# ---------------------------------------------------------------------------
# The chosen mark ("Focus"): three paths sweep in from the left and converge on
# a single solid node - the shared point of common ground. Curvature is
# deliberate: it separates the mark from generic "network node" clip art while
# staying legible at launcher-icon size.

FOCUS_NODE = {"cx": 72.0, "cy": 50.0, "r": 9.5}

# (start point, quadratic control point, end point) on a 100 x 100 grid.
FOCUS_CURVES = [
    ((4.5, 7.5), (40.0, 11.0), (61.4, 42.6)),
    ((4.5, 50.0), (34.0, 50.0), (60.0, 50.0)),
    ((4.5, 92.5), (40.0, 89.0), (61.4, 57.4)),
]

FOCUS_STROKE = 10.0

# Tight bounding box of the rendered mark, including stroke and round caps.
MARK_BOUNDS = (-0.5, 2.5, 81.5, 97.5)

# Exploration A - straight rays meeting a ring.
RAY_CENTRE = (68.0, 50.0)
RAY_RADIUS = 14.0
RAY_STROKE = 10.5
RAY_GAP = 5.5
RAY_STARTS = [(6.0, 22.0), (6.0, 50.0), (6.0, 78.0)]

# Exploration B - diamond boundary with a solid centre and four spokes.
HUB_OUTER = [(50.0, 4.0), (96.0, 50.0), (50.0, 96.0), (4.0, 50.0)]
HUB_INNER = [(50.0, 32.0), (68.0, 50.0), (50.0, 68.0), (32.0, 50.0)]
HUB_STROKE = 8.0


def _fmt(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".")


def focus_path_data() -> list[str]:
    return [
        f"M{_fmt(sx)} {_fmt(sy)}Q{_fmt(cx)} {_fmt(cy)} {_fmt(ex)} {_fmt(ey)}"
        for (sx, sy), (cx, cy), (ex, ey) in FOCUS_CURVES
    ]


def ray_geometry():
    cx, cy = RAY_CENTRE
    rays = []
    for sx, sy in RAY_STARTS:
        dx, dy = sx - cx, sy - cy
        length = math.hypot(dx, dy)
        ux, uy = dx / length, dy / length
        reach = RAY_RADIUS + RAY_GAP
        rays.append(((sx, sy), (cx + ux * reach, cy + uy * reach)))
    return rays, {"cx": cx, "cy": cy, "r": RAY_RADIUS}


def hub_spokes():
    spokes = []
    for (ix, iy), (ox, oy) in zip(HUB_INNER, HUB_OUTER):
        dx, dy = ox - ix, oy - iy
        length = math.hypot(dx, dy)
        ux, uy = dx / length, dy / length
        stop = length - 16.0
        spokes.append(((ix, iy), (ix + ux * stop, iy + uy * stop)))
    return spokes


def polygon_path(points) -> str:
    head = f"M{_fmt(points[0][0])} {_fmt(points[0][1])}"
    body = "".join(f"L{_fmt(x)} {_fmt(y)}" for x, y in points[1:])
    return head + body + "Z"


# ---------------------------------------------------------------------------
# 3. SVG EMISSION
# ---------------------------------------------------------------------------

def focus_mark_svg(stroke: str, node: str, stroke_width: float = FOCUS_STROKE) -> str:
    """Draw the mark in its native 100 x 100 coordinate space."""
    paths = "".join(
        f'<path d="{d}" fill="none" stroke="{stroke}" '
        f'stroke-width="{_fmt(stroke_width)}" stroke-linecap="round"/>'
        for d in focus_path_data()
    )
    return (
        paths
        + f'<circle cx="{_fmt(FOCUS_NODE["cx"])}" cy="{_fmt(FOCUS_NODE["cy"])}" '
        + f'r="{_fmt(FOCUS_NODE["r"])}" fill="{node}"/>'
    )


def place_mark(box_w: float, box_h: float, pad: float, stroke: str, node: str) -> str:
    """Scale and centre the mark inside a box of box_w x box_h."""
    min_x, min_y, max_x, max_y = MARK_BOUNDS
    content_w, content_h = max_x - min_x, max_y - min_y
    scale = min((box_w - 2 * pad) / content_w, (box_h - 2 * pad) / content_h)
    tx = (box_w - content_w * scale) / 2 - min_x * scale
    ty = (box_h - content_h * scale) / 2 - min_y * scale
    return (
        f'<g transform="translate({_fmt(tx)} {_fmt(ty)}) scale({_fmt(scale)})">'
        + focus_mark_svg(stroke=stroke, node=node)
        + "</g>"
    )


def svg_document(
    width: float,
    height: float,
    body: str,
    title: str,
    desc: str = "",
    background: str | None = None,
) -> str:
    bg = f'<rect width="{_fmt(width)}" height="{_fmt(height)}" fill="{background}"/>' if background else ""
    description = f"<desc>{desc}</desc>" if desc else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_fmt(width)} {_fmt(height)}" '
        f'width="{_fmt(width)}" height="{_fmt(height)}" role="img">'
        f"<title>{title}</title>{description}{bg}{body}</svg>"
    )


def write_text(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(content)
    print(f"  svg  {os.path.relpath(path, ROOT)}")


def write_json(path: str, payload) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
    print(f"  json {os.path.relpath(path, ROOT)}")


def render_png(svg: str, path: str, width: int, height: int | None = None) -> None:
    import cairosvg

    os.makedirs(os.path.dirname(path), exist_ok=True)
    cairosvg.svg2png(
        bytestring=svg.encode("utf-8"),
        write_to=path,
        output_width=width,
        output_height=height or width,
    )
    print(f"  png  {os.path.relpath(path, ROOT)} ({width}x{height or width})")


# ---------------------------------------------------------------------------
# 4. BUILD STEPS
# ---------------------------------------------------------------------------

def build_logo_explorations() -> None:
    print("Logo explorations")
    canvas = 120.0
    pad = 14.0

    # Direction A - converging rays meeting a ring.
    rays, ring = ray_geometry()
    body = "".join(
        f'<path d="M{_fmt(a[0])} {_fmt(a[1])}L{_fmt(b[0])} {_fmt(b[1])}" fill="none" '
        f'stroke="{BRAND_STATIC["tealDeep"]}" stroke-width="{RAY_STROKE}" stroke-linecap="round"/>'
        for a, b in rays
    )
    body += (
        f'<circle cx="{ring["cx"]}" cy="{ring["cy"]}" r="{ring["r"]}" fill="none" '
        f'stroke="{BRAND_STATIC["tealDeep"]}" stroke-width="{RAY_STROKE}"/>'
    )
    write_text(
        os.path.join(ROOT, "brand/guidelines/explorations/direction-a-rays.svg"),
        svg_document(
            canvas,
            canvas,
            f'<g transform="translate({pad} {pad}) scale(0.7667)">{body}</g>',
            "Converge logo exploration A",
            "Three straight paths meeting a single ring.",
            BRAND_STATIC["ivory"],
        ),
    )

    # Direction B - hub diamond.
    spoke_paths = "".join(
        f'<path d="M{_fmt(a[0])} {_fmt(a[1])}L{_fmt(b[0])} {_fmt(b[1])}" fill="none" '
        f'stroke="{BRAND_STATIC["tealDeep"]}" stroke-width="{HUB_STROKE}" stroke-linecap="round"/>'
        for a, b in hub_spokes()
    )
    body = (
        f'<path d="{polygon_path(HUB_OUTER)}" fill="none" stroke="{BRAND_STATIC["tealDeep"]}" '
        f'stroke-width="{HUB_STROKE}" stroke-linejoin="round"/>'
        + spoke_paths
        + f'<path d="{polygon_path(HUB_INNER)}" fill="{BRAND_STATIC["tealDeep"]}"/>'
    )
    write_text(
        os.path.join(ROOT, "brand/guidelines/explorations/direction-b-hub.svg"),
        svg_document(
            canvas,
            canvas,
            f'<g transform="translate({pad} {pad}) scale(0.92)">{body}</g>',
            "Converge logo exploration B",
            "A diamond boundary with a solid shared centre.",
            BRAND_STATIC["ivory"],
        ),
    )

    # Direction C - focus curves (chosen).
    write_text(
        os.path.join(ROOT, "brand/guidelines/explorations/direction-c-focus.svg"),
        svg_document(
            canvas,
            canvas,
            f'<g transform="translate({pad} {pad})">{place_mark(92, 92, 0, BRAND_STATIC["tealDeep"], BRAND_STATIC["tealSignal"])}</g>',
            "Converge logo exploration C",
            "Three curved paths converging on one shared node.",
            BRAND_STATIC["ivory"],
        ),
    )


def build_primary_logos(display: Wordmark, body_wordmark: Wordmark) -> None:
    print("Primary logo system")
    text = "Converge"
    tracking = 1.1
    text_size = 44.0

    # Lockup metrics: the mark is scaled so its visual mass matches the cap
    # height of the wordmark, and both are centred on a shared optical band
    # spanning cap height plus descender depth.
    cap_height = display.cap_height(text_size)
    descent = display.descender(text_size)
    mark_size = (cap_height + descent) * 1.06
    gap = 11.5
    text_width = display.metrics(text, text_size, tracking)
    total_w = mark_size + gap + text_width + 2.0
    canvas_h = mark_size + 20.0

    glyphs, _ = display.path(text, text_size, mark_size + gap, 0.0, tracking)

    # Vertical placement: mark centred on the band, wordmark baseline set so the
    # band (cap height + descent) is centred too.
    band_h = cap_height + descent
    mark_top = (canvas_h - mark_size) / 2
    baseline = (canvas_h - band_h) / 2 + cap_height

    def lockup(stroke: str, node: str) -> str:
        return (
            f'<g transform="translate(0 {_fmt(mark_top)})">'
            + place_mark(mark_size, mark_size, 0, stroke, node)
            + "</g>"
            + f'<path d="{glyphs}" transform="translate(0 {_fmt(baseline)})" fill="{stroke}"/>'
        )

    write_text(
        os.path.join(ROOT, "brand/logo/converge-logo-primary.svg"),
        svg_document(
            total_w,
            canvas_h,
            lockup(BRAND_STATIC["midnight"], BRAND_STATIC["tealSignal"]),
            "Converge",
            "Converge primary horizontal logo",
        ),
    )
    write_text(
        os.path.join(ROOT, "brand/logo/converge-logo-primary-reversed.svg"),
        svg_document(
            total_w,
            canvas_h,
            lockup(BRAND_STATIC["ivory"], BRAND_STATIC["tealSignalSoft"]),
            "Converge",
            "Converge primary horizontal logo for dark surfaces",
        ),
    )
    write_text(
        os.path.join(ROOT, "brand/logo/converge-logo-monochrome.svg"),
        svg_document(
            total_w,
            canvas_h,
            lockup("#000000", "#000000"),
            "Converge",
            "Converge single-colour logo",
        ),
    )

    # Secondary (stacked) logo for square placements.
    stack_text_size = 33.0
    stack_tracking = 1.8
    stack_cap = body_wordmark.cap_height(stack_text_size)
    stack_descent = body_wordmark.descender(stack_text_size)
    stack_text_w = body_wordmark.metrics(text, stack_text_size, stack_tracking)
    stack_mark = stack_cap * 1.5
    canvas_w = max(stack_text_w, stack_mark) + 30.0
    canvas_h = 14.0 + stack_mark + 22.0 + stack_cap + stack_descent + 16.0
    stack_baseline = 14.0 + stack_mark + 22.0 + stack_cap
    stack_glyphs, _ = body_wordmark.path(
        text, stack_text_size, 0.0, 0.0, stack_tracking
    )

    def stacked(stroke: str, node: str) -> str:
        return (
            f'<g transform="translate({_fmt((canvas_w - stack_mark) / 2)} 14)">'
            + place_mark(stack_mark, stack_mark, 0, stroke, node)
            + "</g>"
            + f'<path d="{stack_glyphs}" '
            + f'transform="translate({_fmt((canvas_w - stack_text_w) / 2)} {_fmt(stack_baseline)})" '
            + f'fill="{stroke}"/>'
        )

    write_text(
        os.path.join(ROOT, "brand/logo/converge-logo-secondary.svg"),
        svg_document(
            canvas_w,
            canvas_h,
            stacked(BRAND_STATIC["midnight"], BRAND_STATIC["tealSignal"]),
            "Converge",
            "Converge stacked logo",
        ),
    )
    write_text(
        os.path.join(ROOT, "brand/logo/converge-logo-secondary-reversed.svg"),
        svg_document(
            canvas_w,
            canvas_h,
            stacked(BRAND_STATIC["ivory"], BRAND_STATIC["tealSignalSoft"]),
            "Converge",
            "Converge stacked logo for dark surfaces",
        ),
    )

    # Standalone mark, square canvas, generous padding.
    for name, stroke, node in (
        ("converge-mark.svg", BRAND_STATIC["midnight"], BRAND_STATIC["tealSignal"]),
        (
            "converge-mark-reversed.svg",
            BRAND_STATIC["ivory"],
            BRAND_STATIC["tealSignalSoft"],
        ),
    ):
        write_text(
            os.path.join(ROOT, "brand/logo", name),
            svg_document(
                120,
                120,
                f'<g transform="translate(12 12)">{place_mark(96, 96, 0, stroke, node)}</g>',
                "Converge mark",
            ),
        )


def build_icons() -> None:
    print("App icons")
    navy = BRAND_STATIC["midnight"]
    ivory = BRAND_STATIC["ivory"]

    def icon_svg(scale_pad: float, stroke: str, node: str, bg: str | None) -> str:
        return svg_document(
            108,
            108,
            f'<g transform="translate({_fmt(scale_pad)} {_fmt(scale_pad)})">'
            + place_mark(
                108 - 2 * scale_pad, 108 - 2 * scale_pad, 0, stroke, node
            )
            + "</g>",
            "Converge app icon",
            background=bg,
        )

    full_bleed = icon_svg(13.5, ivory, BRAND_STATIC["tealSignal"], navy)
    render_png(full_bleed, os.path.join(ROOT, "brand/icons/converge-icon-1024.png"), 1024)
    render_png(full_bleed, os.path.join(ROOT, "mobile/assets/icon.png"), 1024)

    # Android adaptive icon layers: 108dp canvas, 66dp safe zone.
    foreground = svg_document(
        108,
        108,
        '<g transform="translate(21 21)">'
        + place_mark(66, 66, 0, ivory, BRAND_STATIC["tealSignal"])
        + "</g>",
        "Converge adaptive icon foreground",
    )
    render_png(
        foreground, os.path.join(ROOT, "brand/icons/converge-icon-foreground.png"), 1024
    )
    render_png(
        foreground, os.path.join(ROOT, "mobile/assets/android-icon-foreground.png"), 1024
    )

    background = svg_document(108, 108, "", "Converge adaptive icon background", background=navy)
    render_png(
        background, os.path.join(ROOT, "brand/icons/converge-icon-background.png"), 1024
    )
    render_png(
        background, os.path.join(ROOT, "mobile/assets/android-icon-background.png"), 1024
    )

    monochrome = svg_document(
        108,
        108,
        '<g transform="translate(21 21)">'
        + place_mark(66, 66, 0, "#000000", "#000000")
        + "</g>",
        "Converge adaptive icon monochrome layer",
    )
    render_png(
        monochrome, os.path.join(ROOT, "brand/icons/converge-icon-monochrome.png"), 1024
    )
    render_png(
        monochrome, os.path.join(ROOT, "mobile/assets/android-icon-monochrome.png"), 1024
    )

    # Launcher previews: circular and rounded square.
    for name, rounded in (("converge-icon-round.png", True), ("converge-icon-square.png", False)):
        clip = (
            '<clipPath id="c"><circle cx="512" cy="512" r="512"/></clipPath>'
            if rounded
            else '<clipPath id="c"><rect width="1024" height="1024" rx="200"/></clipPath>'
        )
        shell = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" '
            'width="1024" height="1024">'
            f"<defs>{clip}</defs>"
            '<g clip-path="url(#c)">'
            f'<rect width="1024" height="1024" fill="{navy}"/>'
            '<g transform="translate(0 0) scale(9.4815)">'
            '<g transform="translate(13.5 13.5)">'
            + place_mark(81, 81, 0, ivory, BRAND_STATIC["tealSignal"])
            + "</g></g></g></svg>"
        )
        render_png(shell, os.path.join(ROOT, "brand/icons", name), 1024)

    # Splash artwork.
    splash = svg_document(
        200,
        200,
        '<g transform="translate(30 30)">'
        + place_mark(140, 140, 0, ivory, BRAND_STATIC["tealSignal"])
        + "</g>",
        "Converge splash",
        background=navy,
    )
    render_png(splash, os.path.join(ROOT, "brand/icons/converge-splash.png"), 1024)
    render_png(splash, os.path.join(ROOT, "mobile/assets/splash-icon.png"), 512)

    render_png(full_bleed, os.path.join(ROOT, "brand/icons/converge-favicon.png"), 96)
    render_png(full_bleed, os.path.join(ROOT, "mobile/assets/favicon.png"), 96)

    # Transparent PNG exports of the mark.
    transparent = svg_document(
        120,
        120,
        '<g transform="translate(12 12)">'
        + place_mark(96, 96, 0, navy, BRAND_STATIC["tealSignal"])
        + "</g>",
        "Converge mark, transparent",
    )
    render_png(transparent, os.path.join(ROOT, "brand/logo/converge-mark-512.png"), 512)
    render_png(transparent, os.path.join(ROOT, "brand/logo/converge-mark-128.png"), 128)

    transparent_rev = svg_document(
        120,
        120,
        '<g transform="translate(12 12)">'
        + place_mark(96, 96, 0, ivory, BRAND_STATIC["tealSignalSoft"])
        + "</g>",
        "Converge mark, transparent, for dark surfaces",
    )
    render_png(
        transparent_rev, os.path.join(ROOT, "brand/logo/converge-mark-reversed-512.png"), 512
    )


def build_colour_assets() -> None:
    print("Colour tokens")
    report = contrast_report()
    payload = {
        "brand": BRAND_STATIC,
        "themes": {"light": LIGHT, "dark": DARK},
        "contrast": report,
    }
    write_json(os.path.join(ROOT, "brand/guidelines/colour-tokens.json"), payload)
    write_json(os.path.join(ROOT, "mobile/src/theme/tokens.json"), payload)
    failures = 0
    for row in report:
        flag = "PASS" if row["passes"] else "FAIL"
        if not row["passes"]:
            failures += 1
        print(
            f"  {flag}  {row['theme']:<5} {row['foreground']:<14} on {row['background']:<14} "
            f"{row['ratio']:>6}:1  ({row['level']}, target {row['target']}:1)"
        )
    if failures:
        print(f"  !! {failures} contrast pair(s) below target")


def build_typescript_mark() -> None:
    print("TypeScript vector module")
    rays, ring = ray_geometry()
    spokes = hub_spokes()
    ts = f"""// GENERATED by brand/tools/generate_brand.py - do not edit by hand.
// Vector data for the Converge "Focus" mark, shared by the app and brand exports.

export const MARK_VIEWBOX = 100;

/** Quadratic paths that sweep inward toward the shared node. */
export const MARK_CURVE_PATHS: readonly string[] = {json.dumps(focus_path_data(), indent=2)};

export const MARK_NODE = {{ cx: {FOCUS_NODE['cx']}, cy: {FOCUS_NODE['cy']}, r: {FOCUS_NODE['r']} }} as const;

export const MARK_STROKE_WIDTH = {FOCUS_STROKE};

/** Tight bounds of the rendered mark, used for optical centring. */
export const MARK_BOUNDS = {json.dumps(list(MARK_BOUNDS))} as const;

/** Exploration A - straight rays meeting a ring (retained for reference). */
export const RAY_GEOMETRY = {json.dumps([{"from": list(a), "to": [round(v, 2) for v in b]} for a, b in rays], indent=2)} as const;
export const RAY_RING = {{ cx: {ring['cx']}, cy: {ring['cy']}, r: {ring['r']} }} as const;

/** Exploration B - hub diamond with spokes (retained for reference). */
export const HUB_OUTER = {json.dumps(HUB_OUTER)} as const;
export const HUB_INNER = {json.dumps(HUB_INNER)} as const;
export const HUB_SPOKES = {json.dumps([{"from": list(a), "to": [round(v, 2) for v in b]} for a, b in spokes], indent=2)} as const;
"""
    path = os.path.join(ROOT, "mobile/src/brand/mark.ts")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(ts)
    print(f"  ts   {os.path.relpath(path, ROOT)}")


def build_typography_specimen(display: Wordmark, body: Wordmark, heading: Wordmark, label: Wordmark) -> None:
    print("Typography specimen")
    ivory = BRAND_STATIC["ivory"]
    d1, _ = display.path("Find common ground.", 48, 116, 104, 0.1)
    d2, _ = display.path("Start meaningful conversations.", 48, 116, 168, 0.1)
    h1, _ = heading.path("AuraMatch recommendations", 26, 116, 232, 0.1)
    b1, _ = body.path("Converge connects people through shared interests", 17, 116, 276, 0.1)
    b2, _ = body.path("and community participation, not follower counts.", 17, 116, 302, 0.1)
    l1, _ = label.path("START A CONVERSATION", 13, 116, 352, 2.6)
    meta, _ = body.path("Manrope 400 / 500 / 600 / 700  -  Fraunces 600 for display", 12, 116, 384, 0.2)
    body_svg = (
        f'<path d="{d1}" fill="{BRAND_STATIC["midnight"]}"/>'
        f'<path d="{d2}" fill="{BRAND_STATIC["midnight"]}"/>'
        f'<path d="{h1}" fill="{BRAND_STATIC["tealDeep"]}"/>'
        f'<path d="{b1}" fill="{BRAND_STATIC["slate"]}"/>'
        f'<path d="{b2}" fill="{BRAND_STATIC["slate"]}"/>'
        f'<path d="{l1}" fill="{BRAND_STATIC["tealSignal"]}"/>'
        f'<path d="{meta}" fill="{BRAND_STATIC["slate"]}"/>'
        f'<g transform="translate(30 26)">{place_mark(64, 64, 0, BRAND_STATIC["midnight"], BRAND_STATIC["tealSignal"])}</g>'
    )
    svg = svg_document(720, 420, body_svg, "Converge typography specimen", background=ivory)
    write_text(os.path.join(ROOT, "brand/typography/typography-specimen.svg"), svg)
    render_png(svg, os.path.join(ROOT, "brand/typography/typography-specimen.png"), 1440, 840)


def copy_fonts() -> None:
    print("Font files")
    target = os.path.join(ROOT, "mobile/assets/fonts")
    brand_fonts = os.path.join(ROOT, "brand/typography/fonts")
    os.makedirs(target, exist_ok=True)
    os.makedirs(brand_fonts, exist_ok=True)
    mapping = {
        "Manrope_400.ttf": "Manrope-Regular.ttf",
        "Manrope_500.ttf": "Manrope-Medium.ttf",
        "Manrope_600.ttf": "Manrope-SemiBold.ttf",
        "Manrope_700.ttf": "Manrope-Bold.ttf",
        "Fraunces_600.ttf": "Fraunces-SemiBold.ttf",
    }
    for src, dest in mapping.items():
        source = os.path.join(FONT_DIR, src)
        if not os.path.exists(source):
            raise SystemExit(f"missing font instance {source}")
        shutil.copyfile(source, os.path.join(target, dest))
        shutil.copyfile(source, os.path.join(brand_fonts, dest))
        print(f"  ttf  mobile/assets/fonts/{dest}")
    license_path = os.path.join(FONT_DIR, "OFL.txt")
    if os.path.exists(license_path):
        shutil.copyfile(license_path, os.path.join(brand_fonts, "OFL.txt"))


def main() -> None:
    required = {
        "Fraunces_600.ttf": None,
        "Manrope_400.ttf": None,
        "Manrope_600.ttf": None,
        "Manrope_700.ttf": None,
    }
    for name in required:
        if not os.path.exists(os.path.join(FONT_DIR, name)):
            raise SystemExit(
                f"{name} missing in {FONT_DIR}; build static instances first "
                "(see docs/design/brand.md)"
            )
    display = Wordmark(os.path.join(FONT_DIR, "Fraunces_600.ttf"))
    body = Wordmark(os.path.join(FONT_DIR, "Manrope_400.ttf"))
    heading = Wordmark(os.path.join(FONT_DIR, "Manrope_700.ttf"))
    label = Wordmark(os.path.join(FONT_DIR, "Manrope_600.ttf"))

    build_logo_explorations()
    build_primary_logos(display, body)
    build_icons()
    build_colour_assets()
    build_typescript_mark()
    build_typography_specimen(display, body, heading, label)
    copy_fonts()
    print("Brand build complete")


if __name__ == "__main__":
    main()
