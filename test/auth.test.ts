import { describe, expect, it, vi } from "vitest";
import { User } from "../src/models/User.js";
import { api, plantCode, signup } from "./helpers.js";

vi.mock("../src/lib/mailer.js", () => ({ sendLoginCode: vi.fn(async () => true) }));
const { sendLoginCode } = await import("../src/lib/mailer.js");
const lastCode = () => vi.mocked(sendLoginCode).mock.calls.at(-1)![1];
const start = (body: object) => api().post("/api/auth/email/start").send(body);
const confirm = (email: string, code: string) => api().post("/api/auth/email/confirm").send({ email, code });

describe("auth sem senha", () => {
  it("e-mail novo: cria conta pendente, envia código e confirma", async () => {
    const res = await start({ email: "ANA@test.com", name: "Ana" });
    expect(res.status).toBe(202);
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(vi.mocked(sendLoginCode).mock.calls.at(-1)![0]).toBe("ana@test.com");

    const user = await User.findOne({ email: "ana@test.com" }).select("+loginCode").lean();
    expect(user?.emailVerifiedAt).toBeNull();
    expect(user?.loginCode?.codeHash).not.toContain(code);

    const ok = await confirm("ana@test.com", code);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ success: true, isNew: true });
    expect(ok.body.token).toBeTypeOf("string");
    expect((await User.findOne({ email: "ana@test.com" }).lean())?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("conta existente entra de novo com novo código (isNew false) e sem nome vira o do e-mail", async () => {
    await start({ email: "joao.silva@test.com" });
    expect((await User.findOne({ email: "joao.silva@test.com" }).lean())?.name).toBe("joao silva");
    await confirm("joao.silva@test.com", lastCode());
    const code = await plantCode("joao.silva@test.com");
    expect((await confirm("joao.silva@test.com", code)).body.isNew).toBe(false);
  });

  it("resposta igual para qualquer e-mail e validação de entrada", async () => {
    const a = await start({ email: "x@test.com" });
    const b = await start({ email: "x@test.com" });
    expect(a.body).toEqual(b.body);
    expect((await start({ email: "nao-e-email" })).status).toBe(400);
    expect((await start({ email: { $ne: null } })).status).toBe(400);
    expect((await confirm("x@test.com", "12ab56")).status).toBe(400);
  });

  it("no máximo um e-mail por minuto", async () => {
    vi.mocked(sendLoginCode).mockClear();
    await start({ email: "y@test.com" });
    await start({ email: "y@test.com" });
    expect(vi.mocked(sendLoginCode)).toHaveBeenCalledTimes(1);
  });

  it("código de uso único", async () => {
    await start({ email: "z@test.com" });
    const code = lastCode();
    expect((await confirm("z@test.com", code)).status).toBe(200);
    expect((await confirm("z@test.com", code)).status).toBe(400);
  });

  it("bloqueia depois de 5 tentativas erradas", async () => {
    await start({ email: "w@test.com" });
    const code = lastCode();
    const wrong = code === "111111" ? "222222" : "111111";
    for (let i = 0; i < 5; i++) expect((await confirm("w@test.com", wrong)).status).toBe(400);
    expect((await confirm("w@test.com", code)).status).toBe(400);
  });

  it("código expirado ou e-mail desconhecido não valem", async () => {
    await start({ email: "v@test.com" });
    const code = lastCode();
    await User.updateOne({ email: "v@test.com" }, { $set: { "loginCode.expiresAt": new Date(Date.now() - 1000) } });
    expect((await confirm("v@test.com", code)).status).toBe(400);
    expect((await confirm("ninguem@test.com", "123456")).status).toBe(400);
  });

  it("conta bloqueada não recebe nem usa código", async () => {
    const u = await signup();
    await User.updateOne({ email: u.email }, { status: "blocked" });
    vi.mocked(sendLoginCode).mockClear();
    await start({ email: u.email });
    expect(vi.mocked(sendLoginCode)).not.toHaveBeenCalled();
    const code = await plantCode(u.email);
    expect((await confirm(u.email, code)).status).toBe(400);
  });

  it("contas pendentes não aparecem na lista de usuários", async () => {
    const a = await signup("Ana");
    await start({ email: "pendente@test.com" });
    const list = await api().get("/api/list/users").set({ Authorization: `Bearer ${a.token}` });
    expect(list.body).toHaveLength(1);
  });
});
