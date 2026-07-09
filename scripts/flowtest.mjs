// Dev utility: exercise editor flows end-to-end in a headless browser.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err).slice(0, 300)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push("[console] " + msg.text().slice(0, 200));
});

const shot = (name) => page.screenshot({ path: `scripts/flow-${name}.png` });

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.getByText("Demo", { exact: false }).first().click();
await page.waitForTimeout(1200);

// 1. Select the hero heading text via layers tree and check properties panel
await page.locator(".layer-name", { hasText: "Hero" }).first().click();
await page.waitForTimeout(200);
// expand hero
const heroRow = page.locator(".layer-row", { hasText: "Hero" }).first();
await heroRow.locator(".layer-caret").click();
await page.waitForTimeout(200);
await page.locator(".layer-name", { hasText: "Heading" }).first().click();
await page.waitForTimeout(300);
const hasTextSection = await page.locator(".prop-section-header", { hasText: "Text" }).count();
console.log("text section visible:", hasTextSection > 0);

// 2. Create a component from the navbar via context menu
await page.getByText("Sign Up").first().click({ button: "right" });
await page.waitForTimeout(300);
const createComp = page.locator(".context-item", { hasText: "Create Component" });
console.log("context menu has Create Component:", (await createComp.count()) > 0);
await page.keyboard.press("Escape");

// select navbar via layers panel and create component
await page.locator(".layer-name", { hasText: "Navbar" }).first().click();
await page.waitForTimeout(200);
await page.keyboard.press("Meta+k");
await page.waitForTimeout(500);
const compRow = await page.locator(".layer-row.component").count();
console.log("navbar became component instance:", compRow > 0);
await shot("component");

// 3. Switch to tablet breakpoint and set an override
await page.keyboard.press("2");
await page.waitForTimeout(200);

// 4. Undo the component creation
await page.keyboard.press("Meta+z");
await page.waitForTimeout(400);

// 5. CMS: open or create the Blog Posts collection
await page.locator(".panel-tab", { hasText: "CMS" }).click();
await page.waitForTimeout(300);
const existing = page.locator(".page-row", { hasText: "Blog Posts" });
if ((await existing.count()) > 0) {
  await existing.first().click();
} else {
  page.once("dialog", (d) => d.accept("Blog Posts"));
  await page.locator(".panel-content .icon-btn").first().click();
}
await page.waitForTimeout(500);
const fieldsBtn = await page.locator("button", { hasText: "Fields (" }).count();
console.log("collection editor opened:", fieldsBtn > 0);

// add two entries
for (let i = 0; i < 2; i++) {
  await page.locator(".panel-section-title", { hasText: "Entries" }).locator(".icon-btn").click();
  await page.waitForTimeout(300);
  await page.locator(".modal .btn.primary", { hasText: "Done" }).click();
  await page.waitForTimeout(200);
}
console.log("entries added");

// create detail template page if it doesn't exist yet
const createTemplateBtn = page.locator("button", { hasText: "Create detail page template" });
if ((await createTemplateBtn.count()) > 0) {
  await createTemplateBtn.click();
  await page.waitForTimeout(400);
}

// 6. Insert a CMS list on the home page
await page.locator(".panel-tab", { hasText: "Insert" }).click();
await page.waitForTimeout(300);
const cmsListBtn = page.locator(".insert-section", { hasText: "Blog Posts list" });
console.log("insert has CMS list:", (await cmsListBtn.count()) > 0);
await cmsListBtn.click();
await page.waitForTimeout(600);
await shot("cms");

// 7. Preview
await page.locator(".tool-btn", { hasText: "Preview" }).click();
await page.waitForTimeout(1200);
await shot("preview");
// click a CMS card to navigate to detail page
const card = page.locator(".preview-frame").getByText("Entry 1").first();
if ((await card.count()) > 0) {
  await card.click();
  await page.waitForTimeout(600);
  console.log("navigated to:", await page.locator(".preview-bar span").first().innerText());
  await shot("cms-detail");
}

// wait for autosave to flush
await page.waitForTimeout(1500);
console.log("page errors:", errors.length === 0 ? "none" : errors.slice(0, 5));
await browser.close();
