# Consultify Multi-stage Dockerfile
# Production-optimized build with security best practices

# ==========================================
# STAGE 1: Dependencies
# ==========================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install security updates
RUN apk update && apk upgrade --no-cache

# Copy package files
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/

# Install dependencies
RUN npm ci --omit=dev
RUN cd server && npm ci --omit=dev

# ==========================================
# STAGE 2: Frontend Builder
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package.json package-lock.json ./
# Use npm ci for deterministic builds, fallback to npm install if lock file is out of sync
RUN npm ci || (echo "Lock file out of sync, updating..." && npm install)

# Copy source and build
COPY . .
RUN npm run build

# ==========================================
# STAGE 3: Backend Builder
# ==========================================
FROM node:20-alpine AS backend-builder
WORKDIR /app

# Copy package files and TypeScript config files needed for build
COPY server/package.json server/package-lock.json ./
COPY server/tsconfig.json server/tsconfig.build.json ./
RUN npm ci

# Copy source and build
COPY server/ .
RUN npm run build

# ==========================================
# STAGE 4: Production API
# ==========================================
FROM node:20-alpine AS api
WORKDIR /app

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Install security updates and required tools
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache dumb-init curl

# Copy production dependencies
COPY --from=deps /app/server/node_modules ./node_modules

# Copy built backend
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/package.json ./

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Expose port
EXPOSE 3001

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# ==========================================
# STAGE 5: Production Frontend (nginx)
# ==========================================
FROM nginx:1.25-alpine AS frontend
WORKDIR /usr/share/nginx/html

# Security updates
RUN apk update && apk upgrade --no-cache

# Remove default nginx content
RUN rm -rf ./*

# Copy built frontend
COPY --from=frontend-builder /app/dist .

# Copy nginx config
COPY infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/nginx/default.conf /etc/nginx/conf.d/default.conf

# Security: Create non-root user and set permissions
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /usr/share/nginx/html

# Switch to non-root user
USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
