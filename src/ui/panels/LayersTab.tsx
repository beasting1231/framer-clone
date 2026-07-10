import { useState, type DragEvent } from "react";
import { docActions, useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import type { Node } from "@/model/types";
import { resolveComponentVariant } from "@/model/resolve";
import {
  IconCaret,
  IconComponent,
  IconEye,
  IconEyeOff,
  IconFrame,
  IconGrid,
  IconImage,
  IconList,
  IconLock,
  IconRow,
  IconStack,
  IconText,
} from "../icons";

// ─────────────────────────────────────────────────────────────────────────────
// Layers tree: hierarchy of the active page/component with rename, reorder
// (drag & drop), hide and lock.
// ─────────────────────────────────────────────────────────────────────────────

function nodeIcon(node: Node) {
  switch (node.type) {
    case "text":
      return <IconText />;
    case "image":
      return <IconImage />;
    case "instance":
      return <IconComponent />;
    case "collectionList":
      return <IconList />;
    default: {
      const layout = node.styles.desktop.layout;
      if (layout === "stack") return node.styles.desktop.direction === "row" ? <IconRow /> : <IconStack />;
      if (layout === "grid") return <IconGrid />;
      return <IconFrame />;
    }
  }
}

interface DropState {
  targetId: string;
  mode: "before" | "after" | "inside";
}

export function LayersTab() {
  const project = useDocument((s) => s.project);
  const context = useEditor((s) => s.context);
  const breakpoint = useEditor((s) => s.breakpoint);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropState | null>(null);

  if (!project || !context) return null;
  const rootId =
    context.kind === "page"
      ? project.pages.find((p) => p.id === context.pageId)?.rootId
      : (() => {
          const component = project.components.find((c) => c.id === context.componentId);
          return component ? resolveComponentVariant(component, breakpoint).rootId : undefined;
        })();
  if (!rootId) return null;

  return (
    <div className="panel-content">
      <LayerRow
        id={rootId}
        depth={0}
        project={project}
        renaming={renaming}
        setRenaming={setRenaming}
        dragId={dragId}
        setDragId={setDragId}
        drop={drop}
        setDrop={setDrop}
      />
    </div>
  );
}

function LayerRow(props: {
  id: string;
  depth: number;
  project: NonNullable<ReturnType<typeof useDocument.getState>["project"]>;
  renaming: string | null;
  setRenaming: (id: string | null) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  drop: DropState | null;
  setDrop: (d: DropState | null) => void;
}) {
  const { id, depth, project, renaming, setRenaming, dragId, setDragId, drop, setDrop } = props;
  const selection = useEditor((s) => s.selection);
  const hoveredId = useEditor((s) => s.hoveredId);
  const expanded = useEditor((s) => s.expanded);
  const node = project.nodes[id];
  if (!node) return null;

  const s = useEditor.getState();
  const isRoot = depth === 0;
  const isOpen = isRoot || expanded.has(id);
  const hasChildren = node.children.length > 0 && node.type !== "instance" && node.type !== "collectionList";
  const selected = selection.includes(id);
  const hidden = node.styles.desktop.visible === false;

  const onDragOver = (e: DragEvent) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const canNest = node.type === "frame";
    if (canNest && y > rect.height * 0.3 && y < rect.height * 0.7) setDrop({ targetId: id, mode: "inside" });
    else if (y < rect.height / 2) setDrop({ targetId: id, mode: "before" });
    else setDrop({ targetId: id, mode: "after" });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragId || !drop || drop.targetId !== id) return;
    if (drop.mode === "inside") {
      docActions.reparent(dragId, id, project.nodes[id].children.length);
      s.expandAll([id]);
    } else if (node.parent) {
      const parent = project.nodes[node.parent];
      let index = parent.children.indexOf(id);
      if (drop.mode === "after") index += 1;
      docActions.reparent(dragId, node.parent, index);
    }
    setDragId(null);
    setDrop(null);
  };

  const isDropTarget = drop?.targetId === id;

  return (
    <div>
      <div
        className={`layer-row ${selected ? "selected" : ""} ${node.type === "instance" ? "component" : ""} ${hoveredId === id && !selected ? "hovered" : ""}`}
        style={{
          paddingLeft: 6 + depth * 14,
          opacity: hidden ? 0.45 : 1,
          outline: isDropTarget && drop?.mode === "inside" ? "1.5px solid var(--accent)" : undefined,
        }}
        draggable={!isRoot && renaming !== id}
        onDragStart={(e) => {
          setDragId(id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          setDragId(null);
          setDrop(null);
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={(e) => s.select([id], e.shiftKey)}
        onDoubleClick={() => setRenaming(id)}
        onMouseEnter={() => s.setHovered(id)}
        onMouseLeave={() => s.setHovered(null)}
      >
        {isDropTarget && drop?.mode === "before" && <div className="layer-drop-indicator" style={{ top: 0 }} />}
        {isDropTarget && drop?.mode === "after" && <div className="layer-drop-indicator" style={{ bottom: 0 }} />}
        <span
          className={`layer-caret ${isOpen ? "open" : ""}`}
          style={{ visibility: hasChildren && !isRoot ? "visible" : isRoot ? "visible" : "hidden" }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isRoot) s.toggleExpanded(id);
          }}
        >
          {hasChildren && !isRoot && <IconCaret />}
        </span>
        <span className="layer-icon">{nodeIcon(node)}</span>
        <span className="layer-name">
          {renaming === id ? (
            <input
              autoFocus
              defaultValue={node.name}
              onFocus={(e) => e.target.select()}
              onBlur={(e) => {
                docActions.updateNode(id, { name: e.target.value || node.name });
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setRenaming(null);
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            node.name
          )}
        </span>
        <span className="layer-actions">
          <button
            className="icon-btn"
            title={hidden ? "Show" : "Hide"}
            onClick={(e) => {
              e.stopPropagation();
              docActions.setStyles([id], "desktop", { visible: hidden ? undefined : false });
            }}
          >
            {hidden ? <IconEyeOff /> : <IconEye />}
          </button>
          <button
            className={`icon-btn ${node.locked ? "always-visible" : ""}`}
            title={node.locked ? "Unlock" : "Lock"}
            style={node.locked ? { color: "var(--accent)" } : undefined}
            onClick={(e) => {
              e.stopPropagation();
              docActions.updateNode(id, { locked: !node.locked });
            }}
          >
            <IconLock />
          </button>
        </span>
      </div>
      {isOpen &&
        hasChildren &&
        [...node.children].reverse().map((childId) => (
          <LayerRow key={childId} {...props} id={childId} depth={depth + 1} />
        ))}
    </div>
  );
}
