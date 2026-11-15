import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { escapeHtml } from "../src/lib/escape-html.js";
import { signToken, verifyToken } from "../src/lib/jwt.js";
import { loginCodeEmail, sendLoginCode } from "../src/lib/mailer.js";
import { sendPush } from "../src/lib/push.js";
import { sniffImage, uploadAvatar } from "../src/lib/storage.js";

describe("lib", () => {
  it("env: falha sem segredo forte e lê listas", () => {
    expect(() => loadEnv({ MONGO_URL: "x", JWT_SECRET: "curto" })).toThrow(/JWT_SECRET/);
    const env = loadEnv({ MONGO_URL: "x", JWT_SECRET: "a".repeat(32), CORS_ORIGINS: "https://a.com, https://b.com" });
    expect(env.CORS_ORIGINS).toEqual(["https://a.com", "https://b.com"]);
    expect(env.PORT).toBe(3333);
  });

  it("jwt: assina e verifica; rejeita adulterado", () => {
    const t = signToken("abc");
    expect(verifyToken(t)).toBe("abc");
    expect(verifyToken(t + "x")).toBeNull();
    expect(verifyToken("nada")).toBeNull();
  });

  it("escapa HTML no e-mail", () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
    const mail = loginCodeEmail("123456");
    expect(mail.text).toContain("123456");
    expect(mail.html).toContain("123456");
  });

  it("reconhece imagens pela assinatura", () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImage(Buffer.from("RIFF0000WEBPVP8 "))).toBe("image/webp");
    expect(sniffImage(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });

  it("integrações desligadas sem configuração", async () => {
    expect(await sendLoginCode("a@b.com", "123456")).toBe(false);
    expect(await sendPush({ endpoint: "https://x", keys: { p256dh: "a", auth: "b" } }, "x")).toBe(false);
    await expect(uploadAvatar("u", Buffer.from(""), "image/png")).rejects.toThrow(/storage/);
  });
});
