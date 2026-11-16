import { z } from "zod";

/**
 * Configuração lida (e validada) uma vez só. Se faltar algo obrigatório a
 * API nem sobe — melhor falhar no deploy do que rodar com segredo vazio.
 * Integrações opcionais (e-mail, push, bucket) ficam desligadas quando a
 * configuração delas não está completa.
 */
const csv = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  MONGO_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa de pelo menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  /** origens do front liberadas no CORS e no socket (separadas por vírgula) */
  CORS_ORIGINS: csv,
  /** URL pública do front (aparece no e-mail) */
  APP_URL: z.string().url().default("http://localhost:8080"),
  /** quantos proxies confiáveis existem na frente da API (nginx = 1) */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  /** e-mail do código de acesso (https://resend.com) */
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("The Chat <no-reply@pedrolopes.tech>"),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:contato@pedrolopes.tech"),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /**
   * Opcional: domínio público do bucket (CDN). Sem ele o bucket fica
   * privado e as imagens são servidas pela própria API em /api/files/...
   */
  S3_PUBLIC_URL: z.string().url().optional(),
  /** URL pública desta API (base dos links das imagens servidas por ela) */
  PUBLIC_API_URL: z.string().url().default("http://localhost:3333"),
  S3_PREFIX: z.string().default("the-chat/avatars"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração inválida: ${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export const features = {
  mail: Boolean(env.RESEND_API_KEY),
  push: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
  storage: Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY),
};
