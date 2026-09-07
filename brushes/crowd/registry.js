export default {
  id: "crowd",
  name: "Crowd",
  category: "People & gatherings",
  description: "Royal-blue people trace out from their feet in stroke order, then gently sway and breathe, each on their own rhythm.",
  hint: "Drag to gather a crowd. Each outline grows from the feet, then comes to life. Animate people toggles the movement.",
  preview: new URL("./preview.png", import.meta.url).href,
  controls: [
    { id: "size", label: "Figure size", type: "range", min: 0.4, max: 3, step: 0.05 },
    { id: "density", label: "Crowd density", type: "range", min: 0.35, max: 2.5, step: 0.05 },
    { id: "spread", label: "Crowd spread", caption: "Spread", type: "range", min: 0, max: 2, step: 0.05,
      note: "Zero places feet on your stroke. Increase to scatter groups in depth." },
    { id: "details", label: "Scene objects", caption: "Objects", type: "range", min: 0, max: 2, step: 0.05,
      note: "Mix in traced dogs, birds, a cat, and cafe tables. Zero draws people only." },
    { id: "color", label: "Outline color", type: "palette", options: [
      ["blue", "Royal blue", "#4169e1"],
      ["red", "Vermilion", "#fa594b"],
      ["graphite", "Graphite", "#444440"],
      ["green", "Sage", "#4f9778"],
    ] },
    { id: "pose", label: "People", type: "select", options: [
      ["mixed", "Everyday mix"], ["standing", "Standing & talking"],
      ["walking", "On the move"], ["seated", "Sitting & lounging"],
    ] },
    { id: "motion", label: "Animate people", type: "toggle" },
  ],
  load: () => import("./sketch.js"),
};
