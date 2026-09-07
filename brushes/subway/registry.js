export default {
  id: "subway",
  name: "Subway",
  category: "Routes & stations",
  description:
    "Fine subway strands trail your pen, with new services starting at turns, animated branches, station names and transit symbols.",
  hint: "Drag to grow the lines. At turns, half the services end and new colors start from open circles.",
  preview: new URL("./preview.png", import.meta.url).href,
  controls: [
    { id: "size", label: "Route size", type: "range", min: 0.35, max: 3, step: 0.05 },
    { id: "density", label: "Station density", type: "range", min: 0.4, max: 2.5, step: 0.05 },
    { id: "details", label: "Map detail density", caption: "Map details", type: "range", min: 0, max: 2, step: 0.05,
      note: "Adds transit symbols, service badges and connection notes around stations." },
    { id: "divergence", label: "Route divergence", caption: "Divergence", type: "range", min: 0, max: 2, step: 0.05,
      note: "Controls how far routes wander and how often terminal branches split away." },
    {
      id: "color", label: "Route palette", type: "palette",
      options: [
        ["auto", "Subway mix"],
        ["blue", "Eighth Avenue blue", "#0099c8"],
        ["red", "Broadway red", "#ef5938"],
        ["yellow", "Broadway yellow", "#f9d51c"],
        ["orange", "Sixth Avenue orange", "#f4a02d"],
        ["green", "Lexington green", "#008e69"],
        ["purple", "Flushing purple", "#ae3d89"],
      ],
    },
    {
      id: "routes", label: "Parallel routes", type: "select",
      options: [["1", "Single line"], ["2", "Two lines"], ["3", "Three lines"], ["4", "Four lines"]],
    },
    { id: "labels", label: "Station labels", type: "toggle" },
  ],
  load: () => import("./sketch.js"),
};
