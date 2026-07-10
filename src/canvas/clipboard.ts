import { cloneSubtree, resolveComponentVariant } from "@/model/resolve";
import { uid } from "@/model/factory";
import type { Node } from "@/model/types";
import { docActions, useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";

// Internal clipboard for node subtrees (survives within the session).

let clipboard: { rootIds: string[]; nodes: Record<string, Node> } | null = null;

export function copySelection() {
  const project = useDocument.getState().project;
  const selection = useEditor.getState().selection;
  if (!project || selection.length === 0) return;
  const nodes: Record<string, Node> = {};
  const rootIds: string[] = [];
  for (const id of selection) {
    if (!project.nodes[id]?.parent) continue; // skip page roots
    const { rootId, nodes: cloned } = cloneSubtree(project.nodes, id, uid);
    Object.assign(nodes, cloned);
    rootIds.push(rootId);
  }
  if (rootIds.length > 0) clipboard = { rootIds, nodes };
}

export function cutSelection() {
  copySelection();
  docActions.deleteNodes(useEditor.getState().selection);
  useEditor.getState().clearSelection();
}

export function pasteClipboard() {
  const project = useDocument.getState().project;
  const s = useEditor.getState();
  if (!project || !clipboard) return;

  // paste into: selected frame, or parent of selection, or active page root
  let parentId: string | null = null;
  if (s.selection.length === 1) {
    const sel = project.nodes[s.selection[0]];
    if (sel?.type === "frame") parentId = sel.id;
    else if (sel?.parent) parentId = sel.parent;
  }
  if (!parentId) {
    const ctx = s.context;
    if (ctx?.kind === "page") parentId = project.pages.find((p) => p.id === ctx.pageId)?.rootId ?? null;
    else if (ctx?.kind === "component") {
      const component = project.components.find((c) => c.id === ctx.componentId);
      parentId = component ? resolveComponentVariant(component, s.breakpoint).rootId : null;
    }
  }
  if (!parentId) return;

  const newIds: string[] = [];
  for (const rootId of clipboard.rootIds) {
    const { rootId: newRoot, nodes } = cloneSubtree(clipboard.nodes, rootId, uid);
    const rootNode = nodes[newRoot];
    if (rootNode.styles.desktop.x !== undefined) {
      rootNode.styles.desktop = {
        ...rootNode.styles.desktop,
        x: (rootNode.styles.desktop.x ?? 0) + 20,
        y: (rootNode.styles.desktop.y ?? 0) + 20,
      };
    }
    docActions.insertSubtree(nodes, newRoot, parentId);
    newIds.push(newRoot);
  }
  if (newIds.length > 0) s.select(newIds);
}

export function hasClipboard() {
  return clipboard !== null;
}
