FROM oven/bun:1
WORKDIR /app

# Copy root workspace files
COPY package.json bun.lockb* tsconfig.json ./

# Copy workspace package.jsons
COPY packages/shared/package.json ./packages/shared/package.json
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY web ./web

# Build
WORKDIR /app/web
RUN bun run build

EXPOSE 3000
CMD ["bun", "build/index.js"]
