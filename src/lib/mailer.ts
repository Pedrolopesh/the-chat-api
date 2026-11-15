import nodemailer, { type Transporter } from "nodemailer";
import { env, features } from "../config/env.js";
import { escapeHtml } from "./escape-html.js";
import { logger } from "./logger.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!features.mail) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

export function recoveryEmailHtml(name: string, code: string, link: string): string {
  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
  return `
<div style="max-width:560px;margin:0 auto;border:1px solid #eee;${font}">
  <div style="background:#ff709f;padding:16px"><h3 style="margin:0;font-size:26px;color:#fff;text-align:center">Não se preocupe 😄</h3></div>
  <div style="padding:24px;background:#f7f7f7">
    <p>Olá, ${escapeHtml(name)}</p>
    <p>Recebemos seu pedido para trocar a senha do The Chat. Use o código abaixo (vale por 15 minutos) ou clique no link.</p>
    <p style="text-align:center;margin:28px 0"><span style="background:#ffc4d8;padding:10px 16px;border:1px solid #ff6397;border-radius:6px;font-size:22px;letter-spacing:4px">${escapeHtml(code)}</span></p>
    <p style="text-align:center"><a href="${escapeHtml(link)}" style="color:#ff6397">${escapeHtml(link)}</a></p>
    <p style="margin-top:24px;font-weight:bold">Não pediu a alteração?</p>
    <p>Pode ignorar este e-mail: sua senha continua a mesma.</p>
  </div>
</div>`;
}

/** Envia o e-mail de recuperação. Retorna false se o e-mail não estiver configurado. */
export async function sendRecoveryEmail(to: string, name: string, code: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    logger.warn("e-mail não configurado: recuperação de senha não enviada");
    return false;
  }
  const link = `${env.APP_URL.replace(/\/$/, "")}/#/recovery/password/${encodeURIComponent(code)}`;
  await t.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: "[The Chat] Recuperação de senha",
    html: recoveryEmailHtml(name, code, link),
  });
  return true;
}
