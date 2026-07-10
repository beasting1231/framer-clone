export type CustomBehaviorEvent = "mount" | "click" | "double-click" | "hover-enter" | "hover-leave" | "focus" | "blur";
export type CustomBehaviorRetrigger = "restart" | "ignore-while-running";

export interface CustomAnimateAction {
  type: "animate";
  target?: string;
  keyframes: Array<Record<string, string | number | null>>;
  duration: number;
  delay?: number;
  easing?: string;
  iterations?: number;
  direction?: PlaybackDirection;
  fill?: FillMode;
  retrigger?: CustomBehaviorRetrigger;
}

export interface CustomClassAction {
  type: "class";
  target?: string;
  className: string;
  operation: "add" | "remove" | "toggle";
}

export interface CustomStyleAction {
  type: "style";
  target?: string;
  styles: Record<string, string | number>;
}

export interface CustomAttributeAction {
  type: "attribute";
  target?: string;
  name: string;
  value?: string | number | boolean | null;
}

export interface CustomTextAction {
  type: "text";
  target: string;
  value: string;
}

export type CustomBehaviorAction =
  | CustomAnimateAction
  | CustomClassAction
  | CustomStyleAction
  | CustomAttributeAction
  | CustomTextAction;

export interface CustomCodeBehavior {
  id: string;
  event: CustomBehaviorEvent;
  target?: string;
  once?: boolean;
  actions: CustomBehaviorAction[];
}

const EVENTS = new Set<CustomBehaviorEvent>(["mount", "click", "double-click", "hover-enter", "hover-leave", "focus", "blur"]);
const ACTIONS = new Set(["animate", "class", "style", "attribute", "text"]);
const DIRECTIONS = new Set<PlaybackDirection>(["normal", "reverse", "alternate", "alternate-reverse"]);
const FILLS = new Set<FillMode>(["none", "forwards", "backwards", "both", "auto"]);
const RETRIGGERS = new Set<CustomBehaviorRetrigger>(["restart", "ignore-while-running"]);
const SAFE_ATTRIBUTE = /^(?:aria-[a-z0-9_.:-]+|data-[a-z0-9_.:-]+|title|hidden|disabled|open)$/i;
const SAFE_CLASS = /^[a-zA-Z_][a-zA-Z0-9_-]{0,79}$/;
const SAFE_CSS_PROPERTY = /^(?:--[a-zA-Z0-9_-]+|[a-zA-Z][a-zA-Z0-9-]{0,79})$/;

export function validateCustomBehaviors(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return ["Custom behaviors must be an array."];
  if (value.length > 30) return ["Custom code supports at most 30 behavior rules."];
  const errors: string[] = [];
  const ids = new Set<string>();
  value.forEach((raw, index) => {
    const path = `Behavior ${index + 1}`;
    if (!raw || typeof raw !== "object") {
      errors.push(`${path} must be an object.`);
      return;
    }
    const behavior = raw as Partial<CustomCodeBehavior>;
    if (typeof behavior.id !== "string" || !SAFE_CLASS.test(behavior.id)) errors.push(`${path} needs a safe unique id.`);
    else if (ids.has(behavior.id)) errors.push(`${path} repeats id ${behavior.id}.`);
    else ids.add(behavior.id);
    if (!EVENTS.has(behavior.event as CustomBehaviorEvent)) errors.push(`${path} has an unsupported event.`);
    validateSelector(behavior.target, `${path} target`, errors);
    if (behavior.once !== undefined && typeof behavior.once !== "boolean") errors.push(`${path} once must be boolean.`);
    if (!Array.isArray(behavior.actions) || behavior.actions.length === 0) errors.push(`${path} needs at least one action.`);
    else if (behavior.actions.length > 20) errors.push(`${path} supports at most 20 actions.`);
    else behavior.actions.forEach((action, actionIndex) => validateAction(action, `${path} action ${actionIndex + 1}`, errors));
  });
  return errors;
}

function validateAction(raw: unknown, path: string, errors: string[]) {
  if (!raw || typeof raw !== "object") {
    errors.push(`${path} must be an object.`);
    return;
  }
  const action = raw as Record<string, unknown>;
  if (!ACTIONS.has(String(action.type))) {
    errors.push(`${path} has an unsupported type.`);
    return;
  }
  validateSelector(action.target, `${path} target`, errors, action.type !== "text");
  if (action.type === "animate") {
    if (!Array.isArray(action.keyframes) || action.keyframes.length < 2 || action.keyframes.length > 20) {
      errors.push(`${path} needs 2 to 20 keyframes.`);
    } else if (action.keyframes.some((frame) => !frame || typeof frame !== "object" || Array.isArray(frame))) {
      errors.push(`${path} keyframes must be objects.`);
    } else {
      action.keyframes.forEach((frame, frameIndex) => validateKeyframe(frame as Record<string, unknown>, `${path} keyframe ${frameIndex + 1}`, errors));
    }
    if (!isFiniteNumber(action.duration) || Number(action.duration) < 0 || Number(action.duration) > 120_000) errors.push(`${path} duration must be 0 to 120000ms.`);
    if (action.delay !== undefined && (!isFiniteNumber(action.delay) || Number(action.delay) < 0 || Number(action.delay) > 120_000)) errors.push(`${path} delay is invalid.`);
    if (action.iterations !== undefined && (!isFiniteNumber(action.iterations) || Number(action.iterations) < 1 || Number(action.iterations) > 100)) errors.push(`${path} iterations is invalid.`);
    if (action.direction !== undefined && !DIRECTIONS.has(action.direction as PlaybackDirection)) errors.push(`${path} direction is invalid.`);
    if (action.fill !== undefined && !FILLS.has(action.fill as FillMode)) errors.push(`${path} fill is invalid.`);
    if (action.retrigger !== undefined && !RETRIGGERS.has(action.retrigger as CustomBehaviorRetrigger)) errors.push(`${path} retrigger is invalid.`);
  }
  if (action.type === "class") {
    if (typeof action.className !== "string" || !SAFE_CLASS.test(action.className)) errors.push(`${path} className is invalid.`);
    if (!new Set(["add", "remove", "toggle"]).has(String(action.operation))) errors.push(`${path} operation is invalid.`);
  }
  if (action.type === "style") {
    if (!action.styles || typeof action.styles !== "object" || Array.isArray(action.styles)) errors.push(`${path} styles must be an object.`);
    else {
      const entries = Object.entries(action.styles as Record<string, unknown>);
      if (entries.length > 30) errors.push(`${path} has too many styles.`);
      for (const [property, value] of entries) {
        if (!SAFE_CSS_PROPERTY.test(property) || !isSafeStyleValue(value)) errors.push(`${path} has an unsafe style ${property}.`);
      }
    }
  }
  if (action.type === "attribute") {
    if (typeof action.name !== "string" || !SAFE_ATTRIBUTE.test(action.name)) errors.push(`${path} attribute is not allowed.`);
    if (!["string", "number", "boolean", "undefined"].includes(typeof action.value) && action.value !== null) errors.push(`${path} value is invalid.`);
  }
  if (action.type === "text") {
    if (typeof action.target !== "string" || !action.target.trim()) errors.push(`${path} needs a target.`);
    if (typeof action.value !== "string" || action.value.length > 10_000) errors.push(`${path} text value is invalid.`);
  }
}

function validateKeyframe(frame: Record<string, unknown>, path: string, errors: string[]) {
  const entries = Object.entries(frame);
  if (entries.length > 30) {
    errors.push(`${path} has too many properties.`);
    return;
  }
  for (const [property, value] of entries) {
    if (property === "offset") {
      if (!isFiniteNumber(value) || Number(value) < 0 || Number(value) > 1) errors.push(`${path} offset must be between 0 and 1.`);
      continue;
    }
    if (property === "easing") {
      if (typeof value !== "string" || value.length > 200 || /javascript\s*:|expression\s*\(/i.test(value)) errors.push(`${path} easing is invalid.`);
      continue;
    }
    if (property === "composite") {
      if (!new Set(["replace", "add", "accumulate", "auto"]).has(String(value))) errors.push(`${path} composite is invalid.`);
      continue;
    }
    if (!SAFE_CSS_PROPERTY.test(property) || (value !== null && !isSafeStyleValue(value))) errors.push(`${path} has an unsafe property ${property}.`);
  }
}

function validateSelector(value: unknown, path: string, errors: string[], optional = true) {
  if (value === undefined && optional) return;
  if (typeof value !== "string" || !value.trim() || value.length > 300 || /[{};]/.test(value)) errors.push(`${path} is invalid.`);
}

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeStyleValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.length <= 1000 && !/javascript\s*:|expression\s*\(|@import/i.test(value);
}

export function mountCustomBehaviors(
  host: HTMLElement,
  behaviors: CustomCodeBehavior[] | undefined,
  options: { editor?: boolean } = {},
): () => void {
  if (!behaviors?.length) return () => {};
  const cleanups: Array<() => void> = [];
  const running = new Map<string, Animation[]>();

  const run = (behavior: CustomCodeBehavior, finishAnimations = false) => {
    behavior.actions.forEach((action, actionIndex) => {
      const targets = resolveTargets(host, action.target);
      targets.forEach((target, targetIndex) => {
        const key = `${behavior.id}:${actionIndex}:${targetIndex}`;
        if (action.type === "animate") {
          if (finishAnimations) {
            if (!(target instanceof HTMLElement)) return;
            const finalFrame = action.keyframes[action.keyframes.length - 1] ?? {};
            Object.entries(finalFrame).forEach(([property, value]) => {
              if (property === "offset" || property === "easing" || property === "composite") return;
              const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
              if (value === null) target.style.removeProperty(cssProperty);
              else target.style.setProperty(cssProperty, String(value));
            });
            return;
          }
          const active = (running.get(key) ?? []).filter((animation) => animation.playState === "running");
          if (action.retrigger === "ignore-while-running" && active.length) return;
          active.forEach((animation) => animation.cancel());
          if (!(target instanceof HTMLElement) || typeof target.animate !== "function") return;
          const animation = target.animate(action.keyframes as Keyframe[], {
            duration: action.duration,
            delay: action.delay ?? 0,
            easing: action.easing ?? "ease",
            iterations: action.iterations ?? 1,
            direction: action.direction ?? "normal",
            fill: action.fill ?? "both",
          });
          running.set(key, [animation]);
          void animation.finished.then(() => {
            if (action.fill === undefined || action.fill === "forwards" || action.fill === "both") {
              try {
                animation.commitStyles();
              } catch {
                // Some browsers do not support commitStyles; the filled animation remains valid there.
                return;
              }
              animation.cancel();
            }
          }).catch(() => {}).finally(() => {
            if (running.get(key)?.includes(animation)) running.delete(key);
          });
          return;
        }
        if (!(target instanceof HTMLElement)) return;
        if (action.type === "class") target.classList[action.operation](action.className);
        if (action.type === "style") {
          Object.entries(action.styles).forEach(([property, value]) => target.style.setProperty(property, String(value)));
        }
        if (action.type === "attribute") {
          if (action.value === null || action.value === false) target.removeAttribute(action.name);
          else target.setAttribute(action.name, action.value === true ? "" : String(action.value ?? ""));
        }
        if (action.type === "text") target.textContent = action.value;
      });
    });
  };

  behaviors.forEach((behavior) => {
    if (behavior.event === "mount") {
      run(behavior, options.editor);
      return;
    }
    if (options.editor && (behavior.event === "hover-enter" || behavior.event === "hover-leave")) return;
    const eventName = behavior.event === "double-click" ? "dblclick" : behavior.event === "hover-enter" ? "pointerenter" : behavior.event === "hover-leave" ? "pointerleave" : behavior.event;
    resolveTargets(host, behavior.target).forEach((target) => {
      const listener = () => run(behavior);
      target.addEventListener(eventName, listener, { once: behavior.once });
      cleanups.push(() => target.removeEventListener(eventName, listener));
    });
  });

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    running.forEach((animations) => animations.forEach((animation) => animation.cancel()));
    running.clear();
  };
}

function resolveTargets(host: HTMLElement, selector?: string): HTMLElement[] {
  if (!selector || selector === ":host") return [host];
  try {
    return Array.from(host.querySelectorAll<HTMLElement>(selector));
  } catch {
    return [];
  }
}
