import { harfbuzzScripts } from "../opentype/constants";
import type { ShapeParams } from "./types";

// Scripts whose horizontal direction is right-to-left (from HarfBuzz's
// hb_script_get_horizontal_direction).
const RTL_SCRIPTS = new Set([
  "Arab", "Hebr", "Syrc", "Thaa", "Cprt", "Khar", "Phnx", "Nkoo", "Lydi",
  "Avst", "Armi", "Phli", "Prti", "Sarb", "Orkh", "Samr", "Mand", "Merc",
  "Mero", "Narb", "Nbat", "Palm", "Phlp", "Hatr", "Mani", "Adlm", "Hung",
  "Rohg", "Sogo", "Sogd", "Elym", "Chrs", "Yezi", "Ougr", "Gara", "Todr",
]);

// OpenType script tags that aren't just the lowercased ISO 15924 code.
const OT_SCRIPT_EXCEPTIONS: Record<string, string> = {
  Hira: "kana",
  Hrkt: "kana",
  Kana: "kana",
  Laoo: "lao ",
  Yiii: "yi  ",
  Nkoo: "nko ",
  Vaii: "vai ",
  Zyyy: "DFLT",
  Zinh: "DFLT",
  Zzzz: "DFLT",
};

// Built with the RegExp constructor because the tsconfig target predates the
// "u" flag on literals.
const NEUTRAL = new RegExp("[\\p{Script=Zyyy}\\p{Script=Zinh}]", "u");
const scriptRegexes: [string, RegExp][] = [];
function getScriptRegexes() {
  if (scriptRegexes.length === 0) {
    harfbuzzScripts.forEach(({ tag }: { tag: string }) => {
      if (tag === "Zyyy" || tag === "Zinh" || tag === "Zzzz") return;
      try {
        scriptRegexes.push([tag, new RegExp(`\\p{Script=${tag}}`, "u")]);
      } catch {
        // Script too new for this JS engine's Unicode tables
      }
    });
  }
  return scriptRegexes;
}

// Like hb_buffer_guess_segment_properties: the first character with a real
// script determines the script.
export function detectScript(text: string): string {
  const regexes = getScriptRegexes();
  for (const ch of text) {
    if (NEUTRAL.test(ch)) continue;
    const found = regexes.find(([, re]) => re.test(ch));
    if (found) return found[0];
  }
  return "Zyyy";
}

export function otScriptTag(iso: string): string {
  return OT_SCRIPT_EXCEPTIONS[iso] ?? iso.toLowerCase();
}

// Crowbar's language picker offers OpenType language-system tags ("ARA "),
// which HarfBuzz would otherwise misread as BCP 47; "x-hbot" passes the tag
// through verbatim.
function isOtLanguageTag(language: string) {
  return /^[A-Z][A-Z0-9 ]{2,3}$/.test(language);
}

export function hbLanguage(language: string): string {
  if (!language) return "";
  return isOtLanguageTag(language)
    ? `x-hbot${language.trimEnd()}`
    : language;
}

export interface UIShapingOptions {
  features: Record<string, boolean | string>;
  featureString?: string;
  clusterLevel: number;
  direction: string;
  script: string;
  language: string;
  variations?: Record<string, number>;
}

export function featureList(options: UIShapingOptions): string[] {
  const s =
    options.featureString ||
    Object.keys(options.features)
      .map((f) => (options.features[f] ? "+" : "-") + f)
      .join(",");
  return s
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

export function resolveParams(
  text: string,
  options: UIShapingOptions
): ShapeParams {
  const script = options.script || detectScript(text);
  let direction = options.direction as ShapeParams["direction"];
  if (!["ltr", "rtl", "ttb", "btt"].includes(direction)) {
    direction = RTL_SCRIPTS.has(script) ? "rtl" : "ltr";
  }
  return {
    text,
    features: featureList(options),
    direction,
    script,
    otScript: otScriptTag(script),
    language: hbLanguage(options.language),
    otLanguage: isOtLanguageTag(options.language) ? options.language : "",
    clusterLevel: options.clusterLevel,
    variations: options.variations || {},
  };
}

// Engines written in Rust report clusters as UTF-8 byte offsets; harfbuzzjs
// uses UTF-16 code units. Build a byte-offset -> UTF-16 offset map.
export function utf8ToUtf16Offsets(text: string): Map<number, number> {
  const map = new Map<number, number>();
  let byte = 0;
  let u16 = 0;
  for (const ch of text) {
    map.set(byte, u16);
    const cp = ch.codePointAt(0)!;
    byte += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    u16 += ch.length;
  }
  map.set(byte, u16);
  return map;
}
