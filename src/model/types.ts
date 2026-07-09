// ─────────────────────────────────────────────────────────────────────────────
// Core document model. This is the single source of truth shared by the
// editor, the preview renderer, the local server, and the code generator.
// A project is stored on disk as projects/<id>/framer.json (SerializedProject).
// ─────────────────────────────────────────────────────────────────────────────

export type BreakpointId = "desktop" | "tablet" | "phone";

export interface BreakpointDef {
  id: BreakpointId;
  label: string;
  width: number;
  /** min-width used when compiling to media queries (null = base) */
  minWidth: number | null;
  maxWidth: number | null;
}

export const BREAKPOINTS: BreakpointDef[] = [
  { id: "desktop", label: "Desktop", width: 1200, minWidth: 810, maxWidth: null },
  { id: "tablet", label: "Tablet", width: 810, minWidth: 390, maxWidth: 809.98 },
  { id: "phone", label: "Phone", width: 390, minWidth: null, maxWidth: 389.98 },
];

/** Cascade order: phone inherits from tablet which inherits from desktop. */
export const BREAKPOINT_CASCADE: BreakpointId[] = ["desktop", "tablet", "phone"];

// ── Styling primitives ───────────────────────────────────────────────────────

export type SizeMode = "fixed" | "fill" | "relative" | "fit" | "viewport";

export interface SizeValue {
  mode: SizeMode;
  /** px for fixed, % for relative, vw/vh for viewport. Unused for fill/fit. */
  value?: number;
  /** viewport mode only: which viewport unit (defaults to the natural axis) */
  unit?: "vw" | "vh";
}

export interface GradientStop {
  color: string;
  /** 0..1 */
  position: number;
}

export type Fill =
  | { type: "solid"; color: string; styleId?: string }
  | { type: "linear"; angle: number; stops: GradientStop[] }
  | { type: "radial"; stops: GradientStop[] }
  | { type: "image"; src: string; fit: "cover" | "contain" | "fill" | "tile"; alt?: string };

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset?: boolean;
}

export interface BorderProps {
  width: number;
  color: string;
  style: "solid" | "dashed" | "dotted";
  styleId?: string;
  /** per-side widths override `width` when set */
  perSide?: { top: number; right: number; bottom: number; left: number };
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CornerRadius {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

export type LayoutMode = "absolute" | "stack" | "grid";

export interface StyleProps {
  // position & size
  width?: SizeValue;
  height?: SizeValue;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  /** coordinates within an absolute-layout parent */
  x?: number;
  y?: number;
  /** absolute pinning within any parent (Framer's "absolute position" toggle) */
  positionAbsolute?: boolean;
  pin?: { left?: number; right?: number; top?: number; bottom?: number; centerX?: boolean; centerY?: boolean };
  sticky?: boolean;
  stickyOffset?: number;
  zIndex?: number;
  rotation?: number;

  // layout (container)
  layout?: LayoutMode;
  direction?: "row" | "column";
  gap?: number;
  wrap?: boolean;
  /** cross-axis alignment */
  align?: "start" | "center" | "end" | "stretch";
  /** main-axis distribution */
  justify?: "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
  padding?: Padding;
  gridColumns?: number;
  gridMinItemWidth?: number;
  gridAutoFit?: boolean;

  // appearance
  fill?: Fill | null;
  border?: BorderProps | null;
  radius?: number | CornerRadius;
  shadows?: Shadow[];
  opacity?: number;
  blur?: number;
  backdropBlur?: number;
  overflow?: "visible" | "hidden" | "auto";
  visible?: boolean;
  cursor?: string;

  // typography
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  lineHeight?: number; // multiplier
  letterSpacing?: number; // px
  color?: string;
  colorStyleId?: string;
  textStyleId?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecoration?: "none" | "underline" | "line-through";
}

/** Styles stored per breakpoint; tablet/phone are sparse overrides. */
export interface ResponsiveStyles {
  desktop: StyleProps;
  tablet?: StyleProps;
  phone?: StyleProps;
}

// ── Effects / interactions ───────────────────────────────────────────────────

export type EntrancePreset =
  | "none"
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "scale"
  | "blur";

export interface EntranceEffect {
  preset: EntrancePreset;
  duration: number; // seconds
  delay: number;
  /** trigger when scrolled into view instead of on load */
  onScroll: boolean;
  /** stagger children of this node */
  staggerChildren?: number;
}

export interface HoverEffect {
  scale?: number;
  opacity?: number;
  rotate?: number;
  y?: number;
  /** @deprecated use styles.fill */
  fill?: Fill | null;
  /** @deprecated use styles.color */
  color?: string;
  /** appearance overrides applied on :hover */
  styles?: Partial<StyleProps>;
  duration: number;
}

export interface Effects {
  entrance?: EntranceEffect;
  hover?: HoverEffect;
  pressScale?: number;
}

// ── Timeline animations ──────────────────────────────────────────────────────

export type AnimProperty = "x" | "y" | "scale" | "rotate" | "opacity" | "blur";

export type AnimEasing = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";

export interface AnimKeyframe {
  id: string;
  /** milliseconds from clip start */
  time: number;
  value: number;
  /** easing towards the NEXT keyframe */
  easing: AnimEasing;
}

export interface AnimTrack {
  id: string;
  nodeId: string;
  property: AnimProperty;
  keyframes: AnimKeyframe[];
}

export type AnimTrigger = "load" | "appear";

export interface AnimationClip {
  id: string;
  name: string;
  /** the page whose layers this clip animates */
  pageId: string;
  /** milliseconds; derived from the latest keyframe time */
  duration: number;
  trigger: AnimTrigger;
  /** appear trigger: % from bottom of viewport (0–100) where animation fires */
  appearViewport?: number;
  loop?: boolean;
  tracks: AnimTrack[];
}

export const ANIM_PROPERTIES: { id: AnimProperty; label: string; unit: string; defaultValue: number; min?: number; max?: number; step: number }[] = [
  { id: "x", label: "X", unit: "px", defaultValue: 0, step: 1 },
  { id: "y", label: "Y", unit: "px", defaultValue: 0, step: 1 },
  { id: "scale", label: "Scale", unit: "×", defaultValue: 1, min: 0, step: 0.05 },
  { id: "rotate", label: "Rotate", unit: "°", defaultValue: 0, step: 1 },
  { id: "opacity", label: "Opacity", unit: "", defaultValue: 1, min: 0, max: 1, step: 0.05 },
  { id: "blur", label: "Blur", unit: "px", defaultValue: 0, min: 0, step: 1 },
];

// ── Nodes ────────────────────────────────────────────────────────────────────

export type NodeType = "frame" | "text" | "image" | "icon" | "instance" | "collectionList";

export type SemanticTag =
  | "div"
  | "section"
  | "nav"
  | "header"
  | "footer"
  | "main"
  | "article"
  | "aside"
  | "button"
  | "form"
  | "input"
  | "textarea";

export type TextTag = "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "span" | "blockquote" | "code";

export interface LinkTarget {
  type: "page" | "url" | "email" | "cms-detail";
  pageId?: string;
  url?: string;
  newTab?: boolean;
  /** for cms-detail: bind link to the current entry's detail page */
  collectionId?: string;
}

/** CMS binding: node content driven by a collection field. */
export interface CmsBinding {
  fieldId: string;
}

export interface Node {
  id: string;
  type: NodeType;
  name: string;
  parent: string | null;
  children: string[];
  locked?: boolean;
  styles: ResponsiveStyles;
  effects?: Effects;
  link?: LinkTarget;

  // frame
  tag?: SemanticTag;

  // text
  text?: string;
  textTag?: TextTag;

  // image / icon
  src?: string;
  alt?: string;
  objectFit?: "cover" | "contain" | "fill";
  /** icon: inline svg path markup */
  svg?: string;

  // input / textarea
  placeholder?: string;
  inputType?: string;

  // component instance
  componentId?: string;
  /** overrides keyed by master node id */
  overrides?: Record<string, InstanceOverride>;

  // CMS
  binding?: CmsBinding;
  collectionId?: string;
  /** collectionList: max entries to show (0 = all) */
  limit?: number;
}

export interface InstanceOverride {
  text?: string;
  src?: string;
  alt?: string;
  link?: LinkTarget;
  fill?: Fill | null;
  color?: string;
  visible?: boolean;
}

// ── Pages / components / CMS / assets ────────────────────────────────────────

export interface Page {
  id: string;
  name: string;
  /** url path, e.g. "/", "/about", or "/blog/:slug" for cms templates */
  path: string;
  rootId: string;
  kind: "page" | "cms-template";
  collectionId?: string;
}

export interface ComponentDef {
  id: string;
  name: string;
  rootId: string;
}

export type CmsFieldType = "text" | "richText" | "image" | "number" | "date" | "link" | "boolean" | "color";

export interface CmsField {
  id: string;
  name: string;
  type: CmsFieldType;
}

export interface CmsEntry {
  id: string;
  slug: string;
  values: Record<string, string | number | boolean>;
}

export interface CmsCollection {
  id: string;
  name: string;
  fields: CmsField[];
  entries: CmsEntry[];
}

export interface AssetMeta {
  id: string;
  name: string;
  /** file name inside the project assets/ dir */
  file: string;
  width?: number;
  height?: number;
}

export interface ColorStyle {
  id: string;
  name: string;
  color: string;
}

export interface TextStyle {
  id: string;
  name: string;
  props: Pick<
    StyleProps,
    "fontFamily" | "fontSize" | "fontWeight" | "lineHeight" | "letterSpacing" | "textTransform"
  >;
  /** tablet/phone font-size overrides */
  responsive?: { tablet?: number; phone?: number };
}

// ── Project ──────────────────────────────────────────────────────────────────

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedProject {
  version: 1;
  meta: ProjectMeta;
  pages: Page[];
  homePageId: string;
  nodes: Record<string, Node>;
  components: ComponentDef[];
  cms: { collections: CmsCollection[] };
  assets: AssetMeta[];
  colorStyles: ColorStyle[];
  textStyles: TextStyle[];
  animations?: AnimationClip[];
}
