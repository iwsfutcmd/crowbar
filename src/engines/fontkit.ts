import type { HBGlyph } from "../opentype/CrowbarFont";
import type { EngineFont, ShapeParams, ShapingEngine } from "./types";

type Fontkit = typeof import("fontkit");
let fontkit: Fontkit | null = null;

// fontkit has no cluster output, so reconstruct clusters from the code points
// each glyph consumed, walking in logical order.
function clustersFromCodePoints(text: string, codePoints: number[][]) {
  const offsets: number[] = [];
  let u16 = 0;
  for (const ch of text) {
    offsets.push(u16);
    u16 += ch.length;
  }
  let consumed = 0;
  let last = 0;
  return codePoints.map((cps) => {
    if (cps.length > 0) {
      last = offsets[consumed] ?? last;
      consumed += cps.length;
    }
    return last;
  });
}

export const fontkitEngine: ShapingEngine = {
  id: "fontkit",
  name: "fontkit",
  description: "Pure-JavaScript shaper by Devon Govett, used by PDFKit and react-pdf",
  location: "browser",
  ready: async () => {
    fontkit = fontkit ?? ((await import("fontkit")) as unknown as Fontkit);
  },
  version: () => "2.0.4",
  loadFont(bytes: Uint8Array, faceIndex: number): EngineFont {
    let font: any = null;
    return {
      shape(params: ShapeParams): HBGlyph[] | null {
        if (!fontkit) return null;
        if (!font) {
          const created: any = fontkit.create(bytes as any);
          font = created.fonts ? created.fonts[faceIndex] : created;
        }
        const variations = params.variations;
        const instance =
          Object.keys(variations).length > 0
            ? font.getVariation(variations)
            : font;
        const features: Record<string, boolean | number> = {};
        params.features.forEach((f) => {
          const m = f.match(/^([+-]?)(\w{1,4})(?:=(\d+))?$/);
          if (!m) return;
          const value = m[3] !== undefined ? parseInt(m[3], 10) : 1;
          features[m[2]] = m[1] === "-" || value === 0 ? false : true;
        });
        const run = instance.layout(
          params.text,
          features,
          params.otScript.trim(),
          params.otLanguage ? params.otLanguage.trim() : undefined,
          params.direction === "rtl" ? "rtl" : "ltr"
        );
        // fontkit returns RTL runs in visual order, like HarfBuzz
        const glyphs: any[] = run.glyphs;
        const logical =
          params.direction === "rtl" ? [...glyphs].reverse() : glyphs;
        let clusters = clustersFromCodePoints(
          params.text,
          logical.map((g) => g.codePoints)
        );
        if (params.direction === "rtl") clusters = clusters.reverse();
        return glyphs.map((g, i) => ({
          g: g.id,
          cl: clusters[i],
          ax: Math.round(run.positions[i].xAdvance),
          ay: Math.round(run.positions[i].yAdvance),
          dx: Math.round(run.positions[i].xOffset),
          dy: Math.round(run.positions[i].yOffset),
        }));
      },
    };
  },
};
