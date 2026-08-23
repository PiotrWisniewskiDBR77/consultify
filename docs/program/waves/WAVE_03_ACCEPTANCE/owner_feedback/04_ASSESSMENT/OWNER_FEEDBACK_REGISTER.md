# Assessment — owner feedback register

Intake date: `2026-08-23`

Intake status: `OWNER_REVIEW_IN_PROGRESS / CAPTURED_UNRECONCILED`

This register preserves Piotr's Assessment owner-review observations. It does
not prove implementation, testing or owner acceptance.

## ASM-OWN-001 — Make Library a pure methodology library with readable knowledge

- Route observed: `/assessment/overview?tab=library`
- Product SHA: `ca9ef20646584f4b41bd5732eda3eca993ba0b73`
- Persona: local seeded `OWNER`
- Evidence: `ASM-EVD-001`
- Classification: `REBUILD_INFORMATION_ARCHITECTURE / CONTENT_REQUIRED`
- Priority: `P0`
- Status: `BOUNDED_REMEDIATION_PARTIAL / OWNER_RETEST_REQUIRED`

### Piotr's original wording

> Dobrze, to ma być biblioteka. Tak jak mamy w toolsach biblioteki, to tutaj ma
> być tylko biblioteka. Czyli z tego poziomu otwieramy, powinniśmy być w stanie
> przeczytać o tym narzędziu. W tym momencie w ogóle nie ma informacji tego
> typu, więc jakby ten ekran dzisiaj nie spełnił swojego obowiązku w ogóle.
>
> Ale tak co do zasady, to tu po prostu będzie tylko lista narzędzi z warunkami
> oglądania ich.

### Owner-explicit requirements

1. `Library` is only the Assessment methodology/tool library.
2. The library lists available Assessment methodologies/tools and their
   applicable availability/viewing conditions.
3. Opening an item from this level must allow the user to read substantive
   information about that methodology/tool.
4. The current surface fails its core Library purpose because it exposes no
   such readable methodology information.
5. Running/canonical sessions do not belong inside the Library screen.

### Current observed behavior

- The screen lists five methodology names and a minimal status/action.
- DRD exposes `Uruchom`; four other methods show `Wkrótce`.
- No methodology knowledge, purpose, use/not-use guidance, process, expected
  outputs or eligibility information is available from the visible Library
  surface.
- A second section, `Twoje kanoniczne sesje DRD`, mixes two operational session
  records into the Library screen and exposes raw UUIDs, method-pack versions
  and English lifecycle values.

### Interpreted target experience

Use the accepted Tools Library pattern as the product reference: a clean catalog
of methodologies with a route to a complete readable knowledge/tool document.
Keep process/session records in the dedicated `Processes` area. The target
knowledge contract should be reconciled during the module summary rather than
invented during intake.

### Atomic acceptance criteria

| ID               | Criterion                                                                                                                                   | Intake result          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `ASM-LIB-AC-001` | Library contains methodology/tool catalog content only; no session/process table is rendered in this tab.                                   | `PASS_LOCAL_BROWSER`   |
| `ASM-LIB-AC-002` | Every visible methodology communicates its truthful availability or viewing condition.                                                      | `PASS_LOCAL_BROWSER`   |
| `ASM-LIB-AC-003` | Opening a visible methodology leads to a substantive readable knowledge/tool preview.                                                       | `PASS_LOCAL_BROWSER`   |
| `ASM-LIB-AC-004` | The detail explains purpose, applicability, method/process and expected outputs without raw implementation diagnostics in the default view. | `PARTIAL_BROWSER_PASS` |
| `ASM-LIB-AC-005` | Sessions/processes are reachable from their dedicated module area and are not duplicated in Library.                                        | `PARTIAL_NO_DUPLICATE` |
| `ASM-LIB-AC-006` | Final Library and methodology detail receive explicit Piotr owner retest.                                                                   | `OWNER_GATE_REQUIRED`  |

### Open questions retained for module synthesis

- Exact meaning and presentation of each methodology's "warunki oglądania".
- Whether unavailable methodologies remain visible with an explanation or are
  hidden based on entitlement/readiness.
- Exact Assessment knowledge-document anatomy and which parts can reuse the
  accepted Tools knowledge-document pattern.

### Bounded remediation evidence — 2026-08-23

The complete canonical-session section, its UUID/version/state table and its
Library-side session fetch were removed. Local browser readback now exposes one
catalog table with five truthful methodology rows: DRD as `Method Core` with
`Start`, and four disabled `Coming soon` rows. No canonical-session heading,
UUID or second table is present. The canonical create/readback path behind the
DRD `Start` action remains intact and retains its idempotency-key guard.

Methodology knowledge documents, final catalog metadata and owner acceptance
remain open; this bounded correction does not claim the whole Library target.

The next bounded correction adds a canonical docked Preview for every catalog
row, including unavailable frameworks. The Preview uses the existing framework
registry for descriptions and legal notices, exposes area, access condition and
expected outcomes, and never enables Start for a coming-soon method. A new Area
column is visible in the Library. Because no authoritative commercial model is
connected, the Preview says `Commercial terms: Not configured in catalog`
instead of inventing paid/free status. Focused Library tests pass `6/6`, root
typecheck passes, and local browser readback of the SIRI row passes. A full
knowledge-document route, final bilingual content and owner-approved commercial
vocabulary remain open.

## ASM-OWN-002 — Enrich the catalog and create every assessment as a Process

- Route observed: `/assessment/overview?tab=library`
- Product SHA: `ca9ef20646584f4b41bd5732eda3eca993ba0b73`
- Persona: local seeded `OWNER`
- Evidence: `ASM-EVD-002`
- Classification: `REBUILD_CATALOG_AND_START_FLOW`
- Priority: `P0`
- Status: `BOUNDED_REMEDIATION_PARTIAL / OWNER_RETEST_REQUIRED`

### Piotr's original wording

> Byłem dołożył tutaj trochę kolumn, bo mamy tylko status działań. Bym jeszcze
> zaproponuj tutaj, żebyśmy mieli na przykład jakiego obszaru one mają dotyczyć,
> czy jest ona płatna, czy jest niepłatna. Może jakieś takie rzeczy tutaj
> dołóżmy. Natomiast wszystko, co jest poniżej Twoje kanoniczne sesje, to się tu
> nie powinno zdarzyć, bo to będzie w ramach procesów, które będą się realizowały.
> Tak samo jak w Toolsach.
>
> W pierwszej zakładce mamy bibliotekę i stąd powinniśmy mieć przycisk Start albo
> Assessment. W przycisk Assessment, wtedy wybieramy z listy, który chcemy
> assessment zacząć robić, albo wybieramy tu przyciskiem Start i wtedy zaczyna
> się tworzyć kolejne narzędzie.
>
> I ono wtedy w czasie tworzenia wchodzi już do Processes, czyli procesy audytowe
> czy assessmentowe. Czyli cała ta tabela tutaj Twojej kanonicznej sesji jest
> niepotrzebna w ogóle.

Minor transcription normalization (`kolumn`, `Toolsach`, `zakładce`) is shown
above only where the intended word is unambiguous; the supplied audio-text
meaning is otherwise preserved.

### Owner-explicit requirements

1. Expand the Library table beyond the current methodology/status/action shape.
2. Include useful catalog metadata such as the business/domain area addressed
   by the assessment and whether it is paid or free.
3. Remove the complete `Twoje kanoniczne sesje DRD` section from Library.
4. Follow the Tools operating-model separation: Library selects/starts a method;
   active instances live under `Processes`.
5. Starting an assessment creates a new assessment/audit process and that new
   instance becomes visible in `Processes`.
6. Support a clear start path either from a selected Library row or from one
   global Assessment-start action that first asks the user to choose a method.

### Current observed behavior

- The catalog exposes only `Metodyka`, `Status` and `Działania`.
- It provides no area/domain, commercial-access or other selection metadata.
- The same Library page contains the two canonical DRD session rows.
- The visible `Uruchom` action does not communicate the complete create →
  Process-registration contract.

### Interpreted target flow

`Library methodology selection → Start/create assessment → new durable process
record → Processes list/detail`.

The same creation capability may be reachable through two entry points, but both
must use one canonical creator and create the same process object. The exact
global CTA label and whether both entry points remain are owner decisions, not
settled by this intake note.

### Candidate catalog fields for later reconciliation

These are a starting inventory derived from Piotr's explicit examples, not a
final approved table schema:

- methodology/tool name;
- addressed business/domain area;
- availability/status;
- paid/free or applicable commercial-access condition;
- primary `Start` action and access to methodology knowledge.

### Atomic acceptance criteria

| ID                 | Criterion                                                                                                                        | Intake result         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `ASM-START-AC-001` | Library catalog exposes owner-approved selection metadata, including area/domain and commercial-access condition.                | `PARTIAL_AREA_ONLY`   |
| `ASM-START-AC-002` | No canonical/running session table or session UUID is rendered in Library.                                                       | `PASS_LOCAL_BROWSER`  |
| `ASM-START-AC-003` | A row-level start path and any global start path invoke one canonical creator with no divergent semantics.                       | `PARTIAL_ROW_PATH`    |
| `ASM-START-AC-004` | Starting an assessment creates exactly one durable process with selected methodology/version, owner and initial lifecycle state. | `PASS_LOCAL_FIXTURE`  |
| `ASM-START-AC-005` | The created process appears immediately in `Processes` and remains after refresh/cold login.                                     | `PARTIAL_REFRESH_PASS`|
| `ASM-START-AC-006` | Failed, cancelled or duplicate starts do not fabricate or duplicate a Process and preserve recoverable user input.               | `PARTIAL_UNIT_ONLY`   |
| `ASM-START-AC-007` | Piotr explicitly accepts the final Library columns, CTA naming and create-to-Processes transition.                               | `OWNER_GATE_REQUIRED` |

Local evidence captured on 2026-08-23: the Library row action for DRD used the
Method Core creator and produced session
`8a4eae44-509c-4076-a483-159e782d5393` (`v1`, `draft`, `0/39`, owner
`Assessment Fixture`). The editor opened from the returned identifier, Exit
returned to `Processes`, and a full page reload retained exactly one matching
row. This proves the row-level local-fixture path and refresh readback only. A
global creator comparison, cold-login readback, cancellation and failed-request
recovery remain unproven.

### Open decisions retained for module synthesis

- Final Library columns and their order.
- Exact commercial vocabulary and source of truth for paid/free/entitlement.
- Final global CTA name: `Start`, `Assessment`, `New assessment` or another
  owner-approved label.
- Whether both row-level and global entry points remain visible.
- Exact initial Process lifecycle state and whether creation needs a guided
  creator before the record becomes visible.

## ASM-OWN-003 — Reject the current frozen canonical-session surface

- Route observed: `/assessment/drd/23aaf18e-19f3-4067-ae91-204495b642e5`
- Product SHA: `ca9ef20646584f4b41bd5732eda3eca993ba0b73`
- Persona: local seeded `OWNER`
- Evidence: `ASM-EVD-003`
- Classification: `REBUILD_FROM_USER_JOB / CURRENT_SURFACE_REJECTED`
- Priority: `P0`
- Owner verdict: `NOT_USEFUL`
- Status: `CAPTURED_UNRECONCILED / NOT_ACCEPTED`

### Piotr's original wording

> Wszedłem w te kanoniczne coś. Nie wiem, po co to zostało stworzone. Nie wiem,
> jaki jest tego cel. Ta karta do niczego nie jest podobna ani nie ma żadnego
> sensu.
>
> To jest moje stwierdzenie najprostsze. W mojej ocenie nie jest w ogóle
> przydatna do niczego.

The source transcription around "kanoniczne coś" and "karta" is not treated as
a precise product noun. The unambiguous owner decision is rejection of the
entire observed surface and its usefulness.

### Owner-explicit verdict

1. The observed frozen canonical-session screen has no understandable purpose.
2. Its information and interaction model does not resemble a useful product
   surface known to the owner.
3. The owner finds the screen entirely unusable and does not accept it as a
   direction to preserve.
4. The surface requires reconstruction from the intended user job and business
   outcome, not visual polishing of the current composition.

### Current observed behavior

The default user surface exposes an internal technical proof composition:

- `Sesja 23aaf18e — Zamrożona` and a `SERVER` badge;
- `AssessmentOutput (immutable, v1)`, a truncated content hash, raw session UUID
  and method-pack version;
- implementation-oriented limitation text naming event-store,
  `EventDerivedOutputBridge`, vertical-slice demo, deterministic templates,
  aggregation rules and client-side calculation;
- a two-row unit/current/target/gap table with raw `1A`/`1B` identifiers;
- generated findings using event-store/evidence terminology;
- an empty `Report Snapshot` block;
- a local, explicitly unregistered Initiative Proposal Draft;
- a disabled reopen area that explains missing HTTP/server endpoints.

These details may serve engineering evidence, but they do not explain the
assessment result, business meaning, decision, next action or value to the
normal user.

### Required reconstruction boundary

Do not use this screen as the visual or information-architecture baseline.
Before replacement design, define:

- who opens a completed/frozen assessment and why;
- the primary decision or action the screen supports;
- which result, maturity, gaps, findings and recommendations are business-facing;
- how evidence, method/version and auditability remain available without
  dominating the default view;
- relationship to the separate canonical `Outputs`, `Reports` and `Initiatives`
  areas;
- whether a completed Process should route to a result workspace, an Output
  detail or another owner-approved object.

### Atomic acceptance criteria

| ID                  | Criterion                                                                                                                                        | Intake result             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `ASM-FROZEN-AC-001` | A new owner-approved user job and purpose are documented before rebuilding this surface.                                                         | `OWNER_DECISION_REQUIRED` |
| `ASM-FROZEN-AC-002` | The replacement leads with business result, meaning, gaps/findings and legitimate next action rather than engineering diagnostics.               | `NOT_TESTED`              |
| `ASM-FROZEN-AC-003` | Raw UUIDs, hashes, server badges, implementation class names and endpoint limitations are absent from the default user view.                     | `NOT_TESTED`              |
| `ASM-FROZEN-AC-004` | Required provenance, version and evidence remain accessible through a subordinate details/audit treatment.                                       | `NOT_TESTED`              |
| `ASM-FROZEN-AC-005` | Output, Report and Initiative actions follow their canonical object lifecycles and never expose local/unregistered pseudo-success as completion. | `NOT_TESTED`              |
| `ASM-FROZEN-AC-006` | Piotr reviews a prototype of the replacement before this screen is treated as an accepted reusable pattern.                                      | `OWNER_GATE_REQUIRED`     |

## ASM-OWN-004 — Keep the observed Processes table and menus

- Route observed: `/assessment/overview?tab=processes`
- Product SHA: `ca9ef20646584f4b41bd5732eda3eca993ba0b73`
- Persona: local seeded `OWNER`
- Evidence: `ASM-EVD-004`
- Classification: `KEEP_OWNER_APPROVED_VISUAL_PATTERN`
- Priority: `PRESERVE`
- Owner verdict: `APPROVED_AS_OBSERVED`
- Status: `OWNER_APPROVED_VISUAL / FUNCTIONAL_BEHAVIOR_NOT_VERIFIED`

### Piotr's original wording

> Dobrze, teraz tabela i menu tutaj oraz menu rozwijane zatwierdzone.

### Owner-explicit verdict

1. Preserve the observed Processes table as the accepted visual direction.
2. Preserve the observed menu and dropdown-menu treatment.
3. The separate Preview defect must not invalidate or trigger an unnecessary
   redesign of the accepted table and menu pattern.

### Evidence boundary

This approval applies to the visible composition in the supplied screenshot.
It does not yet prove sorting, filtering, dropdown actions, keyboard behavior,
responsive behavior, persistence or backend correctness.

### Atomic acceptance criteria

| ID                        | Criterion                                                                                                                             | Intake result                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `ASM-PROCESS-LIST-AC-001` | The accepted Processes table composition is preserved during Preview remediation.                                                     | `OWNER_APPROVED_AS_OBSERVED` |
| `ASM-PROCESS-LIST-AC-002` | The accepted menu and dropdown-menu visual treatment is preserved.                                                                    | `OWNER_APPROVED_AS_OBSERVED` |
| `ASM-PROCESS-LIST-AC-003` | Sorting, filters and dropdown actions are verified separately without converting visual approval into unproven functional acceptance. | `NOT_TESTED`                 |

## ASM-OWN-005 — Make Process Preview follow the canonical full-height card pattern

- Route observed: `/assessment/overview?tab=processes`
- Product SHA: `ca9ef20646584f4b41bd5732eda3eca993ba0b73`
- Persona: local seeded `OWNER`
- Evidence: `ASM-EVD-005`
- Classification: `FIX_PREVIEW_LAYOUT_STANDARD`
- Priority: `P1`
- Owner verdict: `NOT_APPROVED`
- Status: `TECHNICAL_BROWSER_PASS / OWNER_RETEST_REQUIRED`

### Piotr's original wording

> Natomiast niestety nie zatwierdzone. Zobacz to, preview jest niezgodny swoją
> wielkością z kartami preview, które mamy ustalone. Karta preview jest od góry
> do dołu ekranu, to znaczy od menu trzeciego do dołu ekranu.
>
> To jest wzór, ta karta nie spełnia wzorca.

### Owner-explicit verdict

1. The current Process Preview card is rejected because its vertical size does
   not follow the established Preview-card standard.
2. The canonical Preview occupies the vertical workspace from the lower edge
   of the third-level menu to the bottom of the viewport.
3. The observed short floating panel, which ends substantially above the
   viewport bottom, does not satisfy that pattern.

### Required correction

- Keep the accepted Processes table and navigation treatment.
- Anchor the Preview workspace immediately below the third-level menu.
- Extend it to the bottom edge of the usable viewport.
- Keep Preview content scrolling inside the full-height panel when content
  exceeds the available height; avoid turning the whole page into a competing
  second vertical scroll surface.
- Retain a coherent table/Preview split at supported viewport sizes.

### Atomic acceptance criteria

| ID                   | Criterion                                                                                                                         | Intake result         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `ASM-PREVIEW-AC-001` | The Preview top edge starts at the established content boundary directly below the third-level menu.                              | `PASS_LOCAL_BROWSER`  |
| `ASM-PREVIEW-AC-002` | The Preview bottom edge reaches the bottom of the usable viewport with no arbitrary empty gap.                                    | `PASS_LOCAL_BROWSER`  |
| `ASM-PREVIEW-AC-003` | Overflowing Preview content scrolls within the panel while its header and close/open controls remain usable.                      | `NOT_TESTED`          |
| `ASM-PREVIEW-AC-004` | Opening and closing Preview preserves the owner-approved Processes table and menu pattern.                                        | `PASS_LOCAL_BROWSER`  |
| `ASM-PREVIEW-AC-005` | The full-height rule remains valid at supported viewport sizes and does not create clipped controls or competing page scrollbars. | `PARTIAL_1280x720`    |
| `ASM-PREVIEW-AC-006` | Piotr explicitly accepts the corrected Preview against the established cross-module pattern.                                      | `OWNER_GATE_REQUIRED` |

### Remediation evidence — 2026-08-23

The root cause was a broken explicit-height chain inside the block-level
content host rendered by `StandardModuleBar`. The nested wrapper used
`flex-1`, although its direct parent was not a flex container, so its height
followed content instead of the usable viewport. The wrapper now uses
`h-full min-h-0 overflow-hidden`.

Local browser readback at `1280x720` after the correction measured the table
and Preview flex row from `y=153` to `y=720`; the Preview aside had the same
`567px` height and no bottom gap. Before the correction, the same aside was
`709px` high and ended at `y=862`, outside its `567px` visible host. The
Processes table, menus and selection behavior remained mounted. Structural
regression coverage is recorded in
`tests/components/assessment/AssessmentHub.previewHeight.ownerFeedback.test.tsx`.

This is a technical local pass, not owner acceptance. Overflow behavior and
the complete supported-viewport matrix remain open.

## ASM-OWN-006 — Standardize the downstream chain as Insights, Reports and Initiatives

- Routes observed: `/assessment/overview?tab=outputs`,
  `/assessment/overview?tab=reports`, `/assessment/overview?tab=initiatives`
- Product SHA: `ca9ef20646584f4b41bd5732eda3eca993ba0b73`
- Persona: local seeded `OWNER`
- Evidence: `ASM-EVD-006`, `ASM-EVD-007`, `ASM-EVD-008`
- Classification: `REUSE_CROSS_MODULE_STANDARD / RENAME_AND_CONNECT_LIFECYCLE`
- Priority: `P0`
- Owner verdict: `REQUIRED_STANDARD`
- Status: `CAPTURED_UNRECONCILED / CONTENT_AND_BEHAVIOR_NOT_ASSESSABLE`

### Piotr's original wording

> Tutaj będzie następująca zmiana. Słowo output zmieniamy na insights. Pozostają
> raporty i inicjatywy. Role tych trzech kart jest identyczna jak mieliśmy w
> toolsach.
>
> Czyli to musi być w ogóle spójne. W trzech miejscach albo w czterech miejscach
> będziemy mieli dokładnie trzy karty identyczne. Insights, reports i
> initiatives. Działając dokładnie tak samo, więc nie musimy tutaj tego
> raportować.
>
> Jak ma to działać? Na bazie zrealizowanych raportów z asesmentów będziemy
> budowali inputy przez kreator. Na bazie asesmentów i inputów będziemy tworzyli
> raporty kreatorem raportów i na bazie tego wszystkiego będą powstawały
> inicjatywy. Dokładnie tak jak w każdym innym toolu. Tutaj nie mam żadnych
> danych, więc nie mogę tego ocenić, ale dokładnie te tabele muszą być identyczne
> jak wszędzie. O pozostałych narzędziach te same funkcje.

The phrase transcribed as "inputy" is interpreted as referring to the newly
named `Insights`, because the owner explicitly defines the three-card chain as
`Insights`, `Reports`, `Initiatives`. This interpretation must be reconciled
against the canonical Tools contract before implementation.

### Owner-explicit product contract

1. Rename the user-facing `Outputs` area to `Insights`.
2. The canonical downstream trio is `Insights`, `Reports`, `Initiatives`.
3. Assessment must reuse the same table structures, creators, lifecycle
   behavior and user interactions already established for this trio in Tools
   and every other applicable module; Assessment must not invent local variants.
4. Completed assessments provide source material from which the user creates
   Insights through a creator.
5. Assessment results and selected Insights provide source material for Reports
   created through the Report Creator.
6. Initiatives are then created from the relevant Assessment, Insights and
   Reports context according to the same canonical lifecycle used elsewhere.

### Current observed behavior and evidence limit

- `Outputs` still uses the obsolete label and currently renders
  `Assessment not found` despite being entered as a top-level module tab.
- Reports and Initiatives show zero-data tables and empty states.
- The supplied state contains no records with which to evaluate list rows,
  preview cards, creators, lineage, transitions or persistence.
- Consequently none of those behaviors is accepted or rejected from these
  screenshots. Their required target is the already established cross-module
  standard, subject to a populated-data retest.

### Reuse and implementation boundary

- Identify one canonical implementation/contract for the trio instead of
  copying divergent Assessment-specific tables.
- Keep labels, columns, filters, statuses, preview behavior, creators, source
  selection, permissions and lifecycle semantics aligned across all applicable
  modules.
- Preserve source lineage: every Insight identifies its Assessment source;
  every Report identifies the Assessment and Insights used; every Initiative
  identifies the upstream source set from which it was proposed.
- Empty states must describe the correct prerequisite and route the user to a
  valid next step. They must not claim "no assessments" when eligible
  assessments exist or surface a generic `Assessment not found` error for a
  valid tab.

### Atomic acceptance criteria

| ID                      | Criterion                                                                                                                                                                | Intake result         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `ASM-DOWNSTREAM-AC-001` | Every user-facing Assessment occurrence of `Outputs` in this downstream role is renamed to `Insights`, including navigation, headings, actions and empty states.         | `NOT_TESTED`          |
| `ASM-DOWNSTREAM-AC-002` | Insights, Reports and Initiatives use the canonical cross-module tables, filters, statuses, menus and full-height Preview behavior rather than Assessment-only variants. | `NOT_TESTED`          |
| `ASM-DOWNSTREAM-AC-003` | An eligible completed Assessment can create an Insight through the canonical creator and the durable Insight appears after refresh.                                      | `NOT_TESTED`          |
| `ASM-DOWNSTREAM-AC-004` | The Report Creator can use the Assessment and selected Insights as traceable inputs and creates exactly one durable Report.                                              | `NOT_TESTED`          |
| `ASM-DOWNSTREAM-AC-005` | The Initiative creator can use the relevant Assessment, Insights and Reports context and preserves traceable source relations.                                           | `NOT_TESTED`          |
| `ASM-DOWNSTREAM-AC-006` | Assessment and the other applicable modules exhibit the same function, terminology and interaction contract for all three areas.                                         | `NOT_TESTED`          |
| `ASM-DOWNSTREAM-AC-007` | Valid tabs do not render `Assessment not found`, and empty states reflect actual prerequisite availability.                                                              | `NOT_TESTED`          |
| `ASM-DOWNSTREAM-AC-008` | Populated seeded fixtures cover at least one full Assessment to Insight to Report to Initiative flow for owner review.                                                   | `EVIDENCE_MISSING`    |
| `ASM-DOWNSTREAM-AC-009` | Piotr accepts the populated tables, creators and end-to-end lineage after the shared implementation is available.                                                        | `OWNER_GATE_REQUIRED` |

## ASM-OWN-007 — Restore the backend-connected Assessment tool as the primary session surface

- Frozen route observed: `/assessment/drd/23aaf18e-19f3-4067-ae91-204495b642e5`
- Active route verified: `/assessment/drd/ec7dfcca-537d-4342-b322-36c01b2e4196`
- Product SHA: `ca9ef20646584f4b41bd5732eda3eca993ba0b73`
- Persona: local seeded `OWNER`
- Evidence: `ASM-EVD-009`
- Classification: `P0_LIFECYCLE_ROUTING_REGRESSION / RESTORE_EXISTING_TOOL`
- Priority: `P0`
- Owner verdict: `BACKEND_CONNECTED_TOOL_REQUIRED_NOW`
- Status: `ROOT_CAUSE_CONFIRMED / ACTIVE_TOOL_OPEN_FOR_OWNER_REVIEW / FROZEN_ROUTE_NOT_FIXED`

### Piotr's original wording

> Teraz dojeżdżamy do miejsca dramatycznego. Mam taką kartę zamiast
> wybudowanego narzędzia asesmentu. Ja wiem, że ono jest w backendzie. My nad tą
> kartą siedzimy od bardzo dawna.
>
> Ona miała co najmniej ze trzy wersje, z czego ze dwie były naprawdę dobre.
> Potrzebuję mieć podłączoną tą kartę backendowo, wtedy mogę ją ocenić. Najlepiej
> jakbyś to zrobił teraz.

### Live diagnosis and immediate recovery

The owner was viewing a `frozen` method-core session. The current frontend
replaces the Assessment workspace for that lifecycle state with a technical
`AssessmentOutput` surface.

The existing backend-connected Assessment tool was then verified live by
opening the active canonical session `ec7dfcca-537d-4342-b322-36c01b2e4196`.
It rendered server-confirmed data and the real DRD workspace, including:

- seven DRD axes and 39 assessment units;
- Interview, Split and Matrix modes;
- assessment questions, answer states and evidence controls;
- Teresa collaboration panel;
- server save state and method version;
- review/freeze lifecycle actions.

This proves that the built tool and backend connection still exist. It does
not resolve the frozen-session routing regression or constitute owner
acceptance of the active workspace design.

### Required correction

1. The backend-connected Assessment workspace remains the primary product
   surface throughout the session lifecycle.
2. Freezing must not replace the entire tool with an engineering diagnostics
   page.
3. A frozen assessment must retain an intelligible read-only workspace and
   provide user-facing access to Insights, Reports and Initiatives through the
   canonical downstream contract.
4. Technical hashes, event-store diagnostics and implementation limitations
   belong in subordinate audit/developer details, not in the primary route.
5. Preserve the prior owner-valued Assessment design work; reconcile earlier
   good versions before visual reconstruction rather than rebuilding blindly.

### Atomic acceptance criteria

| ID                | Criterion                                                                                                                                            | Intake result                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `ASM-TOOL-AC-001` | Opening an active canonical DRD session renders the backend-connected Assessment workspace with server-confirmed data.                               | `LIVE_VERIFIED / OWNER_REVIEW_PENDING` |
| `ASM-TOOL-AC-002` | Opening a frozen DRD session retains a useful read-only Assessment workspace instead of replacing it with the technical output surface.              | `FAILED_AS_OBSERVED`                   |
| `ASM-TOOL-AC-003` | Active and frozen routes preserve the same core information architecture, with lifecycle-appropriate actions and editability.                        | `NOT_TESTED`                           |
| `ASM-TOOL-AC-004` | Insights, Reports and Initiatives are accessible through the canonical downstream lifecycle without exposing engineering diagnostics as the default. | `NOT_TESTED`                           |
| `ASM-TOOL-AC-005` | Earlier owner-valued Assessment variants are compared and the chosen visual baseline is explicitly recorded before substantial redesign.             | `EVIDENCE_REQUIRED`                    |
| `ASM-TOOL-AC-006` | Piotr completes visual and product review against a populated backend-connected session.                                                             | `OWNER_REVIEW_IN_PROGRESS`             |

## ASM-OWN-008 — Reject the active DRD workspace as cognitively impenetrable

- Route observed: `/assessment/drd/ec7dfcca-537d-4342-b322-36c01b2e4196`
- Product SHA: `ca9ef20646584f4b41bd5732eda3eca993ba0b73`
- Persona: local seeded `OWNER`
- Evidence: `ASM-EVD-010`
- Classification: `REBUILD_INTERACTION_ARCHITECTURE / PRESERVE_CURRENT_VISUAL_LANGUAGE`
- Priority: `P0`
- Owner verdict: `NOT_USABLE`
- Status: `CAPTURED_UNRECONCILED / NOT_ACCEPTED`

### Piotr's original wording

> To jest w ogóle dramat, nie? To, co tutaj mamy, jest jakimś mega ciężkim
> dramatem. Nikt normalny nie przebije się przez taką tabelę. Chociaż może
> wygląda bardziej profesjonalnie niż moja.

### Owner-explicit verdict

1. A normal user will not be able to work through the current surface.
2. The current composition is rejected as excessively heavy and cognitively
   impenetrable.
3. The current implementation's typography, frames, visual lightness and
   overall graphic language are explicitly better than the owner's older,
   heavier design and should be preserved.
4. The response must address task architecture and progressive disclosure, not
   merely polish typography, spacing or borders.

### Current observed overload

The viewport simultaneously exposes:

- environment, canonical-session ID, method version and server-source chrome;
- seven top-level axes;
- a long permanently expanded navigator containing nearly all 39 units;
- multiple full question cards at once, each repeating explanatory content,
  answer text area, six answer-state controls, evidence upload and evidence
  strength;
- a persistent Teresa panel containing context and next-step information;
- Interview/Split/Matrix modes, save actions and lifecycle controls;
- a bottom Graphic Mirror/status/action area.

The result gives several navigation systems and several competing focal points
equal visual priority. The user is asked to understand the whole methodology
and the current question simultaneously rather than being guided through one
clear next action.

### Reconstruction direction to validate with further owner input

- Lead with one current unit/question and one obvious completion action.
- Reveal methodology structure, evidence detail, Teresa context, matrix and
  governance progressively when they are needed.
- Replace the always-expanded 39-unit navigator with a comprehensible progress
  and navigation model.
- Avoid repeating the complete answer/evidence apparatus for multiple questions
  in the same viewport unless owner testing proves that batch entry is needed.
- Preserve the owner-approved current typography, frames, visual lightness and
  overall graphic language independently from the rejected density and
  interaction architecture.

### Atomic acceptance criteria

| ID                     | Criterion                                                                                                                                          | Intake result              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `ASM-USABILITY-AC-001` | The default workspace presents one unmistakable current task and one primary next action.                                                          | `NOT_TESTED`               |
| `ASM-USABILITY-AC-002` | A user can understand current position and overall progress without scanning an always-expanded 39-unit tree.                                      | `NOT_TESTED`               |
| `ASM-USABILITY-AC-003` | Secondary methodology, evidence, Teresa, Matrix and governance information uses progressive disclosure and does not compete with the primary task. | `NOT_TESTED`               |
| `ASM-USABILITY-AC-004` | Repeated question controls do not create a multi-screen wall of identical fields in the default view.                                              | `NOT_TESTED`               |
| `ASM-USABILITY-AC-005` | The current typography, frames, visual lightness and overall graphic language are retained without retaining the rejected Interview density.       | `OWNER_APPROVED_DIRECTION` |
| `ASM-USABILITY-AC-006` | A representative first-time user can complete the next assessment step without explanation from the product team.                                  | `NOT_TESTED`               |
| `ASM-USABILITY-AC-007` | Piotr reviews and accepts the simplified interaction architecture before detailed visual polishing.                                                | `OWNER_GATE_REQUIRED`      |

## ASM-OWN-009 — Reframe the Assessment workspace around four task-specific modes

- Current route discussed: `/assessment/drd/ec7dfcca-537d-4342-b322-36c01b2e4196`
- Reference evidence: `ASM-EVD-011`, `ASM-EVD-012`, `ASM-EVD-013`, `ASM-EVD-014`
- Reference runtime visible in screenshots: historical/demo build
  `DEMO @f3237e942304`; not the currently verified SHA
- Classification: `TARGET_INTERACTION_ARCHITECTURE / WORKSHOP_REQUIRED`
- Priority: `P0`
- Owner verdict: `DIRECTIONALLY_APPROVED_CONCEPT`
- Status: `CAPTURED_UNRECONCILED / WORKSHOP_AND_PROTOTYPE_REQUIRED`

### Piotr's original wording

> Myśl optymistyczna jest taka, że rzeczywiście ten rozkład i układ graficzny
> jest pewnie lepszy od tego, co ja mam. Mam za to kilka dużych uwag do
> wdrożenia i myślę, że posunie nas to mega do przodu. Myślę, że tu idealnie
> byłoby, gdybyśmy zrobili jakiś workshop na ten temat.
>
> Potrzebujemy formularz odpowiedzi, potrzebujemy mieć matryks, który mamy,
> potrzebujemy mieć też status już listy udzielonych odpowiedzi. Formularz jest
> nam potrzebny, gdy rozmawiamy. Wtedy cała lista może przytłuć. Formularz to
> jest po prostu jedno pytanie i możliwe odpowiedzi w danym poziomie.
> Potrzebujemy mieć listę, którą możemy zarządzać.
>
> Obecny podział, który mamy interview split matrix. Dodajmy jeszcze tylko po
> prostu raport na koniec. Więc te trzy klocki zmienimy na interview split
> matrix report w czterech klockach. W interview potrzebujemy dużo lepsze
> interview, bo to dzisiejsze jest po prostu za ciężkie.
>
> Split to będzie już suma raportu odpowiedzi, które będzie można sobie
> przeklikiwać, zmieniać, będzie je widać. Matrix graficzny, dowożymy ten mój,
> bo on jest ważny, bo ten Matrix później jest w raporcie, tak jak on jest
> umiejętnie przedstawiony, żeby było widać na którym poziomie w danej osi jest
> ocena, co jest targetem.
>
> I na koniec raport. Raport będzie się składał z tego, że będzie po prostu
> każdy ekran w nim rzucony, czy każdy ekran będzie miał wyciągnięte z niego
> wnioski.

### Owner clarification on visual language

> Żeby było jasne, dopisz to: twój układ graficzny, to znaczy Twoje czcionki,
> ramki. To jest wszystko dużo lepsze niż moje. Moje jest cięższe. Natomiast u
> Ciebie to Interview jest nie do przejścia. No jakby to było mega trudne.

This establishes a deliberate hybrid target:

- **KEEP:** the current implementation's lighter graphic layout, typography,
  frames and visual treatment;
- **REUSE FUNCTIONAL CONCEPT:** the owner's prior Matrix structure and its
  current/target assessment semantics;
- **REBUILD:** the current Interview information and interaction architecture,
  which remains explicitly too difficult to traverse.

### Target four-mode contract

#### 1. Interview

- Primary use: live conversation and sequential assessment intake.
- Default scope: one question and its possible answers for the current maturity
  level.
- It must guide the conversation without exposing the overwhelming full list.
- The current Interview treatment is explicitly too heavy and requires major
  simplification.

#### 2. Split

- Primary use: visible, manageable register of answers already given.
- It aggregates the response record, allows the user to navigate between
  responses and supports authorized correction of an answer.
- It must expose status/coverage without turning the live interview into the
  full register.

#### 3. Matrix

- Primary use: graphical maturity assessment and cross-area comparison.
- Reuse/deliver the owner's existing matrix concept shown in the supplied
  reference screenshots rather than the current Graphic Mirror substitute.
- The Matrix must show the achieved/current level and target level for each
  area within an axis.
- Authorized users can still change the assessment at Matrix level; changes
  must remain consistent with the answer register and audit trail.
- The same graphical Matrix becomes a canonical visual in the final Report.

#### 4. Report

- Add `Report` as the fourth workspace mode beside Interview, Split and Matrix.
- The Report assembles the assessment story from the preceding modes/sections.
- Each included screen/section contributes extracted conclusions, rather than
  producing an unexplained gallery of screenshots.
- Exact report composition, generation rules and relationship to the separate
  module-level Reports register require workshop reconciliation.

### Reference-design observations, not automatic acceptance

The historical screenshots provide useful candidate elements:

- a large level-by-area Digital Development Map;
- explicit `AS-IS` and `TO-BE` semantics;
- axis and area navigation;
- current, target and gap summaries;
- full-screen Matrix inspection;
- a Matrix-level assessment editor with level descriptions.

These images are functional reference evidence supplied by Piotr, not the
target graphic style. They do not by themselves prove current implementation
availability, backend connection, responsive behavior or final owner
acceptance. Their dark theme, heavier frames and all visible chrome are not
automatically requirements.

### Required workshop decisions

1. Exact boundary between Interview and Split, including whether Split is a
   two-pane layout, an answer register, or both.
2. Canonical answer states, editable fields and permissions in Split.
3. Matrix interaction: selection semantics, direct score changes, target
   changes, evidence requirements and conflict handling.
4. Bidirectional consistency among Interview answers, Split register and Matrix
   scores.
5. Report chapter structure, conclusion-generation rules and human review.
6. Relationship between the in-session Report mode and the shared module-level
   `Reports` object/register defined in `ASM-OWN-006`.
7. Mobile/responsive behavior and the minimum usable viewport for the Matrix.

### Atomic acceptance criteria

| ID                 | Criterion                                                                                                                                                | Intake result             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ASM-MODES-AC-001` | The workspace exposes exactly four clearly named modes: Interview, Split, Matrix and Report.                                                             | `NOT_TESTED`              |
| `ASM-MODES-AC-002` | Interview defaults to one current question and its applicable answer choices, with one clear next step.                                                  | `NOT_TESTED`              |
| `ASM-MODES-AC-003` | Split provides a navigable, manageable register of given answers and their status, with governed editing.                                                | `NOT_TESTED`              |
| `ASM-MODES-AC-004` | Matrix uses the owner-provided level-by-area concept and clearly distinguishes current/AS-IS from target/TO-BE for every assessed area.                  | `NOT_TESTED`              |
| `ASM-MODES-AC-005` | An authorized Matrix-level score change updates the canonical assessment state, retains audit lineage and is reflected in Interview/Split after refresh. | `NOT_TESTED`              |
| `ASM-MODES-AC-006` | Interview/Split answer changes recompute or reconcile Matrix state without silent divergence or data loss.                                               | `NOT_TESTED`              |
| `ASM-MODES-AC-007` | Report includes the canonical Matrix visual and structured conclusions derived from every included assessment section.                                   | `NOT_TESTED`              |
| `ASM-MODES-AC-008` | The in-session Report mode creates or updates the canonical Report object without duplicating the shared Reports lifecycle.                              | `OWNER_DECISION_REQUIRED` |
| `ASM-MODES-AC-009` | Full-screen and standard Matrix views remain legible and operable at supported desktop viewport sizes.                                                   | `NOT_TESTED`              |
| `ASM-MODES-AC-010` | The four-mode prototype is reviewed in an owner workshop before implementation is treated as complete.                                                   | `WORKSHOP_REQUIRED`       |
