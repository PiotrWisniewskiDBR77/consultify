# W73 K6 — niezależny przegląd

**Werdykt: HOLD. Zmiana językowa działa i nie wprowadza wykrytej regresji testowej, ale kandydat nie spełnia obowiązkowej bramki wizualnej W73, pozostawia 11 realnie widocznych angielskich tytułów katalogu awaryjnego, a manifest nie opisuje dokładnego kodu produktu w backupie.**

## Zakres i pochodzenie

- Exact kandydat: `d78244f6c8ecd7bcbcacbffd1070f8055e05b86b` z `origin/backup/codex/d-k6-execution-labels-20260915`.
- DAG potwierdzony: `f2628a0d36` → merge E2b-Exec-bis `3441112167` → merge K1 `3dfca08c33` → K6.
- Trzy zadeklarowane commity produktu mieszczą limit siedmiu plików: `3bc2ff100b` = 5, `c6e3a0cccf` = 2, `e0a10d6559` = 7.
- Exact kandydat zawiera jednak jeszcze jeden późniejszy commit produktu `b63dd48ac9` (1 plik). Limit plików nie jest przekroczony, ale `FREEZE.md` i `FREEZE_MANIFEST.json` nadal deklarują `contentSha=e0a10d6559` i tylko trzy commity produktu.

## Znaleziska blokujące

### P1 — brak zrzutów w powłoce Hub

Oba PNG są kompozytem dev-render z trzema odrębnymi powierzchniami pod własnym nagłówkiem `CONSULTIFY · K6`. Nie pokazują nawigacji ani pełnej powłoki Execution Hub. W73 wymaga zrzutów EN+PL light w powłoce Hub obejrzanych przez wykonawcę, więc dostarczony dowód `PARTIAL` nie zamyka bramki.

### P1 — jedenaście wyłączeń `fallback` jest widocznym UI

Pomiar K4obj na kandydacie nadal wskazuje 11 tytułów w `ExecutionHub.tsx:4814-5127`, od `Weekly Execution Pack` do `Sponsor-Ready One-Pager`. Kod wprost używa tego katalogu, gdy `/api/report-builder/definitions` zwróci błąd, pustą listę albo jest niedostępne (`reportDefinitions = null/[]` → `fallbackBase`). To rzeczywista ścieżka wyświetlana użytkownikowi, a nie wewnętrzny fallback techniczny. W PL te tytuły pozostają angielskie. Wpis 73 każe dokończyć pozostałe etykiety trafiające na ekran, dlatego wyłączenie 11 pozycji nie jest uzasadnione.

Jedyna pozostała pozycja z `executionLocalReviewData.ts` jest uzasadniona jako fixture DEV: kod bramkuje ją przez `import.meta.env.DEV && import.meta.env.MODE !== 'test'` i nie trafia do runtime produkcyjnego.

### P1 — freeze nie identyfikuje dokładnego kodu produktu

Po zadeklarowanym `contentSha=e0a10d6559` dodano `b63dd48ac9`, który zmienia `ExecutionManagementTable.tsx`. Manifest zawiera hash pliku po tej poprawce, lecz lista commitów i content SHA jej nie zawierają. Odbiór nie może jednoznacznie odtworzyć deklarowanego zamrożenia. Nowy freeze musi wskazać ostatni commit produktu i pełną listę commitów.

## Dowody pozytywne

- Pomiar odtworzony względem exact dependency base `3dfca08c33`: realne pozycje K4obj w ośmiu wskazanych plikach Execution `26→0`; `MyApprovalsView` (`Overdue`, `No approvals found`) `2→0`; Wizard `Step 1/2/3 of 4` `3→0`.
- Test K6: `2/2 PASS`.
- Pięć testów celowanych: kandydat `25 PASS / 2 FAIL`; baza `25 PASS / 2 FAIL`. Nazwy obu porażek są identyczne i dotyczą zastanych polskich oczekiwań w `EnterpriseOnboardingWizard.v8-status.test.tsx` przy renderze EN.
- `npm run check:jezyk:ci`: PASS; K4en `-5`, K4objPL `-4`, K4obj `-45`, K11 `-1`.
- Front TSC: RC2, dokładnie 177 błędów; `--listFilesOnly`: RC0, 7427 linii. Server TSC: RC0.
- `check:list-canon`: 349; `check:artefakt`: `8-0-117`.
- Build: pierwsza próba zakończyła się lokalnym abortem procesu Node (RC134); kontrolne powtórzenie z `NODE_OPTIONS=--max-old-space-size=8192` zakończyło się RC0.
- Nowe `as any`: 0; migracje: 0; `c-accent` w Wizardzie pozostał bez zmiany.
- Jakość nowych kluczy EN/PL jest poprawna w sprawdzonym zakresie; zrzut PL nie wykazuje istotnej pomyłki w nowych tłumaczeniach, ale nie obejmuje katalogu raportów.

## Warunki zdjęcia HOLD

1. Przenieść 11 tytułów awaryjnego katalogu raportów do EN/PL i wykazać K4obj `11→0` dla tej ścieżki.
2. Dostarczyć EN+PL light z prawdziwej powłoki Execution Hub, w tym widok korzystający z katalogu awaryjnego.
3. Wygenerować nowy freeze/manifest z dokładnym content SHA po wszystkich commitach produktu.
4. Powtórzyć testy delty i bramki; niezależny re-review.
