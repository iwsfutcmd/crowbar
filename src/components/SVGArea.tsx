import React, { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import { CrowbarFont, HBGlyph } from "../opentype/CrowbarFont";

export type SVGProps = {
  glyphstring: HBGlyph[];
  font: CrowbarFont;
  highlightedglyph: number;
};

function deleteAllChildren(e: HTMLElement) {
  let child = e.lastElementChild;
  while (child) {
    e.removeChild(child);
    child = e.lastElementChild;
  }
}

export const SVGArea = ({ glyphstring, font, highlightedglyph }: SVGProps) => {
  const svg = useRef<HTMLDivElement>(null);
  // Draw after mount: during the first render the ref isn't attached yet, so
  // drawing during render left the preview one update behind.
  useEffect(() => {
    if (!svg.current) return;
    deleteAllChildren(svg.current);
    font.glyphstringToSVG(glyphstring, highlightedglyph).addTo(svg.current);
  }, [font, glyphstring, highlightedglyph]);
  return (
    <Box
      sx={{
        position: "fixed",
        top: "80px",
        left: "60%",
        zIndex: 5,
        width: "35%",
        maxHeight: 200,
        backgroundColor: "#f5f5f5",
        padding: "5px",
      }}
    >
      <Box
        ref={svg}
        sx={{
          display: "flex",
          flexFlow: "column",
          width: "40%",
          maxHeight: 200,
        }}
      />
    </Box>
  );
};
