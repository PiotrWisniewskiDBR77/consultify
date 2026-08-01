---
document_id: AI-GENERATOR-ARTIFACT-STANDARD
scope: cross-application
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# AI Generator — wspólny standard artefaktu

## 1. Cel

Generator jest kontrolowanym procesem zamiany zatwierdzonych danych źródłowych
w propozycje nowych obiektów. Nie jest pojedynczym przyciskiem `Generate`,
chatem ani mechanizmem zapisującym wynik bez wiedzy użytkownika.

Pierwszymi implementacjami standardu są:

- Insight Generator;
- Initiative Proposal Generator.

Ten sam shell, statusy, provenance, preview i mechanika review mogą być później
wykorzystane przez generatory raportów, dokumentów, prezentacji i planów.

## 2. Wspólny przebieg

`Select sources → Scope & assumptions → Thinking/analysis → Proposal set →
Review & edit → Validate → Accept selected → Publish or hand off`

Generator zawsze pokazuje przed uruchomieniem:

- jaki obiekt powstanie;
- z jakich źródeł i ich wersji korzysta;
- jaki scope, język, odbiorca i cel obowiązuje;
- czego brakuje oraz czego AI nie będzie zgadywać;
- gdzie trafią zaakceptowane wyniki;
- kto może je zatwierdzić.

## 3. Wspólny shell UX

### Krok 1 — Sources

Lista wybranych odpowiedzi, evidence, findings, outputs albo innych obiektów.
Użytkownik może wejść do źródła, wyłączyć je i zobaczyć ograniczenia dostępu.

### Krok 2 — Generation brief

Cel, zakres, odbiorca, oczekiwany typ wyniku, kryteria jakości, język oraz
opcjonalne instrukcje. Teresa podsumowuje założenia przed startem.

### Krok 3 — Thinking

Widoczny plan analizy i stan wykonywania, bez udawania wewnętrznego toku
rozumowania. System pokazuje wykonywane operacje, np. grupowanie, porównanie,
sprawdzanie sprzeczności i deduplikację.

### Krok 4 — Proposal workspace

Karty propozycji z uzasadnieniem, źródłami, confidence, brakami i flagami.
Można zaznaczać, łączyć, rozdzielać, edytować, odrzucać i regenerować wybrany
element bez utraty reszty.

### Krok 5 — Validation

Automatyczne reguły jakości, duplikaty, sprzeczności, wymagane pola, policy i
uprawnienia. `BLOCKER` nie może zostać przykryty wysokim score.

### Krok 6 — Accept and handoff

Użytkownik widzi preview zapisów. Akceptuje wybrane propozycje; pozostałe
zostają draftami albo są odrzucane z reason. Zapis jest idempotentny i zwraca
identyfikatory obiektów docelowych.

## 4. Wspólny kontrakt propozycji

Każda propozycja ma:

- `proposalId`, `generatorType`, `runId`, `version` i status;
- source object IDs, wersje i dozwolone cytaty;
- claim albo proposed change;
- rationale i alternative interpretation;
- assumptions, unknowns, contradictions i missing evidence;
- confidence z uzasadnieniem;
- AI model/prompt/policy version oraz czas wygenerowania;
- autorów zmian AI i człowieka;
- reviewer, decyzję, reason i timestamp;
- lineage do zaakceptowanego obiektu docelowego.

## 5. Statusy

`Preparing → Ready to generate → Generating → Generated → In review → Accepted
/ Rejected / Needs evidence → Published or Handed off → Superseded`

Osobno obsługujemy `Generation failed`, `Partial result`, `Stale sources`,
`Permission changed` i `Policy blocked`.

## 6. Zachowanie Teresy

Teresa może:

- pomóc dobrać źródła i scope;
- wskazać luki, bias, sprzeczności i duplikaty;
- zaproponować wynik oraz jego warianty;
- wyjaśnić, dlaczego coś zaproponowała;
- poprawić wybrany element po instrukcji;
- przygotować review brief i rekomendację.

Teresa nie może:

- rozszerzać scope ani widoczności danych;
- wytwarzać cytatu, faktu, liczby albo źródła;
- ukrywać sprzecznych danych;
- automatycznie zatwierdzać, publikować lub rejestrować obiektu;
- traktować confidence jako prawdopodobieństwa prawdy;
- nadpisywać pracy człowieka bez preview.

## 7. Reguły bezpieczeństwa i jakości

- zero silent writes;
- zero cross-organization retrieval;
- source eligibility sprawdzane przed generacją i ponownie przed zapisem;
- każdy claim/change ma bezpośrednie lineage albo status `unsupported`;
- regeneracja tworzy wersję, nie usuwa historii;
- przy zmianie źródła wynik otrzymuje `stale`;
- anonimizacja Interview obowiązuje także w cytatach i downstream;
- wynik częściowy jest jawny i nie może wyglądać jak kompletny;
- odrzucenie oraz ręczna korekta uczą preferencji tylko w dozwolonym scope.

## 8. Mierniki

- acceptance, edit i rejection rate;
- unsupported-claim rate;
- duplicate rate przed i po generacji;
- czas do zaakceptowanego wyniku;
- odsetek propozycji cofniętych przez review;
- lineage completeness;
- stale-result rate;
- liczba policy/permission violations — target zero.

## 9. Definition of Done implementacji

- jeden współdzielony shell i proposal model;
- resume po przerwaniu i retry bez duplikacji;
- granular regenerate oraz accept selected;
- działające preview i audit trail;
- testy braku źródeł, sprzeczności, stale source i denied access;
- test izolacji organizacji;
- dowód pełnego lineage;
- żadna implementacja modułowa nie omija wspólnych bramek.
