// Game: nối mọi mô-đun lại với nhau và chạy vòng lặp chính.
// Mỗi khung hình: đọc thao tác -> gửi vào phiên chơi -> nhận sự kiện -> vẽ lại theo trạng thái của phiên.
import { config } from "../config.js";
import { DesktopControls } from "../controls/desktop.js";
import { makeIntent } from "../controls/intent.js";
import { TouchPointerSource } from "../controls/pointers.js";
import { TouchControls } from "../controls/touch.js";
import { buildSolids } from "../core/ballistics.js";
import { buildLayout } from "../core/layout.js";
import { DEFAULT_MAP, MAP_INFO, zoneName } from "../core/map.js";
import { missionById } from "../core/missions.js";
import { Rng } from "../core/rng.js";
import * as storage from "../core/storage.js";
import { Hud } from "../ui/hud.js";
import { Menus } from "../ui/menus.js";
import { TouchOverlay } from "../ui/touchOverlay.js";
import { AvatarView, EnemyView, ObjectiveView, PICKUP_LOOK, PickupView, ShotView, SmokeView, ThrowableView } from "./actors.js";
import { Arsenal } from "./arsenal.js";
import { Effects, Sfx } from "./effects.js";
import { LIT } from "./meshes.js";
import { Player } from "./player.js";
import { NetSession } from "../net/session.js";
import { LocalSession } from "./session.js";
import { World } from "./world/index.js";

const T = window.THREE;
export const MENU = "menu", LOBBY = "lobby", PLAYING = "playing", PAUSED = "paused", GAME_OVER = "game_over";
const STREAKS = { 2: "HẠ GỤC KÉP", 3: "BA MẠNG LIÊN TIẾP", 4: "BỐN MẠNG", 5: "CUỒNG SÁT" };
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

export class Game {
  constructor() {
    this.container = document.getElementById("game");
    this.canvas = document.getElementById("view");
    this.fade = document.getElementById("fade");
    this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    this.maxRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.ratio = this.maxRatio;       // độ nét hiện tại; tự hạ khi máy yếu, tự tăng lại khi dư sức
    this.fps = { t: 0, n: 0 };
    this.renderer.setPixelRatio(this.ratio);
    if (LIT) {                                        // đồ hoạ cao: bóng đổ thật, mép bóng mềm
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    }
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(50, 16 / 9, 0.05, 700);
    this.scene.add(this.camera);

    this.rng = new Rng();
    this.clock = 0;
    this.save = storage.load();
    this.player = new Player(this.camera);
    this.sfx = new Sfx();
    this.sfx.setVolume(this.save.volume ?? config.VOLUME);
    this.mapId = null;
    this.missionId = null;            // nhiệm vụ đang chơi / vừa chơi (null nếu không phải chế độ nhiệm vụ)
    this.missionDef = null;
    this._buildWorld(MAP_INFO.some((m) => m.id === this.save.map) ? this.save.map : DEFAULT_MAP);
    this.arsenal = new Arsenal(this, this.camera);
    this.views = { enemies: new Map(), avatars: new Map(), shots: new Map(), pickups: new Map(), throwables: new Map(), smokes: new Map() };
    this.corpses = [];
    this.pendingSelect = null;
    this.session = null;
    this.phase = MENU;
    this.mode = this.save.mode || "solo";
    this.busy = false;                // đang chuyển cảnh
    this.matchT = 0;                  // giây kể từ đầu trận
    this.sameOrigin = document.body.dataset.phoenixServer === "1";   // máy chủ phòng tự đánh dấu vào trang nó phát -> không cần nhập địa chỉ

    const touchLayer = document.getElementById("touch");
    this.desktop = new DesktopControls(this.canvas);
    this.touch = new TouchControls(16 / 9, "dual");
    this.pointers = new TouchPointerSource(touchLayer);
    this.touchMode = this.save.touch ?? window.matchMedia("(pointer: coarse)").matches;
    this.setSensitivity(this.save.sensitivity ?? 1);
    addEventListener("pointerdown", (e) => {              // chạm tay vào màn hình -> tự chuyển sang cảm ứng
      if (e.pointerType === "touch" && !this.touchMode && this.save.touch === null) this.setTouchMode(true);
    }, true);

    this.hud = new Hud(this.layout);
    this.hud.onSelect = (i) => this.selectWeapon(i);
    this.overlay = new TouchOverlay(touchLayer);
    this.menus = new Menus(this);

    new ResizeObserver(() => this.resize()).observe(this.container);
    this.resize();
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.pause(); });
    this._showMenu();

    this.last = performance.now();
    const loop = (now) => { this.frame(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  get controls() { return this.touchMode ? this.touch : this.desktop; }

  // ================= bản đồ =================
  /** Dựng thế giới cho bản đồ `id`: bố cục + va chạm + hình ảnh + hiệu ứng. */
  _buildWorld(id) {
    if (this.world) this.world.dispose(this.scene);
    this.mapId = id;
    this.layout = buildLayout(null, id);
    this.solids = buildSolids(this.layout);
    this.world = new World(this.scene, this.layout);
    this.effects = new Effects(this.world.root, this.layout.col);
    this.effects.onCasing = () => this.sfx.play("tink", 0.9 + Math.random() * 0.4, 0.5);
    this.objective = new ObjectiveView(this.world.root);
    if (this.hud) this.hud.setLayout(this.layout);
  }

  /** Người chơi chọn bản đồ cho Sinh tồn / Đoàn kết / PvP ở menu: đổi ngay và nhớ lại. */
  chooseMap(id) {
    if (this.phase !== MENU) return;
    this.save.map = id;
    storage.save(this.save);
    this.setMap(id);
  }

  /** Đổi bản đồ (chỉ khi đang ở menu: các hình trong trận thuộc về thế giới cũ nên phải dọn trước). */
  setMap(id) {
    if (id === this.mapId || !MAP_INFO.some((m) => m.id === id)) return;
    this._clearViews();
    this._buildWorld(id);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.touch.setAspect(w / h);
    if (this.phase !== MENU) this.player.applyCamera();
  }

  // ================= chuyển cảnh =================
  /** Kéo một tấm màn chéo qua màn hình, đổi cảnh lúc màn che kín, rồi kéo màn đi. */
  async transition(change) {
    if (this.busy) return;
    this.busy = true;
    this.sfx.unlock();
    this.sfx.play("deploy");
    this.fade.className = "fade cover";
    await wait(380);
    try { change(); } finally {
      this.fade.className = "fade leave";
      await wait(420);
      this.fade.className = "fade";
      this.busy = false;
    }
  }

  toMenu() { return this.transition(() => this._showMenu()); }
  play(mode = this.mode, missionId = null) {
    this.mode = mode;
    this.missionId = mode === "mission" ? missionId : null;
    if (!this.touchMode) this.desktop.capture();          // xin khoá chuột ngay trong lúc bấm nút
    return this.transition(() => this._start(mode, this.missionId));
  }

  // ================= phòng riêng qua mạng =================
  get serverBase() { return this.sameOrigin ? location.origin : (this.save.server || "").trim(); }

  /** Tạo phòng mới (mode) hoặc vào phòng có sẵn (code). */
  async enterRoom({ mode, code, name }) {
    if (this.busy) return;
    this.sfx.unlock();
    this.save.name = name;
    storage.save(this.save);
    if (!this.serverBase) { this.menus.showRoom("Hãy nhập địa chỉ máy chủ phòng trước."); return; }
    this.busy = true;
    this.menus.showRoom("", "Đang kết nối… (máy chủ miễn phí đang ngủ thì mất chừng một phút để thức dậy)");
    try {
      const session = await NetSession.connect(this.serverBase, mode ? { t: "create", mode, name } : { t: "join", code, name });
      if (this.session) this.session.close();
      this.session = session;
      this.missionDef = null;
      this.setMap(MAP_INFO.some((m) => m.id === session.map) ? session.map : DEFAULT_MAP);   // máy chủ chạy bản đồ nào thì máy mình dựng bản đó
      this._toLobby();
    } catch (error) {
      const blocked = !this.sameOrigin && /kết nối/.test(error.message);
      this.menus.showRoom(error.message + (blocked ? " Kiểm tra lại địa chỉ. Nếu đang mở game trên trang xuất bản của Claude thì trang đó chặn kết nối ra ngoài: hãy mở game tại địa chỉ máy chủ phòng." : ""));
    } finally { this.busy = false; }
  }

  _toLobby() {
    this._clearViews();
    this.phase = LOBBY;
    this.hud.show(false);
    this.overlay.show(false);
    this.arsenal.view.visible = false;
    this.desktop.active = false;
    this.desktop.release();
    this.container.classList.remove("playing");
    this.menus.showLobby();
  }

  leaveRoom() { return this.transition(() => this._showMenu()); }

  _showMenu(note = "") {
    this._clearViews();
    if (this.session) this.session.close();
    this.session = null;
    this.phase = MENU;
    this.menuT = Math.random() * 60;
    this.hud.show(false);
    this.overlay.show(false);
    this.arsenal.view.visible = false;
    this.desktop.active = false;
    this.desktop.release();
    this.container.classList.remove("playing");
    this.menus.showMain(note);
  }

  _start(mode, missionId = null) {
    this.save.mode = mode;
    storage.save(this.save);
    if (this.session) this.session.close();
    const def = mode === "mission" ? missionById(missionId) : null;
    this.missionDef = def;
    if (def) this.setMap(def.map);                        // nhiệm vụ dùng bản đồ riêng; các chế độ khác chơi trên bản đồ đang chọn ở menu
    this.session = new LocalSession(mode, "Bạn", this.layout, { mission: def });
    this.session.start();
    this._begin();
  }

  /** Vào trận với phiên chơi hiện có (trong máy hoặc qua mạng). */
  _begin() {
    const mode = this.session.mode;
    this._clearViews();
    this.matchT = 0;
    this.player.reset(this.layout.spawn[0], this.layout.spawn[1]);
    this.arsenal.reset();
    this.hud.reset();
    this.menus.hide();
    this.phase = PLAYING;
    this.container.classList.add("playing");
    this._enterPlay();
    const intro = { solo: ["SINH TỒN", "Địch đang kéo tới. Trụ được càng lâu càng tốt."],
      coop: ["ĐOÀN KẾT", "Giữ nhau sống sót qua từng đợt."], pvp: ["PvP", `Hạ ${config.PVP_KILLS} mạng trước để thắng.`],
      mission: [this.missionDef ? this.missionDef.title.toUpperCase() : "NHIỆM VỤ", this.missionDef ? this.missionDef.brief : ""] }[mode];
    this.hud.announce(intro[0], intro[1], mode === "mission" ? 5 : 3);
  }

  pause() {
    if (this.phase !== PLAYING) return;
    this.phase = PAUSED;
    this.overlay.show(false);
    this.desktop.active = false;
    this.desktop.release();
    this.menus.showPause();
  }

  resume() {
    if (this.phase !== PAUSED) return;
    this.phase = PLAYING;
    this.menus.hide();
    this._enterPlay();
  }

  gameOver(result) {
    this.container.classList.remove("playing");
    if (result.mission && result.mission.victory) {         // ghi sao và thời gian tốt nhất
      const m = result.mission, prev = (this.save.missions || {})[m.id] || { stars: 0, time: Infinity };
      this.save.missions = { ...this.save.missions, [m.id]: { stars: Math.max(prev.stars, m.stars), time: Math.min(prev.time, m.time) } };
      storage.save(this.save);
    }
    const newBest = result.mode === "solo" && result.teamScore > this.save.best;
    if (newBest) {
      this.save.best = result.teamScore;
      this.save.bestWave = Math.max(result.wave, 1);
      storage.save(this.save);
    }
    this.phase = GAME_OVER;
    this.overlay.show(false);
    this.hud.show(false);
    this.arsenal.view.visible = false;
    this.desktop.active = false;
    this.desktop.release();
    this.menus.showOver(result, newBest);
  }

  toggleControls() {
    this.setTouchMode(!this.touchMode);
    this.save.touch = this.touchMode;                     // người chơi đã tự chọn: nhớ lại, không tự đổi nữa
    storage.save(this.save);
  }
  setTouchMode(on) {
    this.touchMode = on;
    this.menus.refreshMode();
    if (this.phase === PLAYING) this._enterPlay();
  }
  setSensitivity(value) {
    this.save.sensitivity = value;
    this.desktop.sensitivity = config.MOUSE_DEG_PER_PX * value;
    this.touch.sensitivity = value;
  }
  setVolume(value) { this.save.volume = value; this.sfx.setVolume(value); }
  saveSettings() { storage.save(this.save); }

  _enterPlay() {
    this.desktop.reset();
    this.touch.releaseAll();
    this.pointers.clear();
    this.hud.show(true);
    this.hud.setTouch(this.touchMode);
    this.arsenal.view.visible = true;
    this.overlay.show(this.touchMode);
    this.container.classList.toggle("touching", this.touchMode);
    this.desktop.active = !this.touchMode;
    if (!this.touchMode) this.desktop.capture();
  }

  _clearViews() {
    for (const group of Object.values(this.views)) {
      for (const view of group.values()) view.vanish();
      group.clear();
    }
    this.corpses.forEach((c) => c.vanish());
    this.corpses = [];
    this.effects.clear();
    if (this.objective) this.objective.hide();
  }

  // ================= vòng lặp =================
  frame(now) {
    const real = (now - this.last) / 1000, dt = Math.min(real, config.MAX_DT);
    this.last = now;
    this._adapt(real);
    if (this.phase === PLAYING) {
      const intent = this.touchMode ? this.touch.poll(dt, this.pointers.poll()) : this.desktop.poll();
      if (intent.pause) this.pause(); else this.step(intent, dt);
    } else if (this.phase === MENU) {
      this._menuCamera(dt);
    } else if (this.session && this.session.online && !this.busy) {
      const s = this.session;
      if (s.lost) { this._showMenu(); this.menus.showRoom("Mất kết nối với phòng."); }
      else if (this.phase === LOBBY) {                    // phòng chờ: đợi chủ phòng bấm bắt đầu
        this._menuCamera(dt);
        this.menus.refreshLobby();
        const events = s.update(dt);
        if (s.started) this.transition(() => { this.menus.hide(); this.phase = PLAYING; this._begin(); this._handle(events); });
      } else if (this.phase === PAUSED) this.step(makeIntent(), dt);   // mở menu giữa trận: trận vẫn chạy
      else if (this.phase === GAME_OVER) this._handle(s.update(dt));   // chờ chủ phòng mở ván mới
    }
    this.world.follow(this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  /** Giữ game mượt: đo tốc độ khung hình, dưới 30 thì giảm độ nét, trên 55 thì tăng lại. */
  _adapt(real) {
    const f = this.fps;
    f.t += real; f.n += 1;
    if (f.t < 1.5 || document.hidden) { if (document.hidden) { f.t = 0; f.n = 0; } return; }
    const rate = f.n / f.t;
    f.t = 0; f.n = 0;
    const next = rate < 30 ? Math.max(0.5, this.ratio * 0.82) : rate > 55 ? Math.min(this.maxRatio, this.ratio * 1.12) : this.ratio;
    if (Math.abs(next - this.ratio) < 0.01) return;
    this.ratio = next;
    this.renderer.setPixelRatio(next);
    this.resize();
  }

  /** Menu: máy quay lượn chậm quanh khu công nghiệp, ống kính tele cho ra chất điện ảnh. */
  _menuCamera(dt) {
    this.menuT += dt;
    const a = this.menuT * 0.035, cam = this.camera;
    const r = 40 + Math.sin(this.menuT * 0.05) * 7, h = 8 + Math.sin(this.menuT * 0.08) * 4;
    cam.position.set(4 + Math.cos(a) * r, h, -(6 + Math.sin(a) * r));
    cam.lookAt(...(this.layout.menuLook || [0, 3, 0]));
    if (Math.abs(cam.fov - 34) > 0.01) { cam.fov = 34; cam.updateProjectionMatrix(); }
  }

  /** Một bước của trận. Tách riêng để kiểm thử tự động gọi được. */
  step(intent, dt) {
    const s = this.session, player = this.player;
    this.clock += dt;
    this.matchT += dt;
    if (s.lost) { this._showMenu(); this.menus.showRoom("Mất kết nối với phòng."); return; }
    const me = s.players.get(s.me), alive = me ? me.alive : true;
    if (this.pendingSelect !== null) { intent.select = this.pendingSelect; this.pendingSelect = null; }   // bấm vào thanh vũ khí
    if (!alive) intent = makeIntent({ lookYaw: intent.lookYaw, lookPitch: intent.lookPitch });   // đã gục: chỉ được ngó quanh
    else if (intent.aimAssist) player.aimAssist(this.targets().map((t) => [t.x, t.y + t.shape.h * 0.8, t.z]), dt);
    player.update(intent, dt, this.layout.col, alive ? this.arsenal.zoom : 1);
    if (player.stepped) this.sfx.play("step", 0.85 + Math.random() * 0.3, player.sprinting ? 0.5 : 0.3);
    if (player.land > 0.5 && !this.landed) this.sfx.play("land", 1, player.land);
    this.landed = player.land > 0.5;
    this.arsenal.view.visible = alive;
    if (alive) this.arsenal.update(intent, dt, player);
    s.sendPose(player.x, player.y, player.z, player.yaw, player.pitch);

    this._handle(s.update(dt));
    if (this.phase !== PLAYING && this.phase !== PAUSED) return;      // vừa bị đưa về phòng chờ
    this._sync(s.enemies, this.views.enemies, EnemyView, dt);
    const others = new Map([...s.players].filter(([id]) => id !== s.me));
    this._sync(others, this.views.avatars, AvatarView, dt);
    this._sync(s.shots, this.views.shots, ShotView, dt);
    this._sync(s.pickups, this.views.pickups, PickupView, dt);
    this._sync(s.throwables, this.views.throwables, ThrowableView, dt);
    this._sync(s.smokes, this.views.smokes, SmokeView, dt);
    this.corpses = this.corpses.filter((c) => c.tickDead(dt) || (c.vanish(), false));
    this.effects.tick(dt);
    this.hud.sync(this, dt, zoneName(this.layout, player.x, player.z));
    this.objective.sync(s.info.mission ? s.info.mission.marker : null, dt, player);
    if (this.touchMode) this.overlay.sync(this.touch, { grenade: me ? me.grenades : 0, smoke: me ? me.smokes : 0 });
    if (s.over && this.phase !== GAME_OVER) this.gameOver(s.over);
  }

  _sync(objects, views, View, dt) {
    for (const id of [...views.keys()]) {
      if (!objects.has(id)) { views.get(id).vanish(); views.delete(id); }
    }
    for (const [id, obj] of objects) {
      let view = views.get(id);
      if (!view) { view = new View(this.world.root, obj); views.set(id, view); }
      view.sync(obj, dt);
    }
  }

  // ================= bắn =================
  /** Những thứ bắn trúng được, ở đúng vị trí người chơi đang nhìn thấy. */
  targets() {
    const list = [];
    for (const v of this.views.enemies.values()) list.push({ id: v.id, kind: "enemy", x: v.x, y: v.y, z: v.z, shape: v.shape, view: v });
    if (this.session && this.session.mode === "pvp") {
      for (const v of this.views.avatars.values()) if (v.alive) list.push({ id: v.id, kind: "player", x: v.x, y: v.y, z: v.z, shape: v.shape, view: v });
    }
    return list;
  }

  /** Vũ khí của mình vừa trúng `target`. Báo cho phiên chơi; máu do bên giữ luật quyết định. */
  damageTarget(target, amount, headshot, point, cause = "gun") {
    this.effects.burst(point, target.view.tint.getHex(), 5, 3.5, 0.09, 0.35);
    this.hud.hitMarker({ headshot });
    this.sfx.play(headshot ? "head" : "hit", 1, 0.9);
    if (target.kind === "enemy") this.session.hitEnemy(target.id, amount, headshot, cause);
    else { target.view.lastFrom = [this.player.x, this.player.z]; this.session.hitPlayer(target.id, amount, headshot); }
  }
  reportShot(muzzle, ends) { this.session.shot(muzzle, ends, this.arsenal.weapon.spec.sound); }
  selectWeapon(index) { this.pendingSelect = index; }

  /** Âm lượng theo khoảng cách tới người chơi. */
  _near(x, z, reach = 60) { return Math.max(0, 1 - Math.hypot(x - this.player.x, z - this.player.z) / reach); }
  _name(id) { return id === this.session.me ? "Bạn" : this.session.names.get(id) || "Ai đó"; }

  // ================= sự kiện từ phiên chơi =================
  _handle(events) {
    const s = this.session, hud = this.hud, me = s.me;
    for (const e of events) {
      switch (e.t) {
        case "spawn":
          if (e.p === me) {
            Object.assign(this.player, { x: e.x, z: e.z, y: e.y || 0, vy: 0, grounded: !e.y });
            this.player.yaw = (Math.atan2(-e.x, -e.z) * 180) / Math.PI;            // quay mặt vào giữa bản đồ
            if (s.mode === "pvp" && this.matchT > 1) { this.arsenal.reset(); hud.announce("HỒI SINH", "Quay lại trận đấu", 1.6); }
            if (e.revived) hud.announce("HỒI SINH", "Đồng đội đã kéo bạn dậy", 2);
          } else if (e.revived) hud.feed(`${this._name(e.p)} đã hồi sinh`);
          break;
        case "wave_start":
          if (this.missionDef) break;                          // nhiệm vụ đã có dòng mục tiêu riêng, khỏi báo đợt
          hud.announce(`ĐỢT ${e.n}`, `${e.count} kẻ địch đang tới`);
          this.sfx.play("wave");
          break;
        case "mission_stage":
          if (e.i === 0 && this.matchT < 1) break;             // chặng đầu đã nằm trong lời giới thiệu nhiệm vụ
          hud.announce(e.n > 1 ? `CHẶNG ${e.i + 1}/${e.n}` : "NHIỆM VỤ", e.text, 3);
          this.sfx.play("clear");
          break;
        case "mission_boss":
          hud.announce("ĐỒ TỂ XUẤT HIỆN", `${e.n} kẻ địch hạng nặng đang kéo tới`, 3.2);
          this.sfx.play("wave");
          break;
        case "wave_clear":
          hud.announce("DỌN SẠCH", `+${e.bonus} điểm thưởng · hồi 15 máu`);
          this.sfx.play("clear");
          break;
        case "enemy_hit": {
          const view = this.views.enemies.get(e.id);
          if (view) view.hit(e.head);
          break;
        }
        case "enemy_fire":
          { const v = this.views.enemies.get(e.id); if (v) this.sfx.play("enemy", 1, this._near(v.x, v.z, 50) * 0.7); }
          break;
        case "enemy_kill": {
          const view = this.views.enemies.get(e.id);
          if (view) {                                         // không biến mất ngay: ngã xuống rồi mới tan
            this.views.enemies.delete(e.id);
            view.die(e.fx, e.fz);
            this.corpses.push(view);
            this.effects.burst([e.x, e.y + view.shape.h * 0.6, e.z], view.tint.getHex(), 10, 5, 0.16, 0.6);
          }
          hud.kill(this._name(e.by), view ? view.spec.name : "Địch", { head: e.head, cause: e.cause, mine: e.by === me, gained: e.gained });
          if (e.by === me) {
            hud.hitMarker({ kill: true });
            hud.callout(e.head ? "TRÚNG ĐẦU" : STREAKS[Math.min(5, e.combo)] || "", `+${e.gained}`);
            this.sfx.play("kill");
          }
          break;
        }
        case "hurt":
          if (e.p === me) {
            hud.flashDamage(0.35 + e.amount / 60);
            hud.damageFrom((Math.atan2(e.x - this.player.x, e.z - this.player.z) * 180) / Math.PI - this.player.yaw);
            this.player.shake = Math.min(1, this.player.shake + e.amount / 25);
            this.sfx.play("hurt");
          } else { const v = this.views.avatars.get(e.p); if (v) v.lastFrom = [e.x, e.z]; }
          break;
        case "player_kill":
          hud.kill(this._name(e.by), this._name(e.victim), { head: e.head, mine: e.by === me, lost: e.victim === me });
          if (e.by === me) { hud.hitMarker({ kill: true }); hud.callout(e.head ? "TRÚNG ĐẦU" : "HẠ GỤC", this._name(e.victim).toUpperCase()); this.sfx.play("kill"); }
          if (e.victim === me) hud.announce("BẠN BỊ HẠ", `${this._name(e.by)} đã hạ bạn · sắp hồi sinh`, config.PVP_RESPAWN);
          break;
        case "player_down":
          if (e.p === me) hud.announce("BẠN ĐÃ GỤC", "Đồng đội dọn xong đợt này bạn sẽ hồi sinh", 4);
          else hud.feed(`${this._name(e.p)} đã gục`);
          break;
        case "pickup":
          if (e.p === me) {
            if (e.kind === "ammo") this.arsenal.addAmmo();
            hud.toast(PICKUP_LOOK[e.kind][1]);
            this.sfx.play("pickup");
          }
          break;
        case "shot": {                                        // súng của người chơi khác
          const view = this.views.avatars.get(e.p);
          if (view) view.fire = 1;
          const ends = Array.isArray(e.to[0]) ? e.to : [e.to];
          for (const end of ends) this.effects.tracer(e.from, end, this.player.eye, 0xffd9a0, 0.03);
          this.sfx.play(e.w || "rifle", e.w ? 1 : 1.12, this._near(e.from[0], e.from[2]) * 0.6);
          if (e.hit === false) this.effects.impact(ends[0]);
          break;
        }
        case "explode": {
          this.effects.explosion([e.x, e.y + 0.3, e.z], config.GRENADE_RADIUS * 0.75);
          this.player.shake = Math.min(1, this.player.shake + this._near(e.x, e.z, 25));
          this.sfx.play("boom", 0.9 + Math.random() * 0.2, 0.3 + this._near(e.x, e.z) * 0.7);
          break;
        }
        case "smoke":
          this.sfx.play("hiss", 1, this._near(e.x, e.z));
          break;
        case "reset":                                          // chủ phòng mở ván mới
          this._toLobby();
          return;
        case "deflect":
          if (e.p === me) {
            this.effects.burst([e.x, e.y, e.z], 0xffe08a, 6, 4, 0.08, 0.3);
            hud.callout("CHẢO ĐỠ ĐẠN", "");
            this.sfx.play("pan", 1.25);
          }
          break;
        default:
      }
    }
  }
}
