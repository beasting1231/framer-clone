// Dev utility: verify CMS list insertion and preview navigation.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
page.on("console", (m) => m.type() === "error" && errors.push("[console] " + m.text().slice(0, 200)));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.getByText("Demo").first().click();
await page.waitForTimeout(1000);

// insert CMS list on home page
await page.locator(".panel-tab", { hasText: "Insert" }).click();
await page.waitForTimeout(400);
const cmsListBtn = page.locator(".insert-section", { hasText: "Blog Posts list" });
console.log("insert has CMS list:", (await cmsListBtn.count()) > 0);
await cmsListBtn.click();
await page.waitForTimeout(800);
await page.screenshot({ path: "scripts/flow-cms.png" });

// preview: navigate to a CMS detail page by clicking a card
await page.locator(".tool-btn", { hasText: "Preview" }).click();
await page.waitForTimeout(1500);
const frame = page.locator(".preview-frame");
await frame.locator("text=Entry 1").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: "scripts/flow-preview.png" });
await frame.locator("text=Entry 1").first().click();
await page.waitForTimeout(800);
console.log("path after card click:", await page.locator(".preview-bar span").first().innerText());
await page.screenshot({ path: "scripts/flow-cms-detail.png" });

// phone breakpoint in preview
await page.locator(".preview-bar .breakpoint-switcher .tool-btn").nth(2).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "scripts/flow-phone.png" });

await page.waitForTimeout(1200); // autosave flush
console.log("errors:", errors.length === 0 ? "none" : errors.slice(0, 5));
await browser.close();
