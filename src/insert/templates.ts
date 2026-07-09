import { createFrame, createImage, createStack, createText, fill, fit, px, rel, uid } from "@/model/factory";
import { buildClipFromEntrances } from "@/model/animation";
import { useEditor } from "@/store/editor";
import { useTimeline } from "@/store/timeline";
import type { Node, StyleProps } from "@/model/types";
import { docActions } from "@/store/document";

// ─────────────────────────────────────────────────────────────────────────────
// Insert library: primitives and prebuilt sections, all assembled from the
// same node primitives the user can edit afterwards.
// ─────────────────────────────────────────────────────────────────────────────

export type TemplateId =
  | "frame"
  | "stack-v"
  | "stack-h"
  | "grid"
  | "text"
  | "heading"
  | "image"
  | "button"
  | "link-text"
  | "input"
  | "textarea"
  | "divider"
  | "section-navbar"
  | "section-hero"
  | "section-features"
  | "section-cta"
  | "section-pricing"
  | "section-testimonials"
  | "section-footer"
  | "section-gallery";

export interface BuiltTemplate {
  root: Node;
  nodes: Record<string, Node>;
}

function assemble(root: Node, children: BuiltTemplate[]): BuiltTemplate {
  const nodes: Record<string, Node> = { [root.id]: root };
  for (const child of children) {
    child.root.parent = root.id;
    root.children.push(child.root.id);
    Object.assign(nodes, child.nodes);
  }
  return { root, nodes };
}

const leaf = (node: Node): BuiltTemplate => ({ root: node, nodes: { [node.id]: node } });

// ── primitive builders ───────────────────────────────────────────────────────

function buildButton(label = "Get Started", opts: { variant?: "primary" | "ghost" } = {}): BuiltTemplate {
  const primary = opts.variant !== "ghost";
  const btn = createStack("Button", {
    width: fit(),
    height: fit(),
    direction: "row",
    gap: 8,
    align: "center",
    justify: "center",
    padding: { top: 12, right: 24, bottom: 12, left: 24 },
    fill: primary ? { type: "solid", color: "#111111" } : null,
    radius: 10,
    cursor: "pointer",
  });
  if (!primary) btn.styles.desktop.border = { width: 1, color: "#DDDDDD", style: "solid" };
  btn.tag = "button";
  btn.effects = { hover: { scale: 1.03, duration: 0.2 }, pressScale: 0.97 };
  const text = createText(label, {
    fontSize: 15,
    fontWeight: 600,
    color: primary ? "#FFFFFF" : "#111111",
    width: fit(),
    height: fit(),
  });
  text.name = "Label";
  return assemble(btn, [leaf(text)]);
}

function buildNavbar(): BuiltTemplate {
  const nav = createStack("Navbar", {
    width: fill(),
    height: fit(),
    direction: "row",
    gap: 24,
    align: "center",
    justify: "space-between",
    padding: { top: 20, right: 48, bottom: 20, left: 48 },
    fill: { type: "solid", color: "#FFFFFF" },
    sticky: true,
    stickyOffset: 0,
  });
  nav.tag = "nav";
  const logo = createText("Brand", { fontSize: 20, fontWeight: 700, width: fit(), height: fit() });
  logo.name = "Logo";
  const links = createStack("Nav Links", {
    width: fit(),
    height: fit(),
    direction: "row",
    gap: 32,
    align: "center",
    justify: "start",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    fill: null,
  });
  const linkBuilt = ["Product", "Features", "Pricing", "About"].map((label) => {
    const t = createText(label, { fontSize: 14, fontWeight: 500, color: "#444444", width: fit(), height: fit(), cursor: "pointer" });
    t.name = label;
    return leaf(t);
  });
  const linksBuilt = assemble(links, linkBuilt);
  const cta = buildButton("Sign Up");
  return assemble(nav, [leaf(logo), linksBuilt, cta]);
}

function buildHero(): BuiltTemplate {
  const hero = createStack("Hero", {
    width: fill(),
    height: fit(),
    direction: "column",
    gap: 24,
    align: "center",
    justify: "center",
    padding: { top: 120, right: 48, bottom: 120, left: 48 },
    fill: { type: "linear", angle: 180, stops: [{ color: "#FFFFFF", position: 0 }, { color: "#F3F4F8", position: 1 }] },
  });
  hero.tag = "section";
  const heading = createText("Build something beautiful", {
    fontSize: 64,
    fontWeight: 700,
    letterSpacing: -1.5,
    lineHeight: 1.1,
    textAlign: "center",
    width: fit(),
    height: fit(),
    maxWidth: 760,
  });
  heading.name = "Heading";
  heading.textTag = "h1";
  heading.styles.tablet = { fontSize: 48 };
  heading.styles.phone = { fontSize: 34 };
  heading.effects = { entrance: { preset: "slide-up", duration: 0.7, delay: 0, onScroll: false } };
  const sub = createText("A visual canvas that ships real, production-ready code. Design, publish, done.", {
    fontSize: 19,
    fontWeight: 400,
    color: "#555566",
    lineHeight: 1.5,
    textAlign: "center",
    width: fit(),
    height: fit(),
    maxWidth: 560,
  });
  sub.name = "Subheading";
  sub.styles.phone = { fontSize: 16 };
  sub.effects = { entrance: { preset: "slide-up", duration: 0.7, delay: 0.15, onScroll: false } };
  const buttons = createStack("Buttons", {
    width: fit(),
    height: fit(),
    direction: "row",
    gap: 12,
    align: "center",
    justify: "center",
    padding: { top: 8, right: 0, bottom: 0, left: 0 },
    fill: null,
  });
  const buttonsBuilt = assemble(buttons, [buildButton("Get Started"), buildButton("Learn More", { variant: "ghost" })]);
  buttons.effects = { entrance: { preset: "slide-up", duration: 0.7, delay: 0.3, onScroll: false } };
  return assemble(hero, [leaf(heading), leaf(sub), buttonsBuilt]);
}

function buildFeatureCard(title: string, body: string): BuiltTemplate {
  const card = createStack(title, {
    width: fill(),
    height: fit(),
    direction: "column",
    gap: 12,
    align: "start",
    justify: "start",
    padding: { top: 28, right: 28, bottom: 28, left: 28 },
    fill: { type: "solid", color: "#FFFFFF" },
    radius: 16,
    border: { width: 1, color: "#EAEAEE", style: "solid" },
  });
  card.effects = { entrance: { preset: "slide-up", duration: 0.6, delay: 0, onScroll: true }, hover: { y: -4, duration: 0.2 } };
  const icon = createFrame("Icon", {
    width: px(44),
    height: px(44),
    radius: 12,
    fill: { type: "solid", color: "#111111" },
    layout: "absolute",
  });
  const heading = createText(title, { fontSize: 18, fontWeight: 600, width: fit(), height: fit() });
  heading.name = "Title";
  heading.textTag = "h3";
  const text = createText(body, { fontSize: 14, color: "#666677", lineHeight: 1.6, width: fill(), height: fit() });
  text.name = "Body";
  return assemble(card, [leaf(icon), leaf(heading), leaf(text)]);
}

function buildFeatures(): BuiltTemplate {
  const section = createStack("Features", {
    width: fill(),
    height: fit(),
    direction: "column",
    gap: 48,
    align: "center",
    justify: "start",
    padding: { top: 96, right: 48, bottom: 96, left: 48 },
    fill: { type: "solid", color: "#FAFAFC" },
  });
  section.tag = "section";
  const heading = createText("Everything you need", {
    fontSize: 40,
    fontWeight: 700,
    letterSpacing: -1,
    textAlign: "center",
    width: fit(),
    height: fit(),
  });
  heading.name = "Heading";
  heading.textTag = "h2";
  heading.styles.phone = { fontSize: 28 };
  const grid = createFrame("Feature Grid", {
    width: fill(),
    height: fit(),
    layout: "grid",
    gridColumns: 3,
    gap: 20,
    fill: null,
    maxWidth: 1080,
  });
  grid.styles.tablet = { gridColumns: 2 };
  grid.styles.phone = { gridColumns: 1 };
  const gridBuilt = assemble(grid, [
    buildFeatureCard("Visual canvas", "Design directly on an infinite canvas with real layout primitives."),
    buildFeatureCard("Real code", "Every save writes a clean React codebase you can open and read."),
    buildFeatureCard("Responsive", "Desktop, tablet and phone breakpoints with cascading overrides."),
  ]);
  return assemble(section, [leaf(heading), gridBuilt]);
}

function buildCta(): BuiltTemplate {
  const section = createStack("CTA", {
    width: fill(),
    height: fit(),
    direction: "column",
    gap: 20,
    align: "center",
    justify: "center",
    padding: { top: 96, right: 48, bottom: 96, left: 48 },
    fill: { type: "solid", color: "#111111" },
  });
  section.tag = "section";
  const heading = createText("Ready to start?", {
    fontSize: 44,
    fontWeight: 700,
    letterSpacing: -1,
    color: "#FFFFFF",
    textAlign: "center",
    width: fit(),
    height: fit(),
  });
  heading.name = "Heading";
  heading.textTag = "h2";
  heading.styles.phone = { fontSize: 30 };
  const button = buildButton("Get Started Free");
  button.root.styles.desktop.fill = { type: "solid", color: "#FFFFFF" };
  const label = button.nodes[button.root.children[0]];
  label.styles.desktop.color = "#111111";
  return assemble(section, [leaf(heading), button]);
}

function buildPriceCard(plan: string, price: string, features: string[], highlight = false): BuiltTemplate {
  const card = createStack(plan, {
    width: fill(),
    height: fit(),
    direction: "column",
    gap: 16,
    align: "start",
    justify: "start",
    padding: { top: 32, right: 28, bottom: 32, left: 28 },
    fill: { type: "solid", color: highlight ? "#111111" : "#FFFFFF" },
    radius: 18,
    border: { width: 1, color: highlight ? "#111111" : "#EAEAEE", style: "solid" },
  });
  const fg = highlight ? "#FFFFFF" : "#111111";
  const muted = highlight ? "#AAAAB8" : "#666677";
  const name = createText(plan, { fontSize: 15, fontWeight: 600, color: muted, width: fit(), height: fit(), textTransform: "uppercase", letterSpacing: 1 });
  name.name = "Plan";
  const priceText = createText(price, { fontSize: 44, fontWeight: 700, letterSpacing: -1, color: fg, width: fit(), height: fit() });
  priceText.name = "Price";
  const list = createStack("Features", {
    width: fill(),
    height: fit(),
    direction: "column",
    gap: 10,
    align: "start",
    justify: "start",
    padding: { top: 8, right: 0, bottom: 8, left: 0 },
    fill: null,
  });
  const items = features.map((f) => {
    const t = createText(`✓  ${f}`, { fontSize: 14, color: muted, width: fit(), height: fit() });
    t.name = f;
    return leaf(t);
  });
  const listBuilt = assemble(list, items);
  const btn = buildButton("Choose plan", { variant: highlight ? "primary" : "ghost" });
  if (highlight) {
    btn.root.styles.desktop.fill = { type: "solid", color: "#FFFFFF" };
    btn.nodes[btn.root.children[0]].styles.desktop.color = "#111111";
  }
  btn.root.styles.desktop.width = fill();
  return assemble(card, [leaf(name), leaf(priceText), listBuilt, btn]);
}

function buildPricing(): BuiltTemplate {
  const section = createStack("Pricing", {
    width: fill(),
    height: fit(),
    direction: "column",
    gap: 48,
    align: "center",
    justify: "start",
    padding: { top: 96, right: 48, bottom: 96, left: 48 },
    fill: { type: "solid", color: "#FFFFFF" },
  });
  section.tag = "section";
  const heading = createText("Simple pricing", { fontSize: 40, fontWeight: 700, letterSpacing: -1, textAlign: "center", width: fit(), height: fit() });
  heading.name = "Heading";
  heading.textTag = "h2";
  const grid = createFrame("Plans", { width: fill(), height: fit(), layout: "grid", gridColumns: 3, gap: 20, fill: null, maxWidth: 1020 });
  grid.styles.tablet = { gridColumns: 1 };
  const gridBuilt = assemble(grid, [
    buildPriceCard("Starter", "$0", ["1 project", "Community support", "Basic features"]),
    buildPriceCard("Pro", "$19", ["Unlimited projects", "Priority support", "All features", "Custom domain"], true),
    buildPriceCard("Team", "$49", ["Everything in Pro", "5 team seats", "Shared libraries"]),
  ]);
  return assemble(section, [leaf(heading), gridBuilt]);
}

function buildTestimonialCard(quote: string, author: string, role: string): BuiltTemplate {
  const card = createStack(author, {
    width: fill(),
    height: fit(),
    direction: "column",
    gap: 20,
    align: "start",
    justify: "space-between",
    padding: { top: 28, right: 28, bottom: 28, left: 28 },
    fill: { type: "solid", color: "#FFFFFF" },
    radius: 16,
    shadows: [{ x: 0, y: 4, blur: 24, spread: -4, color: "rgba(17,17,17,0.08)" }],
  });
  const quoteText = createText(`“${quote}”`, { fontSize: 16, lineHeight: 1.6, color: "#333344", width: fill(), height: fit() });
  quoteText.name = "Quote";
  const meta = createStack("Author", {
    width: fit(),
    height: fit(),
    direction: "row",
    gap: 12,
    align: "center",
    justify: "start",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    fill: null,
  });
  const avatar = createFrame("Avatar", { width: px(40), height: px(40), radius: 20, fill: { type: "solid", color: "#DDDDE4" }, layout: "absolute" });
  const names = createStack("Names", {
    width: fit(),
    height: fit(),
    direction: "column",
    gap: 2,
    align: "start",
    justify: "start",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    fill: null,
  });
  const nameText = createText(author, { fontSize: 14, fontWeight: 600, width: fit(), height: fit() });
  nameText.name = "Name";
  const roleText = createText(role, { fontSize: 12, color: "#888899", width: fit(), height: fit() });
  roleText.name = "Role";
  const namesBuilt = assemble(names, [leaf(nameText), leaf(roleText)]);
  const metaBuilt = assemble(meta, [leaf(avatar), namesBuilt]);
  return assemble(card, [leaf(quoteText), metaBuilt]);
}

function buildTestimonials(): BuiltTemplate {
  const section = createStack("Testimonials", {
    width: fill(),
    height: fit(),
    direction: "column",
    gap: 48,
    align: "center",
    justify: "start",
    padding: { top: 96, right: 48, bottom: 96, left: 48 },
    fill: { type: "solid", color: "#F3F4F8" },
  });
  section.tag = "section";
  const heading = createText("Loved by makers", { fontSize: 40, fontWeight: 700, letterSpacing: -1, textAlign: "center", width: fit(), height: fit() });
  heading.name = "Heading";
  heading.textTag = "h2";
  const grid = createFrame("Quotes", { width: fill(), height: fit(), layout: "grid", gridColumns: 3, gap: 20, fill: null, maxWidth: 1080 });
  grid.styles.tablet = { gridColumns: 1 };
  const gridBuilt = assemble(grid, [
    buildTestimonialCard("This tool completely changed how we ship landing pages.", "Ava Chen", "Design Lead"),
    buildTestimonialCard("The generated code is actually readable. I was shocked.", "Marcus Reid", "Engineer"),
    buildTestimonialCard("From idea to published site in an afternoon.", "Sofia Laurent", "Founder"),
  ]);
  return assemble(section, [leaf(heading), gridBuilt]);
}

function buildFooter(): BuiltTemplate {
  const footer = createStack("Footer", {
    width: fill(),
    height: fit(),
    direction: "row",
    gap: 24,
    align: "center",
    justify: "space-between",
    padding: { top: 40, right: 48, bottom: 40, left: 48 },
    fill: { type: "solid", color: "#111111" },
  });
  footer.tag = "footer";
  footer.styles.phone = { direction: "column", align: "start", gap: 16 };
  const brand = createText("Brand", { fontSize: 16, fontWeight: 700, color: "#FFFFFF", width: fit(), height: fit() });
  brand.name = "Brand";
  const copyright = createText("© 2026 Brand, Inc. All rights reserved.", { fontSize: 13, color: "#888899", width: fit(), height: fit() });
  copyright.name = "Copyright";
  const links = createStack("Footer Links", {
    width: fit(),
    height: fit(),
    direction: "row",
    gap: 24,
    align: "center",
    justify: "start",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    fill: null,
  });
  const items = ["Twitter", "GitHub", "Contact"].map((l) => {
    const t = createText(l, { fontSize: 13, color: "#AAAAB8", width: fit(), height: fit(), cursor: "pointer" });
    t.name = l;
    return leaf(t);
  });
  const linksBuilt = assemble(links, items);
  return assemble(footer, [leaf(brand), leaf(copyright), linksBuilt]);
}

function buildGallery(): BuiltTemplate {
  const section = createStack("Gallery", {
    width: fill(),
    height: fit(),
    direction: "column",
    gap: 32,
    align: "center",
    justify: "start",
    padding: { top: 96, right: 48, bottom: 96, left: 48 },
    fill: { type: "solid", color: "#FFFFFF" },
  });
  section.tag = "section";
  const heading = createText("Gallery", { fontSize: 40, fontWeight: 700, letterSpacing: -1, textAlign: "center", width: fit(), height: fit() });
  heading.name = "Heading";
  heading.textTag = "h2";
  const grid = createFrame("Images", { width: fill(), height: fit(), layout: "grid", gridColumns: 3, gap: 12, fill: null, maxWidth: 1080 });
  grid.styles.phone = { gridColumns: 1 };
  const images = [1, 2, 3, 4, 5, 6].map((i) => {
    const img = createImage("", { width: fill(), height: px(220), radius: 12 });
    img.name = `Image ${i}`;
    return leaf(img);
  });
  const gridBuilt = assemble(grid, images);
  return assemble(section, [leaf(heading), gridBuilt]);
}

// ── template registry ────────────────────────────────────────────────────────

export function buildTemplate(id: TemplateId): BuiltTemplate {
  switch (id) {
    case "frame":
      return leaf(createFrame("Frame", { fill: { type: "solid", color: "#F0F0F2" } }));
    case "stack-v":
      return leaf(createStack("Stack"));
    case "stack-h": {
      const stack = createStack("Row", { direction: "row" });
      return leaf(stack);
    }
    case "grid": {
      const grid = createFrame("Grid", { width: px(600), height: fit(), layout: "grid", gridColumns: 3, gap: 16, fill: { type: "solid", color: "#F0F0F2" }, padding: { top: 16, right: 16, bottom: 16, left: 16 } });
      const cells = [1, 2, 3].map((i) => {
        const cell = createFrame(`Cell ${i}`, { width: fill(), height: px(120), fill: { type: "solid", color: "#FFFFFF" }, radius: 8 });
        return leaf(cell);
      });
      return assemble(grid, cells);
    }
    case "text":
      return leaf(createText("Type something", { fontSize: 16 }));
    case "heading": {
      const h = createText("Heading", { fontSize: 40, fontWeight: 700, letterSpacing: -1 });
      h.textTag = "h2";
      h.name = "Heading";
      return leaf(h);
    }
    case "image":
      return leaf(createImage(""));
    case "button":
      return buildButton();
    case "link-text": {
      const t = createText("Link", { fontSize: 15, color: "#0055FF", textDecoration: "underline", cursor: "pointer" });
      t.name = "Link";
      t.link = { type: "url", url: "https://" };
      return leaf(t);
    }
    case "input": {
      const input = createFrame("Input", {
        width: px(280),
        height: px(44),
        fill: { type: "solid", color: "#FFFFFF" },
        border: { width: 1, color: "#DDDDDD", style: "solid" },
        radius: 10,
        padding: { top: 0, right: 14, bottom: 0, left: 14 },
        fontSize: 14,
      });
      input.tag = "input";
      input.placeholder = "Enter text…";
      return leaf(input);
    }
    case "textarea": {
      const ta = createFrame("Textarea", {
        width: px(280),
        height: px(100),
        fill: { type: "solid", color: "#FFFFFF" },
        border: { width: 1, color: "#DDDDDD", style: "solid" },
        radius: 10,
        padding: { top: 10, right: 14, bottom: 10, left: 14 },
        fontSize: 14,
      });
      ta.tag = "textarea";
      ta.placeholder = "Enter text…";
      return leaf(ta);
    }
    case "divider":
      return leaf(createFrame("Divider", { width: fill(), height: px(1), fill: { type: "solid", color: "#E5E5EA" }, layout: "absolute" }));
    case "section-navbar":
      return buildNavbar();
    case "section-hero":
      return buildHero();
    case "section-features":
      return buildFeatures();
    case "section-cta":
      return buildCta();
    case "section-pricing":
      return buildPricing();
    case "section-testimonials":
      return buildTestimonials();
    case "section-footer":
      return buildFooter();
    case "section-gallery":
      return buildGallery();
  }
}

/** True for prebuilt page sections (navbar, hero, etc.) — always page-root children. */
export function isSectionTemplate(id: string): boolean {
  return id.startsWith("section-");
}

/** Insert a template into a parent at index; returns the new root node id. */
export function insertTemplate(
  id: TemplateId,
  parentId: string,
  index: number,
  position?: (root: Node) => void,
): string | null {
  const built = buildTemplate(id);
  if (!built) return null;
  position?.(built.root);
  // Navbar always pins to the top of its parent stack.
  const insertIndex = id === "section-navbar" ? 0 : index;
  docActions.insertSubtree(built.nodes, built.root.id, parentId, insertIndex);

  const context = useEditor.getState().context;
  if (context?.kind === "page") {
    const clip = buildClipFromEntrances(context.pageId, built.root.name, built.nodes, built.root.id);
    if (clip) {
      docActions.addEntranceClip(clip);
      useTimeline.getState().setClip(clip.id);
    }
  }

  return built.root.id;
}
