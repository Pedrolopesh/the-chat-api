import { describe, expect, it, vi } from "vitest";
import { User } from "../src/models/User.js";
import { api, signup } from "./helpers.js";

vi.mock("../src/lib/mailer.js", () => ({ sendRecoveryEmail: vi.fn(async () => true) }));
const { sendRecoveryEmail } = await import("../src/lib/mailer.js");

describe("auth", () => {
  it("cadastra, guarda a senha com hash e devolve token", async () => {
    const res = await api().post("/api/signup").send({ name: "Ana", email: "ANA@test.com", password: "senha-forte-1" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTypeOf("string");
    const user = await User.findOne({ email: "ana@test.com" }).select("+password").lean();
    expect(user?.password).not.toBe("senha-forte-1");
    expect(user?.password).toMatch(/^\$2[aby]\$12\$/);
  });

  it("recusa cadastro inválido e e-mail repetido", async () => {
    expect((await api().post("/api/signup").send({ name: "A", email: "x", password: "1" })).status).toBe(400);
    await signup();
    const { email } = await signup();
    const dup = await api().post("/api/signup").send({ name: "B", email, password: "senha-forte-1" });
    expect(dup.body).toMatchObject({ success: false, message: "User Alredy exist" });
  });

  it("login com a mesma resposta para e-mail inexistente e senha errada", async () => {
    const { email } = await signup();
    const ok = await api().post("/api/login").send({ email, password: "senha-forte-1" });
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
    const wrong = await api().post("/api/login").send({ email, password: "errada" });
    const missing = await api().post("/api/login").send({ email: "nao@existe.com", password: "errada" });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body).toEqual(missing.body);
  });

  it("rejeita operador do Mongo no lugar do e-mail", async () => {
    const res = await api().post("/api/login").send({ email: { $ne: null }, password: "x" });
    expect(res.status).toBe(400);
  });

  it("recuperação: código com hash, validade, tentativas e uso único", async () => {
    const { email } = await signup();
    const ghost = await api().post("/api/forgot/pass").send({ email: "fantasma@test.com" });
    expect(ghost.body.success).toBe(true); // não revela se a conta existe

    await api().post("/api/forgot/pass").send({ email });
    const code = vi.mocked(sendRecoveryEmail).mock.calls.at(-1)![2];
    expect(code).toMatch(/^\d{6}$/);
    const stored = await User.findOne({ email }).select("+passwordReset").lean();
    expect(stored?.passwordReset?.codeHash).not.toContain(code);

    const wrongCode = code === "123456" ? "654321" : "123456";
    expect((await api().post("/api/confirm/recovery/code").send({ email, code: wrongCode })).status).toBe(400);
    expect((await api().post("/api/confirm/recovery/code").send({ email, code })).body.success).toBe(true);

    const mismatch = await api()
      .patch("/api/update/user/password")
      .send({ email, code, password: "nova-senha-123", confirmPassword: "outra" });
    expect(mismatch.status).toBe(400);

    const upd = await api()
      .patch("/api/update/user/password")
      .send({ email, code, password: "nova-senha-123", confirmPassword: "nova-senha-123" });
    expect(upd.status).toBe(201);
    expect((await api().post("/api/login").send({ email, password: "nova-senha-123" })).status).toBe(200);

    const reuse = await api()
      .patch("/api/update/user/password")
      .send({ email, code, password: "outra-senha-123", confirmPassword: "outra-senha-123" });
    expect(reuse.status).toBe(400);
  });

  it("bloqueia o código depois de 5 tentativas erradas", async () => {
    const { email } = await signup();
    await api().post("/api/forgot/pass").send({ email });
    const code = vi.mocked(sendRecoveryEmail).mock.calls.at(-1)![2];
    const wrongCode = code === "111111" ? "222222" : "111111";
    for (let i = 0; i < 5; i++) await api().post("/api/confirm/recovery/code").send({ email, code: wrongCode });
    expect((await api().post("/api/confirm/recovery/code").send({ email, code })).status).toBe(400);
  });

  it("código expirado não vale", async () => {
    const { email } = await signup();
    await api().post("/api/forgot/pass").send({ email });
    const code = vi.mocked(sendRecoveryEmail).mock.calls.at(-1)![2];
    await User.updateOne({ email }, { $set: { "passwordReset.expiresAt": new Date(Date.now() - 1000) } });
    expect((await api().post("/api/confirm/recovery/code").send({ email, code })).status).toBe(400);
  });
});
