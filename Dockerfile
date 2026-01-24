# ---------- Stage 1: Build ----------
FROM node:22 AS builder
WORKDIR /usr/src/app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build   # tsc อยู่ตรงนี้แน่นอน

# ---------- Stage 2: Runtime ----------
FROM node:22
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/index.js"]
