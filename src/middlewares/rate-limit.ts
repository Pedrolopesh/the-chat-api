import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

const common = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: { success: false, message: "Too many requests, try again later" },
};

/** limite geral da API */
export const apiLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 300 });

/** login/cadastro: contra força bruta */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 20 });

/** recuperação de senha: e-mails e tentativas de código */
export const recoveryLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 10 });
