export default {
  id: "schematic",
  name: "Schematic",
  category: "Lines & little systems",
  description:
    "Ink-soaked diagrams, wandering wires and tiny annotations. A blueprint for something beautifully imaginary.",
  hint: "Drag to connect a system. Click to stamp a single little invention.",
  preview: new URL("./preview.png", import.meta.url).href,
  controls: [
    {
      id: "size",
      label: "Brush size",
      type: "range",
      min: 0.25,
      max: 4,
      step: 0.05,
    },
    {
      id: "density",
      label: "Mark density",
      type: "range",
      min: 0.25,
      max: 6,
      step: 0.05,
    },
    {
      id: "style",
      label: "Drawing language",
      type: "select",
      options: [
        ["auto", "A little of everything"],
        ["patch", "Patch diagrams"],
        ["cad", "CAD drawings"],
        ["mixed", "Mixed systems"],
      ],
    },
    { id: "mirror", label: "Mirror drawing", type: "toggle", key: "m" },
  ],
  load: () => import("./sketch.js"),
};
