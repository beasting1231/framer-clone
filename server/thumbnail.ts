import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { buildCtx, generateSite } from "../src/codegen/generate";
import { emitThumbnailHtml } from "../src/codegen/thumbnailHtml";
import type { SerializedProject } from "../src/model/types";

const THUMBNAIL_DEBOUNCE_MS = 4000;
const THUMB_WIDTH = 1200;
const THUMB_HEIGHT = 550;

let browser: Browser | null = null;
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Set<string>();

export function thumbnailPath(projectDir: string): string {
  return path.join(projectDir, "thumbnail.png");
}

export function hasThumbnail(projectDir: string): boolean {
  return fs.existsSync(thumbnailPath(projectDir));
}

async function getBrowser(): Promise<Browser> {
  if (!browser) browser = await chromium.launch({ headless: true });
  return browser;
}

async function ensureThumbnailPage(project: SerializedProject, projectDir: string, port: number): Promise<void> {
  const siteDir = path.join(projectDir, "site");
  const cssPath = path.join(siteDir, "src", "styles.css");
  if (!fs.existsSync(cssPath)) {
    await generateSite(project, siteDir);
  }
  const ctx = buildCtx(project);
  await fsp.writeFile(path.join(projectDir, "thumbnail.html"), emitThumbnailHtml(ctx, port), "utf8");
}

export async function captureThumbnail(projectId: string, project: SerializedProject, projectDir: string, port: number): Promise<boolean> {
  if (inFlight.has(projectId)) return false;
  inFlight.add(projectId);
  try {
    await ensureThumbnailPage(project, projectDir, port);
    const b = await getBrowser();
    const page = await b.newPage({ viewport: { width: THUMB_WIDTH, height: THUMB_HEIGHT } });
    try {
      const url = `http://127.0.0.1:${port}/thumb-page/${projectId}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(400);
      const out = thumbnailPath(projectDir);
      await page.screenshot({
        path: out,
        clip: { x: 0, y: 0, width: THUMB_WIDTH, height: THUMB_HEIGHT },
        type: "png",
      });
      console.log(`[thumbnail] saved ${projectId}`);
      return true;
    } finally {
      await page.close();
    }
  } catch (err) {
    console.error(`[thumbnail] failed for ${projectId}:`, err);
    return false;
  } finally {
    inFlight.delete(projectId);
  }
}

/** Debounced thumbnail refresh — runs a few seconds after the last save, not on every edit. */
export function scheduleThumbnail(
  projectId: string,
  readProject: () => Promise<SerializedProject | null>,
  projectDir: string,
  port: number,
  delayMs = THUMBNAIL_DEBOUNCE_MS,
): void {
  const existing = pending.get(projectId);
  if (existing) clearTimeout(existing);
  pending.set(
    projectId,
    setTimeout(async () => {
      pending.delete(projectId);
      const project = await readProject();
      if (!project) return;
      await captureThumbnail(projectId, project, projectDir, port);
    }, delayMs),
  );
}

/** Generate thumbnails for any projects that don't have one yet. */
export async function backfillMissingThumbnails(
  listProjectIds: () => Promise<string[]>,
  readProject: (id: string) => Promise<SerializedProject | null>,
  projectDirFor: (id: string) => string,
  port: number,
): Promise<void> {
  const ids = await listProjectIds();
  for (const id of ids) {
    const project = await readProject(id);
    if (!project) continue;
    await captureThumbnail(id, project, projectDirFor(id), port);
  }
}

export async function copyThumbnail(srcDir: string, dstDir: string): Promise<void> {
  const src = thumbnailPath(srcDir);
  if (!fs.existsSync(src)) return;
  await fsp.copyFile(src, thumbnailPath(dstDir));
}

export async function shutdownThumbnailBrowser(): Promise<void> {
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
  if (browser) {
    await browser.close();
    browser = null;
  }
}
