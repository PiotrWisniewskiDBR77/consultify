# Prezentacje v8 - AI governance

> Status: Draft v8
> Cel: Zdefiniowac zasady wykorzystania AI w module prezentacji, tak aby AI wzmacnial szybkosc i jakosc deckow bez naruszania zaufania, traceability i kontroli usera.

---

## 1. Core rule

W `Prezentacje v8` AI nigdy nie zmienia decku po cichu.

Kazda istotna operacja AI musi przejsc przez:

`propose -> review -> accept/reject`

To jest zasada nadrzedna dla:
- outline generation,
- deck generation,
- AI deck edits,
- visual planning,
- refresh,
- speaker notes,
- audience variants.

Jednoczesnie `v8` zaklada, ze AI buduje duza czesc pierwszej wersji decku.
To nie jest poboczna funkcja, tylko glowny silnik scaffoldingu i refinementu.

---

## 2. Dopuszczalne klasy operacji AI

### 2.1 Observe-only

AI analizuje deck lub source artifacts i zwraca wnioski bez zapisu:
- quality observations,
- deck risks,
- missing slides,
- weak narrative points.

### 2.2 Suggest-only

AI proponuje zmiane bez zapisu:
- suggest outline changes,
- suggest slide intents,
- suggest better ordering,
- suggest better visuals,
- suggest delivery readiness.

### 2.3 Proposal-as-content

AI generuje tresc lub strukture do akceptacji:
- slide draft,
- executive summary,
- notes,
- rewrite,
- shortened copy,
- alternate title,
- alternate structure.

### 2.3A AI-as-primary-builder

W modelu Gamma-primary AI ma prawo budowac wiekszosc pierwszego draftu:
- outline decku,
- slide intents,
- card copy,
- notes,
- visual directions,
- rewrite proposals,
- refresh suggestions.

Warunek:
- user review pozostaje jawny,
- acceptance jest wymagane dla mutacji decku,
- system musi odroznic proposal od applied change.

### 2.4 Refresh-and-compare

AI wspiera odswiezenie decku:
- refreshable data blocks,
- source-aware updates,
- diff between old and refreshed content.

### 2.5 Retrieval-and-context support

AI pomaga pobierac i laczyc kontekst:
- source artifact recall,
- context pack assembly,
- why-this-slide-is-relevant explanation,
- rationale for generated blocks.

---

## 3. Niedopuszczalne zachowania AI

- silent overwrite,
- silent delete,
- silent share,
- silent export,
- silent confidentiality change,
- falszywe `sourceRef` lub zmyslone zrodla,
- mixing user content and AI content bez rozroznienia,
- refresh bez sygnalu, ktore bloki zostaly zmienione.

---

## 4. Minimalny audit trail

Kazda operacja AI, ktora ma znaczenie produktowe, musi miec:
- `operationId`
- `actorId`
- `organizationId`
- `deckId`
- `operationType`
- `inputContextRef`
- `proposalPayload`
- `status`
- `createdAt`
- `resolvedAt`
- `resolvedBy`

Jesli operacja dotyczy visuals lub retrieval:
- warto przechowywac tez source set, rationale i score explanation.

Jesli operacja prowadzi do mutacji decku:
- warto przechowywac tez diff lub normalized patch description,
- warto rozrozniac `drafted`, `accepted`, `rejected`, `applied`.

---

## 5. UX contract

### 5.1 AI output must be distinguishable

User musi wiedziec, co jest:
- deck content authored by user,
- AI proposal,
- AI-generated summary,
- AI-generated notes,
- AI-suggested visual.

### 5.2 Resolution must be explicit

User musi miec jasne akcje:
- accept,
- reject,
- regenerate,
- edit manually,
- inspect source context.

### 5.2A AI operation classes must stay explicit

Kazda operacja AI powinna byc sklasyfikowana jako jedna z trzech:
- `AI suggest`
  Bez zapisu, tylko rekomendacja albo analiza.
- `AI draft`
  Tworzy outline, slide, notes, rewrite proposal albo refresh proposal do review.
- `AI apply after acceptance`
  Wykonuje mutacje decku dopiero po akceptacji usera.

### 5.3 No dark patterns

Zakazane:
- auto-apply bez zgody,
- ukrywanie, ze blok jest AI-generated,
- ukrywanie skutkow refresh i rewrite,
- mieszanie source-backed tresci z AI-only trescia bez sygnalu.

---

## 6. Source and retrieval governance

AI dla prezentacji musi byc:
- source-backed, gdy deck opiera sie na artefaktach,
- permission-safe,
- org-safe,
- explainable.

Minimalne reguly:
- pokazuj, z jakich artefaktow pochodzi deck lub slajd,
- nie pokazuj tresci spoza scope usera,
- nie udawaj, ze generated content jest "faktem" bez source,
- dawaj userowi mozliwosc wejscia w source context.

Rozroznienie wymagane w UX:
- `source-backed content`
- `AI draft without source grounding`
- `AI rewrite of source-backed content`

---

## 7. Visual generation governance

AI moze:
- proponowac visuals,
- planowac image slots,
- generowac obrazy,
- odrzucac slaba wizualnie propozycje przez QA pipeline.

AI nie moze:
- udawac, ze visual pochodzi z organization library, jesli nie pochodzi,
- psuc brand-safe defaults bez jawnej zgody,
- produkowac visuali o niejasnym statusie praw i pochodzenia, jesli system nie umie tego opisac.

---

## 8. Delivery governance

AI moze przygotowac deck do delivery:
- speaker notes,
- shortened version,
- audience-tailored variant,
- delivery checklist.

AI nie moze samodzielnie:
- opublikowac lub udostepnic decku,
- zmienic share permissions,
- zmienic confidentiality lub legal constraints.

Po delivery musi pozostac:
- traceability do zrodel,
- informacja, czy deck byl AI-generated lub AI-edited,
- audit trail krytycznych operacji.

---

## 9. Quality gates

Przed uznaniem AI operacji za rollout-ready:

### 9.1 Functional quality

- czy deck draft jest uzyteczny,
- czy outline ma sens,
- czy rewrite pomaga,
- czy visuals sa trafne,
- czy AI rzeczywiscie odciaza usera z recznego skladania pierwszej wersji.

### 9.2 Trust quality

- czy user rozumie, co AI zrobilo,
- czy moze odrzucic bez strat,
- czy system nie manipuluje trescia decku.

### 9.3 Traceability quality

- czy source refs sa prawdziwe,
- czy rationale da sie sprawdzic,
- czy refresh nie zrywa pochodzenia slajdow.

### 9.4 Governance quality

- czy wszystko jest audytowalne,
- czy model i prompt lineage sa identyfikowalne,
- czy da sie odtworzyc przebieg deck operation.

### 9.5 Continuity quality

- czy AI output przechodzi z wizarda do buildera bez rekonstrukcji,
- czy review state nie ginie po otwarciu decku,
- czy refresh/share/export dzialaja na tym samym deck context.

---

## 10. Recommended eval classes

### 10.1 Outline eval

Sprawdzac:
- czy outline pasuje do intentu decku,
- czy nie pomija kluczowych slajdow,
- czy jest czytelny dla review.

### 10.2 Narrative eval

Sprawdzac:
- czy key messages sa sensowne,
- czy deck ma logiczny przeplyw,
- czy nie rozwadnia przekazu.

### 10.3 Deck edit eval

Sprawdzac:
- czy shorten/rewrite poprawia deck,
- czy AI nie niszczy tone of voice,
- czy zmiany sa reviewable.

### 10.4 Visual eval

Sprawdzac:
- trafnosc visuali,
- brand safety,
- czy visual naprawde wzmacnia slajd.

### 10.5 Refresh eval

Sprawdzac:
- czy data refresh jest zgodny ze zrodlem,
- czy diff jest czytelny,
- czy traceability pozostaje zachowana.

---

## 11. Operating recommendation

Najlepszy model dla `Prezentacje v8`:
- AI ma byc glownym builderem pierwszej wersji decku,
- ma byc szybkie w scaffoldingu i refinement,
- ale konserwatywne w operacjach delivery i governance.

To znaczy:
- moze duzo przyspieszyc budowe decku,
- ale nie moze przejmowac kontroli nad finalnym przekazem i dystrybucja.

---

## 12. Summary

AI governance w `Prezentacje v8` ma chronic trzy rzeczy jednoczesnie:
- jakosc decku,
- zaufanie usera,
- traceability komunikacji.

Bez tego prezentacja przestaje byc wiarygodnym artefaktem platformy.
