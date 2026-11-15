import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.js";
import { apiLimiter } from "./middlewares/rate-limit.js";
import { authRouter } from "./modules/auth.js";
import { chatsRouter } from "./modules/chats.js";
import { pushRouter } from "./modules/push.js";
import { statsRouter } from "./modules/stats.js";
import { filesRouter } from "./modules/files.js";
import { usersRouter } from "./modules/users.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    }),
  );
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
  app.use(express.json({ limit: "32kb" }));

  /** saúde: usado pelo Docker e pelo pipeline após o deploy */
  app.get("/health", (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    res.status(db ? 200 : 503).send({ status: db ? "ok" : "degraded", db });
  });

  const api = express.Router();
  api.use(apiLimiter);
  api.get("/", (_req, res) => {
    res.send("Server is runing");
  });
  // rotas públicas primeiro; cada router protegido aplica o próprio auth
  api.use(authRouter);
  api.use(statsRouter);
  api.use(filesRouter);
  api.use(pushRouter);
  api.use(usersRouter);
  api.use(chatsRouter);

  app.use("/api", api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
