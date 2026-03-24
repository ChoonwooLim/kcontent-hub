FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev
COPY ./package*.json ./
RUN npm install --legacy-peer-deps --ignore-scripts
COPY ./ ./
RUN npx prisma generate 2>/dev/null || true
ENV NEXT_TELEMETRY_DISABLED=1
ENV AUTH_SECRET="kcontent-studio-secret-key-2026-orbitron"
ENV AUTH_TRUST_HOST=true
RUN npm run build
RUN mkdir -p public prisma

FROM node:20-alpine AS runner
WORKDIR /app

# 시스템 의존성: openssl + ffmpeg + python3 + yt-dlp
RUN apk add --no-cache openssl ffmpeg python3 curl \
 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp \
 && mkdir -p tmp_downloads \
 && yt-dlp --version \
 && ffmpeg -version | head -1

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3555
ENV AUTH_SECRET="kcontent-studio-secret-key-2026-orbitron"
ENV AUTH_TRUST_HOST=true
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate 2>/dev/null || true
EXPOSE 3555
CMD sh -c "npx prisma db push --skip-generate 2>/dev/null || true; npx next start -p 3555"
