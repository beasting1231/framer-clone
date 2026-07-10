export interface CustomCodeProposal {
  nodeId: string;
  html: string;
  css?: string;
  note?: string;
}

const MAX_CUSTOM_HTML = 40_000;
const MAX_CUSTOM_CSS = 40_000;

export function sanitizeCustomCodeHtml(html: string): string {
  return String(html || "")
    .slice(0, MAX_CUSTOM_HTML)
    .replace(/<\s*\/?\s*(script|iframe|object|embed|link|meta|base|form)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src|xlink:href)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "")
    .replace(/\s+(href|src|xlink:href)\s*=\s*javascript:[^\s>]*/gi, "");
}

export function sanitizeCustomCodeCss(css: string | undefined): string {
  return String(css || "")
    .slice(0, MAX_CUSTOM_CSS)
    .replace(/@import\b[^;]+;/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/<\/?style\b[^>]*>/gi, "");
}

export function validateCustomCodeProposal(value: CustomCodeProposal): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return ["Custom code proposal must be an object."];
  if (typeof value.nodeId !== "string" || !value.nodeId.trim()) errors.push("Custom code proposal needs a nodeId.");
  if (typeof value.html !== "string" || !value.html.trim()) errors.push("Custom code proposal needs html.");
  if (value.html.length > MAX_CUSTOM_HTML) errors.push(`Custom HTML must be ${MAX_CUSTOM_HTML} characters or less.`);
  if (value.css !== undefined && typeof value.css !== "string") errors.push("Custom CSS must be a string.");
  if ((value.css?.length ?? 0) > MAX_CUSTOM_CSS) errors.push(`Custom CSS must be ${MAX_CUSTOM_CSS} characters or less.`);
  if (/<\s*script\b/i.test(value.html)) errors.push("Custom HTML cannot include script tags.");
  if (/\son[a-z]+\s*=/i.test(value.html)) errors.push("Custom HTML cannot include inline event handlers.");
  if (/javascript\s*:/i.test(value.html) || /javascript\s*:/i.test(value.css || "")) errors.push("Custom code cannot include javascript: URLs.");
  if (/@import\b/i.test(value.css || "")) errors.push("Custom CSS cannot include @import.");
  return errors;
}

export function customCodeScopeSelector(nodeId: string): string {
  return `[data-custom-code-node="${cssStringEscape(nodeId)}"]`;
}

export function scopeCustomCodeCss(nodeId: string, css: string | undefined): string {
  const clean = sanitizeCustomCodeCss(css).trim();
  if (!clean) return "";
  const scope = customCodeScopeSelector(nodeId);
  return clean
    .replace(/:host\b/g, scope)
    .replace(/(^|})(\s*)([^@{}][^{}]*)\{/g, (_match, close: string, space: string, selectorText: string) => {
      const selectors = selectorText
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean)
        .map((selector) => (selector.startsWith(scope) ? selector : `${scope} ${selector}`));
      return `${close}${space}${selectors.join(", ")} {`;
    });
}

function cssStringEscape(value: string): string {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
