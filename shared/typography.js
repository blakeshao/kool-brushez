export const FONT_NAME = "DM Sans";
export const FONT_FAMILY = '"DM Sans", sans-serif';

export function canvasFont(size, weight = 400) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

export async function loadDrawingFonts() {
  // Canvas pixels and measured label positions cannot update like CSS text.
  // Load both real weights before any brush starts drawing or measuring.
  await Promise.all([
    document.fonts.load(canvasFont(12)),
    document.fonts.load(canvasFont(12, 700)),
  ]);
}
