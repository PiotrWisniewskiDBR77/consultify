# Production Deployment Guide

**Last Updated:** January 4, 2026  
**Status:** ✅ TypeScript Entry Point Migration Complete - All Database Imports Migrated

---

## Quick Start

### Development
```bash
npm run dev
# Starts both frontend (Vite) and backend (tsx watch)
```

### Production (Compiled - Recommended)
```bash
npm run build:backend
npm run start
# Compiles TypeScript to dist/, then runs compiled JS
# ✅ Entry point migrated to TypeScript
# ✅ All database imports migrated to TypeScript
# ✅ Production-ready compiled version
```

### Production (Development Mode - Fallback)
```bash
npm run start:dev
# Uses tsx runtime - handles TypeScript directly
# Use only if compiled version has issues
```

---

## Architecture Overview

### Current Setup

```
┌─────────────────────────────────────────┐
│  Production Entry Point (RECOMMENDED)   │
│  npm run start                          │
│  ↓                                      │
│  npm run build:backend                  │
│  ↓                                      │
│  node dist/index.js                     │
│  ↓                                      │
│  Compiled TypeScript                    │
│  Full ESM support                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Development Entry Point                │
│  npm run dev:backend                    │
│  ↓                                      │
│  tsx watch src/index.ts                 │
│  ↓                                      │
│  Hot reload + TypeScript runtime        │
└─────────────────────────────────────────┘
```

### Architecture

The codebase uses a hybrid architecture:
- **TypeScript entry point** (`server/src/index.ts`) - fully migrated
- **Legacy JS files** still exist in `routes/` and `services/` but are imported via compiled dist
- **Compiled output** in `server/dist/` - production-ready

---

## Environment Variables

Required for production:

```bash
# Database
DB_TYPE=postgres  # or sqlite
DB_HOST=localhost
DB_PORT=5432
DB_NAME=consultify
DB_USER=postgres
DB_PASSWORD=your_password

# Server
PORT=3005
NODE_ENV=production

# Frontend URL (for CORS)
FRONTEND_URL=https://your-domain.com

# Optional: Redis (for caching, rate limiting)
REDIS_URL=redis://localhost:6379

# Optional: Sentry (for error tracking)
SENTRY_DSN=your_sentry_dsn
```

---

## Deployment Checklist

- [ ] Install dependencies: `npm install`
- [ ] Set environment variables
- [ ] Build backend: `npm run build:backend`
- [ ] Build frontend: `npm run build`
- [ ] Start backend: `npm run start`
- [ ] Verify health: `curl http://localhost:3001/api/health`
- [ ] Check logs for errors
- [ ] Test critical API endpoints

---

## Monitoring

### Health Check Endpoint

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-04T...",
  "latency": 5,
  "database": "connected",
  "aiSystem": { "status": "..." }
}
```

### Logs

Server logs include:
- Startup initialization
- Database connection status
- AI service health
- Error tracking (if Sentry configured)

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Database Connection Issues

1. Check environment variables
2. Verify database is running
3. Check connection string format
4. Review server logs for specific errors

### TypeScript Errors

If you see TypeScript compilation errors:
- Development: Errors are shown but don't block execution
- Production: Check `npm run type-check` before deploying

---

## Performance Considerations

### Compiled Version (Recommended)

- **Startup time:** Optimized for production
- **Memory:** Lower memory footprint
- **CPU:** Better performance
- **Type safety:** Full TypeScript checking at compile time

### Development Mode (tsx)

Use `npm run start:dev` only if:
- You need hot reload during development
- Debugging TypeScript source directly
- Compiled version has issues (should not happen)

---

## Migration Status

| Component | Status | Notes |
|-----------|--------|-------|
| TypeScript Entry Point | ✅ Complete | Production entry point migrated |
| Compiled Production | ✅ Complete | `npm run start` uses compiled version |
| Legacy JS Files | ⏳ Pending | Still exist but imported via dist |
| TypeScript Errors | ⚠️ Some | Non-blocking, need cleanup |

---

## Next Steps

1. **Fix remaining TypeScript compilation errors** (non-blocking)
2. **Remove legacy JS files** once all imports verified
3. **Re-enable strict unused variable checks** after cleanup

---

## Support

For issues or questions:
1. Check `docs/ENTRY_POINT_MIGRATION_REPORT.md` for detailed migration info
2. Review server logs for specific errors
3. Verify environment variables are set correctly

---

*Documentation generated: January 4, 2026*

