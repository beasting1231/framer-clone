import { memo, useEffect, useRef, type CSSProperties, type HTMLAttributes, type MutableRefObject } from "react";
import { mountCustomBehaviors, type CustomCodeBehavior } from "@/model/customBehavior";
import { customCodeScopeSelector, sanitizeCustomCodeHtml, scopeCustomCodeCss } from "@/model/customCode";

export function useCustomBehaviorHost(
  behaviors: CustomCodeBehavior[] | undefined,
  contentKey = "",
  options: { editor?: boolean } = {},
): MutableRefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    return mountCustomBehaviors(host, behaviors, options);
  }, [behaviors, contentKey, options.editor]);
  return ref;
}

export const CustomCodeContent = memo(function CustomCodeContent({ nodeId, html, css, editor = false }: { nodeId: string; html: string; css?: string; editor?: boolean }) {
  const scopedCss = scopeCustomCodeCss(nodeId, css);
  const renderedCss = editor
    ? editorCustomCodeCss(scopedCss).replace(/:hover\b/g, "[data-custom-code-hover-disabled]")
    : scopedCss;
  return (
    <>
      {renderedCss ? <style>{renderedCss}</style> : null}
      <div dangerouslySetInnerHTML={{ __html: sanitizeCustomCodeHtml(html) }} />
    </>
  );
});

/**
 * Editor artboards share the app's browser viewport, so viewport-width media
 * queries would otherwise use the editor window instead of the artboard width.
 * Canvas artboards are inline-size containers; convert the common responsive
 * width-query form so custom code behaves like it does in Preview.
 */
export function editorCustomCodeCss(css: string): string {
  return css.replace(/@media\s+([^{}]+)\{/gi, (rule, rawQuery: string) => {
    const query = rawQuery.trim();
    if (!/(?:min-|max-)?width\s*:/i.test(query)) return rule;

    const containerQuery = query.replace(/^(?:(?:only\s+)?(?:screen|all)\s+and\s+)?/i, "");
    if (!/^\([^()]+\)(?:\s+and\s+\([^()]+\))*$/i.test(containerQuery)) return rule;
    return `@container ${containerQuery}{`;
  });
}

export function CustomCodeRoot({
  nodeId,
  html,
  css,
  behaviors,
  editor = false,
  style,
  ...props
}: {
  nodeId: string;
  html: string;
  css?: string;
  behaviors?: CustomCodeBehavior[];
  editor?: boolean;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, "style">) {
  const hostRef = useCustomBehaviorHost(behaviors, html, { editor });
  const editorScope = customCodeScopeSelector(nodeId);
  const editorMotionCss = editor
    ? `${editorScope}[data-custom-code-editor], ${editorScope}[data-custom-code-editor] * { transition-duration: 0s !important; transition-delay: 0s !important; animation-delay: -1000000s !important; animation-play-state: paused !important; animation-fill-mode: both !important; }`
    : "";
  return (
    <div ref={hostRef as React.Ref<HTMLDivElement>} data-custom-code-node={nodeId} data-custom-code="true" data-custom-code-editor={editor || undefined} style={style} {...props}>
      <CustomCodeContent nodeId={nodeId} html={html} css={css} editor={editor} />
      {editorMotionCss ? <style>{editorMotionCss}</style> : null}
    </div>
  );
}
