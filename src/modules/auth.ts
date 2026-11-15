import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { signToken } from "../lib/jwt.js";
import { logger } from "../lib/logger.js";
import { sendRecoveryEmail } from "../lib/mailer.js";
import { body } from "../middlewares/validate.js";
import { authLimiter, recoveryLimiter } from "../middlewares/rate-limit.js";
import { User } from "../models/User.js";

const BCRYPT_ROUNDS = 12;
const RESET_TTL_MS = 15 * 60_000;
const RESET_MAX_ATTEMPTS = 5;

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, "password must have at least 8 characters").max(128);
const code = z.string().regex(/^\d{6}$/);

const hashCode = (c: string) => createHash("sha256").update(c).digest();

/** Confere o código de recuperação (tempo constante, validade e tentativas). */
async function checkResetCode(emailAddr: string, given: string) {
  const user = await User.findOne({ email: emailAddr }).select("+passwordReset");
  const reset = user?.passwordReset;
  if (!user || !reset?.codeHash || !reset.expiresAt) return null;
  if (reset.expiresAt.getTime() < Date.now() || (reset.attempts ?? 0) >= RESET_MAX_ATTEMPTS) return null;

  const ok = timingSafeEqual(hashCode(given), Buffer.from(reset.codeHash, "hex"));
  if (!ok) {
    await User.updateOne({ _id: user._id }, { $inc: { "passwordReset.attempts": 1 } });
    return null;
  }
  return user;
}

export const authRouter = Router();

authRouter.post(
  "/signup",
  authLimiter,
  body(z.object({ name: z.string().trim().min(1).max(80), email, password })),
  async (req, res) => {
    const { name, email: addr, password: pass } = req.body;
    if (await User.exists({ email: addr })) {
      return res.status(200).send({ success: false, message: "User Alredy exist" });
    }
    const user = await User.create({ name, email: addr, password: await bcrypt.hash(pass, BCRYPT_ROUNDS) });
    res.status(201).send({ success: true, _id: user._id, token: signToken(String(user._id)) });
  },
);

authRouter.post(
  "/login",
  authLimiter,
  body(z.object({ email, password: z.string().min(1).max(128) })),
  async (req, res) => {
    const { email: addr, password: pass } = req.body;
    const user = await User.findOne({ email: addr }).select("+password");
    // mesma resposta para e-mail inexistente e senha errada (não revela quem tem conta)
    const ok = user ? await bcrypt.compare(pass, user.password) : false;
    if (!user || !ok || user.status === "blocked") {
      return res.status(401).send({ success: false, message: "User or password do not match" });
    }
    res.status(200).send({ success: true, user_id: user._id, token: signToken(String(user._id)) });
  },
);

authRouter.post("/forgot/pass", recoveryLimiter, body(z.object({ email })), async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const generated = String(randomInt(100000, 1000000));
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordReset: {
            codeHash: hashCode(generated).toString("hex"),
            expiresAt: new Date(Date.now() + RESET_TTL_MS),
            attempts: 0,
          },
        },
      },
    );
    try {
      await sendRecoveryEmail(user.email, user.name, generated);
    } catch (err) {
      logger.error({ err }, "falha ao enviar e-mail de recuperação");
    }
  }
  // resposta igual exista ou não a conta
  res.send({ success: true, message: "If the email exists, a recovery code was sent" });
});

authRouter.post("/confirm/recovery/code", recoveryLimiter, body(z.object({ email, code })), async (req, res) => {
  const user = await checkResetCode(req.body.email, req.body.code);
  if (!user) return res.status(400).send({ success: false, message: "wrong_pin" });
  res.send({ success: true, message: "corrent_pin" });
});

authRouter.patch(
  "/update/user/password",
  recoveryLimiter,
  body(
    z
      .object({ email, code, password, confirmPassword: z.string() })
      .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"] }),
  ),
  async (req, res) => {
    const user = await checkResetCode(req.body.email, req.body.code);
    if (!user) return res.status(400).send({ success: false, message: "wrong_pin" });
    await User.updateOne(
      { _id: user._id },
      { $set: { password: await bcrypt.hash(req.body.password, BCRYPT_ROUNDS) }, $unset: { passwordReset: 1 } },
    );
    res.status(201).send({ success: true, id: user._id, token: signToken(String(user._id)) });
  },
);
