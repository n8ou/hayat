import React, { createContext, useContext, useReducer, useCallback } from "react";

// ============================================================
// Game Context — إدارة حالة اللعبة المركزية
// ============================================================

const GameContext = createContext(null);

const initialState = {
  // بيانات الجلسة
  playerName: "",
  playerId: null,
  playerColor: null,    // 'white' | 'black'
  roomId: null,

  // حالة اللعبة
  gameStatus: "idle",   // 'idle' | 'waiting' | 'playing' | 'finished'
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  pgn: [],
  turn: "w",            // 'w' | 'b'

  // بيانات اللاعبين
  players: {
    white: null,        // { name, id }
    black: null,
  },

  // نتيجة اللعبة
  result: null,         // { winner, reason }

  // حالة الاتصال
  connectionStatus: "disconnected", // 'connected' | 'disconnected' | 'reconnecting'

  // طلب إعادة مباراة
  rematchRequested: false,
  rematchFrom: null,

  // رسائل النظام
  notifications: [],
};

// ============================================================
// Reducer — معالجة التحولات في الحالة
// ============================================================
function gameReducer(state, action) {
  switch (action.type) {
    case "SET_PLAYER_NAME":
      return { ...state, playerName: action.payload };

    case "ROOM_CREATED":
    case "ROOM_JOINED":
      return {
        ...state,
        roomId: action.payload.roomId,
        playerId: action.payload.playerId,
        playerColor: action.payload.color,
        gameStatus: action.payload.room.status,
        fen: action.payload.room.fen,
        pgn: action.payload.room.pgn || [],
        turn: action.payload.room.turn,
        players: action.payload.room.players,
        result: null,
        rematchRequested: false,
        rematchFrom: null,
      };

    case "OPPONENT_JOINED":
      return {
        ...state,
        players: action.payload.room.players,
        gameStatus: action.payload.room.status,
      };

    case "GAME_START":
      return {
        ...state,
        gameStatus: "playing",
        players: action.payload.room.players,
        fen: action.payload.room.fen,
        turn: action.payload.room.turn,
        result: null,
      };

    case "MOVE_MADE":
      return {
        ...state,
        fen: action.payload.fen,
        pgn: action.payload.pgn || state.pgn,
        turn: action.payload.turn,
      };

    case "GAME_OVER":
      return {
        ...state,
        gameStatus: "finished",
        result: action.payload.result,
      };

    case "REMATCH_REQUESTED":
      return {
        ...state,
        rematchRequested: true,
        rematchFrom: action.payload.from,
      };

    case "REMATCH_STARTED":
      return {
        ...state,
        playerColor: action.payload.room.players.white?.id === state.playerId
          ? "white"
          : "black",
        fen: action.payload.room.fen,
        pgn: [],
        turn: action.payload.room.turn,
        players: action.payload.room.players,
        gameStatus: "playing",
        result: null,
        rematchRequested: false,
        rematchFrom: null,
      };

    case "SET_CONNECTION_STATUS":
      return { ...state, connectionStatus: action.payload };

    case "ADD_NOTIFICATION":
      return {
        ...state,
        notifications: [
          ...state.notifications,
          { id: Date.now(), ...action.payload },
        ],
      };

    case "REMOVE_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter((n) => n.id !== action.payload),
      };

    case "RESET_GAME":
      return {
        ...initialState,
        playerName: state.playerName,
        connectionStatus: state.connectionStatus,
      };

    default:
      return state;
  }
}

// ============================================================
// Provider Component
// ============================================================
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const addNotification = useCallback((type, message, duration = 4000) => {
    const id = Date.now();
    dispatch({ type: "ADD_NOTIFICATION", payload: { id, type, message } });
    if (duration > 0) {
      setTimeout(() => {
        dispatch({ type: "REMOVE_NOTIFICATION", payload: id });
      }, duration);
    }
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    dispatch({ type: "REMOVE_NOTIFICATION", payload: id });
  }, []);

  return (
    <GameContext.Provider value={{ state, dispatch, addNotification, removeNotification }}>
      {children}
    </GameContext.Provider>
  );
}

// ============================================================
// Custom Hook
// ============================================================
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
