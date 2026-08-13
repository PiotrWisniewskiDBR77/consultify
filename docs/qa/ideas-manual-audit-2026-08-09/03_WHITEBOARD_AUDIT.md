# Whiteboard manual audit

Status: **PASS AFTER REPAIRS, WITH FINDINGS**

## Pass A — controls and menus

- Toolbar: Create, Create options, Draw and More present.
- Right rail: Select/pan, AI, Templates, Sticky, Text, Shape, Draw, Frame, Undo/Redo present.
- Selection toolbar exposes font/size/bold/underline/colors/shape, align/distribute/group/ungroup states, Duplicate, Lock, Attach, Linked, Promote to decision/action and Delete.
- AI menu exposes Find themes, Name clusters, Extract action items, Convert to mind map and Convert to table.
- Detail panel exposes status, priority, owner, semantic type, notes/context/goal/rationale/risk, tags, AI context, evidence, artifacts, URL attachments, comments and AI history.
- Double-click + typing edits a sticky. Single click + typing does not; this is correct but not self-evident.
- PPM was opened through the accessibility `Show Menu` action. It exposes Edit/Duplicate/Copy/Layer/Lock/Delete, AI Expand/Challenge/Find evidence/Suggest connections, knowledge, Comments, Find themes/Name clusters/Extract actions. `Shift+F10`/arrow/Enter activation initially failed; shared menu keyboard handling was repaired and manual retest opened the dedicated Comments thread.

## Pass B — business scene from zero

Created 12 named notes for `Priorytetyzacja inicjatyw AI na następny kwartał` across value, feasibility and risk themes, plus additional notes, a shape and three frames/sections. Two sections were named `KLASTER WARTOŚĆ` and `KLASTER WYKONALNOŚĆ`; the third remained `SECTION`. Select-all nudge selected 22/23 elements; Align left, Distribute horizontally, Group and Ungroup worked. A grounded Find themes preview returned three proposals based on the actual whiteboard and was rejected safely. A comment on `Wartość: Predykcja churn` persisted after reopen.

Evidence: [whiteboard__scene__12-notes-three-clusters-before-reopen.png](screens/whiteboard__scene__12-notes-three-clusters-before-reopen.png), [whiteboard__ai__grounded-three-cluster-preview.png](screens/whiteboard__ai__grounded-three-cluster-preview.png), [whiteboard__comments__submitted.png](screens/whiteboard__comments__submitted.png), [whiteboard__comments__persisted-after-refresh.png](screens/whiteboard__comments__persisted-after-refresh.png), [whiteboard__persistence__three-clusters-after-reopen.png](screens/whiteboard__persistence__three-clusters-after-reopen.png)

### Chronological friction log

| Step | Result | Clicks / gesture | Assessment |
|---|---|---:|---|
| create and rename 12 notes | MOŻLIWE | ~60 | NATURALNE 2/5; rename requires select→double-click→textarea→Tab |
| create three frames/shapes | MOŻLIWE | 6+ | NATURALNE 3/5; third section rename failed |
| align/distribute/group/ungroup | MOŻLIWE | 6 | OPTYMALNE 4/5 once multi-select exists |
| lock/layer | MOŻLIWE | PPM keyboard | Bring to front executed; Lock changed PPM command to `Unlock`, then element was unlocked after proof |
| comment via PPM keyboard | MOŻLIWE after repair | 15 keys + type + send | NATURALNE 2/5 because Comments is deep in PPM |
| Find themes preview/reject | MOŻLIWE | 4 | grounded and safe; no mutation after Reject |
| four connections | MOŻLIWE after repair | 12 clicks | explicit Connect elements → source → target repeated four times; edge count 0→4 and reopen retained 4 |
| freehand draw | MOŻLIWE | Draw + drag | real stroke rendered and `Clear drawings` appeared |
| rail move/reset | MOŻLIWE after repair | click + Home | rail moved from right to left; Home reset it to right; screenshots prove both states |

| Criterion | Result | Reason |
|---|---|---|
| possible | YES | 12 notes, clusters, shapes/frames, four connections, drawing, alignment/group/layer/lock, comment, AI and persistence all work |
| natural | PARTIAL | direct creation is fast; newly created elements overlap heavily and naming requires undisclosed double-click |
| optimal | NO | no automatic spacing at insertion; many default `New note` values weaken AI input quality |

## Runtime defect and repair

Before repair, Find themes returned `Market Expansion Strategy`/DACH for a churn board. Root cause: the prompt included organization context without an explicit grounding priority. The backend prompt now requires every theme to be directly supported by current whiteboard elements and forbids unrelated project/history topics. Clean retest after rejecting old proposals returned only `New Notes` and `Visual Elements`; DACH disappeared.

Evidence: [whiteboard__ai__find-themes-retest.png](screens/whiteboard__ai__find-themes-retest.png)

## Findings

- `WB-P1-01` **repaired**: Find themes could prefer unrelated organization context over current board.
- `WB-P1-02`: fresh elements overlap at nearly the same position. Acceptance: successive additions are visibly offset or auto-arranged.
- `WB-P2-01`: `New note` remains until a double-click edit; add immediate inline edit or an explicit Rename action.
- `WB-P2-02`: AI honestly grounded after repair but can only return generic themes when most notes retain default labels; disable/coach AI until labels are meaningful.
- `WB-P1-03` **repaired**: added explicit `Connect elements` source→target flow. Four relations were created and persisted. Evidence: [whiteboard__scene__four-connections-after-repair.png](screens/whiteboard__scene__four-connections-after-repair.png), [whiteboard__persistence__four-connections-after-reopen.png](screens/whiteboard__persistence__four-connections-after-reopen.png).
- `WB-P1-04` **repaired for accessibility**: rail handle now supports click-to-switch-side, arrow-key movement and Home reset in addition to drag. Evidence: [whiteboard__rail__moved-click.png](screens/whiteboard__rail__moved-click.png), [whiteboard__rail__reset-home.png](screens/whiteboard__rail__reset-home.png).
- Freehand proof: [whiteboard__scene__freehand-drawing.png](screens/whiteboard__scene__freehand-drawing.png). Layer/lock proof: [whiteboard__layer-lock__applied.png](screens/whiteboard__layer-lock__applied.png).
- `SYS-P1-02` **repaired**: shared PPM ignored Enter/Space on the focused menuitem in the runtime bridge. Explicit activation was added with unit coverage; Comments opened by keyboard in retest.
