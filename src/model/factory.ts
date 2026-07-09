import { nanoid } from "nanoid";
import type {
  Node,
  NodeType,
  Page,
  SerializedProject,
  StyleProps,
  SizeValue,
} from "./types";

export const uid = () => nanoid(10);

export const px = (value: number): SizeValue => ({ mode: "fixed", value });
export const fill = (): SizeValue => ({ mode: "fill" });
export const fit = (): SizeValue => ({ mode: "fit" });
export const rel = (value: number): SizeValue => ({ mode: "relative", value });

export function createNode(type: NodeType, name: string, styles: StyleProps = {}): Node {
  return {
    id: uid(),
    type,
    name,
    parent: null,
    children: [],
    styles: { desktop: styles },
  };
}

export function createFrame(name = "Frame", styles: StyleProps = {}): Node {
  const node = createNode("frame", name, {
    width: px(200),
    height: px(200),
    layout: "absolute",
    fill: { type: "solid", color: "#FFFFFF" },
    overflow: "hidden",
    ...styles,
  });
  node.tag = "div";
  return node;
}

export function createStack(name = "Stack", styles: StyleProps = {}): Node {
  const node = createNode("frame", name, {
    width: px(300),
    height: fit(),
    layout: "stack",
    direction: "column",
    gap: 12,
    align: "center",
    justify: "start",
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
    fill: { type: "solid", color: "#FFFFFF" },
    ...styles,
  });
  node.tag = "div";
  return node;
}

export function createText(text = "Type something", styles: StyleProps = {}): Node {
  const node = createNode("text", "Text", {
    width: fit(),
    height: fit(),
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.4,
    color: "#111111",
    textAlign: "left",
    ...styles,
  });
  node.text = text;
  node.textTag = "p";
  return node;
}

export function createImage(src = "", styles: StyleProps = {}): Node {
  const node = createNode("image", "Image", {
    width: px(320),
    height: px(220),
    radius: 0,
    ...styles,
  });
  node.src = src;
  node.alt = "";
  node.objectFit = "cover";
  return node;
}

export function createPageRoot(name: string): Node {
  const root = createNode("frame", name, {
    width: fill(),
    height: fit(),
    layout: "stack",
    direction: "column",
    gap: 0,
    align: "stretch",
    justify: "start",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    fill: { type: "solid", color: "#FFFFFF" },
    minHeight: 800,
  });
  root.tag = "main";
  return root;
}

export function createPage(name: string, path: string, rootId: string): Page {
  return { id: uid(), name, path, rootId, kind: "page" };
}

export function createEmptyProject(name: string): SerializedProject {
  const root = createPageRoot("Home");
  const page = createPage("Home", "/", root.id);
  const now = new Date().toISOString();
  return {
    version: 1,
    meta: { id: "", name, createdAt: now, updatedAt: now },
    pages: [page],
    homePageId: page.id,
    nodes: { [root.id]: root },
    components: [],
    cms: { collections: [] },
    assets: [],
    colorStyles: [
      { id: uid(), name: "Primary", color: "#0055FF" },
      { id: uid(), name: "Text", color: "#111111" },
      { id: uid(), name: "Background", color: "#FFFFFF" },
    ],
    textStyles: [],
    animations: [],
  };
}
