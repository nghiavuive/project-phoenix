// Lưu kỷ lục vào trình duyệt. Trình duyệt chặn lưu trữ thì game vẫn chạy bình thường, chỉ không nhớ kỷ lục.
const KEY = "project-phoenix-save";
const EMPTY = { best: 0, bestWave: 0, name: "", touch: null, mode: "solo", sensitivity: 1, volume: null, server: "",
  graphics: null,     // mức đồ hoạ: "cao" | "thap" | null = tự chọn theo máy
  map: "phuong_hoang",   // bản đồ đang chọn cho Sinh tồn / Đoàn kết / PvP
  missions: {} };     // tiến độ nhiệm vụ: { mã: { stars, time } }

export function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...EMPTY, ...data, best: Number(data.best) || 0, bestWave: Number(data.bestWave) || 0 };
  } catch {
    return { ...EMPTY };
  }
}

export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}
