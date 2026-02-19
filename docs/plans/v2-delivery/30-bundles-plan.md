# V2 Delivery — plan 30 paczek (bundles)

Cel: dowieźć wszystkie T001–T122 możliwie szybko, ale **pod kontrolą**.

## Zasady sterujące (must)
- **WIP = 3**: w danym momencie aktywne maksymalnie:
  - **1 paczka Codex**
  - **2 paczki Cursor (my)**
- Każda paczka ma:
  - osobny branch,
  - checklist PR (z `workflow.md`),
  - manual QA (odwołanie do `docs/test-quality/V2_MANUAL_QA_CHECKLIST_122_TASKS.md`),
  - jasny “merge gate”: minimalne testy + smoke.

## Co jest “poza planem kodowym” (EXTRA)
Te rzeczy robimy **na boku** (nie blokują engineering). Szczegóły w `extras-non-coding.md`:
- **Materiały edukacyjne** (treści) — T074–T085 (content)
- **Demo company website (treści/strona)** — T088 (content)
- **Mobile app do Lean data collection** — T029 (osobny tor)

Uwaga: jeśli któryś z tych tematów wymaga “plumbing” w kodzie (np. puste stany, routing, upload), to traktujemy to jako mały slice w paczkach 15–16/20.

---

## Mapa 30 paczek (SSOT)
Format: **Bundle** → taski (Txxx) → domyślny owner.

### Bundle 01 — Chat & Research (core)
- Taski: **T001–T006**
- Domyślny owner: Cursor

### Bundle 02 — My Work (productivity hub)
- Taski: **T007–T012** (+ T008 jako “defer/guardrails” jeśli dotyka UI)
- Domyślny owner: Cursor

### Bundle 03 — Interview / Survey / Acquisition
- Taski: **T013–T017**
- Domyślny owner: Codex (dużo UI flow + copy), Cursor robi review + merge

### Bundle 04 — Tools: hub + library UI + knowledge linking
- Taski: **T018–T021**
- Domyślny owner: Codex

### Bundle 05 — Tools: toolsets + Speed Tool
- Taski: **T019, T022–T024**
- Domyślny owner: Codex

### Bundle 06 — Licensed tools (core)
- Taski: **T025–T027**
- Domyślny owner: Cursor

### Bundle 07 — Licensed tools (advanced, bez mobile)
- Taski: **T028, T030, T031**
- Domyślny owner: Cursor

### Bundle 08 — Initiatives: AI authoring + gate readiness
- Taski: **T032–T033**
- Domyślny owner: Cursor

### Bundle 09 — Portfolio optimization engines
- Taski: **T034–T038**
- Domyślny owner: Codex

### Bundle 10 — Execution control (plan vs actual)
- Taski: **T039–T042**
- Domyślny owner: Cursor

### Bundle 11 — Execution: people/change/comms
- Taski: **T043–T045**
- Domyślny owner: Codex

### Bundle 12 — Benefits / KPI / Finance mapping
- Taski: **T046–T049**
- Domyślny owner: Cursor

### Bundle 13 — Finance A (ingestion + ratios)
- Taski: **T050–T051**
- Domyślny owner: Codex

### Bundle 14 — Finance B (analysis + budgeting)
- Taski: **T052–T053**
- Domyślny owner: Codex

### Bundle 15 — Finance C (initiative modeling)
- Taski: **T054**
- Domyślny owner: Cursor (to jest “hard”)

### Bundle 16 — Finance D (valuation suite)
- Taski: **T055–T057**
- Domyślny owner: Codex (z Twoim review merytorycznym)

### Bundle 17 — Presentations generator + templates
- Taski: **T058–T059**
- Domyślny owner: Cursor (weekend / duży temat)

### Bundle 18 — Reports generator + templates
- Taski: **T060–T061**
- Domyślny owner: Cursor (weekend / duży temat)

### Bundle 19 — Automated recurring/event reporting
- Taski: **T062**
- Domyślny owner: Codex

### Bundle 20 — Organization + Megatrends + Team
- Taski: **T063–T067**
- Domyślny owner: Codex (UI-heavy), Cursor review

### Bundle 21 — Onboarding + Feature news
- Taski: **T068–T069**
- Domyślny owner: Codex

### Bundle 22 — Help plumbing (AI docs + nav + micro‑video)
- Taski: **T071–T073** (+ T070 jako content “na boku”)
- Domyślny owner: Codex

### Bundle 23 — Admin Sync Hub + External system sync guardrails
- Taski: **T086 + T008**
- Domyślny owner: Cursor

### Bundle 24 — Demo engine (data + conversion)
- Taski: **T087, T089, T090** (+ T088 content extra)
- Domyślny owner: Codex

### Bundle 25 — Trial + upgrade mechanics
- Taski: **T091–T092**
- Domyślny owner: Cursor

### Bundle 26 — Legal acceptance (versioning + UX)
- Taski: **T093**
- Domyślny owner: Cursor

### Bundle 27 — Website / Docs / Visual update
- Taski: **T094–T095**
- Domyślny owner: Codex (content), Cursor tylko “route integrity” i review

### Bundle 28 — Partners program (toolkit + certification + outreach)
- Taski: **T096–T098**
- Domyślny owner: Codex

### Bundle 29 — UI/UX final pack (N/C, sidebar, typography, chat polish)
- Taski: **T099–T105 + T101–T103**
- Domyślny owner: Cursor (duży temat)

### Bundle 30 — Platform P0 pack (ops + monetization + AI governance + architecture)
- Taski: **T106–T122** (czyli: feedback, stability, superadmin, billing, oauth, analytics/readiness, AI governance, consolidation)
- Domyślny owner: Cursor (program), z pracą w “slices” (poniżej)

#### Bundle 30 — slices (żeby nie było mega‑klocka)
30.1 **Feedback**: T106  
30.2 **Stability + deploy gates**: T107  
30.3 **SuperAdmin + testing framework**: T108  
30.4 **Billing SSOT (Stripe)**: T109  
30.5 **OAuth bundle**: T110–T112  
30.6 **Behavior + readiness + Sellix**: T113–T115  
30.7 **AI prompts + learning**: T116  
30.8 **Core docs governance**: T117  
30.9 **Internet context governance**: T118  
30.10 **Org/user AI governance**: T119–T121  
30.11 **Architecture consolidation**: T122

---

## Start jutro rano — pilot 3 małych paczek (branch workflow test)
Cel: nauczyć się branch→test→merge bez ryzyka.

### Pilot A (Cursor)
- Zakres: **T002 — Project Sidebar Collapse** (w obrębie Bundle 01)

### Pilot B (Cursor)
- Zakres: **T001 — Chat Title Suggestion System** (w obrębie Bundle 01)

### Pilot C (Codex)
- Zakres: **T072 — Context‑Sensitive Help Navigation** (w obrębie Bundle 22)

Po zrobieniu 3 pilotów: manual QA + `npm run verify:quick` + (jeśli dotyka UI nav) `npm run test:e2e:smoke`, potem merge do `main`.

