import { useEffect, useState, type RefObject } from "react";
import { useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { elementRect, findNodeElement, type Rect } from "./geometry";

// ─────────────────────────────────────────────────────────────────────────────
// Screen-space overlays: selection rectangles, resize handles, hover outline,
// snap guides, marquee, drop highlights, and stack insertion lines.
// ─────────────────────────────────────────────────────────────────────────────

export interface InteractionVisuals {
  guides?: { axis: "v" | "h"; x: number; y: number; len: number }[];
  marquee?: Rect;
  dropHighlight?: Rect;
  insertLine?: Rect;
}

const HANDLE_POS: Record<string, { x: number; y: number; cursor: string }> = {
  nw: { x: 0, y: 0, cursor: "nwse-resize" },
  n: { x: 0.5, y: 0, cursor: "ns-resize" },
  ne: { x: 1, y: 0, cursor: "nesw-resize" },
  e: { x: 1, y: 0.5, cursor: "ew-resize" },
  se: { x: 1, y: 1, cursor: "nwse-resize" },
  s: { x: 0.5, y: 1, cursor: "ns-resize" },
  sw: { x: 0, y: 1, cursor: "nesw-resize" },
  w: { x: 0, y: 0.5, cursor: "ew-resize" },
};

export function Overlays({
  viewportRef,
  visuals,
  contextTargetId,
  onResizeStart,
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
  visuals: InteractionVisuals;
  contextTargetId: string | null;
  onResizeStart: (nodeId: string, handle: string, e: React.MouseEvent) => void;
}) {
  const selection = useEditor((s) => s.selection);
  const hoveredId = useEditor((s) => s.hoveredId);
  const breakpoint = useEditor((s) => s.breakpoint);
  const zoom = useEditor((s) => s.zoom);
  const panX = useEditor((s) => s.panX);
  const panY = useEditor((s) => s.panY);
  const editingTextId = useEditor((s) => s.editingTextId);
  const project = useDocument((s) => s.project);

  // tick to recompute rects after DOM layout settles
  const [, setTick] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setTick((t) => t + 1));
    return () => cancelAnimationFrame(raf);
  });

  const vp = viewportRef.current;
  if (!vp || !project) return null;

  const rectFor = (id: string): Rect | null => {
    const el = findNodeElement(vp, breakpoint, id);
    return el ? elementRect(el, vp) : null;
  };

  const singleSelection = selection.length === 1 ? selection[0] : null;

  return (
    <div className="overlay-layer">
      {/* hover */}
      {hoveredId && !selection.includes(hoveredId) && hoveredId !== editingTextId && (() => {
        const r = rectFor(hoveredId);
        if (!r) return null;
        const isComp = project.nodes[hoveredId]?.type === "instance";
        return <div className={`sel-rect hover ${isComp ? "component" : ""}`} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />;
      })()}

      {/* selection */}
      {selection.map((id) => {
        if (id === editingTextId) return null;
        const r = rectFor(id);
        if (!r) return null;
        const node = project.nodes[id];
        const isComp = node?.type === "instance";
        const showHandles = singleSelection === id && !node?.locked;
        return (
          <div key={id} className={`sel-rect ${isComp ? "component" : ""}`} style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
            {showHandles && (
              <>
                {Object.entries(HANDLE_POS).map(([hid, pos]) => (
                  <div
                    key={hid}
                    className="resize-handle"
                    style={{
                      left: pos.x * r.w - 4,
                      top: pos.y * r.h - 4,
                      cursor: pos.cursor,
                    }}
                    onMouseDown={(e) => onResizeStart(id, hid, e)}
                  />
                ))}
                <div className="sel-size-label">
                  {Math.round(r.w / zoom)} × {Math.round(r.h / zoom)}
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* exact node that a backtick-click will attach to Codex */}
      {contextTargetId && (() => {
        const r = rectFor(contextTargetId);
        const node = project.nodes[contextTargetId];
        if (!r || !node) return null;
        const component = node.type === "instance" ? project.components.find((item) => item.id === node.componentId) : null;
        return (
          <div className="sel-rect codex-context-target" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
            <span>Add to AI · {component?.name || node.name}</span>
          </div>
        );
      })()}

      {/* snap guides */}
      {(visuals.guides ?? []).map((g, i) =>
        g.axis === "v" ? (
          <div key={i} className="snap-guide v" style={{ left: g.x, top: g.y, height: g.len }} />
        ) : (
          <div key={i} className="snap-guide h" style={{ left: g.x, top: g.y, width: g.len }} />
        ),
      )}

      {/* marquee */}
      {visuals.marquee && (
        <div className="marquee" style={{ left: visuals.marquee.x, top: visuals.marquee.y, width: visuals.marquee.w, height: visuals.marquee.h }} />
      )}

      {/* drop highlight */}
      {visuals.dropHighlight && (
        <div className="drop-highlight" style={{ left: visuals.dropHighlight.x, top: visuals.dropHighlight.y, width: visuals.dropHighlight.w, height: visuals.dropHighlight.h }} />
      )}

      {/* stack insertion line */}
      {visuals.insertLine && (
        <div className="stack-insert-line" style={{ left: visuals.insertLine.x, top: visuals.insertLine.y, width: visuals.insertLine.w, height: visuals.insertLine.h }} />
      )}
    </div>
  );
}
