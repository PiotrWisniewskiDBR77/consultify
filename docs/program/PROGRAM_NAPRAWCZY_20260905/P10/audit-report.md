# Raport audytu

**PROPOZYCJA — do słowa właściciela.** Brak osiągalnego rekordu; zrzut listy audytów: `evidence/p10-karty-n/audit-criterion/audit-criterion-loaded.png`.

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Podsumowanie | brak kontraktu | `AuditReportDocumentView.tsx` | presentation model → `/audits/reports/:id/presentation` | sekcja poza kontraktem | blokuje MVP |
| Ustalenia i ryzyka | brak kontraktu | jw. | findings → serwis raportu audytu | sekcja poza kontraktem | blokuje MVP |
| Rekomendacje | brak kontraktu | jw. | recommendations → serwis raportu audytu | sekcja poza kontraktem | blokuje MVP |
