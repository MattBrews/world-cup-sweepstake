FROM node:22-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend-deps
RUN apk add --no-cache python3 make g++ sqlite
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
RUN apk del python3 make g++

FROM node:22-alpine
RUN apk add --no-cache sqlite
WORKDIR /app

COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/src ./backend/src
COPY --from=frontend-build /build/frontend/dist ./frontend/dist

RUN mkdir -p /data

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

VOLUME ["/data"]

CMD ["node", "backend/src/index.js"]
