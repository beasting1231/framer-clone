// Dev utility: screenshot the editor for visual verification.
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5173/";
const out = process.argv[3] ?? "scripts/shot.png";
const actions = process.argv[4] ?? "";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("[console.error]", msg.text().slice(0, 300));
});
page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 500)));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

for (const action of actions.split(";").filter(Boolean)) {
  const [type, ...rest] = action.split(":");
  const arg = rest.join(":");
  if (type === "click") await page.click(arg, { timeout: 5000 }).catch((e) => console.log("click failed:", arg, e.message));
  if (type === "clicktext") await page.getByText(arg, { exact: false }).first().click({ timeout: 5000 }).catch((e) => console.log("clicktext failed:", arg, e.message));
  if (type === "wait") await page.waitForTimeout(Number(arg));
  if (type === "key") await page.keyboard.press(arg);
}
await page.waitForTimeout(500);
await page.screenshot({ path: out });
console.log("saved", out);
await browser.close();
