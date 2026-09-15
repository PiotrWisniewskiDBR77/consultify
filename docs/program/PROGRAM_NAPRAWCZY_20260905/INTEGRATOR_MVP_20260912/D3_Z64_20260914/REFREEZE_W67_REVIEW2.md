# A/D D-3 + Z-64 + W67 — refreeze after review 2

**Werdykt autora: READY_FOR_INDEPENDENT_REVIEW_WITH_STOP_OWNER_DECISION. P1/P2/P3 z przeglądu `87b1045380` są naprawione dowodowo; widoczność sesji OWNER→ADMIN została sklasyfikowana jako `PREMISE_NOT_REPRODUCED`, bo exact base była już zielona, natomiast rzeczywista poprawka kodu błędu cross-tenant pozostaje zielona dopiero w kandydacie.**

## Tożsamość

- Exact base: `59a8c44c04`.
- Content tip przed tym refreeze: `eeb81b944c`.
- Gałąź: `codex/a-d3-debts-z64-20260914`.
- Poprzedni refreeze `87b1045380` jest checkpointem HOLD; niniejszy dokument go zastępuje.
- Migracje produktu, deploy i push na chronione gałęzie: brak.

## Z-64 — wynik ponownej reprodukcji

Pełny scenariusz został rozłożony na dwie bramki zachowania. Zamontowany `AssessmentHub` zaczyna bez sesji, następnie dostaje organization-scoped payload z sesją utworzoną przez innego `ownerUserId`, jest ponownie montowany jako odpowiednik odświeżenia strony ADMIN i pokazuje tę sesję bez filtra właściciela. Ten sam test ma **7/7 PASS na exact base i 7/7 PASS w kandydacie**. RealPG na jednej bazie potwierdza, że OWNER tworzy, ADMIN tej samej organizacji widzi, a MEMBER obcej organizacji nie widzi.

Wynik pomiaru: premise „ADMIN nie widzi sesji OWNER” jest **NOT_REPRODUCED**. `GET/list`, `MethodSessionService` i klient `listSessions` są byte-unchanged względem bazy. Nie przypisujemy tej paczce naprawy widoczności. Exact-base RealPG ma **14/15**: widoczność ADMIN jest PASS, jedyne RED to brak `METHOD_SESSION_ORG_FORBIDDEN` w odpowiedzi obcego odczytu. Kandydat ma **15/15**, ponieważ rzeczywisty fix normalizuje ten kod; osobno zachowuje kanoniczny offline abort → ErrorState → `Try again`.

## N1 — trzy pigułki Menu3

`All` nie jest już pigułką. Total `All 43` jest osobnym podsumowaniem, a Menu3 zawiera dokładnie trzy kategorie: `Draft 8`, `Ready 34`, `Other statuses 1`. Zamontowany test realnego huba ma **22/22 PASS** i mierzy `pillCount=3` oraz `8 + 34 + 1 = 43`.

## Rzeczywiste zrzuty produktu

Stary ekran kart licznikowych został zastąpiony harnessami, które montują rzeczywiste komponenty produktu i podają tylko deterministyczne dane API. Ten sam harness skopiowano bez zmian do odłączonego worktree exact base; dlatego na parach BEFORE/AFTER różni się kod produktu, a nie konstrukcja zrzutu.

- N1, `ReportsAndPresentationsHub`: baza pokazuje pigułki `All 43`, `Draft 8`, `Ready 34`; kandydat pokazuje osobny total `All 43` i trzy pigułki `Draft 8`, `Ready 34`, `Other statuses 1`.
- N2, `AuditLibraryTab`: lista pokazuje 9, baza w szczególe 3, kandydat w szczególe 9.
- N4, `GovernedContextWorkspace`: baza pokazuje `Claims (200)` bez mianownika, kandydat `Claims (727)` i `Showing 200 of 727`.
- Wszystkie 6 PNG ma 57–150 KiB, język EN, viewport 1440×900 i zero `pageerror`. Surowy tekst i parametry URL są obok w JSON.

Dowody: `evidence/d3-z64-w67-review2/screens/base/` i `screens/candidate/`.

## Bramka końcowa review 2

- Focused, każdy plik osobno, `--retry=0`: **9 plików / 72 testy PASS**.
- RealPG, `MOCK_DB=false`, PostgreSQL `127.0.0.1:6454/consultify_d3`: **31/31 PASS**.
- Frontend TypeScript: **177 błędów = baseline 177**. Server TypeScript: **0 błędów**.
- Esbuild nowych/zmienionych plików review 2: **3/3 PASS**.
- `git diff --check 59a8c44c04...HEAD`: **exit 0** po usunięciu końcowych spacji z odziedziczonych raw logs.
- Hash ledger: `REFREEZE_W67_REVIEW2_SHA256.txt`; obejmuje manifest, receipt oraz każdy log, PNG i JSON użyty przez ten refreeze.

## Niezmieniony STOP_OWNER_DECISION

`contractMirrorDrift` pozostaje **4 FAIL / 3 PASS**. Paczka nie zmienia kontraktu ani P-T13. Wariant A kanonizuje `TransitionAuthority` w publicznym kontrakcie. Wariant B, nadal rekomendowany, wydziela server-only authority i synchronizuje publiczne lustra. Decyzja właściciela pozostaje wymagana.

Independent review tego refreeze: **NOT_RUN**.
