import { memo, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { BreakpointId, CmsCollection, CmsEntry, InstanceOverride, Node, SerializedProject, StyleProps } from "@/model/types";
import { finalFrameStylesForPage } from "@/model/animation";
import { resolveHoverAppearance } from "@/model/hover";
import { ancestorChain, nodeStyles, resolveComponentVariant } from "@/model/resolve";
import { stylesToCss, type CssContext } from "@/model/css";
import { docActions, useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { useTimeline } from "@/store/timeline";
import { CustomCodeRoot } from "@/ui/CustomCodeRuntime";

// ─────────────────────────────────────────────────────────────────────────────
// Renders a node subtree as real DOM inside an editor artboard. Every element
// carries data-node-id for hit-testing. Component instances render their
// master subtree (with overrides) but hit-test as the instance node.
// ─────────────────────────────────────────────────────────────────────────────

export interface RenderEnv {
  project: SerializedProject;
  breakpoint: BreakpointId;
  /** id prefix for hit-testing (instances remap inner ids to the instance) */
  hitId?: (nodeId: string) => string;
  overrides?: Record<string, InstanceOverride>;
  cmsEntry?: { collection: CmsCollection; entry: CmsEntry } | null;
  /** ghost copies (extra CMS cards) are non-interactive */
  ghost?: boolean;
  /** editor canvas renders entrance animations at their completed state */
  finalAnimationStyles?: Record<string, CSSProperties>;
}

function bindingValue(node: Node, env: RenderEnv): string | null {
  if (!node.binding || !env.cmsEntry) return null;
  const value = env.cmsEntry.entry.values[node.binding.fieldId];
  return value === undefined ? null : String(value);
}

function childContexts(childIds: string[], parentProps: StyleProps, env: RenderEnv): CssContext[] {
  let flowIndex = 0;
  return childIds.map((childId) => {
    const child = env.project.nodes[childId];
    const childProps = child ? nodeStyles(child, env.project, env.breakpoint) : null;
    const index = childProps && !childProps.positionAbsolute && childProps.visible !== false ? flowIndex++ : undefined;
    return {
      parentLayout: parentProps.layout ?? "absolute",
      parentDirection: parentProps.direction ?? "column",
      parentGap: parentProps.gap ?? 0,
      flowIndex: index,
      editor: true,
    };
  });
}

function EditableText({ node, env, style, hit }: { node: Node; env: RenderEnv; style: CSSProperties; hit: string }) {
  const editingTextId = useEditor((s) => s.editingTextId);
  const activeBp = useEditor((s) => s.breakpoint);
  // the node renders once per artboard; only the active breakpoint's copy edits,
  // otherwise the copies steal focus from each other and instantly blur
  const isEditing = editingTextId === node.id && env.breakpoint === activeBp && !env.ghost && !env.overrides;
  const ref = useRef<HTMLElement | null>(null);
  const Tag = (node.textTag ?? "p") as "p";

  useLayoutEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing]);

  const override = env.overrides?.[node.id] ?? (node.variantSourceId ? env.overrides?.[node.variantSourceId] : undefined);
  const text = bindingValue(node, env) ?? override?.text ?? node.text ?? "";

  if (isEditing) {
    return (
      <Tag
        ref={ref as never}
        data-node-id={hit}
        data-editing="true"
        style={style}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          docActions.updateNode(node.id, { text: (e.target as HTMLElement).innerText });
          useEditor.getState().setEditingText(null);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.target as HTMLElement).blur();
            return;
          }
          if (e.key === "Escape") (e.target as HTMLElement).blur();
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          const target = e.currentTarget;
          const selection = target.ownerDocument.defaultView?.getSelection();
          if (!selection || selection.rangeCount === 0) return;

          const range = selection.getRangeAt(0);
          if (!target.contains(range.commonAncestorContainer)) return;

          range.deleteContents();
          const textNode = target.ownerDocument.createTextNode(text);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {text}
      </Tag>
    );
  }
  return (
    <Tag data-node-id={hit} style={style}>
      {text}
    </Tag>
  );
}

export const RenderNode = memo(function RenderNode({ id, env, parentCtx }: { id: string; env: RenderEnv; parentCtx: CssContext }) {
  const node = env.project.nodes[id];
  const animPatch = useTimeline((s) => (s.open ? s.preview[id] : undefined));
  const propertyState = useEditor((s) => s.propertyState);
  const selection = useEditor((s) => s.selection);
  if (!node) return null;

  const override = env.overrides?.[id] ?? (node.variantSourceId ? env.overrides?.[node.variantSourceId] : undefined);
  if (override?.visible === false) return null;

  const hit = env.hitId ? env.hitId(id) : id;
  const showHoverPreview =
    propertyState === "hover" &&
    selection.some((selId) => selId === hit || ancestorChain(env.project.nodes, hit).includes(selId));

  const props =
    showHoverPreview && node.effects?.hover
      ? resolveHoverAppearance(node, env.project, env.breakpoint, node.effects.hover)
      : nodeStyles(node, env.project, env.breakpoint);
  let style = stylesToCss(props, node, { ...parentCtx, editor: true }) as CSSProperties;
  const finalAnimationStyle = env.finalAnimationStyles?.[id];
  if (finalAnimationStyle) style = { ...style, ...finalAnimationStyle };
  if (showHoverPreview && node.effects?.hover) {
    const h = node.effects.hover;
    const transforms: string[] = [];
    if (style.transform) transforms.push(String(style.transform));
    if (h.scale !== undefined) transforms.push(`scale(${h.scale})`);
    if (h.rotate !== undefined) transforms.push(`rotate(${h.rotate}deg)`);
    if (h.y !== undefined) transforms.push(`translateY(${h.y}px)`);
    if (transforms.length > 0) style = { ...style, transform: transforms.join(" ") };
    if (h.opacity !== undefined) style = { ...style, opacity: h.opacity };
  }
  if (override?.fill && override.fill.type === "solid") style = { ...style, backgroundColor: override.fill.color };
  if (override?.color) style = { ...style, color: override.color };
  if (animPatch) style = { ...style, ...animPatch, willChange: "left, top, transform, opacity, filter" };

  const childCtx: CssContext = {
    parentLayout: props.layout ?? "absolute",
    parentDirection: props.direction ?? "column",
    parentGap: props.gap ?? 0,
    editor: true,
  };

  if (node.customCode) {
    return (
      <CustomCodeRoot
        data-node-id={hit}
        nodeId={node.id}
        html={node.customCode.html}
        css={node.customCode.css}
        behaviors={node.customCode.behaviors}
        editor
        style={style}
      />
    );
  }

  switch (node.type) {
    case "text": {
      const s = { ...style, whiteSpace: "pre-wrap" as const };
      return <EditableText node={node} env={env} style={s} hit={hit} />;
    }

    case "image": {
      const src = bindingValue(node, env) ?? override?.src ?? node.src;
      if (!src) {
        return (
          <div
            data-node-id={hit}
            style={{
              ...style,
              background:
                "repeating-conic-gradient(#e8e8e8 0 25%, #f6f6f6 0 50%) 0 0 / 20px 20px, #f6f6f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              fontSize: 12,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Image
          </div>
        );
      }
      return <img data-node-id={hit} src={src} alt={node.alt ?? ""} style={{ ...style, objectFit: node.objectFit ?? "cover" }} draggable={false} />;
    }

    case "icon":
      return <span data-node-id={hit} style={style} dangerouslySetInnerHTML={{ __html: node.svg ?? "" }} />;

    case "instance": {
      const comp = env.project.components.find((c) => c.id === node.componentId);
      if (!comp) return <div data-node-id={hit} style={style} />;
      const masterRoot = env.project.nodes[resolveComponentVariant(comp, env.breakpoint).rootId];
      if (!masterRoot) return null;
      const masterProps = nodeStyles(masterRoot, env.project, env.breakpoint);
      // instance wrapper carries position; master root renders inside without position
      const masterStyle = stylesToCss(masterProps, masterRoot, { parentLayout: "stack", parentDirection: "column", editor: true }) as CSSProperties;
      const innerEnv: RenderEnv = {
        ...env,
        hitId: () => hit,
        overrides: node.overrides ?? {},
      };
      const innerCtx: CssContext = {
        parentLayout: masterProps.layout ?? "absolute",
        parentDirection: masterProps.direction ?? "column",
        parentGap: masterProps.gap ?? 0,
        editor: true,
      };
      const innerChildContexts = childContexts(masterRoot.children, masterProps, innerEnv);
      return (
        <div data-node-id={hit} data-instance="true" style={{ ...style, ...pickLayoutFree(masterStyle), position: style.position, left: style.left, top: style.top, width: style.width ?? masterStyle.width, height: style.height ?? masterStyle.height }}>
          {masterRoot.children.map((c, index) => (
            <RenderNode key={c} id={c} env={innerEnv} parentCtx={innerChildContexts[index] ?? innerCtx} />
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
        <div data-node-id={hit} style={style}>
          {collection && template ? (
            entries.length > 0 ? (
              entries.map((entry, i) => (
                <RenderNode
                  key={entry.id}
                  id={template}
                  env={{ ...env, cmsEntry: { collection, entry }, ghost: i > 0 ? true : env.ghost, hitId: i > 0 ? () => hit : env.hitId }}
                  parentCtx={childCtx}
                />
              ))
            ) : (
              <div style={{ padding: 24, color: "#999", fontFamily: "Inter, sans-serif", fontSize: 13 }}>No entries yet — add some in the CMS tab</div>
            )
          ) : (
            <div style={{ padding: 24, color: "#999", fontFamily: "Inter, sans-serif", fontSize: 13 }}>Connect a collection in the properties panel</div>
          )}
        </div>
      );
    }

    default: {
      // frame
      const contexts = childContexts(node.children, props, env);
      const children: ReactNode = node.children.map((c, index) => <RenderNode key={c} id={c} env={env} parentCtx={contexts[index] ?? childCtx} />);
      if (node.tag === "input") {
        return <input data-node-id={hit} style={style} placeholder={node.placeholder} readOnly />;
      }
      if (node.tag === "textarea") {
        return <textarea data-node-id={hit} style={style} placeholder={node.placeholder} readOnly />;
      }
      return (
        <div data-node-id={hit} style={style}>
          {children}
        </div>
      );
    }
  }
});

function pickLayoutFree(style: CSSProperties): CSSProperties {
  const { position: _p, left: _l, top: _t, right: _r, bottom: _b, width: _w, height: _h, ...rest } = style;
  return rest;
}

/** Root renderer for an artboard: renders the page/component root's children. */
export function ArtboardContent({ rootId, breakpoint, cmsPreviewEntry }: { rootId: string; breakpoint: BreakpointId; cmsPreviewEntry?: { collection: CmsCollection; entry: CmsEntry } | null }) {
  const project = useDocument((s) => s.project);
  if (!project) return null;
  const root = project.nodes[rootId];
  if (!root) return null;
  const page = project.pages.find((candidate) => candidate.rootId === rootId);
  const env: RenderEnv = {
    project,
    breakpoint,
    cmsEntry: cmsPreviewEntry ?? null,
    finalAnimationStyles: page ? finalFrameStylesForPage(project, page.id) : {},
  };
  const props = nodeStyles(root, project, breakpoint);
  const style = stylesToCss(props, root, { parentLayout: "stack", parentDirection: "column", editor: true }) as CSSProperties;
  // root fills the artboard; artboard supplies width
  const rootStyle: CSSProperties = { ...style, position: "relative", width: "100%", left: undefined, top: undefined };
  const childCtx: CssContext = { parentLayout: props.layout ?? "stack", parentDirection: props.direction ?? "column", editor: true };
  const contexts = childContexts(root.children, props, env);
  return (
    <div className="artboard-content" data-node-id={rootId} style={rootStyle}>
      {root.children.map((c, index) => (
        <RenderNode key={c} id={c} env={env} parentCtx={contexts[index] ?? childCtx} />
      ))}
    </div>
  );
}
