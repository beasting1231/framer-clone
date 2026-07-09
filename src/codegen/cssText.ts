import type { CSSProperties } from "react";

const UNITLESS = new Set([
  "opacity",
  "zIndex",
  "fontWeight",
  "lineHeight",
  "flexGrow",
  "flexShrink",
  "order",
  "zoom",
]);

export function kebab(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

export function cssValue(prop: string, value: unknown): string {
  if (typeof value === "number" && !UNITLESS.has(prop)) return `${value}px`;
  return String(value);
}

/** Serialize a React CSSProperties object to CSS declarations. */
export function cssDeclarations(css: CSSProperties, indent = "  "): string {
  return Object.entries(css)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([prop, value]) => `${indent}${kebab(prop)}: ${cssValue(prop, value)};`)
    .join("\n");
}

/** Diff two style objects: declarations in `next` that differ from `base`, plus resets. */
export function cssDiff(base: CSSProperties, next: CSSProperties): CSSProperties {
  const out: Record<string, unknown> = {};
  const baseRecord = base as Record<string, unknown>;
  const nextRecord = next as Record<string, unknown>;
  for (const key of Object.keys(nextRecord)) {
    if (String(nextRecord[key]) !== String(baseRecord[key])) out[key] = nextRecord[key];
  }
  for (const key of Object.keys(baseRecord)) {
    if (!(key in nextRecord)) {
      // property removed at this breakpoint → reset to initial-ish defaults
      out[key] = RESET_VALUES[key] ?? "unset";
    }
  }
  return out as CSSProperties;
}

const RESET_VALUES: Record<string, string> = {
  display: "block",
  position: "static",
  transform: "none",
  boxShadow: "none",
  filter: "none",
  backdropFilter: "none",
  opacity: "1",
  overflow: "visible",
};
