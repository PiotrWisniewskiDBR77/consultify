# Decyzja

Zrzut: `evidence/p10-karty-n/decision/decision.png`; realny rekord wybrano z listy, lecz szczegół pozostał na „Ładowanie…”.

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Zakres decyzji | `decisionCardContract.ts:61-76` | `DecisionDetailView.tsx:1592`; brak dowodu runtime | pola decyzji → `DecisionController.ts:2627-2739` | brak | kosmetyka |
| Opcje i trade-offy | `decisionCardContract.ts:77-93` | jw. | `alternatives` → `DecisionController.ts:2868-2987` | brak | kosmetyka |
| Ryzyko i wpływ | `decisionCardContract.ts:94-110` | jw. | `risks` → `DecisionController.ts:3000-3164` | brak | kosmetyka |
| Konsekwencje | `decisionCardContract.ts:111-129` | jw. | `consequences_of_inaction` → `DecisionController.ts:149-166` | brak | kosmetyka |
| RACI i eskalacja | `decisionCardContract.ts:130-154` | jw. | interesariusze → `DecisionController.ts:3053-3090` | brak | kosmetyka |
| Załączniki i powiązania | `decisionCardContract.ts:155-180` | jw. | agregat evidence links → `DecisionController.ts:2627-2739` | brak | kosmetyka |
| Komentarze | `decisionCardContract.ts:181-198` | prawy panel `DecisionDetailView.tsx:9771`; brak dowodu runtime | comments → `DecisionController.ts:2784-2842` | brak | kosmetyka |
| Logi aktywności | `decisionCardContract.ts:199-223` | prawy panel; brak dowodu runtime | systemowy log agregatu → `DecisionController.ts:2627-2739` | brak | kosmetyka |
