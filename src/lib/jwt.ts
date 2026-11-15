import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

type Payload = { id: string };

export function signToken(userId: string): string {
  return jwt.sign({ id: userId } satisfies Payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

/** Retorna o id do usuário ou null se o token for inválido/expirado. */
export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof decoded === "object" && typeof decoded.id === "string") return decoded.id;
    return null;
  } catch {
    return null;
  }
}
