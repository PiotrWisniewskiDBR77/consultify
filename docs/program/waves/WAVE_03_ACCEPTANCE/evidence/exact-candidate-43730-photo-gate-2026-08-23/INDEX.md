# Exact-candidate photographic gate — 2026-08-23

Status: `OPEN / FIRST 4 MODULES CAPTURED / OWNER VERDICT NOT CLAIMED`

## Candidate identity

| Field | Value |
|---|---|
| Product SHA | `43730f86f8a74943c36a58b9ff07aa680a42aa3e` |
| Dirty fingerprint | `e4bb10f8b18d0e0556f8d948da12eb776037765ab44de972113b68ca0ba0076a` |
| Client | `http://127.0.0.1:4390` |
| Server | `http://127.0.0.1:4391` |
| Database | `consultify_w3_assessment_owner_finaldemo_bcfb` — local reconstructible seeded data |
| Migrations | `833` |
| Authentication | real local OWNER through documented quick-access flow; test/auth bypasses OFF |
| Theme / viewport | dark desktop, in-app Browser |

Screenshots prove only the visible state at this exact candidate. They do not by
themselves prove persistence, permissions, write/readback, alternate states or
owner acceptance.

## Relation to the canonical 21 gates

The canonical denominator remains `G00–G20` from `MODULE_TEMPLATE.md`. This
folder adds a photographic evidence layer; it does not invent a competing
22-gate standard. The optional owner verdict is recorded separately after G20.

Every module replay must bind current screenshots to:

- `G01`: exact candidate/runtime identity;
- `G04`: visible fixture states;
- `G05`: visible route and main-flow checkpoints, supplemented by functional
  write/readback evidence;
- `G06`: viewport/theme/language/accessibility variants;
- `G07–G10`: owner review card, first impression, guided journey and alternate
  states;
- `G11`: durable screenshot registration with SHA-256;
- `G16–G17`: before/after owner retest;
- `G20`: final exact-SHA 16-module replay.

## Current captures and first comparison

| Evidence | Route / state | SHA-256 | Expected source | Current result |
|---|---|---|---|---|
| `01-chat-start.png` | `/chat`, authenticated OWNER, empty start | `d433c9d16717dddea5ff95cfaf3faecacdfc3ca6a4652c91799038b9549b77ed` | `modules/13_CHAT/MODULE_ACCEPTANCE.md`, `OWNER_REVIEW_2026-08-22.md` | `PARTIAL_MATCH`: exact marker, new welcome/composer/output controls and sidebar render. Conversation/history, governed proposal, Canvas, alternate states and persistence are not yet photographed on this candidate. |
| `02-my-work.png` | `/my-work`, Inbox | `c12db30d4acd021877c8cd5b9280d98779fc57f104d6c71350247e05ba2ceab8` | `modules/07_MY_WORK_AGENT/*OWNER_REVIEW*.md` | `FAIL_DATA_GATE`: shell and second-level menu render, but the active database returns `0` items. Owner cannot inspect the accepted/reworked Ideas, Notebook, Tasks or Decisions records. |
| `02b-my-work-owner-overlay.png` | `/my-work`, Tasks, authenticated OWNER | `4b47325d0ba3e2303e9845fa40416bf3b03bf791f474e511b807af789c74847a` | local append-only owner-review overlay manifest `/private/tmp/consultify-wave3-owner-overlay-43730-v1.json` | `DATA_GATE_RECOVERED / OWNER_RETEST STILL OPEN`: the same exact candidate visibly returns three owner-scoped tasks with distinct lifecycle states. This supplements rather than replaces the earlier empty-state evidence; Decisions and full write/readback still require capture. |
| `03-interview.png` | `/discovery`, Inbox | `09ba788b2001ad7502a7894f3a8d5bfc81b439162aaffcf6dce48ba09513a509` | `modules/02_INTERVIEW/MODULE_ACCEPTANCE.md`, `INTERVIEW_RECOMMENDATION_REGISTER.md` | `FAIL_DATA_GATE`: canonical table shell renders, but all counters are `0`; sessions, assignments, templates, insights, initiatives and detail workspaces cannot yet be replayed. |
| `03b-interview-owner-overlay.png` | `/interview`, Inbox, authenticated OWNER | `42e6072c74265a04aef8f9f365b6da15a55b9e1aa84468b5ee7f231df3af8afd` | local append-only owner-review overlay manifest `/private/tmp/consultify-wave3-owner-overlay-43730-v1.json` | `DATA_GATE_RECOVERED / OWNER_RETEST STILL OPEN`: the exact candidate visibly returns one submitted owner assignment at 100%. Templates, session workspace, insight/initiative propagation and persistence remain outside this screenshot. |
| `04-tools.png` | `/discovery-tools`, Library | `fcbf50127ecdf3c6238d28127034d5b3e6bac0bc7604f7cadd2e261f093a25c4` | `modules/03_TOOLS/TOOLS_OWNER_REVIEW_REGISTER.md` | `PARTIAL_MATCH`: nonempty 36-tool library, table and category/license/status fields render and align with the protected Library baseline. The current tab still says `Outputs`, while the owner register requires the four-class `Outputs / Insights / Reports / Initiatives` model; sessions, detail, preview, row menus and write/readback remain to capture. |

## Per-module expert reviews

| Module | Three-perspective review | Verdict |
|---|---|---|
| Chat | `CHAT_EXPERT_REVIEW_2026-08-23.md` — UX/visual, business-flow and technical/integration review bound to `01-chat-start.png` | `NO-GO FOR OWNER RETEST / REMEDIATION AND EVIDENCE REQUIRED` |
| My Work | `MY_WORK_EXPERT_REVIEW_2026-08-23.md` — UX/visual, business-flow and technical/integration review bound to `02-my-work.png` | `NO-GO FOR OWNER RETEST / FAIL_DATA_GATE` |
| Interview | `INTERVIEW_EXPERT_REVIEW_2026-08-23.md` — UX/visual, business-flow and technical/integration review bound to `03-interview.png` | `NO-GO / PHOTOGRAPHIC GATE FAILED / FAIL_DATA_GATE` |
| Tools | `TOOLS_EXPERT_REVIEW_2026-08-23.md` — UX/visual, consulting-flow and technical/integration review bound to `04-tools.png` | `NO-GO / VISUAL REGRESSION / DOMAIN FLOW NOT IMPLEMENTED` |

## Fail-closed rule

A module is not presented as ready when any of these is true:

1. the screenshot is from a different SHA/runtime/data source;
2. the expected nonempty fixture is empty or synthetic data is not labelled;
3. only the shell, preview or happy path was photographed;
4. a screenshot is used as proof of persistence or authorization;
5. an owner finding has no current before/after evidence;
6. the owner has not issued the verdict recorded in the module packet.

## Next photographic packet per module

For each of the 16 modules, capture the smallest complete set covering:

1. landing/table with nonempty data;
2. empty, loading, error and permission state;
3. filters, sort, view switcher, context/kebab menu and preview;
4. full-detail/workspace navigation and all module-specific cards;
5. create/edit/save plus refresh and cold readback;
6. approval/rejection or lifecycle boundaries;
7. light/dark and PL/EN where the module exposes them;
8. before/after evidence for every registered owner finding.

Each capture receives URL, candidate identity, persona, fixture, expectation,
visible verdict, SHA-256 and the gates it supports. `OWNER_ACCEPTED` remains a
human decision and is never inferred from a screenshot or an automated test.
