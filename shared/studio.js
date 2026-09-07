import P5 from "p5";
import { History } from "./history.js";
import { validateBrush } from "./registry.js";
import { loadDrawingFonts } from "./typography.js";

export const PAPER = { width: 1200, height: 840 };

/** A single p5 canvas, shared artwork, and brush-independent editing tools. */
export async function createStudio(host, callbacks = {}, paper = PAPER) {
  await loadDrawingFonts();
  return new Promise((resolve) => {
    new P5((p) => {
      let base,
        active,
        registration,
        hasMarks = false,
        activeDirty = false,
        drawing = false;
      let tool = "brush",
        lastPoint = null,
        pointerId = null,
        loadVersion = 0;
      const instances = new Map();
      const history = new History();
      const eraserSize = 36;

      function notify() {
        callbacks.change?.({
          registration,
          settings: active?.getSettings(),
          hasMarks,
          tool,
          canUndo: history.canUndo,
          canRedo: history.canRedo,
        });
      }
      function render() {
        p.background(255);
        // Retain the source pixels between resizes; fit them without cropping
        // or progressively resampling the drawing as the viewport changes.
        const scale = Math.min(p.width / base.width, p.height / base.height);
        const width = base.width * scale;
        const height = base.height * scale;
        p.image(
          base,
          (p.width - width) / 2,
          (p.height - height) / 2,
          width,
          height,
        );
        if (active) {
          p.push();
          active.draw();
          p.pop();
        }
      }
      function finish() {
        endPointer();
        if (active) {
          p.push();
          active.finish();
          p.pop();
        }
        render();
      }
      function capture() {
        finish();
        const source = activeDirty ? p : base;
        return {
          pixels: source.drawingContext.getImageData(
            0,
            0,
            source.canvas.width,
            source.canvas.height,
          ),
          width: source.width,
          height: source.height,
          density: source.pixelDensity(),
          hasMarks,
        };
      }
      function checkpoint() {
        history.checkpoint(capture());
      }
      function restore(snapshot) {
        if (!snapshot) return;
        active?.clear();
        activeDirty = false;
        if (base.pixelDensity() !== snapshot.density)
          base.pixelDensity(snapshot.density);
        base.resizeCanvas(snapshot.width, snapshot.height);
        base.drawingContext.putImageData(snapshot.pixels, 0, 0);
        hasMarks = snapshot.hasMarks;
        render();
        notify();
      }
      function commit(force = false) {
        finish();
        if (activeDirty || force) {
          if (base.pixelDensity() !== p.pixelDensity())
            base.pixelDensity(p.pixelDensity());
          base.resizeCanvas(p.width, p.height);
          base.clear();
          base.drawingContext.drawImage(p.canvas, 0, 0, p.width, p.height);
        }
        active?.clear();
        activeDirty = false;
      }
      function point(event) {
        const box = p.canvas.getBoundingClientRect();
        return {
          x: p.constrain(
            ((event.clientX - box.left) * p.width) / box.width,
            0,
            p.width,
          ),
          y: p.constrain(
            ((event.clientY - box.top) * p.height) / box.height,
            0,
            p.height,
          ),
        };
      }
      function eraseAt(pos) {
        const ctx = base.drawingContext;
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = eraserSize;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(lastPoint?.x ?? pos.x, lastPoint?.y ?? pos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, eraserSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        lastPoint = pos;
      }
      function endPointer(event) {
        if (!drawing || (event && event.pointerId !== pointerId)) return;
        if (event && event.type === "pointerup") {
          const pos = point(event);
          if (tool === "eraser") eraseAt(pos);
          else active.pointerMove(pos.x, pos.y);
        }
        active?.pointerUp();
        drawing = false;
        if (p.canvas.hasPointerCapture(pointerId))
          p.canvas.releasePointerCapture(pointerId);
        pointerId = null;
        lastPoint = null;
        callbacks.cursor?.(event, tool, eraserSize);
        notify();
      }
      function wirePointer() {
        const canvas = p.canvas;
        canvas.addEventListener("pointerdown", (event) => {
          if (!active || drawing || event.button !== 0 || !event.isPrimary)
            return;
          event.preventDefault();
          canvas.focus({ preventScroll: true });
          checkpoint();
          if (tool === "eraser") commit(true);
          const pos = point(event);
          pointerId = event.pointerId;
          canvas.setPointerCapture(pointerId);
          drawing = true;
          if (tool === "eraser") eraseAt(pos);
          else {
            active.pointerDown(pos.x, pos.y);
            activeDirty = true;
          }
          hasMarks = true;
          notify();
        });
        canvas.addEventListener("pointermove", (event) => {
          callbacks.cursor?.(event, tool, eraserSize);
          if (!drawing || event.pointerId !== pointerId) return;
          const events = event.getCoalescedEvents?.() || [];
          for (const sample of events.length ? events : [event]) {
            const pos = point(sample);
            if (tool === "eraser") eraseAt(pos);
            else active.pointerMove(pos.x, pos.y);
          }
        });
        canvas.addEventListener("pointerleave", () => callbacks.cursor?.(null));
        canvas.addEventListener("pointerup", endPointer);
        canvas.addEventListener("pointercancel", endPointer);
        canvas.addEventListener("lostpointercapture", endPointer);
        window.addEventListener("blur", () => {
          endPointer();
          callbacks.cursor?.(null);
        });
      }

      const api = {
        resize(width, height, density = p.pixelDensity()) {
          width = Math.max(1, Math.round(width));
          height = Math.max(1, Math.round(height));
          if (
            p.width === width &&
            p.height === height &&
            p.pixelDensity() === density
          )
            return;
          commit();
          if (p.pixelDensity() !== density) p.pixelDensity(density);
          p.resizeCanvas(width, height, true);
          for (const brush of instances.values()) {
            p.push();
            brush.resize();
            p.pop();
          }
          render();
          notify();
        },
        async select(entry, params = new URLSearchParams()) {
          const version = ++loadVersion;
          const module = await entry.load();
          if (version !== loadVersion) return false;
          let brush = instances.get(entry.id);
          if (!brush) {
            brush = validateBrush(module.default(p));
            p.push();
            try {
              brush.setup(params);
            } finally {
              p.pop();
            }
            instances.set(entry.id, brush);
          }
          if (active !== brush) {
            commit();
            active = brush;
            registration = entry;
          }
          tool = "brush";
          notify();
          return true;
        },
        setTool(value) {
          if (!active || !["brush", "eraser"].includes(value)) return;
          finish();
          tool = value;
          notify();
        },
        setSetting(id, value) {
          const control = registration?.controls.find((item) => item.id === id);
          if (!control) return;
          finish();
          if (control.commit) commit();
          if (control.type === "toggle") checkpoint();
          active.setSetting(id, value);
          notify();
        },
        autoFill() {
          if (!active) return;
          checkpoint();
          tool = "brush";
          p.push();
          active.autoFill();
          p.pop();
          activeDirty = true;
          hasMarks = true;
          notify();
        },
        randomize() {
          if (!active) return;
          commit();
          active.randomize();
          notify();
        },
        clear() {
          if (!active || !hasMarks) return;
          checkpoint();
          base.clear();
          active.clear();
          activeDirty = false;
          hasMarks = false;
          render();
          notify();
        },
        undo() {
          if (history.canUndo) restore(history.undo(capture()));
        },
        redo() {
          if (history.canRedo) restore(history.redo(capture()));
        },
        async export(name) {
          finish();
          const blob = await new Promise((resolve) =>
            p.canvas.toBlob(resolve, "image/png"),
          );
          if (!blob)
            throw new Error("The PNG could not be created. Please try again.");
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `${(name || "Untitled study").replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "Untitled study"}.png`;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        },
      };
      p.setup = () => {
        p.pixelDensity(
          paper.density || Math.min(3, Math.ceil(window.devicePixelRatio || 1)),
        );
        // History reads pixels on every stroke. Start with a readback-friendly
        // surface so resampling stays consistent before and after undo.
        const surface = document.createElement("canvas");
        surface.className = "p5Canvas";
        surface.getContext("2d", { willReadFrequently: true });
        host.append(surface);
        const canvas = p.createCanvas(
          paper.width,
          paper.height,
          p.P2D,
          surface,
        );
        canvas.attribute(
          "aria-label",
          "Drawing canvas. Use the brush controls, then click and drag to draw.",
        );
        canvas.attribute("tabindex", "0");
        const baseSurface = document.createElement("canvas");
        baseSurface.getContext("2d", { willReadFrequently: true });
        base = p.createGraphics(p.width, p.height, p.P2D, baseSurface);
        wirePointer();
        resolve(api);
      };
      p.draw = render;
    }, host);
  });
}
