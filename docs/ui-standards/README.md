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

## Szybka nawigacja

| Obszar                   | Dokument                                                                         | Zakres                                                                 |
| ------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Kolory**               | [00-foundation/color-system.md](00-foundation/color-system.md)                   | Paleta DBR77, semantyka, WCAG                                          |
| **Język wizualny**       | [00-foundation/visual-language.md](00-foundation/visual-language.md)             | Tła, ramki, typografia, motion                                         |
| **Shell artefaktu**      | [01-shell-layout/artifact-shell.md](01-shell-layout/artifact-shell.md)           | 4-warstwowy shell, tokeny rozmiaru                                     |
| **Tryby D/N/C**          | [01-shell-layout/presentation-modes.md](01-shell-layout/presentation-modes.md)   | Architektura 3 trybów, N blocks kit                                    |
| **Współdzielone sekcje** | [02-components/shared-sections.md](02-components/shared-sections.md)             | CommentsCanvas, ActivityLog, Risk, Governance                          |
| **Building blocks**      | [02-components/building-blocks.md](02-components/building-blocks.md)             | Callout, ToggleBlock, EmptyState, Checklist, InlineTable, EmbeddedView |
| **AI suggestions modal** | [02-components/ai-suggestions-modal.md](02-components/ai-suggestions-modal.md)   | Standard modala do przeglądu i zastosowania sugestii AI                |
| **Team table**           | [02-components/team-management-table.md](02-components/team-management-table.md) | Standard tabeli zespołu (N‑mode)                                       |
| **Task Panel**           | [02-components/task-panel.md](02-components/task-panel.md)                       | TaskDetailView — layout, sekcje                                        |
| **Decision Panel**       | [02-components/decision-panel.md](02-components/decision-panel.md)               | DecisionDetailView — layout, sekcje                                    |
| **Notification Panel**   | [02-components/notification-panel.md](02-components/notification-panel.md)       | NotificationDetailView                                                 |
| **Initiative sections**  | [02-components/initiative-sections.md](02-components/initiative-sections.md)     | Karty inicjatywy (KPI, Decisions, Gates, RAID…)                        |
| **Moduł hub**            | [03-modules/module-hub-standard.md](03-modules/module-hub-standard.md)           | Struktura ekranu modułu                                                |
| **Tabele**               | [03-modules/app-table-standard.md](03-modules/app-table-standard.md)             | Standard tabel aplikacyjnych                                           |

---

## Katalog komponentów (alfabetycznie)

| Komponent                | Plik                     | Używany w                                    |
| ------------------------ | ------------------------ | -------------------------------------------- |
| `ActivityLogCanvas`      | shared-sections.md       | Task, Decision, Initiative, Notification     |
| `AttachmentsLinksCanvas` | shared-sections.md       | Task, Decision, Initiative                   |
| `Callout`                | building-blocks.md       | Wszędzie (info/warning/critical)             |
| `ChecklistBlock`         | building-blocks.md       | Task, Notification                           |
| `CommentsCanvas`         | shared-sections.md       | Task, Decision, Initiative, Notification     |
| `DecisionDetailView`     | decision-panel.md        | MyWork                                       |
| `EmbeddedView`           | building-blocks.md       | Tasks, Decisions, RAID w artefaktach         |
| `EmptyStateInline`       | building-blocks.md       | Sekcje z pustym stanem                       |
| `GovernanceCanvas`       | shared-sections.md       | Task, Decision (RACI, Reminders, Escalation) |
| `InlineTable`            | building-blocks.md       | Options, KPIs, tabele lekkie                 |
| `NModeHeader`            | presentation-modes.md    | Wszystkie artefakty N-mode                   |
| `NModeLeftNav`           | presentation-modes.md    | Wszystkie artefakty N-mode                   |
| `NModePropertiesStrip`   | artifact-shell.md        | Wszystkie artefakty N-mode                   |
| `NotificationDetailView` | notification-panel.md    | MyWork                                       |
| `RiskCanvas`             | shared-sections.md       | Task, Decision, Initiative                   |
| `TaskDetailView`         | task-panel.md            | MyWork                                       |
| `TeamManagementPanel`    | team-management-table.md | Initiative → Team, Assessment → Team         |
| `ToggleBlock`            | building-blocks.md       | Sekcje rozwijane                             |

---

## Hierarchia importów (preferowana)

```
@/components/shared/NModeLayout     → layout shell
@/components/shared/NModeSections   → section canvases (Comments, Activity, Risk, Governance, Attachments)
@/components/shared/NModeBlocks     → building blocks (Callout, ToggleBlock, EmptyState, Checklist, InlineTable, EmbeddedView)
@/components/MyWork/shared          → artifact-specific shared (Stakeholders, Dependencies, Escalation)
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
