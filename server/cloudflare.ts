import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ProductionBuild } from "./siteBuild";

interface CloudflareConfig {
  apiToken: string;
  accountId: string;
}

interface PagesProject {
  name?: string;
  subdomain?: string;
}

function readLocalEnv(rootDir: string) {
  const values: Record<string, string> = {};
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(rootDir, fileName);
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

function getCloudflareConfig(rootDir: string): CloudflareConfig {
  const local = readLocalEnv(rootDir);
  return {
    apiToken: String(process.env.CLOUDFLARE_API_TOKEN || local.CLOUDFLARE_API_TOKEN || "").trim(),
    accountId: String(process.env.CLOUDFLARE_ACCOUNT_ID || local.CLOUDFLARE_ACCOUNT_ID || "").trim(),
  };
}

async function cloudflareRequest(rootDir: string, pathname: string, init: RequestInit = {}) {
  const config = getCloudflareConfig(rootDir);
  if (!config.apiToken) throw new Error("Missing CLOUDFLARE_API_TOKEN in .env.local.");
  if (!config.accountId) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID in .env.local.");
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    result?: PagesProject;
    errors?: Array<{ message?: string; code?: number }>;
  };
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((error) => error.message || error.code).filter(Boolean).join("; ");
    throw new Error(message || `Cloudflare request failed with HTTP ${response.status}.`);
  }
  return payload.result ?? {};
}

function pagesProjectName(projectId: string) {
  const suffix = projectId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "site";
  return `framer-${suffix}`.slice(0, 58).replace(/-+$/g, "");
}

async function ensurePagesProject(rootDir: string, projectName: string): Promise<PagesProject> {
  const config = getCloudflareConfig(rootDir);
  const account = encodeURIComponent(config.accountId);
  const name = encodeURIComponent(projectName);
  try {
    return await cloudflareRequest(rootDir, `/accounts/${account}/pages/projects/${name}`);
  } catch (error) {
    if (!/not found|does not exist|404/i.test((error as Error).message)) throw error;
  }
  return cloudflareRequest(rootDir, `/accounts/${account}/pages/projects`, {
    method: "POST",
    body: JSON.stringify({ name: projectName, production_branch: "main" }),
  });
}

function runWrangler(rootDir: string, buildDir: string, projectName: string, displayName: string) {
  const config = getCloudflareConfig(rootDir);
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "--yes",
        "wrangler",
        "pages",
        "deploy",
        buildDir,
        `--project-name=${projectName}`,
        "--branch=main",
        "--commit-dirty=true",
        `--commit-message=Publish ${displayName}`,
      ],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: config.apiToken,
          CLOUDFLARE_ACCOUNT_ID: config.accountId,
          NO_COLOR: "1",
        },
      },
    );
    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Cloudflare deployment timed out after 10 minutes."));
    }, 10 * 60 * 1000);
    child.stdout.on("data", (data) => (output += data.toString()));
    child.stderr.on("data", (data) => (output += data.toString()));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(output);
      else reject(new Error(output.trim() || "Cloudflare Pages deployment failed."));
    });
  });
}

function deploymentUrl(output: string) {
  return output.match(/https:\/\/[a-z0-9.-]+\.pages\.dev[^\s]*/i)?.[0].replace(/[),.;]+$/, "") ?? "";
}

export async function deployProductionBuild(options: {
  rootDir: string;
  projectDir: string;
  projectId: string;
  projectName: string;
  build: ProductionBuild;
}) {
  const projectName = pagesProjectName(options.projectId);
  const pagesProject = await ensurePagesProject(options.rootDir, projectName);
  const output = await runWrangler(options.rootDir, options.build.dir, projectName, options.projectName);
  const deployedAt = new Date().toISOString();
  const pagesUrl = pagesProject.subdomain
    ? `https://${pagesProject.subdomain.replace(/^https?:\/\//, "")}`
    : `https://${projectName}.pages.dev`;
  const result = {
    ok: true as const,
    provider: "cloudflare-pages" as const,
    projectName,
    url: pagesUrl,
    pagesUrl,
    deploymentUrl: deploymentUrl(output),
    publishedAt: deployedAt,
    revision: options.build.revision,
  };
  await fsp.writeFile(path.join(options.projectDir, "publish.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}
