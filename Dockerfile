# Stage 1: Install dependencies and build the application
FROM node:18-alpine AS builder
WORKDIR /app

# Install build tools if necessary (e.g., for some native modules)
# RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
# Install all dependencies (including dev) needed for the build
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# The 'node' user is created by the base image with UID/GID 1000.
# This aligns with PUID=1000, PGID=1000 set in docker-compose.yml.

# Copy package.json and package-lock.json to install only production dependencies
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --only=production

# Copy built artifacts from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
# If you have a .env.production file that should be part of the image and not supplied by docker-compose, copy it here.
# e.g. COPY --from=builder /app/.env.production ./.env.production

# Switch to the non-root 'node' user
USER node

EXPOSE 3000

# The `package.json` defines `start` as `next start`.
# `next start` by default listens on port 3000, which matches the internal port in docker-compose.yml.
CMD ["npm", "run", "start"]
