import { Router } from "express";
import { z } from "zod";
import { badRequest, forbidden, notFound } from "../lib/http-error.js";
import { auth, me } from "../middlewares/auth.js";
import { body, idParam, objectId } from "../middlewares/validate.js";
import { Chat } from "../models/Chat.js";
import { PUBLIC_USER_FIELDS, User } from "../models/User.js";
import { emitToChat, emitToUser } from "../socket/index.js";
import { logger } from "../lib/logger.js";
import { notifyUser } from "./push.js";

const message = z.object({
  sender: z.enum(["origin", "response"]).optional(),
  message: z.string().trim().min(1).max(4000),
  timestamp: z.string().max(32).optional(),
});

const memberOf = (userId: string) => ({ $or: [{ user_origin: userId }, { user_response: userId }] });

/** O papel ("origin"/"response") vem de quem está logado, não do cliente. */
function roleIn(chat: { user_origin: unknown[]; user_response: unknown[] }, userId: string) {
  if (chat.user_origin.some((u) => String(u) === userId)) return "origin" as const;
  if (chat.user_response.some((u) => String(u) === userId)) return "response" as const;
  return null;
}

export const chatsRouter = Router();
chatsRouter.use(auth);

chatsRouter.post(
  "/create/chat",
  body(z.object({ user_origin: objectId.optional(), user_response: objectId, chatData: z.array(message).max(1).default([]) })),
  async (req, res) => {
    const origin = me(req); // quem cria a conversa é sempre quem está logado
    const target = req.body.user_response as string;
    if (target === origin) throw badRequest("You can't start a chat with yourself");

    const existing = await Chat.findOne({
      $or: [
        { user_origin: origin, user_response: target },
        { user_origin: target, user_response: origin },
      ],
    }).lean();
    if (existing) return res.status(200).send({ success: false, error: "Alredy have a chat", message: existing });

    if (!(await User.exists({ _id: target }))) throw notFound("user not found");

    const chat = await Chat.create({
      user_origin: [origin],
      user_response: [target],
      status: "new",
      chatData: req.body.chatData.map((m: z.infer<typeof message>) => ({ ...m, sender: "origin" })),
    });
    await User.updateMany({ _id: { $in: [origin, target] } }, { $addToSet: { chats: chat._id } });
    emitToUser(target, "chatCreated", { chat_id: String(chat._id) });
    res.send({ success: true, message: "Success to create chat", doc: chat });
  },
);

chatsRouter.put(
  "/send/message",
  body(z.object({ chat_id: objectId, chatData: message })),
  async (req, res) => {
    const userId = me(req);
    const chat = await Chat.findById(req.body.chat_id).select("user_origin user_response").lean();
    if (!chat) throw notFound("Chat não encontrado");
    const sender = roleIn(chat, userId);
    if (!sender) throw forbidden("You are not part of this chat");

    const msg = { ...req.body.chatData, sender };
    const updated = await Chat.findByIdAndUpdate(chat._id, { $push: { chatData: msg } }, { new: true }).lean();
    const members = [...chat.user_origin, ...chat.user_response].map(String);
    emitToChat(String(chat._id), "messageRecived", { chat_id: String(chat._id), ...msg }, members);

    // push para o outro participante (sem esperar; falha não afeta o envio)
    const other = String((sender === "origin" ? chat.user_response : chat.user_origin)[0]);
    void User.findById(userId)
      .select("name")
      .lean()
      .then((author) =>
        notifyUser(other, {
          title: author?.name ?? "The Chat",
          body: msg.message.length > 120 ? `${msg.message.slice(0, 117)}…` : msg.message,
          url: `/chats/${String(chat._id)}`,
        }),
      )
      .catch((err) => logger.warn({ err }, "falha no push da mensagem"));
    res.status(200).send({ message: "Mensagem enviada", data: updated });
  },
);

/** Antes listava TODAS as conversas do sistema; agora só as do usuário. */
chatsRouter.get("/list/chats", async (req, res) => {
  const chats = await Chat.find(memberOf(me(req))).sort({ updatedAt: -1 }).lean();
  res.json({ success: true, message: chats });
});

chatsRouter.get("/chat/messages/:id", idParam, async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.id, ...memberOf(me(req)) })
    .populate("user_origin", PUBLIC_USER_FIELDS)
    .populate("user_response", PUBLIC_USER_FIELDS)
    .lean();
  if (!chat) throw notFound("Chat não encontrado");
  res.json(chat);
});

chatsRouter.get("/chats/userid/:id", idParam, async (req, res) => {
  const userId = me(req);
  if (req.params.id !== userId) throw forbidden("You can only list your own chats");
  const populate = (q: ReturnType<typeof Chat.find>) =>
    q.populate("user_origin", PUBLIC_USER_FIELDS).populate("user_response", PUBLIC_USER_FIELDS).lean();
  const [asResponse, asOrigin] = await Promise.all([
    populate(Chat.find({ user_response: userId })),
    populate(Chat.find({ user_origin: userId })),
  ]);
  res.send({ success: true, user_response_mesage: asResponse, user_origin_message: asOrigin });
});
