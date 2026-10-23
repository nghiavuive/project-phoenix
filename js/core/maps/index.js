// Các bản đồ ngoài bản gốc (Khu công nghiệp ở core/map.js): Làng quê, Sa mạc, Căn cứ băng giá.
// Mỗi bản đồ một file (lang_que.js, sa_mac.js, bang_gia.js) dựng bằng bộ dụng cụ ở kit.js, trả về cùng dạng với map.js:
// {blocks, decks, lamps, circles, props, zones, roads, spawn, ...} + diện mạo: theme, patches, lights.
// Mọi công trình vẫn chỉ là khối hộp thẳng trục + dốc (core/collide.js) nên va chạm, tìm đường, tầm nhìn
// của địch hoạt động y như ở bản đồ gốc.
import { bangGia } from "./bang_gia.js";
import { langQue } from "./lang_que.js";
import { saMac } from "./sa_mac.js";

/** Cách bố trí các thông số diện mạo; bản đồ nào không khai báo thì lấy mặc định của bản gốc (xem map.js). */
export const MAP_INFO = [
  { id: "phuong_hoang", name: "Khu công nghiệp", blurb: "Bốn khu chiến đấu quanh một ngã tư: nhà kho hai tầng, bãi container, tháp canh." },
  { id: "lang_que", name: "Làng quê", blurb: "Đình làng, nhà mái ngói, ao sen và ruộng lúa. Nhiều ngõ ngách, nhiều chỗ nấp." },
  { id: "sa_mac", name: "Trạm radar sa mạc", blurb: "Bãi cát nắng gắt, trạm radar có mái bằng, giàn khoan và hẻm núi hẹp." },
  { id: "bang_gia", name: "Căn cứ băng giá", blurb: "Đêm tuyết dưới ánh trăng: nhà chỉ huy, đài truyền tin, kho nhiên liệu." },
];

export const EXTRA_MAPS = { lang_que: langQue, sa_mac: saMac, bang_gia: bangGia };
