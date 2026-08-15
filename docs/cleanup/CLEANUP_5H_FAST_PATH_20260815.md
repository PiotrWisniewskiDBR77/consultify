# Plan domykania 48h: od inwentaryzacji do `MODULE_ACCEPTED`

## Stan aktualny (2026-08-15)
- Runner dowód: `f6a00552802d3a5d0f2bbd2c72316c05b55b8f82` (4052 pliki, 39 884 testów: 38 798 PASS / 581 FAIL / 485 PENDING / 19 TODO).
- 0 missing / 0 unexpected; performance gate oddzielony jako PENDING.
- Brama obecna: `READY_FOR_BLOCKER_CLEANSING`.
- Najwięcej non-green pozostaje w: `tests/integration` (136), `tests/components` (55), `tests/unit` (49), `src/components` (23), `server/src` (13).

## Warunek startu
- Utrzymujemy freeze kodowy poza zadaniami domykającymi.
- Nie ruszamy kolejnych branchy ani nowych feature-worktreeów.
- Każda zmiana idzie jako modułowy pakiet P1/P2.

## Kolejność zamykania (realistyczna na 5h)

### Blok A — Konsekwentna baza (60–90 min)
1. `docs/cleanup/CANONICAL_CLEANUP_CHECKPOINT_20260815.md` jako jedyny punkt wejścia stanu.
2. Utworzyć plan usuwania/klasyfikacji untracked w 3 koszykach:
   - `keep-for-docs` (potrzebny dowód)
   - `quarantine-local` (sprzęt / zrzuty / tymczasowe)
   - `archive-backup` (gotowe unikalne commity/artefakty)
3. Przygotować branch mapę: `source->target canonical route` per moduł.

### Blok B — Moduł 1: My Work (`00:30` + `00:30`)
1. Zamknąć i potwierdzić: `route->component->api` (bez UI zmian)
2. Wypisać wszystkie surface i brakujące evidence (`table`, `preview`, `menu`, `inside`)
3. Nadpisać stan na `READY_FOR_RUNTIME` lub `BLOCKED_RUNTIME`.

### Blok C — Moduł 2: Execution + Initiatives (`01:00`)
1. Ujednolicić status route mount + feature flags.
2. Zweryfikować, co jest naprawdę na produkcji (nie tylko test lokalny).
3. W każdym z tych modułów zamknąć decision row:
   - implemented surface
   - partial surface
   - dead/duplicate/unmounted surface

### Blok D — Moduł 3: Results + ROI/OKR/KPI (`01:00`)
1. Wymuszyć spójność wejścia: oddzielne tabelki nadrzędne + detal.
2. Wyeliminować placeholderowe/tech-UI stany, które ukrywają braki.
3. W razie braku fixture data oznaczyć jawnie jako `BLOCKED_DATA`.

### Blok E — Moduł 4: Finance + Materials (`01:00`)
1. Jedna mapa ownera (`finance` + `artifact`) i decyzja `DUPLIKAT/KEEP` per ścieżka.
2. Wyróżnić listy vs detail i zamknąć mapę ścieżek wejścia.
3. Jeśli brakuje danych, ograniczyć do `BLOCKED_DATA` bez „udawanych” done.

### Blok F — Weryfikacja końca dnia (`30 min`)
1. Jeden `module closure ledger` z 16 modułami.
2. Aktualizacja bramki `goal`: status `INVENTORIED`, `FIX_REQUIRED`, `BLOCKED` (z przyczyną), `READY_FOR_NEXT_BLOCK`.
3. Przygotować listę „jeden moduł = jedna decyzja” na następny dzień.

### Blok G — warunki wejścia / wyjścia
- **Wejście:** status dokumentów musi być zgodny z live `git status` i test summary.
- **Wyjście:** każda sekcja ma pojedynczą decyzję i przypisanie właściciela naprawy.
- **Warunek końcowy:** żadna nowa praca produktowa poza modułowym naprawczym pakietem zatwierdzonym przez ledger.

## Zakaz rozszerzania zakresu
- Nie zmieniamy logiki biznesowej poza wymaganiami przyjętych modułów.
- Nie dodajemy nowych ekranów.
- Nie zamykamy modułu bez pełnego łańcucha A–Q.
