import {
  BREAKPOINT_CASCADE,
  type BreakpointId,
  type Node,
  type ResponsiveStyles,
  type SerializedProject,
  type StyleProps,
} from "./types";

/**
 * Resolve the effective styles of a node at a given breakpoint by cascading
 * desktop → tablet → phone (desktop-first, like Framer).
 */
export function resolveStyles(styles: ResponsiveStyles, breakpoint: BreakpointId): StyleProps {
  const idx = BREAKPOINT_CASCADE.indexOf(breakpoint);
  let out: StyleProps = { ...styles.desktop };
  for (let i = 1; i <= idx; i++) {
    const bp = BREAKPOINT_CASCADE[i];
    const overrides = styles[bp as "tablet" | "phone"];
    if (overrides) out = { ...out, ...overrides };
  }
  return out;
}

/** Which properties have an explicit override at the given breakpoint. */
export function overriddenKeys(styles: ResponsiveStyles, breakpoint: BreakpointId): Set<keyof StyleProps> {
  if (breakpoint === "desktop") return new Set();
  const overrides = styles[breakpoint];
  return new Set(overrides ? (Object.keys(overrides) as (keyof StyleProps)[]) : []);
}

/** Apply shared color/text styles from the project into resolved props. */
export function applySharedStyles(props: StyleProps, project: SerializedProject, breakpoint: BreakpointId): StyleProps {
  let out = props;
  if (props.textStyleId) {
    const ts = project.textStyles.find((t) => t.id === props.textStyleId);
    if (ts) {
      const responsiveSize =
        breakpoint === "phone"
          ? (ts.responsive?.phone ?? ts.responsive?.tablet)
          : breakpoint === "tablet"
            ? ts.responsive?.tablet
            : undefined;
      out = { ...ts.props, ...(responsiveSize ? { fontSize: responsiveSize } : {}), ...out };
      // explicit node props win over text style, but the style fills gaps
      for (const key of Object.keys(ts.props) as (keyof StyleProps)[]) {
        if (out[key] === undefined) (out as Record<string, unknown>)[key] = ts.props[key as keyof typeof ts.props];
      }
    }
  }
  if (props.colorStyleId) {
    const cs = project.colorStyles.find((c) => c.id === props.colorStyleId);
    if (cs) out = { ...out, color: cs.color };
  }
  const fillProp = out.fill;
  if (fillProp && fillProp.type === "solid" && fillProp.styleId) {
    const cs = project.colorStyles.find((c) => c.id === fillProp.styleId);
    if (cs) out = { ...out, fill: { ...fillProp, color: cs.color } };
  }
  return out;
}

/** Fully resolved styles for a node at a breakpoint, including shared styles. */
export function nodeStyles(node: Node, project: SerializedProject, breakpoint: BreakpointId): StyleProps {
  return applySharedStyles(resolveStyles(node.styles, breakpoint), project, breakpoint);
}

/** Walk a subtree depth-first, calling visit for each node id. */
export function walkTree(
  nodes: Record<string, Node>,
  rootId: string,
  visit: (node: Node, depth: number) => void,
  depth = 0,
): void {
  const node = nodes[rootId];
  if (!node) return;
  visit(node, depth);
  for (const childId of node.children) walkTree(nodes, childId, visit, depth + 1);
}

/** Collect all node ids in a subtree (including the root). */
export function collectSubtree(nodes: Record<string, Node>, rootId: string): string[] {
  const out: string[] = [];
  walkTree(nodes, rootId, (n) => out.push(n.id));
  return out;
}

/** Find the ancestor chain from a node up to the root (inclusive of both). */
export function ancestorChain(nodes: Record<string, Node>, id: string): string[] {
  const chain: string[] = [];
  let cur: string | null = id;
  while (cur) {
    chain.push(cur);
    cur = nodes[cur]?.parent ?? null;
  }
  return chain;
}

/** Deep-clone a subtree with fresh ids; returns new root id and node map additions. */
export function cloneSubtree(
  nodes: Record<string, Node>,
  rootId: string,
  makeId: () => string,
): { rootId: string; nodes: Record<string, Node> } {
  const idMap = new Map<string, string>();
  const ids = collectSubtree(nodes, rootId);
  for (const id of ids) idMap.set(id, makeId());
  const out: Record<string, Node> = {};
  for (const id of ids) {
    const src = nodes[id];
    const clone: Node = JSON.parse(JSON.stringify(src));
    clone.id = idMap.get(id)!;
    clone.parent = src.parent && idMap.has(src.parent) ? idMap.get(src.parent)! : null;
    clone.children = src.children.map((c) => idMap.get(c)!);
    out[clone.id] = clone;
  }
  return { rootId: idMap.get(rootId)!, nodes: out };
}
