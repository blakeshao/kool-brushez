// Snapshots are supplied by the studio so this stays independent of p5.
export class History {
  constructor(limit = 16) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }
  checkpoint(snapshot) {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }
  undo(current) {
    if (!this.canUndo) return null;
    this.redoStack.push(current);
    return this.undoStack.pop();
  }
  redo(current) {
    if (!this.canRedo) return null;
    this.undoStack.push(current);
    return this.redoStack.pop();
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
}
