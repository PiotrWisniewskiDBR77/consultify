# Recovery & Restore Playbook — Consultivity

> **Owner:** Platform Engineering · **Last updated:** 2026-02-21  
> **Ticket:** T107 — System Stability & Uptime Assurance Framework

---

## 1. Backup Strategy

| Parameter | Value |
|---|---|
| **Format** | `pg_dump` (custom format `-Fc`) |
| **Schedule** | Daily at 03:00 UTC |
| **Retention** | 30 days |
| **Storage** | Off-site S3 bucket (`consultivity-backups`) |
| **Encryption** | AES-256 at rest, TLS in transit |

### Backup Verification Checklist

- [ ] Backup file exists and is non-zero size
- [ ] `pg_restore --list <backup_file>` succeeds (TOC readable)
- [ ] Backup timestamp matches expected schedule
- [ ] File hash matches manifest (if stored)
- [ ] Test restore to staging completed within last 7 days

---

## 2. Restore Procedure

### Prerequisites

- Access to backup storage (S3 credentials)
- PostgreSQL superuser or owner role
- Maintenance window announced (if production)

### Step-by-step

```bash
# 1. Stop application services
pm2 stop all  # or: systemctl stop consultivity

# 2. Download latest backup
aws s3 cp s3://consultivity-backups/latest.dump /tmp/restore.dump

# 3. Drop and recreate target database (CAUTION)
psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='consultivity' AND pid <> pg_backend_pid();"
psql -U postgres -c "DROP DATABASE IF EXISTS consultivity;"
psql -U postgres -c "CREATE DATABASE consultivity OWNER consultivity;"

# 4. Restore from backup
pg_restore -U consultivity -d consultivity -Fc --no-owner --no-acl /tmp/restore.dump

# 5. Run pending migrations (if any)
cd /app && npm run db:migrate

# 6. Verify schema
psql -U consultivity -d consultivity -c "\dt" | head -20

# 7. Restart application
pm2 start all  # or: systemctl start consultivity

# 8. Verify health
curl -sf http://localhost:3005/ping && echo "OK"
curl -sf http://localhost:3005/api/health/ready
```

---

## 3. Sanity Check Queries

Run after every restore to verify data integrity:

```sql
-- Core tables row counts
SELECT 'users' AS tbl, count(*) FROM users
UNION ALL SELECT 'organizations', count(*) FROM organizations
UNION ALL SELECT 'projects', count(*) FROM projects
UNION ALL SELECT 'assessments', count(*) FROM assessments
UNION ALL SELECT 'initiatives', count(*) FROM initiatives
UNION ALL SELECT 'artifacts', count(*) FROM artifacts
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;

-- Check for orphaned records
SELECT count(*) AS orphaned_projects
FROM projects p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE o.id IS NULL;

-- Verify latest audit log entry timestamp
SELECT max(created_at) AS latest_audit FROM audit_logs;

-- Check migration version
SELECT * FROM migrations ORDER BY id DESC LIMIT 5;
```

---

## 4. Rollback Procedure for Failed Deployments

### Immediate Rollback (< 5 min)

```bash
# 1. Revert to previous deployment
git log --oneline -5  # identify previous good commit
git checkout <good_commit_hash>

# 2. Rebuild and restart
npm run build:backend && npm run build
pm2 restart all

# 3. Verify
curl -sf http://localhost:3005/api/health/aggregated | jq .
```

### Database Migration Rollback

```bash
# Check current migration state
npm run db:rollback -- --dry-run

# Execute rollback (one migration at a time)
npm run db:rollback

# Verify
psql -U consultivity -d consultivity -c "SELECT * FROM migrations ORDER BY id DESC LIMIT 3;"
```

### Full Rollback (with data restore)

If a deployment corrupted data:

1. Stop all services
2. Restore from pre-deployment backup (see Section 2)
3. Deploy previous known-good version
4. Run sanity checks (Section 3)
5. Gradually re-enable traffic

---

## 5. Emergency Contacts & Escalation

| Role | Contact | When |
|---|---|---|
| **On-call Engineer** | `ALERT_EMAIL` env var | First responder |
| **Platform Lead** | Slack #platform-critical | L3 escalation |
| **Database Admin** | Internal wiki | Data corruption |
| **Cloud Provider** | AWS Support (Business) | Infrastructure outage |

### Communication Template

```
INCIDENT: [Brief description]
SEVERITY: [Critical / Warning]
IMPACT: [Users affected, services down]
STATUS: [Investigating / Mitigating / Resolved]
ETA: [Expected resolution time]
ACTIONS TAKEN: [Steps completed so far]
```

---

## 6. Post-Incident Review

After every P1/P2 incident:

1. Timeline of events (UTC)
2. Root cause analysis
3. Impact assessment (users, duration, data)
4. Action items with owners and deadlines
5. SLO budget impact calculation
6. Update this playbook if procedures were insufficient
