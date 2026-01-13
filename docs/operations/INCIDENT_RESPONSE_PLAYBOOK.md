# Incident Response Playbook

**Version:** 1.0.0  
**Last Updated:** 2026-01-04

## Overview

This playbook provides step-by-step procedures for responding to common incidents in the Consultinity Enterprise SaaS platform. Follow these procedures to ensure consistent and effective incident response.

## Incident Severity Levels

### P0 - Critical

- System completely down
- Data loss or corruption
- Security breach
- **Response Time:** Immediate (< 15 minutes)

### P1 - High

- Major feature unavailable
- Performance degradation (> 50%)
- Partial data unavailability
- **Response Time:** < 1 hour

### P2 - Medium

- Minor feature unavailable
- Performance degradation (20-50%)
- Non-critical errors
- **Response Time:** < 4 hours

### P3 - Low

- Cosmetic issues
- Minor performance issues (< 20%)
- **Response Time:** < 24 hours

## Common Failure Scenarios

### Scenario 1: Database Connection Failure

**Symptoms:**

- 500 errors on database queries
- Health check shows database disconnected
- Application logs show connection errors

**Response Steps:**

1. **Verify Database Status**

   ```bash
   curl http://localhost:3005/api/health
   ```

2. **Check Database Connectivity**

   ```bash
   # PostgreSQL
   psql $DATABASE_URL -c "SELECT 1"

   # SQLite
   sqlite3 database.db "SELECT 1"
   ```

3. **Check Connection Pool**
   - Review `db_connections_active` metric
   - Check for connection pool exhaustion

4. **Restart Application** (if needed)

   ```bash
   # Graceful restart
   pm2 restart consultinity
   # or
   systemctl restart consultinity
   ```

5. **Escalate** if database is unreachable

**Prevention:**

- Monitor `db_connections_active` metric
- Set up alerts for connection pool > 80%
- Regular database health checks

### Scenario 2: Redis Connection Failure

**Symptoms:**

- Rate limiting not working
- Cache misses increasing
- Health check shows Redis disconnected

**Response Steps:**

1. **Verify Redis Status**

   ```bash
   curl http://localhost:3005/api/health
   # Check redis field in response
   ```

2. **Check Redis Connectivity**

   ```bash
   redis-cli -u $REDIS_URL ping
   ```

3. **System Should Degrade Gracefully**
   - Rate limiting falls back to in-memory
   - Cache falls back to database
   - Application continues to function

4. **Restart Redis** (if needed)

   ```bash
   # Cloud provider specific
   # Railway: Check Redis service status
   # AWS ElastiCache: Check cluster status
   ```

5. **Monitor Fallback Performance**
   - Check if in-memory fallback is working
   - Monitor for performance degradation

**Prevention:**

- Monitor `redis_connected` metric
- Set up alerts for Redis disconnection
- Test fallback mechanisms regularly

### Scenario 3: High Error Rate

**Symptoms:**

- Error rate > 5%
- Many 500 errors in logs
- User complaints

**Response Steps:**

1. **Check Error Metrics**

   ```bash
   curl http://localhost:3005/api/performance/metrics
   # Review errors.rate and errors.total
   ```

2. **Review Error Logs**

   ```bash
   # Check application logs
   tail -f logs/application.log | grep ERROR

   # Check Sentry for error details
   # https://sentry.io/organizations/your-org/issues/
   ```

3. **Identify Root Cause**
   - Database errors?
   - External API failures?
   - Memory issues?
   - Code bugs?

4. **Apply Fix**
   - Database: Check connection pool, optimize queries
   - External API: Check circuit breaker status
   - Memory: Check for leaks, restart if needed
   - Code: Deploy hotfix

5. **Monitor Recovery**
   - Watch error rate decrease
   - Verify system stability

**Prevention:**

- Set up alerts for error rate > 1%
- Regular error log reviews
- Automated error tracking (Sentry)

### Scenario 4: High Latency

**Symptoms:**

- P95 latency > 1000ms
- Slow API responses
- User complaints about slowness

**Response Steps:**

1. **Check Performance Metrics**

   ```bash
   curl http://localhost:3005/api/performance/metrics
   # Review latency.p95 and latency.p99
   ```

2. **Identify Bottleneck**
   - Database queries slow?
   - External API delays?
   - High CPU usage?
   - Memory pressure?

3. **Check Database Performance**

   ```bash
   # Review slow query log
   # PostgreSQL
   SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
   ```

4. **Check External APIs**
   - Review circuit breaker status
   - Check LLM provider health
   - Verify network connectivity

5. **Scale Resources** (if needed)
   - Increase database connection pool
   - Add read replicas
   - Scale application instances

**Prevention:**

- Monitor P95/P99 latency
- Set up alerts for latency > 1000ms
- Regular performance reviews

### Scenario 5: Memory Leak

**Symptoms:**

- Memory usage continuously increasing
- Performance degradation over time
- Application crashes

**Response Steps:**

1. **Verify Memory Leak**

   ```bash
   # Check memory metrics
   curl http://localhost:3005/api/performance/metrics
   # Review memory_usage_bytes trend
   ```

2. **Run Memory Leak Detection**

   ```bash
   npm run test:memory-leak
   ```

3. **Check Memory Monitor**
   - Review `MemoryMonitor` alerts
   - Check for memory growth > 20%

4. **Restart Application** (temporary fix)

   ```bash
   pm2 restart consultinity
   ```

5. **Investigate Root Cause**
   - Review recent code changes
   - Check for unclosed connections
   - Review memory cleanup jobs

6. **Deploy Fix**
   - Fix memory leak in code
   - Deploy hotfix

**Prevention:**

- Regular memory leak tests
- Monitor memory usage trends
- Automated memory cleanup jobs

### Scenario 6: Security Incident

**Symptoms:**

- Unauthorized access attempts
- Suspicious activity in logs
- Data breach indicators

**Response Steps:**

1. **Immediate Actions**
   - Isolate affected systems
   - Preserve logs and evidence
   - Notify security team

2. **Review Audit Logs**

   ```bash
   # Query audit logs
   # Use AuditLogger.getHistory() or direct DB query
   ```

3. **Identify Attack Vector**
   - SQL injection?
   - Authentication bypass?
   - Privilege escalation?

4. **Containment**
   - Block malicious IPs
   - Revoke compromised tokens
   - Disable affected accounts

5. **Remediation**
   - Patch vulnerabilities
   - Update security controls
   - Review access permissions

6. **Post-Incident**
   - Conduct post-mortem
   - Update security procedures
   - Document lessons learned

**Prevention:**

- Regular security audits
- Penetration testing
- Security monitoring

## Automated Rollback Procedures

### Rollback via Git

```bash
# Identify last good commit
git log --oneline

# Rollback to specific commit
git revert <commit-hash>
git push origin main

# Or reset to previous commit (if no one else has pulled)
git reset --hard <commit-hash>
git push --force origin main
```

### Rollback via Deployment Platform

**Railway:**

1. Go to project → Deployments
2. Find last successful deployment
3. Click "Redeploy"

**Docker:**

```bash
# Rollback to previous image
docker pull consultinity:previous-version
docker-compose up -d
```

### Database Rollback

```bash
# Restore from backup
node scripts/restore-backup.js <backup-id>
```

## Post-Mortem Template

### Incident Summary

- **Date:** YYYY-MM-DD
- **Duration:** X hours
- **Severity:** P0/P1/P2/P3
- **Affected Services:** List services
- **Impact:** Description of impact

### Timeline

1. **Detection:** Time and method
2. **Response:** Actions taken
3. **Resolution:** Time and method
4. **Recovery:** Time to full recovery

### Root Cause

- **Primary Cause:** Description
- **Contributing Factors:** List factors

### Impact

- **Users Affected:** Number
- **Downtime:** Duration
- **Data Loss:** Yes/No and details

### Actions Taken

1. Immediate actions
2. Investigation steps
3. Resolution steps

### Lessons Learned

- **What Went Well:** List items
- **What Could Be Improved:** List items
- **Action Items:** List with owners and deadlines

### Prevention Measures

- **Short-term:** Immediate fixes
- **Long-term:** Architectural improvements

## Escalation Procedures

### Level 1: On-Call Engineer

- **Response Time:** < 15 minutes (P0), < 1 hour (P1)
- **Actions:** Initial triage, basic fixes

### Level 2: Senior Engineer

- **Trigger:** P0 incidents, complex issues
- **Response Time:** < 30 minutes
- **Actions:** Advanced troubleshooting, architecture decisions

### Level 3: Engineering Lead

- **Trigger:** P0 incidents, security breaches
- **Response Time:** Immediate
- **Actions:** Strategic decisions, customer communication

### Level 4: CTO/VP Engineering

- **Trigger:** Critical security breaches, extended downtime
- **Response Time:** Immediate
- **Actions:** Executive decisions, external communication

## Communication

### Internal Communication

**Slack Channels:**

- `#incidents` - All incidents
- `#incidents-critical` - P0/P1 incidents only
- `#engineering` - Technical discussions

**Email:**

- Send to: `engineering@consultinity.com`
- Include: Severity, summary, status

### External Communication

**Status Page:**

- Update status page for user-facing incidents
- Provide regular updates (every 15 minutes for P0)

**Customer Communication:**

- For P0/P1 incidents affecting customers
- Template: See `docs/COMMUNICATION_TEMPLATES.md`

## Monitoring and Alerting

### Critical Alerts

- **Error Rate > 5%:** P0
- **P95 Latency > 2000ms:** P1
- **Database Disconnected:** P0
- **Redis Disconnected:** P1
- **Memory Usage > 90%:** P1
- **Security Breach:** P0

### Alert Channels

- **Slack:** `#incidents-critical`
- **Email:** `engineering@consultinity.com`
- **SMS:** On-call engineer (P0 only)

## Recovery Verification

After incident resolution:

1. **Verify System Health**

   ```bash
   curl http://localhost:3005/api/health
   curl http://localhost:3005/api/health/ready
   ```

2. **Check Metrics**
   - Error rate < 1%
   - Latency within baselines
   - All services connected

3. **Run Smoke Tests**

   ```bash
   npm run test:integration
   ```

4. **Monitor for 1 Hour**
   - Watch metrics dashboard
   - Check for recurring issues

## References

- Monitoring Dashboard: `docs/MONITORING_DASHBOARD.md`
- Load Testing Guide: `docs/LOAD_TESTING_GUIDE.md`
- Security Runbooks: `docs/SECURITY_RUNBOOKS.md`
- Disaster Recovery: `docs/DISASTER_RECOVERY.md`
