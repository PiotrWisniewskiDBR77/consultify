# Consultify UI/UX — macierz zgodności modułów

> **Status:** operacyjny rejestr zgodności.  
> **Standard oceny:** [`UI_UX_IMPLEMENTATION_STANDARD.md`](UI_UX_IMPLEMENTATION_STANDARD.md).  
> **Dozwolone statusy:** `ACCEPTED`, `ACCEPTED_WITH_CORRECTION`, `NEEDS_STANDARD`, `REJECTED`, `NOT_EVIDENCED`, `OUT_OF_SCOPE`.

## 1. Sposób użycia

Każdy moduł ma własne `docs/modules/<moduł>/04_UI_UX.md`. Ten rejestr nie zastępuje specyfikacji modułu — pokazuje, czy została ona domknięta i potwierdzona obrazami oraz działającym przepływem.

Właściciel modułu aktualizuje pięć bramek:

- `SPEC` — pełny kontrakt UI/UX w `04_UI_UX.md`;
- `LIST` — Menu 2/3, lista/tabela/grid/kanban, menu i filtry;
- `PREVIEW` — panel szybkiego podglądu, jeśli moduł operuje rekordami;
- `INSIDE` — pełne wnętrze/workspace/wizard i jego sekcje;
- `STATES` — loading, empty, error, locked, long data, light/dark;
- `EVIDENCE` — prawidłowo nazwane ujęcia i test krytycznego przepływu.

`N/A` jest dopuszczalne wyłącznie z uzasadnieniem w `04_UI_UX.md`.

## 2. Macierz 19 modułów

| # | Moduł | Specyfikacja modułu | Główny typ UI | Wzorzec referencyjny | SPEC | LIST | PREVIEW | INSIDE | STATES | EVIDENCE | Decyzja |
|---:|---|---|---|---|---|---|---|---|---|---|---|
| 01 | Czat | [`01_czat/04_UI_UX.md`](../modules/01_czat/04_UI_UX.md) | conversation + canvas | Chat shell + artifact workspace | REVIEW | N/A | N/A | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 02 | Moja Praca | [`02_moja-praca/04_UI_UX.md`](../modules/02_moja-praca/04_UI_UX.md) | multi-tool hub | Zadania + Decyzje | REVIEW | PARTIAL | PARTIAL | PARTIAL | PARTIAL | 146 screenshots | `ACCEPTED_WITH_CORRECTION` |
| 03 | Wywiad | [`03_wywiad/04_UI_UX.md`](../modules/03_wywiad/04_UI_UX.md) | guided workflow | Wizard + N-mode | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 04 | Narzędzia | [`04_narzedzia/04_UI_UX.md`](../modules/04_narzedzia/04_UI_UX.md) | library + tool workspace | Triada + artifact | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 05 | Inicjatywy | [`05_inicjatywy/04_UI_UX.md`](../modules/05_inicjatywy/04_UI_UX.md) | portfolio + card detail | Triada + Decyzje | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 06 | Realizacja | [`06_realizacja/04_UI_UX.md`](../modules/06_realizacja/04_UI_UX.md) | portfolio + PMO workspace | Triada + Zadania | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 07 | Rezultaty | [`07_rezultaty/04_UI_UX.md`](../modules/07_rezultaty/04_UI_UX.md) | KPI dashboard + detail | Hub + interactive board | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 08 | Finanse | [`08_finanse/04_UI_UX.md`](../modules/08_finanse/04_UI_UX.md) | models + analysis workspace | Finance canon + artifact | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 09 | Outputs | [`09_outputs/04_UI_UX.md`](../modules/09_outputs/04_UI_UX.md) | library + preview | Triada + export | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 10 | Dokumenty | [`10_dokumenty/04_UI_UX.md`](../modules/10_dokumenty/04_UI_UX.md) | library + editor | Notebook editor + export | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 11 | Tabele | [`11_tabele/04_UI_UX.md`](../modules/11_tabele/04_UI_UX.md) | workbook/canvas | Table artifact | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 12 | Prezentacje | [`12_prezentacje/04_UI_UX.md`](../modules/12_prezentacje/04_UI_UX.md) | generator + deck workspace | Wizard + artifact + export | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 13 | Meeting | [`13_meeting/04_UI_UX.md`](../modules/13_meeting/04_UI_UX.md) | agenda + meeting workspace | Calendar + N-mode | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `OUT_OF_SCOPE` |
| 14 | MCP IRIS | [`14_mcp-iris/04_UI_UX.md`](../modules/14_mcp-iris/04_UI_UX.md) | integration/configuration | Hub + wizard | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `OUT_OF_SCOPE` |
| 15 | MCP Marketplace | [`15_mcp-marketplace/04_UI_UX.md`](../modules/15_mcp-marketplace/04_UI_UX.md) | marketplace + detail | Library + preview | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `OUT_OF_SCOPE` |
| 16 | Organizacja | [`16_organizacja/04_UI_UX.md`](../modules/16_organizacja/04_UI_UX.md) | settings + people tables | App table + forms | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 17 | Panel Administratora | [`17_panel-administratora/04_UI_UX.md`](../modules/17_panel-administratora/04_UI_UX.md) | admin tables/configuration | App table + forms | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 18 | Ustawienia | [`18_ustawienia/04_UI_UX.md`](../modules/18_ustawienia/04_UI_UX.md) | settings/forms | Forms + permissions | REVIEW | N/A | N/A | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |
| 19 | Portal Partnerski | [`19_portal-partnerski/04_UI_UX.md`](../modules/19_portal-partnerski/04_UI_UX.md) | portal + shared artifacts | Portal shell + Triada | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | PARTIAL | `NOT_EVIDENCED` |

`REVIEW` i `PARTIAL` są wartościami roboczymi pól bramki, nie decyzją końcową.

## 3. Moja Praca — mapa funkcji i evidence

Katalog: [`artifacts/visual-qa/module-catalog-2026-08-02/02_my-work`](../../artifacts/visual-qa/module-catalog-2026-08-02/02_my-work/README.md).

| Funkcja | Evidence | Obowiązkowe powierzchnie | Ocena startowa |
|---|---:|---|---|
| Pomysły | 28 | list, preview, Table, Process Flow, Mind Map, Whiteboard | `PARTIAL` — szeroki materiał; wykonać checklistę stanów |
| Notatnik | 21 | library, menus, preview, editor, context, graph, history | `PARTIAL` |
| Inbox | 9 | list/grid, menus, preview/detail, AI actions | `PARTIAL` |
| Kalendarz | 8 | month/week/day/agenda, event preview/form/conflict | `PARTIAL` |
| Zadania | 18 | list, columns, preview, detail sections | `REFERENCE_ACCEPTED` |
| Decyzje | 18 | list, preview, menu, detail sections | `REFERENCE_ACCEPTED` |
| Sejf klienta | 13 | vault list, menus, preview, documents/upload | `PARTIAL` |
| Run agent | 18 | process list, preview, wizard, workspace | `PARTIAL` |
| Manager | 10 | cockpit, lanes, preview/detail, AI actions | `PARTIAL` |

## 4. Karta odbioru funkcji

Skopiuj poniższy blok do modułowego `04_UI_UX.md` dla każdej funkcji:

```md
### UI/UX acceptance — <FUNCTION_ID>

- User job:
- Entry route:
- Screen type:
- Reference implementation:
- Primary CTA:
- Menu 2 / Menu 3:
- List/table/card anatomy:
- Kebab / context menu:
- Preview contract:
- Inside/workspace sections:
- Wizard steps (if any):
- AI scope and review:
- Permission/locked behavior:
- Loading/empty/error/long-data:
- Light/dark evidence:
- Keyboard/a11y evidence:
- Screenshot folder:
- Automated test:
- Decision: NOT_EVIDENCED
- Corrections:
- Owner / date:
```

## 5. Kryterium ukończenia modułu

Moduł może otrzymać `ACCEPTED` wyłącznie gdy:

1. wszystkie funkcje w module mają kartę odbioru;
2. żadna funkcja MVP nie ma statusu `NOT_EVIDENCED`, `REJECTED` ani `NEEDS_STANDARD`;
3. krytyczne ścieżki mają test funkcjonalny;
4. zestaw Visual QA obejmuje listę, menu, preview, wnętrze i stany;
5. light/dark oraz długie dane nie łamią layoutu;
6. poprawki mają właściciela i nie są ukryte w komentarzach do screenshotów.

