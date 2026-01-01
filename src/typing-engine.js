export class TypingEngine {
  constructor({ actions, onActivate, onBufferChange }) {
    this.actions = Array.isArray(actions) ? actions : [];
    this.onActivate = onActivate;
    this.onBufferChange = onBufferChange;
    this.buffer = "";
    this.match = null;
  }

  append(char) {
    this.buffer += char;
    this.emitChange();
  }

  backspace() {
    if (!this.buffer.length) return;
    this.buffer = this.buffer.slice(0, -1);
    this.emitChange();
  }

  reset() {
    this.buffer = "";
    this.emitChange();
  }

  activateMatch() {
    if (!this.match) return false;
    if (typeof this.onActivate === "function") {
      this.onActivate(this.match);
    }
    this.reset();
    return true;
  }

  emitChange() {
    const normalized = this.buffer.trim();
    this.match = this.actions.find((action) => action.prompt === normalized) || null;
    if (typeof this.onBufferChange === "function") {
      this.onBufferChange(this.buffer, this.match);
    }
  }
}
