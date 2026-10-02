import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import {
  generateKey,
  GitHubSettings,
  loadSettings,
  saveSettings,
} from "../engines/github";

export const GitHubSettingsForm = () => {
  const [settings, setSettings] = useState<GitHubSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const update = (patch: Partial<GitHubSettings>) => {
    setSaved(false);
    setSettings({ ...settings, ...patch });
  };

  return (
    <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2, maxWidth: 640 }}>
      <Box component="ol" sx={{ m: 0, pl: 3, fontSize: "0.9em" }}>
        <li>
          Use a fork of Crowbar on GitHub (it contains the{" "}
          <code>native-shape.yml</code> workflow) and enable Actions on it.
        </li>
        <li>
          Create a fine-grained personal access token for that repository with{" "}
          <b>Contents: read and write</b> and <b>Actions: read and write</b>.
        </li>
        <li>
          Generate an encryption key below and add it to the repository as the
          Actions secret <code>CROWBAR_KEY</code>. Fonts and results are
          encrypted with it, so they are not readable even in a public repo.
        </li>
      </Box>
      <TextField
        label="Repository (owner/name)"
        size="small"
        value={settings.repo}
        onChange={(e) => update({ repo: e.target.value.trim() })}
      />
      <TextField
        label="Personal access token"
        size="small"
        type="password"
        value={settings.token}
        onChange={(e) => update({ token: e.target.value.trim() })}
      />
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          label="Encryption key (CROWBAR_KEY)"
          size="small"
          fullWidth
          value={settings.key}
          onChange={(e) => update({ key: e.target.value.trim() })}
        />
        <Button onClick={() => update({ key: generateKey() })}>Generate</Button>
      </Box>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
        <Button
          variant="contained"
          onClick={() => {
            saveSettings(settings);
            setSaved(true);
          }}
        >
          Save
        </Button>
        {saved && <span>Saved in this browser.</span>}
      </Box>
    </Box>
  );
};
