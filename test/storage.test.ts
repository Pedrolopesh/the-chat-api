import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

// bucket configurado só neste arquivo (env lido na importação)
vi.hoisted(() => {
  Object.assign(process.env, {
    S3_ENDPOINT: "https://conta.r2.cloudflarestorage.com",
    S3_BUCKET: "the-chat",
    S3_ACCESS_KEY_ID: "id",
    S3_SECRET_ACCESS_KEY: "secret",
    PUBLIC_API_URL: "https://thechat-api.test",
  });
});

const bucket = new Map<string, { body: Buffer; type?: string }>();
vi.mock("@aws-sdk/client-s3", () => {
  class Cmd {
    constructor(public input: Record<string, unknown>) {}
  }
  class PutObjectCommand extends Cmd {}
  class GetObjectCommand extends Cmd {}
  class DeleteObjectCommand extends Cmd {}
  class S3Client {
    async send(cmd: Cmd) {
      const key = cmd.input.Key as string;
      if (cmd instanceof PutObjectCommand) bucket.set(key, { body: cmd.input.Body as Buffer, type: cmd.input.ContentType as string });
      if (cmd instanceof DeleteObjectCommand) bucket.delete(key);
      if (cmd instanceof GetObjectCommand) {
        const obj = bucket.get(key);
        if (!obj) throw Object.assign(new Error("no key"), { name: "NoSuchKey" });
        return { Body: Readable.from(obj.body), ContentType: obj.type, ContentLength: obj.body.length };
      }
      return {};
    }
  }
  return { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
});

const { api, bearer, signup } = await import("./helpers.js");
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("resto-do-png")]);

describe("avatar no bucket privado", () => {
  it("sobe, serve pela API e apaga o anterior", async () => {
    const a = await signup();
    const up = await api()
      .patch("/api/upload/user/image")
      .set(bearer(a.token))
      .attach("photo", png, { filename: "a.png", contentType: "image/png" });
    expect(up.status).toBe(200);
    const url = up.body.data.img_profile as string;
    expect(url).toMatch(new RegExp(`^https://thechat-api\\.test/api/files/the-chat/avatars/${a.id}/[0-9a-f-]{36}\\.png$`));

    const key = url.split("/api/files/")[1]!;
    const got = await api().get(`/api/files/${key}`);
    expect(got.status).toBe(200);
    expect(got.headers["content-type"]).toBe("image/png");
    expect(got.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(Buffer.from(got.body).equals(png)).toBe(true);

    const second = await api()
      .patch("/api/upload/user/image")
      .set(bearer(a.token))
      .attach("photo", png, { filename: "b.png", contentType: "image/png" });
    await new Promise((r) => setTimeout(r, 20));
    expect(bucket.has(key)).toBe(false);
    expect(bucket.size).toBe(1);
    expect(second.body.data.img_profile).not.toBe(url);
  });

  it("recusa arquivo que não é imagem e caminhos fora do padrão", async () => {
    const a = await signup();
    const fake = await api()
      .patch("/api/upload/user/image")
      .set(bearer(a.token))
      .attach("photo", Buffer.from("<svg onload=alert(1)>"), { filename: "x.png", contentType: "image/png" });
    expect(fake.status).toBe(400);
    for (const path of ["the-chat/backups/thechat-1.archive.gz", "../etc/passwd", "the-chat/avatars/x/y.png"]) {
      expect((await api().get(`/api/files/${path}`)).status).toBe(404);
    }
    const missing = "the-chat/avatars/507f1f77bcf86cd799439011/00000000-0000-0000-0000-000000000000.png";
    expect((await api().get(`/api/files/${missing}`)).status).toBe(404);
  });
});
