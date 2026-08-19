# UI/UX Standards — Consultify

> ⚠️ **AUTORYTET PRZENIESIONY → [CANON.md](CANON.md)** (od 2026-06-14, v3.0).
> Ten plik pozostaje jako **pomocniczy indeks nawigacyjny**. Jedynym dokumentem, który *ogłasza* standard i rozstrzyga konflikty, jest `CANON.md` (§2 Hierarchia prawdy).
> Aktualny odbiór: [FINAL_CANONICAL_DOCUMENTATION_ACCEPTANCE_2026-08-03.md](FINAL_CANONICAL_DOCUMENTATION_ACCEPTANCE_2026-08-03.md) — `APPROVED_SPEC / PARTIAL`.

## Finalny odbiór aplikacji — aktywny

- [System finalnego odbioru 16 modułów](CONSULTIFY_16_MODULE_FINAL_ACCEPTANCE_SYSTEM_2026-08-04.md)
- [Ledger finalnego odbioru 16 modułów](CONSULTIFY_16_MODULE_FINAL_ACCEPTANCE_LEDGER_2026-08-04.csv)
- [Rejestr powierzchni: tabele, narzędzia i kreatory](CONSULTIFY_SURFACE_REGISTER_2026-08-04.md)

> **Indeks wytycznych UI/UX i specyfikacji komponentów.**
> **Data konsolidacji:** 2026-05-01 (v2.1 — "DBR77 Tech Sexy 2027" Edition)
>
> **Nota historyczna v2.1:** dawniej Golden Standard był opisywany jako najwyższy SSOT. Od v3 rolę tę pełni wyłącznie `CANON.md`; Golden Standard jest materiałem migracyjnym.

---

## ⚠️ ZASADA KRYTYCZNA (MUST)

**NIE WYMYŚLAJ NOWYCH STANDARDÓW ANI KOMPONENTÓW.**

- Wszystkie komponenty UI **MUSZĄ** być zgodne z dokumentacją w tym katalogu.
- Przed utworzeniem nowego komponentu — **ZAWSZE** sprawdź czy istnieje w katalogu poniżej.
- Przed zmianą stylu/układu — **ZAWSZE** przeczytaj odpowiedni standard.
- Jeśli standard nie opisuje przypadku — **ZAPYTAJ** zamiast wymyślać. Aktualizacja standardu wymaga świadomej decyzji.
- `README.md` jest wyłącznie indeksem; `FROZEN_LAYOUTS.md` jest obowiązującym aneksem podporządkowanym `CANON.md`.
- Lokalne kopie z sufiksami typu ` 2.md` albo ` 3.md` nie sa autorytatywne i powinny byc traktowane jako snapshot duplicates.

---

## Struktura dokumentacji

```
docs/ui-standards/
├── CANON.md                  ← JEDYNY FRONT I AUTORYTET
├── README.md                 ← TEN PLIK (pomocniczy indeks)
├── CONSULTIFY_APP_WIDE_UI_UX_CURRENT_STATE_AND_REMEDIATION_SPEC_2026-08-04.md ← aktywny stan demo + mapa napraw
├── FINAL_CANONICAL_DOCUMENTATION_ACCEPTANCE_2026-08-03.md ← aktualny odbiór
├── 00-foundation/            ← Fundamenty wizualne (kolory, tokeny, DBR77)
├── 01-shell-layout/         ← Shell artefaktów, tryby D/N/C
├── 02-components/           ← Katalog WSZYSTKICH komponentów
└── 03-modules/               ← Standardy modułów (hub, tabele)
```

---

## ⛔ FROZEN LAYOUTS (NIE ZMIENIAJ)

**[FROZEN_LAYOUTS.md](FROZEN_LAYOUTS.md)** — układy PINOWANE: sidebar order, module topbar order, view-modes order, 1 Command Row, App Table + Preview, Workspace 3-tools strip. Przy nowych taskach i implementacji — **nie rób bałaganu**.

---

## Szybka nawigacja

| Obszar                               | Dokument                                                                                                     | Zakres                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jedyny front i hierarchia prawdy** | [CANON.md](CANON.md)                                                                                         | Najwyższy autorytet, właściciele obszarów, rozstrzyganie konfliktów i graf dokumentów normatywnych                                           |
| **Aktualny stan całej aplikacji** | [CONSULTIFY_APP_WIDE_UI_UX_CURRENT_STATE_AND_REMEDIATION_SPEC_2026-08-04.md](CONSULTIFY_APP_WIDE_UI_UX_CURRENT_STATE_AND_REMEDIATION_SPEC_2026-08-04.md) | 16 modułów na aktywnym demo: typy ekranów, potwierdzone odstępstwa, kontrakty tabel/preview oraz kolejność napraw; dokument operacyjny podporządkowany `CANON.md` |
| **Aktualny odbiór**                  | [FINAL_CANONICAL_DOCUMENTATION_ACCEPTANCE_2026-08-03.md](FINAL_CANONICAL_DOCUMENTATION_ACCEPTANCE_2026-08-03.md) | Finalny odbiór specyfikacji: `APPROVED_SPEC`; runtime pozostaje `PARTIAL`                                                                    |
| **Faza 1 — mapowanie runtime**       | [PHASE_1_RUNTIME_MAPPING_BRIEF_2026-08-03.md](PHASE_1_RUNTIME_MAPPING_BRIEF_2026-08-03.md)                     | Brief wykonawczy dla Claude, checkpointy oraz zasady niezależnego odbioru przez Codex                                                        |
| **Kompletny standard implementacyjny** | [UI_UX_IMPLEMENTATION_STANDARD.md](UI_UX_IMPLEMENTATION_STANDARD.md)                                         | Pełny kontrakt shelli, list, preview, detail, artefaktów, wizardów, stanów, AI, a11y, responsive, evidence i odbioru                         |
| **Macierz zgodności modułów**        | [MODULE_UI_UX_COMPLIANCE_MATRIX.md](MODULE_UI_UX_COMPLIANCE_MATRIX.md)                                       | 19 modułów: bramki SPEC/LIST/PREVIEW/INSIDE/STATES/EVIDENCE oraz status odbioru                                                              |
| **Golden Standard — materiał migracyjny** | [CONSULTIFY_UI_UX_GOLDEN_STANDARD.md](CONSULTIFY_UI_UX_GOLDEN_STANDARD.md)                              | Historyczny pakiet wartościowej treści, podporządkowany `CANON.md`; nie rozstrzyga konfliktów                                                |
| **Operating Standard**               | [CONSULTIFY_UI_UX_OPERATING_STANDARD.md](CONSULTIFY_UI_UX_OPERATING_STANDARD.md)                             | Operacyjna brama dla Cursor, audytu, refactorów i zatwierdzania wyjątków                                                                     |
| **Documentation audit**              | [UI_UX_DOCUMENTATION_COMPLETENESS_AUDIT.md](_archive/UI_UX_DOCUMENTATION_COMPLETENESS_AUDIT.md)                       | Audyt kompletności, spójności i egzekwowalności dokumentacji UI/UX                                                                           |
| **Enforcement plan**                 | [UI_UX_ENFORCEMENT_PLAN.md](_archive/UI_UX_ENFORCEMENT_PLAN.md)                                                       | Plan bramek Cursor/CI/review, aby egzekwować Golden Standard                                                                                 |
| **Migration audit**                  | [UI_UX_MIGRATION_AUDIT.md](_archive/UI_UX_MIGRATION_AUDIT.md)                                                         | Mapa obecnego stanu UI/UX, migration debt, decyzje per moduł                                                                                 |
| **Migration plan**                   | [UI_UX_MIGRATION_PLAN.md](_archive/UI_UX_MIGRATION_PLAN.md)                                                           | Fale migracji, bramki komponentów, kolejność refactorów                                                                                      |
| **Reference screens**                | [UI_UX_REFERENCE_SCREENS.md](_archive/UI_UX_REFERENCE_SCREENS.md)                                                     | Kandydaci na ekrany referencyjne i warunki zatwierdzenia                                                                                     |
| **Kanon v3 (legacy/consolidated)**   | [UI_UX_CANON_V3.md](UI_UX_CANON_V3.md)                                                                       | Historyczna konsolidacja decyzji v3; podporządkowana Golden Standard                                                                         |
| **Kolory**                           | [00-foundation/color-system.md](00-foundation/color-system.md)                                               | Paleta DBR77, semantyka, WCAG                                                                                                                |
| **Czytelność light mode**            | [00-foundation/light-mode-readability.md](00-foundation/light-mode-readability.md)                           | Kontrast, badge taxonomy, metadata i zasady surface hierarchy                                                                                |
| **Język wizualny**                   | [00-foundation/visual-language.md](00-foundation/visual-language.md)                                         | Tła, ramki, typografia, motion                                                                                                               |
| **Canvas Mode**                      | [00-foundation/canvas-mode.md](00-foundation/canvas-mode.md)                                                 | Rozszerzenie DBR77 dla experience surfaces (Home tab, landing, onboarding)                                                                   |
| **Tożsamość artefaktów**             | [00-foundation/artifact-identity-map.md](00-foundation/artifact-identity-map.md)                             | Kanon: 1 artefakt = 1 ikona + 1 akcent kolorystyczny (v3)                                                                                    |
| **Shell artefaktu**                  | [01-shell-layout/artifact-shell.md](01-shell-layout/artifact-shell.md)                                       | 4-warstwowy shell, tokeny rozmiaru                                                                                                           |
| **Tryby D/N/C**                      | [01-shell-layout/presentation-modes.md](01-shell-layout/presentation-modes.md)                               | Architektura 3 trybów, N blocks kit                                                                                                          |
| **N-mode cards**                     | [01-shell-layout/n-mode-card-standard.md](01-shell-layout/n-mode-card-standard.md)                           | SSOT kart roboczych N-mode: anatomia, AI, visibility, katalog kart, standard `Interview Insight`                                             |
| **Shared N-mode sections**           | [shared-nmode-sections-standard.md](01-shell-layout/shared-nmode-sections-standard.md)                                       | Reużywalne sekcje N-mode i zasady niedublowania powiązanego kontekstu                                                                        |
| **App Topbar (v3)**                  | [01-shell-layout/app-topbar-standard-v3.md](01-shell-layout/app-topbar-standard-v3.md)                       | Globalny topbar: Data/Model/Inbox/Tasks/User + zasady AI (v3)                                                                                |
| **Artifact shell future**            | [artifact-shell-future-standard.md](01-shell-layout/artifact-shell-future-standard.md)                                       | Future/next-iteration shell N/C; pomocniczy względem Golden Standard i artifact-shell                                                        |
| **Współdzielone sekcje**             | [02-components/shared-sections.md](02-components/shared-sections.md)                                         | CommentsCanvas, ActivityLog, Risk, Governance                                                                                                |
| **Building blocks**                  | [02-components/building-blocks.md](02-components/building-blocks.md)                                         | Callout, ToggleBlock, EmptyState, Checklist, InlineTable, EmbeddedView                                                                       |
| **Component registry**               | [02-components/COMPONENT_CATALOG_AND_OWNERSHIP_REGISTRY.md](02-components/COMPONENT_CATALOG_AND_OWNERSHIP_REGISTRY.md) | Rejestr rodzin komponentów, odpowiedzialności, implementacji i statusów konsolidacji                                                         |
| **Component documentation card**     | [02-components/COMPONENT_DOCUMENTATION_CARD_STANDARD.md](02-components/COMPONENT_DOCUMENTATION_CARD_STANDARD.md) | Obowiązkowy standard kompletnego opisu pojedynczej rodziny komponentów                                                                       |
| **Component UI/UX audit**            | [02-components/COMPONENT_UI_UX_AUDIT_AND_ACCEPTANCE_MATRIX.md](02-components/COMPONENT_UI_UX_AUDIT_AND_ACCEPTANCE_MATRIX.md) | Macierz kontroli, bramki GO/FIX/NO-GO i kolejność audytu                                                                                      |
| **AI suggestions modal**             | [02-components/ai-suggestions-modal.md](02-components/ai-suggestions-modal.md)                               | Standard modala do przeglądu i zastosowania sugestii AI                                                                                      |
| **Help + Intro**                     | [02-components/help-intro-standard.md](02-components/help-intro-standard.md)                                 | Delikatny standard intro, contextual help i wejść do AI                                                                                      |
| **Help Panel + Intro Spec**          | [02-components/help-sidepanel-intro-spec.md](02-components/help-sidepanel-intro-spec.md)                     | Spec ekranów, sekcji, stanów i zachowań dla helpa i intro                                                                                    |
| **Help + Intro Implementation Plan** | [02-components/help-intro-implementation-plan.md](02-components/help-intro-implementation-plan.md)           | Kolejność wdrożenia 1:1 dla frontendu, pliki i fazy prac                                                                                     |
| **Workspace 3-tools strip**          | [02-components/workspace-3-tools-strip.md](02-components/workspace-3-tools-strip.md)                         | Kanon: Tools / Context / AI Suggestions (prawy panel)                                                                                        |
| **Team table**                       | [02-components/team-management-table.md](02-components/team-management-table.md)                             | Standard tabeli zespołu (N‑mode)                                                                                                             |
| **Task Panel**                       | [02-components/task-panel.md](02-components/task-panel.md)                                                   | TaskDetailView — layout, sekcje                                                                                                              |
| **Decision Panel**                   | [02-components/decision-panel.md](02-components/decision-panel.md)                                           | DecisionDetailView — layout, sekcje                                                                                                          |
| **Notification Panel**               | [02-components/notification-panel.md](02-components/notification-panel.md)                                   | NotificationDetailView                                                                                                                       |
| **Initiative sections**              | [02-components/initiative-sections.md](02-components/initiative-sections.md)                                 | Karty inicjatywy (KPI, Decisions, Gates, RAID…)                                                                                              |
| **Mechanika Table + Preview**        | [03-modules/TABLE_AND_PREVIEW_CANON.md](03-modules/TABLE_AND_PREVIEW_CANON.md)                               | Mechanika i szczegół implementacyjny anatomii ustanowionej w `TRIADA_KANON.md`; nie redefiniuje Menu 1/2/3                                  |
| **Moduł hub**                        | [03-modules/module-hub-standard.md](03-modules/module-hub-standard.md)                                       | Struktura ekranu modułu                                                                                                                      |
| **Tabele**                           | [03-modules/app-table-standard.md](03-modules/app-table-standard.md)                                         | Złoty standard tabel aplikacyjnych: My Work > Pomysły, dark/light reference, Excel-like boundary resize, chips, row states, settings popover |
| **Table + Preview**                  | [03-modules/table-preview-pane-standard.md](03-modules/table-preview-pane-standard.md)                       | Kanon “tabela + preview pane” (Outlook style)                                                                                                |
| **Golden Standard v3 — historyczny** | [03-modules/golden-standard-table-cards-preview-v3.md](03-modules/golden-standard-table-cards-preview-v3.md) | Materiał historyczny `SUPERSEDED`; nie ustanawia standardu                                                                                   |
| **Interactive boards (v3)**          | [03-modules/interactive-board-standard.md](03-modules/interactive-board-standard.md)                         | Kanon tablic KPI/finanse: definicja kolumn + view modes                                                                                      |
| **Tools library & detail**           | [03-modules/tools-library-detail-standard.md](03-modules/tools-library-detail-standard.md)                   | Kanon modułu Tools: Goal tab layout, kolory, badge taxonomy, grafiki                                                                         |

---

## Katalog komponentów (alfabetycznie)

| Komponent                | Plik                       | Używany w                                    |
| ------------------------ | -------------------------- | -------------------------------------------- |
| `ActivityLogCanvas`      | shared-sections.md         | Task, Decision, Initiative, Notification     |
| `AICoachPanel`           | _(MyWork/Focus)_           | Focus tab — AI priority recommendations      |
| `AIConnections`          | _(MyWork/shared)_          | Task, Decision, Idea — AI-discovered links   |
| `AIPlanView`             | _(MyWork/Focus)_           | Focus tab — AI time-blocked schedule         |
| `AttachmentsLinksCanvas` | shared-sections.md         | Task, Decision, Initiative                   |
| `Callout`                | building-blocks.md         | Wszędzie (info/warning/critical)             |
| `ChecklistBlock`         | building-blocks.md         | Task, Notification                           |
| `CommentsCanvas`         | shared-sections.md         | Task, Decision, Initiative, Notification     |
| `ConvertToMenu`          | _(MyWork/shared)_          | Universal "Convert to..." dropdown           |
| `DecisionDetailView`     | decision-panel.md          | MyWork                                       |
| `EmbeddedView`           | building-blocks.md         | Tasks, Decisions, RAID w artefaktach         |
| `EmptyStateInline`       | building-blocks.md         | Sekcje z pustym stanem                       |
| `GovernanceCanvas`       | shared-sections.md         | Task, Decision (RACI, Reminders, Escalation) |
| `IdeaMapWorkspace`       | _(MyWork)_                 | MyWork — Idea workspace with map + tools     |
| `IdeaWorkspaceTools`     | _(MyWork)_                 | Idea Workspace — standard tools sidebar      |
| `InlineTable`            | building-blocks.md         | Options, KPIs, tabele lekkie                 |
| `MorningBriefCard`       | _(MyWork)_                 | MyWorkHub — collapsible daily briefing       |
| `NModeHeader`            | presentation-modes.md      | Wszystkie artefakty N-mode                   |
| `NModeLeftNav`           | presentation-modes.md      | Wszystkie artefakty N-mode                   |
| `NModePropertiesStrip`   | artifact-shell.md          | Wszystkie artefakty N-mode                   |
| `NotificationDetailView` | notification-panel.md      | MyWork                                       |
| `NudgeStrip`             | _(MyWork/Focus)_           | Focus tab — proactive nudge alerts           |
| `PostDecisionFollowUp`   | _(MyWork/shared)_          | Decision — follow-up task modal              |
| `RelatedContext`         | _(MyWork/shared)_          | Task, Decision — cross-entity KnowledgePulse |
| `RiskCanvas`             | shared-sections.md         | Task, Decision, Initiative                   |
| `TaskDetailView`         | task-panel.md              | MyWork                                       |
| `TeamManagementPanel`    | team-management-table.md   | Initiative → Team, Assessment → Team         |
| `ToggleBlock`            | building-blocks.md         | Sekcje rozwijane                             |
| `WorkspacePanelStrip`    | workspace-3-tools-strip.md | Workspace → 3 przyciski: Tools/Context/AI    |

---

## Standard "Workspace"

**Workspace** to wzorzec UI dla widoku roboczego artefaktu (idea map, notebook, przyszłe typy).

Każdy Workspace składa się z:

- **Główny content** — mapa/edytor/diagram zajmujący maks. przestrzeń
- **Tools panel** — sidebar (w-80) z narzędziami specyficznymi dla workspace + współdzielonymi sekcjami

### Współdzielone sekcje (standard)

Zaimplementowane w `@/components/shared/WorkspaceTools`:

| Komponent              | Opis                                                 |
| ---------------------- | ---------------------------------------------------- |
| `ToolsPanelShell`      | Container z headerem, gradient, close button, scroll |
| `SectionLabel`         | Nagłówek sekcji (9px, uppercase, tracking)           |
| `AIQuickActions`       | Przyciski Command + AI Chat                          |
| `TransformTextSection` | Tłumacz, zmień styl, skróć/rozwiń, popraw AI         |
| `ShareSection`         | Wyślij mailem                                        |

### Sekcje per workspace

| Workspace | Sekcje specyficzne                                               |
| --------- | ---------------------------------------------------------------- |
| Notebook  | Insert Block, Create from Note, Page metadata, Compose strip     |
| Idea Map  | Challenge, AI Map expand, Metadata, Convert (init/task/decision) |

### Implementacja

- **Notebook:** `AIChatInlinePanel` (`@/components/MyWork/notebook/`)
- **Idea Map:** `IdeaWorkspaceTools` (`@/components/MyWork/`)
- **Nowy workspace:** importuj `ToolsPanelShell` + shared sections, dodaj własne sekcje

---

## Hierarchia importów (preferowana)

```
@/components/shared/NModeLayout     → layout shell
@/components/shared/NModeSections   → section canvases (Comments, Activity, Risk, Governance, Attachments)
@/components/shared/NModeBlocks     → building blocks (Callout, ToggleBlock, EmptyState, Checklist, InlineTable, EmbeddedView)
@/components/shared/WorkspaceTools  → Workspace tools (ToolsPanelShell, AIQuickActions, TransformTextSection, ShareSection)
@/components/MyWork/shared          → MyWork shared (PostDecisionFollowUp, RelatedContext, AIConnections,
                                      ConvertToMenu, DelegationModal, askAiHelper, Stakeholders,
                                      Dependencies, Escalation, AIInsightSection, LinkedItemsSection)
@/components/MyWork/Focus           → Focus-specific (AICoachPanel, AIPlanView, NudgeStrip, FocusView)
@/components/MyWork/notebook        → Notebook-specific (SlashMenu, KnowledgePulse, NewPageModal)
@/components/MyWork/Executive       → Executive-specific (ExecutiveDashboard, KPIGrid, ActionRequiredStrip)
```

---

## Zasady ogólne

1. **NIE twórz duplikatów** — sprawdź najpierw czy istnieje wspólny komponent.
2. **Nowe detail view** — użyj NModeLayout shell + istniejących NModeSections.
3. **Nowe sekcje** — jeśli powtarzają się w 2+ widokach, wyekstrahuj do NModeSections.
4. **Stylowanie** — używaj tokenów DBR77 (rounded-xl, navy-900, purple accents).
5. **i18n** — zawsze PL + EN via `useTranslation`.
6. **locked prop** — zawsze obsługuj read-only dla artefaktów.

## Zasady v2.0 "Tech Sexy" (NOWE)

7. **Invisible borders** — separacja przez zmianę tła/cień/space, nie `border`. Border tylko na input fields i dividers (ultra-subtelne).
8. **Monochromatic chrome** — sidebar, nav, toolbary = skala szarości. Max 1 kolorowy element (CTA) na ekranie.
9. **Ikony = outline, mono-weight** — kolor ikony = kolor tekstu obok. Nigdy filled, nigdy kolorowe w nav.
10. **Hover = zmiana tła** — nigdy zmiana koloru tekstu/borderu na hover. `bg-white/[0.03]` → `bg-white/[0.06]`.
11. **Shadow = only floating** — cień tylko na modale/dropdowny. Nigdy na kartach w content.
12. **Warm darks** — nigdy `#000000` ani `#ffffff`. Primary text dark = `#f1f5f9`, tło = navy-950.
13. **Typography = architecture** — hierarchia przez size + weight, nie kolor/bordery. Semibold, nie bold.

---

## Źródła prawdy (techniczne)

- **Kolory i tokeny:** `tailwind.config.js`
- **Style globalne:** `src/index.css`
- **Semantyka kolorów:** ten katalog → 00-foundation/color-system.md
