import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken } from "../services/authService.js";
import { verifyTeamToken } from "../services/teamAuthService.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("websocket");

let io: Server | null = null;

export function getIO(): Server | null {
  return io;
}

export function setupWebSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === "production"
        ? process.env.APP_URL || false
        : "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Authentication middleware — REQUIRED for all connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    // Try admin token
    const payload = verifyToken(token);
    if (payload) {
      socket.data.adminId = payload.adminId;
      socket.data.authType = "admin";
      return next();
    }

    // Try team token
    const teamPayload = verifyTeamToken(token);
    if (teamPayload) {
      socket.data.adminId = teamPayload.adminId;
      socket.data.memberId = teamPayload.memberId;
      socket.data.role = teamPayload.role;
      socket.data.authType = "team";
      return next();
    }

    return next(new Error("Invalid or expired token"));
  });

  io.on("connection", (socket: Socket) => {
    const adminId = socket.data.adminId as string;
    const authType = socket.data.authType as string;

    // Automatically join the admin's own room based on authenticated token
    socket.join(`admin:${adminId}`);
    log.info({ adminId, authType }, "WebSocket client connected");

    // Subscribe to a specific admin room — only allowed if the token's adminId matches
    socket.on("subscribe:admin", (targetAdminId: string) => {
      const tokenAdminId = socket.data.adminId as string;

      // SECURITY: A user can only subscribe to their OWN admin's room
      if (tokenAdminId !== targetAdminId) {
        log.warn(
          { tokenAdminId, targetAdminId },
          "Blocked unauthorized WebSocket subscribe:admin attempt"
        );
        socket.emit("error", { message: "Forbidden: cannot subscribe to another admin's room" });
        return;
      }

      // Already joined on connection, but if re-joining is needed:
      socket.join(`admin:${targetAdminId}`);
    });

    socket.on("disconnect", () => {
      log.info({ adminId, authType }, "WebSocket client disconnected");
    });
  });

  log.info("WebSocket server initialized with authenticated rooms");
  return io;
}

export function emitToAdmin(adminId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`admin:${adminId}`).emit(event, data);
}

export function emitToAll(event: string, data: unknown): void {
  if (!io) return;
  io.emit(event, data);
}
