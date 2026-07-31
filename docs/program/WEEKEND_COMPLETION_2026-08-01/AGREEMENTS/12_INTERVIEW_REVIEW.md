---
agreement_id: MOD-AGR-12
module: Interview
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
accepted_by:
accepted_at:
last_reviewed: 2026-07-31
---

# Karta uzgodnienia — Interview

## 1. Definicja

Interview jest kontrolowanym systemem pozyskiwania wiedzy od ludzi. Prowadzi od
celu badania i przygotowania pytań, przez dystrybucję, odpowiedzi i dowody, do
zatwierdzonych insightów oraz dalszego wykorzystania w aplikacji.

Interview nie jest:

- Assessmentem ustalającym formalny poziom dojrzałości;
- formularzem bez celu badawczego;
- chatem, w którym AI odpowiada zamiast respondenta;
- właścicielem dokumentu, inicjatywy albo wiedzy organizacyjnej powstałej dalej.

## 2. Ocena stanu

Moduł jest jednym z najbardziej dojrzałych w produkcie. Mamy realny runtime,
który jest już używany, oraz szeroką dokumentację V3/V6/V8. Nie projektujemy go
od zera. Konsolidujemy działającą mechanikę, upraszczamy źródła prawdy i
udowadniamy pełny przepływ.

### Istniejące fundamenty

- `InterviewHub` i role-aware tabs;
- Templates oraz builder pytań;
- Sessions i assignments;
- Inbox osoby odpowiadającej oraz manager view;
- trzy tryby runtime: Single Question, Task List, Conversational;
- tekst, wybory, skale, liczby, daty i odpowiedzi głosowe;
- context, notes, evidence, pliki, linki i artifact links;
- save/exit/resume oraz answer history;
- submit, approve i send-back;
- AI help, answer improvement i explanation;
- Insights, Pending Review, reports i Initiative lineage;
- backend V8, migracje oraz testy usług/routes.

### Główne ryzyka

- wiele nakładających się dokumentów V3/V6/V8 i historycznych audytów;
- kilka aliasów trasy i dodatkowy `Discovery/InterviewHub`;
- rozbudowany `InterviewHub` jako duży orkiestrator;
- brak jednego stale wykonywanego frontendowego golden flow;
- ryzyko, że niezatwierdzony insight stanie się wiedzą organizacyjną;
- niepełny dowód działania external invitation/expiry/revocation;
- lineage insight → response/evidence → downstream wymaga odbioru E2E.

## 3. Obietnica użytkownikowi

Autor może zbudować lub wybrać profesjonalny interview template, określić cel,
scope i respondentów, rozesłać pytania, monitorować coverage, prowadzić rozmowę
oraz zatwierdzić wynik. Respondent może odpowiedzieć w wygodnym trybie,
zrozumieć pytanie, zapisać postęp, dodać dowód i wrócić później. Reviewer może
sprawdzić odpowiedzi i insighty. Organizacja wykorzystuje dopiero zatwierdzoną,
cytowalną wiedzę.

## 4. Kanoniczny przepływ

```text
Discovery Brief
→ Template / Question Set
→ Session or Program/Wave
→ Participants and Assignments
→ Answer Runtime
→ Submit
→ Review / Send Back / Confirm
→ Synthesis and Triangulation
→ Client Readback
→ Approved Insights
→ Reports / Knowledge / Tools / Assessment / Initiative Drafts
```

Każdy etap zachowuje version, owner, source, status i next action.

## 5. Powierzchnie modułu

Obecny układ jest role-aware i należy go zachować, dopóki testy użytkowników nie
wykażą realnego problemu:

1. **Inbox** — moje assignments i odpowiedzi wymagające działania;
2. **Sessions** — sesje utworzone/prowadzone przeze mnie;
3. **Assigned** — praca rozdzielona innym osobom i nadzór;
4. **Templates** — biblioteka i builder;
5. **Pending Review** — kontrolowana kolejka dopuszczenia;
6. **Insights** — synteza wielu odpowiedzi/sesji;
7. **Initiatives** — lokalne `Initiative Proposal Drafts` oraz projekcja ich
   dalszego statusu po rejestracji w module Initiatives; nigdy obiekty
   syntetyczne tworzone tylko na potrzeby widoku.

Obecny runtime pokazuje przede wszystkim realne, już zapisane inicjatywy. Luka
TO-BE polega na dodaniu jawnego etapu Proposal Draft przed rejestracją, zgodnie
ze wspólnym lifecycle inicjatywy w całej aplikacji.

To wyjątek od prostego `Library first`: dla respondenta pierwszym ekranem jest
Inbox, bo jego celem jest wykonanie przypisanej pracy. Manager/creator może
otrzymać zapamiętany domyślny widok, ale jedna osoba nie widzi powierzchni, do
których nie ma uprawnień.

## 6. Template i pytanie

Template zawiera purpose, audience, methodology, topics/categories, estimated
time, questions, branching, answer types, required state, help, evidence policy,
privacy/anonymity, insight objectives, version i readiness.

Pytanie zawiera:

- canonical wording i plain-language help;
- why-it-matters;
- answer type/options i validation;
- required/optional i skip logic;
- respondent role/topic tags;
- example answer jako pomoc, nie dane respondenta;
- follow-up/branching conditions;
- evidence/context instructions;
- AI policy oraz source/methodology reference.

AI może proponować pytania i poprawiać jakość, ale autor zatwierdza treść oraz
publikuje wersję Template.

Kanoniczna definicja pytania i generatora:

- [`QUESTION_ARTIFACT_CONTRACT.md`](QUESTION_ARTIFACT_CONTRACT.md);
- [`QUESTION_GENERATOR_CONTRACT.md`](QUESTION_GENERATOR_CONTRACT.md).

Interview stosuje profil Interview wspólnego Question Artifact. Assessment i
Audits wykorzystują ten sam rdzeń z własnymi, twardszymi rozszerzeniami
metodologicznymi.

## 7. Trzy tryby odpowiedzi

### Single Question

Najlepszy do pogłębionej, skupionej pracy. Jedno pytanie, help, odpowiedź,
context, evidence, voice, previous/next i progress.

### Task List

Najlepszy dla eksperta uzupełniającego wiele znanych odpowiedzi. Pokazuje
status, required/missing, bulk navigation i szybki powrót.

### Conversational

Teresa prowadzi rozmowę pytanie po pytaniu, dopytuje, wyjaśnia i tworzy
proposals odpowiedzi/notatek. Respondent zatwierdza zapis. Rozmowa nie może
zmienić canonical intent ani wypełnić odpowiedzi za człowieka.

Tryby czytają i zapisują ten sam Answer model. Można je przełączać bez utraty
danych, jeśli policy sesji na to pozwala.

## 8. Help i Teresa

Respondent może poprosić o:

- prostsze wyjaśnienie;
- znaczenie pytania;
- przykładową formę odpowiedzi;
- doprecyzowanie pojęć;
- wskazanie właściwego evidence;
- rozbicie trudnego pytania na mniejsze;
- podsumowanie własnej odpowiedzi;
- sprawdzenie kompletności.

Teresa oznacza wyraźnie swoje propozycje. Nie wymyśla faktów, nie usuwa
niepewności, nie ujawnia odpowiedzi innych respondentów oraz nie manipuluje
respondentem w stronę oczekiwanej tezy.

## 9. Odpowiedź i evidence

Answer zachowuje exact question/template version, respondent, status, value,
context/rationale, voice transcript, evidence links, timestamps, edit history,
AI proposal provenance i reviewer decision.

Status:

`Not started → Draft → Answered → Submitted → In review → Confirmed / Sent
back → Superseded`

Autosave nie oznacza submit. AI improvement nie oznacza akceptacji. Send-back
zachowuje poprzednią wersję i konkretne missing items.

Pełny przepływ pomocy podczas odpowiedzi, kontroli przed wysyłką i review
managera definiuje
[`INTERVIEW_ANSWER_ASSISTANCE_AND_VERIFICATION_CONTRACT.md`](INTERVIEW_ANSWER_ASSISTANCE_AND_VERIFICATION_CONTRACT.md).
W szczególności manager nie może cicho zmienić wypowiedzi respondenta: własną
wiedzę dodaje jako przypisany follow-up albo jawny `Reviewer Supplement`.

## 10. Review, triangulacja i readback

Review sprawdza odpowiedź względem pytania, kompletności, evidence, zgody i
scope. Synthesis zachowuje:

- supporting i contradicting responses;
- source excerpts i respondent/segment policy;
- stakeholder coverage i weighting;
- confidence oraz evidence sufficiency;
- hypothesis status;
- alternative interpretation;
- limitations i dissent.

Przed promocją insightu możliwy jest Client Readback: przedstawienie wniosku,
potwierdzenie, korekta albo odrzucenie przez uprawnione osoby.

## 11. Insight

Insight jest odrębnym, wersjonowanym obiektem, a nie anonimowym streszczeniem.
Zawiera claim, meaning, source responses/evidence, supporting/contradicting
signals, affected scope, confidence, reviewer, readback status, recommended
action i downstream lineage.

Tylko approved/eligible insight może stać się współdzieloną pamięcią
organizacyjną, findingiem Assessmentu, inputem Tools lub źródłem Initiative
Proposal Draft.

Szczegółowe kontrakty obu krytycznych generatorów:

- [`INSIGHT_GENERATOR_CONTRACT.md`](INSIGHT_GENERATOR_CONTRACT.md);
- [`INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md`](INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md);
- wspólny wzorzec UX, danych i kontroli:
  [`AI_GENERATOR_ARTIFACT_STANDARD.md`](AI_GENERATOR_ARTIFACT_STANDARD.md).

## 12. Integracje i granice własności

| Kierunek | Kontrakt |
| --- | --- |
| Organization | respondent roles, units, permissions i org context |
| My Work | assignments, reviews, evidence requests, decisions i reminders |
| Notifications | invitations, deadlines, send-back, escalation |
| Materials | evidence files, reports, decks i share links |
| Assessment | approved responses/insights jako source input, nie score |
| Tools | approved insights/evidence jako session input |
| Initiatives | Proposal Draft z approved insight i pełnym lineage |
| Knowledge | wyłącznie approved, eligible, scoped meaning |
| Meeting | przyszłe live capture/transcript/readback |

Interview nie tworzy kopii tasków, plików, projekt teams ani registered
initiatives.

## 13. Prywatność i bezpieczeństwo

- jawny purpose, consent, privacy/anonymity mode i retention;
- respondent widzi tylko swój dozwolony zakres;
- anonymity wall oddziela identity od wyników zgodnie z policy;
- external link ma expiry, revoke, single/multi-use policy i audit;
- AI respektuje scope i nie cytuje prywatnej wypowiedzi bez prawa;
- export/share zachowuje confidentiality;
- cross-organization access jest blokowany i testowany.

## 14. MVP golden flows

### Respondent

`open Inbox/invitation → understand purpose/privacy → answer in Single Question
or Conversational → add evidence → save/exit → resume → review answers → submit`

### Creator/Reviewer

`select template → create session → assign → monitor → receive submit → send
back/approve → generate synthesis → verify citations → approve insight → create
report or Initiative Proposal Draft`

## 15. Priorytety domknięcia

1. Zamrozić jeden canonical read order zamiast kolejnych równoległych speców.
2. Udowodnić dwa golden flows na stagingu.
3. Zweryfikować external invitation expiry/revoke i anonymity wall.
4. Zablokować knowledge promotion przed approval/eligibility.
5. Udowodnić lineage insight → answers/evidence → downstream.
6. Ujednolicić save/exit/resume oraz błędy wszystkich runtime modes.
7. Dodać frontend journey tests dla Hub, Workspace i review.
8. Oznaczyć aliasy i drugi Discovery hub jako canonical/legacy adapter.

## 16. Definition of Done

1. Template version jest przypięta do Session.
2. Pytania i branching są odtwarzalne.
3. Trzy runtime modes zapisują jeden model.
4. Autosave, exit i resume nie gubią odpowiedzi.
5. Voice/evidence zachowują consent i lineage.
6. Submit, send-back, resubmit i confirm mają audit history.
7. Respondent privacy i tenant isolation przechodzą testy.
8. Insight cytuje konkretne approved sources.
9. Contradictions i dissent nie są ukrywane.
10. Knowledge promotion wymaga policy i approval.
11. Handoff do Assessment/Tools/Initiatives zachowuje source link.
12. Reports i Materials czytają zatwierdzony snapshot.
13. Demo nie maskuje błędów runtime.
14. Oba golden flows przechodzą E2E na stagingu.
