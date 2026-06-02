# Runbook: Stuck Generation

**Severity tier:** P1 (escalate to P0 if jobs queued > 200 AND no progress for 15 minutes)
**SLO impacted:** `p95_generation_latency_ms` (Sprint 4 SLO target ≤45000 ms; Operations Health classification: ≤8000 ms pass / 8000..12000 at_risk / >12000 breach — see `presentationOperationsHealthService.ts`)
**Triggers:**

- Anomaly detector emits `anomaly_detected` with `metadata.sloId='p95_generation_latency_ms'`, `severity='major'`, `direction='above'`.
- Operations Health scoreboard `P95 generation latency` card flips to `breach`.
- Operations Health Jobs strip shows `generation_started_at` rows without matching `generation_completed_at` aging beyond 5 minutes.
- Customer-reported "my deck has been generating for 10 minutes".

**Owner role:** Backend Lead + SRE on-call
**Estimated time to mitigate:** 15–30 minutes

---

## 1. Detection

### Signals

- Alert: `anomaly_detected` runtime event with `sloId='p95_generation_latency_ms'`.
- Dashboard: Operations Health scoreboard `P95 generation latency` card pill in `breach`.
- Customer signal: "Generation never finishes" reported by users in the same window.
- Metric/SLO: queue depth >> baseline OR p95 latency > 90s over the active window.

### Confirm-before-acting checklist

- [ ] Pull the last hour of `presentation_ai_operations` rows in `status='in_progress'`.
- [ ] Compare current p95 latency against the 24h anomaly detector baseline.
- [ ] Verify upstream LLM provider status (OpenAI / Anthropic status pages).
- [ ] Identify scope: single deck / single org / global / specific upstream model.

---

## 2. Containment

### Step 2.1 — Find stuck jobs

```sql
SELECT id, deck_id, organization_id, started_at
  FROM presentation_ai_operations
 WHERE status = 'in_progress'
   AND started_at < NOW() - INTERVAL '5 minutes'
 ORDER BY started_at ASC
 LIMIT 100;
```

### Step 2.2 — Mark stuck jobs as failed to free the queue

```sql
UPDATE presentation_ai_operations
   SET status = 'failed',
       error_reason = 'timed_out_by_runbook',
       finished_at = NOW()
 WHERE status = 'in_progress'
   AND started_at < NOW() - INTERVAL '5 minutes';
```

### Step 2.3 — Pause new generation submissions if queue is excessive

```bash
# When queue depth exceeds 200 in-flight, pause to drain.
# Replace with your queue gating mechanism (env var or runtime config).
node server/scripts/run-presentation-alert-worker.ts --pause-once
```

---

## 3. Recovery

### Step 3.1 — Check upstream provider status

- OpenAI status: status.openai.com
- Anthropic status: status.anthropic.com

If the upstream is down, switch to the configured fallback model (if available) or hold the queue until upstream recovers.

### Step 3.2 — Retry the runbook-killed jobs

```sql
SELECT id, deck_id
  FROM presentation_ai_operations
 WHERE error_reason = 'timed_out_by_runbook'
   AND finished_at >= NOW() - INTERVAL '1 hour'
 LIMIT 100;
```

For each id, re-trigger via the existing generation endpoint. Do this gradually (batch of 10 with 1-minute pauses) so the queue does not flood again.

### Verification

- [ ] `p95_generation_latency_ms` SLO returns to `pass` within 15 minutes on the Operations Health scoreboard.
- [ ] No new in-progress rows older than 5 minutes for 30 minutes.
- [ ] No new `anomaly_detected` runtime events for `sloId='p95_generation_latency_ms'` for 30 minutes.

---

## 4. Communication

### Internal

- Slack channel: `#consultify-incidents`
- Mention: `@on-call`
- Status update cadence: every 15 minutes until resolved.

### External (if customer-facing)

- Status page update only if upstream issue is widespread.
- Customer email template: see `docs/operations/incident-runbooks/customer-comms-templates.md`. Mention upstream provider status if applicable.

---

## 5. Postmortem

### Required artefacts

- [ ] Incident timeline document.
- [ ] Root cause analysis: did our timeout protection fire as expected? Were retries effective?
- [ ] Action items with owners + due dates.
- [ ] Update this runbook if a new failure mode appeared.

### Postmortem template

- **What happened** — queue depth at peak, p95 trend, upstream involvement.
- **Why it happened** — provider outage, fallback misconfig, our own timeout missing.
- **What we'll do differently** — tighter timeout, better fallback wiring, queue-depth alarms earlier.
