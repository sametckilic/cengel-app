FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/achievement-core/package.json packages/achievement-core/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/generator/package.json packages/generator/package.json
COPY packages/puzzle-core/package.json packages/puzzle-core/package.json
RUN npm ci

COPY apps/api apps/api
COPY packages packages
RUN npm run api:build
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/packages/achievement-core ./packages/achievement-core
COPY apps/mobile/data/generated ./apps/mobile/data/generated
COPY package.json ./package.json
COPY apps/api/package.json ./apps/api/package.json

USER node
EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
