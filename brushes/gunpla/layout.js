const key = (column, row) => `${column},${row}`;

export function createLayout(unit, limits = null) {
  return { unit, limits, cells: new Map(), edges: new Set(), pieces: [],
    minColumn: Infinity, minRow: Infinity, maxColumn: -Infinity, maxRow: -Infinity };
}

export function reserveComponent(layout, part, column, row) {
  if (layout.cells.has(key(column, row))) return null;
  const desiredWidth = Math.max(1, Math.ceil((part.width * part.scale + 12) / layout.unit));
  const desiredHeight = Math.max(1, Math.ceil((part.height * part.scale + 13) / layout.unit));
  const shapes = [];
  for (let columns = 1; columns <= desiredWidth; columns++)
    for (let rows = 1; rows <= desiredHeight; rows++) shapes.push({ columns, rows });
  shapes.sort((a, b) => b.columns * b.rows - a.columns * a.rows ||
    Math.abs(a.columns / a.rows - desiredWidth / desiredHeight) - Math.abs(b.columns / b.rows - desiredWidth / desiredHeight));
  for (const shape of shapes) {
    const anchors = [];
    for (let dx = 0; dx < shape.columns; dx++)
      for (let dy = 0; dy < shape.rows; dy++) anchors.push({ column: column - dx, row: row - dy,
        distance: Math.abs(dx - (shape.columns - 1) / 2) + Math.abs(dy - (shape.rows - 1) / 2) });
    anchors.sort((a, b) => a.distance - b.distance);
    for (const anchor of anchors) {
      const left = anchor.column, top = anchor.row;
      const right = left + shape.columns, bottom = top + shape.rows;
      const bounds = layout.limits;
      if (bounds && (left < 0 || top < 0 || right > bounds.columns || bottom > bounds.rows)) continue;
      let available = true;
      for (let c = left; c < right && available; c++)
        for (let r = top; r < bottom; r++)
          if (layout.cells.has(key(c, r))) { available = false; break; }
      if (!available) continue;
      const piece = { ...shape, column: left, row: top, part, edges: [] };
      for (let c = left; c < right; c++)
        for (let r = top; r < bottom; r++) layout.cells.set(key(c, r), piece);
      function edge(id, points) {
        if (layout.edges.has(id)) return;
        layout.edges.add(id);
        piece.edges.push(points.map(value => value * layout.unit));
      }
      const w = shape.columns, h = shape.rows;
      for (let c = 0; c < w; c++) {
        edge(`h:${left + c},${top}`, [c - w / 2, -h / 2, c + 1 - w / 2, -h / 2]);
        edge(`h:${left + c},${bottom}`, [c - w / 2, h / 2, c + 1 - w / 2, h / 2]);
      }
      for (let r = 0; r < h; r++) {
        edge(`v:${left},${top + r}`, [-w / 2, r - h / 2, -w / 2, r + 1 - h / 2]);
        edge(`v:${right},${top + r}`, [w / 2, r - h / 2, w / 2, r + 1 - h / 2]);
      }
      layout.minColumn = Math.min(layout.minColumn, left);
      layout.minRow = Math.min(layout.minRow, top);
      layout.maxColumn = Math.max(layout.maxColumn, right);
      layout.maxRow = Math.max(layout.maxRow, bottom);
      layout.pieces.push(piece);
      return piece;
    }
  }
  return null;
}
