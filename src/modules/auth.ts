import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { signToken } from "../lib/jwt.js";
import { sendLoginCode } from "../lib/mailer.js";
import { authLimiter } from "../middlewares/rate-limit.js";
import { body } from "../middlewares/validate.js";
import { User } from "../models/User.js";

/** validade do código, tentativas erradas por código e intervalo mínimo entre e-mails */
export const CODE_TTL_MS = 15 * 60_000;
export const CODE_MAX_ATTEMPTS = 5;
export const RESEND_INTERVAL_MS = 60_000;

const email = z.string().trim().toLowerCase().email().max(254);
const code = z.string().regex(/^\d{6}$/);

export const hashCode = (userId: string, c: string) => createHash("sha256").update(`${userId}:${c}`).digest("hex");
const sameHash = (a: string, b: string) => timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
const nameFromEmail = (addr: string) => addr.split("@")[0].replace(/[._-]+/g, " ").trim().slice(0, 80) || "Usuário";

/**
 * Gera e envia um código novo, respeitando 60 s entre envios. A reserva é
 * um update condicional: dois pedidos simultâneos nunca mandam dois e-mails.
 */
async function issueCode(userId: string, to: string) {
  const now = new Date();
  const generated = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const reserved = await User.updateOne(
    {
      _id: userId,
      $or: [{ "loginCode.sentAt": { $exists: false } }, { "loginCode.sentAt": { $lte: new Date(now.getTime() - RESEND_INTERVAL_MS) } }],
    },
    {
      $set: {
        loginCode: { codeHash: hashCode(userId, generated), expiresAt: new Date(now.getTime() + CODE_TTL_MS), attempts: 0, sentAt: now },
      },
    },
  );
  if (reserved.modifiedCount !== 1) return;
  await sendLoginCode(to, generated);
}

/**
 * Consome o código: uso único e no máximo 5 tentativas. Cada tentativa é
 * reservada com update condicional, então requisições paralelas não passam
 * do limite.
 */
async function consumeCode(emailAddr: string, given: string) {
  const user = await User.findOneAndUpdate(
    {
      email: emailAddr,
      status: { $ne: "blocked" },
      "loginCode.expiresAt": { $gt: new Date() },
      "loginCode.attempts": { $lt: CODE_MAX_ATTEMPTS },
    },
    { $inc: { "loginCode.attempts": 1 } },
    { new: true },
  ).select("+loginCode");
  const stored = user?.loginCode?.codeHash;
  if (!user || !stored || !sameHash(stored, hashCode(String(user._id), given))) return null;

  // uso único mesmo com duas confirmações ao mesmo tempo
  const claimed = await User.updateOne(
    { _id: user._id, "loginCode.codeHash": stored },
    { $unset: { loginCode: 1 }, $set: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() } },
  );
  return claimed.modifiedCount === 1 ? user : null;
}

export const authRouter = Router();

/**
 * Entrada sem senha, passo 1: responde sempre igual (202), exista ou não a
 * conta. E-mail novo ganha uma conta pendente; todo e-mail recebe código.
 */
authRouter.post(
  "/auth/email/start",
  authLimiter,
  body(z.object({ email, name: z.string().trim().min(1).max(80).optional() })),
  async (req, res) => {
    const { email: addr, name } = req.body as { email: string; name?: string };
    let user = await User.findOne({ email: addr });
    if (!user) {
      try {
        user = await User.create({ email: addr, name: name ?? nameFromEmail(addr) });
      } catch (err) {
        // dois pedidos simultâneos para o mesmo e-mail novo: o outro criou
        if ((err as { code?: number }).code !== 11000) throw err;
        user = await User.findOne({ email: addr });
      }
    }
    if (user && user.status !== "blocked") await issueCode(String(user._id), user.email);
    res.status(202).send({ success: true, message: "If the email is valid, a code was sent" });
  },
);

/** Passo 2: troca o código por um token. */
authRouter.post("/auth/email/confirm", authLimiter, body(z.object({ email, code })), async (req, res) => {
  const wasNew = await User.exists({ email: req.body.email, emailVerifiedAt: null });
  const user = await consumeCode(req.body.email, req.body.code);
  if (!user) return res.status(400).send({ success: false, message: "invalid_code" });
  res.send({
    success: true,
    user_id: user._id,
    token: signToken(String(user._id)),
    isNew: Boolean(wasNew),
  });
});
