import { create } from "zustand";
import type { CSSProperties } from "react";
import { sampleClip, sampledToCss, usesPinnedAnimationOffsets } from "@/model/animation";
import { useDocument } from "./document";

// ─────────────────────────────────────────────────────────────────────────────
// Timeline drawer state + live playback. `preview` holds per-node CSS patches
// for the current playhead; canvas nodes subscribe to their own entry.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DRAWER_HEIGHT = 264;
const MIN_DRAWER_HEIGHT = 160;
const MAX_DRAWER_HEIGHT_RATIO = 0.75;

export type KeyframeRef = { trackId: string; kfId: string };

interface TimelineState {
  open: boolean;
  drawerHeight: number;
  clipId: string | null;
  playhead: number;
  playing: boolean;
  /** selected keyframes (supports multi-select) */
  selectedKeyframes: KeyframeRef[];
  /** track awaiting a canvas pick for retarget */
  retargetTrackId: string | null;
  /** nodeId → inline styles at the current playhead */
  preview: Record<string, CSSProperties>;

  setOpen: (open: boolean) => void;
  setDrawerHeight: (height: number) => void;
  setClip: (clipId: string | null) => void;
  setPlayhead: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  setSelectedKeyframes: (sel: KeyframeRef[]) => void;
  setRetargetTrack: (trackId: string | null) => void;
  /** click-select: additive with shift/cmd, otherwise replace unless already in a multi-selection */
  selectKeyframe: (ref: KeyframeRef, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  isKeyframeSelected: (trackId: string, kfId: string) => boolean;
  /** recompute preview styles for the current clip/playhead */
  refresh: () => void;
  clearPreview: () => void;
}

function computePreview(clipId: string | null, t: number): Record<string, CSSProperties> {
  if (!clipId) return {};
  const project = useDocument.getState().project;
  if (!project) return {};
  const clip = project.animations?.find((c) => c.id === clipId);
  if (!clip) return {};
  const sampled = sampleClip(clip, t);
  const out: Record<string, CSSProperties> = {};
  for (const [nodeId, values] of Object.entries(sampled)) {
    const node = project.nodes[nodeId];
    out[nodeId] = sampledToCss(values, Boolean(node && usesPinnedAnimationOffsets(node)));
  }
  return out;
}

export const useTimeline = create<TimelineState>((set, get) => ({
  open: false,
  drawerHeight: DEFAULT_DRAWER_HEIGHT,
  clipId: null,
  playhead: 0,
  playing: false,
  selectedKeyframes: [],
  retargetTrackId: null,
  preview: {},

  setOpen: (open) => {
    if (open) {
      const { clipId, playhead } = get();
      set({ open: true, preview: computePreview(clipId, playhead) });
    } else {
      set({ open: false, playing: false, preview: {}, selectedKeyframes: [], retargetTrackId: null });
    }
  },
  setDrawerHeight: (height) => {
    const max = Math.round(window.innerHeight * MAX_DRAWER_HEIGHT_RATIO);
    set({ drawerHeight: Math.max(MIN_DRAWER_HEIGHT, Math.min(max, Math.round(height))) });
  },
  setClip: (clipId) => {
    const open = get().open;
    set({
      clipId,
      playhead: 0,
      playing: false,
      selectedKeyframes: [],
      retargetTrackId: null,
      preview: open ? computePreview(clipId, 0) : {},
    });
  },
  setPlayhead: (t) => {
    const { clipId, open } = get();
    set({ playhead: t, preview: open ? computePreview(clipId, t) : {} });
  },
  setPlaying: (playing) => set({ playing }),
  setSelectedKeyframes: (selectedKeyframes) => set({ selectedKeyframes }),
  setRetargetTrack: (retargetTrackId) => set({ retargetTrackId }),
  selectKeyframe: (ref, e) => {
    const current = get().selectedKeyframes;
    const isSelected = current.some((s) => s.trackId === ref.trackId && s.kfId === ref.kfId);
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (additive) {
      set({
        selectedKeyframes: isSelected
          ? current.filter((s) => !(s.trackId === ref.trackId && s.kfId === ref.kfId))
          : [...current, ref],
      });
    } else if (!isSelected) {
      set({ selectedKeyframes: [ref] });
    }
  },
  isKeyframeSelected: (trackId, kfId) => get().selectedKeyframes.some((s) => s.trackId === trackId && s.kfId === kfId),
  refresh: () => {
    const { clipId, playhead, open } = get();
    if (open) set({ preview: computePreview(clipId, playhead) });
  },
  clearPreview: () => set({ preview: {} }),
}));
