import { docActions, useDocument } from "@/store/document";
import { resolveComponentVariant } from "@/model/resolve";
import { useEditor } from "@/store/editor";
import { insertTemplate, isSectionTemplate, type TemplateId } from "@/insert/templates";
import { uid } from "@/model/factory";
import type { Node } from "@/model/types";
import {
  IconButton,
  IconComponent,
  IconFrame,
  IconGrid,
  IconImage,
  IconInput,
  IconList,
  IconRow,
  IconStack,
  IconText,
} from "../icons";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Insert panel: drag items onto the canvas, or click to append to selection.
// ─────────────────────────────────────────────────────────────────────────────

const PRIMITIVES: { id: TemplateId; label: string; icon: ReactNode }[] = [
  { id: "frame", label: "Frame", icon: <IconFrame /> },
  { id: "stack-v", label: "Stack", icon: <IconStack /> },
  { id: "stack-h", label: "Row", icon: <IconRow /> },
  { id: "grid", label: "Grid", icon: <IconGrid /> },
  { id: "text", label: "Text", icon: <IconText /> },
  { id: "heading", label: "Heading", icon: <IconText /> },
  { id: "image", label: "Image", icon: <IconImage /> },
  { id: "button", label: "Button", icon: <IconButton /> },
  { id: "link-text", label: "Link", icon: <IconText /> },
  { id: "input", label: "Input", icon: <IconInput /> },
  { id: "textarea", label: "Textarea", icon: <IconInput /> },
  { id: "divider", label: "Divider", icon: <IconRow /> },
];

const SECTIONS: { id: TemplateId; label: string; desc: string }[] = [
  { id: "section-navbar", label: "Navbar", desc: "Logo, links, call to action" },
  { id: "section-hero", label: "Hero", desc: "Heading, subtitle, buttons" },
  { id: "section-features", label: "Features", desc: "3-column feature grid" },
  { id: "section-gallery", label: "Gallery", desc: "Responsive image grid" },
  { id: "section-pricing", label: "Pricing", desc: "3 plans with highlight" },
  { id: "section-contact", label: "Contact", desc: "Copy and contact form" },
  { id: "section-testimonials", label: "Testimonials", desc: "Quote cards" },
  { id: "section-cta", label: "Call to Action", desc: "Dark banner with button" },
  { id: "section-footer", label: "Footer", desc: "Brand, copyright, links" },
];

export function InsertTab() {
  const project = useDocument((s) => s.project);
  if (!project) return null;
  const s = useEditor.getState();

  /** Page/component root for the current editing context. */
  const contextRootId = (): string | null => {
    const state = useEditor.getState();
    const proj = useDocument.getState().project!;
    const ctx = state.context;
    if (ctx?.kind === "page") return proj.pages.find((p) => p.id === ctx.pageId)?.rootId ?? null;
    if (ctx?.kind === "component") {
      const component = proj.components.find((c) => c.id === ctx.componentId);
      return component ? resolveComponentVariant(component, state.breakpoint).rootId : null;
    }
    return null;
  };

  /** Click-to-insert: sections always go on the page root; primitives go into selection. */
  const clickInsert = (id: TemplateId) => {
    const state = useEditor.getState();
    const proj = useDocument.getState().project!;
    let parentId: string | null = null;

    if (isSectionTemplate(id)) {
      // Sections are page-level: always append to the home/root stack, never nest
      // inside a previously selected section.
      parentId = contextRootId();
    } else {
      if (state.selection.length === 1) {
        const sel = proj.nodes[state.selection[0]];
        if (sel?.type === "frame") parentId = sel.id;
        else if (sel?.parent) parentId = sel.parent;
      }
      if (!parentId) parentId = contextRootId();
    }

    if (!parentId) return;
    const index = id === "section-navbar" ? 0 : proj.nodes[parentId].children.length;
    const inserted = insertTemplate(id, parentId, index);
    if (inserted) state.select([inserted]);
  };

  const insertComponent = (componentId: string) => {
    const state = useEditor.getState();
    const proj = useDocument.getState().project!;
    const ctx = state.context;
    let parentId: string | null = null;
    if (ctx?.kind === "page") parentId = proj.pages.find((p) => p.id === ctx.pageId)?.rootId ?? null;
    else if (ctx?.kind === "component") {
      const component = proj.components.find((c) => c.id === ctx.componentId);
      parentId = component ? resolveComponentVariant(component, state.breakpoint).rootId : null;
    }
    if (!parentId) return;
    const comp = proj.components.find((c) => c.id === componentId);
    if (!comp) return;
    const instance: Node = {
      id: uid(),
      type: "instance",
      name: comp.name,
      parent: null,
      children: [],
      componentId,
      overrides: {},
      styles: { desktop: {} },
    };
    docActions.insertSubtree({ [instance.id]: instance }, instance.id, parentId, proj.nodes[parentId].children.length);
    state.select([instance.id]);
  };

  return (
    <div className="panel-content">
      <div className="panel-section-title">Primitives</div>
      <div className="insert-grid">
        {PRIMITIVES.map((item) => (
          <button
            key={item.id}
            className="insert-item"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("application/x-insert", item.id)}
            onClick={() => clickInsert(item.id)}
            title="Drag to canvas or click to insert"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <div className="panel-section-title" style={{ marginTop: 14 }}>
        Sections
      </div>
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          className="insert-section"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-insert", section.id);
            e.dataTransfer.setData("application/x-insert-section", section.id);
          }}
          onClick={() => clickInsert(section.id)}
        >
          <div>
            <div>{section.label}</div>
            <div className="desc">{section.desc}</div>
          </div>
        </button>
      ))}

      {project.components.length > 0 && (
        <>
          <div className="panel-section-title" style={{ marginTop: 14 }}>
            Your components
          </div>
          {project.components.map((comp) => (
            <button
              key={comp.id}
              className="insert-section"
              style={{ color: "var(--component)" }}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/x-component", comp.id)}
              onClick={() => insertComponent(comp.id)}
            >
              <IconComponent style={{ width: 15, height: 15 }} />
              {comp.name}
            </button>
          ))}
        </>
      )}

      {project.cms.collections.length > 0 && (
        <>
          <div className="panel-section-title" style={{ marginTop: 14 }}>
            CMS lists
          </div>
          {project.cms.collections.map((coll) => (
            <button
              key={coll.id}
              className="insert-section"
              onClick={() => {
                const state = useEditor.getState();
                const proj = useDocument.getState().project!;
                const ctx = state.context;
                const parentId = ctx?.kind === "page" ? proj.pages.find((p) => p.id === ctx.pageId)?.rootId : null;
                if (!parentId) return;
                insertCollectionList(coll.id, parentId);
              }}
            >
              <IconList style={{ width: 15, height: 15 }} />
              <div>
                <div>{coll.name} list</div>
                <div className="desc">Repeating cards bound to {coll.name}</div>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

/** Create a collection list with a starter card template bound to common fields. */
export function insertCollectionList(collectionId: string, parentId: string) {
  const proj = useDocument.getState().project!;
  const coll = proj.cms.collections.find((c) => c.id === collectionId);
  if (!coll) return;
  const titleField = coll.fields.find((f) => f.type === "text");
  const imageField = coll.fields.find((f) => f.type === "image");
  const summaryField = coll.fields.filter((f) => f.type === "text")[1];

  const list: Node = {
    id: uid(),
    type: "collectionList",
    name: `${coll.name} List`,
    parent: null,
    children: [],
    collectionId,
    limit: 0,
    styles: {
      desktop: {
        width: { mode: "fill" },
        height: { mode: "fit" },
        layout: "grid",
        gridColumns: 3,
        gap: 20,
        padding: { top: 24, right: 48, bottom: 24, left: 48 },
      },
      tablet: { gridColumns: 2 },
      phone: { gridColumns: 1 },
    },
  };

  const card: Node = {
    id: uid(),
    type: "frame",
    name: "Card",
    parent: list.id,
    children: [],
    tag: "div",
    link: { type: "cms-detail", collectionId },
    styles: {
      desktop: {
        width: { mode: "fill" },
        height: { mode: "fit" },
        layout: "stack",
        direction: "column",
        gap: 0,
        align: "stretch",
        justify: "start",
        fill: { type: "solid", color: "#FFFFFF" },
        radius: 14,
        overflow: "hidden",
        border: { width: 1, color: "#EAEAEE", style: "solid" },
        cursor: "pointer",
      },
    },
    effects: { hover: { y: -4, duration: 0.2 } },
  };
  list.children.push(card.id);
  const nodes: Record<string, Node> = { [list.id]: list, [card.id]: card };

  if (imageField) {
    const img: Node = {
      id: uid(),
      type: "image",
      name: "Cover",
      parent: card.id,
      children: [],
      binding: { fieldId: imageField.id },
      objectFit: "cover",
      styles: { desktop: { width: { mode: "fill" }, height: { mode: "fixed", value: 180 } } },
    };
    card.children.push(img.id);
    nodes[img.id] = img;
  }

  const body: Node = {
    id: uid(),
    type: "frame",
    name: "Body",
    parent: card.id,
    children: [],
    tag: "div",
    styles: {
      desktop: {
        width: { mode: "fill" },
        height: { mode: "fit" },
        layout: "stack",
        direction: "column",
        gap: 8,
        align: "start",
        justify: "start",
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
      },
    },
  };
  card.children.push(body.id);
  nodes[body.id] = body;

  if (titleField) {
    const title: Node = {
      id: uid(),
      type: "text",
      name: "Title",
      parent: body.id,
      children: [],
      text: "Title",
      textTag: "h3",
      binding: { fieldId: titleField.id },
      styles: { desktop: { width: { mode: "fit" }, height: { mode: "fit" }, fontSize: 18, fontWeight: 600, color: "#111111", fontFamily: "Inter" } },
    };
    body.children.push(title.id);
    nodes[title.id] = title;
  }
  if (summaryField) {
    const summary: Node = {
      id: uid(),
      type: "text",
      name: "Summary",
      parent: body.id,
      children: [],
      text: "Summary",
      binding: { fieldId: summaryField.id },
      styles: { desktop: { width: { mode: "fill" }, height: { mode: "fit" }, fontSize: 14, color: "#666677", lineHeight: 1.5, fontFamily: "Inter" } },
    };
    body.children.push(summary.id);
    nodes[summary.id] = summary;
  }

  docActions.insertSubtree(nodes, list.id, parentId);
  useEditor.getState().select([list.id]);
}
