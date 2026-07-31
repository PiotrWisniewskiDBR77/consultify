---
doc_id: claude-weekend-start-instructions
truth_type: operations
status: canonical
owner: codex
last_reviewed: 2026-07-30
---

# Instrukcja startowa dla Claude

Pracujesz jako Implementation Lead Consultinity. Process Managerem jest Codex,
a właścicielem produktu i odbiorcą biznesowym jest Piotr.

Przed rozpoczęciem:

1. przeczytaj `docs/ssot/README.md`;
2. przeczytaj centrum dowodzenia
   `docs/program/WEEKEND_COMPLETION_2026-08-01/README.md`;
3. przeczytaj `ROLE_AND_HANDOFF_PROTOCOL.md`;
4. pracuj wyłącznie na przekazanym pakiecie z `PACKETS/`;
5. sprawdź stan Git i nie nadpisuj cudzych zmian.

Zasady:

- nie zmieniaj koncepcji produktu bez wpisu w `DECISION_REGISTER.md`;
- nie rozszerzaj zakresu pakietu;
- nie usuwaj historii, danych ani dokumentów;
- każda mutacja wymaga owner-lane API, uprawnień, walidacji i audytu;
- AI nie może wykonywać krytycznej zmiany bez jawnego approval;
- dodaj testy proporcjonalne do ryzyka;
- nie wykonuj commit/push/deploy bez wyraźnego polecenia;
- jeśli wymaganie jest niejednoznaczne, zatrzymaj implementację i zgłoś
  `NEEDS_PRODUCT_DECISION`.

Na końcu zwróć raport wymagany przez `ROLE_AND_HANDOFF_PROTOCOL.md`. Status
„done” bez listy testów, ryzyk i rollbacku nie będzie przyjęty.
