# DegenRadar — Solana Intelligence Platform

> Event-driven token discovery, scoring, and narrative detection for Solana.

## Architecture

```
Solana → Helius/Birdeye → Redis (BullMQ) → Workers → PostgreSQL
                                                          ↓
                                              Feature Engine → Scoring Engine
                                                          ↓
                                              WebSocket Gateway → Next.js Dashboard
                                                          ↓
                                                   Telegram Alerts
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, TailwindCSS, shadcn/ui, Recharts |
| API | Fastify, Zod |
| ORM | Drizzle |
| Database | PostgreSQL |
| Queue | BullMQ + Redis |
| Blockchain | @solana/web3.js, Helius, Birdeye, Jupiter |
| Monorepo | pnpm + Turborepo |

## Quick Start

```bash
# 1. Copy env
cp .env.example .env
# Fill in your API keys

# 2. Start infrastructure
docker-compose up -d

# 3. Install dependencies
pnpm install

# 4. Run migrations
pnpm db:migrate

# 5. Start development
pnpm dev
```

## Project Structure

```
degenradar/
├── apps/
│   ├── web/          ← Next.js dashboard
│   └── api/          ← Fastify API
├── workers/
│   ├── token-discovery/
│   ├── trade-ingestion/
│   ├── holder-analysis/
│   ├── risk-engine/
│   ├── feature-engine/
│   ├── scoring/
│   └── alerts/
├── packages/
│   ├── db/           ← Drizzle schema + migrations
│   ├── redis/        ← BullMQ queue definitions
│   ├── helius/       ← Helius client
│   ├── birdeye/      ← Birdeye client
│   ├── jupiter/      ← Jupiter client
│   ├── solana/       ← Solana web3 helpers
│   ├── scoring/      ← Scoring engine
│   ├── features/     ← Feature calculators
│   ├── types/        ← Shared TypeScript types
│   ├── config/       ← Env config
│   └── logger/       ← Pino logger
└── infra/
    └── docker/
```
