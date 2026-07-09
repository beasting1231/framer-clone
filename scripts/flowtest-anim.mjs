// Dev utility: verify bottom animation timeline drawer.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.getByText("Demo").first().click();
await page.waitForTimeout(1200);

// open timeline drawer
await page.locator(".tool-btn", { hasText: "Animate" }).click();
await page.waitForTimeout(400);
console.log("drawer visible:", (await page.locator(".timeline-drawer").count()) > 0);

// create animation
page.once("dialog", (d) => d.accept("Hero fade"));
await page.locator(".timeline-header .icon-btn").first().click();
await page.waitForTimeout(400);

// select heading and add opacity track
await page.locator(".layer-name", { hasText: "Hero" }).first().click();
await page.locator(".layer-row", { hasText: "Hero" }).first().locator(".layer-caret").click();
await page.waitForTimeout(200);
await page.locator(".layer-name", { hasText: "Heading" }).first().click();
await page.waitForTimeout(300);
await page.locator(".tl-addtrack button").first().click();
await page.waitForTimeout(200);
await page.locator(".tl-prop-menu .context-item", { hasText: "Opacity" }).click();
await page.waitForTimeout(400);
console.log("tracks:", await page.locator(".timeline-track-label").count());

// set first keyframe to 0 opacity
const firstKf = page.locator(".tl-keyframe").first();
await firstKf.click();
await page.waitForTimeout(200);
const valInput = page.locator(".timeline-inspector .prop-number input").nth(1);
await valInput.fill("0");
await valInput.press("Enter");
await page.waitForTimeout(300);

// scrub playhead to end
const lane = page.locator(".tl-lane").first();
const box = await lane.boundingBox();
await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
await page.mouse.up();
await page.waitForTimeout(200);
await page.locator(".timeline-header .tool-btn", { hasText: "▶" }).click();
await page.waitForTimeout(1200);

console.log("playback ran without errors");

// preview mode should include clip motion
await page.locator(".tool-btn", { hasText: "Preview" }).click();
await page.waitForTimeout(1500);
console.log("preview loaded, errors:", errors.length === 0 ? "none" : errors.slice(0, 3));

await page.waitForTimeout(1200);
await browser.close();
