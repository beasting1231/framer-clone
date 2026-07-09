import { useEffect } from "react";
import { useDocument, docActions } from "@/store/document";
import { useEditor } from "@/store/editor";
import { Canvas } from "@/canvas/Canvas";
import { Toolbar } from "./Toolbar";
import { LeftPanel } from "./LeftPanel";
import { TimelinePanel } from "./TimelinePanel";
import { PropertiesPanel } from "@/properties/PropertiesPanel";
import { copySelection, cutSelection, pasteClipboard } from "@/canvas/clipboard";

export function EditorShell() {
  useKeyboardShortcuts();
  return (
    <div className="app">
      <Toolbar />
      <div className="editor-body">
        <LeftPanel />
        <Canvas />
        <PropertiesPanel />
      </div>
      <TimelinePanel />
    </div>
  );
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      if (s.screen !== "editor") return;

      const target = e.target as HTMLElement;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      const doc = useDocument.getState();
      const project = doc.project;
      if (!project) return;

      if (typing) {
        // allow undo/redo from inputs to hit the browser default
        return;
      }

      // ── undo / redo
      if (mod && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) doc.redo();
        else doc.undo();
        return;
      }

      // ── clipboard
      if (mod && e.key === "c") {
        copySelection();
        return;
      }
      if (mod && e.key === "x") {
        cutSelection();
        return;
      }
      if (mod && e.key === "v") {
        pasteClipboard();
        return;
      }
      if (mod && e.key === "d") {
        e.preventDefault();
        const ids = docActions.duplicateNodes(s.selection);
        if (ids.length > 0) s.select(ids);
        return;
      }

      // ── grouping / components
      if (mod && e.key === "Enter") {
        e.preventDefault();
        const id = docActions.wrapInStack(s.selection);
        if (id) s.select([id]);
        return;
      }
      if (mod && e.key === "k") {
        e.preventDefault();
        if (s.selection.length === 1) docActions.createComponent(s.selection[0]);
        return;
      }

      // ── z-order
      if (mod && (e.key === "]" || e.key === "[")) {
        e.preventDefault();
        for (const id of s.selection) {
          const node = project.nodes[id];
          const parent = node?.parent ? project.nodes[node.parent] : null;
          if (!parent) continue;
          const idx = parent.children.indexOf(id);
          if (e.key === "]" && idx < parent.children.length - 1) docActions.reorderChild(parent.id, idx, idx + 1);
          if (e.key === "[" && idx > 0) docActions.reorderChild(parent.id, idx, idx - 1);
        }
        return;
      }

      // ── delete
      if (e.key === "Backspace" || e.key === "Delete") {
        if (s.selection.length > 0) {
          e.preventDefault();
          docActions.deleteNodes(s.selection);
          s.clearSelection();
        }
        return;
      }

      // ── nudge
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && s.selection.length > 0) {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -delta : e.key === "ArrowRight" ? delta : 0;
        const dy = e.key === "ArrowUp" ? -delta : e.key === "ArrowDown" ? delta : 0;
        for (const id of s.selection) {
          const node = project.nodes[id];
          if (!node) continue;
          const styles = node.styles.desktop;
          if (styles.x !== undefined || styles.y !== undefined) {
            docActions.setStyles([id], s.breakpoint, { x: (styles.x ?? 0) + dx, y: (styles.y ?? 0) + dy });
          }
        }
        return;
      }

      // ── escape: cancel asset pick / go up / clear
      if (e.key === "Escape") {
        if (s.assetPick) {
          s.cancelAssetPick();
          return;
        }
        if (s.editingTextId) {
          s.setEditingText(null);
          return;
        }
        if (s.selection.length === 1) {
          const parent = project.nodes[s.selection[0]]?.parent;
          if (parent) {
            s.select([parent]);
            return;
          }
        }
        s.clearSelection();
        return;
      }

      // ── enter: drill into first child
      if (e.key === "Enter" && !mod && s.selection.length === 1) {
        const node = project.nodes[s.selection[0]];
        if (node && node.children.length > 0) {
          e.preventDefault();
          s.select([node.children[0]]);
        }
        return;
      }

      // ── tools
      if (!mod && !e.altKey) {
        if (e.key === "v") s.setTool("select");
        if (e.key === "f") s.setTool("frame");
        if (e.key === "s") s.setTool("stack");
        if (e.key === "t") s.setTool("text");
        if (e.key === "h") s.setTool("hand");
        if (e.key === "i") s.setLeftTab("insert");
        if (e.key === "1") s.setBreakpoint("desktop");
        if (e.key === "2") s.setBreakpoint("tablet");
        if (e.key === "3") s.setBreakpoint("phone");
        if (e.key === "0") {
          useEditor.setState({ zoom: 0.55, panX: 100, panY: 70 });
        }
        if (e.key === "=" || e.key === "+") {
          useEditor.setState({ zoom: Math.min(4, s.zoom * 1.25) });
        }
        if (e.key === "-") {
          useEditor.setState({ zoom: Math.max(0.05, s.zoom / 1.25) });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
