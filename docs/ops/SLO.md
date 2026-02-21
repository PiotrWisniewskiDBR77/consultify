# Service Level Objectives (SLO) — Consultivity

> **Owner:** Platform Engineering · **Last updated:** 2026-02-21  
> **Ticket:** T107 — System Stability & Uptime Assurance Framework

---

## 1. Service Level Objectives

| Metric | Target | Window | Measurement |
|---|---|---|---|
| **API Uptime** | ≥ 99.9 % | 30 days rolling | `/ping` returns 200 |
| **p95 Latency** | < 500 ms | 5 min sliding | Response time at 95th percentile |
| **5xx Error Rate** | < 0.1 % | 5 min sliding | `5xx responses / total responses` |
| **AI Availability** | > 99 % | 30 days rolling | AI endpoint success rate |
| **Cron Success Rate** | > 99 % | 30 days rolling | Scheduled jobs completing without error |

### Budget Calculation

- **API Uptime 99.9 %** → max 43.2 min downtime / 30 days
- **AI Availability 99 %** → max 7.2 h degraded / 30 days

---

## 2. Alert Thresholds

| Alert | Condition | Severity | Cooldown |
|---|---|---|---|
| **5xx Spike** | ≥ 3× baseline 5xx in 5 min window | Critical | 30 min |
| **Readiness 503** | `/api/health/ready` returns 503 for > 2 min | Critical | 30 min |
| **Backup Failure** | 3 consecutive backup failures | Critical | — |
| **AI Timeout Spike** | > 10 % AI calls timeout in 15 min window | Warning | 30 min |
| **DB Pool Exhaustion** | Pool utilization > 90 % | Warning | 30 min |
| **High Latency** | p95 > 2000 ms in 5 min window | Warning | 30 min |

---

## 3. Escalation Policy

### Notification Channels

1. **Logger** — all alerts emit structured log entries (`[AlertWatchdog]`)
2. **Email** — critical alerts sent to `ALERT_EMAIL` / `ADMIN_EMAIL`
3. **In-app** — SuperAdmin dashboard shows aggregated health

### Deduplication

- Each alert type has a **30-minute cooldown**; duplicate firings within the window are suppressed.
- A **"recovered"** event is logged when the condition clears.

### Escalation Tiers

| Tier | Timeframe | Action |
|---|---|---|
| L1 | Immediate | Automated alert + log |
| L2 | +15 min unresolved | Email to on-call engineer |
| L3 | +60 min unresolved | Page platform lead |

---

## 4. Monitoring Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /ping` | Load balancer liveness |
| `GET /api/health` | Basic health + Redis status |
| `GET /api/health/ready` | Kubernetes readiness probe |
| `GET /api/health/live` | Kubernetes liveness probe |
| `GET /api/health/aggregated` | Unified dashboard (T107) |
| `GET /api/metrics/prometheus` | Prometheus-format metrics |

---

## 5. Review Cadence

- SLOs reviewed **monthly** by platform team.
- Alert thresholds tuned after every incident post-mortem.
- Error budget consumed > 50 % triggers proactive review.
