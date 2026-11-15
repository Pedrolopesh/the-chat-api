# The Chat — API

API do [The Chat](https://github.com/Pedrolopesh/the-chat-app): entrada sem
senha (código por e-mail), conversas entre usuários em tempo real (socket.io) e notificações push.

Node 22 · TypeScript · Express 5 · MongoDB (Mongoose) · socket.io 4 · Zod.

Produção: `https://thechat-api.pedrolopes.tech` (só um ambiente, produção).
Front: `https://thechat.pedrolopes.tech`.

## Rodando localmente

```bash
cp .env.example .env              # preencha JWT_SECRET (openssl rand -base64 48)
docker compose -f compose.dev.yaml up -d   # Mongo local
npm ci
npm run dev                       # http://localhost:3333/api
```

| Comando | O que faz |
|---|---|
| `npm test` / `npm run test:cov` | testes (Vitest + Supertest + Mongo em memória), cobertura mínima de 80% |
| `npm run lint` / `npm run typecheck` | ESLint e TypeScript |
| `npm run build` | compila para `dist/` |
| `npm run vapid` | gera o par de chaves das notificações push |

## Rotas

Todas sob `/api`. As marcadas com 🔒 exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | status |
| POST | `/auth/email/start` | `{ email, name? }` → `202` sempre; envia o código (conta nova nasce pendente) |
| POST | `/auth/email/confirm` | `{ email, code }` → `{ user_id, token, isNew }` |
| GET | `/push/key` | chave pública VAPID |
| GET 🔒 | `/list/users` | usuários (só `_id`, `name`, `img_profile`) |
| GET 🔒 | `/user/:id` | perfil (e-mail só no próprio) |
| PUT 🔒 | `/update/user/:id` | `{ name }` — só o próprio |
| PATCH 🔒 | `/update/user/image/:id` | `{ img_profile }` (URL https) — só o próprio |
| PATCH 🔒 | `/upload/user/image` | multipart `photo` (jpeg/png/webp, até 2 MB) → bucket; apaga o avatar anterior |
| GET | `/files/<chave>` | foto de perfil lida do bucket privado (só chaves de avatar) |
| POST 🔒 | `/create/chat` | `{ user_response, chatData? }` |
| PUT 🔒 | `/send/message` | `{ chat_id, chatData: { message, timestamp? } }` |
| GET 🔒 | `/list/chats` | conversas do usuário |
| GET 🔒 | `/chat/messages/:id` | conversa (só participantes) |
| GET 🔒 | `/chats/userid/:id` | conversas do usuário (só o próprio id) |
| POST 🔒 | `/subscribe` | `{ subscribeData }` (PushSubscription) |
| POST 🔒 | `/notification/send` | push de teste para o próprio usuário |

`GET /health` (fora de `/api`) responde `200` com o banco conectado.

### Tempo real

```js
const socket = io(API_URL, { auth: { token } });
socket.emit("join", chatId, (ok) => {});          // só entra se participar da conversa
socket.on("messageRecived", ({ chat_id, sender, message, timestamp }) => {});
```

A mensagem é enviada por `PUT /send/message`; o servidor salva e emite para a
sala da conversa.

## Segurança

- Segredos só por variável de ambiente, validados na subida (JWT ≥ 32 caracteres).
- Sem senha: entrada por código de 6 dígitos enviado pelo Resend (`crypto.randomInt`), guardado só como hash, válido por 15 min, 5 tentativas, uso único e no máximo um e-mail por minuto. A resposta é a mesma exista ou não a conta; contas pendentes não aparecem para os outros.
- Autorização por dono: só participantes leem/escrevem na conversa; cada um só altera o próprio perfil; o remetente da mensagem vem do token.
- Validação de entrada com Zod (bloqueia operadores do Mongo), limite de corpo, rate limit geral e mais restrito em login/recuperação.
- Helmet, CORS restrito às origens do front, erros sem detalhes internos, logs sem token nem código.
- Upload em memória, até 2 MB, tipo conferido pela assinatura do arquivo.
- Container sem root, sistema de arquivos somente leitura, sem capabilities; Mongo em rede interna sem porta publicada.

> As mensagens **não** têm criptografia de ponta a ponta: trafegam com TLS e
> ficam no banco do servidor.

## Deploy (produção)

Pipeline em `.github/workflows/ci.yml`:

1. **PR e push:** lint, tipos, testes com cobertura, `npm audit`, Gitleaks, build da imagem, smoke test da stack (`deploy/compose.yaml`) e Trivy.
2. **Push na `master`:** publica a imagem no GHCR (`sha-<commit>` e `latest`), gera o `.env` a partir dos secrets, copia `deploy/` para `/opt/the-chat` na VPS e roda `deploy.sh` (sobe, espera o `/health` e volta para a imagem anterior se falhar). No fim, checa `https://thechat-api.pedrolopes.tech/health`.

Na VPS tudo é isolado dos outros serviços: projeto `the-chat`, redes
`the-chat-db` (interna) e `the-chat-edge`, volume `the-chat-mongo-data`, API
em `127.0.0.1:3004` atrás do nginx (`deploy/nginx-thechat-api.conf`).
Backup diário do Mongo para o bucket: `deploy/backup.sh` (cron).

### Secrets do repositório (environment `production`)

| Secret | Uso |
|---|---|
| `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` | acesso de deploy |
| `JWT_SECRET`, `MONGO_ROOT_PASSWORD` | obrigatórios |
| `RESEND_API_KEY` | e-mail com o código de acesso |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | push |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | bucket R2 `the-chat` (chave `the-chat-api-rw`, só esse bucket): avatares e backups |

Variáveis (não secretas): `CORS_ORIGINS`, `APP_URL`, `MAIL_FROM`, `PUBLIC_API_URL`, `API_BIND`, `API_PORT` e, se houver CDN, `S3_PUBLIC_URL`.

### Bucket

Cloudflare R2, bucket **privado** `the-chat`:

| Prefixo | Conteúdo | Retenção |
|---|---|---|
| `the-chat/avatars/<userId>/<uuid>.<ext>` | fotos de perfil, servidas por `GET /api/files/...` | enquanto for a foto atual |
| `the-chat/backups/thechat-<data>.archive.gz` | `mongodump --gzip` diário (`deploy/backup.sh`) | 30 dias (regra de ciclo de vida `backups-30-dias`) |

Restaurar um backup:

```bash
aws s3 cp s3://the-chat/the-chat/backups/<arquivo> - --endpoint-url "$S3_ENDPOINT" \
  | docker exec -i the-chat-mongo mongorestore --archive --gzip --drop -u thechat -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin
```
