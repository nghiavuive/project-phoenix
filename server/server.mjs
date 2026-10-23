// Máy chủ Project Phoenix: vừa phát trang game (index.html + js/), vừa làm máy chủ phòng qua WebSocket tại /ws.
// Chỉ cần đưa cả thư mục này lên một dịch vụ chạy Node.js là có địa chỉ để cả nhóm vào chơi.
//
//     npm install
//     npm start            (mặc định cổng 8080; dịch vụ đám mây tự đặt biến PORT)
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import { config } from "../js/config.js";
import { Hub } from "./rooms.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json" };

export function startServer(port = Number(process.env.PORT) || 8080) {
  const hub = new Hub();

  const http = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/health") {                    // cho dịch vụ đám mây kiểm tra máy chủ còn sống
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ phoenix: true, rooms: hub.rooms.size }));
      return;
    }
    // chỉ phát đúng trang game và thư mục js/, không gì khác
    const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const file = path.normalize(path.join(ROOT, rel));
    const allowed = file === path.join(ROOT, "index.html") || file.startsWith(path.join(ROOT, "js") + path.sep);
    if (!allowed || !TYPES[path.extname(file)] || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Không có trang này");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)], "cache-control": "no-cache" });
    if (rel === "index.html") {                          // đánh dấu vào trang: "trang này có sẵn máy chủ phòng", để game khỏi hỏi địa chỉ
      res.end(readFileSync(file, "utf8").replace("<body>", '<body data-phoenix-server="1">'));
      return;
    }
    createReadStream(file).pipe(res);
  });

  const wss = new WebSocketServer({ server: http, path: "/ws", maxPayload: 16 * 1024 });
  wss.on("connection", (socket) => {
    const conn = {
      send: (message) => { if (socket.readyState === 1 && socket.bufferedAmount < 1_000_000) socket.send(JSON.stringify(message)); },
      close: () => socket.close(),
    };
    socket.on("message", (data) => {
      let message;
      try { message = JSON.parse(data.toString()); } catch { socket.close(); return; }
      hub.receive(conn, message);
    });
    socket.on("close", () => hub.drop(conn));
    socket.on("error", () => hub.drop(conn));
  });

  const step = 1 / config.NET_TICK;
  let last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    hub.tick(Math.min((now - last) / 1000, 0.1));
    last = now;
  }, step * 1000);

  return new Promise((ready) => {
    http.listen(port, () => ready({ hub, port: http.address().port, close: () => { clearInterval(timer); wss.close(); http.close(); } }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await startServer();
  console.log(`Project Phoenix đang chạy: http://localhost:${port}  (máy chủ phòng tại /ws)`);
}
