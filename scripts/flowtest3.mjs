// Dev utility: verify canvas gestures — draw, drag, resize, inline text edit.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
page.on("console", (m) => m.type() === "error" && errors.push("[console] " + m.text().slice(0, 200)));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.getByText("Demo").first().click();
await page.waitForTimeout(1200);

const sizeLabel = async () => {
  const el = page.locator(".sel-size-label");
  return (await el.count()) > 0 ? await el.innerText() : "none";
};

// 1. Draw a frame with the F tool inside the hero (absolute draw should fall into nearest frame)
await page.keyboard.press("f");
await page.mouse.move(300, 200);
await page.mouse.down();
await page.mouse.move(420, 300, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(400);
console.log("after draw, selection size:", await sizeLabel());

// 2. Drag the selected frame (if it landed in a stack it reorders; in free it moves)
await page.mouse.move(360, 250);
await page.mouse.down();
await page.mouse.move(500, 400, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(400);
console.log("drag completed, errors so far:", errors.length);

// 3. Resize via the SE handle
const handle = page.locator(".resize-handle").nth(4); // se
if ((await handle.count()) > 0) {
  const box = await handle.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    console.log("after resize, size:", await sizeLabel());
  }
} else {
  console.log("no resize handles found");
}

// 4. Undo everything
await page.keyboard.press("Meta+z");
await page.keyboard.press("Meta+z");
await page.keyboard.press("Meta+z");
await page.waitForTimeout(300);

// 5. Inline text editing: double-click hero heading
await page.getByText("Build something beautiful").first().dblclick();
await page.waitForTimeout(400);
const editing = await page.locator('[contenteditable="true"]').count();
console.log("inline editing active:", editing > 0);
if (editing > 0) {
  await page.keyboard.press("Meta+a");
  await page.keyboard.type("Hello from the canvas");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const changed = await page.locator(".artboard-content").first().innerText();
  console.log("text updated:", changed.includes("Hello from the canvas"));
  await page.keyboard.press("Meta+z");
}

await page.waitForTimeout(1200);
await page.screenshot({ path: "scripts/flow-gestures.png" });
console.log("errors:", errors.length === 0 ? "none" : errors.slice(0, 5));
await browser.close();
