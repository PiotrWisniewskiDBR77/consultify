# Pomysł

**PROPOZYCJA — do słowa właściciela.** Zrzut listy: `evidence/p10-karty-n/idea/idea.png`; realne rekordy są na liście, warsztatu nie otwarto.

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Płótno wybranego narzędzia | brak kontraktu | `IdeaMapWorkspace.tsx` | idea/tool state → `server/src/routes/my-work.routes.ts` | sekcja poza kontraktem | blokuje MVP |
| Szczegóły elementu | brak kontraktu | `panel/IdeaElementInspector.tsx:194` | node data → writer idei `my-work.routes.ts` | sekcja poza kontraktem | blokuje MVP |
| Teresa | brak kontraktu | `IdeaTeresaSection.tsx` | propozycja AI → executor, zapis dopiero po akceptacji | sekcja poza kontraktem | blokuje MVP |
