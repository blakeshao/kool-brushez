import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:4182";
let browser, server;
before(async () => {
  server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4182", "--strictPort"], { stdio: "pipe" });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(origin)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true,
    ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  });
});
after(async () => { await browser?.close(); server?.kill(); });

async function ready(page, name = "Gunpla") {
  await page.waitForFunction(name => document.querySelector("#status").textContent.includes(`${name} · Ready`), name);
}
async function pixels(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.locator(".p5Canvas").evaluate(canvas => {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261, ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.min(data[i], data[i + 1], data[i + 2]) < 245) ink++;
      for (let j = 0; j < 3; j++) hash = Math.imul(hash ^ data[i + j], 16777619);
    }
    return { hash, ink };
  });
}

test("Gunpla builds a sprue one component at a time and preserves settings, shared artwork, history and Retina export", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${origin}/?brush=gunpla&parts=armor&color=blue&size=.75`);
  await ready(page);
  assert.equal(await page.getByLabel("Components", { exact: true }).inputValue(), "armor");
  assert.ok(await page.locator('[data-brush="gunpla"] img').evaluate(img => img.complete && img.naturalWidth > 0));
  const box = await page.locator(".p5Canvas").boundingBox();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .35);
  await page.mouse.down();
  await page.waitForTimeout(100);
  const clicked = await pixels(page);
  assert.ok(clicked.ink > 100, "a click quickly bursts into one component bay");
  await page.mouse.move(box.x + box.width * .8, box.y + box.height * .35, { steps: 25 });
  assert.ok((await pixels(page)).ink > clicked.ink * 2, "dragging adds connected components before release");
  await page.mouse.up();
  await page.locator("#draw-tool").click();
  const original = await pixels(page);
  await page.locator("#draw-tool").click();
  assert.deepEqual(await pixels(page), original, "finish is idempotent");
  await page.locator("#undo").click();
  assert.equal((await pixels(page)).ink, 0);
  await page.locator("#redo").click();
  assert.deepEqual(await pixels(page), original);
  await page.getByRole("button", { name: "Runner red", exact: true }).click();
  await page.getByLabel("Components", { exact: true }).selectOption("weapons");
  await page.getByLabel("Part numbers", { exact: true }).uncheck();
  await page.getByRole("slider", { name: "Part detail", exact: true }).press("End");
  await page.getByRole("slider", { name: "Surface grain", exact: true }).press("End");
  await page.getByRole("slider", { name: "Component size variation", exact: true }).press("End");
  assert.deepEqual(await pixels(page), original, "settings only affect future plates");
  await page.getByRole("button", { name: "Score brush", exact: true }).click();
  await ready(page, "Score");
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .75);
  await page.locator("#draw-tool").click();
  const combined = await pixels(page);
  assert.ok(combined.ink > original.ink);
  await page.getByRole("button", { name: "Gunpla brush", exact: true }).click();
  await ready(page);
  assert.deepEqual(await pixels(page), combined);
  assert.equal(await page.getByLabel("Components", { exact: true }).inputValue(), "weapons");
  assert.equal(await page.getByRole("slider", { name: "Surface grain", exact: true }).inputValue(), "2");
  assert.equal(await page.getByRole("slider", { name: "Component size variation", exact: true }).inputValue(), "2");
  assert.equal(await page.getByLabel("Part numbers", { exact: true }).isChecked(), false);
  await page.locator("#remix").click();
  assert.deepEqual(await pixels(page), combined);
  await page.locator("#erase-tool").click();
  await page.mouse.move(box.x + box.width * .1, box.y + box.height * .35);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .9, box.y + box.height * .35, { steps: 30 });
  await page.mouse.up();
  assert.ok((await pixels(page)).ink < combined.ink);
  await page.locator("#undo").click();
  assert.deepEqual(await pixels(page), combined);
  await page.getByLabel("Canvas aspect ratio").selectOption("16:9");
  const resized = await pixels(page);
  assert.ok(resized.ink > 0);
  await page.locator("#auto-fill").click();
  await page.locator("#draw-tool").click();
  assert.ok((await pixels(page)).ink > resized.ink);
  await page.locator("#undo").click();
  assert.deepEqual(await pixels(page), resized);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export").click()]);
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [2400, 1350]);
  assert.deepEqual(errors, []);
  await page.close();
});

test("Gunpla sampling is independent of event frequency, leaves sprue openings transparent and fits narrow paper", async () => {
  const page = await browser.newPage();
  await page.goto(`${origin}/?brush=gunpla`);
  await ready(page);
  const result = await page.evaluate(async () => {
    const { default: P5 } = await import("/node_modules/.vite/deps/p5.js");
    const { default: createBrush } = await import("/brushes/gunpla/sketch.js");
    return new Promise((resolve, reject) => new P5(p => {
      p.setup = () => {
        try {
          p.pixelDensity(1); p.createCanvas(1000, 400); p.noLoop();
          let now = 0;
          p.millis = () => now;
          function capture(brush) {
            p.clear(); brush.draw();
            const data = p.drawingContext.getImageData(0, 0, p.width, p.height).data;
            let hash = 2166136261, ink = 0, white = 0, edges = 0;
            let minX = p.width, maxX = -1, minY = p.height, maxY = -1;
            for (let i = 0; i < data.length; i += 4) {
              hash = Math.imul(hash ^ data[i + 3], 16777619);
              if (!data[i + 3]) continue;
              ink++;
              if (data[i + 3] > 16 && data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) white++;
              const x = (i / 4) % p.width, y = Math.floor(i / 4 / p.width);
              minX = Math.min(minX, x); maxX = Math.max(maxX, x);
              minY = Math.min(minY, y); maxY = Math.max(maxY, y);
              if (x < 2 || x >= p.width - 2 || y < 2 || y >= p.height - 2) edges++;
            }
            return { hash, ink, white, edges, width: Math.max(0, maxX - minX + 1), height: Math.max(0, maxY - minY + 1) };
          }
          const samples = [], singles = [], retraced = [], expanded = [], diagonal = [];
          for (const step of [720, 3]) {
            p.randomSeed(17);
            const brush = createBrush(p);
            brush.setup(new URLSearchParams({size: ".7", labels: "false"}));
            brush.pointerDown(140, 200);
            now += 400;
            singles.push(capture(brush));
            for (let x = 140 + step; x <= 860; x += step) brush.pointerMove(x, 200);
            brush.pointerUp(); brush.finish();
            samples.push(capture(brush));
            brush.pointerDown(140, 200);
            brush.pointerMove(860, 200);
            brush.pointerUp();
            retraced.push(capture(brush));
            brush.pointerDown(140, 200 + 93 * .7);
            brush.pointerMove(860, 200 + 93 * .7);
            brush.pointerUp(); brush.finish();
            expanded.push(capture(brush));
            brush.clear();
          }
          for (const steps of [1, 60]) {
            p.randomSeed(17);
            const brush = createBrush(p);
            brush.setup(new URLSearchParams({size: ".7", labels: "false"}));
            brush.pointerDown(140, 300);
            for (let i = 1; i <= steps; i++) brush.pointerMove(140 + 600 * i / steps, 300 - 240 * i / steps);
            brush.pointerUp(); brush.finish();
            diagonal.push(capture(brush));
            brush.clear();
          }
          const brush = createBrush(p);
          brush.setup(new URLSearchParams({parts: "weapons", size: "2.5", labels: "false"}));
          p.resizeCanvas(130, 700); brush.resize();
          brush.autoFill(); brush.finish();
          const narrow = capture(brush);
          brush.clear();
          brush.pointerMove(70, 500);
          const cleared = capture(brush);
          queueMicrotask(() => { p.remove(); resolve({ samples, singles, retraced, expanded, diagonal, narrow, cleared }); });
        } catch (error) { reject(error); }
      };
    }));
  });
  assert.ok(result.samples[0].ink > 1000);
  assert.ok(result.singles[0].ink < result.samples[0].ink / 3, "one component is only a small part of the completed sprue");
  assert.deepEqual(result.retraced, result.samples, "revisiting existing cells does not duplicate components or rails");
  assert.ok(result.expanded[0].ink > result.samples[0].ink * 1.25, "a second stroke adds another row to the same tab");
  assert.deepEqual(result.diagonal[0], result.diagonal[1], "diagonal traversal is independent of event frequency");
  assert.equal(result.samples[0].white, 0, "no white background or socket fill covers earlier artwork");
  assert.deepEqual(result.samples[0], result.samples[1], "sparse and frequent input create identical component trails");
  assert.ok(result.narrow.ink > 1000);
  assert.equal(result.narrow.edges, 0, "even maximum-size weapon bays fit within narrow auto-fill paper");
  assert.equal(result.cleared.ink, 0, "clear cancels the stroke without ghost plates");
  await page.close();
});

test("Gunpla shades molded white plastic with subtle grain and optional Japanese material annotations", async () => {
  const page = await browser.newPage();
  await page.goto(`${origin}/?brush=gunpla`);
  await ready(page);
  const result = await page.evaluate(async () => {
    const { createComponent, drawComponent } = await import("/brushes/gunpla/plates.js");
    const tones = [];
    for (const texture of [0, 1]) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 400;
      const ctx = canvas.getContext("2d");
      const part = { ...createComponent(() => .5, {parts: "weapons", size: 2, variation: 0, texture, details: 0, color: "white", labels: false}, 1, "magazine"), scale: 2 };
      drawComponent(ctx, part, 200, 200, 80, 100, []);
      const data = ctx.getImageData(180, 170, 40, 60).data;
      const shades = new Set();
      let opaque = 0, total = 0, bright = 0;
      for (let i = 0; i < data.length; i += 4) {
        shades.add(data[i]);
        total += data[i];
        if (data[i] > 235) bright++;
        if (data[i + 3] === 255) opaque++;
      }
      tones.push({ shades: shades.size, opaque, mean: total / (data.length / 4), bright: bright / (data.length / 4), pixels: Array.from(data) });
    }
    const { default: P5 } = await import("/node_modules/.vite/deps/p5.js");
    const { default: createBrush } = await import("/brushes/gunpla/sketch.js");
    const captions = await new Promise((resolve, reject) => new P5(p => {
      p.setup = () => {
        try {
          p.pixelDensity(1); p.createCanvas(700, 300); p.noLoop();
          let text = [];
          function watch(ctx) {
            const fillText = ctx.fillText.bind(ctx);
            ctx.fillText = (...args) => { text.push(args[0]); fillText(...args); };
          }
          watch(p.drawingContext);
          const createGraphics = p.createGraphics.bind(p);
          p.createGraphics = (...args) => { const layer = createGraphics(...args); watch(layer.drawingContext); return layer; };
          const outputs = [];
          for (const labels of [true, false]) {
            text = [];
            p.randomSeed(17);
            const brush = createBrush(p);
            brush.setup(new URLSearchParams({ parts: "mechanical", labels: String(labels) }));
            brush.pointerDown(100, 150); brush.pointerMove(550, 150); brush.pointerUp();
            brush.finish();
            p.clear(); brush.draw();
            outputs.push([...text]);
            brush.clear();
          }
          queueMicrotask(() => { p.remove(); resolve(outputs); });
        } catch (error) { reject(error); }
      };
    }));
    return { tones, captions };
  });
  assert.ok(result.tones[0].mean > 235 && result.tones[0].bright > .85, "white plastic faces remain bright instead of gray printing");
  assert.ok(result.tones[0].shades > 1, "smooth plastic still has physical surface shading");
  let changed = 0;
  for (let i = 0; i < result.tones[0].pixels.length; i += 4)
    if (result.tones[0].pixels[i] !== result.tones[1].pixels[i]) changed++;
  assert.ok(changed > 300, "surface grain is visible at close range");
  assert.ok(Math.abs(result.tones[0].mean - result.tones[1].mean) < 1, "grain does not darken the material into a dot pattern");
  assert.equal(result.tones[1].opaque, result.tones[0].opaque, "texture does not punch holes in plastic");
  assert.ok(result.captions[0].some(text => text.includes("パーツ")));
  assert.ok(result.captions[0].some(text => text.includes("ABS樹脂")));
  assert.ok(result.captions[0].some(text => /^\d+$/.test(text)), "components retain numeric callouts");
  assert.deepEqual(result.captions[1], [], "the annotation toggle hides both callouts and material headings");
  await page.close();
});

test("Gunpla bursts from older components, settles after release and cancels pending motion cleanly", async () => {
  const page = await browser.newPage();
  await page.goto(`${origin}/?brush=gunpla`);
  await ready(page);
  const result = await page.evaluate(async () => {
    const { default: P5 } = await import("/node_modules/.vite/deps/p5.js");
    const { default: createBrush } = await import("/brushes/gunpla/sketch.js");
    return new Promise((resolve, reject) => new P5(p => {
      p.setup = () => {
        try {
          p.pixelDensity(2); p.createCanvas(700, 450); p.noLoop();
          let now = 0;
          p.millis = () => now;
          const brush = createBrush(p);
          const outputs = [];
          function capture() {
            p.clear(); brush.draw();
            return p.drawingContext.getImageData(0, 0, p.canvas.width, p.canvas.height).data;
          }
          function hash(data) {
            let value = 2166136261;
            for (const channel of data) value = Math.imul(value ^ channel, 16777619);
            return value;
          }
          function changes(before, after) {
            let count = 0, minX = 700, minY = 450, maxX = -1, maxY = -1;
            for (let i = 0; i < after.length; i += 4) {
              if (after[i] === before[i] && after[i + 1] === before[i + 1]
                && after[i + 2] === before[i + 2] && after[i + 3] === before[i + 3]) continue;
              count++;
              const x = (i / 4 % p.canvas.width) / 2, y = Math.floor(i / 4 / p.canvas.width) / 2;
              minX = Math.min(minX, x); maxX = Math.max(maxX, x);
              minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            }
            return { count, minX, minY, maxX, maxY };
          }
          // Compare natural completion with an immediate lifecycle finish.
          for (const immediate of [false, true]) {
            p.randomSeed(17); now = 0;
            brush.setup(new URLSearchParams({ parts: "mechanical", labels: "false", size: ".7" }));
            const empty = capture();
            brush.pointerDown(150, 200); brush.pointerUp();
            const initial = hash(capture());
            now = 3;
            const firstPop = changes(empty, capture());
            now = 400; capture();
            brush.pointerDown(550, 200); brush.pointerUp(); brush.finish();
            const older = capture();
            brush.pointerDown(260, 320); brush.pointerUp();
            const beginning = hash(capture());
            now = 408;
            const emerging = changes(older, capture());
            now = 540;
            const later = changes(older, capture());
            if (immediate) brush.finish();
            else now = 800;
            const finished = hash(capture());
            brush.finish();
            const repeated = hash(capture());
            outputs.push({ empty: hash(empty), initial, firstPop, older: hash(older),
              beginning, emerging, later, finished, repeated });
            brush.clear();
          }
          // A header must not appear ahead of the first component.
          brush.setSetting("labels", true);
          brush.pointerDown(150, 200); brush.pointerUp();
          const blankStart = changes(new Uint8ClampedArray(p.canvas.width * p.canvas.height * 4), capture()).count;
          now += 30; capture(); brush.clear(); now += 500;
          const cleared = changes(new Uint8ClampedArray(p.canvas.width * p.canvas.height * 4), capture()).count;
          brush.pointerDown(150, 200); brush.pointerMove(450, 200); brush.pointerUp();
          now += 30; capture(); brush.resize(); now += 500;
          const resized = changes(new Uint8ClampedArray(p.canvas.width * p.canvas.height * 4), capture()).count;
          queueMicrotask(() => { p.remove(); resolve({ outputs, blankStart, cleared, resized }); });
        } catch (error) { reject(error); }
      };
    }));
  });
  const [natural, forced] = result.outputs;
  assert.equal(natural.initial, natural.empty, "the first part begins at zero size");
  assert.ok(natural.firstPop.count > 0 && natural.firstPop.maxX - natural.firstPop.minX < 30,
    `the first part grows from a tiny point: ${JSON.stringify(natural.firstPop)}`);
  assert.equal(natural.beginning, natural.older, "spawning a part does not immediately paint its destination");
  assert.ok(natural.emerging.count > 0 && natural.emerging.maxX < 250 && natural.emerging.maxY < 300,
    "the new part emerges near the closest older part, not the last part or its destination");
  assert.ok(natural.later.minX > natural.emerging.maxX && natural.later.minY > natural.emerging.maxY,
    "the new part moves outward while older parts stay unchanged");
  assert.notEqual(natural.finished, natural.older, "release lets the new part finish");
  assert.equal(natural.finished, forced.finished, "natural and immediate completion have identical Retina pixels");
  assert.equal(natural.finished, natural.repeated, "settling does not redraw components twice");
  assert.equal(result.blankStart, 0, "annotations do not appear before the initial burst");
  assert.equal(result.cleared, 0, "clear removes live motion without ghosts");
  assert.equal(result.resized, 0, "resize discards live motion without ghosts");
  await page.close();
});
