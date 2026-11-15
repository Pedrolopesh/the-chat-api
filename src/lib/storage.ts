import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env, features } from "../config/env.js";

let client: S3Client | null = null;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const ALLOWED_IMAGE_TYPES = Object.keys(EXT);

/** Confere a assinatura do arquivo (não confia só no mimetype enviado). */
export function sniffImage(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

/** Sobe o avatar no bucket (S3/R2) e devolve a URL pública. */
export async function uploadAvatar(userId: string, body: Buffer, contentType: string): Promise<string> {
  if (!features.storage) throw new Error("storage não configurado");
  client ??= new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
  });
  const key = `${env.S3_PREFIX}/${userId}/${randomUUID()}.${EXT[contentType]}`;
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${env.S3_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
}
