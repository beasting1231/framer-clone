// Dev utility: verify instance override editing UI.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.getByText("Demo").first().click();
await page.waitForTimeout(1200);

// find an instance node (flowtest created a Navbar component earlier); create one if absent
const instanceId = await page.evaluate(() => {
  const p = window.__stores.useDocument.getState().project;
  const inst = Object.values(p.nodes).find((n) => n.type === "instance");
  return inst?.id ?? null;
});
console.log("existing instance:", instanceId);
if (!instanceId) {
  console.log("no instance in project — creating one with Cmd+K");
  await page.locator(".layer-name", { hasText: "Navbar" }).first().click();
  await page.waitForTimeout(200);
  await page.keyboard.press("Meta+k");
  await page.waitForTimeout(500);
}

const finalId = instanceId ?? (await page.evaluate(() => Object.values(window.__stores.useDocument.getState().project.nodes).find((n) => n.type === "instance")?.id));
if (!finalId) {
  console.log("SKIP: could not obtain an instance");
  await browser.close();
  process.exit(0);
}

await page.evaluate((id) => window.__stores.useEditor.getState().select([id]), finalId);
await page.waitForTimeout(400);

console.log("overrides section visible:", (await page.getByText("Overrides", { exact: true }).count()) > 0);
const firstInput = page.locator(".prop-section", { hasText: "Component" }).locator('input[class="prop-input"]').first();
await firstInput.fill("Overridden!");
await page.waitForTimeout(400);
const canvasHas = await page.locator(".artboard-content", { hasText: "Overridden!" }).count();
console.log("canvas shows override:", canvasHas > 0);

// reset via the override dot
await page.locator(".prop-section", { hasText: "Component" }).locator(".override-dot").first().click();
await page.waitForTimeout(300);
const cleared = await page.locator(".artboard-content", { hasText: "Overridden!" }).count();
console.log("override cleared:", cleared === 0);

await page.waitForTimeout(1200);
console.log("errors:", errors.length === 0 ? "none" : errors.slice(0, 3));
await browser.close();
