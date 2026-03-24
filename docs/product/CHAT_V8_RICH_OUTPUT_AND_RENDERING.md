# Chat v8 - Rich output and rendering

> Status: Draft v8
> Cel: Zdefiniowac, jak `Chat v8` renderuje bogatsze odpowiedzi i kiedy output pozostaje in-thread, a kiedy powinien przejsc do artifactu.

---

## 1. Po co istnieje ten dokument

Leader-grade chat nie sklada sie tylko z plain text.
User dostaje:
- markdown-like prose,
- lists,
- tables,
- code blocks,
- citations clusters,
- structured plans,
- action proposals,
- artifact-ready drafts.

Produkt musi wiedziec, jak to renderowac i jak odroznic od formalnego artifactu.

---

## 2. Nadrzedna zasada

Rich output ma zwiekszac czytelnosc i iteracyjnosc, a nie zastępowac artifact system bez zasad.

Jesli output powinien pozostac rozmowa, zostaje in-thread.
Jesli output staje sie trwalym obiektem pracy, powinien miec naturalny handoff do artifactu.

---

## 3. Rendering classes

### 3.1 Rich prose

Use case:
- structured answer,
- sections,
- lists,
- callouts,
- warnings.

### 3.2 Tabular output

Use case:
- porownania,
- matrices,
- structured summaries.

### 3.3 Code or structured block output

Use case:
- snippets,
- config examples,
- schema-like outputs.

### 3.4 Citation-heavy output

Use case:
- sourced answers,
- research summaries,
- multi-source comparison.

### 3.5 Artifact-ready block

Use case:
- note/task/decision draft,
- plan or memo ready for save/handoff.

---

## 4. In-thread vs artifact rule

### 4.1 Stay in thread

Output zostaje w rozmowie, gdy:
- sluzy do szybkiej iteracji,
- nie wymaga oddzielnego lifecycle,
- nie wymaga governance outside chat.

### 4.2 Move to artifact

Output powinien miec handoff do artifactu, gdy:
- ma stac sie trwała jednostka pracy,
- wymaga ownership / status / governance,
- ma byc dalej edytowany poza rozmowa,
- ma wejsc do procesu notatek, taskow, decyzji lub innych modulow.

---

## 5. UX requirements

- code, tables i structured blocks musza byc czytelne,
- copyability and inspectability musza byc przewidywalne,
- sourced output nie moze tracic source semantics przez rendering,
- proposal and action-carrying content musi zachowac approval semantics.

---

## 6. Download / copy / export semantics

Rich output powinien miec jasno opisane:
- co mozna skopiowac inline,
- co mozna zapisac jako artifact,
- co mozna eksportowac tylko przez oddzielny artifact flow,
- co nie jest w ogole exportable w v8 baseline.

---

## 7. Non-goals

`Chat v8` baseline nie implikuje:
- general-purpose sandbox,
- full canvas/app-builder inside the thread,
- dowolnych embedded editors bez lifecycle contracts.

Jesli cos przypomina artifact workspace, powinno miec wyrazny handoff lub byc sklasyfikowane jako extension.

---

## 8. Anti-patterns

- every rich output treated as plain prose,
- artifact-ready content bez handoff path,
- code/table rendering without copyability or structure,
- sourced output rendered without source meaning,
- rich output udajacy trwały artifact bez governance.

---

## 9. Definition of done

Rich output and rendering sa domkniete, gdy:
- rendering classes sa jednoznaczne,
- in-thread vs artifact boundary jest jasna,
- sourced and action-rich outputs zachowuja swoje semantics,
- product nie udaje sandbox parity, jesli go nie ma.

Related specs:
- `CHAT_V8_RESPONSE_MODEL.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `CHAT_V8_CONTROL_SURFACE_SPEC.md`
