"""Extract wordmark outlines from a TTF so logo SVGs are font-independent."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform


class Wordmark:
    def __init__(self, path):
        self.font = TTFont(path)
        self.upm = self.font["head"].unitsPerEm
        self.cmap = self.font.getBestCmap()
        self.glyph_set = self.font.getGlyphSet()
        self.hmtx = self.font["hmtx"]
        self.os2 = self.font["OS/2"] if "OS/2" in self.font else None

    def cap_height(self, size):
        """Cap height in user units, derived from OS/2 sCapHeight."""
        if self.os2 is not None and getattr(self.os2, "sCapHeight", 0):
            return self.os2.sCapHeight / self.upm * size
        return 0.7 * size

    def descender(self, size):
        """Maximum descender depth in user units (positive below the baseline)."""
        if self.os2 is not None and getattr(self.os2, "sTypoDescender", 0):
            return abs(self.os2.sTypoDescender) / self.upm * size
        return 0.22 * size

    def ascender(self, size):
        if self.os2 is not None and getattr(self.os2, "sTypoAscender", 0):
            return self.os2.sTypoAscender / self.upm * size
        return 0.75 * size

    def metrics(self, text, size, tracking=0.0):
        scale = size / self.upm
        total = 0.0
        for ch in text:
            name = self.cmap.get(ord(ch))
            adv = self.hmtx[name][0] if name else 0
            total += adv * scale + tracking
        return total - tracking if text else 0.0

    def path(self, text, size, x=0.0, y=0.0, tracking=0.0):
        """Return (svg_path_d, advance_width). y is the baseline."""
        scale = size / self.upm
        cursor = 0.0
        parts = []
        for ch in text:
            name = self.cmap.get(ord(ch))
            if name is None:
                continue
            glyph = self.glyph_set[name]
            pen = SVGPathPen(self.glyph_set, ntos=lambda v: f"{v:.2f}")
            # flip y: font units are y-up, SVG is y-down
            t = Transform(scale, 0, 0, -scale, x + cursor, y)
            glyph.draw(TransformPen(pen, t))
            d = pen.getCommands()
            if d:
                parts.append(d)
            cursor += self.hmtx[name][0] * scale + tracking
        return " ".join(parts), cursor - tracking if parts else 0.0
