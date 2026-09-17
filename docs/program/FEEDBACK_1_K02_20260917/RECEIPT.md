# FEEDBACK-1 poz. 1 — K-02 v3: trwałość sesji DRD i Wywiadu

**Werdykt: READY FOR CTO REVIEW — oba P1 z W180 są zamknięte, regresja TypeScript wynosi 0, a testy zachowania i RealPG przechodzą.** Niezależny ponowny review: `P0=0`, `P1=0`, `P2=2`.

## Tożsamość

- Tor: A / Codex-1.
- Gałąź: `codex/feedback-1-k02-session-persistence-20260917-v3`.
- Baza: `be57c5dae677844a224d78d874d3ab52444a882d` (W181).
- Kandydat przed finalnym amend: `45fb7954ac1ecd986f1199604694b57adb2ad52a`; finalne SHA podaje meldunek w `OD_CODEXA.md`.
- Zakres: W180 K-02 v2/v3, zgłoszenia 30, 31, 72 i 79 oraz naprawa P1 wykryta przez niezależny review.
- Bez migracji, nowych flag, stagingu, deployu i zmian Railway.

## Zamknięcie P1 z W180

1. `InterviewWorkspace` przekazuje opcjonalne `session?.id` w obu miejscach. Pełny frontend TSC na tej samej instalacji: baza **158**, kandydat **158**, regresja **0**, diagnostyki w plikach K-02 **0**. Liczba referencyjna linii w środowisku CTO to **169**; różnica wynika z instalacji/sparse checkout i jest raportowana osobno. `npx tsc` z domyślnym limitem 4 GB zakończył się OOM, dlatego wiążący pomiar wykonano repozytoryjnym `npm run type-check` z limitem 8192 MB.
2. Fikstura `assessmentUiTechnicalFixture` pobiera świeżą wersję przed każdym zapisem `ANSWER_*` i wysyła `expectedVersion`. Test kontraktowy dowodzi sekwencji wersji **[3,4,5]** i wersji końcowej **6**. Mutacja usuwająca `expectedVersion` daje realne **409 VERSION_CONFLICT**.

## Zachowanie użytkownika

- **#30:** istniejąca naprawa z `a805effb69` pozostaje na linii. Wzmocniony test zatrzymuje readback po autosave i dowodzi, że panel nie przechodzi w pełnoekranowy loading, pozostaje na pytaniu **3/7**, a wpisany tekst nie znika ani podczas, ani po odświeżeniu. Mutacja przywracająca historyczny warunek loadingu powoduje RED.
- **#31:** decyzja wybrana przez użytkownika wygrywa z oczekującym lub trwającym autosave; serializacja nie pozwala starszemu szkicowi nadpisać nowszej decyzji.
- **#72:** główny Save Wywiadu najpierw opróżnia bieżącą odpowiedź, a dopiero potem zapisuje metadane sesji; błąd blokuje przejście wymagające udanego zapisu.
- **#79:** kursor pytania jest związany z identyfikatorem sesji i odtwarza ostatnią pozycję po ponownym otwarciu.
- **Help retry:** po sekwencji `Help` → odpowiedź zapisana → utworzenie zadania nieudane → `No` zapisane → ponowne `Help`, zapis `dont_know` nie jest pomijany. Nowy test wymaga 3 appendów, 2 prób utworzenia zadania i ostatniego `answerState=dont_know`. Mutacja usuwająca czyszczenie tokenu po udanym `No` daje RED: 2 appendy zamiast 3.

## Dowody

- Skupiony zestaw paczki po poprawkach: **45 PASS**; ponowny przebieg zmienionego podzbioru: **20/20 PASS** (`--retry=0`, jeden worker).
- Niezależny UI review: **38/38 PASS** i potwierdzenie dowodu #30.
- Niezależny backend re-review po naprawie Help retry: **4/4 PASS**, `P0=0`, `P1=0`, `P2=2`.
- RealPG na `127.0.0.1:6454`, kontener `cx-codex-k02-pg`, dane w `tmpfs`: migracje **925/925 PASS**, `http.integration` **16/16 PASS**, bez skipów.
- Server TSC: **0 diagnostyk**; dokładny `@types/node` **22.19.3**.
- Frontend TSC: baza **158**, kandydat **158**, delta **0**, zmienione pliki **0**.
- `git diff --check`: PASS.

## Pozostawione P2

1. `cancelPending` czyści timer, ale po udanym bezpośrednim zapisie może pozostawić wskaźnik `DIRTY`; poprawa wymaga jawnego potwierdzenia rewizji po sukcesie, a nie prostego ustawienia `SAVED` przed `await`.
2. Klucz `interview_current_question:<sessionId>` w `localStorage` nie ma polityki sprzątania.
3. `handleSave` przy niepowodzeniu zapisu dziecka kończy operację bez dodatkowego komunikatu na poziomie powłoki; komunikat pozostaje w dziecku.
4. Zastany dług językowy i baseline pochodzą z linii i nie są rozszerzane w K-02.
5. Nie wykonano pełnego scenariusza przeglądarkowego na stagingu; zakaz zapisu i deployu pozostaje wiążący.

## Granice

Paczka nie dotykała chronionych gałęzi, stagingu, demo, Railway ani checkoutu właściciela. Dowody dotyczą lokalnego kandydata i osobnej bazy RealPG.
