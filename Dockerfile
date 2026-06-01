FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY pnpm-workspace.yaml ./

# Copy packages
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @gigify/db generate

# Build the web app
RUN pnpm --filter web build

WORKDIR /app/apps/web

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["pnpm", "start", "--", "-p", "3000", "-H", "0.0.0.0"]
