import { create } from "zustand";
import type { BreakpointId } from "@/model/types";

// ─────────────────────────────────────────────────────────────────────────────
// Editor UI state: selection, active page/breakpoint, canvas viewport, tool,
// panel tabs. Kept separate from the document so undo/redo never touches it.
// ─────────────────────────────────────────────────────────────────────────────

export type Tool = "select" | "frame" | "stack" | "text" | "image" | "hand";
export type LeftTab = "pages" | "layers" | "assets" | "cms" | "insert";
export type AppScreen = "picker" | "editor" | "preview";

/** Editing context: a page or a component master opened for editing */
export type EditContext = { kind: "page"; pageId: string } | { kind: "component"; componentId: string };

/** Click-to-pick an image from the Assets tab (fill background or image src). */
export type AssetPickTarget =
  | { kind: "fill"; nodeIds: string[]; bp: BreakpointId }
  | { kind: "image-src"; nodeIds: string[] };

interface EditorState {
  screen: AppScreen;
  context: EditContext | null;
  breakpoint: BreakpointId;

  selection: string[];
  hoveredId: string | null;
  editingTextId: string | null;
  /** normal = base styles, hover = edit hover-state overrides */
  propertyState: "normal" | "hover";

  tool: Tool;
  leftTab: LeftTab;
  insertOpen: boolean;

  /** When set, Assets tab is open and clicking an asset applies it to this target. */
  assetPick: AssetPickTarget | null;

  zoom: number;
  panX: number;
  panY: number;

  /** ids expanded in the layers tree */
  expanded: Set<string>;

  contextMenu: { x: number; y: number; nodeId: string | null } | null;
  publishState: { status: "idle" | "building" | "done" | "error"; message?: string };

  setScreen: (screen: AppScreen) => void;
  setContext: (context: EditContext | null) => void;
  setBreakpoint: (bp: BreakpointId) => void;
  select: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;
  setEditingText: (id: string | null) => void;
  setPropertyState: (state: "normal" | "hover") => void;
  setTool: (tool: Tool) => void;
  setLeftTab: (tab: LeftTab) => void;
  setInsertOpen: (open: boolean) => void;
  startAssetPick: (target: AssetPickTarget) => void;
  cancelAssetPick: () => void;
  setViewport: (zoom: number, panX: number, panY: number) => void;
  toggleExpanded: (id: string) => void;
  expandAll: (ids: string[]) => void;
  setContextMenu: (menu: EditorState["contextMenu"]) => void;
  setPublishState: (state: EditorState["publishState"]) => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  screen: "picker",
  context: null,
  breakpoint: "desktop",

  selection: [],
  hoveredId: null,
  editingTextId: null,
  propertyState: "normal",

  tool: "select",
  leftTab: "layers",
  insertOpen: false,
  assetPick: null,

  zoom: 0.6,
  panX: 120,
  panY: 80,

  expanded: new Set<string>(),

  contextMenu: null,
  publishState: { status: "idle" },

  setScreen: (screen) => set({ screen }),
  setContext: (context) => set({ context, selection: [], hoveredId: null, editingTextId: null, assetPick: null, propertyState: "normal" }),
  setBreakpoint: (breakpoint) => set({ breakpoint }),

  select: (ids, additive = false) => {
    if (additive) {
      const current = get().selection;
      const merged = [...current];
      for (const id of ids) {
        const idx = merged.indexOf(id);
        if (idx >= 0) merged.splice(idx, 1);
        else merged.push(id);
      }
      set({ selection: merged, editingTextId: null, assetPick: null });
    } else {
      set({ selection: ids, editingTextId: null, assetPick: null });
    }
  },

  clearSelection: () => set({ selection: [], editingTextId: null, assetPick: null }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setEditingText: (editingTextId) => set({ editingTextId }),
  setPropertyState: (propertyState) => set({ propertyState }),
  setTool: (tool) => set({ tool, assetPick: null }),
  setLeftTab: (leftTab) => {
    // Leaving Assets while picking cancels the pick.
    const assetPick = get().assetPick && leftTab !== "assets" ? null : get().assetPick;
    set({ leftTab, insertOpen: false, assetPick });
  },
  setInsertOpen: (insertOpen) => set({ insertOpen }),
  startAssetPick: (target) => set({ assetPick: target, leftTab: "assets", insertOpen: false }),
  cancelAssetPick: () => set({ assetPick: null }),
  setViewport: (zoom, panX, panY) => set({ zoom, panX, panY }),

  toggleExpanded: (id) => {
    const expanded = new Set(get().expanded);
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    set({ expanded });
  },

  expandAll: (ids) => {
    const expanded = new Set(get().expanded);
    for (const id of ids) expanded.add(id);
    set({ expanded });
  },

  setContextMenu: (contextMenu) => set({ contextMenu }),
  setPublishState: (publishState) => set({ publishState }),
}));
