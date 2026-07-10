import { useEffect, useLayoutEffect, useRef } from "react";
import { useEditor } from "@/store/editor";

export type PreviewWidthMode = "full" | "desktop" | "tablet" | "phone" | "custom";

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || !!el?.isContentEditable;
}

/** Global preview keyboard shortcuts — registered while preview is active. */
export function usePreviewShortcuts(opts: {
  setWidthMode: (mode: PreviewWidthMode) => void;
  refreshPreview: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { setWidthMode, refreshPreview } = opts;

  // Focus once on enter so keyboard shortcuts work even before the first click.
  useLayoutEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        useEditor.getState().setScreen("editor");
        return;
      }

      if (isTypingTarget(e.target)) return;
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;

      if (e.code === "KeyR") {
        e.preventDefault();
        e.stopImmediatePropagation();
        refreshPreview();
        return;
      }

      const widthByDigit: Record<string, PreviewWidthMode> = {
        Digit1: "full",
        Digit2: "desktop",
        Digit3: "tablet",
        Digit4: "phone",
      };
      const nextWidth = widthByDigit[e.code];
      if (nextWidth) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setWidthMode(nextWidth);
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [refreshPreview, setWidthMode]);

  return rootRef;
}
