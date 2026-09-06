# Miernik

**PROPOZYCJA — do słowa właściciela.** Zrzut: `evidence/p10-karty-n/metric/metric-loaded.png`; szczegół rekordu nie załadował się.

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Definicja KPI | brak kontraktu | `ResultsVNext/kpiTool/KpiToolPage.tsx` | KPI → `server/src/routes/resultsVnext/kpi.routes.ts` | sekcja poza kontraktem | blokuje MVP |
| Wartości i okresy | brak kontraktu | jw. | observations → trasy KPI | sekcja poza kontraktem | blokuje MVP |
| Odchylenia i karta działania | brak kontraktu | jw. | action cards → `kpi.routes.ts:985-1023` | sekcja poza kontraktem | blokuje MVP |
