import type { AnimEasing, AnimProperty, AnimTrack, AnimationClip, EntranceEffect, Node, SerializedProject } from "./types";
import { ANIM_PROPERTIES } from "./types";
import type { CSSProperties } from "react";
import { walkTree } from "./resolve";
import { uid } from "./factory";

// ─────────────────────────────────────────────────────────────────────────────
// Sampling timeline clips: given a clip and a time, produce per-node style
// patches. Used by the editor's live playback; preview/codegen use Framer
// Motion keyframes built by `trackToMotion`.
// ─────────────────────────────────────────────────────────────────────────────

const EASING_FN: Record<AnimEasing, (t: number) => number> = {
  linear: (t) => t,
  ease: (t) => cubicBezier(0.25, 0.1, 0.25, 1, t),
  "ease-in": (t) => cubicBezier(0.42, 0, 1, 1, t),
  "ease-out": (t) => cubicBezier(0, 0, 0.58, 1, t),
  "ease-in-out": (t) => cubicBezier(0.42, 0, 0.58, 1, t),
};

/** Framer Motion cubic-bezier arrays for each easing. */
export const EASING_BEZIER: Record<AnimEasing, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

/** Solve y for x on a cubic bezier with fixed endpoints (0,0)-(1,1). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // binary search over the parametric t
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 24; i++) {
    const cx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    if (Math.abs(cx - x) < 1e-4) break;
    if (cx < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}

/** Convert clip/keyframe time (ms) to seconds for Framer Motion. */
export function msToSec(ms: number): number {
  return ms / 1000;
}

/** Viewport config for appear trigger — fires when element crosses into view at N% from the bottom. */
export function appearViewportConfig(percentFromBottom: number, once = true) {
  const pct = Math.max(0, Math.min(100, percentFromBottom));
  return {
    once,
    amount: "some" as const,
    pctFromBottom: pct,
    // Negative bottom margin shrinks the root from the bottom edge, so intersection
    // begins when the element reaches the line pct% up from the bottom.
    margin: `0px 0px -${pct}% 0px`,
  };
}

/** Duration of a clip = latest keyframe time across all tracks (ms). */
export function clipDuration(clip: AnimationClip): number {
  let max = 0;
  for (const track of clip.tracks) {
    for (const kf of track.keyframes) max = Math.max(max, kf.time);
  }
  return max;
}

/** Minimum timeline width when placing/scrubbing keyframes (ms). */
export function clipTimelineExtent(clip: AnimationClip): number {
  return Math.max(1000, clipDuration(clip));
}

/** Keep stored duration in sync with keyframes (for serialization). */
export function syncClipDuration(clip: AnimationClip): void {
  clip.duration = clipDuration(clip);
}

export type TrackTargetIssue = "missing" | "duplicate";

export type TargetColor = {
  bar: string;
  barMuted: string;
  text: string;
  dot: string;
};

const TARGET_HUES = [212, 268, 152, 32, 8, 328, 172, 48, 252, 98, 195, 285];

export const NO_TARGET_COLOR: TargetColor = {
  bar: "hsl(0 0% 42%)",
  barMuted: "hsl(0 0% 42% / 0.18)",
  text: "hsl(0 0% 55%)",
  dot: "hsl(0 0% 48%)",
};

/** Stable per-target colors within a clip (same nodeId → same color). */
export function buildTargetColorMap(tracks: AnimTrack[]): Map<string, TargetColor> {
  const map = new Map<string, TargetColor>();
  let i = 0;
  for (const track of tracks) {
    if (map.has(track.nodeId)) continue;
    const h = TARGET_HUES[i % TARGET_HUES.length];
    map.set(track.nodeId, {
      bar: `hsl(${h} 72% 52%)`,
      barMuted: `hsl(${h} 72% 52% / 0.22)`,
      text: `hsl(${h} 62% 72%)`,
      dot: `hsl(${h} 76% 58%)`,
    });
    i++;
  }
  return map;
}

/** A track needs retargeting when its layer is gone or another track owns the same target. */
export function getTrackTargetIssue(
  clip: AnimationClip,
  track: AnimTrack,
  nodes: Record<string, Node>,
): TrackTargetIssue | null {
  if (!nodes[track.nodeId]) return "missing";
  const conflicts = clip.tracks.filter((t) => t.nodeId === track.nodeId && t.property === track.property);
  if (conflicts.length > 1 && conflicts[0].id !== track.id) return "duplicate";
  return null;
}

/** Migrate legacy clips that stored duration/keyframe times in seconds. */
export function migrateAnimationClips(clips: AnimationClip[]) {
  for (const clip of clips) {
    if (clip.appearViewport === undefined && clip.duration < 100) {
      clip.duration = Math.round(clip.duration * 1000);
      for (const track of clip.tracks) {
        for (const kf of track.keyframes) kf.time = Math.round(kf.time * 1000);
      }
    }
    clip.appearViewport ??= 20;
    syncClipDuration(clip);
  }
}

export function defaultValueFor(property: AnimProperty): number {
  return ANIM_PROPERTIES.find((p) => p.id === property)?.defaultValue ?? 0;
}

/** Sample one track at time t (milliseconds). */
export function sampleTrack(track: AnimTrack, t: number): number {
  const kfs = track.keyframes;
  if (kfs.length === 0) return defaultValueFor(track.property);
  if (t <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (t >= a.time && t <= b.time) {
      const span = b.time - a.time;
      const raw = span <= 0 ? 1 : (t - a.time) / span;
      const eased = EASING_FN[a.easing ?? "linear"](raw);
      return a.value + (b.value - a.value) * eased;
    }
  }
  return last.value;
}

export interface SampledValues {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
  blur?: number;
}

/** Map timeline property → Framer Motion / CSS prop name. */
function motionKey(property: AnimProperty): string {
  if (property === "blur") return "filter";
  // Timeline x/y are absolute layer coordinates (same as styles.x/y), not transform offsets.
  if (property === "x") return "left";
  if (property === "y") return "top";
  return property;
}

/** Convert a numeric track value to the value Motion/CSS expects. */
function motionValue(property: AnimProperty, value: number): number | string {
  return property === "blur" ? `blur(${value}px)` : value;
}

/** Sample all tracks of a clip at time t → map of nodeId → property values. */
export function sampleClip(clip: AnimationClip, t: number): Record<string, SampledValues> {
  const out: Record<string, SampledValues> = {};
  for (const track of clip.tracks) {
    if (track.keyframes.length === 0) continue;
    (out[track.nodeId] ??= {})[track.property] = sampleTrack(track, t);
  }
  return out;
}

/** Convert sampled values into inline CSS (position + transform + opacity). */
export function sampledToCss(v: SampledValues): CSSProperties {
  const css: CSSProperties = {};
  const parts: string[] = [];
  // x/y are absolute coordinates — override static left/top instead of additive translate.
  if (v.x !== undefined) css.left = v.x;
  if (v.y !== undefined) css.top = v.y;
  if (v.scale !== undefined) parts.push(`scale(${v.scale})`);
  if (v.rotate !== undefined) parts.push(`rotate(${v.rotate}deg)`);
  if (parts.length > 0) css.transform = parts.join(" ");
  if (v.opacity !== undefined) css.opacity = v.opacity;
  if (v.blur !== undefined) css.filter = `blur(${v.blur}px)`;
  return css;
}

export function buildClipMotionMap(project: SerializedProject, pageId: string): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const clip of project.animations ?? []) {
    if (clip.pageId !== pageId) continue;
    const nodeIds = new Set(clip.tracks.map((t) => t.nodeId));
    for (const nodeId of nodeIds) {
      const kf = nodeMotionKeyframes(clip, nodeId);
      if (!kf) continue;
      const target: Record<string, unknown> = { ...kf.values };
      const transition: Record<string, unknown> = {};
      for (const prop of Object.keys(kf.values)) {
        transition[prop] = {
          type: "tween",
          duration: msToSec(kf.duration),
          times: kf.times[prop],
          ease: kf.eases[prop],
          ...(clip.loop ? { repeat: Infinity, repeatType: "loop" } : {}),
        };
      }
      const props: Record<string, unknown> = { transition };
      if (clip.trigger === "appear") {
        props.whileInView = target;
        props.viewport = appearViewportConfig(clip.appearViewport ?? 20, !clip.loop);
      } else {
        props.animate = target;
      }
      const initial: Record<string, unknown> = {};
      for (const [prop, vals] of Object.entries(kf.values)) initial[prop] = vals[0];
      props.initial = initial;
      out[nodeId] = { ...(out[nodeId] ?? {}), ...props };
    }
  }
  return out;
}

/** Serialize clip motion props for one node into JSX attributes (codegen). */
export function clipMotionAttrs(project: SerializedProject, pageId: string, nodeId: string): string {
  const motion = buildClipMotionMap(project, pageId)[nodeId];
  if (!motion) return "";
  const parts: string[] = [];
  if (motion.initial) parts.push(`initial={${JSON.stringify(motion.initial)}}`);
  if (motion.animate) parts.push(`animate={${JSON.stringify(motion.animate)}}`);
  if (motion.whileInView) parts.push(`whileInView={${JSON.stringify(motion.whileInView)}}`);
  if (motion.viewport) parts.push(`viewport={${JSON.stringify(motion.viewport)}}`);
  if (motion.transition) parts.push(`transition={${JSON.stringify(motion.transition)}}`);
  return parts.length > 0 ? " " + parts.join(" ") : "";
}

export interface MotionKeyframes {
  /** motion prop → keyframe value array */
  values: Record<string, (number | string)[]>;
  /** property → normalized 0..1 times */
  times: Record<string, number[]>;
  /** property → per-segment bezier easings */
  eases: Record<string, [number, number, number, number][]>;
  /** duration in ms (converted to seconds for Motion in buildClipMotionMap) */
  duration: number;
}

/**
 * Build Framer Motion keyframe props for one node from a clip.
 * Motion requires a value/time pair list per property.
 */
export function nodeMotionKeyframes(clip: AnimationClip, nodeId: string): MotionKeyframes | null {
  const tracks = clip.tracks.filter((tr) => tr.nodeId === nodeId && tr.keyframes.length > 0);
  if (tracks.length === 0) return null;
  const values: Record<string, (number | string)[]> = {};
  const times: Record<string, number[]> = {};
  const eases: Record<string, [number, number, number, number][]> = {};
  for (const track of tracks) {
    const kfs = [...track.keyframes].sort((a, b) => a.time - b.time);
    const dur = clipDuration(clip);
    // motion `times` must start at 0 and end at 1; pad with holds if needed
    const vs = kfs.map((k) => k.value);
    const ts = kfs.map((k) => Math.min(1, Math.max(0, dur <= 0 ? 0 : k.time / dur)));
    const es = kfs.slice(0, -1).map((k) => EASING_BEZIER[k.easing ?? "linear"]);
    if (ts[0] > 0) {
      vs.unshift(vs[0]);
      ts.unshift(0);
      es.unshift(EASING_BEZIER.linear);
    }
    if (ts[ts.length - 1] < 1) {
      vs.push(vs[vs.length - 1]);
      ts.push(1);
      es.push(EASING_BEZIER.linear);
    }
    values[motionKey(track.property)] = vs.map((v) => motionValue(track.property, v));
    times[motionKey(track.property)] = ts;
    eases[motionKey(track.property)] = es;
  }
  return { values, times, eases, duration: clipDuration(clip) };
}

/** Build a timeline clip from entrance effects on a newly inserted section subtree. */
export function buildClipFromEntrances(
  pageId: string,
  clipName: string,
  nodes: Record<string, Node>,
  rootId: string,
): AnimationClip | null {
  const entries: { nodeId: string; entrance: EntranceEffect }[] = [];
  walkTree(nodes, rootId, (node) => {
    const entrance = node.effects?.entrance;
    if (entrance && entrance.preset !== "none") entries.push({ nodeId: node.id, entrance });
  });
  if (entries.length === 0) return null;

  const trigger = entries.some((e) => e.entrance.onScroll) ? ("appear" as const) : ("load" as const);
  const tracks: AnimTrack[] = [];

  const pushTrack = (nodeId: string, property: AnimProperty, delayMs: number, endMs: number, from: number, to: number) => {
    tracks.push({
      id: uid(),
      nodeId,
      property,
      keyframes: [
        { id: uid(), time: delayMs, value: from, easing: "ease-out" },
        { id: uid(), time: endMs, value: to, easing: "ease-out" },
      ],
    });
  };

  for (const { nodeId, entrance } of entries) {
    const delayMs = Math.round(entrance.delay * 1000);
    const endMs = Math.round((entrance.delay + entrance.duration) * 1000);
    switch (entrance.preset) {
      case "fade":
        pushTrack(nodeId, "opacity", delayMs, endMs, 0, 1);
        break;
      case "slide-up":
        pushTrack(nodeId, "y", delayMs, endMs, 40, 0);
        pushTrack(nodeId, "opacity", delayMs, endMs, 0, 1);
        break;
      case "slide-down":
        pushTrack(nodeId, "y", delayMs, endMs, -40, 0);
        pushTrack(nodeId, "opacity", delayMs, endMs, 0, 1);
        break;
      case "slide-left":
        pushTrack(nodeId, "x", delayMs, endMs, 40, 0);
        pushTrack(nodeId, "opacity", delayMs, endMs, 0, 1);
        break;
      case "slide-right":
        pushTrack(nodeId, "x", delayMs, endMs, -40, 0);
        pushTrack(nodeId, "opacity", delayMs, endMs, 0, 1);
        break;
      case "scale":
        pushTrack(nodeId, "scale", delayMs, endMs, 0.8, 1);
        pushTrack(nodeId, "opacity", delayMs, endMs, 0, 1);
        break;
      case "blur":
        pushTrack(nodeId, "blur", delayMs, endMs, 12, 0);
        pushTrack(nodeId, "opacity", delayMs, endMs, 0, 1);
        break;
    }
  }

  const clip: AnimationClip = { id: uid(), name: clipName, pageId, duration: 0, trigger, appearViewport: 20, loop: false, tracks };
  syncClipDuration(clip);
  return clip;
}
