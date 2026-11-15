import { Router } from "express";
import { Chat } from "../models/Chat.js";
import { User } from "../models/User.js";

const TTL_MS = 5 * 60_000;
let cache: { at: number; data: { users: number; messages: number } } | null = null;

/** Números públicos da landing (usuários confirmados e mensagens), com cache de 5 min. */
export const statsRouter = Router();

statsRouter.get("/stats", async (_req, res) => {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const [users, agg] = await Promise.all([
      User.countDocuments({ emailVerifiedAt: { $ne: null }, status: { $ne: "blocked" } }),
      Chat.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: { $size: "$chatData" } } } }]),
    ]);
    cache = { at: Date.now(), data: { users, messages: agg[0]?.total ?? 0 } };
  }
  res.set("Cache-Control", "public, max-age=300").send(cache.data);
});

export const resetStatsCache = () => (cache = null);
