import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "";

export function useSocket(adminId: string | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!adminId) return;
    const token = localStorage.getItem("authToken") || undefined;
    const socket = io(SOCKET_URL, {
      auth: { token },
      query: { adminId },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [adminId]);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => { socketRef.current?.off(event, handler); };
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { on, emit, socket: socketRef };
}
