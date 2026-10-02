"""Shape text with the platform's native shaping engines for Crowbar.

Uses uharfbuzz, whose wheels are built with HarfBuzz's CoreText shaper on
macOS and its DirectWrite and Uniscribe shapers on Windows. Those shapers hand
the actual shaping to the operating system and return the result in HarfBuzz's
buffer format, which is exactly what Crowbar displays.

Two modes:

  # GitHub Actions: encrypted job in, encrypted results out (key in CROWBAR_KEY)
  python shape.py --job job.enc --out results.enc --engines coretext

  # Local use: plain font + strings in, plain JSON out (load it in Crowbar)
  python shape.py --font MyFont.otf --text "office" --text "AVA" --out results.json
"""

import argparse
import base64
import hashlib
import json
import os
import platform
import re
import sys

import uharfbuzz as hb

PLATFORM_ENGINES = {
    "darwin": ["coretext"],
    "win32": ["directwrite", "uniscribe"],
}

FEATURE_RE = re.compile(r"^([+-]?)(\w{1,4})(?:\[[^\]]*\])?(?:=(\d+))?$")


def platform_name():
    if sys.platform == "darwin":
        return f"macOS {platform.mac_ver()[0]}"
    if sys.platform == "win32":
        return f"Windows {platform.version()}"
    return platform.platform()


def parse_features(features):
    """HarfBuzz feature strings -> uharfbuzz features dict. Ranges are ignored."""
    out = {}
    for f in features:
        m = FEATURE_RE.match(f.strip())
        if not m:
            continue
        sign, tag, value = m.groups()
        out[tag] = False if sign == "-" else (int(value) if value else True)
    return out


def utf16_offsets(text):
    offsets, u16 = [], 0
    for ch in text:
        offsets.append(u16)
        u16 += 2 if ord(ch) > 0xFFFF else 1
    offsets.append(u16)
    return offsets


def shape_one(font, engine, params):
    text = params["text"]
    font.set_variations(params.get("variations") or {})
    buf = hb.Buffer()
    buf.add_codepoints([ord(c) for c in text])
    buf.cluster_level = params.get("clusterLevel", 0)
    buf.direction = params["direction"]
    buf.script = params["script"]
    if params.get("language"):
        buf.language = params["language"]
    hb.shape(font, buf, parse_features(params.get("features", [])), shapers=[engine])
    offsets = utf16_offsets(text)
    return [
        {
            "g": info.codepoint,
            # add_codepoints numbers clusters by code point; Crowbar uses UTF-16
            "cl": offsets[min(info.cluster, len(offsets) - 1)],
            "ax": pos.x_advance,
            "ay": pos.y_advance,
            "dx": pos.x_offset,
            "dy": pos.y_offset,
        }
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions)
    ]


def shape_all(font_bytes, face_index, requests, engines):
    face = hb.Face(hb.Blob(font_bytes), face_index)
    font = hb.Font(face)
    out = []
    for engine in engines:
        results = []
        for params in requests:
            try:
                glyphs, error = shape_one(font, engine, params), None
            except Exception as e:  # report per-string failures to the UI
                glyphs, error = None, f"{type(e).__name__}: {e}"
            entry = {"params": params, "glyphs": glyphs}
            if error:
                entry["error"] = error
            results.append(entry)
        out.append(
            {
                "engine": engine,
                "platform": platform_name(),
                "harfbuzz": hb.version_string(),
                "results": results,
            }
        )
    return out


def default_params(text, args):
    return {
        "text": text,
        "features": args.features.split(",") if args.features else [],
        "direction": args.direction,
        "script": args.script,
        "otScript": args.script.lower(),
        "language": args.language or "",
        "otLanguage": "",
        "clusterLevel": 0,
        "variations": {},
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--job", help="encrypted job file (needs CROWBAR_KEY)")
    ap.add_argument("--font", help="font file (local mode)")
    ap.add_argument("--face-index", type=int, default=0)
    ap.add_argument("--text", action="append", default=[], help="string to shape")
    ap.add_argument("--direction", default="ltr")
    ap.add_argument("--script", default="Latn", help="ISO 15924 script code")
    ap.add_argument("--language", default="")
    ap.add_argument("--features", default="", help='e.g. "-liga,+ss01"')
    ap.add_argument("--engines", help="comma-separated; default: all on this OS")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    engines = (
        args.engines.split(",")
        if args.engines
        else PLATFORM_ENGINES.get(sys.platform, ["ot"])
    )

    if args.job:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        aes = AESGCM(base64.b64decode(os.environ["CROWBAR_KEY"]))
        blob = open(args.job, "rb").read()
        job = json.loads(aes.decrypt(blob[:12], blob[12:], None))
        font_bytes = base64.b64decode(job["font"])
        payload = {
            "engines": shape_all(font_bytes, job["faceIndex"], job["requests"], engines)
        }
        iv = os.urandom(12)
        data = iv + aes.encrypt(iv, json.dumps(payload).encode(), None)
        open(args.out, "wb").write(data)
    else:
        font_bytes = open(args.font, "rb").read()
        requests = [default_params(t, args) for t in args.text]
        payload = {
            "fontSha256": hashlib.sha256(font_bytes).hexdigest(),
            "engines": shape_all(font_bytes, args.face_index, requests, engines),
        }
        json.dump(payload, open(args.out, "w", encoding="utf-8"), ensure_ascii=False)

    for e in payload["engines"]:
        errors = sum(1 for r in e["results"] if "error" in r)
        print(f"{e['engine']}: {len(e['results'])} strings, {errors} errors")


if __name__ == "__main__":
    main()
