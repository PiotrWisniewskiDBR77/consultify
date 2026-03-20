# Notatka v8 - AI governance

> Status: Draft v8
> Cel: Zdefiniowac zasady wykorzystania AI w module `Notebook`, tak aby AI wzmacnial prace z wiedza bez naruszania zaufania, traceability i kontroli usera.

---

## 1. Core rule

W `Notatka v8` AI nigdy nie zapisuje zmian po cichu.

Kazda istotna operacja AI musi przejsc przez:

`propose -> review -> accept/reject`

To jest zasada nadrzedna dla:
- edycji tresci,
- suggestions,
- extraction,
- conversions,
- contextual insertions.

---

## 2. Dopuszczalne klasy operacji AI

### 2.1 Observe-only

AI analizuje notatke i zwraca wnioski bez propozycji zapisu:
- summary,
- key topics,
- questions,
- risks,
- missing angles.

### 2.2 Suggest-only

AI proponuje zmiane lub powiazanie, ale nic nie zapisuje:
- suggest tags,
- suggest note type,
- suggest related notes,
- suggest linked artifacts,
- suggest readiness for conversion.

### 2.3 Proposal-as-content

AI generuje blok lub serie blokow, ktore user moze wstawic:
- insert block,
- append section,
- replace section,
- create outline.

### 2.4 Extract-and-convert

AI wydobywa strukture i proponuje przejscie do innych artefaktow:
- action items,
- task candidates,
- decision candidates,
- initiative seed,
- report/presentation outline.

### 2.5 Retrieval support

AI pomaga odzyskac wiedze:
- semantic search,
- contextual recall,
- RAG context,
- why-this-note-is-relevant explanation.

---

## 3. Niedopuszczalne zachowania AI

- silent overwrite,
- silent delete,
- silent conversion,
- mixing user content and AI content bez rozroznienia,
- retrievowanie niedozwolonych danych poza boundary uzytkownika/organizacji,
- "hallucinated links" bez mozliwosci weryfikacji,
- generowanie finalnych obiektow z pominięciem review.

---

## 4. Minimalny audit trail

Kazda operacja AI, ktora ma znaczenie produktowe, musi miec:
- `operationId`
- `actorId`
- `organizationId`
- `noteId`
- `operationType`
- `inputContextRef`
- `promptVersion` lub logic prompt id
- `modelRef`
- `proposalPayload`
- `status`
- `createdAt`
- `resolvedAt`
- `resolvedBy`

Jesli operacja dotyczy retrieval:
- warto przechowywac takze listę cytowanych zrodel i score explanation.

---

## 5. UX contract

### 5.1 AI content must be visually distinct

User musi zawsze widziec, co jest:
- jego trescia,
- propozycja AI,
- komentarzem AI,
- wynikiem extraction.

### 5.2 Resolution must be explicit

User musi miec jasne akcje:
- accept,
- reject,
- insert elsewhere,
- revisit later,
- open source context.

### 5.3 No dark patterns

Zakazane:
- ukryte "auto apply",
- niejawne aktualizacje notatki po response AI,
- mieszanie finalnej tresci z draftem bez sygnalizacji.

---

## 6. Retrieval governance

AI retrieval dla notatek musi byc:
- permission-safe,
- org-safe,
- explainable,
- source-backed.

Minimalne reguly:
- pokazuj cytaty i snippets,
- pokazuj zrodlo notatki, jesli to potrzebne do zaufania,
- nie pokazuj tresci spoza scope usera,
- dawaj sygnal `matchType` i powod trafnosci tam, gdzie to mozliwe.

---

## 7. Conversion governance

AI moze przygotowac:
- outline,
- structured proposal,
- extracted actions,
- readiness recommendation.

AI nie moze samodzielnie:
- stworzyc finalnego taska/decision/inititative bez jawnego potwierdzenia,
- zmienic source traceability,
- ukryc zrodla konwersji.

Po konwersji musi pozostac:
- link source note -> target artifact,
- informacja o origin,
- mozliwosc cofniecia poznawczego, czyli zrozumienia skad artefakt sie wzial.

---

## 8. Quality gates

Przed uznaniem operacji AI za gotowa do rollout:

### 8.1 Functional quality

- czy wynik jest uzyteczny,
- czy proposal jest czytelny,
- czy resolution flow dziala,
- czy output ma sens w kontekscie notatki.

### 8.2 Trust quality

- czy user wie, co sie stalo,
- czy moze odrzucic bez strat,
- czy system nie manipuluje finalna trescia.

### 8.3 Retrieval quality

- czy trafnosc wynikow jest sensowna,
- czy cytaty sa zgodne z note source,
- czy nie ma wyciekow permission.

### 8.4 Governance quality

- czy wszystko jest audytowalne,
- czy model/prompt jest identyfikowalny,
- czy da sie odtworzyc przeplyw.

---

## 9. Recommended eval classes

### 9.1 Summary eval

Sprawdzac:
- czy summary oddaje sens notatki,
- czy nie pomija krytycznych ryzyk,
- czy nie zmienia znaczenia.

### 9.2 Action extraction eval

Sprawdzac:
- precision extracted tasks,
- false positives,
- czy extracted items sa faktycznie actionable.

### 9.3 Topic suggestion eval

Sprawdzac:
- czy topics pomagaja, czy tylko parafrazuja note title,
- czy wspieraja template/retrieval quality.

### 9.4 Retrieval eval

Sprawdzac:
- relevance,
- citation accuracy,
- diversity of useful results,
- contextual usefulness.

### 9.5 Conversion assist eval

Sprawdzac:
- jakosc outline,
- czy conversion proposal zachowuje source intent,
- czy nie produkuje "smieciowych" obiektow.

---

## 10. Operating recommendation

Najlepszy model dla `Notatka v8`:
- AI ma byc agresywne poznawczo,
- ale konserwatywne operacyjnie.

To znaczy:
- moze duzo sugerowac, laczyc i inspirowac,
- ale nie moze przejmowac kontroli nad trescia i decyzjami.

---

## 11. Summary

AI governance w `Notatka v8` ma chronic trzy rzeczy jednoczesnie:
- jakosc pomocy,
- zaufanie usera,
- traceability systemu.

Bez tego `Notebook` przestaje byc wiarygodnym artefaktem wiedzy.
