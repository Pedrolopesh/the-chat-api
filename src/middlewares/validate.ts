import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

export const objectId = z.string().refine((v) => isValidObjectId(v), "invalid id");

/** Valida e normaliza req.body. Erro → 400 com os campos inválidos. */
export const body =
  (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).send({
        success: false,
        message: "Please fill in all fields",
        fields: parsed.error.issues.map((i) => i.path.join(".")),
      });
    }
    req.body = parsed.data;
    next();
  };

/** Garante que :id é um ObjectId válido (evita CastError e consultas estranhas). */
export function idParam(req: Request, res: Response, next: NextFunction) {
  if (!isValidObjectId(req.params.id)) return res.status(400).send({ success: false, message: "invalid id" });
  next();
}
