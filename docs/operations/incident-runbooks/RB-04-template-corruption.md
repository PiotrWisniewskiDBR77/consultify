# Runbook: Template Corruption

**Severity tier:** P0 — templates are shared infrastructure; corruption cascades to every deck using the template.
**SLO impacted:** Indirect — affects all decks using the corrupted template. Surfaces as a sudden cluster of `BLOCKED_P0` decks sharing one `template_id`. Side-effect: pushes `export_blocked_rate` upward.
**Triggers:**

- Sudden spike in `BLOCKED_P0` transitions where many decks share one `template_id` (see Governance Watchlist).
- Anomaly detector emits `anomaly_detected` with `metadata.sloId='export_blocked_rate'` AND inspection reveals shared template root.
- Manual customer report: "Every deck using template X is now flagged BLOCKED."
- `presentation_template_governance_events` shows a recent edit/promotion to the now-corrupted template.

**Owner role:** Backend Lead + Template Owner + SRE on-call (P0 page)
**Estimated time to mitigate:** 30–60 minutes

---

## 1. Detection

### Signals

- Alert: governance alert worker fires many `BLOCKED_P0` dispatches grouped by the same `template_id`.
- Dashboard: Operations Health scoreboard `Export blocked rate` card in `breach` AND Watchlist filtered by `template_id` shows ≥3 affected decks.
- Customer signal: multiple customers hit by the same template report identical blocking errors.
- Metric/SLO: see RB-01 cross-reference — RB-04 is the underlying cause whenever ≥3 decks share a template across the BLOCKED_P0 cluster.

### Confirm-before-acting checklist

- [ ] Group `BLOCKED_P0` decks of the last hour by `template_id` and confirm a single template dominates.
- [ ] Inspect `presentation_template_governance_events` for a recent change to that template.
- [ ] Check the Quality Gates panel for the failing rule that the template now violates.
- [ ] Identify scope: single template / a family sharing a `lineage_root_id`.

---

## 2. Containment

Speed matters here — every new deck minted from the corrupted template carries the defect.

### Step 2.1 — Deprecate the corrupted template version (Sprint 14 endpoint)

```bash
curl -X POST -H "Authorization: Bearer $OPS_TOKEN" \
     -H "Content-Type: application/json" \
     "${BASE_URL}/api/presentations/templates/${TEMPLATE_ID}/governance/deprecate" \
     -d '{"reason":"rb-04-corruption-detected"}'
```

### Step 2.2 — Identify the last-known-good version via lineage chain

```sql
SELECT id, version, lifecycle_state, created_at
  FROM presentation_templates
 WHERE lineage_root_id = (SELECT lineage_root_id FROM presentation_templates WHERE id = $1)
   AND lifecycle_state IN ('approved','active')
 ORDER BY created_at DESC
 LIMIT 5;
```

### Step 2.3 — Block new decks from using the corrupted template

The deprecate endpoint already prevents new selections in the picker, but verify the picker reflects the change (cache invalidation):

```bash
curl -fsSL "${BASE_URL}/api/presentations/templates?lifecycle_state=active" | jq '.data[].id' | grep -F "${TEMPLATE_ID}"
# Expect NO match. If the corrupted id is still listed, escalate to the cache layer.
```

---

## 3. Recovery

### Step 3.1 — Clone the last-known-good template into a new draft

Use the existing template-clone endpoint (no schema change). Apply known fixes from the postmortem hypothesis only — keep the diff minimal.

### Step 3.2 — Submit the new draft for approval through the existing governance flow

Do NOT skip approval. The defect that produced the corruption may have bypassed approval; do not repeat that path.

### Step 3.3 — Migrate affected decks per operator decision (NOT bulk)

For each affected deck, the operator inspects the deck and decides whether to migrate to the new version or leave it on the old (non-deprecated) version. Manual gating prevents a second wave of corruption if the new template has an unforeseen issue.

### Verification

- [ ] No new `BLOCKED_P0` transitions on decks rooted in the same `lineage_root_id` for 30 minutes.
- [ ] `export_blocked_rate` SLO returns to `pass` on the Operations Health scoreboard.
- [ ] Quality Gates panel no longer flags the template-driven rule.

---

## 4. Communication

### Internal

- Slack channel: `#consultify-incidents` AND `#consultify-exec` (P0 escalation).
- Mention: `@on-call` and `@template-owner`.
- Status update cadence: every 15 minutes until resolved; engage exec sponsor at the 30-minute mark if not resolved.

### External (customer-facing)

- Status page update REQUIRED for P0.
- Customer email template: see `docs/operations/incident-runbooks/customer-comms-templates.md` (acknowledge → investigation → resolution). Per-customer outreach for customers with high deck counts on the affected template.

---

## 5. Postmortem

### Required artefacts

- [ ] Incident timeline document.
- [ ] Root cause analysis: how did the corrupted version pass approval? Human error, gap in CI, race condition?
- [ ] Action items with owners + due dates.
- [ ] CI / approval-gate change to prevent recurrence (e.g. golden-test against a known-good corpus).
- [ ] Update this runbook if a new failure mode appeared.

### Postmortem template

- **What happened** — first symptom, scope by deck count, cluster identification.
- **Why it happened** — change history of the template, approval-gate audit trail, missing CI check.
- **What we'll do differently** — automated golden checks before promotion, stricter approval routing, telemetry around lineage drift.
