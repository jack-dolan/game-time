FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
COPY client/package.json client/package.json

RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Patch OS packages in the base layer. node:20-alpine lags Alpine's own
# security updates between rebuilds, so without this the image ships known-fixed
# CVEs in openssl and friends. The cost is that two builds of the same commit
# can pull slightly different package versions.
RUN apk --no-cache upgrade

RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
COPY client/package.json client/package.json

RUN npm ci --omit=dev

COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

USER app
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
