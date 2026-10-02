import type { HBGlyph } from "../opentype/CrowbarFont";
import type { EngineFont, ShapeParams, ShapingEngine } from "./types";

// Native engines (CoreText, DirectWrite, Uniscribe) can't run in the browser.
// Their results are produced in batches on GitHub Actions (see github.ts and
// native/shape.py) and cached here, keyed by font hash and shaping inputs.

export interface NativeResultFile {
  engine: string;
  platform: string;
  harfbuzz: string;
  results: { params: ShapeParams; glyphs: HBGlyph[] | null; error?: string }[];
}

export function paramsKey(params: ShapeParams): string {
  // Stable key: fixed field order, sorted variations
  return JSON.stringify([
    params.text,
    params.features,
    params.direction,
    params.script,
    params.language,
    params.clusterLevel,
    Object.entries(params.variations).sort(),
  ]);
}

interface CachedResult {
  glyphs: HBGlyph[] | null;
  error?: string;
}

// fontHash -> engine -> paramsKey -> result
const cache = new Map<string, Map<string, Map<string, CachedResult>>>();
const platforms = new Map<string, string>();
const listeners = new Set<() => void>();

export function subscribeNative(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => l());
}

// Results are small, so keep them in localStorage per font to survive reloads.
const STORAGE_PREFIX = "crowbar.native.";

function persisted(fontHash: string): NativeResultFile[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + fontHash) || "[]");
  } catch {
    return [];
  }
}

function persist(fontHash: string, file: NativeResultFile) {
  try {
    const files = persisted(fontHash);
    const existing = files.find((f) => f.engine === file.engine);
    if (existing) {
      const keys = new Set(file.results.map((r) => paramsKey(r.params)));
      existing.results = [
        ...existing.results.filter((r) => !keys.has(paramsKey(r.params))),
        ...file.results,
      ];
      existing.platform = file.platform;
      existing.harfbuzz = file.harfbuzz;
    } else {
      files.push(file);
    }
    localStorage.setItem(STORAGE_PREFIX + fontHash, JSON.stringify(files));
  } catch {
    // Storage full or unavailable: results last for this session only
  }
}

const restored = new Set<string>();
function restore(fontHash: string) {
  if (restored.has(fontHash)) return;
  restored.add(fontHash);
  persisted(fontHash).forEach((file) => addToCache(fontHash, file));
}

export function addNativeResults(fontHash: string, file: NativeResultFile) {
  restore(fontHash);
  addToCache(fontHash, file);
  persist(fontHash, file);
  notify();
}

function addToCache(fontHash: string, file: NativeResultFile) {
  if (!cache.has(fontHash)) cache.set(fontHash, new Map());
  const byEngine = cache.get(fontHash)!;
  if (!byEngine.has(file.engine)) byEngine.set(file.engine, new Map());
  const results = byEngine.get(file.engine)!;
  file.results.forEach((r) => {
    const key = paramsKey(r.params);
    results.set(key, { glyphs: r.glyphs, error: r.error });
  });
  platforms.set(file.engine, `${file.platform}, via HarfBuzz ${file.harfbuzz}`);
}

export function lookupNative(
  fontHash: string,
  engine: string,
  params: ShapeParams
): CachedResult | undefined {
  restore(fontHash);
  return cache.get(fontHash)?.get(engine)?.get(paramsKey(params));
}

function nativeEngine(
  id: string,
  name: string,
  description: string
): ShapingEngine {
  return {
    id,
    name,
    description,
    location: "native",
    ready: async () => {},
    version: () => platforms.get(id) ?? "no results yet",
    loadFont(_bytes: Uint8Array, _faceIndex: number, fontHash: string): EngineFont {
      return {
        shape(params: ShapeParams): HBGlyph[] | null {
          const hit = lookupNative(fontHash, id, params);
          if (!hit) return null;
          if (hit.error) throw new Error(hit.error);
          return hit.glyphs;
        },
      };
    },
  };
}

export const NATIVE_ENGINES = ["coretext", "directwrite", "uniscribe"];

export const coretextEngine = nativeEngine(
  "coretext",
  "CoreText",
  "Apple's shaper (macOS, iOS), run on a GitHub Actions macOS runner"
);
export const directwriteEngine = nativeEngine(
  "directwrite",
  "DirectWrite",
  "Microsoft's modern shaper, run on a GitHub Actions Windows runner"
);
export const uniscribeEngine = nativeEngine(
  "uniscribe",
  "Uniscribe",
  "Microsoft's legacy shaper, run on a GitHub Actions Windows runner"
);
