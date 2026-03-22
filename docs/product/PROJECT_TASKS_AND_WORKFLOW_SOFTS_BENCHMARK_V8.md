# Project Tasks And Workflow Softs Benchmark v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: wyciagnac wzorce dla `Inbox`, intake, triage i personal workflow z benchmarkow `Softs`, bez kopiowania UI, ale z przełożeniem na target runtime dla `consultify`

---

## 1. Why this document exists

`Inbox` w `consultify` nie powinien byc tylko lista notyfikacji ani drugim task-listem.

Ma byc:

- action queue
- triage surface
- governance enforcement layer
- AI-assisted intake mechanism

Do tego potrzebne sa benchmarki nie tylko z klasycznych task managerow, ale tez z:

- `Softs/Notatki`
- `Softs/Agenci`
- `Softs/tabele`

bo w praktyce nowoczesny inbox powstaje na styku:

- capture
- routing
- delegation
- review
- governed action

---

## 2. Benchmark source families

Wnioski dla tego dokumentu pochodza z benchmark families juz wykorzystywanych w repo:

- `Softs/Notatki/Notion dev.zip`
- `Softs/Notatki/Notion help.zip`
- `Softs/Notatki/evernote dev.zip`
- `Softs/Notatki/evernote help.zip`
- `Softs/Agenci/*`
- `Softs/tabele/*`

Zasada:

`Inbox` nie kopiuje UI liderow. Adaptuje ich logike intake, routing, source-awareness, workflow orchestration i confidence-safe AI assistance.

---

## 3. What each benchmark family contributes

### 3.1 Notes family: Notion + Evernote

Wnosi:

- frictionless capture
- `capture now, organize later`
- source-aware creation
- jeden inbox dla sygnalow przychodzacych z roznych miejsc
- search-first and context-first recovery

Lesson for `consultify`:

`Inbox` powinien byc pierwszym miejscem, gdzie sygnal trafia do personal workflow zanim stanie sie uporzadkowanym taskiem, decyzja lub notatka dojrzala operacyjnie.

### 3.2 Agents family

Wnosi:

- routing
- handoffs
- fan-out / fan-in
- typed outputs
- async work with visible completion
- background execution with governed re-entry

Lesson for `consultify`:

`Inbox` musi umiec przyjmowac nie tylko ludzkie zadania, ale tez wyniki AI, review requests, resumable work i recommendation objects, bez zamieniania wszystkiego w zwykly message feed.

### 3.3 Tables / forms family

Wnosi:

- controlled intake through forms
- structured data entry
- interfaces as audience-specific intake surfaces
- normalization before entry into the system of record

Lesson for `consultify`:

`Inbox` powinien rozumiec roznice miedzy:

- surowym sygnalem
- sformalizowanym requestem
- review item
- finalnym actionable work object

---

## 4. Benchmark patterns to adopt

### 4.1 Frictionless intake

Pattern:

- user or system can send work into the queue without forcing full structuring first

Adaptation:

- `Inbox` accepts task, decision, approval, escalation, AI suggestion and signal-like items without requiring the user to reorganize them immediately

### 4.2 One inbox, many sources

Pattern:

- many source types, one normalized intake surface

Adaptation:

- `Inbox` should surface a canonical item model regardless of whether the source is:
  - task
  - decision
  - gate approval
  - notification
  - agent result
  - radar suggestion
  - external signal

### 4.3 Source awareness

Pattern:

- user must know why the item appeared

Adaptation:

- every inbox item must explain:
  - source object
  - source system or actor
  - why it is visible to this user
  - what is expected next

### 4.4 Triage as first-class behavior

Pattern:

- inbox is valuable only if user can quickly route work onward

Adaptation:

- triage actions are not cosmetic
- they must have durable consequences:
  - route to focus
  - schedule
  - delegate
  - save
  - snooze
  - dismiss
  - done
  - reject where governance allows

### 4.5 AI as triage helper, not decider

Pattern:

- AI may recommend priority or route
- human still decides

Adaptation:

- AI may suggest:
  - urgency
  - section
  - next action
  - rationale
  - confidence

- system must support:
  - explicit review
  - confidence-safe auto-triage only under policy
  - undo for AI-applied triage

### 4.6 Async completion and re-entry

Pattern:

- background work must return visibly into user workflow

Adaptation:

- completed async work, proposal review, resume-ready sessions and failed-with-recovery-path objects must be able to land in `Inbox`

### 4.7 Governance queue, not notification graveyard

Pattern:

- high-value inbox surfaces separate actionable items from FYI noise

Adaptation:

- `Inbox` in `consultify` should remain an action queue first
- FYI items may exist, but cannot drown review, approval and breach items

### 4.8 Dedupe and normalization

Pattern:

- repeated or overlapping signals should not create chaos

Adaptation:

- repeated alerts and overlapping notifications should materialize into one canonical item where possible
- source detail can remain visible in preview or audit layer

### 4.9 SLA-backed urgency

Pattern:

- deadlines and breach state must be operational, not decorative

Adaptation:

- SLA level, remaining time and breach state must drive:
  - ordering
  - escalation
  - badges
  - re-engagement

### 4.10 Focus routing

Pattern:

- triage is useful only if it feeds the next work surface

Adaptation:

- `Inbox` must feed:
  - `Today`
  - `This week`
  - `Later`
  - delegated ownership
  - due-date changes

---

## 5. Product implications for Consultify

The target `Inbox` should be:

- unified across sources
- typed and explainable
- persistent in triage decisions
- connected to focus and execution
- governed by SLA and escalation
- AI-assisted but human-controlled
- compatible with chat and async agent runtime

It should not be:

- a clone of email inbox
- a second copy of task board
- a place where AI silently routes business-critical work without traceability

---

## 6. Most important gaps this benchmark highlights

Compared with the benchmark logic, `consultify` must explicitly guarantee:

- one canonical item model
- one canonical section model
- one canonical triage contract
- one explicit bridge from intake sources into inbox materialization
- AI suggestions with confidence and undo
- clear separation of actionable vs FYI surfaces
- durable explanation of `why am I seeing this`

---

## 7. Benchmark conclusion

The final benchmark conclusion is:

`Inbox v8` in `consultify` should combine Evernote-like frictionless capture logic, Notion-like source-aware organization, agent-stack routing discipline, and structured intake thinking from table/form systems. The result should be a governed action queue where work from many parts of the app lands in one normalized surface, is triaged quickly, and moves into execution without losing source context or control.

---

## 8. Related canonical docs

- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
- `INTAKE_AND_TRIAGE_RUNTIME_V8.md`
- `MY_WORK_INBOX_AND_SLA.md`
- `ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`
- `AGENT_EXECUTION_V8_SSOT.md`
