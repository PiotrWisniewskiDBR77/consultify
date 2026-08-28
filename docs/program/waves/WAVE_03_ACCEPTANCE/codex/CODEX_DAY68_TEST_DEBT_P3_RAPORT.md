# DYŻUR 68 — TEST DEBT P3 — RAPORT

Status: **PARTIAL / NOT_AUTHORIZED**. Nie deklaruję zamknięcia długu P3.

## Rodowód i mianownik

- Marker i HEAD startowy: `6868d57ebcb346e7d4bf142eb89229bc6bcd3e98`.
- Instrukcja: tip `ad4d666661643162b9438fb7880bfad0e91bddab`, dokument wydany.
- Gałąź: `codex/day68-test-debt-p3-20260828`.
- Historyczna sekcja P3 mapy: 77 wpisów, 77 unikalnych.
- Aktualny kontrakt: 74 istniejące, unikalne pliki.
- Nieistniejące i świadomie nieodtworzone po `a212b3ecf8`: `portfolioScenarioSurface.test.tsx`, `sourceProposalRegistrationWorkbench.test.tsx`, `resourceLoadMath.test.ts`.
- Pomiar: parser sekcji pomiędzy nagłówkami P3/P4 (`awk` + `sed`), następnie `test -f` dla każdej ścieżki. Status przed pracą był pusty.

## PG i migracje

- Własny kontener `cx-day68-pg`, `127.0.0.1:5940`, baza `cx_day68_testdebt`.
- Pełny istniejący łańcuch: przebieg 1 zastosował 862 migracje, exit 0.
- Przebieg 2: `Applying migrations: 0`, exit 0.
- Nie utworzono migracji i nie użyto zasobów zdalnych.

## Bazowy przebieg P3

Komenda obejmowała wszystkie 74 istniejące pliki oraz wymagane zmienne real-PG, w tym `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, właściwy `DATABASE_URL`, lokalny `JWT_SECRET` i `--retry=0`.

- Test Files: 66 failed, 8 passed (74).
- Tests: 222 failed, 403 passed (625).
- Unhandled errors: 8.
- Exit: 1.
- Przykładowe, nazwane przyczyny: niekompletne lokalne mocki `react-i18next`; brak eksportu `ORGANIZATION_MODULES` w mocku; dryf oczekiwań beta/roli/wyceny; brakujące tłumaczenia DE; test migracji zależny od plików poza P3; timeout produkcyjnego buildu w `wave3DotenvIsolation`; testy owner-runtime zależne od cudzych portów/fixture; testy workbook CF nieobserwujące oczekiwanych reguł XML.

To jest pomiar stanu markera, nie regres wprowadzony przez dyżur. Nie zmieniono żadnego testu ani produktu.

## Pin buga — werdykt obowiązkowy

Plik: `tests/unit/initiativeDocumentView.section-ai-noop.test.ts`.

- Osobny przebieg: 3/3 zielone, exit 0, `--retry=0`.
- Asercja „K4 sections nie należą do NOOP” oraz sprawdzenie realnych case handlerów opisują zamierzone zachowanie.
- Asercja wymagająca, aby `raci`, `change-log`, `workstream-owners` i `suggested-changes` pozostawały w `SECTION_AI_NOOP_IDS`, ma werdykt **kanonizacja dziury**. Utrwala brak funkcji.
- Asercja przed/po: bez zmiany. Naprawa wymaga handlerów runtime i zmiany widocznej dla użytkownika poza licencją P3, dlatego status to `NOT_AUTHORIZED`, a nie `FIXED`.

## Kompilacje produkcyjne 4b

- Serwer: usunięcie własnego `server/dist`, następnie `NODE_OPTIONS="--max-old-space-size=3072" ../node_modules/.bin/tsc --build tsconfig.build.json` — exit 0.
- Front: `NODE_OPTIONS="--max-old-space-size=6144" npm run build` — exit 0 (`vite`, 10508 modułów).

## Dowody mutacyjne i zmiany testów

- Naprawy deklarowane: ŻADNE.
- Dowody mutacyjne: NIE DOTYCZY — brak nałożonej naprawy.
- Zmienione istniejące testy: ŻADNE.
- Czerwone→zielone: 0. Zielone→czerwone: 0. Porównania po zmianie nie wykonywano, bo nie powstała zmiana.

## Osiągalność i wygląd

- HTTP: NIE DOTYCZY — dyżur nie zmienił ścieżki runtime.
- Zrzuty: NIE DOTYCZY — brak zmiany widocznej.
- Zmiany widoczne dla użytkownika: ŻADNE.

## Kontrola diffu

- Przed raportem `git diff --name-only`, `git diff --cached --name-only` i diff commitów ponad marker były puste.
- Automatyczny `junit.xml` wytworzony przez Vitest został usunięty i nie jest częścią diffu.
- Do commita dopuszczony jest wyłącznie ten raport. Migracji: 0.

## Status per przyczyna

| Pozycja | Status | Brak do zamknięcia |
|---|---|---|
| Mianownik P3 | ZROBIONE | — |
| Fresh PG i idempotencja migracji | ZROBIONE | — |
| Baseline 74 plików | ZROBIONE | — |
| Pin `initiativeDocumentView.section-ai-noop.test.ts` | NOT_AUTHORIZED | decyzja właściciela i licencja na runtime/zmianę widoczną |
| Dług 66 czerwonych plików | PARTIAL | izolowane naprawy per przyczyna, mutacje oraz rerun po nazwach |
| Kompilacja serwera i frontu | ZROBIONE | — |

## Korekty wobec mapy

- 77 historycznych wpisów nie jest aktualnym mianownikiem: trzy martwe ścieżki dają 74 istniejące pliki.
- Klasyfikacja nie sprowadza się do „test pinujący buga”: baseline pokazuje równocześnie testy, środowisko, dane/kontrakty i zależności poza pakietem.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano, które z 222 porażek pozostają czerwone w izolowanych przebiegach pojedynczych plików; wspólny przebieg wykazał także zanieczyszczenie mocków i 8 unhandled errors.
- Nie zweryfikowano czerwony→zielony ani mutacji dla żadnej przyczyny, ponieważ nie nałożono naprawy.
- Nie udowodniono osiągalności HTTP żadnej ścieżki i nie jest ona deklarowana.
- Nie udowodniono, że implementacja czterech brakujących handlerów AI jest pożądaną decyzją produktową.

---

## KARTA DOWODOWA — DYŻUR 68 (TEST DEBT P3)

Gałąź: `codex/day68-test-debt-p3-20260828`  
Tip: do uzupełnienia po commicie  
Marker: `6868d57ebcb346e7d4bf142eb89229bc6bcd3e98`  
Data: 2026-08-28

1. Rodowód: marker jest bazą pracy — TAK. Pierwszy commit/push — do uzupełnienia po commicie. Commitów ponad marker: 0 przed raportem.
2. Rozłączność: pliki spoza licencji — ŻADNE; migracje `20261680-20261689` wykorzystane: 0; port PG/harness: 5940/3998.
3. Osiągalność: NIE DOTYCZY, brak zmiany runtime.
4. Dowód mutacyjny: brak deklarowanych napraw; NIE DOTYCZY.
4b. Serwer build: exit 0. Front build: exit 0.
5. Regres: baseline P3, 74 pliki, `--retry=0`; 222 czerwone zastane; brak wyniku „po”.
6. Zmiany istniejących testów: ŻADNE. Pin rozstrzygnięty jako częściowa kanonizacja dziury.
7. Mianowniki: 77 wpisów mapy (`awk`/`sed`), 74 istniejące (`test -f`), 625 testów i 222 porażki (podsumowanie Vitest).
8. Wygląd: NIE DOTYCZY, brak zmiany widocznej.
9. Status: PARTIAL / NOT_AUTHORIZED; pełna tabela powyżej.
10. Twierdzenia niezweryfikowane: sekcja powyżej, niepusta.
11. STOP: zmiana widoczna/runtime potrzebna do usunięcia pinu; sprawdzona licencja obejmuje wyłącznie 74 testy P3 i raport; potrzebna decyzja właściciela oraz rozszerzenie licencji.
