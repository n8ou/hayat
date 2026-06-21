import { io } from "socket.io-client";

const SERVER_URL =
  process.env.REACT_APP_SERVER_URL || "http://localhost:3001";

// إنشاء اتصال Socket.io واحد مشترك في التطبيق
const socket = io(SERVER_URL, {
  autoConnect: false,       // لا نتصل تلقائياً، نتحكم بالوقت يدوياً
  reconnection: true,       // إعادة الاتصال تلقائياً عند الانقطاع
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  transports: ["websocket", "polling"],
});

export default socket;
