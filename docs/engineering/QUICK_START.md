# Quick Start Guide

## 🚀 Production Deployment

### Recommended: Use tsx Runtime

```bash
npm run start:dev
```

**Why?** Handles TypeScript directly, no compilation needed, works with hybrid TS/JS architecture.

### Alternative: Compiled Version

```bash
npm run build:backend
npm run start
```

**Note:** May have import path issues. Use `start:dev` until migration is complete.

---

## 🛠️ Development

```bash
npm run dev
# Starts both frontend and backend with hot reload
```

---

## ✅ Verification

### Check Server Status

```bash
curl http://localhost:3005/api/health
```

Expected:

```json
{
  "status": "ok",
  "database": "connected",
  ...
}
```

---

## 📚 Documentation

- **Deployment:** `docs/PRODUCTION_DEPLOYMENT.md`
- **Migration Details:** `docs/ENTRY_POINT_MIGRATION_REPORT.md`
- **Summary:** `docs/MIGRATION_SUMMARY.md`

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
lsof -i :3005
kill -9 <PID>
```

### Server Won't Start

1. Check environment variables
2. Verify database is running
3. Review server logs

---

_Last updated: January 4, 2026_
