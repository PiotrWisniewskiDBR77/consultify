# Plan

Kontrakt zastany, po scaleniu DEC-421: karta `plan` w rejestrze i `StandardArtifactShell`.

| sekcja / zakładka / pole | kontrakt mówi | ekran pokazuje | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Horyzont | `PlanCard.tsx` `sections` | `PlanCard` | `scenario.windowUnit`, `timezone`, `periods` → plan scenario writer | brak | kosmetyka |
| Zakres inicjatyw | jw. | jw. | lista inicjatyw scenariusza → plan scenario writer | brak | kosmetyka |
| Kolejność i okna | jw. | jw. | `scenario.windows` → plan scenario writer | brak | kosmetyka |
| Zależności i konflikty | jw. | jw. | analysis proposal → route plan analysis proposal | brak | kosmetyka |
| Obciążenie ról | jw. | jw. | opublikowana analiza obciążenia; bez niej jawne „Nieznane” | brak | kosmetyka |
| Decyzje | jw. | jw. | status/publishedAt → publish writer | brak | kosmetyka |

