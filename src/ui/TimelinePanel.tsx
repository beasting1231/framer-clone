import { useEffect, useRef, useState, type ReactNode } from "react";
import { docActions, useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { useTimeline } from "@/store/timeline";
import { ANIM_PROPERTIES, type AnimEasing, type AnimProperty, type AnimationClip, type AnimTrack } from "@/model/types";
import { sampleTrack, clipDuration, clipTimelineExtent, getTrackTargetIssue, buildTargetColorMap, NO_TARGET_COLOR, type TargetColor } from "@/model/animation";
import { NumberInput } from "@/properties/controls";
import { IconPlus, IconTrash, IconAlert } from "./icons";

// ─────────────────────────────────────────────────────────────────────────────
// Bottom drawer: horizontal keyframe timeline with one row per animated
// property. Framer-style animations, edited like a video timeline.
// ─────────────────────────────────────────────────────────────────────────────

const PPS = 220; // pixels per second of timeline (times stored in ms)
const LANE_PAD_LEFT = 28; // space before 0ms so the first keyframe is easy to grab
const SNAP_MS = 50;
const msToPx = (ms: number) => (ms / 1000) * PPS;
const pxToMs = (px: number) => Math.round((px / PPS) * 1000);
const timeToPx = (ms: number) => msToPx(ms) + LANE_PAD_LEFT;
const pxToTime = (px: number) => pxToMs(px - LANE_PAD_LEFT);

function snapTime(ms: number): number {
  return Math.round(ms / SNAP_MS) * SNAP_MS;
}
const TRACK_H = 34;
const EASINGS: AnimEasing[] = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"];

type TrackMenuState = { trackId: string; x: number; y: number };
type TrackDragState = { trackId: string };

function dropIndexFromY(clientY: number, rows: HTMLElement[]): number {
  if (rows.length === 0) return 0;
  for (let i = 0; i < rows.length; i++) {
    const rect = rows[i].getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (clientY < mid) return i;
  }
  return rows.length - 1;
}

export function TimelinePanel() {
  const open = useTimeline((s) => s.open);
  if (!open) return null;
  return <TimelineDrawer />;
}

function TimelineDrawerShell({ children }: { children: ReactNode }) {
  const drawerHeight = useTimeline((s) => s.drawerHeight);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = useTimeline.getState().drawerHeight;
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    const move = (ev: MouseEvent) => {
      const max = Math.round(window.innerHeight * 0.75);
      const next = Math.max(160, Math.min(max, startH + (startY - ev.clientY)));
      useTimeline.getState().setDrawerHeight(next);
    };
    const up = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="timeline-drawer" style={{ height: drawerHeight }} onKeyDown={(e) => e.stopPropagation()}>
      <div className="timeline-resize-handle" onMouseDown={startResize} title="Drag to resize" />
      {children}
    </div>
  );
}

function TimelineDrawer() {
  const project = useDocument((s) => s.project);
  const context = useEditor((s) => s.context);
  const selection = useEditor((s) => s.selection);
  const clipId = useTimeline((s) => s.clipId);
  const playhead = useTimeline((s) => s.playhead);
  const playing = useTimeline((s) => s.playing);
  const selectedKeyframes = useTimeline((s) => s.selectedKeyframes);
  const retargetTrackId = useTimeline((s) => s.retargetTrackId);
  const [addTrackOpen, setAddTrackOpen] = useState(false);
  const [trackMenu, setTrackMenu] = useState<TrackMenuState | null>(null);
  const [trackDrag, setTrackDrag] = useState<TrackDragState | null>(null);
  const [dropTrackIndex, setDropTrackIndex] = useState<number | null>(null);
  const lanesRef = useRef<HTMLDivElement | null>(null);
  const tracksScrollRef = useRef<HTMLDivElement | null>(null);
  const dropIndexRef = useRef<number | null>(null);

  const pageId = context?.kind === "page" ? context.pageId : null;
  const clips = (project?.animations ?? []).filter((c) => c.pageId === pageId);
  const clip = clips.find((c) => c.id === clipId) ?? null;

  // auto-select first clip of the page
  useEffect(() => {
    const tl = useTimeline.getState();
    if (!clip && clips.length > 0) tl.setClip(clips[0].id);
    if (clip === null && clips.length === 0 && clipId !== null) tl.setClip(null);
  }, [clip, clips.length, clipId, pageId]);

  // spacebar toggles play/pause while the drawer is open
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      const tl = useTimeline.getState();
      const activeClip = (useDocument.getState().project?.animations ?? []).find((c) => c.id === tl.clipId);
      if (!activeClip) return;
      const dur = clipDuration(activeClip);
      if (!tl.playing && dur > 0 && tl.playhead >= dur) tl.setPlayhead(0);
      tl.setPlaying(!tl.playing);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // delete/backspace removes selected keyframes
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Delete" && e.code !== "Backspace") return;
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable) return;
      const tl = useTimeline.getState();
      if (tl.selectedKeyframes.length === 0 || !tl.clipId) return;
      e.preventDefault();
      e.stopPropagation();
      docActions.deleteKeyframes(tl.clipId, tl.selectedKeyframes);
      tl.setSelectedKeyframes([]);
      tl.refresh();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // escape cancels retarget mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      const tl = useTimeline.getState();
      if (!tl.retargetTrackId) return;
      e.preventDefault();
      e.stopPropagation();
      tl.setRetargetTrack(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // close track context menu on outside click
  useEffect(() => {
    if (!trackMenu) return;
    const close = () => setTrackMenu(null);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [trackMenu]);

  // playback loop
  useEffect(() => {
    if (!playing || !clip) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const tl = useTimeline.getState();
      const activeClip = (useDocument.getState().project?.animations ?? []).find((c) => c.id === clip.id);
      const dur = activeClip ? clipDuration(activeClip) : 0;
      const loop = activeClip?.loop ?? false;
      const dt = (now - last) / 1000;
      last = now;
      let t = tl.playhead + dt * 1000;
      if (dur <= 0) {
        tl.setPlaying(false);
        return;
      }
      if (t >= dur) {
        if (loop) t = t % dur;
        else {
          tl.setPlayhead(dur);
          tl.setPlaying(false);
          return;
        }
      }
      tl.setPlayhead(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, clip?.id]);

  // refresh canvas preview when the clip data changes
  const animations = project?.animations;
  useEffect(() => {
    useTimeline.getState().refresh();
  }, [animations]);

  if (!project) return null;
  const tl = useTimeline.getState();

  if (!pageId) {
    return (
      <TimelineDrawerShell>
        <div className="timeline-header">
          <span className="muted" style={{ fontSize: 12 }}>Timeline animations are per page — exit component editing to use them.</span>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" title="Close" onClick={() => tl.setOpen(false)}>✕</button>
        </div>
      </TimelineDrawerShell>
    );
  }

  const duration = clip ? clipDuration(clip) : 0;
  const extent = clip ? clipTimelineExtent(clip) : 1000;

  const timeFromEvent = (e: React.MouseEvent): number => {
    const el = lanesRef.current;
    if (!el || !clip) return 0;
    const rect = el.getBoundingClientRect();
    const t = pxToTime(e.clientX - rect.left + el.scrollLeft);
    const end = duration > 0 ? duration : extent;
    return Math.max(0, Math.min(end, t));
  };

  const scrubPlayhead = (e: React.MouseEvent) => {
    tl.setPlaying(false);
    tl.setPlayhead(timeFromEvent(e));
    const move = (ev: MouseEvent) => {
      const el = lanesRef.current;
      if (!el || !clip) return;
      const rect = el.getBoundingClientRect();
      const t = pxToTime(ev.clientX - rect.left + el.scrollLeft);
      const end = duration > 0 ? duration : extent;
      useTimeline.getState().setPlayhead(Math.max(0, Math.min(end, t)));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const deleteSelectedKeyframes = () => {
    if (!clip || selectedKeyframes.length === 0) return;
    docActions.deleteKeyframes(clip.id, selectedKeyframes);
    tl.setSelectedKeyframes([]);
    tl.refresh();
  };

  const selectedKf = (() => {
    if (selectedKeyframes.length !== 1 || !clip) return null;
    const { trackId, kfId } = selectedKeyframes[0];
    const track = clip.tracks.find((t) => t.id === trackId);
    const kf = track?.keyframes.find((k) => k.id === kfId);
    return track && kf ? { track, kf } : null;
  })();

  const targetColors = clip ? buildTargetColorMap(clip.tracks) : new Map<string, TargetColor>();

  const syncTrackScroll = (source: "tracks" | "lanes") => {
    const tracksEl = tracksScrollRef.current;
    const lanesEl = lanesRef.current;
    if (!tracksEl || !lanesEl) return;
    if (source === "tracks") lanesEl.scrollTop = tracksEl.scrollTop;
    else tracksEl.scrollTop = lanesEl.scrollTop;
  };

  const startTrackDrag = (e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const from = clip?.tracks.findIndex((t) => t.id === trackId) ?? 0;
    setTrackDrag({ trackId });
    setDropTrackIndex(from);
    dropIndexRef.current = from;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    let didMove = false;

    const move = (ev: MouseEvent) => {
      didMove = true;
      const rows = Array.from(tracksScrollRef.current?.querySelectorAll<HTMLElement>("[data-track-row]") ?? []);
      const idx = dropIndexFromY(ev.clientY, rows);
      dropIndexRef.current = idx;
      setDropTrackIndex(idx);
    };
    const up = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const activeClipId = useTimeline.getState().clipId;
      const activeClip = (useDocument.getState().project?.animations ?? []).find((c) => c.id === activeClipId);
      const to = dropIndexRef.current;
      if (!didMove) {
        const nodeId = activeClip?.tracks.find((t) => t.id === trackId)?.nodeId;
        const node = nodeId ? useDocument.getState().project?.nodes[nodeId] : null;
        if (node) useEditor.getState().select([nodeId!]);
      } else if (activeClip && to !== null) {
        const fromIdx = activeClip.tracks.findIndex((t) => t.id === trackId);
        if (fromIdx >= 0 && fromIdx !== to) docActions.reorderTrack(activeClip.id, trackId, to);
      }
      setTrackDrag(null);
      setDropTrackIndex(null);
      dropIndexRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <TimelineDrawerShell>
      {/* ── header ── */}
      <div className="timeline-header">
        <select
          className="prop-input small"
          style={{ width: 150 }}
          value={clip?.id ?? ""}
          onChange={(e) => tl.setClip(e.target.value || null)}
        >
          {clips.length === 0 && <option value="">No animations</option>}
          {clips.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          className="icon-btn"
          title="New animation"
          onClick={() => {
            const name = prompt("Animation name", `Animation ${clips.length + 1}`);
            if (!name) return;
            tl.setClip(docActions.addClip(pageId, name));
          }}
        >
          <IconPlus />
        </button>
        {clip && (
          <>
            <button
              className="icon-btn"
              title="Delete animation"
              onClick={() => {
                if (confirm(`Delete animation "${clip.name}"?`)) {
                  docActions.deleteClip(clip.id);
                  tl.setClip(null);
                }
              }}
            >
              <IconTrash />
            </button>
            <div className="timeline-sep" />
            <span className="muted tl-label">Trigger</span>
            <select
              className="prop-input small"
              style={{ width: 92 }}
              value={clip.trigger}
              onChange={(e) => docActions.updateClip(clip.id, { trigger: e.target.value as AnimationClip["trigger"] })}
            >
              <option value="load">On load</option>
              <option value="appear">On appear</option>
            </select>
            {clip.trigger === "appear" && (
              <>
                <span className="muted tl-label">Viewport</span>
                <div style={{ width: 72 }}>
                  <NumberInput
                    value={clip.appearViewport ?? 20}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={(v) => docActions.updateClip(clip.id, { appearViewport: v })}
                  />
                </div>
                <span className="muted" style={{ fontSize: 10 }}>from bottom</span>
              </>
            )}
            <label className="tl-loop">
              <input type="checkbox" checked={!!clip.loop} onChange={(e) => docActions.updateClip(clip.id, { loop: e.target.checked })} />
              Loop
            </label>
            <div className="timeline-sep" />
            <button
              className="tool-btn"
              title={playing ? "Pause (Space)" : "Play (Space)"}
              onClick={() => {
                if (!playing && duration > 0 && playhead >= duration) tl.setPlayhead(0);
                tl.setPlaying(!playing);
              }}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <span className="tl-time">{Math.round(playhead)}ms</span>
            {duration > 0 && <span className="muted" style={{ fontSize: 10 }}>/ {duration}ms</span>}
          </>
        )}
        <div style={{ flex: 1 }} />
        <button className="icon-btn" title="Close timeline" onClick={() => tl.setOpen(false)}>✕</button>
      </div>

      {clip ? (
        <div className="timeline-body">
          {retargetTrackId && (
            <div className="tl-retarget-banner">
              Click a layer on the canvas to retarget this track · <kbd>Esc</kbd> to cancel
            </div>
          )}
          {/* ── track labels ── */}
          <div className="timeline-tracks">
            <div className="timeline-ruler-spacer" />
            <div className="timeline-tracks-scroll" ref={tracksScrollRef} onScroll={() => syncTrackScroll("tracks")}>
              {clip.tracks.map((track, index) => {
                const node = project.nodes[track.nodeId];
                const propDef = ANIM_PROPERTIES.find((p) => p.id === track.property);
                const targetIssue = getTrackTargetIssue(clip, track, project.nodes);
                const color = targetIssue ? NO_TARGET_COLOR : (targetColors.get(track.nodeId) ?? NO_TARGET_COLOR);
                const issueTitle =
                  targetIssue === "missing"
                    ? "No target — layer was deleted. Retarget to a layer on the canvas."
                    : targetIssue === "duplicate"
                      ? "No target — another track already animates this layer and property. Retarget or delete."
                      : undefined;
                const dragging = trackDrag?.trackId === track.id;
                const dropBefore = dropTrackIndex === index && trackDrag && trackDrag.trackId !== track.id;
                return (
                  <div key={track.id} data-track-row className="tl-track-row" style={{ height: TRACK_H }}>
                    {dropBefore && <div className="tl-track-drop-line" />}
                    <div
                      className={`timeline-track-label ${targetIssue ? "timeline-track-label--warning" : ""} ${retargetTrackId === track.id ? "timeline-track-label--retargeting" : ""} ${dragging ? "timeline-track-label--dragging" : ""}`}
                      style={{ "--tl-target-muted": color.barMuted, "--tl-target-text": color.text, "--tl-target-dot": color.dot } as React.CSSProperties}
                      onMouseDown={(e) => {
                        if ((e.target as HTMLElement).closest(".tl-track-del")) return;
                        startTrackDrag(e, track.id);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTrackMenu({ trackId: track.id, x: e.clientX, y: e.clientY });
                      }}
                      title={issueTitle ?? (node ? "Click to select · drag to reorder" : "No target")}
                    >
                      <span className="tl-track-grip" aria-hidden>⋮⋮</span>
                      <span className="tl-target-dot" style={{ background: color.dot }} />
                      {targetIssue && (
                        <span className="tl-track-warn" title={issueTitle}>
                          <IconAlert style={{ width: 12, height: 12, color: "var(--danger)" }} />
                        </span>
                      )}
                      <span className={`tl-track-node ${targetIssue ? "tl-track-node--warning" : ""}`} style={{ color: targetIssue ? undefined : color.text }}>
                        {targetIssue ? "No target" : (node?.name ?? "No target")}
                      </span>
                      <span className="tl-track-prop" style={{ color: color.bar }}>{propDef?.label}</span>
                      <button
                        className="icon-btn tl-track-del"
                        title="Remove track"
                        onClick={(e) => {
                          e.stopPropagation();
                          docActions.deleteTrack(clip.id, track.id);
                          tl.setSelectedKeyframes(tl.selectedKeyframes.filter((s) => s.trackId !== track.id));
                          if (retargetTrackId === track.id) tl.setRetargetTrack(null);
                          tl.refresh();
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="tl-addtrack">
              <button
                className="btn"
                style={{ width: "100%", fontSize: 11 }}
                onClick={() => setAddTrackOpen((v) => !v)}
                disabled={selection.length === 0}
                title={selection.length === 0 ? "Select a layer on the canvas first" : "Animate the selected layer"}
              >
                + Add track {selection.length > 0 && project.nodes[selection[0]] ? `(${project.nodes[selection[0]].name})` : ""}
              </button>
              {addTrackOpen && selection.length > 0 && (
                <div className="tl-prop-menu">
                  {ANIM_PROPERTIES.map((p) => (
                    <button
                      key={p.id}
                      className="context-item"
                      onClick={() => {
                        docActions.addTrack(clip.id, selection[0], p.id as AnimProperty);
                        setAddTrackOpen(false);
                        tl.refresh();
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── lanes ── */}
          <div className="timeline-lanes" ref={lanesRef} onScroll={() => syncTrackScroll("lanes")}>
            <div className="timeline-lanes-inner" style={{ width: timeToPx(extent) + 32 }}>
              <Ruler duration={extent} onMouseDown={scrubPlayhead} />
              {clip.tracks.map((track, index) => {
                const targetIssue = getTrackTargetIssue(clip, track, project.nodes);
                const color = targetIssue ? NO_TARGET_COLOR : (targetColors.get(track.nodeId) ?? NO_TARGET_COLOR);
                const dragging = trackDrag?.trackId === track.id;
                const dropBefore = dropTrackIndex === index && trackDrag && trackDrag.trackId !== track.id;
                return (
                  <div key={track.id} className="tl-lane-row" style={{ height: TRACK_H }}>
                    {dropBefore && <div className="tl-track-drop-line" />}
                    <TrackLane
                      clip={clip}
                      track={track}
                      color={color}
                      dragging={dragging}
                      onScrub={scrubPlayhead}
                      onTrackDragStart={startTrackDrag}
                    />
                  </div>
                );
              })}
              {/* playhead */}
              <div className="tl-playhead" style={{ left: timeToPx(playhead) }}>
                <div className="tl-playhead-cap" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="timeline-empty muted">
          Create an animation with the + button, then select a layer and add tracks for the properties you want to animate.
        </div>
      )}

      {trackMenu && clip && (
        <div
          className="context-menu"
          style={{ position: "fixed", left: trackMenu.x, top: trackMenu.y, zIndex: 300 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="context-item"
            onClick={() => {
              docActions.duplicateTrack(clip.id, trackMenu.trackId);
              tl.refresh();
              setTrackMenu(null);
            }}
          >
            Duplicate
          </button>
          <button
            className="context-item"
            onClick={() => {
              tl.setRetargetTrack(trackMenu.trackId);
              setTrackMenu(null);
            }}
          >
            Retarget…
          </button>
          <div className="context-divider" />
          <button
            className="context-item danger"
            onClick={() => {
              docActions.deleteTrack(clip.id, trackMenu.trackId);
              tl.setSelectedKeyframes(tl.selectedKeyframes.filter((s) => s.trackId !== trackMenu.trackId));
              if (retargetTrackId === trackMenu.trackId) tl.setRetargetTrack(null);
              tl.refresh();
              setTrackMenu(null);
            }}
          >
            Remove track
          </button>
        </div>
      )}

      {/* ── keyframe inspector ── */}
      {clip && selectedKeyframes.length > 0 && (
        <div className="timeline-inspector">
          {selectedKf ? (
            <>
              <span className="muted tl-label">Keyframe</span>
              <span className="muted tl-label">Time</span>
              <div style={{ width: 76 }}>
                <NumberInput
                  value={selectedKf.kf.time}
                  min={0}
                  step={10}
                  unit="ms"
                  onChange={(v) => {
                    docActions.updateKeyframe(clip.id, selectedKf.track.id, selectedKf.kf.id, { time: v });
                    tl.refresh();
                  }}
                />
              </div>
              <span className="muted tl-label">Value</span>
              <div style={{ width: 86 }}>
                <NumberInput
                  value={selectedKf.kf.value}
                  step={ANIM_PROPERTIES.find((p) => p.id === selectedKf.track.property)?.step ?? 1}
                  min={ANIM_PROPERTIES.find((p) => p.id === selectedKf.track.property)?.min}
                  max={ANIM_PROPERTIES.find((p) => p.id === selectedKf.track.property)?.max}
                  unit={ANIM_PROPERTIES.find((p) => p.id === selectedKf.track.property)?.unit}
                  onChange={(v) => {
                    docActions.updateKeyframe(clip.id, selectedKf.track.id, selectedKf.kf.id, { value: v });
                    tl.refresh();
                  }}
                />
              </div>
              <span className="muted tl-label">Easing to next</span>
              <select
                className="prop-input small"
                style={{ width: 110 }}
                value={selectedKf.kf.easing}
                disabled={selectedKf.track.keyframes[selectedKf.track.keyframes.length - 1]?.id === selectedKf.kf.id}
                title={selectedKf.track.keyframes[selectedKf.track.keyframes.length - 1]?.id === selectedKf.kf.id ? "The last keyframe has no following segment to ease" : "Controls the segment from this keyframe to the next"}
                onChange={(e) => {
                  docActions.updateKeyframe(clip.id, selectedKf.track.id, selectedKf.kf.id, { easing: e.target.value as AnimEasing });
                  tl.refresh();
                }}
              >
                {EASINGS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </>
          ) : (
            <span className="muted tl-label">{selectedKeyframes.length} keyframes selected</span>
          )}
          <button className="btn danger" style={{ fontSize: 11 }} onClick={deleteSelectedKeyframes}>
            Delete{selectedKeyframes.length > 1 ? ` (${selectedKeyframes.length})` : ""}
          </button>
          <div style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 10 }}>
            Shift-click to multi-select · drag moves selection · Delete to remove
          </span>
        </div>
      )}
    </TimelineDrawerShell>
  );
}

function Ruler({ duration, onMouseDown }: { duration: number; onMouseDown: (e: React.MouseEvent) => void }) {
  const step = duration <= 2000 ? 200 : duration <= 5000 ? 500 : 1000;
  const ticks: { t: number; major: boolean }[] = [];
  for (let t = 0; t <= duration + 1e-6; t += step) {
    ticks.push({ t, major: true });
  }
  return (
    <div className="tl-ruler" onMouseDown={onMouseDown} title="Click / drag to scrub">
      {ticks.map(({ t }) => (
        <div key={t} className="tl-tick major" style={{ left: timeToPx(t) }}>
          <span>{t >= 1000 ? `${t / 1000}s` : `${t}ms`}</span>
        </div>
      ))}
    </div>
  );
}

function TrackLane({
  clip,
  track,
  color,
  dragging,
  onScrub,
  onTrackDragStart,
}: {
  clip: AnimationClip;
  track: AnimTrack;
  color: TargetColor;
  dragging?: boolean;
  onScrub: (e: React.MouseEvent) => void;
  onTrackDragStart: (e: React.MouseEvent, trackId: string) => void;
}) {
  const selectedKeyframes = useTimeline((s) => s.selectedKeyframes);
  const isSelected = (kfId: string) => selectedKeyframes.some((s) => s.trackId === track.id && s.kfId === kfId);

  const addAt = (e: React.MouseEvent) => {
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const t = Math.max(0, pxToTime(e.clientX - rect.left));
    const value = sampleTrack(track, t);
    const id = docActions.addKeyframe(clip.id, track.id, t, Math.round(value * 100) / 100);
    useTimeline.getState().setSelectedKeyframes([{ trackId: track.id, kfId: id }]);
    useTimeline.getState().refresh();
  };

  const dragKeyframe = (e: React.MouseEvent, kfId: string) => {
    e.stopPropagation();
    const ref = { trackId: track.id, kfId };
    const tl = useTimeline.getState();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;

    if (additive) {
      tl.selectKeyframe(ref, e);
    } else {
      const current = tl.selectedKeyframes;
      const inSelection = current.some((s) => s.trackId === ref.trackId && s.kfId === ref.kfId);
      if (!inSelection || current.length === 1) tl.setSelectedKeyframes([ref]);
    }

    const selection = useTimeline.getState().selectedKeyframes;
    const activeClip = (useDocument.getState().project?.animations ?? []).find((c) => c.id === clip.id);
    if (!activeClip || selection.length === 0) return;

    const startTimes = new Map<string, number>();
    for (const sel of selection) {
      const tr = activeClip.tracks.find((t) => t.id === sel.trackId);
      const kf = tr?.keyframes.find((k) => k.id === sel.kfId);
      if (kf) startTimes.set(`${sel.trackId}:${sel.kfId}`, kf.time);
    }

    const startMouseX = e.clientX;
    const before = useDocument.getState().beginGesture();
    let moved = false;
    const move = (ev: MouseEvent) => {
      moved = true;
      const dt = pxToMs(ev.clientX - startMouseX);
      const updates = selection.map((sel) => {
        const key = `${sel.trackId}:${sel.kfId}`;
        let time = Math.max(0, (startTimes.get(key) ?? 0) + dt);
        if (ev.shiftKey) time = snapTime(time);
        return { trackId: sel.trackId, kfId: sel.kfId, patch: { time } };
      });
      docActions.updateKeyframes(clip.id, updates, false);
      useTimeline.getState().refresh();
    };
    const up = () => {
      if (!moved && !additive) useTimeline.getState().setSelectedKeyframes([ref]);
      if (moved) useDocument.getState().commitGesture(before);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // first→last keyframe span bar
  const kfs = track.keyframes;
  const spanStart = kfs.length > 0 ? kfs[0].time : 0;
  const spanEnd = kfs.length > 0 ? kfs[kfs.length - 1].time : 0;

  return (
    <div
      className={`tl-lane-bar ${dragging ? "tl-lane-bar--dragging" : ""}`}
      style={{ "--tl-target-bar": color.bar, "--tl-target-muted": color.barMuted } as React.CSSProperties}
      onMouseDown={onScrub}
      onDoubleClick={addAt}
    >
      <button
        type="button"
        className="tl-lane-grip"
        title="Drag to reorder track"
        onMouseDown={(e) => {
          e.stopPropagation();
          onTrackDragStart(e, track.id);
        }}
      />
      {kfs.length > 1 && (
        <div className="tl-span" style={{ left: timeToPx(spanStart), width: Math.max(msToPx(spanEnd - spanStart), 8) }} />
      )}
      {kfs.map((kf) => (
        <div
          key={kf.id}
          className={`tl-keyframe ${isSelected(kf.id) ? "selected" : ""}`}
          style={{ left: timeToPx(kf.time) }}
          title={`${kf.time}ms → ${kf.value}`}
          onMouseDown={(e) => dragKeyframe(e, kf.id)}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ))}
    </div>
  );
}
