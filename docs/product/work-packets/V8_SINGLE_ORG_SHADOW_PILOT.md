# V8 Single-Org Shadow Pilot — Launch Plan

> Owner: Manager Agent
> Status: ACTIVE
> Start: 2026-03-23
> Duration: 7 days minimum (shadow mode)
> Org: PM Test GmbH (`15f69780-675c-4f32-9230-82a4646f15d8`)

---

## 1. Pilot Start Gate

| Gate | Status | Evidence |
|------|--------|----------|
| Password rotation | PASS | Old `<HASLO>` rejected, new 24-char bcrypt-hashed |
| Secrets audit | PASS | No secrets in committed docs or evidence |
| Flags for PM Test GmbH | PASS | `chat=true`, `ai_core=true` |
| V8 system health | PASS | Overall: healthy, all 6 domains ready |
| Shadow mode active | PASS | 43 comparisons recorded, 0% V8 error rate |
| Emergency stop path | PASS | Railway CLI verified, commands documented |
| General infrastructure | PASS | App: ok, DB: connected, Redis: connected |

**All 7 gates: PASS**

---

## 2. Password Rotation Dependency

- Old weak password (`<HASLO>`): **REJECTED** (verified at login endpoint)
- New password: 24-char random, bcrypt-hashed
- Storage: `.env.staging.secrets` (gitignored, local-only)
- No secrets in any committed artifact
- **Status: RESOLVED**

---

## 3. Pilot Launch Plan

### Scope

| Parameter | Value |
|-----------|-------|
| Organization | PM Test GmbH |
| Org ID | `15f69780-675c-4f32-9230-82a4646f15d8` |
| Modules | Chat + AI Core |
| Mode | Shadow only (V8 runs in parallel, legacy serves users) |
| Duration | 7 days minimum, then reassess |
| Environment | Staging (`https://stage.consultinity.ai`) |

### Launch Steps

1. **Confirm all gates PASS** — completed
2. **Record pilot start timestamp** — `2026-03-23T21:53:50Z`
3. **Verify shadow mode is recording** — 43 comparisons already exist
4. **Begin daily monitoring cadence** — Day 1 starts now
5. **Capture Day 1 baseline evidence** — shadow stats, health, metrics

### Flags and Scope

| Flag | Value | Set via |
|------|-------|---------|
| `ENABLE_V8_GLOBAL` | `true` | Railway env var |
| `ENABLE_V8_SHADOW_MODE` | `true` | Railway env var |
| Per-org `chat` | `true` | V8 feature flag API |
| Per-org `ai_core` | `true` | V8 feature flag API |

### Expected Traffic / Usage Assumptions

- PM Test GmbH is a test organization with limited real traffic
- Expected: 50-200 API requests/day to Chat and AI Core endpoints
- Shadow comparisons should accumulate at ~50-200/day
- Target: 500+ total comparisons by Day 7
- If traffic is insufficient, manual test sessions will supplement

### Monitoring Points

| Endpoint | What to check | Frequency |
|----------|---------------|-----------|
| `/api/v8/admin/health` | Overall health, domain statuses | Every 4h |
| `/api/v8/admin/shadow/stats` | Comparison count, error rate, mismatch rate | Every 4h |
| `/api/v8/admin/metrics` | Latency, uptime | Daily |
| `/api/v8/health/readiness` | All domains ready | Daily |
| `/api/health` | General app health | Every 4h |
| Railway logs | V8-related errors, warnings | Daily |

### Daily Review Cadence

| Time | Action |
|------|--------|
| Morning (09:00 CET) | Check overnight shadow stats, health, any alerts |
| Afternoon (15:00 CET) | Mid-day comparison count check |
| Evening (21:00 CET) | End-of-day evidence capture, daily board update |

### Evidence to Capture Each Day

1. **Shadow stats snapshot** — total comparisons, match rate, V8 error rate, latency delta
2. **Health snapshot** — all domain statuses
3. **Readiness snapshot** — all domain readiness checks
4. **Error log scan** — any V8-related errors in Railway logs
5. **Legacy health check** — confirm no degradation
6. **Comparison delta** — new comparisons since last check
7. **Anomaly notes** — any unexpected behavior

---

## 4. Pilot Success Criteria

| # | Criterion | Threshold | How Measured | Partial | Fails Pilot |
|---|-----------|-----------|-------------|---------|-------------|
| 1 | V8 error rate | < 5% over 7 days | `/admin/shadow/stats` → `v8ErrorRate` | 5-10% = investigate | > 10% for 1h = abort |
| 2 | Legacy health | No degradation | `/api/health` + legacy endpoint checks | Transient blip < 5min = ok | Sustained degradation correlated with V8 |
| 3 | Comparison volume | 500+ total | `/admin/shadow/stats` → `totalComparisons` | 200-500 = extend pilot | < 200 after 7 days = insufficient data |
| 4 | V8 incidents | Zero V8-caused incidents | Manual review + logs | Non-V8 incidents = ok | Any V8-caused user-facing incident |
| 5 | Monitoring stability | Continuous operator visibility | All monitoring endpoints responsive | Brief gaps < 30min = ok | Monitoring blind spots > 1h |
| 6 | Shadow mismatch quality | All mismatches format-only | `/admin/shadow/stats` + manual analysis | New format mismatches = ok | Data or behavior mismatch |
| 7 | Latency delta | V8 latency < 2x legacy | `/admin/shadow/stats` → avg latencies | 1.5-2x = monitor | > 2x sustained = investigate |

---

## 5. Abort / Rollback Model

### Immediate Abort Conditions

| Condition | Detection | Action |
|-----------|-----------|--------|
| V8 error rate > 10% for 1 hour | Shadow stats monitoring | Disable `ENABLE_V8_SHADOW_MODE=false` |
| Legacy endpoint degradation correlated with V8 | Health endpoint + user reports | Disable `ENABLE_V8_GLOBAL=false`, redeploy |
| V8 causes data corruption | DB integrity checks | Emergency: disable all flags, rollback migrations |
| Staging unreachable | Health endpoint timeout | Check Railway status, do NOT touch production |
| Shadow interceptor causes request failures | Error rate spike on legacy endpoints | Disable shadow mode immediately |

### Escalation Conditions

| Condition | Escalation |
|-----------|-----------|
| V8 error rate 5-10% for > 2 hours | Alert source-of-truth, prepare abort |
| New type of shadow mismatch (data/behavior) | Pause pilot, analyze before continuing |
| Latency delta > 2x for > 1 hour | Investigate, prepare to disable shadow |
| Any V8-related error in legacy path | Immediate investigation, potential abort |

### Who Decides Stop

- **Automatic stop**: V8 error rate > 10% for 1h → manager agent disables flags
- **Escalated stop**: Source-of-truth decides based on manager agent report
- **Emergency stop**: Any agent with Railway CLI access

### Exact Rollback Actions

```bash
# Step 1: Disable shadow mode
railway variables set ENABLE_V8_SHADOW_MODE=false -e staging -s consultify

# Step 2: If legacy is affected, disable V8 entirely
railway variables set ENABLE_V8_GLOBAL=false -e staging -s consultify

# Step 3: Force redeploy to pick up new env vars
railway redeploy -y -e staging -s consultify

# Step 4: Verify legacy is healthy
curl -s https://stage.consultinity.ai/api/health

# Step 5: If data corruption suspected (extreme case only)
# Run: npx tsx scripts/v8-migrate.ts --rollback
# Requires: V8_ROLLBACK_CONFIRM=yes environment variable
```

### Evidence Required After Abort

1. Timestamp of abort decision
2. Reason for abort
3. Shadow stats at time of abort
4. Error logs from abort window
5. Legacy health status after abort
6. Root cause analysis (within 24h)

---

## 6. Daily Pilot Board Format

Each daily report follows this exact structure:

```
### Pilot Day [N] — [Date]

| Section | Value |
|---------|-------|
| Pilot day | Day N of 7 |
| Traffic / comparison volume | X new comparisons (Y total) |
| V8 error rate | X% |
| Legacy health status | healthy / degraded / critical |
| Shadow mismatch summary | X total, Y new, all format-only / data / behavior |
| Operator observations | [notes] |
| Incidents / anomalies | none / [description] |
| Abort risk status | GREEN / YELLOW / RED |
| Current pilot verdict | ON TRACK / AT RISK / ABORT |
| Recommended next action | [action] |
```

---

## 7. End-of-Pilot Decision Gate

After 7 days, the following assessment is performed:

### Gate Criteria

| # | Criterion | Required | Evidence |
|---|-----------|----------|----------|
| 1 | 7 consecutive days of shadow operation | Yes | Daily board reports |
| 2 | V8 error rate < 5% cumulative | Yes | Shadow stats |
| 3 | Zero V8-caused incidents | Yes | Incident log |
| 4 | 500+ shadow comparisons | Yes | Shadow stats |
| 5 | All mismatches format-only | Yes | Mismatch analysis |
| 6 | No legacy degradation | Yes | Health logs |
| 7 | Monitoring continuously operational | Yes | Evidence snapshots |

### Allowed Verdicts

| Verdict | Condition |
|---------|-----------|
| `CONTINUE SHADOW PILOT` | Criteria mostly met but comparison volume insufficient or minor concerns |
| `GO FOR ACTIVE-MODE PILOT DECISION` | All 7 criteria met, source-of-truth can approve active mode |
| `REPEAT PILOT AFTER FIXES` | Criteria failed due to fixable issues |
| `ABORT` | Fundamental issues discovered, V8 not ready |

### NOT allowed after pilot

- `production-ready`
- `broad rollout ready`
- `fully closed`

---

## 8. Recommended Launch Sequence

1. ~~Rotate staging password~~ — **DONE**
2. ~~Verify secrets audit~~ — **DONE**
3. ~~Verify flags for PM Test GmbH~~ — **DONE**
4. ~~Verify system health~~ — **DONE**
5. ~~Verify shadow mode active~~ — **DONE**
6. ~~Verify emergency stop path~~ — **DONE**
7. **Record pilot start** — `2026-03-23T21:53:50Z`
8. **Begin Day 1 monitoring** — active
9. **Daily board reports** — Days 1-7
10. **End-of-pilot gate assessment** — Day 7+

---

## 9. Main Pilot Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| 1 | Insufficient traffic from PM Test GmbH | Medium | Low comparison volume | Supplement with manual test sessions |
| 2 | Shadow interceptor latency overhead | Low | User-perceived slowdown | Monitor latency delta, abort if > 2x |
| 3 | New mismatch types emerge | Low | Pilot pause for analysis | Daily mismatch review |
| 4 | Railway staging instability | Low | False positive failures | Distinguish infra vs V8 issues |
| 5 | Rate limiting interferes with monitoring | Medium | Gaps in evidence | Space API calls, use longer intervals |

---

## 10. Recommended Next Action

**Pilot is LIVE as of `2026-03-23T21:53:50Z`.**

Immediate next steps:
1. Capture Day 1 baseline evidence (done in gate verification)
2. Schedule first daily review for tomorrow morning (09:00 CET)
3. Monitor shadow stats accumulation over next 24h
4. Prepare Day 1 pilot board report tomorrow evening

---

## Pilot Daily Reports

### Pilot Day 0 (Launch) — 2026-03-23

| Section | Value |
|---------|-------|
| Pilot day | Day 0 (launch) |
| Traffic / comparison volume | 43 comparisons (pre-pilot baseline) |
| V8 error rate | 0% |
| Legacy health status | healthy |
| Shadow mismatch summary | 43 total, all format-only (verified in pre-pilot closure) |
| Operator observations | All 7 gates passed. System fully green. Password rotated. |
| Incidents / anomalies | aiCore health check bug fixed (accepted 'healthy' alongside 'active') |
| Abort risk status | GREEN |
| Current pilot verdict | ON TRACK |
| Recommended next action | Begin Day 1 monitoring tomorrow 09:00 CET |
