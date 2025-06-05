
# Stage 1: Builder
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package.json ./
# Se você tiver um package-lock.json, descomente a linha abaixo
# COPY package-lock.json ./

# Install dependencies (incluindo devDependencies para o build)
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Stage 2: Runner
FROM node:20-slim AS runner

WORKDIR /app

# Set environment to production
ENV NODE_ENV production

# Create a non-root user and group for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets from the builder stage
# .next e public são os mais importantes para a execução
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/public ./public

# Copiar node_modules e package.json é necessário se não estiver usando output: 'standalone'
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# Se o next.config.ts for necessário em tempo de execução pelo 'next start', copie-o também.
# Geralmente, com a cópia do .next, as configurações de build já estão incorporadas.
# COPY --from=builder /app/next.config.ts ./next.config.ts

# Switch to the non-root user
USER nextjs

# Expose port 3000 (padrão do Next.js para 'next start')
EXPOSE 3000

# Set the PORT environment variable
ENV PORT 3000

# Command to run the application
# Usa 'npm run start' que por sua vez executa 'next start'
CMD ["npm", "run", "start"]
