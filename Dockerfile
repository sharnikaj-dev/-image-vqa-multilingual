FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build
RUN npx esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=server.mjs

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.mjs ./server.mjs
EXPOSE 8080
CMD ["node", "server.mjs"]