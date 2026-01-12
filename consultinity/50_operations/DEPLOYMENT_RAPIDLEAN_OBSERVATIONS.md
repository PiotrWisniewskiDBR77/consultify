# RapidLean Production Observations - Deployment Guide

## Pre-Deployment Checklist

### 1. Database Migration
```bash
# Run migration script
sqlite3 consultify.db < server/migrations/007_rapidlean_observations.sql

# Verify tables created
sqlite3 consultify.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rapid_lean%';"
```

Expected output:
- `rapid_lean_assessments`
- `rapid_lean_observations`
- `rapid_lean_reports`

### 2. Verify File Upload Directories
```bash
# Create upload directories
mkdir -p uploads/organizations/{orgId}/rapidlean/{assessmentId}
mkdir -p uploads/organizations/{orgId}/rapidlean/reports
mkdir -p uploads/organizations/{orgId}/rapidlean/temp

# Set permissions
chmod -R 755 uploads/organizations
```

### 3. Install Dependencies
```bash
# Backend dependencies (should already be installed)
npm install multer pdfkit exceljs

# Frontend dependencies (should already be installed)
npm install
```

### 4. Environment Variables
Ensure these are set in `.env`:
```env
# File upload settings
MAX_FILE_SIZE=5242880  # 5MB
MAX_FILES_PER_UPLOAD=10

# Report generation
REPORT_STORAGE_PATH=./uploads/organizations
```

## Deployment Steps

### Step 1: Run Database Migration
```bash
cd /path/to/consultify
node -e "const db = require('./server/database'); const fs = require('fs'); const sql = fs.readFileSync('./server/migrations/007_rapidlean_observations.sql', 'utf8'); db.exec(sql, (err) => { if (err) console.error(err); else console.log('Migration successful'); process.exit(0); });"
```

### Step 2: Verify Backend Services
```bash
# Check if services are accessible
node -e "const mapper = require('./server/services/rapidLeanObservationMapper'); console.log('Mapper loaded:', !!mapper);"
node -e "const service = require('./server/services/rapidLeanService'); console.log('Service loaded:', !!service);"
node -e "const report = require('./server/services/rapidLeanReportService'); console.log('Report service loaded:', !!report);"
```

### Step 3: Run Tests
```bash
# Unit tests
npm run test:unit -- rapidLean

# Integration tests
npm run test:integration -- rapidlean-observations

# E2E tests (requires server running)
npm run test:e2e -- rapidlean-observations
```

### Step 4: Build Frontend
```bash
npm run build
```

### Step 5: Start Server
```bash
# Development
npm run dev

# Production
NODE_ENV=production npm start
```

## Post-Deployment Verification

### 1. API Endpoints Test
```bash
# Get templates
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3005/api/rapidlean/templates

# Expected: JSON with 6 templates
```

### 2. Database Verification
```sql
-- Check tables exist
SELECT COUNT(*) FROM rapid_lean_observations;
SELECT COUNT(*) FROM rapid_lean_reports;

-- Check indexes
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_observations%';
```

### 3. File Upload Test
```bash
# Test photo upload (requires authentication)
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "observations=[{\"templateId\":\"value_stream_template\",\"answers\":{}}]" \
  -F "photos=@test-image.jpg" \
  http://localhost:3005/api/rapidlean/observations
```

## Rollback Plan

If issues occur:

1. **Database Rollback:**
```sql
-- Drop new tables
DROP TABLE IF EXISTS rapid_lean_reports;
DROP TABLE IF EXISTS rapid_lean_observations;

-- Remove new columns from rapid_lean_assessments
-- Note: SQLite doesn't support DROP COLUMN, would need to recreate table
```

2. **Code Rollback:**
```bash
git checkout <previous-commit>
npm install
npm run build
```

## Monitoring

### Key Metrics to Monitor
- Observation completion rate
- Assessment generation time
- Report generation success rate
- File upload errors
- API response times

### Log Locations
- Backend logs: `server/logs/`
- Error logs: Check application logs for RapidLean errors
- Upload logs: Check file system errors

## Troubleshooting

### Issue: Migration fails
**Solution:** Check SQLite version (3.8.0+ required)

### Issue: File upload fails
**Solution:** 
- Verify directory permissions
- Check disk space
- Verify multer configuration

### Issue: Report generation fails
**Solution:**
- Check PDF library installation
- Verify report storage path exists
- Check file permissions

### Issue: DRD mapping incorrect
**Solution:**
- Verify observation templates loaded correctly
- Check mapping rules in `rapidLeanObservationTemplates.js`
- Review observation data format

## Support Contacts

- Technical Issues: Check logs and error messages
- User Support: Refer to `docs/user-guide-assessment-module.md`
- API Documentation: `docs/api/assessment-module-api.md`

