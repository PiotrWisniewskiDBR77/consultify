# Deployment Guide

**Version:** 1.0  
**Last Updated:** January 4, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [CI/CD Pipeline](#2-cicd-pipeline)
3. [Deployment Strategies](#3-deployment-strategies)
4. [Rollback Procedures](#4-rollback-procedures)
5. [Multi-Region Setup](#5-multi-region-setup)
6. [Infrastructure as Code](#6-infrastructure-as-code)

---

## 1. Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐     ┌─────────────┐     ┌──────────────────────┐  │
│  │ CloudFl │────▶│     ALB     │────▶│  EKS / Kubernetes    │  │
│  │ are CDN │     │(Load Balanc)│     │  ┌──────┐ ┌──────┐   │  │
│  └─────────┘     └─────────────┘     │  │ API  │ │ API  │   │  │
│                                       │  │ Pod 1│ │ Pod 2│   │  │
│                                       │  └──────┘ └──────┘   │  │
│                                       └──────────────────────┘  │
│                                                │                 │
│                        ┌───────────────────────┼────────────┐   │
│                        ▼                       ▼            │   │
│              ┌─────────────────┐    ┌─────────────────┐     │   │
│              │    RDS          │    │   ElastiCache   │     │   │
│              │  PostgreSQL     │    │     Redis       │     │   │
│              │  (Multi-AZ)     │    │   (Cluster)     │     │   │
│              └─────────────────┘    └─────────────────┘     │   │
└─────────────────────────────────────────────────────────────────┘
```

### Environments

| Environment | Branch | URL | Auto-deploy |
|-------------|--------|-----|-------------|
| Development | `develop` | localhost:3000 | No |
| Staging | `develop` | staging.consultify.app | Yes (on merge) |
| Production | `main` | consultify.app | Manual approval |

---

## 2. CI/CD Pipeline

### Pipeline Stages

```yaml
1. Code Quality (lint, type-check)
   ↓
2. Security Scanning (npm audit, Trivy, CodeQL)
   ↓
3. Unit Tests + Integration Tests
   ↓
4. Build Artifacts
   ↓
5. Performance Testing (Lighthouse, k6)
   ↓
6. Deploy to Staging (automatic)
   ↓
7. E2E Tests on Staging
   ↓
8. Manual Approval
   ↓
9. Deploy to Production (blue-green)
   ↓
10. Post-deployment Verification
```

### Quality Gates

All of the following must pass before deployment:

- [ ] ESLint: 0 errors
- [ ] TypeScript: 0 type errors
- [ ] Unit tests: >80% coverage
- [ ] Security scan: 0 critical/high vulnerabilities
- [ ] Performance: Lighthouse score >80
- [ ] E2E tests: All critical paths passing

### Triggering Deployments

**Staging (Automatic):**
```bash
git push origin develop
# Automatically deploys after CI passes
```

**Production (Manual):**
```bash
# Option 1: GitHub Actions
# Go to Actions → Blue-Green Deployment → Run workflow

# Option 2: CLI
gh workflow run blue-green-deploy.yml \
  -f app=consultify \
  -f environment=production \
  -f strategy=blue-green
```

---

## 3. Deployment Strategies

### Blue-Green Deployment

**How it works:**
1. Deploy new version to "green" environment
2. Run health checks on green
3. Run smoke tests on green
4. Switch traffic from blue to green
5. Monitor for issues
6. Keep blue as rollback option

**Implementation:**
```bash
# Current active: BLUE
# New deployment: GREEN

# 1. Deploy to green
kubectl apply -k infrastructure/kubernetes/overlays/production-green

# 2. Wait for rollout
kubectl rollout status deployment/consultify-api -n production-green

# 3. Run smoke tests
./scripts/smoke-test.sh https://green.consultify.app

# 4. Switch traffic
kubectl patch ingress consultify-ingress -n production \
  --patch '{"spec":{"rules":[{"host":"consultify.app","http":{"paths":[{"path":"/","pathType":"Prefix","backend":{"service":{"name":"consultify-api-green","port":{"number":3001}}}}]}}]}}'

# 5. Monitor
kubectl logs -f deployment/consultify-api -n production-green --tail=100
```

### Canary Deployment

**How it works:**
1. Deploy new version alongside old (10% traffic)
2. Monitor error rates and latency
3. Gradually increase traffic (25%, 50%, 75%, 100%)
4. Roll back if issues detected

**Implementation:**
```bash
# 1. Deploy canary (10% traffic)
kubectl apply -f infrastructure/kubernetes/canary/deployment.yaml
kubectl apply -f infrastructure/kubernetes/canary/traffic-split.yaml

# 2. Monitor for 15 minutes
watch kubectl get --raw '/apis/metrics.k8s.io/v1beta1/pods' | jq

# 3. Increase to 50%
kubectl patch trafficsplit consultify-split \
  --patch '{"spec":{"backends":[{"service":"consultify-api","weight":50},{"service":"consultify-api-canary","weight":50}]}}'

# 4. Full rollout
kubectl patch trafficsplit consultify-split \
  --patch '{"spec":{"backends":[{"service":"consultify-api-canary","weight":100}]}}'
```

### Zero-Downtime Deployment

**Requirements met:**
- Rolling updates with `maxSurge=1, maxUnavailable=0`
- Readiness probes prevent traffic to unhealthy pods
- Pre-stop hooks allow graceful shutdown
- Pod Disruption Budget ensures minimum availability
- Database migrations are backward compatible

---

## 4. Rollback Procedures

### Automated Rollback

Rollback triggers automatically if:
- Health check fails for 3+ consecutive checks
- Error rate exceeds 5% for 2+ minutes
- P95 latency exceeds 2000ms for 2+ minutes

### Manual Rollback

#### Kubernetes Rollback
```bash
# List deployment history
kubectl rollout history deployment/consultify-api -n production

# Rollback to previous version
kubectl rollout undo deployment/consultify-api -n production

# Rollback to specific revision
kubectl rollout undo deployment/consultify-api -n production --to-revision=3

# Verify rollback
kubectl rollout status deployment/consultify-api -n production
```

#### Blue-Green Rollback
```bash
# Switch traffic back to blue
kubectl patch ingress consultify-ingress -n production \
  --patch '{"spec":{"rules":[{"host":"consultify.app","http":{"paths":[{"path":"/","pathType":"Prefix","backend":{"service":{"name":"consultify-api-blue","port":{"number":3001}}}}]}}]}}'
```

#### Database Rollback
```bash
# If migration caused issues, run down migration
npm run migrate:down

# Restore from backup (if needed)
pg_restore -h $DB_HOST -U $DB_USER -d consultify backup_20260104.dump
```

### Rollback Checklist

```bash
[ ] 1. Identify the issue (logs, metrics, alerts)
[ ] 2. Communicate to team (Slack #incidents)
[ ] 3. Execute rollback command
[ ] 4. Verify services are healthy
[ ] 5. Verify user-facing functionality
[ ] 6. Document incident
[ ] 7. Schedule post-mortem
```

---

## 5. Multi-Region Setup

### Active-Passive Configuration

```
┌─────────────────────┐     ┌─────────────────────┐
│   EU-CENTRAL-1      │     │    EU-WEST-1        │
│   (PRIMARY)         │     │    (SECONDARY)      │
├─────────────────────┤     ├─────────────────────┤
│  ┌──────────────┐   │     │  ┌──────────────┐   │
│  │ EKS Cluster  │   │     │  │ EKS Cluster  │   │
│  │ (Active)     │   │────▶│  │ (Standby)    │   │
│  └──────────────┘   │     │  └──────────────┘   │
│         │           │     │         │           │
│         ▼           │     │         ▼           │
│  ┌──────────────┐   │     │  ┌──────────────┐   │
│  │ RDS Primary  │───│────▶│──│ RDS Replica  │   │
│  └──────────────┘   │     │  └──────────────┘   │
└─────────────────────┘     └─────────────────────┘
         ▲                           │
         │         ┌─────────────────┘
         │         ▼
    ┌──────────────────┐
    │   Route 53       │
    │   Health Check   │
    │   DNS Failover   │
    └──────────────────┘
```

### Failover Procedure

```bash
# 1. Promote RDS replica to primary
aws rds promote-read-replica --db-instance-identifier consultify-replica-eu-west-1

# 2. Update DNS (Route 53 does this automatically with health checks)
# Or manually:
aws route53 change-resource-record-sets --hosted-zone-id Z123456 \
  --change-batch file://failover-changeset.json

# 3. Scale up standby EKS cluster
kubectl config use-context eu-west-1
kubectl scale deployment consultify-api --replicas=3

# 4. Verify services
curl https://consultify.app/api/health
```

---

## 6. Infrastructure as Code

### Terraform Deployment

```bash
# Initialize
cd infrastructure/terraform
terraform init

# Plan changes
terraform plan -var-file=production.tfvars -out=tfplan

# Apply changes
terraform apply tfplan

# Destroy (DANGEROUS)
terraform destroy -var-file=production.tfvars
```

### Kubernetes Deployment

```bash
# Apply base + production overlay
kubectl apply -k infrastructure/kubernetes/overlays/production

# View generated manifests (dry-run)
kubectl kustomize infrastructure/kubernetes/overlays/production

# Diff before applying
kubectl diff -k infrastructure/kubernetes/overlays/production
```

### Environment Variables

Required secrets (stored in AWS Secrets Manager):
```
DATABASE_URL
REDIS_URL
JWT_SECRET
ENCRYPTION_KEY
ENCRYPTION_SALT
OPENAI_API_KEY
SENTRY_DSN
```

### Scaling

**Horizontal Pod Autoscaler:**
- API: 2-10 pods (CPU >70%, Memory >80%)
- Frontend: 2-5 pods (CPU >80%)

**Manual scaling:**
```bash
kubectl scale deployment consultify-api --replicas=5 -n production
```

---

## Quick Reference

### Common Commands

```bash
# Check deployment status
kubectl get deployments -n production

# View pods
kubectl get pods -n production -o wide

# View logs
kubectl logs -f deployment/consultify-api -n production

# Execute into pod
kubectl exec -it deployment/consultify-api -n production -- /bin/sh

# Port forward for debugging
kubectl port-forward svc/consultify-api 3001:3001 -n production

# View metrics
kubectl top pods -n production

# View HPA status
kubectl get hpa -n production
```

### Emergency Contacts

| Role | Contact |
|------|---------|
| On-call Engineer | PagerDuty |
| Infrastructure Lead | infra@consultify.com |
| Security Team | security@consultify.com |

---

*This guide should be reviewed and updated after each major infrastructure change.*








