import type { BreakpointId, ProjectMeta, SerializedProject } from "@/model/types";
import type { CustomCodeProposal } from "@/model/customCode";

export interface ProjectListItem extends ProjectMeta {
  pageCount: number;
  hasThumbnail?: boolean;
}

export interface CodexMessage {
  role: "user" | "assistant";
  text: string;
  images?: CodexImageAttachment[];
}

export interface CodexImageAttachment {
  id: string;
  name: string;
  dataUrl: string;
}

export interface CodexProgress {
  type: "assistant" | "command" | "file" | "status" | "error";
  text: string;
  phase?: string;
  diff?: string;
  projectId?: string;
}

export interface CodexSendResult {
  ok: boolean;
  mode?: string;
  output: string;
  changedFiles?: string[];
  changedNodeIds?: string[];
  patchApplied?: boolean;
  project?: SerializedProject;
  revision?: string;
  threadId?: string;
  error?: string;
  unauthenticated?: boolean;
  requiresCustomCodeApproval?: boolean;
  customCodeProposal?: CustomCodeProposal;
}

const API_FALLBACK_ORIGIN = "http://localhost:4570";

function shouldUseFallbackOrigin() {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "file:" || !["5173", "4570"].includes(window.location.port);
}

function apiUrl(url: string, forceFallback = false) {
  if (!url.startsWith("/")) return url;
  if (forceFallback || shouldUseFallbackOrigin()) return `${API_FALLBACK_ORIGIN}${url}`;
  return url;
}

export function eventSourceUrl(url: string) {
  return apiUrl(url);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const doFetch = (forceFallback = false) =>
    fetch(apiUrl(url, forceFallback), {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  let res: Response;
  try {
    res = await doFetch();
  } catch (error) {
    if (!url.startsWith("/") || shouldUseFallbackOrigin()) {
      throw new Error(`Cannot reach Framer backend at ${API_FALLBACK_ORIGIN}. Start the server with npm run server or npm run dev.`);
    }
    try {
      res = await doFetch(true);
    } catch {
      throw new Error(`Cannot reach Framer backend at ${API_FALLBACK_ORIGIN}. Start the server with npm run server or npm run dev.`);
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listProjects: () => request<ProjectListItem[]>("/api/projects"),

  createProject: (name: string, project: SerializedProject) =>
    request<{ id: string }>("/api/projects", { method: "POST", body: JSON.stringify({ name, project }) }),

  getProject: (id: string) => request<SerializedProject>(`/api/projects/${id}`),

  saveProject: (id: string, project: SerializedProject) =>
    request<{ ok: true; project: SerializedProject; revision: string }>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(project) }),

  renameProject: (id: string, name: string) =>
    request<{ ok: true }>(`/api/projects/${id}/rename`, { method: "POST", body: JSON.stringify({ name }) }),

  duplicateProject: (id: string) => request<{ id: string }>(`/api/projects/${id}/duplicate`, { method: "POST" }),

  deleteProject: (id: string) => request<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" }),

  uploadAsset: (projectId: string, name: string, dataUrl: string) =>
    request<{ file: string; url: string }>(`/api/projects/${projectId}/assets`, {
      method: "POST",
      body: JSON.stringify({ name, dataUrl }),
    }),

  deleteAsset: (projectId: string, file: string) =>
    request<{ ok: true }>(`/api/projects/${projectId}/assets/${encodeURIComponent(file)}`, { method: "DELETE" }),

  publish: (projectId: string) =>
    request<{ ok: true; dir: string; output: string }>(`/api/projects/${projectId}/publish`, { method: "POST" }),

  codexStatus: () => request<{ ok: boolean; authenticated: boolean; output: string }>("/api/codex/status"),

  codexLogin: () => request<{ ok: boolean; output: string; url?: string }>("/api/codex/login", { method: "POST" }),

  codexStartSession: (projectId: string) =>
    request<{ ok: boolean; mode: string; startedAt: number; threadId?: string }>(`/api/codex/projects/${projectId}/start-session`, { method: "POST" }),

  codexSend: (projectId: string, body: { prompt: string; images?: CodexImageAttachment[]; conversation?: CodexMessage[]; selection?: string[]; model?: string; reasoning?: string; speed?: string; projectHash?: string; currentPageId?: string; breakpoint?: BreakpointId }) =>
    request<CodexSendResult>(`/api/codex/projects/${projectId}/send`, { method: "POST", body: JSON.stringify(body) }),

  codexApplyCustomCode: (projectId: string, body: { proposal: CustomCodeProposal; projectHash?: string }) =>
    request<CodexSendResult>(`/api/codex/projects/${projectId}/apply-custom-code`, { method: "POST", body: JSON.stringify(body) }),

  codexStop: (projectId: string) => request<{ ok: true }>(`/api/codex/projects/${projectId}/stop`, { method: "POST" }),
};
