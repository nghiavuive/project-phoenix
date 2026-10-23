// Menu: màn hình chính (chọn chế độ, vào trận), phòng riêng, cài đặt, tạm dừng, kết thúc.
import { config } from "../config.js";
import { MAP_INFO } from "../core/map.js";
import { MISSIONS, isUnlocked, nextMission } from "../core/missions.js";
import { MODE_NAMES } from "../core/sim.js";
import { QUALITY } from "../game/meshes.js";

const $ = (id) => document.getElementById(id);
const dots = (n) => Math.round(n).toLocaleString("vi-VN");

const HELP_DESKTOP = "W A S D di chuyển · Chuột nhìn · Chuột trái bắn · Chuột phải ngắm · Shift chạy · Space nhảy · R nạp đạn · 1–8, Q hoặc lăn chuột đổi vũ khí · G lựu đạn · F bom khói · Esc tạm dừng";
const HELP_TOUCH = "Ngón trái: cần ảo di chuyển, đẩy hết cỡ để chạy · Ngón phải: vuốt để nhìn, giữ BẮN để bắn, NGẮM để bật ngắm · Chạm thanh vũ khí để đổi · Súng tự bắn khi tâm ngắm trúng địch";
const MODES = {
  solo: ["Một mình chống các đợt địch ngày càng đông.", "1 người · tính kỷ lục"],
  coop: [`Cùng ${config.BOTS_COOP} đồng đội máy giữ trận địa. Ai gục sẽ hồi sinh khi dọn xong đợt.`, `${config.BOTS_COOP + 1} người · địch đông hơn`],
  pvp: [`Đấu tự do với ${config.BOTS_PVP} đối thủ máy. Ai hạ ${config.PVP_KILLS} mạng trước thì thắng.`, `${config.BOTS_PVP + 1} người · ${config.PVP_TIME / 60} phút`],
  mission: ["Có mục tiêu rõ ràng: thu thập dữ liệu, giữ chốt, hạ trùm, rút lui. Mỗi bản đồ có nhiệm vụ riêng; nhanh và ít bị thương thì được thêm sao.", `1 người · ${MISSIONS.length} nhiệm vụ · tối đa 3 sao`],
};
const GRAPHICS = { null: "Tự động", cao: "Cao", thap: "Thấp" };
const stars = (n) => `${"★".repeat(n)}<span class="off">${"★".repeat(3 - n)}</span>`;

export class Menus {
  constructor(game) {
    this.game = game;
    this.root = $("menu");
    this.pages = Object.fromEntries(["main", "missions", "room", "lobby", "settings", "pause", "over"].map((k) => [k, $(`page-${k}`)]));
    const click = (id, fn) => $(id).addEventListener("click", () => { game.sfx.unlock(); game.sfx.play("ui"); fn(); });

    this.cards = [...document.querySelectorAll(".mode")];
    for (const card of this.cards) card.addEventListener("click", () => { game.sfx.unlock(); game.sfx.play("ui"); this.pick(card.dataset.mode); });
    click("btn-play", () => (game.mode === "mission" ? this.showMissions() : game.play(game.mode)));
    click("btn-missions-back", () => this.showMain());
    click("btn-next", () => { const next = nextMission(game.missionId); if (next) game.play("mission", next.id); });
    this._buildMaps();
    click("btn-room", () => this.showRoom());
    const ask = (extra) => {                                  // gom tên + địa chỉ máy chủ rồi nhờ game kết nối
      game.save.server = $("room-server").value.trim();
      game.enterRoom({ name: $("room-name").value.trim() || "Người chơi", ...extra });
    };
    click("btn-host-coop", () => ask({ mode: "coop", map: game.mapId }));       // người tạo phòng chọn bản đồ ở màn hình chính
    click("btn-host-pvp", () => ask({ mode: "pvp", map: game.mapId }));
    click("btn-join", () => ask({ code: $("room-code").value.trim() }));
    $("room-code").addEventListener("keydown", (e) => { if (e.key === "Enter") $("btn-join").click(); });
    click("btn-lobby-start", () => game.session && game.session.start());
    click("btn-lobby-leave", () => game.leaveRoom());
    $("room-name").value = game.save.name || "";
    $("room-server").value = game.save.server || "";
    click("btn-settings", () => this._only("settings"));
    click("btn-room-back", () => this.showMain());
    click("btn-settings-back", () => { game.saveSettings(); this.back === "pause" ? this.showPause() : this.showMain(); });
    click("btn-controls", () => game.toggleControls());
    click("btn-resume", () => game.resume());
    click("btn-retry", () => game.play(game.session.mode, game.missionId));
    click("btn-pause-settings", () => { this.back = "pause"; this._only("settings"); });
    click("btn-quit", () => game.toMenu());
    click("btn-again", () => (game.session.online ? game.session.reset() : game.play(game.session.mode, game.missionId)));
    click("btn-graphics", () => {                              // Tự động -> Cao -> Thấp: mức đồ hoạ cố định lúc tải trang nên tải lại để áp dụng
      const order = [null, "cao", "thap"], now = order.indexOf(game.save.graphics ?? null);
      game.save.graphics = order[(now + 1) % order.length];
      game.saveSettings();
      $("btn-graphics").textContent = "Đang áp dụng…";
      setTimeout(() => location.reload(), 250);
    });
    click("btn-home", () => game.toMenu());

    const sens = $("set-sens"), vol = $("set-vol");
    sens.value = game.save.sensitivity ?? 1;
    vol.value = game.save.volume ?? config.VOLUME;
    const show = () => { $("set-sens-val").textContent = `${Math.round(sens.value * 100)}%`; $("set-vol-val").textContent = `${Math.round(vol.value * 100)}%`; };
    sens.addEventListener("input", () => { game.setSensitivity(Number(sens.value)); show(); });
    vol.addEventListener("input", () => { game.setVolume(Number(vol.value)); show(); });
    vol.addEventListener("change", () => { game.sfx.unlock(); game.sfx.play("rifle"); });
    show();

    const full = $("btn-full");
    full.hidden = !(document.fullscreenEnabled && document.documentElement.requestFullscreen);
    full.addEventListener("click", () => {
      const done = document.fullscreenElement ? document.exitFullscreen() : $("game").requestFullscreen();
      if (done && done.catch) done.catch(() => { full.hidden = true; });     // nơi không cho toàn màn hình: ẩn nút
    });
    this.pick(game.mode);
  }

  _only(name) {
    this.root.hidden = false;
    this.root.dataset.page = name;
    for (const [key, page] of Object.entries(this.pages)) page.hidden = key !== name;
  }
  hide() { this.root.hidden = true; }

  pick(mode) {
    this.game.mode = mode;
    for (const card of this.cards) card.setAttribute("aria-pressed", String(card.dataset.mode === mode));
    $("mode-desc").textContent = MODES[mode][0];
    $("mode-meta").textContent = MODES[mode][1];
    $("maps").hidden = mode === "mission";                       // nhiệm vụ có bản đồ riêng của nó
    $("btn-play").textContent = mode === "mission" ? "Chọn nhiệm vụ" : `Vào trận · ${mode === "solo" ? "Sinh tồn" : MODE_NAMES[mode]}`;
  }

  // ---------- chọn bản đồ ----------
  _buildMaps() {
    const box = $("maps");
    box.textContent = "";
    for (const info of MAP_INFO) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "map-card";
      b.dataset.map = info.id;
      b.innerHTML = "<strong></strong><small></small>";
      b.firstChild.textContent = info.name;
      b.lastChild.textContent = info.blurb;
      b.addEventListener("click", () => { this.game.sfx.unlock(); this.game.sfx.play("ui"); this.game.chooseMap(info.id); this.refreshMaps(); });
      box.appendChild(b);
    }
    this.refreshMaps();
  }
  refreshMaps() {
    for (const b of $("maps").children) b.setAttribute("aria-pressed", String(b.dataset.map === this.game.mapId));
  }

  // ---------- danh sách nhiệm vụ ----------
  showMissions() {
    this._only("missions");
    const box = $("mission-list"), progress = this.game.save.missions || {};
    box.textContent = "";
    let lastMap = null;
    for (const m of MISSIONS) {
      if (m.map !== lastMap) {
        lastMap = m.map;
        const h = document.createElement("h3");
        h.textContent = MAP_INFO.find((i) => i.id === m.map).name;
        box.appendChild(h);
      }
      const open = isUnlocked(m.id, progress), got = progress[m.id] ? progress[m.id].stars : 0;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mission";
      b.disabled = !open;
      b.innerHTML = "<strong></strong><small></small><span class=\"stars\"></span>";
      b.children[0].textContent = m.title;
      b.children[1].textContent = open ? m.brief : "Hoàn thành nhiệm vụ trước đó để mở";
      b.children[2].innerHTML = open ? stars(got) : "🔒";
      b.addEventListener("click", () => { this.game.sfx.unlock(); this.game.sfx.play("ui"); this.game.play("mission", m.id); });
      box.appendChild(b);
    }
  }

  refreshMode() {
    const touch = this.game.touchMode;
    $("btn-controls").textContent = touch ? "Cảm ứng" : "Phím + chuột";
    $("help").textContent = touch ? HELP_TOUCH : HELP_DESKTOP;
    const chosen = this.game.save.graphics ?? null;
    $("btn-graphics").textContent = chosen === null ? `Tự động (${GRAPHICS[QUALITY]})` : GRAPHICS[chosen];
    $("graphics-help").textContent = QUALITY === "cao"
      ? "Cao: bóng đổ thật, vân bề mặt, cỏ và mây. Cần máy có card đồ hoạ vừa phải. Đổi mức sẽ tải lại trang."
      : "Thấp: bóng vẽ sẵn, nhẹ cho điện thoại và máy yếu. Đổi mức sẽ tải lại trang.";
  }

  showMain(note = "") {
    this.back = "main";
    this._only("main");
    const { best, bestWave } = this.game.save;
    $("best").textContent = best ? `Kỷ lục sinh tồn: ${dots(best)} điểm · đợt ${bestWave}` : "Chưa có kỷ lục sinh tồn";
    $("note").textContent = note;
    this.refreshMode();
    this.refreshMaps();
  }

  // ---------- phòng riêng ----------
  /** note: lời báo lỗi (đỏ); busy: đang chờ kết nối. */
  showRoom(note = "", busy = "") {
    this._only("room");
    $("room-note").textContent = note;
    $("room-busy").textContent = busy;
    for (const id of ["btn-host-coop", "btn-host-pvp", "btn-join"]) $(id).disabled = Boolean(busy);
    this.refreshRoom();
  }
  /** Trang đang chạy trên chính máy chủ phòng thì khỏi phải nhập địa chỉ. */
  refreshRoom() {
    $("room-server-row").hidden = this.game.sameOrigin;
    $("room-where").textContent = this.game.sameOrigin ? "Máy chủ phòng: chính trang này. Tạo phòng rồi đọc mã cho bạn bè, họ mở cùng địa chỉ trang và nhập mã."
      : "Trang này không tự có máy chủ phòng. Nhập địa chỉ máy chủ phòng của nhóm, hoặc mở game ngay tại địa chỉ đó để khỏi phải nhập.";
  }

  showLobby() {
    this._only("lobby");
    this._lobby = "";
    this.refreshLobby();
  }
  refreshLobby() {
    const s = this.game.session, key = JSON.stringify([s.roster, s.owner]);
    if (key === this._lobby) return;
    this._lobby = key;
    $("lobby-mode").textContent = `PHÒNG ${MODE_NAMES[s.mode].toUpperCase()}`;
    $("lobby-code").textContent = s.code;
    $("lobby-rule").textContent = s.mode === "coop" ? "Cùng nhau chống các đợt địch. Ai gục sẽ hồi sinh khi cả đội dọn xong đợt."
      : `Mỗi người một phe. Ai hạ ${config.PVP_KILLS} mạng trước, hoặc dẫn đầu khi hết giờ, là thắng.`;
    const list = $("lobby-list");
    list.textContent = "";
    s.roster.forEach(([id, name], i) => {
      const row = document.createElement("li");
      if (id === s.me) row.className = "me";
      for (const text of [String(i + 1), name + (id === s.me ? " (bạn)" : ""), id === s.owner ? "chủ phòng" : "", ""]) {
        const span = document.createElement("span"); span.textContent = text; row.appendChild(span);
      }
      list.appendChild(row);
    });
    $("btn-lobby-start").hidden = !s.isOwner;
    $("lobby-wait").hidden = s.isOwner;
    $("btn-lobby-start").textContent = s.roster.length > 1 ? `Bắt đầu · ${s.roster.length} người` : "Bắt đầu một mình";
  }

  showPause() {
    this._only("pause");
    const s = this.game.session;
    $("pause-mode").textContent = (s.online ? "PHÒNG " : "") + MODE_NAMES[s.mode].toUpperCase() + (s.online ? " · TRẬN VẪN ĐANG DIỄN RA" : "");
    $("pause-title").textContent = s.online ? "Menu" : "Tạm dừng";
    $("btn-retry").hidden = s.online;
    $("btn-quit").textContent = s.online ? "Rời phòng" : "Về menu";
  }

  showOver(result, newBest) {
    this._only("over");
    const me = this.game.session.me, rank = result.ranking, mine = rank.find((r) => r.id === me) || rank[0];
    const title = $("over-title"), page = this.pages.over, ms = result.mission || null;
    $("over-stars").innerHTML = "";
    $("btn-next").hidden = true;
    if (ms) {                                                     // nhiệm vụ: thắng hay thua, mấy sao
      title.textContent = ms.victory ? "Hoàn thành" : "Thất bại";
      page.dataset.tone = ms.victory ? "win" : "lose";
      $("over-score").textContent = ms.title;
      const mm = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
      $("over-stats").textContent = ms.victory ? `Thời gian ${mm(ms.time)} (chuẩn ${mm(ms.par)}) · bạn hạ ${mine.kills} địch`
        : `Bạn đã gục sau ${mm(ms.time)} · hạ ${mine.kills} địch`;
      $("over-stars").innerHTML = ms.victory ? stars(ms.stars) : "";
      $("btn-next").hidden = !(ms.victory && nextMission(ms.id));
      $("btn-again").classList.toggle("primary", $("btn-next").hidden);       // chỉ một nút nổi bật: "tiếp theo" nếu có, không thì "chơi lại"
    } else if (result.mode === "pvp") {
      const won = rank[0].id === me;
      title.textContent = won ? "Chiến thắng" : "Hết trận";
      page.dataset.tone = won ? "win" : "lose";
      $("over-score").textContent = won ? `${mine.kills} mạng · bạn dẫn đầu` : `Vô địch: ${rank[0].name}`;
      $("over-stats").textContent = `Bạn hạ ${mine.kills} · gục ${mine.deaths}`;
    } else {
      title.textContent = "Gục ngã";
      page.dataset.tone = "lose";
      $("over-score").textContent = `${dots(result.teamScore)} điểm`;
      $("over-stats").textContent = `Trụ tới đợt ${result.wave} · bạn hạ ${mine.kills} địch · ${mine.headshots} phát trúng đầu`;
    }
    $("over-best").textContent = result.mode !== "solo" ? "" : newBest ? "KỶ LỤC MỚI" : `Kỷ lục: ${dots(this.game.save.best)}`;
    const s = this.game.session;
    $("btn-again").textContent = s.online ? "Về phòng chờ" : ms ? "Chơi lại nhiệm vụ" : "Chơi lại";
    $("btn-again").hidden = s.online && !s.isOwner;
    $("over-wait").hidden = !(s.online && !s.isOwner);
    $("btn-home").textContent = s.online ? "Rời phòng" : "Về menu";
    if (!ms) $("btn-again").classList.add("primary");
    const table = $("over-table");
    table.textContent = "";
    if (rank.length > 1) {
      rank.forEach((r, i) => {
        const row = document.createElement("li");
        if (r.id === me) row.className = "me";
        const cells = [String(i + 1), r.id === me ? "Bạn" : r.name, result.mode === "pvp" ? `${r.kills} hạ` : `${r.kills} địch`,
          result.mode === "pvp" ? `${r.deaths} gục` : `${dots(r.score)} điểm`];
        for (const text of cells) { const span = document.createElement("span"); span.textContent = text; row.appendChild(span); }
        table.appendChild(row);
      });
    }
  }
}
