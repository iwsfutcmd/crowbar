import type * as HarfBuzz from "harfbuzzjs";
import { hbSingleton, initHB } from "../opentype/CrowbarFont";
import type { HBGlyph } from "../opentype/CrowbarFont";
import { HARFBUZZ_ID, EngineFont, ShapeParams, ShapingEngine } from "./types";

// Plain (untraced) HarfBuzz shaping with fully-resolved parameters, used as the
// baseline other engines are compared against. The traced view still goes
// through CrowbarFont.shapeTrace.
export function hbShape(hbFont: HarfBuzz.Font, params: ShapeParams): HBGlyph[] {
  const hb = hbSingleton!;
  hbFont.setVariations(
    Object.entries(params.variations).map(
      ([tag, value]) => new hb.Variation(tag, value)
    )
  );
  const buffer = new hb.Buffer();
  buffer.setClusterLevel(params.clusterLevel as HarfBuzz.ClusterLevel);
  buffer.addText(params.text);
  buffer.setDirection(
    (hb.Direction as any)[params.direction.toUpperCase()] as HarfBuzz.Direction
  );
  buffer.setScript(params.script);
  if (params.language) buffer.setLanguage(params.language);
  const features = params.features
    .map((f) => hb.Feature.fromString(f))
    .filter((f): f is HarfBuzz.Feature => f !== undefined);
  hb.shape(hbFont, buffer, features);
  return buffer.getGlyphInfosAndPositions().map((info) => ({
    g: info.codepoint,
    cl: info.cluster,
    ax: info.xAdvance,
    ay: info.yAdvance,
    dx: info.xOffset,
    dy: info.yOffset,
  }));
}

export const harfbuzzEngine: ShapingEngine = {
  id: HARFBUZZ_ID,
  name: "HarfBuzz",
  description: "The reference open-source shaper, with full lookup tracing (WebAssembly)",
  location: "browser",
  ready: async () => {
    await initHB();
  },
  version: () => (hbSingleton ? hbSingleton.versionString() : "not loaded"),
  loadFont(bytes: Uint8Array, faceIndex: number): EngineFont {
    let font: HarfBuzz.Font | null = null;
    return {
      shape(params: ShapeParams) {
        const hb = hbSingleton!;
        font =
          font ?? new hb.Font(new hb.Face(new hb.Blob(bytes), faceIndex));
        return hbShape(font, params);
      },
    };
  },
};
