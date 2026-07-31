---
document_id: ASSESSMENT-KNOWLEDGE-COMMUNICATION-CONTRACT
module: Assessment
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Assessment — baza wiedzy i komunikacja z runtime

## 1. Warstwy wiedzy

1. **Canonical sources** — książka, standard, szkolenie, whitepaper, licencja.
2. **Human Method Pack docs** — zatwierdzone MD-y wyjaśniające metodę.
3. **Runtime Method Pack** — walidowane struktury, pytania, reguły i fixtures.
4. **Retrieval chunks** — pomocnicze fragmenty dla Teresy, zawsze z metadata.
5. **Session evidence** — dane klienta; nigdy nie stają się automatycznie
   wiedzą ogólną.

RAG nie jest źródłem scoringu. Zwraca wiedzę interpretacyjną; deterministic
engine wykonuje reguły.

## 2. Metadata fragmentu

- method id/version i language;
- pack type: methodology/qbank/evidence/help/scoring/initiative/output;
- unit id i opcjonalny level/attribute/question id;
- source id, locator, owner i approval status;
- effective/deprecated date;
- licence/use restrictions;
- audience: human/AI/both;
- confidentiality;
- checksum/version.

## 3. Komunikacja Workbench → Knowledge

Zapytanie przekazuje tylko potrzebny kontekst:

`method/version + unit + level candidate + capability + language + allowed
scope + evidence refs`

Odpowiedź zawiera:

`canonical facts + questions + evidence expectations + pitfalls + source refs
+ limitations`

Nie zwraca gotowej decyzji. Capability może na tej podstawie utworzyć proposal.

Dla pomocy konwersacyjnej KB zwraca także plain-language explanation,
why-it-matters, glossary, answer examples, likely respondent roles i dozwolone
follow-up routes. Szczegóły:
[`ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md`](ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md).

## 4. Routing

1. exact Method Pack version;
2. exact unit/level/attribute;
3. method-wide approved guidance;
4. controlled generic assessment guidance;
5. `knowledge unavailable` zamiast swobodnego zgadywania.

Nie miesza się treści DRD, SIRI i ADMA tylko dlatego, że używają podobnego
słowa. Wiedza cross-method może służyć porównaniu, jeśli capability oraz
licencja jawnie na to pozwalają.

## 5. Odpowiedzialność i publikacja

`Draft chunk → methodology review → owner approval → index → retrieval test →
release`

Zmiana chunków wymaga reindeksacji i testu referencji. Sesje historyczne mogą
odtwarzać wiedzę przypiętą do ich Method Pack version.

## 6. Packi metod

Szczegółowe mapy komunikacji:

- [`ASSESSMENT_KB_DRD.md`](ASSESSMENT_KB_DRD.md);
- [`ASSESSMENT_KB_SIRI.md`](ASSESSMENT_KB_SIRI.md);
- [`ASSESSMENT_KB_ADMA.md`](ASSESSMENT_KB_ADMA.md).
