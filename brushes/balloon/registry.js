export default {
  id: "balloon",
  name: "Balloon",
  category: "Soft shapes & surprises",
  description:
    "A hidden patchwork of airbrushed shapes. Trace a line, lift your pen, and watch the color bloom.",
  hint: "Draw a line and let go. Soft, colorful shapes will bloom along your path.",
  preview: new URL("./preview.png", import.meta.url).href,
  controls: [
    {
      id: "size",
      label: "Cell size",
      type: "range",
      min: 0.4,
      max: 3,
      step: 0.05,
      commit: true,
      note: "Changing size starts a fresh pattern over your drawing.",
    },
    {
      id: "color",
      label: "Ink palette",
      type: "palette",
      options: [
        ["auto", "Poster palette"],
        ["red", "Red", "#ec523a"],
        ["blue", "Blue", "#3876d0"],
        ["green", "Green", "#409454"],
        ["yellow", "Yellow", "#f1be38"],
        ["pink", "Pink", "#f29ec0"],
      ],
    },
  ],
  load: () => import("./sketch.js"),
};
