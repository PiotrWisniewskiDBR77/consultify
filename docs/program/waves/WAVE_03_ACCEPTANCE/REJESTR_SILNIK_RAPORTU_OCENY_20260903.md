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
