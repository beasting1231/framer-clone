import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import prettier from "prettier";
import {
  BREAKPOINTS,
  type BreakpointId,
  type CmsCollection,
  type CmsField,
  type Node,
  type Page,
  type SerializedProject,
  type StyleProps,
} from "../model/types";
import { nodeStyles } from "../model/resolve";
import { stylesToCss, type CssContext } from "../model/css";
import { getHoverStyles, resolveHoverAppearance } from "../model/hover";
import { clipMotionAttrs } from "../model/animation";
import { cssDeclarations, cssDiff } from "./cssText";

// ─────────────────────────────────────────────────────────────────────────────
// Generates a clean, readable Vite + React + TypeScript codebase for a project
// into <projectDir>/site. Regenerated on every save so it never drifts from
// the canvas.
// ─────────────────────────────────────────────────────────────────────────────

export interface GenCtx {
  project: SerializedProject;
  /** node id → css class name */
  classNames: Map<string, string>;
  /** component id → React component name */
  componentNames: Map<string, string>;
  /** page id → React component name */
  pageNames: Map<string, string>;
  /** collection id → variable name (camelCase) */
  collectionVars: Map<string, string>;
  /** collection id → field id → property name */
  fieldVars: Map<string, Map<string, string>>;
  assetPrefix: string;
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "node";

const pascal = (name: string) => {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const result = cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return /^[A-Za-z]/.test(result) ? result : `X${result}`;
};

const camel = (name: string) => {
  const p = pascal(name);
  return p.charAt(0).toLowerCase() + p.slice(1);
};

function uniqueNamer(): (base: string) => string {
  const used = new Set<string>();
  return (base: string) => {
    let name = base;
    let n = 2;
    while (used.has(name)) name = `${base}${n++}`;
    used.add(name);
    return name;
  };
}

export function buildCtx(project: SerializedProject): GenCtx {
  const classNames = new Map<string, string>();
  for (const [id, node] of Object.entries(project.nodes)) {
    classNames.set(id, `${slug(node.name)}-${id.slice(0, 4)}`);
  }
  const compNamer = uniqueNamer();
  const componentNames = new Map(project.components.map((c) => [c.id, compNamer(pascal(c.name))]));
  const pageNamer = uniqueNamer();
  const pageNames = new Map(project.pages.map((p) => [p.id, pageNamer(pascal(p.name) || "Page")]));
  const collVars = new Map(project.cms.collections.map((c) => [c.id, camel(c.name)]));
  const fieldVars = new Map(
    project.cms.collections.map((c) => {
      const namer = uniqueNamer();
      namer("slug"); // reserved
      return [c.id, new Map(c.fields.map((f) => [f.id, namer(camel(f.name))]))] as const;
    }),
  );
  return {
    project,
    classNames,
    componentNames,
    pageNames,
    collectionVars: collVars,
    fieldVars,
    assetPrefix: `/project-assets/${project.meta.id}/`,
  };
}

const rewriteAsset = (ctx: GenCtx, src: string) =>
  src.startsWith(ctx.assetPrefix) ? `/assets/${src.slice(ctx.assetPrefix.length)}` : src;

// ── CSS generation ───────────────────────────────────────────────────────────

function parentCtxAt(ctx: GenCtx, node: Node, bp: BreakpointId): CssContext {
  const parent = node.parent ? ctx.project.nodes[node.parent] : null;
  if (!parent) return { parentLayout: "stack", parentDirection: "column" };
  const ps = nodeStyles(parent, ctx.project, bp);
  return { parentLayout: ps.layout ?? "absolute", parentDirection: ps.direction ?? "column" };
}

function nodeCssAt(ctx: GenCtx, node: Node, bp: BreakpointId, stripPosition = false) {
  const props = nodeStyles(node, ctx.project, bp);
  const css = stylesToCss(props, node, parentCtxAt(ctx, node, bp)) as Record<string, unknown>;
  if (stripPosition) {
    delete css.position;
    delete css.left;
    delete css.top;
    delete css.right;
    delete css.bottom;
  }
  if (node.type === "text") css.whiteSpace = "pre-wrap";
  return css;
}

function collectTreeIds(ctx: GenCtx, rootId: string, out: string[] = []): string[] {
  const node = ctx.project.nodes[rootId];
  if (!node) return out;
  out.push(rootId);
  for (const c of node.children) collectTreeIds(ctx, c, out);
  return out;
}

function generateCss(ctx: GenCtx): string {
  const { project } = ctx;
  const sections: string[] = [];
  const tabletRules: string[] = [];
  const phoneRules: string[] = [];

  const masterRootIds = new Set(project.components.map((c) => c.rootId));

  const emitNodeCss = (id: string) => {
    const node = project.nodes[id];
    if (!node) return;
    const cls = ctx.classNames.get(id)!;
    const strip = masterRootIds.has(id);
    const desktop = nodeCssAt(ctx, node, "desktop", strip);
    const tablet = cssDiff(desktop, nodeCssAt(ctx, node, "tablet", strip));
    const phone = cssDiff(nodeCssAt(ctx, node, "tablet", strip), nodeCssAt(ctx, node, "phone", strip));
    sections.push(`.${cls} {\n${cssDeclarations(desktop)}\n}`);
    if (Object.keys(tablet).length > 0) tabletRules.push(`  .${cls} {\n${cssDeclarations(tablet, "    ")}\n  }`);
    if (Object.keys(phone).length > 0) phoneRules.push(`  .${cls} {\n${cssDeclarations(phone, "    ")}\n  }`);
    // hover appearance as CSS :hover rules
    const hover = node.effects?.hover;
    if (hover) {
      const hs = getHoverStyles(hover);
      const parentCtx = parentCtxAt(ctx, node, "desktop");
      const baseProps = nodeStyles(node, project, "desktop");
      const hoverProps = resolveHoverAppearance(node, project, "desktop", hover);
      if (Object.keys(hs).length > 0) {
        const baseCss = stylesToCss(baseProps, node, parentCtx);
        const hoverCss = stylesToCss(hoverProps, node, parentCtx);
        const diff = cssDiff(baseCss, hoverCss);
        if (Object.keys(diff).length > 0) {
          sections.push(`.${cls}:hover {\n${cssDeclarations(diff)}\n}`);
        }
      }
      const hasMotion = hover.scale !== undefined || hover.y !== undefined || hover.rotate !== undefined || hover.opacity !== undefined;
      if (Object.keys(hs).length > 0 || hasMotion) {
        const props = [
          "background-color",
          "color",
          "border-radius",
          "box-shadow",
          "opacity",
          "filter",
          "backdrop-filter",
          "border-color",
          "transform",
        ];
        sections.push(`.${cls} {\n  transition: ${props.map((p) => `${p} ${hover.duration}s ease`).join(", ")};\n}`);
      }
    }
  };

  // component masters first so instance classes override them
  for (const comp of project.components) {
    sections.push(`/* ── Component: ${comp.name} ${"─".repeat(Math.max(3, 40 - comp.name.length))} */`);
    for (const id of collectTreeIds(ctx, comp.rootId)) emitNodeCss(id);
  }
  for (const page of project.pages) {
    sections.push(`/* ── Page: ${page.name} ${"─".repeat(Math.max(3, 45 - page.name.length))} */`);
    for (const id of collectTreeIds(ctx, page.rootId)) emitNodeCss(id);
  }

  const tabletBp = BREAKPOINTS.find((b) => b.id === "tablet")!;
  const phoneBp = BREAKPOINTS.find((b) => b.id === "phone")!;

  let css = RESET_CSS + "\n" + sections.join("\n\n") + "\n";
  if (tabletRules.length > 0) css += `\n@media (max-width: ${tabletBp.maxWidth}px) {\n${tabletRules.join("\n\n")}\n}\n`;
  if (phoneRules.length > 0) css += `\n@media (max-width: ${phoneBp.maxWidth}px) {\n${phoneRules.join("\n\n")}\n}\n`;
  return css;
}

const RESET_CSS = `/* Generated by Framer Clone — do not edit by hand (regenerated on every save) */

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#root {
  min-height: 100vh;
}

#root {
  display: flex;
  flex-direction: column;
}

body {
  font-family: "Inter", sans-serif;
  -webkit-font-smoothing: antialiased;
}

img {
  display: block;
  max-width: 100%;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font: inherit;
  border: none;
  background: none;
  cursor: pointer;
  color: inherit;
}

input,
textarea {
  font: inherit;
}
`;

// ── JSX generation ───────────────────────────────────────────────────────────

interface FileImports {
  motion: boolean;
  link: boolean;
  components: Set<string>;
  collections: Set<string>;
}

interface Scope {
  /** variable holding the current CMS entry, when inside a list/template */
  entryVar?: string;
  collection?: CmsCollection;
  /** inside a component definition: read overrides */
  inComponent?: boolean;
  /** page being emitted — enables timeline clip motion */
  pageId?: string;
}

const escapeJsxText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");

const jsString = (text: string) => JSON.stringify(text);

function motionProps(node: Node, skipEntrance = false): string {
  const fx = node.effects;
  if (!fx) return "";
  const parts: string[] = [];
  const entrance = fx.entrance;
  if (!skipEntrance && entrance && entrance.preset !== "none") {
    const from: Record<string, unknown> = {};
    switch (entrance.preset) {
      case "fade":
        from.opacity = 0;
        break;
      case "slide-up":
        from.opacity = 0;
        from.y = 40;
        break;
      case "slide-down":
        from.opacity = 0;
        from.y = -40;
        break;
      case "slide-left":
        from.opacity = 0;
        from.x = 40;
        break;
      case "slide-right":
        from.opacity = 0;
        from.x = -40;
        break;
      case "scale":
        from.opacity = 0;
        from.scale = 0.8;
        break;
      case "blur":
        from.opacity = 0;
        from.filter = "blur(12px)";
        break;
    }
    const to: Record<string, unknown> = { opacity: 1, x: 0, y: 0 };
    if (from.scale !== undefined) to.scale = 1;
    if (from.filter !== undefined) to.filter = "blur(0px)";
    parts.push(`initial={${JSON.stringify(from)}}`);
    if (entrance.onScroll) {
      parts.push(`whileInView={${JSON.stringify(to)}}`, `viewport={{ once: true, amount: 0.3 }}`);
    } else {
      parts.push(`animate={${JSON.stringify(to)}}`);
    }
    const transition: Record<string, unknown> = { duration: entrance.duration, delay: entrance.delay, ease: "easeOut" };
    if (entrance.staggerChildren) transition.staggerChildren = entrance.staggerChildren;
    parts.push(`transition={${JSON.stringify(transition)}}`);
  }
  const hover = fx.hover;
  if (hover && (hover.scale !== undefined || hover.opacity !== undefined || hover.rotate !== undefined || hover.y !== undefined)) {
    const wh: Record<string, unknown> = {};
    if (hover.scale !== undefined) wh.scale = hover.scale;
    if (hover.opacity !== undefined) wh.opacity = hover.opacity;
    if (hover.rotate !== undefined) wh.rotate = hover.rotate;
    if (hover.y !== undefined) wh.y = hover.y;
    parts.push(`whileHover={${JSON.stringify(wh)}}`);
  }
  if (fx.pressScale !== undefined) parts.push(`whileTap={{ scale: ${fx.pressScale} }}`);
  return parts.length > 0 ? " " + parts.join(" ") : "";
}

function hasClipMotion(ctx: GenCtx, pageId: string, nodeId: string): boolean {
  return (ctx.project.animations ?? []).some(
    (c) => c.pageId === pageId && c.tracks.some((t) => t.nodeId === nodeId && t.keyframes.length > 0),
  );
}

function hasMotion(node: Node, ctx?: GenCtx, pageId?: string, nodeId?: string): boolean {
  if (ctx && pageId && nodeId && hasClipMotion(ctx, pageId, nodeId)) return true;
  const fx = node.effects;
  if (!fx) return false;
  if (fx.entrance && fx.entrance.preset !== "none") return true;
  if (fx.hover && (fx.hover.scale !== undefined || fx.hover.opacity !== undefined || fx.hover.rotate !== undefined || fx.hover.y !== undefined)) return true;
  return fx.pressScale !== undefined;
}

function detailPathFor(ctx: GenCtx, collectionId: string): string | null {
  const page = ctx.project.pages.find((p) => p.kind === "cms-template" && p.collectionId === collectionId);
  return page ? page.path : null;
}

function linkAttrs(ctx: GenCtx, node: Node, scope: Scope, imports: FileImports): { tag: string; attrs: string } | null {
  const link = node.link;
  if (!link) return null;
  if (link.type === "page") {
    const page = ctx.project.pages.find((p) => p.id === link.pageId);
    if (!page) return null;
    imports.link = true;
    return { tag: "Link", attrs: ` to=${jsString(page.path)}` };
  }
  if (link.type === "url") {
    const target = link.newTab ? ` target="_blank" rel="noopener"` : "";
    return { tag: "a", attrs: ` href=${jsString(link.url ?? "#")}${target}` };
  }
  if (link.type === "email") {
    return { tag: "a", attrs: ` href=${jsString(`mailto:${link.url ?? ""}`)}` };
  }
  if (link.type === "cms-detail" && scope.entryVar) {
    const collectionId = link.collectionId ?? scope.collection?.id;
    const detailPath = collectionId ? detailPathFor(ctx, collectionId) : null;
    if (!detailPath) return null;
    imports.link = true;
    const to = detailPath.replace(":slug", `\${${scope.entryVar}.slug}`);
    return { tag: "Link", attrs: ` to={\`${to}\`}` };
  }
  return null;
}

function bindingExpr(ctx: GenCtx, node: Node, scope: Scope): string | null {
  if (!node.binding || !scope.entryVar || !scope.collection) return null;
  const fieldVar = ctx.fieldVars.get(scope.collection.id)?.get(node.binding.fieldId);
  return fieldVar ? `${scope.entryVar}.${fieldVar}` : null;
}

function emitNode(ctx: GenCtx, id: string, scope: Scope, imports: FileImports, indent: string, extraClass?: string): string {
  const node = ctx.project.nodes[id];
  if (!node) return "";
  const cls = ctx.classNames.get(id)!;
  const className = extraClass ? `{\`${cls} \${${extraClass}}\`}` : jsString(cls);
  const motion = hasMotion(node, ctx, scope.pageId, id);
  if (motion) imports.motion = true;
  const skipEntrance = scope.pageId ? hasClipMotion(ctx, scope.pageId, id) : false;
  const fx = [motion ? motionProps(node, skipEntrance) : "", scope.pageId ? clipMotionAttrs(ctx.project, scope.pageId, id) : ""].filter(Boolean).join("");
  const overrideKey = jsString(cls);
  const ov = scope.inComponent ? `overrides[${overrideKey}]` : null;

  // ── component instance
  if (node.type === "instance" && node.componentId) {
    const compName = ctx.componentNames.get(node.componentId);
    if (!compName) return "";
    imports.components.add(compName);
    const overridesAttr =
      node.overrides && Object.keys(node.overrides).length > 0
        ? ` overrides={${JSON.stringify(remapOverrideKeys(ctx, node.overrides))}}`
        : "";
    return `${indent}<${compName} className=${className}${overridesAttr} />`;
  }

  // ── collection list
  if (node.type === "collectionList" && node.collectionId) {
    const collection = ctx.project.cms.collections.find((c) => c.id === node.collectionId);
    const varName = ctx.collectionVars.get(node.collectionId);
    if (!collection || !varName) return "";
    imports.collections.add(varName);
    const limit = node.limit && node.limit > 0 ? `.slice(0, ${node.limit})` : "";
    const childScope: Scope = { ...scope, entryVar: "entry", collection };
    const card = node.children[0];
    const inner = card
      ? emitNode(ctx, card, childScope, imports, indent + "    ")
          .replace(/^(\s*)<(\w+)/, (m, s, tag) => `${s}<${tag} key={entry.slug}`)
      : "";
    return `${indent}<div className=${className}>\n${indent}  {${varName}${limit}.map((entry) => (\n${inner}\n${indent}  ))}\n${indent}</div>`;
  }

  // ── text
  if (node.type === "text") {
    const tag = node.textTag ?? "p";
    const el = motion ? `motion.${tag}` : tag;
    const bound = bindingExpr(ctx, node, scope);
    let content: string;
    if (bound) content = `{${bound}}`;
    else if (ov) content = `{${ov}?.text ?? ${jsString(node.text ?? "")}}`;
    else content = escapeJsxText(node.text ?? "");
    const linkInfo = linkAttrs(ctx, node, scope, imports);
    const inner = `${indent}<${el} className=${className}${fx}>${content}</${el.startsWith("motion") ? el : tag}>`;
    if (linkInfo) return `${indent}<${linkInfo.tag}${linkInfo.attrs}>\n  ${inner}\n${indent}</${linkInfo.tag}>`;
    return inner;
  }

  // ── image
  if (node.type === "image") {
    const el = motion ? "motion.img" : "img";
    const bound = bindingExpr(ctx, node, scope);
    const srcDefault = jsString(rewriteAsset(ctx, node.src ?? ""));
    let srcAttr: string;
    if (bound) srcAttr = `{${bound}}`;
    else if (ov) srcAttr = `{${ov}?.src ?? ${srcDefault}}`;
    else srcAttr = srcDefault;
    const alt = jsString(node.alt ?? "");
    const fit = node.objectFit ? ` style={{ objectFit: ${jsString(node.objectFit)} }}` : "";
    const img = `${indent}<${el} className=${className} src=${srcAttr.startsWith("{") ? srcAttr : srcAttr} alt=${alt}${fit}${fx} />`;
    const linkInfo = linkAttrs(ctx, node, scope, imports);
    if (linkInfo) return `${indent}<${linkInfo.tag}${linkInfo.attrs}>\n  ${img}\n${indent}</${linkInfo.tag}>`;
    return img;
  }

  // ── icon (inline svg)
  if (node.type === "icon") {
    return `${indent}<span className=${className} dangerouslySetInnerHTML={{ __html: ${jsString(node.svg ?? "")} }}${fx} />`;
  }

  // ── frame
  const baseTag: string = node.tag ?? "div";
  if (baseTag === "input") {
    const ph = node.placeholder ? ` placeholder=${jsString(node.placeholder)}` : "";
    return `${indent}<input className=${className} type=${jsString(node.inputType ?? "text")}${ph} />`;
  }
  if (baseTag === "textarea") {
    const ph = node.placeholder ? ` placeholder=${jsString(node.placeholder)}` : "";
    return `${indent}<textarea className=${className}${ph} />`;
  }

  const linkInfo = linkAttrs(ctx, node, scope, imports);
  const children = node.children
    .map((c) => emitNode(ctx, c, scope, imports, indent + "  "))
    .filter(Boolean)
    .join("\n");

  // motion works on plain tags; a linked frame keeps its own tag and wraps in Link
  const el = motion ? `motion.${baseTag}` : baseTag;
  const open = `<${el} className=${className}${fx}`;
  const frame = children
    ? `${indent}${open}>\n${children}\n${indent}</${el}>`
    : `${indent}${open} />`;
  if (linkInfo) {
    const indented = frame
      .split("\n")
      .map((line) => "  " + line)
      .join("\n");
    return `${indent}<${linkInfo.tag}${linkInfo.attrs}>\n${indented}\n${indent}</${linkInfo.tag}>`;
  }
  return frame;
}

function remapOverrideKeys(ctx: GenCtx, overrides: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [nodeId, value] of Object.entries(overrides)) {
    const cls = ctx.classNames.get(nodeId);
    if (cls) out[cls] = value;
  }
  return out;
}

function fileHeader(imports: FileImports, ctx: GenCtx, opts: { useParams?: boolean } = {}): string {
  const lines: string[] = [];
  const routerImports: string[] = [];
  if (imports.link) routerImports.push("Link");
  if (opts.useParams) routerImports.push("useParams");
  if (routerImports.length > 0) lines.push(`import { ${routerImports.join(", ")} } from "react-router-dom";`);
  if (imports.motion) lines.push(`import { motion } from "framer-motion";`);
  for (const comp of [...imports.components].sort()) {
    lines.push(`import { ${comp} } from "../components/${comp}";`);
  }
  if (imports.collections.size > 0) {
    lines.push(`import { ${[...imports.collections].sort().join(", ")} } from "../cms/data";`);
  }
  return lines.length > 0 ? lines.join("\n") + "\n\n" : "";
}

function newImports(): FileImports {
  return { motion: false, link: false, components: new Set(), collections: new Set() };
}

// ── File emitters ────────────────────────────────────────────────────────────

function emitPageFile(ctx: GenCtx, page: Page): string {
  const imports = newImports();
  const name = ctx.pageNames.get(page.id)!;
  if (page.kind === "cms-template" && page.collectionId) {
    const collection = ctx.project.cms.collections.find((c) => c.id === page.collectionId);
    const varName = ctx.collectionVars.get(page.collectionId);
    if (collection && varName) {
      imports.collections.add(varName);
      const scope: Scope = { entryVar: "entry", collection, pageId: page.id };
      const jsx = emitNode(ctx, page.rootId, scope, imports, "    ");
      return (
        fileHeader(imports, ctx, { useParams: true }) +
        `export default function ${name}() {\n` +
        `  const { slug } = useParams();\n` +
        `  const entry = ${varName}.find((e) => e.slug === slug);\n` +
        `  if (!entry) {\n    return <div style={{ padding: 64, fontFamily: "Inter, sans-serif" }}>Not found</div>;\n  }\n` +
        `  return (\n${jsx}\n  );\n}\n`
      );
    }
  }
  const jsx = emitNode(ctx, page.rootId, { pageId: page.id }, imports, "    ");
  return fileHeader(imports, ctx) + `export default function ${name}() {\n  return (\n${jsx}\n  );\n}\n`;
}

function emitComponentFile(ctx: GenCtx, componentId: string): string {
  const comp = ctx.project.components.find((c) => c.id === componentId)!;
  const name = ctx.componentNames.get(componentId)!;
  const imports = newImports();
  const jsx = emitNode(ctx, comp.rootId, { inComponent: true }, imports, "    ", "className");
  return (
    fileHeader(imports, ctx).replace(/\.\.\/components\//g, "./") +
    `export interface ${name}Props {\n  className?: string;\n  overrides?: Record<string, { text?: string; src?: string; visible?: boolean }>;\n}\n\n` +
    `export function ${name}({ className = "", overrides = {} }: ${name}Props) {\n  return (\n${jsx}\n  );\n}\n`
  );
}

const FIELD_TS_TYPES: Record<CmsField["type"], string> = {
  text: "string",
  richText: "string",
  image: "string",
  number: "number",
  date: "string",
  link: "string",
  boolean: "boolean",
  color: "string",
};

function emitCmsData(ctx: GenCtx): string {
  const { project } = ctx;
  if (project.cms.collections.length === 0) return "// No CMS collections in this project yet.\nexport {};\n";
  const parts: string[] = ["// CMS content — generated from the project's collections.\n"];
  for (const collection of project.cms.collections) {
    const varName = ctx.collectionVars.get(collection.id)!;
    const typeName = pascal(collection.name).replace(/s$/, "") + "Entry";
    const fields = collection.fields
      .map((f) => `  ${ctx.fieldVars.get(collection.id)!.get(f.id)}: ${FIELD_TS_TYPES[f.type]};`)
      .join("\n");
    parts.push(`export interface ${typeName} {\n  slug: string;\n${fields}\n}\n`);
    const entries = collection.entries.map((entry) => {
      const values = collection.fields
        .map((f) => {
          const propName = ctx.fieldVars.get(collection.id)!.get(f.id)!;
          let value = entry.values[f.id];
          if (f.type === "image" && typeof value === "string") value = rewriteAsset(ctx, value);
          const literal = typeof value === "number" || typeof value === "boolean" ? String(value ?? (f.type === "number" ? 0 : false)) : jsString(String(value ?? ""));
          return `    ${propName}: ${literal},`;
        })
        .join("\n");
      return `  {\n    slug: ${jsString(entry.slug)},\n${values}\n  },`;
    });
    parts.push(`export const ${varName}: ${typeName}[] = [\n${entries.join("\n")}\n];\n`);
  }
  return parts.join("\n");
}

function emitApp(ctx: GenCtx): string {
  const { project } = ctx;
  const imports = project.pages
    .map((p) => `import ${ctx.pageNames.get(p.id)} from "./pages/${ctx.pageNames.get(p.id)}";`)
    .join("\n");
  const routes = project.pages
    .map((p) => `        <Route path=${jsString(p.path)} element={<${ctx.pageNames.get(p.id)} />} />`)
    .join("\n");
  return `import { BrowserRouter, Routes, Route } from "react-router-dom";
${imports}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
${routes}
      </Routes>
    </BrowserRouter>
  );
}
`;
}

const SITE_MAIN = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

function sitePackageJson(project: SerializedProject): string {
  return JSON.stringify(
    {
      name: slug(project.meta.name) + "-site",
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
      dependencies: {
        "framer-motion": "^12.42.2",
        react: "^19.2.7",
        "react-dom": "^19.2.7",
        "react-router-dom": "^7.9.5",
      },
      devDependencies: {
        "@types/react": "^19.2.17",
        "@types/react-dom": "^19.2.3",
        "@vitejs/plugin-react": "^6.0.3",
        typescript: "^7.0.2",
        vite: "^8.1.4",
      },
    },
    null,
    2,
  );
}

const SITE_VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;

const SITE_TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      isolatedModules: true,
    },
    include: ["src"],
  },
  null,
  2,
);

function siteIndexHtml(project: SerializedProject): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${project.meta.name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=DM+Sans:opsz,wght@9..40,100..1000&family=DM+Serif+Display&family=Space+Grotesk:wght@300..700&family=Playfair+Display:wght@400..900&family=JetBrains+Mono:wght@100..800&family=Lora:wght@400..700&family=Manrope:wght@200..800&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

function siteReadme(project: SerializedProject): string {
  return `# ${project.meta.name}

This site was generated by Framer Clone. It is a standard Vite + React + TypeScript app.

\`\`\`bash
npm install
npm run dev     # local dev server
npm run build   # production build → dist/
\`\`\`

- \`src/pages/\` — one component per page
- \`src/components/\` — reusable components created in the editor
- \`src/cms/data.ts\` — CMS collections exported as typed data
- \`src/styles.css\` — all styling, with media queries for tablet/phone breakpoints

This folder is regenerated on every save in the editor, so manual edits here will be overwritten. Edit the design in the editor instead (the source of truth is \`../framer.json\`).
`;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

async function writeFormatted(filePath: string, content: string): Promise<void> {
  const ext = path.extname(filePath);
  const parser =
    ext === ".tsx" || ext === ".ts" ? "typescript" : ext === ".css" ? "css" : ext === ".json" ? "json" : ext === ".html" ? "html" : null;
  let output = content;
  if (parser) {
    try {
      output = await prettier.format(content, { parser, printWidth: 100 });
    } catch {
      // fall back to unformatted output rather than failing the save
    }
  }
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, output, "utf8");
}

export async function generateSite(project: SerializedProject, outDir: string): Promise<void> {
  const ctx = buildCtx(project);
  const src = path.join(outDir, "src");

  // clean generated sources (leave node_modules/dist intact)
  await fsp.rm(src, { recursive: true, force: true });

  const writes: Promise<void>[] = [
    writeFormatted(path.join(outDir, "package.json"), sitePackageJson(project)),
    writeFormatted(path.join(outDir, "vite.config.ts"), SITE_VITE_CONFIG),
    writeFormatted(path.join(outDir, "tsconfig.json"), SITE_TSCONFIG),
    writeFormatted(path.join(outDir, "index.html"), siteIndexHtml(project)),
    writeFormatted(path.join(outDir, "README.md"), siteReadme(project)),
    writeFormatted(path.join(src, "main.tsx"), SITE_MAIN),
    writeFormatted(path.join(src, "App.tsx"), emitApp(ctx)),
    writeFormatted(path.join(src, "styles.css"), generateCss(ctx)),
    writeFormatted(path.join(src, "cms", "data.ts"), emitCmsData(ctx)),
  ];
  for (const page of project.pages) {
    writes.push(writeFormatted(path.join(src, "pages", `${ctx.pageNames.get(page.id)}.tsx`), emitPageFile(ctx, page)));
  }
  for (const comp of project.components) {
    writes.push(
      writeFormatted(path.join(src, "components", `${ctx.componentNames.get(comp.id)}.tsx`), emitComponentFile(ctx, comp.id)),
    );
  }
  await Promise.all(writes);

  // copy uploaded assets into the site's public dir
  const assetsSrc = path.join(outDir, "..", "assets");
  const assetsDst = path.join(outDir, "public", "assets");
  if (fs.existsSync(assetsSrc)) {
    await fsp.mkdir(assetsDst, { recursive: true });
    await fsp.cp(assetsSrc, assetsDst, { recursive: true });
  }
}
