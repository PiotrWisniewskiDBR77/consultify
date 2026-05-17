# Runbook: Export Blocked Spike

**Severity tier:** P1 (escalate to P0 if >50% of an org's decks transition to `BLOCKED_P0` in a 1h window)
**SLO impacted:** `export_blocked_rate` (Sprint 4 SLO target tracked as quality signal; Operations Health classification: <=10% pass / 10..25% at_risk / >25% breach — see `presentationOperationsHealthService.ts`)
**Triggers:**

- Anomaly detector emits `anomaly_detected` with `metadata.sloId='export_blocked_rate'`, `severity='major'` (see `PRESENTATION_OPS_ANOMALY_DETECTION.md`).
- Governance alert worker dispatches more than 20 transitions into `BLOCKED_P0` for a single org within 1h (see `PRESENTATION_GOVERNANCE_ALERTS.md`).
- Operations Health scoreboard shows orange `Anomaly` chip on the `Export blocked rate` card AND the steady-state pill flips `at_risk` or `breach`.

**Owner role:** Backend Lead (primary) + SRE on-call (paging)
**Estimated time to mitigate:** 20–30 minutes

---

## 1. Detection

### Signals

- Alert: `anomaly_detected` runtime event with `sloId='export_blocked_rate'` and `severity='major'`.
- Alert: governance alert worker dispatch volume spike — `presentation_governance_alert_dispatches.status='sent'` for `payload.toVerdict='BLOCKED_P0'`.
- Dashboard: Operations Health scoreboard, `Export blocked rate` card → orange `Anomaly` chip + pill in `at_risk`/`breach`.
- Customer signal: "I keep getting export rejected with a quality gate error" repeated by multiple users in the same org.
- Metric/SLO: `export_blocked_rate` rises above 25% over the active window, OR z-score against 24h baseline is ≥ +3.5.

### Confirm-before-acting checklist

- [ ] Pull the last hour of `presentation_runtime_events` for the affected org and filter `event_type IN ('export_attempted','export_blocked','quality_gate_blocked')`.
- [ ] Open the Operations Health scoreboard at the active window (1d / 7d) and verify the SLO trend.
- [ ] Inspect the Governance Watchlist (`GET /api/presentations/governance/watchlist`) — note `totals.blocked_p0` per org.
- [ ] Verify it is NOT a tuning false positive (check `MAJOR_Z_THRESHOLD` and recent SLO target changes).
- [ ] Identify scope: single deck / single org / global — record this on the incident ticket.

---

## 2. Containment

Each step ≤ 60 seconds to execute. Do not proceed past containment until the spike is no longer growing.

### Step 2.1 — Pause auto-publish / auto-export jobs

```bash
# Use the existing pause-once flag — no code change, no deploy.
node server/scripts/run-presentation-alert-worker.ts --pause-once
```

### Step 2.2 — Suppress further alerts for the affected org while you firefight

```sql
UPDATE presentation_governance_alert_subscriptions
   SET active = FALSE
 WHERE organization_id = $1
   AND active = TRUE;
```

### Step 2.3 — Snapshot affected decks before any recovery action

```bash
npm run drive:snapshot -- --org-id="<org_id>" --reason="rb-01-export-blocked-spike"
```

---

## 3. Recovery

Order matters. Do step 3.1 first — it tells you whether the rest of this runbook is the right runbook.

### Step 3.1 — Identify the blocker pattern

```bash
npm run audit:integrity -- --window-days=1 --org-id="<org_id>"
```

Cross-reference the result with the Quality Gates panel — specifically the most-blocked deck. If the same `template_id` appears across many decks, ESCALATE to `RB-04 — Template corruption`.

### Step 3.2 — Decide whether the gate was correct

- If the gate caught a real defect → containment IS the resolution. Do not relax the gate. Move to communication.
- If the gate is overly strict (false positive cluster) → review constants in `presentationQualityGatesService.ts`, but **do NOT change code under incident pressure**. Use the runtime config to emergency-relax the affected severity threshold; revert by editing config back, no redeploy needed.

### Step 3.3 — Re-enable subscriptions and worker

```sql
UPDATE presentation_governance_alert_subscriptions
   SET active = TRUE
 WHERE organization_id = $1
   AND target IS NOT NULL;
```

Then restart the worker without `--pause-once`.

### Verification

- [ ] `export_blocked_rate` returns to `pass` within 15 minutes on the Operations Health scoreboard.
- [ ] Governance Watchlist `totals.blocked_p0` for the affected org clears or returns to baseline.
- [ ] No new `anomaly_detected` runtime events for `sloId='export_blocked_rate'` for 30 minutes.

---

## 4. Communication

### Internal

- Slack channel: `#consultify-incidents`
- Mention: `@on-call`
- Status update cadence: every 15 minutes until SLO returns to `pass`.

### External (only if customer-facing)

- Status page: status.consultify.example.com (update on confirmed P0 escalation only).
- Customer email template: see `docs/operations/incident-runbooks/customer-comms-templates.md` (acknowledge → investigation → resolution).

---

## 5. Postmortem

### Required artefacts

- [ ] Incident timeline document (UTC, minute granularity).
- [ ] Root cause analysis: was the gate correct (real block) or noisy (false positive cluster)?
- [ ] Action items with owners + due dates.
- [ ] Update this runbook if a new failure mode was discovered.

### Postmortem template

- **What happened** — first symptom, when alert fired, scope.
- **Why it happened** — root cause: gate semantics, content drift, template change?
- **What we'll do differently** — gate tuning, additional CI checks, or runbook updates.
