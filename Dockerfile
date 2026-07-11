# Meridian — single-service image: the Express BFF serves the built SPA + /api.

# --- Stage 1: build the SPA (dist/) ---
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: runtime (BFF serves dist/ + /api on one port) ---
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Server deps only (production).
COPY server/package*.json ./server/
RUN npm --prefix server ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 8787
CMD ["node", "server/src/index.js"]
