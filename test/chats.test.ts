import { describe, expect, it } from "vitest";
import { api, bearer, signup } from "./helpers.js";

async function setup() {
  const a = await signup("Ana");
  const b = await signup("Bruno");
  const c = await signup("Carla");
  const created = await api()
    .post("/api/create/chat")
    .set(bearer(a.token))
    .send({ user_origin: a.id, user_response: b.id, chatData: [{ sender: "origin", message: "olá", timestamp: "01/01/2026-10:00" }] });
  return { a, b, c, chatId: String(created.body.doc._id), created };
}

describe("chats", () => {
  it("cria a conversa com quem está logado como origem", async () => {
    const { created, a, b } = await setup();
    expect(created.body.success).toBe(true);
    expect(created.body.doc.user_origin).toEqual([a.id]);
    expect(created.body.doc.user_response).toEqual([b.id]);
  });

  it("não duplica a conversa (nos dois sentidos) nem conversa consigo mesmo", async () => {
    const { a, b } = await setup();
    const again = await api().post("/api/create/chat").set(bearer(b.token)).send({ user_response: a.id });
    expect(again.body).toMatchObject({ success: false, error: "Alredy have a chat" });
    expect((await api().post("/api/create/chat").set(bearer(a.token)).send({ user_response: a.id })).status).toBe(400);
    expect(
      (await api().post("/api/create/chat").set(bearer(a.token)).send({ user_response: "507f1f77bcf86cd799439011" })).status,
    ).toBe(404);
  });

  it("só participantes leem e mandam mensagens; o remetente vem do token", async () => {
    const { b, c, chatId } = await setup();
    const sent = await api()
      .put("/api/send/message")
      .set(bearer(b.token))
      .send({ chat_id: chatId, chatData: { sender: "origin", message: "oi!", timestamp: "01/01/2026-10:01" } });
    expect(sent.status).toBe(200);
    expect(sent.body.data.chatData.at(-1)).toMatchObject({ sender: "response", message: "oi!" });

    expect((await api().get(`/api/chat/messages/${chatId}`).set(bearer(c.token))).status).toBe(404);
    expect(
      (await api().put("/api/send/message").set(bearer(c.token)).send({ chat_id: chatId, chatData: { message: "intruso" } })).status,
    ).toBe(403);

    const read = await api().get(`/api/chat/messages/${chatId}`).set(bearer(b.token));
    expect(read.body.chatData).toHaveLength(2);
    expect(read.body.user_origin[0].email).toBeUndefined();
  });

  it("lista só as próprias conversas", async () => {
    const { a, b, c } = await setup();
    expect((await api().get("/api/list/chats").set(bearer(c.token))).body.message).toHaveLength(0);
    expect((await api().get("/api/list/chats").set(bearer(a.token))).body.message).toHaveLength(1);

    const mine = await api().get(`/api/chats/userid/${b.id}`).set(bearer(b.token));
    expect(mine.body.user_response_mesage).toHaveLength(1);
    expect(mine.body.user_origin_message).toHaveLength(0);
    expect((await api().get(`/api/chats/userid/${b.id}`).set(bearer(c.token))).status).toBe(403);
  });

  it("valida o corpo da mensagem", async () => {
    const { a, chatId } = await setup();
    const empty = await api().put("/api/send/message").set(bearer(a.token)).send({ chat_id: chatId, chatData: { message: "  " } });
    expect(empty.status).toBe(400);
    const missing = await api().put("/api/send/message").set(bearer(a.token)).send({ chat_id: "507f1f77bcf86cd799439011", chatData: { message: "x" } });
    expect(missing.status).toBe(404);
  });
});
