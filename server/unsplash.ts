import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const API_BASE = "https://api.unsplash.com";
const UTM_SOURCE = "framer_clone";
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

export type UnsplashResolution = "small" | "regular" | "full";

export interface UnsplashPhoto {
  id: string;
  description: string;
  width: number;
  height: number;
  color: string;
  urls: { thumb: string; small: string; regular: string; full: string };
  links: { html: string; downloadLocation: string };
  user: { name: string; username: string; profileUrl: string };
}

function readLocalEnv(rootDir: string) {
  const values: Record<string, string> = {};
  const legacyEnv = process.env.WEBSITE_CLONER_ENV_FILE || path.join(os.homedir(), "Documents", "website cloner", ".env.local");
  for (const filePath of [path.join(rootDir, ".env.local"), path.join(rootDir, ".env"), legacyEnv]) {
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || Object.hasOwn(values, match[1])) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      values[match[1]] = value;
    }
  }
  return values;
}

function accessKey(rootDir: string) {
  const local = readLocalEnv(rootDir);
  const key = String(
    process.env.UNSPLASH_ACCESS_KEY ||
      process.env.UNSPLASH_CLIENT_ID ||
      local.UNSPLASH_ACCESS_KEY ||
      local.UNSPLASH_CLIENT_ID ||
      "",
  ).trim();
  if (!key) throw new Error("Missing UNSPLASH_ACCESS_KEY in .env.local.");
  return key;
}

async function unsplashJson(rootDir: string, pathname: string) {
  const url = pathname.startsWith("http") ? pathname : `${API_BASE}${pathname}`;
  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey(rootDir)}`, "Accept-Version": "v1" },
  });
  if (!response.ok) {
    const message = response.status === 403 ? "Unsplash rate limit or access denied." : `Unsplash request failed (${response.status}).`;
    throw new Error(message);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function withAttribution(url: string) {
  if (!url) return "";
  const parsed = new URL(url);
  parsed.searchParams.set("utm_source", UTM_SOURCE);
  parsed.searchParams.set("utm_medium", "referral");
  return parsed.toString();
}

function normalizePhoto(value: unknown): UnsplashPhoto | null {
  const photo = value as Record<string, any>;
  if (!photo?.id || !photo?.urls) return null;
  const user = photo.user || {};
  return {
    id: String(photo.id),
    description: String(photo.alt_description || photo.description || ""),
    width: Number(photo.width) || 0,
    height: Number(photo.height) || 0,
    color: String(photo.color || ""),
    urls: {
      thumb: String(photo.urls.thumb || ""),
      small: String(photo.urls.small || ""),
      regular: String(photo.urls.regular || ""),
      full: String(photo.urls.full || ""),
    },
    links: {
      html: withAttribution(String(photo.links?.html || "")),
      downloadLocation: String(photo.links?.download_location || ""),
    },
    user: {
      name: String(user.name || user.username || "Unsplash photographer"),
      username: String(user.username || ""),
      profileUrl: withAttribution(String(user.links?.html || "")),
    },
  };
}

export async function searchUnsplash(rootDir: string, query: string, page = 1, perPage = 18) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return { results: [], total: 0, totalPages: 0 };
  const params = new URLSearchParams({
    query: cleanQuery,
    page: String(Math.max(1, Math.min(100, page))),
    per_page: String(Math.max(1, Math.min(30, perPage))),
  });
  const payload = await unsplashJson(rootDir, `/search/photos?${params}`);
  const rawResults = Array.isArray(payload.results) ? payload.results : [];
  const results = rawResults.map(normalizePhoto).filter((photo): photo is UnsplashPhoto => Boolean(photo));
  return {
    results,
    total: Number(payload.total) || results.length,
    totalPages: Number(payload.total_pages) || 0,
  };
}

async function getPhoto(rootDir: string, photoId: string) {
  const payload = await unsplashJson(rootDir, `/photos/${encodeURIComponent(photoId)}`);
  const photo = normalizePhoto(payload);
  if (!photo) throw new Error("Unsplash photo is unavailable.");
  return photo;
}

async function trackDownload(rootDir: string, photo: UnsplashPhoto) {
  if (!photo.links.downloadLocation) return;
  await unsplashJson(rootDir, photo.links.downloadLocation);
}

function resolutionUrl(photo: UnsplashPhoto, resolution: UnsplashResolution) {
  return photo.urls[resolution] || photo.urls.regular || photo.urls.full || photo.urls.small;
}

function imageExtension(url: string) {
  try {
    const parsed = new URL(url);
    const format = String(parsed.searchParams.get("fm") || "").toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "avif"].includes(format)) return format === "jpeg" ? ".jpg" : `.${format}`;
  } catch {
    // Unsplash image URLs commonly have no extension and default to JPEG.
  }
  return ".jpg";
}

function assetFileName(photo: UnsplashPhoto, extension: string) {
  const label = photo.description || photo.user.username || photo.user.name;
  const base = `unsplash-${photo.id}-${label}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${base || `unsplash-${photo.id}`}${extension}`;
}

async function availableFile(dir: string, requested: string) {
  const extension = path.extname(requested);
  const base = path.basename(requested, extension);
  let file = requested;
  let index = 2;
  while (fs.existsSync(path.join(dir, file))) file = `${base}-${index++}${extension}`;
  return file;
}

async function downloadImage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Unsplash image download failed (${response.status}).`);
    const length = Number(response.headers.get("content-length")) || 0;
    if (length > MAX_IMAGE_BYTES) throw new Error("Unsplash image is larger than 50 MB.");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("Unsplash image is larger than 50 MB.");
    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}

export async function importUnsplashPhoto(options: {
  rootDir: string;
  projectDir: string;
  photoId: string;
  resolution: UnsplashResolution;
}) {
  const photo = await getPhoto(options.rootDir, options.photoId);
  await trackDownload(options.rootDir, photo);
  const url = resolutionUrl(photo, options.resolution);
  if (!url) throw new Error("Unsplash photo has no downloadable image URL.");
  const assetsDir = path.join(options.projectDir, "assets");
  await fsp.mkdir(assetsDir, { recursive: true });
  const file = await availableFile(assetsDir, assetFileName(photo, imageExtension(url)));
  const buffer = await downloadImage(url);
  await fsp.writeFile(path.join(assetsDir, file), buffer);
  return {
    file,
    name: photo.description || `${photo.user.name} on Unsplash`,
    width: photo.width,
    height: photo.height,
    source: "unsplash" as const,
    attribution: {
      provider: "Unsplash" as const,
      photoId: photo.id,
      photoUrl: photo.links.html,
      photographerName: photo.user.name,
      photographerUrl: photo.user.profileUrl,
    },
  };
}
