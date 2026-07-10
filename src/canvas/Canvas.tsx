import { useCallback, useEffect, useRef, useState } from "react";
import { BREAKPOINTS, type BreakpointId, type Node } from "@/model/types";
import { nodeStyles, ancestorChain, componentVariants, resolveComponentVariant } from "@/model/resolve";
import { createFrame, createStack, createText, createImage, px } from "@/model/factory";
import { docActions, useDocument } from "@/store/document";
import { useTimeline } from "@/store/timeline";
import { useEditor } from "@/store/editor";
import { useCodexChat } from "@/store/codexChat";
import { ArtboardContent } from "./CanvasRenderer";
import { Overlays, type InteractionVisuals } from "./Overlays";
import { CanvasContextMenu } from "./ContextMenu";
import { insertTemplate, isSectionTemplate, type TemplateId } from "@/insert/templates";
import {
  ARTBOARD_GAP,
  artboardX,
  computeSnapping,
  elementRect,
  findNodeElement,
  rectsIntersect,
  screenToWorld,
  type Rect,
} from "./geometry";

// ─────────────────────────────────────────────────────────────────────────────
// The infinite canvas: renders one artboard per breakpoint for the active
// page (or a single artboard for a component master) and implements all
// mouse interactions.
// ─────────────────────────────────────────────────────────────────────────────

type Gesture =
  | { type: "pan"; startX: number; startY: number; panX: number; panY: number }
  | {
      type: "maybe-move";
      startX: number;
      startY: number;
      nodeId: string;
      additive: boolean;
      wasSelected: boolean;
    }
  | {
      type: "move";
      startX: number;
      startY: number;
      ids: string[];
      /** starting x/y per node (absolute movers) */
      starts: Map<string, { x: number; y: number }>;
      absolute: boolean;
      snapTargets: Rect[];
      before: ReturnType<typeof useDocument.getState>["beginGesture"] extends () => infer R ? R : never;
      dropParent: string | null;
      dropIndex: number;
    }
  | {
      type: "resize";
      startX: number;
      startY: number;
      nodeId: string;
      handle: string;
      startRect: Rect; // world
      startStyles: { x?: number; y?: number; w: number; h: number };
      before: unknown;
    }
  | { type: "marquee"; startX: number; startY: number }
  | { type: "draw"; startX: number; startY: number; tool: "frame" | "stack" | "text" | "image" };

export function Canvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const spaceDown = useRef(false);
  const backquoteDown = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [visuals, setVisuals] = useState<InteractionVisuals>({});
  const [contextTargetId, setContextTargetId] = useState<string | null>(null);

  const project = useDocument((s) => s.project);
  const projectId = useDocument((s) => s.projectId);
  const context = useEditor((s) => s.context);
  const zoom = useEditor((s) => s.zoom);
  const panX = useEditor((s) => s.panX);
  const panY = useEditor((s) => s.panY);
  const tool = useEditor((s) => s.tool);
  const breakpoint = useEditor((s) => s.breakpoint);

  // ── resolve what we're editing
  const page = context?.kind === "page" ? project?.pages.find((p) => p.id === context.pageId) : null;
  const component = context?.kind === "component" ? project?.components.find((c) => c.id === context.componentId) : null;
  const componentVariant = component ? resolveComponentVariant(component, breakpoint) : null;
  const rootId = page?.rootId ?? componentVariant?.rootId ?? null;

  // ── space key panning
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (useTimeline.getState().open) return;
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target as HTMLElement).isContentEditable) {
        spaceDown.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (useTimeline.getState().open) return;
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Holding ` turns the next canvas click into explicit Codex context.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Backquote" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
      backquoteDown.current = true;
      const point = lastPointer.current;
      const element = point ? document.elementFromPoint(point.x, point.y) as HTMLElement | null : null;
      setContextTargetId(element?.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId ?? null);
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Backquote") {
        backquoteDown.current = false;
        setContextTargetId(null);
      }
    };
    const reset = () => {
      backquoteDown.current = false;
      setContextTargetId(null);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
    };
  }, []);

  // ── wheel: pan / zoom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useEditor.getState();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = Math.exp(-e.deltaY * 0.01);
        const newZoom = Math.min(4, Math.max(0.05, s.zoom * factor));
        const wx = (mx - s.panX) / s.zoom;
        const wy = (my - s.panY) / s.zoom;
        s.setViewport(newZoom, mx - wx * newZoom, my - wy * newZoom);
      } else {
        s.setViewport(s.zoom, s.panX - e.deltaX, s.panY - e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── helpers ────────────────────────────────────────────────────────────────

  const hitChain = useCallback(
    (target: Element | null): string[] => {
      const chain: string[] = [];
      let el: Element | null = target;
      while (el && el !== viewportRef.current) {
        const id = (el as HTMLElement).dataset?.nodeId;
        if (id && !chain.includes(id)) chain.push(id);
        el = el.parentElement;
      }
      return chain; // deepest → root
    },
    [],
  );

  const artboardBpFromTarget = (target: Element | null): BreakpointId | null => {
    const el = (target as HTMLElement)?.closest?.("[data-artboard]") as HTMLElement | null;
    return (el?.dataset.artboard as BreakpointId) ?? null;
  };

  /** Pick the node to select from a hit chain, honoring drill-down. */
  const pickCandidate = (chain: string[], selection: string[]): string | null => {
    if (!project || !rootId || chain.length === 0) return null;
    // chain is deepest→root; drop everything above root
    const rootIdx = chain.indexOf(rootId);
    const usable = rootIdx >= 0 ? chain.slice(0, rootIdx) : chain;
    if (usable.length === 0) return rootId;
    // deepest selected ancestor in the chain → select its child on the chain
    const selectedSet = new Set(selection);
    for (let i = 0; i < usable.length; i++) {
      if (selectedSet.has(usable[i])) return usable[i];
    }
    // check if any selected node is an ancestor: then pick child one below it
    for (let i = usable.length - 1; i >= 0; i--) {
      const parentOfI = project.nodes[usable[i]]?.parent;
      if (parentOfI && selectedSet.has(parentOfI)) return usable[i];
    }
    // ancestors of selection allow deeper picks: if selection lives inside same top-level section, go one deeper than the shared ancestor
    if (selection.length > 0) {
      const selChain = ancestorChain(project.nodes, selection[0]);
      const selSet = new Set(selChain);
      for (let i = 0; i < usable.length - 1; i++) {
        if (selSet.has(usable[i + 1])) return usable[i];
      }
    }
    return usable[usable.length - 1]; // top-level child of root
  };

  const worldRectOf = (id: string, bp: BreakpointId): Rect | null => {
    const vp = viewportRef.current;
    if (!vp) return null;
    const el = findNodeElement(vp, bp, id);
    if (!el) return null;
    const r = elementRect(el, vp);
    const s = useEditor.getState();
    return { x: (r.x - s.panX) / s.zoom, y: (r.y - s.panY) / s.zoom, w: r.w / s.zoom, h: r.h / s.zoom };
  };

  /** Find drop container under cursor, excluding a dragged subtree. */
  const dropTargetAt = (clientX: number, clientY: number, excludeIds: Set<string>): { parentId: string; bp: BreakpointId } | null => {
    if (!project || !rootId) return null;
    const els = document.elementsFromPoint(clientX, clientY);
    for (const el of els) {
      const id = (el as HTMLElement).dataset?.nodeId;
      if (!id || excludeIds.has(id)) continue;
      // must not be inside the dragged subtree
      const chain = ancestorChain(project.nodes, id);
      if (chain.some((a) => excludeIds.has(a))) continue;
      const node = project.nodes[id];
      if (!node) continue;
      const bp = artboardBpFromTarget(el);
      if (!bp) continue;
      if (node.type === "frame" || id === rootId) {
        if (node.tag === "input" || node.tag === "textarea") continue;
        return { parentId: id, bp };
      }
    }
    // fallback: artboard body
    for (const el of els) {
      const bp = (el as HTMLElement).dataset?.artboard as BreakpointId | undefined;
      if (bp) return { parentId: rootId, bp };
    }
    return null;
  };

  /** Resolve the frame whose background should receive a dragged asset.
   * Prefer a selected frame under the pointer, including the page root, so a
   * background-fill gesture can never fall through and insert a size-changing
   * image child. Empty, unselected artboard space still creates an image layer. */
  const assetFillTargetAt = (clientX: number, clientY: number): { nodeId: string; bp: BreakpointId } | null => {
    if (!project || !rootId) return null;
    const elements = document.elementsFromPoint(clientX, clientY);
    const selected = new Set(useEditor.getState().selection);
    const resolveElement = (element: Element, selectedOnly: boolean) => {
      const nodeId = (element as HTMLElement).dataset?.nodeId;
      if (!nodeId || (selectedOnly && !selected.has(nodeId)) || (!selectedOnly && nodeId === rootId)) return null;
      const node = project.nodes[nodeId];
      // Component instances deliberately remap all of their internal DOM back
      // to the instance id. Treat the instance itself as the precise fill
      // target instead of skipping it and falling through to an outer frame.
      if (!node || (node.type !== "frame" && node.type !== "instance") || node.tag === "input" || node.tag === "textarea") return null;
      const bp = artboardBpFromTarget(element);
      return bp ? { nodeId, bp } : null;
    };
    for (const element of elements) {
      const target = resolveElement(element, true);
      if (target) return target;
    }
    for (const element of elements) {
      const target = resolveElement(element, false);
      if (target) return target;
    }
    return null;
  };

  /** Insertion index within a stack/grid container based on cursor. */
  const insertionIndex = (parentId: string, bp: BreakpointId, clientX: number, clientY: number, excludeIds: Set<string>): number => {
    if (!project) return 0;
    const parent = project.nodes[parentId];
    const props = nodeStyles(parent, project, bp);
    const horizontal = props.layout === "grid" ? true : props.direction === "row";
    const vp = viewportRef.current!;
    const vpRect = vp.getBoundingClientRect();
    const cx = clientX - vpRect.left;
    const cy = clientY - vpRect.top;
    let index = 0;
    for (const childId of parent.children) {
      if (excludeIds.has(childId)) continue;
      const childNode = project.nodes[childId];
      const cs = nodeStyles(childNode, project, bp);
      if (cs.positionAbsolute) continue;
      const el = findNodeElement(vp, bp, childId);
      if (!el) continue;
      const r = elementRect(el, vp);
      const mid = horizontal && props.layout !== "grid" ? r.x + r.w / 2 : props.layout === "grid" ? 0 : r.y + r.h / 2;
      if (props.layout === "grid") {
        // grid: order by proximity — insert before child whose center is after cursor
        const centerX = r.x + r.w / 2;
        const centerY = r.y + r.h / 2;
        if (cy < centerY - r.h / 2 || (cy < centerY + r.h / 2 && cx < centerX)) return index;
      } else if (horizontal ? cx < mid : cy < mid) {
        return index;
      }
      index++;
    }
    return index;
  };

  const insertLineFor = (parentId: string, bp: BreakpointId, index: number, excludeIds: Set<string>): Rect | null => {
    if (!project) return null;
    const vp = viewportRef.current!;
    const parent = project.nodes[parentId];
    const props = nodeStyles(parent, project, bp);
    if (props.layout !== "stack" && props.layout !== "grid") return null;
    const horizontal = props.direction === "row" && props.layout === "stack";
    const children = parent.children.filter((c) => !excludeIds.has(c) && !nodeStyles(project.nodes[c], project, bp).positionAbsolute);
    const parentEl = findNodeElement(vp, bp, parentId);
    if (!parentEl) return null;
    const pr = elementRect(parentEl, vp);
    if (children.length === 0) {
      return horizontal ? { x: pr.x + 8, y: pr.y + 4, w: 3, h: pr.h - 8 } : { x: pr.x + 4, y: pr.y + 8, w: pr.w - 8, h: 3 };
    }
    const targetChild = children[Math.min(index, children.length - 1)];
    const el = findNodeElement(vp, bp, targetChild);
    if (!el) return null;
    const r = elementRect(el, vp);
    const after = index >= children.length;
    if (horizontal) {
      const x = after ? r.x + r.w + 2 : r.x - 4;
      return { x, y: r.y, w: 3, h: r.h };
    }
    const y = after ? r.y + r.h + 2 : r.y - 4;
    return { x: r.x, y, w: r.w, h: 3 };
  };

  // ── mouse handlers ─────────────────────────────────────────────────────────

  const onMouseDown = (e: React.MouseEvent) => {
    const vp = viewportRef.current;
    if (!vp || !project || !rootId) return;
    useEditor.getState().setContextMenu(null);
    if (e.button === 2) return; // context menu handled separately

    const s = useEditor.getState();
    const vpRect = vp.getBoundingClientRect();
    const sx = e.clientX - vpRect.left;
    const sy = e.clientY - vpRect.top;

    // panning
    if (e.button === 1 || spaceDown.current || tool === "hand") {
      gesture.current = { type: "pan", startX: e.clientX, startY: e.clientY, panX: s.panX, panY: s.panY };
      return;
    }

    // set active breakpoint from clicked artboard
    const bp = artboardBpFromTarget(e.target as Element);
    if (bp && bp !== s.breakpoint) s.setBreakpoint(bp);

    // drawing tools
    if (tool === "frame" || tool === "stack" || tool === "text" || tool === "image") {
      gesture.current = { type: "draw", startX: e.clientX, startY: e.clientY, tool };
      return;
    }

    // text editing passthrough
    if ((e.target as HTMLElement).isContentEditable) return;
    if (s.editingTextId) s.setEditingText(null);

    if (backquoteDown.current && projectId) {
      const nodeId = hitChain(e.target as Element)[0];
      const node = nodeId ? project.nodes[nodeId] : null;
      if (node) {
        const component = node.type === "instance" ? project.components.find((item) => item.id === node.componentId) : null;
        useCodexChat.getState().addContextNode(projectId, {
          id: node.id,
          label: component?.name || node.name || node.id,
        });
        window.dispatchEvent(new CustomEvent("framer:codex-context-added", { detail: { id: node.id, label: component?.name || node.name || node.id } }));
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    const retargetTrackId = useTimeline.getState().retargetTrackId;
    if (retargetTrackId) {
      const chain = hitChain(e.target as Element);
      const candidate = chain.length > 0 ? pickCandidate(chain, s.selection) : null;
      const clipId = useTimeline.getState().clipId;
      if (clipId && candidate && candidate !== rootId) {
        docActions.retargetTrack(clipId, retargetTrackId, candidate);
        useTimeline.getState().setRetargetTrack(null);
        useTimeline.getState().refresh();
        s.select([candidate]);
      }
      return;
    }

    const chain = hitChain(e.target as Element);
    if (chain.length === 0 || !bp) {
      // clicked empty canvas → marquee
      gesture.current = { type: "marquee", startX: e.clientX, startY: e.clientY };
      if (!e.shiftKey) s.clearSelection();
      setVisuals({ marquee: { x: sx, y: sy, w: 0, h: 0 } });
      return;
    }

    const candidate = pickCandidate(chain, s.selection);
    if (!candidate) return;
    const wasSelected = s.selection.includes(candidate);
    if (!wasSelected) s.select([candidate], e.shiftKey);
    gesture.current = {
      type: "maybe-move",
      startX: e.clientX,
      startY: e.clientY,
      nodeId: candidate,
      additive: e.shiftKey,
      wasSelected,
    };
  };

  const beginMove = (g: Extract<Gesture, { type: "maybe-move" }>) => {
    if (!project || !rootId) return null;
    const s = useEditor.getState();
    const ids = s.selection.filter((id) => id !== rootId && !project.nodes[id]?.locked);
    if (ids.length === 0) return null;
    const bp = s.breakpoint;
    const starts = new Map<string, { x: number; y: number }>();
    let allAbsolute = true;
    for (const id of ids) {
      const node = project.nodes[id];
      if (!node?.parent) {
        allAbsolute = false;
        continue;
      }
      const parentProps = nodeStyles(project.nodes[node.parent], project, bp);
      const own = nodeStyles(node, project, bp);
      const isAbs = (parentProps.layout ?? "absolute") === "absolute" || own.positionAbsolute;
      if (!isAbs) allAbsolute = false;
      starts.set(id, { x: own.x ?? 0, y: own.y ?? 0 });
    }
    // snap targets: siblings of the first moving node + parent bounds
    const snapTargets: Rect[] = [];
    const first = project.nodes[ids[0]];
    if (first?.parent) {
      const parent = project.nodes[first.parent];
      for (const sib of parent.children) {
        if (ids.includes(sib)) continue;
        const r = worldRectOf(sib, bp);
        if (r) snapTargets.push(r);
      }
      const pr = worldRectOf(first.parent, bp);
      if (pr) snapTargets.push(pr);
    }
    const before = useDocument.getState().beginGesture();
    return {
      type: "move" as const,
      startX: g.startX,
      startY: g.startY,
      ids,
      starts,
      absolute: allAbsolute,
      snapTargets,
      before,
      dropParent: null,
      dropIndex: 0,
    };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const vp = viewportRef.current;
    if (!vp || !project || !rootId) return;
    const g = gesture.current;
    const s = useEditor.getState();
    const vpRect = vp.getBoundingClientRect();
    const sx = e.clientX - vpRect.left;
    const sy = e.clientY - vpRect.top;
    lastPointer.current = { x: e.clientX, y: e.clientY };

    if (!g) {
      const chain = hitChain(e.target as Element);
      if (backquoteDown.current) {
        setContextTargetId(chain[0] ?? null);
        return;
      }
      // hover highlight
      const candidate = chain.length > 0 ? pickCandidate(chain, s.selection) : null;
      if (candidate !== s.hoveredId) s.setHovered(candidate);
      return;
    }

    if (g.type === "pan") {
      s.setViewport(s.zoom, g.panX + (e.clientX - g.startX), g.panY + (e.clientY - g.startY));
      return;
    }

    if (g.type === "maybe-move") {
      if (Math.abs(e.clientX - g.startX) + Math.abs(e.clientY - g.startY) > 4) {
        const move = beginMove(g);
        gesture.current = move ?? null;
      }
      return;
    }

    if (g.type === "move") {
      const dx = (e.clientX - g.startX) / s.zoom;
      const dy = (e.clientY - g.startY) / s.zoom;
      const excluded = new Set(g.ids);

      if (g.absolute) {
        // snap using the first node's rect
        const firstId = g.ids[0];
        const start = g.starts.get(firstId)!;
        const curRect = worldRectOf(firstId, s.breakpoint);
        let snapDx = 0;
        let snapDy = 0;
        let guides: InteractionVisuals["guides"] = [];
        if (curRect) {
          const proposed = { ...curRect, x: curRect.x, y: curRect.y };
          // rect if we applied raw delta from starts:
          const el = findNodeElement(vp, s.breakpoint, firstId);
          if (el) {
            const node = project.nodes[firstId];
            const own = nodeStyles(node, project, s.breakpoint);
            const shiftX = start.x + dx - (own.x ?? 0);
            const shiftY = start.y + dy - (own.y ?? 0);
            proposed.x = curRect.x + shiftX;
            proposed.y = curRect.y + shiftY;
          }
          const snap = computeSnapping(proposed, g.snapTargets, 6 / s.zoom);
          snapDx = snap.dx;
          snapDy = snap.dy;
          guides = snap.guides.map((gl) =>
            gl.axis === "v"
              ? { axis: "v" as const, x: gl.pos * s.zoom + s.panX, y: gl.from * s.zoom + s.panY, len: (gl.to - gl.from) * s.zoom }
              : { axis: "h" as const, x: gl.from * s.zoom + s.panX, y: gl.pos * s.zoom + s.panY, len: (gl.to - gl.from) * s.zoom },
          );
        }
        for (const id of g.ids) {
          const start = g.starts.get(id);
          if (!start) continue;
          docActions.setStyles([id], s.breakpoint, { x: Math.round(start.x + dx + snapDx), y: Math.round(start.y + dy + snapDy) }, false);
        }
        // check for potential reparent target (only when dragging a single node)
        let dropHighlight: Rect | undefined;
        if (g.ids.length === 1) {
          const target = dropTargetAt(e.clientX, e.clientY, excluded);
          const curParent = project.nodes[g.ids[0]]?.parent;
          if (target && target.parentId !== curParent) {
            g.dropParent = target.parentId;
            g.dropIndex = insertionIndex(target.parentId, target.bp, e.clientX, e.clientY, excluded);
            const el = findNodeElement(vp, target.bp, target.parentId);
            if (el) dropHighlight = elementRect(el, vp);
          } else {
            g.dropParent = null;
          }
        }
        setVisuals({ guides, dropHighlight });
      } else {
        // stack child: indicator-based move
        const target = dropTargetAt(e.clientX, e.clientY, excluded);
        if (target) {
          const targetProps = nodeStyles(project.nodes[target.parentId], project, target.bp);
          g.dropParent = target.parentId;
          if ((targetProps.layout ?? "absolute") === "absolute") {
            g.dropIndex = project.nodes[target.parentId].children.length;
            const el = findNodeElement(vp, target.bp, target.parentId);
            setVisuals({ dropHighlight: el ? elementRect(el, vp) : undefined });
          } else {
            g.dropIndex = insertionIndex(target.parentId, target.bp, e.clientX, e.clientY, excluded);
            const line = insertLineFor(target.parentId, target.bp, g.dropIndex, excluded);
            setVisuals({ insertLine: line ?? undefined });
          }
        } else {
          g.dropParent = null;
          setVisuals({});
        }
      }
      return;
    }

    if (g.type === "resize") {
      const dx = (e.clientX - g.startX) / s.zoom;
      const dy = (e.clientY - g.startY) / s.zoom;
      const { handle, startStyles, nodeId } = g;
      const patch: Record<string, unknown> = {};
      let w = startStyles.w;
      let h = startStyles.h;
      let x = startStyles.x;
      let y = startStyles.y;
      if (handle.includes("e")) w = Math.max(1, startStyles.w + dx);
      if (handle.includes("s")) h = Math.max(1, startStyles.h + dy);
      if (handle.includes("w")) {
        w = Math.max(1, startStyles.w - dx);
        if (x !== undefined) x = startStyles.x! + dx;
      }
      if (handle.includes("n")) {
        h = Math.max(1, startStyles.h - dy);
        if (y !== undefined) y = startStyles.y! + dy;
      }
      if (e.shiftKey) {
        const ratio = startStyles.w / Math.max(1, startStyles.h);
        if (handle.includes("e") || handle.includes("w")) h = w / ratio;
        else w = h * ratio;
      }
      if (handle.includes("e") || handle.includes("w")) patch.width = px(Math.round(w));
      if (handle.includes("n") || handle.includes("s")) patch.height = px(Math.round(h));
      if (x !== undefined && handle.includes("w")) patch.x = Math.round(x);
      if (y !== undefined && handle.includes("n")) patch.y = Math.round(y);
      docActions.setStyles([nodeId], s.breakpoint, patch, false);
      return;
    }

    if (g.type === "marquee") {
      const rect = {
        x: Math.min(g.startX, e.clientX) - vpRect.left,
        y: Math.min(g.startY, e.clientY) - vpRect.top,
        w: Math.abs(e.clientX - g.startX),
        h: Math.abs(e.clientY - g.startY),
      };
      setVisuals({ marquee: rect });
      // live-select top-level nodes intersecting the marquee (active bp artboard)
      const root = project.nodes[rootId];
      const hits: string[] = [];
      for (const childId of root.children) {
        const el = findNodeElement(vp, s.breakpoint, childId);
        if (!el) continue;
        if (rectsIntersect(rect, elementRect(el, vp))) hits.push(childId);
      }
      useEditor.setState({ selection: hits });
      return;
    }

    if (g.type === "draw") {
      const rect = {
        x: Math.min(g.startX, e.clientX) - vpRect.left,
        y: Math.min(g.startY, e.clientY) - vpRect.top,
        w: Math.abs(e.clientX - g.startX),
        h: Math.abs(e.clientY - g.startY),
      };
      setVisuals({ marquee: rect });
    }
  };

  const finishMove = (g: Extract<Gesture, { type: "move" }>, e: React.MouseEvent) => {
    const s = useEditor.getState();
    if (!project) return;
    if (g.absolute) {
      if (g.dropParent && g.ids.length === 1) {
        const id = g.ids[0];
        const targetProps = nodeStyles(project.nodes[g.dropParent], project, s.breakpoint);
        if ((targetProps.layout ?? "absolute") === "absolute") {
          // convert coords to new parent's space
          const parentRect = worldRectOf(g.dropParent, s.breakpoint);
          const nodeRect = worldRectOf(id, s.breakpoint);
          docActions.reparent(id, g.dropParent, project.nodes[g.dropParent].children.length, false);
          if (parentRect && nodeRect) {
            docActions.setStyles([id], s.breakpoint, { x: Math.round(nodeRect.x - parentRect.x), y: Math.round(nodeRect.y - parentRect.y) }, false);
          }
        } else {
          docActions.reparent(id, g.dropParent, g.dropIndex, false);
          docActions.setStyles([id], s.breakpoint, { x: undefined, y: undefined } as never, false);
        }
      }
      useDocument.getState().commitGesture(g.before as never);
    } else {
      if (g.dropParent) {
        const before = useDocument.getState().beginGesture();
        const id = g.ids[0];
        const targetProps = nodeStyles(project.nodes[g.dropParent], project, s.breakpoint);
        if ((targetProps.layout ?? "absolute") === "absolute") {
          const vp = viewportRef.current!;
          const vpRect = vp.getBoundingClientRect();
          const world = screenToWorld(e.clientX - vpRect.left, e.clientY - vpRect.top, s.zoom, s.panX, s.panY);
          const parentRect = worldRectOf(g.dropParent, s.breakpoint);
          docActions.reparent(id, g.dropParent, project.nodes[g.dropParent].children.length, false);
          if (parentRect) {
            docActions.setStyles([id], s.breakpoint, { x: Math.round(world.x - parentRect.x), y: Math.round(world.y - parentRect.y) }, false);
          }
        } else {
          docActions.reparent(id, g.dropParent, g.dropIndex, false);
        }
        useDocument.getState().commitGesture(before);
      }
    }
  };

  const finishDraw = (g: Extract<Gesture, { type: "draw" }>, e: React.MouseEvent) => {
    const vp = viewportRef.current;
    if (!vp || !project || !rootId) return;
    const s = useEditor.getState();
    const vpRect = vp.getBoundingClientRect();
    const w = Math.abs(e.clientX - g.startX) / s.zoom;
    const h = Math.abs(e.clientY - g.startY) / s.zoom;
    const target = dropTargetAt(e.clientX, e.clientY, new Set());
    if (!target) {
      s.setTool("select");
      return;
    }
    const parentNode = project.nodes[target.parentId];
    const parentProps = nodeStyles(parentNode, project, target.bp);
    const isAbs = (parentProps.layout ?? "absolute") === "absolute";

    let node: Node;
    const sized = w > 8 && h > 8;
    if (g.tool === "frame") node = createFrame("Frame", { fill: { type: "solid", color: "#F0F0F0" } });
    else if (g.tool === "stack") node = createStack("Stack");
    else if (g.tool === "image") node = createImage("");
    else node = createText("Type something", { fontSize: 16 });

    if (sized && g.tool !== "text") {
      node.styles.desktop.width = px(Math.round(w));
      node.styles.desktop.height = px(Math.round(h));
    }
    if (isAbs) {
      const parentRect = worldRectOf(target.parentId, target.bp);
      const world = screenToWorld(Math.min(g.startX, e.clientX) - vpRect.left, Math.min(g.startY, e.clientY) - vpRect.top, s.zoom, s.panX, s.panY);
      node.styles.desktop.x = Math.round(world.x - (parentRect?.x ?? 0));
      node.styles.desktop.y = Math.round(world.y - (parentRect?.y ?? 0));
    }
    const index = isAbs ? parentNode.children.length : insertionIndex(target.parentId, target.bp, e.clientX, e.clientY, new Set());
    docActions.insertSubtree({ [node.id]: node }, node.id, target.parentId, index);
    s.select([node.id]);
    s.setTool("select");
    if (g.tool === "text") s.setEditingText(node.id);
  };

  const onMouseUp = (e: React.MouseEvent) => {
    const g = gesture.current;
    gesture.current = null;
    setVisuals({});
    if (!g) return;
    const s = useEditor.getState();

    if (g.type === "maybe-move") {
      // plain click (no drag): if it was already selected, refine selection
      if (g.wasSelected && !g.additive) s.select([g.nodeId]);
      return;
    }
    if (g.type === "move") {
      finishMove(g, e);
      return;
    }
    if (g.type === "resize") {
      useDocument.getState().commitGesture(g.before as never);
      return;
    }
    if (g.type === "draw") {
      finishDraw(g, e);
      return;
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!project || !rootId) return;
    const s = useEditor.getState();
    const chain = hitChain(e.target as Element);
    if (chain.length === 0) return;
    const deepest = chain[0];
    const node = project.nodes[deepest];
    if (!node) return;
    if (node.type === "instance" && node.componentId) {
      // open component master for editing
      s.setContext({ kind: "component", componentId: node.componentId });
      return;
    }
    if (node.type === "text") {
      s.select([deepest]);
      s.setEditingText(deepest);
      return;
    }
    // drill: select the deepest hit directly
    s.select([deepest === rootId ? rootId : deepest]);
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!project) return;
    const s = useEditor.getState();
    const chain = hitChain(e.target as Element);
    const candidate = chain.length > 0 ? pickCandidate(chain, s.selection) : null;
    if (candidate && !s.selection.includes(candidate)) s.select([candidate]);
    s.setContextMenu({ x: e.clientX, y: e.clientY, nodeId: candidate });
  };

  // resize handle mousedown (called from Overlays)
  const onResizeStart = useCallback(
    (nodeId: string, handle: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!project) return;
      const s = useEditor.getState();
      const rect = worldRectOf(nodeId, s.breakpoint);
      if (!rect) return;
      const own = nodeStyles(project.nodes[nodeId], project, s.breakpoint);
      gesture.current = {
        type: "resize",
        startX: e.clientX,
        startY: e.clientY,
        nodeId,
        handle,
        startRect: rect,
        startStyles: { x: own.x, y: own.y, w: rect.w, h: rect.h },
        before: useDocument.getState().beginGesture(),
      };
    },
    [project],
  );

  // ── insert panel drag & drop ───────────────────────────────────────────────

  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-insert") || e.dataTransfer.types.includes("application/x-asset") || e.dataTransfer.types.includes("application/x-component")) {
      e.preventDefault();
      if (e.dataTransfer.types.includes("application/x-asset")) {
        e.dataTransfer.dropEffect = "copy";
        const fillTarget = assetFillTargetAt(e.clientX, e.clientY);
        if (fillTarget && viewportRef.current) {
          const element = findNodeElement(viewportRef.current, fillTarget.bp, fillTarget.nodeId);
          setVisuals({ dropHighlight: element ? elementRect(element, viewportRef.current) : undefined });
          return;
        }
      }
      // Sections always land on the page root — highlight the root insert line.
      const sectionDrop = e.dataTransfer.types.includes("application/x-insert-section") && rootId;
      const target = sectionDrop
        ? { parentId: rootId, bp: useEditor.getState().breakpoint }
        : dropTargetAt(e.clientX, e.clientY, new Set());
      if (target && viewportRef.current) {
        const el = findNodeElement(viewportRef.current, target.bp, target.parentId);
        const targetProps = nodeStyles(project!.nodes[target.parentId], project!, target.bp);
        if ((targetProps.layout ?? "absolute") !== "absolute") {
          const idx = sectionDrop
            ? project!.nodes[rootId!].children.length
            : insertionIndex(target.parentId, target.bp, e.clientX, e.clientY, new Set());
          // Prefer top-of-root line when the dragged section is a navbar (id available in some browsers during dragover).
          const sectionId = e.dataTransfer.getData("application/x-insert-section");
          const lineIdx = sectionId === "section-navbar" ? 0 : idx;
          setVisuals({ insertLine: insertLineFor(target.parentId, target.bp, lineIdx, new Set()) ?? undefined });
        } else {
          setVisuals({ dropHighlight: el ? elementRect(el, viewportRef.current) : undefined });
        }
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setVisuals({});
    if (!project || !rootId) return;
    const s = useEditor.getState();
    const templateId = e.dataTransfer.getData("application/x-insert");
    const assetUrl = e.dataTransfer.getData("application/x-asset");

    if (assetUrl) {
      const fillTarget = assetFillTargetAt(e.clientX, e.clientY);
      if (fillTarget) {
        const currentFill = nodeStyles(project.nodes[fillTarget.nodeId], project, fillTarget.bp).fill;
        docActions.setStyles(
          [fillTarget.nodeId],
          fillTarget.bp,
          {
            fill:
              currentFill?.type === "image"
                ? { ...currentFill, src: assetUrl }
                : { type: "image", src: assetUrl, fit: "cover" },
          },
        );
        s.select([fillTarget.nodeId]);
        return;
      }
    }

    // Sections always insert as siblings on the page/component root stack.
    if (templateId && isSectionTemplate(templateId)) {
      const index = templateId === "section-navbar" ? 0 : project.nodes[rootId].children.length;
      const inserted = insertTemplate(templateId as TemplateId, rootId, index);
      if (inserted) s.select([inserted]);
      return;
    }

    const target = dropTargetAt(e.clientX, e.clientY, new Set());
    if (!target) return;
    const parentNode = project.nodes[target.parentId];
    const parentProps = nodeStyles(parentNode, project, target.bp);
    const isAbs = (parentProps.layout ?? "absolute") === "absolute";
    const index = isAbs ? parentNode.children.length : insertionIndex(target.parentId, target.bp, e.clientX, e.clientY, new Set());

    const positionNode = (node: Node) => {
      if (isAbs && viewportRef.current) {
        const vpRect = viewportRef.current.getBoundingClientRect();
        const world = screenToWorld(e.clientX - vpRect.left, e.clientY - vpRect.top, s.zoom, s.panX, s.panY);
        const parentRect = worldRectOf(target.parentId, target.bp);
        node.styles.desktop.x = Math.round(world.x - (parentRect?.x ?? 0));
        node.styles.desktop.y = Math.round(world.y - (parentRect?.y ?? 0));
      }
    };

    if (templateId) {
      const inserted = insertTemplate(templateId as TemplateId, target.parentId, index, positionNode);
      if (inserted) s.select([inserted]);
      return;
    }
    if (assetUrl) {
      const node = createImage(assetUrl);
      positionNode(node);
      docActions.insertSubtree({ [node.id]: node }, node.id, target.parentId, index);
      s.select([node.id]);
      return;
    }
    const componentId = e.dataTransfer.getData("application/x-component");
    if (componentId) {
      const comp = project.components.find((c) => c.id === componentId);
      if (!comp) return;
      const instance: Node = {
        id: crypto.randomUUID().slice(0, 10),
        type: "instance",
        name: comp.name,
        parent: null,
        children: [],
        componentId,
        overrides: {},
        styles: { desktop: {} },
      };
      positionNode(instance);
      docActions.insertSubtree({ [instance.id]: instance }, instance.id, target.parentId, index);
      s.select([instance.id]);
    }
  };

  if (!project || !rootId) return <div className="canvas-viewport" ref={viewportRef} />;

  const artboards: { bp: BreakpointId; width: number; x: number }[] = component
    ? [{ bp: breakpoint, width: BREAKPOINTS.find((def) => def.id === breakpoint)?.width ?? 600, x: 0 }]
    : BREAKPOINTS.map((def) => ({ bp: def.id, width: def.width, x: artboardX(def.id) }));

  const cursorClass = tool === "hand" ? "hand" : tool !== "select" ? "placing" : "";

  return (
    <div
      ref={viewportRef}
      className={`canvas-viewport ${cursorClass}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseLeave={() => {
        lastPointer.current = null;
        setContextTargetId(null);
        useEditor.getState().setHovered(null);
      }}
    >
      <div className="canvas-world" style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}>
        {component && componentVariant && (
          <div style={{ position: "absolute", left: 0, top: -72, color: "var(--component)", fontSize: 13 / zoom, whiteSpace: "nowrap", display: "flex", gap: 10 / zoom, alignItems: "center" }}>
            <button
              className="btn"
              style={{ fontSize: 12 / zoom, height: 30 / zoom, padding: `0 ${12 / zoom}px` }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                const pageId = project.homePageId;
                useEditor.getState().setContext({ kind: "page", pageId });
              }}
            >
              ← Back
            </button>
            <span>
              Editing component: {component.name} · {BREAKPOINTS.find((def) => def.id === breakpoint)?.label}
            </span>
            <select
              className="prop-select"
              value={componentVariant.id}
              title={`Variant used at ${breakpoint}`}
              style={{ width: 130 / zoom, height: 30 / zoom, fontSize: 12 / zoom }}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                const variant = componentVariants(component).find((item) => item.id === e.target.value);
                docActions.assignComponentVariant(component.id, breakpoint, e.target.value);
                if (variant) useEditor.getState().select([variant.rootId]);
              }}
            >
              {componentVariants(component).map((variant) => (
                <option key={variant.id} value={variant.id}>{variant.name}</option>
              ))}
            </select>
            {!component.variantByBreakpoint?.[breakpoint] && breakpoint !== "desktop" && (
              <button
                className="btn"
                style={{ fontSize: 12 / zoom, height: 30 / zoom, padding: `0 ${12 / zoom}px` }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const created = docActions.addComponentVariant(component.id, breakpoint);
                  if (created) useEditor.getState().select([created.rootId]);
                }}
              >
                Create {BREAKPOINTS.find((def) => def.id === breakpoint)?.label} state
              </button>
            )}
          </div>
        )}
        {artboards.map(({ bp, width, x }) => (
          <div key={bp} data-artboard={bp} className="artboard" style={{ left: x, top: 0, width, minHeight: 400, containerType: "inline-size" }}>
            {!component && (
              <div
                className={`artboard-label ${bp === breakpoint ? "active" : ""}`}
                style={{ fontSize: Math.min(22, 11 / zoom), top: -Math.min(44, 24 / zoom) }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  useEditor.getState().setBreakpoint(bp);
                  useEditor.getState().select([rootId]);
                }}
              >
                {`${page?.name ?? ""} · ${BREAKPOINTS.find((b) => b.id === bp)?.label}`}
              </div>
            )}
            <ArtboardContent rootId={rootId} breakpoint={bp} />
          </div>
        ))}
      </div>
      <Overlays viewportRef={viewportRef} visuals={visuals} contextTargetId={contextTargetId} onResizeStart={onResizeStart} />
      <CanvasContextMenu />
    </div>
  );
}
