import { buildTemplate, type TemplateId } from "@/insert/templates";
import type { BreakpointId, Node, SerializedProject, StyleProps } from "./types";

export type ProjectPatchOp =
  | { op: "setText"; nodeId: string; text: string }
  | { op: "setNodeFields"; nodeId: string; fields: Pick<Partial<Node>, "name" | "tag" | "textTag" | "alt" | "placeholder" | "inputType" | "link"> }
  | { op: "setStyles"; nodeIds: string[]; breakpoint: BreakpointId; styles: Partial<StyleProps> }
  | { op: "insertTemplate"; templateId: TemplateId; parentId: string; index?: number }
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

const BREAKPOINTS = new Set<BreakpointId>(["desktop", "tablet", "phone"]);
const NODE_TYPES = new Set(["frame", "text", "image", "icon", "instance", "collectionList"]);
const LAYOUTS = new Set(["absolute", "stack", "grid"]);
const SIZE_MODES = new Set(["fixed", "fill", "relative", "fit", "viewport"]);
const TAGS = new Set(["div", "section", "nav", "header", "footer", "main", "article", "aside", "button", "form", "input", "textarea"]);
const TEXT_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "blockquote", "code"]);
const NODE_FIELD_KEYS = new Set(["name", "tag", "textTag", "alt", "placeholder", "inputType", "link"]);

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
  }

  for (const page of project.pages) {
    if (!project.nodes[page.rootId]) errors.push(`Page ${page.name} has missing root ${page.rootId}.`);
    else if (project.nodes[page.rootId].parent !== null) errors.push(`Page root ${page.rootId} must not have a parent.`);
  }
  for (const component of project.components) {
    if (!project.nodes[component.rootId]) errors.push(`Component ${component.name} has missing root ${component.rootId}.`);
    else if (project.nodes[component.rootId].parent !== null) errors.push(`Component root ${component.rootId} must not have a parent.`);
  }

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
  for (const component of project.components) visit(component.rootId);
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
    }
  }

  const after = validateProject(next);
  if (!after.ok) throw new Error(`Patch would make project invalid: ${after.errors.join(" ")}`);
  next.meta.updatedAt = new Date().toISOString();
  return { project: next, changedNodeIds: [...changed], summary: patch.summary || "Applied AI patch." };
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
}

function validateStylePatch(styles: Partial<StyleProps>) {
  if (styles.layout && !LAYOUTS.has(styles.layout)) throw new Error(`Invalid layout ${styles.layout}.`);
  for (const key of ["width", "height"] as const) {
    const size = styles[key];
    if (size && !SIZE_MODES.has(size.mode)) throw new Error(`Invalid ${key} mode ${size.mode}.`);
  }
  if (styles.direction && !["row", "column"].includes(styles.direction)) throw new Error(`Invalid stack direction ${styles.direction}.`);
  if (styles.fill && !["solid", "linear", "radial", "image"].includes(styles.fill.type)) throw new Error(`Invalid fill type ${styles.fill.type}.`);
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
  if (project.pages.some((page) => page.rootId === id) || project.components.some((component) => component.rootId === id)) {
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
