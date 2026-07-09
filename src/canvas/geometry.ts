import type { BreakpointId } from "@/model/types";
import { BREAKPOINTS } from "@/model/types";

// ─────────────────────────────────────────────────────────────────────────────
// Canvas geometry: world layout of artboards, coordinate transforms, and
// DOM-rect helpers for hit testing and overlays.
// ─────────────────────────────────────────────────────────────────────────────

export const ARTBOARD_GAP = 140;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** World-space x offset for each breakpoint artboard (desktop first). */
export function artboardX(bp: BreakpointId): number {
  let x = 0;
  for (const def of BREAKPOINTS) {
    if (def.id === bp) return x;
    x += def.width + ARTBOARD_GAP;
  }
  return x;
}

export function screenToWorld(sx: number, sy: number, zoom: number, panX: number, panY: number) {
  return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
}

export function worldToScreen(wx: number, wy: number, zoom: number, panX: number, panY: number) {
  return { x: wx * zoom + panX, y: wy * zoom + panY };
}

/** Rect of a DOM element in viewport-local screen coordinates. */
export function elementRect(el: Element, viewport: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  const v = viewport.getBoundingClientRect();
  return { x: r.left - v.left, y: r.top - v.top, w: r.width, h: r.height };
}

/** Find the rendered element for a node id within a specific breakpoint artboard. */
export function findNodeElement(viewport: HTMLElement, bp: BreakpointId, nodeId: string): HTMLElement | null {
  const artboard = viewport.querySelector(`[data-artboard="${bp}"]`);
  if (!artboard) return null;
  return artboard.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`) as HTMLElement | null;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: { axis: "v" | "h"; pos: number; from: number; to: number }[];
}

/**
 * Snap a moving rect against sibling rects and the container rect.
 * All rects in world coordinates; threshold in world px.
 */
export function computeSnapping(moving: Rect, targets: Rect[], threshold: number): SnapResult {
  const movingXs = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const movingYs = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
  let bestDx: { d: number; pos: number } | null = null;
  let bestDy: { d: number; pos: number } | null = null;

  for (const t of targets) {
    const targetXs = [t.x, t.x + t.w / 2, t.x + t.w];
    const targetYs = [t.y, t.y + t.h / 2, t.y + t.h];
    for (const mx of movingXs) {
      for (const tx of targetXs) {
        const d = tx - mx;
        if (Math.abs(d) <= threshold && (!bestDx || Math.abs(d) < Math.abs(bestDx.d))) bestDx = { d, pos: tx };
      }
    }
    for (const my of movingYs) {
      for (const ty of targetYs) {
        const d = ty - my;
        if (Math.abs(d) <= threshold && (!bestDy || Math.abs(d) < Math.abs(bestDy.d))) bestDy = { d, pos: ty };
      }
    }
  }

  const guides: SnapResult["guides"] = [];
  if (bestDx) {
    const ys = targets.flatMap((t) => [t.y, t.y + t.h]).concat([moving.y, moving.y + moving.h]);
    guides.push({ axis: "v", pos: bestDx.pos, from: Math.min(...ys), to: Math.max(...ys) });
  }
  if (bestDy) {
    const xs = targets.flatMap((t) => [t.x, t.x + t.w]).concat([moving.x, moving.x + moving.w]);
    guides.push({ axis: "h", pos: bestDy.pos, from: Math.min(...xs), to: Math.max(...xs) });
  }
  return { dx: bestDx?.d ?? 0, dy: bestDy?.d ?? 0, guides };
}
