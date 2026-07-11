# ---- build stage ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:24-slim
ENV NODE_ENV=production \
    DATABASE_PATH=/data/timeclock.db \
    PORT=3000
WORKDIR /app
COPY --from=build /app/server/package.json server/package.json
RUN cd server && npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
