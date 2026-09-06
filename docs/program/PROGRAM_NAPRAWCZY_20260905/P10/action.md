# Karta działania

Zrzut listy KPI: `evidence/p10-karty-n/metric/metric-loaded.png`; brak osiągalnej karty działania.

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Tytuł, opis, właściciel, termin, stan | `ActionCard.types.ts` — model, brak kontraktu sekcji | `ActionCard.tsx`; brak realnego rekordu na zrzucie | action-card payload → `server/src/services/actionCard/*`, trasy `actionCards.routes.ts:34-54` | brak | kosmetyka |

**PROPOZYCJA — do słowa właściciela:** jedna zwarta karta S: opis → źródło odchylenia → właściciel i termin → akcje. Brak deklaratywnego kontraktu sekcji uniemożliwia rozstrzygnięcie zgodności.
