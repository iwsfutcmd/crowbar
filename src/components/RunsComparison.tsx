import React, { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import { CrowbarFont, HBGlyph } from "../opentype/CrowbarFont";

const HB_COLOR = "#1e88e5";
const ENGINE_COLOR = "#e53935";
const HEIGHT = 110;

type Props = {
  font: CrowbarFont;
  hbGlyphs: HBGlyph[];
  engineName: string;
  engineGlyphs: HBGlyph[] | null;
  highlightedGlyph: number;
};

// Renders HarfBuzz's output, the other engine's output and an overlay of the
// two, all at the same scale, so differences can be seen rather than read.
export const RunsComparison = ({
  font,
  hbGlyphs,
  engineName,
  engineGlyphs,
  highlightedGlyph,
}: Props) => {
  const refs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];
  const key = JSON.stringify([hbGlyphs, engineGlyphs, highlightedGlyph]);

  useEffect(() => {
    const pictures: { glyphs: HBGlyph[]; fill?: string; opacity?: number }[][] =
      [[{ glyphs: hbGlyphs }]];
    if (engineGlyphs) {
      pictures.push([{ glyphs: engineGlyphs }]);
      pictures.push([
        { glyphs: hbGlyphs, fill: HB_COLOR, opacity: 0.5 },
        { glyphs: engineGlyphs, fill: ENGINE_COLOR, opacity: 0.5 },
      ]);
    }
    const svgs = font.glyphRunsToSVGs(pictures, highlightedGlyph);
    refs.forEach((ref, i) => {
      const el = ref.current;
      if (!el) return;
      el.replaceChildren();
      const svg = svgs[i];
      if (!svg) return;
      const vb = svg.viewbox();
      svg.size(vb.height ? (HEIGHT * vb.width) / vb.height : 0, HEIGHT);
      svg.addTo(el);
    });
    // key captures the glyph data; refs are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [font, key]);

  const row = (label: React.ReactNode, i: number) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 1 }}>
      <Box sx={{ width: 140, flexShrink: 0, fontSize: "0.9em" }}>{label}</Box>
      <Box ref={refs[i]} sx={{ overflowX: "auto", lineHeight: 0 }} />
    </Box>
  );

  const swatch = (color: string) => (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: 10,
        height: 10,
        mr: 0.5,
        backgroundColor: color,
        opacity: 0.7,
      }}
    />
  );

  return (
    <Box>
      {row(<b>HarfBuzz</b>, 0)}
      {engineGlyphs && row(<b>{engineName}</b>, 1)}
      {engineGlyphs &&
        row(
          <>
            <b>Overlay</b>
            <br />
            {swatch(HB_COLOR)}HarfBuzz
            <br />
            {swatch(ENGINE_COLOR)}
            {engineName}
          </>,
          2
        )}
    </Box>
  );
};
