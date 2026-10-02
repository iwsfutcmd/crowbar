//! WebAssembly wrappers around alternative shaping engines for Crowbar.
//!
//! Each engine takes a JSON-encoded `ShapeRequest` and returns a JSON array of
//! glyphs in the same shape as harfbuzzjs's buffer output (`g`, `cl`, `ax`,
//! `ay`, `dx`, `dy`, in font units), so the UI can treat all engines alike.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShapeRequest {
    text: String,
    /// HarfBuzz-syntax feature strings, e.g. "+liga", "-kern", "salt=2".
    features: Vec<String>,
    /// Resolved direction: "ltr", "rtl", "ttb" or "btt".
    direction: String,
    /// ISO 15924 script code, e.g. "Arab".
    script: String,
    /// OpenType script tag, e.g. "arab" (used by engines that want OT tags).
    ot_script: String,
    /// BCP 47 language (HarfBuzz syntax, may be "x-hbotXXX").
    language: String,
    /// OpenType language system tag, or empty.
    ot_language: String,
    cluster_level: u32,
    variations: Vec<(String, f32)>,
}

#[derive(Serialize)]
struct OutGlyph {
    g: u32,
    cl: u32,
    ax: i32,
    ay: i32,
    dx: i32,
    dy: i32,
}

fn tag_u32(s: &str) -> u32 {
    let mut bytes = [b' '; 4];
    for (i, b) in s.bytes().take(4).enumerate() {
        bytes[i] = b;
    }
    u32::from_be_bytes(bytes)
}

#[wasm_bindgen]
pub struct ShaperFont {
    data: Vec<u8>,
    face_index: u32,
}

#[wasm_bindgen]
impl ShaperFont {
    #[wasm_bindgen(constructor)]
    pub fn new(data: Vec<u8>, face_index: u32) -> ShaperFont {
        ShaperFont { data, face_index }
    }

    pub fn shape_harfrust(&self, request: &str) -> Result<String, JsError> {
        use harfrust::{
            BufferClusterLevel, Direction, Feature, FontRef, Language, Script, ShapeOptions,
            ShaperData, ShaperInstance, Tag, UnicodeBuffer, Variation,
        };

        let req: ShapeRequest = serde_json::from_str(request)?;
        let font = FontRef::from_index(&self.data, self.face_index)
            .map_err(|e| JsError::new(&format!("harfrust: {e}")))?;
        let data = ShaperData::new(&font);
        let variations: Vec<Variation> = req
            .variations
            .iter()
            .map(|(tag, value)| Variation {
                tag: Tag::new_checked(tag.as_bytes()).unwrap_or(Tag::new(b"    ")),
                value: *value,
            })
            .collect();
        let instance = ShaperInstance::from_variations(&font, &variations);
        let shaper = data
            .shaper(&font)
            .instance(Some(&instance))
            .build();

        let mut buffer = UnicodeBuffer::new();
        buffer.push_str(&req.text);
        buffer.set_cluster_level(match req.cluster_level {
            1 => BufferClusterLevel::MonotoneCharacters,
            2 => BufferClusterLevel::Characters,
            _ => BufferClusterLevel::MonotoneGraphemes,
        });
        buffer.guess_segment_properties();
        if let Ok(direction) = req.direction.parse::<Direction>() {
            buffer.set_direction(direction);
        }
        if let Some(script) = Script::from_iso15924_tag(Tag::new(&tag_u32(&req.script).to_be_bytes())) {
            buffer.set_script(script);
        }
        if let Ok(language) = req.language.parse::<Language>() {
            buffer.set_language(language);
        }
        let features: Vec<Feature> = req
            .features
            .iter()
            .filter_map(|f| f.parse::<Feature>().ok())
            .collect();

        let glyphs = shaper.shape(buffer, ShapeOptions::new().features(&features));
        let out: Vec<OutGlyph> = glyphs
            .glyph_infos()
            .iter()
            .zip(glyphs.glyph_positions())
            .map(|(info, pos)| OutGlyph {
                g: info.glyph_id,
                cl: info.cluster,
                ax: pos.x_advance,
                ay: pos.y_advance,
                dx: pos.x_offset,
                dy: pos.y_offset,
            })
            .collect();
        Ok(serde_json::to_string(&out)?)
    }

    pub fn shape_allsorts(&self, request: &str) -> Result<String, JsError> {
        use allsorts::binary::read::ReadScope;
        use allsorts::font::MatchingPresentation;
        use allsorts::font_data::FontData;
        use allsorts::glyph_position::{GlyphLayout, TextDirection};
        use allsorts::gsub::{FeatureInfo, FeatureMask, FeatureMaskExt};
        use allsorts::tables::variable_fonts::avar::AvarTable;
        use allsorts::tables::variable_fonts::fvar::FvarTable;
        use allsorts::tables::{Fixed, FontTableProvider};
        use allsorts::{tag, Font};

        let req: ShapeRequest = serde_json::from_str(request)?;
        fn err<E: std::fmt::Debug>(e: E) -> JsError {
            JsError::new(&format!("allsorts: {e:?}"))
        }
        let scope = ReadScope::new(&self.data);
        let font_file = scope.read::<FontData<'_>>().map_err(err)?;
        let provider = font_file
            .table_provider(self.face_index as usize)
            .map_err(err)?;

        // Normalise user-space variation settings against fvar/avar.
        let tuple = {
            let fvar_data = provider.table_data(tag::FVAR).map_err(err)?;
            let avar_data = provider.table_data(tag::AVAR).map_err(err)?;
            match fvar_data {
                Some(fvar_data) if !req.variations.is_empty() => {
                    let fvar = ReadScope::new(&fvar_data)
                        .read::<FvarTable<'_>>()
                        .map_err(err)?;
                    let avar = avar_data
                        .as_ref()
                        .map(|d| ReadScope::new(d).read::<AvarTable<'_>>())
                        .transpose()
                        .map_err(err)?;
                    let user: Vec<Fixed> = fvar
                        .axes()
                        .map(|axis| {
                            req.variations
                                .iter()
                                .find(|(t, _)| tag_u32(t) == axis.axis_tag)
                                .map(|(_, v)| Fixed::from(*v))
                                .unwrap_or(axis.default_value)
                        })
                        .collect();
                    Some(fvar.normalize(user.into_iter(), avar.as_ref()).map_err(err)?)
                }
                _ => None,
            }
        };

        let mut font = Font::new(provider).map_err(err)?;
        let script_tag = tag_u32(&req.ot_script);
        let lang_tag = if req.ot_language.trim().is_empty() {
            None
        } else {
            Some(tag_u32(&req.ot_language))
        };

        // Start from Allsorts' default features and apply the user's overrides.
        let mut mask = FeatureMask::default_mask();
        let mut kerning = true;
        let mut custom: Vec<FeatureInfo> = Vec::new();
        for f in &req.features {
            let (on, rest) = match f.as_bytes().first() {
                Some(b'-') => (false, &f[1..]),
                Some(b'+') => (true, &f[1..]),
                _ => (true, f.as_str()),
            };
            let (name, value) = match rest.split_once('=') {
                Some((n, v)) => (n, v.trim().parse::<usize>().ok()),
                None => (rest, None),
            };
            let on = on && value != Some(0);
            let ftag = tag_u32(name.trim());
            if ftag == tag::KERN {
                kerning = on;
            }
            let bit = FeatureMask::from_tag(ftag);
            if bit.is_empty() {
                if on {
                    custom.push(FeatureInfo {
                        feature_tag: ftag,
                        alternate: value.map(|v| v.saturating_sub(1)),
                    });
                }
            } else if on {
                mask |= bit;
            } else {
                mask &= !bit;
            }
        }

        let glyphs = font.map_glyphs(&req.text, script_tag, MatchingPresentation::NotRequired);
        let tuple_ref = tuple.as_ref().map(|t| t.as_tuple());
        let infos = match font.shape(glyphs, script_tag, lang_tag, mask, &custom, tuple_ref, kerning) {
            Ok(infos) => infos,
            Err((_, infos)) => infos,
        };

        let rtl = req.direction == "rtl";
        let vertical = req.direction == "ttb" || req.direction == "btt";
        let direction = if rtl {
            TextDirection::RightToLeft
        } else {
            TextDirection::LeftToRight
        };
        let positions = GlyphLayout::new(&mut font, &infos, direction, vertical)
            .glyph_positions()
            .map_err(err)?;

        // Allsorts doesn't track clusters, so reconstruct them from the
        // characters each glyph consumed, as UTF-8 byte offsets like HarfBuzz.
        let char_offsets: Vec<u32> = req.text.char_indices().map(|(i, _)| i as u32).collect();
        let mut consumed = 0usize;
        let mut last_cluster = 0u32;
        let mut out: Vec<OutGlyph> = infos
            .iter()
            .zip(positions.iter())
            .map(|(info, pos)| {
                let n = info.glyph.unicodes.len();
                let cl = if n > 0 {
                    let cl = char_offsets.get(consumed).copied().unwrap_or(last_cluster);
                    consumed += n;
                    cl
                } else {
                    last_cluster
                };
                last_cluster = cl;
                OutGlyph {
                    g: u32::from(info.glyph.glyph_index),
                    cl,
                    ax: if vertical { 0 } else { pos.hori_advance },
                    ay: if vertical { -pos.vert_advance } else { 0 },
                    dx: pos.x_offset,
                    dy: pos.y_offset,
                }
            })
            .collect();
        if rtl {
            // HarfBuzz reports RTL runs in visual order; match it.
            out.reverse();
        }
        Ok(serde_json::to_string(&out)?)
    }
}

#[wasm_bindgen]
pub fn versions() -> String {
    format!(
        "{{\"harfrust\":\"{}\",\"allsorts\":\"{}\"}}",
        env!("HARFRUST_VERSION"),
        env!("ALLSORTS_VERSION")
    )
}
