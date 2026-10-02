// Runs native shaping engines (CoreText, DirectWrite, Uniscribe) on GitHub
// Actions runners.
//
// Flow: the font and the shaping requests are encrypted in the browser with a
// key that is also stored as the repository secret CROWBAR_KEY, committed to a
// jobs branch, and the native-shape workflow is dispatched. The workflow
// decrypts the job, shapes on macOS and Windows runners, and commits encrypted
// results plus an unencrypted done.json marker back to the jobs branch, which
// we poll for. Fonts and results are therefore never readable in the repo.

import type { ShapeParams } from "./types";
import { addNativeResults, NativeResultFile } from "./native";

export interface GitHubSettings {
  repo: string; // "owner/name"
  token: string;
  key: string; // base64 AES-256 key, also stored as the CROWBAR_KEY secret
}

const SETTINGS_KEY = "crowbar.github";
export const JOBS_BRANCH = "crowbar-native-jobs";
const WORKFLOW = "native-shape.yml";

export function loadSettings(): GitHubSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { repo: "", token: "", key: "", ...saved };
  } catch {
    return { repo: "", token: "", key: "" };
  }
}

export function saveSettings(settings: GitHubSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable; settings last for this session only
  }
}

export function generateKey(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + 0x8000))
    );
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(key: string) {
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(key) as BufferSource,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

// Layout: 12-byte IV followed by AES-GCM ciphertext (with tag)
async function encrypt(key: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await importKey(key),
      plaintext as BufferSource
    )
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return out;
}

async function decrypt(key: string, blob: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: blob.subarray(0, 12) as BufferSource },
      await importKey(key),
      blob.subarray(12) as BufferSource
    )
  );
}

class GitHub {
  constructor(private settings: GitHubSettings) {}

  async request(path: string, init: RequestInit = {}, accept?: string) {
    const res = await fetch(
      `https://api.github.com/repos/${this.settings.repo}${path}`,
      {
        ...init,
        headers: {
          Accept: accept ?? "application/vnd.github+json",
          Authorization: `Bearer ${this.settings.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(init.headers || {}),
        },
      }
    );
    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      throw new Error(`GitHub ${res.status} on ${path}: ${body.slice(0, 300)}`);
    }
    return res;
  }

  async json(path: string, init: RequestInit = {}) {
    const res = await this.request(path, init);
    return res.status === 404 ? null : res.json();
  }

  async defaultBranch(): Promise<string> {
    const repo = await this.json("");
    if (!repo) throw new Error(`Repository ${this.settings.repo} not found`);
    return repo.default_branch;
  }

  async ensureJobsBranch(defaultBranch: string) {
    if (await this.json(`/git/ref/heads/${JOBS_BRANCH}`)) return;
    const base = await this.json(`/git/ref/heads/${defaultBranch}`);
    await this.json(`/git/refs`, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${JOBS_BRANCH}`,
        sha: base.object.sha,
      }),
    });
  }

  async putFile(path: string, content: Uint8Array, message: string) {
    await this.json(`/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: bytesToBase64(content),
        branch: JOBS_BRANCH,
      }),
    });
  }

  async getRaw(path: string): Promise<Uint8Array | null> {
    const res = await this.request(
      `/contents/${path}?ref=${JOBS_BRANCH}`,
      { cache: "no-store" },
      "application/vnd.github.raw"
    );
    if (res.status === 404) return null;
    return new Uint8Array(await res.arrayBuffer());
  }

  async deleteDir(dir: string) {
    const listing = await this.json(`/contents/${dir}?ref=${JOBS_BRANCH}`);
    for (const file of listing ?? []) {
      await this.json(`/contents/${file.path}`, {
        method: "DELETE",
        body: JSON.stringify({
          message: `Clean up ${dir}`,
          sha: file.sha,
          branch: JOBS_BRANCH,
        }),
      });
    }
  }

  async findRun(jobId: string) {
    const runs = await this.json(
      `/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=20`
    );
    return (runs?.workflow_runs ?? []).find((r: any) =>
      String(r.display_title).includes(jobId)
    );
  }
}

export type NativeJobStatus =
  | { state: "uploading" }
  | { state: "queued" | "running"; url?: string }
  | { state: "done"; url?: string; failed: string[] }
  | { state: "error"; message: string; url?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runNativeJob(
  settings: GitHubSettings,
  font: { bytes: Uint8Array; faceIdx: number; hash: string },
  requests: ShapeParams[],
  onStatus: (status: NativeJobStatus) => void
) {
  const gh = new GitHub(settings);
  const jobId = `${font.hash.slice(0, 12)}-${Date.now().toString(36)}`;
  const dir = `jobs/${jobId}`;
  let runUrl: string | undefined;
  try {
    onStatus({ state: "uploading" });
    const defaultBranch = await gh.defaultBranch();
    await gh.ensureJobsBranch(defaultBranch);
    const job = new TextEncoder().encode(
      JSON.stringify({
        font: bytesToBase64(font.bytes),
        faceIndex: font.faceIdx,
        requests,
      })
    );
    await gh.putFile(
      `${dir}/job.enc`,
      await encrypt(settings.key, job),
      `Native shaping job ${jobId}`
    );
    // Responds 204 with no body, so don't parse it
    await gh.request(`/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      body: JSON.stringify({
        ref: defaultBranch,
        inputs: { job_id: jobId, jobs_branch: JOBS_BRANCH },
      }),
    });
    onStatus({ state: "queued" });

    // Runners usually take 1-3 minutes; give up after 20.
    const deadline = Date.now() + 20 * 60 * 1000;
    while (Date.now() < deadline) {
      await sleep(8000);
      const run = await gh.findRun(jobId);
      if (run) runUrl = run.html_url;
      // Check for results first: if one platform failed the run is marked as
      // failed, but the other platform's results are still committed.
      const done = await gh.getRaw(`${dir}/done.json`);
      if (!done) {
        if (run?.status === "completed") {
          throw new Error(`Workflow run ${run.conclusion}`);
        }
        if (run) {
          onStatus({
            state: run.status === "queued" ? "queued" : "running",
            url: runUrl,
          });
        }
        continue;
      }
      const marker = JSON.parse(new TextDecoder().decode(done));
      for (const file of marker.files as string[]) {
        const blob = await gh.getRaw(`${dir}/${file}`);
        if (!blob) continue;
        const payload = JSON.parse(
          new TextDecoder().decode(await decrypt(settings.key, blob))
        );
        (payload.engines as NativeResultFile[]).forEach((r) =>
          addNativeResults(font.hash, r)
        );
      }
      await gh.deleteDir(dir);
      onStatus({ state: "done", url: runUrl, failed: marker.failed ?? [] });
      return;
    }
    throw new Error("Timed out waiting for the workflow");
  } catch (e) {
    onStatus({ state: "error", message: String(e), url: runUrl });
  }
}

// Results can also be produced from the command line (native/shape.py) and
// loaded as an unencrypted JSON file.
export function loadResultsFile(fontHash: string, json: string) {
  const payload = JSON.parse(json);
  if (payload.fontSha256 && payload.fontSha256 !== fontHash) {
    throw new Error("These results are for a different font file");
  }
  (payload.engines as NativeResultFile[]).forEach((r) =>
    addNativeResults(fontHash, r)
  );
}
