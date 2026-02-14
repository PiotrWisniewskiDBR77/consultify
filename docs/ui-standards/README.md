# UI/UX Standards — Consultify

> **JEDYNE KANONICZNE ŹRÓDŁO** wytycznych UI/UX i specyfikacji komponentów.  
> **Data konsolidacji:** 2026-02-14

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

| Obszar                   | Dokument                                                                       | Zakres                                                                 |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Kolory**               | [00-foundation/color-system.md](00-foundation/color-system.md)                 | Paleta DBR77, semantyka, WCAG                                          |
| **Język wizualny**       | [00-foundation/visual-language.md](00-foundation/visual-language.md)           | Tła, ramki, typografia, motion                                         |
| **Shell artefaktu**      | [01-shell-layout/artifact-shell.md](01-shell-layout/artifact-shell.md)         | 4-warstwowy shell, tokeny rozmiaru                                     |
| **Tryby D/N/C**          | [01-shell-layout/presentation-modes.md](01-shell-layout/presentation-modes.md) | Architektura 3 trybów, N blocks kit                                    |
| **Współdzielone sekcje** | [02-components/shared-sections.md](02-components/shared-sections.md)           | CommentsCanvas, ActivityLog, Risk, Governance                          |
| **Building blocks**      | [02-components/building-blocks.md](02-components/building-blocks.md)           | Callout, ToggleBlock, EmptyState, Checklist, InlineTable, EmbeddedView |
| **Task Panel**           | [02-components/task-panel.md](02-components/task-panel.md)                     | TaskDetailView — layout, sekcje                                        |
| **Decision Panel**       | [02-components/decision-panel.md](02-components/decision-panel.md)             | DecisionDetailView — layout, sekcje                                    |
| **Notification Panel**   | [02-components/notification-panel.md](02-components/notification-panel.md)     | NotificationDetailView                                                 |
| **Initiative sections**  | [02-components/initiative-sections.md](02-components/initiative-sections.md)   | Karty inicjatywy (KPI, Decisions, Gates, RAID…)                        |
| **Moduł hub**            | [03-modules/module-hub-standard.md](03-modules/module-hub-standard.md)         | Struktura ekranu modułu                                                |
| **Tabele**               | [03-modules/app-table-standard.md](03-modules/app-table-standard.md)           | Standard tabel aplikacyjnych                                           |

---

## Katalog komponentów (alfabetycznie)

| Komponent                | Plik                  | Używany w                                    |
| ------------------------ | --------------------- | -------------------------------------------- |
| `ActivityLogCanvas`      | shared-sections.md    | Task, Decision, Initiative, Notification     |
| `AttachmentsLinksCanvas` | shared-sections.md    | Task, Decision, Initiative                   |
| `Callout`                | building-blocks.md    | Wszędzie (info/warning/critical)             |
| `ChecklistBlock`         | building-blocks.md    | Task, Notification                           |
| `CommentsCanvas`         | shared-sections.md    | Task, Decision, Initiative, Notification     |
| `DecisionDetailView`     | decision-panel.md     | MyWork                                       |
| `EmbeddedView`           | building-blocks.md    | Tasks, Decisions, RAID w artefaktach         |
| `EmptyStateInline`       | building-blocks.md    | Sekcje z pustym stanem                       |
| `GovernanceCanvas`       | shared-sections.md    | Task, Decision (RACI, Reminders, Escalation) |
| `InlineTable`            | building-blocks.md    | Options, KPIs, tabele lekkie                 |
| `NModeHeader`            | presentation-modes.md | Wszystkie artefakty N-mode                   |
| `NModeLeftNav`           | presentation-modes.md | Wszystkie artefakty N-mode                   |
| `NModePropertiesStrip`   | artifact-shell.md     | Wszystkie artefakty N-mode                   |
| `NotificationDetailView` | notification-panel.md | MyWork                                       |
| `RiskCanvas`             | shared-sections.md    | Task, Decision, Initiative                   |
| `TaskDetailView`         | task-panel.md         | MyWork                                       |
| `ToggleBlock`            | building-blocks.md    | Sekcje rozwijane                             |

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
4. **Stylowanie** — używaj tokenów DBR77 (rounded-2xl, navy-900, purple accents).
5. **i18n** — zawsze PL + EN via `useTranslation`.
6. **locked prop** — zawsze obsługuj read-only dla artefaktów.

---

## Źródła prawdy (techniczne)

- **Kolory i tokeny:** `tailwind.config.js`
- **Style globalne:** `src/index.css`
- **Semantyka kolorów:** ten katalog → 00-foundation/color-system.md
