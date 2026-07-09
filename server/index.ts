import express from "express";
import cors from "cors";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { buildCtx, generateSite } from "../src/codegen/generate";
import { emitThumbnailHtml } from "../src/codegen/thumbnailHtml";
import { hashProject } from "../src/model/projectHash";
import type { SerializedProject } from "../src/model/types";
import { backfillMissingThumbnails, copyThumbnail, hasThumbnail, scheduleThumbnail, thumbnailPath } from "./thumbnail";
import { createCodexRouter, streamCodexProgress } from "./codex";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROJECTS_DIR = path.join(ROOT, "projects");
const PORT = 4570;

fs.mkdirSync(PROJECTS_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: "80mb" }));

const projectDir = (id: string) => {
  // prevent path traversal
  const safe = id.replace(/[^a-zA-Z0-9-_]/g, "");
  return path.join(PROJECTS_DIR, safe);
};

const projectFile = (id: string) => path.join(projectDir(id), "framer.json");

async function readProject(id: string): Promise<SerializedProject | null> {
  try {
    const raw = await fsp.readFile(projectFile(id), "utf8");
    return JSON.parse(raw) as SerializedProject;
  } catch {
    return null;
  }
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

async function uniqueProjectId(name: string): Promise<string> {
  const base = slugify(name);
  let id = base;
  let n = 2;
  while (fs.existsSync(projectDir(id))) {
    id = `${base}-${n++}`;
  }
  return id;
}

async function writeProjectToDisk(id: string, project: SerializedProject): Promise<void> {
  const dir = projectDir(id);
  await fsp.mkdir(path.join(dir, "assets"), { recursive: true });
  project.meta.id = id;
  project.meta.updatedAt = new Date().toISOString();
  await fsp.writeFile(projectFile(id), JSON.stringify(project, null, 2), "utf8");
  try {
    await generateSite(project, path.join(dir, "site"));
    const ctx = buildCtx(project);
    await fsp.writeFile(path.join(dir, "thumbnail.html"), emitThumbnailHtml(ctx, PORT), "utf8");
  } catch (err) {
    console.error(`[codegen] failed for ${id}:`, err);
  }
  scheduleThumbnail(id, () => readProject(id), dir, PORT);
}

app.get("/api/codex/events", streamCodexProgress);
app.use("/api/codex", createCodexRouter({
  rootDir: ROOT,
  projectsDir: PROJECTS_DIR,
  readProject,
  writeProject: writeProjectToDisk,
}));

// ── Projects CRUD ────────────────────────────────────────────────────────────

app.get("/api/projects", async (_req, res) => {
  const entries = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true }).catch(() => []);
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const project = await readProject(entry.name);
    if (project) {
      const dir = projectDir(entry.name);
      const thumb = hasThumbnail(dir);
      if (!thumb) scheduleThumbnail(entry.name, () => readProject(entry.name), dir, PORT, 500);
      projects.push({
        ...project.meta,
        id: entry.name,
        pageCount: project.pages.length,
        hasThumbnail: thumb,
      });
    }
  }
  projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  res.json(projects);
});

app.post("/api/projects", async (req, res) => {
  const { name, project } = req.body as { name: string; project: SerializedProject };
  const id = await uniqueProjectId(name || "Untitled");
  project.meta.name = name || "Untitled";
  await writeProjectToDisk(id, project);
  res.json({ id });
});

app.get("/api/projects/:id", async (req, res) => {
  const project = await readProject(req.params.id);
  if (!project) return res.status(404).json({ error: "not found" });
  res.json(project);
});

app.put("/api/projects/:id", async (req, res) => {
  const project = req.body as SerializedProject;
  await writeProjectToDisk(req.params.id, project);
  const saved = await readProject(req.params.id);
  res.json({ ok: true, project: saved ?? project, revision: hashProject(saved ?? project) });
});

app.post("/api/projects/:id/rename", async (req, res) => {
  const project = await readProject(req.params.id);
  if (!project) return res.status(404).json({ error: "not found" });
  project.meta.name = (req.body as { name: string }).name;
  await writeProjectToDisk(req.params.id, project);
  res.json({ ok: true });
});

app.post("/api/projects/:id/duplicate", async (req, res) => {
  const project = await readProject(req.params.id);
  if (!project) return res.status(404).json({ error: "not found" });
  const newId = await uniqueProjectId(`${project.meta.name} copy`);
  project.meta.name = `${project.meta.name} copy`;
  project.meta.createdAt = new Date().toISOString();
  await writeProjectToDisk(newId, project);
  // copy assets
  const srcAssets = path.join(projectDir(req.params.id), "assets");
  const dstAssets = path.join(projectDir(newId), "assets");
  if (fs.existsSync(srcAssets)) {
    await fsp.cp(srcAssets, dstAssets, { recursive: true });
  }
  await copyThumbnail(projectDir(req.params.id), projectDir(newId));
  // regenerate so the site copies assets too
  await writeProjectToDisk(newId, project);
  res.json({ id: newId });
});

app.delete("/api/projects/:id", async (req, res) => {
  const dir = projectDir(req.params.id);
  if (!fs.existsSync(projectFile(req.params.id))) {
    return res.status(404).json({ error: "not found" });
  }
  await fsp.rm(dir, { recursive: true, force: true });
  res.json({ ok: true });
});

// ── Assets ───────────────────────────────────────────────────────────────────

app.post("/api/projects/:id/assets", async (req, res) => {
  const { name, dataUrl } = req.body as { name: string; dataUrl: string };
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return res.status(400).json({ error: "invalid data url" });
  const buffer = Buffer.from(match[2], "base64");
  const ext = path.extname(name) || `.${(match[1].split("/")[1] || "png").replace("+xml", "")}`;
  const base = slugify(path.basename(name, path.extname(name)));
  const dir = path.join(projectDir(req.params.id), "assets");
  await fsp.mkdir(dir, { recursive: true });
  let file = `${base}${ext}`;
  let n = 2;
  while (fs.existsSync(path.join(dir, file))) file = `${base}-${n++}${ext}`;
  await fsp.writeFile(path.join(dir, file), buffer);
  res.json({ file, url: `/project-assets/${req.params.id}/${file}` });
});

app.delete("/api/projects/:id/assets/:file", async (req, res) => {
  const file = path.basename(req.params.file);
  await fsp.rm(path.join(projectDir(req.params.id), "assets", file), { force: true });
  res.json({ ok: true });
});

// serve project assets to the editor
app.use("/project-assets/:id", (req, res, next) => {
  const dir = path.join(projectDir(req.params.id), "assets");
  express.static(dir)(req, res, next);
});

// serve generated styles for thumbnail screenshots
app.get("/thumb-styles/:id/styles.css", (req, res) => {
  const file = path.join(projectDir(req.params.id), "site", "src", "styles.css");
  if (!fs.existsSync(file)) return res.status(404).end();
  res.type("text/css").sendFile(file);
});

// serve static thumbnail HTML (uses generated styles.css)
app.get("/thumb-page/:id", (req, res) => {
  const file = path.join(projectDir(req.params.id), "thumbnail.html");
  if (!fs.existsSync(file)) return res.status(404).end();
  res.sendFile(file);
});

// serve project thumbnails for the picker
app.get("/project-thumbnails/:id", (req, res) => {
  const file = thumbnailPath(projectDir(req.params.id));
  if (!fs.existsSync(file)) return res.status(404).end();
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(file);
});

// ── Publish (production build of the generated site) ────────────────────────

app.post("/api/projects/:id/publish", async (req, res) => {
  const project = await readProject(req.params.id);
  if (!project) return res.status(404).json({ error: "not found" });
  await writeProjectToDisk(req.params.id, project);
  const siteDir = path.join(projectDir(req.params.id), "site");

  const run = (cmd: string, args: string[]) =>
    new Promise<{ code: number; output: string }>((resolve) => {
      const child = spawn(cmd, args, { cwd: siteDir, shell: process.platform === "win32" });
      let output = "";
      child.stdout.on("data", (d) => (output += d.toString()));
      child.stderr.on("data", (d) => (output += d.toString()));
      child.on("close", (code) => resolve({ code: code ?? 1, output }));
    });

  if (!fs.existsSync(path.join(siteDir, "node_modules"))) {
    const install = await run("npm", ["install", "--no-fund", "--no-audit"]);
    if (install.code !== 0) {
      return res.status(500).json({ error: "npm install failed", output: install.output.slice(-4000) });
    }
  }
  const build = await run("npm", ["run", "build"]);
  if (build.code !== 0) {
    return res.status(500).json({ error: "build failed", output: build.output.slice(-4000) });
  }
  res.json({ ok: true, dir: path.join(siteDir, "dist"), output: build.output.slice(-2000) });
});

// serve published builds for preview
app.use("/published/:id", (req, res, next) => {
  const dir = path.join(projectDir(req.params.id), "site", "dist");
  express.static(dir)(req, res, next);
});

app.listen(PORT, () => {
  console.log(`[server] projects dir: ${PROJECTS_DIR}`);
  console.log(`[server] listening on http://localhost:${PORT}`);
  backfillMissingThumbnails(
    async () => {
      const entries = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true }).catch(() => []);
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    },
    readProject,
    projectDir,
    PORT,
  ).catch((err) => console.error("[thumbnail] backfill failed:", err));
});
