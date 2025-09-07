# Stage 1: Build
FROM node:22 AS builder
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN yarn install --frozen-lockfile

# Copy source
COPY . .

# Build TypeScript -> dist/
RUN yarn build   # this should run tsc

# Stage 2: Runtime
FROM node:22
WORKDIR /usr/src/app

# Copy only necessary files from builder
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/src/email-templates ./dist/email-templates

RUN yarn install --production --frozen-lockfile

# Expose Cloud Run port
EXPOSE 8080

# Start app
CMD ["node", "dist/index.js"]
