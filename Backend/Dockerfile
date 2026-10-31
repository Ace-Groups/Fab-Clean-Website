# Fab Clean API — Cloud Run (build from repository root)
#   docker build -f Backend/Dockerfile -t fab-clean-api .
#   gcloud builds submit --config cloudbuild.yaml
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY Backend ./Backend
COPY lib ./lib
COPY Frontend/package.json ./Frontend/package.json

# Frontend package.json is listed so the workspace lockfile resolves; we do not build it here.
RUN pnpm install --frozen-lockfile --filter @workspace/api-server...
RUN pnpm --filter @workspace/api-server build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs \
  && corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/Backend/package.json ./Backend/
COPY --from=build /app/Backend/dist ./Backend/dist
COPY --from=build /app/lib ./lib
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/Backend/node_modules ./Backend/node_modules

USER nodejs
EXPOSE 8080
CMD ["node", "Backend/dist/index.cjs"]
