// Skin súng và phần thưởng xu. Máy chủ dùng đúng bảng này để tính giá và kiểm tra quyền sở hữu,
// còn máy khách dùng để vẽ cửa hàng và đổi màu súng. Skin chỉ đổi màu, không đổi sức mạnh.
// role của màu súng (xem M trong game/arsenal.js): metal (thân), dark (chi tiết tối), accent (vạch nhấn), wood/woodLight (báng, ốp), steel (nòng).
export const SKINS = Object.freeze([
  { id: "mac_dinh", name: "Mặc định", price: 0, rarity: "thường", colors: null },
  { id: "rung_ram", name: "Rừng rậm", price: 300, rarity: "thường", colors: { metal: 0x3c4a2e, dark: 0x1e2616, accent: 0xb6c46a, wood: 0x4a3a22, woodLight: 0x6a5530, steel: 0x8d9a7a, olive: 0x3c4a2e } },
  { id: "sa_mac", name: "Cát vàng", price: 450, rarity: "thường", colors: { metal: 0x9c8660, dark: 0x4a3f2a, accent: 0x2e5c7a, wood: 0x6e5a3a, woodLight: 0x8c7448, steel: 0xcdbf9d, olive: 0x9c8660 } },
  { id: "bang_gia", name: "Băng giá", price: 700, rarity: "hiếm", colors: { metal: 0x9fc4dd, dark: 0x2d4358, accent: 0xeaf6ff, wood: 0x5d7f99, woodLight: 0x86a9c2, steel: 0xe3f1fb, olive: 0x9fc4dd } },
  { id: "dem_den", name: "Đêm đen", price: 900, rarity: "hiếm", colors: { metal: 0x15161a, dark: 0x08090b, accent: 0xe0e0e0, wood: 0x1d1e23, woodLight: 0x2a2c33, steel: 0x50535d, olive: 0x15161a } },
  { id: "hong_ngoc", name: "Hồng ngọc", price: 1400, rarity: "sử thi", colors: { metal: 0x7a1020, dark: 0x2a0710, accent: 0xff5a7a, wood: 0x3a0c14, woodLight: 0x5a1422, steel: 0xd9a0ac, olive: 0x7a1020 } },
  { id: "hoang_kim", name: "Hoàng kim", price: 2500, rarity: "huyền thoại", colors: { metal: 0xc9a227, dark: 0x5a4510, accent: 0xfff0a8, wood: 0x8a6a1a, woodLight: 0xb08a28, steel: 0xffe27a, olive: 0xc9a227 } },
  { id: "phuong_hoang", name: "Phượng hoàng", price: 4000, rarity: "huyền thoại", colors: { metal: 0x2a0c0a, dark: 0x120504, accent: 0xff7a1a, wood: 0x4a1408, woodLight: 0xb8321a, steel: 0xffb347, olive: 0x2a0c0a } },
]);
export const SKIN_BY_ID = Object.freeze(Object.fromEntries(SKINS.map((s) => [s.id, s])));
export const DEFAULT_SKIN = "mac_dinh";

// ---------- xu ----------
export const COIN = Object.freeze({
  perKill: 2,            // mỗi địch hạ trong trận trực tuyến
  perHeadshot: 1,        // thêm cho mỗi phát trúng đầu
  perWave: 10,           // mỗi đợt vượt qua (Đoàn kết)
  pvpWin: 60,            // thắng PvP
  pvpKill: 4,            // mỗi mạng PvP
  minSeconds: 45,        // ván ngắn hơn thế không được tính xu (chống bỏ phiếu đóng ván liên tục)
  matchCap: 220,         // trần xu cho một ván
  hourCap: 900,          // trần xu kiếm được mỗi giờ
  missionFirst: [40, 70, 110],   // thưởng lần đầu hoàn thành nhiệm vụ theo số sao (1, 2, 3 sao); chỉ trả phần chênh khi đạt thêm sao
  soloDayCap: 120,       // xu tối đa mỗi ngày từ chơi đơn (máy khách tự báo nên bị chặn chặt)
  soloPerWave: 6,
  start: 100,            // tặng khi lập tài khoản
});
export const missionCoins = (stars) => (stars >= 1 ? COIN.missionFirst[Math.min(3, stars) - 1] : 0);

export const validName = (s) => /^[A-Za-z0-9_]{3,16}$/.test(String(s));
export const validPassword = (s) => typeof s === "string" && s.length >= 6 && s.length <= 64;
