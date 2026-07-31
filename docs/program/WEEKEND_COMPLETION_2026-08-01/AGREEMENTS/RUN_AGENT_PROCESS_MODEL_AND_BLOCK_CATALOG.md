---
document_id: RUN-AGENT-PROCESS-MODEL-BLOCK-CATALOG
module: My Work / Run Agent
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Run Agent — model procesu i kompletny katalog bloków

## 1. Docelowy model grafu

Definition jest directed graph z walidowanymi nodes i edges. Edge może nieść
warunek, output mapping i label. Graf musi obsługiwać:

- sekwencję;
- równoległe gałęzie i merge;
- condition/switch;
- foreach/map z limitem współbieżności;
- controlled loop z max iterations;
- sub-process/call agent;
- wait until/delay/event;
- human input, review, approval i decision;
- error/fallback/compensation path;
- explicit output/end states.

Cycle jest dozwolony wyłącznie przez kontrolowany loop node. Inne cykle blokują
publish. Każdy graf ma start trigger i co najmniej jeden terminal output.

## 2. Kontrakt bloku

Każdy block definition zawiera:

- stabilny `blockType` i wersję;
- business label, purpose i category;
- input/output JSON schemas oraz sensitivity classification;
- configuration schema i validation rules;
- capability/tool reference i minimal permissions;
- execution mode: deterministic, prompt, agentic, human lub control;
- idempotency behavior, timeout, retry i error defaults;
- side-effect class: none, reversible, compensatable, irreversible;
- approval recommendation i prohibited autonomy levels;
- telemetry schema i redaction policy;
- UI renderer, help, example i test fixture;
- availability: active, beta, soon, deprecated.

Palette może pokazać tylko blok z działającym executor/capability. `Soon` jest
nieklikalne i dokładnie mówi, czego brakuje.

## 3. Kategorie i bloki

### 3.1 Triggers

Manual; conversation intent; form/input submitted; schedule/cron; calendar
event; webhook; connector event; record created/changed; threshold/KPI alert;
task/decision/initiative lifecycle; file added to Vault; inbound e-mail;
previous process completed/failed.

Trigger definiuje dedup key, debounce, authorization, sample event, start input
schema i replay policy. Schedule ma timezone, DST behavior i catch-up policy.

### 3.2 User input i human work

Free text; structured form; file/source selection; selection list; task to human;
request evidence; request clarification; manager review; approval; business
decision; workshop/meeting; wait for external response.

Human node ma assignee/role resolution, due date/SLA, escalation, reminder,
allowed actions, form schema i timeout path. Odpowiedź staje się wersjonowanym
outputem kroku, nie komentarzem poza procesem.

### 3.3 Knowledge i data

Vault file/folder/collection/KB; Notes; Review Table; web/deep research;
enterprise connector search; structured query; module read; uploaded run input;
previous run memory; approved organization method/playbook.

Blok rozróżnia trwały context od dynamic search. Jawnie wybiera exact/latest,
scope, filters, freshness, citation requirement i behavior `not found`.

### 3.4 AI / Teresa

Prompt transform; classify/extract; summarize; compare; synthesize; generate
options; critique; quality review; planning; deep analysis; artifact drafting;
agentic tool-use; multimodal analysis; translate/localize.

Każdy blok ma instrukcję, context inputs, output schema, model profile, citation
policy, confidence/quality gate i fallback. Prompt node nie powinien udawać
agenta. Agentic node otrzymuje ograniczony tool set i max turns/actions.

### 3.5 Moduły Consultify — reads

Interview answers/status; Assessment responses/matrix/gaps; Tool sessions/
outputs; Audit evidence/findings; Initiative portfolio/card/status; Execution
milestones/tasks/blockers/capacity; Finance model/ROI/NPV/actuals; KPI/OKR/
alerts; Results benefits; Decisions; Tasks; Calendar; Materials; Organization
roles/projects; Meeting transcripts/notes.

Każdy odczyt ma owner API, filter scope, freshness i provenance. Brak modułowego
API oznacza `soon`, nie frontendową atrapę.

### 3.6 Moduły Consultify — proposals/writes

Create/update Task; create Decision candidate; create Initiative proposal;
request project assignment; create Note; schedule Meeting; publish Material
draft; write approved KPI measurement; update Execution checkpoint; send
notification. Każdy write ma preview, expected version, idempotency i read-back.

### 3.7 Documents and artifacts

Generate/edit DOCX; PPTX; XLSX; PDF/report; Canvas; table; chart/diagram; e-mail
draft; executive summary; implementation plan. Input może być template z Vault,
wcześniejszy output lub pusty dokument. Output zachowuje source manifest i jest
draftem do review przed publikacją/wysyłką.

### 3.8 External connectors/MCP

Capability discover/search/read/create/update/send/upload/download; Slack/Teams;
mail/calendar; SharePoint/Drive/Box; CRM/ERP/PM; databases/APIs. Palette nie jest
listą dostawców, tylko capabilities; binding wybiera konkretną connection.

### 3.9 Control flow

Condition, switch, parallel, merge/all, merge/any, foreach, loop, sub-process,
wait/delay, wait event, rate limit, checkpoint, stop success, stop failure,
error boundary, retry, fallback i compensate.

Condition działa na typed expressions lub policy rule. AI classification może
dostarczyć wartość, ale control node wykonuje deterministyczne rozgałęzienie.

### 3.10 Observability i utility

Log business event; set variable; transform/map; validate schema; redact;
calculate; format; deduplicate; compare versions; assert; emit metric; create
checkpoint. Informacja/comment pozostaje anotacją i nie jest wykonywana.

## 4. Dane pomiędzy krokami

Każdy output ma nazwę, typ, schema version, provenance, sensitivity i size.
Mapping używa typed picker, nie ręcznych niezweryfikowanych ścieżek jako default.
Expression może odwołać się do trigger, variables, step outputs, run metadata i
secrets reference, lecz nie do danych poza effective ACL.

Duże pliki/artefakty przekazujemy jako references, nie inline JSON. Secret i
credentials nigdy nie stają się outputem ani częścią promptu. UI pokazuje sample
data z maskingiem i ostrzega o incompatible schema.

## 5. Bramy jakości procesu

Publish validation sprawdza:

- reachability, terminal path i brak niekontrolowanego cyklu;
- wymagane konfiguracje i bindings;
- kompatybilność schemas na edges;
- ACL i execute-as dla owner/run user;
- side effects i approval coverage;
- error path, retry i idempotency;
- max loop/actions/time/cost;
- source/citation policy dla AI;
- output owner i handoff/read-back;
- krytyczne tests i brak deprecated blocks.

## 6. Obecny katalog vs cel

AS-IS ma rodzaje: `etap-modul`, `ai-teresa`, `vault-kontekst`,
`brama-akceptu`, `automat`, `informacja`, `pauza`. To wartościowy proof, ale
miesza execution mode, source, control i business module w jednej osi `kind`.
Docelowo są to osobne cechy bloku. Migracja mapuje istniejące kroki do katalogu,
nie usuwa ich bez raportu.

## 7. Pytania do odbioru

1. Czy w MVP pozwalamy na foreach i parallel, czy tylko condition + sub-process?
2. Czy user może tworzyć własne custom HTTP/MCP blocks?
3. Czy każdy AI block wybiera model, czy wybór jest centralną policy?
4. Jakie writes mogą działać bez każdorazowej zgody w autonomy level 3?
5. Czy business Decision node jest oddzielny od prostego Approval node?
