const MAX_BUFFER_LENGTH = 15;

export class TypingEngine {
  constructor({ actions, onActivate, onBufferChange }) {
    this.actions = Array.isArray(actions) ? actions : [];
    this.onActivate = onActivate;
    this.onBufferChange = onBufferChange;
    this.buffer = "";
    this.match = null;
  }

  setActions(actions) {
    this.actions = Array.isArray(actions) ? actions : [];
    this.emitChange();
  }

  /**
   * Both edits report whether they changed the buffer. A keystroke that
   * changed nothing -- backspace on an empty buffer, a character past the
   * cap -- is not typing, and the caller measuring pace needs to tell the
   * difference. Returning it here keeps that judgement out of the shell
   * without giving this class any timing rules of its own.
   */
  append(char) {
    if (this.buffer.length >= MAX_BUFFER_LENGTH) return false;
    this.buffer += char;
    this.emitChange();
    return true;
  }

  backspace() {
    if (!this.buffer.length) return false;
    this.buffer = this.buffer.slice(0, -1);
    this.emitChange();
    return true;
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
