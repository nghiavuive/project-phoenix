// Nguồn điểm chạm của trình duyệt: gom mọi ngón đang chạm thành {id: [x, y]} theo toạ độ giao diện.
export class TouchPointerSource {
  constructor(surface) {
    this.surface = surface;
    this.active = new Map();
    this.onFirstTouch = null;         // gọi một lần khi phát hiện người chơi dùng màn hình cảm ứng
    const put = (e) => {
      if (e.pointerType === "mouse") return;
      if (this.onFirstTouch) { this.onFirstTouch(); this.onFirstTouch = null; }
      this.active.set(e.pointerId, this._toUi(e));
      e.preventDefault();
    };
    const drop = (e) => this.active.delete(e.pointerId);
    surface.addEventListener("pointerdown", (e) => { put(e); try { surface.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } });
    surface.addEventListener("pointermove", (e) => { if (this.active.has(e.pointerId)) put(e); });
    surface.addEventListener("pointerup", drop);
    surface.addEventListener("pointercancel", drop);
    surface.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  _toUi(e) {
    const r = this.surface.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width - 0.5) * (r.width / r.height), 0.5 - (e.clientY - r.top) / r.height];
  }
  poll() { return Object.fromEntries(this.active); }
  clear() { this.active.clear(); }
}
