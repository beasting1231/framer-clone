import { createElement, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { BREAKPOINTS, type BreakpointId, type CmsCollection, type CmsEntry, type InstanceOverride, type Node, type Page, type SerializedProject } from "@/model/types";
import { buildClipMotionMap } from "@/model/animation";
import { nodeStyles } from "@/model/resolve";
import { stylesToCss, type CssContext } from "@/model/css";
import { useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { IconClose, IconDesktop, IconFullWidth, IconPhone, IconRefresh, IconTablet } from "@/ui/icons";
import { PreviewMotion } from "./PreviewMotion";
import { usePreviewShortcuts, type PreviewWidthMode } from "./usePreviewShortcuts";

// ─────────────────────────────────────────────────────────────────────────────
// Preview: renders the real site in an interactive frame — working links,
// CMS detail pages, entrance/hover animations — at any device width.
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewEnv {
  project: SerializedProject;
  breakpoint: BreakpointId;
  navigate: (path: string) => void;
  cmsEntry?: { collection: CmsCollection; entry: CmsEntry } | null;
  overrides?: Record<string, InstanceOverride>;
  /** scroll container for appear animations (preview-frame) */
  scrollRoot: RefObject<Element | null>;
  /** nodeId → framer-motion props from timeline clips on the current page */
  clipMotion?: Record<string, Record<string, unknown>>;
}
function buildClipMotion(project: SerializedProject, pageId: string) {
  return buildClipMotionMap(project, pageId);
}

function bindingValue(node: Node, env: PreviewEnv): string | null {
  if (!node.binding || !env.cmsEntry) return null;
  const v = env.cmsEntry.entry.values[node.binding.fieldId];
  return v === undefined ? null : String(v);
}

function detailPath(project: SerializedProject, collectionId: string, slug: string): string | null {
  const page = project.pages.find((p) => p.kind === "cms-template" && p.collectionId === collectionId);
  return page ? page.path.replace(":slug", slug) : null;
}

function linkProps(node: Node, env: PreviewEnv): { onClick?: (e: React.MouseEvent) => void; style?: CSSProperties } {
  const link = node.link;
  if (!link) return {};
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (link.type === "page") {
      const page = env.project.pages.find((p) => p.id === link.pageId);
      if (page) env.navigate(page.path);
    } else if (link.type === "url" && link.url) {
      window.open(link.url, link.newTab ? "_blank" : "_self");
    } else if (link.type === "email" && link.url) {
      window.open(`mailto:${link.url}`);
    } else if (link.type === "cms-detail") {
      const collectionId = link.collectionId ?? env.cmsEntry?.collection.id;
      const slug = env.cmsEntry?.entry.slug;
      if (collectionId && slug) {
        const path = detailPath(env.project, collectionId, slug);
        if (path) env.navigate(path);
      }
    }
  };
  return { onClick, style: { cursor: "pointer" } };
}

function motionFor(node: Node, skipEntrance = false): Record<string, unknown> {
  const fx = node.effects;
  if (!fx) return {};
  const out: Record<string, unknown> = {};
  const entrance = fx.entrance;
  if (!skipEntrance && entrance && entrance.preset !== "none") {
    const from: Record<string, unknown> = { opacity: 0 };
    if (entrance.preset === "slide-up") from.y = 40;
    if (entrance.preset === "slide-down") from.y = -40;
    if (entrance.preset === "slide-left") from.x = 40;
    if (entrance.preset === "slide-right") from.x = -40;
    if (entrance.preset === "scale") from.scale = 0.8;
    if (entrance.preset === "blur") from.filter = "blur(12px)";
    const to: Record<string, unknown> = { opacity: 1, x: 0, y: 0 };
    if (from.scale !== undefined) to.scale = 1;
    if (from.filter !== undefined) to.filter = "blur(0px)";
    out.initial = from;
    if (entrance.onScroll) {
      out.whileInView = to;
      out.viewport = { once: true, amount: 0.3 };
    } else {
      out.animate = to;
    }
    out.transition = { duration: entrance.duration, delay: entrance.delay, ease: "easeOut" };
  }
  const hover = fx.hover;
  if (hover) {
    const wh: Record<string, unknown> = {};
    if (hover.scale !== undefined) wh.scale = hover.scale;
    if (hover.opacity !== undefined) wh.opacity = hover.opacity;
    if (hover.rotate !== undefined) wh.rotate = hover.rotate;
    if (hover.y !== undefined) wh.y = hover.y;
    if (hover.fill?.type === "solid") wh.backgroundColor = hover.fill.color;
    if (hover.color) wh.color = hover.color;
    if (Object.keys(wh).length > 0) {
      out.whileHover = { ...wh, transition: { duration: hover.duration } };
    }
  }
  if (fx.pressScale !== undefined) out.whileTap = { scale: fx.pressScale };
  return out;
}

function PreviewNode({ id, env, parentCtx }: { id: string; env: PreviewEnv; parentCtx: CssContext }) {
  const node = env.project.nodes[id];
  if (!node) return null;
  const override = env.overrides?.[id];
  if (override?.visible === false) return null;

  const props = nodeStyles(node, env.project, env.breakpoint);
  let style = stylesToCss(props, node, parentCtx) as CSSProperties;
  if (override?.fill?.type === "solid") style = { ...style, backgroundColor: override.fill.color };
  if (override?.color) style = { ...style, color: override.color };

  const childCtx: CssContext = { parentLayout: props.layout ?? "absolute", parentDirection: props.direction ?? "column" };
  const link = linkProps(node, env);
  const clipAnim = env.clipMotion?.[id];
  const anim = clipAnim ? { ...motionFor(node, true), ...clipAnim } : motionFor(node);
  const hasAnim = Object.keys(anim).length > 0;

  switch (node.type) {
    case "text": {
      const text = bindingValue(node, env) ?? override?.text ?? node.text ?? "";
      const textStyle = { ...style, whiteSpace: "pre-wrap" as const, ...link.style };
      if (hasAnim) {
        return (
          <PreviewMotion tag={node.textTag ?? "p"} anim={anim} scrollRoot={env.scrollRoot} style={textStyle} onClick={link.onClick}>
            {text}
          </PreviewMotion>
        );
      }
      const Tag = node.textTag ?? "p";
      return createElement(Tag, { style: textStyle, onClick: link.onClick }, text);
    }
    case "image": {
      const src = bindingValue(node, env) ?? override?.src ?? node.src ?? "";
      if (!src) return <div style={{ ...style, background: "#EEE" }} />;
      const imgStyle = { ...style, objectFit: node.objectFit ?? "cover", ...link.style };
      if (hasAnim) {
        return <PreviewMotion tag="img" anim={anim} scrollRoot={env.scrollRoot} src={src} alt={node.alt ?? ""} style={imgStyle} onClick={link.onClick} />;
      }
      return <img src={src} alt={node.alt ?? ""} style={imgStyle} onClick={link.onClick} />;
    }
    case "icon":
      return <span style={style} dangerouslySetInnerHTML={{ __html: node.svg ?? "" }} />;
    case "instance": {
      const comp = env.project.components.find((c) => c.id === node.componentId);
      const masterRoot = comp ? env.project.nodes[comp.rootId] : null;
      if (!comp || !masterRoot) return null;
      const masterProps = nodeStyles(masterRoot, env.project, env.breakpoint);
      const masterStyle = stylesToCss(masterProps, masterRoot, { parentLayout: "stack", parentDirection: "column" }) as CSSProperties;
      const innerCtx: CssContext = { parentLayout: masterProps.layout ?? "absolute", parentDirection: masterProps.direction ?? "column" };
      const merged: CSSProperties = { ...masterStyle, position: style.position, left: style.left, top: style.top, width: style.width ?? masterStyle.width, height: style.height ?? masterStyle.height };
      return (
        <div style={merged}>
          {masterRoot.children.map((c) => (
            <PreviewNode key={c} id={c} env={{ ...env, overrides: node.overrides ?? {} }} parentCtx={innerCtx} />
          ))}
        </div>
      );
    }
    case "collectionList": {
      const collection = env.project.cms.collections.find((c) => c.id === node.collectionId);
      const template = node.children[0];
      let entries = collection?.entries ?? [];
      if (node.limit && node.limit > 0) entries = entries.slice(0, node.limit);
      return (
        <div style={style}>
          {collection && template
            ? entries.map((entry) => (
                <PreviewNode key={entry.id} id={template} env={{ ...env, cmsEntry: { collection, entry } }} parentCtx={childCtx} />
              ))
            : null}
        </div>
      );
    }
    default: {
      const children: ReactNode = node.children.map((c) => <PreviewNode key={c} id={c} env={env} parentCtx={childCtx} />);
      if (node.tag === "input") return <input style={style} placeholder={node.placeholder} type={node.inputType ?? "text"} />;
      if (node.tag === "textarea") return <textarea style={style} placeholder={node.placeholder} />;
      const frameStyle = { ...style, ...link.style };
      if (hasAnim) {
        return (
          <PreviewMotion tag="div" anim={anim} scrollRoot={env.scrollRoot} style={frameStyle} onClick={link.onClick}>
            {children}
          </PreviewMotion>
        );
      }
      return (
        <div style={frameStyle} onClick={link.onClick}>
          {children}
        </div>
      );
    }
  }
}

function matchRoute(project: SerializedProject, path: string): { page: Page; cmsEntry: { collection: CmsCollection; entry: CmsEntry } | null } | null {
  for (const page of project.pages) {
    if (page.kind === "page" && page.path === path) return { page, cmsEntry: null };
  }
  for (const page of project.pages) {
    if (page.kind !== "cms-template" || !page.collectionId) continue;
    const pattern = page.path.replace(":slug", "([^/]+)");
    const match = new RegExp(`^${pattern}$`).exec(path);
    if (match) {
      const collection = project.cms.collections.find((c) => c.id === page.collectionId);
      const entry = collection?.entries.find((e) => e.slug === match[1]);
      if (collection && entry) return { page, cmsEntry: { collection, entry } };
    }
  }
  return null;
}

const BP_ICONS = { desktop: IconDesktop, tablet: IconTablet, phone: IconPhone } as const;

const MIN_PREVIEW_WIDTH = 280;
const MAX_PREVIEW_WIDTH = 4800;

function clampPreviewWidth(width: number) {
  return Math.max(MIN_PREVIEW_WIDTH, Math.min(MAX_PREVIEW_WIDTH, Math.round(width)));
}

/** Pick responsive styles from the effective preview width. */
function breakpointForWidth(width: number): BreakpointId {
  if (width <= 389.98) return "phone";
  if (width <= 809.98) return "tablet";
  return "desktop";
}

function presetWidth(bp: BreakpointId) {
  return BREAKPOINTS.find((b) => b.id === bp)!.width;
}

/** Preview-only reload shortcut — Alt/Option+R avoids browser refresh (Cmd+R). */
function previewRefreshShortcutLabel() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌥R" : "Alt+R";
}

export function PreviewMode() {
  const project = useDocument((s) => s.project);
  const context = useEditor((s) => s.context);
  const [widthMode, setWidthMode] = useState<PreviewWidthMode>("full");
  const [customWidth, setCustomWidth] = useState(1024);
  const [widthDraft, setWidthDraft] = useState("");
  const [measuredWidth, setMeasuredWidth] = useState(1280);
  const widthInputFocused = useRef(false);
  const initialPath = useMemo(() => {
    if (!project) return "/";
    if (context?.kind === "page") {
      const page = project.pages.find((p) => p.id === context.pageId);
      if (page && page.kind === "page") return page.path;
      if (page?.kind === "cms-template" && page.collectionId) {
        const coll = project.cms.collections.find((c) => c.id === page.collectionId);
        if (coll?.entries[0]) return page.path.replace(":slug", coll.entries[0].slug);
      }
    }
    return project.pages.find((p) => p.id === project.homePageId)?.path ?? "/";
  }, [project, context]);
  const [path, setPath] = useState(initialPath);
  const [history, setHistory] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const refreshPreview = useCallback(() => {
    scrollRootRef.current?.scrollTo(0, 0);
    setRefreshKey((k) => k + 1);
  }, []);

  const previewRootRef = usePreviewShortcuts({ setWidthMode, refreshPreview });

  const fixedWidth =
    widthMode === "full" ? null : widthMode === "custom" ? customWidth : presetWidth(widthMode);
  const effectiveWidth = fixedWidth ?? measuredWidth;
  const breakpoint = breakpointForWidth(effectiveWidth);
  const displayWidth =
    widthMode === "full" ? measuredWidth : widthMode === "custom" ? customWidth : presetWidth(widthMode);

  useEffect(() => {
    if (!widthInputFocused.current) setWidthDraft(String(displayWidth));
  }, [displayWidth]);

  useEffect(() => {
    const el = scrollRootRef.current;
    if (!el || widthMode !== "full") return;
    const ro = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setMeasuredWidth(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthMode]);

  if (!project) return null;
  const route = matchRoute(project, path) ?? matchRoute(project, "/");

  const navigate = (to: string) => {
    setHistory((h) => [...h, path]);
    setPath(to);
  };

  const env: PreviewEnv = {
    project,
    breakpoint,
    navigate,
    cmsEntry: route?.cmsEntry ?? null,
    scrollRoot: scrollRootRef,
    clipMotion: route ? buildClipMotion(project, route.page.id) : {},
  };

  const root = route ? project.nodes[route.page.rootId] : null;
  const rootProps = root ? nodeStyles(root, project, breakpoint) : null;
  const rootStyle = root && rootProps ? (stylesToCss(rootProps, root, { parentLayout: "stack", parentDirection: "column" }) as CSSProperties) : {};

  const commitWidthDraft = () => {
    const parsed = parseInt(widthDraft, 10);
    if (!Number.isNaN(parsed)) {
      const next = clampPreviewWidth(parsed);
      setWidthMode("custom");
      setCustomWidth(next);
      setWidthDraft(String(next));
    } else {
      setWidthDraft(String(displayWidth));
    }
    widthInputFocused.current = false;
  };

  const frameStyle: CSSProperties =
    widthMode === "full" ? { width: "100%", maxWidth: "100%" } : { width: fixedWidth!, maxWidth: "100%" };

  return (
    <div
      className="preview-root"
      ref={previewRootRef}
      tabIndex={-1}
      onMouseDownCapture={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea, select, button, a, [contenteditable='true']")) return;
        previewRootRef.current?.focus({ preventScroll: true });
      }}
    >
      <div className="preview-bar">
        <button className="tool-btn" onClick={() => useEditor.getState().setScreen("editor")} title="Back to editor (⌥P)">
          <IconClose />
        </button>
        <button
          className="tool-btn"
          title={`Refresh preview (${previewRefreshShortcutLabel()})`}
          onClick={refreshPreview}
        >
          <IconRefresh />
        </button>
        <button
          className="tool-btn"
          style={{ opacity: history.length > 0 ? 1 : 0.4 }}
          onClick={() => {
            const prev = history[history.length - 1];
            if (prev !== undefined) {
              setHistory((h) => h.slice(0, -1));
              setPath(prev);
            }
          }}
        >
          ←
        </button>
        <span style={{ background: "var(--bg-2)", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "var(--text-1)", minWidth: 180 }}>
          {path}
        </span>
        <div className="toolbar-spacer" />
        <div className="preview-width-controls">
          <div className="breakpoint-switcher">
            <button
              className={`tool-btn ${widthMode === "full" ? "active" : ""}`}
              title="Full width (⌥1)"
              onClick={() => setWidthMode("full")}
            >
              <IconFullWidth />
            </button>
            {BREAKPOINTS.map((bp) => {
              const Icon = BP_ICONS[bp.id];
              const shortcut =
                bp.id === "desktop" ? "⌥2" : bp.id === "tablet" ? "⌥3" : bp.id === "phone" ? "⌥4" : undefined;
              return (
                <button
                  key={bp.id}
                  className={`tool-btn ${widthMode === bp.id ? "active" : ""}`}
                  title={`${bp.label} (${bp.width}px)${shortcut ? ` · ${shortcut}` : ""}`}
                  onClick={() => setWidthMode(bp.id)}
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
            onChange={(e) => setWidthDraft(e.target.value)}
            onBlur={commitWidthDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            aria-label="Preview width"
          />
          <span className="muted" style={{ fontSize: 11 }}>
            px
          </span>
        </div>
      </div>
      <div className={`preview-stage ${widthMode === "full" ? "preview-stage--full" : ""}`}>
        <div
          className={`preview-frame ${widthMode === "full" ? "preview-frame--full" : ""}`}
          ref={scrollRootRef}
          style={frameStyle}
        >
          {root ? (
            <div key={refreshKey} style={{ ...rootStyle, position: "relative", width: "100%", minHeight: "100%" }}>
              {root.children.map((c) => (
                <PreviewNode
                  key={c}
                  id={c}
                  env={env}
                  parentCtx={{ parentLayout: rootProps?.layout ?? "stack", parentDirection: rootProps?.direction ?? "column" }}
                />
              ))}
            </div>
          ) : (
            <div style={{ padding: 60, fontFamily: "Inter", color: "#999" }}>No page matches “{path}”.</div>
          )}
        </div>
      </div>
    </div>
  );
}
