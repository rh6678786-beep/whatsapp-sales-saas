import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(adminId: string | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!adminId) return;

    const token = sessionStorage.getItem("authToken") || undefined;
    const socket = io("", {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      console.warn("[WS] Connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [adminId]); // Reconnect if adminId changes

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { on, emit, socket: socketRef };
}
