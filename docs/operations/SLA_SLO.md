# SLA / SLO (Service Levels & Objectives)

> **Document:** SLA_SLO.md  
> **Version:** 1.0  
> **Last Updated:** 2026-02-06  
> **Status:** ✅ Baseline defined (needs prod measurement evidence)

## Purpose

Define:

- **SLA**: contractual commitments to customers (what we guarantee)
- **SLO**: internal targets (what we engineer for)
- **SLI**: how we measure (what the numbers mean)

This file exists because multiple documents reference `operations/SLA_SLO.md` as audit evidence.

## Service scope

Applies to the core Consultify platform, including:

- Web app + API (`/api/*`)
- AI Chat streaming (`/api/ai/chat/stream`)

Excludes:

- Scheduled maintenance windows (announced)
- Third‑party provider outages outside our control **only if** we can prove graceful degradation/failover was attempted (AI providers)

---

## 1) Availability

### SLA (external)

- [ ] **Uptime SLA**: **99.9% monthly availability** (downtime budget ≈ 43.2 minutes/month)

### SLO (internal)

- [ ] **Uptime SLO**: **99.95% monthly availability** (downtime budget ≈ 21.6 minutes/month)

### SLI (measurement)

- **Availability SLI** = \(1 - \frac{\text{bad minutes}}{\text{total minutes}}\)
- “Bad minute” = inability to serve successful authenticated requests for the primary user journeys.

Evidence pointers:

- Monitoring dashboards: `docs/operations/MONITORING_DASHBOARD.md`
- Incident process: `docs/operations/INCIDENT_RESPONSE_PLAYBOOK.md`

---

## 2) Latency (API)

### SLO (internal)

- [ ] **API latency**: P95 < **500ms** for non-AI endpoints (monthly window)

### SLI (measurement)

- HTTP server request duration histograms (by route group), excluding:
  - long‑poll/stream endpoints
  - background jobs

---

## 3) AI Chat streaming (SSE)

### SLO (internal)

- [ ] **Stream start latency**: first token/chunk within **< 2s** P95 (monthly)
- [ ] **Completion latency**: full response within **< 10s** P95 for standard queries (monthly)
- [ ] **Streaming stability**: reconnect/resume works for interrupted streams (target > 95% success)

### SLI (measurement)

- Time-to-first-chunk (TTFC)
- Time-to-last-chunk (TTLC)
- Stream error rate (provider errors, client disconnects, retries)

Contract & API evidence:

- Streaming contract: `wdrozenia/integrations/api-contracts/AI_CHAT_STREAM.md`
- AI API spec: `docs/api/AI_CHAT_API.md`

---

## 4) Error rates

### SLO (internal)

- [ ] **5xx rate**: < **1%** of requests (monthly), excluding deliberate chaos tests
- [ ] **AI provider error rate**: < **2%** (monthly), with automatic fallback where configured

### SLI (measurement)

- HTTP status distribution
- AI provider error tagging and circuit breaker metrics

---

## 5) Support response times (for enterprise contracts)

### SLA (external, typical)

- [ ] P0 (critical): first response < **1 hour**
- [ ] P1 (high): first response < **4 hours**
- [ ] P2 (medium): first response < **1 business day**
- [ ] P3 (low): first response < **3 business days**

---

## 6) Reporting & evidence expectations (audit-ready)

For VC / SOC2 readiness, maintain monthly evidence:

- Uptime & latency dashboard exports
- Incident tickets + postmortems
- DR restore test report (RPO/RTO)
- AI cost/budget reports (if AI is metered/billed)

Related docs:

- DR: `docs/operations/DISASTER_RECOVERY.md`
- Prod checklist: `docs/operations/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Load testing: `docs/operations/LOAD_TESTING_GUIDE.md`
