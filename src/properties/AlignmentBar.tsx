import { docActions, useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";

// ─────────────────────────────────────────────────────────────────────────────
// Alignment / distribution for multi-selected absolute-positioned layers.
// Rects are measured from the live canvas DOM at the active breakpoint.
// ─────────────────────────────────────────────────────────────────────────────

interface MeasuredNode {
  id: string;
  x: number; // style x/y (parent coords)
  y: number;
  rect: DOMRect; // screen rect (same scale for all, so deltas are valid)
}

function measureSelection(): MeasuredNode[] {
  const { selection, breakpoint } = useEditor.getState();
  const project = useDocument.getState().project;
  if (!project) return [];
  const artboard = document.querySelector(`[data-artboard="${breakpoint}"]`);
  if (!artboard) return [];
  const out: MeasuredNode[] = [];
  for (const id of selection) {
    const node = project.nodes[id];
    if (!node?.parent) continue;
    const styles = node.styles.desktop;
    if (styles.x === undefined && styles.y === undefined) continue;
    const el = artboard.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
    if (!el) continue;
    out.push({ id, x: styles.x ?? 0, y: styles.y ?? 0, rect: el.getBoundingClientRect() });
  }
  return out;
}

type AlignOp = "left" | "centerX" | "right" | "top" | "centerY" | "bottom" | "distributeX" | "distributeY";

function applyAlign(op: AlignOp) {
  const measured = measureSelection();
  if (measured.length < 2) return;
  const { breakpoint } = useEditor.getState();
  const zoom = useEditor.getState().zoom;

  const minL = Math.min(...measured.map((m) => m.rect.left));
  const maxR = Math.max(...measured.map((m) => m.rect.right));
  const minT = Math.min(...measured.map((m) => m.rect.top));
  const maxB = Math.max(...measured.map((m) => m.rect.bottom));

  const setPos = (m: MeasuredNode, screenDx: number, screenDy: number) => {
    const dx = screenDx / zoom;
    const dy = screenDy / zoom;
    docActions.setStyles([m.id], breakpoint, { x: Math.round(m.x + dx), y: Math.round(m.y + dy) }, false);
  };

  const before = useDocument.getState().beginGesture();

  if (op === "distributeX" || op === "distributeY") {
    const horizontal = op === "distributeX";
    const sorted = [...measured].sort((a, b) => (horizontal ? a.rect.left - b.rect.left : a.rect.top - b.rect.top));
    const total = horizontal ? maxR - minL : maxB - minT;
    const sumSize = sorted.reduce((acc, m) => acc + (horizontal ? m.rect.width : m.rect.height), 0);
    const gap = (total - sumSize) / (sorted.length - 1);
    let cursor = horizontal ? minL : minT;
    for (const m of sorted) {
      if (horizontal) {
        setPos(m, cursor - m.rect.left, 0);
        cursor += m.rect.width + gap;
      } else {
        setPos(m, 0, cursor - m.rect.top);
        cursor += m.rect.height + gap;
      }
    }
  } else {
    for (const m of measured) {
      switch (op) {
        case "left":
          setPos(m, minL - m.rect.left, 0);
          break;
        case "right":
          setPos(m, maxR - m.rect.right, 0);
          break;
        case "centerX":
          setPos(m, (minL + maxR) / 2 - (m.rect.left + m.rect.right) / 2, 0);
          break;
        case "top":
          setPos(m, 0, minT - m.rect.top);
          break;
        case "bottom":
          setPos(m, 0, maxB - m.rect.bottom);
          break;
        case "centerY":
          setPos(m, 0, (minT + maxB) / 2 - (m.rect.top + m.rect.bottom) / 2);
          break;
      }
    }
  }
  useDocument.getState().commitGesture(before);
}

const OPS: { op: AlignOp; label: string; title: string }[] = [
  { op: "left", label: "⇤", title: "Align left" },
  { op: "centerX", label: "↔", title: "Align horizontal centers" },
  { op: "right", label: "⇥", title: "Align right" },
  { op: "top", label: "⤒", title: "Align top" },
  { op: "centerY", label: "↕", title: "Align vertical centers" },
  { op: "bottom", label: "⤓", title: "Align bottom" },
  { op: "distributeX", label: "⇹", title: "Distribute horizontally" },
  { op: "distributeY", label: "⇳", title: "Distribute vertically" },
];

export function AlignmentBar() {
  return (
    <div className="prop-section" style={{ paddingTop: 8, paddingBottom: 8 }}>
      <div className="seg-control">
        {OPS.map(({ op, label, title }) => (
          <button key={op} className="seg-btn" title={title} onClick={() => applyAlign(op)} style={{ fontSize: 13 }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
