import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

export function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).send({ error: "No token provided" });

  const [scheme, token] = header.split(" ");
  if (!/^Bearer$/i.test(scheme ?? "") || !token) return res.status(401).send({ error: "Token malformatted" });

  const userId = verifyToken(token);
  if (!userId) return res.status(401).send({ error: "Token invalid" });

  req.userId = userId;
  next();
}

/** id do usuário autenticado (só usar depois do middleware auth). */
export const me = (req: Request) => req.userId as string;
