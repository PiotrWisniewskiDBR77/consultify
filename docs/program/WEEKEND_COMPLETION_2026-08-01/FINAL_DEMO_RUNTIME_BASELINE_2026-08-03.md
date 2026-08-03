# Consultify MVP — final demo runtime baseline (2026-08-03)

## Purpose

This file is the single runtime reference for the UI/UX pass and the subsequent
16-module contract audit. It separates code integration from feature visibility and from
authenticated acceptance.

## Canonical revision

- branch: `codex/integrate-mvp-final-20260803`;
- Git and `origin/demo` revision: `c4166ef942fded38b0e7a2a5f518bf03caa7bd15`;
- target: `https://demo.consultify.ai`;
- Railway project/environment/service: `consultify` / `demo` / `consultify`.

No UI/UX agent may use an older SHA as its baseline. A report produced against another
revision is discovery evidence only, not final acceptance evidence.

## Program state represented by this revision

- exactly 93 unique ledger tasks;
- 92 tasks with `CODE_GO_FROZEN`;
- `ASM-09` with `OUTSIDE_MVP`;
- post-MVP work remains four separate program items: audits, meetings, consulting tools
  from Knowledge Tools, and assessment tools.

## Runtime activation policy

The demo build exposes accepted MVP surfaces. It must not enable post-MVP or unrelated
experimental surfaces merely to make the release appear larger.

Explicit demo activations added after integration:

| Surface | Task | Flag | Demo decision |
| --- | --- | --- | --- |
| post-investment actual and review | FIN-07 | `VITE_FIN007_POST_INVESTMENT_REVIEW_ENABLED` | `true` |
| KPI Recovery Card | RES-04/RES-11 flow | `VITE_RESULTS_RECOVERY_CARD_ENABLED` | `true` |

Surfaces deliberately left disabled:

| Surface | Flag | Reason |
| --- | --- | --- |
| Execution change signals | `VITE_EXEC_CHANGE_SIGNALS_ENABLED` | separate, not visually accepted; not required to represent the 93-task MVP ledger |
| ASM-09 SIRI/ADMA packs | package scope | `OUTSIDE_MVP` |
| four post-MVP program items | multiple | must remain separate backlog items |

The standard Results and Execution cockpit suites already default to enabled on demo and
other non-public-production hosts. They do not require additional Railway variables.

## Active entry points to inspect in the UI/UX pass

The UI/UX pass must verify actual mounted paths, not isolated component harnesses:

- Finance/Results ROI detail: FIN-07 form and durable review;
- Results KPI drawer: definition/version/visibility, measurement, threshold and Recovery
  Card;
- Results Scorecards and Initiatives Goals: separate owners and separate screens;
- Initiatives document: roles/capabilities, resources, capacity and roadmap;
- My Work: Calendar, Notes and Vault;
- Chat/Canvas: approved handoff to Material, Note, Table and Initiative with reopen link;
- Finance: statement ingestion and candidate handoff;
- Tools, Assessments, Interviews, Materials and Execution golden-flow entry points from the
  canonical navigation.

## Release gates

This baseline may advance through three different statuses only with evidence:

1. `DEMO_BUILD_HEALTHY`: deployment success, `/ping`, `/api/health`, exact SHA.
2. `DEMO_UI_UX_REVIEWED`: authenticated full-product pass on this exact SHA; blockers fixed
   and redeployed.
3. `CONTRACT_AUDIT_COMPLETE`: all 16 module contracts compared with this final deployed
   revision and classified as implemented, partial or missing.

`CODE_GO_FROZEN` is a code/package acceptance status. It does not by itself claim that a
surface was visible, populated or visually accepted on demo.

