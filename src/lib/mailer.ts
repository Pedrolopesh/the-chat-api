import { env, features } from "../config/env.js";
import { escapeHtml } from "./escape-html.js";
import { logger } from "./logger.js";

export function loginCodeEmail(code: string) {
  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
  const app = env.APP_URL.replace(/\/$/, "");
  const text = `Seu código de acesso ao The Chat é ${code}. Ele vale por 15 minutos.\n\n${app}\n\nSe você não pediu, ignore este e-mail.`;
  const html = `
<div style="max-width:520px;margin:0 auto;border:1px solid #eee;${font}">
  <div style="background:#ff709f;padding:16px"><h3 style="margin:0;font-size:24px;color:#fff;text-align:center">The Chat</h3></div>
  <div style="padding:24px;background:#f7f7f7">
    <p>Use este código para entrar (vale por 15 minutos):</p>
    <p style="text-align:center;margin:28px 0"><span style="background:#ffc4d8;padding:10px 16px;border:1px solid #ff6397;border-radius:6px;font-size:26px;letter-spacing:6px">${escapeHtml(code)}</span></p>
    <p style="color:#666">Se você não pediu, ignore este e-mail: ninguém entra na sua conta sem ele.</p>
    <p><a href="${escapeHtml(app)}" style="color:#ff6397">${escapeHtml(app)}</a></p>
  </div>
</div>`;
  return { subject: "Seu código de acesso ao The Chat", text, html };
}

/**
 * Envia pelo Resend (API HTTP). Sem RESEND_API_KEY nada sai — em
 * desenvolvimento o código aparece no log; em produção só um aviso.
 * Nunca registra destinatário nem conteúdo.
 */
export async function sendLoginCode(to: string, code: string): Promise<boolean> {
  const message = loginCodeEmail(code);
  if (!features.mail) {
    if (env.NODE_ENV === "development") logger.warn(`RESEND_API_KEY ausente — código: ${code}`);
    else logger.warn("RESEND_API_KEY ausente: e-mail não enviado");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.error({ status: res.status }, "falha ao enviar e-mail pelo Resend");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ error: err instanceof Error ? err.name : "desconhecido" }, "falha de rede no Resend");
    return false;
  }
}
