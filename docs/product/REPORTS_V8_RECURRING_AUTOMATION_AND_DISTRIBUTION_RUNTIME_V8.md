# Reports v8 Recurring Automation And Distribution Runtime

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical runtime for recurring report generation, scheduled refresh, re-review and governed distribution

---

## 1. Why this document exists

Serious report autonomy is not only:

- create once
- export once

It must also support:

- repeated generation
- repeated refresh
- periodic review
- governed redistribution

This document closes that recurring runtime.

---

## 2. Core statement

Recurring reports must remain part of the canonical report runtime, not fork into a separate automation product.

Canonical rule:

`scheduled generation and recurring distribution must preserve the same source, review, freshness and delivery governance as one-off reports`

---

## 3. What recurring runtime must support

It should support:

- schedule creation
- source refresh before run
- stale detection
- conditional regeneration
- re-review when material changes occur
- controlled distribution after run

---

## 4. Schedule classes

At minimum:

- `time_based`
- `event_triggered`
- `review_cadence`
- `distribution_cadence`

---

## 5. Material-change doctrine

Not every refresh should auto-regenerate and redistribute.

The runtime must distinguish:

- no significant change
- minor update
- material update
- critical review-required update

Rule:

`material or critical change must reopen the right review path before external or executive redistribution`

---

## 6. Recurring distribution doctrine

The runtime should support:

- internal routine send
- executive cadence send
- external controlled send where explicitly allowed

It must preserve:

- distribution audit
- freshness state at send time
- review state at send time

---

## 7. AI role

AI may:

- summarize what changed since last run
- draft updated executive summary
- propose whether re-review is needed

AI may not:

- auto-approve redistributed report
- suppress material freshness warnings

---

## 8. Presentation recurring automation scope

> V8 Decision W6-4 applied — 2026-03-23

Recurring automation extends to presentations, but in bounded form.

| Output type | Recurring automation scope | Governance |
|---|---|---|
| **Reports** | Full first-class recurring support — schedule creation, source refresh, conditional regeneration, re-review, controlled distribution | Standard recurring report governance |
| **Presentations** | Bounded recurring support — generated only from an approved recurring report or an approved recurring output program, not fully freeform | Stricter governance than reports; presentation recurring runs must trace to an approved recurring report or program source |

Canonical rule:

`presentations are included in recurring automation, but with stricter governance than reports`

---

## 9. Acceptance criteria

This layer is complete when:

- recurring reports stay inside canonical report governance
- recurring presentations are supported from approved recurring report or program sources
- material changes reopen review when needed
- scheduled distribution preserves audit and freshness state
- autonomy can support repeated reporting without becoming unsafe

---

## 10. Related canonical docs

- `REPORTS_V8_RUNTIME_TRUTH_MAP.md`
- `REPORTS_V8_DELIVERY_AND_EXPORT_RUNTIME.md`
- `REPORTS_V8_AI_OPERATIONS_AND_GOVERNANCE.md`
