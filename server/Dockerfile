FROM oven/bun:1.3.14 AS install
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM install AS verify
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY tests ./tests
RUN bun run typecheck && bun test

FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=install /app/node_modules ./node_modules
COPY --from=verify /app/package.json ./package.json
COPY --from=verify /app/src ./src
COPY drizzle.config.ts ./drizzle.config.ts
COPY drizzle ./drizzle
RUN mkdir -p /app/data/private && chown -R bun:bun /app/data
USER bun
EXPOSE 3000
ENTRYPOINT ["bun", "src/index.ts"]
