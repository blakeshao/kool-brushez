import { brushes } from "./registry.js";
import { createStudio } from "./studio.js";
import { renderControls, syncControls } from "./hud.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const compactLayout = matchMedia("(max-width: 820px)");
let studio,
  state,
  controlsFor,
  toastTimer,
  displayScale = 1;
let selectionVersion = 0;
let desktopPanelOpen = true;
let desktopBrushesOpen = true;

function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
  }, 3500);
}
function fitCanvas() {
  const viewport = $("canvas-surround");
  const availableWidth = Math.max(1, viewport.clientWidth);
  const availableHeight = Math.max(1, viewport.clientHeight);
  const value = $("aspect-ratio").value;
  const [w, h] = value.split(":").map(Number);
  const ratio = value === "auto" ? availableWidth / availableHeight : w / h;
  // A consistent export resolution, with the whole paper always in view.
  const width = ratio >= 1 ? 1200 : Math.max(1, Math.round(1200 * ratio));
  const height = ratio >= 1 ? Math.max(1, Math.round(1200 / ratio)) : 1200;
  displayScale = Math.min(availableWidth / width, availableHeight / height);
  viewport.style.setProperty("--display-width", `${width * displayScale}px`);
  viewport.style.setProperty("--display-height", `${height * displayScale}px`);
  viewport.classList.toggle("fixed-aspect", value !== "auto");
  const density = Math.max(
    1,
    Math.min(
      3,
      Math.ceil((window.devicePixelRatio || 1) * Math.max(1, displayScale)),
    ),
  );
  studio?.resize(width, height, density);
  return { width, height, density };
}

function fillBrushGrid() {
  const list = $("brush-list");
  const rowHeight = parseFloat(
    getComputedStyle(list).getPropertyValue("--brush-row"),
  );
  const count = Math.max(
    0,
    Math.ceil(list.clientHeight / rowHeight) - brushes.size,
  );
  const blanks = [...list.querySelectorAll(".brush-empty")];
  for (const cell of blanks.slice(count)) cell.remove();
  for (let i = blanks.length; i < count; i++) {
    const cell = document.createElement("div");
    cell.className = "brush-empty";
    cell.setAttribute("aria-hidden", "true");
    list.append(cell);
  }
}

function update(next) {
  state = next;
  $("undo").disabled = !state.canUndo;
  $("redo").disabled = !state.canRedo;
  $("app").dataset.hasMarks = String(state.hasMarks);
  $("draw-tool").classList.toggle("active", state.tool === "brush");
  $("draw-tool").setAttribute("aria-pressed", String(state.tool === "brush"));
  $("erase-tool").classList.toggle("active", state.tool === "eraser");
  $("erase-tool").setAttribute("aria-pressed", String(state.tool === "eraser"));
  if (!state.registration) return;
  const entry = state.registration;
  $("status").textContent =
    state.tool === "eraser"
      ? "Eraser · 36 px"
      : `${entry.name} · Ready to draw`;
  if (controlsFor !== entry.id) {
    controlsFor = entry.id;
    renderControls(
      $("controls"),
      entry,
      state.settings,
      (id, value) => studio.setSetting(id, value),
      $("sliders"),
    );
    $("settings-heading").textContent = entry.name;
  } else syncControls($("controls"), entry, state.settings, $("sliders"));
  for (const card of $("brush-list").querySelectorAll("[data-brush]")) {
    card.classList.toggle("selected", card.dataset.brush === entry.id);
    card.setAttribute("aria-pressed", String(card.dataset.brush === entry.id));
  }
}
function cursor(event, tool, diameter) {
  const el = $("brush-cursor");
  el.hidden =
    !event || event.pointerType === "touch" || event.type === "pointercancel";
  if (el.hidden) return;
  const bounds = $("canvas-host").getBoundingClientRect();
  const viewport = $("canvas-surround").getBoundingClientRect();
  if (
    event.clientX < Math.max(bounds.left, viewport.left) ||
    event.clientX > Math.min(bounds.right, viewport.right) ||
    event.clientY < Math.max(bounds.top, viewport.top) ||
    event.clientY > Math.min(bounds.bottom, viewport.bottom)
  ) {
    el.hidden = true;
    return;
  }
  el.style.left = `${event.clientX}px`;
  el.style.top = `${event.clientY}px`;
  el.classList.toggle("eraser", tool === "eraser");
  el.style.width =
    el.style.height = `${tool === "eraser" ? diameter * displayScale : 5}px`;
}
async function selectBrush(id, updateURL = true) {
  const entry = brushes.get(id) || brushes.values().next().value;
  const version = ++selectionVersion;
  $("status").textContent = `Loading ${entry.name}…`;
  try {
    if (!(await studio.select(entry, params)) || version !== selectionVersion)
      return;
    document.title = `${entry.name} — Brushroom`;
    if (updateURL) {
      const url = new URL(location.href);
      url.searchParams.set("brush", entry.id);
      url.searchParams.delete("auto");
      history.replaceState(null, "", url);
    }
    if (compactLayout.matches) {
      togglePanel(false);
      toggleBrushes(false);
    }
  } catch (error) {
    console.error(error);
    if (version !== selectionVersion) return;
    $("status").textContent =
      "Could not load brush. Choose a brush to try again.";
    toast(`Could not load ${entry.name}. Please try again.`);
  }
}
function togglePanel(show = $("sidebar").hidden, remember = true) {
  if (remember && !compactLayout.matches) desktopPanelOpen = show;
  const returnFocus = !show && $("sidebar").contains(document.activeElement);
  $("sidebar").hidden = !show;
  $("sidebar-backdrop").hidden = !show;
  $("app").classList.toggle("panel-collapsed", !show);
  const toggle = $("sidebar-toggle");
  const label = `${show ? "Collapse" : "Expand"} brush options`;
  toggle.setAttribute("aria-expanded", String(show));
  toggle.setAttribute("aria-label", label);
  toggle.title = `${label} (H)`;
  if (returnFocus) toggle.focus();
}
function toggleBrushes(show = $("brush-list").hidden, remember = true) {
  if (remember && !compactLayout.matches) desktopBrushesOpen = show;
  const list = $("brush-list");
  const returnFocus = !show && list.contains(document.activeElement);
  list.hidden = !show;
  $("brushes-backdrop").hidden = !show;
  $("app").classList.toggle("brushes-collapsed", !show);
  const toggle = $("brushes-toggle");
  const label = `${show ? "Collapse" : "Expand"} brushes`;
  toggle.setAttribute("aria-expanded", String(show));
  toggle.setAttribute("aria-label", label);
  toggle.title = `${label} (L)`;
  if (returnFocus) toggle.focus();
}

for (const entry of brushes.values()) {
  const button = document.createElement("button");
  button.className = "brush-stroke";
  button.dataset.brush = entry.id;
  button.setAttribute("aria-label", `${entry.name} brush`);
  button.setAttribute("aria-pressed", "false");
  button.title = `${entry.name} brush`;
  const preview = document.createElement("img");
  preview.src = entry.preview;
  preview.alt = "";
  preview.className = "brush-preview";
  button.append(preview);
  button.addEventListener("click", () => {
    if (studio) selectBrush(entry.id);
  });
  $("brush-list").append(button);
}
new ResizeObserver(fitCanvas).observe($("canvas-surround"));
new ResizeObserver(fillBrushGrid).observe($("brush-list"));
fillBrushGrid();
compactLayout.addEventListener("change", () => {
  togglePanel(!compactLayout.matches && desktopPanelOpen, false);
  toggleBrushes(!compactLayout.matches && desktopBrushesOpen, false);
});
togglePanel(!compactLayout.matches);
toggleBrushes(!compactLayout.matches);
fitCanvas();

$("sidebar-toggle").addEventListener("click", () => togglePanel());
$("brushes-toggle").addEventListener("click", () => toggleBrushes());
document.addEventListener("pointerdown", (event) => {
  if (!compactLayout.matches) return;
  if (
    !$("sidebar").hidden &&
    !event.target.closest("#sidebar, #sidebar-toggle, #help-dialog")
  )
    togglePanel(false);
  if (
    !$("brush-list").hidden &&
    !event.target.closest("#brush-list, #brushes-toggle, #help-dialog")
  )
    toggleBrushes(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || $("help-dialog").open) return;
  if (!$("sidebar").hidden) {
    togglePanel(false);
    $("sidebar-toggle").focus();
  } else if (compactLayout.matches && !$("brush-list").hidden) {
    toggleBrushes(false);
    $("brushes-toggle").focus();
  }
});
$("help-toggle").addEventListener("click", () => $("help-dialog").showModal());
$("help-close").addEventListener("click", () => $("help-dialog").close());
$("help-dialog").addEventListener("click", (event) => {
  if (event.target === $("help-dialog")) {
    const rect = event.target.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      event.target.close();
  }
});
$("aspect-ratio").addEventListener("change", fitCanvas);

try {
  studio = await createStudio(
    $("canvas-host"),
    { change: update, cursor },
    fitCanvas(),
  );
  fitCanvas();
  await selectBrush(params.get("brush"), false);
  if (params.has("auto")) studio.autoFill();
  $("draw-tool").addEventListener("click", () => studio.setTool("brush"));
  $("erase-tool").addEventListener("click", () =>
    studio.setTool(state.tool === "eraser" ? "brush" : "eraser"),
  );
  $("undo").addEventListener("click", () => studio.undo());
  $("redo").addEventListener("click", () => studio.redo());
  $("clear").addEventListener("click", () => {
    studio.clear();
    toast("Canvas cleared. Undo to restore.");
  });
  $("auto-fill").addEventListener("click", () => studio.autoFill());
  $("remix").addEventListener("click", () => {
    studio.randomize();
    toast("New variation.");
  });
  $("export").addEventListener("click", async () => {
    try {
      await studio.export();
      toast("PNG exported.");
    } catch (error) {
      toast(error.message);
    }
  });
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("input, select, textarea, [contenteditable=true]")
    )
      return;
    if ($("help-dialog").open) return;
    const key = event.key.toLowerCase();
    if (event.metaKey || event.ctrlKey) {
      if (key === "z") {
        event.preventDefault();
        event.shiftKey ? studio.redo() : studio.undo();
      } else if (key === "y") {
        event.preventDefault();
        studio.redo();
      } else if (key === "s") {
        event.preventDefault();
        $("export").click();
      }
      return;
    }
    if (event.altKey || !state?.registration) return;
    // Space on a focused button keeps its native keyboard behavior.
    if (key === " " && target instanceof Element && target.closest("button, a"))
      return;
    const actions = {
      b: () => studio.setTool("brush"),
      e: () => studio.setTool(state.tool === "eraser" ? "brush" : "eraser"),
      c: () => $("clear").click(),
      r: () => $("remix").click(),
      s: () => $("export").click(),
      h: () => togglePanel(),
      l: () => toggleBrushes(),
      "?": () => $("help-dialog").showModal(),
      " ": () => studio.autoFill(),
    };
    if (actions[key]) {
      event.preventDefault();
      if (!event.repeat) actions[key]();
      return;
    }
    const controls = state.registration.controls;
    const choice = controls.find((control) =>
      ["palette", "select"].includes(control.type),
    );
    if (/^[0-5]$/.test(key) && choice?.options[Number(key)]) {
      event.preventDefault();
      studio.setSetting(choice.id, choice.options[Number(key)][0]);
    }
    const toggle = controls.find((control) => control.key === key);
    if (toggle) {
      event.preventDefault();
      studio.setSetting(toggle.id, !state.settings[toggle.id]);
    }
    const rangeId = ["[", "]"].includes(key)
      ? "size"
      : ["-", "=", "+"].includes(key)
        ? "density"
        : null;
    const range = controls.find((control) => control.id === rangeId);
    if (range) {
      event.preventDefault();
      const factor = ["[", "-"].includes(key) ? 1 / 1.2 : 1.2;
      studio.setSetting(
        range.id,
        Math.max(
          range.min,
          Math.min(range.max, state.settings[range.id] * factor),
        ),
      );
    }
  });
} catch (error) {
  console.error(error);
  $("status").textContent =
    "The studio could not start. Please reload to try again.";
  toast("The studio could not start. Please reload to try again.");
}
