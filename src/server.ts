import { createServer } from "node:http";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { env, features } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { attachSocket, closeSocket } from "./socket/index.js";

async function main() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URL, { serverSelectionTimeoutMS: 15_000 });
  logger.info("conectado ao MongoDB");

  const server = createServer(createApp());
  attachSocket(server, env.CORS_ORIGINS);
  server.listen(env.PORT, () => logger.info({ port: env.PORT, features }, "API no ar"));

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "encerrando");
    await closeSocket();
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "falha ao iniciar");
  process.exit(1);
});
