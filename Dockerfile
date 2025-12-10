# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install all dependencies (including dev for build)
RUN npm ci
RUN cd server && npm ci

# Copy source files
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy server package files and install production deps only
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server code
COPY server ./server

# Create uploads directory
RUN mkdir -p server/uploads

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 consultify
RUN chown -R consultify:nodejs /app
USER consultify

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3005/api/health || exit 1

# Start server
CMD ["node", "server/index.js"]
