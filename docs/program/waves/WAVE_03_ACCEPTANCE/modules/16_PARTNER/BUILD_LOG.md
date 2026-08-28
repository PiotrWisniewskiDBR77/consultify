# Partner — build/review log

## 2026-08-28 — wznowienie na f87043a i tipie a3c702e

- Naprawiono przestarzałą blokadę seedera `831` migracji; test kontraktu 8/8 PASS, bez wyciszania i bez migracji.
- Lokalny fixture Partnera został zasiany na PG 5934; runtime na server 4392/client 3992 potwierdził tip `a3c702e…`, 862 migracje i readiness 200.
- Wykonano 100 zrzutów: 25 sekcji × dwa motywy × pusty/pełny. Pełny i pusty stan były rzeczywistymi stanami własnej lokalnej DB, a dump przywrócił pełny fixture po próbie pustej.
- Logowanie i 19/20 nazwanych odczytów Gateway zwróciło 200. Earnings zwrócił 500 przy nieustalonej polityce accrual; projects ukrywa błąd porównania UUID/text pod odpowiedzią 200.
- Build serwera i frontu: exit 0. Znaleziono mieszaną polsko-angielską lokalizację. G11–G20 pozostają wejściem do kolejnej naprawy/oceny, nie są fikcyjnie zamknięte.

## 2026-08-28 — Day62 owner review

- Marker/HEAD: `5e30cb9bf66c8e75481ba723debdd04f3c1a6893`.
- To był odbiór, nie budowa; kod, testy, config i migracje pozostały bez zmian.
- Obejrzano: pełny mianownik źródłowy Partnera (25 sekcji sidebara/runtime; 5 aliasów legacy bez podwójnego liczenia), lokalną barierę logowania po wejściu na `/partner`, świeżą DB, migracje, konfigurację poczty, tabele outbox i procesy.
- Działało: związanie markera, izolowany worktree, PG 5934, migrator `858` potem `0`, Vite 3992, anonimowy redirect do logowania, brak skonfigurowanej poczty i zero wierszy outbox.
- Pękło: repozytoryjny fixture Partnera odmówił bazy wymaganej przez dyżur, ponieważ akceptuje tylko `consultify_w3_partner_owner_*`; brak dozwolonej persony zatrzymał pełny visual packet oraz realną ścieżkę G09.
- Decyzje potrzebne od Piotra/integratora: ujednolicić nazwę bazy instrukcji z fail-closed kontraktem fixture albo dostarczyć markerowy fixture wspierający `consultify_day62_partner_review`; wskazać brakujący `04_KARTA_DOWODOWA.md`; rozstrzygnąć, czy angielski login należy do polskiego mianownika Partnera.
- Wynik: G07 `PARTIAL — REVIEW_CARD_PREPARED`; G08 `PARTIAL 0/25`; G09 `PARTIAL/NOT_PROVEN`; G10 `PARTIAL/NOT_PROVEN`; G11–G20 bez zmian.
- Raport: `../../codex/CODEX_DAY62_PARTNER_OWNER_REVIEW_REPORT.md`.
- Commit raportu: uzupełniany po commicie w SHA oddania; niniejszy wpis jest częścią tego samego commita.
