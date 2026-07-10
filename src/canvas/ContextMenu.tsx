import { useEffect } from "react";
import { docActions, useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { copySelection, cutSelection, pasteClipboard, hasClipboard } from "./clipboard";
import { componentRootIds } from "@/model/resolve";

export function CanvasContextMenu() {
  const menu = useEditor((s) => s.contextMenu);
  const project = useDocument((s) => s.project);

  useEffect(() => {
    if (!menu) return;
    const close = () => useEditor.getState().setContextMenu(null);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);

  if (!menu || !project) return null;
  const s = useEditor.getState();
  const node = menu.nodeId ? project.nodes[menu.nodeId] : null;
  const isRoot = node ? project.pages.some((p) => p.rootId === node.id) || project.components.some((c) => componentRootIds(c).includes(node.id)) : false;
  const close = () => useEditor.getState().setContextMenu(null);

  const item = (label: string, action: () => void, opts: { shortcut?: string; danger?: boolean; disabled?: boolean } = {}) => (
    <button
      key={label}
      className={`context-item ${opts.danger ? "danger" : ""}`}
      style={opts.disabled ? { opacity: 0.4, pointerEvents: "none" } : undefined}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        action();
        close();
      }}
    >
      {label}
      {opts.shortcut && <span className="shortcut">{opts.shortcut}</span>}
    </button>
  );

  return (
    <div className="context-menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
      {node && !isRoot && (
        <>
          {item("Cut", () => cutSelection(), { shortcut: "⌘X" })}
          {item("Copy", () => copySelection(), { shortcut: "⌘C" })}
        </>
      )}
      {item("Paste", () => pasteClipboard(), { shortcut: "⌘V", disabled: !hasClipboard() })}
      {node && !isRoot && (
        <>
          {item("Duplicate", () => {
            const ids = docActions.duplicateNodes(s.selection);
            if (ids.length > 0) s.select(ids);
          }, { shortcut: "⌘D" })}
          <div className="context-divider" />
          {item("Wrap in Stack", () => {
            const id = docActions.wrapInStack(s.selection);
            if (id) s.select([id]);
          }, { shortcut: "⌘⏎" })}
          {node.type !== "instance" &&
            item("Create Component", () => {
              const def = docActions.createComponent(node.id);
              if (def) s.select([node.id]);
            }, { shortcut: "⌘K" })}
          {node.type === "instance" &&
            item("Edit Component", () => {
              if (node.componentId) s.setContext({ kind: "component", componentId: node.componentId });
            })}
          <div className="context-divider" />
          {item(node.locked ? "Unlock" : "Lock", () => docActions.updateNode(node.id, { locked: !node.locked }))}
          {item("Bring Forward", () => {
            const parent = node.parent ? project.nodes[node.parent] : null;
            if (!parent) return;
            const idx = parent.children.indexOf(node.id);
            if (idx < parent.children.length - 1) docActions.reorderChild(parent.id, idx, idx + 1);
          }, { shortcut: "⌘]" })}
          {item("Send Backward", () => {
            const parent = node.parent ? project.nodes[node.parent] : null;
            if (!parent) return;
            const idx = parent.children.indexOf(node.id);
            if (idx > 0) docActions.reorderChild(parent.id, idx, idx - 1);
          }, { shortcut: "⌘[" })}
          <div className="context-divider" />
          {item("Delete", () => {
            docActions.deleteNodes(s.selection);
            s.clearSelection();
          }, { shortcut: "⌫", danger: true })}
        </>
      )}
    </div>
  );
}
