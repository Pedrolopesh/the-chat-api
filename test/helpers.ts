import request from "supertest";
import { createApp } from "../src/app.js";
import { hashCode } from "../src/modules/auth.js";
import { User } from "../src/models/User.js";

export const app = createApp();
export const api = () => request(app);

/** Define um código conhecido para o usuário (simula o e-mail recebido). */
export async function plantCode(emailAddr: string, code = "424242") {
  const user = await User.findOne({ email: emailAddr });
  await User.updateOne(
    { _id: user!._id },
    { $set: { loginCode: { codeHash: hashCode(String(user!._id), code), expiresAt: new Date(Date.now() + 60_000), attempts: 0, sentAt: new Date() } } },
  );
  return code;
}

let n = 0;
/** Cria e confirma uma conta pelo fluxo sem senha. */
export async function signup(name = "Ana") {
  n++;
  const email = `user${n}-${Date.now()}@test.com`;
  await api().post("/api/auth/email/start").send({ email, name });
  const code = await plantCode(email);
  const res = await api().post("/api/auth/email/confirm").send({ email, code });
  return { id: String(res.body.user_id), token: res.body.token as string, email };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
