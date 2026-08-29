---
module_id: MODULE_MY_WORK
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-30
---

# My Work — aktualny kontrakt funkcjonalny

> ### ★ DWA SPISY FUNKCJI TEGO SAMEGO MODUŁU — stan do uzgodnienia (2026-08-29)
>
> Ten kontrakt wylicza **9** pozycji `MW-F-001…MW-F-009` (w tym Client Vault i Run
> Agent). `00_META.md` wylicza **12** pozycji `MW_*` i **nie zawiera ani Client Vault,
> ani Run Agent**. `STATUS.md` orzeka „pokrycie kompletne `12/12`", podczas gdy katalog
> `functions/` zawiera **14** plików, a `function-cards/` — **11**.
>
> **Nie ma przelicznika `MW-F-*` ↔ `MW_*` i nikt go dotąd nie zrobił.** Do czasu jego
> powstania **żadna liczba funkcji tego modułu nie jest wiążąca** — ani 9, ani 12,
> ani 14. Wykonawca, który potrzebuje listy, bierze ją z katalogu `functions/`
> i wpisuje do raportu własny pomiar (`Z24`).
>
> Zakres zagnieżdżony potwierdzony w [`../../FUNCTIONAL_DOCUMENTATION.md`](../../FUNCTIONAL_DOCUMENTATION.md):
> **Client Vault i Run Agent nie są osobnymi pozycjami menu** — należą do My Work.


Szczegółowa kolejność i granice osobnych pakietów produktowych znajdują się w
[`MY_WORK_DOCUMENTATION_MAP.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_DOCUMENTATION_MAP.md).
Niniejszy dokument pozostaje kontraktem nadrzędnym wspólnego modułu.

Pierwszy szczegółowy pakiet:
[`MY_WORK_IDEAS_REVIEW.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_IDEAS_REVIEW.md).

Canonical Notes review package starts at
[`MY_WORK_NOTES_REVIEW.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_NOTES_REVIEW.md).

Canonical Calendar review package starts at
[`MY_WORK_CALENDAR_REVIEW.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_CALENDAR_REVIEW.md).

Canonical Inbox review package starts at
[`MY_WORK_INBOX_REVIEW.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_INBOX_REVIEW.md).

Canonical Tasks + Decisions package starts at
[`MY_WORK_TASKS_AND_DECISIONS_OPERATING_SYSTEM.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_TASKS_AND_DECISIONS_OPERATING_SYSTEM.md).

Canonical Client Vault package starts at
[`MY_WORK_CLIENT_VAULT_REVIEW.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_CLIENT_VAULT_REVIEW.md).

Canonical Run Agent package starts at
[`MY_WORK_RUN_AGENT_REVIEW.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_RUN_AGENT_REVIEW.md).

## Cel i granica

My Work jest osobistym centrum pracy użytkownika. Zbiera przypisane zadania,
decyzje, pomysły, notatki, kalendarz i powiadomienia, ale nie przejmuje
własności obiektów domenowych. Client Vault i Run Agent są funkcjami
zagnieżdżonymi My Work, nie osobnymi pozycjami menu.

## Mapa funkcji

| ID | Funkcja | Stan |
| --- | --- | --- |
| `MW-F-001` | Home / radar pracy | AS-IS |
| `MW-F-002` | Ideas i tryby pracy wizualnej | AS-IS |
| `MW-F-003` | Notebook | AS-IS |
| `MW-F-004` | Inbox i powiadomienia | AS-IS |
| `MW-F-005` | Calendar | AS-IS |
| `MW-F-006` | Tasks i Decisions | AS-IS |
| `MW-F-007` | Manager | AS-IS |
| `MW-F-008` | Client Vault | partial |
| `MW-F-009` | Run Agent | partial |

## Główny przepływ

Użytkownik otwiera `/my-work/*`, wybiera rodzaj pracy, przegląda obiekty
zebrane z modułów właścicielskich, wykonuje akcję lub przechodzi do źródła.
Zmiana stanu obiektu ma zostać zapisana przez API jego właściciela, a My Work
odświeża widok i zachowuje link zwrotny.

## Dane, role, AI i integracje

My Work agreguje, nie duplikuje prawdy. Widoczność wynika z organizacji,
projektu, przypisania i roli. Teresa może porządkować, streszczać i proponować
pracę; wykonanie akcji zmieniającej stan wymaga jawnego potwierdzenia oraz
zapisu u właściciela. Moduł integruje wszystkie główne pozycje menu.

## AS-IS

Rodzina tras `/my-work/*` montuje `MyWorkView`; mapowanie sidebara jest aktywne.
Home, Ideas, Notebook, Inbox, Calendar, Tasks, Decisions i Manager mają
powierzchnie runtime. Pokrycie testami jest nierówne: tryby tabelaryczne są
lepiej udowodnione niż pełne podróże po hubie.

## TO-BE

Jeden spokojny cockpit pokazujący: co wymaga uwagi, dlaczego, do kiedy, z
jakiego procesu pochodzi i jaka akcja jest bezpieczna. Każdy wpis ma właściciela,
priorytet, termin, provenance i przejście do obiektu źródłowego.

## Luki i bramka

- potwierdzić aktualny zestaw zakładek oraz zachowanie mobile;
- udowodnić pełne przepływy Inbox/Tasks/Decisions/Manager;
- ujednolicić Client Vault i Run Agent z uprawnieniami My Work;
- sprawdzić brak duplikacji statusów między agregatem a modułem właścicielskim;
- dodać testy tenant isolation i akcji masowych.

Ocena: `B`. Dowody: `STATUS.md`, `CODEMAP.md`, `03_BEHAVIOR.md`,
`05_DATA_AND_INTEGRATIONS.md`, trasy aplikacji i testy My Work.
