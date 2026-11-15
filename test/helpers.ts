import request from "supertest";
import { createApp } from "../src/app.js";

export const app = createApp();
export const api = () => request(app);

let n = 0;
export async function signup(name = "Ana") {
  n++;
  const email = `user${n}-${Date.now()}@test.com`;
  const res = await api().post("/api/signup").send({ name, email, password: "senha-forte-1" });
  return { id: String(res.body._id), token: res.body.token as string, email };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
