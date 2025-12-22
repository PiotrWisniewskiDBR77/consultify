# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install all dependencies (including dev for build)
# Use npm install if package-lock.json is out of sync, otherwise use npm ci for faster installs
RUN if [ -f package-lock.json ]; then npm ci || npm install; else npm install; fi
RUN if [ -f server/package-lock.json ]; then cd server && npm ci || npm install; else cd server && npm install; fi

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
# Use npm install if package-lock.json is out of sync, otherwise use npm ci for faster installs
RUN cd server && if [ -f package-lock.json ]; then npm ci --omit=dev || npm install --omit=dev; else npm install --omit=dev; fi

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
# Railway uses HTTP healthchecks configured in railway.json, but Docker HEALTHCHECK provides fallback
# Using Node.js since alpine doesn't include wget/curl by default
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3005) + '/api/health', (r) => { r.on('data', () => {}); r.on('end', () => process.exit(r.statusCode === 200 ? 0 : 1)); }).on('error', () => process.exit(1))"

# Start server
CMD ["node", "server/index.js"]
