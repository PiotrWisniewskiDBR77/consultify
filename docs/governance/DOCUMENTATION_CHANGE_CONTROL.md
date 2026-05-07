# Documentation Change Control

Status: `ACTIVE`
Owner: PMO + Product Lead (with delegated owners per doc)
Date: 2026-05-07
Closes: Epic L3 (Documentation change control) — `PRESENTATION_ARTIFACT_ENGINE_SYSTEM_AND_BACKLOG.md`

This document is the parent policy for how controlled documentation evolves. It is enforced
by a small validator (`server/src/services/docChangeControlValidatorService.ts`) plus a CI
script (`server/scripts/check-doc-change-control.ts`, exposed as `npm run docs:check`).

---

## 1. Purpose

Documentation drift is the silent failure mode of a governance-heavy product. When a backlog
or reference doc is edited without rationale, owner sign-off, or a clear impact assessment,
downstream consumers (engineering, QA, ops, customer-facing teams) cannot tell what changed,
why, or what they need to update in response.

Documentation Change Control exists to:

- preserve **auditability** — every controlled change has rationale + impact + reviewer,
- prevent **silent drift** — every controlled doc has an explicit owner and changelog,
- keep PR review **honest** — CI fails when a controlled doc changes without a fresh
  changelog entry,
- make rollback **possible** — historical entries explain why a prior decision was made,
  so reverting is an informed action and not a guess.

This is a governance scaffold, not a content gate. The validator does not opine on the
content of a doc; it opines on whether the change has been properly recorded.

---

## 2. In-Scope Documents

The following documents are **controlled docs**. Each one must have an owner role and a
matching `CHANGELOG_<basename>.md` next to this policy file.

| Doc | Owner role |
| --- | --- |
| `docs/product/PRESENTATION_ARTIFACT_ENGINE_SYSTEM_AND_BACKLOG.md` | Product owner |
| `docs/product/PRESENTATION_ARTIFACT_ENGINE_REFERENCE.md` | Product owner |
| `docs/product/PRESENTATION_RUNTIME_AND_CONFIDENTIALITY_ROLLOUT_RUNBOOK.md` | Ops lead |
| `docs/product/PRESENTATION_RBAC_MATRIX.md` | Security lead |
| `docs/testing/PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md` | Product owner |
| `docs/testing/PRESENTATION_SLI_SLO.md` | Ops lead |
| `docs/product/EXECUTION_TASK_METADATA_STANDARD.md` | PMO |
| `docs/product/PRESENTATION_STAGE_GATE_WORKFLOW.md` | PMO |
| `DRD/UI_UX_SOURCE_OF_TRUTH.md` (in DRD root) | Design lead |

The named owner per role is tracked in `DOC_OWNER_REGISTRY.md`. Adding a new controlled
doc requires (a) adding a row in the registry, (b) creating the matching changelog file,
and (c) seeding the first entry.

Sprint 14 starter changelogs (this commit):

- `CHANGELOG_PRESENTATION_ARTIFACT_ENGINE_SYSTEM_AND_BACKLOG.md`
- `CHANGELOG_PRESENTATION_RUNTIME_AND_CONFIDENTIALITY_ROLLOUT_RUNBOOK.md`
- `CHANGELOG_PRESENTATION_RBAC_MATRIX.md`
- `CHANGELOG_PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md`

The remaining controlled docs get their changelogs seeded the next time they change, by the
author of that change (this is the lazy-bootstrap policy — we do not retroactively forge
changelog history for docs that haven't moved in this sprint).

---

## 3. Required Metadata In Every Change

Each new entry in `CHANGELOG_<doc>.md` MUST include all of the following fields. The
validator enforces them.

- **Author** — the person making the change. (Free text; matched against the entry header.)
- **Date** — `YYYY-MM-DD` (ISO calendar date). Matched against the entry header.
- **Doc** — the relative path of the doc this entry refers to.
- **Risk tier** — `P0`, `P1`, or `P2`. Maps to the existing risk model in
  `EXECUTION_TASK_METADATA_STANDARD.md` and the gate taxonomy in the engine backlog.
  - `P0` — content-integrity blocker (e.g. policy contradiction, missing canonical truth).
  - `P1` — decision/evidence affecting (e.g. RBAC adjustment, SLO threshold change).
  - `P2` — quality improvement, clarification, formatting (no behavior change).
- **Rationale** — at least 20 chars, must NOT be boilerplate (`updated docs` is rejected).
  Should answer "why is this change needed *now*".
- **Impact note** — what downstream code, docs, and tests are affected. Three sub-bullets:
  - `Code:` (services / modules touched, or `none`)
  - `Docs:` (other docs that need follow-up, or `none`)
  - `Tests:` (test surfaces to update, or `none`)
- **Reviewer** — the doc owner OR an explicit, named delegate from the registry.
- **Linked PR / ticket** — URL or ID of the PR / ticket that introduced the change.
- **Diff summary** — at least 1 bullet describing the actual edits.

The reusable template is in `DOC_CHANGE_TEMPLATE.md`. Copy it, edit, prepend to the
relevant `CHANGELOG_*.md`.

---

## 4. Process Flow

```
draft -> docs:check (local) -> PR -> docs:check (CI) -> owner review -> merge -> source of truth
```

Step by step:

1. **Author drafts the change** locally on a feature branch (in the actual product doc).
2. **Author appends a new entry** at the top of the relevant `CHANGELOG_<doc>.md`, using
   `DOC_CHANGE_TEMPLATE.md` as the seed.
3. **Author runs `npm run docs:check -- --doc <doc>`** to confirm the entry parses,
   passes validator rules, and is dated today (or in the PR window if `--since` is used).
4. **Author opens a PR.** CI runs the same validator. Any `FAIL` blocks the PR.
5. **Owner reviews and approves.** Reviewer must be either the doc owner from
   `DOC_OWNER_REGISTRY.md` or an explicit delegate listed in the same registry.
6. **After merge**, the `CHANGELOG_<doc>.md` row is the canonical record of the change.
   The product doc itself is the new state; the changelog is the audit trail.

The validator is intentionally local-first: it runs offline, has zero side-effects, and
never modifies any doc. CI just runs the same code path with `--quiet` and a report file.

---

## 5. Rejection Criteria

A change is rejected (validator returns `FAIL`) when any of the following are true for the
latest entry in the changelog:

- No changelog entry has been added for the doc that changed.
- The new entry is missing one of the required fields (author, date, rationale, impact
  note, reviewer, linked PR).
- Rationale is shorter than 20 chars.
- Rationale matches the boilerplate pattern (`/^updated docs?\.?$/i`) — e.g. `updated docs`,
  `updated doc.`, `Updated Docs`.
- The reviewer is not the registered owner and is not in the registry's delegate column.

A change is flagged with warnings (validator returns `PASS_WITH_WARNINGS`) when:

- Risk tier is missing or unrecognized.
- Diff summary has zero bullets.

Older entries (anything below the latest) are checked with the same rules but downgraded
from errors to warnings; we do not retroactively block a PR because of historical entries
we did not author.

---

## 6. Audit

- **Per-PR (automated)**: CI runs `npm run docs:check` on every PR. Failed checks block
  merge.
- **Quarterly (human)**: PMO + Product Lead review changelog completeness across all
  in-scope docs. Spot-checks ensure rationale/impact notes are substantive, not just
  syntactically present.
- **Ad-hoc (incident)**: When a production incident traces back to a doc change, the
  responsible changelog entry is part of the incident report.

The validator is not a replacement for human review — it is a floor. Humans still own the
substance of the change; the validator only ensures the substance was *recorded*.

---

## 7. Doc-vs-Changelog Parity (Implemented)

Every controlled doc has a paired CHANGELOG file. The parity gate ensures these stay in sync:

- A meaningful diff to the doc without a corresponding changelog entry → CI fails.
- A changelog entry without a meaningful doc diff → warning (might be a content-policy update).

Run locally:

```bash
npm run docs:parity
```

CI gate: `check-doc-changelog-parity.ts` runs on every PR that touches `docs/product/`,
`docs/operations/`, or `docs/governance/`.

Failure mode: PR is blocked until the appropriate changelog entry is added with rationale +
impact note + reviewer.

Implementation: `server/src/services/docChangelogParityService.ts` (pure logic, never throws,
JSON-serializable result) plus `server/scripts/check-doc-changelog-parity.ts` (read-only CLI;
uses `git log` + `git show` best-effort to recover the doc snapshot at the last changelog
commit, falls back to mtime comparison when git is unavailable). Tests:
`server/src/services/__tests__/docChangelogParityService.test.ts`.

Diff normalization: whitespace-only, HTML-comment-only, and markdown-link-target-only edits
are explicitly ignored. Only prose / structural changes count as "meaningful". This matches
the spirit of the change-control policy — we record changes that affect *meaning*, not
formatting noise.

---

## 8. Future Work

Tracked separately:

- **Owner-of-record enforcement** — automatic check that the reviewer named in the
  changelog matches the GitHub PR approver (today this is a manual review step).
- **Changelog-to-Notion mirror** — surface the latest entry of every controlled doc in the
  PMO Notion page, so non-engineers see the same audit trail without reading the repo.
- **Risk-tier escalation rules** — `P0` entries require an additional CTO/CPO sign-off
  (today they are accepted with the standard owner sign-off).

These items are explicitly out of scope for the current closure. They are listed here so
the governance scaffold can be extended without re-litigating the policy.
