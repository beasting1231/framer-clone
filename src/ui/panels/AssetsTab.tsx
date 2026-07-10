import { useRef, useState } from "react";
import { api } from "@/api/client";
import { resolveStyles } from "@/model/resolve";
import type { Fill } from "@/model/types";
import { docActions, useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { IconPlus, IconTrash, IconUpload } from "../icons";
import { UnsplashPicker } from "./UnsplashPicker";

// ─────────────────────────────────────────────────────────────────────────────
// Assets tab: uploaded images (stored in projects/<id>/assets/ on disk),
// shared color styles and text styles.
// ─────────────────────────────────────────────────────────────────────────────

export function AssetsTab() {
  const project = useDocument((s) => s.project);
  const assetPick = useEditor((s) => s.assetPick);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  if (!project) return null;

  const picking = assetPick != null;

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const { file: savedFile } = await api.uploadAsset(project.meta.id, file.name, dataUrl);
        docActions.addAsset({ name: file.name, file: savedFile });
      }
    } finally {
      setUploading(false);
    }
  };

  const applyAsset = (url: string) => {
    const pick = useEditor.getState().assetPick;
    if (!pick) return;
    if (pick.kind === "fill") {
      for (const id of pick.nodeIds) {
        const node = useDocument.getState().project?.nodes[id];
        if (!node) continue;
        const current = resolveStyles(node.styles, pick.bp).fill;
        const next: Fill =
          current?.type === "image"
            ? { ...current, src: url }
            : { type: "image", src: url, fit: "cover" };
        docActions.setStyles([id], pick.bp, { fill: next });
      }
    } else if (pick.kind === "image-src") {
      for (const id of pick.nodeIds) {
        docActions.updateNode(id, { src: url });
      }
    }
    useEditor.getState().cancelAssetPick();
  };

  return (
    <div className={`panel-content ${picking ? "assets-picking" : ""}`}>
      {picking && (
        <div className="asset-pick-banner">
          <span>Click an image to use it</span>
          <button type="button" className="btn" onClick={() => useEditor.getState().cancelAssetPick()}>
            Cancel
          </button>
        </div>
      )}
      <div className="panel-section-title">
        Images
        <button className="icon-btn" title="Upload image" onClick={() => fileRef.current?.click()}>
          <IconUpload />
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => upload(e.target.files)} />
      {uploading && <div className="panel-empty">Uploading…</div>}
      {project.assets.length === 0 && !uploading && (
        <div className="panel-empty">Upload images to use in your site. They're saved to the project's assets folder.</div>
      )}
      <div className="asset-grid">
        {project.assets.map((asset) => {
          const url = `/project-assets/${project.meta.id}/${asset.file}`;
          return (
            <div
              key={asset.id}
              className={`asset-tile ${picking ? "pickable" : ""}`}
              draggable={!picking}
              title={picking ? `Use ${asset.name}` : `${asset.name} — drag onto canvas`}
              onDragStart={(e) => {
                if (picking) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData("application/x-asset", url);
              }}
              onClick={() => {
                if (picking) applyAsset(url);
              }}
            >
              <img src={url} alt={asset.name} draggable={false} />
              {!picking && (
                <button
                  className="del"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await api.deleteAsset(project.meta.id, asset.file).catch(() => {});
                    docActions.deleteAsset(asset.id);
                  }}
                >
                  <IconTrash style={{ width: 11, height: 11 }} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <UnsplashPicker
        projectId={project.meta.id}
        onImported={(asset) => {
          docActions.addAsset(asset);
          const url = `/project-assets/${project.meta.id}/${asset.file}`;
          if (useEditor.getState().assetPick) applyAsset(url);
        }}
      />

      <div className="panel-section-title" style={{ marginTop: 18 }}>
        Color styles
        <button
          className="icon-btn"
          title="Add color style"
          onClick={() => {
            const name = prompt("Style name", "New Color");
            if (name) docActions.addColorStyle(name, "#0099FF");
          }}
        >
          <IconPlus />
        </button>
      </div>
      {project.colorStyles.map((style) => (
        <div key={style.id} className="swatch-row">
          <input
            type="color"
            value={style.color}
            style={{ width: 26, height: 26, padding: 0, border: "1px solid var(--border)", borderRadius: 6, background: "none", cursor: "pointer" }}
            onChange={(e) => docActions.updateColorStyle(style.id, { color: e.target.value })}
          />
          <input
            className="prop-input"
            style={{ flex: 1, background: "transparent" }}
            defaultValue={style.name}
            key={`${style.id}-name`}
            onBlur={(e) => e.target.value !== style.name && docActions.updateColorStyle(style.id, { name: e.target.value })}
          />
          <span className="muted" style={{ fontSize: 10 }}>
            {style.color.toUpperCase()}
          </span>
          <button className="icon-btn" onClick={() => docActions.deleteColorStyle(style.id)}>
            <IconTrash />
          </button>
        </div>
      ))}

      <div className="panel-section-title" style={{ marginTop: 18 }}>
        Text styles
        <button
          className="icon-btn"
          title="Add text style"
          onClick={() => {
            const name = prompt("Style name", "Heading");
            if (name)
              docActions.addTextStyle({
                name,
                props: { fontFamily: "Inter", fontSize: 32, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5 },
                responsive: { tablet: 28, phone: 24 },
              });
          }}
        >
          <IconPlus />
        </button>
      </div>
      {project.textStyles.length === 0 && (
        <div className="panel-empty">Define reusable typography styles and apply them from the Text section of the properties panel.</div>
      )}
      {project.textStyles.map((style) => (
        <div key={style.id} className="swatch-row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{style.name}</div>
            <div className="muted" style={{ fontSize: 10 }}>
              {style.props.fontFamily} · {style.props.fontSize}px · {style.props.fontWeight}
            </div>
          </div>
          <button className="icon-btn" onClick={() => docActions.deleteTextStyle(style.id)}>
            <IconTrash />
          </button>
        </div>
      ))}
    </div>
  );
}
