FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --include=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# python3/bash so whitelisted .py/.sh automation scripts can actually run.
# prisma/tsx are devDependencies not included in the standalone output, but the
# entrypoint needs them once at container start to run migrations + seed.
RUN apk add --no-cache python3 bash && npm install -g prisma@6.19.3 tsx@4.19.2
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Next bundles app deps into its own compiled output for the server runtime, but the
# standalone seed script runs outside that bundle (via tsx) and needs its own copy.
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
