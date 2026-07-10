import { useEffect, useRef, useState, type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Reusable property panel controls: numeric inputs with drag-to-scrub,
// segmented controls, color inputs, rows with override indicators.
// ─────────────────────────────────────────────────────────────────────────────

export function PropRow({ label, children, overridden, onReset }: { label: string; children: ReactNode; overridden?: boolean; onReset?: () => void }) {
  return (
    <div className="prop-row">
      <span className="prop-label">
        {overridden && <span className="override-dot" title="Overridden at this breakpoint — click to reset" onClick={onReset} />}
        {label}
      </span>
      {children}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  onCommit,
  unit,
  min,
  max,
  step = 1,
  placeholder,
  parseText,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  onCommit?: () => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** try to handle raw typed text (e.g. "100%", "50vh"); return true if handled */
  parseText?: (raw: string) => boolean;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const dragging = useRef<{ startY: number; startValue: number } | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    // don't clobber in-progress typing (e.g. "100%" before commit parses the unit)
    if (!dragging.current && !focused.current) setText(value === undefined ? "" : String(Math.round((value + Number.EPSILON) * 100) / 100));
  }, [value]);

  const clamp = (v: number) => {
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  const commit = (raw: string) => {
    if (parseText?.(raw.trim())) {
      onCommit?.();
      return;
    }
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) onChange(clamp(parsed));
    onCommit?.();
  };

  const onScrubStart = (e: React.MouseEvent) => {
    if (value === undefined) return;
    e.preventDefault();
    dragging.current = { startY: e.clientY, startValue: value };
    document.body.style.cursor = "ns-resize";
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return;
      // drag up to increase, down to decrease
      const delta = Math.round((dragging.current.startY - ev.clientY) / 2) * step;
      const next = clamp(dragging.current.startValue + delta);
      setText(String(next));
      onChange(next);
    };
    const up = () => {
      dragging.current = null;
      document.body.style.cursor = "";
      onCommit?.();
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="prop-number">
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseFloat(e.target.value);
          if (!Number.isNaN(parsed)) onChange(clamp(parsed));
        }}
        onFocus={() => (focused.current = true)}
        onBlur={(e) => {
          focused.current = false;
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const delta = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1) * step;
            const next = clamp((parseFloat(text) || 0) + delta);
            setText(String(next));
            onChange(next);
          }
        }}
      />
      {unit && (
        <span className="unit" onMouseDown={onScrubStart} title="Drag up/down to change">
          {unit}
        </span>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg-control">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`seg-btn ${value === opt.value ? "active" : ""}`}
          title={opt.title}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Parse #rrggbb / #rrggbbaa / rgba() to hex + alpha for the native color input. */
function toHexAlpha(color: string): { hex: string; alpha: number } {
  if (color.startsWith("#")) {
    if (color.length === 9) {
      return { hex: color.slice(0, 7), alpha: Math.round((parseInt(color.slice(7, 9), 16) / 255) * 100) };
    }
    return { hex: color.length === 7 ? color : "#000000", alpha: 100 };
  }
  const m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\)$/.exec(color.trim());
  if (m) {
    const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
    return { hex: `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`, alpha: m[4] !== undefined ? Math.round(parseFloat(m[4]) * 100) : 100 };
  }
  return { hex: "#000000", alpha: 100 };
}

function fromHexAlpha(hex: string, alpha: number): string {
  if (alpha >= 100) return hex;
  const a = Math.round((alpha / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

export function ColorInput({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const { hex, alpha } = toHexAlpha(value || "#000000");
  const [draft, setDraft] = useState<string | null>(null);

  const commitDraft = (raw: string) => {
    setDraft(null);
    let v = raw.replace(/[^0-9a-fA-F]/g, "");
    if (v.length === 3) v = v.split("").map((c) => c + c).join("");
    if (v.length === 6) onChange(fromHexAlpha(`#${v}`, alpha));
  };

  return (
    <>
      <div className="color-swatch" style={{ ["--swatch-color" as never]: value }}>
        <input
          type="color"
          value={hex}
          // z-index lifts it above the ::after swatch overlay so it's clickable
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", zIndex: 1 }}
          onChange={(e) => onChange(fromHexAlpha(e.target.value, alpha))}
        />
      </div>
      <input
        className="prop-input"
        style={{ flex: 1, minWidth: 0, textTransform: "uppercase", fontSize: 10 }}
        value={draft ?? hex.replace("#", "")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commitDraft(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(null);
        }}
      />
      <NumberInput value={alpha} min={0} max={100} unit="%" onChange={(a) => onChange(fromHexAlpha(hex, a))} />
    </>
  );
}

const PROPERTY_SECTION_STATE_KEY = "framer.properties.section-state.v1";
let propertySectionState: Record<string, boolean> | null = null;

function readPropertySectionState() {
  if (propertySectionState) return propertySectionState;
  try {
    propertySectionState = JSON.parse(localStorage.getItem(PROPERTY_SECTION_STATE_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    propertySectionState = {};
  }
  return propertySectionState;
}

function savePropertySectionState(sectionId: string, isOpen: boolean) {
  const next = { ...readPropertySectionState(), [sectionId]: isOpen };
  propertySectionState = next;
  try {
    localStorage.setItem(PROPERTY_SECTION_STATE_KEY, JSON.stringify(next));
  } catch {
    // The in-memory state still preserves toggles for the current editor session.
  }
}

export function Section({ title, children, action, sectionId = title }: { title: string; children: ReactNode; action?: ReactNode; sectionId?: string }) {
  const [isOpen, setIsOpen] = useState(() => readPropertySectionState()[sectionId] ?? true);

  const toggle = () => {
    setIsOpen((open) => {
      const next = !open;
      savePropertySectionState(sectionId, next);
      return next;
    });
  };

  return (
    <div className={`prop-section ${isOpen ? "is-open" : "is-collapsed"}`}>
      <div className="prop-section-header">
        <button
          type="button"
          className="prop-section-toggle"
          aria-expanded={isOpen}
          onClick={toggle}
        >
          <span>{title}</span>
          <span className="prop-section-chevron" aria-hidden="true" />
        </button>
        {action && <div className="prop-section-action">{action}</div>}
      </div>
      <div className="prop-section-collapse" aria-hidden={!isOpen}>
        <div className="prop-section-content">
          <div className="prop-section-content-inner">{children}</div>
        </div>
      </div>
    </div>
  );
}
