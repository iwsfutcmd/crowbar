import type { HBGlyph } from "../opentype/CrowbarFont";
import type { EngineFont, ShapeParams, ShapingEngine } from "./types";
import { utf8ToUtf16Offsets } from "./resolve";

type ShapersModule = typeof import("./wasm/shapers");

let shapers: ShapersModule | null = null;
let loading: Promise<ShapersModule> | null = null;

function loadShapers(): Promise<ShapersModule> {
  if (!loading) {
    loading = import("./wasm/shapers").then(async (mod) => {
      await mod.default();
      shapers = mod;
      return mod;
    });
  }
  return loading;
}

function rustEngine(
  id: "harfrust" | "allsorts",
  name: string,
  description: string
): ShapingEngine {
  return {
    id,
    name,
    description,
    location: "browser",
    ready: async () => {
      await loadShapers();
    },
    version: () =>
      shapers ? JSON.parse(shapers.versions())[id] ?? "?" : "not loaded",
    loadFont(bytes: Uint8Array, faceIndex: number): EngineFont {
      let font: InstanceType<ShapersModule["ShaperFont"]> | null = null;
      return {
        shape(params: ShapeParams): HBGlyph[] | null {
          if (!shapers) return null;
          font = font ?? new shapers.ShaperFont(bytes, faceIndex);
          const request = JSON.stringify({
            ...params,
            variations: Object.entries(params.variations),
          });
          const raw: HBGlyph[] = JSON.parse(
            id === "harfrust"
              ? font.shape_harfrust(request)
              : font.shape_allsorts(request)
          );
          const offsets = utf8ToUtf16Offsets(params.text);
          return raw.map((g) => ({ ...g, cl: offsets.get(g.cl) ?? g.cl }));
        },
      };
    },
  };
}

export const harfrustEngine = rustEngine(
  "harfrust",
  "HarfRust",
  "The HarfBuzz team's Rust port of HarfBuzz (WebAssembly)"
);

export const allsortsEngine = rustEngine(
  "allsorts",
  "Allsorts",
  "YesLogic's independent Rust shaping engine, used by Prince (WebAssembly)"
);
