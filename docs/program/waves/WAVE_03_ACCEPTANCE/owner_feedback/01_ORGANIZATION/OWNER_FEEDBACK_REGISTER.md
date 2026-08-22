# Organization — owner feedback register

Date opened: `2026-08-21`

Intake status: `OWNER_REVIEW_IN_PROGRESS / CAPTURED_UNRECONCILED`

## ORG-OWN-001 — Remove “Megatrendy” from the Organization menu

- Module: `Organization`
- Screen/route: `Profil firmy / Organization inner sidebar`; route `NOT VERIFIED`
- Category: `UI / UX`
- Piotr's original wording (verbatim):

  > Z menu trzeba wywalić zakładkę „Megatrendy”, bo ona linkuje teraz do narzędzi. Wywal więc zakładkę „Megatrendy” z menu.

- Current behavior: The Organization inner sidebar contains a “Megatrendy”
  entry. According to Piotr, it now links to tools rather than representing a
  valid standalone Organization section.
- Expected experience: “Megatrendy” is not displayed in the Organization
  menu. Access to the relevant tools remains in the navigation intended for
  tools.
- Impact: The current entry is misleading or redundant and may suggest that
  “Megatrendy” is a separate part of Organization.
- Proposed importance: `HIGH` — affects primary module navigation and can
  misdirect users on every visit.
- Evidence: `ORG-EVD-002`, `ORG-EVD-003`
- Open questions: None.
- Status: `CAPTURED_UNRECONCILED`

## ORG-OWN-002 — Standardize the Organization screen layout

- Module: `Organization`
- Screens/routes: `Profil firmy`, `Cele i oczekiwania`, `Wyzwania`,
  `Synteza strategiczna`, `Graf wiedzy`, `Context governance`; routes
  `NOT VERIFIED`
- Category: `UI / UX / CX`
- Piotr's original wording (verbatim):

  > Dobrze, duża rzecz to jest uspójnienie założeń graficznych. Zobacz, wszystkie ekrany powinny mieć taki sam layout. Teraz profil firmy jest jakąś pozostałością dziwnej zakładki w zakładkach, więc trzeba to wystandaryzować i zbudować menu wertykalne. Czyli mamy kilka poziomych modułów, czyli wewnętrzny sidebar, a poza tym menu poziome, w którym znajdują się zakładki – we wszystkich ekranach oprócz profilu firmy.
  >
  > Tutaj jest to skonstruowane inaczej. Więc trzeba wystandaryzować layout. To jest pierwsze duże zadanie.

- Piotr's additional wording (verbatim, later clarification):

  > Ten ukłd dotalnie nie pasuje do obecnego UI/UX aplikacji. to trzeba zalanować zuepnie od zera. ~apropnować nowy układ na 3,4 kartach manu wertykalnego i dotego doożyc karte 5 ze zbiorem dodawanych plików i mamy liste pików, I na koniec kartę gotowosci i zakesu wypenienia informajci o rganizacji

- Current behavior:
  - Company Profile uses a distinct content structure based on vertically
    stacked expandable sections.
  - The other reviewed screens use the shared Organization inner sidebar.
  - Screens with subsections, including Goals & Expectations, Challenges and
    Strategic Synthesis, expose them as horizontal tabs above the content.
  - Company Profile does not follow that pattern and appears to Piotr as a
    remnant of an earlier nested-tab concept.
  - The current Company Profile is a long accordion/form composition whose
    sections continue vertically across several viewport heights.
- Expected experience:
  - All Organization screens use one recognizable layout and navigation system.
  - The shared hierarchy includes the module's inner sidebar and a horizontal
    tab menu for screen subsections.
  - Company Profile is rebuilt to follow the common standard instead of
    remaining an accordion-based exception.
  - The Company Profile information architecture is designed again from the
    beginning rather than cosmetically adapting the existing accordion.
  - The primary profile content is grouped into approximately `3–4` vertical
    menu cards.
  - A separate fifth card contains the collection and list of files added to
    the organization profile.
  - A final card presents readiness and the scope/completeness of Organization
    information.
  - Moving between Organization screens does not change the navigation logic
    or visual model of the page.
- Impact: The inconsistency weakens predictability, makes the information
  hierarchy harder to understand and gives the impression that different
  product generations have been joined together.
- Proposed importance: `HIGH / CROSS-CUTTING` — Piotr explicitly called this
  the first large task and it establishes the module-wide layout standard.
- Evidence: `ORG-EVD-004` through `ORG-EVD-012`
- Open question: `ORG-Q-001`
- Status: `CAPTURED_UNRECONCILED`

## Open questions

### ORG-Q-001 — Target Company Profile hierarchy

- Question: What is the exact grouping and naming of the proposed `3–4`
  primary vertical cards, and should the file and readiness cards be counted
  inside or in addition to that number? The file-list and final
  readiness/completeness purposes are now stated, but the mapping of existing
  fields into the primary cards remains open.
- Related observation: `ORG-OWN-002`
- Status: `OPEN_UNRECONCILED`

## ORG-OWN-003 — Redesign the Organization information architecture as a whole

- Module: `Organization`
- Screens/routes: `Cele i oczekiwania`, `Wyzwania`, `Synteza strategiczna`,
  `Graf wiedzy`, `Context governance`; routes `NOT VERIFIED`
- Category: `UI / UX / CX / INFORMATION ARCHITECTURE`
- Piotr's original wording (verbatim):

  > Układ graficzny jest totalnie nieakcpetowany ale tez nie ma ensu abym pisał całosć sam. Zrob teraz dla mne przeglad tych obrazów i powołaj 3 ekspertów z BCG, Mackinzej i IMP i zaproponujcie jak mozna zorganizowac te karty lepiej i spisz to jako moje uwagi. Dodatkowo pisz jak to optymalnie tutaj opisać.

- Piotr's additional direction (verbatim):

  > Tak ale tutaj chciałym wyjatowo aby eksperci opisali jak powinny wyglądać te ekrany - co powinny zawierać, jak go poukładać. Tutaj ta praca jest do zrobienia prawie od zera. ale całkowicie trzeba to opisac.

- Current behavior:
  - The module mixes primary navigation, workflow stages, raw input fields,
    analytical outputs and technical data-governance controls.
  - Goals uses a narrow working area inside a very wide canvas and offers no
    visible next-step or module-level progress summary.
  - Challenges and Strategic Synthesis use very wide table structures even
    when only one record is present.
  - Knowledge Graph presents a dominant empty surface without a strong first
    action, explanation of prerequisites or useful partial state.
  - Context governance combines sources, conflicts and a long claim queue in
    one technical view, exposing identifiers and internal field names.
  - The repeated Teresa context bar competes with the task content while not
    explaining concrete gaps or actions.
- Expected experience — owner-requested expert synthesis, not verbatim:
  - Use one stable Organization page shell: title and purpose, compact global
    context/readiness status, local navigation, primary insight or issue,
    actions, working content, and contextual provenance/quality detail.
  - Organize Company Profile into six cards following a clear progression:
    `Identity & Scale → Operating Model → Strategic Direction → Constraints &
    Preferences → Sources & Files → Readiness & Decisions`.
  - Use the Organization inner sidebar only for primary module destinations;
    use horizontal tabs only for peer subsections of the active destination;
    use content cards for information and actions, never as duplicate
    navigation.
  - Remove “Megatrendy” from the Organization menu. Treat Knowledge Graph as a
    cross-cutting exploration mode rather than a mandatory workflow step.
  - Consolidate source management in “Sources & Files” and surface conflicts,
    missing information and approval decisions in “Readiness & Decisions”.
  - Replace large empty surfaces with states that explain value, prerequisites
    and one primary next action.
  - Use list/cards for small collections and reserve tables for larger data
    sets requiring comparison, filtering or bulk work.
  - Translate technical names and identifiers into business labels; keep
    technical detail behind an explicit detail control.
  - Every card shows its purpose, completeness, items needing attention,
    saved state and the next action.
  - Business completeness is evaluated against an explicit minimum dataset,
    not merely whether UI fields contain values. The review must expose entity
    scope, reporting period and units, evidence owner/source/freshness,
    confidence and decision relevance.
- Impact: The current structure does not give users a coherent path from
  organization data through evidence and analysis to readiness and decisions.
  It makes the product look unfinished and increases the effort required to
  understand what to do next.
- Proposed importance: `CRITICAL / CROSS-CUTTING` — Piotr explicitly rejected
  the graphical system as a whole; the issue affects the complete Organization
  workflow and the standard for all its screens.
- Expert review: [`ORG-OWN-003_EXPERT_SYNTHESIS.md`](ORG-OWN-003_EXPERT_SYNTHESIS.md)
- Complete screen blueprint: [`ORG-OWN-003_SCREEN_BLUEPRINT.md`](ORG-OWN-003_SCREEN_BLUEPRINT.md)
- Evidence: `ORG-EVD-013` through `ORG-EVD-017`
- Open questions: `ORG-Q-002` through `ORG-Q-007`
- Status: `CAPTURED_UNRECONCILED`

### ORG-Q-002 — Organization destination model

- Question: Should Knowledge Graph remain a sidebar destination or become a
  cross-cutting view available from every Organization screen, and should
  Context governance disappear as a standalone destination after its
  functions move into Sources and Readiness?
- Related observation: `ORG-OWN-003`
- Status: `OPEN_UNRECONCILED`

### ORG-Q-003 — Final six-card terminology

- Question: Confirm final Polish and English names for the six proposed cards
  and whether “Readiness & Decisions” includes the final owner approval of the
  Organization context or only reports completeness and blockers.
- Related observation: `ORG-OWN-003`
- Status: `OPEN_UNRECONCILED`

### ORG-Q-004 — Minimum business dataset and readiness formula

- Question: Which fields are mandatory for the Organization context to support
  real decisions, which are optional by organization type, and how exactly do
  missing, stale, conflicting or unsupported values affect readiness?
- Related observation: `ORG-OWN-003`
- Status: `OPEN_UNRECONCILED`

### ORG-Q-005 — Entity and reporting scope

- Question: Does the profile describe the legal entity, consolidated group,
  business unit or transformation perimeter, and what reporting period,
  currency and units apply to quantitative fields?
- Related observation: `ORG-OWN-003`
- Status: `OPEN_UNRECONCILED`

### ORG-Q-006 — Accountability and evidence quality

- Question: Who owns each material fact, what is its source and effective date,
  when does it expire, and how are confidence and conflicts represented?
- Related observation: `ORG-OWN-003`
- Status: `OPEN_UNRECONCILED`

### ORG-Q-007 — Boundary between business profile and AI settings

- Question: Should communication and AI preferences remain part of the
  business profile, or move to a separate assistant/settings area so that
  Organization readiness measures business context rather than configuration?
- Related observation: `ORG-OWN-003`
- Status: `OPEN_UNRECONCILED`

## ORG-OWN-004 — Remove Administration from the Organization menu

- Module: `Organization`
- Screen/route: `Context governance / Organization inner sidebar`; route
  `NOT VERIFIED`
- Category: `UI / UX / INFORMATION ARCHITECTURE`
- Piotr's original wording (verbatim):

  > DObra to tytaj mamy w men na dole Administacja - usun to z memu moduy organizacja bo mamy odizelnie mou administracja

- Current behavior: The Organization inner sidebar ends with an expandable
  `ADMINISTRACJA` section even though the application already exposes a
  separate Administration/Admin module in the primary navigation.
- Expected experience: The `ADMINISTRACJA` section is not displayed inside the
  Organization menu. Administrative functions remain available only through
  the dedicated Administration module and its authorized navigation.
- Impact: Duplicated navigation blurs module boundaries, creates uncertainty
  about the canonical entry point and makes Organization appear to own
  administrative functions that belong elsewhere.
- Proposed importance: `HIGH` — affects primary information architecture and
  consistency across every Organization screen.
- Evidence: `ORG-EVD-018`
- Open questions: None.
- Status: `CAPTURED_UNRECONCILED`

## Register counters

- Observations: `4`
- Evidence items: `18`
- Open questions: `7`
- Owner decisions: `0`
- Fixed: `0`
- Accepted: `0`
