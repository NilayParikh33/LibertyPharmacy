# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NODE_ENV=production here only affects the build (e.g. React's production
# bundle) — runtime env vars (DATABASE_URL, SES_FROM_EMAIL, etc.) are still
# supplied by the ECS task definition at deploy time, not baked into the image.
ENV NODE_ENV=production
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime image — only what `output: "standalone"` traced as actually needed,
# not the full node_modules tree from the builder stage.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Required for the standalone server to accept connections from outside the
# container — it defaults to binding 127.0.0.1 otherwise.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# RDS_CA_BUNDLE_PATH (see .env.example) is read relative to this working
# directory — keep this alongside server.js, not under .next.
COPY --from=builder --chown=nextjs:nodejs /app/certs ./certs

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
