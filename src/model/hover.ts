import type { BreakpointId, HoverEffect, Node, SerializedProject, StyleProps } from "./types";
import { nodeStyles } from "./resolve";

/** Hover appearance + motion overrides stored on node.effects.hover */
export type HoverStyleProps = Partial<StyleProps>;

const TYPO_KEYS: (keyof StyleProps)[] = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "color",
  "textAlign",
  "textTransform",
  "textDecoration",
];

export function getHoverStyles(hover: HoverEffect | undefined): HoverStyleProps {
  if (!hover) return {};
  const styles: HoverStyleProps = { ...(hover.styles ?? {}) };
  if (hover.fill !== undefined) styles.fill = hover.fill;
  if (hover.color !== undefined) styles.color = hover.color;
  return styles;
}

export function hasHoverOverride(hover: HoverEffect | undefined, key: keyof StyleProps): boolean {
  if (!hover) return false;
  if (hover.styles && key in hover.styles) return true;
  if (key === "fill" && hover.fill !== undefined) return true;
  if (key === "color" && hover.color !== undefined) return true;
  return false;
}

export function defaultHoverEffect(): HoverEffect {
  return { duration: 0.2, styles: {} };
}

export function ensureHoverEffect(node: Node): HoverEffect {
  return node.effects?.hover ?? defaultHoverEffect();
}

/** Merge normal resolved styles with hover overrides for display / rendering. */
export function resolveHoverAppearance(
  node: Node,
  project: SerializedProject,
  bp: BreakpointId,
  hover?: HoverEffect,
): StyleProps {
  const base = nodeStyles(node, project, bp);
  if (!hover) return base;
  const overrides = getHoverStyles(hover);
  if (Object.keys(overrides).length === 0) return base;

  const merged: StyleProps = { ...base, ...overrides };
  if (TYPO_KEYS.some((k) => k in overrides) && !("textStyleId" in overrides)) {
    merged.textStyleId = undefined;
  }
  if ("color" in overrides && !("colorStyleId" in overrides)) {
    merged.colorStyleId = undefined;
  }
  return merged;
}

export function mergeHoverOnto(base: StyleProps, hover: HoverEffect | undefined): StyleProps {
  return { ...base, ...getHoverStyles(hover) };
}

export function patchHoverStyles(hover: HoverEffect, patch: Partial<StyleProps>): HoverEffect {
  const extra: Partial<StyleProps> = {};
  if (TYPO_KEYS.some((k) => k in patch)) extra.textStyleId = undefined;
  if ("color" in patch) extra.colorStyleId = undefined;
  const next = { ...getHoverStyles(hover), ...patch, ...extra };
  return { ...hover, fill: undefined, color: undefined, styles: next };
}

export function resetHoverStyleKeys(hover: HoverEffect, keys: (keyof StyleProps)[]): HoverEffect {
  const styles = { ...(hover.styles ?? {}) };
  for (const key of keys) delete styles[key];
  const next: HoverEffect = { ...hover, styles };
  if (keys.includes("fill")) next.fill = undefined;
  if (keys.includes("color")) next.color = undefined;
  return next;
}

export function hasAnyHoverStyle(hover: HoverEffect | undefined): boolean {
  if (!hover) return false;
  const hs = getHoverStyles(hover);
  return Object.keys(hs).length > 0;
}
