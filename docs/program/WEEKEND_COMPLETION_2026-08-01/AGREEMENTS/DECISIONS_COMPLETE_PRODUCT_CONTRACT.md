---
document_id: DECISIONS-COMPLETE-PRODUCT-CONTRACT
module: My Work / Decisions
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Decisions — kompletny kontrakt produktu

## 1. Cel

Decisions skraca drogę od nierozstrzygniętego problemu do jawnego, uzasadnionego
i wykonanego wyboru. System pilnuje, aby decyzja miała właściwego decydenta,
termin, opcje, dowody, konsekwencje i przełożenie na działanie.

## 2. Powierzchnie

- List: kompletny rejestr ze statusami, SLA, decydentem, projektem i blokadami;
- Kanban: proces przygotowania i rozstrzygania;
- Timeline: terminy decyzji, opóźnienia i wpływ na zależną pracę;
- Detail: dossier decyzji, approval, komentarze, powiązania i audit;
- My Work/Inbox: „czeka na moją decyzję”, „czeka na mój wkład”, eskalacje.

Minimalne widoki zapisane: Moje do decyzji, Do mojego review, Zablokowane,
Przeterminowane, Eskalowane, Ostatnio opublikowane. Filtry obejmują decydenta,
owner, projekt, source, priority/impact, oba statusy, termin i confidentiality.

## 3. Model dwóch osi statusu

Jedno pole nie może mieszać wyniku biznesowego i workflow approval.

**Oś A — workflow dokumentu:** `proposed → review → approve → published`.
Powrót `review → proposed` i `approve → review` służy poprawkom. `published` jest
terminalny dla wersji; korekta tworzy nową wersję/amendment.

**Oś B — wynik biznesowy:** `pending`, `approved`, `rejected`, `deferred`,
`escalated`, `blocked`, `superseded`. Wynik `approved` nie jest tym samym co krok
workflow `approve`: pierwszy mówi, co rozstrzygnięto; drugi, że materiał czeka na
formalną publikację.

Migracja ma jawnie rozdzielić obecne wartości i nie zgadywać znaczenia bez
provenance. UI pokazuje jedną zwięzłą etykietę główną, a drugą oś w detail/tooltip.

## 4. Wymagane dane

- pytanie decyzyjne zapisane tak, aby można było odpowiedzieć;
- owner procesu, decider/approver i mandat/poziom decyzji;
- projekt, source, termin decyzji i konsekwencja opóźnienia;
- kontekst, scope i ograniczenia;
- realne opcje, w tym — gdy zasadne — „nie robić teraz”;
- kryteria wyboru, dowody, założenia i poziom pewności;
- rekomendacja ze wskazaniem trade-offów;
- wybrany wynik, rationale, warunki i data przeglądu;
- relacje do tasków, initiatives, risks, KPI i wcześniejszych decyzji.

## 5. Karty detail

| Karta | Cel | Minimum | Rola Teresy |
| --- | --- | --- | --- |
| Zakres decyzji | precyzyjne pytanie i granice | problem, scope, deadline | pisze draft i wykrywa nie-decyzje |
| Opcje i trade-offy | uczciwy wybór | ≥2 opcje lub uzasadnienie | generuje opcje, źródła i porównanie |
| Ryzyko i wpływ | ocena konsekwencji | skutek, szansa, mitygacja | analizuje scenariusze |
| Konsekwencje | koszt decyzji/braku decyzji | d7/d30/d90 lub właściwy horyzont | modeluje, oznacza niepewność |
| Governance i eskalacja | mandat i ścieżka | decider, RACI, SLA, próg | proponuje; człowiek zatwierdza |
| Zasoby i linki | evidence/provenance | źródło, autor, data | streszcza, nie wymyśla dowodów |
| Komentarze | dyskusja | autor, czas, odniesienie | streszcza i wykrywa otwarte pytania |
| Activity log | audyt | wersje i zdarzenia | wyłącznie odczyt faktów |

Rdzeń domyślny: Zakres, Opcje, Ryzyko, Konsekwencje. Governance staje się
obowiązkowe przy decyzjach o wysokim wpływie, wielu projektach, budżecie,
security/compliance albo eskalacji.

## 6. Teresa i standard jakości

Teresa działa jak konsultant: doprecyzowuje pytanie, wskazuje brakującego
decydenta, zbiera źródła, rozróżnia fakt/założenie/opinię, tworzy MECE opcje,
porównuje je według jawnych kryteriów, wykrywa confirmation bias, konflikt z
wcześniejszą decyzją i pracę oczekującą na rozstrzygnięcie. Może rekomendować,
ale rekomendacja pokazuje przesłanki, niepewność i alternatywy.

Teresa nie głosuje, nie zatwierdza, nie publikuje w imieniu człowieka, nie
fabrykuje źródeł i nie ukrywa sprzecznych danych. Dla działań high impact zawsze
obowiązuje `proposal → diff → human approval → execute → read-back`.

## 7. Approval i wykonanie

Domyślny prosty workflow: owner przygotowuje → decider rozstrzyga → system
publikuje po potwierdzeniu → ownerzy akceptują proponowane taski. Admin może
skonfigurować wielu approverów, kolejność, quorum, zastępstwo i progi. Delegacja
nie usuwa pierwotnego mandatu z audytu.

Publikacja zamraża dossier wersji, informuje zainteresowanych i uruchamia jawne
propozycje działań. Zmiana opublikowanej decyzji tworzy amendment, pokazuje wpływ
na zależne taski/initiatives i wymaga ponownego approval odpowiedniego do wpływu.

## 8. Relacje i bottleneck management

- blocker decision musi wskazywać pracę, którą blokuje, wartość/opóźnienie i SLA;
- Decision Map pokazuje `depends_on`, `blocks`, `supersedes`, `conflicts_with`,
  `implements` i `related_to`;
- opóźnienie generuje alert decidera, następnie delegation/escalation według
  polityki; sama eskalacja nie zmienia wyniku decyzji;
- dashboard mierzy lead time, aging, reopen/amendment rate, decisions without
  owner, blocked work i realizację działań po decyzji — nie liczbę kliknięć.

## 9. MVP golden flows

1. Utworzenie decyzji z Initiative/Task/Meeting/Inbox z provenance.
2. Teresa przygotowuje dossier; człowiek zatwierdza diff.
3. Review odsyła do uzupełnienia z konkretną luką.
4. Decider wybiera wynik, wpisuje/akceptuje rationale i publikuje.
5. System proponuje taski; ownerzy je akceptują, a decyzja otrzymuje read-back.
6. Przeterminowana decyzja przechodzi delegację/escalation bez utraty audytu.
7. Amendment pokazuje wpływ na istniejące zadania przed publikacją.
