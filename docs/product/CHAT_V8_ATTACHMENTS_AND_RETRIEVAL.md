# Chat v8 - Attachments and retrieval

> Status: Draft v8
> Cel: Zdefiniowac kanoniczny kontrakt dla files, URL ingest, cloud usage, retrieval scope i source transparency.

---

## 1. Zasada nadrzedna

`Chat v8` ma byc grounded tam, gdzie produkt to obiecuje.
Jednoczesnie ma byc uczciwy:
- nie kazdy answer ma sources,
- nie kazdy sourced answer ma perfect citations,
- nie kazdy source type jest equally mature.

---

## 2. Source classes

`Chat v8` rozroznia:
- `general model knowledge`
- `conversation history`
- `workspace context`
- `attachments`
- `web/research`
- `organizational memory`

User-facing product powinien umiec odroznic przynajmniej najwazniejsze klasy.

---

## 3. Local file contract

### 3.1 Baseline

Local file workflow:

`select file -> ingest -> receive docId -> attach to conversation context -> ask grounded question -> retrieve relevant chunks`

### 3.2 Requirements

- supported file types musza byc jawnie zdefiniowane,
- ingestion state musi byc widoczny,
- conversation context musi wiedziec, jakie `docIds` sa aktywne,
- grounded answer musi byc odroznialny od answer bez grounding.

### 3.3 Canonical truth

Local file ingest jest canonical baseline capability.

---

## 4. URL ingest contract

### 4.1 Baseline

URL workflow:

`add URL -> ingest page -> receive docId -> include in conversation retrieval scope`

### 4.2 Requirements

- URL ingest musi miec policy and safety rules,
- surface, ktora pokazuje URL add, nie moze potem ignorowac URL context,
- docs musza jasno mowic, czy behavior jest rowny we wszystkich shellach.

### 4.3 Canonical truth

URL ingest jest canonical capability, ale surface parity dzis jest niepelna.

---

## 5. Cloud source contract

### 5.1 Current reality

Cloud source usage ma dwa odrebne etapy:
- `connect provider`
- `browse or download file for chat use`

### 5.2 v8 rule

Nie wolno traktowac tych etapow jako jednej w pelni gotowej capability, jesli in-chat connect nie jest realny.

### 5.3 Canonical position

- `browse/download from already connected source` moze byc partial-supported,
- `in-chat connect/OAuth` nie jest canonical baseline, dopoki nie jest realny.

---

## 6. Retrieval contract

### 6.1 Retrieval scope

Gdy answer jest grounded on attachments, runtime powinien pracowac na:
- explicit `attachmentDocIds`,
- optional attachment metadata,
- current conversation context.

### 6.2 Retrieval behavior

System moze:
- uzyc vector + keyword retrieval,
- uzyc fallback when embeddings are missing,
- skladac source excerpts do promptu.

`v8` nie wymaga ujawniania calych technicznych szczegolow userowi, ale wymaga uczciwego modelu outcome.

### 6.3 Output expectations

Grounded answer powinien:
- trzymac sie aktywnych sources,
- unikac nieuzasadnionych twierdzen poza retrieval scope,
- sygnalizowac limits, gdy evidence jest slabe.

---

## 7. Citation and transparency contract

### 7.1 Strong rule

Jesli produkt pokazuje sources lub citations, user musi rozumiec ich znaczenie.

### 7.2 Best-effort rule

Jeśli runtime citations sa best-effort, docs i UX musza to powiedziec wprost.

### 7.3 Sourced answer rule

Sourced answer powinien byc odroznialny od:
- general answer,
- workspace answer,
- web answer.

---

## 8. Deep research and web retrieval

### 8.1 Deep research

Deep research to nie zwykly fast-answer mode.
To guided flow z confirm step i bardziej reviewable output.

### 8.2 Web search

Web/research musi byc jawnie odroznione od attachment retrieval.
User powinien rozumiec, czy answer opiera sie na:
- pliku,
- URL ingest,
- web search,
- general knowledge.

---

## 9. UX rules

- Add files menu moze pokazywac tylko te source types, ktore maja uczciwy runtime contract,
- recent attachments nie moga sugerowac full re-attach, jesli to tylko local memory hint,
- context and source UI musi wzmacniac trust, nie zgadywanie,
- shell parity ma znaczenie: to samo promise powinno znaczyc to samo w canonical surfaces.

---

## 10. Anti-patterns

- URL add visible, but silently ignored later,
- cloud connect wyglada jak complete feature, ale jest tylko pointer do settings,
- citations traktowane jak gwarancja mimo best-effort runtime,
- mieszanie attachment retrieval z web research bez odroznienia.

---

## 11. Definition of done

Attachments and retrieval sa domkniete, gdy:
- file, URL i cloud source semantics sa jawne,
- retrieval scope jest zrozumialy,
- source transparency jest uczciwa,
- sourced answer ma odrebny contract,
- docs nie overpromise'uja relative do runtime.
