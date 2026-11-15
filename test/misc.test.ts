import { describe, expect, it } from "vitest";
import { api, bearer, signup } from "./helpers.js";

describe("app", () => {
  it("saúde, status e cabeçalhos de segurança", async () => {
    const health = await api().get("/health");
    expect(health.status).toBe(200);
    expect(health.body.db).toBe(true);
    const root = await api().get("/api/");
    expect(root.text).toBe("Server is runing");
    expect(root.headers["x-powered-by"]).toBeUndefined();
    expect(root.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("CORS só para as origens configuradas", async () => {
    const ok = await api().get("/api/").set("Origin", "http://localhost:8080");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:8080");
    const bad = await api().get("/api/").set("Origin", "https://malicioso.com");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("JSON inválido e rota inexistente", async () => {
    const bad = await api().post("/api/login").set("Content-Type", "application/json").send("{oops");
    expect(bad.status).toBe(400);
    expect((await api().get("/nada")).status).toBe(404);
  });

  it("push: chave pública e inscrição", async () => {
    const key = await api().get("/api/push/key");
    expect(key.body.success).toBe(false);
    const a = await signup();
    const sub = { endpoint: "https://push.example.com/abc", keys: { p256dh: "k", auth: "a" } };
    const res = await api().post("/api/subscribe").set(bearer(a.token)).send({ subscribeData: sub, user_id: a.id });
    expect(res.body.success).toBe(true);
    const insecure = await api()
      .post("/api/subscribe")
      .set(bearer(a.token))
      .send({ subscribeData: { ...sub, endpoint: "http://x.com" } });
    expect(insecure.status).toBe(400);
    expect((await api().post("/api/notification/send").set(bearer(a.token))).status).toBe(503);
  });
});

describe("stats", () => {
  it("conta usuários confirmados e mensagens", async () => {
    const { resetStatsCache } = await import("../src/modules/stats.js");
    const a = await signup("Ana");
    const b = await signup("Bruno");
    await api().post("/api/auth/email/start").send({ email: "pendente@test.com" });
    const chat = await api().post("/api/create/chat").set(bearer(a.token)).send({ user_response: b.id, chatData: [{ message: "oi" }] });
    await api().put("/api/send/message").set(bearer(b.token)).send({ chat_id: chat.body.doc._id, chatData: { message: "olá" } });
    resetStatsCache();
    const res = await api().get("/api/stats");
    expect(res.body).toEqual({ users: 2, messages: 2 });
    expect(res.headers["cache-control"]).toContain("max-age=300");
  });
});
