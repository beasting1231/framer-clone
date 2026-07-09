import { useState } from "react";
import { BREAKPOINTS } from "@/model/types";
import { useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { useTimeline } from "@/store/timeline";
import { api } from "@/api/client";
import {
  IconBack,
  IconCursor,
  IconDesktop,
  IconFrame,
  IconHand,
  IconImage,
  IconPhone,
  IconPlay,
  IconPlus,
  IconRedo,
  IconStack,
  IconTablet,
  IconText,
  IconUndo,
} from "./icons";

const BP_ICONS = { desktop: IconDesktop, tablet: IconTablet, phone: IconPhone };

function TimelineButton() {
  const open = useTimeline((s) => s.open);
  return (
    <button className={`tool-btn ${open ? "active" : ""}`} title="Animation timeline" onClick={() => useTimeline.getState().setOpen(!open)}>
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1.5" y="3.5" width="12" height="8" rx="1.5" stroke="currentColor" />
        <path d="M4 6h5M6 9h6" stroke="currentColor" strokeLinecap="round" />
        <circle cx="4" cy="9" r="1.2" fill="currentColor" />
        <circle cx="10.5" cy="6" r="1.2" fill="currentColor" />
      </svg>
      Animate
    </button>
  );
}

export function Toolbar() {
  const project = useDocument((s) => s.project);
  const saveState = useDocument((s) => s.saveState);
  const undoLen = useDocument((s) => s.undoStack.length);
  const redoLen = useDocument((s) => s.redoStack.length);
  const tool = useEditor((s) => s.tool);
  const breakpoint = useEditor((s) => s.breakpoint);
  const zoom = useEditor((s) => s.zoom);
  const leftTab = useEditor((s) => s.leftTab);
  const publishState = useEditor((s) => s.publishState);
  const [publishOpen, setPublishOpen] = useState(false);

  if (!project) return null;
  const s = useEditor.getState();

  const doPublish = async () => {
    setPublishOpen(true);
    s.setPublishState({ status: "building" });
    try {
      await useDocument.getState().flushSave();
      const result = await api.publish(project.meta.id);
      s.setPublishState({ status: "done", message: result.dir });
    } catch (err) {
      s.setPublishState({ status: "error", message: String((err as Error).message ?? err) });
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className="tool-btn"
          title="Back to projects"
          onClick={async () => {
            await useDocument.getState().flushSave();
            useDocument.getState().close();
            s.setScreen("picker");
          }}
        >
          <IconBack />
        </button>
        <div className="project-title">{project.meta.name}</div>
        <div className={`save-indicator ${saveState === "error" ? "error" : ""}`}>
          {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "…" : "Save failed"}
        </div>
      </div>

      <div className="toolbar-group" style={{ marginLeft: 8 }}>
        <button className={`tool-btn ${tool === "select" ? "active" : ""}`} title="Select (V)" onClick={() => s.setTool("select")}>
          <IconCursor />
        </button>
        <button
          className={`tool-btn ${leftTab === "insert" ? "active" : ""}`}
          title="Insert (I)"
          onClick={() => s.setLeftTab(leftTab === "insert" ? "layers" : "insert")}
        >
          <IconPlus />
          Insert
        </button>
        <button className={`tool-btn ${tool === "frame" ? "active" : ""}`} title="Frame (F)" onClick={() => s.setTool("frame")}>
          <IconFrame />
        </button>
        <button className={`tool-btn ${tool === "stack" ? "active" : ""}`} title="Stack (S)" onClick={() => s.setTool("stack")}>
          <IconStack />
        </button>
        <button className={`tool-btn ${tool === "text" ? "active" : ""}`} title="Text (T)" onClick={() => s.setTool("text")}>
          <IconText />
        </button>
        <button className={`tool-btn ${tool === "image" ? "active" : ""}`} title="Image" onClick={() => s.setTool("image")}>
          <IconImage />
        </button>
        <button className={`tool-btn ${tool === "hand" ? "active" : ""}`} title="Hand (H)" onClick={() => s.setTool("hand")}>
          <IconHand />
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="breakpoint-switcher">
        {BREAKPOINTS.map((bp) => {
          const Icon = BP_ICONS[bp.id];
          return (
            <button
              key={bp.id}
              className={`tool-btn ${breakpoint === bp.id ? "active" : ""}`}
              title={`${bp.label} (${bp.width}px)`}
              onClick={() => s.setBreakpoint(bp.id)}
            >
              <Icon />
            </button>
          );
        })}
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <button className="tool-btn" title="Undo (⌘Z)" onClick={() => useDocument.getState().undo()} style={{ opacity: undoLen > 0 ? 1 : 0.35 }}>
          <IconUndo />
        </button>
        <button className="tool-btn" title="Redo (⇧⌘Z)" onClick={() => useDocument.getState().redo()} style={{ opacity: redoLen > 0 ? 1 : 0.35 }}>
          <IconRedo />
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <TimelineButton />
        <button className="tool-btn" title="Preview (⌥P toggle)" onClick={() => s.setScreen("preview")}>
          <IconPlay />
          Preview
        </button>
        <button className="tool-btn primary" onClick={doPublish}>
          Publish
        </button>
      </div>

      {publishOpen && (
        <div className="modal-backdrop" onClick={() => publishState.status !== "building" && setPublishOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Publish</h3>
            {publishState.status === "building" && (
              <p className="muted" style={{ lineHeight: 1.6 }}>
                Building production site… this runs <code>npm install</code> +<code> vite build</code> in the project's{" "}
                <code>site/</code> folder. First build can take a minute.
              </p>
            )}
            {publishState.status === "done" && (
              <div style={{ lineHeight: 1.7, fontSize: 12 }}>
                <p style={{ color: "var(--accent)", fontWeight: 600 }}>Build succeeded.</p>
                <p className="muted">Deployable static build written to:</p>
                <p style={{ wordBreak: "break-all", background: "var(--bg-2)", padding: 8, borderRadius: 6, marginTop: 6 }}>
                  {publishState.message}
                </p>
                <p className="muted" style={{ marginTop: 10 }}>
                  The full React source lives in <code>projects/{project.meta.id}/site/</code> — open it in any code editor.
                </p>
              </div>
            )}
            {publishState.status === "error" && (
              <div style={{ lineHeight: 1.6, fontSize: 12 }}>
                <p style={{ color: "var(--danger)", fontWeight: 600 }}>Build failed</p>
                <pre style={{ whiteSpace: "pre-wrap", background: "var(--bg-2)", padding: 8, borderRadius: 6, marginTop: 6, maxHeight: 200, overflow: "auto" }}>
                  {publishState.message}
                </pre>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn" disabled={publishState.status === "building"} onClick={() => setPublishOpen(false)}>
                {publishState.status === "building" ? "Building…" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
