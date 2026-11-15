import { Router } from "express";
import { z } from "zod";
import { env, features } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { sendPush } from "../lib/push.js";
import { auth, me } from "../middlewares/auth.js";
import { body } from "../middlewares/validate.js";
import { Subscription } from "../models/Subscription.js";

const subscription = z.object({
  endpoint: z.string().url().max(2048).refine((u) => u.startsWith("https://"), "must be https"),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});

export const pushRouter = Router();

/** Chave pública VAPID para o front (pública por definição). */
pushRouter.get("/push/key", (_req, res) => {
  res.send({ success: features.push, publicKey: features.push ? env.VAPID_PUBLIC_KEY : null });
});

pushRouter.use(auth);

pushRouter.post("/subscribe", body(z.object({ subscribeData: subscription }).passthrough()), async (req, res) => {
  const { endpoint, keys } = req.body.subscribeData;
  await Subscription.findOneAndUpdate(
    { endpoint },
    { user: me(req), endpoint, keys },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.status(200).send({ success: true, sucess: true, message: "subscription created in user" });
});

/** Notificação de teste: só para o próprio usuário. */
pushRouter.post("/notification/send", async (req, res) => {
  if (!features.push) throw new HttpError(503, "Push unavailable");
  const subs = await Subscription.find({ user: me(req) }).lean();
  let sent = 0;
  for (const s of subs) {
    try {
      if (await sendPush({ endpoint: s.endpoint, keys: s.keys! }, "Notificações do The Chat funcionando 🎉")) sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // inscrição expirada/removida no navegador: limpa
      if (status === 404 || status === 410) await Subscription.deleteOne({ _id: s._id });
      else logger.warn({ err }, "falha ao enviar push");
    }
  }
  res.status(200).send({ success: true, sucess: true, sent });
});
