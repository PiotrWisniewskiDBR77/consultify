# UI/UX Standards — Consultify

> **JEDYNE KANONICZNE ŹRÓDŁO** wytycznych UI/UX i specyfikacji komponentów.  
> **Data konsolidacji:** 2026-02-15 (v2.0 — "Tech Sexy" Edition)
>
> **v2.0 Changelog:** Ewolucja visual language na podstawie analizy wzorców UI 2025-2026 (ChatGPT, Notion, ClickUp, Gemini, NotebookLM). Kluczowe zmiany: invisible borders, multi-layer depth, monochromatic chrome, outline-only icons, refined hover/spacing. Nie rewolucja — refinement.

---

## ⚠️ ZASADA KRYTYCZNA (MUST)

**NIE WYMYŚLAJ NOWYCH STANDARDÓW ANI KOMPONENTÓW.**

- Wszystkie komponenty UI **MUSZĄ** być zgodne z dokumentacją w tym katalogu.
- Przed utworzeniem nowego komponentu — **ZAWSZE** sprawdź czy istnieje w katalogu poniżej.
- Przed zmianą stylu/układu — **ZAWSZE** przeczytaj odpowiedni standard.
- Jeśli standard nie opisuje przypadku — **ZAPYTAJ** zamiast wymyślać. Aktualizacja standardu wymaga świadomej decyzji.
- `README.md` i `FROZEN_LAYOUTS.md` sa autoratywne dla nawigacji po tym pakiecie.
- Lokalne kopie z sufiksami typu ` 2.md` albo ` 3.md` nie sa autorytatywne i powinny byc traktowane jako snapshot duplicates.

---

## Struktura dokumentacji

```
docs/ui-standards/
├── README.md                 ← TEN PLIK (index)
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

| Obszar                   | Dokument                                                                         | Zakres                                                                 |
| ------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Kanon v3 (SSOT)**      | [UI_UX_CANON_V3.md](UI_UX_CANON_V3.md)                                           | Konsolidacja decyzji v3 (topbary, light mode, preview, AI, inbox)      |
| **Kolory**               | [00-foundation/color-system.md](00-foundation/color-system.md)                   | Paleta DBR77, semantyka, WCAG                                          |
| **Czytelność light mode** | [00-foundation/light-mode-readability.md](00-foundation/light-mode-readability.md) | Kontrast, badge taxonomy, metadata i zasady surface hierarchy        |
| **Język wizualny**       | [00-foundation/visual-language.md](00-foundation/visual-language.md)             | Tła, ramki, typografia, motion                                         |
| **Canvas Mode**          | [00-foundation/canvas-mode.md](00-foundation/canvas-mode.md)                     | Rozszerzenie DBR77 dla experience surfaces (Home tab, landing, onboarding) |
| **Tożsamość artefaktów** | [00-foundation/artifact-identity-map.md](00-foundation/artifact-identity-map.md) | Kanon: 1 artefakt = 1 ikona + 1 akcent kolorystyczny (v3)              |
| **Shell artefaktu**      | [01-shell-layout/artifact-shell.md](01-shell-layout/artifact-shell.md)           | 4-warstwowy shell, tokeny rozmiaru                                     |
| **Tryby D/N/C**          | [01-shell-layout/presentation-modes.md](01-shell-layout/presentation-modes.md)   | Architektura 3 trybów, N blocks kit                                    |
| **App Topbar (v3)**      | [01-shell-layout/app-topbar-standard-v3.md](01-shell-layout/app-topbar-standard-v3.md) | Globalny topbar: Data/Model/Inbox/Tasks/User + zasady AI (v3)      |
| **Współdzielone sekcje** | [02-components/shared-sections.md](02-components/shared-sections.md)             | CommentsCanvas, ActivityLog, Risk, Governance                          |
| **Building blocks**      | [02-components/building-blocks.md](02-components/building-blocks.md)             | Callout, ToggleBlock, EmptyState, Checklist, InlineTable, EmbeddedView |
| **AI suggestions modal** | [02-components/ai-suggestions-modal.md](02-components/ai-suggestions-modal.md)   | Standard modala do przeglądu i zastosowania sugestii AI                |
| **Help + Intro**         | [02-components/help-intro-standard.md](02-components/help-intro-standard.md)      | Delikatny standard intro, contextual help i wejść do AI                |
| **Help Panel + Intro Spec** | [02-components/help-sidepanel-intro-spec.md](02-components/help-sidepanel-intro-spec.md) | Spec ekranów, sekcji, stanów i zachowań dla helpa i intro          |
| **Help + Intro Implementation Plan** | [02-components/help-intro-implementation-plan.md](02-components/help-intro-implementation-plan.md) | Kolejność wdrożenia 1:1 dla frontendu, pliki i fazy prac        |
| **Workspace 3-tools strip** | [02-components/workspace-3-tools-strip.md](02-components/workspace-3-tools-strip.md) | Kanon: Tools / Context / AI Suggestions (prawy panel)              |
| **Team table**           | [02-components/team-management-table.md](02-components/team-management-table.md) | Standard tabeli zespołu (N‑mode)                                       |
| **Task Panel**           | [02-components/task-panel.md](02-components/task-panel.md)                       | TaskDetailView — layout, sekcje                                        |
| **Decision Panel**       | [02-components/decision-panel.md](02-components/decision-panel.md)               | DecisionDetailView — layout, sekcje                                    |
| **Notification Panel**   | [02-components/notification-panel.md](02-components/notification-panel.md)       | NotificationDetailView                                                 |
| **Initiative sections**  | [02-components/initiative-sections.md](02-components/initiative-sections.md)     | Karty inicjatywy (KPI, Decisions, Gates, RAID…)                        |
| **Moduł hub**            | [03-modules/module-hub-standard.md](03-modules/module-hub-standard.md)           | Struktura ekranu modułu                                                |
| **Tabele**               | [03-modules/app-table-standard.md](03-modules/app-table-standard.md)             | Standard tabel aplikacyjnych                                           |
| **Table + Preview**      | [03-modules/table-preview-pane-standard.md](03-modules/table-preview-pane-standard.md) | Kanon “tabela + preview pane” (Outlook style)                       |
| **Golden Standard v3**   | [03-modules/golden-standard-table-cards-preview-v3.md](03-modules/golden-standard-table-cards-preview-v3.md) | SSOT: Table + Cards + Preview (Sprint 1) |
| **Interactive boards (v3)** | [03-modules/interactive-board-standard.md](03-modules/interactive-board-standard.md) | Kanon tablic KPI/finanse: definicja kolumn + view modes             |
| **Tools library & detail** | [03-modules/tools-library-detail-standard.md](03-modules/tools-library-detail-standard.md) | Kanon modułu Tools: Goal tab layout, kolory, badge taxonomy, grafiki |

---

## Katalog komponentów (alfabetycznie)

| Komponent                | Plik                     | Używany w                                    |
| ------------------------ | ------------------------ | -------------------------------------------- |
| `ActivityLogCanvas`      | shared-sections.md       | Task, Decision, Initiative, Notification     |
| `AICoachPanel`           | _(MyWork/Focus)_         | Focus tab — AI priority recommendations      |
| `AIConnections`          | _(MyWork/shared)_        | Task, Decision, Idea — AI-discovered links   |
| `AIPlanView`             | _(MyWork/Focus)_         | Focus tab — AI time-blocked schedule          |
| `AttachmentsLinksCanvas` | shared-sections.md       | Task, Decision, Initiative                   |
| `Callout`                | building-blocks.md       | Wszędzie (info/warning/critical)             |
| `ChecklistBlock`         | building-blocks.md       | Task, Notification                           |
| `CommentsCanvas`         | shared-sections.md       | Task, Decision, Initiative, Notification     |
| `ConvertToMenu`          | _(MyWork/shared)_        | Universal "Convert to..." dropdown            |
| `DecisionDetailView`     | decision-panel.md        | MyWork                                       |
| `EmbeddedView`           | building-blocks.md       | Tasks, Decisions, RAID w artefaktach         |
| `EmptyStateInline`       | building-blocks.md       | Sekcje z pustym stanem                       |
| `GovernanceCanvas`       | shared-sections.md       | Task, Decision (RACI, Reminders, Escalation) |
| `IdeaMapWorkspace`       | _(MyWork)_               | MyWork — Idea workspace with map + tools     |
| `IdeaWorkspaceTools`     | _(MyWork)_               | Idea Workspace — standard tools sidebar      |
| `InlineTable`            | building-blocks.md       | Options, KPIs, tabele lekkie                 |
| `MorningBriefCard`       | _(MyWork)_               | MyWorkHub — collapsible daily briefing       |
| `NModeHeader`            | presentation-modes.md    | Wszystkie artefakty N-mode                   |
| `NModeLeftNav`           | presentation-modes.md    | Wszystkie artefakty N-mode                   |
| `NModePropertiesStrip`   | artifact-shell.md        | Wszystkie artefakty N-mode                   |
| `NotificationDetailView` | notification-panel.md    | MyWork                                       |
| `NudgeStrip`             | _(MyWork/Focus)_         | Focus tab — proactive nudge alerts           |
| `PostDecisionFollowUp`   | _(MyWork/shared)_        | Decision — follow-up task modal              |
| `RelatedContext`          | _(MyWork/shared)_        | Task, Decision — cross-entity KnowledgePulse |
| `RiskCanvas`             | shared-sections.md       | Task, Decision, Initiative                   |
| `TaskDetailView`         | task-panel.md            | MyWork                                       |
| `TeamManagementPanel`    | team-management-table.md | Initiative → Team, Assessment → Team         |
| `ToggleBlock`            | building-blocks.md       | Sekcje rozwijane                             |
| `WorkspacePanelStrip`    | workspace-3-tools-strip.md | Workspace → 3 przyciski: Tools/Context/AI |

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

| Workspace  | Sekcje specyficzne                                              |
| ---------- | --------------------------------------------------------------- |
| Notebook   | Insert Block, Create from Note, Page metadata, Compose strip    |
| Idea Map   | Challenge, AI Map expand, Metadata, Convert (init/task/decision)|

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
