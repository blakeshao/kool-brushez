import score from "../brushes/score/registry.js";
import schematic from "../brushes/schematic/registry.js";
import balloon from "../brushes/balloon/registry.js";
import subway from "../brushes/subway/registry.js";
import crowd from "../brushes/crowd/registry.js";
import gunpla from "../brushes/gunpla/registry.js";

/**
 * Each folder registers its own metadata, controls, preview and lazy JS entry.
 * Add new brush registrations here; the studio never branches on brush IDs.
 * A loader resolves { default: createBrush(p5Instance) }.
 * See brushes/README.md for the brush lifecycle contract.
 */
export function createRegistry(entries) {
  const registry = new Map();
  for (const entry of entries) {
    if (
      typeof entry.id !== "string" ||
      !/^[a-z][a-z0-9-]*$/.test(entry.id) ||
      registry.has(entry.id)
    ) {
      throw new Error(`Invalid or duplicate brush ID: ${entry.id}`);
    }
    if (
      !entry.name ||
      typeof entry.load !== "function" ||
      !Array.isArray(entry.controls)
    ) {
      throw new Error(`Incomplete brush registration: ${entry.id}`);
    }
    registry.set(entry.id, Object.freeze(entry));
  }
  if (!registry.size) throw new Error("Register at least one brush.");
  return registry;
}

export const brushes = createRegistry([score, schematic, balloon, subway, crowd, gunpla]);
export const requiredMethods = [
  "setup",
  "resize",
  "draw",
  "pointerDown",
  "pointerMove",
  "pointerUp",
  "finish",
  "clear",
  "autoFill",
  "randomize",
  "getSettings",
  "setSetting",
];

export function validateBrush(brush) {
  for (const method of requiredMethods) {
    if (typeof brush?.[method] !== "function")
      throw new Error(`Brush is missing ${method}().`);
  }
  return brush;
}
