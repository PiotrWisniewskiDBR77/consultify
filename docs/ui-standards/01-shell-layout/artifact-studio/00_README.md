# Artifact Studio — DOC, PPT i XLSX

> Status: `APPROVED_SPEC / RUNTIME_PARTIAL`
> Data decyzji właścicielskich: 2026-08-08
> Zakres: otwarte dokumenty, prezentacje i skoroszyty w module Materials
> Poza zakresem: tworzenie i administracja szablonami
> Autorytet nadrzędny: [`../../CANON.md`](../../CANON.md)

## Cel pakietu

Ten katalog jest wykonawczą specyfikacją trzech studiów artefaktów. Nie ustanawia
konkurencyjnego kanonu aplikacji. Doprecyzowuje `CANON.md` wyłącznie dla
otwartych artefaktów DOC, PPT i XLSX.

Pakiet zastępuje w tym zakresie historyczne założenie, że każde studio może
budować własny shell, własny panel AI lub własną hierarchię toolbarów.

## Kolejność czytania

1. [`01_OWNER_DECISIONS_AND_ARCHITECTURE.md`](01_OWNER_DECISIONS_AND_ARCHITECTURE.md)
2. [`02_COMMAND_AND_INTERACTION_CONTRACT.md`](02_COMMAND_AND_INTERACTION_CONTRACT.md)
3. [`03_DOCUMENT_STUDIO_SPEC.md`](03_DOCUMENT_STUDIO_SPEC.md)
4. [`04_PRESENTATION_STUDIO_SPEC.md`](04_PRESENTATION_STUDIO_SPEC.md)
5. [`05_SPREADSHEET_STUDIO_SPEC.md`](05_SPREADSHEET_STUDIO_SPEC.md)
6. [`06_ACCEPTANCE_AND_EVIDENCE.md`](06_ACCEPTANCE_AND_EVIDENCE.md)
7. [`07_IMPLEMENTATION_ACTION_PLAN.md`](07_IMPLEMENTATION_ACTION_PLAN.md)
8. [`08_AGENT_EXECUTION_PACKETS.md`](08_AGENT_EXECUTION_PACKETS.md)
9. [`09_EXECUTION_CONTROL_BOARD.md`](09_EXECUTION_CONTROL_BOARD.md)
10. [`10_BASELINE_AND_SAFETY_MAP.md`](10_BASELINE_AND_SAFETY_MAP.md)

## Status prawdy

- `APPROVED_SPEC` oznacza zatwierdzony model docelowy.
- `RUNTIME_PARTIAL` oznacza, że istniejący produkt realizuje tylko część modelu.
- Obecność przycisku, renderera albo endpointu nie oznacza kompletnej funkcji.
- Funkcja P0 może być widoczna dopiero po przejściu pełnego kontraktu wykonawczego.
- `READY_FOR_CODEX_REVIEW` nie oznacza akceptacji.

## Jawna rozbieżność ze starszym standardem

Pliki `../artifact-shell.md` i `../artifact-shell-future-standard.md` opisują
ogólny shell artefaktów N/C oraz historyczne cztery warstwy. Nie są wzorcem
otwartych studiów DOC/PPT/XLSX w miejscach, gdzie wymagają osobnego paska
właściwości, stałego AI w górnym CTA albo niezmiennej szerokości 242 px.

Dla studiów objętych tym pakietem obowiązują decyzje właścicielskie poniżej:

- Menu 1 pozostaje nietknięte;
- Menu 2 jest jedną linią artefaktu;
- Menu 3 jest jednym dynamicznym paskiem kontekstowym;
- istnieje jeden przełączalny panel po lewej;
- prawa strona jest zarezerwowana wyłącznie dla globalnej Teresy;
- standardowy skrót Teresy w bottom barze pozostaje;
- szablony są poza zakresem.

Rozbieżność musi zostać formalnie włączona do nadrzędnego kanonu podczas
osobnego review dokumentacji. Nie wolno na jej podstawie mieszać obu anatomii
w jednym ekranie.

## Warunek rozpoczęcia implementacji

Implementacja może rozpocząć się pakietowo po zatwierdzeniu baseline'u i
wspólnych kontraktów. Usuwanie legacy jest zabronione do czasu przejścia pełnej
bramki parytetu, runtime i rollbacku.
