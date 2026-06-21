import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useGame } from "../context/GameContext";
import useSocket from "../hooks/useSocket";

// ============================================================
// ChessGame — مكوّن لعبة الشطرنج الرئيسي
// ============================================================
export default function ChessGame() {
  const { state, dispatch } = useGame();
  const { makeMove, requestRematch, acceptRematch, resign, leaveRoom } =
    useSocket();

  const {
    fen,
    turn,
    playerColor,
    players,
    gameStatus,
    result,
    rematchRequested,
    rematchFrom,
    roomId,
    playerName,
    pgn,
  } = state;

  // مثيل chess.js للتحقق من الحركات
  const [chess] = useState(() => new Chess());
  const [moveSquares, setMoveSquares] = useState({});
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [lastMoveSquares, setLastMoveSquares] = useState({});
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });

  // مزامنة chess.js مع الـ FEN القادم من السيرفر
  useEffect(() => {
    try {
      chess.load(fen);
    } catch {
      /* FEN غير صالح — نتجاهل */
    }
  }, [fen, chess]);

  // تحديث قائمة القطع المأسورة
  useEffect(() => {
    try {
      const tempChess = new Chess(fen);
      const board = tempChess.board();
      const allPieces = { w: { p:8,n:2,b:2,r:2,q:1,k:1 }, b: { p:8,n:2,b:2,r:2,q:1,k:1 } };
      const remaining = { w: {}, b: {} };

      board.flat().filter(Boolean).forEach((piece) => {
        const c = piece.color;
        const t = piece.type;
        remaining[c][t] = (remaining[c][t] || 0) + 1;
      });

      const captured = { white: [], black: [] };
      const pieceSymbols = {
        w: { p:"♙",n:"♘",b:"♗",r:"♖",q:"♕" },
        b: { p:"♟",n:"♞",b:"♝",r:"♜",q:"♛" },
      };

      ["p","n","b","r","q"].forEach((type) => {
        const whiteCaptured = (allPieces.b[type] || 0) - (remaining.b[type] || 0);
        for (let i = 0; i < whiteCaptured; i++) {
          captured.white.push(pieceSymbols.b[type]);
        }
        const blackCaptured = (allPieces.w[type] || 0) - (remaining.w[type] || 0);
        for (let i = 0; i < blackCaptured; i++) {
          captured.black.push(pieceSymbols.w[type]);
        }
      });

      setCapturedPieces(captured);
    } catch {}
  }, [fen]);

  // هل الرقعة مقلوبة (اللاعب الأسود ينظر من الأسفل)
  const boardOrientation = playerColor === "black" ? "black" : "white";

  // هل دور هذا اللاعب
  const isMyTurn = useMemo(() => {
    if (gameStatus !== "playing") return false;
    return (turn === "w" && playerColor === "white") ||
           (turn === "b" && playerColor === "black");
  }, [turn, playerColor, gameStatus]);

  // ----------------------------------------------------------
  // حساب الحركات المتاحة للمربع المحدد
  // ----------------------------------------------------------
  const getValidMoves = useCallback(
    (square) => {
      const moves = chess.moves({ square, verbose: true });
      const highlights = {};
      moves.forEach((m) => {
        highlights[m.to] = {
          background:
            chess.get(m.to)
              ? "radial-gradient(circle, rgba(224,112,112,0.55) 70%, transparent 70%)"
              : "radial-gradient(circle, rgba(126,184,164,0.45) 30%, transparent 30%)",
          borderRadius: "50%",
        };
      });
      return highlights;
    },
    [chess]
  );

  // ----------------------------------------------------------
  // تنفيذ الحركة (يجب تعريفها قبل onSquareClick)
  // ----------------------------------------------------------
  const executeMove = useCallback(
    (from, to, promotion = "q") => {
      setSelectedSquare(null);
      setMoveSquares({});

      let move;
      try {
        move = chess.move({ from, to, promotion });
      } catch {
        return false;
      }

      if (!move) return false;

      const isGameOver = chess.isGameOver();
      let gameResult = null;

      if (isGameOver) {
        if (chess.isCheckmate()) {
          const winner = move.color === "w" ? "white" : "black";
          gameResult = { winner, reason: "كش مات" };
        } else if (chess.isDraw()) {
          let reason = "تعادل";
          if (chess.isStalemate()) reason = "ستالميت";
          else if (chess.isInsufficientMaterial()) reason = "مواد غير كافية";
          else if (chess.isThreefoldRepetition()) reason = "ثلاثية التكرار";
          gameResult = { winner: null, reason };
        }
        dispatch({ type: "GAME_OVER", payload: { result: gameResult } });
      }

      // تحديث تمييز آخر حركة
      setLastMoveSquares({
        [from]: { background: "rgba(255, 214, 0, 0.25)" },
        [to]:   { background: "rgba(255, 214, 0, 0.35)" },
      });

      // تحديث الحالة المحلية
      dispatch({
        type: "MOVE_MADE",
        payload: {
          fen: chess.fen(),
          pgn: chess.history(),
          turn: chess.turn(),
        },
      });

      // إرسال الحركة للسيرفر
      makeMove({
        move: { from, to, promotion },
        fen: chess.fen(),
        pgn: chess.history(),
        turn: chess.turn(),
        isGameOver,
        result: gameResult,
      });

      return true;
    },
    [chess, dispatch, makeMove]
  );

  // ----------------------------------------------------------
  // معالجة النقر على المربع
  // ----------------------------------------------------------
  const onSquareClick = useCallback(
    (square) => {
      if (!isMyTurn) return;

      const piece = chess.get(square);

      // إذا نقر على قطعته → اختيار أو إلغاء
      if (piece && piece.color === (playerColor === "white" ? "w" : "b")) {
        if (selectedSquare === square) {
          setSelectedSquare(null);
          setMoveSquares({});
        } else {
          setSelectedSquare(square);
          setMoveSquares(getValidMoves(square));
        }
        return;
      }

      // إذا كان هناك مربع محدد → حاول تنفيذ الحركة
      if (selectedSquare) {
        executeMove(selectedSquare, square);
      }
    },
    [isMyTurn, chess, playerColor, selectedSquare, getValidMoves, executeMove]
  );

  // ----------------------------------------------------------
  // معالجة السحب والإفلات
  // ----------------------------------------------------------
  const onPieceDrop = useCallback(
    (sourceSquare, targetSquare, piece) => {
      if (!isMyTurn) return false;
      const pieceColor = piece[0] === "w" ? "white" : "black";
      if (pieceColor !== playerColor) return false;
      return executeMove(sourceSquare, targetSquare);
    },
    [isMyTurn, playerColor, executeMove]
  );

  // هل يمكن سحب هذه القطعة
  const isDraggablePiece = useCallback(
    ({ piece }) => {
      if (!isMyTurn) return false;
      const color = piece[0] === "w" ? "white" : "black";
      return color === playerColor;
    },
    [isMyTurn, playerColor]
  );

  // دمج تمييزات المربعات
  const customSquareStyles = useMemo(() => {
    const styles = { ...lastMoveSquares };
    if (selectedSquare) {
      styles[selectedSquare] = { background: "rgba(255, 214, 0, 0.5)" };
    }
    return { ...styles, ...moveSquares };
  }, [lastMoveSquares, selectedSquare, moveSquares]);

  // ----------------------------------------------------------
  // اسم اللاعب الآخر
  // ----------------------------------------------------------
  const opponentColor = playerColor === "white" ? "black" : "white";
  const myPlayer = players[playerColor];
  const opponentPlayer = players[opponentColor];

  const isMyTurnForDisplay = isMyTurn;
  const isOpponentTurn = !isMyTurn && gameStatus === "playing";

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  return (
    <div
      className="game-layout"
      style={{ background: "var(--bg-base)", minHeight: "100vh" }}
    >
      {/* ===== Sidebar Left ===== */}
      <aside className="sidebar-left">
        {/* معلومات الغرفة */}
        <RoomInfo roomId={roomId} />

        {/* بطاقة الخصم */}
        <PlayerCard
          player={opponentPlayer}
          color={opponentColor}
          isActive={isOpponentTurn}
          capturedPieces={
            opponentColor === "white"
              ? capturedPieces.white
              : capturedPieces.black
          }
        />

        {/* سجل الحركات */}
        <MoveHistory pgn={pgn} />
      </aside>

      {/* ===== Board Center ===== */}
      <main className="board-center">
        {/* مؤشر الدور */}
        <TurnIndicator
          isMyTurn={isMyTurnForDisplay}
          turn={turn}
          playerColor={playerColor}
          gameStatus={gameStatus}
          myName={myPlayer?.name || playerName}
          opponentName={opponentPlayer?.name || "..."}
        />

        {/* الرقعة */}
        <div
          className="board-wrapper animate-scale-in"
          style={{ width: "min(560px, 90vw)" }}
        >
          <Chessboard
            position={fen}
            onSquareClick={onSquareClick}
            onPieceDrop={onPieceDrop}
            isDraggablePiece={isDraggablePiece}
            boardOrientation={boardOrientation}
            customSquareStyles={customSquareStyles}
            customBoardStyle={{
              borderRadius: "12px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            customDarkSquareStyle={{ backgroundColor: "#7a9e7e" }}
            customLightSquareStyle={{ backgroundColor: "#e8dcc8" }}
            animationDuration={180}
            showBoardNotation={true}
          />
        </div>

        {/* حالة الكش / التعادل */}
        {gameStatus === "playing" && chess.inCheck() && (
          <div
            className="badge badge-danger animate-scale-in"
            style={{ fontSize: "0.9rem", padding: "8px 18px" }}
          >
            ⚠ كش — الملك في خطر!
          </div>
        )}

        {/* أزرار التحكم */}
        <GameControls
          gameStatus={gameStatus}
          onResign={() => setShowResignConfirm(true)}
          onLeave={leaveRoom}
          onRematch={requestRematch}
          onAcceptRematch={acceptRematch}
          rematchRequested={rematchRequested}
          rematchFrom={rematchFrom}
          playerColor={playerColor}
        />
      </main>

      {/* ===== Sidebar Right ===== */}
      <aside className="sidebar-right">
        {/* بطاقتي */}
        <PlayerCard
          player={myPlayer}
          color={playerColor}
          isActive={isMyTurnForDisplay}
          isMe={true}
          capturedPieces={
            playerColor === "white"
              ? capturedPieces.white
              : capturedPieces.black
          }
        />

        {/* لوحة معلومات اللعبة */}
        <GameStatusPanel
          gameStatus={gameStatus}
          result={result}
          playerColor={playerColor}
          myName={myPlayer?.name || playerName}
          opponentName={opponentPlayer?.name || "..."}
        />

        {/* معلومات تقنية */}
        <TechInfo fen={fen} turn={turn} />
      </aside>

      {/* ===== Modals ===== */}
      {showResignConfirm && (
        <ResignModal
          onConfirm={() => { resign(); setShowResignConfirm(false); }}
          onCancel={() => setShowResignConfirm(false)}
        />
      )}

      {gameStatus === "finished" && result && (
        <GameOverModal
          result={result}
          playerColor={playerColor}
          myName={myPlayer?.name || playerName}
          opponentName={opponentPlayer?.name || "..."}
          onRematch={requestRematch}
          onLeave={leaveRoom}
          rematchRequested={rematchRequested}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

/* --- Room Info --- */
function RoomInfo({ roomId }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card p-4 animate-fade-in-up">
      <div className="text-muted text-sm mb-2" style={{ fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        كود الغرفة
      </div>
      <div
        className="room-code"
        style={{ fontSize: "1.2rem", padding: "12px", cursor: "pointer" }}
        onClick={copy}
        title="انقر للنسخ"
      >
        {roomId}
      </div>
      {copied && (
        <div className="text-center mt-2 text-success animate-fade-in" style={{ fontSize: "0.78rem" }}>
          ✓ تم النسخ
        </div>
      )}
    </div>
  );
}

/* --- Player Card --- */
function PlayerCard({ player, color, isActive, isMe = false, capturedPieces = [] }) {
  return (
    <div
      className={`player-card animate-fade-in-up ${isActive ? "active-turn" : ""}`}
      style={{ transition: "all 0.3s ease" }}
    >
      <div className={`player-avatar player-avatar-${color}`}>
        {player?.name?.charAt(0).toUpperCase() || (color === "white" ? "♙" : "♟")}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {player?.name || (color === "white" ? "لاعب أبيض" : "لاعب أسود")}
          </span>
          {isMe && (
            <span className="badge badge-neutral" style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
              أنت
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="status-dot online" />
          <span className="text-muted" style={{ fontSize: "0.75rem" }}>
            {color === "white" ? "الأبيض ♙" : "الأسود ♟"}
          </span>
        </div>
        {capturedPieces.length > 0 && (
          <div className="captured-pieces mt-2">
            {capturedPieces.map((p, i) => (
              <span key={i} className="captured-piece">{p}</span>
            ))}
          </div>
        )}
      </div>
      {isActive && (
        <div
          className="animate-pulse"
          style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "var(--accent-primary)",
            boxShadow: "0 0 8px var(--accent-primary)",
          }}
        />
      )}
    </div>
  );
}

/* --- Turn Indicator --- */
function TurnIndicator({ isMyTurn, turn, playerColor, gameStatus, myName, opponentName }) {
  if (gameStatus !== "playing") return null;

  return (
    <div
      className="animate-fade-in"
      style={{
        padding: "10px 24px",
        borderRadius: "100px",
        background: isMyTurn
          ? "rgba(126,184,164,0.12)"
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${isMyTurn ? "var(--border-accent)" : "var(--border-subtle)"}`,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "0.9rem",
        transition: "all 0.4s ease",
      }}
    >
      <span style={{ fontSize: "1.2rem" }}>
        {turn === "w" ? "♙" : "♟"}
      </span>
      <span className={isMyTurn ? "text-accent font-medium" : "text-secondary"}>
        {isMyTurn ? `دورك يا ${myName}` : `دور ${opponentName}`}
      </span>
      {isMyTurn && (
        <span
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--accent-primary)",
            animation: "pulse 1.5s ease infinite",
          }}
        />
      )}
    </div>
  );
}

/* --- Move History --- */
function MoveHistory({ pgn }) {
  const moves = pgn || [];
  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ num: Math.floor(i / 2) + 1, white: moves[i], black: moves[i + 1] });
  }

  return (
    <div
      className="glass-card p-4 animate-fade-in-up"
      style={{ maxHeight: "280px" }}
    >
      <div
        className="text-muted mb-3"
        style={{ fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        سجل الحركات
      </div>
      <div
        className="overflow-y-auto"
        style={{ maxHeight: "220px" }}
      >
        {pairs.length === 0 ? (
          <div className="text-muted text-center text-sm" style={{ padding: "20px 0" }}>
            لا توجد حركات بعد
          </div>
        ) : (
          <div className="move-list">
            {pairs.map((pair) => (
              <React.Fragment key={pair.num}>
                <div className="move-num">{pair.num}.</div>
                <div className="move-cell">{pair.white}</div>
                <div className="move-cell">{pair.black || ""}</div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* --- Game Controls --- */
function GameControls({
  gameStatus, onResign, onLeave, onRematch, onAcceptRematch,
  rematchRequested, rematchFrom, playerColor,
}) {
  if (gameStatus === "finished") return null;
  if (gameStatus !== "playing") return null;

  return (
    <div className="flex gap-3 mt-2 animate-fade-in">
      <button className="btn btn-danger btn-sm" onClick={onResign}>
        🏳 استسلام
      </button>
      <button className="btn btn-ghost btn-sm" onClick={onLeave}>
        ← مغادرة
      </button>
      {rematchRequested && rematchFrom !== playerColor && (
        <button
          className="btn btn-primary btn-sm animate-scale-in"
          onClick={onAcceptRematch}
        >
          🔄 قبول إعادة المباراة
        </button>
      )}
    </div>
  );
}

/* --- Game Status Panel --- */
function GameStatusPanel({ gameStatus, result, playerColor, myName, opponentName }) {
  const statusMap = {
    waiting:  { label: "انتظار الخصم...", badge: "badge-warning" },
    playing:  { label: "اللعبة جارية",   badge: "badge-success" },
    finished: { label: "انتهت اللعبة",   badge: "badge-neutral" },
  };

  const status = statusMap[gameStatus] || statusMap.waiting;

  return (
    <div className="glass-card p-4 animate-fade-in-up">
      <div
        className="text-muted mb-3"
        style={{ fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        حالة اللعبة
      </div>
      <div className={`badge ${status.badge} mb-3`} style={{ fontSize: "0.8rem" }}>
        {gameStatus === "playing" && (
          <span style={{ animation: "pulse 2s infinite" }}>●</span>
        )}
        {status.label}
      </div>

      {result && (
        <div
          className="animate-fade-in-up"
          style={{
            padding: "12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-base)",
            border: "1px solid var(--border-subtle)",
            fontSize: "0.85rem",
          }}
        >
          {result.winner ? (
            <>
              <div className="font-medium mb-1">
                {result.winner === playerColor ? "🏆 أنت الفائز!" : "💀 خسرت الجولة"}
              </div>
              <div className="text-muted">السبب: {result.reason}</div>
            </>
          ) : (
            <>
              <div className="font-medium mb-1">🤝 تعادل</div>
              <div className="text-muted">السبب: {result.reason}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* --- Tech Info --- */
function TechInfo({ fen, turn }) {
  return (
    <div
      className="glass-card p-4 animate-fade-in-up"
      style={{ fontSize: "0.75rem" }}
    >
      <div
        className="text-muted mb-3"
        style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        معلومات تقنية
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="text-muted">الدور</span>
          <span className="font-mono text-accent" style={{ fontSize: "0.7rem" }}>
            {turn === "w" ? "White" : "Black"}
          </span>
        </div>
        <div>
          <div className="text-muted mb-1">FEN</div>
          <div
            className="font-mono text-secondary"
            style={{
              fontSize: "0.65rem",
              wordBreak: "break-all",
              lineHeight: 1.6,
              background: "var(--bg-base)",
              padding: "6px 8px",
              borderRadius: "4px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {fen}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Resign Modal --- */
function ResignModal({ onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content text-center" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🏳</div>
        <h3 className="text-xl font-medium mb-2">تأكيد الاستسلام</h3>
        <p className="text-secondary mb-6" style={{ fontSize: "0.9rem" }}>
          هل أنت متأكد؟ سيُمنح الفوز للخصم.
        </p>
        <div className="flex gap-3 justify-center">
          <button className="btn btn-danger" onClick={onConfirm}>
            نعم، أستسلم
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            لا، متابعة
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Game Over Modal --- */
function GameOverModal({
  result, playerColor, myName, opponentName,
  onRematch, onLeave, rematchRequested,
}) {
  const isWinner = result.winner === playerColor;
  const isDraw = result.winner === null;

  const emoji = isDraw ? "🤝" : isWinner ? "🏆" : "💀";
  const title = isDraw ? "تعادل!" : isWinner ? "أحسنت! فزت!" : "للأسف، خسرت";
  const subtitle = isDraw
    ? `تعادل بسبب: ${result.reason}`
    : isWinner
    ? `ربحت بسبب: ${result.reason}`
    : `خسرت بسبب: ${result.reason}`;

  return (
    <div className="modal-backdrop">
      <div className="modal-content text-center animate-scale-in">
        <div style={{ fontSize: "3rem", marginBottom: "16px" }}>{emoji}</div>
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-secondary mb-2">{subtitle}</p>

        {!isDraw && (
          <div className="mb-6">
            <span
              className={`badge ${isWinner ? "badge-success" : "badge-danger"}`}
              style={{ fontSize: "0.85rem" }}
            >
              {isWinner ? `🏆 ${myName}` : `🏆 ${opponentName}`} — الفائز
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            className={`btn btn-primary btn-block ${rematchRequested ? "opacity-60" : ""}`}
            onClick={onRematch}
            disabled={rematchRequested}
          >
            {rematchRequested ? "⏳ في انتظار رد الخصم..." : "🔄 إعادة المباراة"}
          </button>
          <button className="btn btn-secondary btn-block" onClick={onLeave}>
            ← العودة للقائمة الرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}
