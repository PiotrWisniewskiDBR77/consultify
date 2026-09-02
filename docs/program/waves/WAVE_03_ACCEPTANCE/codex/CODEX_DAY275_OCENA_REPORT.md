# CODEX DAY 275 — Ocena: macierz DRD, slajd i raport

Status: **IMPLEMENTED_AND_EVIDENCED_LOCAL / NOT_PUSHED / OWNER_ACCEPTANCE_PENDING**  
Marker: `0eff12615b6f00d48f9684a490ca77d9f3ebed72`  
Gałąź: `codex/day275-ocena-macierz-i-raport-20260902`  
Worktree: `/private/tmp/cx-day275-ocena-macierz-i-raport`

Flaga `assessmentOutputArtifacts` **pozostaje OFF; przełączenie domyślnej wartości jest oddzielnym krokiem po akcepcie**. Zrzuty prezentacji i raportu wykonano z jawnym `?ff_assessmentOutputArtifacts=1`.

## Weryfikacja wejściowa

Surowy zapis 14 kontroli: `/private/tmp/cx-day275-ocena-macierz-i-raport-artefakty/wejscie-14-komend.txt`.

### Marker i sanity — wynik dosłowny

```text
0eff12615b merge: wyjscie z zamknietego kola logowania dwuskladnikowego
MARKER OK
0eff12615b6f00d48f9684a490ca77d9f3ebed72
0
```

Tip `github-backup/kandydat/staging-20260902d` był równy markerowi; zakres rozbieżności był pusty. Dysk przed startem: `90Gi` wolne, po checkout: `84Gi`; wszystkie wartości >5 GB. Porty `6292`, `5272`, `5273`, kontener `cx-day275-pg`, gałąź i worktree były wolne.

### Czternaście kontroli

1. Case ścieżki: `src/components/assessment/ = 109`, `src/components/Assessment/ = 0`.
2. `DRDMatrixGrid`: eksport `DRDAssessmentEditor.tsx:210`, użycia w tym samym pliku `:1162`, `:2254`.
3. `DRDMatrixReadOnly` importuje i renderuje ten sam grid (`:26`, `:94`).
4. Slajd: `AxisMatrixSlide` renderuje `DRDMatrixReadOnly`; `PresentationDeck.tsx:64` rozwija `axisMatrices`; builder woła `buildAxisMatrices`.
5. Raport: `wstep:733`, `osie:811`, `odpowiedzi:908`, `podsumowanie:1048` — cztery rozdziały.
6. `AxisSection`: opis osi stoi przed `DRDMatrixReadOnly`, a `AreaBlock` po macierzy (`AssessmentReportDocument.tsx:327-395`).
7. `DRD_STRUCTURE` to dane (`drdStructure.ts:1762`); zmierzono 7 odrębnych stałych `AXIS_1_…AXIS_7_`.
8. Flaga artefaktów kończy `return false`; cztery realne wywołania: `AssessmentOutputsTab.tsx:319,526`, `AppRoutes.tsx:840,854`.
9. Panel przed zmianą: link do macierzy + `StandardTable`, bez gridu. Montaż panelu: `AssessmentHub.tsx:2127`.
10. Panel nie czyta żadnej flagi: 0 trafień (`rc=1`).
11. Raport audytu: osobny `renderAuditReport` i 13 sekcji w kolejności od `executive_summary` do `traceability_matrix`.
12. Współdzielenie kompozytorów Ocena/Audyt: 0 trafień (`rc=1`).
13. Wołacze starej serwerowej ścieżki PPTX w `src/`: 0 (`rc=1`); funkcja serwerowa istnieje `assessmentDeckService.ts:1036` i nie została usunięta.
14. Odrzucone duplikaty nadal żyją: `AreaMatrixTable` używany w `AxisReportSection.tsx:438`, `EmbeddedMatrix` w `ReportBuilder.tsx:440` (`rc=0`).

Migracje RealPG: pierwszy przebieg zakończył `✅ Postgres migrations complete`; drugi dosłownie:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

## §A.0 — dowód mutacyjny istniejących napraw

Wynik: **slajd i struktura raportu były już naprawione na markerze i bronią się przed regresją**.

- Deck z dwoma ocenionymi osiami wytwarza macierze `axis-1`, `axis-2` i renderuje kanoniczny grid na obu slajdach.
- Raport renderuje `wstep → osie → odpowiedzi → podsumowanie`; w osi 1 opis osi poprzedza pierwszy obszar.
- Mutacja usuwająca rozwinięcie `axisMatrices` dała RED, `rc=1` (`mutacja-slajd-red.txt`).
- Mutacja przesuwająca opis osi za macierz/obszary dała RED, `rc=1`, `1749 < 753` było fałszywe (`mutacja-raport-red.txt`).
- Po przywróceniu pliki `PresentationDeck.tsx` i `AssessmentReportDocument.tsx` nie występują w finalnym diffie.

## §A.1 — zrzuty PRZED

Powstało 6/6 obrazów poza repo. Z40:

```text
presentation: mean_luma_delta=220.90 different_pixels=99.95%
quality:      mean_luma_delta=224.81 different_pixels=99.92%
report:       mean_luma_delta=232.96 different_pixels=99.99%
```

Obraz PRZED potwierdził: prezentacja już ma macierz; raport już ma cztery rozdziały i macierze; panel jakości ma tylko tabelę i link.

## §A.2 — macierz obok tabeli

Panel pobiera teraz równolegle `getAssessment()` oraz dotychczasowe evidence/review. Dokładne `assessment.answers.drd.areas` zasila bezpośrednio istniejący `DRDMatrixGrid`; nie powstała nowa macierz ani interpolacja z agregatów. Klik komórki wybiera rzeczywisty `areaId` i poziom do przeglądu/formularza dowodu; poziomy nadal zmienia się wyłącznie w sesji oceny. Link do sesji oraz `StandardTable` pozostały.

Test ochronny wymaga jednocześnie gridu i tabeli oraz sprawdza, że grid dostał rzeczywiste `answers.drd`. Mutacja „bez macierzy” dała RED (`rc=1`); mutacja „bez tabeli” też dała RED (`rc=1`). Finalny test GREEN.

## §A.3 — rozdzielność raportów

Test tekstowy chroni audytową kolejność sekcji i brak odwołań do `AssessmentReportDocument`, `DRDMatrixReadOnly`, `buildPresentationDeck` w `server/src/services/audits/`. GREEN.

## §A.4 — zrzuty PO

Powstało 6/6 odbiorowych PNG. Skrypt mechanicznie wymaga: gridu slajdu, gridu i tabeli jednocześnie w panelu, czterech nagłówków w kolejności oraz gridu w rozdziale 2, braku kontrolek harnessu i Z40.

```text
presentation: mean_luma_delta=221.12 different_pixels=99.95%
quality:      mean_luma_delta=220.65 different_pixels=99.66%
report:       mean_luma_delta=232.96 different_pixels=99.99%
```

Manifest SHA-256:

```text
cf92d4a8029e60a1556474136fc928aee5244353660bed15ae4cf4589140c2ee  presentation-dark.png
1fa768aa1af4b061d3452cffda2fcacbe11b675e96dfe6e569c601a53e81f1a6  presentation-light.png
588ae7d649b7e69ef89dbcc3b5a0019864b9f127c6b33e983adc3458b6468800  quality-dark.png
45c4bebc87eb7128ffa1731b7f3761dc41ab0cf02684bde9c861707b30a808cb  quality-light.png
691f1e1a2ab1506c80669047a11842c4e3ef0fe5879bdb6e918e8c54c9c12941  report-dark.png
1a9f7264492272e9cc80c1428603c69acbcb6b492fd685b520ef1696eeb9b5ba  report-light.png
```

## §A.5 — inwentarz rodziny macierzy

| Plik:linia | Co renderuje | Status | Użycie | Domyślna osiągalność |
|---|---|---|---|---|
| `assessment/drd/DRDAssessmentEditor.tsx:210` | obszary × poziomy, AS/TO, klik | **KANONICZNY** | editor `:1162,:2254`, panel jakości `AssessmentQualityReviewPanel.tsx:297`, wrapper read-only | tak w sesji i panelu |
| `assessment/drd/DRDMatrixReadOnly.tsx:75` | ten sam `DRDMatrixGrid`, bez zapisu | wariant kanoniczny | slajd `slides.tsx:251`, raport `AssessmentReportDocument.tsx:381` | nie: artefakty za flagą OFF |
| `assessment/drd/DRDMatrixSession.tsx:97` | sesyjny `MaturityMatrix` + overview | wariant sesyjny | domyślna powierzchnia sesji DRD | tak w sesji |
| `method-workspace/LiveMatrix.tsx:145` | macierz workspace metody | wariant innej powierzchni | `MethodWorkspaceShell.tsx:446`, ekrany DRD workspace | zależnie od workspace |
| `Reports/AreaMatrixTable.tsx:109` | starsza tabela macierzowa | **ODRZUCONY** | `AxisReportSection.tsx:438` | tak w starym module Raportów |
| `Reports/EmbeddedMatrix.tsx:525` | starsza macierz osadzona | **ODRZUCONY** | `ReportBuilder.tsx:440` | tak w starym builderze raportu |

Nic nie zostało skasowane.

## Uzupełniona licencja ścieżki 7

Instrukcja nazywała klienta `V8AssessmentApi.getScoring`, ale taki symbol nie istnieje. Rzeczywisty łańcuch agregatów to:

`AssessmentQualityReviewPanel.tsx:147` → `V8AssessmentApi.listEvidence` (`src/services/api/v8/assessment.ts:532`) → `/api/v8` przez `ApiGateway` (`Gateway.ts:1486`) → `v8Router /assessment` (`routes/v8/index.ts:100`) → `GET /:assessmentId/evidence` (`assessment.routes.ts:983-1026`) → tenantowy SELECT `assessments.answers_json` (`:1000`) + `listEvidence` (`drdEvidenceScoring.ts:161-175`) → `assessment_axis_evidence` (`migration 20260801…:31`) → `computeDrdScoring` (`drdEvidenceScoring.ts:227`).

Dokładne wartości macierzy idą osobną istniejącą drogą: `getAssessment` (`assessment.ts:321`) → `GET /:assessmentId` (`assessment.routes.ts:422+`) → tenantowy `assessments.answers_json`. RealPG test przez `ApiGateway.initializeRoutes`, podpisany JWT, tenantową fixture, HTTP oraz SQL readback: **1/1 PASS, 0 skipped**.

## Mianowniki B.3

| # | Autor | Pomiar Day 275 | Wynik |
|---:|---:|---:|---|
| komponenty macierzy | 6 | 6 | zgodne |
| osie DRD jako dane | 7 | 7 | zgodne |
| rozdziały raportu Oceny | 4 | 4 | zgodne |
| sekcje raportu audytu | 13 | 13 | zgodne |
| wołacze starego PPTX w `src/` | 0 | 0 | zgodne |
| wywołania flagi artefaktów | 4 | 4 | zgodne |
| flagi panelu jakości | 0 | 0 | zgodne |

## Pomiar zasięgu §0.4a

- PRZED: 73 pełne nazwy, 73 PASS.
- PO: 77 pełnych nazw, 77 PASS.
- Diff: dokładnie 4 dodane nazwy Day 275; 0 znikniętych.
- RealPG/API: 1 pełna nazwa, 1 PASS, 0 skipped.
- TypeScript: `npm run type-check -- --pretty false` oraz `npm run type-check:server -- --pretty false` — oba `exit 0`.
- Scoped ESLint: 0 błędów; 4 istniejące ostrzeżenia hardcoded-color w niezmienianych fragmentach panelu.
- Surowe pliki: `przed-nazwy.txt`, `po-nazwy.txt`, `diff-nazw.txt`, `day275-front-przed.json`, `day275-front-po.json`, `day275-serwer.json` w katalogu artefaktów poza repo.

## Korekty wobec instrukcji

1. `V8AssessmentApi.getScoring` nie istnieje. Panel używa `listEvidence`, które zwraca agregaty osi; agregaty nie wystarczają do odtworzenia poziomów obszarów. Dokładne dane dostarcza istniejący `getAssessment`.
2. Podana komenda serwerowa z root repo + `--config server/vitest.config.ts` + selektor `server/src/...` uruchamia 0 testów i zapisuje `success:false`. Poprawny przebieg wymaga cwd `server/`, `--config vitest.config.ts`, selektora `src/routes/...`; pełny env pozostał bez zmian.
3. Instrukcja mówi o zakazie „czwartej macierzy”, choć wylicza sześć komponentów. Bezpieczna interpretacja Z41 została zachowana: użyto tylko istniejącego `DRDMatrixGrid`.

## Z30 — deklaracja

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

SQL zwrócił `(0 rows)`; env: `BRAK ZMIENNYCH POCZTY`.

## STOP-y i twierdzenia niezweryfikowane

STOP-y proceduralne: brak. Nie wykonano pushu, Railway, zdalnej bazy, wysyłki ani zmiany flagi.  
Twierdzenia niezweryfikowane: akceptacja właściciela, zachowanie na urządzeniu produkcyjnym, deployment. Zrzuty są dowodem lokalnego realnego renderu harnessu, nie deploymentu.
