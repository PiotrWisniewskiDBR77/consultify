# Modules (catalog) — start here

Cel tego katalogu: trzymać **jeden, spójny punkt odniesienia** dla wszystkich modułów (dla ludzi i agentów), w kolejności jak w sidebarze aplikacji.

Ten katalog jest **kuratorską nakładką** na istniejące SSOT w `DRD/consultify/docs/` (np. routing w `docs/modules/`). Nie przenosimy teraz istniejących dokumentów — zamiast tego linkujemy do nich z poziomu folderu danego modułu.

## Zasady

- Numeracja = **kolejność w sidebarze**.
- Folder modułu = `NN_<slug>/` (NN = 2 cyfry).
- Praca na wymaganiach autora odbywa się wg: `INSTRUKCJA_KONTRAKTU.md`.
- Każdy folder modułu ma **dwie warstwy dokumentacji**:
  - **Warstwa nawigacyjna (entrypoint, szybkie linki):**
    - `README.md` (wejście + skrót)
    - `SSOT.md` (źródła prawdy i ich priorytet)
    - `CODEMAP.md` (route, komponenty, backend)
    - `STATUS.md` (shipped/wkrótce + ryzyka)
  - **Warstwa kontraktowa (kanoniczna, wiążąca):**
    - `00_META.md` … `07_ACCEPTANCE_AND_TESTS.md` + `CHANGELOG.md`
    - `RAW_INPUT.md` jako surowe wejście autora (nie jest kanoniczne; jest materiałem źródłowym do przepisania)

### Która warstwa jest kanoniczna?

- **Jedynym kanonicznym źródłem prawdy o zachowaniu modułu jest warstwa kontraktowa** (`00-07`).
- Pliki nawigacyjne są indeksami i nie powinny duplikować treści kontraktu (tylko streszczenie + linki).

## Lista modułów (sidebar order)

> Uwaga: **`Tabele Studio` jest obecnie duplikatem** `Tabele` w nawigacji — w katalogu modułów **pomijamy** `Tabele Studio` i traktujemy to jako ten sam moduł.
>
> `Wyloguj się` nie jest modułem (akcja systemowa) — nie tworzymy dla niego folderu.

1. `01_czat` — Czat
2. `02_moja-praca` — Moja Praca
3. `03_wywiad` — Wywiad
4. `04_narzedzia` — Narzędzia
5. `05_inicjatywy` — Inicjatywy
6. `06_realizacja` — Realizacja
7. `07_rezultaty` — Rezultaty
8. `08_finanse` — Finanse
9. `09_outputs` — Outputs
10. `10_dokumenty` — Dokumenty (wkrótce)
11. `11_tabele` — Tabele (wkrótce)
12. `12_prezentacje` — Prezentacje (wkrótce)
13. `13_meeting` — Meeting (wkrótce)
14. `14_mcp-iris` — MCP IRIS (wkrótce)
15. `15_mcp-marketplace` — MCP Marketplace (wkrótce)
16. `16_organizacja` — Organizacja
17. `17_panel-administratora` — Panel Administratora
18. `18_ustawienia` — Ustawienia
19. `19_portal-partnerski` — Portal Partnerski

## SSOT (global) dla modułów

- Routing i granice odpowiedzialności modułów: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- Rejestr kanonicznych dokumentów: `DRD/consultify/docs/product/DOCUMENTATION_REGISTRY.md`
- Standard UI/UX dla modułów (Menu 2/3, huby): `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`

## Coverage Manifest

- `_AUTHOR_CONTRACT_COVERAGE_2026-05-09.md` — aktualny manifest pokrycia źródeł przez kontrakty modułów.
