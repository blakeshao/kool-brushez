import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

let browser, server;
const origin = "http://127.0.0.1:4178";
const launchOptions = process.env.BROWSER_CHANNEL
  ? { channel: process.env.BROWSER_CHANNEL }
  : {};

before(async () => {
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "4178",
      "--strictPort",
    ],
    { stdio: "pipe" },
  );
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, ...launchOptions });
});
after(async () => {
  await browser?.close();
  server?.kill();
});

async function ready(page, brush = "Score") {
  await page.waitForFunction(
    (name) =>
      document.querySelector("#status").textContent.includes(`${name} · Ready`),
    brush,
  );
}
async function select(page, name) {
  // The brush list is a drawer on compact layouts.
  if (!(await page.locator("#brush-list").isVisible()))
    await page.locator("#brushes-toggle").click();
  await page
    .getByRole("button", { name: `${name} brush`, exact: true })
    .click();
  await ready(page, name);
}
async function assertCanvasFitsWorkspace(page, ratio = "auto") {
  await page.waitForFunction((ratio) => {
    const canvas = document.querySelector(".p5Canvas");
    const paper = canvas.getBoundingClientRect();
    const viewport = document
      .querySelector("#canvas-surround")
      .getBoundingClientRect();
    const [w, h] = ratio.split(":").map(Number);
    const target = ratio === "auto" ? viewport.width / viewport.height : w / h;
    return (
      Math.abs(canvas.width / canvas.height - target) < 0.002 &&
      Math.abs(paper.width / paper.height - target) < 0.002 &&
      paper.width <= viewport.width + 1 &&
      paper.height <= viewport.height + 1 &&
      (Math.abs(paper.width - viewport.width) < 1 ||
        Math.abs(paper.height - viewport.height) < 1)
    );
  }, ratio);
  const bounds = await page.locator(".p5Canvas").evaluate((canvas) => {
    const paper = canvas.getBoundingClientRect();
    const viewport = document
      .querySelector("#canvas-surround")
      .getBoundingClientRect();
    return {
      contained:
        paper.left >= viewport.left - 1 &&
        paper.top >= viewport.top - 1 &&
        paper.right <= viewport.right + 1 &&
        paper.bottom <= viewport.bottom + 1,
      centered:
        Math.abs(paper.x + paper.width / 2 - viewport.x - viewport.width / 2) <
          1 &&
        Math.abs(
          paper.y + paper.height / 2 - viewport.y - viewport.height / 2,
        ) < 1,
      fillsAxis:
        Math.abs(paper.width - viewport.width) < 1 ||
        Math.abs(paper.height - viewport.height) < 1,
      noScrolling:
        viewport.width >= canvas.clientWidth - 1 &&
        viewport.height >= canvas.clientHeight - 1,
    };
  });
  assert.deepEqual(bounds, {
    contained: true,
    centered: true,
    fillsAxis: true,
    noScrolling: true,
  });
}
async function options(page) {
  // Let responsive panel changes finish before deciding whether to toggle it.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  if (!(await page.locator("#sidebar").isVisible()))
    await page.locator("#sidebar-toggle").click();
}
async function draw(page, y = 0.4) {
  const box = await page.locator(".p5Canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * y);
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) {
    await page.mouse.move(
      box.x + box.width * (0.2 + i * 0.022),
      box.y + box.height * (y + Math.sin(i * 0.3) * 0.06),
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.locator("#draw-tool").click(); // Finishes all in-flight ink before comparisons.
}
async function pixels(page) {
  return page.locator(".p5Canvas").evaluate((canvas) => {
    const data = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0,
      hash = 2166136261;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) ink++;
      hash = Math.imul(hash ^ data[i], 16777619);
      hash = Math.imul(hash ^ data[i + 1], 16777619);
      hash = Math.imul(hash ^ data[i + 2], 16777619);
    }
    return { ink, hash };
  });
}

test("one shared canvas preserves all brushes, history, erasing, resize and PNG export", async () => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await ready(page);
  await assertCanvasFitsWorkspace(page);
  const paperTop = (await page.locator("#canvas-surround").boundingBox()).y;
  assert.ok(
    Math.abs((await page.locator("#brush-list").boundingBox()).y - paperTop) <
      1,
  );
  const brushesToggle = page.locator("#brushes-toggle");
  const brushesToggleBounds = await brushesToggle.boundingBox();
  const listedCanvas = await page.locator("#canvas-surround").boundingBox();
  await brushesToggle.click();
  assert.equal(await page.locator("#brush-list").isVisible(), false);
  assert.equal(await brushesToggle.getAttribute("aria-label"), "Expand brushes");
  assert.equal(await brushesToggle.getAttribute("aria-expanded"), "false");
  assert.deepEqual(
    await brushesToggle.boundingBox(),
    brushesToggleBounds,
    "the brush handle stays put",
  );
  await assertCanvasFitsWorkspace(page);
  assert.ok(
    (await page.locator("#canvas-surround").boundingBox()).width >
      listedCanvas.width,
  );
  await page.keyboard.press("l");
  assert.equal(await page.locator("#brush-list").isVisible(), true);
  assert.equal(await brushesToggle.getAttribute("aria-expanded"), "true");
  await assertCanvasFitsWorkspace(page);
  assert.equal(await page.locator("canvas:visible").count(), 1);
  assert.equal((await pixels(page)).ink, 0);
  await draw(page, 0.25);
  const score = await pixels(page);
  assert.ok(score.ink > 100);
  await select(page, "Schematic");
  assert.deepEqual(
    await pixels(page),
    score,
    "switching keeps the score marks",
  );
  await draw(page, 0.5);
  const schematic = await pixels(page);
  assert.ok(schematic.ink > score.ink);
  await select(page, "Balloon");
  assert.deepEqual(await pixels(page), schematic);
  await draw(page, 0.74);
  const allBrushes = await pixels(page);
  assert.ok(allBrushes.ink > schematic.ink);
  await page.locator("#undo").click();
  assert.deepEqual(await pixels(page), schematic);
  await page.locator("#redo").click();
  assert.deepEqual(await pixels(page), allBrushes);
  await select(page, "Score");
  assert.deepEqual(await pixels(page), allBrushes);
  await page.locator("#erase-tool").click();
  const box = await page.locator(".p5Canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.25, {
    steps: 30,
  });
  await page.mouse.up();
  assert.ok(
    (await pixels(page)).ink < allBrushes.ink,
    "eraser removes previously committed marks",
  );
  await page.locator("#undo").click();
  assert.deepEqual(await pixels(page), allBrushes);
  await page.getByRole("button", { name: "Clear canvas", exact: true }).click();
  assert.equal((await pixels(page)).ink, 0);
  assert.equal(await page.locator("#empty-state").count(), 0);
  assert.equal(await page.locator("#artboard").innerText(), "");
  await page.locator("#undo").click();
  assert.deepEqual(await pixels(page), allBrushes);
  await page.setViewportSize({ width: 1100, height: 760 });
  await options(page);
  await assertCanvasFitsWorkspace(page);
  assert.ok((await pixels(page)).ink > 0, "resizing retains the drawing");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertCanvasFitsWorkspace(page);
  assert.deepEqual(
    await pixels(page),
    allBrushes,
    "resizing back restores the source pixels exactly",
  );
  await options(page);
  assert.equal(await page.getByLabel("Drawing name").count(), 0);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#export").click(),
  ]);
  assert.equal(download.suggestedFilename(), "Untitled study.png");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  const paperSize = await page
    .locator(".p5Canvas")
    .evaluate((canvas) => [canvas.width, canvas.height]);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], paperSize);
  assert.deepEqual(errors, []);
  await page.close();
});

test("deep links, per-brush controls, safe shortcuts, touch drawing and mobile layout", async () => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/?brush=balloon&color=pink`);
  await ready(page, "Balloon");
  await assertCanvasFitsWorkspace(page);
  assert.equal(
    await page
      .getByRole("button", { name: "Pink", exact: true, includeHidden: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator("#sidebar").isVisible(), false);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const box = await page.locator(".p5Canvas").boundingBox();
  assert.ok(box.width <= 390 && box.width > 250);
  assert.equal(await page.locator("#brush-list").isVisible(), false);
  await page.locator("#brushes-toggle").click();
  assert.equal(await page.locator("#brush-list").isVisible(), true);
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#brush-list").isVisible(),
    false,
    "Escape closes the brush drawer",
  );
  await page.locator("#sidebar-toggle").click();
  await page.getByRole("button", { name: "Collapse brush options" }).click();
  assert.equal(await page.locator("#sidebar").isVisible(), false);
  await page.getByRole("button", { name: "Expand brush options" }).click();
  await page.mouse.click(box.x + 5, box.y + box.height * 0.5);
  assert.equal(await page.locator("#sidebar").isVisible(), false);
  assert.equal((await pixels(page)).ink, 0, "dismissing options does not draw");
  await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.locator("#draw-tool").click();
  assert.ok((await pixels(page)).ink > 0, "a touch tap reveals a balloon");
  await page.locator("#sidebar-toggle").click();
  await select(page, "Schematic");
  await page.locator("#sidebar-toggle").click();
  await page.getByLabel("Drawing language").selectOption("cad");
  assert.equal(await page.getByLabel("Drawing language").inputValue(), "cad");
  await page.getByLabel("Mirror drawing").check();
  await select(page, "Score");
  await page.locator("#sidebar-toggle").click();
  await page.getByRole("button", { name: "Red", exact: true }).click();
  await select(page, "Balloon");
  await page.locator("#sidebar-toggle").click();
  await select(page, "Score");
  await page.locator("#sidebar-toggle").click();
  assert.equal(
    await page
      .getByRole("button", { name: "Red", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await select(page, "Schematic");
  await page.locator("#sidebar-toggle").click();
  assert.equal(await page.getByLabel("Drawing language").inputValue(), "cad");
  assert.equal(await page.getByLabel("Mirror drawing").isChecked(), true);
  await select(page, "Score");
  await page.setViewportSize({ width: 1100, height: 760 });
  await options(page);
  await page.getByRole("slider", { name: "Glob size", exact: true }).press("c");
  assert.ok(
    (await pixels(page)).ink > 0,
    "pressing C in a slider must not clear",
  );
  await page.locator("#help-toggle").click();
  await page.keyboard.press("c");
  assert.ok(
    (await pixels(page)).ink > 0,
    "shortcuts are disabled inside the dialog",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#help-dialog").isVisible(), false);
  assert.deepEqual(errors, []);
  await page.close();
});

test("auto-fill, unknown brush fallback and rapid switching remain usable", async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/?brush=unknown`);
  await ready(page);
  for (const brush of ["Score", "Schematic", "Balloon", "Subway", "Crowd"]) {
    await select(page, brush);
    await options(page);
    await page.locator("#auto-fill").click();
    await page.locator("#draw-tool").click();
    assert.ok((await pixels(page)).ink > 100);
    await options(page);
    await page.locator("#clear").click();
  }
  await page.evaluate(() => {
    for (const name of ["score", "schematic", "subway", "crowd", "balloon", "score", "subway", "crowd", "balloon"])
      document.querySelector(`[data-brush="${name}"]`).click();
  });
  await ready(page, "Balloon");
  assert.match(page.url(), /brush=balloon/);
  assert.equal(await page.locator("canvas:visible").count(), 1);
  assert.deepEqual(errors, []);
  await page.close();
});

test("Subway draws live, honors presets, and preserves pixels through history, switching and Retina export", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/?brush=subway&color=red&routes=2&labels=false&divergence=0`);
  await ready(page, "Subway");
  assert.equal(await page.getByLabel("Parallel routes").inputValue(), "2");
  assert.equal(await page.getByLabel("Station labels").isChecked(), false);
  assert.equal(await page.getByRole("slider", { name: "Route divergence" }).inputValue(), "0");
  assert.equal(await page.getByRole("button", { name: "Broadway red", exact: true }).getAttribute("aria-pressed"), "true");
  const preview = page.locator('[data-brush="subway"] img');
  assert.ok(await preview.evaluate((img) => img.complete && img.naturalWidth > 0));

  const box = await page.locator(".p5Canvas").boundingBox();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .25, { steps: 24 });
  assert.ok((await pixels(page)).ink > 100, "the route is visible before the pen lifts");
  await page.mouse.up();
  await page.locator("#draw-tool").click();
  const red = await pixels(page);
  await page.locator("#draw-tool").click();
  assert.deepEqual(await pixels(page), red, "finish is idempotent");
  const palette = await page.locator(".p5Canvas").evaluate((canvas) => {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0, other = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 200 && data[i + 1] < 130 && data[i + 2] < 100) red++;
      if (data[i] < 80 && (data[i + 1] > 120 || data[i + 2] > 120)) other++;
    }
    return { red, other };
  });
  assert.ok(palette.red > 1000);
  assert.equal(palette.other, 0, "the color preset sets the starting bundle");
  await page.locator("#undo").click();
  assert.equal((await pixels(page)).ink, 0);
  await page.locator("#redo").click();
  assert.deepEqual(await pixels(page), red);
  await page.getByLabel("Station labels").check();
  await page.getByLabel("Parallel routes").selectOption("4");
  await page.getByRole("button", { name: "Subway mix", exact: true }).click();
  await page.getByRole("slider", { name: "Route divergence" }).press("End");
  assert.deepEqual(await pixels(page), red, "settings leave existing artwork intact");
  await draw(page, .6);
  const mixed = await pixels(page);
  assert.ok(mixed.ink > red.ink);
  await select(page, "Score");
  assert.deepEqual(await pixels(page), mixed);
  await select(page, "Subway");
  assert.equal(await page.getByLabel("Parallel routes").inputValue(), "4");
  assert.equal(await page.getByLabel("Station labels").isChecked(), true);
  assert.equal(await page.getByRole("slider", { name: "Route divergence" }).inputValue(), "2");
  assert.deepEqual(await pixels(page), mixed);
  await page.getByLabel("Canvas aspect ratio").selectOption("16:9");
  await assertCanvasFitsWorkspace(page, "16:9");
  assert.ok((await pixels(page)).ink > 100);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export").click()]);
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [2400, 1350]);
  assert.deepEqual(errors, []);
  await page.close();
});

test("Subway trails the pen slightly and new branches animate independently through pauses, moves and release", async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/?brush=subway`);
  await ready(page, "Subway");
  const result = await page.evaluate(async () => {
    const { default: P5 } = await import("/node_modules/.vite/deps/p5.js");
    const { default: createBrush } = await import("/brushes/subway/sketch.js");
    return new Promise((resolve, reject) => {
      const host = document.createElement("div"); host.hidden = true; document.body.append(host);
      new P5((p) => {
        p.setup = () => {
          try {
            p.pixelDensity(1); p.createCanvas(900, 650); p.noLoop(); p.randomSeed(17);
            let now = 0;
            p.millis = () => now;
            const notes = new Set();
            const createGraphics = p.createGraphics.bind(p);
            p.createGraphics = (...args) => {
              const layer = createGraphics(...args), ctx = layer.drawingContext;
              const fillText = ctx.fillText.bind(ctx);
              ctx.fillText = (text, ...args) => { if (ctx.globalAlpha > 0) notes.add(text); fillText(text, ...args); };
              return layer;
            };
            const brush = createBrush(p); brush.setup();
            brush.setSetting("labels", false);
            let tipX = 150;
            function frame(time) {
              now = time; p.background(255); brush.draw();
              const data = p.drawingContext.getImageData(0, 0, p.width, p.height).data;
              let ink = 0, colored = 0, away = 0, nearTip = 0, hash = 2166136261;
              for (let i = 0; i < data.length; i += 4) {
                if (Math.min(data[i], data[i + 1], data[i + 2]) < 240) ink++;
                if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 70) {
                  colored++;
                  const x = (i / 4) % p.width, y = Math.floor(i / 4 / p.width);
                  if (Math.abs(y - 300) > 16) away++;
                  if (x >= tipX - 15 && x <= tipX + 2 && Math.abs(y - 300) <= 12) nearTip++;
                }
                hash = Math.imul(hash ^ data[i], 16777619);
                hash = Math.imul(hash ^ data[i + 1], 16777619);
                hash = Math.imul(hash ^ data[i + 2], 16777619);
              }
              return { ink, colored, away, nearTip, hash };
            }
            brush.pointerDown(100, 300); brush.pointerMove(150, 300);
            const first = frame(0), paused = frame(5000);
            tipX = 760; brush.pointerMove(tipX, 300);
            const extended = frame(5000), early = frame(5200);
            tipX = 765; brush.pointerMove(tipX, 300);
            const moved = frame(5200);
            brush.pointerUp();
            const released = frame(5600), complete = frame(100000);
            brush.finish();
            const finished = frame(100000);
            brush.clear();
            p.randomSeed(17);
            brush.pointerDown(100, 300); brush.pointerMove(760, 300); brush.pointerUp();
            frame(100000);
            const interrupted = frame(100200);
            brush.clear();
            const cleared = frame(200000);
            brush.setSetting("labels", true);
            brush.autoFill();
            const autoStart = frame(200000);
            brush.finish(); // All staggered starts are still in the future.
            const autoFinished = frame(200000), settled = frame(400000);
            const result = { first, paused, extended, early, moved, released, complete, finished, interrupted, cleared, autoStart, autoFinished, settled, notes: [...notes] };
            queueMicrotask(() => { p.remove(); host.remove(); resolve(result); });
          } catch (error) { reject(error); }
        };
      }, host);
    });
  });
  assert.equal(result.first.nearTip, 0, "the main strands start just behind the brush");
  assert.ok(result.paused.nearTip > 40, "the main strands catch up when the brush pauses");
  assert.equal(result.extended.nearTip, 0, "a fast move leaves a fresh delay after a pause");
  assert.ok(result.early.nearTip > 40, "the short delay catches up within a fraction of a second");
  assert.equal(result.extended.away, 0, "new branches start empty even after a five-second pause");
  assert.ok(result.early.away > 20, "branches grow while the pointer is still down");
  assert.equal(result.moved.away, result.early.away, "continuing the stroke neither resets nor reshapes existing branches");
  assert.ok(result.released.away > result.early.away, "branches continue growing after release");
  assert.ok(result.complete.away >= result.released.away);
  assert.deepEqual(result.finished, result.complete, "settling an already complete animation changes no pixels");
  assert.ok(result.interrupted.away > 0);
  assert.equal(result.cleared.ink, 0, "clearing cancels all future drawing");
  assert.equal(result.autoStart.ink, 0);
  assert.ok(result.autoFinished.colored > result.complete.colored);
  assert.deepEqual(result.settled, result.autoFinished, "finish leaves no delayed routes behind");
  const notes = ["Free transfer", "Peak direction", "Bus connection", "Rail connection", "AirTrain", "Ferry connection", "Uptown", "Weekdays only"];
  assert.ok(notes.filter((note) => result.notes.includes(note)).length >= 6, "the map includes varied transit annotations");
  assert.deepEqual(errors, []);
  await page.close();
});

test("Subway starts new colored services at turns without recoloring earlier lines", async () => {
  const page = await browser.newPage();
  await page.goto(`${origin}/?brush=subway`);
  await ready(page, "Subway");
  const result = await page.evaluate(async () => {
    const { default: P5 } = await import("/node_modules/.vite/deps/p5.js");
    const { default: createBrush } = await import("/brushes/subway/sketch.js");
    const { FAMILIES } = await import("/brushes/subway/palette.js");
    return new Promise((resolve, reject) => {
      const host = document.createElement("div"); host.hidden = true; document.body.append(host);
      new P5((p) => {
        p.setup = () => {
          try {
            p.pixelDensity(2); p.createCanvas(900, 650); p.noLoop(); p.randomSeed(17);
            let now = 0; p.millis = () => now;
            const brush = createBrush(p); brush.setup();
            brush.setSetting("labels", false); brush.setSetting("divergence", 0);
            const frame = () => { p.background(255); brush.draw(); };
            const colors = (x, y, w, h) => {
              const data = p.drawingContext.getImageData(x * 2, y * 2, w * 2, h * 2).data;
              const counts = Object.fromEntries(Object.keys(FAMILIES).map((key) => [key, 0]));
              let hash = 2166136261;
              for (let i = 0; i < data.length; i += 4) {
                const hex = "#" + Array.from(data.slice(i, i + 3), (byte) => byte.toString(16).padStart(2, "0")).join("");
                for (const [key, family] of Object.entries(FAMILIES)) if (family.ink === hex) counts[key]++;
                hash = Math.imul(hash ^ data[i], 16777619);
                hash = Math.imul(hash ^ data[i + 1], 16777619);
                hash = Math.imul(hash ^ data[i + 2], 16777619);
              }
              return { counts, hash };
            };
            brush.pointerDown(100, 300); brush.pointerMove(406, 300); frame();
            now = 1000; frame();
            const before = colors(110, 280, 160, 40);
            for (let y = 297; y >= 96; y -= 3) brush.pointerMove(406, y);
            frame(); now = 2000; frame();
            const after = colors(110, 280, 160, 40), outgoing = colors(390, 120, 40, 100);
            brush.pointerUp(); brush.finish(); frame();
            const settled = colors(390, 120, 40, 100);
            queueMicrotask(() => { p.remove(); host.remove(); resolve({ before, after, outgoing, settled }); });
          } catch (error) { reject(error); }
        };
      }, host);
    });
  });
  assert.deepEqual(result.after, result.before, "a turn preserves every pixel of the earlier straight");
  const newColors = Object.keys(result.outgoing.counts).filter((key) => !result.before.counts[key] && result.outgoing.counts[key] > 50);
  assert.equal(newColors.length, 2, "two new colors grow along the outgoing route");
  assert.deepEqual(result.settled, result.outgoing, "finishing preserves the newly grown services");
  await page.close();
});

test("export and undo settle a Subway auto-fill that is still drawing", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${origin}/?brush=subway`);
  await ready(page, "Subway");
  await page.locator("#auto-fill").click();
  const partial = await pixels(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export").click()]);
  const complete = await pixels(page);
  assert.ok(complete.ink > partial.ink, "export immediately finishes the growing network");
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).subarray(1, 4).toString(), "PNG");
  await page.locator("#undo").click();
  assert.equal((await pixels(page)).ink, 0);
  await page.locator("#redo").click();
  assert.deepEqual(await pixels(page), complete);
  await page.locator("#auto-fill").click();
  await page.locator("#undo").click();
  assert.deepEqual(await pixels(page), complete, "undo also cancels pending routes");
  await page.close();
});

test("right-side controls support dragging and keys, preserve brush settings, and keep existing marks", async () => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await ready(page);
  assert.equal(await page.locator("#artboard").innerText(), "");
  assert.equal(await page.locator("#sidebar").isVisible(), true);
  const size = page.getByRole("slider", { name: "Glob size", exact: true });
  const staffSize = page.getByRole("slider", { name: "Staff size", exact: true });
  assert.equal(await staffSize.inputValue(), "1");
  const box = await size.boundingBox();
  const canvas = await page.locator("#canvas-surround").boundingBox();
  assert.ok(
    box.x >= canvas.x + canvas.width,
    "brush controls stay in the right column",
  );
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  const dragged = Number(await size.inputValue());
  assert.ok(dragged > 1);
  await size.press("ArrowRight");
  const adjusted = Number(await size.inputValue());
  assert.ok(Math.abs(adjusted - dragged - 0.05) < 0.001);
  assert.equal(await staffSize.inputValue(), "1", "glob size leaves staff size alone");
  await staffSize.press("ArrowRight");
  assert.equal(await staffSize.inputValue(), "1.05");
  assert.equal(Number(await size.inputValue()), adjusted, "staff size leaves glob size alone");
  assert.equal(
    (await pixels(page)).ink,
    0,
    "adjusting a slider does not draw on the paper",
  );
  await select(page, "Balloon");
  await draw(page, 0.5);
  const before = await pixels(page);
  const cells = page.getByRole("slider", { name: "Cell size", exact: true });
  await cells.press("ArrowRight");
  assert.equal(await cells.inputValue(), "0.55");
  assert.deepEqual(
    await pixels(page),
    before,
    "re-dealing with the size slider keeps the artwork",
  );
  await select(page, "Score");
  assert.equal(await staffSize.inputValue(), "1.05", "staff size persists across brush switching");
  await staffSize.press("End");
  assert.equal(await staffSize.inputValue(), "4");
  assert.deepEqual(await pixels(page), before, "staff size keeps existing artwork");
  assert.equal(
    Number(await size.inputValue()),
    adjusted,
    "size persists across brush switching",
  );
  await size.press("End");
  assert.equal(await size.inputValue(), "4");
  await size.press("Home");
  assert.equal(await size.inputValue(), "0.4");
  const toggle = page.locator("#sidebar-toggle");
  const toggleBounds = await toggle.boundingBox();
  const expandedCanvas = await page.locator("#canvas-surround").boundingBox();
  await toggle.click();
  assert.equal(await page.locator("#sidebar").isVisible(), false);
  assert.equal(await toggle.getAttribute("aria-label"), "Expand brush options");
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.deepEqual(await toggle.boundingBox(), toggleBounds, "the toggle stays put");
  await assertCanvasFitsWorkspace(page);
  assert.ok((await page.locator("#canvas-surround").boundingBox()).width > expandedCanvas.width);
  await page.keyboard.press("h");
  await assertCanvasFitsWorkspace(page);
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  assert.deepEqual(await pixels(page), before, "collapsing and expanding preserves the drawing");
  await page.keyboard.press("Tab");
  assert.equal(await size.evaluate((input) => input === document.activeElement), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#sidebar").isVisible(), false);
  assert.equal(await toggle.evaluate((button) => button === document.activeElement), true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.locator("#sidebar").isVisible(), false, "resizing remembers desktop collapse");
  await toggle.click();
  assert.equal(await size.inputValue(), "0.4", "collapsed controls retain settings");
  assert.equal(await staffSize.inputValue(), "4");
  assert.deepEqual(errors, []);
  await page.close();
});

test("Score staff size changes the ribbon while glob diameters remain independent", async () => {
  const page = await browser.newPage();
  await page.goto(origin);
  await ready(page);
  const samples = await page.evaluate(async () => {
    const { default: P5 } = await import("/node_modules/.vite/deps/p5.js");
    const { default: createBrush } = await import("/brushes/score/sketch.js");
    const results = [];
    for (const [staffSize, size] of [[0.5, 0.75], [1, 0.75], [2, 0.75], [1, 1.5]]) {
      results.push(await new Promise((resolve, reject) => {
        const host = document.createElement("div");
        host.hidden = true;
        document.body.append(host);
        new P5((p) => {
          p.setup = () => {
            try {
              p.pixelDensity(2);
              p.createCanvas(600, 400);
              p.noLoop();
              const layers = [], diameters = [];
              const createGraphics = p.createGraphics.bind(p);
              p.createGraphics = (...args) => {
                const layer = createGraphics(...args);
                layers.push(layer);
                if (layers.length === 2) {
                  const circle = layer.circle.bind(layer);
                  layer.circle = (x, y, diameter) => {
                    diameters.push(diameter);
                    return circle(x, y, diameter);
                  };
                }
                return layer;
              };
              const brush = createBrush(p);
              brush.setup();
              brush.setSetting("staffSize", staffSize);
              brush.setSetting("size", size);
              // This seed produces a cluster of dots anchored to staff lines.
              p.randomSeed(17);
              p.noiseSeed(17);
              brush.pointerDown(300, 200);
              brush.pointerUp();
              brush.finish();
              const staff = layers[0].canvas;
              const data = staff.getContext("2d").getImageData(0, 0, staff.width, staff.height).data;
              let minX = staff.width, minY = staff.height, maxX = -1, maxY = -1, ink = 0;
              for (let y = 0; y < staff.height; y++) {
                for (let x = 0; x < staff.width; x++) {
                  const alpha = data[(y * staff.width + x) * 4 + 3];
                  ink += alpha;
                  if (alpha > 0) {
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                  }
                }
              }
              const result = { width: maxX - minX + 1, height: maxY - minY + 1, ink, diameters };
              queueMicrotask(() => { p.remove(); host.remove(); resolve(result); });
            } catch (error) { reject(error); }
          };
        }, host);
      }));
    }
    return results;
  });
  const [small, normal, large, largeGlobs] = samples;
  assert.ok(normal.diameters.length > 1, "the reference stamp contains multiple globs");
  for (const sample of [small, large]) {
    assert.deepEqual(sample.diameters, normal.diameters, "staff size leaves glob diameters unchanged");
  }
  for (const [a, b] of [[small, normal], [normal, large]]) {
    assert.ok(Math.abs(b.height - a.height * 2) <= 2, "staff spacing scales with staff size");
    assert.ok(Math.abs(b.width - a.width * 2) <= 2, "click ribbon length scales with staff size");
    assert.ok(b.ink > a.ink * 3.5, "line thickness scales along with the ribbon");
  }
  assert.deepEqual(
    { ...largeGlobs, diameters: [] }, { ...normal, diameters: [] },
    "changing glob size leaves the staff pixels unchanged",
  );
  assert.deepEqual(largeGlobs.diameters, normal.diameters.map((d) => d * 2));
  await page.close();
});

test("aspect ratios fit the complete paper and preserve artwork, history, controls and export", async () => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await ready(page);
  assert.equal(await page.locator('[id^="zoom-"]').count(), 0);
  const aspect = page.getByLabel("Canvas aspect ratio");
  await aspect.selectOption("1:1");
  await assertCanvasFitsWorkspace(page, "1:1");
  await draw(page);
  const original = await pixels(page);
  assert.ok(original.ink > 100);
  for (const ratio of ["4:3", "3:4", "16:9", "9:16", "auto", "1:1"]) {
    await aspect.selectOption(ratio);
    await assertCanvasFitsWorkspace(page, ratio);
    assert.ok((await pixels(page)).ink > 0);
  }
  assert.deepEqual(
    await pixels(page),
    original,
    "changing ratios back and forth does not erode the drawing",
  );
  await page.setViewportSize({ width: 1100, height: 760 });
  await assertCanvasFitsWorkspace(page, "1:1");
  assert.deepEqual(
    await pixels(page),
    original,
    "fixed-ratio paper is unchanged by window resizing",
  );
  await aspect.selectOption("16:9");
  await assertCanvasFitsWorkspace(page, "16:9");
  const widescreen = await pixels(page);
  await page.locator("#undo").click();
  assert.equal((await pixels(page)).ink, 0);
  await page.locator("#redo").click();
  assert.deepEqual(
    await pixels(page),
    widescreen,
    "history survives a new paper shape",
  );
  for (const brush of ["Schematic", "Balloon", "Score"]) {
    await select(page, brush);
    await draw(page, 0.55);
    const painted = await pixels(page);
    assert.notEqual(
      painted.hash,
      widescreen.hash,
      `${brush} draws after paper resizing`,
    );
    await page.locator("#undo").click();
    assert.deepEqual(
      await pixels(page),
      widescreen,
      `${brush} undo restores the existing artwork`,
    );
  }
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#export").click(),
  ]);
  const chunks = [];
  for await (const chunk of await download.createReadStream())
    chunks.push(chunk);
  const png = Buffer.concat(chunks);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 675]);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertCanvasFitsWorkspace(page, "16:9");
  assert.deepEqual(await pixels(page), widescreen);
  await aspect.selectOption("auto");
  await assertCanvasFitsWorkspace(page);
  assert.deepEqual(errors, []);
  await page.close();
});

test("Retina rendering stays sharp through compositing, erasing, resizing and export", async () => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await ready(page);
  await assertCanvasFitsWorkspace(page);
  async function assertResolution() {
    const resolution = await page.locator(".p5Canvas").evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      return {
        width: canvas.width / bounds.width,
        height: canvas.height / bounds.height,
        dpr: devicePixelRatio,
      };
    });
    assert.ok(
      resolution.width >= resolution.dpr && resolution.height >= resolution.dpr,
      "the paper must have at least one raster pixel per screen pixel",
    );
  }
  await assertResolution();
  let previous = await pixels(page);
  for (const [brush, y] of [
    ["Score", 0.25],
    ["Schematic", 0.5],
    ["Balloon", 0.74],
  ]) {
    await select(page, brush);
    assert.deepEqual(
      await pixels(page),
      previous,
      "switching does not rescale Retina artwork",
    );
    await draw(page, y);
    const current = await pixels(page);
    assert.ok(current.ink > previous.ink, `${brush} renders at Retina density`);
    previous = current;
  }
  await page.locator("#erase-tool").click();
  const box = await page.locator(".p5Canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.25, {
    steps: 30,
  });
  await page.mouse.up();
  assert.ok((await pixels(page)).ink < previous.ink);
  await page.locator("#undo").click();
  assert.deepEqual(await pixels(page), previous);
  await page.getByLabel("Canvas aspect ratio").selectOption("16:9");
  await assertCanvasFitsWorkspace(page, "16:9");
  const fitted = await pixels(page);
  await page.setViewportSize({ width: 2000, height: 1000 });
  await assertCanvasFitsWorkspace(page, "16:9");
  await assertResolution();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertCanvasFitsWorkspace(page, "16:9");
  assert.deepEqual(
    await pixels(page),
    fitted,
    "changing rendering density retains the source pixels",
  );
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#export").click(),
  ]);
  const chunks = [];
  for await (const chunk of await download.createReadStream())
    chunks.push(chunk);
  const png = Buffer.concat(chunks);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [2400, 1350]);
  assert.deepEqual(errors, []);
  await page.close();
});

test("Schematic scales labels, linework and texture in proportion to its geometry", async () => {
  const page = await browser.newPage();
  await page.goto(origin);
  await ready(page);
  // Inverse pixel densities compare all sizes at the same physical resolution.
  const results = await page.evaluate(async () => {
    const { default: P5 } = await import("/node_modules/.vite/deps/p5.js");
    const { default: createBrush } =
      await import("/brushes/schematic/sketch.js");
    const results = [];
    for (const style of ["patch", "cad"]) {
      let original;
      for (const size of [1, 0.5, 0.25]) {
        const rendered = await new Promise((resolve, reject) => {
          const host = document.createElement("div");
          host.hidden = true;
          document.body.append(host);
          new P5((p) => {
            p.setup = () => {
              try {
                p.pixelDensity(1 / size);
                p.createCanvas(800 * size, 400 * size);
                p.noLoop();
                p.randomSeed(17);
                p.noiseSeed(17);
                const brush = createBrush(p);
                brush.setup(new URLSearchParams({ style }));
                brush.setSetting("size", size);
                const y = (x) =>
                  200 + Math.sin(((x - 120) / 500) * Math.PI * 2) * 35;
                brush.pointerDown(120 * size, y(120) * size);
                for (let x = 124; x <= 620; x += 4) {
                  brush.pointerMove(x * size, y(x) * size);
                  for (let k = 0; k < 3; k++) {
                    p.clear();
                    brush.draw();
                  }
                }
                brush.pointerUp();
                brush.finish();
                p.background(255);
                brush.draw();
                const data = p.drawingContext.getImageData(
                  0,
                  0,
                  p.canvas.width,
                  p.canvas.height,
                ).data;
                queueMicrotask(() => {
                  p.remove();
                  host.remove();
                  resolve({ data });
                });
              } catch (error) {
                reject(error);
              }
            };
          }, host);
        });
        original ||= rendered.data;
        let total = 0,
          changed = 0;
        for (let i = 0; i < original.length; i++) {
          const delta = Math.abs(original[i] - rendered.data[i]);
          total += delta;
          if (delta > 8) changed++;
        }
        results.push({
          style,
          size,
          meanError: total / original.length,
          changed: changed / original.length,
        });
      }
    }
    return results;
  });
  for (const result of results) {
    assert.ok(
      result.meanError < 0.05 && result.changed < 0.001,
      `${result.style} at ${result.size}× should match the full-size drawing: ${JSON.stringify(result)}`,
    );
  }
  await page.close();
});

test("Crowd draws live, preserves transparent artwork, and supports settings, history, erasing and Retina export", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${origin}/?brush=crowd&color=blue&pose=standing&spread=0`);
  await ready(page, "Crowd");
  assert.equal(await page.getByLabel("People", { exact: true }).inputValue(), "standing");
  assert.equal(await page.getByRole("checkbox", { name: "Animate people" }).isChecked(), true);
  assert.equal(await page.getByRole("slider", { name: "Crowd spread" }).inputValue(), "0");
  assert.equal(await page.getByRole("button", { name: "Royal blue", exact: true }).getAttribute("aria-pressed"), "true");
  assert.ok(await page.locator('[data-brush="crowd"] img').evaluate(img => img.complete && img.naturalWidth > 0));
  const box = await page.locator(".p5Canvas").boundingBox();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .35);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .35, { steps: 20 });
  assert.ok((await pixels(page)).ink > 100, "figures appear before the pointer lifts");
  await page.mouse.up();
  await page.locator("#draw-tool").click();
  const original = await pixels(page);
  await page.locator("#draw-tool").click();
  assert.deepEqual(await pixels(page), original, "finishing twice does not add figures");
  await page.locator("#undo").click();
  assert.equal((await pixels(page)).ink, 0);
  await page.locator("#redo").click();
  assert.deepEqual(await pixels(page), original);
  await page.getByRole("button", { name: "Vermilion", exact: true }).click();
  await page.getByLabel("People", { exact: true }).selectOption("seated");
  await page.getByRole("slider", { name: "Crowd density" }).press("End");
  await page.getByRole("slider", { name: "Scene objects" }).press("End");
  assert.deepEqual(await pixels(page), original, "settings preserve existing figures");
  await page.getByRole("checkbox", { name: "Animate people" }).uncheck();
  assert.deepEqual(await pixels(page), original, "pausing keeps the original traces");
  await select(page, "Balloon");
  await draw(page, .65);
  const combined = await pixels(page);
  assert.ok(combined.ink > original.ink);
  await select(page, "Crowd");
  assert.equal(await page.getByLabel("People", { exact: true }).inputValue(), "seated");
  assert.equal(await page.getByRole("checkbox", { name: "Animate people" }).isChecked(), false);
  assert.equal(await page.getByRole("slider", { name: "Crowd density" }).inputValue(), "2.5");
  assert.equal(await page.getByRole("slider", { name: "Scene objects" }).inputValue(), "2");
  assert.deepEqual(await pixels(page), combined);
  await page.locator("#erase-tool").click();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .33);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .33, { steps: 20 });
  await page.mouse.up();
  assert.ok((await pixels(page)).ink < combined.ink);
  await page.locator("#undo").click();
  assert.deepEqual(await pixels(page), combined);
  await page.locator("#remix").click();
  assert.deepEqual(await pixels(page), combined, "new variation keeps the drawing");
  await page.getByLabel("Canvas aspect ratio").selectOption("16:9");
  await assertCanvasFitsWorkspace(page, "16:9");
  await draw(page, .85);
  assert.ok((await pixels(page)).ink > 100);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export").click()]);
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [2400, 1350]);
  assert.deepEqual(errors, []);
  await page.close();
});

test("Crowd placement follows distance rather than events and leaves figure interiors transparent", async () => {
  const page = await browser.newPage();
  await page.goto(`${origin}/?brush=crowd`);
  await ready(page, "Crowd");
  const result = await page.evaluate(async () => {
    const { default: P5 } = await import("/node_modules/.vite/deps/p5.js");
    const { default: createBrush } = await import("/brushes/crowd/sketch.js");
    return new Promise((resolve, reject) => new P5(p => {
      p.setup = () => {
        try {
          p.pixelDensity(1);
          p.createCanvas(800, 300);
          p.noLoop();
          const renders = [];
          for (const step of [600, 3]) {
            p.randomSeed(28);
            const brush = createBrush(p);
            brush.setup(new URLSearchParams({spread: "0"}));
            brush.pointerDown(100, 200);
            for (let x = 100 + step; x <= 700; x += step) brush.pointerMove(x, 200);
            brush.pointerMove(700, 200);
            brush.pointerUp();
            brush.finish();
            p.clear();
            brush.draw();
            const data = p.drawingContext.getImageData(0, 0, 800, 300).data;
            let hash = 2166136261, ink = 0, white = 0;
            for (let i = 0; i < data.length; i += 4) {
              hash = Math.imul(hash ^ data[i + 3], 16777619);
              if (data[i + 3]) {
                ink++;
                if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) white++;
              }
            }
            renders.push({ hash, ink, white });
            brush.clear();
          }
          queueMicrotask(() => { p.remove(); resolve(renders); });
        } catch (error) { reject(error); }
      };
    }));
  });
  assert.ok(result[0].ink > 500);
  assert.equal(result[0].white, 0, "no paper-colored fill obscures earlier artwork");
  assert.deepEqual(result[0], result[1], "coalesced and frequent pointer events paint the same crowd");
  await page.close();
});

test("Crowd traces from the ground in order, continues after release, and settles or cancels all pending figures", async () => {
  const page = await browser.newPage();
  await page.goto(`${origin}/?brush=crowd`);
  await ready(page, "Crowd");
  const result = await page.evaluate(async () => {
    const { default: P5 } = await import("/node_modules/.vite/deps/p5.js");
    const { default: createBrush } = await import("/brushes/crowd/sketch.js");
    const { drawFigure, INKS } = await import("/brushes/crowd/figures.js");
    return new Promise((resolve, reject) => new P5(p => {
      p.setup = () => {
        try {
          p.pixelDensity(1);
          p.createCanvas(700, 320);
          p.noLoop();
          let now = 0;
          p.millis = () => now;
          p.randomSeed(28);
          const brush = createBrush(p);
          brush.setup(new URLSearchParams({ size: "2", pose: "walking", spread: "0", details: "0", motion: "false" }));
          function capture() {
            p.clear();
            brush.draw();
            const data = p.drawingContext.getImageData(0, 0, 700, 320).data;
            let ink = 0, top = 320, bottom = -1, hash = 2166136261, feet = 2166136261;
            for (let i = 0; i < data.length; i += 4) {
              const y = Math.floor(i / 4 / 700);
              const alpha = data[i + 3];
              hash = Math.imul(hash ^ alpha, 16777619);
              if (y >= 240) feet = Math.imul(feet ^ alpha, 16777619);
              if (alpha) { ink++; top = Math.min(top, y); bottom = Math.max(bottom, y); }
            }
            return { ink, top, bottom, hash, feet };
          }
          brush.pointerDown(350, 250);
          brush.pointerUp();
          const frames = [0, 16, 180, 350, 550, 1500].map(time => {
            now = time;
            return capture();
          });
          brush.finish();
          const settled = capture();
          brush.clear();
          p.randomSeed(28);
          brush.randomize();
          now = 2000;
          brush.pointerDown(350, 250);
          now = 2150;
          brush.finish();
          const forced = capture();
          brush.clear();
          brush.autoFill();
          const autoStart = capture();
          brush.finish();
          const autoEnd = capture();
          now = 10000;
          const autoLater = capture();
          brush.clear();
          brush.pointerDown(350, 250);
          brush.pointerUp();
          now += 150;
          const beforeClear = capture();
          brush.clear();
          now += 2000;
          const cleared = capture();
          brush.pointerDown(350, 250);
          brush.resize();
          now += 2000;
          const resized = capture();
          // A tracing tip leaves some ink in a row waiting while other ink in
          // that row is already visible; a horizontal wipe cannot do this.
          const figure = { index: 0, x: 350, y: 250, scale: 2, flip: 1, ink: INKS.blue };
          const paths = new Map();
          p.clear();
          drawFigure(p.drawingContext, figure, paths, 0.4);
          const partial = p.drawingContext.getImageData(0, 0, 700, 320).data;
          p.clear();
          drawFigure(p.drawingContext, figure, paths);
          const complete = p.drawingContext.getImageData(0, 0, 700, 320).data;
          let tracingRows = 0, outsideOriginal = 0;
          for (let y = 0; y < 320; y++) {
            let visible = false, waiting = false;
            for (let x = 0; x < 700; x++) {
              const i = (y * 700 + x) * 4 + 3;
              if (partial[i] > 150) visible = true;
              if (complete[i] > 150 && partial[i] === 0) waiting = true;
              if (partial[i] > 0 && complete[i] === 0) outsideOriginal++;
            }
            if (visible && waiting) tracingRows++;
          }
          queueMicrotask(() => {
            p.remove();
            resolve({ frames, settled, forced, autoStart, autoEnd, autoLater, beforeClear, cleared, resized, tracingRows, outsideOriginal });
          });
        } catch (error) { reject(error); }
      };
    }));
  });
  const { frames } = result;
  assert.equal(frames[0].ink, 0, "new figures begin with no ink");
  assert.ok(frames[1].ink > 0, "growth is visible on the first animation frame after drawing");
  for (let i = 1; i < frames.length; i++) {
    assert.ok(frames[i].ink > frames[i - 1].ink, "outlines keep growing after releasing the pen");
    assert.ok(frames[i].top <= frames[i - 1].top, "growth reaches upwards");
    assert.ok(frames[i].bottom >= 249 && frames[i].bottom <= 251, "feet remain on the stroke throughout growth");
  }
  assert.ok(result.tracingRows > 20, "growth follows the outline rather than wiping across its height");
  assert.equal(result.outsideOriginal, 0, "growing ink stays inside the original unmoved trace");
  assert.deepEqual(result.settled, frames.at(-1), "finishing completed growth leaves it unchanged");
  assert.deepEqual(result.forced, result.settled, "immediate finish produces the same full figures as animation");
  assert.ok(result.autoEnd.ink > result.autoStart.ink + 1000, "finish includes future auto-fill groups");
  assert.deepEqual(result.autoEnd, result.autoLater, "no delayed figures appear after finish");
  assert.ok(result.beforeClear.ink > 0);
  assert.equal(result.cleared.ink, 0, "clear cancels growth without ghost marks");
  assert.equal(result.resized.ink, 0, "resize cancels transient growth");
  await page.close();
});

test("Crowd people move after tracing, resume across strokes, and pause cleanly", async () => {
  const page = await browser.newPage();
  await page.goto(`${origin}/?brush=crowd`);
  await ready(page, "Crowd");
  const result = await page.evaluate(async () => {
    const { default: P5 } = await import("/node_modules/.vite/deps/p5.js");
    const { default: createBrush } = await import("/brushes/crowd/sketch.js");
    const { FIGURES, OBJECTS, drawFigure, INKS } = await import("/brushes/crowd/figures.js");
    return new Promise((resolve, reject) => new P5(p => {
      p.setup = () => {
        try {
          p.pixelDensity(1);
          p.createCanvas(900, 320);
          p.noLoop();
          let now = 0;
          p.millis = () => now;
          p.randomSeed(28);
          const brush = createBrush(p);
          brush.setup(new URLSearchParams({ size: "1.5", pose: "standing", spread: "0", details: "0" }));
          function pixels(x = 0, y = 0, w = 900, h = 320) {
            const data = p.drawingContext.getImageData(x, y, w, h).data;
            let hash = 2166136261, ink = 0;
            for (let i = 3; i < data.length; i += 4) {
              hash = Math.imul(hash ^ data[i], 16777619);
              if (data[i]) ink++;
            }
            return { hash, ink };
          }
          function capture(time) {
            now = time;
            p.clear();
            brush.draw();
            return { all: pixels(), left: pixels(0, 0, 440, 320) };
          }
          brush.pointerDown(220, 260);
          brush.pointerUp();
          const alive = [capture(1500), capture(2500)];
          brush.finish();
          const settled = capture(2500), later = capture(4000);
          brush.pointerDown(700, 260);
          brush.pointerUp();
          const resumed = [capture(4000), capture(4400), capture(6000)];
          brush.setSetting("motion", false);
          const paused = [capture(6000), capture(7000)];
          brush.setSetting("motion", true);
          const enabled = [capture(7000), capture(7700)];
          brush.clear();
          const cleared = capture(9000);

          const paths = new Map();
          const motifs = [];
          for (const [kind, definitions] of [["person", FIGURES], ["object", OBJECTS]]) {
            definitions.forEach((definition, index) => {
              const figure = { kind, index, x: 450, y: 260, scale: 2, flip: 1, ink: INKS.blue, bornAt: 0, duration: 780 };
              function render(progress, time) {
                p.clear();
                drawFigure(p.drawingContext, figure, paths, progress, time);
                return { all: pixels(), base: pixels(0, 170, 900, 150) };
              }
              motifs.push({ name: definition.name, kind,
                tracing: render(0.5), tracingWithMotion: render(0.5, 3000),
                still: render(1), completed: render(1, 780),
                first: render(1, 1600), second: render(1, 3000),
              });
            });
          }
          queueMicrotask(() => {
            p.remove();
            resolve({ alive, settled, later, resumed, paused, enabled, cleared, motifs });
          });
        } catch (error) { reject(error); }
      };
    }));
  });
  assert.ok(result.alive[0].all.ink > 500);
  assert.notEqual(result.alive[0].all.hash, result.alive[1].all.hash, "people keep moving after the pen lifts and growth ends");
  assert.deepEqual(result.settled, result.later, "finish captures a stable neutral pose");
  assert.deepEqual(result.resumed[0].left, result.settled.left, "starting a new stroke does not retrace earlier people");
  assert.notEqual(result.resumed[1].left.hash, result.resumed[0].left.hash, "earlier people resume moving with the next stroke");
  assert.ok(result.resumed[2].all.ink > result.alive[1].all.ink, "later strokes preserve previous people");
  assert.deepEqual(result.paused[0], result.paused[1], "the motion toggle stops ongoing animation");
  assert.deepEqual(result.enabled[0], result.paused[1], "re-enabling motion starts at the neutral pose");
  assert.notEqual(result.enabled[0].all.hash, result.enabled[1].all.hash);
  assert.equal(result.cleared.all.ink, 0, "cleared people never return on later animation frames");
  for (const motif of result.motifs) {
    assert.deepEqual(motif.tracingWithMotion, motif.tracing, `${motif.name} stays still during outline tracing`);
    assert.deepEqual(motif.completed, motif.still, `${motif.name} enters idle motion without a jump`);
    if (motif.kind === "person" || motif.name === "reading-at-a-table") {
      assert.notEqual(motif.first.all.hash, motif.second.all.hash, `${motif.name} animates after completion`);
      if (motif.name === "reading-at-a-table")
        assert.deepEqual(motif.first.base, motif.second.base, "the reader moves while the table stays fixed");
    } else {
      assert.deepEqual(motif.first, motif.second, `${motif.name} stays still`);
    }
  }
  await page.close();
});
