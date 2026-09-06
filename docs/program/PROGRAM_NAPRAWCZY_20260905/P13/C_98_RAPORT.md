# P13-C — Karty N faza B: raport wykonania

## Werdykt

**PARTIAL / NOT PROVEN.** Zmiany poniżej są rzeczywistym kodem i przeszły wskazane bramki, ale pełny zakres P13-C nie został domknięty. W szczególności nie ma uczciwego dowodu żywych tras 1440/1280 dla wszystkich kart, pełnych powłok K1–K30 dla 21 nowych wpisów ani rekordu pokazowego odchylenia utworzonego na własnym PostgreSQL. Te braki nie są przedstawiane jako sukces.

## Tożsamość pracy

- baza: `29992c920bd451018ee25712e49c3ba7e0297e5c`
- worktree: `/private/tmp/codex-p13c-karty-n-wyniki`
- gałąź: `codex/p13c-karty-n`
- pierwszy commit: `3ae96086ab`
- historyczne migracje: **0 zmienionych**; nowych migracji: **0**

## Zrobione i potwierdzone

1. Rejestr i rubryka: `KartaNKey`/`REJESTR_KART_N` rozszerzone z 13 do 34 wpisów; dodano 5 kart Wyników, 12 Materiałów, 2 Finanse i 2 Realizacja. Rubryka ma niepustą, falsyfikowalną bramkę kompletności dla nowych typów. Brak harnessu przy nowych wpisach jest jawny (`ekranHarnessu?`) i oznacza brak dowodu runtime, nie PASS.
2. Wyniki:
   - `objective` ma 6/6 sekcji prawego panelu (dodane Źródła, Komentarze, Historia),
   - `roi_case` ma 6/6 (dodane Komentarze i Historia),
   - `RoiCaseFullTool` pokazuje nazwę sprawy zamiast surowego `caseId`,
   - usunięto drugi tor „Poproś Teresę o zapis przez pipeline” wraz z panelem propozycji z karty odchylenia.
3. Materiały:
   - usunięto osadzony tool/panel i dolny przycisk Teresa z Document Studio,
   - Excele mają etykietę działania „Uzupełnij tę sekcję” zamiast „Zapytaj/Przekaż Teresie”,
   - chip Teresa usunięto z obu pasków DeckBuildera,
   - istniejący `buildTabeleArtifactSections` jest osiągalny bez flagi Notatnika,
   - dodano trasę tożsamości `/reports/management/:reportId`, która czyta istniejący `GET /api/management-reports/:id` i przy powrocie wraca do listy.
4. Finanse:
   - `CanonicalStatementTableV2` renderuje trzy nazwane części: RZiS, Bilans i rachunek przepływów pieniężnych, także z uczciwym pustym stanem każdej części,
   - karta szczegółowa KPI analizy używa wspólnego polskiego formatera zmiany r/r (`+2,1%`, nie `+2.1%`).

## Dowód DEC-400

`CanonicalStatementTableV2.test.tsx`:

- GREEN: 8/8,
- pojedyncza mutacja: usunięcie grupy `CF` z tablicy trzech części,
- RED: 1/8 (`expected length 3, received 2`),
- przywrócenie jednego pliku,
- final GREEN: 8/8.

Mutacja dotknęła wyłącznie kopii roboczej i została przywrócona przed raportem.

## Bramki

- frontend `npm run type-check -- --pretty false`: exit 0,
- serwer `npm run type-check:server -- --pretty false`: exit 0,
- wybrane testy: 50, z czego 47 PASS i 3 zastane czerwone; dwa czerwone w `analysisKpiTable.contract.test.ts` dotyczą zastanego słownika/formatu (`Marża brutto` vs `Marża brutto na sprzedaży`, `0,4` vs `40%`), trzeci był testem starego mianownika pustego stanu i został zaktualizowany; finalny test tabeli: 8/8 PASS,
- hooki commita: `check-list-canon`, `check-teresa-kontrakty`, `check-artefakt`, `check-triada`, `check-gestosc`, `check-focus-canon --ci`, `check-flags-env-static` — PASS; wymagany marker `13_CHAT` ujawnił rzeczywistą klasyfikację trzech plików Tabel/Exceli i został dodany obok `11_MATERIALS`.

## Niezrobione / dowód brakujący

- `kpi-scorecard` i `okr-report` pozostają listami zgodnie z DEC-435, ale nie dostały osobnych nowych harnessów ani pełnego live proof.
- `okr-set-tool` i `roi-case-tool`: nie udowodniono jeszcze kompletnego Menu 2 + Menu 5 + Pracuj z AI na realnej trasie.
- Nie utworzono sprawy odchylenia DEC-437. ID: **EVIDENCE_MISSING**. Zastany kontrakt `vnext` nie ma ręcznego POST create; sprawa powstaje jako skutek zapisu pomiaru. Bez uruchomienia własnego PG i pełnego przepływu pomiar→odchylenie wpisanie ID byłoby zgadywaniem.
- Nie przepięto jeszcze wszystkich 12 kart Materiałów na pełną `StandardArtifactShell`; rejestracja typu nie jest dowodem powłoki.
- Nie dodano tras tożsamości dla `template` i obu architektów wzorców.
- `finance-statement-pack` i `finance-analysis` nie mają jeszcze pełnego `ArtifactRightPanel` i jednego `Pracuj z AI`; status API DRAFT vs etykieta „Zatwierdzone” oraz ukrycie starego `FinancialModelWorkspace` nie zostały w tej paczce dowiedzione.
- `execution-report` i `execution-work-doc` są w rejestrze/rubryce, ale nadal nie mają kompletnego Menu 5/ArtifactRightPanel/AI. `ExecutionHub.tsx` nie został zmieniony poza brakiem potrzebnej rejestracji tras — zgodnie z zakazem nie wykonano szerszego refaktoru.
- Brak żywych zrzutów 1440/1280, brak cold readback i brak testu na własnej bazie. Werdykt pozostaje `NOT PROVEN`.

## Zakres chroniony

Nie zmieniano Mojej Pracy, Wywiadu, Inicjatyw, Oceny, Audytów ani Narzędzi. Nie zmieniano żadnej migracji ani `migrationOrdering.ts`. Symlink `node_modules` w worktree jest wyłącznie lokalnym, nieśledzonym przyrządem i nie wchodzi do commita.
