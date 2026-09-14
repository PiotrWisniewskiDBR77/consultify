# A/D D-1 — independent skeptical review — 2026-09-14

**Werdykt: ACCEPT dla sześciu dostarczonych pozycji (a, b, c, d, f, g); pozycja (e) pozostaje prawidłowo zatrzymana jako HOLD/STOP, ponieważ zmiana `findings[].unitName` zmienia wejście `contentHash`. Paczka jest READY dla odbioru CTO w tym dokładnym zakresie.**

## Tożsamość

- Exact base: `4de31efbcb0c286cdcbdb0251b10a894db02848d`.
- Reviewed freeze: `2a80b6016d8efb55ef776751809533992da453a9`.
- Branch: `codex/a-d-d1-20260914`.
- Review nie zmienił kodu produktu.

## Weryfikacja siedmiu pozycji

1. **(a) ACCEPT — jawne typy.** Delta usuwa wszystkie objęte zakresem `as any`, `: any` i `any[]` z `WorkIntelligenceReport.tsx` oraz `executionWorkAnalysisService.ts`. Nie dodaje żadnego nowego wystąpienia tych wzorców w całej delcie. Focused testy raportu: 9/9 + 5/5; RealPG generatora i akcji przełożonego: 3/3.
2. **(b) ACCEPT — scenariusz techniczny J2.** Playwright na realnym froncie, API, JWT, ApiGateway i PostgreSQL przechodzi 2/2 bez retry. Scenariusz otwiera Ustawienia, rozwija `drd-frozen-technical-details`, odczytuje zamrożony Output, tworzy raport i propozycję, potwierdza cold reload, konflikt CAS oraz odmowę obcego tenantu. Zmiana cleanupu leży wyłącznie w trasie test-support i usuwa jej własny receipt przed rekordem użytkownika fixture.
3. **(c) ACCEPT — usunięcie ekranu legacy.** Produkcyjny `AssessmentSessionEditorView` wylicza `shouldMountDrdMethodWorkspace(framework, flag)`; dla każdego `framework === 'drd'` wynik jest `true`, a jedyny produkcyjny render przekazuje `forceHttpSourceOfTruth`. Po delcie symbol `DrdMethodWorkspaceScreenLegacy` ma zero wystąpień. Wrapper z historycznym propem `true`, `false` i `undefined` zawsze montuje ścieżkę HTTP: niezależny rerun 5/5 gating + 15/15 ekran HTTP + 4/4 frozen shell.
4. **(d) ACCEPT — fixture raportu.** Stare zdania o `EventDerivedOutputBridge` i `vertical-slice demo` zniknęły. Zrzuty EN light i PL dark są czyste, czytelne, bez chrome harnessu oraz bez błędów konsoli/HTTP. Treść Outputu na wariancie PL może pozostać treścią zamrożoną w EN; paczka nie zmienia kontraktu locale Outputu, który jest w torze J3.
5. **(e) HOLD/STOP — `unitName`.** `EventDerivedOutputBridge.ts` nadal zapisuje `unitName: u.unitId`. `buildHashableOutputContent` mapuje pełne findingi przez `{ ...f }`, a następnie `freezeOutput` wywołuje `computeContentHash(buildHashableOutputContent(...))`. Podmiana identyfikatora na nazwę locale zmienia więc treść hashowaną. Zgodnie z Wpisami 60–61 delta nie dotyka `EventDerivedOutputBridge.ts`, `MethodOutputService.ts`, `method-core.routes.ts`, `drdMatrixCellContent.ts` ani `DRD_STRUCTURE`; decyzję i wdrożenie przejął tor J3 CTO.
6. **(f) ACCEPT — `DocumentCardMenu5` po locale.** Komponent czyta bieżący `resolvedLanguage/language`, tłumaczy `common.sections` i przekazuje ten sam `isPolish` do Menu 2, nazw sekcji i `PracujZAI`. Wszystkie cztery produkcyjne wywołania kompilują się bez usuniętego propa. Behawioralny test EN/PL: 1/1.
7. **(g) ACCEPT — kanoniczna szerokość statusu.** Floor `status` wzrasta w jednym kanonicznym miejscu z 130 do 160 px. Testy mierzą pełną etykietę `Zatwierdzona`, styl nagłówka i podłogi pozostałych typów: 13/13 + 20/20.

## Odtworzone bramki

- Focused, każdy plik osobno, `--retry=0`: **8 plików / 72 testy PASS**.
- Fresh PostgreSQL 18 + pgvector, `127.0.0.1:5320/consultify_d1`: strict migrations **918/918**, RealPG **3/3 PASS**, zero skip, `MOCK_DB=false`, `RUN_DB_TESTS=1`.
- Server TypeScript: **exit 0**.
- Frontend TypeScript z heap 8 GiB: **177 błędów**, zgodnie z podłogą autora i linii; zero błędów w plikach paczki. Pierwsza próba bez podniesionego heap zakończyła się V8 OOM i nie jest wynikiem jakości kodu.
- Esbuild: **12/12 plików PASS**.
- `git diff --check`: PASS. Nowe `as any`: 0. Migracje: 0. Pliki J3: 0.
- Autorski szerszy przelot DRD ma 11 czerwieni w trzech niezmienionych testach oczekujących polskich etykiet przy bazowym EN. Jego wcześniejszy wpis o 6 czerwieniach w zmienionym `DrdHttpMethodWorkspaceScreen.test.tsx` jest nieaktualnym przebiegiem sprzed finalnej poprawki; post-rebase autora oraz niezależny rerun tego exact freeze są zielone 15/15.

## Dowody review

- `evidence/d1/independent-review-focused.log`
- `evidence/d1/independent-review-strict-migrations.log`
- `evidence/d1/independent-review-realpg.log`
- `evidence/d1/independent-review-server-tsc.log`
- `evidence/d1/independent-review-frontend-tsc.log`
- `evidence/d1/independent-review-esbuild.log`
- `evidence/d1/independent-review-source-checks.log`

Review zatrzymuje się przed integracją i wdrożeniem. Pozycja (e) nie jest częścią kandydata D-1.
