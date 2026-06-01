FROM node:20-slim AS base

# Install system deps: openssl for Prisma, Chromium deps for Playwright deep scrape
RUN apt-get update -y && apt-get install -y \
  openssl libssl-dev \
  chromium \
  fonts-liberation \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
  && rm -rf /var/lib/apt/lists/*

# Tell Playwright to use the system Chromium instead of downloading its own
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY pnpm-workspace.yaml ./

# Copy packages — schema.prisma must be copied before generate
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Delete any cached musl binaries and force a clean generate
RUN find /app/node_modules -name "libquery_engine-linux-musl*" -delete 2>/dev/null || true
RUN find /app/node_modules -name "libquery_engine-linux-arm64*" -delete 2>/dev/null || true

# Generate Prisma client fresh with debian-openssl-3.0.x only
RUN PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x pnpm --filter @gigify/db generate

# Build the web app
RUN pnpm --filter web build

WORKDIR /app/apps/web

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["pnpm", "start", "--", "-p", "3000", "-H", "0.0.0.0"]
