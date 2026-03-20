# Chat v8 - AI governance

> Status: Draft v8
> Cel: Ustawic zasady uzycia AI w czacie, tak aby system byl skuteczny, uczciwy, reviewable i bezpieczny produktowo.

---

## 1. Po co istnieje ten dokument

`CHAT_V8_SSOT.md` definiuje produkt.
Ten dokument definiuje governance:
- co AI moze robic,
- czego nie moze robic silent,
- jak maja wygladac proposals, approvals i actions,
- jak uczciwie komunikowac sources, confidence i limitations.

---

## 2. Zasada nadrzedna

AI w `Chat v8` jest partnerem operacyjnym, ale nie niewidzialnym wykonawca.

Kazda wazna operacja AI musi byc jedna z trzech klas:
- `AI answer`
- `AI proposal`
- `AI action after approval`

User musi zawsze rozumiec, z ktorej klasy korzysta.

---

## 3. AI answer rules

### 3.1 Dozwolone

AI moze:
- odpowiadac na pytania,
- syntetyzowac materialy,
- analizowac attachments i context,
- porownywac opcje,
- pomagac w research,
- przygotowywac structured outputs,
- sugerowac dalsze kroki.

### 3.2 Niedozwolone

AI nie moze:
- ukrywac, ze odpowiedz jest best-effort,
- udawac, ze ma zrodlo, jesli go nie ma,
- twierdzic, ze wykonalo akcje, jesli tylko ja zaproponowalo,
- mutowac artifactow lub business state silent.

---

## 4. Proposal rules

### 4.1 Kiedy cos jest `proposal`

To proposal, gdy AI:
- rekomenduje dzialanie,
- draftuje note/task/decision/idea,
- proponuje save flow,
- proponuje business action,
- proponuje refinement lub next step.

### 4.2 Proposal contract

Kazdy istotny proposal powinien miec:
- `what`
- `why`
- `target`
- `risk or assumption`
- `accept / reject path`

User nie moze zgadywac, co sie stanie po akceptacji.

---

## 5. Action rules

### 5.1 Canonical state model

AI actions w `Chat v8` sa kanonicznie:

`proposed -> pending_review -> approved or rejected -> executed or closed -> audited`

### 5.2 High-trust rule

Jesli akcja dotyczy:
- business entity,
- records,
- workflow state,
- notifications,
- artifacts outside the chat itself,

to musi byc reviewable i audytowalna.

### 5.3 No silent execution

Istotne akcje nie moga byc wykonywane bez wyraznej zgody usera, chyba ze produkt ma osobna, jawnie opisana polityke auto-execution dla wybranych low-risk cases.

---

## 6. Retrieval and source transparency rules

### 6.1 Source classes

System musi rozroznic co najmniej:
- model knowledge / general answer,
- workspace context,
- conversation history,
- attachments,
- web/research,
- organizational memory.

### 6.2 Honesty rule

Jesli sources sa best-effort, to docs i UX nie moga sugerowac, ze sa guaranteed.

### 6.3 Citation rule

`Chat v8` powinien dazyc do leader-grade source transparency, ale:
- nie kazda odpowiedz musi miec citation,
- nie kazda citation path jest rowna,
- sourced answer powinien byc odroznialny od non-sourced answer.

---

## 7. Memory and privacy rules

### 7.1 Private mode

`private mode` musi znaczyc jasno:
- ograniczenie memory injection i personalization,
- przewidywalne zachowanie w stream payload i UX.

### 7.2 Organizational context

AI moze korzystac z organizational/business context tylko w granicach:
- permissions,
- tenant isolation,
- explicit runtime contracts.

### 7.3 User control

User musi miec rozsadny poziom kontroli nad:
- custom instructions,
- modes,
- scope,
- privacy-sensitive flows.

---

## 8. Voice governance rules

Voice w `Chat v8` musi jasno komunikowac:
- kiedy audio jest transkrybowane lokalnie vs serwerowo,
- kiedy odpowiedzi sa czytane glosowo,
- jak zatrzymac nagrywanie lub mowienie,
- jakie sa ograniczenia platformowe.

Nie wolno sugerowac "full conversational voice parity", jesli produkt ma tylko czesciowy runtime contract.

---

## 9. Feedback governance

Feedback pipeline ma spelniac trzy warunki:
- byc realny, nie placeholder,
- nie dubowac sie bez potrzeby,
- miec sensowna relacje do learning system i analytics.

Legacy feedback paths nie powinny byc traktowane jako canonical.

---

## 10. UX requirements from governance

Produkt musi odroznic wizualnie:
- zwykla odpowiedz,
- sourced answer,
- research mode output,
- action proposal,
- approved or pending action state,
- voice state.

Jesli user nie widzi tej roznicy, governance istnieje tylko na papierze.

---

## 11. Definition of done for AI governance

Governance `Chat v8` jest domkniete, gdy:
- answer/proposal/action sa rozdzielone semantycznie,
- AI actions maja jawny review and audit contract,
- source and scope semantics sa uczciwe,
- private mode i memory behavior sa zrozumiale,
- voice ma jawne privacy and capability rules,
- feedback flow jest jednoznaczny i realny.
