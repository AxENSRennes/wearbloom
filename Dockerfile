# Stage 1: Install dependencies using Node (pnpm requires corepack/node)
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/api/package.json ./packages/api/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY packages/validators/package.json ./packages/validators/
COPY tooling/typescript/package.json ./tooling/typescript/
COPY tooling/eslint/package.json ./tooling/eslint/
COPY tooling/prettier/package.json ./tooling/prettier/
COPY patches/ ./patches/

RUN pnpm install --frozen-lockfile

# Stage 2: Runtime using Bun (matching architecture spec)
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Copy installed node_modules and workspace config from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=deps /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/validators/node_modules ./packages/validators/node_modules

# Copy workspace config files
COPY package.json pnpm-workspace.yaml turbo.json ./

# Copy only server-relevant source
COPY apps/server/ ./apps/server/
COPY packages/api/ ./packages/api/
COPY packages/auth/ ./packages/auth/
COPY packages/db/ ./packages/db/
COPY packages/validators/ ./packages/validators/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "cd packages/db && bun drizzle-kit push && cd /app && bun run apps/server/src/index.ts"]
