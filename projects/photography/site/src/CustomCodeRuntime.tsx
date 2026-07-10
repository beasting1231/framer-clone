import { useEffect, useRef, type ElementType } from "react";
import { motion } from "framer-motion";

type Behavior = {
  id: string;
  event: "mount" | "click" | "double-click" | "hover-enter" | "hover-leave" | "focus" | "blur";
  target?: string;
  once?: boolean;
  actions: Array<
    Record<string, unknown> & { type: "animate" | "class" | "style" | "attribute" | "text" }
  >;
};

function resolveTargets(host: HTMLElement, selector?: string): HTMLElement[] {
  if (!selector || selector === ":host") return [host];
  try {
    return Array.from(host.querySelectorAll<HTMLElement>(selector));
  } catch {
    return [];
  }
}

function mountBehaviors(host: HTMLElement, behaviors: Behavior[]) {
  const cleanups: Array<() => void> = [];
  const running = new Map<string, Animation[]>();
  const run = (behavior: Behavior) => {
    behavior.actions.forEach((action, actionIndex) => {
      resolveTargets(host, typeof action.target === "string" ? action.target : undefined).forEach(
        (target, targetIndex) => {
          const key = `${behavior.id}:${actionIndex}:${targetIndex}`;
          if (action.type === "animate") {
            const active = (running.get(key) ?? []).filter(
              (animation) => animation.playState === "running",
            );
            if (action.retrigger === "ignore-while-running" && active.length) return;
            active.forEach((animation) => animation.cancel());
            const animation = target.animate((action.keyframes as Keyframe[]) ?? [], {
              duration: Number(action.duration) || 0,
              delay: Number(action.delay) || 0,
              easing: typeof action.easing === "string" ? action.easing : "ease",
              iterations: Number(action.iterations) || 1,
              direction: (action.direction as PlaybackDirection) || "normal",
              fill: (action.fill as FillMode) || "both",
            });
            running.set(key, [animation]);
            void animation.finished
              .then(() => {
                if (
                  action.fill === undefined ||
                  action.fill === "forwards" ||
                  action.fill === "both"
                ) {
                  try {
                    animation.commitStyles();
                  } catch {
                    return;
                  }
                  animation.cancel();
                }
              })
              .catch(() => {})
              .finally(() => {
                if (running.get(key)?.includes(animation)) running.delete(key);
              });
            return;
          }
          if (action.type === "class") {
            const className = String(action.className || "");
            const operation = action.operation as "add" | "remove" | "toggle";
            if (className && operation) target.classList[operation](className);
          }
          if (action.type === "style" && action.styles && typeof action.styles === "object") {
            Object.entries(action.styles as Record<string, string | number>).forEach(
              ([property, value]) => target.style.setProperty(property, String(value)),
            );
          }
          if (action.type === "attribute") {
            const name = String(action.name || "");
            if (action.value === null || action.value === false) target.removeAttribute(name);
            else target.setAttribute(name, action.value === true ? "" : String(action.value ?? ""));
          }
          if (action.type === "text") target.textContent = String(action.value ?? "");
        },
      );
    });
  };
  behaviors.forEach((behavior) => {
    if (behavior.event === "mount") {
      run(behavior);
      return;
    }
    const eventName =
      behavior.event === "double-click"
        ? "dblclick"
        : behavior.event === "hover-enter"
          ? "pointerenter"
          : behavior.event === "hover-leave"
            ? "pointerleave"
            : behavior.event;
    resolveTargets(host, behavior.target).forEach((target) => {
      const listener = () => run(behavior);
      target.addEventListener(eventName, listener, { once: behavior.once });
      cleanups.push(() => target.removeEventListener(eventName, listener));
    });
  });
  return () => {
    cleanups.forEach((cleanup) => cleanup());
    running.forEach((animations) => animations.forEach((animation) => animation.cancel()));
  };
}

export function CustomCodeRuntime({
  className,
  nodeId,
  html,
  css,
  behaviors = [],
  animated = false,
  ...motionProps
}: {
  className?: string;
  nodeId: string;
  html: string;
  css?: string;
  behaviors?: Behavior[];
  animated?: boolean;
} & Record<string, unknown>) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    return mountBehaviors(ref.current, behaviors);
  }, [behaviors, html]);
  const Component = (animated ? motion.div : "div") as ElementType;
  return (
    <Component
      ref={ref}
      className={className}
      data-custom-code-node={nodeId}
      data-custom-code="true"
      {...motionProps}
    >
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </Component>
  );
}
