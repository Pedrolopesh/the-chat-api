import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).send({ success: false, message: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).send({ success: false, message: err.message, ...err.body });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).send({ success: false, message: err.code === "LIMIT_FILE_SIZE" ? "file too large" : "invalid upload" });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).send({ success: false, message: "invalid json" });
  }
  // detalhes do erro ficam só no log, nunca na resposta
  logger.error({ err, path: req.path }, "erro não tratado");
  res.status(500).send({ success: false, message: "Internal server error" });
}
