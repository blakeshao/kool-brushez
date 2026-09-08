export default {
  id: "christmas",
  name: "Christmas Branch",
  category: "Pine & baubles",
  description:
    "A fluffy pine bough grows along every stroke, needles fanning out with a soft drop shadow, dressed with the odd hanging bauble.",
  hint: "Drag to grow a branch. Needles fan out from your path; baubles hang here and there.",
  preview: new URL("./preview.png", import.meta.url).href,
  controls: [
    {
      id: "size",
      label: "Needle size",
      type: "range",
      min: 0.4,
      max: 3.5,
      step: 0.05,
    },
    {
      id: "density",
      label: "Needle density",
      type: "range",
      min: 0.3,
      max: 3,
      step: 0.05,
    },
    {
      id: "color",
      label: "Needle color",
      type: "palette",
      options: [
        ["auto", "Mixed greens"],
        ["pine", "Pine", "#1f7a3f"],
        ["spruce", "Spruce", "#2e6e78"],
        ["frost", "Frost", "#bfe0d6"],
      ],
    },
    { id: "ornaments", label: "Hang ornaments", type: "toggle", key: "o" },
  ],
  load: () => import("./sketch.js"),
};
