import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { generateSite } from "../src/codegen/generate";
import { hashProject } from "../src/model/projectHash";
import type { SerializedProject } from "../src/model/types";

export interface ProductionBuild {
  dir: string;
  output: string;
  revision: string;
  reused: boolean;
}

const buildCache = new Map<string, ProductionBuild>();
const buildJobs = new Map<string, Promise<ProductionBuild>>();
const previewServers = new Map<string, { server: http.Server; url: string }>();
const confirmedPreviewRevisions = new Map<string, string>();

function runCommand(command: string, args: string[], cwd: string, timeoutMs = 10 * 60 * 1000) {
  return new Promise<{ code: number; output: string }>((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      env: { ...process.env, NO_COLOR: "1" },
    });
    let output = "";
    let settled = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ code, output });
    };
    const timeout = setTimeout(() => {
      output += `\nCommand timed out after ${Math.round(timeoutMs / 1000)} seconds.`;
      child.kill("SIGTERM");
      finish(1);
    }, timeoutMs);
    child.stdout?.on("data", (data) => (output += data.toString()));
    child.stderr?.on("data", (data) => (output += data.toString()));
    child.on("error", (error) => {
      output += `\n${error.message}`;
      finish(1);
    });
    child.on("close", (code) => finish(code ?? 1));
  });
}

export async function ensureProductionBuild(
  projectId: string,
  project: SerializedProject,
  projectDir: string,
): Promise<ProductionBuild> {
  const revision = hashProject(project);
  const distDir = path.join(projectDir, "site", "dist");
  const cached = buildCache.get(projectId);
  if (cached?.revision === revision && fs.existsSync(path.join(distDir, "index.html"))) {
    return { ...cached, reused: true };
  }

  const running = buildJobs.get(projectId);
  if (running) return running;

  const job = (async () => {
    const siteDir = path.join(projectDir, "site");
    await generateSite(project, siteDir);

    if (!fs.existsSync(path.join(siteDir, "node_modules"))) {
      const install = await runCommand("npm", ["install", "--no-fund", "--no-audit"], siteDir);
      if (install.code !== 0) {
        throw new Error(`npm install failed\n${install.output.slice(-4000)}`);
      }
    }

    const build = await runCommand("npm", ["run", "build"], siteDir);
    if (build.code !== 0) {
      throw new Error(`build failed\n${build.output.slice(-4000)}`);
    }
    if (!fs.existsSync(path.join(distDir, "index.html"))) {
      throw new Error("Build completed without producing site/dist/index.html.");
    }

    const result: ProductionBuild = {
      dir: distDir,
      output: build.output.slice(-2000),
      revision,
      reused: false,
    };
    buildCache.set(projectId, result);
    confirmedPreviewRevisions.delete(projectId);
    return result;
  })();

  buildJobs.set(projectId, job);
  try {
    return await job;
  } finally {
    buildJobs.delete(projectId);
  }
}

export async function ensureProductionPreviewServer(projectId: string, distDir: string): Promise<string> {
  const existing = previewServers.get(projectId);
  if (existing) return existing.url;

  const previewApp = express();
  previewApp.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  previewApp.use(express.static(distDir, { etag: false, fallthrough: true }));
  previewApp.use((_req, res) => res.sendFile(path.join(distDir, "index.html")));

  const server = http.createServer(previewApp);
  const url = await new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to start the production preview server."));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
  previewServers.set(projectId, { server, url });
  return url;
}

export function confirmProductionPreview(projectId: string, revision: string): boolean {
  const build = buildCache.get(projectId);
  if (!build || build.revision !== revision) return false;
  confirmedPreviewRevisions.set(projectId, revision);
  return true;
}

export function wasProductionBuildPreviewed(projectId: string, revision: string): boolean {
  return confirmedPreviewRevisions.get(projectId) === revision;
}
