import { useEffect, useState } from "react";
import { api, type ProjectListItem } from "@/api/client";
import { createEmptyProject } from "@/model/factory";
import { useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { IconDots, IconPlus } from "./icons";

function ProjectThumb({ id, name, updatedAt, hasThumbnail }: { id: string; name: string; updatedAt: string; hasThumbnail?: boolean }) {
  const [failed, setFailed] = useState(false);
  const letter = name.charAt(0).toUpperCase();

  useEffect(() => {
    setFailed(false);
  }, [updatedAt, hasThumbnail]);

  if (failed && !hasThumbnail) {
    return <div className="thumb">{letter}</div>;
  }

  return (
    <div className="thumb">
      <img
        src={`/project-thumbnails/${id}?t=${encodeURIComponent(updatedAt)}`}
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

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

  useEffect(() => {
    refresh();
    // Thumbnails generate in the background — poll until they appear.
    const interval = setInterval(refresh, 3000);
    const stop = setTimeout(() => clearInterval(interval), 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, []);

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
        {error && (
          <p className="subtitle" style={{ color: "var(--danger)" }}>
            Could not reach the local server ({error}). Is <code>npm run dev</code> running?
          </p>
        )}
        <div className="picker-grid">
          <div className="project-item">
            <button className="project-card new" onClick={createProject}>
              <IconPlus style={{ width: 22, height: 22 }} />
              New project
            </button>
          </div>
          {(projects ?? []).map((p) => (
            <div key={p.id} className={`project-item ${menuFor === p.id ? "project-item--menu-open" : ""}`}>
              <div className="project-card" onClick={() => openProject(p.id)}>
                <ProjectThumb id={p.id} name={p.name} updatedAt={p.updatedAt} hasThumbnail={p.hasThumbnail} />
                <button
                  className="project-card-menu-btn"
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
              <div className="project-label">
                <span className="project-name">{p.name}</span>
                <span className="project-edited">{timeAgo(p.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
