import React from "react";
import { useGame } from "../context/GameContext";

// ============================================================
// Toast Notifications — نظام الإشعارات العائمة
// ============================================================
export default function ToastContainer() {
  const { state, removeNotification } = useGame();
  const { notifications } = state;

  if (!notifications || notifications.length === 0) return null;

  const icons = {
    info:    "ℹ",
    success: "✓",
    warning: "⚠",
    error:   "✕",
  };

  return (
    <div className="toast-container" aria-live="polite">
      {notifications.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type || "info"} animate-slide-in`}
          role="alert"
        >
          <span style={{ fontSize: "1rem", flexShrink: 0 }}>
            {icons[toast.type] || icons.info}
          </span>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            onClick={() => removeNotification(toast.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              opacity: 0.6,
              fontSize: "1rem",
              lineHeight: 1,
              padding: "0 4px",
              flexShrink: 0,
            }}
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
