# Spotkanie

**PROPOZYCJA — do słowa właściciela.** Zrzut: `evidence/p10-karty-n/meeting/meeting-loaded.png`; stanowisko nie ma seeda spotkań.

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Informacje o spotkaniu | brak kontraktu | `MeetingObjectPage.tsx:222` | meeting → serwisy Meeting | sekcja poza kontraktem | blokuje MVP |
| Agenda i notatki | brak kontraktu | jw. | agenda/notes → serwisy Meeting | sekcja poza kontraktem | blokuje MVP |
| Decyzje i działania | brak kontraktu | jw. | governed decisions/actions → serwisy Meeting | sekcja poza kontraktem | blokuje MVP |
