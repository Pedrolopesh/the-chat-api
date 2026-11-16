import { Router } from "express";
import { features } from "../config/env.js";
import { AVATAR_KEY, getObject } from "../lib/storage.js";

/**
 * Serve as fotos de perfil a partir do bucket privado. Só chaves no
 * formato de avatar gerado pela API (nada de listar nem ler backups).
 */
export const filesRouter = Router();

filesRouter.get(/^\/files\/(.+)$/, async (req, res) => {
  const key = (req.params as Record<string, string>)[0] ?? "";
  if (!features.storage || !AVATAR_KEY.test(key)) return res.status(404).send({ success: false, message: "Not found" });

  const obj = await getObject(key);
  if (!obj) return res.status(404).send({ success: false, message: "Not found" });

  res.set({
    "Content-Type": obj.contentType ?? "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
    // a imagem é exibida no front (outro domínio)
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
  });
  if (obj.length) res.set("Content-Length", String(obj.length));
  obj.body.on("error", () => res.destroy());
  obj.body.pipe(res);
});
