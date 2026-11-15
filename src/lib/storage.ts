import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env, features } from "../config/env.js";

let client: S3Client | null = null;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const ALLOWED_IMAGE_TYPES = Object.keys(EXT);

function s3(): S3Client {
  if (!features.storage) throw new Error("storage não configurado");
  client ??= new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
  });
  return client;
}

/** Confere a assinatura do arquivo (não confia só no mimetype enviado). */
export function sniffImage(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Só chaves de avatar geradas pela própria API: <prefixo>/<userId>/<uuid>.<ext> */
export const AVATAR_KEY = new RegExp(
  `^${escapeRe(env.S3_PREFIX)}/[a-f\\d]{24}/[a-f\\d]{8}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{12}\\.(jpg|png|webp)$`,
);

/** URL pública de uma chave: CDN do bucket, se houver; senão a rota /api/files da API. */
export function publicUrl(key: string): string {
  const base = env.S3_PUBLIC_URL ?? `${env.PUBLIC_API_URL.replace(/\/$/, "")}/api/files`;
  return `${base.replace(/\/$/, "")}/${key}`;
}

/** Extrai a chave de uma URL gerada por publicUrl (para apagar o avatar antigo). */
export function keyFromUrl(url: string): string | null {
  for (const base of [env.S3_PUBLIC_URL, `${env.PUBLIC_API_URL.replace(/\/$/, "")}/api/files`]) {
    if (base && url.startsWith(`${base.replace(/\/$/, "")}/`)) {
      const key = url.slice(base.replace(/\/$/, "").length + 1);
      return AVATAR_KEY.test(key) ? key : null;
    }
  }
  return null;
}

/** Sobe o avatar no bucket (S3/R2) e devolve a URL pública. */
export async function uploadAvatar(userId: string, body: Buffer, contentType: string): Promise<string> {
  const key = `${env.S3_PREFIX}/${userId}/${randomUUID()}.${EXT[contentType]}`;
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return publicUrl(key);
}

export async function getObject(key: string): Promise<{ body: Readable; contentType?: string; length?: number } | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return { body: res.Body as Readable, contentType: res.ContentType, length: res.ContentLength };
  } catch (err) {
    if ((err as { name?: string }).name === "NoSuchKey") return null;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}
