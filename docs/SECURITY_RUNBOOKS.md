# Security Runbooks

**Version:** 1.0  
**Last Updated:** January 4, 2026

---

## Table of Contents

1. [Incident Response](#1-incident-response)
2. [Key Rotation Procedures](#2-key-rotation-procedures)
3. [Account Compromise Response](#3-account-compromise-response)
4. [Data Breach Response](#4-data-breach-response)
5. [DDoS Attack Response](#5-ddos-attack-response)
6. [Suspicious Activity Investigation](#6-suspicious-activity-investigation)
7. [Security Patch Deployment](#7-security-patch-deployment)

---

## 1. Incident Response

### 1.1 Severity Classification

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| P1 - Critical | Active attack, data breach | 15 minutes | Active SQL injection, leaked credentials |
| P2 - High | Security vulnerability discovered | 1 hour | XSS found in production, auth bypass |
| P3 - Medium | Potential security issue | 4 hours | Unusual login patterns, failed MFA attempts |
| P4 - Low | Security improvement needed | 24 hours | Missing security header, weak config |

### 1.2 Initial Response Checklist

```bash
# 1. Assess the situation
- [ ] Identify the incident type
- [ ] Determine affected systems
- [ ] Estimate data exposure

# 2. Contain the threat
- [ ] Isolate affected systems if necessary
- [ ] Block attacker IP addresses
- [ ] Revoke compromised credentials

# 3. Preserve evidence
- [ ] Capture relevant logs
- [ ] Document timeline
- [ ] Take system snapshots

# 4. Notify stakeholders
- [ ] Security team
- [ ] Engineering lead
- [ ] Legal/Compliance (if data breach)
- [ ] Customers (if required)
```

### 1.3 Communication Template

```
SECURITY INCIDENT NOTIFICATION

Incident ID: SEC-[DATE]-[NUMBER]
Severity: [P1/P2/P3/P4]
Status: [Investigating/Contained/Resolved]

Summary:
[Brief description of the incident]

Impact:
- Affected systems: [list]
- Affected users: [count or estimate]
- Data exposure: [Yes/No/Unknown]

Current Actions:
1. [Action taken]
2. [Action in progress]

Next Update: [Time]

Contact: [Security Team Lead]
```

---

## 2. Key Rotation Procedures

### 2.1 Encryption Key Rotation

**When to rotate:**
- Every 90 days (scheduled)
- Immediately if compromised
- After security incident
- Employee with key access leaves

**Procedure:**

```bash
# Step 1: Generate new key
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Step 2: Update environment (in deployment system)
# Add current key as versioned backup
export ENCRYPTION_KEY_V1=$ENCRYPTION_KEY
export ENCRYPTION_KEY=$NEW_KEY
export ENCRYPTION_KEY_CREATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Step 3: Deploy with new configuration
# Application will use new key for encryption
# Old key retained for decryption

# Step 4: Run re-encryption migration (scheduled)
npm run migrate:reencrypt

# Step 5: After grace period (30 days), remove old key
unset ENCRYPTION_KEY_V1
```

### 2.2 JWT Secret Rotation

```bash
# Step 1: Generate new secret
NEW_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# Step 2: Deploy with both secrets (grace period)
export JWT_SECRET_OLD=$JWT_SECRET
export JWT_SECRET=$NEW_JWT_SECRET

# Step 3: Application validates with both during transition
# Step 4: After token max lifetime (7 days), remove old secret
unset JWT_SECRET_OLD
```

### 2.3 API Key Rotation

```bash
# Via API:
curl -X POST "https://api.consultinity.com/api/organizations/{orgId}/api-keys/{keyId}/rotate" \
  -H "Authorization: Bearer {adminToken}" \
  -H "Content-Type: application/json" \
  -d '{"gracePeriodHours": 24}'

# Response includes new key
# Old key valid for grace period
```

---

## 3. Account Compromise Response

### 3.1 User Account Compromise

```bash
# 1. Immediately revoke all sessions
curl -X POST "https://api.consultinity.com/api/admin/users/{userId}/revoke-sessions" \
  -H "Authorization: Bearer {adminToken}"

# 2. Force password reset
curl -X POST "https://api.consultinity.com/api/admin/users/{userId}/force-password-reset" \
  -H "Authorization: Bearer {adminToken}"

# 3. Reset MFA
curl -X POST "https://api.consultinity.com/api/admin/users/{userId}/reset-mfa" \
  -H "Authorization: Bearer {adminToken}"

# 4. Review recent activity
curl "https://api.consultinity.com/api/admin/users/{userId}/activity-log?days=7" \
  -H "Authorization: Bearer {adminToken}"

# 5. Notify user
# Send security notification email with instructions
```

### 3.2 Admin Account Compromise

**CRITICAL - P1 Response**

```bash
# 1. Immediately:
- [ ] Revoke admin's sessions
- [ ] Disable admin account
- [ ] Change all system secrets
- [ ] Audit all admin actions in last 24 hours

# 2. Investigate:
- [ ] Review authentication logs
- [ ] Check for privilege escalation
- [ ] Verify no backdoors created
- [ ] Audit API key creation

# 3. Recovery:
- [ ] Create new admin account (different email)
- [ ] Re-verify all user permissions
- [ ] Rotate all encryption keys
```

---

## 4. Data Breach Response

### 4.1 Assessment

```bash
# 1. Identify scope
- What data was accessed?
- How many records affected?
- What time period?

# 2. Containment
- Block access vector
- Preserve logs
- Isolate affected systems

# 3. Documentation
- Timeline of events
- Evidence collection
- Chain of custody
```

### 4.2 Notification Requirements

| Regulation | Timeline | Notification |
|------------|----------|--------------|
| GDPR | 72 hours | Data Protection Authority + affected users |
| CCPA | "Without unreasonable delay" | California Attorney General |
| HIPAA | 60 days | HHS + affected individuals |

### 4.3 GDPR Breach Notification Template

```
PERSONAL DATA BREACH NOTIFICATION
Under Article 33 GDPR

1. Nature of the breach:
[Description of the breach including categories of data subjects
and approximate number of data subjects affected]

2. Name and contact details of DPO:
[DPO contact information]

3. Likely consequences:
[Assessment of potential impact on data subjects]

4. Measures taken:
[Steps taken to address the breach and mitigate effects]

Date of breach: [Date]
Date of discovery: [Date]
Date of notification: [Date]
```

---

## 5. DDoS Attack Response

### 5.1 Detection

```bash
# Signs of DDoS:
- Unusual traffic spike
- High CPU/memory usage
- Slow response times
- 5xx errors increasing

# Monitoring alerts:
- Request rate > 10x normal
- Error rate > 5%
- Latency > 2000ms
```

### 5.2 Mitigation Steps

```bash
# 1. Enable rate limiting (if not already)
# Already configured in index.ts with Redis backing

# 2. Block malicious IPs
# Add to nginx/firewall blocklist
iptables -A INPUT -s {malicious_ip} -j DROP

# 3. Scale up infrastructure
# If using cloud provider:
# - Increase instance count
# - Enable auto-scaling
# - Activate CDN caching

# 4. Enable Cloudflare/AWS Shield (if available)
# - Switch DNS to proxy mode
# - Enable "Under Attack" mode
```

### 5.3 Post-Attack Analysis

```bash
# 1. Collect attack data
- Source IPs
- Attack patterns
- Peak traffic volume

# 2. Update defenses
- Add IPs to permanent blocklist
- Adjust rate limits
- Improve DDoS protection
```

---

## 6. Suspicious Activity Investigation

### 6.1 Login Anomalies

```sql
-- Find unusual login patterns
SELECT 
  user_id,
  ip_address,
  user_agent,
  created_at,
  success
FROM activity_logs
WHERE action = 'login'
  AND created_at > datetime('now', '-24 hours')
ORDER BY created_at DESC;

-- Multiple failed logins
SELECT 
  user_id,
  ip_address,
  COUNT(*) as failed_attempts
FROM activity_logs
WHERE action = 'login'
  AND success = 0
  AND created_at > datetime('now', '-1 hour')
GROUP BY user_id, ip_address
HAVING COUNT(*) > 5;
```

### 6.2 API Abuse Detection

```sql
-- High volume API usage
SELECT 
  user_id,
  api_key_id,
  endpoint,
  COUNT(*) as request_count
FROM api_logs
WHERE created_at > datetime('now', '-1 hour')
GROUP BY user_id, api_key_id, endpoint
HAVING COUNT(*) > 1000
ORDER BY request_count DESC;

-- Unusual data access patterns
SELECT 
  user_id,
  resource_type,
  COUNT(DISTINCT resource_id) as unique_resources
FROM access_logs
WHERE created_at > datetime('now', '-24 hours')
GROUP BY user_id, resource_type
HAVING COUNT(DISTINCT resource_id) > 100;
```

### 6.3 Investigation Checklist

```bash
- [ ] Review user's recent activity
- [ ] Check IP geolocation history
- [ ] Verify device fingerprints
- [ ] Review accessed resources
- [ ] Check for data exports
- [ ] Verify MFA was used
- [ ] Cross-reference with other users from same IP
```

---

## 7. Security Patch Deployment

### 7.1 Severity-Based Timeline

| Severity | Patch Timeline | Testing |
|----------|----------------|---------|
| Critical (CVE 9.0+) | 24 hours | Emergency testing |
| High (CVE 7.0-8.9) | 7 days | Standard QA |
| Medium (CVE 4.0-6.9) | 30 days | Full regression |
| Low (CVE < 4.0) | Next release | Standard cycle |

### 7.2 Emergency Patch Procedure

```bash
# 1. Create hotfix branch
git checkout -b hotfix/security-{cve-id}

# 2. Apply patch
npm audit fix
# or manual patch

# 3. Run security tests
npm run test:security

# 4. Deploy to staging
npm run deploy:staging

# 5. Quick verification (< 30 min)
# - Core functionality works
# - Vulnerability patched
# - No regressions

# 6. Deploy to production
npm run deploy:production

# 7. Monitor
# - Error rates
# - Response times
# - Security alerts
```

### 7.3 Post-Patch Verification

```bash
# 1. Verify patch applied
npm audit

# 2. Run vulnerability scan
npm run security:scan

# 3. Test specific CVE
# (custom test based on vulnerability)

# 4. Document
- CVE ID
- Patch version
- Deployment time
- Verification results
```

---

## Contact Information

| Role | Contact | Availability |
|------|---------|--------------|
| Security Team Lead | security@consultinity.com | 24/7 |
| Infrastructure Lead | infra@consultinity.com | Business hours |
| Legal/Compliance | legal@consultinity.com | Business hours |
| Emergency Hotline | +48-XXX-XXX-XXX | 24/7 |

---

*This document should be reviewed quarterly and updated after any major incident.*











