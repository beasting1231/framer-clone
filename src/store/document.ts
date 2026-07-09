import { create } from "zustand";
import { api } from "@/api/client";
import { createPageRoot, createPage, uid } from "@/model/factory";
import { cloneSubtree, collectSubtree } from "@/model/resolve";
import { defaultValueFor, migrateAnimationClips, clipDuration, syncClipDuration } from "@/model/animation";
import type { BreakpointId, CmsCollection, CmsEntry, CmsField, ColorStyle, ComponentDef, Node, Page, SerializedProject, StyleProps, TextStyle, AnimEasing, AnimProperty, AnimKeyframe, AnimationClip } from "@/model/types";
import { nodeStyles } from "@/model/resolve";

// ─────────────────────────────────────────────────────────────────────────────
// Document store: holds the open project, mutation API, snapshot-based
// undo/redo, and debounced autosave to the local server (disk + codegen).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 100;
const AUTOSAVE_MS = 800;

type DocSlice = Pick<
  SerializedProject,
  "pages" | "homePageId" | "nodes" | "components" | "cms" | "assets" | "colorStyles" | "textStyles" | "animations"
>;

function snapshotOf(project: SerializedProject): DocSlice {
  return structuredClone({
    pages: project.pages,
    homePageId: project.homePageId,
    nodes: project.nodes,
    components: project.components,
    cms: project.cms,
    assets: project.assets,
    colorStyles: project.colorStyles,
    textStyles: project.textStyles,
    animations: project.animations ?? [],
  });
}

export type SaveState = "saved" | "saving" | "dirty" | "error";

interface DocumentState {
  project: SerializedProject | null;
  projectId: string | null;
  saveState: SaveState;
  undoStack: DocSlice[];
  redoStack: DocSlice[];

  // lifecycle
  open: (id: string, project: SerializedProject) => void;
  close: () => void;

  /**
   * Apply a mutation to the project. `commit` (default true) pushes an undo
   * snapshot before mutating — pass false for continuous gestures (drag),
   * then call `commitGesture` once with the pre-gesture snapshot.
   */
  mutate: (fn: (project: SerializedProject) => void, commit?: boolean) => void;
  beginGesture: () => DocSlice | null;
  commitGesture: (before: DocSlice | null) => void;
  undo: () => void;
  redo: () => void;
  flushSave: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savingPromise: Promise<void> | null = null;

async function persist(get: () => DocumentState, set: (partial: Partial<DocumentState>) => void) {
  const { project, projectId } = get();
  if (!project || !projectId) return;
  set({ saveState: "saving" });
  try {
    await api.saveProject(projectId, project);
    // only mark saved if nothing changed while saving
    if (get().saveState === "saving") set({ saveState: "saved" });
  } catch (err) {
    console.error("save failed", err);
    set({ saveState: "error" });
  }
}

function scheduleSave(get: () => DocumentState, set: (partial: Partial<DocumentState>) => void) {
  set({ saveState: "dirty" });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    savingPromise = persist(get, set);
  }, AUTOSAVE_MS);
}

export const useDocument = create<DocumentState>((set, get) => ({
  project: null,
  projectId: null,
  saveState: "saved",
  undoStack: [],
  redoStack: [],

  open: (id, project) => {
    if (saveTimer) clearTimeout(saveTimer);
    project.animations ??= []; // older projects predate timeline animations
    migrateAnimationClips(project.animations);
    set({ project, projectId: id, saveState: "saved", undoStack: [], redoStack: [] });
  },

  close: () => {
    if (saveTimer) clearTimeout(saveTimer);
    set({ project: null, projectId: null, undoStack: [], redoStack: [] });
  },

  mutate: (fn, commit = true) => {
    const { project, undoStack } = get();
    if (!project) return;
    const next = { ...project };
    if (commit) {
      const snap = snapshotOf(project);
      set({ undoStack: [...undoStack.slice(-MAX_HISTORY + 1), snap], redoStack: [] });
    }
    // shallow-copy top-level slices so React re-renders; fn mutates the copy
    next.pages = [...project.pages];
    next.nodes = { ...project.nodes };
    next.components = [...project.components];
    next.cms = { collections: [...project.cms.collections] };
    next.assets = [...project.assets];
    next.colorStyles = [...project.colorStyles];
    next.textStyles = [...project.textStyles];
    next.animations = (project.animations ?? []).map((c) => ({ ...c, tracks: c.tracks.map((t) => ({ ...t, keyframes: [...t.keyframes] })) }));
    fn(next);
    set({ project: next });
    scheduleSave(get, set);
  },

  beginGesture: () => {
    const { project } = get();
    return project ? snapshotOf(project) : null;
  },

  commitGesture: (before) => {
    if (!before) return;
    const { undoStack } = get();
    set({ undoStack: [...undoStack.slice(-MAX_HISTORY + 1), before], redoStack: [] });
  },

  undo: () => {
    const { project, undoStack, redoStack } = get();
    if (!project || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, snapshotOf(project)],
      project: { ...project, ...structuredClone(prev) },
    });
    scheduleSave(get, set);
  },

  redo: () => {
    const { project, undoStack, redoStack } = get();
    if (!project || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, snapshotOf(project)],
      project: { ...project, ...structuredClone(next) },
    });
    scheduleSave(get, set);
  },

  flushSave: async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      savingPromise = persist(get, set);
    }
    if (savingPromise) await savingPromise;
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Mutation helpers — the editor's document manipulation API. All go through
// useDocument.getState().mutate so they are undoable and autosaved.
// ─────────────────────────────────────────────────────────────────────────────

const doc = () => useDocument.getState();

export const docActions = {
  // ── nodes ──────────────────────────────────────────────────────────────────

  /** Insert a set of nodes (already wired parent/children among themselves) under a parent. */
  insertSubtree(nodes: Record<string, Node>, rootId: string, parentId: string, index?: number) {
    doc().mutate((p) => {
      Object.assign(p.nodes, structuredClone(nodes));
      const root = p.nodes[rootId];
      const parent = { ...p.nodes[parentId] };
      root.parent = parentId;
      const children = [...parent.children];
      children.splice(index ?? children.length, 0, rootId);
      parent.children = children;
      p.nodes[parentId] = parent;
    });
  },

  updateNode(id: string, patch: Partial<Node>, commit = true) {
    doc().mutate((p) => {
      p.nodes[id] = { ...p.nodes[id], ...patch };
    }, commit);
  },

  /** Set style properties at a breakpoint. Desktop writes base; others write overrides. */
  setStyles(ids: string[], bp: BreakpointId, patch: Partial<StyleProps>, commit = true) {
    doc().mutate((p) => {
      for (const id of ids) {
        const node = p.nodes[id];
        if (!node) continue;
        const styles = { ...node.styles };
        if (bp === "desktop") {
          styles.desktop = { ...styles.desktop, ...patch };
        } else {
          styles[bp] = { ...(styles[bp] ?? {}), ...patch };
        }
        p.nodes[id] = { ...node, styles };
      }
    }, commit);
  },

  /** Remove overrides for given keys at a non-desktop breakpoint (reset to inherited). */
  resetStyleOverride(ids: string[], bp: Exclude<BreakpointId, "desktop">, keys: (keyof StyleProps)[]) {
    doc().mutate((p) => {
      for (const id of ids) {
        const node = p.nodes[id];
        if (!node?.styles[bp]) continue;
        const overrides = { ...node.styles[bp] };
        for (const key of keys) delete overrides[key];
        p.nodes[id] = { ...node, styles: { ...node.styles, [bp]: overrides } };
      }
    });
  },

  deleteNodes(ids: string[]) {
    doc().mutate((p) => {
      for (const id of ids) {
        const node = p.nodes[id];
        if (!node) continue;
        // don't delete page roots or component roots
        if (p.pages.some((page) => page.rootId === id)) continue;
        if (p.components.some((c) => c.rootId === id)) continue;
        if (node.parent) {
          const parent = { ...p.nodes[node.parent] };
          parent.children = parent.children.filter((c) => c !== id);
          p.nodes[node.parent] = parent;
        }
        for (const subId of collectSubtree(p.nodes, id)) delete p.nodes[subId];
      }
    });
  },

  /** Move a node to a new parent at a given index. */
  reparent(id: string, newParentId: string, index: number, commit = true) {
    doc().mutate((p) => {
      const node = p.nodes[id];
      if (!node || id === newParentId) return;
      // prevent moving into own descendant
      let cursor: string | null = newParentId;
      while (cursor) {
        if (cursor === id) return;
        cursor = p.nodes[cursor]?.parent ?? null;
      }
      const oldParentId = node.parent;
      if (oldParentId) {
        const oldParent = { ...p.nodes[oldParentId] };
        const oldIndex = oldParent.children.indexOf(id);
        oldParent.children = oldParent.children.filter((c) => c !== id);
        p.nodes[oldParentId] = oldParent;
        if (oldParentId === newParentId && oldIndex < index) index -= 1;
      }
      const newParent = { ...p.nodes[newParentId] };
      const children = [...newParent.children];
      children.splice(Math.max(0, Math.min(index, children.length)), 0, id);
      newParent.children = children;
      p.nodes[newParentId] = newParent;
      p.nodes[id] = { ...node, parent: newParentId };
    }, commit);
  },

  reorderChild(parentId: string, from: number, to: number) {
    doc().mutate((p) => {
      const parent = { ...p.nodes[parentId] };
      const children = [...parent.children];
      const [moved] = children.splice(from, 1);
      children.splice(to, 0, moved);
      parent.children = children;
      p.nodes[parentId] = parent;
    });
  },

  duplicateNodes(ids: string[]): string[] {
    const newIds: string[] = [];
    doc().mutate((p) => {
      for (const id of ids) {
        const node = p.nodes[id];
        if (!node?.parent) continue;
        const { rootId, nodes } = cloneSubtree(p.nodes, id, uid);
        Object.assign(p.nodes, nodes);
        const clone = p.nodes[rootId];
        clone.parent = node.parent;
        clone.name = `${node.name} copy`;
        // offset absolute-positioned copies slightly
        if (clone.styles.desktop.x !== undefined) {
          clone.styles.desktop = { ...clone.styles.desktop, x: (clone.styles.desktop.x ?? 0) + 16, y: (clone.styles.desktop.y ?? 0) + 16 };
        }
        const parent = { ...p.nodes[node.parent] };
        const idx = parent.children.indexOf(id);
        const children = [...parent.children];
        children.splice(idx + 1, 0, rootId);
        parent.children = children;
        p.nodes[node.parent] = parent;
        newIds.push(rootId);
      }
    });
    return newIds;
  },

  /** Wrap nodes in a new stack frame (Framer's "wrap in stack" / group). */
  wrapInStack(ids: string[]): string | null {
    if (ids.length === 0) return null;
    let wrapperId: string | null = null;
    doc().mutate((p) => {
      const first = p.nodes[ids[0]];
      if (!first?.parent) return;
      const parentId = first.parent;
      const siblings = ids.filter((id) => p.nodes[id]?.parent === parentId);
      if (siblings.length === 0) return;
      const parent = { ...p.nodes[parentId] };
      const insertAt = Math.min(...siblings.map((id) => parent.children.indexOf(id)));

      const wrapper: Node = {
        id: uid(),
        type: "frame",
        name: "Stack",
        parent: parentId,
        children: [],
        tag: "div",
        styles: {
          desktop: {
            width: { mode: "fit" },
            height: { mode: "fit" },
            layout: "stack",
            direction: "column",
            gap: 12,
            align: "start",
            justify: "start",
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        },
      };
      // keep canvas position when wrapping absolute children
      const xs = siblings.map((id) => p.nodes[id].styles.desktop.x ?? 0);
      const ys = siblings.map((id) => p.nodes[id].styles.desktop.y ?? 0);
      wrapper.styles.desktop.x = Math.min(...xs);
      wrapper.styles.desktop.y = Math.min(...ys);

      p.nodes[wrapper.id] = wrapper;
      parent.children = parent.children.filter((c) => !siblings.includes(c));
      const children = [...parent.children];
      children.splice(Math.min(insertAt, children.length), 0, wrapper.id);
      parent.children = children;
      p.nodes[parentId] = parent;
      for (const id of siblings) {
        const child = { ...p.nodes[id] };
        child.parent = wrapper.id;
        const styles = { ...child.styles, desktop: { ...child.styles.desktop } };
        delete styles.desktop.x;
        delete styles.desktop.y;
        child.styles = styles;
        p.nodes[id] = child;
        wrapper.children.push(id);
      }
      wrapperId = wrapper.id;
    });
    return wrapperId;
  },

  // ── pages ──────────────────────────────────────────────────────────────────

  addPage(name: string, pathStr: string): Page | null {
    let page: Page | null = null;
    doc().mutate((p) => {
      const root = createPageRoot(name);
      p.nodes[root.id] = root;
      page = createPage(name, pathStr, root.id);
      p.pages.push(page);
    });
    return page;
  },

  updatePage(id: string, patch: Partial<Page>) {
    doc().mutate((p) => {
      p.pages = p.pages.map((page) => (page.id === id ? { ...page, ...patch } : page));
    });
  },

  deletePage(id: string) {
    doc().mutate((p) => {
      if (p.pages.length <= 1) return;
      const page = p.pages.find((pg) => pg.id === id);
      if (!page) return;
      for (const subId of collectSubtree(p.nodes, page.rootId)) delete p.nodes[subId];
      p.pages = p.pages.filter((pg) => pg.id !== id);
      p.animations = (p.animations ?? []).filter((c) => c.pageId !== id);
      if (p.homePageId === id) p.homePageId = p.pages[0].id;
    });
  },

  duplicatePage(id: string): Page | null {
    let newPage: Page | null = null;
    doc().mutate((p) => {
      const page = p.pages.find((pg) => pg.id === id);
      if (!page) return;
      const { rootId, nodes } = cloneSubtree(p.nodes, page.rootId, uid);
      Object.assign(p.nodes, nodes);
      const basePath = page.path === "/" ? "/copy" : `${page.path}-copy`;
      let pathStr = basePath;
      let n = 2;
      while (p.pages.some((pg) => pg.path === pathStr)) pathStr = `${basePath}-${n++}`;
      newPage = { ...page, id: uid(), name: `${page.name} copy`, path: pathStr, rootId };
      p.pages.push(newPage);
    });
    return newPage;
  },

  // ── components ────────────────────────────────────────────────────────────

  /** Turn a node into a component: master goes to library, node becomes an instance. */
  createComponent(nodeId: string): ComponentDef | null {
    let def: ComponentDef | null = null;
    doc().mutate((p) => {
      const node = p.nodes[nodeId];
      if (!node || node.type === "instance" || !node.parent) return;
      // clone the subtree as the master (detached from any page)
      const { rootId, nodes } = cloneSubtree(p.nodes, nodeId, uid);
      Object.assign(p.nodes, structuredClone(nodes));
      const master = p.nodes[rootId];
      master.parent = null;
      // masters shouldn't carry canvas coordinates
      const masterStyles = { ...master.styles, desktop: { ...master.styles.desktop } };
      delete masterStyles.desktop.x;
      delete masterStyles.desktop.y;
      master.styles = masterStyles;

      def = { id: uid(), name: node.name, rootId };
      p.components.push(def);

      // replace original node with an instance
      const instance: Node = {
        id: node.id,
        type: "instance",
        name: node.name,
        parent: node.parent,
        children: [],
        componentId: def.id,
        overrides: {},
        styles: {
          desktop: {
            x: node.styles.desktop.x,
            y: node.styles.desktop.y,
            width: node.styles.desktop.width,
            height: node.styles.desktop.height,
          },
        },
      };
      // remove old subtree except the node itself (children move to master clone)
      for (const subId of collectSubtree(p.nodes, node.id)) {
        if (subId !== node.id) delete p.nodes[subId];
      }
      p.nodes[node.id] = instance;
    });
    return def;
  },

  renameComponent(id: string, name: string) {
    doc().mutate((p) => {
      p.components = p.components.map((c) => (c.id === id ? { ...c, name } : c));
    });
  },

  deleteComponent(id: string) {
    doc().mutate((p) => {
      const comp = p.components.find((c) => c.id === id);
      if (!comp) return;
      // detach instances into empty frames
      for (const node of Object.values(p.nodes)) {
        if (node.type === "instance" && node.componentId === id) {
          p.nodes[node.id] = { ...node, type: "frame", componentId: undefined, overrides: undefined, tag: "div" };
        }
      }
      for (const subId of collectSubtree(p.nodes, comp.rootId)) delete p.nodes[subId];
      p.components = p.components.filter((c) => c.id !== id);
    });
  },

  setInstanceOverride(instanceId: string, masterNodeId: string, patch: Record<string, unknown>) {
    doc().mutate((p) => {
      const node = p.nodes[instanceId];
      if (!node) return;
      const overrides = { ...(node.overrides ?? {}) };
      overrides[masterNodeId] = { ...(overrides[masterNodeId] ?? {}), ...patch };
      p.nodes[instanceId] = { ...node, overrides };
    });
  },

  // ── CMS ────────────────────────────────────────────────────────────────────

  addCollection(name: string): CmsCollection | null {
    let coll: CmsCollection | null = null;
    doc().mutate((p) => {
      coll = {
        id: uid(),
        name,
        fields: [
          { id: uid(), name: "Title", type: "text" },
          { id: uid(), name: "Image", type: "image" },
          { id: uid(), name: "Summary", type: "text" },
        ],
        entries: [],
      };
      p.cms.collections.push(coll);
    });
    return coll;
  },

  updateCollection(id: string, patch: Partial<CmsCollection>) {
    doc().mutate((p) => {
      p.cms.collections = p.cms.collections.map((c) => (c.id === id ? { ...c, ...patch } : c));
    });
  },

  deleteCollection(id: string) {
    doc().mutate((p) => {
      p.cms.collections = p.cms.collections.filter((c) => c.id !== id);
      p.pages = p.pages.filter((pg) => !(pg.kind === "cms-template" && pg.collectionId === id));
    });
  },

  addField(collectionId: string, field: Omit<CmsField, "id">): CmsField | null {
    let created: CmsField | null = null;
    doc().mutate((p) => {
      created = { ...field, id: uid() };
      p.cms.collections = p.cms.collections.map((c) =>
        c.id === collectionId ? { ...c, fields: [...c.fields, created!] } : c,
      );
    });
    return created;
  },

  updateField(collectionId: string, fieldId: string, patch: Partial<CmsField>) {
    doc().mutate((p) => {
      p.cms.collections = p.cms.collections.map((c) =>
        c.id === collectionId
          ? { ...c, fields: c.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) }
          : c,
      );
    });
  },

  deleteField(collectionId: string, fieldId: string) {
    doc().mutate((p) => {
      p.cms.collections = p.cms.collections.map((c) =>
        c.id === collectionId ? { ...c, fields: c.fields.filter((f) => f.id !== fieldId) } : c,
      );
    });
  },

  addEntry(collectionId: string): CmsEntry | null {
    let entry: CmsEntry | null = null;
    doc().mutate((p) => {
      const coll = p.cms.collections.find((c) => c.id === collectionId);
      if (!coll) return;
      const n = coll.entries.length + 1;
      entry = { id: uid(), slug: `entry-${n}`, values: {} };
      for (const f of coll.fields) {
        if (f.type === "text") entry.values[f.id] = f.name === "Title" ? `Entry ${n}` : "";
      }
      p.cms.collections = p.cms.collections.map((c) =>
        c.id === collectionId ? { ...c, entries: [...c.entries, entry!] } : c,
      );
    });
    return entry;
  },

  updateEntry(collectionId: string, entryId: string, patch: Partial<CmsEntry>) {
    doc().mutate((p) => {
      p.cms.collections = p.cms.collections.map((c) =>
        c.id === collectionId
          ? { ...c, entries: c.entries.map((e) => (e.id === entryId ? { ...e, ...patch, values: { ...e.values, ...(patch.values ?? {}) } } : e)) }
          : c,
      );
    });
  },

  deleteEntry(collectionId: string, entryId: string) {
    doc().mutate((p) => {
      p.cms.collections = p.cms.collections.map((c) =>
        c.id === collectionId ? { ...c, entries: c.entries.filter((e) => e.id !== entryId) } : c,
      );
    });
  },

  // ── shared styles & assets ────────────────────────────────────────────────

  addColorStyle(name: string, color: string): ColorStyle | null {
    let style: ColorStyle | null = null;
    doc().mutate((p) => {
      style = { id: uid(), name, color };
      p.colorStyles.push(style);
    });
    return style;
  },

  updateColorStyle(id: string, patch: Partial<ColorStyle>) {
    doc().mutate((p) => {
      p.colorStyles = p.colorStyles.map((c) => (c.id === id ? { ...c, ...patch } : c));
    });
  },

  deleteColorStyle(id: string) {
    doc().mutate((p) => {
      p.colorStyles = p.colorStyles.filter((c) => c.id !== id);
    });
  },

  addTextStyle(style: Omit<TextStyle, "id">): TextStyle | null {
    let created: TextStyle | null = null;
    doc().mutate((p) => {
      created = { ...style, id: uid() };
      p.textStyles.push(created);
    });
    return created;
  },

  updateTextStyle(id: string, patch: Partial<TextStyle>) {
    doc().mutate((p) => {
      p.textStyles = p.textStyles.map((t) => (t.id === id ? { ...t, ...patch } : t));
    });
  },

  deleteTextStyle(id: string) {
    doc().mutate((p) => {
      p.textStyles = p.textStyles.filter((t) => t.id !== id);
    });
  },

  addAsset(meta: { name: string; file: string; width?: number; height?: number }) {
    doc().mutate((p) => {
      p.assets.push({ id: uid(), ...meta });
    });
  },

  deleteAsset(id: string) {
    doc().mutate((p) => {
      p.assets = p.assets.filter((a) => a.id !== id);
    });
  },

  // ── timeline animations ─────────────────────────────────────────────────────

  addClip(pageId: string, name: string): string {
    const id = uid();
    doc().mutate((p) => {
      (p.animations ??= []).push({ id, name, pageId, duration: 0, trigger: "load", appearViewport: 20, tracks: [] });
    });
    return id;
  },

  /** Import a clip built from section entrance effects (e.g. after inserting from the library). */
  addEntranceClip(clip: AnimationClip): string {
    doc().mutate((p) => {
      const names = new Set((p.animations ?? []).filter((c) => c.pageId === clip.pageId).map((c) => c.name));
      let name = clip.name;
      let n = 2;
      while (names.has(name)) {
        name = `${clip.name} (${n++})`;
      }
      (p.animations ??= []).push({ ...clip, name });
    });
    return clip.id;
  },

  updateClip(clipId: string, patch: Partial<Omit<AnimationClip, "id" | "tracks" | "duration">>) {
    doc().mutate((p) => {
      p.animations = (p.animations ?? []).map((c) => (c.id === clipId ? { ...c, ...patch } : c));
    });
  },

  deleteClip(clipId: string) {
    doc().mutate((p) => {
      p.animations = (p.animations ?? []).filter((c) => c.id !== clipId);
    });
  },

  /** Add a track with start/end keyframes seeded from the layer's current values. */
  addTrack(clipId: string, nodeId: string, property: AnimProperty): string {
    const id = uid();
    doc().mutate((p) => {
      const clip = (p.animations ?? []).find((c) => c.id === clipId);
      if (!clip) return;
      if (clip.tracks.some((t) => t.nodeId === nodeId && t.property === property)) return;
      const node = p.nodes[nodeId];
      const styles = node ? nodeStyles(node, p, "desktop") : null;
      const val = (() => {
        if (!styles) return defaultValueFor(property);
        switch (property) {
          case "x": return styles.x ?? 0;
          case "y": return styles.y ?? 0;
          case "rotate": return styles.rotation ?? 0;
          case "opacity": return styles.opacity ?? 1;
          case "blur": return styles.blur ?? 0;
          case "scale": return 1;
          default: return defaultValueFor(property);
        }
      })();
      const endTime = clipDuration(clip) > 0 ? clipDuration(clip) : 2000;
      clip.tracks.push({
        id,
        nodeId,
        property,
        keyframes: [
          { id: uid(), time: 0, value: val, easing: "ease-out" as AnimEasing },
          { id: uid(), time: endTime, value: val, easing: "ease-out" as AnimEasing },
        ],
      });
      syncClipDuration(clip);
    });
    return id;
  },

  deleteTrack(clipId: string, trackId: string) {
    doc().mutate((p) => {
      const clip = (p.animations ?? []).find((c) => c.id === clipId);
      if (!clip) return;
      clip.tracks = clip.tracks.filter((t) => t.id !== trackId);
      syncClipDuration(clip);
    });
  },

  duplicateTrack(clipId: string, trackId: string): string {
    const id = uid();
    doc().mutate((p) => {
      const clip = (p.animations ?? []).find((c) => c.id === clipId);
      const source = clip?.tracks.find((t) => t.id === trackId);
      if (!clip || !source) return;
      const copy = {
        id,
        nodeId: source.nodeId,
        property: source.property,
        keyframes: source.keyframes.map((kf) => ({ ...kf, id: uid() })),
      };
      const idx = clip.tracks.findIndex((t) => t.id === trackId);
      clip.tracks.splice(idx + 1, 0, copy);
      syncClipDuration(clip);
    });
    return id;
  },

  retargetTrack(clipId: string, trackId: string, nodeId: string) {
    doc().mutate((p) => {
      const clip = (p.animations ?? []).find((c) => c.id === clipId);
      const track = clip?.tracks.find((t) => t.id === trackId);
      if (!clip || !track || !p.nodes[nodeId]) return;
      track.nodeId = nodeId;
    });
  },

  reorderTrack(clipId: string, trackId: string, toIndex: number) {
    doc().mutate((p) => {
      const clip = (p.animations ?? []).find((c) => c.id === clipId);
      if (!clip) return;
      const from = clip.tracks.findIndex((t) => t.id === trackId);
      if (from < 0) return;
      const to = Math.max(0, Math.min(clip.tracks.length - 1, toIndex));
      if (from === to) return;
      const [track] = clip.tracks.splice(from, 1);
      clip.tracks.splice(to, 0, track);
    });
  },

  addKeyframe(clipId: string, trackId: string, time: number, value: number): string {
    const id = uid();
    doc().mutate((p) => {
      const clip = (p.animations ?? []).find((c) => c.id === clipId);
      const track = clip?.tracks.find((t) => t.id === trackId);
      if (!clip || !track) return;
      track.keyframes = [...track.keyframes, { id, time, value, easing: "ease-out" as AnimEasing }].sort((a, b) => a.time - b.time);
      syncClipDuration(clip);
    });
    return id;
  },

  updateKeyframe(clipId: string, trackId: string, kfId: string, patch: Partial<Omit<AnimKeyframe, "id">>, commit = true) {
    doc().mutate((p) => {
      const clip = (p.animations ?? []).find((c) => c.id === clipId);
      const track = clip?.tracks.find((t) => t.id === trackId);
      if (!clip || !track) return;
      track.keyframes = track.keyframes
        .map((k) => (k.id === kfId ? { ...k, ...patch, time: Math.max(0, patch.time ?? k.time) } : k))
        .sort((a, b) => a.time - b.time);
      syncClipDuration(clip);
    }, commit);
  },

  deleteKeyframes(clipId: string, refs: { trackId: string; kfId: string }[]) {
    if (refs.length === 0) return;
    doc().mutate((p) => {
      const clip = (p.animations ?? []).find((c) => c.id === clipId);
      if (!clip) return;
      const remove = new Set(refs.map((r) => `${r.trackId}:${r.kfId}`));
      for (const track of clip.tracks) {
        track.keyframes = track.keyframes.filter((k) => !remove.has(`${track.id}:${k.id}`));
      }
      syncClipDuration(clip);
    });
  },

  updateKeyframes(
    clipId: string,
    updates: { trackId: string; kfId: string; patch: Partial<Omit<AnimKeyframe, "id">> }[],
    commit = true,
  ) {
    if (updates.length === 0) return;
    doc().mutate((p) => {
      const clip = (p.animations ?? []).find((c) => c.id === clipId);
      if (!clip) return;
      const byTrack = new Map<string, Map<string, Partial<Omit<AnimKeyframe, "id">>>>();
      for (const { trackId, kfId, patch } of updates) {
        if (!byTrack.has(trackId)) byTrack.set(trackId, new Map());
        byTrack.get(trackId)!.set(kfId, patch);
      }
      for (const track of clip.tracks) {
        const patches = byTrack.get(track.id);
        if (!patches) continue;
        track.keyframes = track.keyframes
          .map((k) => {
            const patch = patches.get(k.id);
            if (!patch) return k;
            return { ...k, ...patch, time: Math.max(0, patch.time ?? k.time) };
          })
          .sort((a, b) => a.time - b.time);
      }
      syncClipDuration(clip);
    }, commit);
  },

  deleteKeyframe(clipId: string, trackId: string, kfId: string) {
    doc().mutate((p) => {
      const clip = (p.animations ?? []).find((c) => c.id === clipId);
      const track = clip?.tracks.find((t) => t.id === trackId);
      if (!clip || !track) return;
      track.keyframes = track.keyframes.filter((k) => k.id !== kfId);
      syncClipDuration(clip);
    });
  },
};
