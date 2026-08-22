# Cross-module — owner feedback register

Date opened: `2026-08-21`

## XMOD-OWN-002 — Standardize and widen the working-content column

- Modules: `Organization / Admin / Settings`
- Screen: `Organization Profile → Identity & Scale`; route `NOT VERIFIED`
- Scope: every child screen in the three modules
- Category: `UI / UX / VISUAL CONSISTENCY / RESPONSIVE LAYOUT`
- Piotr's original wording (verbatim):

  > Dobra, słuchaj, to ja ci w takim razie zgłoszę trochę odbiorów, które włożysz, a później do rejestru i dokładnie opiszesz, ok? Zacznijmy od tego, że musisz przejść najlepiej sam przez wszystkie zakładki, jakie mamy w organizacji, adminie i ustawieniach, ale wszystkie i przeanalizować szerokość tych ekranów. Albo inaczej: wyznacz po prostu szerokość ekranu, szerszą niż ten, który tutaj mamy, i zmień wszystkie ekrany, żeby miały tę samą szerokość kolumny, w której są narzędzia. Teraz wszystkie zakładki mają zupełnie różne kolumny.

- Current behavior:
  - according to Piotr, child screens across Organization, Admin and Settings use
    inconsistent working-column widths;
  - the supplied Identity & Scale screen shows a comparatively narrow centered
    working column within a much wider available content region;
  - banners, status blocks, action rows, form cards and other tools inherit this
    narrow column, leaving substantial unused horizontal space;
  - no evidence yet demonstrates a shared width contract across every child screen.
- Expected experience:
  - every child screen in the three modules uses the same content-container contract;
  - the working column is visibly wider than the supplied Identity & Scale state;
  - banners, headers, toolbars, cards, forms, lists and ordinary tables align to the
    same left/right edges;
  - navigation width remains separate and does not change the content contract;
  - switching modules or child screens does not cause the working column to jump,
    shrink or expand without a declared screen-type reason.
- Expert-proposed measurable contract:
  - desktop content container: `width: 100%`, `max-width: 1280px`;
  - container centered within the space remaining after global and domain sidebars;
  - horizontal page gutter uses the shared Settings spacing token, with a minimum
    equivalent of `24px` on desktop and `16px` on compact/mobile layouts;
  - header, alerts, summary, primary action row and main tool cards share the same
    container edges;
  - ordinary forms do not introduce a second narrower page-level max-width;
  - form fields may use internal grids, but their parent card remains full container
    width;
  - large graph, audit-diff or data-grid screens may use a documented `WIDE_DATA`
    variant up to available width, but their header/actions still align with the
    canonical `1280px` container;
  - no screen-specific arbitrary width or inline max-width is allowed.
- Responsive rule:
  - desktop: canonical `1280px` maximum after sidebars;
  - tablet: full remaining width with shared gutters and domain menu drawer;
  - mobile: full width minus shared `16px` gutters, single-column controls;
  - no basic workflow requires horizontal page scrolling.
- Impact: inconsistent widths make the three reconstructed modules appear to use
  different design systems, waste workspace and produce visible layout movement
  while navigating.
- Proposed importance: `HIGH / CROSS-CUTTING`
- Evidence: `XMOD-EVD-002`
- Acceptance criteria: `XMOD-WIDTH-AC-001` through `XMOD-WIDTH-AC-006`
- Status: `CAPTURED_UNRECONCILED`

### Acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| `XMOD-WIDTH-AC-001` | Every Organization, Admin and Settings child screen resolves to the same canonical content-container component/token | `NOT_TESTED` |
| `XMOD-WIDTH-AC-002` | At desktop acceptance width, ordinary content uses `100%` width up to `1280px` after sidebars | `NOT_TESTED` |
| `XMOD-WIDTH-AC-003` | Breadcrumb, header, alerts, actions and main cards align to identical left/right container edges | `NOT_TESTED` |
| `XMOD-WIDTH-AC-004` | Navigation between all child screens produces no unexplained horizontal width jump | `NOT_TESTED` |
| `XMOD-WIDTH-AC-005` | Any `WIDE_DATA` exception is named, limited to data canvas/grid and preserves canonical header/action alignment | `NOT_TESTED` |
| `XMOD-WIDTH-AC-006` | Tablet/mobile use shared gutters and complete primary workflows without horizontal page scrolling | `NOT_TESTED` |

## XMOD-OWN-003 — Establish one semantic typography scale

- Modules: `Organization / Admin / Settings`
- Evidence screen: `Organization Profile → Identity & Scale`; route `NOT VERIFIED`
- Scope: all headings, body copy, labels, helper text, controls, navigation and KPI
  values on every child screen
- Category: `UI / UX / VISUAL CONSISTENCY / ACCESSIBILITY`
- Piotr's original wording (verbatim):

  > Druga, mega kompleksowa sprawa. Trzeba przejść przez wszystkie zakładki i zidentyfikować, zobacz, wielkości czcionek w nagłówkach i w tekstach. Nie ma w tym żadnego składu i ładu. Jakby każdy jest inny. To znaczy, ja mam takie wrażenie, że one mają jakiś system, tylko ten system totalnie nie ma sensu. Więc wyznacz jeden wspólny system wielkości czcionek na poszczególnych nagłówkach i zrób to teraz poprawnie. Ale do tego trzeba zrobić analizę wszystkich zakładek z organizacją, adminem i settings.

- Current behavior:
  - according to Piotr, heading and text sizes across the three modules lack a
    coherent, understandable hierarchy;
  - the supplied screen simultaneously exposes breadcrumb labels, page title and
    subtitle, alert text, context action, profile title and subtitle, completeness
    label/value, helper/link text, assistant-card text and button text;
  - their relative weight and size do not produce an immediately legible hierarchy;
  - no evidence yet demonstrates that equivalent semantic roles use one shared token
    across all child screens.
- Expected experience:
  - typography reflects semantic role, never the module or an individual component's
    local styling;
  - equivalent page titles, section titles, card titles, labels, help text and buttons
    use exactly the same type token in Organization, Admin and Settings;
  - the hierarchy is visible without relying on colour alone;
  - dense administrative screens remain readable without shrinking core text below
    the shared body/caption limits;
  - responsive layouts preserve hierarchy instead of scaling every element freely.
- Expert-proposed desktop type scale:

| Token | Use | Size / line-height | Weight | Additional rule |
|---|---|---:|---:|---|
| `type.display` | Exceptional domain landing title only | `28 / 36px` | `700` | Not used inside ordinary child screens |
| `type.pageTitle` | One H1 per child screen | `24 / 32px` | `700` | Sentence/title case |
| `type.sectionTitle` | Major H2 section or management summary | `20 / 28px` | `700` | No visual substitution for page title |
| `type.cardTitle` | Card/section H3 | `16 / 24px` | `600` | Icon optional; same baseline |
| `type.body` | Standard descriptions and values | `14 / 20px` | `400` | Default readable UI copy |
| `type.bodyStrong` | Emphasis, row title, important value | `14 / 20px` | `600` | Not a heading replacement |
| `type.fieldLabel` | Form/control label | `14 / 20px` | `600` | Programmatically linked to control |
| `type.helper` | Help, secondary explanation, metadata | `13 / 18px` | `400` | Muted colour allowed |
| `type.caption` | Timestamp, provenance, compact badge support | `12 / 16px` | `400–600` | Minimum ordinary UI text size |
| `type.breadcrumb` | Breadcrumb and compact overline | `11 / 16px` | `600` | Uppercase allowed; controlled tracking |
| `type.control` | Button, select and input value | `14 / 20px` | `500–600` | Identical across modules |
| `type.kpi` | Primary numeric KPI | `24 / 28px` | `700` | Label uses helper/caption token |

- Responsive typography:
  - tablet keeps the desktop semantic scale unless available width causes verified
    truncation;
  - mobile changes only `pageTitle` to `22/28px`, `sectionTitle` to `18/24px` and
    `kpi` to `22/28px`;
  - body, label, helper and caption sizes do not shrink below the values above;
  - text reflows, wraps or moves controls below labels before reducing font size.
- Implementation rule:
  - the values above become shared semantic tokens or are mapped to equivalent
    existing Settings tokens after inventory;
  - components consume semantic tokens; screen-level arbitrary font sizes, inline
    values and module-specific copies are prohibited;
  - exactly one H1 exists per screen and heading levels follow document order;
  - badges may use caption, but critical explanations never appear only inside a
    badge or tooltip.
- Impact: inconsistent typography damages hierarchy, perceived quality, scanning
  speed and accessibility throughout all three major modules.
- Proposed importance: `HIGH / CROSS-CUTTING`
- Evidence: `XMOD-EVD-003`
- Acceptance criteria: `XMOD-TYPE-AC-001` through `XMOD-TYPE-AC-008`
- Status: `CAPTURED_UNRECONCILED`

### Typography acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| `XMOD-TYPE-AC-001` | Inventory maps every visible text role on every child screen to one approved semantic token | `NOT_TESTED` |
| `XMOD-TYPE-AC-002` | Equivalent roles render with the same size, line-height and weight across Organization, Admin and Settings | `NOT_TESTED` |
| `XMOD-TYPE-AC-003` | Every screen contains exactly one H1 and follows ordered H1→H2→H3 semantics | `NOT_TESTED` |
| `XMOD-TYPE-AC-004` | No ordinary readable text is smaller than `12/16px`; body and field labels meet the defined minimums | `NOT_TESTED` |
| `XMOD-TYPE-AC-005` | PL/EN labels wrap or reflow without clipping, overlap or hidden actions | `NOT_TESTED` |
| `XMOD-TYPE-AC-006` | At 200% zoom, hierarchy, controls and complete tasks remain available without loss of information | `NOT_TESTED` |
| `XMOD-TYPE-AC-007` | Mobile applies only the documented responsive token changes and never shrinks body/helper/caption | `NOT_TESTED` |
| `XMOD-TYPE-AC-008` | Visual comparison on exact SHA shows no screen-level arbitrary font-size exceptions | `NOT_TESTED` |

## XMOD-OWN-004 — Standardize the breadcrumb location and behavior

- Modules: `Organization / Admin / Settings`
- Evidence screens: `Admin Panel → Team & Access → Members` and `Settings → Profile`; routes `NOT VERIFIED`
- Scope: every child screen in the three modules
- Category: `UI / UX / INFORMATION ARCHITECTURE / WAYFINDING`
- Piotr's original wording (verbatim):

  > Dobrze, teraz wystandaryzuj, w którym miejscu będzie ścieżka dostępu. Tutaj mamy **Settings Profile** w lewym rogu nad tabelą. Idealnie, w jednym miejscu wiadomo, gdzie jest użytkownik. Ten napis dokładnie tu powinien być.

- Current behavior:
  - Admin shows `ADMIN PANEL > TEAM & ACCESS > MEMBERS` above its title;
  - Settings shows `Settings > Profile` in a separate top strip;
  - the examples do not yet prove one shared component, offset or vertical rhythm across every screen.
- Expected experience:
  - every child screen begins with one breadcrumb in a fixed top-left slot of the canonical content container;
  - it identifies domain, module and current screen, aligned with the page title and primary content;
  - ancestors are links; the current leaf is non-linking and has `aria-current="page"`;
  - refresh and deep-link entry reproduce the same breadcrumb and selected navigation state.
- Responsive rule: intermediate segments may collapse into an accessible ellipsis, but the current leaf remains visible and never overlaps the primary action.
- Impact: inconsistent wayfinding forces re-orientation and weakens the shared information architecture.
- Proposed importance: `HIGH / CROSS-CUTTING`
- Evidence: `XMOD-EVD-004`, `XMOD-EVD-005`
- Acceptance criteria: `XMOD-BREADCRUMB-AC-001` through `XMOD-BREADCRUMB-AC-006`
- Status: `CAPTURED_UNRECONCILED`

### Breadcrumb acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| `XMOD-BREADCRUMB-AC-001` | Every child screen uses the shared breadcrumb in the fixed top-left screen-header slot | `NOT_TESTED` |
| `XMOD-BREADCRUMB-AC-002` | The hierarchy follows `Domain > Module > Screen`, omitting only genuinely absent levels | `NOT_TESTED` |
| `XMOD-BREADCRUMB-AC-003` | Breadcrumb, H1 and content share the canonical left edge and stable vertical spacing | `NOT_TESTED` |
| `XMOD-BREADCRUMB-AC-004` | Ancestors navigate correctly; the leaf is non-linking and carries `aria-current="page"` | `NOT_TESTED` |
| `XMOD-BREADCRUMB-AC-005` | Direct entry, refresh and browser history preserve breadcrumb and sidebar selection | `NOT_TESTED` |
| `XMOD-BREADCRUMB-AC-006` | Compact layouts retain the current leaf without clipping, overlap or loss of accessible hierarchy | `NOT_TESTED` |

## XMOD-OWN-005 — Put Save Changes in one canonical header action slot

- Modules: `Organization / Admin / Settings`
- Evidence screen: `Settings → Profile`; route `NOT VERIFIED`
- Scope: every editable child screen/card in the three modules
- Category: `UI / UX / ACTION CONSISTENCY / FORM STATE`
- Piotr's original wording (verbatim):

  > Wprowadź teraz takie menu, jak mamy tutaj, w każdym ustawieniu, czyli w każdym ekranie, oraz przycisk **Save Changes**. Wstaw je do góry, dokładnie w tę linię, aby we wszystkich kartach znajdowały się w tym samym miejscu.Czyli to są dwa zgłoszenia. Jedno zgłoszenie to jest w lewym górnym rogu – ścieżka dostępu –, a drugie zgłoszenie to przycisk „Save”, żeby na wszystkich kartach był w tym samym miejscu.

- Current behavior:
  - Settings Profile places `Save Changes` at the right side of the title/header line;
  - other screens expose actions at different levels or do not demonstrate a common save location;
  - evidence does not yet prove consistent dirty, saving, success, error or readback states.
- Expected experience:
  - every editable screen uses one right-aligned primary-action slot on the same header line as its title block;
  - the standard form action is `Save Changes` and remains there irrespective of card length;
  - one authoritative save communicates `CLEAN`, `DIRTY`, `SAVING`, `SAVED` and `ERROR`;
  - success is never shown without server acknowledgement and readback;
  - non-save workflows use the same slot but a truthful verb such as `Invite`, `Publish` or `Export`.
- Responsive rule: the header may stack, but the action remains associated with the title and reachable without scrolling to the end of a long form.
- Impact: moving save controls cause missed or duplicate saves and obscure durable persistence.
- Proposed importance: `HIGH / CROSS-CUTTING`
- Evidence: `XMOD-EVD-005`
- Acceptance criteria: `XMOD-SAVE-AC-001` through `XMOD-SAVE-AC-007`
- Status: `CAPTURED_UNRECONCILED`

### Save-action acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| `XMOD-SAVE-AC-001` | Every editable screen exposes one primary save action in the canonical right-side screen-header slot | `NOT_TESTED` |
| `XMOD-SAVE-AC-002` | Ordinary forms use `Save Changes`; other verbs are reserved for semantically different actions | `NOT_TESTED` |
| `XMOD-SAVE-AC-003` | The button is disabled when clean or blocked, with the blocking reason available | `NOT_TESTED` |
| `XMOD-SAVE-AC-004` | Dirty, saving, saved and error states are visibly and accessibly communicated | `NOT_TESTED` |
| `XMOD-SAVE-AC-005` | Success appears only after server acknowledgement and persisted-value readback | `NOT_TESTED` |
| `XMOD-SAVE-AC-006` | Validation focuses the first invalid field and preserves all unsaved input | `NOT_TESTED` |
| `XMOD-SAVE-AC-007` | Long and compact layouts keep the save reachable without a conflicting second primary action | `NOT_TESTED` |

## XMOD-OWN-006 — Apply one professional visual system card by card

- Modules: `Organization / Admin / Settings`
- Scope: every canonical child screen and every component/card rendered within it
- Category: `UI / UX / DESIGN SYSTEM / VISUAL QA / ACCESSIBILITY`
- Piotr's original wording (verbatim):

  > Dobrze, i teraz prawdopodobnie największe zadanie. Wprowadź jeden standard graficzny dla czcionek, ich wielkości i kolorów. W zależności od charakteru czcionki mogą się różnić, ale w ramach jednego typu komponentów powinny być spójne.
  >
  > Ustal jednolite zasady kolorystyki, ramek i tła, tak aby wszystkie narzędzia wyglądały tak profesjonalnie, jak już dopracowane elementy w naszej aplikacji.
  >
  > Opis standardu powinien zostać wprowadzony, a następnie przejść przez wszystkie karty. Wykonaj zadanie, przeglądając każdą kartę osobno i dostosowując wszystkie komponenty, aby były wystandaryzowane. Proponuję, żeby to tutaj, w tym czacie, w rejestrze błędów zrobić tę pracę, a nie nakazywać jej wykonawcy, bo wykonawca to zignoruje i nie przejdzie wszystkiego na pewno. Jak będzie miał precyzyjną listę zadań, to wtedy to zrobi.

- Current behavior:
  - Piotr reports inconsistent typography, sizes, colours, borders and backgrounds;
  - components with the same semantic purpose may present different visual rules;
  - a general implementation instruction would not prove that every card was inspected;
  - exact-SHA card-by-card visual inventory remains `NOT_EXECUTED`.
- Expected experience:
  - the same semantic component uses the same typography, colour, surface, border,
    radius, spacing, focus and state tokens in all three modules;
  - differences are allowed only when the component's semantic role differs;
  - refined existing application components are reused as the implementation source,
    not approximated from screenshots;
  - every canonical child screen receives an individually recorded desktop,
    compact and state review before this work can pass.
- Required execution packet: [`VISUAL_STANDARD_CARD_AUDIT.md`](VISUAL_STANDARD_CARD_AUDIT.md)
- Impact: without a finite per-screen checklist, broad visual-standardization work can
  be declared complete while leaving inconsistent cards and states behind.
- Proposed importance: `CRITICAL / CROSS-CUTTING`
- Evidence: no new visual evidence supplied with this observation
- Acceptance criteria: `XMOD-VISUAL-AC-001` through `XMOD-VISUAL-AC-010`
- Status: `CAPTURED_UNRECONCILED`

### Visual-system acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| `XMOD-VISUAL-AC-001` | Every canonical child screen has its own completed audit row and linked before/after evidence | `NOT_TESTED` |
| `XMOD-VISUAL-AC-002` | Equivalent text roles map to the typography tokens defined under `XMOD-OWN-003` | `NOT_TESTED` |
| `XMOD-VISUAL-AC-003` | Page, card, nested, selected, disabled and overlay surfaces use shared semantic background tokens | `NOT_TESTED` |
| `XMOD-VISUAL-AC-004` | Borders, dividers, radii and shadows are selected by component role, not by screen | `NOT_TESTED` |
| `XMOD-VISUAL-AC-005` | Neutral, accent, focus, info, success, warning, error and destructive colours have one meaning across modules | `NOT_TESTED` |
| `XMOD-VISUAL-AC-006` | Red is reserved for error/destructive semantics and is not used for ordinary selection | `NOT_TESTED` |
| `XMOD-VISUAL-AC-007` | Inputs, selects, toggles, checks, tables, cards, banners and buttons share canonical dimensions and states | `NOT_TESTED` |
| `XMOD-VISUAL-AC-008` | Hover, focus-visible, active, disabled, loading, empty, validation and error states are reviewed per applicable component | `NOT_TESTED` |
| `XMOD-VISUAL-AC-009` | PL/EN, 200% zoom, keyboard and compact layouts preserve hierarchy, contrast and task completion | `NOT_TESTED` |
| `XMOD-VISUAL-AC-010` | No arbitrary screen-local font, colour, border, background, radius or shadow values remain | `NOT_TESTED` |

## XMOD-OWN-007 — Full per-screen component conformity and repair register

- Modules: `Organization / Admin / Settings`
- Scope: all `109` canonical child screens, inspected and reconciled separately
- Category: `UI / UX / COMPONENT SYSTEM / VISUAL QA / EXECUTION CONTROL`
- Piotr's original wording (verbatim):

  > Zasłuchaj, to teraz kolejne duże zadanie. Chciałbym, żebyś rozpisał dla wszystkich ekranów pełne przejście i analizę, czy wszystkie komponenty są zgodne ze standardem: wszystkie ramki, wszystkie tła, wszystkie czcionki, wszystkie rozwijane listy. Tak, żeby ujednolicić w całości cały zestaw graficzny dla wszystkich kart z organizacją, administracją i ustawieniami. Musisz to rozpisać jako przejście przez wszystkie karty oddzielnie, tak jak wcześniej robiliście nagłówki. Przygotuję kompletny zestaw napraw tutaj. Wpisz to do rejestru pracy.

- Current behavior:
  - the documentation identifies all canonical screens, but runtime conformity of
    every rendered component remains `NOT_INSPECTED`;
  - the previous visual checklist did not explicitly enumerate the mandatory
    component families inside each individual screen row;
  - no exact-SHA evidence currently proves conformity or identifies all repairs.
- Expected experience:
  - every screen is inspected separately against the same twelve component checks;
  - every visible instance of frames, backgrounds, typography, dropdowns and other
    controls is either mapped to the canonical component/token or logged as a named
    exception requiring repair;
  - each repair retains route, component instance, current token/value, target
    component/token, states affected and before/after evidence;
  - a module cannot pass by sampling a subset of screens or only default states.
- Required work register: [`VISUAL_STANDARD_CARD_AUDIT.md`](VISUAL_STANDARD_CARD_AUDIT.md)
- Impact: makes the visual reconstruction finite, assignable and auditable rather
  than relying on a broad instruction likely to leave local inconsistencies.
- Proposed importance: `CRITICAL / CROSS-CUTTING`
- Evidence: no new screenshot supplied
- Acceptance criteria: `XMOD-COMP-AC-001` through `XMOD-COMP-AC-008`
- Status: `CAPTURED_UNRECONCILED`

### Component-conformity acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| `XMOD-COMP-AC-001` | All 109 screen rows record a result for every applicable `CMP-01–12` check | `NOT_TESTED` |
| `XMOD-COMP-AC-002` | Every rendered dropdown/select is checked in closed, open, hover, focus, selected, disabled, validation and keyboard states | `NOT_TESTED` |
| `XMOD-COMP-AC-003` | Every card/surface records canonical background, border, radius, divider and elevation mapping | `NOT_TESTED` |
| `XMOD-COMP-AC-004` | Every text instance maps to semantic typography and text-colour roles | `NOT_TESTED` |
| `XMOD-COMP-AC-005` | Every nonconforming instance becomes an atomic repair item with route, locator, current and target rule | `NOT_TESTED` |
| `XMOD-COMP-AC-006` | Each repaired screen has desktop/compact before-and-after evidence on the exact candidate SHA | `NOT_TESTED` |
| `XMOD-COMP-AC-007` | Applicable interactive, validation, loading, empty, error and disabled states are evidenced, not inferred from default state | `NOT_TESTED` |
| `XMOD-COMP-AC-008` | Completion requires `109/109` screen rows reconciled with no unexplained exception or missing evidence | `NOT_TESTED` |

## Counters

- Observations: `6`
- Evidence items: `4` directly linked (`XMOD-EVD-002–005`)
- Fixed: `0`
- Accepted: `0`
