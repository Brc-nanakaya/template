# syntax=docker/dockerfile:1
#
# AWS（ECS Fargate / App Runner）と Azure（Container Apps / App Service）
# の両方でそのまま動く単一イメージ。
#
#   docker build -t template-app .
#
# マイグレーションやアカウント作成は、同じイメージのコマンドを差し替えて実行する。
# イメージを 1 つに保つことで、アプリとマイグレーションのバージョンがずれない。
#
#   docker run --rm -e DATABASE_URL=... template-app node scripts/db-migrate.cjs
#   docker run --rm -e DATABASE_URL=... template-app node scripts/db-seed.cjs
#   docker run --rm -e DATABASE_URL=... template-app node scripts/db-user.cjs list

# ---------------------------------------------------------------------------
# deps: 依存インストール（package ファイルだけ先に copy してキャッシュを効かせる）
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder: Next.js のビルドと、DB スクリプトのバンドル
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* はビルド時にバンドルへ焼き込まれるため、ここで受け取る必要がある。
# 実行時の環境変数では変えられない点に注意
ARG NEXT_PUBLIC_DEMO_LOGIN_HINT=false
ARG NEXT_PUBLIC_MOCK_LLM=false
ENV NEXT_PUBLIC_DEMO_LOGIN_HINT=$NEXT_PUBLIC_DEMO_LOGIN_HINT
ENV NEXT_PUBLIC_MOCK_LLM=$NEXT_PUBLIC_MOCK_LLM
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# DB スクリプトを依存ごと 1 ファイルに固める（各 300KB 程度）。
# 実行イメージに tsx や node_modules を追加せずに済む
RUN npm run build:scripts

# ---------------------------------------------------------------------------
# runner: 実行イメージ
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# 0.0.0.0 で待ち受けないとコンテナ外から届かない
ENV HOSTNAME=0.0.0.0

# root で動かさない
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# standalone は実行に必要な node_modules を同梱している
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# マイグレーション用（バンドル済みなので node_modules 不要）
COPY --from=builder --chown=nextjs:nodejs /app/dist/scripts ./scripts
COPY --chown=nextjs:nodejs drizzle ./drizzle

USER nextjs
EXPOSE 3000

# DB に依存しない liveness を使う（DB 障害での再起動ループを避ける）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
