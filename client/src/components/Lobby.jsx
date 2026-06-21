import React, { useState } from "react";
import useSocket from "../hooks/useSocket";
import { useGame } from "../context/GameContext";

// ============================================================
// Lobby — شاشة البداية وإنشاء/الانضمام للغرف
// ============================================================
export default function Lobby() {
  const { state, dispatch } = useGame();
  const { createRoom, joinRoom, connectionStatus } = useSocket();

  const [view, setView] = useState("home"); // 'home' | 'create' | 'join' | 'waiting'
  const [playerName, setPlayerName] = useState(state.playerName || "");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isConnected = connectionStatus === "connected";

  // ----------------------------------------------------------
  // إنشاء غرفة جديدة
  // ----------------------------------------------------------
  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError("يرجى إدخال اسمك أولاً");
      return;
    }
    setError("");
    setLoading(true);
    try {
      dispatch({ type: "SET_PLAYER_NAME", payload: playerName.trim() });
      await createRoom(playerName.trim());
      setView("waiting");
    } catch (err) {
      setError(err.message || "حدث خطأ في إنشاء الغرفة");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------
  // الانضمام لغرفة
  // ----------------------------------------------------------
  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      setError("يرجى إدخال اسمك أولاً");
      return;
    }
    if (!roomCode.trim() || roomCode.trim().length < 6) {
      setError("يرجى إدخال كود الغرفة (6 أحرف)");
      return;
    }
    setError("");
    setLoading(true);
    try {
      dispatch({ type: "SET_PLAYER_NAME", payload: playerName.trim() });
      await joinRoom(roomCode.trim(), playerName.trim());
    } catch (err) {
      setError(err.message || "حدث خطأ في الانضمام للغرفة");
      setLoading(false);
    }
  };

  const handleKeyDown = (e, action) => {
    if (e.key === "Enter") action();
  };

  // ----------------------------------------------------------
  // شاشة الانتظار بعد إنشاء الغرفة
  // ----------------------------------------------------------
  if (view === "waiting" && state.roomId) {
    return <WaitingRoom roomId={state.roomId} playerName={playerName} />;
  }

  // ----------------------------------------------------------
  // الشاشة الرئيسية للـ Lobby
  // ----------------------------------------------------------
  return (
    <div className="lobby-container">
      {/* زخارف الخلفية */}
      <div className="lobby-bg-decoration top-left" />
      <div className="lobby-bg-decoration bottom-right" />

      <div className="lobby-card animate-fade-in-up">
        {/* --- Header --- */}
        <div className="text-center mb-6">
          <div style={{ fontSize: "3.5rem", marginBottom: "12px", lineHeight: 1 }}>
            ♟
          </div>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #e8eaf0, #7eb8a4)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-0.02em",
              marginBottom: "6px",
            }}
          >
            Zen Chess
          </h1>
          <p className="text-secondary text-sm">شطرنج متعدد اللاعبين في الوقت الفعلي</p>

          {/* مؤشر حالة الاتصال */}
          <div
            className="flex items-center justify-center gap-2 mt-3"
            style={{ fontSize: "0.8rem" }}
          >
            <span
              className="status-dot"
              style={{
                background:
                  connectionStatus === "connected"
                    ? "var(--accent-success)"
                    : connectionStatus === "reconnecting"
                    ? "var(--accent-warning)"
                    : "var(--accent-danger)",
                animation:
                  connectionStatus === "reconnecting" ? "pulse 1s infinite" : "none",
              }}
            />
            <span className="text-muted">
              {connectionStatus === "connected"
                ? "متصل بالسيرفر"
                : connectionStatus === "reconnecting"
                ? "جاري إعادة الاتصال..."
                : "غير متصل"}
            </span>
          </div>
        </div>

        {/* --- Card Content --- */}
        <div className="glass-card-elevated p-8">
          {/* اختيار الاسم */}
          <div className="mb-4">
            <label
              className="text-secondary text-sm font-medium"
              style={{ display: "block", marginBottom: "8px" }}
            >
              اسمك في اللعبة
            </label>
            <input
              className="input"
              type="text"
              placeholder="أدخل اسمك..."
              value={playerName}
              maxLength={20}
              onChange={(e) => {
                setPlayerName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) =>
                handleKeyDown(
                  e,
                  view === "join" ? handleJoinRoom : handleCreateRoom
                )
              }
            />
          </div>

          {/* إدخال كود الغرفة في وضع الانضمام */}
          {view === "join" && (
            <div className="mb-4 animate-fade-in-up">
              <label
                className="text-secondary text-sm font-medium"
                style={{ display: "block", marginBottom: "8px" }}
              >
                كود الغرفة
              </label>
              <input
                className="input input-mono"
                type="text"
                placeholder="XXXXXX"
                value={roomCode}
                maxLength={6}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase());
                  setError("");
                }}
                onKeyDown={(e) => handleKeyDown(e, handleJoinRoom)}
                autoFocus
              />
            </div>
          )}

          {/* رسالة الخطأ */}
          {error && (
            <div
              className="animate-fade-in"
              style={{
                background: "rgba(224,112,112,0.1)",
                border: "1px solid rgba(224,112,112,0.25)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                color: "var(--accent-danger)",
                fontSize: "0.875rem",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>⚠</span> {error}
            </div>
          )}

          {/* الأزرار */}
          <div className="flex flex-col gap-3">
            {view === "home" ? (
              <>
                <button
                  id="btn-create-room"
                  className="btn btn-primary btn-lg btn-block stagger-children"
                  onClick={() => {
                    if (!playerName.trim()) {
                      setError("يرجى إدخال اسمك أولاً");
                      return;
                    }
                    setError("");
                    setView("create");
                  }}
                  disabled={!isConnected}
                >
                  <span>+</span>
                  إنشاء غرفة جديدة
                </button>

                <div className="divider">أو</div>

                <button
                  id="btn-join-room"
                  className="btn btn-secondary btn-lg btn-block"
                  onClick={() => {
                    if (!playerName.trim()) {
                      setError("يرجى إدخال اسمك أولاً");
                      return;
                    }
                    setError("");
                    setView("join");
                  }}
                  disabled={!isConnected}
                >
                  <span>→</span>
                  الانضمام لغرفة
                </button>
              </>
            ) : view === "create" ? (
              <>
                <button
                  id="btn-confirm-create"
                  className="btn btn-primary btn-lg btn-block"
                  onClick={handleCreateRoom}
                  disabled={loading || !isConnected}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: 18, height: 18 }} />
                      جاري الإنشاء...
                    </>
                  ) : (
                    "إنشاء الغرفة ✓"
                  )}
                </button>
                <button
                  className="btn btn-ghost btn-block"
                  onClick={() => { setView("home"); setError(""); }}
                >
                  ← رجوع
                </button>
              </>
            ) : (
              <>
                <button
                  id="btn-confirm-join"
                  className="btn btn-primary btn-lg btn-block"
                  onClick={handleJoinRoom}
                  disabled={loading || !isConnected}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: 18, height: 18 }} />
                      جاري الانضمام...
                    </>
                  ) : (
                    "انضم للغرفة →"
                  )}
                </button>
                <button
                  className="btn btn-ghost btn-block"
                  onClick={() => { setView("home"); setRoomCode(""); setError(""); }}
                >
                  ← رجوع
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p
          className="text-center text-muted mt-4"
          style={{ fontSize: "0.78rem" }}
        >
          ♟ Zen Chess • Real-time Multiplayer • v1.0
        </p>
      </div>
    </div>
  );
}

// ============================================================
// WaitingRoom — شاشة الانتظار بعد إنشاء الغرفة
// ============================================================
function WaitingRoom({ roomId, playerName }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="lobby-container">
      <div className="lobby-bg-decoration top-left" />
      <div className="lobby-bg-decoration bottom-right" />

      <div className="lobby-card animate-scale-in">
        <div className="glass-card-elevated p-8 text-center">
          {/* أيقونة الانتظار المتحركة */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(126,184,164,0.1)",
              border: "2px solid var(--border-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.8rem",
              margin: "0 auto 20px",
              animation: "pulse 2s ease infinite",
            }}
          >
            ♟
          </div>

          <h2 className="text-xl font-medium mb-2">
            في انتظار الخصم...
          </h2>
          <p className="text-secondary text-sm mb-6">
            شارك هذا الكود مع صديقك ليلتحق بالغرفة
          </p>

          {/* كود الغرفة */}
          <div
            className="room-code mb-4"
            onClick={copyCode}
            title="انقر للنسخ"
            id="room-code-display"
          >
            {roomId}
          </div>

          <button
            className={`btn btn-sm mb-6 ${copied ? "btn-success" : "btn-secondary"}`}
            style={
              copied
                ? {
                    background: "rgba(126,201,154,0.15)",
                    color: "var(--accent-success)",
                    border: "1px solid rgba(126,201,154,0.3)",
                  }
                : {}
            }
            onClick={copyCode}
          >
            {copied ? "✓ تم النسخ!" : "نسخ الكود"}
          </button>

          {/* نقاط الانتظار */}
          <div
            className="flex items-center justify-center gap-2 text-secondary text-sm"
          >
            <span className="animate-pulse">●</span>
            <span className="animate-pulse" style={{ animationDelay: "0.3s" }}>●</span>
            <span className="animate-pulse" style={{ animationDelay: "0.6s" }}>●</span>
            <span style={{ marginRight: "8px" }}>بانتظار لاعب آخر</span>
          </div>

          {/* معلومات اللاعب */}
          <div
            className="mt-6 p-4 rounded-md"
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="player-avatar player-avatar-white"
                style={{ width: 36, height: 36, fontSize: "0.9rem" }}
              >
                {playerName.charAt(0).toUpperCase()}
              </div>
              <div className="text-right flex-1">
                <div className="font-medium text-sm">{playerName}</div>
                <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                  أنت • اللون الأبيض ♙
                </div>
              </div>
              <span className="status-dot online" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
