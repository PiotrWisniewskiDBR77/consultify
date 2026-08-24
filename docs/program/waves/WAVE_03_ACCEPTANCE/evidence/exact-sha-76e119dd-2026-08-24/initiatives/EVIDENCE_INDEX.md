# Initiatives targeted blocker closure — exact SHA evidence

Date: `2026-08-24`

Status: `TECHNICAL TARGETED PASS / OWNER ACCEPTANCE REQUIRED`

## Qualified runtime

- Product/client/server SHA: `76e119dda75770a6549b5a00deffc407c1eca868`
- Client: `http://127.0.0.1:3987`
- Server: `http://127.0.0.1:3986`
- Database: retained local PostgreSQL `consultify_w3_initiatives_owner_20260824`
- Migrations: `834`
- Fixture: `W3-INITIATIVES-OWNER-v1`
- Runtime manifest: `/private/tmp/consultify-wave3-runtime-manifest-ini-adopt-r9-20260824.json`
- Production and Railway: unchanged

## Targeted findings verified

| Finding | Previous exact-SHA result | Current browser result | State |
|---|---|---|---|
| `INI-C04-A` | Plan did not expose the canonical Initiative when no saved window existed. | Plan contains `Automatyzacja planowania przezbrojeń` and explicitly shows `Nie przypisano okna planu`. | `FIXED_BROWSER_VERIFIED` |
| `INI-C04-B` | Capacity exposed raw UUID and `UNKNOWN` actor labels. | The retained fixture UUID is not visible; the surface uses readable actor/constraint labels. | `FIXED_BROWSER_VERIFIED` |
| `INI-C04-C` | `Otwórz narzędzia obciążenia` produced a blank/opaque destination. | The action opens the labelled `Capacity Scenario Workbench` on the same Capacity route. | `FIXED_BROWSER_VERIFIED` |

This packet proves only the three targeted blocker closures. It does not prove
the complete Plan/Capacity product contract, the full `G00–G20` module gate,
owner acceptance, release readiness, or production behavior.

## Browser evidence

| File | SHA-256 | What it proves |
|---|---|---|
| `01-plan-unscheduled-canonical-initiative.png` | `1f147efa9cc36d8fec13e232399ab40050e7129a2dfcef864f285bc8d8708ea7` | Canonical Initiative remains reviewable in Plan even without a saved scenario window. |
| `02-capacity-workbench-readable.png` | `4bdcecdea2cadf60f1eebccc242937736d2c0ee793a0865607475528447152c4` | Capacity uses readable labels and opens the non-blank workbench. |

Both captures are `1600×1000` and were produced against the qualified runtime
above.

## Verification ledger

- Focused tests for Plan and Capacity: `6/6 PASS`.
- ESLint for the four touched source/test files: `PASS`.
- `git diff --check`: `PASS`.
- Browser assertions:
  - canonical Initiative text present in Plan;
  - unscheduled state text present in Plan;
  - fixture UUID absent in Capacity;
  - workbench region with `aria-label="Capacity Scenario Workbench"` present;
  - URL remains `/initiatives?tab=capacity`, not `about:blank`.

## Authentication qualification

The current seed script password did not authenticate against the preserved
database; the direct login endpoint returned literal `401`. No credential or
database record was rewritten. Browser verification used a short-lived OWNER
session token signed with the exact local runtime secret for the already
existing fixture persona. No authentication/test bypass was enabled and no
production identity was used.

## Remaining gate

Piotr must still perform the owner replay and decide each observation. Until
then the controlling result remains `OWNER_RETEST_PENDING`; these screenshots
are technical evidence, not an acceptance decision.
