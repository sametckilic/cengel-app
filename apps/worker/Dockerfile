FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/generator/package.json packages/generator/package.json
COPY packages/puzzle-core/package.json packages/puzzle-core/package.json
RUN npm ci

COPY apps/worker apps/worker
COPY packages/contracts packages/contracts
COPY packages/generator packages/generator
RUN npm run worker:build
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/packages/contracts ./packages/contracts
COPY packages/generator ./packages/generator
COPY apps/mobile/data/generated/daily ./apps/mobile/data/generated/daily
COPY package.json ./package.json
COPY apps/worker/package.json ./apps/worker/package.json

USER node

CMD ["node", "apps/worker/dist/main.js"]
