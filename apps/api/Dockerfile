FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --no-audit --no-fund
COPY apps/api apps/api
COPY scripts scripts
RUN npm run db:generate && npm run build -w @erams/api
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/src/main.js"]
