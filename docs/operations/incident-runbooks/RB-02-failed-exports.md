# Runbook: Failed Exports

**Severity tier:** P1 (escalate to P0 if `export_success_rate` drops below 90% over the active window)
**SLO impacted:** `export_success_rate` (Sprint 4 SLO target ≥99.5%; Operations Health classification: ≥95% pass / 90..95 at_risk / <90 breach — see `presentationOperationsHealthService.ts` and `PRESENTATION_SLI_SLO.md`)
**Triggers:**

- Anomaly detector emits `anomaly_detected` with `metadata.sloId='export_success_rate'`, `severity='major'`, `direction='below'`.
- Operations Health scoreboard `Export success rate` card shows `breach` pill OR an orange anomaly chip.
- Customer-reported failure of a recent export (`failed`/`error` PDF/PPTX/PNG/HTML).
- `presentation_export_records.status='failed'` count rises sharply versus the prior 24h baseline.

**Owner role:** Backend Lead + SRE on-call
**Estimated time to mitigate:** 15–25 minutes

---

## 1. Detection

### Signals

- Alert: `anomaly_detected` runtime event with `sloId='export_success_rate'`.
- Dashboard: Operations Health scoreboard, `Export success rate` card pill in `at_risk`/`breach`.
- Customer signal: "Export keeps failing" / "I clicked Download PDF and got an error toast".
- Metric/SLO: `export_success_rate < 95%` in the active window or z-score ≤ -2.5 against 24h baseline.

### Confirm-before-acting checklist

- [ ] Pull the last hour of `presentation_export_records` for the affected org. Group by `error_reason` to find the dominant pattern.
- [ ] Compare current window against the 24h baseline values surfaced by the anomaly detector (`metadata.baselineMean`, `metadata.current`).
- [ ] Verify it is not a single bad deck dominating the rate — check `deck_id` distribution in failures.
- [ ] Identify scope: single org / global / single export format (`pdf` / `pptx` / `png` / `html`).

---

## 2. Containment

### Step 2.1 — Group failures by error pattern

```sql
SELECT error_reason, COUNT(*) AS hits, MIN(created_at) AS first_seen
  FROM presentation_export_records
 WHERE status = 'failed'
   AND created_at >= NOW() - INTERVAL '1 hour'
 GROUP BY error_reason
 ORDER BY hits DESC
 LIMIT 10;
```

### Step 2.2 — Health-check the Playwright PDF renderer

```bash
curl -fsSL "http://localhost:${PORT:-3000}/api/presentations/health/pdf-renderer" || echo "RENDERER UNHEALTHY"
```

If the endpoint is missing or returns non-2xx, mark the renderer as suspect (chromium binary missing, font absent, OOM).

### Step 2.3 — Roll back the most recent deploy if regression suspected

```bash
git log --oneline -5 -- server/src/services/presentationExport*.ts \
                       server/src/services/playwrightPdfRenderer*.ts
# Confirm with the deploy log; if a recent change correlates, roll back.
```

---

## 3. Recovery

### Step 3.1 — Re-trigger failed exports for affected decks

The deck data itself is intact; only the export step failed. Use the existing export endpoints (no manual data fix required):

```bash
# For each affected deck id (loop in your shell of choice):
curl -X POST -H "Authorization: Bearer $OPS_TOKEN" \
     "${BASE_URL}/api/presentations/decks/${DECK_ID}/exports?format=pdf"
```

### Step 3.2 — Confirm a healthy retry rate before declaring resolved

Aim for >90% success on the re-triggered batch within 5 minutes. If the retry rate is also degraded, escalate to RB-03 (renderer / queue worker may also be stuck).

### Verification

- [ ] `export_success_rate` SLO returns to `pass` within 15 minutes on the Operations Health scoreboard.
- [ ] No new `anomaly_detected` runtime events for `sloId='export_success_rate'` for 30 minutes.
- [ ] All retried exports recorded `status='completed'` with non-null `download_url`.

---

## 4. Communication

### Internal

- Slack channel: `#consultify-incidents`
- Mention: `@on-call`
- Status update cadence: every 15 minutes until resolved.

### External (if customer-facing)

- Status page update only if many orgs affected.
- Customer email template: see `docs/operations/incident-runbooks/customer-comms-templates.md`. Include re-export ETA in the resolution message.

---

## 5. Postmortem

### Required artefacts

- [ ] Incident timeline document.
- [ ] Root cause analysis (chromium binary missing? Font issue? Slide content too large? OOM?).
- [ ] Action items with owners + due dates.
- [ ] Update this runbook if a new error pattern was observed.

### Postmortem template

- **What happened** — failure rate before/after, dominant error pattern.
- **Why it happened** — renderer regression, infra change, content edge case.
- **What we'll do differently** — renderer health check coverage, content validation, deploy guardrails.
