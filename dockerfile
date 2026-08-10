FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
# pg_dump/pg_restore for the Backup & Recovery module (app/lib/backup/pg.ts). The major version
# must match supabase/config.toml's `major_version` — pg_dump refuses to dump a newer server.
RUN apk add --no-cache postgresql17-client
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]