import { useEffect } from "react";
import { useEditor } from "@/store/editor";
import { useDocument } from "@/store/document";
import { ProjectPicker } from "@/ui/ProjectPicker";
import { EditorShell } from "@/ui/EditorShell";
import { ProductionPreviewMode } from "@/preview/ProductionPreviewMode";

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || !!el?.isContentEditable;
}

/** ⌥P toggles between editor and preview (works in both modes). */
function usePreviewToggle() {
  const screen = useEditor((s) => s.screen);
  useEffect(() => {
    if (screen !== "editor" && screen !== "preview") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || e.code !== "KeyP") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const s = useEditor.getState();
      s.setScreen(s.screen === "preview" ? "editor" : "preview");
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [screen]);
}

export default function App() {
  const screen = useEditor((s) => s.screen);
  const project = useDocument((s) => s.project);
  usePreviewToggle();

  if (screen === "picker" || !project) return <ProjectPicker />;
  if (screen === "preview") return <ProductionPreviewMode />;
  return <EditorShell />;
}
