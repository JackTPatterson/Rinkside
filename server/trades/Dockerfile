FROM node:24-alpine
WORKDIR /app
COPY server/trades/package*.json server/trades/
RUN npm ci --omit=dev --prefix server/trades
COPY server/trades server/trades
COPY src/data/teams.js src/data/teams.js
WORKDIR /app/server/trades
ENV NODE_ENV=production PORT=8787 TRADE_DB_PATH=/data/trades.sqlite
EXPOSE 8787
CMD ["node", "index.mjs"]
