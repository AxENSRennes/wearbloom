FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
RUN npm install -g bun
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/api/package.json ./packages/api/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY packages/validators/package.json ./packages/validators/
COPY tooling/typescript/package.json ./tooling/typescript/
COPY tooling/eslint/package.json ./tooling/eslint/
COPY tooling/prettier/package.json ./tooling/prettier/

RUN pnpm install --frozen-lockfile

# Runner
FROM base AS runner
COPY --from=deps /app/ ./
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "apps/server/src/index.ts"]
