# Analiza obciążenia

Kontrakt zastany, po scaleniu DEC-421: karta `capacity_analysis` w rejestrze i `StandardArtifactShell`.

| sekcja / zakładka / pole | kontrakt mówi | ekran pokazuje | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Plan źródłowy | `CapacityAnalysisCard.tsx` `sections` | `CapacityAnalysisCard` | `planScenarioId`, `planScenarioVersion` → capacity scenario writer | brak | kosmetyka |
| Arkusz obciążenia | jw. | jw. | `periods[].demand/supply` → capacity writer | brak | kosmetyka |
| Luki i presja | jw. | jw. | deterministyczne `countCapacityGaps` | brak | kosmetyka |
| Propozycje zmian | jw. | jw. | `capacityOptionsAdvisor` / route `capacity-options/:id/propose` | brak | kosmetyka |
| Decyzje | jw. | jw. | status/publishedAt → publish writer | brak | kosmetyka |

