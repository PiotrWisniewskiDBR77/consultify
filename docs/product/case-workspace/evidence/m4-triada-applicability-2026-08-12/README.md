# M4 — VISUAL_TRIADA_SPEC_A_LEDGER applicability audit (2026-08-12)

Worktree `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`,
branch `claude/case-workspace-v1-20260809`, HEAD at start `0687420a61`.
Role: **auditor only** — no product file was edited. The only files touched
by this packet are this directory and
`docs/product/case-workspace/acceptance/VISUAL_TRIADA_SPEC_A_LEDGER.csv`
(append-only, `git status --short` before this packet started already showed
that file untouched by it and several *other* files dirty from concurrent
packets — `CUSTOMER_JOURNEY_LEDGER.csv`, `GOLDEN_CASE_EVIDENCE_LEDGER.csv`,
`src/components/CaseWorkspace/{PlanView,RezultatyView,api,ui}.tsx` — none of
which this packet touched).

## What this closes

The ledger had 235 `NOT_IMPLEMENTED` rows extracted mechanically from broad
canon documents (TRIADA_KANON.md, ARTIFACT_ANATOMY_STANDARD.md,
MY_WORK_TABLE_SURFACE_CONTRACT_V1.md, and the case-workspace `00-14` package)
by an earlier, uncoordinated extraction pass — `acceptance/README.md`'s own
words: "first-pass EPIC E0 draft... rows carry `status = NOT_IMPLEMENTED`
throughout... not the final W1 deliverable." Nobody had gone through them one
by one to establish which actually bind Case Workspace's own surfaces
(Zlecenia list, preview, full Case, Plan Prosty/Ekspercki/Lista, Realizacja,
Rezultaty, history, attention, approvals, waits, relations, deliverables,
return context) versus which describe archetypes, view modes or product
phases Case Workspace does not use, or does not use yet.

Of the 235, two (`CW-RT-038`, `CW-DOD-H7`) already had a superseding `-U1`
row from an earlier packet (`claude-l1-triada-speca`) carrying real evidence
— which is exactly the "233 currently carry no evidence at all" the launch
brief named (235 minus those 2).

## Method

1. Read the canon in full: `docs/ui-standards/TRIADA_KANON.md` (Part A +
   Part B 40-point checklist), `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`
   §§0C, 3, 10.2, 11.2, 13, 18.1, `docs/ui-standards/MY_WORK_TABLE_SURFACE_CONTRACT_V1.md`
   in full, and every case-workspace package document (`00`–`14`, read `00`,
   `01`, `02`, `03`, `04`, `05`, `12`, `13` fully; `08`, `09`, `11` for their
   2/1/frozen-decision rows specifically).
2. Grouped all 235 rows by `row_id` prefix (`CW-*` 124, `MYWORK-*` 39,
   `ARTIFACT-*` 35, `TRIADA-*` 31, `GOV-*` 2, `OD-*` 2, `AEV8-*` 1, `HIST-*`
   1) and read every row's full text against the canon just read.
3. For every row where the canon gave a literal reason the requirement does
   not bind one of the required surfaces, or names it explicitly as a later
   phase, recorded `NOT_APPLICABLE_TO_THIS_SURFACE` or `DEFERRED_POST_V1`
   with the exact file:line citation. Where no such citation could be found,
   the row stays `APPLICABLE_REQUIRED_V1` — per the packet's own rule, a
   belief that something "looks unrelated" is not a citation.
4. Checked for exact-text duplicates within this one ledger
   (normalize-lowercase-strip-punctuation-collapse-whitespace, same method
   `acceptance/SCOPE_ADJUDICATION.md` §2.1 already validated for the
   sibling ledgers): **zero** exact duplicates found among the 235 rows.
   Paraphrase-level near-duplicate detection was not attempted — the same
   limitation `SCOPE_ADJUDICATION.md` §2.1 already names for the sibling
   ledgers applies here ("needs semantic judgment per pair, which... is not
   a single-session task").
5. Read every existing evidence directory under
   `docs/product/case-workspace/evidence/` dated 2026-08-12 in full (not
   just its filename) before citing it: `l3-axe-completion`, `e5-a11y-matrix`,
   `f1-back-button-a11y`, `f2-bottomnav-contrast`, `g1-nav-active-canon`,
   `f3-partial-skipped`, `c4-deliverable-ui`, `m1-plan-authoring-ui`,
   `m2-approval-status-ui`, `e7-migration-paths`. Matched a small number of
   `APPLICABLE_REQUIRED_V1` rows to evidence that concretely and specifically
   proves them (not merely "related"), and marked those `PASS_WITH_EVIDENCE`.
6. Live-verified two things myself against the real stack (backend
   `127.0.0.1:3001`, PID 11390, coordinator-owned, not restarted; vite
   `127.0.0.1:4501`; real login `cw.local@local.test`; isolated
   `claude-in-chrome` tab, `location.href` re-confirmed before every capture,
   per the browser-hazard warning in the launch brief):
   - the F1 back-button fix (`aria-label="Wstecz"`) is live today;
   - a genuine, previously-unrecorded label-text mismatch between canon and
     the live UI on plan-version status pills (see §4 FAIL below).
7. Grepped `src/components/CaseWorkspace/*.tsx` directly for crimson/`primary-*`
   misuse as a source-level check (`CW-DOD-F5`).

## 1. Full breakdown — all 235 rows, one of six categories

| Category | Count |
|---|---:|
| `APPLICABLE_REQUIRED_V1` | 219 |
| `NOT_APPLICABLE_TO_THIS_SURFACE` | 6 |
| `DEFERRED_POST_V1` | 4 |
| `PASS_WITH_EVIDENCE` | 4 |
| `FAIL` | 3 |
| `DUPLICATE_OF:<id>` | 0 |
| **Total** | **235** |

(A third row, `CW-RT-031-M4b`, supersedes this packet's own first pass on
`CW-RT-031` — see §6 "corrections made within this pass" — bringing the
ledger's net new rows from this packet to 236, all append-only, none
in-place.)

## 2. `APPLICABLE_REQUIRED_V1` — 219 total; of those, PASS / FAIL / unverified

- **PASS_WITH_EVIDENCE: 4** (`CW-DOD-H7`, `CW-RT-038`, `CW-SSOT-7.4-03`,
  `CW-DOD-F5` — see §3, evidence table).
- **FAIL: 3** (`CW-03-009`, `CW-RT-031`, `ARTIFACT-PANEL-SECTIONS` — see §4,
  full reproduction).
- **Unverified in this pass: 212.** These remain genuinely open — this
  packet did not attempt to live-test all 212 (a realistic live sweep of
  every SPEC-L/SPEC-A checklist item across every required surface at every
  breakpoint/theme is multiple sessions of work, not one auditor's pass).
  Each carries a `-M4` superseding row citing its source file:line and
  restating that no exclusion citation was found, so it stays
  `APPLICABLE_REQUIRED_V1` rather than being silently dropped. See §5 for
  which surfaces have zero live evidence at all.

## 3. `NOT_APPLICABLE` and `DEFERRED` — every one, with its citation

| Row | Verdict | Citation (file:line, quoted) |
|---|---|---|
| `ARTIFACT-CANVAS-AI-SCOPE` | NOT_APPLICABLE | `12_CASE_WORKSPACE_MODULE_SSOT.md:231` — "This is a SPEC-A full-object surface: Archetype C — Record, class L... it is neither a dashboard nor a ModuleHub, and it is not a new local shell." Canvas = archetype A (`ARTIFACT_ANATOMY_STANDARD.md:141`), a different archetype than Record = C. |
| `ARTIFACT-CANVAS-KEYBOARD` | NOT_APPLICABLE | Same as above. |
| `ARTIFACT-DOD-182` | NOT_APPLICABLE | This is the "DoD Instrument" checklist (`ARTIFACT_ANATOMY_STANDARD.md:1560`), scoped to "Typ 4 — INSTRUMENT" (§0C, line 52-58), distinct from "Typ 3 — ARTEFAKT" (line 45); `12_CASE_WORKSPACE_MODULE_SSOT.md:231` confirms Case is a Typ-3 Archetype-C artifact. |
| `ARTIFACT-WIZARD-CONTRACT` | NOT_APPLICABLE | `01_PRODUCT_CANON_AND_MODES.md:175` — "the lifecycle is a completeness model, not a forced wizard for every Zlecenie"; `12_CASE_WORKSPACE_MODULE_SSOT.md:181` — "completeness model, not a mandatory wizard"; zero `wizard`/`generator` mentions of any product surface anywhere in `docs/product/case-workspace/*.md`. |
| `TRIADA-KANBAN-01` | NOT_APPLICABLE | `TRIADA_KANON.md:139` — "KANBAN (5 — jeśli ekran ma widok kanban)" [only if the screen has a kanban view]; `02_INFORMATION_ARCHITECTURE_AND_UX.md:51` (row `CW-02-007`) — "desktop uses table plus preview; mobile uses equivalent cards/list rows" (no kanban view named); zero `kanban` mentions anywhere in `docs/product/case-workspace/*.md`. |
| `TRIADA-KANBAN-02` | NOT_APPLICABLE | Same as above. |
| `CW-02-005` | DEFERRED_POST_V1 | Row's own text: "Later, Teresa adds a conversational entry..." — under `02_INFORMATION_ARCHITECTURE_AND_UX.md` §2.2 "Later — Chat" (heading line 41); `00_CASE_WORKSPACE_CANON.md:62` — the workspace "can **later** be embedded beside or inside the main Teresa Chat." |
| `CW-02-006` | DEFERRED_POST_V1 | Entirely under `02_INFORMATION_ARCHITECTURE_AND_UX.md` §2.2 "Later — Chat" (line 47). |
| `CW-02-033` | DEFERRED_POST_V1 | Entirely under `02_INFORMATION_ARCHITECTURE_AND_UX.md` §8 "Teresa and approvals in the **later** Chat surface" (heading line 289, row line 293). |
| `CW-03-004` | DEFERRED_POST_V1 | `03_INTERACTION_RESPONSIVE_ACCESSIBILITY.md:33` constrains a `Chat \| Work` split that only exists once the deferred Chat surface (above) is built. |

Every row I could **not** find a citation for — including several
compound rows that mix one "later" clause with three or four V1-testable
clauses (`CW-01-023`, `CW-02-012`, `CW-03-003`, `CW-03-018`, `CW-03-019`) —
was deliberately left `APPLICABLE_REQUIRED_V1` rather than partially
excluded, since the row as extracted is a single unit and most of its
content is testable today.

## 4. Every `FAIL`, full format

### FAIL 1 — `CW-03-009` (and duplicate content in `CW-RT-031`)

- **Screen:** Case Detail (any case), Plan tab, right panel status pill /
  command banners.
- **Viewport:** all (not size-dependent).
- **Element:** plan-version status pill (e.g. "Plan: Zatwierdzony (wersja
  1)") and the propose/publish command-banner text.
- **Requirement:** `03_INTERACTION_RESPONSIVE_ACCESSIBILITY.md:66` (`CW-03-009`)
  and `04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:228` (`CW-RT-031`) both
  mandate the exact Polish plan-lifecycle labels `Szkic`, `Do przeglądu`,
  `Opublikowany`, `Wycofany`.
- **Severity:** MEDIUM — canon-mandated exact copy is violated on a
  user-visible status label; not a functional break, but `CW-SSOT-7.5-02`
  explicitly requires exact-wording discipline and copy snapshots.
- **Reproduction (live, this packet, 2026-08-12):** logged in
  (`POST /api/auth/login`, `cw.local@local.test`) against the live
  coordinator backend (`127.0.0.1:3001`) and vite (`127.0.0.1:4501`) in an
  isolated tab; navigated to
  `/zlecenia/case-eaccd54e-f4e2-4812-8df9-c597d9f93997?zakladka=plan&widok-planu=prosty`
  (a real `PUBLISHED` plan, per `m1-plan-authoring-ui-2026-08-12/README.md`);
  live screenshot shows the pill reading **"Plan: Zatwierdzony (wersja 1)"**,
  not "Opublikowany". `m1-plan-authoring-ui-2026-08-12/README.md`'s own
  live-evidence transcript additionally quotes the `IN_REVIEW` banner
  verbatim: **"Plan nr 1 ma teraz status: W recenzji."** (canon requires
  "Do przeglądu").
- **Code location:** `src/utils/enumLabels.ts:275-281`,
  `PLAN_VERSION_STATUS_LABELS = {DRAFT:'Szkic', IN_REVIEW:'W recenzji',
  PUBLISHED:'Zatwierdzony', SUPERSEDED:'Zastąpiony', WITHDRAWN:'Wycofany'}`
  — read directly from source, 2026-08-12.
- **Proposed minimal fix:** change the `pl` value for `IN_REVIEW` from
  `'W recenzji'` to `'Do przeglądu'`, and for `PUBLISHED` from `'Zatwierdzony'`
  to `'Opublikowany'`, in that same object. Verify no other UI copy assumes
  the current wording first — action-button verbs ("Publikuj", "Wycofaj
  plan") are separate labels, not state labels, so should be unaffected.

### FAIL 2 — `ARTIFACT-PANEL-SECTIONS`

- **Screen:** Case Detail (any case), any phase tab, right panel accordion.
- **Viewport:** all.
- **Element:** `ArtifactRightPanel` accordion section list.
- **Requirement:** `ARTIFACT_ANATOMY_STANDARD.md:913` — "Right panel
  accordion has 5 sections in fixed order: Actions ... Properties ...
  Relations ... **Comments** ... History/AI."
- **Severity:** LOW-MEDIUM — self-admitted, deliberate deviation, not an
  accidental bug (see caveat below).
- **Reproduction (live, this packet, 2026-08-12):** live screenshot of the
  Case Detail Plan tab's right panel shows exactly 5 sections but not the
  canon's 5: **"AKCJE", "WŁAŚCIWOŚCI", "POWIĄZANIA", "ŹRÓDŁA I ZAŁOŻENIA",
  "HISTORIA"** — Actions/Properties/Relations/[Sources & Assumptions]/History,
  with the mandated "Comments" section entirely absent.
- **Code location:** `src/components/CaseWorkspace/CaseDetailScreen.tsx:1-18`
  (file header) explicitly documents this as deliberate: "prawy panel to
  accordion o stałej kolejności Akcje · Właściwości · Powiązania · Źródła i
  założenia · Historia (**Komentarze jawnie pominięte**)" [Comments
  explicitly omitted]; label text at line 1769.
- **Caveat (why this is flagged, not asserted with full certainty):**
  `ARTIFACT_ANATOMY_STANDARD.md` §13.1's own per-artifact table (lines
  1017-1031) never lists "Comments" as a "key section" for **any** of the 11
  archetype-C instances it documents (Task, Decision, KPI, Insight, Idea,
  RAID, Milestone, Change Request, Stage Gate, Action Proposal, Initiative)
  — suggesting "Comments" may function as a template slot many archetype-C
  screens legitimately omit, which would make this not a real defect. No
  owner-decision in `11_OWNER_DECISION_REGISTER.md` explicitly authorizes
  the substitution, which is why this is recorded FAIL rather than silently
  reclassified `NOT_APPLICABLE` — the repair/adjudication wave should settle
  whether §11.2's "fixed order" is a hard literal MUST or a default
  template.
- **Proposed minimal fix (if confirmed a real defect):** either add a
  genuine (even empty-state/read-only) Comments section in position 4,
  keeping "Źródła i założenia" as a 6th section, or obtain and cite an
  explicit owner-decision authorizing the substitution.

## 5. Surfaces with NO evidence at all — need a live sweep

- **Plan Ekspercki and Plan Lista** projections — every piece of live
  evidence found (E5, L3, M1, F1-F3) exercises Plan **Prosty** only.
  `CW-02-015`/`CW-02-016` (three synchronized views, same graph digest) is
  entirely unverified.
- **Attention / "Wymaga uwagi"** as a cross-Case My Work projection — no
  evidence directory addresses it directly (M2 covers per-Case proposal
  approvals inside Realizacja, not the shared My Work attention queue named
  in `CW-02-004`/`12_CASE_WORKSPACE_MODULE_SSOT.md` §12).
- **Waits** (`CW-02-024` "Realizacja... active or waiting step", the
  `Czeka na Ciebie/zespół/system` state family, `06.5` long-running human
  steps) — no live evidence found producing and rendering a
  `WAITING_HUMAN`/`WAITING_TIMER`/`WAITING_EVENT` state in the UI.
- **Mobile (<768px) Zlecenia index as single-column list-card** — F3/C4
  captured mobile screenshots of table-based tabs (Realizacja/Rezultaty
  tables scrolling horizontally), but the specific "below 768px becomes a
  single-column shared list-card projection" claim (`CW-SSOT-16-02`) for
  the **list** screen itself was not found reproduced anywhere.
- **200% zoom** — named as a mandatory acceptance condition
  (`CW-DOD-H2`, `CW-SSOT-7.5-02`) with no evidence directory addressing it.
- **VoiceOver/NVDA** — explicitly named as not attempted in every a11y
  evidence directory read (E5, F1, L3) for the same stated reason (real
  macOS Accessibility setting change, out of bounds for an unattended
  session).
- **Saved views** (`Wymaga mojej uwagi`, `Moje aktywne`, `Zespół`, `Szkice`,
  `Zaplanowane`, `Zakończone` — `CW-02-010`) — no evidence found exercising
  any of the six.
- **Kebab / right-click context menu parity** on the Zlecenia list rows —
  the MYWORK-KEBAB-*/MYWORK-CONTEXTMENU rows have no case-workspace-specific
  live evidence (only the general My Work contract they're extracted from).

## 6. What I could not verify, and corrections made within this pass

- Could not verify: the 212 `APPLICABLE_REQUIRED_V1` rows without
  `PASS_WITH_EVIDENCE`/`FAIL` — see §2, §5.
- Could not resolve with full confidence: whether `ARTIFACT-PANEL-SECTIONS`'
  Comments omission is a real defect or accepted per-archetype variation —
  recorded as FAIL with the caveat spelled out (§4), not silently dropped.
- Paraphrase-level (non-exact-text) duplicate detection across the 235 rows
  was not attempted, consistent with the same limitation
  `acceptance/SCOPE_ADJUDICATION.md` §2.1 already documents for the sibling
  ledgers as "not a single-session task."
- **Self-correction within this pass:** this packet's own first classification
  pass marked `CW-RT-031` `APPLICABLE_REQUIRED_V1` even though it had
  already live-verified the identical label-mismatch defect for the
  sibling row `CW-03-009` in the same session. Caught before finishing this
  report; fixed via an append-only correction row `CW-RT-031-M4b`
  (`supersedes_row_id: CW-RT-031-M4`) rather than editing the first row in
  place, per the ledger's own hard rule.

## Files

- This README.
- The 236 net-new rows themselves are the primary evidence artifact —
  `docs/product/case-workspace/acceptance/VISUAL_TRIADA_SPEC_A_LEDGER.csv`,
  all suffixed `-M4`/`-U2`/`-M4b`, each with `supersedes_row_id` pointing at
  the row it succeeds, `candidate_sha: PENDING-CANDIDATE-SHA` throughout (no
  candidate SHA was stamped, per the hard rules).
