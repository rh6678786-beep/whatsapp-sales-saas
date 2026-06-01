import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken } from "../services/authService.js";

let io: Server | null = null;

export function getIO(): Server | null {
  return io;
}

export function setupWebSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token as string;
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        socket.data.adminId = payload.adminId;
        return next();
      }
    }
    // Allow anonymous connections but with limited access
    next();
  });

  io.on("connection", (socket: Socket) => {
    const adminId = socket.data.adminId || (socket.handshake.query.adminId as string);
    if (adminId) {
      socket.join(`admin:${adminId}`);
      if (!socket.data.adminId) socket.data.adminId = adminId;
    }

    socket.on("subscribe:admin", (id: string) => {
      const tokenAdminId = socket.data.adminId;
      if (tokenAdminId && tokenAdminId !== id) {
        // Authenticated users can only subscribe to their own admin
        return;
      }
      socket.join(`admin:${id}`);
      socket.data.adminId = id;
    });

    socket.on("disconnect", () => {});
  });

  console.log("[WS] WebSocket server initialized");
  return io;
}

export function emitToAdmin(adminId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`admin:${adminId}`).emit(event, data);
}

export function emitToAll(event: string, data: any): void {
  if (!io) return;
  io.emit(event, data);
}
