# Customer Communications Templates

Companion file to the four canonical incident runbooks
(`RB-01..RB-04`). The runbooks reference this document from their
`Communication` section. Use the templates verbatim where possible —
they are battle-tested for tone, completeness, and legal review.

> Index: see `INCIDENT_INDEX.md`.
> Authoritative tone & escalation policy: this file.
> All templates default to English. Polish translations are tracked as
> future work (see bottom of this file).

---

## Tone and language standards

- Tone: calm, factual, action-oriented. No blame, no internal jargon.
- Subject lines: clear category + short summary.
- Always include: incident ID, status, ETA, what we're doing, what the
  customer should do (if anything).
- Avoid: speculation, partial root causes, internal team names without
  context.

---

## Severity → channel matrix

| Severity | Internal channel | External channel | Cadence |
| --- | --- | --- | --- |
| P0 | Slack `#consultify-incidents` + on-call page | Status page + customer email | every 15 min until resolved |
| P1 | Slack `#consultify-incidents` | Status page | every 30 min |
| P2 | Slack `#consultify-incidents` (handoff thread) | Status page if customer-visible | hourly until resolved |

---

## Template 1 — Initial acknowledgment (within 15 min)

```
Subject: [<INCIDENT_ID>] Investigating: <one-line symptom>

Hi <Customer Name> team,

We're aware of an issue affecting <component> and are investigating.

Current status: Investigating
Started: <ISO timestamp>
Customer impact: <e.g. "Some PDF exports are returning errors">
Workaround: <e.g. "Try again in 5 minutes" or "None at this time">
Next update: in <30> minutes

Status page: <url>

Apologies for the disruption — we'll keep you posted.

— Consultify Operations
```

---

## Template 2 — Investigation update (every 15-30 min)

```
Subject: [<INCIDENT_ID>] Update: <one-line current status>

Update at <ISO timestamp>:

What we know:
- <bullet 1>
- <bullet 2>

What we're doing:
- <bullet 1>
- <bullet 2>

Customer impact: <unchanged | reduced | no longer affecting…>
Next update: in <X> minutes

Thank you for your patience.

— Consultify Operations
```

---

## Template 3 — Resolution announcement

```
Subject: [<INCIDENT_ID>] Resolved: <one-line summary>

The incident affecting <component> is now resolved as of <ISO timestamp>.

Summary:
- Started: <ISO>
- Resolved: <ISO>
- Total impact window: <duration>
- Affected: <scope>

Root cause (preliminary): <brief>
What we did: <brief>

Postmortem: a full postmortem will be published within 5 business days at <url>.

If you experienced any specific issues you'd like us to verify, please reply to this thread.

Thank you for your patience.

— Consultify Operations
```

---

## Template 4 — Postmortem publication

```
Subject: [<INCIDENT_ID>] Postmortem: <title>

Hi <Customer Name> team,

The full postmortem for the incident on <date> is now available:

<url>

Highlights:
- Root cause: <one-line>
- Impact: <one-line>
- What we changed: <one-line>
- Action items: <count> tracked, all due within <30 days>

We'd be happy to walk through this on a call if useful.

— Consultify Operations
```

---

## Template 5 — Maintenance window pre-announcement (proactive)

```
Subject: [Scheduled Maintenance] <date> — <feature> brief downtime

Hi <Customer Name> team,

We have scheduled maintenance affecting <feature> on <date> from <start> to <end> (<timezone>).

Expected impact: <e.g. "PDF exports unavailable for ~5 minutes">
Action required: <none | rerun affected jobs after window>

Status page: <url>

Apologies for the inconvenience — this maintenance will <improve X / harden Y>.

— Consultify Operations
```

---

## Severity-specific guidance

- P0 templates use shorter sentences and lead with action.
- P1 may include an internal-only paragraph that's removed before
  sending externally.
- P2 customer comms only fire when end-users are affected; otherwise
  internal-only.

---

## Translation

- All templates default to English.
- For Polish customers, mirror translations live alongside this file
  (future work — not in scope).

---

## Compliance and escalation

- Never include PII or internal IDs in customer-facing comms.
- Legal/compliance review required for >2h customer-impacting
  incidents.

---

## Future work

- Multilingual templates
- Auto-fill from incident metadata
- Per-customer impact scoping
