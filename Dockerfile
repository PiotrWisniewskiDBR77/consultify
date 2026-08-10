# Consultinity Multi-stage Dockerfile
# Production-optimized build with security best practices

# ==========================================
# STAGE 1: Dependencies
# ==========================================
FROM node:25-alpine AS deps
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
FROM node:25-alpine AS frontend-builder
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
FROM node:25-alpine AS backend-builder
WORKDIR /app

# Copy package files and TypeScript config files needed for build
COPY server/package.json server/package-lock.json ./
COPY server/tsconfig.json ./
COPY server/tsconfig.build.json ./
RUN npm ci

# Copy source and build
COPY server/ .
# Create aiPipeline.js for case-sensitive filesystems (macOS git can't track both)
# Note: We don't create AIPipeline.js re-export as it would overwrite the compiled output
RUN if [ ! -f src/services/ai/aiPipeline.js ]; then \
      echo "Creating aiPipeline.js re-export file..." && \
      printf '// Re-export from AIPipeline.js (compiled) for case-sensitive file systems\n// This file allows imports using lowercase '\''aiPipeline'\'' to work on case-sensitive filesystems\nexport * from '\''./AIPipeline.js'\'';\nexport { AIPipeline } from '\''./AIPipeline.js'\'';\nexport { default } from '\''./AIPipeline.js'\'';\n' > src/services/ai/aiPipeline.js; \
    fi
# Create aiSchemaValidator.js for case-sensitive filesystems (macOS git can't track both)
# Note: We don't create AISchemaValidator.js re-export as it would overwrite the compiled output
RUN if [ ! -f src/utils/aiSchemaValidator.js ]; then \
      echo "Creating aiSchemaValidator.js re-export file..." && \
      printf '// Re-export from AISchemaValidator.js (compiled) for case-sensitive file systems\n// This file allows imports using lowercase '\''aiSchemaValidator'\'' to work on case-sensitive filesystems\nexport * from '\''./AISchemaValidator.js'\'';\n' > src/utils/aiSchemaValidator.js; \
    fi
RUN npm run build
# Copy .js re-export files to dist (TypeScript excludes .js files but we need them at runtime)
# Note: Only copy lowercase re-export files - uppercase files are compiled outputs from TypeScript
RUN mkdir -p dist/src/utils dist/src/services/ai && \
    if [ -f src/utils/aiSchemaValidator.js ]; then \
      cp src/utils/aiSchemaValidator.js dist/src/utils/aiSchemaValidator.js && \
      echo "✓ Copied aiSchemaValidator.js"; \
    else \
      echo "⚠️  aiSchemaValidator.js not found in src"; \
    fi && \
    if [ -f src/services/ai/aiPipeline.js ]; then \
      cp src/services/ai/aiPipeline.js dist/src/services/ai/aiPipeline.js && \
      echo "✓ Copied aiPipeline.js"; \
    else \
      echo "⚠️  aiPipeline.js not found in src"; \
    fi && \
    echo "Verifying copied files:" && \
    ls -la dist/src/utils/*.js 2>/dev/null | grep -i schema || echo "No schema files in dist/src/utils" && \
    ls -la dist/src/services/ai/*.js 2>/dev/null | grep -i pipeline || echo "No pipeline files in dist/src/services/ai"

# ==========================================
# STAGE 4: Production API
# ==========================================
FROM node:25-alpine AS api
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
CMD ["node", "dist/src/index.js"]

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
