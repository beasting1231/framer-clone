import { docActions, useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { defaultHoverEffect, ensureHoverEffect, getHoverStyles, hasHoverOverride, patchHoverStyles, resetHoverStyleKeys, resolveHoverAppearance } from "@/model/hover";
import { nodeStyles, overriddenKeys, resolveStyles } from "@/model/resolve";
import type {
  BreakpointId,
  EntrancePreset,
  Fill,
  HoverEffect,
  Node,
  SerializedProject,
  Shadow,
  SizeValue,
  StyleProps,
  TextTag,
} from "@/model/types";
import { NumberInput, PropRow, Segmented, ColorInput, Section } from "./controls";
import { AlignmentBar } from "./AlignmentBar";
import { IconPlus, IconTrash } from "@/ui/icons";

// ─────────────────────────────────────────────────────────────────────────────
// Context-sensitive properties panel (right side). Reads resolved styles at
// the active breakpoint; edits write base styles (desktop) or overrides.
// ─────────────────────────────────────────────────────────────────────────────

const FONTS = ["Inter", "DM Sans", "DM Serif Display", "Space Grotesk", "Playfair Display", "JetBrains Mono", "Lora", "Manrope", "Georgia", "Arial"];
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

export function PropertiesPanel() {
  const project = useDocument((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const breakpoint = useEditor((s) => s.breakpoint);
  const propertyState = useEditor((s) => s.propertyState);

  if (!project) return null;
  if (selection.length === 0) {
    return (
      <div className="right-panel">
        <div className="panel-empty" style={{ marginTop: 40 }}>
          Select a layer to edit its properties.
          <br />
          <br />
          <span style={{ fontSize: 11 }}>
            Editing at <strong>{breakpoint}</strong> — changes at tablet/phone become overrides.
          </span>
        </div>
      </div>
    );
  }

  const nodes = selection.map((id) => project.nodes[id]).filter(Boolean);
  if (nodes.length === 0) return <div className="right-panel" />;
  const node = nodes[0];

  return <NodeProperties key={`${node.id}-${breakpoint}-${propertyState}`} node={node} ids={selection} project={project} bp={breakpoint} />;
}

function NodeProperties({ node, ids, project, bp }: { node: Node; ids: string[]; project: SerializedProject; bp: BreakpointId }) {
  const propertyState = useEditor((s) => s.propertyState);
  const setPropertyState = useEditor((s) => s.setPropertyState);
  const normalStyles = nodeStyles(node, project, bp);
  const overridden = overriddenKeys(node.styles, bp);
  const hoverEffect = node.effects?.hover;
  const isHover = propertyState === "hover";
  const styles = isHover ? resolveHoverAppearance(node, project, bp, hoverEffect) : normalStyles;
  const isText = node.type === "text";
  const isFrame = node.type === "frame" || node.type === "collectionList";
  const isImage = node.type === "image";
  const isInstance = node.type === "instance";
  const isRoot = project.pages.some((p) => p.rootId === node.id) || project.components.some((c) => c.rootId === node.id);
  const multi = ids.length > 1;

  const updateHover = (patch: Partial<HoverEffect>) => {
    const base = ensureHoverEffect(node);
    docActions.updateNode(node.id, { effects: { ...node.effects, hover: { ...base, ...patch } } });
  };

  const setHoverStyle = (patch: Partial<StyleProps>) => {
    const base = ensureHoverEffect(node);
    updateHover(patchHoverStyles(base, patch));
  };

  const set = (patch: Partial<StyleProps>) => {
    if (isHover) setHoverStyle(patch);
    else docActions.setStyles(ids, bp, patch);
  };

  const reset = (...keys: (keyof StyleProps)[]) => {
    if (isHover) {
      const base = ensureHoverEffect(node);
      updateHover(resetHoverStyleKeys(base, keys));
      return;
    }
    if (bp !== "desktop") docActions.resetStyleOverride(ids, bp, keys);
  };

  const ov = (...keys: (keyof StyleProps)[]) => {
    if (isHover) return keys.some((k) => hasHoverOverride(hoverEffect, k));
    return keys.some((k) => overridden.has(k));
  };

  const switchToHover = () => {
    if (!node.effects?.hover) {
      docActions.updateNode(node.id, { effects: { ...node.effects, hover: defaultHoverEffect() } });
    }
    setPropertyState("hover");
  };

  const parent = node.parent ? project.nodes[node.parent] : null;
  const parentLayout = parent ? (resolveStyles(parent.styles, bp).layout ?? "absolute") : "absolute";
  const inAbsolute = parentLayout === "absolute" && !isRoot;

  // CMS binding availability: node inside a collection list card or cms template page
  const bindableCollection = findBindableCollection(project, node);

  if (!multi && node.customCode) {
    return (
      <div className="right-panel custom-code-locked-panel">
        <Section title={node.name}>
          <PropRow label="Name">
            <input className="prop-input" value={node.name} disabled readOnly />
          </PropRow>
        </Section>
        <Section title="Custom code">
          <div className="custom-code-lock">
            <strong>Properties disabled</strong>
            <p>
              This layer is controlled by approved custom code. Normal editor controls are locked so they do not overwrite
              the custom implementation.
            </p>
            {node.customCode.note && <p className="muted">{node.customCode.note}</p>}
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="right-panel">
      {!multi && !isRoot && (
        <PropertyStateBar
          state={propertyState}
          onNormal={() => setPropertyState("normal")}
          onHover={switchToHover}
          hoverDuration={hoverEffect?.duration ?? 0.2}
          onDurationChange={(v) => updateHover({ duration: v })}
        />
      )}
      {multi && <AlignmentBar />}
      {/* ── name & breakpoint hint */}
      <Section title={multi ? `${ids.length} layers` : node.name}>
        {isHover && (
          <div className="muted" style={{ fontSize: 10, lineHeight: 1.5, marginBottom: 4 }}>
            Editing hover state — blue dots mark overrides from normal (click to reset).
          </div>
        )}
        {bp !== "desktop" && !isHover && (
          <div className="muted" style={{ fontSize: 10, lineHeight: 1.5, marginBottom: 4 }}>
            Editing {bp} — changed values override desktop. Blue dots mark overrides (click to reset).
          </div>
        )}
        {!multi && !isRoot && (
          <PropRow label="Name">
            <input
              className="prop-input"
              defaultValue={node.name}
              key={node.id}
              onBlur={(e) => e.target.value !== node.name && docActions.updateNode(node.id, { name: e.target.value })}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </PropRow>
        )}
      </Section>

      {/* ── hover quick appearance */}
      {isHover && !multi && !isRoot && (
        <HoverAppearanceSection node={node} project={project} bp={bp} isText={isText} set={set} ov={ov} reset={reset} styles={styles} />
      )}

      {/* ── position */}
      {!isHover && inAbsolute && (
        <Section title="Position">
          <PropRow label="X / Y" overridden={ov("x", "y")} onReset={() => reset("x", "y")}>
            <NumberInput value={styles.x ?? 0} unit="X" onChange={(v) => set({ x: v })} />
            <NumberInput value={styles.y ?? 0} unit="Y" onChange={(v) => set({ y: v })} />
          </PropRow>
          <PropRow label="Rotate" overridden={ov("rotation")} onReset={() => reset("rotation")}>
            <NumberInput value={styles.rotation ?? 0} unit="°" onChange={(v) => set({ rotation: v })} />
          </PropRow>
          <PropRow label="Z index" overridden={ov("zIndex")} onReset={() => reset("zIndex")}>
            <NumberInput value={styles.zIndex} placeholder="auto" unit="z" onChange={(v) => set({ zIndex: v })} />
          </PropRow>
        </Section>
      )}
      {!isHover && !inAbsolute && !isRoot && (
        <Section title="Position">
          <PropRow label="Absolute" overridden={ov("positionAbsolute")} onReset={() => reset("positionAbsolute")}>
            <Segmented
              value={styles.positionAbsolute ? "yes" : "no"}
              options={[
                { value: "no", label: "In flow" },
                { value: "yes", label: "Absolute" },
              ]}
              onChange={(v) => set({ positionAbsolute: v === "yes" ? true : undefined, pin: v === "yes" ? { top: 0, left: 0 } : undefined })}
            />
          </PropRow>
          {styles.positionAbsolute && (
            <>
              <PropRow label="Top/Left" overridden={ov("pin")} onReset={() => reset("pin")}>
                <NumberInput value={styles.pin?.top} unit="T" onChange={(v) => set({ pin: { ...styles.pin, top: v } })} />
                <NumberInput value={styles.pin?.left} unit="L" onChange={(v) => set({ pin: { ...styles.pin, left: v } })} />
              </PropRow>
              <PropRow label="Bot/Right">
                <NumberInput value={styles.pin?.bottom} unit="B" onChange={(v) => set({ pin: { ...styles.pin, bottom: v } })} />
                <NumberInput value={styles.pin?.right} unit="R" onChange={(v) => set({ pin: { ...styles.pin, right: v } })} />
              </PropRow>
            </>
          )}
          <PropRow label="Sticky" overridden={ov("sticky")} onReset={() => reset("sticky")}>
            <Segmented
              value={styles.sticky ? "yes" : "no"}
              options={[
                { value: "no", label: "Off" },
                { value: "yes", label: "Sticky" },
              ]}
              onChange={(v) => set({ sticky: v === "yes" ? true : undefined, stickyOffset: v === "yes" ? 0 : undefined })}
            />
          </PropRow>
          <PropRow label="Z index" overridden={ov("zIndex")} onReset={() => reset("zIndex")}>
            <NumberInput value={styles.zIndex} placeholder="auto" unit="z" onChange={(v) => set({ zIndex: v })} />
          </PropRow>
        </Section>
      )}

      {/* ── size */}
      <Section title="Size">
        <SizeControl label="Width" value={styles.width} overridden={ov("width")} onReset={() => reset("width")} onChange={(v) => set({ width: v })} />
        <SizeControl label="Height" value={styles.height} overridden={ov("height")} onReset={() => reset("height")} onChange={(v) => set({ height: v })} />
        <PropRow label="Min / Max W" overridden={ov("minWidth", "maxWidth")} onReset={() => reset("minWidth", "maxWidth")}>
          <NumberInput value={styles.minWidth} placeholder="min" unit="↓" onChange={(v) => set({ minWidth: v })} />
          <NumberInput value={styles.maxWidth} placeholder="max" unit="↑" onChange={(v) => set({ maxWidth: v })} />
        </PropRow>
        <PropRow label="Min / Max H" overridden={ov("minHeight", "maxHeight")} onReset={() => reset("minHeight", "maxHeight")}>
          <NumberInput value={styles.minHeight} placeholder="min" unit="↓" onChange={(v) => set({ minHeight: v })} />
          <NumberInput value={styles.maxHeight} placeholder="max" unit="↑" onChange={(v) => set({ maxHeight: v })} />
        </PropRow>
      </Section>

      {/* ── layout (frames) */}
      {isFrame && node.type !== "collectionList" && (
        <Section title="Layout">
          <PropRow label="Type" overridden={ov("layout")} onReset={() => reset("layout")}>
            <Segmented
              value={styles.layout ?? "absolute"}
              options={[
                { value: "absolute", label: "Free" },
                { value: "stack", label: "Stack" },
                { value: "grid", label: "Grid" },
              ]}
              onChange={(v) => set({ layout: v })}
            />
          </PropRow>
          {styles.layout === "stack" && (
            <>
              <PropRow label="Direction" overridden={ov("direction")} onReset={() => reset("direction")}>
                <Segmented
                  value={styles.direction ?? "column"}
                  options={[
                    { value: "row", label: "→" },
                    { value: "column", label: "↓" },
                  ]}
                  onChange={(v) => set({ direction: v })}
                />
              </PropRow>
              <PropRow label="Distribute" overridden={ov("justify")} onReset={() => reset("justify")}>
                <select className="prop-input" value={styles.justify ?? "start"} onChange={(e) => set({ justify: e.target.value as StyleProps["justify"] })}>
                  <option value="start">Start</option>
                  <option value="center">Center</option>
                  <option value="end">End</option>
                  <option value="space-between">Space between</option>
                  <option value="space-around">Space around</option>
                  <option value="space-evenly">Space evenly</option>
                </select>
              </PropRow>
              <PropRow label="Align" overridden={ov("align")} onReset={() => reset("align")}>
                <Segmented
                  value={styles.align ?? "start"}
                  options={[
                    { value: "start", label: "⤒" },
                    { value: "center", label: "↔" },
                    { value: "end", label: "⤓" },
                    { value: "stretch", label: "⇔" },
                  ]}
                  onChange={(v) => set({ align: v })}
                />
              </PropRow>
              <PropRow label="Wrap" overridden={ov("wrap")} onReset={() => reset("wrap")}>
                <Segmented
                  value={styles.wrap ? "yes" : "no"}
                  options={[
                    { value: "no", label: "No" },
                    { value: "yes", label: "Wrap" },
                  ]}
                  onChange={(v) => set({ wrap: v === "yes" ? true : undefined })}
                />
              </PropRow>
            </>
          )}
          {styles.layout === "grid" && (
            <>
              <PropRow label="Columns" overridden={ov("gridColumns")} onReset={() => reset("gridColumns")}>
                <NumberInput value={styles.gridColumns ?? 3} min={1} max={12} unit="col" onChange={(v) => set({ gridColumns: v })} />
              </PropRow>
              <PropRow label="Auto fit" overridden={ov("gridAutoFit")} onReset={() => reset("gridAutoFit")}>
                <Segmented
                  value={styles.gridAutoFit ? "yes" : "no"}
                  options={[
                    { value: "no", label: "Fixed" },
                    { value: "yes", label: "Auto" },
                  ]}
                  onChange={(v) => set({ gridAutoFit: v === "yes" ? true : undefined })}
                />
              </PropRow>
              {styles.gridAutoFit && (
                <PropRow label="Min item">
                  <NumberInput value={styles.gridMinItemWidth ?? 200} unit="px" onChange={(v) => set({ gridMinItemWidth: v })} />
                </PropRow>
              )}
            </>
          )}
          {(styles.layout === "stack" || styles.layout === "grid") && (
            <PropRow label="Gap" overridden={ov("gap")} onReset={() => reset("gap")}>
              <NumberInput value={styles.gap ?? 0} min={0} unit="px" onChange={(v) => set({ gap: v })} />
            </PropRow>
          )}
          <PaddingControl styles={styles} overridden={ov("padding")} onReset={() => reset("padding")} onChange={set} />
          <PropRow label="Overflow" overridden={ov("overflow")} onReset={() => reset("overflow")}>
            <Segmented
              value={styles.overflow ?? "visible"}
              options={[
                { value: "visible", label: "Show" },
                { value: "hidden", label: "Hide" },
                { value: "auto", label: "Scroll" },
              ]}
              onChange={(v) => set({ overflow: v })}
            />
          </PropRow>
          <PropRow label="Tag">
            <select
              className="prop-input"
              value={node.tag ?? "div"}
              onChange={(e) => docActions.updateNode(node.id, { tag: e.target.value as Node["tag"] })}
            >
              {["div", "section", "nav", "header", "footer", "main", "article", "aside", "button", "form"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </PropRow>
        </Section>
      )}

      {/* ── collection list settings */}
      {!isHover && node.type === "collectionList" && (
        <Section title="Collection">
          <PropRow label="Source">
            <select
              className="prop-input"
              value={node.collectionId ?? ""}
              onChange={(e) => docActions.updateNode(node.id, { collectionId: e.target.value })}
            >
              <option value="">Choose…</option>
              {project.cms.collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </PropRow>
          <PropRow label="Limit">
            <NumberInput value={node.limit ?? 0} min={0} unit="max" onChange={(v) => docActions.updateNode(node.id, { limit: v })} />
          </PropRow>
          <PropRow label="Columns" overridden={ov("gridColumns")} onReset={() => reset("gridColumns")}>
            <NumberInput value={styles.gridColumns ?? 3} min={1} max={12} unit="col" onChange={(v) => set({ gridColumns: v })} />
          </PropRow>
          <PropRow label="Gap" overridden={ov("gap")} onReset={() => reset("gap")}>
            <NumberInput value={styles.gap ?? 0} min={0} unit="px" onChange={(v) => set({ gap: v })} />
          </PropRow>
        </Section>
      )}

      {/* ── text content + typography */}
      {isText && (
        <Section title={isHover ? "Typography" : "Text"}>
          {!isHover && bindableCollection && (
            <PropRow label="Bind to">
              <select
                className="prop-input"
                value={node.binding?.fieldId ?? ""}
                onChange={(e) =>
                  docActions.updateNode(node.id, { binding: e.target.value ? { fieldId: e.target.value } : undefined })
                }
              >
                <option value="">— static text —</option>
                {bindableCollection.fields
                  .filter((f) => f.type === "text" || f.type === "richText" || f.type === "number" || f.type === "date")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </PropRow>
          )}
          {!isHover && !node.binding && (
            <textarea
              className="prop-input"
              style={{ width: "100%", height: 60, padding: 6, marginBottom: 6 }}
              defaultValue={node.text}
              key={`${node.id}-text`}
              onBlur={(e) => e.target.value !== node.text && docActions.updateNode(node.id, { text: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
            />
          )}
          {!isHover && (
            <PropRow label="Tag">
              <select className="prop-input" value={node.textTag ?? "p"} onChange={(e) => docActions.updateNode(node.id, { textTag: e.target.value as TextTag })}>
                {["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "blockquote", "code"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </PropRow>
          )}
          {!isHover && project.textStyles.length > 0 && (
            <PropRow label="Style">
              <select
                className="prop-input"
                value={styles.textStyleId ?? ""}
                onChange={(e) => set({ textStyleId: e.target.value || undefined })}
              >
                <option value="">— custom —</option>
                {project.textStyles.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </PropRow>
          )}
          <PropRow label="Font" overridden={ov("fontFamily")} onReset={() => reset("fontFamily")}>
            <select className="prop-input" value={styles.fontFamily ?? "Inter"} onChange={(e) => set({ fontFamily: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </PropRow>
          <PropRow label="Weight" overridden={ov("fontWeight")} onReset={() => reset("fontWeight")}>
            <select className="prop-input" value={styles.fontWeight ?? 400} onChange={(e) => set({ fontWeight: Number(e.target.value) })}>
              {WEIGHTS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </PropRow>
          <PropRow label="Size" overridden={ov("fontSize")} onReset={() => reset("fontSize")}>
            <NumberInput value={styles.fontSize ?? 16} min={1} unit="px" onChange={(v) => set({ fontSize: v })} />
          </PropRow>
          <PropRow label="Line" overridden={ov("lineHeight")} onReset={() => reset("lineHeight")}>
            <NumberInput value={styles.lineHeight ?? 1.4} min={0.5} max={4} step={0.1} unit="×" onChange={(v) => set({ lineHeight: v })} />
          </PropRow>
          <PropRow label="Spacing" overridden={ov("letterSpacing")} onReset={() => reset("letterSpacing")}>
            <NumberInput value={styles.letterSpacing ?? 0} step={0.1} unit="px" onChange={(v) => set({ letterSpacing: v })} />
          </PropRow>
          {!isHover && (
            <PropRow label="Color" overridden={ov("color")} onReset={() => reset("color")}>
              <ColorInput value={styles.color ?? "#111111"} onChange={(c) => set({ color: c })} />
            </PropRow>
          )}
          {!isHover && (
            <PropRow label="Align" overridden={ov("textAlign")} onReset={() => reset("textAlign")}>
              <Segmented
                value={styles.textAlign ?? "left"}
                options={[
                  { value: "left", label: "⟸" },
                  { value: "center", label: "≡" },
                  { value: "right", label: "⟹" },
                ]}
                onChange={(v) => set({ textAlign: v })}
              />
            </PropRow>
          )}
          {!isHover && (
            <PropRow label="Case" overridden={ov("textTransform")} onReset={() => reset("textTransform")}>
              <Segmented
                value={styles.textTransform ?? "none"}
                options={[
                  { value: "none", label: "Aa" },
                  { value: "uppercase", label: "AA" },
                  { value: "lowercase", label: "aa" },
                  { value: "capitalize", label: "Ab" },
                ]}
                onChange={(v) => set({ textTransform: v })}
              />
            </PropRow>
          )}
        </Section>
      )}

      {/* ── image */}
      {!isHover && isImage && (
        <Section title="Image">
          {bindableCollection && (
            <PropRow label="Bind to">
              <select
                className="prop-input"
                value={node.binding?.fieldId ?? ""}
                onChange={(e) =>
                  docActions.updateNode(node.id, { binding: e.target.value ? { fieldId: e.target.value } : undefined })
                }
              >
                <option value="">— static image —</option>
                {bindableCollection.fields
                  .filter((f) => f.type === "image")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </PropRow>
          )}
          {!node.binding && (
            <>
              <PropRow label="Source">
                <input
                  className="prop-input"
                  placeholder="URL or pick from Assets"
                  defaultValue={node.src}
                  key={`${node.id}-src-${node.src ?? ""}`}
                  onBlur={(e) => e.target.value !== node.src && docActions.updateNode(node.id, { src: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </PropRow>
              <PropRow label="Asset">
                <ImageAssetPickButton nodeIds={ids} />
              </PropRow>
            </>
          )}
          <PropRow label="Fit">
            <Segmented
              value={node.objectFit ?? "cover"}
              options={[
                { value: "cover", label: "Cover" },
                { value: "contain", label: "Fit" },
                { value: "fill", label: "Fill" },
              ]}
              onChange={(v) => docActions.updateNode(node.id, { objectFit: v })}
            />
          </PropRow>
          <PropRow label="Alt">
            <input
              className="prop-input"
              defaultValue={node.alt}
              key={`${node.id}-alt`}
              onBlur={(e) => docActions.updateNode(node.id, { alt: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </PropRow>
        </Section>
      )}

      {/* ── instance */}
      {!isHover && isInstance && (
        <Section title="Component">
          <div className="muted" style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 8 }}>
            Instance of <strong style={{ color: "var(--component)" }}>{project.components.find((c) => c.id === node.componentId)?.name}</strong>.
            Double-click on canvas to edit the master.
          </div>
          <button
            className="btn"
            style={{ width: "100%" }}
            onClick={() => node.componentId && useEditor.getState().setContext({ kind: "component", componentId: node.componentId })}
          >
            Edit component
          </button>
          <InstanceOverrides node={node} project={project} />
        </Section>
      )}

      {/* ── fill / appearance */}
      {(isFrame || isText || isInstance) && !multi && (
        <FillSection
          styles={styles}
          node={node}
          project={project}
          overridden={ov("fill")}
          onReset={() => reset("fill")}
          set={set}
          nodeIds={ids}
          bp={bp}
        />
      )}

      {(isFrame || isImage || isInstance) && (
        <Section title="Border & Radius">
          <PropRow label="Radius" overridden={ov("radius")} onReset={() => reset("radius")}>
            <NumberInput
              value={typeof styles.radius === "number" ? styles.radius : (styles.radius?.tl ?? 0)}
              min={0}
              unit="px"
              onChange={(v) => set({ radius: v })}
            />
            <button
              className="icon-btn"
              title="Per-corner radius"
              onClick={() => {
                const r = typeof styles.radius === "number" ? styles.radius : 0;
                set({ radius: typeof styles.radius === "object" ? r : { tl: r, tr: r, br: r, bl: r } });
              }}
            >
              ◲
            </button>
          </PropRow>
          {typeof styles.radius === "object" && (
            <PropRow label="Corners">
              <NumberInput value={styles.radius.tl} min={0} unit="tl" onChange={(v) => set({ radius: { ...(styles.radius as object), tl: v } as never })} />
              <NumberInput value={styles.radius.tr} min={0} unit="tr" onChange={(v) => set({ radius: { ...(styles.radius as object), tr: v } as never })} />
              <NumberInput value={styles.radius.br} min={0} unit="br" onChange={(v) => set({ radius: { ...(styles.radius as object), br: v } as never })} />
              <NumberInput value={styles.radius.bl} min={0} unit="bl" onChange={(v) => set({ radius: { ...(styles.radius as object), bl: v } as never })} />
            </PropRow>
          )}
          <PropRow label="Border" overridden={ov("border")} onReset={() => reset("border")}>
            <NumberInput
              value={styles.border?.width ?? 0}
              min={0}
              unit="px"
              onChange={(v) =>
                set({ border: v === 0 ? null : { width: v, color: styles.border?.color ?? "#DDDDDD", style: styles.border?.style ?? "solid" } })
              }
            />
            {styles.border && styles.border.width > 0 && (
              <select
                className="prop-input small"
                value={styles.border.style}
                onChange={(e) => set({ border: { ...styles.border!, style: e.target.value as "solid" | "dashed" | "dotted" } })}
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dash</option>
                <option value="dotted">Dot</option>
              </select>
            )}
          </PropRow>
          {styles.border && styles.border.width > 0 && (
            <PropRow label="B. color">
              <ColorInput value={styles.border.color} onChange={(c) => set({ border: { ...styles.border!, color: c } })} />
            </PropRow>
          )}
        </Section>
      )}

      {/* ── effects: shadow/opacity/blur */}
      <ShadowSection styles={styles} overridden={ov("shadows")} onReset={() => reset("shadows")} set={set} />

      <Section title="Opacity & Blur">
        <PropRow label="Opacity" overridden={ov("opacity")} onReset={() => reset("opacity")}>
          <NumberInput value={Math.round((styles.opacity ?? 1) * 100)} min={0} max={100} unit="%" onChange={(v) => set({ opacity: v / 100 })} />
        </PropRow>
        <PropRow label="Blur" overridden={ov("blur")} onReset={() => reset("blur")}>
          <NumberInput value={styles.blur ?? 0} min={0} unit="px" onChange={(v) => set({ blur: v || undefined })} />
        </PropRow>
        <PropRow label="Backdrop" overridden={ov("backdropBlur")} onReset={() => reset("backdropBlur")}>
          <NumberInput value={styles.backdropBlur ?? 0} min={0} unit="px" onChange={(v) => set({ backdropBlur: v || undefined })} />
        </PropRow>
        <PropRow label="Visible" overridden={ov("visible")} onReset={() => reset("visible")}>
          <Segmented
            value={styles.visible === false ? "no" : "yes"}
            options={[
              { value: "yes", label: "Show" },
              { value: "no", label: "Hide" },
            ]}
            onChange={(v) => set({ visible: v === "no" ? false : undefined })}
          />
        </PropRow>
      </Section>

      {/* ── link */}
      {!isRoot && !multi && !isHover && <LinkSection node={node} project={project} />}

      {/* ── hover motion */}
      {isHover && !isRoot && !multi && (
        <HoverMotionSection hover={ensureHoverEffect(node)} onChange={updateHover} />
      )}

      {/* ── animations */}
      {!isHover && !isRoot && !multi && <EffectsSection node={node} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SizeControl({ label, value, onChange, overridden, onReset }: { label: string; value: SizeValue | undefined; onChange: (v: SizeValue) => void; overridden: boolean; onReset: () => void }) {
  const mode = value?.mode ?? "fit";

  /** typed units switch the mode: "100%", "50vh", "100vw", "300px", "fill", "fit" */
  const parseTyped = (raw: string): boolean => {
    const lower = raw.toLowerCase();
    if (lower === "fill") return onChange({ mode: "fill" }), true;
    if (lower === "fit" || lower === "auto") return onChange({ mode: "fit" }), true;
    const m = lower.match(/^(-?\d*\.?\d+)\s*(px|%|vw|vh)$/);
    if (!m) return false;
    const num = Math.max(0, parseFloat(m[1]));
    const unit = m[2] as "px" | "%" | "vw" | "vh";
    if (unit === "px") onChange({ mode: "fixed", value: num });
    else if (unit === "%") onChange({ mode: "relative", value: num });
    else onChange({ mode: "viewport", value: num, unit });
    return true;
  };

  return (
    <PropRow label={label} overridden={overridden} onReset={onReset}>
      <select
        className="prop-input small"
        style={{ width: 62 }}
        value={mode}
        onChange={(e) => {
          const m = e.target.value as SizeValue["mode"];
          onChange(m === "fixed" ? { mode: "fixed", value: value?.value ?? 200 } : m === "relative" ? { mode: "relative", value: 100 } : m === "viewport" ? { mode: "viewport", value: 100 } : { mode: m });
        }}
      >
        <option value="fixed">Fixed</option>
        <option value="fill">Fill</option>
        <option value="relative">Rel %</option>
        <option value="fit">Fit</option>
        <option value="viewport">View</option>
      </select>
      {(mode === "fixed" || mode === "relative" || mode === "viewport") && (
        <NumberInput
          value={value?.value}
          min={0}
          unit={mode === "fixed" ? "px" : mode === "relative" ? "%" : (value?.unit ?? (label === "Width" ? "vw" : "vh"))}
          onChange={(v) => onChange({ mode, value: v, unit: value?.unit })}
          parseText={parseTyped}
        />
      )}
    </PropRow>
  );
}

function PaddingControl({ styles, onChange, overridden, onReset }: { styles: StyleProps; onChange: (patch: Partial<StyleProps>) => void; overridden: boolean; onReset: () => void }) {
  const p = styles.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const uniform = p.top === p.right && p.right === p.bottom && p.bottom === p.left;
  return (
    <>
      <PropRow label="Padding" overridden={overridden} onReset={onReset}>
        {uniform ? (
          <NumberInput value={p.top} min={0} unit="px" onChange={(v) => onChange({ padding: { top: v, right: v, bottom: v, left: v } })} />
        ) : (
          <span className="muted" style={{ fontSize: 10, flex: 1 }}>
            mixed
          </span>
        )}
        <button className="icon-btn" title="Per-side padding" onClick={() => onChange({ padding: { ...p, top: p.top + (uniform ? 0 : 0) } })}>
          ▦
        </button>
      </PropRow>
      <PropRow label="">
        <NumberInput value={p.top} min={0} unit="T" onChange={(v) => onChange({ padding: { ...p, top: v } })} />
        <NumberInput value={p.right} min={0} unit="R" onChange={(v) => onChange({ padding: { ...p, right: v } })} />
        <NumberInput value={p.bottom} min={0} unit="B" onChange={(v) => onChange({ padding: { ...p, bottom: v } })} />
        <NumberInput value={p.left} min={0} unit="L" onChange={(v) => onChange({ padding: { ...p, left: v } })} />
      </PropRow>
    </>
  );
}

function ImageAssetPickButton({ nodeIds }: { nodeIds: string[] }) {
  const assetPick = useEditor((s) => s.assetPick);
  const picking =
    assetPick?.kind === "image-src" &&
    assetPick.nodeIds.length === nodeIds.length &&
    assetPick.nodeIds.every((id, i) => id === nodeIds[i]);
  return (
    <button
      className={`btn prop-pick-btn ${picking ? "picking" : ""}`}
      onClick={() => {
        if (picking) useEditor.getState().cancelAssetPick();
        else useEditor.getState().startAssetPick({ kind: "image-src", nodeIds });
      }}
    >
      {picking ? "Click an asset…" : "Choose…"}
    </button>
  );
}

function FillSection({
  styles,
  node,
  project,
  set,
  overridden,
  onReset,
  nodeIds,
  bp,
}: {
  styles: StyleProps;
  node: Node;
  project: SerializedProject;
  set: (p: Partial<StyleProps>) => void;
  overridden: boolean;
  onReset: () => void;
  nodeIds: string[];
  bp: BreakpointId;
}) {
  const fillValue = styles.fill;
  const assetPick = useEditor((s) => s.assetPick);
  const pickingFill =
    assetPick?.kind === "fill" &&
    assetPick.nodeIds.length === nodeIds.length &&
    assetPick.nodeIds.every((id, i) => id === nodeIds[i]);
  const type = fillValue?.type ?? "none";
  const setType = (t: string) => {
    if (pickingFill) useEditor.getState().cancelAssetPick();
    if (t === "none") set({ fill: null });
    else if (t === "solid") set({ fill: { type: "solid", color: fillValue?.type === "solid" ? fillValue.color : "#FFFFFF" } });
    else if (t === "linear")
      set({
        fill: {
          type: "linear",
          angle: 180,
          stops: [
            { color: "#0099FF", position: 0 },
            { color: "#7B2FFF", position: 1 },
          ],
        },
      });
    else if (t === "radial")
      set({
        fill: {
          type: "radial",
          stops: [
            { color: "#0099FF", position: 0 },
            { color: "#003366", position: 1 },
          ],
        },
      });
    else if (t === "image") set({ fill: { type: "image", src: "", fit: "cover" } });
  };

  return (
    <Section title={node.type === "text" ? "Highlight" : "Fill"}>
      <PropRow label="Type" overridden={overridden} onReset={onReset}>
        <select className="prop-input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="none">None</option>
          <option value="solid">Solid</option>
          <option value="linear">Linear gradient</option>
          <option value="radial">Radial gradient</option>
          <option value="image">Image</option>
        </select>
      </PropRow>
      {fillValue?.type === "solid" && (
        <>
          <PropRow label="Color">
            <ColorInput value={fillValue.color} onChange={(c) => set({ fill: { type: "solid", color: c } })} />
          </PropRow>
          {project.colorStyles.length > 0 && (
            <PropRow label="Style">
              <select
                className="prop-input"
                value={fillValue.styleId ?? ""}
                onChange={(e) => {
                  const cs = project.colorStyles.find((c) => c.id === e.target.value);
                  set({ fill: cs ? { type: "solid", color: cs.color, styleId: cs.id } : { type: "solid", color: fillValue.color } });
                }}
              >
                <option value="">— custom —</option>
                {project.colorStyles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </PropRow>
          )}
        </>
      )}
      {(fillValue?.type === "linear" || fillValue?.type === "radial") && (
        <>
          {fillValue.type === "linear" && (
            <PropRow label="Angle">
              <NumberInput value={fillValue.angle} unit="°" onChange={(v) => set({ fill: { ...fillValue, angle: v } })} />
            </PropRow>
          )}
          {fillValue.stops.map((stop, i) => (
            <PropRow key={i} label={`Stop ${i + 1}`}>
              <ColorInput
                value={stop.color}
                onChange={(c) => {
                  const stops = fillValue.stops.map((st, j) => (j === i ? { ...st, color: c } : st));
                  set({ fill: { ...fillValue, stops } as Fill });
                }}
              />
            </PropRow>
          ))}
        </>
      )}
      {fillValue?.type === "image" && (
        <>
          <PropRow label="Source">
            <input
              className="prop-input"
              placeholder="Image URL"
              defaultValue={fillValue.src}
              key={`${node.id}-fill-src-${fillValue.src}`}
              onBlur={(e) => set({ fill: { ...fillValue, src: e.target.value } })}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </PropRow>
          <PropRow label="Asset">
            <button
              className={`btn prop-pick-btn ${pickingFill ? "picking" : ""}`}
              onClick={() => {
                if (pickingFill) useEditor.getState().cancelAssetPick();
                else useEditor.getState().startAssetPick({ kind: "fill", nodeIds, bp });
              }}
            >
              {pickingFill ? "Click an asset…" : "Choose…"}
            </button>
          </PropRow>
          <PropRow label="Fit">
            <Segmented
              value={fillValue.fit}
              options={[
                { value: "cover", label: "Cover" },
                { value: "contain", label: "Fit" },
                { value: "tile", label: "Tile" },
              ]}
              onChange={(v) => set({ fill: { ...fillValue, fit: v } })}
            />
          </PropRow>
        </>
      )}
    </Section>
  );
}

function ShadowSection({ styles, set, overridden, onReset }: { styles: StyleProps; set: (p: Partial<StyleProps>) => void; overridden: boolean; onReset: () => void }) {
  const shadows = styles.shadows ?? [];
  const update = (i: number, patch: Partial<Shadow>) => {
    set({ shadows: shadows.map((sh, j) => (j === i ? { ...sh, ...patch } : sh)) });
  };
  return (
    <Section
      title="Shadows"
      action={
        <button
          className="icon-btn"
          onClick={() => set({ shadows: [...shadows, { x: 0, y: 4, blur: 16, spread: 0, color: "rgba(0,0,0,0.15)" }] })}
        >
          <IconPlus />
        </button>
      }
    >
      {overridden && (
        <div className="muted" style={{ fontSize: 10, marginBottom: 4, cursor: "pointer" }} onClick={onReset}>
          ● overridden — reset
        </div>
      )}
      {shadows.length === 0 && <div className="muted" style={{ fontSize: 11 }}>No shadows</div>}
      {shadows.map((shadow, i) => (
        <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < shadows.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
          <PropRow label="X / Y">
            <NumberInput value={shadow.x} unit="X" onChange={(v) => update(i, { x: v })} />
            <NumberInput value={shadow.y} unit="Y" onChange={(v) => update(i, { y: v })} />
            <button className="icon-btn" onClick={() => set({ shadows: shadows.filter((_, j) => j !== i) })}>
              <IconTrash />
            </button>
          </PropRow>
          <PropRow label="Blur/Spr">
            <NumberInput value={shadow.blur} min={0} unit="B" onChange={(v) => update(i, { blur: v })} />
            <NumberInput value={shadow.spread} unit="S" onChange={(v) => update(i, { spread: v })} />
          </PropRow>
          <PropRow label="Color">
            <ColorInput value={shadow.color} onChange={(c) => update(i, { color: c })} />
          </PropRow>
          <PropRow label="Inset">
            <Segmented
              value={shadow.inset ? "yes" : "no"}
              options={[
                { value: "no", label: "Drop" },
                { value: "yes", label: "Inner" },
              ]}
              onChange={(v) => update(i, { inset: v === "yes" ? true : undefined })}
            />
          </PropRow>
        </div>
      ))}
    </Section>
  );
}

function LinkSection({ node, project }: { node: Node; project: SerializedProject }) {
  const link = node.link;
  const setLink = (patch: Partial<NonNullable<Node["link"]>> | null) => {
    if (patch === null) docActions.updateNode(node.id, { link: undefined });
    else docActions.updateNode(node.id, { link: { type: "url", ...link, ...patch } as NonNullable<Node["link"]> });
  };
  return (
    <Section title="Link">
      <PropRow label="Link to">
        <select
          className="prop-input"
          value={link?.type ?? "none"}
          onChange={(e) => {
            const t = e.target.value;
            if (t === "none") setLink(null);
            else if (t === "page") setLink({ type: "page", pageId: project.pages[0]?.id });
            else if (t === "cms-detail") setLink({ type: "cms-detail", collectionId: project.cms.collections[0]?.id });
            else setLink({ type: t as "url" | "email", url: "" });
          }}
        >
          <option value="none">None</option>
          <option value="page">Page</option>
          <option value="url">URL</option>
          <option value="email">Email</option>
          <option value="cms-detail">CMS entry (in lists)</option>
        </select>
      </PropRow>
      {link?.type === "page" && (
        <PropRow label="Page">
          <select className="prop-input" value={link.pageId ?? ""} onChange={(e) => setLink({ pageId: e.target.value })}>
            {project.pages
              .filter((p) => p.kind === "page")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </PropRow>
      )}
      {(link?.type === "url" || link?.type === "email") && (
        <PropRow label={link.type === "email" ? "Email" : "URL"}>
          <input
            className="prop-input"
            placeholder={link.type === "email" ? "hi@example.com" : "https://"}
            defaultValue={link.url}
            key={`${node.id}-link`}
            onBlur={(e) => setLink({ url: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </PropRow>
      )}
      {link?.type === "url" && (
        <PropRow label="New tab">
          <Segmented
            value={link.newTab ? "yes" : "no"}
            options={[
              { value: "no", label: "Same" },
              { value: "yes", label: "New tab" },
            ]}
            onChange={(v) => setLink({ newTab: v === "yes" })}
          />
        </PropRow>
      )}
      {link?.type === "cms-detail" && (
        <PropRow label="Collection">
          <select className="prop-input" value={link.collectionId ?? ""} onChange={(e) => setLink({ collectionId: e.target.value })}>
            {project.cms.collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </PropRow>
      )}
    </Section>
  );
}

function findFirstTextDescendant(project: SerializedProject, rootId: string): Node | null {
  const visit = (id: string): Node | null => {
    const n = project.nodes[id];
    if (!n) return null;
    if (n.type === "text") return n;
    for (const childId of n.children) {
      const found = visit(childId);
      if (found) return found;
    }
    return null;
  };
  return visit(rootId);
}

function setNodeHoverStyle(project: SerializedProject, nodeId: string, patch: Partial<StyleProps>) {
  const target = project.nodes[nodeId];
  if (!target) return;
  const base = ensureHoverEffect(target);
  docActions.updateNode(nodeId, { effects: { ...target.effects, hover: patchHoverStyles(base, patch) } });
}

function HoverAppearanceSection({
  node,
  project,
  bp,
  isText,
  styles,
  set,
  ov,
  reset,
}: {
  node: Node;
  project: SerializedProject;
  bp: BreakpointId;
  isText: boolean;
  styles: StyleProps;
  set: (patch: Partial<StyleProps>) => void;
  ov: (...keys: (keyof StyleProps)[]) => boolean;
  reset: (...keys: (keyof StyleProps)[]) => void;
}) {
  const textTarget = isText ? node : findFirstTextDescendant(project, node.id);
  const textColorNode = textTarget;
  const textColorStyles = textColorNode
    ? resolveHoverAppearance(textColorNode, project, bp, textColorNode.effects?.hover)
    : null;
  const textColorOverridden = textColorNode ? hasHoverOverride(textColorNode.effects?.hover, "color") : false;

  return (
    <Section title="Appearance">
      {textColorNode && (
        <PropRow
          label="Text color"
          overridden={textColorOverridden}
          onReset={() => {
            if (textColorNode.id === node.id) reset("color");
            else {
              const target = project.nodes[textColorNode.id];
              if (!target) return;
              const base = ensureHoverEffect(target);
              docActions.updateNode(textColorNode.id, { effects: { ...target.effects, hover: resetHoverStyleKeys(base, ["color"]) } });
            }
          }}
        >
          <ColorInput
            value={textColorStyles?.color ?? "#111111"}
            onChange={(c) => {
              if (textColorNode.id === node.id) set({ color: c });
              else setNodeHoverStyle(project, textColorNode.id, { color: c });
            }}
          />
        </PropRow>
      )}
      {(node.type === "frame" || node.type === "instance") && (
        <PropRow label="Fill" overridden={ov("fill")} onReset={() => reset("fill")}>
          <ColorInput
            value={
              styles.fill?.type === "solid"
                ? styles.fill.color
                : styles.fill?.type === "linear" || styles.fill?.type === "radial"
                  ? styles.fill.stops[0]?.color ?? "#FFFFFF"
                  : "#FFFFFF"
            }
            onChange={(c) => set({ fill: { type: "solid", color: c } })}
          />
        </PropRow>
      )}
      {(node.type === "frame" || node.type === "image" || node.type === "instance") && (
        <PropRow label="Radius" overridden={ov("radius")} onReset={() => reset("radius")}>
          <NumberInput
            value={typeof styles.radius === "number" ? styles.radius : (styles.radius?.tl ?? 0)}
            min={0}
            unit="px"
            onChange={(v) => set({ radius: v })}
          />
        </PropRow>
      )}
    </Section>
  );
}

function PropertyStateBar({
  state,
  onNormal,
  onHover,
  hoverDuration,
  onDurationChange,
}: {
  state: "normal" | "hover";
  onNormal: () => void;
  onHover: () => void;
  hoverDuration: number;
  onDurationChange: (v: number) => void;
}) {
  return (
    <div className="property-state-bar">
      <div className="property-state-tabs">
        <button className={`property-state-tab ${state === "normal" ? "active" : ""}`} onClick={onNormal}>
          Normal
        </button>
        <button className={`property-state-tab ${state === "hover" ? "active" : ""}`} onClick={onHover}>
          Hover
        </button>
      </div>
      {state === "hover" && (
        <PropRow label="Transition">
          <NumberInput value={hoverDuration} min={0} step={0.05} unit="s" onChange={onDurationChange} />
        </PropRow>
      )}
    </div>
  );
}

function HoverMotionSection({ hover, onChange }: { hover: HoverEffect; onChange: (patch: Partial<HoverEffect>) => void }) {
  return (
    <Section title="Motion">
      <PropRow label="Scale">
        <NumberInput value={hover.scale ?? 1} min={0.1} max={3} step={0.01} unit="×" onChange={(v) => onChange({ scale: v === 1 ? undefined : v })} />
      </PropRow>
      <PropRow label="Lift Y">
        <NumberInput value={hover.y ?? 0} step={1} unit="px" onChange={(v) => onChange({ y: v || undefined })} />
      </PropRow>
      <PropRow label="Rotate">
        <NumberInput value={hover.rotate ?? 0} step={1} unit="°" onChange={(v) => onChange({ rotate: v || undefined })} />
      </PropRow>
      <PropRow label="Opacity">
        <NumberInput
          value={hover.opacity !== undefined ? Math.round(hover.opacity * 100) : 100}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => onChange({ opacity: v === 100 ? undefined : v / 100 })}
        />
      </PropRow>
    </Section>
  );
}

const ENTRANCE_PRESETS: { value: EntrancePreset; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "slide-up", label: "Slide up" },
  { value: "slide-down", label: "Slide down" },
  { value: "slide-left", label: "Slide left" },
  { value: "slide-right", label: "Slide right" },
  { value: "scale", label: "Scale" },
  { value: "blur", label: "Blur" },
];

function EffectsSection({ node }: { node: Node }) {
  const fx = node.effects ?? {};
  const setFx = (patch: Partial<NonNullable<Node["effects"]>>) => {
    docActions.updateNode(node.id, { effects: { ...fx, ...patch } });
  };
  const entrance = fx.entrance;

  return (
    <Section title="Effects">
      <PropRow label="Entrance">
        <select
          className="prop-input"
          value={entrance?.preset ?? "none"}
          onChange={(e) => {
            const preset = e.target.value as EntrancePreset;
            setFx({
              entrance: preset === "none" ? undefined : { preset, duration: entrance?.duration ?? 0.6, delay: entrance?.delay ?? 0, onScroll: entrance?.onScroll ?? true },
            });
          }}
        >
          {ENTRANCE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </PropRow>
      {entrance && entrance.preset !== "none" && (
        <>
          <PropRow label="Duration">
            <NumberInput value={entrance.duration} min={0} step={0.1} unit="s" onChange={(v) => setFx({ entrance: { ...entrance, duration: v } })} />
          </PropRow>
          <PropRow label="Delay">
            <NumberInput value={entrance.delay} min={0} step={0.05} unit="s" onChange={(v) => setFx({ entrance: { ...entrance, delay: v } })} />
          </PropRow>
          <PropRow label="Trigger">
            <Segmented
              value={entrance.onScroll ? "scroll" : "load"}
              options={[
                { value: "load", label: "On load" },
                { value: "scroll", label: "In view" },
              ]}
              onChange={(v) => setFx({ entrance: { ...entrance, onScroll: v === "scroll" } })}
            />
          </PropRow>
        </>
      )}
      <PropRow label="Press">
        <NumberInput
          value={fx.pressScale !== undefined ? fx.pressScale : 1}
          min={0.5}
          max={1.5}
          step={0.01}
          unit="×"
          onChange={(v) => setFx({ pressScale: v === 1 ? undefined : v })}
        />
      </PropRow>
    </Section>
  );
}

/** Per-instance content overrides: text, image src and visibility of master nodes. */
function InstanceOverrides({ node, project }: { node: Node; project: SerializedProject }) {
  const comp = project.components.find((c) => c.id === node.componentId);
  if (!comp) return null;

  // collect overridable nodes (text + image) from the master subtree
  const targets: Node[] = [];
  const visit = (id: string) => {
    const n = project.nodes[id];
    if (!n) return;
    if (n.type === "text" || n.type === "image") targets.push(n);
    for (const c of n.children) visit(c);
  };
  visit(comp.rootId);
  if (targets.length === 0) return null;

  const overrides = node.overrides ?? {};

  return (
    <div style={{ marginTop: 10 }}>
      <div className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        Overrides
      </div>
      {targets.map((t) => {
        const ov = overrides[t.id];
        const hasOv = ov?.text !== undefined || ov?.src !== undefined;
        return (
          <PropRow
            key={t.id}
            label={t.name}
            overridden={hasOv}
            onReset={() => docActions.setInstanceOverride(node.id, t.id, { text: undefined, src: undefined })}
          >
            <input
              className="prop-input"
              placeholder={t.type === "text" ? (t.text ?? "").slice(0, 24) : "Image URL"}
              value={(t.type === "text" ? ov?.text : ov?.src) ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                docActions.setInstanceOverride(node.id, t.id, t.type === "text" ? { text: v || undefined } : { src: v || undefined });
              }}
            />
          </PropRow>
        );
      })}
    </div>
  );
}

/** Find the collection whose fields this node can bind to (inside a list card or a CMS template page). */
function findBindableCollection(project: SerializedProject, node: Node) {
  // walk up ancestors looking for a collectionList
  let cur: Node | null = node;
  while (cur) {
    if (cur.type === "collectionList" && cur.collectionId) {
      return project.cms.collections.find((c) => c.id === cur!.collectionId) ?? null;
    }
    cur = cur.parent ? (project.nodes[cur.parent] ?? null) : null;
  }
  // or: node lives in a cms-template page
  let rootWalk: Node | null = node;
  while (rootWalk?.parent) rootWalk = project.nodes[rootWalk.parent] ?? null;
  if (rootWalk) {
    const page = project.pages.find((p) => p.rootId === rootWalk!.id);
    if (page?.kind === "cms-template" && page.collectionId) {
      return project.cms.collections.find((c) => c.id === page.collectionId) ?? null;
    }
  }
  return null;
}
