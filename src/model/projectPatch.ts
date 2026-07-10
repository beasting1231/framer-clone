import { buildTemplate, type TemplateId } from "@/insert/templates";
import { pruneMissingAnimationTracks, syncClipDuration } from "./animation";
import { validateCustomCodeProposal } from "./customCode";
import { uid } from "./factory";
import { componentRootIds, componentVariants, nodeStyles } from "./resolve";
import type { AnimEasing, AnimProperty, AnimationClip, BreakpointId, Node, SerializedProject, StyleProps } from "./types";

export type ProjectPatchOp =
  | { op: "setText"; nodeId: string; text: string }
  | { op: "setNodeFields"; nodeId: string; fields: Pick<Partial<Node>, "name" | "tag" | "textTag" | "alt" | "placeholder" | "inputType" | "link"> }
  | { op: "setStyles"; nodeIds: string[]; breakpoint: BreakpointId; styles: Partial<StyleProps> }
  | {
      op: "addAppearAnimation";
      nodeIds: string[];
      name?: string;
      pageId?: string;
      preset?: "fade" | "fade-up" | "fade-down" | "fade-left" | "fade-right" | "fade-blur" | "fade-blur-up" | "scale-fade";
      duration?: number;
      delay?: number;
      stagger?: number;
      appearViewport?: number;
      easing?: AnimEasing;
    }
  | { op: "insertTemplate"; templateId: TemplateId; parentId: string; index?: number }
  | { op: "insertTemplateRelative"; templateId: TemplateId; anchorNodeId: string; position: "before" | "after" }
  | { op: "insertNodeTree"; parentId: string; index?: number; rootId: string; nodes: Record<string, Node> }
  | { op: "deleteNodes"; nodeIds: string[] }
  | { op: "reparent"; nodeId: string; parentId: string; index?: number }
  | { op: "reorderChild"; parentId: string; from: number; to: number };

export interface ProjectPatch {
  summary: string;
  ops: ProjectPatchOp[];
}

export interface PatchApplyResult {
  project: SerializedProject;
  changedNodeIds: string[];
  summary: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const BREAKPOINTS = new Set<BreakpointId>(["wide", "desktop", "tablet", "phone"]);
const NODE_TYPES = new Set(["frame", "text", "image", "icon", "instance", "collectionList"]);
const LAYOUTS = new Set(["absolute", "stack", "grid"]);
const SIZE_MODES = new Set(["fixed", "fill", "relative", "fit", "viewport"]);
const RADIAL_GRADIENT_ANCHORS = new Set([
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);
const TAGS = new Set(["div", "section", "nav", "header", "footer", "main", "article", "aside", "button", "form", "input", "textarea"]);
const TEXT_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "blockquote", "code"]);
const NODE_FIELD_KEYS = new Set(["name", "tag", "textTag", "alt", "placeholder", "inputType", "link"]);
const ANIM_PROPERTIES = new Set<AnimProperty>(["x", "y", "scale", "rotate", "opacity", "blur"]);
const ANIM_EASINGS = new Set<AnimEasing>(["linear", "ease", "ease-in", "ease-out", "ease-in-out"]);
const STYLE_KEYS = new Set<keyof StyleProps>([
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "x",
  "y",
  "positionAbsolute",
  "pin",
  "sticky",
  "stickyOffset",
  "zIndex",
  "translateX",
  "translateY",
  "translateZ",
  "rotation",
  "rotationX",
  "rotationY",
  "scaleX",
  "scaleY",
  "perspective",
  "transformOriginX",
  "transformOriginY",
  "layout",
  "direction",
  "gap",
  "wrap",
  "align",
  "justify",
  "padding",
  "gridColumns",
  "gridMinItemWidth",
  "gridAutoFit",
  "fill",
  "border",
  "radius",
  "shadows",
  "opacity",
  "blur",
  "backdropBlur",
  "overflow",
  "visible",
  "cursor",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "color",
  "colorStyleId",
  "textStyleId",
  "textAlign",
  "textTransform",
  "textDecoration",
]);

export function parseProjectPatch(text: string): ProjectPatch {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("```") ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "") : trimmed;
  const parsed = JSON.parse(jsonText) as unknown;
  assertPatch(parsed);
  return parsed;
}

export function validateProject(project: SerializedProject): ValidationResult {
  const errors: string[] = [];
  if (!project || typeof project !== "object") return { ok: false, errors: ["Project is not an object."] };
  if (project.version !== 1) errors.push("Project version must be 1.");
  if (!project.meta?.id || !project.meta?.name) errors.push("Project meta is incomplete.");
  if (!Array.isArray(project.pages) || project.pages.length === 0) errors.push("Project must have at least one page.");
  if (!project.homePageId || !project.pages?.some((page) => page.id === project.homePageId)) errors.push("Home page is missing.");
  if (!project.nodes || typeof project.nodes !== "object") errors.push("Project nodes map is missing.");
  if (!Array.isArray(project.components)) errors.push("Components must be an array.");
  if (!project.cms || !Array.isArray(project.cms.collections)) errors.push("CMS collections must be an array.");
  if (!Array.isArray(project.assets)) errors.push("Assets must be an array.");
  if (!Array.isArray(project.colorStyles)) errors.push("Color styles must be an array.");
  if (!Array.isArray(project.textStyles)) errors.push("Text styles must be an array.");
  if (errors.length) return { ok: false, errors };

  const nodeEntries = Object.entries(project.nodes);
  for (const [id, node] of nodeEntries) {
    if (id !== node.id) errors.push(`Node key ${id} does not match node id ${node.id}.`);
    validateNode(node, errors);
    if (node.parent && !project.nodes[node.parent]) errors.push(`Node ${id} has missing parent ${node.parent}.`);
    for (const childId of node.children) {
      const child = project.nodes[childId];
      if (!child) errors.push(`Node ${id} references missing child ${childId}.`);
      else if (child.parent !== id) errors.push(`Node ${childId} parent does not point back to ${id}.`);
    }
    for (const breakpoint of BREAKPOINTS) {
      const resolved = nodeStyles(node, project, breakpoint);
      if ((resolved.gap ?? 0) < 0 && resolved.layout !== "stack") {
        errors.push(`Node ${id} has negative gap at ${breakpoint}, but negative gap is supported only for stack layout.`);
      }
    }
  }

  for (const page of project.pages) {
    if (!project.nodes[page.rootId]) errors.push(`Page ${page.name} has missing root ${page.rootId}.`);
    else if (project.nodes[page.rootId].parent !== null) errors.push(`Page root ${page.rootId} must not have a parent.`);
  }
  for (const component of project.components) {
    const variants = componentVariants(component);
    const variantIds = new Set<string>();
    for (const variant of variants) {
      if (variantIds.has(variant.id)) errors.push(`Component ${component.name} has duplicate variant id ${variant.id}.`);
      variantIds.add(variant.id);
      if (!project.nodes[variant.rootId]) errors.push(`Component ${component.name} variant ${variant.name} has missing root ${variant.rootId}.`);
      else if (project.nodes[variant.rootId].parent !== null) errors.push(`Component variant root ${variant.rootId} must not have a parent.`);
    }
    for (const [breakpoint, variantId] of Object.entries(component.variantByBreakpoint ?? {})) {
      if (!BREAKPOINTS.has(breakpoint as BreakpointId)) errors.push(`Component ${component.name} has invalid breakpoint mapping ${breakpoint}.`);
      if (variantId && !variantIds.has(variantId)) errors.push(`Component ${component.name} maps ${breakpoint} to missing variant ${variantId}.`);
    }
  }
  validateAnimations(project, errors);

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      errors.push(`Node tree contains a cycle at ${id}.`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const childId of project.nodes[id]?.children ?? []) visit(childId);
    visiting.delete(id);
    visited.add(id);
  };
  for (const page of project.pages) visit(page.rootId);
  for (const component of project.components) {
    for (const rootId of componentRootIds(component)) visit(rootId);
  }
  for (const id of Object.keys(project.nodes)) {
    if (!visited.has(id)) errors.push(`Node ${id} is orphaned.`);
  }

  return { ok: errors.length === 0, errors };
}

export function applyProjectPatch(project: SerializedProject, patch: ProjectPatch): PatchApplyResult {
  assertPatch(patch);
  const before = validateProject(project);
  if (!before.ok) throw new Error(`Existing project is invalid: ${before.errors.join(" ")}`);
  const next = structuredClone(project);
  const changed = new Set<string>();

  for (const op of patch.ops) {
    switch (op.op) {
      case "setText": {
        const node = requireNode(next, op.nodeId);
        if (node.type !== "text") throw new Error(`Node ${op.nodeId} is not a text node.`);
        node.text = op.text;
        changed.add(node.id);
        break;
      }
      case "setNodeFields": {
        const node = requireNode(next, op.nodeId);
        for (const [key, value] of Object.entries(op.fields)) {
          if (!NODE_FIELD_KEYS.has(key)) throw new Error(`Field ${key} cannot be changed by the agent.`);
          (node as unknown as Record<string, unknown>)[key] = value;
        }
        changed.add(node.id);
        break;
      }
      case "setStyles": {
        if (!BREAKPOINTS.has(op.breakpoint)) throw new Error(`Invalid breakpoint ${op.breakpoint}.`);
        validateStylePatch(op.styles);
        for (const id of op.nodeIds) {
          const node = requireNode(next, id);
          const styles = { ...node.styles };
          if (op.breakpoint === "desktop") styles.desktop = { ...styles.desktop, ...op.styles };
          else styles[op.breakpoint] = { ...(styles[op.breakpoint] ?? {}), ...op.styles };
          node.styles = styles;
          changed.add(id);
        }
        break;
      }
      case "addAppearAnimation": {
        const clip = buildAppearAnimation(next, op);
        next.animations ??= [];
        next.animations.push(clip);
        for (const id of op.nodeIds) changed.add(id);
        break;
      }
      case "insertTemplate": {
        const parent = requireNode(next, op.parentId);
        const built = buildTemplate(op.templateId);
        if (!built) throw new Error(`Unknown template ${op.templateId}.`);
        const index = op.templateId === "section-navbar" ? 0 : clampIndex(op.index, parent.children.length);
        built.root.parent = parent.id;
        parent.children.splice(index, 0, built.root.id);
        Object.assign(next.nodes, built.nodes);
        changed.add(built.root.id);
        break;
      }
      case "insertTemplateRelative": {
        const anchor = requireNode(next, op.anchorNodeId);
        if (!anchor.parent) throw new Error(`Anchor node ${op.anchorNodeId} has no parent.`);
        const parent = requireNode(next, anchor.parent);
        const anchorIndex = parent.children.indexOf(anchor.id);
        if (anchorIndex < 0) throw new Error(`Anchor node ${op.anchorNodeId} is not in its parent children.`);
        const built = buildTemplate(op.templateId);
        if (!built) throw new Error(`Unknown template ${op.templateId}.`);
        const index = op.templateId === "section-navbar" ? 0 : anchorIndex + (op.position === "after" ? 1 : 0);
        built.root.parent = parent.id;
        parent.children.splice(index, 0, built.root.id);
        Object.assign(next.nodes, built.nodes);
        changed.add(built.root.id);
        changed.add(parent.id);
        break;
      }
      case "insertNodeTree": {
        const parent = requireNode(next, op.parentId);
        const tree = normalizeInsertedTree(op, next);
        const root = tree.nodes[tree.rootId];
        root.parent = parent.id;
        parent.children.splice(clampIndex(op.index, parent.children.length), 0, root.id);
        Object.assign(next.nodes, tree.nodes);
        for (const id of Object.keys(tree.nodes)) changed.add(id);
        break;
      }
      case "deleteNodes": {
        for (const id of op.nodeIds) deleteNode(next, id, changed);
        break;
      }
      case "reparent": {
        const node = requireNode(next, op.nodeId);
        const parent = requireNode(next, op.parentId);
        if (node.parent) {
          const oldParent = requireNode(next, node.parent);
          oldParent.children = oldParent.children.filter((id) => id !== node.id);
        }
        node.parent = parent.id;
        parent.children.splice(clampIndex(op.index, parent.children.length), 0, node.id);
        changed.add(node.id);
        changed.add(parent.id);
        break;
      }
      case "reorderChild": {
        const parent = requireNode(next, op.parentId);
        if (op.from < 0 || op.from >= parent.children.length || op.to < 0 || op.to >= parent.children.length) {
          throw new Error(`Invalid reorder indexes for ${op.parentId}.`);
        }
        const [moved] = parent.children.splice(op.from, 1);
        parent.children.splice(op.to, 0, moved);
        changed.add(parent.id);
        break;
      }
      default: {
        throw new Error(`Unsupported patch operation ${(op as { op?: string }).op ?? "unknown"}.`);
      }
    }
  }

  pruneMissingAnimationTracks(next);
  const after = validateProject(next);
  if (!after.ok) throw new Error(`Patch would make project invalid: ${after.errors.join(" ")}`);
  next.meta.updatedAt = new Date().toISOString();
  return { project: next, changedNodeIds: [...changed], summary: summarizePatchOps(patch) };
}

function summarizePatchOps(patch: ProjectPatch) {
  if (patch.ops.length === 0) return patch.summary || "No project changes were needed.";
  const counts = new Map<string, number>();
  for (const op of patch.ops) counts.set(op.op, (counts.get(op.op) ?? 0) + 1);
  return `Applied ${patch.ops.length} validated editor change${patch.ops.length === 1 ? "" : "s"}: ${[...counts.entries()]
    .map(([op, count]) => `${count} ${op}`)
    .join(", ")}.`;
}

function assertPatch(value: unknown): asserts value is ProjectPatch {
  if (!value || typeof value !== "object") throw new Error("Agent response is not an object.");
  const patch = value as ProjectPatch;
  if (typeof patch.summary !== "string") throw new Error("Patch summary must be a string.");
  if (!Array.isArray(patch.ops)) throw new Error("Patch ops must be an array.");
  if (patch.ops.length > 40) throw new Error("Patch contains too many operations.");
  for (const op of patch.ops as unknown[]) {
    if (!op || typeof op !== "object" || typeof (op as { op?: unknown }).op !== "string") {
      throw new Error("Every patch operation must have an op string.");
    }
  }
}

function validateNode(node: Node, errors: string[]) {
  if (!NODE_TYPES.has(node.type)) errors.push(`Node ${node.id} has invalid type ${node.type}.`);
  if (typeof node.name !== "string") errors.push(`Node ${node.id} has invalid name.`);
  if (!Array.isArray(node.children)) errors.push(`Node ${node.id} children must be an array.`);
  if (!node.styles?.desktop) errors.push(`Node ${node.id} must have desktop styles.`);
  for (const bp of Object.keys(node.styles ?? {})) {
    if (!BREAKPOINTS.has(bp as BreakpointId)) errors.push(`Node ${node.id} has invalid breakpoint ${bp}.`);
    else {
      try {
        validateStylePatch(node.styles[bp as BreakpointId] ?? {});
      } catch (error) {
        errors.push(`Node ${node.id} has invalid ${bp} styles: ${String((error as Error).message || error)}`);
      }
    }
  }
  if (node.tag && !TAGS.has(node.tag)) errors.push(`Node ${node.id} has invalid tag ${node.tag}.`);
  if (node.textTag && !TEXT_TAGS.has(node.textTag)) errors.push(`Node ${node.id} has invalid text tag ${node.textTag}.`);
  if (node.customCode) {
    const customErrors = validateCustomCodeProposal({ nodeId: node.id, ...node.customCode });
    for (const error of customErrors) errors.push(`Node ${node.id} has invalid custom code: ${error}`);
  }
}

function validateStylePatch(styles: Partial<StyleProps>) {
  for (const key of Object.keys(styles)) {
    if (!STYLE_KEYS.has(key as keyof StyleProps)) throw new Error(`Unsupported style property ${key}. Use project StyleProps, not raw CSS.`);
  }
  if (styles.layout && !LAYOUTS.has(styles.layout)) throw new Error(`Invalid layout ${styles.layout}.`);
  for (const key of ["width", "height"] as const) {
    const size = styles[key];
    if (size && !SIZE_MODES.has(size.mode)) throw new Error(`Invalid ${key} mode ${size.mode}.`);
  }
  if (styles.direction && !["row", "column"].includes(styles.direction)) throw new Error(`Invalid stack direction ${styles.direction}.`);
  if (styles.fill && !["solid", "linear", "radial", "image"].includes(styles.fill.type)) throw new Error(`Invalid fill type ${styles.fill.type}.`);
  if (styles.fill?.type === "radial" && styles.fill.anchor && !RADIAL_GRADIENT_ANCHORS.has(styles.fill.anchor)) {
    throw new Error(`Invalid radial gradient anchor ${styles.fill.anchor}.`);
  }
}

function validateAnimations(project: SerializedProject, errors: string[]) {
  if (project.animations === undefined) return;
  if (!Array.isArray(project.animations)) {
    errors.push("Animations must be an array.");
    return;
  }
  const pageIds = new Set(project.pages.map((page) => page.id));
  const clipIds = new Set<string>();
  for (const clip of project.animations) {
    if (!clip || typeof clip !== "object") {
      errors.push("Animation clip must be an object.");
      continue;
    }
    if (!clip.id || typeof clip.id !== "string") errors.push("Animation clip has invalid id.");
    else if (clipIds.has(clip.id)) errors.push(`Animation clip ${clip.id} is duplicated.`);
    else clipIds.add(clip.id);
    if (!clip.name || typeof clip.name !== "string") errors.push(`Animation clip ${clip.id} has invalid name.`);
    if (!pageIds.has(clip.pageId)) errors.push(`Animation clip ${clip.id} references missing page ${clip.pageId}.`);
    if (!["load", "appear"].includes(clip.trigger)) errors.push(`Animation clip ${clip.id} has invalid trigger ${clip.trigger}.`);
    if (!Number.isFinite(clip.duration) || clip.duration < 0) errors.push(`Animation clip ${clip.id} has invalid duration.`);
    if (clip.appearViewport !== undefined && (!Number.isFinite(clip.appearViewport) || clip.appearViewport < 0 || clip.appearViewport > 100)) {
      errors.push(`Animation clip ${clip.id} has invalid appearViewport.`);
    }
    if (!Array.isArray(clip.tracks)) {
      errors.push(`Animation clip ${clip.id} tracks must be an array.`);
      continue;
    }
    const trackKeys = new Set<string>();
    for (const track of clip.tracks) {
      if (!track.id || typeof track.id !== "string") errors.push(`Animation clip ${clip.id} has a track with invalid id.`);
      if (!project.nodes[track.nodeId]) errors.push(`Animation track ${track.id} references missing node ${track.nodeId}.`);
      if (!ANIM_PROPERTIES.has(track.property)) errors.push(`Animation track ${track.id} has invalid property ${track.property}.`);
      const trackKey = `${track.nodeId}:${track.property}`;
      if (trackKeys.has(trackKey)) errors.push(`Animation clip ${clip.id} has duplicate ${track.property} track for ${track.nodeId}.`);
      trackKeys.add(trackKey);
      if (!Array.isArray(track.keyframes) || track.keyframes.length === 0) {
        errors.push(`Animation track ${track.id} must have keyframes.`);
        continue;
      }
      let previousTime = -1;
      const keyframeIds = new Set<string>();
      for (const keyframe of track.keyframes) {
        if (!keyframe.id || typeof keyframe.id !== "string") errors.push(`Animation track ${track.id} has keyframe with invalid id.`);
        else if (keyframeIds.has(keyframe.id)) errors.push(`Animation track ${track.id} has duplicated keyframe ${keyframe.id}.`);
        else keyframeIds.add(keyframe.id);
        if (!Number.isFinite(keyframe.time) || keyframe.time < 0) errors.push(`Animation track ${track.id} has invalid keyframe time.`);
        if (keyframe.time < previousTime) errors.push(`Animation track ${track.id} keyframes must be sorted by time.`);
        previousTime = keyframe.time;
        if (!Number.isFinite(keyframe.value)) errors.push(`Animation track ${track.id} has invalid keyframe value.`);
        if (!ANIM_EASINGS.has(keyframe.easing)) errors.push(`Animation track ${track.id} has invalid easing ${keyframe.easing}.`);
      }
    }
  }
}

function buildAppearAnimation(project: SerializedProject, op: Extract<ProjectPatchOp, { op: "addAppearAnimation" }>): AnimationClip {
  if (!Array.isArray(op.nodeIds) || op.nodeIds.length === 0) throw new Error("addAppearAnimation requires at least one nodeId.");
  const uniqueNodeIds = [...new Set(op.nodeIds)];
  const pageId = op.pageId ?? pageIdForNode(project, uniqueNodeIds[0]);
  if (!pageId || !project.pages.some((page) => page.id === pageId)) throw new Error("addAppearAnimation could not determine a valid page.");
  for (const nodeId of uniqueNodeIds) {
    requireNode(project, nodeId);
    const nodePageId = pageIdForNode(project, nodeId);
    if (nodePageId && nodePageId !== pageId) throw new Error(`Node ${nodeId} belongs to a different page.`);
  }

  const duration = clampNumber(op.duration, 250, 4000, 700);
  const delay = clampNumber(op.delay, 0, 10000, 0);
  const stagger = clampNumber(op.stagger, 0, 2000, 100);
  const easing = ANIM_EASINGS.has(op.easing ?? "ease-out") ? op.easing ?? "ease-out" : "ease-out";
  const preset = op.preset ?? "fade-blur-up";
  const tracks: AnimationClip["tracks"] = [];
  const pushTrack = (nodeId: string, property: AnimProperty, start: number, end: number, from: number, to: number) => {
    tracks.push({
      id: uid(),
      nodeId,
      property,
      keyframes: [
        { id: uid(), time: start, value: from, easing },
        { id: uid(), time: end, value: to, easing },
      ],
    });
  };

  uniqueNodeIds.forEach((nodeId, index) => {
    const start = Math.round(delay + index * stagger);
    const end = Math.round(start + duration);
    switch (preset) {
      case "fade":
        pushTrack(nodeId, "opacity", start, end, 0, 1);
        break;
      case "fade-up":
        pushTrack(nodeId, "y", start, end, 40, 0);
        pushTrack(nodeId, "opacity", start, end, 0, 1);
        break;
      case "fade-down":
        pushTrack(nodeId, "y", start, end, -40, 0);
        pushTrack(nodeId, "opacity", start, end, 0, 1);
        break;
      case "fade-left":
        pushTrack(nodeId, "x", start, end, 40, 0);
        pushTrack(nodeId, "opacity", start, end, 0, 1);
        break;
      case "fade-right":
        pushTrack(nodeId, "x", start, end, -40, 0);
        pushTrack(nodeId, "opacity", start, end, 0, 1);
        break;
      case "fade-blur":
        pushTrack(nodeId, "blur", start, end, 14, 0);
        pushTrack(nodeId, "opacity", start, end, 0, 1);
        break;
      case "scale-fade":
        pushTrack(nodeId, "scale", start, end, 0.92, 1);
        pushTrack(nodeId, "opacity", start, end, 0, 1);
        break;
      case "fade-blur-up":
      default:
        pushTrack(nodeId, "y", start, end, 42, 0);
        pushTrack(nodeId, "blur", start, end, 14, 0);
        pushTrack(nodeId, "opacity", start, end, 0, 1);
        break;
    }
  });

  const clip: AnimationClip = {
    id: uid(),
    name: uniqueClipName(project, pageId, op.name || "AI appear animation"),
    pageId,
    duration: 0,
    trigger: "appear",
    appearViewport: clampNumber(op.appearViewport, 0, 100, 20),
    loop: false,
    tracks,
  };
  syncClipDuration(clip);
  return clip;
}

function pageIdForNode(project: SerializedProject, nodeId: string): string | null {
  const seen = new Set<string>();
  let current: Node | undefined = project.nodes[nodeId];
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const page = project.pages.find((candidate) => candidate.rootId === current?.id);
    if (page) return page.id;
    current = current.parent ? project.nodes[current.parent] : undefined;
  }
  return null;
}

function uniqueClipName(project: SerializedProject, pageId: string, baseName: string) {
  const names = new Set((project.animations ?? []).filter((clip) => clip.pageId === pageId).map((clip) => clip.name));
  let name = baseName.trim() || "AI appear animation";
  let next = 2;
  while (names.has(name)) name = `${baseName} (${next++})`;
  return name;
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function requireNode(project: SerializedProject, id: string): Node {
  const node = project.nodes[id];
  if (!node) throw new Error(`Node ${id} does not exist.`);
  return node;
}

function clampIndex(index: number | undefined, length: number) {
  if (!Number.isFinite(index)) return length;
  return Math.max(0, Math.min(Number(index), length));
}

function deleteNode(project: SerializedProject, id: string, changed: Set<string>) {
  const node = requireNode(project, id);
  if (project.pages.some((page) => page.rootId === id) || project.components.some((component) => componentRootIds(component).includes(id))) {
    throw new Error(`Cannot delete root node ${id}.`);
  }
  if (node.parent) {
    const parent = requireNode(project, node.parent);
    parent.children = parent.children.filter((childId) => childId !== id);
    changed.add(parent.id);
  }
  const remove = (nodeId: string) => {
    const current = requireNode(project, nodeId);
    for (const childId of current.children) remove(childId);
    delete project.nodes[nodeId];
    changed.add(nodeId);
  };
  remove(id);
}

function normalizeInsertedTree(op: Extract<ProjectPatchOp, { op: "insertNodeTree" }>, project: SerializedProject) {
  const inputNodes = Array.isArray(op.nodes) ? Object.fromEntries((op.nodes as Node[]).map((node) => [node.id, node])) : op.nodes;
  const ids = Object.keys(inputNodes);
  if (!inputNodes[op.rootId]) throw new Error("Inserted tree root is missing.");
  const remap = new Map<string, string>();
  for (const id of ids) remap.set(id, project.nodes[id] ? `ai_${id}_${Math.random().toString(36).slice(2, 7)}` : id);
  const nodes: Record<string, Node> = {};
  for (const id of ids) {
    const source = structuredClone(inputNodes[id]);
    source.id = remap.get(id)!;
    source.parent = source.parent ? remap.get(source.parent) ?? source.parent : null;
    source.children = source.children.map((childId) => remap.get(childId) ?? childId);
    nodes[source.id] = source;
  }
  return { rootId: remap.get(op.rootId)!, nodes };
}
