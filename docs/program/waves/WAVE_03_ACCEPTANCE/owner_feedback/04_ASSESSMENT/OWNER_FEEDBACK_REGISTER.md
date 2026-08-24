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

## ASM-OWN-010 — Use only the primary application menu inside an Assessment session

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Classification: `WORKSPACE_CHROME_SIMPLIFICATION`
- Priority: `P0`
- Status: `CAPTURED_UNRECONCILED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Piotr's original wording

> Po pierwsze, pamiętajmy, że tu operujemy tylko w menu pierwszym. Nie mamy menu
> drugiego, trzeciego, staramy się odzyskać trochę ekranu.

### Owner-explicit requirement

1. After entering a concrete Assessment session, retain only the primary
   application navigation level.
2. Do not render the module-level second menu or an additional third navigation
   row inside the session workspace.
3. Reclaim the removed vertical chrome for the four task surfaces: Interview,
   Split, Matrix and Report.
4. This is a session-wide layout rule, not a one-screen exception. Navigation
   between the four modes must therefore live within the workspace composition
   without recreating another full-width application menu tier.

### Atomic acceptance criteria

| ID                   | Criterion                                                                                                                       | Intake result |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `ASM-CHROME-AC-001`  | Every active and read-only DRD session route renders the primary application menu and no module-level second menu.              | `NOT_TESTED`  |
| `ASM-CHROME-AC-002`  | No third full-width application navigation row is rendered in Interview, Split, Matrix or Report.                              | `NOT_TESTED`  |
| `ASM-CHROME-AC-003`  | The recovered vertical space is assigned to the task workspace and remains usable at every supported desktop viewport height. | `NOT_TESTED`  |
| `ASM-CHROME-AC-004`  | Exit/back navigation remains clear without restoring the removed menu levels.                                                   | `NOT_TESTED`  |

## ASM-OWN-011 — Add one compact, right-aligned tool-local navigation bar

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Source screenshot: `Screenshot 2026-08-23 at 13.08.45.png`
- Classification: `OWNER_NAVIGATION_DECISION / SUPERSEDES_PART_OF_ASM-OWN-009`
- Priority: `P0`
- Status: `CAPTURED_UNRECONCILED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Piotr's original wording

> Zbudujemy za to do tego menu drugiego tego konkretnego narzędzia. W tym menu
> wrzucimy wszystkie przyciski, które nam będą potrzebne do pracy w całym
> narzędziu. [...] Zostawmy to po prawej stronie, tam gdzie jest. [...] Zrobimy
> Interview, Workspace, Matrix, Report. Potem może Settings. Tylko Settings zrób
> jako oddzielny przycisk. [...] Cztery pierwsze będą przerzucały pomiędzy
> ekranami, na których będziemy pracowali, a Settings będzie otwierał listę
> ustawień, które musimy mieć [...] do całego Assessmentu.

### Reconciliation with `ASM-OWN-010`

`ASM-OWN-010` removes the generic module-level second menu and any third
application navigation row. It does **not** prohibit one compact navigation bar
owned by the open Assessment tool. This tool-local bar is part of the workspace
composition and must not recreate the height or information density of the
removed application chrome.

### Owner-explicit navigation contract

1. Place one compact, tool-local navigation group on the right side of the
   Assessment session header, retaining the visual direction shown in the
   supplied reference crop.
2. The group contains exactly four peer workspace switches in this order:
   `Interview`, `Workspace`, `Matrix`, `Report`.
3. These four controls switch the primary working surface of the same
   Assessment session; they do not navigate to separate module registries.
4. `Workspace` supersedes the previously recorded working label `Split` in the
   four-mode contract from `ASM-OWN-009`. Do not render both names or both
   destinations.
5. Add `Settings` as a separate, visually detached button next to the mode
   group. It is not a fifth workspace mode.
6. `Settings` opens the Assessment-level settings list/surface needed to
   configure and operate the whole assessment. The exact settings inventory
   remains open for subsequent owner review.
7. Retain the useful current left side of the tool header: an `Exit` action and
   the Assessment/session name. The four-mode group and separate `Settings`
   action occupy the right side of that same header.
8. The header must remain one coherent horizontal tool bar at supported desktop
   widths; this decision does not authorize another navigation row.

### Atomic acceptance criteria

| ID                    | Criterion                                                                                                                               | Intake result             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ASM-LOCALNAV-AC-001` | The right side of the session header exposes `Interview`, `Workspace`, `Matrix`, `Report` once, in that order.                          | `NOT_TESTED`              |
| `ASM-LOCALNAV-AC-002` | Selecting each of the four controls changes only the primary session workspace while retaining the same Assessment identity and state. | `NOT_TESTED`              |
| `ASM-LOCALNAV-AC-003` | `Split` is not rendered as an additional mode after the `Workspace` naming decision.                                                     | `NOT_TESTED`              |
| `ASM-LOCALNAV-AC-004` | `Settings` is visually and semantically separate from the four-mode segmented control.                                                   | `NOT_TESTED`              |
| `ASM-LOCALNAV-AC-005` | `Settings` opens one Assessment-level settings surface without replacing or duplicating an application navigation tier.                 | `NOT_TESTED`              |
| `ASM-LOCALNAV-AC-006` | Mode changes preserve unsaved/draft work or warn before any destructive transition; no answer, evidence or score is silently lost.      | `BACKEND_CONTRACT_NEEDED` |
| `ASM-LOCALNAV-AC-007` | Piotr approves the final settings inventory and the responsive/collapsed behavior of the right-aligned controls.                        | `OWNER_GATE_REQUIRED`     |
| `ASM-LOCALNAV-AC-008` | The left side retains one clear `Exit` action and the full Assessment/session name while the working controls remain on the right.       | `NOT_TESTED`              |
| `ASM-LOCALNAV-AC-009` | The combined left/right header remains a single row at supported desktop widths and does not silently truncate the identifying name.     | `NOT_TESTED`              |

## ASM-OWN-012 — Consolidate document metadata in the first Settings card

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Source screenshots: `Screenshot 2026-08-23 at 13.11.26.png`,
  `Screenshot 2026-08-23 at 13.11.47.png`
- Classification: `INFORMATION_ARCHITECTURE_SIMPLIFICATION`
- Priority: `P0`
- Status: `CAPTURED_UNRECONCILED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Piotr's original wording

> Jest sporo jakichś oznaczeń. Nie wiem szczerze, do czego one służą. Wrzućmy
> wszystkie je na jedną kartę Settings. Zróbmy po prostu kartę Settings pod
> tytułem „Informacje o dokumencie”. Niech to będzie pierwsza karta Settings.

### Owner-explicit requirement

1. Remove the observed technical, lifecycle and administrative metadata strips
   from the primary Assessment workspace.
2. Preserve their canonical values and audit meaning; this is relocation and
   simplification, not deletion from the domain model.
3. Make `Informacje o dokumencie` the first card in the Assessment `Settings`
   surface.
4. Consolidate at least the currently observed values in that card:
   - canonical session/document identity and full session ID;
   - method identifier and pinned method-pack version;
   - session/document revision;
   - runtime/source designation currently shown as `SERVER`;
   - save state;
   - evidence coverage/count;
   - items requiring review;
   - freeze blockers/readiness.
5. Translate every retained item into understandable product language and add
   a short explanation where its purpose is not self-evident. Raw engineering
   labels must not simply be moved unchanged into the card.
6. Additional Settings cards will be defined in subsequent owner-feedback
   entries; this decision fixes only the first card and its position.

### Atomic acceptance criteria

| ID                    | Criterion                                                                                                                              | Intake result         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `ASM-DOCINFO-AC-001`  | `Informacje o dokumencie` is the first card opened/listed in Assessment Settings.                                                       | `NOT_TESTED`          |
| `ASM-DOCINFO-AC-002`  | The primary Interview, Workspace, Matrix and Report surfaces no longer render the observed technical metadata strips.                  | `NOT_TESTED`          |
| `ASM-DOCINFO-AC-003`  | Every relocated value is read from the canonical session/document state and matches API/database readback after refresh.               | `RUNTIME_PROOF_NEEDED`|
| `ASM-DOCINFO-AC-004`  | Session ID, method/version, revision, source, save state, evidence coverage, review count and freeze blockers are represented once.     | `NOT_TESTED`          |
| `ASM-DOCINFO-AC-005`  | Labels and explanations are business-readable; internal diagnostic vocabulary is hidden from the default user while remaining auditable.| `OWNER_GATE_REQUIRED` |
| `ASM-DOCINFO-AC-006`  | Moving metadata does not remove or weaken save, review, approval or freeze guards and does not fabricate readiness.                     | `BACKEND_PROOF_NEEDED`|

## ASM-OWN-013 — Remove the unexplained global assessment-state legend

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Source screenshot: `Screenshot 2026-08-23 at 13.12.34.png`
- Classification: `REMOVE_FROM_GLOBAL_WORKSPACE_CHROME`
- Priority: `P1`
- Status: `CAPTURED_UNRECONCILED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Piotr's original wording

> Nie wiem, w ogóle nie widzę potrzeby, żeby ona tu była.

The referent is the visible global legend containing `Propozycja AI`, `Review`,
`Blocker`, `Evidence luka` and `Nieoceniony`.

### Owner-explicit requirement

1. Remove this global legend strip from the Assessment session workspace.
2. Do not move it into `Informacje o dokumencie`; those labels describe local
   item states, not document metadata.
3. Retain a state only where it is used by a concrete object in `Workspace` or
   `Matrix`, and display it adjacent to that object with a clear user action or
   explanation.
4. Do not keep an always-visible legend for states absent from the current
   surface merely to document internal system vocabulary.

### Atomic acceptance criteria

| ID                    | Criterion                                                                                                                         | Intake result |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `ASM-LEGEND-AC-001`   | No global row containing the five observed legend labels appears in any of the four Assessment workspace modes.                  | `NOT_TESTED`  |
| `ASM-LEGEND-AC-002`   | `Informacje o dokumencie` does not become a dumping ground for these item-level states.                                           | `NOT_TESTED`  |
| `ASM-LEGEND-AC-003`   | Any retained AI proposal, review, blocker, evidence-gap or unevaluated state is attached to a real object and explains next action.| `NOT_TESTED`  |
| `ASM-LEGEND-AC-004`   | Removing the legend does not remove canonical state, filtering, accessibility text or lifecycle enforcement.                    | `NOT_TESTED`  |

## ASM-OWN-014 — Add a context-sensitive third tool line per active workspace

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Classification: `OWNER_NAVIGATION_DECISION / PARTIAL_SUPERSESSION`
- Priority: `P0`
- Status: `CAPTURED_UNRECONCILED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Piotr's original wording

> Mamy ustawiony drugi poziom menu i teraz ustawimy trzeci poziom menu. Trzeci
> poziom menu będzie się zmieniać w zależności od tego, którą kartę będziemy
> mieli otwartą. Czy to będzie Interview, czy to będzie Workspace, czy to będzie
> Matrix, czy to będzie Report. W zależności od tego trzecia linia menu będzie
> się zmieniać.

### Reconciled three-level hierarchy

1. **Level 1 — application navigation:** the retained primary Consultify menu.
2. **Level 2 — Assessment tool navigation:** the fixed session header with the
   left-side Exit/name identity, the right-side `Interview`, `Workspace`,
   `Matrix`, `Report` mode group and separate `Settings` action.
3. **Level 3 — active-mode controls:** one compact contextual line whose
   controls and information are defined separately for Interview, Workspace,
   Matrix and Report.

Level 3 is not another global/module navigation tier. It may contain only
controls, view choices, progress or actions relevant to the currently active
mode. Switching Level 2 replaces the Level 3 composition rather than stacking
or retaining controls from the previous mode.

### Supersession boundary

This entry supersedes the absolute no-third-line wording in `ASM-OWN-010`,
`ASM-CHROME-AC-002` and the corresponding single-row restriction in
`ASM-LOCALNAV-AC-009`. It does **not** restore the removed generic module menu,
technical metadata strips or global state legend. The screen-space objective
remains binding: Level 3 must be compact and task-relevant.

### Atomic acceptance criteria

| ID                     | Criterion                                                                                                                                | Intake result         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `ASM-CONTEXT-AC-001`   | Exactly one compact Level 3 line is rendered below the fixed Assessment tool header.                                                     | `NOT_TESTED`          |
| `ASM-CONTEXT-AC-002`   | Interview, Workspace, Matrix and Report each provide an explicitly specified and independently testable Level 3 composition.             | `OWNER_INPUT_PENDING` |
| `ASM-CONTEXT-AC-003`   | Changing the Level 2 mode replaces the complete Level 3 composition without leaving stale controls or state from the previous mode.      | `NOT_TESTED`          |
| `ASM-CONTEXT-AC-004`   | Level 3 contains no generic application navigation, document-metadata dump or always-visible global status legend.                       | `NOT_TESTED`          |
| `ASM-CONTEXT-AC-005`   | Mode changes retain session identity and canonical draft state; Level 3 actions remain permission- and lifecycle-aware.                  | `BACKEND_PROOF_NEEDED`|
| `ASM-CONTEXT-AC-006`   | The three-level composition preserves sufficient working height at every supported desktop viewport and has an approved responsive form.| `OWNER_GATE_REQUIRED` |

## ASM-OWN-015 — Give Level 3 a stable left/right action architecture

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Classification: `OWNER_TOOLBAR_DECISION`
- Priority: `P0`
- Status: `CAPTURED_UNRECONCILED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Piotr's original wording

> Musimy elegancko ustawić odstępy między liniami, pomiędzy drugim i trzecim
> menu, żeby mieć trochę przestrzeni graficznej. [...] Tutaj zrobimy analizę,
> która będzie analizować opcje AI. Tutaj zrobimy Zapisz. Tutaj zrobimy Szkic,
> żeby było widać status, czy tam Draft. To zróbmy po prawej stronie, a po lewej
> stronie będziemy robić przyciski typowe dla danej karty.

### Owner-explicit toolbar contract

1. Visually separate Level 2 and Level 3 with deliberate whitespace/rhythm;
   the two rows must not read as one dense segmented-control stack.
2. Level 3 uses one stable two-zone layout:
   - **left:** controls specific to the active Interview, Workspace, Matrix or
     Report surface;
   - **right:** common Assessment controls and state.
3. The right zone contains:
   - an AI analysis/options entry point;
   - an explicit `Zapisz` action;
   - a truthful visible lifecycle status such as `Szkic`/`Draft`.
4. The status is presentation of canonical state, not a button unless a later
   owner decision explicitly defines a governed status transition.
5. `Zapisz` must expose saving, saved, failed and retry states derived from the
   real persistence command. It must not show success before durable write.
6. The AI entry point must open only the analysis/options available for the
   active Assessment and current mode. Exact AI option inventory remains to be
   defined during the mode-specific review.

### Atomic acceptance criteria

| ID                     | Criterion                                                                                                                          | Intake result             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ASM-TOOLBAR-AC-001`   | Level 2 and Level 3 remain visually distinct through consistent spacing without wasting the recovered working height.             | `OWNER_GATE_REQUIRED`     |
| `ASM-TOOLBAR-AC-002`   | The left zone changes with the active mode and contains no controls irrelevant to that mode.                                      | `OWNER_INPUT_PENDING`     |
| `ASM-TOOLBAR-AC-003`   | The right zone consistently exposes AI analysis/options, `Zapisz` and the canonical lifecycle status.                            | `NOT_TESTED`              |
| `ASM-TOOLBAR-AC-004`   | Draft/status is semantically a status and is accessible without being mistaken for an enabled action.                            | `NOT_TESTED`              |
| `ASM-TOOLBAR-AC-005`   | Save states are backed by durable persistence and cold readback; failure remains visible and retryable without data loss.         | `BACKEND_PROOF_NEEDED`    |
| `ASM-TOOLBAR-AC-006`   | AI options are permission-, lifecycle- and mode-aware and cannot fabricate an analysis or a successful write.                    | `BACKEND_CONTRACT_NEEDED` |
| `ASM-TOOLBAR-AC-007`   | Left and right zones wrap/collapse according to an owner-approved responsive rule without overlapping the Assessment identity.   | `OWNER_GATE_REQUIRED`     |

## ASM-OWN-016 — Rebuild Interview around a compact two-stage navigator

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Current-light evidence: `Screenshot 2026-08-23 at 13.15.12.png`
- Functional reference evidence: `Screenshot 2026-08-23 at 13.14.33.png`,
  `Screenshot 2026-08-23 at 13.18.08.png`,
  `Screenshot 2026-08-23 at 13.18.14.png`
- Classification: `INTERVIEW_REBUILD / FUNCTIONAL_REFERENCE_ONLY`
- Priority: `P0`
- Status: `CAPTURED_UNRECONCILED / PROTOTYPE_REQUIRED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Piotr's original wording

> Musimy zupełnie zmienić względem tego, co obecnie mamy. [...] Obecnie mamy
> taki pierdolnik. On jest nieodczytywalny. W zasadzie z niego nie zostanie
> prawie że nic. Po prawej stronie Teresa nie jest nam potrzebna, bo mamy
> oddzielny czat Teresy. Po lewej stronie ta lista jest za duża, żeby dać sobie
> z nią radę. No i ten zestaw pytań [...] też jest bardzo trudny do odpowiedzi.
>
> [...] Możemy mieć z lewej strony zwinięte grupy i otworzyć sobie menu pływające
> dokładnie tej jednej grupy i wtedy łatwo będzie po tej grupie przeskakiwać.
> [...] Zróbmy najpierw tak, popatrz jak wygląda lewe z przyciskami i zrób tak,
> żebyśmy mieli tak samo z prawej strony. [...] One są zamknięte i otwiera się
> lista i łatwo się tym zarządza. [...] Jeśli nadal ciężko się tymi przyciskami
> zarządza, wtedy dorobimy rozwijane drugie menu pod jakimś przyciskiem. Ono nie
> musi cały czas straszyć.

### Owner-explicit reconstruction boundary

1. Do not incrementally polish the current light Interview composition. Its
   simultaneous full unit tree, repeated multi-question forms and Teresa side
   panel are rejected as an information architecture.
2. Remove the dedicated Teresa side panel from Interview. Teresa remains
   available through the separate canonical Chat capability and must not
   consume permanent Interview width.
3. Replace the always-expanded 39-unit tree with a compact two-stage navigator
   derived from the supplied dark functional reference:
   - a narrow first panel lists assessment groups/axes in collapsed summary
     form with truthful progress;
   - a second panel lists only the units/areas belonging to the selected group.
4. Selecting a group changes the second panel. Selecting a unit changes the
   central Interview question surface while preserving the current Assessment
   session and draft state.
5. Groups are compact/collapsed by default. The user can deliberately expose
   the selected group's contents without expanding the entire method tree.
6. Treat a floating or button-opened quick-jump menu as a conditional follow-up
   enhancement. Add it only if owner testing shows the two-stage navigator is
   still difficult; it must not remain permanently open or duplicate controls
   without demonstrated value.
7. Preserve the current lighter typography, spacing and frame language. The
   dark screenshots contribute functional navigation structure, not target
   theme, density or visual acceptance.
8. The central question/answer surface remains explicitly rejected as too hard
   and will receive a separate detailed contract during continued review.

### Teresa clarification — 2026-08-23 13:24

The removal decision applies specifically and completely to the dedicated
right-hand Teresa sheet shown in `Screenshot 2026-08-23 at 13.24.09.png`,
including its current-position summary, current-question repetition,
`Prowadź Ty`, proposal area and next-step card. Do not redesign it, collapse it
or replace it with another Assessment-owned assistant panel. The user works
with the single general Teresa capability available at application level.
Assessment may provide that general capability with explicit current-session,
axis, area or level context, but must not create a second assistant identity or
reserve permanent workspace width for it.

### Atomic acceptance criteria

| ID                     | Criterion                                                                                                                               | Intake result          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `ASM-INTNAV-AC-001`    | Interview renders no permanent Teresa side panel and retains access to the separate canonical Chat without duplicating it.             | `NOT_TESTED`           |
| `ASM-INTNAV-AC-002`    | The first navigator panel shows all groups/axes as compact rows with truthful completion counts and one clear selected state.           | `NOT_TESTED`           |
| `ASM-INTNAV-AC-003`    | The second panel shows only the units/areas of the selected group and never the full cross-group unit tree.                             | `NOT_TESTED`           |
| `ASM-INTNAV-AC-004`    | Group and unit selection update navigation and central content without losing unsaved answers, evidence, comments or score state.      | `BACKEND_PROOF_NEEDED` |
| `ASM-INTNAV-AC-005`    | Keyboard, screen-reader and pointer users can identify selection, progress, expand/collapse state and move between both panels.         | `NOT_TESTED`           |
| `ASM-INTNAV-AC-006`    | A quick-jump overlay is absent from the first prototype and is introduced only after an explicit owner usability decision.              | `OWNER_GATE_REQUIRED`  |
| `ASM-INTNAV-AC-007`    | The light current visual language is retained while the rejected information architecture is replaced.                                 | `OWNER_GATE_REQUIRED`  |
| `ASM-INTNAV-AC-008`    | Representative 7-axis/39-unit data remains navigable at supported desktop widths without permanent horizontal or full-page tree scroll.| `NOT_TESTED`           |
| `ASM-INTNAV-AC-009`    | No Assessment-owned Teresa sheet, collapsed variant or duplicate assistant identity is mounted in any Interview state.                  | `NOT_TESTED`           |
| `ASM-INTNAV-AC-010`    | Opening general Teresa preserves explicit Assessment context and a clear return path without duplicating or silently leaking session data.| `RUNTIME_PROOF_NEEDED`|

## ASM-OWN-017 — Render canonical QBank level cards and synchronize achieved-level color

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Source screenshot: `Screenshot 2026-08-23 at 13.19.36.png`
- Classification: `CANONICAL_KNOWLEDGE_BINDING / SHARED_SCORE_STATE`
- Priority: `P0`
- Status: `SOURCE_FOUND / CAPTURED_UNRECONCILED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Piotr's original wording

> W repozytorium mamy katalog knowledge, a w nim jest pełna lista pytań dla
> pełnego audytu DRDF-DBR77. Nie musisz tego wymyślać, więc poszukaj to. [...] Jest
> cała instrukcja tego, jakie pytania na którym poziomie mają być zadawane,
> łącznie z przykładami.
>
> Każdy jeden z arkuszy pytań musi być bardzo łatwo czytelny. [...] Zróbmy tak
> jak na tym niebieskim ekranie. Czyli po prostu zaznaczamy pole, jaki to jest
> poziom. Jeśli zaznaczymy dany poziom, to ta karta powinna zmienić kolor, żeby
> było widać, że została uznana za inny poziom. I później, jak będziemy mieli
> Matrix, to ten kolor też się tam będzie zmieniał. [...] I tu, i w Matrixie ma
> być zaznaczony kolorem.

### Verified canonical source

The full Polish DRD QBank v2 exists in three versioned files:

1. `knowledge/tool-kb/drd/qbank/v2/drd-qbank-axis1-2.pl.md`
   - SHA-256: `a3cb2ea7d56df799204e3b308455010a4c58e7abad76ab34bee32169ff8f1988`
   - 14 areas, 88 level definitions, 264 evidence-question bullets.
2. `knowledge/tool-kb/drd/qbank/v2/drd-qbank-axis3-4.pl.md`
   - SHA-256: `dfd3686af43df9bd59fd23d18ffd8e260f234c5c9c5454995710e1dc4e42e670`
   - 10 areas, 60 level definitions, 180 evidence-question bullets.
3. `knowledge/tool-kb/drd/qbank/v2/drd-qbank-axis5-7.pl.md`
   - SHA-256: `5b99196181957794842a78bdf81d10f60fb8ff4badc21e48c8c999d5e7068242`
   - 15 areas, 85 level definitions, 255 evidence-question bullets.

Verified denominator: 7 axes, 39 areas, 233 level definitions and 699
evidence-question bullets. Each level provides `Pytania (dowodowe)`,
`Dowód / przykład` and `Sugerowane technologie`. The pack identifies itself as
`drd`, QBank `2.0.0`, Polish, branded `Digital Pathfinder / DBR77`, and explicitly
states that its questions must not be used for scoring without the evidence
they request.

### Owner-explicit card contract

1. Build the Interview content from the pinned canonical QBank pack; do not
   invent substitute questions, examples or generic self-assessment copy.
2. For the selected area/unit, render one highly readable card per applicable
   maturity level in ascending order.
3. Each level card exposes its canonical level identity, questions and
   evidence/example guidance. Suggested technologies may be disclosed without
   overwhelming the primary assessment decision.
4. A clear selection control marks the achieved/current level for the area.
5. Selecting an achieved level changes the card's visual treatment to the
   canonical color assigned to that maturity level.
6. Interview and Matrix read the same persisted assessment value and color
   mapping. A confirmed change in either surface must appear in the other after
   reconciliation/refresh; neither surface may maintain a private score.
7. Color supplements, but never replaces, the explicit level number/name,
   selected state and accessible text.
8. The precise rule for whether selecting level N marks only N or also denotes
   lower levels as achieved remains an owner/methodology decision; do not infer
   cumulative scoring from the screenshot alone.

### Atomic acceptance criteria

| ID                    | Criterion                                                                                                                                | Intake result             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ASM-QBANK-AC-001`    | Every rendered Polish DRD level card resolves to the pinned v2 QBank source and exposes its source version.                              | `NOT_TESTED`              |
| `ASM-QBANK-AC-002`    | Coverage tests reconcile exactly 7 axes, 39 areas, 233 level definitions and 699 evidence questions; omissions and duplicates fail closed.| `NOT_TESTED`             |
| `ASM-QBANK-AC-003`    | Cards remain readable and distinguish level, questions, evidence/example and optional technologies without reproducing the rejected form.| `OWNER_GATE_REQUIRED`    |
| `ASM-QBANK-AC-004`    | A level cannot be accepted as achieved without the governed evidence/exception contract required by the pinned methodology.              | `BACKEND_CONTRACT_NEEDED` |
| `ASM-QBANK-AC-005`    | Selecting/changing a level persists one canonical current score with actor, timestamp, source version and audit lineage.                 | `BACKEND_PROOF_NEEDED`    |
| `ASM-QBANK-AC-006`    | Interview and Matrix show the same current level and canonical color after save, refresh and cold login.                                | `RUNTIME_PROOF_NEEDED`    |
| `ASM-QBANK-AC-007`    | Selection remains understandable in monochrome/high-contrast modes and to assistive technology; color is never the sole signal.          | `NOT_TESTED`              |
| `ASM-QBANK-AC-008`    | The cumulative-versus-single-level selection rule is explicitly approved before score calculation is treated as final.                  | `OWNER_DECISION_REQUIRED` |

## ASM-OWN-018 — Use a progressive, evidence-governed expanded level card

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Source screenshots: `Screenshot 2026-08-23 at 13.22.05.png`,
  `Screenshot 2026-08-23 at 13.23.33.png`
- Expert synthesis:
  `ASSESSMENT_LEVEL_CARD_SKEPTICAL_REVIEW_2026-08-23.md`
- Classification: `THREE_SKEPTIC_REVIEW / DESIGN_CANDIDATE_9.2_OF_10`
- Priority: `P0`
- Status: `EXPERT_REVIEW_COMPLETE / OWNER_REVIEW_REQUIRED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Owner problem and requested direction

The user often cannot determine from one short maturity description whether a
level is achieved. A compact level card therefore needs an optional, standardized
deep-assessment surface below it. That surface should reuse useful semantics
from the current question card, support richer evidence collection and remain
connected to the compact navy-card navigation concept.

Piotr explicitly requested independent skeptical review by a consultant, a UX
expert and a survey-methodology expert, with a target score of at least `9/10`.
The independent corrected-design scores were `9.2`, `9.3` and conditional
`9.0`; the reconciled formula is `9.2/10` subject to its mandatory gates.

### Reconciled owner-plus-expert contract

1. The collapsed card presents the canonical short level identity/criterion and
   saved verdict/evidence state.
2. Use the unambiguous Polish CTA `Sprawdź kryteria`; after work exists use
   `Kontynuuj ocenę` or `Edytuj ocenę`. Do not use English `Tell me more` or
   `Go deeper` in the Polish product.
3. Clicking the card/header or CTA expands one inline full-width standardized
   assessment panel; it never changes the score.
4. Keep at most one level card expanded for the selected area.
5. The expanded card provides canonical QBank prompts sequentially, canonical
   evidence/example help, response notes, file/URL/manual-reference evidence
   with provenance and the governed assessment controls.
6. Separate material verdict, respondent knowledge and evidence state. Do not
   reuse the current flat six-option answer set as one scoring control.
7. A user selection is provisional. Canonical achieved state and Matrix color
   require durable save plus the evidence/validation contract.
8. Persist each area-level decision independently until the method owner
   formally approves an aggregation/cumulative-level rule.
9. Preserve the lighter current visual language while integrating the compact
   functional navigation rhythm from the navy reference.

### Atomic acceptance criteria

| ID                     | Criterion                                                                                                                              | Intake result             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ASM-DEEP-AC-001`      | A collapsed card has one clear expand action and cannot change maturity through an ambiguous whole-card click.                        | `NOT_TESTED`              |
| `ASM-DEEP-AC-002`      | At most one full-width inline card is expanded and focus/scroll remain anchored within the selected area and below the sticky toolbar.| `NOT_TESTED`              |
| `ASM-DEEP-AC-003`      | Expanded content uses the pinned QBank prompts/evidence/examples without adding scoring questions or applying a `2 of 3` rule.        | `NOT_TESTED`              |
| `ASM-DEEP-AC-004`      | Verdict, respondent knowledge and evidence status are separate canonical fields with explicit labels and valid transitions.           | `BACKEND_CONTRACT_NEEDED` |
| `ASM-DEEP-AC-005`      | File, URL and external references retain description, source/owner and relevant date/period; broken or rejected evidence remains known.| `BACKEND_CONTRACT_NEEDED`|
| `ASM-DEEP-AC-006`      | `Osiągnięty` requires adequate evidence and authorized assessor validation; oral declaration or technology alone cannot raise score.  | `BACKEND_CONTRACT_NEEDED` |
| `ASM-DEEP-AC-007`      | `Nie dotyczy` requires rationale and approval; conflicting evidence requires adjudication and cannot silently resolve.                | `BACKEND_CONTRACT_NEEDED` |
| `ASM-DEEP-AC-008`      | Save, retry, conflict and navigation preserve draft; Matrix changes only after canonical successful write.                            | `RUNTIME_PROOF_NEEDED`    |
| `ASM-DEEP-AC-009`      | The same saved record, audit history and QBank version drive Interview and Matrix text/icon/color after refresh and cold login.        | `RUNTIME_PROOF_NEEDED`    |
| `ASM-DEEP-AC-010`      | Piotr reviews the clickable collapsed/expanded prototype before the candidate is treated as implementation-ready or accepted.         | `OWNER_GATE_REQUIRED`     |

## ASM-OWN-019 — Show hierarchical progress and deep-link Matrix to the active axis

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Functional reference: supplied navy DRD navigation and Matrix screenshots
- Classification: `PROGRESS_INFORMATION / CROSS_MODE_CONTEXT_LINK`
- Priority: `P0`
- Status: `CAPTURED_UNRECONCILED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Piotr's original wording

> Mamy informację, tak jak na tym granatowym, czyli ile uzyskaliśmy, ile mamy
> odpowiedzi na ile pytań, a w samych arkuszach poszczególnych, jaki mamy score
> na ile, czyli jaki mamy numer. Informujemy w tabliczkach elegancko. [...]
> Będąc tutaj, zawsze [możemy] wcisnąć Matrix. To powinno przerzucić do całej
> karty matryksowej danej osi digitalnej. Czyli mamy zlinkowanie do danej osi.

### Owner-explicit progress and linking contract

1. Each first-stage axis/group row shows a compact, truthful progress fraction:
   assessed areas/units over all applicable areas/units in that axis, for
   example `2/9`.
2. Each second-stage area/unit row shows its canonical current maturity result
   against the applicable scale, for example `Poziom 3/7`; if it is not yet
   defensibly scored, show an honest non-scored state rather than `0` as a
   fabricated maturity level.
3. Keep these values inside elegant compact badges/table cells attached to the
   relevant navigator row. Do not reintroduce a full-width global technical
   progress strip.
4. Fractions must distinguish answered, assessed and evidence-validated states;
   the label/tooltip must make the active denominator clear. A response count
   must not masquerade as a validated maturity score.
5. Selecting Level 2 `Matrix` from Interview carries the current session and
   active axis identity into Matrix and opens the complete Matrix card for that
   axis.
6. The Matrix deep link must not reset selection, open a generic Matrix landing
   page or silently change scores.
7. Returning from Matrix to Interview restores the prior axis and area/unit;
   any unsaved Interview work follows the save/discard/stay protection defined
   earlier.

### Atomic acceptance criteria

| ID                     | Criterion                                                                                                                               | Intake result          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `ASM-PROGRESS-AC-001`  | Every axis row shows assessed/applicable area progress from canonical state and reconciles with the visible second-stage rows.          | `RUNTIME_PROOF_NEEDED` |
| `ASM-PROGRESS-AC-002`  | Every area row shows a validated score/scale or an explicit unassessed/provisional state; missing evidence never becomes level zero.    | `NOT_TESTED`           |
| `ASM-PROGRESS-AC-003`  | Answered, assessed and evidence-validated denominators remain semantically distinct and accessible beyond a bare fraction.             | `NOT_TESTED`           |
| `ASM-PROGRESS-AC-004`  | `Matrix` from Interview opens the current session's complete Matrix card focused on the active axis.                                   | `NOT_TESTED`           |
| `ASM-PROGRESS-AC-005`  | Matrix and Interview display the same saved scores, colors and progress after refresh/cold login, with no client-side duplicate truth. | `RUNTIME_PROOF_NEEDED` |
| `ASM-PROGRESS-AC-006`  | Returning to Interview restores the prior axis/unit and protects any unresolved draft.                                                  | `NOT_TESTED`           |

## ASM-OWN-020 — Do not duplicate axis navigation in Interview Level 3

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Source screenshot: `Screenshot 2026-08-23 at 13.25.43.png`
- Classification: `REMOVE_DUPLICATE_NAVIGATION`
- Priority: `P1`
- Status: `CAPTURED_UNRECONCILED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Owner-explicit requirement

The current full-width axis row (`Procesy Cyfrowe`, `Produkty Cyfrowe`,
`Cyfrowe Modele Biznesowe`, `Zarządzanie Danymi`, `Kultura Transformacji`,
`Cyberbezpieczeństwo`, `Dojrzałość AI`) must not appear in Interview Level 3.
The two-stage left navigator defined by `ASM-OWN-016` is the sole axis and area
selection surface. Interview Level 3 remains available only for mode-specific
working controls on the left and the common AI/save/status controls on the
right.

### Atomic acceptance criteria

| ID                      | Criterion                                                                                                                 | Intake result |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `ASM-NODUPE-AC-001`     | No full-width axis list or axis selector is rendered in Interview Level 3.                                                | `NOT_TESTED`  |
| `ASM-NODUPE-AC-002`     | The left two-stage navigator is the single axis/area selection truth and retains selected/progress state.                 | `NOT_TESTED`  |
| `ASM-NODUPE-AC-003`     | Removing the duplicate row does not remove keyboard navigation, deep links, current-location context or Matrix linking.   | `NOT_TESTED`  |

## ASM-OWN-021 — Collapse the tool to Interview, Matrix and Report

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Source screenshot: `Screenshot 2026-08-23 at 13.27.25.png`
- Classification: `OWNER_INFORMATION_ARCHITECTURE_DECISION / SUPERSEDES_FOUR_MODE_MODEL`
- Priority: `P0`
- Status: `CAPTURED_UNRECONCILED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Piotr's original wording

> Celem Interview jest zebranie aktualnego wywiadu o stanie faktycznym, zebranie
> możliwych dowodów, uzasadnienie ich.
>
> Celem [...] Workspace'u będzie ustalenie, co klient by chciał, jakie są jego
> pomysły osiągnąć w ramach realizowanego procesu transformacyjnego. [...] Musimy
> przejść po poszczególnych aktualnych ocenach [...] i ustalić, które z następnych
> kroków, ile z następnych kroków klient chciałby zrealizować.
>
> Może się też okazać, że klient przegapił któreś, na przykład miał ocenę 1, 2,
> 5, a nie miał 3, 4, i to też warto wtedy uzupełniać. Prawdziwym narzędziem do
> workspace'owego będzie po prostu Matrix. [...] Wywalamy ten Split, wywalamy
> Workspace, będzie Interview, Matrix, Report.

### Current final mode contract

Level 2 exposes exactly three peer workspaces in this order:

1. **Interview — AS-IS evidence intake**
   - establish the client's factual current state;
   - capture canonical QBank responses;
   - collect and qualify evidence;
   - record rationale, uncertainty, conflicts and assessor validation;
   - do not mix target aspiration or transformation planning into factual
     current-state scoring.
2. **Matrix — maturity visualization and transformation workspace**
   - visualize all saved AS-IS area-level decisions and gaps;
   - inspect each current assessment in an organized way;
   - agree what the client wants to achieve (`TO-BE`);
   - select which specific next maturity steps, and how many, belong to the
     intended transformation scope;
   - reveal non-contiguous maturity patterns such as evidenced levels `1`, `2`
     and `5` with unresolved/missing `3` and `4`;
   - allow the team to include remediation of skipped lower gaps rather than
     silently treating a higher capability signal as a continuous score.
3. **Report — governed synthesis**
   - present the accepted AS-IS, selected TO-BE, gaps, evidence quality and
     structured conclusions from the same canonical Assessment state.

`Settings` remains a separate action and is not counted as a workspace mode.

### Explicit supersession

This entry supersedes every earlier current-target reference to four modes,
including `Interview | Split | Matrix | Report` in `ASM-OWN-009` and
`Interview | Workspace | Matrix | Report` in `ASM-OWN-011`, plus corresponding
four-mode wording in `ASM-OWN-012`, `ASM-OWN-013`, `ASM-OWN-014`,
`ASM-OWN-016` and `ASM-OWN-019`. Those entries remain historical decision
provenance. Do not render `Split` or `Workspace` as a tab, route or duplicate
working surface.

### Matrix planning boundary

Matrix does not rewrite the evidence-derived AS-IS score merely because the
client chooses a target. Store current assessment, desired target and selected
transformation steps as distinct values with lineage. A non-contiguous high
capability may remain visible without automatically filling lower gaps. The
exact methodology for calculating a single summary level remains subject to
the formal method-owner decision retained in `ASM-OWN-017`/`018`.

### Atomic acceptance criteria

| ID                    | Criterion                                                                                                                               | Intake result             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ASM-THREE-AC-001`    | Level 2 shows exactly `Interview`, `Matrix`, `Report` in that order; neither `Split` nor `Workspace` is rendered or routable.            | `NOT_TESTED`              |
| `ASM-THREE-AC-002`    | Interview contains AS-IS factual/evidence work and no target-selection control that can overwrite current-state judgment.              | `NOT_TESTED`              |
| `ASM-THREE-AC-003`    | Matrix reads the same canonical AS-IS decisions and separately persists TO-BE plus explicitly selected transformation steps.          | `BACKEND_CONTRACT_NEEDED` |
| `ASM-THREE-AC-004`    | Matrix exposes missing/conflicting lower levels even when a higher level has evidence; it never silently fills a maturity sequence.    | `NOT_TESTED`              |
| `ASM-THREE-AC-005`    | For every area, the user can inspect current state, desired target, gap and the specific next levels included in transformation scope. | `NOT_TESTED`              |
| `ASM-THREE-AC-006`    | Report uses the same accepted AS-IS, TO-BE, selected steps, evidence and gap state without recomputing a divergent client-side truth.   | `BACKEND_CONTRACT_NEEDED` |
| `ASM-THREE-AC-007`    | Settings remains a separate action and opens no fourth working mode.                                                                    | `NOT_TESTED`              |
| `ASM-THREE-AC-008`    | Piotr approves the revised three-mode clickable prototype before implementation is considered accepted.                                | `OWNER_GATE_REQUIRED`     |

## ASM-OWN-022 — Reuse the proven DRD demo interaction as the donor

- Local review route: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Exact donor URL supplied by Piotr:
  `https://demo.consultify.ai/assessment/drd/1404d2c5-a769-43fd-928d-c487469f36f0?axis=2&area=2A&level=1`
- Donor screenshot watermark: `DEMO @f3237e942304`
- Source screenshots: `Screenshot 2026-08-23 at 13.31.41.png`,
  `Screenshot 2026-08-23 at 13.33.38.png`,
  `Screenshot 2026-08-23 at 13.33.51.png`,
  `Screenshot 2026-08-23 at 13.33.59.png`,
  `Screenshot 2026-08-23 at 13.34.37.png`
- Located source donor:
  `src/components/assessment/drd/DRDAssessmentEditor.tsx`
- Classification: `OWNER_DONOR_SELECTION / SUPERSEDES_NEW_INTERACTION_DESIGN`
- Priority: `P0`
- Status: `CAPTURED_AND_SOURCE_LOCATED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Owner decision

Do not invent another Assessment interaction model. Restore and adapt the
proven demo mechanics. The donor already combines the useful level card,
current/target decisions, evidence-supporting content, Survey/Matrix switching
and the maturity Matrix. The current light Assessment should reuse that product
logic and interaction while adopting the navigation and visual decisions from
this review.

### Interview card donor contract

1. One level card contains the short description and expandable supporting
   material: example/suggested technologies, explanation, canonical questions,
   comment, attachment and link.
2. Level cards collapse and expand; the active card supports `Previous` and
   `Next` without losing state.
3. The principal decisions are `Achieved`, `Target` and `Skip`:
   - `Achieved` records an AS-IS claim for the level;
   - `Target` records the desired TO-BE level and never overwrites AS-IS;
   - `Skip` records an explicit workflow decision for that level and must not be
     silently reinterpreted as `not applicable`, `not achieved` or missing data.
4. A visible decision changes the card state/color and the same persisted state
   is reflected in Matrix.
5. The donor's right-hand area list moves to the approved left two-stage
   navigator. The permanent tool-specific Teresa panel remains removed.
6. The donor label `Survey` maps to the final `Interview` mode; the donor
   `Preview`/Matrix switch maps to the final `Matrix` mode. This must not
   reintroduce `Split` or `Workspace`.
7. Reuse the donor behavior in the current light visual language. The navy demo
   is a functional and interaction reference, not a command to restore its
   theme.

### Matrix donor contract

1. Matrix displays the full selected axis and supports a full-screen view.
2. Each cell opens details containing at least description, example and
   technologies where supplied by the canonical method pack.
3. Cell details expose distinct `Set AS-IS` and `Set TO-BE` actions.
4. AS-IS and TO-BE colors, cell states, area counters and summary cards read the
   same saved state as Interview.
5. Matrix remains the transformation workspace defined in `ASM-OWN-021`; the
   donor presentation does not authorize a second client-side scoring truth.

### Methodology reconciliation retained from the skeptical review

Selecting the donor supersedes the proposal to design a new card shell in
`ASM-OWN-018`, but it does not remove the safety requirements discovered by the
three skeptical reviewers. An `Achieved` click is a claim/selection until the
required evidence and authorized validation status are satisfied. Claim,
evidence quality, validation and audit provenance remain separate canonical
fields. The implementation must not infer continuous achievement of all lower
levels unless the approved DRD methodology explicitly requires it.

### Atomic acceptance criteria

| ID                    | Criterion                                                                                                                            | Intake result             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `ASM-DONOR-AC-001`    | The implementation reuses the located donor mechanics instead of introducing a third Assessment interaction model.                  | `SOURCE_LOCATED`          |
| `ASM-DONOR-AC-002`    | Each level card provides description, example/explanation, questions, comment, attachment and link with collapse/expand navigation. | `NOT_TESTED`              |
| `ASM-DONOR-AC-003`    | `Achieved`, `Target` and `Skip` persist distinct semantics; TO-BE cannot overwrite AS-IS and Skip cannot fabricate a verdict.        | `BACKEND_CONTRACT_NEEDED` |
| `ASM-DONOR-AC-004`    | Interview and Matrix show identical saved level state/colors after refresh and cold login.                                           | `RUNTIME_PROOF_NEEDED`    |
| `ASM-DONOR-AC-005`    | The area navigator is on the left and no permanent Assessment-specific Teresa sheet is rendered.                                    | `NOT_TESTED`              |
| `ASM-DONOR-AC-006`    | The visible modes remain exactly `Interview`, `Matrix`, `Report`, with Matrix reachable directly from Interview context.             | `NOT_TESTED`              |
| `ASM-DONOR-AC-007`    | Matrix cell details support description/example/technologies plus distinct AS-IS and TO-BE actions and a full-screen view.           | `NOT_TESTED`              |
| `ASM-DONOR-AC-008`    | Evidence validation, assessor authority, QBank version and audit provenance remain explicit despite the faster donor interaction.    | `BACKEND_CONTRACT_NEEDED` |
| `ASM-DONOR-AC-009`    | The exact supplied demo URL is used for visual/behavioral comparison during implementation and owner acceptance.                    | `OWNER_GATE_REQUIRED`     |

## ASM-OWN-023 — Team permissions and staged Assessment approvals

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Classification: `SETTINGS_GOVERNANCE / APPROVAL_WORKFLOW`
- Priority: `P0`
- Status: `CAPTURED_WITH_TERMINOLOGY_TO_CONFIRM / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Owner-explicit Settings requirements

Settings gains two tightly connected governance cards:

1. **Team and access**
   - define the Assessment team with access to the document;
   - define who may answer questions;
   - define who may approve answers;
   - define who may approve targets/Matrix and the final report;
   - permissions must be explicit roles/capabilities, not inferred merely from
     document access.
2. **Acceptance / approvals** — wording to be confirmed with Piotr
   - this card is directly related to the Team card;
   - show the approval stages, assigned approvers and current gate state;
   - prevent a user from approving a stage without the corresponding authority;
   - retain approver identity, decision, timestamp and revision lineage.

Piotr's spoken term sounded like `karta atfekcyjna`; the register uses
`Acceptance / approvals` only as a working interpretation. The final Polish
product label remains `TO_CONFIRM`, rather than silently inventing terminology.

### Approval stages currently enumerated by the owner

1. **Answer approval** — factual Interview answers/evidence are reviewed and
   approved.
2. **Target approval** — desired levels and transformation decisions are
   approved; this produces an approved Matrix state.
3. **Report approval** — the report derived from the approved Assessment state
   is approved as the final deliverable.

The owner first referred to “two approval levels” but subsequently enumerated
the three gates above. Until clarified, the implementation contract is three
distinct approval stages, not a fabricated two-stage simplification. These
stage approvals must remain separate from document lifecycle labels such as
`Draft` and from a generic save indicator.

### Gate dependencies

`Interview answers/evidence approved` → `targets and Matrix approved` →
`report generated/reviewed and approved`.

- Approving answers freezes or versions the accepted AS-IS input used by
  Matrix; later edits must create a visible reapproval requirement rather than
  silently changing an accepted baseline.
- Approving targets freezes or versions the accepted TO-BE and selected
  transformation scope; the approved Matrix is the report input.
- Report approval refers to a specific report revision and its exact approved
  AS-IS/TO-BE source revisions.
- A later upstream change invalidates or explicitly supersedes downstream
  approvals; it must never leave a stale report looking current.

### Atomic acceptance criteria

| ID                    | Criterion                                                                                                                               | Intake result             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ASM-GOV-AC-001`      | Settings exposes a Team card listing document access and distinct answer/approval capabilities.                                       | `BACKEND_CONTRACT_NEEDED` |
| `ASM-GOV-AC-002`      | Settings exposes a related Acceptance/Approvals card with stages, assigned approvers and current gate state.                           | `LABEL_TO_CONFIRM`        |
| `ASM-GOV-AC-003`      | Answer approval, target/Matrix approval and report approval are persisted as distinct decisions with actor, timestamp and revision.    | `BACKEND_CONTRACT_NEEDED` |
| `ASM-GOV-AC-004`      | A user can answer or approve only when granted the corresponding capability; document access alone grants neither action implicitly.   | `SECURITY_PROOF_NEEDED`   |
| `ASM-GOV-AC-005`      | Target approval produces an approved Matrix tied to the approved answer baseline and selected transformation scope.                    | `RUNTIME_PROOF_NEEDED`    |
| `ASM-GOV-AC-006`      | Report approval identifies the exact report and upstream Assessment revisions from which it was generated.                            | `RUNTIME_PROOF_NEEDED`    |
| `ASM-GOV-AC-007`      | Editing an approved upstream state visibly invalidates/reopens affected downstream approvals instead of leaving stale approval badges. | `BACKEND_CONTRACT_NEEDED` |
| `ASM-GOV-AC-008`      | Piotr confirms whether the intended model contains three gates or two levels grouping those gates, and confirms the card's final name. | `OWNER_CLARIFICATION`     |

## ASM-OWN-024 — Report as an expert, company-specific interpretation

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Classification: `REPORT_METHODOLOGY / EXPERT_ANALYSIS`
- Priority: `P0`
- Status: `CAPTURED_AND_BOOK_LOCATED / REPORT_STRUCTURE_PENDING / NOT_ACCEPTED`

### Owner-explicit purpose of the Report

The Report is not a dump of Interview responses and not a mechanical rendering
of Matrix scores. It is an expert analysis that:

1. states what evidence and information were successfully collected;
2. explains how the observed capabilities work in the context of this specific
   enterprise;
3. draws defensible conclusions about the current situation;
4. identifies meaningful development possibilities and next steps within a
   stated, foreseeable time horizon;
5. explains why a particular target is appropriate, rather than treating the
   highest available maturity level as the universal destination.

For DRD, not every area should be driven to the maximum level. A recommendation
must consider business context, strategic relevance, dependencies, cost,
capability, risk, coherence and the expected planning horizon. “Higher” is not
automatically “better” or economically justified.

### Canonical methodology source located in the repository

Piotr's book/material is present under `knowledge/DRD/`:

- `0. Wprowadzenie .pdf`
- `1. Digitlne processy.pdf`
- `2. Digitalne produkty.pdf`
- `3. digitlane modele .pdf`
- `4. Big data.pdf`
- `5. Kultura.pdf`
- `6. Cyberbezpieczenstwo .pdf`
- `7. Os AI opis.pdf`
- `extracted_content.txt` — 2,800-line searchable extraction of the material.

The introduction explicitly describes the Digital Roadmap as a combination of
strategic consulting and operational reorganization. It defines three broad
steps: current-state assessment, transformation initiatives, and coherent
sequencing/timeline with economic effects. It also requires coherence among
initiatives, prerequisite capabilities before advanced solutions, iterative
adjustment and periodic reassessment. These are methodology inputs for the
Report, not instructions to generate initiatives automatically without expert
judgment.

The Report generator may use Piotr's authored conclusions or a language model
equipped with consulting tools, but generated interpretation must remain
traceable to the approved Assessment state and the pinned methodology/book
version. The model cannot invent company facts, evidence or certainty.

### Report source hierarchy

1. approved Interview answers, evidence, uncertainty and rationale;
2. approved Matrix AS-IS, TO-BE, gaps and selected transformation scope;
3. enterprise context available to and authorized for this Assessment;
4. pinned DRD QBank/method pack;
5. Piotr's book under `knowledge/DRD/` as expert interpretation methodology;
6. explicit expert/model analysis, clearly distinguished from collected fact.

### Atomic acceptance criteria

| ID                    | Criterion                                                                                                                               | Intake result             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ASM-REPORT-AC-001`   | Report distinguishes collected facts/evidence, expert interpretation, assumptions, uncertainty and recommendations.                   | `BACKEND_CONTRACT_NEEDED` |
| `ASM-REPORT-AC-002`   | Every material conclusion is traceable to approved Assessment evidence/context and a pinned methodology source or is marked inference. | `BACKEND_CONTRACT_NEEDED` |
| `ASM-REPORT-AC-003`   | Recommendations explain enterprise fit and a stated time horizon; they do not automatically recommend maximum maturity everywhere.   | `NOT_TESTED`              |
| `ASM-REPORT-AC-004`   | The report considers dependencies, sequencing, readiness, cost/risk and coherence across axes before recommending next steps.         | `NOT_TESTED`              |
| `ASM-REPORT-AC-005`   | The generation record pins the exact Interview, Matrix, QBank/method-pack and book/methodology revisions used.                         | `BACKEND_CONTRACT_NEEDED` |
| `ASM-REPORT-AC-006`   | A language model cannot manufacture company evidence or silently present inference as an approved fact.                               | `AI_SAFETY_PROOF_NEEDED`  |
| `ASM-REPORT-AC-007`   | Report approval follows the governance and revision dependency contract in `ASM-OWN-023`.                                             | `RUNTIME_PROOF_NEEDED`    |
| `ASM-REPORT-AC-008`   | The detailed report sections, presentation and editing workflow remain open for the continuing owner review.                          | `OWNER_REVIEW_CONTINUES`  |

## ASM-OWN-025 — Seven axis chapters with a fixed textual analysis template

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Existing report source inspected: `docs/product/DRD_REPORT_SPEC.md`
- Classification: `REPORT_INFORMATION_ARCHITECTURE / CONTENT_STANDARD`
- Priority: `P0`
- Status: `CAPTURED_WITH_CANON_RECONCILIATION_REQUIRED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Owner-explicit Report architecture

The interactive Report has one selectable chapter/screen per Assessment axis.
For the current DRD method pack this means seven axis buttons and seven axis
chapters. Selecting an axis opens its complete report chapter. Axis selection
must preserve the active session and report revision and must not navigate to a
separate generic report object.

Each axis chapter contains, in order:

1. axis introduction;
2. the axis Matrix as a report-quality visual;
3. one expert commentary block for every area in that axis;
4. axis conclusions.

“One screen per axis” means one coherent interactive chapter that may scroll.
It does not require squeezing all area commentary into one physical PDF page.
The export renderer may paginate the chapter while preserving its hierarchy.

### Proposed textual standard for every axis chapter

#### A. Axis opening — 120–180 words

- one-sentence executive verdict, maximum 25 words;
- scope: what this axis evaluates in this company;
- concise synthesis of current AS-IS, intended TO-BE and evidence confidence;
- the axis's practical business meaning and its most important tension;
- no methodology tutorial and no repetition of every area result.

Required reasoning sequence: `co ustalono → co to znaczy dla firmy → gdzie jest
najważniejsze napięcie lub możliwość`.

#### B. Axis Matrix visual

- render the approved axis Matrix from canonical data, including area names,
  AS-IS, TO-BE, gaps and evidence/validation state;
- use an export-quality component/SVG rather than a lossy screenshot;
- title the visual with a conclusion, not merely `Matrix osi X`;
- provide a short caption of 30–60 words identifying the dominant pattern and
  any material non-contiguous gaps;
- the visual must remain legible without relying on color alone.

#### C. One area commentary per area — 110–170 words each

Every area uses the same five-part micro-structure:

1. **Stan faktyczny** — 1–2 sentences grounded in approved answers/evidence;
2. **Ocena i wiarygodność** — AS-IS/TO-BE plus whether the result is evidenced,
   declared, incomplete, conflicting or not assessed;
3. **Znaczenie dla przedsiębiorstwa** — the operational/business consequence
   in this organization's context;
4. **Luka i sens targetu** — what must change and why the selected target is
   appropriate; explicitly say when a higher level is not justified;
5. **Najbliższy krok** — one concrete action or decision with owner/role and a
   foreseeable horizon, or an explicit evidence gap to close first.

The block must not restate the level description verbatim. It must interpret
the approved material. Where input is insufficient, a shorter honest block is
preferred to padded or invented analysis.

#### D. Axis conclusion — 180–260 words

- synthesize the pattern across areas rather than repeat area commentaries;
- identify 2–4 strengths/capabilities worth retaining;
- identify 2–4 critical gaps, contradictions or dependencies;
- explain what the axis enables or blocks in other axes;
- state the recommended development direction and realistic time horizon;
- identify the first 1–3 priorities in sequence;
- state material uncertainties or conditions that may change the conclusion.

End with a compact decision line:
`Rekomendowany kierunek | Priorytet | Horyzont | Warunek powodzenia`.

### Writing and evidence rules

- Polish or English is generated from the same canonical state; terminology
  comes from the pinned method pack/book.
- Use management language understandable without reading the questionnaire.
- Prefer concrete observations, consequences and actions over generic advice.
- Numbers come from the deterministic engine; the model does not calculate or
  fabricate them.
- Every area commentary retains source references to the accepted answers and
  evidence; UI may expose them through citations/details without cluttering the
  executive text.
- Inference is labelled; missing evidence and disagreements remain visible.
- Target recommendations require business justification and do not default to
  the maximum level.
- The generator may shorten text when there is little reliable material, but
  must not exceed the limits merely to sound expert.

### Reconciliation with the existing report specification

`docs/product/DRD_REPORT_SPEC.md` currently describes seven measurement axes
but eight communication/reporting dimensions and specifies eight detailed
chapters in S7. Piotr's current owner decision is seven interactive chapters,
one per axis. This entry therefore governs the new Report UI, but the canon,
report spec, engine mappings and export contract must be reconciled and
versioned before implementation. Do not silently delete the existing 8D
mapping or claim that the conflict is already resolved.

### Atomic acceptance criteria

| ID                     | Criterion                                                                                                                               | Intake result                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `ASM-CHAPTER-AC-001`   | Report shows seven axis selectors and exactly one coherent interactive chapter for each current DRD axis.                             | `NOT_TESTED`                   |
| `ASM-CHAPTER-AC-002`   | Every chapter orders content as introduction → Matrix visual → one commentary per area → axis conclusion.                             | `NOT_TESTED`                   |
| `ASM-CHAPTER-AC-003`   | Area commentary count equals the canonical applicable-area count for the selected axis; no assessed area disappears.                 | `RUNTIME_PROOF_NEEDED`         |
| `ASM-CHAPTER-AC-004`   | Introduction, area blocks and conclusion comply with the stated length and substantive requirements without filler or invented facts. | `AI_QUALITY_PROOF_NEEDED`      |
| `ASM-CHAPTER-AC-005`   | The embedded Matrix reads approved canonical state and renders at report/export quality with accessible non-color status encoding.   | `RUNTIME_AND_VISUAL_PROOF`     |
| `ASM-CHAPTER-AC-006`   | Each area block exposes traceability to its approved answers/evidence and labels uncertainty or inference honestly.                   | `BACKEND_CONTRACT_NEEDED`      |
| `ASM-CHAPTER-AC-007`   | Selecting an axis preserves the report revision and returns to the same axis after refresh/deep link.                                 | `NOT_TESTED`                   |
| `ASM-CHAPTER-AC-008`   | The seven-axis owner decision and existing eight-dimension report canon are formally reconciled and versioned before implementation.  | `CANON_DECISION_REQUIRED`      |
| `ASM-CHAPTER-AC-009`   | Piotr accepts a generated seven-chapter report on complete seeded data, including text density and exported pagination.                | `OWNER_GATE_REQUIRED`          |

## ASM-OWN-026 — Export one axis or assemble the complete seven-axis PDF

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Classification: `REPORT_EXPORT / PDF_ASSEMBLY`
- Priority: `P0`
- Status: `CAPTURED_UNRECONCILED / NOT_IMPLEMENTED / NOT_ACCEPTED`

### Owner-explicit export contract

1. Every axis chapter provides an `Eksportuj PDF` action for the currently
   selected axis.
2. The Report provides an `Eksportuj wszystko` action that assembles all seven
   axis chapters into one downloadable PDF.
3. The combined document follows the canonical axis order and does not depend
   on the order in which the user visited the screens.
4. Both export paths render the same saved report revision and approved source
   state as the interactive Report. Export must not regenerate divergent text
   or silently incorporate later drafts.
5. The axis PDF contains the complete chapter: axis opening, Matrix visual, all
   applicable area commentaries and axis conclusions.
6. The combined PDF contains each complete axis chapter with clear chapter
   boundaries, continuous pagination and a generated table of contents.
7. Matrix visuals must be export-quality and text must paginate without clipped
   cards, missing comments, orphan headings or unreadable scaling.
8. The generated file records organization/document name, report revision,
   generation timestamp, method version and approval/publication state.

### Export-state rules

- Draft export is allowed only when visibly watermarked/labelled `DRAFT` and
  must not resemble an approved deliverable.
- Approved export must refer to the exact approved report revision from
  `ASM-OWN-023`.
- If any required chapter is missing or stale, `Eksportuj wszystko` must show an
  honest validation result; it cannot quietly omit the chapter.
- Repeated export of the same immutable revision should produce semantically
  identical content even if low-level PDF metadata differs.

### Atomic acceptance criteria

| ID                    | Criterion                                                                                                                            | Intake result              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| `ASM-PDF-AC-001`      | Every axis chapter can be exported individually as a complete, downloadable PDF.                                                    | `NOT_TESTED`               |
| `ASM-PDF-AC-002`      | `Eksportuj wszystko` produces one PDF containing all seven complete chapters in canonical axis order.                               | `NOT_TESTED`               |
| `ASM-PDF-AC-003`      | Individual and combined exports use the exact saved report revision and do not independently regenerate narrative.                  | `BACKEND_CONTRACT_NEEDED`  |
| `ASM-PDF-AC-004`      | Combined PDF includes clear chapter boundaries, continuous pagination, table of contents and required document/revision metadata.   | `NOT_TESTED`               |
| `ASM-PDF-AC-005`      | Draft exports are unmistakably marked; approved exports are cryptographically or immutably tied to the approved report revision.    | `BACKEND_CONTRACT_NEEDED`  |
| `ASM-PDF-AC-006`      | Missing, stale or failed chapters are reported and never silently omitted from an apparently complete export.                       | `FAILURE_PATH_PROOF_NEEDED`|
| `ASM-PDF-AC-007`      | Matrix graphics, tables and text pass screen and print QA without clipping, overflow, illegible scaling or color-only meaning.      | `VISUAL_PROOF_NEEDED`      |
| `ASM-PDF-AC-008`      | Piotr accepts both one-axis and full seven-axis PDFs generated from complete seeded Assessment data.                                | `OWNER_GATE_REQUIRED`      |

## ASM-OWN-027 — Settings information architecture, entitlement and report credits

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Classification: `TOOL_SETTINGS / COMMERCIAL_ENTITLEMENT / VERSIONING`
- Priority: `P0`
- Status: `CAPTURED_UNRECONCILED / COMMERCIAL_CONTRACT_NEEDED / NOT_ACCEPTED`

### Settings entry and cards

`Settings` is a separate tool-level action, not a fourth workspace tab. It opens
an organized Settings surface for the current Assessment document. The current
candidate information architecture is:

1. **Informacje o dokumencie** — method/session identity and business-readable
   document metadata from `ASM-OWN-012`;
2. **Subskrypcja i wykorzystanie** — entitlement, payment/access state, licences
   and report-generation allowance;
3. **Zespół i uprawnienia** — access, answering and approval capabilities from
   `ASM-OWN-023`;
4. **Akceptacje** — answer, target/Matrix and report gates from `ASM-OWN-023`,
   final label still subject to owner confirmation;
5. **Wersje** — document/report revision history and restoration/comparison
   actions subject to the safe versioning contract below.

### Subscription and entitlement contract

Assessment is a paid tool. Settings shows an authoritative, human-readable
entitlement state, including:

- subscription/product name and status;
- whether access is paid/current, trial/demo, past due, suspended or expired;
- licensed seats and currently assigned/remaining seats, when seat-limited;
- report-generation allowance/credits: included, consumed and remaining;
- renewal/reset period where applicable;
- a clear contact-sales action when paid capability is unavailable.

If no valid paid entitlement exists, the user may explore/complete the test in
an explicitly temporary demo mode but cannot persist Assessment answers or
generate a Report. This restriction must be disclosed before substantial input,
not only after the user clicks Save. Temporary answers must not create a false
saved state and must be lost only through a clearly communicated user choice or
session boundary.

Report generation is a monetized/usage-metered action. A credit is consumed
only after a defined successful generation outcome, never merely on button
click, validation failure, retry or infrastructure error. Re-exporting the same
immutable report revision should not consume a new generation credit unless
the commercial policy explicitly says otherwise. Exact charging, refund and
regeneration rules remain `COMMERCIAL_DECISION_REQUIRED`.

### Versioning contract

- show chronological Assessment versions with author, timestamp, lifecycle
  status and reason/source of the revision;
- identify which Interview, Matrix and Report revision is current and which is
  approved;
- approvals and exports remain tied to exact revisions;
- comparison is read-only and cannot silently mutate current state;
- restoration creates a new revision derived from the selected historical
  version rather than rewriting audit history;
- changing an approved upstream revision applies the invalidation rules from
  `ASM-OWN-023`.

### Atomic acceptance criteria

| ID                     | Criterion                                                                                                                               | Intake result                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `ASM-SET-AC-001`       | Separate Settings action opens the five-card structure without becoming another Assessment workspace mode.                            | `NOT_TESTED`                  |
| `ASM-SET-AC-002`       | Subscription card shows authoritative entitlement/payment, seats and report-credit totals with source and refresh state.              | `BACKEND_CONTRACT_NEEDED`     |
| `ASM-SET-AC-003`       | Unpaid/demo mode permits explicitly temporary exploration but cannot persist answers or generate a report.                            | `SECURITY_AND_RUNTIME_PROOF`  |
| `ASM-SET-AC-004`       | The user is warned before entering non-persistable work and UI never displays false Save/approved states.                             | `NOT_TESTED`                  |
| `ASM-SET-AC-005`       | Unentitled state provides a clear, non-deceptive contact-sales path without exposing internal billing data.                           | `NOT_TESTED`                  |
| `ASM-SET-AC-006`       | Report credit is decremented atomically only for the agreed successful-generation event and retries/failures cannot double-charge.    | `COMMERCIAL_DECISION_NEEDED`  |
| `ASM-SET-AC-007`       | Version history preserves actor/time/status/reason and approvals/exports reference exact immutable revisions.                         | `BACKEND_CONTRACT_NEEDED`     |
| `ASM-SET-AC-008`       | Restoring history creates a new revision; it cannot erase audit lineage or retain stale downstream approvals.                         | `RUNTIME_PROOF_NEEDED`        |

## ASM-OWN-028 — Human comments and advisory AI analysis for Matrix and Report

- Route observed: `/assessment/drd/1113db5d-fb9b-4e91-8812-46525cf60c5c`
- Product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
- Persona: local seeded `OWNER`
- Classification: `COLLABORATION / AI_REVIEW / CROSS_METHOD_CAPABILITY`
- Priority: `P0`
- Status: `CAPTURED_UNRECONCILED / AI_CONTRACT_NEEDED / NOT_ACCEPTED`

### Human collaboration

Both Matrix and Report allow authorized people to comment on the relevant
object rather than only on the document globally:

- Matrix: axis, area/cell, AS-IS decision, TO-BE decision or gap;
- Report: axis chapter, area commentary, Matrix visual/caption, conclusion or
  recommendation.

Comments retain author, timestamp, object/revision anchor, resolution state and
thread history. A resolved comment remains auditable. A comment does not change
the score, target, report text or approval by itself.

### AI Analysis contract

The common `AI Analysis` action reviews the current Assessment state and
produces a proposed, reviewable change list. Its purpose is to challenge the
human result, not rubber-stamp it. Depending on the active mode it should detect
and explain at least:

- missing answers, evidence, rationale or required approvals;
- contradictory answers/evidence or non-contiguous maturity claims;
- targets unsupported by enterprise context, prerequisites or time horizon;
- gaps or dependencies omitted from the Matrix transformation scope;
- report conclusions not grounded in approved inputs;
- weak, generic or inconsistent recommendations;
- stale downstream content after upstream changes;
- opportunities or alternative targets worth human consideration.

Each AI proposal contains: affected object, issue/observation, supporting
sources, proposed change, rationale, confidence/uncertainty and expected
consequence. Proposals are drafts. The user may inspect, accept individually,
edit or reject them. No AI action silently changes AS-IS, TO-BE, evidence,
comments, approvals or report content. Accepted changes use ordinary canonical
write/version/audit flows and may trigger reapproval.

### Flexible Assessment platform requirement

The navigation shell, Settings, permissions, approvals, comments, AI proposal
workflow, versioning and exports must be reusable across DRD and future
Assessment methods. Method-specific adapters/configuration supply:

- hierarchy and terminology (axes/dimensions/areas/levels/questions);
- decision semantics and scoring rules;
- evidence requirements;
- Matrix/visualization model;
- report chapter structure and methodology sources;
- approval requirements and commercial entitlements where they differ.

The shared shell must not hard-code `7 axes`, DRD level counts, cumulative
scoring, `Achieved/Target/Skip`, or the DRD report template as universal truths.
For the active DRD method pack, those configured values produce the seven-axis
experience selected by Piotr.

### Atomic acceptance criteria

| ID                     | Criterion                                                                                                                               | Intake result                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `ASM-AI-AC-001`        | Matrix and Report support anchored, threaded, resolvable comments with author, revision and audit history.                             | `BACKEND_CONTRACT_NEEDED`    |
| `ASM-AI-AC-002`        | Comments cannot implicitly change scoring, target, report content or approval state.                                                   | `NOT_TESTED`                 |
| `ASM-AI-AC-003`        | AI Analysis reviews completeness, evidence, contradictions, target logic, dependencies, grounding and stale content.                  | `AI_QUALITY_PROOF_NEEDED`    |
| `ASM-AI-AC-004`        | AI returns an inspectable list of sourced proposals with rationale/confidence; no proposal is auto-applied.                            | `AI_SAFETY_PROOF_NEEDED`     |
| `ASM-AI-AC-005`        | Accept/edit/reject works per proposal and accepted changes use canonical writes, versioning, audit and reapproval rules.               | `RUNTIME_PROOF_NEEDED`       |
| `ASM-AI-AC-006`        | Shared Assessment shell contains no DRD-only hierarchy, scoring or report assumptions; these enter through a versioned method adapter.| `ARCHITECTURE_PROOF_NEEDED`  |
| `ASM-AI-AC-007`        | A second structurally different Assessment fixture proves the same shell supports another hierarchy and decision model.               | `CROSS_METHOD_PROOF_NEEDED`  |
| `ASM-AI-AC-008`        | AI suggestions remain clearly advisory and cannot bypass role, subscription or approval gates.                                        | `SECURITY_PROOF_NEEDED`      |
