# Assessment — independent UX and visual review

Date: `2026-08-23`  
Candidate: `43730f86f8a74943c36a58b9ff07aa680a42aa3e`  
Review role: independent UX / visual-standard reviewer  
Decision: `NO-GO FOR OWNER ACCEPTANCE`

## Scope and evidence boundary

This review uses the exact-candidate gate packet, the complete Assessment owner-feedback register and all ten PNG files in this directory. It evaluates the visible desktop state only. The screenshots do not prove keyboard operation, focus order, screen-reader semantics, contrast ratios, responsive behavior, persistence or authorization. No item below is marked `FIXED` or owner-accepted.

The strongest preserved patterns are the clean Processes table, the overall typography/frame language and the full-height preview direction. The principal failure is not cosmetic: the session workspace exposes too many navigation, diagnostic and task surfaces at once, while its modes do not correspond to distinct user jobs.

## Atomic findings

### `ASM-UX-001` — Interview has no single primary task

- **Evidence:** `ASM-G09-interview-current.png` simultaneously shows the environment/session banner, seven axes, session header, lifecycle controls, draft alert, coverage line, expanded area tree, question card, mode switcher, permanent Teresa panel and footer controls.
- **Violated standard:** one primary task and one primary next action per work surface; progressive disclosure for context and governance (`ASM-USABILITY-AC-001`, `ASM-USABILITY-AC-003`).
- **Impact:** a first-time user must interpret the whole methodology before answering the current question; the central question competes with at least four navigation/control systems.
- **Priority:** `P0`.
- **Testable correction:** the initial Interview viewport contains exactly one current question/level, applicable response choices and one primary continue/save action. Axis tree, evidence detail, AI help and governance open on demand. In an unmoderated usability test, a representative user identifies the current question and next action within 5 seconds without assistance.

### `ASM-UX-002` — The left navigator is permanently expanded beyond scannable density

- **Evidence:** `ASM-G09-interview-current.png` and `ASM-G09-split-current.png` show multiple axes and a long list of areas with repeated counters in a narrow, internally scrolling column.
- **Violated standard:** overview first, detail on demand; navigation must communicate position and progress without requiring a scan of the full 39-unit hierarchy (`ASM-USABILITY-AC-002`).
- **Impact:** area labels truncate, counters repeat without clear meaning, and the current location is difficult to distinguish from methodology structure.
- **Priority:** `P0`.
- **Testable correction:** show collapsed axis groups with answered/total progress and only the active axis expanded. Provide search or a temporary navigator for direct jumps. At 1280×720, every active-axis area label and its progress state remains readable without horizontal scrolling.

### `ASM-UX-003` — `Split` is visually and semantically indistinguishable from Interview

- **Evidence:** `ASM-G09-interview-current.png` and `ASM-G09-split-current.png` are materially the same composition; only the selected tab changes.
- **Violated standard:** each second-level workspace mode must represent a distinct user job and visible information architecture; selected navigation must predict the resulting surface.
- **Impact:** users receive no answer register or review view, cannot form a stable mental model and may believe the control is broken.
- **Priority:** `P0`.
- **Testable correction:** first reconcile the later owner decision about removing Split. If retained, Split must render a dedicated answer/status register with filters, coverage and governed edit actions and no Interview question wall. If removed, no Split label, route or stale deep link remains.

### `ASM-UX-004` — Matrix does not communicate its core AS-IS / TO-BE comparison

- **Evidence:** `ASM-G09-matrix-current.png` presents grey level buttons and text placeholders `C — · T — · Δ —`; its legend mixes AI proposal, review, blocker, evidence gap and unassessed states, but there is no clear achieved/current versus target encoding.
- **Violated standard:** the Matrix must make current, target and gap immediately legible and must reuse the owner-approved level-by-area concept (`ASM-MODES-AC-004`).
- **Impact:** the primary analytical purpose of the Matrix is not visible; empty and unavailable values visually dominate a large low-information surface.
- **Priority:** `P0`.
- **Testable correction:** every evaluated area shows a persistent, legend-consistent AS-IS marker, TO-BE marker and gap; clicking a cell opens details without obscuring the comparison. In a comprehension test, users correctly identify current, target and gap for a sampled area without explanation.

### `ASM-UX-005` — Session chrome duplicates navigation and consumes the working viewport

- **Evidence:** all three `ASM-G09-*-current.png` images show a technical canonical-session strip, seven-axis strip, document header, draft alert, progress strip, mode switcher and footer simultaneously.
- **Violated standard:** three-level menu hierarchy with contextual controls; technical/document metadata belongs in subordinate Settings/Information, not permanent work chrome (`ASM-CUR-007`).
- **Impact:** roughly one third of the 720px-tall viewport is occupied before the main task; axis navigation is duplicated between the top strip and left tree.
- **Priority:** `P0`.
- **Testable correction:** retain one product header, one tool-level row for `Interview / Matrix / Report` plus separate Settings, and one contextual third-level row. Move UUID, method version, server source, evidence totals and freeze blockers into Settings/Information. No axis navigation is duplicated in the default viewport.

### `ASM-UX-006` — Permanent Teresa panel duplicates the global assistant and constrains content

- **Evidence:** `ASM-G09-interview-current.png` and `ASM-G09-split-current.png` reserve a full right column for Teresa while a global assistant entry remains present in the application shell and an inline `Zapytaj Teresę` action is also visible.
- **Violated standard:** progressive disclosure and single source of interaction for the global assistant; secondary help must not compete with the primary task (`ASM-USABILITY-AC-003`).
- **Impact:** duplicated assistant affordances reduce the question workspace, create uncertainty about which assistant context is authoritative and increase visual noise.
- **Priority:** `P1`.
- **Testable correction:** remove the permanent Teresa column. Open the global assistant with assessment context from one contextual `Ask AI / Analyze` action; closing it restores full content width and preserves the current question.

### `ASM-UX-007` — Library uses process lifecycle filters that do not match a methodology catalog

- **Evidence:** `ASM-G04-library.png` and `ASM-G07-library-preview.png` show `Draft`, `In Review`, `Awaiting Approval`, `Approved`, `Rejected`, `Archived` above a static framework catalog whose relevant states are `Method Core` and `Coming soon`.
- **Violated standard:** controls and filters must be relevant to the object type in the current register; Library is a methodology catalog, not a process lifecycle list (`ASM-LIB-AC-001`).
- **Impact:** all counters are zero and imply filtering behavior that has no visible meaning for frameworks, increasing header density and weakening trust.
- **Priority:** `P1`.
- **Testable correction:** Library exposes only methodology-relevant search/filter facets such as area, availability and commercial access. Process lifecycle chips appear only under Processes/other lifecycle registers. Every visible filter changes or truthfully describes the catalog result set.

### `ASM-UX-008` — Preview is full height, but the table/preview split still causes avoidable clipping

- **Evidence:** `ASM-G07-library-preview.png` and `ASM-G09-process-preview.png` show the table reduced to a narrow pane with a persistent horizontal scrollbar; in Process Preview, headers such as Progress and later columns are clipped. Preview content itself requires internal scrolling.
- **Violated standard:** canonical full-height preview must preserve a coherent table/preview split and avoid competing/unnecessary horizontal scroll at supported sizes (`ASM-PREVIEW-AC-003`, `ASM-PREVIEW-AC-005`).
- **Impact:** users lose table context when preview opens and may not realize hidden columns/actions exist.
- **Priority:** `P1`.
- **Testable correction:** define responsive split breakpoints and minimum widths. At 1280×720, the selected row retains its identity plus the owner-approved essential columns without horizontal scrolling; preview header/actions remain fixed and only preview body scrolls. Below the breakpoint, use a full-width overlay/drawer rather than compressing both panes.

### `ASM-UX-009` — Destructive actions have excessive visual prominence in Preview

- **Evidence:** `ASM-G09-process-preview.png` gives `Delete` a large red half-width button alongside `Duplicate`, while constructive actions `Report` and `Initiative pack` are smaller chips below.
- **Violated standard:** action hierarchy should privilege the primary workflow and isolate destructive actions behind explicit intent/confirmation.
- **Impact:** destructive action attracts more attention than opening/continuing the assessment and raises accidental-action risk.
- **Priority:** `P1`.
- **Testable correction:** make `Open/Continue` the sole primary action; move Duplicate and Delete to the canonical overflow menu, with Delete last, visually destructive and confirmation-gated. Keyboard focus must not default to Delete.

### `ASM-UX-010` — Downstream navigation is duplicated and uses obsolete terminology

- **Evidence:** `ASM-G10-outputs.png` shows top navigation `Outputs / Reports / Initiatives` and a second in-content tab row repeating the same three destinations; the owner-decided term is `Insights`.
- **Violated standard:** one navigation level per destination; canonical cross-module terminology and IA (`ASM-DOWNSTREAM-AC-001`, `ASM-DOWNSTREAM-AC-002`).
- **Impact:** duplicated tabs suggest nested scope that does not exist and the obsolete name breaks consistency with Tools and other modules.
- **Priority:** `P0`.
- **Testable correction:** render one second-level trio `Insights / Reports / Initiatives`; remove the internal duplicate tabs and all user-facing `Outputs` strings for this role. Direct routes and refresh preserve the selected destination.

### `ASM-UX-011` — Empty states contradict visible data and offer competing creation paths

- **Evidence:** `ASM-G08-processes.png` contains two Assessment processes, while `ASM-G10-reports.png` and `ASM-G10-initiatives.png` say `No assessments found`. Each also presents both a header creation CTA and a central empty-state CTA with differing labels (`New Report` / `Generate Report`, `New Initiative` / `Initiative Pack`).
- **Violated standard:** empty state must reflect actual prerequisite availability and expose one clear next step (`ASM-DOWNSTREAM-AC-007`).
- **Impact:** system feedback is factually confusing and users cannot tell whether creation is unavailable, data is disconnected or they should start another assessment.
- **Priority:** `P0`.
- **Testable correction:** derive empty-state copy from eligible source records. When eligible processes exist, show source selection or explain the unmet lifecycle prerequisite. Use one canonical creator and one label; header and empty-state entry points, if both retained, open the same creator with identical state.

### `ASM-UX-012` — Status color and meaning are inconsistent across surfaces

- **Evidence:** `ASM-G04-library.png` uses green `Method Core` as a status; `ASM-G08-processes.png` uses blue `Draft`; `ASM-G09-interview-current.png` repeats Draft as both a chip and a full-width amber warning bar; the Matrix legend introduces additional colors and categories without visibly applied cells.
- **Violated standard:** one semantic token per lifecycle/attention meaning; avoid using warning emphasis for neutral states.
- **Impact:** users cannot reliably infer whether color represents availability, lifecycle, risk, evidence or maturity level.
- **Priority:** `P1`.
- **Testable correction:** publish and apply a semantic token map separating availability, lifecycle, warning/blocker, evidence state and maturity level. Draft appears consistently as neutral lifecycle status; amber/red are reserved for actionable warning/blocker states. Automated visual assertions cover labels plus non-color indicators.

### `ASM-UX-013` — Accessibility and responsive acceptance are not evidenced

- **Evidence:** all evidence is a single desktop-size visual capture; icon-only search/settings/overflow/close controls, truncated labels, nested internal scroll regions and color-coded states are visible, but no focus, names, contrast or viewport replay is present.
- **Violated standard:** operable keyboard navigation, accessible names, visible focus, non-color status communication and supported viewport behavior (`G17`, `ASM-PREVIEW-AC-005`, `ASM-MODES-AC-009`).
- **Impact:** the current screenshots cannot establish that the module is usable with keyboard/screen reader or at narrower supported viewports; nested scroll regions are a particular risk.
- **Priority:** `P0` acceptance blocker, not a claim that each control currently fails.
- **Testable correction:** after IA remediation, run keyboard-only and screen-reader smoke tests for Library, Processes, Preview and all workspace modes; verify accessible names for every icon-only control, logical focus return after Preview, WCAG AA contrast, non-color state labels and viewport replays at the documented minimum, 1280×720 and a larger desktop size.

## UX closure sequence

1. Record the superseding workspace decision before implementation: current evidence supports `Interview / Matrix / Report` plus separate Settings, while the older register still specifies four modes including Split.
2. Prototype and owner-test the simplified Interview and target Matrix at 1280×720 before visual polish.
3. Remove duplicated/technical chrome and reconcile the three-level menu contract.
4. Reuse the accepted Processes table, dropdown and full-height Preview patterns, correcting responsive split behavior rather than redesigning them.
5. Connect and populate `Insights / Reports / Initiatives`, then validate the shared creator, preview and empty-state standards with real deterministic fixtures.
6. Complete keyboard, accessibility and supported-viewport replay before owner retest.

This review remains an expert recommendation against current exact-candidate evidence. It does not replace Piotr's owner decision or constitute implementation acceptance.
