# RUNDA 3 — 10-materialy (05.09, po naprawach)

Staging (backend realnej aplikacji): `curl https://staging.consultify.ai/api/health` → `gitSha: b852ade6164e0dec755ea3ae0c59ec2f7ca3dc04`.
To STARSZY commit niż próg `5ffdabe05e` z zadania → **naprawy SERWEROWE jeszcze NIE są wdrożone** na środowisku, na którym testuję. Różnice zależne od serwera oznaczone `CZEKA_NA_SERWER`.

10 pozycji z werdyktem `ROZNI_SIE` sprzed dzisiejszych napraw (8 z rundy 1 + 2 z rundy 2, które wciąż były ROZNI_SIE) — ponownie sprawdzone na żywo.

| id | werdykt rano | werdykt teraz | jedno zdanie |
|---|---|---|---|
| sheet-artifact | ROZNI_SIE | **NOWY_WZORZEC** | Pasek arkusza ma dziś ikony zamiast słów — zrealizowana prośba właściciela; obraz zatwierdzony z 30.08 jest przeterminowany. |
| excele-prawy-panel-standard | ROZNI_SIE | **NOWY_WZORZEC** | Ten sam ekran/przyczyna co sheet-artifact — obraz z 30.08 pokazuje jeszcze stary warsztat. |
| excele-edytowalna-siatka | ROZNI_SIE | **NOWY_WZORZEC** | Siatka edytowalna bez zmian, jedyna różnica to ikony paska — decyzja właściciela. |
| document-studio-resume-error | ROZNI_SIE | **NOWY_WZORZEC** | Wyśrodkowana karta błędu z ikoną — dokładnie to, o co prosił właściciel; obraz z 30.08 pokazuje starą wersję. |
| document-studio-template-resolve-error | ROZNI_SIE | **NOWY_WZORZEC** | Jak wyżej + dziś DODATKOWO naprawiony fail-closed bez parametru entry=template (luka z rundy 1 zamknięta). |
| report-artifact | ROZNI_SIE | **ROZNI_SIE (nadal)** | Raport nadal renderuje się jako edytor Document Studio, nie jako gotowa karta raportu z KPI/RAG/benchmarkiem — brak dedykowanego komponentu. |
| document-studio-ai-teresa | ROZNI_SIE | **ROZNI_SIE (częściowo naprawione)** | Flaga env działa już bez parametru URL, ale prawy panel to nadal formularz-pytanie, nie czat Teresy z obrazu. |
| document-studio-menu-pliku | ROZNI_SIE | **ZGODNY** | Menu „Plik” w pełni widoczne i klikalne — naprawione (był problem z przycięciem overflow). |
| document-studio-save-as-template (runda 2) | ROZNI_SIE | **ZGODNY** | Modal „Zrób z tego wzorzec” otwiera się i działa end-to-end po naprawie menu Plik. |
| report-builder-library-template (runda 2) | ROZNI_SIE | **CZEKA_NA_SERWER** | Nadal 403 TEMPLATE_FORBIDDEN na POST /api/report-builder/templates/resolve — naprawa serwerowa jeszcze nie wdrożona (stary gitSha). |

## Liczby
- ZGODNY: 2 (document-studio-menu-pliku, document-studio-save-as-template)
- NOWY_WZORZEC: 5 (sheet-artifact, excele-prawy-panel-standard, excele-edytowalna-siatka, document-studio-resume-error, document-studio-template-resolve-error)
- ROZNI_SIE: 2 (report-artifact, document-studio-ai-teresa)
- CZEKA_NA_SERWER: 1 (report-builder-library-template)

## ROZNI_SIE ze specyfikacją naprawy (do zlecenia robotnikowi)

**report-artifact** — trasa `/document-studio/:artifactId` (src/routes/AppRoutes.tsx:2887) renderuje WSZYSTKIE materiały, także raporty zarządcze, komponentem `DocumentStudioView` (edytor bloków). Brak gałęzi renderującej dedykowaną „kartę raportu" (pigułka statusu WYMAGA UWAGI, kafle KPI, tabela RAG per strumień prac, tabela benchmarku). Naprawa: dodać w `DocumentStudioView` (lub w routingu) rozgałęzienie po typie/kind artefaktu (np. `artifact.kind==='management_report'`) renderujące dedykowany komponent — rozbudować `src/components/Reports/Management/ManagementReportsView.tsx` o widok pojedynczego raportu.

**document-studio-ai-teresa** — prawy panel w stanie wejściowym „Z AI" to komponent `src/components/DocumentStudio/DocumentStudioAiEntryPanel.tsx` (chip „Kontekst: DBR77", nagłówek „JAKI DOKUMENT MAM NAPISAĆ?", pole tekstowe, 2 przyciski) zamiast czatu Teresy z ikonami +/iskierka, wyciszeniem i dymkiem TERESA. Naprawa: podmienić ten panel na wariant czatu Teresy w stylu `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx`.

## CZEKA_NA_SERWER

**report-builder-library-template** — trasa POST `/api/report-builder/templates/resolve` zwraca `403 {"error":"TEMPLATE_FORBIDDEN"}` dla wzorców systemowych. Resolver: `server/src/services/materials/creationIntent.ts`, gałąź `report_template`, warunek `provenance_status !== 'approved'`. Do ponownego sprawdzenia po wdrożeniu naprawy serwerowej (gitSha ≥ 5ffdabe05e).

## Czas i trudności
Ok. 45 minut. Największa trudność: `sheet-artifact` przy bezpośrednim wejściu przez `?artifactId=` z rundy 2 dawał pusty stan „Twój arkusz pojawi się tutaj" (zły/martwy artifactId) — trzeba było odtworzyć realną ścieżką klikową (Materiały → Arkusze → wiersz 2 → Otwórz), co dało inny, żywy artifactId. Druga trudność: `document-studio-menu-pliku` i `document-studio-save-as-template` wymagały własnego skryptu Playwright (klik w „Plik", potem w pozycję menu) — zwykły `zrzut.mjs` nie obsługuje zagnieżdżonych menu z dwoma klikami + odczytem bounding-box.

## Runda 4

| id | werdykt runda 3 | werdykt runda 4 | jedno zdanie |
|---|---|---|---|
| report-builder-library-template | CZEKA_NA_SERWER | **ROZNI_SIE** | Serwerowy 403 TEMPLATE_FORBIDDEN jest naprawiony (POST /api/report-builder/templates/resolve → 200), ale ten sam templateArtifactId trafia teraz na inną, celową blokadę klienta TEMPLATE_SOURCE_UNSUPPORTED (src/views/ReportBuilderView.tsx:47) bo jest to wzorzec systemowy (originRuntime=report_template) a nie assessment-owy — spec naprawy w wyniki.json. |

## Runda 5

| id | werdykt runda 3 | werdykt runda 5 | jedno zdanie |
|---|---|---|---|
| report-artifact | DANE | **DANE** | Bez zmian: dokument nadal otwiera sie w trybie Raport z przelacznikiem Raport/Edytor i realna trescia (7 sekcji, plakietki Zalozenie); brak tylko harnessowych pol KPI/RAG/benchmark, ktorych API nie zwraca. |
