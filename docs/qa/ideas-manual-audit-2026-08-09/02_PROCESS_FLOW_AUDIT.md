# Process Flow manual audit

Status: **PASS AFTER REPAIR — complete complaint process, labelled decision branches and correction loop persisted**

## Pass A — controls and menus

- Modes: Classic Flow, Automation and Value Stream all switched without losing nodes. Value Stream exposed inventory/waiting-time semantics.
- Main toolbar: Start, End, Action, Decision, Lane, Insert, Split and More actions present. Start/End/Action/Decision/Lane were executed.
- Right rail: Select/pan, AI, Templates, Start/End, Action, Decision, Lane, Grid, Snap, Undo and Redo present. Grid/Snap show explicit on-state.
- Selection properties expose node type, label, lane, description, assignee, system, duration/unit, cost and FTE.
- AI menu exposes New AI conversation and Process analysis. Process analysis returned a Polish bottleneck insight grounded in `Negocjacje`.
- Undo became enabled after edits; disabled Redo state was honest.
- A visible `Connect` mode was added and runtime-tested as a keyboard/AX-operable source→target sequence. Decision connections receive deterministic `Yes`/`No` labels and a connection from `Korekta rozwiązania` receives `Correction loop`.
- Insert, Split, More actions children, drag/snap geometry and the full destructive PPM matrix: `NOT VERIFIED`.

Evidence: [process-flow__ai__bottleneck-analysis.png](screens/process-flow__ai__bottleneck-analysis.png)

## Pass B — business scene from zero

Built the required complaint flow with Start `Zgłoszenie reklamacji B2B`, End `Zamknięcie reklamacji`, actions `Rejestracja i nadanie numeru`, `Weryfikacja kompletności`, `Analiza zasadności reklamacji`, `Przygotowanie rozwiązania`, `Korekta rozwiązania`, and decisions `Czy dane są kompletne?`, `Czy klient akceptuje rozwiązanie?`. Three lanes were renamed `Klient / Account`, `Obsługa klienta`, `Zespół jakości`. Grid and Snap were toggled off/on; Auto arrange, Undo and Redo worked. After repair, both decisions received persisted `Yes`/`No` branches and `Korekta rozwiązania` was connected back to `Przygotowanie rozwiązania` with a persisted `Correction loop` label.

Evidence: [process-flow__scene__complaint-10-steps-3-lanes.png](screens/process-flow__scene__complaint-10-steps-3-lanes.png), [process-flow__persistence__complaint-after-reopen.png](screens/process-flow__persistence__complaint-after-reopen.png), [process-flow__scene__yes-no-correction-loop-after-repair.png](screenshots/process-flow__scene__yes-no-correction-loop-after-repair.png), [process-flow__persistence__yes-no-correction-loop-after-reopen.png](screenshots/process-flow__persistence__yes-no-correction-loop-after-reopen.png)

### Chronological friction log

| Step | Result | Clicks | Assessment |
|---|---|---:|---|
| create/rename Start, actions, decisions, End | MOŻLIWE | ~30 | NATURALNE 3/5; type semantics are visible but naming is a separate action |
| create and rename three lanes | MOŻLIWE | 9 | NATURALNE 2/5; default Lane names require later discovery |
| Grid/Snap off→on | MOŻLIWE | 4 | OPTYMALNE 4/5; on-state is explicit |
| Auto arrange → Undo → Redo | MOŻLIWE | 4 | OPTYMALNE 4/5 |
| label Yes/No edges and correction loop | MOŻLIWE AFTER REPAIR | 9 clicks for three source→target connections | NATURALNE 4/5; visible Connect mode gives explicit source and target feedback |
| save → refresh → reopen | MOŻLIWE | 3 | persistence PASS |

| Criterion | Result | Reason |
|---|---|---|
| possible | YES | required nodes, lanes, labelled branches and correction loop persist |
| natural | YES | add→Rename and Connect source→target are predictable; lane naming remains less discoverable |
| optimal | PARTIAL | toolbar and rail duplicate creation actions; useful for reach but visually redundant |

## Findings

- `PF-P2-01`: the same Start/End/Action/Decision/Lane actions appear in toolbar and rail without differentiated purpose. Keep one primary placement or explain rail as palette.
- `PF-P2-02`: lane creation defaults to `Lane 2/3`; immediate inline naming is missing.
- `PF-P3-01`: zoom reached 300% while the full scene remained difficult to read; add obvious Fit view near zoom.
- `PF-P1-02` (repaired): visible Connect mode now creates deterministic Yes/No branches and a labelled correction loop; all labels survived full reload.
