// 30-slot inventory; the first 10 slots are the hotbar.
import { ITEMS, RECIPES } from './content.js';

export class Inventory {
  constructor() {
    this.slots = new Array(30).fill(null);
    this.sel = 0;
    this.cursor = null; // stack held by the mouse in the inventory screen
  }
  get held() { return this.slots[this.sel]; }
  count(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.n; if (this.cursor?.id === id) n += this.cursor.n; return n; }
  add(id, n = 1) {
    const max = ITEMS[id].max;
    for (const s of this.slots) if (s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; if (!n) return 0; }
    for (let i = 0; i < this.slots.length && n; i++) if (!this.slots[i]) { const k = Math.min(n, max); this.slots[i] = { id, n: k }; n -= k; }
    return n;
  }
  remove(id, n = 1) {
    for (let i = this.slots.length - 1; i >= 0 && n; i--) {
      const s = this.slots[i];
      if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) this.slots[i] = null; }
    }
    return n === 0;
  }
  useHeld() {
    const s = this.held;
    if (!s) return false;
    s.n--; if (!s.n) this.slots[this.sel] = null;
    return true;
  }
  canCraft(r) { return Object.entries(r.cost).every(([id, n]) => this.count(id) >= n); }
  craft(r) {
    if (!this.canCraft(r)) return false;
    for (const [id, n] of Object.entries(r.cost)) this.remove(id, n);
    const left = this.add(r.out, r.n);
    return left === 0;
  }
  clickSlot(i) {
    const s = this.slots[i], c = this.cursor;
    if (c && s && c.id === s.id) { const k = Math.min(c.n, ITEMS[s.id].max - s.n); s.n += k; c.n -= k; if (!c.n) this.cursor = null; }
    else { this.slots[i] = c; this.cursor = s; }
  }
}
export { RECIPES };
