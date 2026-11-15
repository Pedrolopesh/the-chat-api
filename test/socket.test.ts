import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { attachSocket, closeSocket } from "../src/socket/index.js";
import { api, bearer, signup } from "./helpers.js";

const server = createServer(createApp());
let url = "";

beforeAll(async () => {
  attachSocket(server, ["http://localhost:8080"]);
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await closeSocket();
  server.close();
});

const open = (token?: string) =>
  new Promise<Socket>((resolve, reject) => {
    const s = connect(url, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false });
    s.on("connect", () => resolve(s));
    s.on("connect_error", (e) => {
      s.close();
      reject(e);
    });
  });

describe("socket", () => {
  it("recusa conexão sem token", async () => {
    await expect(open()).rejects.toThrow("unauthorized");
  });

  it("entrega a mensagem só para quem está na sala da conversa", async () => {
    const a = await signup("Ana");
    const b = await signup("Bruno");
    const c = await signup("Carla");
    const chat = await api().post("/api/create/chat").set(bearer(a.token)).send({ user_response: b.id });
    const chatId = String(chat.body.doc._id);

    const sb = await open(b.token);
    const sc = await open(c.token);
    const join = (s: Socket, id: unknown) => new Promise<boolean>((r) => s.emit("join", id, r));
    expect(await join(sb, chatId)).toBe(true);
    expect(await join(sc, chatId)).toBe(false); // não participa
    expect(await join(sc, "lixo")).toBe(false);

    let intruder = false;
    sc.on("messageRecived", () => (intruder = true));
    const got = new Promise((r) => sb.on("messageRecived", r));
    await api().put("/api/send/message").set(bearer(a.token)).send({ chat_id: chatId, chatData: { message: "tempo real" } });
    expect(await got).toMatchObject({ chat_id: chatId, sender: "origin", message: "tempo real" });
    await new Promise((r) => setTimeout(r, 100));
    expect(intruder).toBe(false);
    sb.emit("leave", chatId);
    sb.close();
    sc.close();
  });
});
