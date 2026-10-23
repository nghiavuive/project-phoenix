// Điểm khởi động của bản web.
import { Game } from "./game/app.js";

function boot() {
  try {
    window.phoenix = new Game();          // để ngỏ ra ngoài cho kiểm thử tự động và gỡ lỗi trong bảng điều khiển
  } catch (error) {
    console.error(error);
    document.getElementById("menu").hidden = false;
    document.getElementById("page-main").hidden = false;
    document.getElementById("note").textContent = window.THREE
      ? "Trình duyệt này không bật được đồ hoạ 3D (WebGL). Thầy thử Chrome hoặc Edge bản mới."
      : "Không tải được thư viện đồ hoạ. Kiểm tra kết nối mạng rồi tải lại trang.";
  }
}
boot();
