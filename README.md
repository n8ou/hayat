# ♟ Zen Chess — Real-time Multiplayer Chess

تطبيق شطرنج متعدد اللاعبين في الوقت الفعلي بتصميم Zen أنيق.

## هيكل المشروع

```
chess-app/
├── server/                  # الخلفية (Node.js + Express + Socket.io)
│   ├── server.js            # السيرفر الرئيسي
│   └── package.json
│
└── client/                  # الواجهة الأمامية (React)
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── context/
    │   │   └── GameContext.jsx    # إدارة الحالة المركزية
    │   ├── hooks/
    │   │   └── useSocket.js       # Hook لإدارة Socket.io
    │   ├── components/
    │   │   ├── Lobby.jsx          # شاشة البداية
    │   │   ├── ChessGame.jsx      # شاشة اللعبة الرئيسية
    │   │   └── ToastContainer.jsx # نظام الإشعارات
    │   ├── App.jsx
    │   ├── index.js
    │   ├── index.css              # نظام التصميم الكامل
    │   └── socket.js              # Socket.io singleton
    ├── .env
    └── package.json
```

## تشغيل المشروع

### 1. تثبيت وتشغيل السيرفر
```bash
cd chess-app/server
npm install
npm run dev
```

### 2. تثبيت وتشغيل الـ Client (نافذة جديدة)
```bash
cd chess-app/client
npm install
npm start
```

### 3. افتح المتصفح على
- **الواجهة**: http://localhost:3000
- **السيرفر**: http://localhost:3001/health

## للعب مع صديق
1. اللاعب الأول: ينشئ غرفة → يحصل على كود 6 أحرف
2. اللاعب الثاني: يدخل الكود → تبدأ اللعبة فوراً

## التقنيات المستخدمة
- **React 18** + Context API
- **chess.js** — التحقق من صحة الحركات
- **react-chessboard** — عرض الرقعة
- **Socket.io** — الاتصال الفوري
- **Express** — السيرفر
