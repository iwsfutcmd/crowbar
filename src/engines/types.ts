import type { HBGlyph } from "../opentype/CrowbarFont";

// Fully-resolved shaping inputs. Direction and script are never "auto" here:
// they are resolved once (see resolve.ts) so every engine sees the same input.
export interface ShapeParams {
  text: string;
  // HarfBuzz-syntax feature strings, e.g. "+liga", "-kern", "salt=2"
  features: string[];
  direction: "ltr" | "rtl" | "ttb" | "btt";
  // ISO 15924 script code, e.g. "Arab"
  script: string;
  // OpenType script tag, e.g. "arab"
  otScript: string;
  // HarfBuzz/BCP 47 language string (may be "x-hbotXXXX"), or ""
  language: string;
  // OpenType language system tag, or ""
  otLanguage: string;
  clusterLevel: number;
  variations: Record<string, number>;
}

export interface EngineFont {
  // Returns the shaped glyphs (clusters as UTF-16 offsets into the text), or
  // null when the engine has no result for these inputs (e.g. a native engine
  // whose results haven't been fetched yet).
  shape(params: ShapeParams): HBGlyph[] | null;
}

export interface ShapingEngine {
  id: string;
  name: string;
  description: string;
  // "browser" engines run locally; "native" engines run on GitHub Actions.
  location: "browser" | "native";
  ready(): Promise<void>;
  version(): string;
  loadFont(bytes: Uint8Array, faceIndex: number, fontHash: string): EngineFont;
}

export const HARFBUZZ_ID = "harfbuzz";
