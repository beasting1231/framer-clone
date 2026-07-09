import type { ProjectMeta, SerializedProject } from "@/model/types";

export interface ProjectListItem extends ProjectMeta {
  pageCount: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
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
    request<{ ok: true }>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(project) }),

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
};
