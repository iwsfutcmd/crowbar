import React, { useEffect, useReducer, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import { CrowbarFont, HBGlyph } from "../opentype/CrowbarFont";
import { ShapingEngine } from "../engines";
import { harfbuzzEngine } from "../engines/harfbuzz";
import { resolveParams, UIShapingOptions } from "../engines/resolve";
import { subscribeNative } from "../engines/native";
import {
  loadResultsFile,
  loadSettings,
  NativeJobStatus,
  runNativeJob,
} from "../engines/github";
import { GlyphBox } from "./GlyphBox";
import { SVGArea } from "./SVGArea";
import { GitHubSettingsForm } from "./GitHubSettingsForm";

function sameGlyph(a?: HBGlyph, b?: HBGlyph) {
  if (!a || !b) return false;
  return (
    a.g === b.g &&
    a.cl === b.cl &&
    (a.ax || 0) === (b.ax || 0) &&
    (a.ay || 0) === (b.ay || 0) &&
    (a.dx || 0) === (b.dx || 0) &&
    (a.dy || 0) === (b.dy || 0)
  );
}

// Crowbar colours glyphs by cluster index, so number clusters sequentially in
// the same way for both rows; equal raw clusters get equal colours.
// Zero positions are dropped, as in CrowbarFont.shapeTrace, so GlyphBox
// doesn't display them.
function sequentialClusters(glyphs: HBGlyph[], clusterOrder: number[]) {
  return glyphs.map((g) => {
    if (!clusterOrder.includes(g.cl)) clusterOrder.push(g.cl);
    const out: HBGlyph = { g: g.g, cl: clusterOrder.indexOf(g.cl) };
    if (g.ax) out.ax = g.ax;
    if (g.ay) out.ay = g.ay;
    if (g.dx) out.dx = g.dx;
    if (g.dy) out.dy = g.dy;
    return out;
  });
}

function useEngineReady(engine: ShapingEngine) {
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    engine
      .ready()
      .then(() => live && setReady((r) => ({ ...r, [engine.id]: true })))
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [engine]);
  return { ready: !!ready[engine.id], error };
}

type Props = {
  font: CrowbarFont;
  text: string;
  engine: ShapingEngine;
  options: UIShapingOptions;
};

export const EngineOutput = ({ font, text, engine, options }: Props) => {
  const { ready, error: loadError } = useEngineReady(engine);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [highlightedGlyph, setHighlightedGlyph] = useState(-1);
  const [job, setJob] = useState<NativeJobStatus | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => subscribeNative(rerender), []);

  if (loadError) {
    return <Alert severity="error">Could not load {engine.name}: {loadError}</Alert>;
  }
  if (!ready) {
    return (
      <Box sx={{ p: 2 }}>
        <CircularProgress size={20} /> Loading {engine.name}…
      </Box>
    );
  }

  const params = resolveParams(text, options);
  const baseline = font.engineFont(harfbuzzEngine)!.shape(params) || [];
  let result: HBGlyph[] | null = null;
  let shapeError: string | null = null;
  try {
    result = font.engineFont(engine)!.shape(params);
  } catch (e) {
    shapeError = String(e);
  }

  const clusterOrder: number[] = [];
  const hbRow = sequentialClusters(baseline, clusterOrder);
  const engineRow = result ? sequentialClusters(result, clusterOrder) : null;
  const differs = engineRow
    ? Array.from(
        { length: Math.max(hbRow.length, engineRow.length) },
        (_, i) => !sameGlyph(hbRow[i], engineRow[i])
      )
    : [];
  const diffCount = differs.filter(Boolean).length;

  const startJob = () => {
    const settings = loadSettings();
    if (!settings.repo || !settings.token || !settings.key) {
      setShowSettings(true);
      return;
    }
    runNativeJob(
      settings,
      { bytes: font.bytes!, faceIdx: font.faceIdx, hash: font.hash },
      [params],
      setJob
    );
  };

  const loadFile = (file: File) => {
    file
      .text()
      .then((json) => loadResultsFile(font.hash, json))
      .catch((e) => setJob({ state: "error", message: String(e) }));
  };

  const jobBusy =
    job && (job.state === "uploading" || job.state === "queued" || job.state === "running");

  const renderRow = (
    label: string,
    version: string,
    glyphs: HBGlyph[],
    rowDiffers: boolean[]
  ) => (
    <TableRow>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        <b>{label}</b>
        <br />
        <small>{version}</small>
      </TableCell>
      <TableCell>
        {glyphs.map((glyph, ix) => (
          <span
            key={ix}
            onMouseEnter={() => setHighlightedGlyph(glyph.cl)}
            onMouseLeave={() => setHighlightedGlyph(-1)}
          >
            <GlyphBox
              glyph={glyph}
              font={font}
              color={rowDiffers[ix] ? "glyphdiffers" : ""}
            />
          </span>
        ))}
      </TableCell>
    </TableRow>
  );

  return (
    <div>
      <SVGArea
        highlightedglyph={highlightedGlyph}
        glyphstring={engineRow || hbRow}
        font={font}
      />
      <Box sx={{ my: 2 }}>
        <Alert
          severity={
            shapeError ? "error" : !engineRow ? "info" : diffCount ? "warning" : "success"
          }
        >
          {shapeError && <>{engine.name} failed: {shapeError}</>}
          {!shapeError && !engineRow && (
            <>
              No {engine.name} result for this text and these settings yet.{" "}
              {engine.description}.
            </>
          )}
          {engineRow &&
            (diffCount
              ? `${engine.name} differs from HarfBuzz at ${diffCount} glyph position${diffCount === 1 ? "" : "s"} (highlighted).`
              : `${engine.name} output is identical to HarfBuzz.`)}{" "}
          Lookup-by-lookup tracing is only available with HarfBuzz.
        </Alert>
      </Box>

      {engine.location === "native" && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="contained" onClick={startJob} disabled={!!jobBusy}>
              Shape on GitHub Actions
            </Button>
            <Button component="label" variant="outlined">
              Load results file
              <input
                hidden
                type="file"
                accept=".json,application/json"
                onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
              />
            </Button>
            <Button onClick={() => setShowSettings(!showSettings)}>
              GitHub settings
            </Button>
            {jobBusy && <CircularProgress size={20} />}
            {job && <JobStatusText job={job} />}
          </Box>
          <Box component="p" sx={{ mb: 0, fontSize: "0.85em", opacity: 0.8 }}>
            Shapes the current text with CoreText (macOS runner) and DirectWrite
            and Uniscribe (Windows runner), usually in 1–3 minutes. The font is
            encrypted in your browser before upload and results are cached
            locally.
          </Box>
          {showSettings && <GitHubSettingsForm />}
        </Paper>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableBody>
            {renderRow("HarfBuzz", harfbuzzEngine.version(), hbRow, engineRow ? differs : [])}
            {engineRow && renderRow(engine.name, engine.version(), engineRow, differs)}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

const JobStatusText = ({ job }: { job: NativeJobStatus }) => {
  const link =
    "url" in job && job.url ? (
      <>
        {" "}
        (<Link href={job.url} target="_blank" rel="noreferrer">run</Link>)
      </>
    ) : null;
  switch (job.state) {
    case "uploading":
      return <span>Uploading encrypted job…</span>;
    case "queued":
      return <span>Waiting for runners…{link}</span>;
    case "running":
      return <span>Shaping…{link}</span>;
    case "done":
      return (
        <span>
          Done{job.failed.length ? `, but ${job.failed.join(" and ")} failed` : ""}.
          {link}
        </span>
      );
    case "error":
      return (
        <Box component="span" sx={{ color: "error.main" }}>
          {job.message}
          {link}
        </Box>
      );
    default:
      return null;
  }
};
