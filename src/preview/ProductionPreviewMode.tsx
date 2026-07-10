import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { api } from "@/api/client";
import { BREAKPOINTS, type BreakpointId } from "@/model/types";
import { useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { IconClose, IconDesktop, IconFullWidth, IconPhone, IconRefresh, IconTablet, IconWide } from "@/ui/icons";
import { usePreviewShortcuts, type PreviewWidthMode } from "./usePreviewShortcuts";

const BP_ICONS = { wide: IconWide, desktop: IconDesktop, tablet: IconTablet, phone: IconPhone } as const;
const MIN_PREVIEW_WIDTH = 280;
const MAX_PREVIEW_WIDTH = 4800;
const PHONE_PREVIEW_HEIGHT = 844;

function clampPreviewWidth(width: number) {
  return Math.max(MIN_PREVIEW_WIDTH, Math.min(MAX_PREVIEW_WIDTH, Math.round(width)));
}

function presetWidth(bp: BreakpointId) {
  return BREAKPOINTS.find((breakpoint) => breakpoint.id === bp)!.width;
}

function initialProjectPath() {
  const project = useDocument.getState().project;
  const context = useEditor.getState().context;
  if (!project) return "/";
  if (context?.kind === "page") {
    const page = project.pages.find((candidate) => candidate.id === context.pageId);
    if (page?.kind === "page") return page.path;
    if (page?.kind === "cms-template" && page.collectionId) {
      const collection = project.cms.collections.find((candidate) => candidate.id === page.collectionId);
      if (collection?.entries[0]) return page.path.replace(":slug", collection.entries[0].slug);
    }
  }
  return project.pages.find((page) => page.id === project.homePageId)?.path ?? "/";
}

export function ProductionPreviewMode() {
  const projectId = useDocument((state) => state.projectId);
  const [widthMode, setWidthMode] = useState<PreviewWidthMode>("full");
  const [customWidth, setCustomWidth] = useState(1024);
  const [widthDraft, setWidthDraft] = useState("");
  const [measuredWidth, setMeasuredWidth] = useState(1280);
  const [status, setStatus] = useState<"building" | "ready" | "error">("building");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [revision, setRevision] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const widthInputFocused = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const initialPath = useMemo(initialProjectPath, [projectId]);

  const buildPreview = useCallback(async () => {
    if (!projectId) return;
    setStatus("building");
    setError("");
    try {
      await useDocument.getState().flushSave();
      const result = await api.buildProductionPreview(projectId);
      const url = new URL(initialPath.replace(/^\/?/, "/"), `${result.url}/`);
      url.searchParams.set("preview", result.revision);
      setPreviewUrl(url.toString());
      setRevision(result.revision);
      setStatus("ready");
    } catch (buildError) {
      setError(String((buildError as Error).message ?? buildError));
      setStatus("error");
    }
  }, [initialPath, projectId]);

  useEffect(() => {
    void buildPreview();
  }, [buildPreview]);

  const refreshPreview = useCallback(() => setRefreshKey((key) => key + 1), []);
  const previewRootRef = usePreviewShortcuts({ setWidthMode, refreshPreview });
  const fixedWidth = widthMode === "full" ? null : widthMode === "custom" ? customWidth : presetWidth(widthMode);
  const displayWidth = widthMode === "full" ? measuredWidth : widthMode === "custom" ? customWidth : presetWidth(widthMode);
  const frameStyle: CSSProperties =
    widthMode === "full"
      ? { width: "100%", maxWidth: "100%" }
      : {
          width: fixedWidth!,
          maxWidth: "100%",
          ...(widthMode === "phone"
            ? { height: `min(${PHONE_PREVIEW_HEIGHT}px, calc(100% - 32px))`, minHeight: 0 }
            : {}),
        };

  useEffect(() => {
    if (!widthInputFocused.current) setWidthDraft(String(displayWidth));
  }, [displayWidth]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || widthMode !== "full") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setMeasuredWidth(next);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [widthMode]);

  const commitWidthDraft = () => {
    const parsed = Number.parseInt(widthDraft, 10);
    if (Number.isNaN(parsed)) {
      setWidthDraft(String(displayWidth));
    } else {
      const next = clampPreviewWidth(parsed);
      setWidthMode("custom");
      setCustomWidth(next);
      setWidthDraft(String(next));
    }
    widthInputFocused.current = false;
  };

  return (
    <div className="preview-root" ref={previewRootRef} tabIndex={-1}>
      <div className="preview-bar">
        <button className="tool-btn" onClick={() => useEditor.getState().setScreen("editor")} title="Back to editor (⌥P)">
          <IconClose />
        </button>
        <button className="tool-btn" title="Reload production preview" onClick={refreshPreview} disabled={status !== "ready"}>
          <IconRefresh />
        </button>
        <span className="production-preview-badge">Production build</span>
        <span className="muted" style={{ fontSize: 11 }}>
          This exact build will be published
        </span>
        <div className="toolbar-spacer" />
        <div className="preview-width-controls">
          <div className="breakpoint-switcher">
            <button className={`tool-btn ${widthMode === "full" ? "active" : ""}`} title="Full width (⌥1)" onClick={() => setWidthMode("full")}>
              <IconFullWidth />
            </button>
            {BREAKPOINTS.map((breakpoint) => {
              const Icon = BP_ICONS[breakpoint.id];
              return (
                <button
                  key={breakpoint.id}
                  className={`tool-btn ${widthMode === breakpoint.id ? "active" : ""}`}
                  title={`${breakpoint.label} (${breakpoint.width}px)`}
                  onClick={() => setWidthMode(breakpoint.id)}
                >
                  <Icon />
                </button>
              );
            })}
          </div>
          <input
            className="preview-width-input"
            type="text"
            inputMode="numeric"
            value={widthDraft}
            onFocus={() => {
              widthInputFocused.current = true;
              if (widthMode === "full") {
                setWidthMode("custom");
                setCustomWidth(clampPreviewWidth(measuredWidth));
              }
            }}
            onChange={(event) => setWidthDraft(event.target.value)}
            onBlur={commitWidthDraft}
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
            aria-label="Preview width"
          />
          <span className="muted" style={{ fontSize: 11 }}>px</span>
        </div>
      </div>
      <div ref={stageRef} className={`preview-stage ${widthMode === "full" ? "preview-stage--full" : ""} ${widthMode === "phone" ? "preview-stage--phone" : ""}`}>
        <div className={`preview-frame-shell ${widthMode === "full" ? "preview-frame-shell--full" : ""} ${widthMode === "phone" ? "preview-frame-shell--phone" : ""}`} style={frameStyle}>
          {status === "building" && <div className="production-preview-status">Building the production website…</div>}
          {status === "error" && (
            <div className="production-preview-status production-preview-status--error">
              <strong>Production preview failed</strong>
              <pre>{error}</pre>
              <button className="btn primary" onClick={() => void buildPreview()}>Try again</button>
            </div>
          )}
          {status === "ready" && previewUrl && (
            <iframe
              key={`${revision}-${refreshKey}`}
              className="production-preview-frame"
              src={previewUrl}
              title="Production website preview"
              onLoad={() => {
                if (projectId && revision) void api.confirmProductionPreview(projectId, revision);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
