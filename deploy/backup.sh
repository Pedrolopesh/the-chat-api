#!/usr/bin/env bash
# Backup diário do Mongo do The Chat para o bucket (S3/R2), cifrado em
# trânsito (HTTPS). Lê as credenciais do .env do deploy. Instale no cron:
#   15 4 * * * /opt/the-chat/backup.sh >> /var/log/the-chat-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
# lê só as chaves necessárias (não executa o .env como script)
get() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }
MONGO_ROOT_PASSWORD=$(get MONGO_ROOT_PASSWORD)
S3_ENDPOINT=$(get S3_ENDPOINT); S3_BUCKET=$(get S3_BUCKET); S3_REGION=$(get S3_REGION)
S3_ACCESS_KEY_ID=$(get S3_ACCESS_KEY_ID); S3_SECRET_ACCESS_KEY=$(get S3_SECRET_ACCESS_KEY)
S3_BACKUP_PREFIX=$(get S3_BACKUP_PREFIX)

stamp=$(date -u +%Y%m%d-%H%M)
key="${S3_BACKUP_PREFIX:-the-chat/backups}/thechat-${stamp}.archive.gz"

docker exec the-chat-mongo mongodump --quiet --archive --gzip \
  -u thechat -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --db thechat \
| docker run --rm -i \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    -e AWS_DEFAULT_REGION="${S3_REGION:-auto}" \
    amazon/aws-cli:2.22.0 s3 cp - "s3://${S3_BUCKET}/${key}" --endpoint-url "$S3_ENDPOINT"

echo "$(date -u +%FT%TZ) backup ok: ${key}"
