# Disaster Recovery Plan

**Version:** 1.0.0
**Last Updated:** January 4, 2026

## 1. Objectives

### Recovery Time Objective (RTO)
- **Critical Systems:** 1 hour
- **Non-Critical Systems:** 4 hours

### Recovery Point Objective (RPO)
- **Database:** 1 hour (via continuous WAL archiving / frequent snapshots)
- **Files:** 24 hours (daily backups)

## 2. Backup Strategy

### Automated Backups
- **Frequency:** Daily (full), Hourly (incremental capability)
- **Retention:** 30 days (daily), 12 months (monthly)
- **Storage:** Local + Cloud Object Storage (S3/GCS)
- **Encryption:** AES-256-GCM at rest

### Verification
- **Automated Checks:** `BackupService.verifyBackupIntegrity()` runs after creation.
- **Manual Drills:** Quarterly restoration tests.

## 3. Multi-Region Strategy

### Data Residency & Redundancy
- Backups are replicated to cross-region S3 buckets (e.g., `eu-central-1` to `eu-west-1`).
- Database configuration supports read replicas in secondary regions for read-availablity during primary region outages.

## 4. Recovery Procedures

### Scenario A: Database Corruption
1. **Identify** the corruption scope.
2. **Select** the last known good backup from `BackupService.listBackups()`.
3. **Execute Restore:**
   ```bash
   node scripts/restore-backup.js <backup-id>
   ```
4. **Verify** integrity using `verifyBackupIntegrity`.

### Scenario B: Region Failure
1. **Switch** DNS/LoadBalancer to secondary region.
2. **Promote** Read Replica to Primary OR Restore from replicated S3 backup.
3. **Update** `DATABASE_URL` env var.
4. **Restart** services.

## 5. Contact List
- **Infrastructure Lead:** infra@consultinity.com
- **CTO:** cto@dbr77.com
