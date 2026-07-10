import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type ReactNode, type RefObject } from "react";
import { motion } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// Motion wrapper for preview: appear clips use IntersectionObserver + animate
// (not whileInView) so keyframe timelines fire inside the preview scroll container.
// ─────────────────────────────────────────────────────────────────────────────

function motionTag(tag: string): ElementType {
  if (tag === "img") return motion.img;
  return ((motion as unknown as Record<string, ElementType>)[tag] ?? motion.div) as ElementType;
}

function useAppearInView(
  ref: RefObject<HTMLElement | null>,
  scrollRoot: RefObject<Element | null>,
  viewport: { once?: boolean; pctFromBottom?: number } | undefined,
  enabled: boolean,
  elVersion: number,
): boolean {
  const [inView, setInView] = useState(false);
  const [rootVersion, setRootVersion] = useState(0);

  // Bump when scroll root mounts so the observer rebinds to the preview-frame.
  useEffect(() => {
    if (scrollRoot.current) {
      setRootVersion((v) => v + 1);
      return;
    }
    const id = window.setInterval(() => {
      if (scrollRoot.current) {
        setRootVersion((v) => v + 1);
        window.clearInterval(id);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [scrollRoot]);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    const root = scrollRoot.current;
    if (!el || !root) return;

    let observer: IntersectionObserver | null = null;
    const pct = viewport?.pctFromBottom ?? 20;
    const once = viewport?.once ?? true;

    const bind = () => {
      const rootEl = scrollRoot.current;
      if (!rootEl || !ref.current) return;
      observer?.disconnect();
      const shrink = Math.round(rootEl.clientHeight * (pct / 100));
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setInView(true);
              if (once) observer?.unobserve(ref.current!);
            } else if (!once) {
              setInView(false);
            }
          }
        },
        { root: rootEl, rootMargin: `0px 0px -${shrink}px 0px`, threshold: 0 },
      );
      observer.observe(ref.current);
    };

    bind();
    const rootObserver = new ResizeObserver(bind);
    rootObserver.observe(root);

    return () => {
      observer?.disconnect();
      rootObserver.disconnect();
    };
  }, [enabled, ref, scrollRoot, viewport?.once, viewport?.pctFromBottom, rootVersion, elVersion]);

  return inView;
}

export function PreviewMotion({
  tag = "div",
  anim,
  scrollRoot,
  style,
  children,
  elementRef,
  ...rest
}: {
  tag?: string;
  anim: Record<string, unknown>;
  scrollRoot: RefObject<Element | null>;
  style?: CSSProperties;
  children?: ReactNode;
  elementRef?: (node: HTMLElement | null) => void;
} & Record<string, unknown>) {
  const elRef = useRef<HTMLElement | null>(null);
  const [elVersion, setElVersion] = useState(0);
  const viewport = anim.viewport as { once?: boolean; pctFromBottom?: number } | undefined;
  const isAppear = !!anim.whileInView;
  const inView = useAppearInView(elRef, scrollRoot, viewport, isAppear, elVersion);

  const motionProps = useMemo(() => {
    const props = { ...anim };
    if (isAppear) {
      const target = props.whileInView;
      const initial = props.initial;
      delete props.whileInView;
      delete props.viewport;
      props.animate = inView ? target : initial;
    }
    return props;
  }, [anim, inView, isAppear]);

  const Comp = motionTag(tag);
  return (
    <Comp
      ref={(node: HTMLElement | null) => {
        elementRef?.(node);
        if (elRef.current !== node) {
          elRef.current = node;
          if (node) setElVersion((v) => v + 1);
        }
      }}
      style={style}
      {...motionProps}
      {...rest}
    >
      {children}
    </Comp>
  );
}
