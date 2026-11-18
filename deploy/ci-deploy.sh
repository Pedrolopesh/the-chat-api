#!/usr/bin/env bash
# Comando forçado da chave SSH do pipeline (authorized_keys, com a opção `restrict`).
# A chave só consegue pedir duas coisas, vindas em $SSH_ORIGINAL_COMMAND:
#
#   <imagem>    publicar uma imagem: precisa ser uma tag sha-<12 hex> do repositório da API
#   sync-env    atualizar no .env da VPS só as chaves opcionais abaixo, lidas do stdin
#               (KEY=VALUE por linha). JWT, senha do banco e o resto do .env nunca são tocados.
#
# Qualquer outra coisa é recusada, mesmo que a chave do pipeline vaze.
set -euo pipefail
cd "$(dirname "$0")"

# CI_DEPLOY_ENV_FILE só existe para teste local; sshd não repassa variáveis do cliente.
ENV_FILE="${CI_DEPLOY_ENV_FILE:-.env}"
ALLOWED='^(S3_ENDPOINT|S3_REGION|S3_BUCKET|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|S3_PUBLIC_URL|S3_PREFIX|S3_BACKUP_PREFIX|VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY)$'
VALUE_OK='^[A-Za-z0-9+/=_.:@,-]{1,255}$'   # sem espaço, aspas, $, crase ou barra invertida

cmd="${SSH_ORIGINAL_COMMAND:-}"

if [[ "$cmd" == "sync-env" ]]; then
  [[ -f "$ENV_FILE" ]] || { echo "sem $ENV_FILE" >&2; exit 3; }
  tmp="$(mktemp "${ENV_FILE}.XXXXXX")"; trap 'rm -f "$tmp"' EXIT
  cp "$ENV_FILE" "$tmp"
  [[ -z "$(tail -c1 "$tmp")" ]] || echo >> "$tmp"   # garante quebra de linha no fim
  n=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" ]] && continue
    key="${line%%=*}"; val="${line#*=}"
    if [[ "$line" != *=* || ! "$key" =~ $ALLOWED || ! "$val" =~ $VALUE_OK ]]; then
      echo "linha recusada (chave '${key}')" >&2; exit 2
    fi
    grep -v -E "^${key}=" "$tmp" > "${tmp}.n" || true; mv "${tmp}.n" "$tmp"
    printf '%s=%s\n' "$key" "$val" >> "$tmp"
    n=$((n + 1))
  done
  chmod 600 "$tmp"; cat "$tmp" > "$ENV_FILE"
  echo "sync-env ok: ${n} chave(s)"
  exit 0
fi

if [[ ! "$cmd" =~ ^ghcr\.io/pedrolopesh/the-chat-api:sha-[0-9a-f]{12}$ ]]; then
  echo "comando recusado: '${cmd}'" >&2
  exit 2
fi
exec ./deploy.sh "$cmd"
