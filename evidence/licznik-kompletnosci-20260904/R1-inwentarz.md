# Dyżur 351 — R1: inwentarz licznika kompletności

Komenda pomiarowa:

```bash
bash -c "grep -rn 'actual > 0 || \|actual) > 0 || \|current > 0 || \|achievedLevel > 0 || ' server/src/ src/ --include=*.ts --include=*.tsx | grep -v __tests__"
```

Wynik własny: 12 trafień tekstowych w 8 plikach. Instrukcja mówi o 11 trafieniach, ale sama lista w instrukcji zawiera 12 pozycji (7 rdzenia i 5 kandydatów). Z 12 trafień 9 liczy kompletność, a 3 mają inne znaczenie.

| Miejsce | Fragment | Znaczenie | Werdykt | Osiągalność |
| --- | --- | --- | --- | --- |
| `server/src/routes/assessment/assessment-hub.routes.ts:63` | `achievedLevel > 0 || targetLevel > 0` | Uznaje oś DRD za ukończoną i zasila `progress`. | KOMPLETNOŚĆ; cel nie jest odpowiedzią | backend: zamontowana żywa trasa `/api/assessments` |
| `server/src/routes/assessment/assessment-hub.routes.ts:76` | `current > 0 || target > 0` | Uznaje wymiar SIRI za ukończony i zasila `progress`. | KOMPLETNOŚĆ; cel nie jest odpowiedzią | backend: zamontowana żywa trasa `/api/assessments` |
| `server/src/routes/assessment/assessment-hub.routes.ts:80` | `current > 0 || target > 0` | Uznaje wymiar ADMA za ukończony i zasila `progress`. | KOMPLETNOŚĆ; cel nie jest odpowiedzią | backend: zamontowana żywa trasa `/api/assessments` |
| `server/src/services/report/drdVizAdapter.ts:81` | `actual > 0 || target > 0` | Liczy ocenione obszary do `completionPercent`. | KOMPLETNOŚĆ | backend; konsument modelu używa tylko `dimensions`, nie tej liczby |
| `server/src/services/report/drdVizAdapter.ts:121` | `current > 0 || target > 0` | Liczy ocenione osie do `completionPercent`. | KOMPLETNOŚĆ | backend; liczba nie wchodzi do modelu raportu |
| `src/services/drdVizAdapter.ts:59` | `actual > 0 || target > 0` | Liczy ocenione obszary do `completionPercent`. | KOMPLETNOŚĆ | plik `app`, lecz konsumenci liczby są `unreachable`: MINA |
| `src/services/drdVizAdapter.ts:105` | `current > 0 || target > 0` | Liczy ocenione osie do `completionPercent`. | KOMPLETNOŚĆ | plik `app`, lecz konsumenci liczby są `unreachable`: MINA |
| `src/components/assessment/drd/drdAnswersAdapter.ts:76` | `actual > 0 || target > 0` | Decyduje, które pary actual/target uczestniczą w agregacji i średnich osi. | INNE; target jest prawidłowym sygnałem dla agregacji celu | `app` |
| `src/components/assessment/tools/SIRIForm.tsx:143` | `current > 0 || target > 0` | Liczy `progress.completed` formularza SIRI. | KOMPLETNOŚĆ; cel nie jest odpowiedzią | `unreachable` |
| `src/components/assessment/tools/DRDForm.tsx:107` | `actual > 0 || target > 0` | Liczy `progress.completedAxes` formularza DRD. | KOMPLETNOŚĆ; cel nie jest odpowiedzią | `app` |
| `src/components/assessment/reports/AssessmentReportVisualizations.tsx:332` | `current > 0 || target > 0` | Sprawdza, czy radar ma co najmniej trzy osie z dowolnym sygnałem i może być czytelnie narysowany. | INNE; `hasSignal`, nie kompletność | `app` |
| `src/services/report/assessmentReportDataAdapter.ts:119` | `current > 0 || target > 0` | Włącza wymiar SIRI do agregacji średnich current i target dla building block. | INNE; agregacja danych, nie kompletność | `test-only` |

Rozdzielenie żywe/mina:

- ŻYWE: trzy gałęzie `computeProgressFields` w zamontowanej trasie; `DRDForm.tsx` jest `app`.
- MINA: `src/services/drdVizAdapter.ts` jest `app`, ale jego `completionPercent` konsumują wyłącznie `DRDReportTemplate.tsx` i `ReportEditor.tsx`, oba `unreachable`; `SIRIForm.tsx` także jest `unreachable`.
- Serwerowy adapter zawiera błędną liczbę, lecz modele raportu konsumują z niego wyłącznie `viz.dimensions`, więc nie cofa to naprawy dyżuru 346.

Korekta wobec instrukcji: mianownik R2 wynosi 9 miejsc w 5 plikach, nie 7 miejsc w 3 plikach. Instrukcja w B.1 rozszerza licencję kandydatów po werdykcie KOMPLETNOŚĆ, dlatego `SIRIForm.tsx` i `DRDForm.tsx` wchodzą do R2.
