import { useEffect, useCallback } from "react";
import socket from "../socket";
import { useGame } from "../context/GameContext";

// ============================================================
// useSocket — Hook مركزي لإدارة جميع أحداث Socket.io
// ============================================================
export default function useSocket() {
  const { state, dispatch, addNotification } = useGame();

  // ----------------------------------------------------------
  // الاتصال بالسيرفر
  // ----------------------------------------------------------
  const connect = useCallback(() => {
    if (!socket.connected) {
      socket.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    socket.disconnect();
  }, []);

  // ----------------------------------------------------------
  // إنشاء غرفة
  // ----------------------------------------------------------
  const createRoom = useCallback(
    (playerName) =>
      new Promise((resolve, reject) => {
        socket.emit("create_room", { playerName }, (response) => {
          if (response.success) {
            dispatch({ type: "ROOM_CREATED", payload: response });
            resolve(response);
          } else {
            reject(new Error(response.error));
          }
        });
      }),
    [dispatch]
  );

  // ----------------------------------------------------------
  // الانضمام لغرفة
  // ----------------------------------------------------------
  const joinRoom = useCallback(
    (roomId, playerName) =>
      new Promise((resolve, reject) => {
        socket.emit(
          "join_room",
          { roomId: roomId.toUpperCase().trim(), playerName },
          (response) => {
            if (response.success) {
              dispatch({ type: "ROOM_JOINED", payload: response });
              resolve(response);
            } else {
              reject(new Error(response.error));
            }
          }
        );
      }),
    [dispatch]
  );

  // ----------------------------------------------------------
  // إرسال حركة
  // ----------------------------------------------------------
  const makeMove = useCallback(
    (moveData) => {
      socket.emit("make_move", {
        roomId: state.roomId,
        ...moveData,
      });
    },
    [state.roomId]
  );

  // ----------------------------------------------------------
  // طلب إعادة مباراة
  // ----------------------------------------------------------
  const requestRematch = useCallback(() => {
    socket.emit("request_rematch", { roomId: state.roomId });
  }, [state.roomId]);

  const acceptRematch = useCallback(() => {
    socket.emit("accept_rematch", { roomId: state.roomId });
  }, [state.roomId]);

  // ----------------------------------------------------------
  // الاستسلام
  // ----------------------------------------------------------
  const resign = useCallback(() => {
    socket.emit("resign", { roomId: state.roomId });
  }, [state.roomId]);

  // ----------------------------------------------------------
  // العودة للـ Lobby
  // ----------------------------------------------------------
  const leaveRoom = useCallback(() => {
    disconnect();
    dispatch({ type: "RESET_GAME" });
  }, [disconnect, dispatch]);

  // ----------------------------------------------------------
  // تسجيل أحداث Socket
  // ----------------------------------------------------------
  useEffect(() => {
    connect();

    // --- أحداث الاتصال ---
    const onConnect = () => {
      dispatch({ type: "SET_CONNECTION_STATUS", payload: "connected" });

      // محاولة إعادة الانضمام إن كانت هناك جلسة سابقة
      const savedSession = sessionStorage.getItem("chess_session");
      if (savedSession) {
        try {
          const { roomId, playerId } = JSON.parse(savedSession);
          socket.emit("rejoin_room", { roomId, playerId }, (response) => {
            if (response.success) {
              dispatch({ type: "ROOM_JOINED", payload: response });
              addNotification("success", "تمت إعادة الاتصال بالغرفة ✓");
            } else {
              sessionStorage.removeItem("chess_session");
            }
          });
        } catch {
          sessionStorage.removeItem("chess_session");
        }
      }
    };

    const onDisconnect = (reason) => {
      dispatch({ type: "SET_CONNECTION_STATUS", payload: "disconnected" });
      if (reason !== "io client disconnect") {
        addNotification("warning", "انقطع الاتصال بالسيرفر، جاري إعادة الاتصال...", 6000);
      }
    };

    const onReconnecting = () => {
      dispatch({ type: "SET_CONNECTION_STATUS", payload: "reconnecting" });
    };

    const onConnectError = () => {
      addNotification("error", "تعذّر الاتصال بالسيرفر", 5000);
    };

    // --- أحداث اللعبة ---
    const onOpponentJoined = (data) => {
      dispatch({ type: "OPPONENT_JOINED", payload: data });
      addNotification("success", `انضم ${data.opponentName} إلى الغرفة! 🎉`);
    };

    const onGameStart = (data) => {
      dispatch({ type: "GAME_START", payload: data });
    };

    const onMoveReceived = (data) => {
      dispatch({ type: "MOVE_MADE", payload: data });
    };

    const onGameOver = (data) => {
      dispatch({ type: "GAME_OVER", payload: data });
    };

    const onOpponentDisconnected = ({ color }) => {
      addNotification(
        "warning",
        `انقطع اتصال الخصم. سيُمنح له 30 ثانية للعودة...`,
        8000
      );
    };

    const onOpponentReconnected = () => {
      addNotification("success", "عاد الخصم إلى اللعبة ✓");
    };

    const onRematchRequested = (data) => {
      dispatch({ type: "REMATCH_REQUESTED", payload: data });
      addNotification("info", "الخصم يطلب إعادة مباراة!", 0);
    };

    const onRematchStarted = (data) => {
      dispatch({ type: "REMATCH_STARTED", payload: data });
      addNotification("success", "بدأت مباراة جديدة! ألوان اللاعبين تبدّلت 🔄");
    };

    const onMoveError = ({ error }) => {
      addNotification("error", error, 3000);
    };

    // تسجيل المستمعين
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("reconnecting", onReconnecting);
    socket.on("connect_error", onConnectError);
    socket.on("opponent_joined", onOpponentJoined);
    socket.on("game_start", onGameStart);
    socket.on("move_received", onMoveReceived);
    socket.on("game_over", onGameOver);
    socket.on("opponent_disconnected", onOpponentDisconnected);
    socket.on("opponent_reconnected", onOpponentReconnected);
    socket.on("rematch_requested", onRematchRequested);
    socket.on("rematch_started", onRematchStarted);
    socket.on("move_error", onMoveError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("reconnecting", onReconnecting);
      socket.off("connect_error", onConnectError);
      socket.off("opponent_joined", onOpponentJoined);
      socket.off("game_start", onGameStart);
      socket.off("move_received", onMoveReceived);
      socket.off("game_over", onGameOver);
      socket.off("opponent_disconnected", onOpponentDisconnected);
      socket.off("opponent_reconnected", onOpponentReconnected);
      socket.off("rematch_requested", onRematchRequested);
      socket.off("rematch_started", onRematchStarted);
      socket.off("move_error", onMoveError);
    };
  }, [connect, dispatch, addNotification]);

  // حفظ بيانات الجلسة عند تغيرها
  useEffect(() => {
    if (state.roomId && state.playerId) {
      sessionStorage.setItem(
        "chess_session",
        JSON.stringify({ roomId: state.roomId, playerId: state.playerId })
      );
    }
  }, [state.roomId, state.playerId]);

  return {
    socket,
    connectionStatus: state.connectionStatus,
    createRoom,
    joinRoom,
    makeMove,
    requestRematch,
    acceptRematch,
    resign,
    leaveRoom,
  };
}
