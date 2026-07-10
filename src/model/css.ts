import type { CSSProperties } from "react";
import type { Fill, LayoutMode, Node, Shadow, SizeValue, StyleProps } from "./types";

const ALIGN_MAP: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

const JUSTIFY_MAP: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  "space-between": "space-between",
  "space-around": "space-around",
  "space-evenly": "space-evenly",
};

export function fillToCss(fillProp: Fill): Partial<CSSProperties> {
  switch (fillProp.type) {
    case "solid":
      return { backgroundColor: fillProp.color };
    case "linear":
      return {
        backgroundImage: `linear-gradient(${fillProp.angle}deg, ${fillProp.stops
          .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
          .join(", ")})`,
      };
    case "radial":
      return {
        backgroundImage: `radial-gradient(circle, ${fillProp.stops
          .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
          .join(", ")})`,
      };
    case "image":
      if (!fillProp.src) return { backgroundColor: "#E5E5E5" };
      return {
        backgroundImage: `url("${fillProp.src}")`,
        backgroundSize: fillProp.fit === "tile" ? "auto" : fillProp.fit === "fill" ? "100% 100%" : fillProp.fit,
        backgroundPosition: "center",
        backgroundRepeat: fillProp.fit === "tile" ? "repeat" : "no-repeat",
      };
  }
}

export function shadowToCss(shadows: Shadow[]): string {
  return shadows
    .map((s) => `${s.inset ? "inset " : ""}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`)
    .join(", ");
}

function sizeToCss(size: SizeValue | undefined, axis: "w" | "h", isStackChild: boolean, direction?: "row" | "column"): Partial<CSSProperties> {
  if (!size) return {};
  const prop = axis === "w" ? "width" : "height";
  switch (size.mode) {
    case "fixed":
      return { [prop]: `${size.value ?? 0}px` } as CSSProperties;
    case "relative":
      return { [prop]: `${size.value ?? 100}%` } as CSSProperties;
    case "viewport":
      return { [prop]: `${size.value ?? 100}${size.unit ?? (axis === "w" ? "vw" : "vh")}` } as CSSProperties;
    case "fit":
      return { [prop]: "fit-content" } as CSSProperties;
    case "fill": {
      if (isStackChild) {
        const isMainAxis = (direction === "row" && axis === "w") || (direction === "column" && axis === "h");
        if (isMainAxis) return { flexGrow: 1, flexBasis: 0, [prop]: "auto", minWidth: axis === "w" ? 0 : undefined, minHeight: axis === "h" ? 0 : undefined } as CSSProperties;
        return { alignSelf: "stretch", [prop]: "auto" } as CSSProperties;
      }
      return { [prop]: "100%" } as CSSProperties;
    }
  }
}

export interface CssContext {
  /** layout mode of the parent container */
  parentLayout?: LayoutMode;
  /** direction of the parent stack */
  parentDirection?: "row" | "column";
  /** true when rendering inside the editor canvas (disables sticky etc.) */
  editor?: boolean;
}

/**
 * Convert resolved StyleProps into CSS. This is the one place layout semantics
 * are defined; the editor canvas, preview, and generated site all use it.
 */
export function stylesToCss(props: StyleProps, node: Node, ctx: CssContext = {}): CSSProperties {
  const css: CSSProperties = {};
  const parentLayout = ctx.parentLayout ?? "absolute";
  // Stack/grid children obey their parent unless explicitly switched to Absolute.
  // Stale x/y values must not silently opt an "In flow" layer out of layout.
  const inStack = parentLayout === "stack" && !props.positionAbsolute;
  const inGrid = parentLayout === "grid" && !props.positionAbsolute;

  // ── size
  Object.assign(css, sizeToCss(props.width, "w", inStack, ctx.parentDirection));
  Object.assign(css, sizeToCss(props.height, "h", inStack, ctx.parentDirection));
  if (props.minWidth !== undefined) css.minWidth = props.minWidth;
  if (props.maxWidth !== undefined) css.maxWidth = props.maxWidth;
  if (props.minHeight !== undefined) css.minHeight = props.minHeight;
  if (props.maxHeight !== undefined) css.maxHeight = props.maxHeight;

  // ── position
  if (props.positionAbsolute && props.pin) {
    css.position = "absolute";
    const p = props.pin;
    if (p.centerX) {
      css.left = "50%";
      css.transform = `translateX(-50%)`;
    } else {
      if (p.left !== undefined) css.left = p.left;
      if (p.right !== undefined) css.right = p.right;
    }
    if (p.centerY) {
      css.top = "50%";
      css.transform = css.transform ? `translate(-50%, -50%)` : `translateY(-50%)`;
    } else {
      if (p.top !== undefined) css.top = p.top;
      if (p.bottom !== undefined) css.bottom = p.bottom;
    }
  } else if (props.positionAbsolute || (parentLayout === "absolute" && !inStack && !inGrid)) {
    css.position = "absolute";
    css.left = props.x ?? 0;
    css.top = props.y ?? 0;
  } else {
    css.position = "relative";
  }
  if (props.sticky && !ctx.editor) {
    css.position = "fixed";
    // Absolute pins still describe where a sticky layer should sit. Preserve
    // them so Preview/generated output matches the editor canvas.
    css.top = props.positionAbsolute && props.pin?.top !== undefined ? props.pin.top : (props.stickyOffset ?? 0);
    const centered = props.positionAbsolute && props.pin?.centerX;
    if (!centered && (props.width?.mode === "fill" || props.width?.mode === "relative" || !props.width)) {
      css.left = 0;
      css.right = 0;
    } else if (css.left === undefined) {
      css.left = 0;
    }
    css.zIndex = props.zIndex ?? 1000;
  }
  if (props.zIndex !== undefined) css.zIndex = props.zIndex;
  const transforms = css.transform ? [String(css.transform)] : [];
  if (props.perspective !== undefined || props.rotationX || props.rotationY || props.translateZ) {
    transforms.push(`perspective(${Math.max(1, props.perspective ?? 800)}px)`);
  }
  if (props.translateX || props.translateY || props.translateZ) {
    transforms.push(`translate3d(${props.translateX ?? 0}px, ${props.translateY ?? 0}px, ${props.translateZ ?? 0}px)`);
  }
  if (props.rotation) transforms.push(`rotate(${props.rotation}deg)`);
  if (props.rotationX) transforms.push(`rotateX(${props.rotationX}deg)`);
  if (props.rotationY) transforms.push(`rotateY(${props.rotationY}deg)`);
  if (props.scaleX !== undefined || props.scaleY !== undefined) {
    transforms.push(`scale(${props.scaleX ?? 1}, ${props.scaleY ?? 1})`);
  }
  if (transforms.length > 0) css.transform = transforms.join(" ");
  if (props.transformOriginX !== undefined || props.transformOriginY !== undefined) {
    css.transformOrigin = `${props.transformOriginX ?? 50}% ${props.transformOriginY ?? 50}%`;
  }
  if (props.rotationX || props.rotationY || props.translateZ) css.transformStyle = "preserve-3d";

  // ── container layout
  if (node.type === "frame" || node.type === "instance" || node.type === "collectionList") {
    const layout = props.layout ?? "absolute";
    if (layout === "stack") {
      css.display = "flex";
      css.flexDirection = props.direction ?? "column";
      css.gap = props.gap ?? 0;
      if (props.wrap) css.flexWrap = "wrap";
      css.alignItems = ALIGN_MAP[props.align ?? "start"];
      css.justifyContent = JUSTIFY_MAP[props.justify ?? "start"];
    } else if (layout === "grid") {
      css.display = "grid";
      css.gap = props.gap ?? 0;
      if (props.gridAutoFit) {
        css.gridTemplateColumns = `repeat(auto-fit, minmax(${props.gridMinItemWidth ?? 200}px, 1fr))`;
      } else {
        css.gridTemplateColumns = `repeat(${props.gridColumns ?? 3}, 1fr)`;
      }
      css.alignItems = ALIGN_MAP[props.align ?? "stretch"];
    } else {
      // absolute container: children position against it
      css.position = css.position === "absolute" || css.position === "fixed" ? css.position : "relative";
    }
    if (props.padding) {
      const p = props.padding;
      css.padding = `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
    }
  }

  // ── appearance
  if (props.fill) Object.assign(css, fillToCss(props.fill));
  if (props.border) {
    const b = props.border;
    if (b.perSide) {
      css.borderStyle = b.style;
      css.borderColor = b.color;
      css.borderTopWidth = b.perSide.top;
      css.borderRightWidth = b.perSide.right;
      css.borderBottomWidth = b.perSide.bottom;
      css.borderLeftWidth = b.perSide.left;
    } else if (b.width > 0) {
      css.border = `${b.width}px ${b.style} ${b.color}`;
    }
  }
  if (props.radius !== undefined) {
    if (typeof props.radius === "number") {
      if (props.radius > 0) css.borderRadius = props.radius;
    } else {
      const r = props.radius;
      css.borderRadius = `${r.tl}px ${r.tr}px ${r.br}px ${r.bl}px`;
    }
  }
  if (props.shadows && props.shadows.length > 0) css.boxShadow = shadowToCss(props.shadows);
  if (props.opacity !== undefined && props.opacity < 1) css.opacity = props.opacity;
  if (props.blur) css.filter = `blur(${props.blur}px)`;
  if (props.backdropBlur) css.backdropFilter = `blur(${props.backdropBlur}px)`;
  if (props.overflow && props.overflow !== "visible") css.overflow = props.overflow;
  if (props.visible === false) css.display = "none";
  if (props.cursor) css.cursor = props.cursor;

  // ── typography
  if (node.type === "text" || node.type === "frame" || node.type === "instance") {
    if (props.fontFamily) css.fontFamily = `"${props.fontFamily}", sans-serif`;
    if (props.fontSize !== undefined) css.fontSize = props.fontSize;
    if (props.fontWeight !== undefined) css.fontWeight = props.fontWeight;
    if (props.fontStyle) css.fontStyle = props.fontStyle;
    if (props.lineHeight !== undefined) css.lineHeight = props.lineHeight;
    if (props.letterSpacing !== undefined) css.letterSpacing = `${props.letterSpacing}px`;
    if (props.color) css.color = props.color;
    if (props.textAlign) css.textAlign = props.textAlign;
    if (props.textTransform && props.textTransform !== "none") css.textTransform = props.textTransform;
    if (props.textDecoration && props.textDecoration !== "none") css.textDecoration = props.textDecoration;
  }

  return css;
}
