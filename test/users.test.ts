import { describe, expect, it } from "vitest";
import { api, bearer, signup } from "./helpers.js";

describe("users", () => {
  it("exige token válido", async () => {
    expect((await api().get("/api/list/users")).status).toBe(401);
    expect((await api().get("/api/list/users").set({ Authorization: "Bearer lixo" })).status).toBe(401);
    expect((await api().get("/api/list/users").set({ Authorization: "Basic abc" })).status).toBe(401);
  });

  it("lista usuários sem e-mail nem senha", async () => {
    const a = await signup("Ana");
    await signup("Bruno");
    const res = await api().get("/api/list/users").set(bearer(a.token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    for (const u of res.body) expect(Object.keys(u).sort()).toEqual(["_id", "img_profile", "name"]);
  });

  it("o próprio perfil traz e-mail; o de outro, só dados públicos", async () => {
    const a = await signup("Ana");
    const b = await signup("Bruno");
    const own = await api().get(`/api/user/${a.id}`).set(bearer(a.token));
    expect(own.body.content.email).toBe(a.email);
    expect(own.body.content.password).toBeUndefined();
    const other = await api().get(`/api/user/${b.id}`).set(bearer(a.token));
    expect(other.body.content.email).toBeUndefined();
    expect((await api().get("/api/user/nao-e-id").set(bearer(a.token))).status).toBe(400);
    expect((await api().get("/api/user/507f1f77bcf86cd799439011").set(bearer(a.token))).status).toBe(404);
  });

  it("só altera o próprio cadastro", async () => {
    const a = await signup("Ana");
    const b = await signup("Bruno");
    const ok = await api().put(`/api/update/user/${a.id}`).set(bearer(a.token)).send({ name: "Ana Maria" });
    expect(ok.body.data.name).toBe("Ana Maria");
    expect((await api().put(`/api/update/user/${b.id}`).set(bearer(a.token)).send({ name: "x" })).status).toBe(403);
    expect(
      (await api().patch(`/api/update/user/image/${b.id}`).set(bearer(a.token)).send({ img_profile: "https://x.com/a.png" })).status,
    ).toBe(403);
  });

  it("avatar por URL só aceita https", async () => {
    const a = await signup();
    const bad = await api()
      .patch(`/api/update/user/image/${a.id}`)
      .set(bearer(a.token))
      .send({ img_profile: "javascript:alert(1)" });
    expect(bad.status).toBe(400);
    const ok = await api()
      .patch(`/api/update/user/image/${a.id}`)
      .set(bearer(a.token))
      .send({ img_profile: "https://cdn.test/a.png" });
    expect(ok.body.success).toBe(true);
  });

  it("upload responde 503 sem bucket configurado", async () => {
    const a = await signup();
    const res = await api()
      .patch("/api/upload/user/image")
      .set(bearer(a.token))
      .attach("photo", Buffer.from([0xff, 0xd8, 0xff, 0x00]), { filename: "a.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(503);
  });
});
