# PRV-009 — Usunięcie duplikatu przycisku „Open"/„Otwórz" (TYPE 11) — 11 miejsc

- **Stan:** DO ODBIORU (2026-07-26)
- **Gałąź/commity:** `integ/typ11-open-duplikaty-2026-07-26` — 11 commitów cherry-pick z 3 fal

## Co zostało zrobione
Analiza A2 (`Harvard/wdrozenie-100/_ANALIZA_A2_INWENTARZ_PREVIEW.md`) wykazała 12 ekranów z
naruszeniem kanonu §7.3 (anty-duplikacja akcji): panel podglądu miał header „Open" ORAZ
dodatkową pozycję w kebabie/pasku akcji wołającą DOKŁADNIE TĘ SAMĄ funkcję. Naprawione 11 z 12
(dwunasty, Finance→Statements child-chipy, to luka produktowa nie duplikat — opisana niżej):

1. **DecisionPreviewPanel** (★ cytowany jako SSOT wzorca — naprawiony pierwszy, żeby przestał
   propagować defekt do kopiujących go ekranów)
2. AssessmentHub (3 taby: list/reports/initiatives)
3. AssessmentTable („Open in Map")
4. BlockTypesManager („Edit")
5. ModelCatalogTable („Edit")
6. ExecutionHub → List/Portfolio
7. MeetingHub
8. **Finance** — najgorszy przypadek: TRZY aktywne przyciski „otwórz" jednocześnie (dwa z
   kolidującym skrótem `O`) + podwójny Export. Zredukowane do jednego z każdego.
9. **OutputsAggregateTabContent** — naprawiony ZNANY BUG: „Download XLSX" nic nie pobierał, bo
   dzielił handler z „Open". Root cause: `resolveArtifactOpenPath` nigdy nie zwracał `null` dla
   `kind==='sheet'`, więc prawdziwy fallback do XLSX był martwym, nieosiągalnym kodem. Podpięty
   realny `openGovernedSheetRow` — przycisk teraz faktycznie pobiera plik.
10. InitiativesHub → tab table
11. ResultsHub → catalog KPI

**Świadomie NIE ruszone:** Finance→Statements child-chipy (pigułki relacji zawsze otwierają
rodzica, nie konkretnego childa — brak w module osobnego widoku dla pojedynczego
child-statementu; to luka produktowa do zaprojektowania, nie mechaniczny duplikat).

## Dowody
- Wszystkie 13 tkniętych plików: esbuild czysty.
- Strażnicy na zintegrowanym drzewie: check-artefakt ✓ · check-list-canon --all ✓ · check-actions ✓.
- 1 test punktowy (MeetingHub.smoke.test.tsx) 5/5 PASS; pozostałe testy dotykanych plików nie
  odnosiły się do zmienionych tablic akcji (zweryfikowane grepem przed pominięciem).

## Jak odebrać
Klikanie: otwórz podgląd w dowolnym z 11 modułów, sprawdź że kebab/pasek akcji NIE ma już
drugiego „Open"/„Edit"/„Otwórz" obok nagłówkowego przycisku. Dla Outputs: sprawdź że „Download
XLSX" faktycznie ściąga plik (flaga `tablePlatformMetadataFirst`).
