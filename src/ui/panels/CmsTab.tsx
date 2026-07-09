import { useState } from "react";
import { docActions, useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { createPageRoot, uid } from "@/model/factory";
import type { CmsCollection, CmsEntry, CmsFieldType, Node, Page } from "@/model/types";
import { api } from "@/api/client";
import { IconBack, IconDatabase, IconPlus, IconTrash } from "../icons";

// ─────────────────────────────────────────────────────────────────────────────
// CMS tab: collections → fields + entries. Entries edited in a modal-like
// inline editor. Also creates detail template pages.
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_TYPES: CmsFieldType[] = ["text", "richText", "image", "number", "date", "link", "boolean", "color"];

export function CmsTab() {
  const project = useDocument((s) => s.project);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!project) return null;

  const open = openId ? project.cms.collections.find((c) => c.id === openId) : null;
  if (open) return <CollectionEditor collection={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="panel-content">
      <div className="panel-section-title">
        Collections
        <button
          className="icon-btn"
          title="New collection"
          onClick={() => {
            const name = prompt("Collection name", "Blog Posts");
            if (!name) return;
            const coll = docActions.addCollection(name);
            if (coll) setOpenId(coll.id);
          }}
        >
          <IconPlus />
        </button>
      </div>
      {project.cms.collections.length === 0 && (
        <div className="panel-empty">
          Collections hold structured content — blog posts, team members, projects. Create one, add entries, then drop a
          list onto any page from the Insert tab.
        </div>
      )}
      {project.cms.collections.map((coll) => (
        <div key={coll.id} className="page-row" onClick={() => setOpenId(coll.id)}>
          <IconDatabase style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{coll.name}</span>
          <span className="page-path">
            {coll.entries.length} {coll.entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      ))}
    </div>
  );
}

function CollectionEditor({ collection, onBack }: { collection: CmsCollection; onBack: () => void }) {
  const project = useDocument((s) => s.project)!;
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [showFields, setShowFields] = useState(false);
  const s = useEditor.getState();

  const templatePage = project.pages.find((p) => p.kind === "cms-template" && p.collectionId === collection.id);

  const createTemplatePage = () => {
    useDocument.getState().mutate((p) => {
      const root = createPageRoot(`${collection.name} Detail`);
      // starter template: title + image + body bound to fields
      const titleField = collection.fields.find((f) => f.type === "text");
      const imageField = collection.fields.find((f) => f.type === "image");
      const content: Node = {
        id: uid(),
        type: "frame",
        name: "Content",
        parent: root.id,
        children: [],
        tag: "article",
        styles: {
          desktop: {
            width: { mode: "fill" },
            height: { mode: "fit" },
            layout: "stack",
            direction: "column",
            gap: 24,
            align: "start",
            justify: "start",
            padding: { top: 80, right: 48, bottom: 80, left: 48 },
            maxWidth: 760,
          },
        },
      };
      root.children.push(content.id);
      p.nodes[root.id] = root;
      p.nodes[content.id] = content;
      if (titleField) {
        const title: Node = {
          id: uid(),
          type: "text",
          name: "Title",
          parent: content.id,
          children: [],
          text: "Title",
          textTag: "h1",
          binding: { fieldId: titleField.id },
          styles: {
            desktop: { width: { mode: "fit" }, height: { mode: "fit" }, fontSize: 48, fontWeight: 700, letterSpacing: -1, fontFamily: "Inter", color: "#111111" },
            phone: { fontSize: 32 },
          },
        };
        content.children.push(title.id);
        p.nodes[title.id] = title;
      }
      if (imageField) {
        const img: Node = {
          id: uid(),
          type: "image",
          name: "Cover",
          parent: content.id,
          children: [],
          binding: { fieldId: imageField.id },
          objectFit: "cover",
          styles: { desktop: { width: { mode: "fill" }, height: { mode: "fixed", value: 400 }, radius: 16 } },
        };
        content.children.push(img.id);
        p.nodes[img.id] = img;
      }
      const slugBase = collection.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const page: Page = {
        id: uid(),
        name: `${collection.name} Detail`,
        path: `/${slugBase}/:slug`,
        rootId: root.id,
        kind: "cms-template",
        collectionId: collection.id,
      };
      p.pages.push(page);
    });
  };

  return (
    <div className="panel-content">
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <button className="icon-btn" onClick={onBack}>
          <IconBack />
        </button>
        <strong style={{ flex: 1 }}>{collection.name}</strong>
        <button
          className="icon-btn"
          title="Delete collection"
          onClick={() => {
            if (confirm(`Delete collection "${collection.name}" and its template pages?`)) {
              docActions.deleteCollection(collection.id);
              onBack();
            }
          }}
        >
          <IconTrash />
        </button>
      </div>

      <button className="btn" style={{ width: "100%", marginBottom: 6 }} onClick={() => setShowFields(!showFields)}>
        {showFields ? "Hide fields" : `Fields (${collection.fields.length})`}
      </button>

      {showFields && (
        <div style={{ marginBottom: 10 }}>
          {collection.fields.map((field) => (
            <div key={field.id} className="prop-row">
              <input
                className="prop-input"
                defaultValue={field.name}
                key={`${field.id}-name`}
                onBlur={(e) => e.target.value !== field.name && docActions.updateField(collection.id, field.id, { name: e.target.value })}
              />
              <select
                className="prop-input small"
                style={{ width: 76 }}
                value={field.type}
                onChange={(e) => docActions.updateField(collection.id, field.id, { type: e.target.value as CmsFieldType })}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button className="icon-btn" onClick={() => docActions.deleteField(collection.id, field.id)}>
                <IconTrash />
              </button>
            </div>
          ))}
          <button
            className="btn"
            style={{ width: "100%" }}
            onClick={() => docActions.addField(collection.id, { name: "New Field", type: "text" })}
          >
            + Add field
          </button>
        </div>
      )}

      {!templatePage ? (
        <button className="btn" style={{ width: "100%", marginBottom: 10 }} onClick={createTemplatePage}>
          + Create detail page template
        </button>
      ) : (
        <button
          className="btn"
          style={{ width: "100%", marginBottom: 10 }}
          onClick={() => s.setContext({ kind: "page", pageId: templatePage.id })}
        >
          Open detail template ({templatePage.path})
        </button>
      )}

      <div className="panel-section-title">
        Entries
        <button
          className="icon-btn"
          onClick={() => {
            const entry = docActions.addEntry(collection.id);
            if (entry) setEditingEntry(entry.id);
          }}
        >
          <IconPlus />
        </button>
      </div>
      {collection.entries.map((entry) => {
        const titleField = collection.fields.find((f) => f.type === "text");
        const title = titleField ? String(entry.values[titleField.id] ?? entry.slug) : entry.slug;
        return (
          <div key={entry.id} className="page-row" onClick={() => setEditingEntry(entry.id)}>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title || entry.slug}</span>
            <span className="page-path">/{entry.slug}</span>
          </div>
        );
      })}

      {editingEntry && (
        <EntryEditor
          collection={collection}
          entry={collection.entries.find((e) => e.id === editingEntry)!}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}

function EntryEditor({ collection, entry, onClose }: { collection: CmsCollection; entry: CmsEntry; onClose: () => void }) {
  const project = useDocument((s) => s.project)!;
  if (!entry) return null;

  const setValue = (fieldId: string, value: string | number | boolean) => {
    docActions.updateEntry(collection.id, entry.id, { values: { ...entry.values, [fieldId]: value } });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit entry</h3>
        <div className="prop-row">
          <span className="prop-label">Slug</span>
          <input
            className="prop-input"
            defaultValue={entry.slug}
            key={`${entry.id}-slug`}
            onBlur={(e) => {
              const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
              if (slug && slug !== entry.slug) docActions.updateEntry(collection.id, entry.id, { slug });
            }}
          />
        </div>
        {collection.fields.map((field) => {
          const value = entry.values[field.id];
          return (
            <div className="prop-row" key={field.id} style={{ alignItems: field.type === "richText" ? "flex-start" : "center" }}>
              <span className="prop-label">{field.name}</span>
              {field.type === "boolean" ? (
                <input type="checkbox" checked={Boolean(value)} onChange={(e) => setValue(field.id, e.target.checked)} />
              ) : field.type === "number" ? (
                <input
                  className="prop-input"
                  type="number"
                  defaultValue={value === undefined ? "" : Number(value)}
                  key={`${entry.id}-${field.id}`}
                  onBlur={(e) => setValue(field.id, Number(e.target.value))}
                />
              ) : field.type === "richText" ? (
                <textarea
                  className="prop-input"
                  style={{ height: 90, padding: 6 }}
                  defaultValue={String(value ?? "")}
                  key={`${entry.id}-${field.id}`}
                  onBlur={(e) => setValue(field.id, e.target.value)}
                />
              ) : field.type === "image" ? (
                <ImageFieldInput
                  value={String(value ?? "")}
                  projectId={project.meta.id}
                  onChange={(url) => setValue(field.id, url)}
                />
              ) : field.type === "date" ? (
                <input
                  className="prop-input"
                  type="date"
                  defaultValue={String(value ?? "")}
                  key={`${entry.id}-${field.id}`}
                  onBlur={(e) => setValue(field.id, e.target.value)}
                />
              ) : field.type === "color" ? (
                <input type="color" value={String(value ?? "#000000")} onChange={(e) => setValue(field.id, e.target.value)} />
              ) : (
                <input
                  className="prop-input"
                  defaultValue={String(value ?? "")}
                  key={`${entry.id}-${field.id}`}
                  onBlur={(e) => setValue(field.id, e.target.value)}
                />
              )}
            </div>
          );
        })}
        <div className="modal-actions">
          <button
            className="btn danger"
            onClick={() => {
              if (confirm("Delete this entry?")) {
                docActions.deleteEntry(collection.id, entry.id);
                onClose();
              }
            }}
          >
            Delete
          </button>
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageFieldInput({ value, projectId, onChange }: { value: string; projectId: string; onChange: (url: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flex: 1, alignItems: "center", minWidth: 0 }}>
      {value && <img src={value} alt="" style={{ width: 26, height: 26, objectFit: "cover", borderRadius: 4 }} />}
      <input className="prop-input" placeholder="URL or upload →" defaultValue={value} key={value} onBlur={(e) => onChange(e.target.value)} />
      <label className="btn" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
        …
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const { url } = await api.uploadAsset(projectId, file.name, dataUrl);
            docActions.addAsset({ name: file.name, file: url.split("/").pop()! });
            onChange(url);
          }}
        />
      </label>
    </div>
  );
}
