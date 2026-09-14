# A/D D-1 — siedem długów — freeze 2026-09-14

**Werdykt autora: READY_FOR_INDEPENDENT_REVIEW dla sześciu dostarczonych pozycji; D-1(e) pozostaje formalnie STOP/HOLD decyzją CTO, ponieważ zmiana `findings[].unitName` zmieniłaby `contentHash`.**

## Zakres i wynik

1. **(a) Jawne typy:** usunięto wszystkie 7 wystąpień `as any` z `WorkIntelligenceReport` i `executionWorkAnalysisService` poza `ExecutionHub`. Odczyty API, rekord trwały i wiersze pracy mają jawne typy; wyszukiwanie w obu plikach zwraca 0 `as any`, 0 `: any` i 0 `any[]`.
2. **(b) J2 w teście technicznym:** `asm-ui-canon-technical.spec.ts` po zamrożeniu otwiera Ustawienia i disclosure `drd-frozen-technical-details`. Test biegnie przez realny frontend, backend, JWT, ApiGateway i PostgreSQL. Naprawiono też należący do tego harnessu cleanup: własny wpis `test_support_cleanup` jest usuwany przed użytkownikiem fixture, więc FK nie blokuje sprzątania.
3. **(c) Martwy ekran legacy:** jedyny produktowy caller to `AssessmentSessionEditorView`, który zawsze montuje ścieżkę J2; `shouldMountDrdMethodWorkspace('drd', false)` i wariant `true` zwracają `true`. Stary ekran lokalny nie miał produktowego callera. Adapter zmalał z 1129 do 45 linii, a symbol `DrdMethodWorkspaceScreenLegacy` zniknął. Cztery testy wyłącznie martwej implementacji usunięto; kontrakt obu historycznych wartości flagi sprawdza test gatingu.
4. **(d) Dev-render Outputu:** fixture używa aktualnych, zamrażanych tekstów EN dla zakresu, ograniczeń, agregacji i demo bypass. Dodatkowy pusty odczyt magazynu zastanego jest obsłużony lokalnie, więc zrzuty nie mają 404 ani błędów konsoli.
5. **(e) STOP/HOLD:** `unitName` uczestniczy w pełnym `findings`, a `findings` w `buildHashableOutputContent`; podmiana `unitId` na nazwę locale zmieni hash nowych Outputów. Zgodnie z W59 i W60 nie zmieniono `EventDerivedOutputBridge.ts`, `MethodOutputService.ts`, `method-core.routes.ts`, `drdMatrixCellContent.ts` ani `DRD_STRUCTURE`.
6. **(f) `DocumentCardMenu5`:** usunięto domyślne `isPolish=true`. Komponent bierze język z bieżącego i18n i tłumaczy `common.sections`; wszyscy czterej callerzy dziedziczą locale bez ręcznego propa. Test behawioralny pokrywa EN i PL.
7. **(g) Z-48:** kanoniczna minimalna szerokość kolumny statusu w `FilterableTable` wynosi 160 px. Test pomiarowy obejmuje polską pigułkę `Zatwierdzona` i potwierdza brak obcięcia.

## Tożsamość i dowody po rebase W60

- Exact base: `4de31efbcb0c286cdcbdb0251b10a894db02848d`.
- Content tip przed tym freeze: `543084e98c`.
- Gałąź: `codex/a-d-d1-20260914`.
- Backup: `backup/codex/a-d-d1-20260914-20260914`.
- Focused i bezpośrednie rodzeństwo: **8 plików / 72 testy PASS**, każdy plik osobno, `--retry=0`.
- Szerszy pomiar rodzeństwa DRD: **54 testy; 43 PASS, 11 zastanych czerwieni** w trzech niezmienionych plikach (`naglowekIStanOdpowiedzi`, `skipCode`, `zapytajTerese`) oczekujących polskich etykiet przy bazowym języku EN. Delta D-1 nie dotyka tych plików.
- Realny PG: `executionWorkAnalysis.gateway.pg.test.ts` **3/3 PASS**, bez skip, na PG `127.0.0.1:5320/consultify_d1`.
- Realna przeglądarka: `asm-ui-canon-technical.spec.ts` **2/2 PASS**, Chromium, `--retries=0`, jeden worker; frontend `4217`, API `4218`, ta sama baza PG.
- Server TypeScript: **0 błędów**.
- Frontend TypeScript: **177 błędów łącznie, 0 w plikach paczki**; liczba wróciła do podłogi linii po poprawieniu jawnego typu fixture.
- Esbuild per produkcyjny plik: **12/12 PASS**.
- `git diff --check`: PASS. Hooki commitów: triada, gęstość, język, flagi i ratchety PASS; bez nowych `primary-*`/crimson.
- Zrzuty: `evidence/d1/screens/assessment-output-report-en-light.png` oraz `evidence/d1/screens/assessment-output-report-pl-dark.png`; oba czyste, bez chrome harnessu, błędów konsoli i HTTP >=400. Łącznie cały lokalny katalog dowodów ma 1120 KiB.
- Migracje: brak. Deploy/integracja: brak.

Autor zatrzymuje się przed niezależnym review zgodnie z W59. CTO decyduje osobno o zmianie kontraktu/hash dla D-1(e).
