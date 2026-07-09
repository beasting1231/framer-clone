import { docActions, useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { IconDots, IconPage, IconPlus, IconDatabase } from "../icons";
import { useState } from "react";

export function PagesTab() {
  const project = useDocument((s) => s.project);
  const context = useEditor((s) => s.context);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  if (!project) return null;
  const s = useEditor.getState();

  const addPage = () => {
    const name = prompt("Page name", "New Page");
    if (!name) return;
    const path = prompt("Path", `/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
    if (!path) return;
    const page = docActions.addPage(name, path);
    if (page) s.setContext({ kind: "page", pageId: page.id });
  };

  return (
    <div className="panel-content" onClick={() => setMenuFor(null)}>
      <div className="panel-section-title">
        Pages
        <button className="icon-btn" title="Add page" onClick={addPage}>
          <IconPlus />
        </button>
      </div>
      {project.pages.map((page) => {
        const active = context?.kind === "page" && context.pageId === page.id;
        const isCms = page.kind === "cms-template";
        return (
          <div
            key={page.id}
            className={`page-row ${active ? "active" : ""}`}
            style={{ position: "relative" }}
            onClick={() => s.setContext({ kind: "page", pageId: page.id })}
          >
            {isCms ? <IconDatabase style={{ width: 13, height: 13, flexShrink: 0 }} /> : <IconPage style={{ width: 13, height: 13, flexShrink: 0 }} />}
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {page.name}
              {project.homePageId === page.id && (
                <span className="muted" style={{ marginLeft: 6, fontSize: 10 }}>
                  home
                </span>
              )}
            </span>
            <span className="page-path">{page.path}</span>
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMenuFor(menuFor === page.id ? null : page.id);
              }}
            >
              <IconDots />
            </button>
            {menuFor === page.id && (
              <div className="context-menu" style={{ position: "absolute", right: 0, top: 30, zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
                <button
                  className="context-item"
                  onClick={() => {
                    const name = prompt("Rename page", page.name);
                    if (name) docActions.updatePage(page.id, { name });
                    setMenuFor(null);
                  }}
                >
                  Rename
                </button>
                <button
                  className="context-item"
                  onClick={() => {
                    const path = prompt("Path", page.path);
                    if (path) docActions.updatePage(page.id, { path });
                    setMenuFor(null);
                  }}
                >
                  Edit path
                </button>
                <button
                  className="context-item"
                  onClick={() => {
                    const dup = docActions.duplicatePage(page.id);
                    if (dup) s.setContext({ kind: "page", pageId: dup.id });
                    setMenuFor(null);
                  }}
                >
                  Duplicate
                </button>
                {page.kind === "page" && (
                  <button
                    className="context-item"
                    onClick={() => {
                      useDocument.getState().mutate((p) => {
                        p.homePageId = page.id;
                        const home = p.pages.find((pg) => pg.id === page.id);
                        if (home) home.path = "/";
                      });
                      setMenuFor(null);
                    }}
                  >
                    Set as home
                  </button>
                )}
                <div className="context-divider" />
                <button
                  className="context-item danger"
                  onClick={() => {
                    if (project.pages.length > 1 && confirm(`Delete page "${page.name}"?`)) {
                      docActions.deletePage(page.id);
                      if (active) s.setContext({ kind: "page", pageId: project.pages.find((p) => p.id !== page.id)!.id });
                    }
                    setMenuFor(null);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="panel-section-title" style={{ marginTop: 16 }}>
        Components
      </div>
      {project.components.length === 0 && <div className="panel-empty">Right-click any frame and choose "Create Component"</div>}
      {project.components.map((comp) => {
        const active = context?.kind === "component" && context.componentId === comp.id;
        return (
          <div
            key={comp.id}
            className={`page-row ${active ? "active" : ""}`}
            style={{ color: active ? undefined : "var(--component)" }}
            onClick={() => s.setContext({ kind: "component", componentId: comp.id })}
          >
            <span style={{ flex: 1 }}>{comp.name}</span>
          </div>
        );
      })}
    </div>
  );
}
