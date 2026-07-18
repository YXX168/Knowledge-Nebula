FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

LABEL org.opencontainers.image.title="知识星云（Knowledge Nebula）" \
      org.opencontainers.image.description="本地优先、自托管的知识库工作台，支持全文搜索、多格式预览、安全编辑与实时同步" \
      org.opencontainers.image.source="https://github.com/YXX168/Knowledge-Nebula" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8765 \
    SCAN_INTERVAL_MS=1200 \
    KNOWLEDGE_CONFIG_PATH=/config/config.json

WORKDIR /app
RUN mkdir -p /config /knowledge && chown -R node:node /app /config /knowledge
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server.mjs ./server.mjs

USER node
EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8765/ >/dev/null || exit 1

CMD ["node", "server.mjs"]
