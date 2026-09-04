# CODEX DAY 339 — wybór silnika raportu Oceny po pomiarze

Data: 2026-09-04. Stan: **POMIAR ZAKOŃCZONY, REKOMENDACJA NIEWYKONANA**. Baza pracy: marker `74c07919ce`, gałąź `codex/day339-silnik-raportu-wybor-20260904`. Nie podłączono ani nie wygaszono żadnego silnika, nie zmieniono flag i nie uruchomiono modelu językowego.

## 0. Wejście i tożsamość pracy

Wynik markera, dosłownie:

```text
74c07919ce docs(rejestr): sekcja N — decyzje wlasciciela DEC-388..391 (szablon nie tnie karty, silnik raportu po pomiarze, narrator zostaje, kontrakt czatu obowiazuje)
MARKER OK
```

Sanity worktree, dosłownie:

```text
74c07919cea7ab55dc9fde5fbd911f7f955ed425
```

`git status --short | head -3` nie wypisał żadnej linii. Tip `github-backup/grafika/m03-20260902` był o 6 commitów przed markerem; różnica obejmowała wyłącznie pliki instrukcji 334–342 i ich źródła. Zgodnie z regułą rozjazdu praca zaczęła się dokładnie z markera, bez rebase.

Zasoby wejściowe: 61–66 GiB wolnego; porty `6375` i `5515` puste; brak kontenera `cx-day339-pg`. Utworzono wyłącznie lokalny `pgvector/pgvector:pg16` jako `cx-day339-pg`, baza `cx339`, bind `127.0.0.1:6375`. Pierwszy przebieg zastosował samodzielnie zmierzone **894 migracje**, drugi **0**; oba bez błędów.

## 1. R1 — inwentarz i osiągalność

| Silnik | Trasa / moduł | Konsument | Osiągalność od korzenia |
| --- | --- | --- | --- |
| Kontrakt MethodSession | `GET /api/method/sessions/:sessionId/assessment-report-contract` | `methodCoreApi.ts:234` i `AssessmentReportContractView` | Łańcuch importów istnieje, ale ekran HTTP wymaga `drdHttpSourceOfTruthV1`, domyślnie `false`; **nieosiągalny domyślnie**. |
| DOCX MethodSession | `GET /api/method/sessions/:sessionId/assessment-report.docx` | `AssessmentReportContractView.tsx:360` | Ten sam domyślnie wyłączony ekran; **nieosiągalny domyślnie**. |
| HTML + narrator | `GET /api/assessment-reports/:reportId/drd-report` | `api.ts:10463` → `DRDAuditReportView` | Route UI jest w `AppRoutes`, lecz `isDrdReportEnabled()` domyślnie odsyła do `/audit-programs`; **osiągalny tylko po zastanej fladze**. |
| Model 298 | `buildAcceptedDrdReportModel` | brak | Definicja + własny test, **0 wołaczy produkcyjnych**. Dług integracyjny, nie werdykt o jakości. |
| Metadane sesji | `methodSessionReportMetadataService` | brak | Eksport + test day331, **0 wołaczy produkcyjnych**. Dług integracyjny. |

Sprostowanie: `AssessmentReportDocxDownload` ma `0` wystąpień w `src/` poza `__tests__`; realny konsument DOCX to `AssessmentReportContractView.tsx:360`.

## 2. R2 — jedna realna sesja Oceny

Sesja użyta przez wszystkie wyniki R3: `2e87758d-bd31-459f-b073-28080cbd7a9c`; organizacja `day339-report-engine-org`; 7 potwierdzonych odpowiedzi i 7 zdarzeń dowodowych. Produkcyjny łańcuch testowy: realne HTTP → `ApiGateway.getInstance().initializeRoutes(app)` → prawdziwy `verifyToken` z podpisanym JWT → handler → RealPG → SQL readback.

| Krok | Kod HTTP |
| --- | ---: |
| `POST /api/method/sessions` | 201 |
| 7 × `POST .../events` — `EVIDENCE_ATTACHED` | 7 × 201 |
| 7 × `POST .../events` — `ANSWER_CONFIRMED` | 7 × 201 |
| `GET /api/method/sessions/:id` | 200 |
| `GET /api/method/sessions/:id/events` | 200 |
| `GET .../assessment-report-contract` | 200 |

SQL readback przed R3:

```text
id                                   | organization_id          | answers | evidence_events
2e87758d-bd31-459f-b073-28080cbd7a9c | day339-report-engine-org | 7       | 7
```

Późniejszy pełny przebieg PO ponownie wykonał test i zastąpił efemeryczną fixture nową sesją; nie zmienia to utrwalonego manifestu i plików R3, lecz oznacza, że powyższy UUID nie jest finalnie utrzymywany jako retained fixture.

## 3. R3 — wyniki silników dla tej samej sesji

| Silnik | Wynik | Strony | Czas zmierzony | SHA-256 |
| --- | --- | ---: | ---: | --- |
| MethodSession kontrakt | `01-kontrakt-method-session.json` | n/d | 638.07 ms | `5aa3064c6c4f7d44970dc7dad2ff242d06fb2770e219d57238b1f26f71e01730` |
| MethodSession DOCX | `01-silnik-method-session.docx` | 18 po PDF | 945.40 ms DOCX; 2428.16 ms z PDF | `c16900b6334f4f5d9cdd18e0fe489d2f5ddfaadd0c845ffc2f14c76d73698688` |
| MethodSession PDF kontrolny | `01-silnik-method-session.pdf` | 18 | 2428.16 ms | `446ead94bee2fcc060bc24b7a4c7687f25ae4e3cf4a0db8fd7dd3e7a1847758b` |
| HTML bez klucza | `02-silnik-html.html` | 9 po PDF | 76.77 ms HTML; 1280.40 ms z PDF | `cbdea297bb1e5141d3baf9d517f7adbc738545e991b2bb80ded12981b1478615` |
| Model HTML | `02-silnik-html-model.json` | n/d | 77.48 ms | `471219eff04d27ad99fa1bef80a17eb5d4a9f421f9c75e62effdbae473bb05a8` |
| HTML PDF kontrolny | `02-silnik-html.pdf` | 9 | 1280.40 ms | `027c7449cc5587414c98898b1649aea5919b85a85130c0cb9d45a4248984a136` |
| Model 298 | `03-silnik-298-model.json` | n/d | 9.79 ms | `11cf1b2ffd565654a08e7cf04e45a08963a502013e3c729511a0712077d2d740` |
| Model 298 DOCX | `03-silnik-298.docx` | 21 po PDF | 185.75 ms DOCX; 1646.03 ms z PDF | `f7a79576a50bcb24696927068287b584fa9232abce7f50f12c81987a9718041d` |
| Model 298 PDF kontrolny | `03-silnik-298.pdf` | 21 | 1646.03 ms | `b864eadfe1fd7ccce5a68a781a705751a3f4cffa8a635a454483c56d860e4b55` |

Wszystkie pliki są w `evidence/silniki-raportu-oceny-20260904/` oraz kopii roboczej `/private/tmp/cx-day339-silnik-raportu-wybor-artefakty/`. Manifest: `day339-engine-manifest.json`, SHA-256 `0177e09e6191cd894713ab9125fcc924f09c37d21943d153d0ea434f3e79ae9b`.

Granica pomiaru: produkcyjna trasa HTML czyta `assessment_reports` i nie przyjmuje `method_session_id`. Istniejący silnik `buildDrdReportHtmlServer` uruchomiono więc bezpośrednio z `areaScores` wyprowadzonymi z tej samej sesji; nie dodano trasy ani wołacza.

## 4. R4 — plik do obejrzenia

`evidence/silniki-raportu-oceny-20260904/04-zestawienie-obok-prototypu.pdf`, 66 stron A3, SHA-256 `26a458a65bf460ca2de107af94a3e26ca5bffe9f2082143ac4befbd5b01cc339`. Każda sekcja zaczyna się odpowiedziami na pięć pytań, następnie pokazuje prototyp po lewej i odpowiadającą stronę silnika po prawej. Obejrzano wszystkie 66 stron po renderze PNG: brak obcięć i nakładania; braki stron są nazwane czerwonym komunikatem.

| Silnik | Strony | Struktura | Język | Gniazda niewypełnione | Czas |
| --- | ---: | --- | --- | --- | ---: |
| MethodSession DOCX | 18 | Ma wymagane typy sekcji, ale nie układ 21 stron | polski | 148 jawnych komunikatów: m.in. klient, zatrudnienie, sponsor, streszczenia, komentarze obszarów, horyzonty, linie decyzyjne | 2.43 s z PDF |
| HTML | 9 | Zwarty raport, nie 2 strony na każdą oś | głównie polski; angielskie tytuły poziomów | 0 jawnych komunikatów; 32 nieodpowiedziane obszary pokazane jako zera | 1.28 s z PDF |
| Model 298 | 21 | zgodna z prototypem | polski | 0 jawnych komunikatów, ale narracja i metadane są statyczną treścią prototypu | 1.65 s z PDF |

## 5. R5 — narrator

Narrator może zastąpić tylko prozę: 5 akapitów streszczenia zarządczego, po 4 akapity dla 3 największych luk oraz po jednym werdykcie dla 7 osi. Nie zmienia liczb, tabel, wyboru top-3 ani roadmapy. Prompt wymaga polskiego, closed grounding `facts + evidence`, answer-first i JSON; walidator odrzuca obce liczby oraz brakujące/dangling `factRefs`, ponawia raz, potem wraca do deterministycznego stuba.

R3 wykonano bez kluczy dostawców i bez przekazania `llm`; wynik HTML miał `narrative:"deterministic"` i był kompletny. Nie wywołano `llmService`, `/api/ai/**` ani żadnego modelu. Szczegółowa tabela pól i linii jest w rejestrze, sekcja R5.

## 6. R6 — metadane

`WHERE EXISTS` jest w `methodSessionReportMetadataService.ts:77-79`, przed `ON CONFLICT` z linii 80. Blokuje insert i update dla `sessionId`, który nie należy do przekazanej organizacji; nie sprawdza roli ani poprawności treści metadanych. Brak trasy i produkcyjnego wołacza oznacza dług integracyjny.

`get` po `save` jest jedynym potwierdzeniem na poziomie serwisu, że warunkowy zapis dał wiersz. Nowy test równoległy na RealPG: zapis właściciela `fulfilled`, zapis obcego tenanta `rejected`, zimny readback zachował wiersz właściciela. Pakiet R6 `2/2 PASS`, `--retry=0`.

## 7. R7 — werdykty i rekomendacja

- MethodSession DOCX: realna ścieżka i uczciwe braki, lecz 18/21 stron i ekran domyślnie OFF.
- HTML: najszybszy i fail-safe bez LLM, lecz 9/21 stron, angielskie etykiety oraz brak wejścia MethodSession.
- Model 298: jedyny 21/21, lecz tylko liczby pochodzą z sesji; treść i metadane są nadal prototypowe, a wołaczy brak.

**Rekomendacja dla nadzorcy:** wybrać model 298 jako docelowy kontrakt układu, ale nie podłączać obecnego modułu; najpierw osobny etap musi zmapować pełną realną sesję i metadane do tego modelu i udowodnić ApiGateway/JWT/PG, zimny eksport oraz akcept właściciela. Rekomendacji nie wykonano.

## 8. Testy, pułapki i rozłączność

Pomiar nazw: PRZED `33/33` suite, `98/98` testów PASS; PO `35/35`, `100/100` PASS. Dodane pełne nazwy:

```text
Day 339 — one Assessment session through Gateway for report-engine comparison creates and cold-reads the same evidence-bearing session used by every measured engine
Day331 method-session report metadata tenant guard keeps the owner row when owner and foreign tenant save concurrently
```

Nazwy zniknięte: **0**. Pliki: `/private/tmp/cx-day339-silnik-raportu-wybor-artefakty/przed-nazwy.txt`, `po-nazwy.txt`, `nazwy.diff`.

Pułapki: właściwy config uruchomiono z `server/`; pierwsza próba z roota odkryła 0 testów i `success:false`, więc nie została uznana za PASS. Każdy dowód DB miał w tej samej linii `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=...6375/cx339 JWT_SECRET=... --retry=0`. Test R2 przechodzi przez Gateway i prawdziwy auth. R6 nie przechodzi przez trasę, więc dowodzi wyłącznie SQL serwisu; auth/V8/visibility nie są jego przedmiotem. Model 298 był uruchomiony wyłącznie pomiarowo, bez wołacza produkcyjnego.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Rozłączność: nie zmieniono żadnej trasy, silnika produkcyjnego, pliku prototypu, flagi, `.env*`, migracji, infrastruktury testowej ani terenu dyżurów 338/340. Nie użyto Railway, zdalnej bazy, `git stash`, rebase, force ani pushu na `origin`.

## Korekty wobec instrukcji

1. Autor oczekiwał ok. 893 migracji; pomiar świeżej bazy dał **894**, drugi przebieg 0.
2. R3 ujawnił, że trasa HTML nie ma wejścia pozwalającego odwołać raport do `MethodSession`; porównanie tej samej sesji wymagało dozwolonego uruchomienia modułu bez podłączania.
3. Instrukcja wymaga zachowania „bez klucza” i równocześnie zakazuje wywołania `llmService`. Wybrano bezpieczniejszą interpretację: silnik bez klienta LLM, wynik deterministyczny; zachowanie trasy importującej `llmService` pozostaje niezweryfikowane.
4. W `§0.2b` dowód braku konfiguracji SMTP w tabeli `settings` jest możliwy dopiero po migracjach, choć tekst żąda go przed „czymkolwiek zapisującym”. Przed bazą sprawdzono środowisko i brak drenaży w Gateway; po migracjach, przed testami zapisującymi dane produktu, potwierdzono `0 rows` w `settings WHERE key LIKE 'smtp%'`.

## TWIERDZENIA NIEZWERYFIKOWANE

- **Nie zweryfikowano zachowania narratora przy obecnym kluczu dostawcy** ani tego, czy zwróci prozę LLM, przejdzie walidację, ponowi, czy spadnie do stuba.
- Nie zweryfikowano produkcyjnej trasy HTML bez klucza, ponieważ route przekazuje obiekt `llmService`, a jego wykonanie byłoby zakazanym wywołaniem w tym dyżurze.
- Nie zweryfikowano pełnych 39 odpowiedzi, frozen Outputu, trwałego magazynu plików, natywnego PDF, wyciągu 4-stronicowego, produkcyjnego runtime, urządzeń ani akceptu właściciela.
- Nie zweryfikowano, że statyczna narracja modelu 298 jest prawdziwa dla sesji 339; udowodniono wyłącznie przeliczenie wartości liczbowych i zachowanie układu.
