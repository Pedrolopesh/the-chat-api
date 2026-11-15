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

/** pedido e confirmação de código: contra abuso e força bruta */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 20 });



