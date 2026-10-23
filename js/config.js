// Mọi thông số cân bằng game - giữ nguyên giá trị của bản Python (phoenix/config.py).
export const config = {
  ARENA_RADIUS: 52.0,
  COMBO_MAX: 8,
  COMBO_WINDOW: 3.0,
  COOP_EXTRA: 0.5,
  COOP_REVIVE_HP: 50,
  CRATE_COUNT: 14,
  EYE_HEIGHT: 1.7,
  FOG_RANGE: [45, 120],
  FOV: 80,
  GRAVITY: 20.0,
  HEADSHOT_BONUS: 50,
  HEADSHOT_MULT: 2.0,
  HEALTH_PACK: 30,
  JUMP_SPEED: 7.0,
  MAX_ALIVE: 12,
  MAX_DT: 0.05,
  MAX_PLAYERS: 6,
  MOUSE_SENSITIVITY: 40.0,
  NET_PORT: 5055,
  PICKUP_CHANCE: 0.3,
  PICKUP_LIFETIME: 20.0,
  PICKUP_RADIUS: 1.6,
  PITCH_LIMIT: 75.0,
  PLAYER_HP: 100,
  PLAYER_RADIUS: 0.45,
  POSE_RATE: 20,
  PVP_KILLS: 10,
  PVP_PICKUP_EVERY: 7.0,
  PVP_RESPAWN: 3.0,
  PVP_SHIELD: 1.5,
  PVP_TIME: 300.0,
  ROCK_COUNT: 22,
  SHELL_PACK: 6,
  SHOW_FPS: true,
  SKY_COLOR: "#8ec9f0",
  SNAPSHOT_RATE: 15,
  SOUND: true,
  SPAWN_INTERVAL: 0.7,
  SPAWN_MIN_DIST: 20.0,
  SPRINT_FOV: 88,
  SPRINT_SPEED: 10.0,
  SUN_DIR: [0.45, 0.8, -0.4],
  TITLE: "Project Phoenix",
  TOUCH_AIM_ASSIST: 4.0,
  TOUCH_AUTO_FIRE: true,
  TOUCH_SENSITIVITY: 220.0,
  TOUCH_STICK_RADIUS: 0.11,
  TOUCH_TURN_SPEED: 130.0,
  TREE_COUNT: 34,
  VOLUME: 0.5,
  WALK_SPEED: 6.0,
  WAVE_REST: 4.0,
  WORLD_SEED: 2026,
  // riêng bản web
  MOUSE_DEG_PER_PX: 0.12,
  FOV_H: 80,            // góc nhìn ngang (độ), giống bản Python
  SPRINT_FOV_H: 88,
  // ánh sáng "giờ vàng": nắng thấp và ấm, bóng râm ngả lạnh, bóng đổ dài
  SUN: [0.60, 0.62, -0.50],
  SUN_WARM: [0.78, 0.64, 0.44],     // màu cộng thêm ở mặt hướng nắng
  SHADE_COOL: [0.40, 0.45, 0.58],   // màu nền ở mặt khuất nắng
  SKY_TOP: "#3f7fc4", SKY_MID: "#9ccbe8", SKY_HORIZON: "#f2cfa6",
  FOG: ["#e6d2b8", 75, 240],
  // vật ném (mới ở bản web)
  START_GRENADES: 2,
  START_SMOKES: 1,
  MAX_GRENADES: 4,
  MAX_SMOKES: 3,
  THROW_SPEED: 17,          // m/s
  GRENADE_FUSE: 2.2,        // giây từ lúc ném tới lúc nổ
  GRENADE_RADIUS: 6.5,      // bán kính sát thương
  GRENADE_DAMAGE: 220,      // sát thương ở tâm vụ nổ lên địch, giảm dần ra mép
  GRENADE_PLAYER_DAMAGE: 90,  // lên người chơi (kể cả tự ném trúng mình)
  SMOKE_FUSE: 1.2,
  SMOKE_RADIUS: 6.0,
  SMOKE_TIME: 12.0,         // khói tồn tại bao lâu
  // phòng riêng qua mạng
  NET_TICK: 30,             // số bước mô phỏng mỗi giây trên máy chủ phòng
  NET_SNAPSHOT: 15,         // số lần/giây máy chủ gửi trạng thái
  NET_POSE: 20,             // số lần/giây mỗi máy gửi vị trí của mình
  // chế độ đấu với máy (bot)
  BOTS_COOP: 2,             // số đồng đội máy trong Đoàn kết
  BOTS_PVP: 3,              // số đối thủ máy trong PvP
  BOT_NAMES: ["Sói Xám", "Đại Bàng", "Hổ Vằn", "Rắn Lục", "Cú Đêm"],
  BOT_SPEED: 5.2,
  BOT_DAMAGE_PVP: 11,        // mỗi viên trúng người chơi
  BOT_DAMAGE_COOP: 17,      // mỗi viên trúng địch
  BOT_AIM: 0.6,             // độ chính xác tối đa ở cự ly gần (0..1)
};
