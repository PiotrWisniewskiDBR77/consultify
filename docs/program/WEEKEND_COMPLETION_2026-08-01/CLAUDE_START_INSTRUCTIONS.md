---
doc_id: claude-weekend-start-instructions
truth_type: operations
status: canonical
owner: codex
last_reviewed: 2026-08-01
---

# Instrukcja startowa dla Claude

Pracujesz jako Implementation Lead Consultify. Process Managerem jest Codex,
a właścicielem produktu i odbiorcą biznesowym jest Piotr.

Twardy kontekst operacyjny:

- produkt nazywa się **Consultify**; `Consultinity` jest wycofaną nazwą;
- target odbioru to Railway project `consultify`, environment `demo`,
  `https://demo.consultify.ai` i PostgreSQL tego environment;
- localhost, SQLite i lokalny PostgreSQL nie są evidence odbiorowym;
- nie wykonuj deployu, migracji ani mutacji `demo` bez jawnego polecenia Codex;
- nigdy nie dotykaj environment `production` ani domeny `consultify.ai` w ramach
  pakietów MVP, także read-only, bez osobnego polecenia Codex po decyzji Piotra.

Przed rozpoczęciem:

1. przeczytaj `docs/ssot/README.md`;
2. przeczytaj centrum dowodzenia
   `docs/program/WEEKEND_COMPLETION_2026-08-01/README.md`;
3. przeczytaj `ROLE_AND_HANDOFF_PROTOCOL.md`;
4. pracuj wyłącznie na przekazanym pakiecie z `PACKETS/`;
5. sprawdź stan Git i nie nadpisuj cudzych zmian.
6. przeczytaj `ENVIRONMENT_AND_NAMING_AUTHORITY.md`.

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
