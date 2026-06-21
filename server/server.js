const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();

// دعم CORS للإنتاج والتطوير
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["*"];

app.use(
  cors({
    origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  // تحسين الاتصال للإنتاج
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
});

// ============================================================
// في الذاكرة: تخزين بيانات الغرف
// ============================================================
const rooms = new Map();
/*
  هيكل كل غرفة (Room):
  {
    id: string,                     // معرّف الغرفة الفريد
    players: {
      white: { id, socketId, name },
      black: { id, socketId, name } | null
    },
    fen: string,                    // FEN الحالية لحالة الرقعة
    pgn: string[],                  // سجل الحركات
    turn: 'w' | 'b',               // الدور الحالي
    status: 'waiting' | 'playing' | 'finished',
    result: null | { winner, reason },
    lastActivity: Date
  }
*/

// ============================================================
// REST API: صحة السيرفر وملفات الواجهة الأمامية
// ============================================================

// خدمة الملفات الثابتة من تطبيق React المدمج
const buildPath = path.join(__dirname, "../client/build");
app.use(express.static(buildPath));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rooms: rooms.size,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// استرجاع معلومات الغرفة بدون Socket
app.get("/api/room/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: "الغرفة غير موجودة" });
  }
  res.json({
    id: room.id,
    status: room.status,
    playersCount: Object.values(room.players).filter(Boolean).length,
    turn: room.turn,
    fen: room.fen,
  });
});

// مسار احتياطي لخدمة تطبيق React (توجيه العميل)
app.get("*", (req, res) => {
  const indexPath = path.join(buildPath, "index.html");
  const fs = require("fs");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head><meta charset="utf-8"><title>Zen Chess — جاري التحميل</title></head>
        <body style="font-family:sans-serif;background:#1a1f2e;color:#e8eaf0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px">
          <div style="font-size:3rem">♟</div>
          <h1>Zen Chess Server</h1>
          <p style="color:#7eb8a4">✓ السيرفر يعمل</p>
          <p style="color:#e07070;font-size:.85rem">⚠ ملفات الواجهة غير موجودة — تأكد من إعداد Build Command في Render</p>
          <p style="color:#5c647a;font-size:.75rem">Build Command: npm run build</p>
        </body>
      </html>
    `);
  }
});

// ============================================================
// Socket.io: معالجة الأحداث الرئيسية
// ============================================================
io.on("connection", (socket) => {
  console.log(`[+] اتصال جديد: ${socket.id}`);

  // ----------------------------------------------------------
  // إنشاء غرفة جديدة
  // ----------------------------------------------------------
  socket.on("create_room", ({ playerName }, callback) => {
    const roomId = generateRoomCode();
    const playerId = uuidv4();

    const room = {
      id: roomId,
      players: {
        white: { id: playerId, socketId: socket.id, name: playerName || "لاعب ١" },
        black: null,
      },
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", // وضع البداية
      pgn: [],
      turn: "w",
      status: "waiting",
      result: null,
      lastActivity: new Date(),
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = playerId;
    socket.data.color = "white";

    console.log(`[+] تم إنشاء غرفة: ${roomId} بواسطة ${playerName}`);

    callback({
      success: true,
      roomId,
      playerId,
      color: "white",
      room: serializeRoom(room),
    });
  });

  // ----------------------------------------------------------
  // الانضمام لغرفة موجودة
  // ----------------------------------------------------------
  socket.on("join_room", ({ roomId, playerName }, callback) => {
    const room = rooms.get(roomId);

    if (!room) {
      return callback({ success: false, error: "الغرفة غير موجودة. تحقق من الكود." });
    }

    if (room.status === "playing" || room.status === "finished") {
      return callback({ success: false, error: "اللعبة بدأت بالفعل أو انتهت." });
    }

    if (room.players.black !== null) {
      return callback({ success: false, error: "الغرفة ممتلئة." });
    }

    const playerId = uuidv4();
    room.players.black = {
      id: playerId,
      socketId: socket.id,
      name: playerName || "لاعب ٢",
    };
    room.status = "playing";
    room.lastActivity = new Date();

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = playerId;
    socket.data.color = "black";

    console.log(`[+] ${playerName} انضم للغرفة: ${roomId}`);

    // إخطار اللاعب الأول بأن الخصم قد انضم
    socket.to(roomId).emit("opponent_joined", {
      opponentName: playerName || "لاعب ٢",
      room: serializeRoom(room),
    });

    callback({
      success: true,
      roomId,
      playerId,
      color: "black",
      room: serializeRoom(room),
    });

    // إرسال إشارة بدء اللعبة للجميع في الغرفة
    io.to(roomId).emit("game_start", {
      room: serializeRoom(room),
    });
  });

  // ----------------------------------------------------------
  // تنفيذ حركة
  // ----------------------------------------------------------
  socket.on("make_move", ({ roomId, move, fen, pgn, turn, isGameOver, result }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // التحقق من أن اللاعب هو صاحب الدور
    const expectedColor = room.turn === "w" ? "white" : "black";
    if (socket.data.color !== expectedColor) {
      socket.emit("move_error", { error: "ليس دورك!" });
      return;
    }

    // تحديث حالة الغرفة
    room.fen = fen;
    room.pgn = pgn || [];
    room.turn = turn;
    room.lastActivity = new Date();

    if (isGameOver && result) {
      room.status = "finished";
      room.result = result;
    }

    // إرسال الحركة للخصم (وليس للمُرسِل)
    socket.to(roomId).emit("move_received", {
      move,
      fen,
      pgn,
      turn,
      isGameOver,
      result,
    });

    // إذا انتهت اللعبة
    if (isGameOver && result) {
      io.to(roomId).emit("game_over", { result });
      console.log(`[=] انتهت اللعبة في الغرفة ${roomId}: ${JSON.stringify(result)}`);
    }
  });

  // ----------------------------------------------------------
  // إعادة تشغيل اللعبة (Rematch)
  // ----------------------------------------------------------
  socket.on("request_rematch", ({ roomId }) => {
    socket.to(roomId).emit("rematch_requested", {
      from: socket.data.color,
    });
  });

  socket.on("accept_rematch", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // تبديل الألوان للمباراة القادمة
    const tempWhite = room.players.white;
    room.players.white = room.players.black;
    room.players.black = tempWhite;

    // إعادة تعيين حالة اللعبة
    room.fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    room.pgn = [];
    room.turn = "w";
    room.status = "playing";
    room.result = null;

    // تحديث بيانات socket للاعبين بعد تبديل الألوان
    const whiteSocket = io.sockets.sockets.get(room.players.white.socketId);
    const blackSocket = io.sockets.sockets.get(room.players.black.socketId);
    if (whiteSocket) whiteSocket.data.color = "white";
    if (blackSocket) blackSocket.data.color = "black";

    io.to(roomId).emit("rematch_started", {
      room: serializeRoom(room),
    });

    console.log(`[~] إعادة مباراة في الغرفة: ${roomId}`);
  });

  // ----------------------------------------------------------
  // طلب الاستسلام (Resign)
  // ----------------------------------------------------------
  socket.on("resign", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== "playing") return;

    const resigningColor = socket.data.color;
    const winner = resigningColor === "white" ? "black" : "white";

    room.status = "finished";
    room.result = { winner, reason: "استسلام" };

    io.to(roomId).emit("game_over", {
      result: { winner, reason: "استسلام" },
    });

    console.log(`[!] استسلم اللاعب ${resigningColor} في الغرفة: ${roomId}`);
  });

  // ----------------------------------------------------------
  // مزامنة الحالة عند إعادة الاتصال
  // ----------------------------------------------------------
  socket.on("rejoin_room", ({ roomId, playerId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: "الغرفة لم تعد موجودة." });
    }

    let playerColor = null;
    if (room.players.white?.id === playerId) {
      playerColor = "white";
      room.players.white.socketId = socket.id;
    } else if (room.players.black?.id === playerId) {
      playerColor = "black";
      room.players.black.socketId = socket.id;
    } else {
      return callback({ success: false, error: "لاعب غير معروف." });
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = playerId;
    socket.data.color = playerColor;

    // إخطار الخصم بعودة الاتصال
    socket.to(roomId).emit("opponent_reconnected", { color: playerColor });

    callback({
      success: true,
      color: playerColor,
      room: serializeRoom(room),
    });

    console.log(`[~] إعادة اتصال: ${playerId} في الغرفة ${roomId}`);
  });

  // ----------------------------------------------------------
  // قطع الاتصال
  // ----------------------------------------------------------
  socket.on("disconnect", (reason) => {
    const { roomId, color } = socket.data;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    console.log(`[-] انقطع اتصال: ${socket.id} (${color}) من الغرفة ${roomId} - السبب: ${reason}`);

    // إخطار الخصم بانقطاع الاتصال
    socket.to(roomId).emit("opponent_disconnected", {
      color,
      reason,
    });

    // إذا كانت اللعبة جارية، نمنح ٣٠ ثانية قبل إنهائها
    if (room.status === "playing") {
      room[`${color}DisconnectTimer`] = setTimeout(() => {
        const currentRoom = rooms.get(roomId);
        if (!currentRoom) return;

        // التحقق إن اللاعب لم يعد يتصل
        const player = currentRoom.players[color];
        const playerSocket = io.sockets.sockets.get(player?.socketId);
        if (!playerSocket || !playerSocket.connected) {
          const winner = color === "white" ? "black" : "white";
          currentRoom.status = "finished";
          currentRoom.result = { winner, reason: "انقطاع الاتصال" };
          io.to(roomId).emit("game_over", {
            result: { winner, reason: "انقطاع الاتصال" },
          });
          console.log(`[!] فاز ${winner} بسبب انقطاع اتصال ${color} في الغرفة ${roomId}`);
        }
      }, 30000); // 30 ثانية للانتظار
    }

    // تنظيف الغرف الفارغة بعد ساعة
    scheduleRoomCleanup(roomId);
  });
});

// ============================================================
// دوال المساعدة
// ============================================================

/**
 * توليد كود غرفة بصري وسهل القراءة (6 أحرف)
 */
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // بدون O, 0, I, 1
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  } while (rooms.has(code));
  return code;
}

/**
 * تحويل بيانات الغرفة لصيغة آمنة للإرسال
 */
function serializeRoom(room) {
  return {
    id: room.id,
    players: {
      white: room.players.white
        ? { name: room.players.white.name, id: room.players.white.id }
        : null,
      black: room.players.black
        ? { name: room.players.black.name, id: room.players.black.id }
        : null,
    },
    fen: room.fen,
    pgn: room.pgn,
    turn: room.turn,
    status: room.status,
    result: room.result,
  };
}

/**
 * جدولة تنظيف الغرف غير النشطة
 */
function scheduleRoomCleanup(roomId) {
  setTimeout(() => {
    const room = rooms.get(roomId);
    if (!room) return;
    const hourAgo = new Date(Date.now() - 3600000);
    if (room.lastActivity < hourAgo) {
      rooms.delete(roomId);
      console.log(`[x] تم حذف الغرفة غير النشطة: ${roomId}`);
    }
  }, 3600000); // بعد ساعة
}

// تنظيف دوري كل ساعتين للغرف القديمة جداً
setInterval(() => {
  const twoHoursAgo = new Date(Date.now() - 7200000);
  let cleaned = 0;
  for (const [id, room] of rooms) {
    if (room.lastActivity < twoHoursAgo) {
      rooms.delete(id);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[x] تم تنظيف ${cleaned} غرفة منتهية الصلاحية`);
  }
}, 7200000);

// ============================================================
// تشغيل السيرفر
// ============================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     ♟  Chess Server Running  ♟        ║
║   Port: ${PORT}                          ║
║   Environment: ${process.env.NODE_ENV || "development"}           ║
╚════════════════════════════════════════╝
  `);
});
