import express from "express";
import cors from "cors";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCtx, generateSite } from "../src/codegen/generate";
import { emitThumbnailHtml } from "../src/codegen/thumbnailHtml";
import { hashProject } from "../src/model/projectHash";
import type { SerializedProject } from "../src/model/types";
import { backfillMissingThumbnails, copyThumbnail, hasThumbnail, scheduleThumbnail, thumbnailPath } from "./thumbnail";
import { createCodexRouter, streamCodexProgress } from "./codex";
import { deployProductionBuild } from "./cloudflare";
import {
  confirmProductionPreview,
  ensureProductionBuild,
  ensureProductionPreviewServer,
  wasProductionBuildPreviewed,
} from "./siteBuild";
import { importUnsplashPhoto, searchUnsplash, type UnsplashResolution } from "./unsplash";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROJECTS_DIR = path.join(ROOT, "projects");
const PORT = Number(process.env.PORT || 4570);

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

app.get("/api/unsplash/search", async (req, res) => {
  const query = String(req.query.query || "").trim();
  const page = Number.parseInt(String(req.query.page || "1"), 10) || 1;
  try {
    res.json({ ok: true, ...(await searchUnsplash(ROOT, query, page, 18)) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/projects/:id/assets/unsplash", async (req, res) => {
  if (!(await readProject(req.params.id))) return res.status(404).json({ error: "not found" });
  const photoId = String((req.body as { photoId?: string }).photoId || "").trim();
  const requestedResolution = String((req.body as { resolution?: string }).resolution || "regular");
  const resolution: UnsplashResolution = ["small", "regular", "full"].includes(requestedResolution)
    ? (requestedResolution as UnsplashResolution)
    : "regular";
  if (!photoId) return res.status(400).json({ error: "Missing Unsplash photo ID." });
  try {
    const asset = await importUnsplashPhoto({
      rootDir: ROOT,
      projectDir: projectDir(req.params.id),
      photoId,
      resolution,
    });
    res.json({ ok: true, asset });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

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

// ── Production preview + Cloudflare publish ─────────────────────────────────

app.post("/api/projects/:id/preview-build", async (req, res) => {
  const project = await readProject(req.params.id);
  if (!project) return res.status(404).json({ error: "not found" });
  try {
    const build = await ensureProductionBuild(req.params.id, project, projectDir(req.params.id));
    const url = await ensureProductionPreviewServer(req.params.id, build.dir);
    res.json({ ok: true, url, revision: build.revision, reused: build.reused });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/projects/:id/preview-confirm", async (req, res) => {
  const revision = String((req.body as { revision?: string }).revision || "");
  if (!revision || !confirmProductionPreview(req.params.id, revision)) {
    return res.status(409).json({ error: "This production preview is no longer current." });
  }
  res.json({ ok: true });
});

app.post("/api/projects/:id/publish", async (req, res) => {
  const project = await readProject(req.params.id);
  if (!project) return res.status(404).json({ error: "not found" });
  try {
    const dir = projectDir(req.params.id);
    const build = await ensureProductionBuild(req.params.id, project, dir);
    if (!wasProductionBuildPreviewed(req.params.id, build.revision)) {
      return res.status(409).json({ error: "Preview the current version before publishing. Only the version you inspected can be deployed." });
    }
    const result = await deployProductionBuild({
      rootDir: ROOT,
      projectDir: dir,
      projectId: req.params.id,
      projectName: project.meta.name,
      build,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
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
