import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyToken } from "../lib/jwt.js";
import { logger } from "../lib/logger.js";
import { Chat } from "../models/Chat.js";

let io: Server | null = null;

export const room = (chatId: string) => `chat:${chatId}`;

/** Usuário participa da conversa? (origem ou destino) */
export async function isMember(chatId: string, userId: string) {
  return Boolean(
    await Chat.exists({ _id: chatId, $or: [{ user_origin: userId }, { user_response: userId }] }),
  );
}

/**
 * Tempo real com socket.io:
 *  - conexão exige o JWT (auth.token no handshake);
 *  - o cliente entra só nas salas das conversas de que participa ("join");
 *  - mensagens novas são emitidas pelo servidor depois de salvas
 *    (PUT /send/message), nunca repassadas de um cliente para todos.
 */
export function attachSocket(server: HttpServer, origins: string[]) {
  io = new Server(server, {
    cors: { origin: origins.length ? origins : false, credentials: false },
    maxHttpBufferSize: 16 * 1024,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const userId = typeof token === "string" ? verifyToken(token) : null;
    if (!userId) return next(new Error("unauthorized"));
    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    socket.on("join", async (chatId: unknown, ack?: (ok: boolean) => void) => {
      try {
        const ok = typeof chatId === "string" && /^[a-f\d]{24}$/i.test(chatId) && (await isMember(chatId, socket.data.userId));
        if (ok) await socket.join(room(chatId as string));
        if (typeof ack === "function") ack(ok);
      } catch (err) {
        logger.warn({ err }, "falha ao entrar na sala");
        if (typeof ack === "function") ack(false);
      }
    });
    socket.on("leave", (chatId: unknown) => {
      if (typeof chatId === "string") void socket.leave(room(chatId));
    });
  });

  return io;
}

export function emitToChat(chatId: string, event: string, payload: unknown) {
  io?.to(room(chatId)).emit(event, payload);
}

export async function closeSocket() {
  await io?.close();
  io = null;
}
