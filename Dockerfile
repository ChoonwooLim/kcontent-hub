# ─── Build Stage ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl openssl-dev

# Install dependencies (WITH scripts so postinstall/prisma generate runs)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Generate Prisma client & build (uses local next from node_modules, not npx)
RUN npm run build

# ─── Production Stage ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# nextjs standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "server.js"]
