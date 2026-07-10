import type { CmsCollection, CmsEntry, Node } from "../model/types";
import type { GenCtx } from "./generate";
import { resolveComponentVariant } from "../model/resolve";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface StaticScope {
  entry?: CmsEntry;
  collection?: CmsCollection;
}

function bindingValue(ctx: GenCtx, node: Node, scope: StaticScope): string | null {
  if (!node.binding || !scope.entry || !scope.collection) return null;
  const value = scope.entry.values[node.binding.fieldId];
  return value === undefined ? null : String(value);
}

function emitStaticNode(ctx: GenCtx, id: string, scope: StaticScope, indent: string): string {
  const node = ctx.project.nodes[id];
  if (!node) return "";
  const cls = ctx.classNames.get(id)!;

  if (node.type === "instance" && node.componentId) {
    const comp = ctx.project.components.find((c) => c.id === node.componentId);
    if (!comp) return "";
    const masterRoot = ctx.project.nodes[resolveComponentVariant(comp, "desktop").rootId];
    if (!masterRoot) return "";
    const children = masterRoot.children
      .map((c) => emitStaticNode(ctx, c, scope, indent + "  "))
      .filter(Boolean)
      .join("\n");
    return `${indent}<div class="${cls}">\n${children}\n${indent}</div>`;
  }

  if (node.type === "collectionList" && node.collectionId) {
    const collection = ctx.project.cms.collections.find((c) => c.id === node.collectionId);
    const template = node.children[0];
    if (!collection || !template) return `${indent}<div class="${cls}"></div>`;
    let entries = collection.entries;
    if (node.limit && node.limit > 0) entries = entries.slice(0, node.limit);
    const children = entries
      .map((entry) => emitStaticNode(ctx, template, { entry, collection }, indent + "  "))
      .join("\n");
    return `${indent}<div class="${cls}">\n${children}\n${indent}</div>`;
  }

  if (node.type === "text") {
    const tag = node.textTag ?? "p";
    const text = escapeHtml(bindingValue(ctx, node, scope) ?? node.text ?? "");
    return `${indent}<${tag} class="${cls}">${text}</${tag}>`;
  }

  if (node.type === "image") {
    const src = bindingValue(ctx, node, scope) ?? node.src ?? "";
    const alt = escapeHtml(node.alt ?? "");
    return `${indent}<img class="${cls}" src="${escapeHtml(src)}" alt="${alt}" />`;
  }

  if (node.type === "icon") {
    return `${indent}<span class="${cls}">${node.svg ?? ""}</span>`;
  }

  const tag = node.tag ?? "div";
  if (tag === "input") {
    const ph = node.placeholder ? ` placeholder="${escapeHtml(node.placeholder)}"` : "";
    return `${indent}<input class="${cls}"${ph} />`;
  }
  if (tag === "textarea") {
    const ph = node.placeholder ? ` placeholder="${escapeHtml(node.placeholder)}"` : "";
    return `${indent}<textarea class="${cls}"${ph}></textarea>`;
  }

  const children = node.children
    .map((c) => emitStaticNode(ctx, c, scope, indent + "  "))
    .filter(Boolean)
    .join("\n");
  if (!children) return `${indent}<${tag} class="${cls}"></${tag}>`;
  return `${indent}<${tag} class="${cls}">\n${children}\n${indent}</${tag}>`;
}

/** Static HTML for thumbnail screenshots — uses the same CSS classes as the generated site. */
export function emitThumbnailHtml(ctx: GenCtx, port: number): string {
  const page = ctx.project.pages.find((p) => p.id === ctx.project.homePageId) ?? ctx.project.pages[0];
  if (!page) {
    return `<!DOCTYPE html><html><body style="margin:0;background:#111;color:#666;font:14px Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">Empty project</body></html>`;
  }

  const root = ctx.project.nodes[page.rootId];
  if (!root) {
    return `<!DOCTYPE html><html><body style="margin:0;background:#111"></body></html>`;
  }

  const rootCls = ctx.classNames.get(root.id)!;
  const body = root.children.map((c) => emitStaticNode(ctx, c, {}, "    ")).join("\n");
  const stylesUrl = `http://127.0.0.1:${port}/thumb-styles/${ctx.project.meta.id}/styles.css`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1200" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${stylesUrl}" />
  <style>
    html, body { margin: 0; padding: 0; width: 1200px; overflow: hidden; background: #fff; }
    #thumb-root { width: 1200px; overflow: hidden; }
  </style>
</head>
<body>
  <div id="thumb-root">
    <${root.tag ?? "main"} class="${rootCls}">
${body}
    </${root.tag ?? "main"}>
  </div>
</body>
</html>`;
}
