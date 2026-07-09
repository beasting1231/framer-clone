import { useEffect, useState } from "react";
import { api, type ProjectListItem } from "@/api/client";
import { createEmptyProject } from "@/model/factory";
import { useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { IconDots, IconPlus } from "./icons";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ProjectPicker() {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const openDoc = useDocument((s) => s.open);
  const setScreen = useEditor((s) => s.setScreen);
  const setContext = useEditor((s) => s.setContext);

  const refresh = () => {
    api
      .listProjects()
      .then((list) => {
        setProjects(list);
        setError(null);
      })
      .catch((e) => setError(String(e.message ?? e)));
  };

  useEffect(refresh, []);

  const openProject = async (id: string) => {
    const project = await api.getProject(id);
    openDoc(id, project);
    useEditor.setState({ zoom: 0.55, panX: 100, panY: 70, breakpoint: "desktop", selection: [] });
    setContext({ kind: "page", pageId: project.homePageId });
    setScreen("editor");
  };

  const createProject = async () => {
    const name = prompt("Project name", "My Site");
    if (!name) return;
    const project = createEmptyProject(name);
    const { id } = await api.createProject(name, project);
    await openProject(id);
  };

  return (
    <div className="picker" onClick={() => setMenuFor(null)}>
      <div className="picker-inner">
        <h1>Projects</h1>
        <p className="subtitle">
          Stored on disk in the <code>projects/</code> folder — every save regenerates a readable React codebase in{" "}
          <code>projects/&lt;name&gt;/site</code>.
        </p>
        {error && (
          <p className="subtitle" style={{ color: "var(--danger)" }}>
            Could not reach the local server ({error}). Is <code>npm run dev</code> running?
          </p>
        )}
        <div className="picker-grid">
          <button className="project-card new" onClick={createProject}>
            <IconPlus style={{ width: 22, height: 22 }} />
            New project
          </button>
          {(projects ?? []).map((p) => (
            <div
              key={p.id}
              className={`project-card ${menuFor === p.id ? "project-card--menu-open" : ""}`}
              onClick={() => openProject(p.id)}
            >
              <div className="thumb">{p.name.charAt(0).toUpperCase()}</div>
              <div className="card-body">
                <div>
                  <div className="name">{p.name}</div>
                  <div className="meta">
                    {p.pageCount} page{p.pageCount === 1 ? "" : "s"} · {timeAgo(p.updatedAt)}
                  </div>
                </div>
                <button
                  className="icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor(menuFor === p.id ? null : p.id);
                  }}
                >
                  <IconDots />
                </button>
                {menuFor === p.id && (
                  <div className="context-menu project-card-menu" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="context-item"
                    onClick={async () => {
                      await api.duplicateProject(p.id);
                      setMenuFor(null);
                      refresh();
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className="context-item"
                    onClick={async () => {
                      const name = prompt("Rename project", p.name);
                      if (name) {
                        await api.renameProject(p.id, name);
                        refresh();
                      }
                      setMenuFor(null);
                    }}
                  >
                    Rename
                  </button>
                  <div className="context-divider" />
                  <button
                    className="context-item danger"
                    onClick={async () => {
                      if (confirm(`Delete "${p.name}"? This removes the folder from disk.`)) {
                        await api.deleteProject(p.id);
                        refresh();
                      }
                      setMenuFor(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
