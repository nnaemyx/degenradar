# ─── Base image with Node + pnpm ───────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate
WORKDIR /app

# ─── Install ALL deps (with devDeps for build) ─────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types/package.json          packages/types/
COPY packages/config/package.json         packages/config/
COPY packages/logger/package.json         packages/logger/
COPY packages/db/package.json             packages/db/
COPY packages/redis/package.json          packages/redis/
COPY packages/helius/package.json         packages/helius/
COPY packages/birdeye/package.json        packages/birdeye/
COPY packages/jupiter/package.json        packages/jupiter/
COPY packages/solana/package.json         packages/solana/
COPY packages/features/package.json       packages/features/
COPY packages/scoring/package.json        packages/scoring/
COPY apps/api/package.json                apps/api/
COPY apps/web/package.json                apps/web/
COPY workers/token-discovery/package.json workers/token-discovery/
COPY workers/risk-engine/package.json     workers/risk-engine/
COPY workers/feature-engine/package.json  workers/feature-engine/
COPY workers/scoring/package.json         workers/scoring/
COPY workers/alerts/package.json          workers/alerts/
RUN pnpm install --frozen-lockfile

# ─── Copy full source ──────────────────────────────────────────────────────
FROM deps AS source
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/     apps/
COPY workers/  workers/

# ─── Build Next.js web app ─────────────────────────────────────────────────
FROM source AS build-web
RUN pnpm --filter @degenradar/web build

# ══════════════════════════════════════════════════════════════════════════════
#  Final images — one per service (small, no devDeps)
# ══════════════════════════════════════════════════════════════════════════════

# ── API ────────────────────────────────────────────────────────────────────
FROM source AS api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["pnpm", "--filter", "@degenradar/api", "start"]

# ── Web ────────────────────────────────────────────────────────────────────
FROM build-web AS web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@degenradar/web", "start"]

# ── Worker: token-discovery ────────────────────────────────────────────────
FROM source AS worker-token-discovery
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@degenradar/worker-token-discovery", "start"]

# ── Worker: risk-engine ────────────────────────────────────────────────────
FROM source AS worker-risk-engine
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@degenradar/worker-risk-engine", "start"]

# ── Worker: feature-engine ────────────────────────────────────────────────
FROM source AS worker-feature-engine
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@degenradar/worker-feature-engine", "start"]

# ── Worker: scoring ────────────────────────────────────────────────────────
FROM source AS worker-scoring
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@degenradar/worker-scoring", "start"]

# ── Worker: alerts ────────────────────────────────────────────────────────
FROM source AS worker-alerts
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@degenradar/worker-alerts", "start"]
