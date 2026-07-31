---
module_id: MODULE_CHAT
doc_kind: TESTS_AND_EVIDENCE
status: canonical
owner: quality-owner
last_updated: 2026-07-29
---

# Chat — testy i dowody

## Weryfikacja 2026-07-29

Uruchomiono 10 celowanych plików testowych obejmujących routing, synchronizację
rozmowy, główny panel, Composer, Canvas i politykę AI.

- wynik: `70 PASS / 4 FAIL`, 74 testy;
- routing `/chat` i `/chat/:conversationId`: PASS;
- synchronizacja parametru rozmowy: PASS;
- podstawowe zachowania `UnifiedChatPanel`: przeważająco PASS;
- kontrakt i retrieval policy gateway AI: `13/13 PASS`;
- przekazanie i montowanie dokumentu Canvas: PASS;
- regresje:
  - Composer nie spełnia dwóch oczekiwań kontraktu klas wizualnych;
  - szerokość podziału Canvas zapisuje `45` zamiast oczekiwanego `64`;
  - Canvas nie pokazuje oczekiwanego komunikatu braku capability.

Testy emitują także ostrzeżenia React o aktualizacjach poza `act(...)`. Nie
zmieniają one wyniku funkcjonalnego, ale są długiem jakościowym testów.

## Decyzja bramki

`Chat = code-verified`, `Canvas = NO_GO`, ocena dokumentacji `B`.
Do poziomu `A` wymagane są: zielony zestaw celowany, działający dowód E2E,
kontrola uprawnień/tenantów i ręczna walidacja aktualnego demo.
