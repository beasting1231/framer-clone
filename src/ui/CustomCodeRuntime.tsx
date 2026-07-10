import { useEffect, useRef, type CSSProperties, type HTMLAttributes, type MutableRefObject } from "react";
import { mountCustomBehaviors, type CustomCodeBehavior } from "@/model/customBehavior";
import { sanitizeCustomCodeHtml, scopeCustomCodeCss } from "@/model/customCode";

export function useCustomBehaviorHost(
  behaviors: CustomCodeBehavior[] | undefined,
  contentKey = "",
): MutableRefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    return mountCustomBehaviors(host, behaviors);
  }, [behaviors, contentKey]);
  return ref;
}

export function CustomCodeContent({ nodeId, html, css }: { nodeId: string; html: string; css?: string }) {
  const scopedCss = scopeCustomCodeCss(nodeId, css);
  return (
    <>
      {scopedCss ? <style>{scopedCss}</style> : null}
      <div dangerouslySetInnerHTML={{ __html: sanitizeCustomCodeHtml(html) }} />
    </>
  );
}

export function CustomCodeRoot({
  nodeId,
  html,
  css,
  behaviors,
  style,
  ...props
}: {
  nodeId: string;
  html: string;
  css?: string;
  behaviors?: CustomCodeBehavior[];
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, "style">) {
  const hostRef = useCustomBehaviorHost(behaviors, html);
  return (
    <div ref={hostRef as React.Ref<HTMLDivElement>} data-custom-code-node={nodeId} data-custom-code="true" style={style} {...props}>
      <CustomCodeContent nodeId={nodeId} html={html} css={css} />
    </div>
  );
}
