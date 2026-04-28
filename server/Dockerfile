FROM oven/bun:1 as base
WORKDIR /app

# Copy root workspace files
COPY package.json bun.lockb* tsconfig.json ./

# Copy workspace package.jsons to leverage cache and ensure lockfile consistency
COPY packages/shared/package.json ./packages/shared/package.json
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json

# Install dependencies from root
RUN bun install --frozen-lockfile

# Copy source code for shared and server
COPY packages/shared ./packages/shared
COPY server ./server

# Build/Run
WORKDIR /app/server
EXPOSE 8080
CMD ["bun", "src/index.ts"]
