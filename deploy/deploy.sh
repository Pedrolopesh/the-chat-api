#!/usr/bin/env bash
# Roda NA VPS, chamado pelo pipeline:  ./deploy.sh <imagem:tag>
# Sobe a nova imagem, espera o /health e, se falhar, volta para a anterior.
set -euo pipefail
cd "$(dirname "$0")"

new_image="$1"
prev_image=$(cat .current-image 2>/dev/null || true)

up() {
  API_IMAGE="$1" docker compose -f compose.yaml --env-file .env up -d --remove-orphans
}

healthy() {
  local port; port=$(grep -E '^API_PORT=' .env | cut -d= -f2); port=${port:-3004}
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

docker pull "$new_image"
up "$new_image"

if healthy; then
  echo "$new_image" > .current-image
  docker image prune -f --filter "label!=keep" >/dev/null || true
  echo "deploy ok: $new_image"
else
  echo "health check falhou para $new_image" >&2
  docker logs --tail 50 the-chat-api >&2 || true
  if [ -n "$prev_image" ]; then
    echo "voltando para $prev_image" >&2
    up "$prev_image"
  fi
  exit 1
fi
