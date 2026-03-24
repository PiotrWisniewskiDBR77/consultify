# Chat v8 - Workflow model

> Status: Draft v8
> Cel: Zdefiniowac kanoniczny end-to-end workflow pracy z czatem, historia, retrieval, actions i workspace context.

---

## 1. Nadrzedny workflow produktu

Kanoniczny workflow `Chat v8` jest jeden:

`entry -> select or create conversation -> configure scope/modes -> ask -> stream -> inspect -> refine -> act/save -> revisit`

To jest glowny mental model usera.
Wszystkie dodatkowe capabilities maja wzmacniac ten workflow, a nie tworzyc konkurencyjne sciezki.

Important interpretation:
- `configure scope/modes` moze byc explicit albo implicit,
- user nie musi przechodzic przez osobny setup screen,
- ale produkt musi dawac mu zrozumienie aktywnego context, source classes i trybow zanim wysle pytanie.

---

## 2. Entry points

### 2.1 Full chat

User wchodzi do glownego chatu przez route full chat.
To jest miejsce dla:
- ogolnej rozmowy,
- dlugiego think/work session,
- revisit rozmow,
- file-grounded lub research-heavy flows.

### 2.2 Split chat

User pracuje w module lub artifact view i korzysta z chatu obok workspace content.
To jest miejsce dla:
- contextual assistance,
- question-answer while working,
- approve/reject actions,
- save to artifact flows.

### 2.3 Existing conversation revisit

User wraca przez historie:
- recent,
- pinned,
- folder-scoped,
- search result,
- archived.

---

## 3. Workflow stages

### 3.1 Stage A - Conversation selection

User:
- tworzy nowa rozmowe,
- wybiera istniejaca,
- wchodzi do folderu,
- wraca do archiwum lub pinned.

System:
- laduje conversation metadata i messages,
- zachowuje split/full context,
- nie gubi powiazania rozmowy z folderem ani project/business context.

### 3.2 Stage B - Scope and setup

Przed wyslaniem user powinien moc jawnie lub implicit zrozumiec:
- jaki jest workspace context,
- czy sa aktywne attachments,
- czy wlaczony jest web/research,
- czy dziala private mode,
- jaki jest tier/model/persona.

To nie musi byc zawsze osobny wizard.
Musi byc jednak czytelny product contract.

### 3.3 Stage C - Ask and stream

User wpisuje prompt albo dyktuje.
System:
- zapisuje user message,
- uruchamia stream,
- pokazuje thinking/progress tam, gdzie runtime to wspiera,
- zawsze daje `stop`,
- pokazuje blad i `retry` tam, gdzie to potrzebne.

### 3.4 Stage D - Inspect response

Po odpowiedzi user musi moc ocenic:
- czy odpowiedz jest dobra,
- czy ma zrodla / grounding,
- czy zawiera suggestion, action albo artifact,
- czy wymaga dalszego doprecyzowania.

### 3.5 Stage E - Refine

User moze:
- zadac follow-up,
- edytowac ostatni prompt lub zregenerowac odpowiedz tam, gdzie produkt to wspiera,
- rozwidlic watek lub porownac wariant odpowiedzi tam, gdzie produkt to wspiera,
- dopiac nowe attachments,
- wlaczyc inny mode,
- przejsc w research/deeper reasoning,
- porownac lub poprawic odpowiedz,
- skorzystac z feedback flow.

### 3.6 Stage F - Act or save

Jesli odpowiedz prowadzi do pracy, user moze:
- zapisac jako note,
- zapisac jako idea,
- zapisac jako decision/task/other artifact,
- zaakceptowac lub odrzucic AI action,
- przejsc do modulow roboczych.

### 3.7 Stage G - Revisit

Rozmowa wraca do historii i jest dalej odzyskiwalna przez:
- title,
- last message preview,
- search,
- folder,
- archive state,
- star/pin.

---

## 4. Specialized workflow variants

### 4.1 Grounded attachment flow

`entry -> add file or URL -> ingest -> ask grounded question -> inspect sourced answer -> continue or save`

Rules:
- ingestion state musi byc zrozumialy dla usera,
- scope grounded answer musi byc jawny,
- citations sa uczciwie opisane jako strong lub best-effort.

### 4.2 Deep research flow

`entry -> turn on deep research -> confirm understanding -> stream research -> inspect plan/findings -> continue`

Rules:
- deep research ma jawny confirm gate,
- user rozumie, ze to nie jest zwykly fast-answer path,
- research result musi byc reviewable i traceable.

### 4.3 Workspace co-working flow

`workspace view -> split chat -> ask contextual question -> get answer or action proposal -> approve/save -> continue working`

Rules:
- AI widzi to, co produkt deklaruje jako workspace context,
- split chat nie moze psuc core ask/stream experience,
- actions i save flows musza byc naturalna kontynuacja pracy.

### 4.4 Voice flow

`entry -> dictation or voice mode -> transcript -> send/stream -> hear response or continue`

Rules:
- user musi wiedziec, czy to dictation, continuous voice czy TTS,
- voice states maja byc czytelne,
- fallback behavior ma byc przewidywalny.

---

## 5. History and library workflow

Historia `Chat v8` nie jest tylko "sidebar".
To library workflow:

`all/recent -> pinned -> folder -> search -> archived -> open thread -> continue`

Required semantics:
- create in place,
- quick rename,
- pin/unpin,
- archive/unarchive,
- delete with intent,
- move between unassigned and folder,
- personal vs team folder understanding.

---

## 6. Action workflow

Kanoniczna sciezka AI actions:

`assistant proposes -> user reviews -> approve/reject -> execute or log state -> inspect audit trail`

Rules:
- propose state musi byc widoczny,
- approve/reject musi miec realny backend meaning,
- user nie moze zgadywac, czy approval tylko znaczy "approve" czy tez "execute".

---

## 7. Source and trust workflow

Chat `v8` musi jawnie rozroznic cztery glownie user-facing klasy odpowiedzi:
- general answer,
- workspace-grounded answer,
- attachment-grounded answer,
- web/research-grounded answer.

Pelna source taxonomy obejmuje dodatkowo:
- conversation history,
- organizational memory.

Te source classes sa opisane normatywnie w:
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`

User powinien wiedziec:
- skad odpowiedz przyszla,
- czy citations sa expected,
- czy answer jest policy-governed,
- czy odpowiedz moze prowadzic do wykonania akcji.

Related specs:
- `CHAT_V8_RESPONSE_MODEL.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `CHAT_V8_RICH_OUTPUT_AND_RENDERING.md`

---

## 8. Workflow anti-patterns to avoid

- dwa rozne produkty czatu dla full i split paths,
- ukryte focus/scope behavior,
- add-attachment UX bez realnego retrieval meaning,
- reviewless AI action execution,
- fake feedback/report flows,
- voice features obecne w kodzie, ale nieobecne w user-visible contract.
