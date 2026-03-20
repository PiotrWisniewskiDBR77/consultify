# Chat v8 - Actions and approvals

> Status: Draft v8
> Cel: Zdefiniowac kanoniczny kontrakt dla AI action proposals, approvals, execution semantics i artifact handoff.

---

## 1. Po co istnieje ten dokument

`Chat v8` ma byc mocniejszy od liderow nie tylko w odpowiadaniu, ale w przechodzeniu do dzialania.
To wymaga twardego kontraktu:
- co jest tylko sugestia,
- co jest action proposal,
- co jest approval,
- co jest execution,
- co jest zapisane i audytowalne.

---

## 2. Nadrzedna zasada

Kazda istotna akcja AI nalezy do jednej klasy:
- `suggestion`
- `proposal`
- `approved action`
- `executed action`

System nie moze mylic tych stanow.

---

## 3. Canonical lifecycle

Kanoniczny lifecycle:

`suggested -> pending_review -> approved or rejected -> executed or closed -> audited`

Rules:
- `approved` nie moze domyslnie znaczyc czegos innego w zaleznosci od shellu,
- jesli `approve` i `execute` sa osobnymi krokami runtime, docs musza to powiedziec wprost,
- `reject` musi miec realny backend meaning, nie tylko local UI removal.

---

## 4. Action classes

### 4.1 Ephemeral response actions

To lekkie action chips lub next-step shortcuts, np.:
- navigate,
- copy,
- lightweight execute helper,
- open another surface.

Rules:
- jesli sa rendered, musza miec jednoznaczny handler,
- jesli sa tylko w legacy shellu, nie wolno ich traktowac jako canonical parity.

### 4.2 Durable AI actions

To akcje zapisane jako:
- proposals,
- pending approvals,
- audytowalne decyzje.

To jest glowna przewaga `consultify`.

### 4.3 Artifact handoff actions

To przejscie z rozmowy do artifactu, np.:
- save as note,
- save as idea,
- create decision,
- create task,
- move output into work artifact flow.

Rules:
- wynik handoff musi byc reviewable,
- user powinien rozumiec, co bedzie utworzone.

---

## 5. Approval contract

### 5.1 Approval means decision, not magic

Approval ma znaczyc:
- user reviewed proposal,
- user wyrazil zgode na dalszy krok.

Jesli system po approve jeszcze nie wykonal akcji, musi to byc czytelne.

### 5.2 Reject contract

Reject ma:
- istniec realnie po stronie backendu,
- zatrzymywac dalszy execution path,
- byc auditowalne.

### 5.3 View all / open action center

Jesli produkt pokazuje `view all` lub business actions navigation:
- target musi istniec,
- optional callback nie moze byc traktowany jako universal capability.

---

## 6. Proposal shape

Kazdy durable proposal powinien miec:
- `actionId`
- `type`
- `target`
- `summary`
- `reason`
- `risk or assumptions`
- `approvalRequired`
- `status`
- `createdAt`
- `resolvedAt?`
- `auditRef?`

Minimalny product-visible payload:
- co zostanie zrobione,
- na czym,
- dlaczego,
- co stanie sie po approve.

---

## 7. UX requirements

### 7.1 Pending actions strip

Pending strip musi:
- pokazywac liczbnik i preview,
- rozroznic pending od already resolved,
- miec prawdziwy approve/reject meaning,
- dawac droge do pelnego review.

### 7.2 Message-level proposal visibility

Jesli odpowiedz AI generuje proposal lub action suggestion, user powinien moc powiazac:
- proposal w message flow,
- pending state w action layer,
- execution outcome.

### 7.3 Artifact save actions

Save actions musza mowic jasno:
- jaki artifact powstanie,
- czy to draft czy final,
- czy potrzebna jest akceptacja.

---

## 8. Audit rules

Kazda durable action powinna pozostawiac:
- status trail,
- actor trail,
- timestamps,
- target reference,
- outcome or failure info.

Bez tego `Chat v8` nie moze pretendowac do governed action system.

---

## 9. Anti-patterns

- approve button, ktory nie wiadomo czy approve'uje czy execute'uje,
- reject, ktory jest tylko front-endowym sukcesem,
- action CTA, ktore dziala tylko w jednej shell path,
- save-to-artifact bez jasnego rezultatu,
- proposal without rationale.

---

## 10. Definition of done

Actions and approvals sa domkniete, gdy:
- lifecycle jest jednoznaczny,
- approve/reject sa prawdziwe i audytowalne,
- proposal state jest widoczny,
- action and artifact handoff sa zrozumiale,
- docs wyraznie oddzielaja response actions, durable actions i execution semantics.
