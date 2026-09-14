# A/D D-3 + Z-64 + W67 — refreeze after review 3

**Werdykt autora: READY_FOR_INDEPENDENT_REVIEW_WITH_STOP_OWNER_DECISION_AND_BLOCKED_BACKUP. Jedyny P1 rereview został naprawiony zachowaniem: `Other statuses` jest przyciskiem filtrującym listę do statusów resztkowych, a ponowne kliknięcie przywraca pełny zbiór.**

## Tożsamość

- Exact base: `59a8c44c04`.
- Product tip: `3598bc2356`.
- Evidence tip przed refreeze: `fafd9c372b`.
- Gałąź: `codex/a-d3-debts-z64-20260914`.
- Poprzedni refreeze `f8d8d0e70a` był checkpointem HOLD; ten dokument go zastępuje.
- Migracje produktu i deploy: brak.

## N1 — interaktywny Menu3

`All 43` pozostaje podsumowaniem poza pigułkami. Menu3 ma dokładnie trzy przyciski: `Draft 8`, `Ready 34`, `Other statuses 1`. `Other statuses` korzysta z jednego helpera współdzielonego z listami Dokumentów, Prezentacji i Arkuszy. Obejmuje `generated`, `editing`, `exported`, `shared` i `archived`, czyli każdy niepusty status poza `draft` i `ready`.

Test zamontowanego `ReportsAndPresentationsHub` klika `Other statuses`, potwierdza obecność wyłącznie rekordu `generated`, brak rekordów `draft` i `ready`, następnie klika ponownie i potwierdza powrót wszystkich trzech grup. Wynik: hub **22/22 PASS**, helper **8/8 PASS**, razem N1 focused **30/30 PASS**. Esbuild czterech dotkniętych plików produktu: **4/4 PASS**.

## Zachowane bramki poprzedniego refreeze

- Z-64 OWNER→ADMIN: `PREMISE_NOT_REPRODUCED`; exact base mounted 7/7 i candidate 7/7. RealPG base 14/15, candidate 15/15. Rzeczywiste poprawki pozostają ograniczone do kodu błędu cross-tenant i retry po offline abort.
- Real-product screenshots: 6/6 EN dla N1/N2/N4, base i candidate.
- Poprzednia pełna bramka: focused 72/72, RealPG 31/31, server tsc 0, frontend tsc 177 = baseline 177.
- `contractMirrorDrift`: nadal `STOP_OWNER_DECISION`, 4 FAIL / 3 PASS; P-T13 i kontrakty bez zmian.

## Integralność dowodów

`realpg-migrate.log` został dodany jawnie do repo, ponieważ wcześniejszy ledger odwoływał się do lokalnego pliku ignorowanego przez `logs`. Nowy `REFREEZE_W67_REVIEW3_SHA256.txt` obejmuje wyłącznie istniejące wymagane dowody, w tym surowe logi N1 review 3. `shasum -a 256 -c` oraz `git diff --check 59a8c44c04...HEAD` muszą zakończyć się kodem 0 przed przekazaniem.

## Backup — jawna awaria checkpointu

Dla checkpointu candidate `f8d8d0e70a`, sześć commitów przed zdalnym refem, remote `backup/codex/a-d3-debts-z64-20260914-w67-20260914` pozostał na `87b1045380`. Próby HTTPS zakończyły się `HTTP 408` oraz `Empty reply from server`; próba SSH zakończyła się `Permission denied (publickey)`. Stan checkpointu jest `BLOCKED_BACKUP`, bez twierdzenia o wykonanej kopii. Po nowym refreeze zostanie wykonana jedna ograniczona próba nowego exact backupu; jej wynik będzie zgłoszony w handoffie.

Independent review tego refreeze: **NOT_RUN**.
