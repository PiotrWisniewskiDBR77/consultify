# S4 - Idea Suite Closeout

Stage id: `S4`

Stage goal: domknac Idea jako jeden workspace z czterema spojnymi narzedziami.

Target duration: 4-7 dni

In-scope modules:

- Idea - mind map
- Idea - process flow
- Idea - whiteboard
- Idea - tabela

---

## 1) Definition of Ready (DoR)

- [ ] S3 ma wynik `GO`.
- [ ] Kontrakty 4 modulow sa approved.
- [ ] Wymagania cross-tool handoff sa jawne.

---

## 2) Operational checklist

Per tool:

- [ ] Wejscie do narzedzia.
- [ ] Core create/edit/save workflow.
- [ ] Read-back i refresh persistence.
- [ ] Uczciwe stany empty/error/degraded.
- [ ] Brak raw internals.

Cross-tool:

- [ ] Kontekst nie ginie przy przejsciu miedzy narzedziami.
- [ ] Handoff artefaktow jest czytelny.
- [ ] AI actions sa osadzone w Menu 3.
- [ ] Brak duplikacji AI toolbarow.

---

## 3) Epics and tasks

## EPIC-S4-1 Workspace orchestration

- T1: Nawigacja i shell continuity.
- T2: Cross-tool context persistence.
- T3: Handoff artifact path.

## EPIC-S4-2 Mind map closure

- T1: Node operations stability.
- T2: Save/read-back integrity.
- T3: AI assist context safety.

## EPIC-S4-3 Process flow closure

- T1: Flow edit stability.
- T2: Quantitative overlays integrity.
- T3: Export/promotion continuity.

## EPIC-S4-4 Whiteboard closure

- T1: Workshop canvas stability.
- T2: Collaboration-safe behavior.
- T3: Artifact capture continuity.

## EPIC-S4-5 Idea tabela closure

- T1: Table interaction stability.
- T2: Relation/view consistency.
- T3: Save/read-back/export integrity.

---

## 4) Test checklist (S4)

### Technical gate

- [ ] API Gate for each tool.
- [ ] DB-Compat for critical saves.
- [ ] UI Smoke for each core path.

### Functional gate

- [ ] Mind map deep edit smoke.
- [ ] Process flow build smoke.
- [ ] Whiteboard session smoke.
- [ ] Idea tabela data smoke.

### Integration gate

- [ ] Cross-tool context handoff test.
- [ ] Artifact promotion test.
- [ ] Menu 3 AI placement audit.

### Manual evidence

- [ ] Anygravity focused retest for top risks.

---

## 5) Gate criteria

### GO

- Wszystkie 4 narzedzia: min. `PASS_WITH_P2`.
- Cross-tool handoff: `PASS`.
- Brak `BLOCKED_P1`.

### NO_GO

- Utrata danych/kontekstu przy przejsciu.
- Brak stabilnego save/read-back.
- Niezgodnosc z Menu 3 AI placement.

---

## 6) Required output artifact

`S4_IDEA_SUITE_INTEGRATION_PACK.md`:

1. tool-by-tool decision
2. cross-tool handoff evidence
3. UI/UX audit notes
4. residual risks

---

## 7) Sprint report template

1. Changes made
2. Validation performed
3. Gate result
4. Remaining risks
5. Next step
6. UI/UX gate decision

