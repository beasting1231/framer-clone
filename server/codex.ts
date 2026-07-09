import fsp from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type { Request, Response, Router } from "express";
import express from "express";
import { buildAgentEditorGuide } from "../src/model/agentGuide";
import type { SerializedProject } from "../src/model/types";
import { hashProject } from "../src/model/projectHash";
import { validateProject } from "../src/model/projectPatch";

type CodexRunResult = {
  code: number;
  stdout: string;
  stderr: string;
  output: string;
  threadId: string;
};

type CodexSendBody = {
  prompt?: string;
  conversation?: unknown;
  selection?: unknown;
  model?: string;
  reasoning?: string;
  projectHash?: string;
  currentPageId?: string;
  breakpoint?: string;
};

type CodexProgress = {
  type: "assistant" | "command" | "file" | "status" | "error";
  text: string;
  phase?: string;
  diff?: string;
  projectId?: string;
};

type CodexSession = {
  projectId: string;
  projectPath: string;
  threadId: string;
  agentVersion: string;
  child: ChildProcess | null;
  busy: boolean;
  startedAt: number;
};

type CodexRouterOptions = {
  rootDir: string;
  projectsDir: string;
  readProject: (id: string) => Promise<SerializedProject | null>;
  writeProject: (id: string, project: SerializedProject) => Promise<void>;
};

const sessions = new Map<string, CodexSession>();
const CODEX_AGENT_VERSION = "direct-edit-v1";
const DEFAULT_CODEX_MODEL = "gpt-5.5";
const CODEX_MODELS = new Set(["gpt-5.5", "gpt-5.4-mini", "gpt-5.3-codex-spark"]);

export function createCodexRouter(options: CodexRouterOptions): Router {
  const router = express.Router();

  router.get("/status", async (_req, res) => {
    const status = await getCodexStatus();
    res.json(status);
  });

  router.post("/login", async (_req, res) => {
    const status = await getCodexStatus();
    if (status.authenticated) {
      return res.json({ ok: true, output: "Codex is already authenticated." });
    }
    const result = await startCodexDeviceLogin(options.rootDir);
    res.json(result);
  });

  router.post("/projects/:id/start-session", async (req, res) => {
    const projectPath = assertProjectPath(req.params.id, options.projectsDir);
    const status = await getCodexStatus();
    if (!status.authenticated) return res.status(401).json({ ok: false, unauthenticated: true, error: "Codex is not authenticated." });
    const session = getSession(req.params.id, projectPath);
    res.json({ ok: true, mode: "exec-json", startedAt: session.startedAt, threadId: session.threadId });
  });

  router.post("/projects/:id/send", async (req, res) => {
    const projectId = req.params.id;
    const projectPath = assertProjectPath(projectId, options.projectsDir);
    const body = req.body as CodexSendBody;
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return res.status(400).json({ ok: false, error: "Enter a message." });

    const status = await getCodexStatus();
    if (!status.authenticated) return res.status(401).json({ ok: false, unauthenticated: true, error: "Codex is not authenticated." });

    const session = getSession(projectId, projectPath);
    if (session.busy) return res.status(409).json({ ok: false, error: "Codex is already running for this project." });

    const project = await options.readProject(projectId);
    if (!project) return res.status(404).json({ ok: false, error: "Project not found." });
    const currentHash = hashProject(project);
    if (body.projectHash && body.projectHash !== currentHash) {
      console.warn(`[codex] client revision mismatch for ${projectId}; continuing with latest saved project`);
    }
    const beforeValidation = validateProject(project);
    if (!beforeValidation.ok) {
      return res.status(400).json({ ok: false, error: `Project is invalid before AI edit: ${beforeValidation.errors.join(" ")}` });
    }
    const contextualPrompt = await buildFramerCodexPrompt(prompt, {
      projectId,
      projectPath,
      project,
      conversation: body.conversation,
      selection: body.selection,
      currentPageId: body.currentPageId,
      breakpoint: body.breakpoint,
    });

    session.busy = true;
    emitProgress(res, { type: "status", text: "Thinking...", projectId });
    const result = await runCodexForDirectEdit({
      prompt: contextualPrompt,
      projectPath,
      session,
      projectId,
      readProject: options.readProject,
      writeProject: options.writeProject,
      model: sanitizeCodexModel(body.model),
      reasoning: sanitizeCodexOption(body.reasoning, "medium"),
      onProgress: (payload) => emitProgress(res, { ...payload, projectId }),
    });
    session.busy = false;
    session.child = null;
    if (result.threadId) session.threadId = result.threadId;

    if (!result.ok) {
      return res.json({
        ok: false,
        mode: "exec-json",
        output: result.error,
        changedFiles: [],
        changedNodeIds: [],
        patchApplied: false,
        threadId: session.threadId,
        error: result.error,
      });
    }

    res.json({
      ok: true,
      mode: "exec-json",
      output: result.output,
      changedFiles: result.changedFiles,
      changedNodeIds: [],
      patchApplied: result.changedFiles.length > 0,
      project: result.project,
      revision: result.project ? hashProject(result.project) : currentHash,
      threadId: session.threadId,
      error: "",
    });
  });

  router.post("/projects/:id/stop", (req, res) => {
    const session = sessions.get(req.params.id);
    if (session?.child) session.child.kill("SIGTERM");
    if (session) {
      session.busy = false;
      session.child = null;
    }
    res.json({ ok: true });
  });

  return router;
}

function assertProjectPath(projectId: string, projectsDir: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9-_]/g, "");
  const resolved = path.resolve(projectsDir, safe);
  const root = path.resolve(projectsDir);
  if (!safe || (resolved !== root && !resolved.startsWith(`${root}${path.sep}`))) {
    throw new Error("Project path is outside the projects folder.");
  }
  return resolved;
}

function getSession(projectId: string, projectPath: string): CodexSession {
  const existing = sessions.get(projectId);
  if (existing) {
    if (existing.agentVersion !== CODEX_AGENT_VERSION) {
      existing.threadId = "";
      existing.agentVersion = CODEX_AGENT_VERSION;
      existing.startedAt = Date.now();
    }
    return existing;
  }
  const session = { projectId, projectPath, threadId: "", agentVersion: CODEX_AGENT_VERSION, child: null, busy: false, startedAt: Date.now() };
  sessions.set(projectId, session);
  return session;
}

async function getCodexStatus() {
  const result = await runCodex(["login", "status"], { timeoutMs: 10_000 });
  const output = `${result.stdout}\n${result.stderr}`.trim();
  const authenticated = result.code === 0 && !/not authenticated|not logged in|login required|no auth/i.test(output);
  return { ok: result.code === 0, authenticated, output };
}

async function buildFramerCodexPrompt(
  userPrompt: string,
  context: {
    projectId: string;
    projectPath: string;
    project: SerializedProject | null;
    conversation: unknown;
    selection: unknown;
    currentPageId?: string;
    breakpoint?: string;
    retryError?: string;
  },
) {
  const project = context.project;
  const selectedIds = Array.isArray(context.selection) ? context.selection.map(String).slice(0, 20) : [];
  const selectedTree = project ? selectedIds.map((id) => summarizeNodeTree(project, id, 0, 4)).filter(Boolean) : [];
  const conversation = normalizeConversation(context.conversation);
  const pageStructure = project ? describePageStructure(project) : "";
  const projectSummary = project ? summarizeProject(project) : "";

  return [
    `You are the Codex coding agent for the local Framer-style visual editor project "${project?.meta.name || context.projectId}" at ${context.projectPath}.`,
    `Agent capability version: ${CODEX_AGENT_VERSION}`,
    "Behave like Codex CLI launched in this project folder.",
    `Workspace: ${context.projectPath}`,
    `Current page: ${context.currentPageId || "unknown"}`,
    `Current breakpoint: ${context.breakpoint || "desktop"}`,
    "",
    "Important source-of-truth rules:",
    "- Edit framer.json for visual/editor changes. The React/CSS site under site/ is derived output and will be regenerated by the app.",
    "- Do not edit only generated site files for an editor-visible change.",
    "- If the user asks an informational question, answer directly and do not edit files.",
    "- If the user asks for a change, inspect framer.json and make the edit directly.",
    "- After changing files, briefly state what changed.",
    "",
    buildAgentEditorGuide(),
    "",
    project ? `Pages: ${project.pages.map((page) => `${page.name} (${page.path}, root ${page.rootId})`).join(", ")}` : "",
    pageStructure,
    projectSummary ? `Project node summary:\n${projectSummary}` : "",
    selectedTree.length ? `Selected node subtree context:\n${selectedTree.join("\n\n")}` : "",
    conversation.length ? `Recent chat:\n${conversation.map((m) => `${m.role}: ${m.text}`).join("\n")}` : "",
    context.retryError ? `Previous edit was rejected. Fix framer.json. Rejection reason: ${context.retryError}` : "",
    "",
    "Current user request:",
    userPrompt,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeConversation(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-6)
    .map((message) => {
      const source = message && typeof message === "object" ? (message as { role?: unknown; text?: unknown }) : {};
      return {
        role: source.role === "assistant" ? "assistant" : "user",
        text: String(source.text || "").replace(/\u0000/g, "").trim().slice(0, 900),
      };
    })
    .filter((message) => !isStaleCapabilityRefusal(message))
    .filter((message) => message.text);
}

function isStaleCapabilityRefusal(message: { role: string; text: string }) {
  if (message.role !== "assistant") return false;
  return /can['’]?t add|cannot add|not supported|unsupported/i.test(message.text) && /patch operation|editor model API|timeline|scroll/i.test(message.text);
}

function describePageStructure(project: SerializedProject) {
  return [
    "Page root child order, top-to-bottom:",
    ...project.pages.map((page) => {
      const root = project.nodes[page.rootId];
      const children = root?.children.map((id, index) => {
        const node = project.nodes[id];
        return `${index}: ${node?.name || "Unknown"} (${id})`;
      }) ?? [];
      return `${page.name} root ${page.rootId}: ${children.join(" -> ")}`;
    }),
  ].join("\n");
}

function summarizeProject(project: SerializedProject) {
  const lines: string[] = [];
  for (const page of project.pages) {
    const root = project.nodes[page.rootId];
    if (!root) continue;
    for (const childId of root.children) {
      const line = summarizeNodeTree(project, childId, 0, 3);
      if (line) lines.push(line);
    }
  }
  return lines.join("\n\n").slice(0, 14000);
}

function summarizeNodeTree(project: SerializedProject, nodeId: string, depth = 0, maxDepth = 3): string {
  const node = project.nodes[nodeId];
  if (!node) return "";
  const styles = node.styles?.desktop ?? {};
  const bits = [
    `${"  ".repeat(depth)}- ${node.name} (${node.id}) type=${node.type}`,
    node.text ? `text=${JSON.stringify(node.text)}` : "",
    node.tag ? `tag=${node.tag}` : "",
    styles.color ? `color=${styles.color}` : "",
    styles.fill ? `fill=${JSON.stringify(styles.fill).slice(0, 160)}` : "",
    styles.layout ? `layout=${styles.layout}` : "",
    node.children.length ? `children=${node.children.length}` : "",
  ].filter(Boolean);
  const children = depth >= maxDepth ? [] : node.children.map((id) => summarizeNodeTree(project, id, depth + 1, maxDepth)).filter(Boolean);
  return [bits.join(" "), ...children].join("\n");
}

async function runCodexForDirectEdit(options: {
  prompt: string;
  projectPath: string;
  session: CodexSession;
  projectId: string;
  readProject: (id: string) => Promise<SerializedProject | null>;
  writeProject: (id: string, project: SerializedProject) => Promise<void>;
  model?: string;
  reasoning: string;
  onProgress: (payload: CodexProgress) => void;
}): Promise<
  | { ok: true; project: SerializedProject | null; changedFiles: string[]; output: string; threadId: string }
  | { ok: false; error: string; threadId: string }
> {
  const beforeSnapshot = await snapshotProjectFiles(options.projectPath);
  let activePrompt = options.prompt;
  let lastThreadId = options.session.threadId;
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await runCodex(
      buildCodexExecArgs({
        cwd: options.projectPath,
        prompt: activePrompt,
        threadId: options.session.threadId,
        model: options.model,
        reasoning: options.reasoning,
      }),
      {
        cwd: options.projectPath,
        timeoutMs: 0,
        json: true,
        session: options.session,
        onProgress: options.onProgress,
      },
    );
    if (result.threadId) lastThreadId = result.threadId;
    if (result.code !== 0) {
      lastError = result.output || result.stderr || `Codex exited with code ${result.code}.`;
    } else {
      const changedFiles = await getChangedProjectFiles(options.projectPath, beforeSnapshot);
      const project = await readProjectFile(options.projectPath);
      if (project) {
        const validation = validateProject(project);
        if (validation.ok) {
          if (changedFiles.length === 0) {
            return { ok: true, project: null, changedFiles: [], output: result.output || "Done.", threadId: lastThreadId };
          }
          if (changedFiles.length > 0) await options.writeProject(options.projectId, project);
          const savedProject = await options.readProject(options.projectId);
          return {
            ok: true,
            project: savedProject ?? project,
            changedFiles,
            output: formatCodexEditOutput(result.output || "Done.", changedFiles),
            threadId: lastThreadId,
          };
        }
        lastError = `Project validation failed: ${validation.errors.join(" ")}`;
      } else if (changedFiles.length === 0) {
        return { ok: true, project: null, changedFiles: [], output: result.output || "Done.", threadId: lastThreadId };
      } else {
        lastError = "Codex changed files but framer.json could not be read.";
      }
    }

    if (attempt === 0) {
      options.onProgress({ type: "error", text: `Validation failed: ${lastError}` });
      activePrompt = [
        options.prompt,
        "",
        "The previous edit did not produce a valid editor project.",
        `Fix the project now. Validation error: ${lastError}`,
        "Edit framer.json directly and keep it valid for the visual editor.",
      ].join("\n");
    }
  }

  return { ok: false, error: `Codex edit failed: ${lastError}`, threadId: lastThreadId };
}

function formatCodexEditOutput(output: string, changedFiles: string[]) {
  const text = String(output || "Done.").trim() || "Done.";
  if (!changedFiles.length) return text;
  return `${text}\n\nChanged: ${changedFiles.slice(0, 5).join(", ")}${changedFiles.length > 5 ? "..." : ""}`;
}

async function readProjectFile(projectPath: string): Promise<SerializedProject | null> {
  try {
    return JSON.parse(await fsp.readFile(path.join(projectPath, "framer.json"), "utf8")) as SerializedProject;
  } catch {
    return null;
  }
}

async function snapshotProjectFiles(projectPath: string) {
  const snapshot = new Map<string, string>();
  const files = await listProjectTextFiles(projectPath);
  await Promise.all(
    files.map(async (filePath) => {
      try {
        const stats = await fsp.stat(filePath);
        snapshot.set(filePath, `${stats.size}:${stats.mtimeMs}`);
      } catch {}
    }),
  );
  return snapshot;
}

async function getChangedProjectFiles(projectPath: string, before: Map<string, string>) {
  const changed: string[] = [];
  const files = await listProjectTextFiles(projectPath);
  await Promise.all(
    files.map(async (filePath) => {
      try {
        const stats = await fsp.stat(filePath);
        const signature = `${stats.size}:${stats.mtimeMs}`;
        if (before.get(filePath) !== signature) changed.push(path.relative(projectPath, filePath));
      } catch {}
    }),
  );
  return changed.sort();
}

async function listProjectTextFiles(projectPath: string) {
  const results: string[] = [];
  const skipDirs = new Set(["node_modules", "dist", ".git", ".vite"]);
  const textExt = new Set([".json", ".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".md"]);
  async function walk(dir: string) {
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) await walk(full);
        continue;
      }
      if (textExt.has(path.extname(entry.name).toLowerCase())) results.push(full);
    }
  }
  await walk(projectPath);
  return results;
}

function sanitizeCodexOption(value: unknown, fallback = "") {
  const text = String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80);
  return text || fallback;
}

function sanitizeCodexModel(value: unknown) {
  const text = sanitizeCodexOption(value, DEFAULT_CODEX_MODEL);
  return CODEX_MODELS.has(text) ? text : DEFAULT_CODEX_MODEL;
}

function buildCodexExecArgs(options: { cwd: string; prompt: string; threadId?: string; model?: string; reasoning: string }) {
  const flags = [
    "--skip-git-repo-check",
    "--dangerously-bypass-approvals-and-sandbox",
    "-c",
    'approval_policy="never"',
    "--model",
    sanitizeCodexModel(options.model),
    "-c",
    `model_reasoning_effort="${options.reasoning}"`,
    "-c",
    'model_reasoning_summary="auto"',
    "--json",
  ];
  if (options.threadId) return ["exec", "resume", ...flags, options.threadId, options.prompt];
  return ["exec", ...flags, "--cd", options.cwd, options.prompt];
}

function runCodex(
  args: string[],
  options: {
    cwd?: string;
    timeoutMs?: number;
    json?: boolean;
    session?: CodexSession;
    onProgress?: (payload: CodexProgress) => void;
  } = {},
): Promise<CodexRunResult> {
  return new Promise((resolve) => {
    const child = spawn("codex", args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (options.session) options.session.child = child;
    let stdout = "";
    let stderr = "";
    const jsonState = { threadId: "", finalMessage: "", errorMessage: "" };
    const parseJson = options.json ? createCodexJsonParser((event) => handleCodexJsonEvent(event, jsonState, options)) : null;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : 120_000;
    const timeout = timeoutMs > 0 ? setTimeout(() => child.kill("SIGTERM"), timeoutMs) : null;

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      parseJson?.(text);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      resolve({ code: 1, stdout, stderr: stderr || error.message, output: jsonState.finalMessage || jsonState.errorMessage, threadId: jsonState.threadId });
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({ code: code ?? 1, stdout, stderr, output: jsonState.finalMessage || jsonState.errorMessage || stdout.trim(), threadId: jsonState.threadId });
    });
  });
}

function startCodexDeviceLogin(cwd: string): Promise<{ ok: boolean; output: string; url?: string }> {
  return new Promise((resolve) => {
    const child = spawn("codex", ["login", "--device-auth"], {
      cwd,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let resolved = false;
    const finish = (result: { ok: boolean; output: string; url?: string }) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };
    const handleText = (chunk: Buffer) => {
      output += chunk.toString();
      const cleanOutput = stripAnsi(output);
      const url = cleanOutput.match(/https?:\/\/\S+/)?.[0]?.replace(/[),.]+$/, "");
      if (url) {
        openExternalUrl(url);
        finish({ ok: true, output: cleanOutput.trim(), url });
      }
    };
    const timeout = setTimeout(() => {
      finish({ ok: false, output: output.trim() || "Codex login did not return a device URL." });
    }, 10_000);
    child.stdout.on("data", handleText);
    child.stderr.on("data", handleText);
    child.on("error", (error) => {
      clearTimeout(timeout);
      finish({ ok: false, output: output.trim() || error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const cleanOutput = stripAnsi(output);
      const url = cleanOutput.match(/https?:\/\/\S+/)?.[0]?.replace(/[),.]+$/, "");
      finish({ ok: code === 0 || Boolean(url), output: cleanOutput.trim(), url });
    });
  });
}

function stripAnsi(value: string) {
  return String(value || "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function openExternalUrl(url: string) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.unref();
}

function createCodexJsonParser(onEvent: (event: Record<string, unknown>) => void) {
  let buffer = "";
  return (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line));
      } catch {}
    }
  };
}

function handleCodexJsonEvent(
  event: Record<string, unknown>,
  state: { threadId: string; finalMessage: string; errorMessage: string },
  options: { onProgress?: (payload: CodexProgress) => void },
) {
  if (event.type === "thread.started" && typeof event.thread_id === "string") state.threadId = event.thread_id;
  const payload = unwrapCodexEvent(event);
  const type = resolveCodexEventType(event);
  const item = typeof payload.item === "object" && payload.item ? (payload.item as Record<string, unknown>) : payload;

  if (/error|failed/.test(type) || item.type === "error") {
    const text = extractErrorText(item) || extractErrorText(payload) || extractErrorText(event);
    if (text && text !== state.errorMessage) {
      state.errorMessage = text;
      options.onProgress?.({ type: "error", text });
    }
    return;
  }

  if (/item\.(started|updated|completed)/.test(type)) {
    const phase = type.endsWith(".completed") ? "completed" : type.endsWith(".started") ? "started" : "updated";
    if (item.type === "agent_message") {
      const text = extractMessageText(item);
      if (text && text !== state.finalMessage) {
        state.finalMessage = text;
        options.onProgress?.({ type: "assistant", text });
      }
    } else if (item.type === "command_execution" && typeof item.command === "string") {
      options.onProgress?.({ type: "command", text: item.command, phase });
    } else if (item.type === "file_change" && typeof item.path === "string") {
      options.onProgress?.({ type: "file", text: item.path, diff: describeFileChange(item), phase });
    }
    return;
  }

  const delta = firstString([payload.delta, payload.text]);
  if (/delta/i.test(type) && delta) {
    state.finalMessage += delta;
    options.onProgress?.({ type: "assistant", text: state.finalMessage });
  }
}

function extractErrorText(value: Record<string, unknown>): string {
  const direct = firstString([value.message, value.error, value.status, value.detail]);
  if (!direct) return "";
  if (!direct.trim().startsWith("{")) return direct;
  try {
    const parsed = JSON.parse(direct) as Record<string, unknown>;
    const nested = typeof parsed.error === "object" && parsed.error ? (parsed.error as Record<string, unknown>) : parsed;
    return firstString([nested.message, nested.error, nested.detail]) || direct;
  } catch {
    return direct;
  }
}

function unwrapCodexEvent(event: Record<string, unknown>) {
  for (const key of ["params", "data", "event"]) {
    const value = event[key];
    if (value && typeof value === "object") return value as Record<string, unknown>;
  }
  return event;
}

function resolveCodexEventType(event: Record<string, unknown>) {
  const method = String(event.method || "");
  if (method.includes("/")) return method.split("/").join(".").toLowerCase();
  return String(event.type || event.event || method || "").toLowerCase();
}

function extractMessageText(message: Record<string, unknown>) {
  if (typeof message.text === "string") return message.text;
  if (typeof message.output_text === "string") return message.output_text;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (part && typeof part === "object" ? firstString([(part as Record<string, unknown>).text, (part as Record<string, unknown>).output_text]) : ""))
      .join("");
  }
  return "";
}

function describeFileChange(item: Record<string, unknown>) {
  const additions = Number(item.additions ?? item.added ?? item.lines_added ?? item.insertions);
  const deletions = Number(item.deletions ?? item.removed ?? item.lines_removed);
  if (Number.isFinite(additions) && Number.isFinite(deletions)) return `+${additions} -${deletions}`;
  const diff = firstString([item.diff, item.patch]);
  if (diff) {
    const lines = diff.split("\n");
    const added = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
    const removed = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
    if (added || removed) return `+${added} -${removed}`;
  }
  return firstString([item.summary, item.change_summary, item.status]) || "diff";
}

function firstString(values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value;
  return "";
}

function emitProgress(res: Response, payload: CodexProgress) {
  (res.req.app as unknown as { emit: (event: string, payload: CodexProgress) => void }).emit("codex-progress", payload);
}

export function streamCodexProgress(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const onProgress = (payload: CodexProgress) => {
    const projectId = String(req.query.projectId || "");
    if (projectId && payload.projectId !== projectId) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const app = req.app as unknown as {
    on: (event: string, listener: (payload: CodexProgress) => void) => void;
    off: (event: string, listener: (payload: CodexProgress) => void) => void;
  };
  app.on("codex-progress", onProgress);
  req.on("close", () => app.off("codex-progress", onProgress));
}
