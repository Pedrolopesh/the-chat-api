import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";

process.env.NODE_ENV = "test";
process.env.MONGO_URL ??= "mongodb://placeholder";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters!!";
process.env.CORS_ORIGINS = "http://localhost:8080";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
