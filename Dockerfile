FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev
COPY ./package*.json ./
RUN npm install --legacy-peer-deps --ignore-scripts
COPY ./ ./
RUN npx prisma generate 2>/dev/null || true
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN mkdir -p public prisma

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3555
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate 2>/dev/null || true
EXPOSE 3555
CMD sh -c "npx prisma db push --skip-generate 2>/dev/null || true; npx next start -p 3555"
