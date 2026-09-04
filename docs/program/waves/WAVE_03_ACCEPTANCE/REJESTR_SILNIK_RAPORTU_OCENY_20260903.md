# Rejestr silnika raportu Oceny DRD — 2026-09-03

Stan: R1 — pomiar wejściowy. Baza: `ebfcf3d580`.

## Pole → źródło → stan

| Pole/sekcja | Rzeczywiste źródło na markerze | Stan R1 |
| --- | --- | --- |
| Klient, opis, branża | profil organizacji + `DrdReportMeta.industry` | jest |
| Data, wersja, status | `MethodSession` + rewizja `method_report_snapshots` | jest |
| Zespół doradczy i klienta | addytywne `method_session_report_metadata` | backend jest; karta UI brak |
| Terminy, zakres, wyłączenia | addytywne `method_session_report_metadata` | backend jest; karta UI brak |
| Osie, obszary, skale | `server/src/data/drdStructure.ts` / `src/services/drdStructure.ts` | jest: 7 osi, skale 7/5/5/7/6/6/5 |
| Polskie tytuły poziomów | struktura DRD | częściowo; osie 1–4 i 7 nadal mają angielskie tytuły |
| AS-IS / TO-BE | zdarzenia sesji i snapshot Output | jest |
| Pytania | bank wiedzy DRD | jest |
| Odpowiedzi klienta | zdarzenia `answer` | jest |
| Dowody | zdarzenia dowodowe z siłą E0–E4 | jest; brak jednej reguły 4 etykiet zaakceptowanego raportu |
| Rekomendacja: priorytet/horyzont/właściciel | `method_session_report_metadata.recommendations` | backend jest |
| Uzasadnienie rekomendowanego sufitu per oś | `method_session_report_metadata.recommended_ceiling_rationales` | backend jest |
| Benchmark | `drdIndustryBenchmark.ts` | jest jako hipoteza ekspercka, nie pomiar |
| Plik DOCX/PDF | brak magazynu plików na ścieżce Method Core | brak |

## Rzeczywisty łańcuch generowania na markerze

Frontend `AssessmentHub.tsx` kieruje istniejące raporty do starego Report Buildera. Method Core udostępnia `POST /api/method/outputs/:id/report`, ale handler `createArtefactSnapshot` przyjmuje od klienta `title` i `content`, oblicza hash i zapisuje strukturalny snapshot w `method_report_snapshots`. Nie wywołuje `server/src/services/report/drdReportGenerator.ts`, nie składa DOCX/PDF i nie tworzy pliku w magazynie.

Istniejący `server/src/services/report/drdReportModel.ts` buduje starszy model ośmiu sekcji (HTML, radar, top-3 luk, roadmapa, rozdziały). Nie odpowiada zaakceptowanemu układowi 21 stron: okładka + wstęp + 7 osi po 2 strony + zbiorcze + podsumowanie.

## Miejsce karty „Metryka badania”

Karta należy do pełnostronicowej sesji Assessment (artefakt D), przed przejściem do raportu. Dane muszą być utrwalane po stronie sesji i włączone do niezmiennego snapshotu Output; sam stan komponentu lub zawartość raportu nie jest SSOT.

## Korekty wobec instrukcji

1. Instrukcja wskazuje `src/method-core/methods/drd/drdStructure.ts`; na markerze taki plik nie istnieje. Kanoniczne struktury są w `src/services/drdStructure.ts` i `server/src/data/drdStructure.ts`.
2. Polecenie grepu z instrukcji dla `ReportTemplate|generateReport|reportBuilder` zwraca głównie szerokie, stare trasy; realna trasa Method Core to `/api/method/outputs/:id/report`.
3. Instrukcja odwołuje się do „tabeli licencji”, lecz dokument nie zawiera takiej tabeli. W R1 zmieniono wyłącznie nowy, jawnie dozwolony przez Z13 rejestr.

## Decyzje projektowe

Kontrakt właściciela pozostaje bez zmian: 21 stron pełnych i 4 strony wyciągu zarządczego z jednego modelu; 4 etykiety dowodu z E0–E4; deterministyczny narrator jako wersja bazowa; LLM domyślnie OFF z fail-safe; rekomendowany sufit zostaje; metryka badania jest polem sesji. Źródło: DEC-2026-09-03-385.

## Różnice strona po stronie

Pomiar modelu przykładowego przez wspólny skład; nie jest to raport z realnej sesji.

| Strony | Różnica pikselowa po normalizacji | Oględziny |
| --- | --- | --- |
| 1–21 | każda `mean_abs_rgb = 0.0000` | wszystkie obejrzane; brak ucięć, nakładania i sierot |

Różnice nazwane: brak. Każda z 21 stron jest piksel-w-piksel identyczna z odpowiadającą stroną zaakceptowanego prototypu. Wyciąg 4-stronicowy obejrzany osobno; zawiera strony pełnego modelu 1, 18, 20 i 21.

## Pomiar porównawczy — dyżur 339

Marker: `74c07919ce`. Wspólna sesja pomiarowa: `2e87758d-bd31-459f-b073-28080cbd7a9c`, organizacja `day339-report-engine-org`.

### R1 — silniki, trasy, konsumenci i osiągalność

| Silnik | Definicja / wołacz | Trasa | Konsument we froncie | Osiągalność od korzenia produktu |
| --- | --- | --- | --- | --- |
| Kontrakt raportu MethodSession | `assessmentReportContractService.ts`; route `method-core.routes.ts:535` | `GET /api/method/sessions/:sessionId/assessment-report-contract` | `methodCoreApi.ts:234` oraz `AssessmentReportContractView.tsx` | Importy prowadzą `src/index.tsx:99,124,137` → `src/App.tsx:29,580` → `AppRoutes.tsx:2286` → `AssessmentSessionEditorView.tsx:40,1753` → `DrdMethodWorkspaceScreen.tsx:897-907` → `DrdHttpMethodWorkspaceScreen.tsx:88-90,1147`, ale ostatnia gałąź wymaga `drdHttpSourceOfTruthV1`; flaga ma `defaultValue:false` (`useFeatureFlags.ts:261-270`). **Nieosiągalny domyślnie, osiągalny wyłącznie po jawnym włączeniu zastanej flagi.** |
| DOCX MethodSession | `buildAssessmentDrdReportSchema`; route `method-core.routes.ts:553` | `GET /api/method/sessions/:sessionId/assessment-report.docx` | `AssessmentReportContractView.tsx:360` | Ten sam łańcuch i ta sama domyślnie wyłączona bramka co wyżej. **Nieosiągalny domyślnie.** |
| HTML + narrator | `buildDrdReportHtmlServer` → `generateDrdReport`; route `assessment-reports.routes.ts:1065` | `GET /api/assessment-reports/:reportId/drd-report` | `api.ts:10463` → `DRDAuditReportView.tsx`; route UI `AppRoutes.tsx:1702` | `src/index.tsx` → `App.tsx` → `AppRoutes.tsx:541-542,1702`; `DRDAuditReportRoute` przekierowuje przy `isDrdReportEnabled()===false` (`AppRoutes.tsx:793-806`). **Osiągalny wyłącznie po zastanej fladze, domyślnie OFF.** |
| Model 298 | `acceptedDrdReportModel.ts:94` | brak | brak | `grep -rn "buildAcceptedDrdReportModel" server/src src tests` zwraca tylko definicję i własny test; **zero wołaczy produkcyjnych, dług integracyjny**. |
| Metadane raportu | `methodSessionReportMetadataService.ts:59-105` | brak | brak | Jedyny importer jest w teście day331; **zero wołaczy produkcyjnych, dług integracyjny**. |

Sprostowanie nazwy: `grep -rn "AssessmentReportDocxDownload" src/ | grep -v __tests__` zwrócił **0 trafień**. Realnym konsumentem pobrania DOCX jest `AssessmentReportContractView.tsx:360`; `AssessmentReportDocxDownload` występuje wyłącznie w nazwie pliku testowego.

### R5 — co realnie dopisuje narrator LLM

| Pole / sekcja raportu | Czy narrator nadpisuje | Dowód | Co konkretnie wstawia |
| --- | --- | --- | --- |
| Streszczenie zarządcze | Tak, wyłącznie warstwę prozy | `drdReportModel.ts:389-410`; prompt `drdLlmNarrator.ts:307-311` | Dokładnie 5 akapitów: stan, znaczenie, trzy luki, pierwsze działanie i efekt z horyzontem; limit 350 słów. Fakty wejściowe obejmują procent bieżący/docelowy, najsilniejszą i najsłabszą oś, fazę oraz kompletność. |
| Trzy największe karty luk | Tak, wyłącznie 4 akapity prozy każdej karty | `drdReportModel.ts:412-448`; prompt `drdLlmNarrator.ts:313-316` | „Co jest → co to znaczy → co robić najpierw z rolą → jaki efekt z horyzontem”, na faktach obszaru, osi, AS-IS, TO-BE, skali i tytułów poziomów. |
| Werdykt rozdziału każdej z 7 osi | Tak, wyłącznie zdanie-werdykt | `drdReportModel.ts:468-490`; prompt `drdLlmNarrator.ts:318-320` | Jeden akapit do 20 słów, wprowadzający tabelę obszarów; fakty to nazwa osi, wynik bieżący, cel i maksymalna skala. |
| Liczby, tabele, kolejność luk i roadmapa | Nie | `drdReportModel.ts:348-376,412-466`; `drdLlmNarrator.ts:377-405` | Pozostają deterministyczne. Walidator odrzuca liczby spoza `facts`, wymaga istniejących `factRefs` i oznacza zaakceptowaną prozę `aiGenerated:true`, `narrative:'llm'`. |
| Źródła metodologiczne | Nie nadpisuje; może dodać dowody do wsadu narratora | `drdReportGrounding.ts:74-130` | Do 3 fragmentów książki na oś jako `drd_methodology_kb`; błąd KB daje `[]`. Fragmenty mogą wspierać cytowanie jakościowe, ale nie pozwalają wnieść nowych liczb. |

Zasady promptu (`drdLlmNarrator.ts:268-302`): język polski, closed grounding wyłącznie `facts + evidence`, answer-first, brak zewnętrznych statystyk, JSON bez Markdownu. Walidacja (`:363-407`) wymaga właściwej liczby akapitów, liczb pochodzących z silnika oraz istniejących odwołań dowodowych. Jedna niepoprawna odpowiedź powoduje ponowienie, druga lub wyjątek zwraca narrator deterministyczny (`:430-483`).

Przebieg R3 wykonano z usuniętymi z procesu `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY` i `GOOGLE_AI_API_KEY` oraz bez przekazania klienta `llm`; silnik zwrócił `narrative: "deterministic"` i kompletny HTML. Nie nastąpiło ani jedno wywołanie modelu. Zachowanie produkcyjnej trasy, która importuje obiekt `llmService` nawet bez klucza, nie zostało wykonawczo sprawdzone ze względu na bezwzględny zakaz wywołania `llmService`; statyczny kontrakt narratora deklaruje fallback przy wyjątku.

### R6 — metadane sesji: ochrona i dług integracyjny

1. `WHERE EXISTS` znajduje się dokładnie w `methodSessionReportMetadataService.ts:77-79`, przed `ON CONFLICT` z linii 80. Chroni zarówno pierwszy insert, jak i wejście do aktualizacji konfliktu: źródłowy `SELECT` nie zwraca wiersza, jeżeli `method_sessions.id` nie należy do podanego `organization_id`. Nie chroni poprawności merytorycznej pól metadanych ani uprawnień roli użytkownika; serwis przyjmuje `updatedBy` i zakłada, że ewentualny wołacz przeprowadzi autoryzację.
2. `grep -rn "methodSessionReportMetadataService" server/src src tests` znajduje wyłącznie eksport serwisu i import w teście day331. **Nie istnieje trasa ani produkcyjny wołacz. To dług integracyjny, nie działająca funkcja produktu.**
3. `runOrThrow` nie daje serwisowi informacji, czy warunkowy `INSERT ... SELECT` utworzył wiersz. `get(organizationId, sessionId)` z linii 99 jest jedynym potwierdzeniem na poziomie serwisu; dla obcej organizacji zwraca `null`, a `save` rzuca `report metadata save refused`. Nowy przypadek realnego PostgreSQL uruchomił równolegle zapis właściciela i zapis obcego tenanta: właściciel `fulfilled`, obcy `rejected`, zimny odczyt zachował `{organization_id: ownerOrg, study_scope: 'owner concurrent value'}`. Oznacza to, że równoległy zapis innej organizacji nie nadpisuje wiersza właściciela.

Pakiet R6: `2/2 PASS`, `--retry=0`, `DB_TYPE=postgres` sprawdzone w `beforeAll`, `assertRealPostgresTestEnvironment()` wywołane bez argumentów, baza `127.0.0.1:6375/cx339`. Pułapki testowe: brak trasy oznacza, że bramki V8/auth/visibility nie leżą na ścieżce tego testu; nie jest to dowód HTTP ani osiągalności produktu, tylko egzekucji SQL serwisu na RealPG.

### R7 — rekomendacja dla nadzorcy

- **Kontrakt/DOCX MethodSession:** jedyny silnik raportu klientowskiego zmierzony na realnej sesji przez istniejący kontrakt, lecz wynik ma 18 zamiast 21 stron, 148 jawnych braków i domyślnie wyłączony ekran pobierania.
- **HTML + narrator:** generuje najszybciej i bez klucza poprawnie wraca do deterministycznej prozy, ale daje zwarty dokument 9-stronicowy, angielskie tytuły poziomów oraz nie ma kontraktu wejściowego z `MethodSession`.
- **Model 298:** jako jedyny zachowuje zaakceptowany układ 21 stron, lecz w tym pomiarze z sesji przeliczył tylko wyniki liczbowe; metadane i narracja nadal były statyczną treścią prototypu, a produkcyjnych wołaczy jest zero.

**Rekomendacja:** wybrać model 298 jako docelowy kontrakt układu, ale nie podłączać go w obecnej postaci; najpierw nadzorca powinien zlecić osobny etap mapowania całej realnej sesji i metadanych do tego modelu, z ApiGateway/JWT/PostgreSQL, zimnym odczytem eksportu oraz akceptem właściciela na pliku wynikowym. Ta rekomendacja nie została wykonana.

Nie zmierzono: zachowania produkcyjnej trasy HTML przy rzeczywiście skonfigurowanym kluczu dostawcy; wywołania tej trasy dla tej samej `MethodSession` (brak takiego wejścia); pełnej sesji z odpowiedziami dla wszystkich 39 obszarów i zamrożonym Outputem; trwałego magazynu wyeksportowanych plików; produkcyjnego runtime, urządzeń i przeglądarek; akceptu właściciela dla któregokolwiek nowego wyniku; PDF generowanego natywnie przez produkt (kontrolne PDF-y powstały przez LibreOffice); 4-stronicowego wyciągu zarządczego z tej sesji; zachowania narratora z obecnym kluczem dostawcy.

## Dyżur 346 — sprostowanie przyrządu porównawczego

Proza w `03-silnik-298.pdf`, w tym dane „TechProd Manufacturing”, nie pochodzi z `buildAcceptedDrdReportModel`; podał ją skrypt `scripts/dev/day339-porownanie-silnikow.mjs`, importując statyczny prototyp `scripts/prototypes/raport-oceny-tresc.mjs` i łącząc go z liczbami sesji. Przyrząd ma teraz opcjonalne, jawne parametry katalogów wyjściowych oraz etykietę hybrydy na pierwszej stronie; produkcyjnego wołacza silnika 298 nie dodano.
