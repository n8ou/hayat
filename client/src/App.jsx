import React from "react";
import { GameProvider, useGame } from "./context/GameContext";
import Lobby from "./components/Lobby";
import ChessGame from "./components/ChessGame";
import ToastContainer from "./components/ToastContainer";
import "./index.css";

// ============================================================
// AppInner — مكوّن داخلي يقرأ الحالة من الـ Context
// ============================================================
function AppInner() {
  const { state } = useGame();
  const { gameStatus } = state;

  // عرض الرقعة عند بدء اللعبة
  const showGame = gameStatus === "playing" || gameStatus === "finished";

  return (
    <>
      {showGame ? <ChessGame /> : <Lobby />}
      <ToastContainer />
    </>
  );
}

// ============================================================
// App — نقطة الدخول الرئيسية
// ============================================================
function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}

export default App;
