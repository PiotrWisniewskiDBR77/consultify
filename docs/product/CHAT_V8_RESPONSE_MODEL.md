# Chat v8 - Response model

> Status: Draft v8
> Cel: Zdefiniowac typy odpowiedzi, ich znaczenie produktowe i oczekiwania UX dla `Chat v8`.

---

## 1. Po co istnieje ten dokument

W leader-grade chat product nie kazda odpowiedz jest "po prostu tekstem".
User musi rozumiec, czy dostal:
- zwykla odpowiedz,
- sourced answer,
- research answer,
- proposal,
- action-carrying response,
- artifact-oriented output.

---

## 2. Canonical response classes

Important distinction:
- `response class` opisuje to, jaki typ outputu user dostaje,
- `source class` opisuje, z czego AI korzystalo,
- `action state` opisuje, czy output prowadzi do governed action lifecycle.

Source-class details live in:
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`

### 2.1 General answer

Znaczenie:
- odpowiedz modelowa bez twardego source contract,
- moze korzystac z conversation i ogolnego kontekstu.

UX expectation:
- brak przymusu citations,
- wysoka klarownosc i szybki flow.

### 2.2 Workspace-grounded answer

Znaczenie:
- odpowiedz oparta o to, nad czym user pracuje w split/workspace context.

UX expectation:
- user wie, ze odpowiedz jest contextual,
- workspace influence jest zrozumialy.

### 2.3 Attachment-grounded answer

Znaczenie:
- odpowiedz oparta o aktywne pliki lub URL-ingested content.

UX expectation:
- sourcedness jest widoczna,
- citations i references sa uczciwie opisane.

### 2.4 Research answer

Znaczenie:
- odpowiedz z trybu research / web / deeper analysis.

UX expectation:
- wolniejsza, bardziej structured,
- bardziej reviewable,
- source expectations wyzsze niz dla zwyklej odpowiedzi.

### 2.5 Proposal response

Znaczenie:
- odpowiedz, ktora proponuje dzialanie albo draft.

UX expectation:
- jasno odrozniona od zwyklej answer,
- zawiera `what`, `why`, `target`, `next step`.

### 2.6 Action-carrying response

Znaczenie:
- odpowiedz powiazana z AI action lifecycle.

UX expectation:
- user widzi approval state,
- wie, czy cos juz zostalo wykonane, czy tylko czeka.

### 2.7 Artifact-oriented response

Znaczenie:
- odpowiedz gotowa lub prawie gotowa do zapisania jako artifact.

UX expectation:
- naturalny handoff do notes/tasks/decisions/ideas,
- jasny rezultat save action.

### 2.8 Rich structured response

Znaczenie:
- odpowiedz, ktora wymaga bogatszego renderingu niz plain prose,
- moze zawierac structured sections, code, tables, checklists, citations clusters lub exportable blocks.

UX expectation:
- rendering rules sa przewidywalne,
- user wie, co zostaje in-thread, a co powinno byc zapisane jako artifact.

---

## 3. Required response metadata

W miare mozliwosci runtime odpowiedz powinna miec metadata dla:
- `citations`
- `artifacts`
- `actions`
- `reasoning/thinking`
- `source class`
- `warnings or limitations`

Nie wszystko musi byc obecne zawsze.
Ale `v8` wymaga jednej prawdy co te pola znacza.

Normative rendering and metadata usage details live in:
- `CHAT_V8_RICH_OUTPUT_AND_RENDERING.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`

---

## 4. Streaming contract

Response model w `v8` zaklada streaming-first UX.

Required behaviors:
- partial chunks arrive progressively,
- user moze zatrzymac stream,
- end-of-stream jest jednoznaczny,
- errors i retries maja czytelny contract,
- advanced state events nie moga psuc prostoty zwyklej rozmowy.

---

## 5. Trust contract by response class

| Response class | Source expectation | Review expectation | Action expectation |
|---|---|---|---|
| General answer | low-explicit | low | none by default |
| Workspace-grounded answer | medium | medium | optional |
| Attachment-grounded answer | high | medium-high | optional |
| Research answer | high | high | optional |
| Proposal response | medium-high | high | explicit next step |
| Action-carrying response | high | very high | explicit approval state |
| Artifact-oriented response | high | high | explicit save semantics |
| Rich structured response | variable by source class | medium-high | depends on embedded proposal/action state |

---

## 6. UX requirements

- sourced answer powinien wygladac inaczej niz zwykla odpowiedz,
- proposal i action-carrying response nie moga byc mylone z neutral answer,
- message actions musza odpowiadac typowi odpowiedzi,
- response state should support follow-up, save, approve or inspect actions naturally.

Thread operations related to responses are defined in:
- `CHAT_V8_MESSAGE_AND_THREAD_OPERATIONS.md`

---

## 7. Anti-patterns

- every answer rendered as the same semantic object,
- proposal hidden inside plain prose,
- action state only in backend, not in visible UX,
- sourced answer without source meaning,
- research answer without stronger review discipline.

---

## 8. Definition of done

Response model jest domkniety, gdy:
- response classes sa jednoznaczne,
- metadata meaning jest stabilne,
- sourced, proposal and action responses sa wyraznie odroznione,
- streaming and trust semantics sa zrozumiale dla usera i zespolu.
