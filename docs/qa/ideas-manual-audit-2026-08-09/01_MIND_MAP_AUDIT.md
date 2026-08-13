# Mind Map manual audit

Status: **PASS AFTER REPAIR, WITH FINDINGS**

## Pass A — controls and menus

| Surface | Verified result | Assessment |
|---|---|---|
| Menu 1 | stage and save status live; Teresa, kebab and Convert open | sensible document scope; Convert kept separate correctly |
| Menu 3 — node | Add child, sibling, rename, font/size/style/color/shape/arrows, lock and more are present; Add child and sibling create nodes | dense but contextual; insertion is fast once selected |
| left inspector | Overview, Properties, Relations, AI, Activity, Tool open | `Tool` is a misleading name for appearance/settings; rename to Appearance |
| right rail | Select/pan, AI, Templates, Frame, Add node, Knowledge, Comments, Connect, Present, Import/Export, More tools, Undo/Redo present | Present and Import/Export duplicate document/view actions elsewhere |
| bottom bar | representation switcher, zoom −/%/+, overflow present | clear and compact |
| AI popover | node actions and generators exposed; Auto-clustering explicitly disabled/Coming soon | scope headings are useful; unavailable action is honest |
| keyboard | Tab/add child, Enter commit, F2 surface, Undo tested; browser-level Shift+F10 could not be isolated from macOS menu | unsupported paths are `NOT VERIFIED`, not passed |
| persistence | save indicator, full refresh, reopen and List→reopen retained the business map | PASS |

AI runtime: `Priority Recommender` pokazał preview z sortowaniem Rank/Impact/Effort dla treści mapy; wynik został zastosowany. Preview nie zmieniało danych przed `Apply priorities`. Dowody: [mind-map__ai__priority-preview.png](screens/mind-map__ai__priority-preview.png), [mind-map__ai__priorities-applied.png](screens/mind-map__ai__priorities-applied.png).

PPM węzła otworzyło 50 pozycji w grupach Edit, Structure, AI, Convert, Convert branch, Style & data. `Enter` po nawigacji strzałkami działa po naprawie wspólnego `CanvasContextMenu`. Menu jest funkcjonalne, ale przekracza rozsądny koszt skanowania; `Detect dependencies`, `Paste` i `Paste style` były jawnie disabled.

## Pass B — business scene from zero

Built from the audit record: `Jak zmniejszyć churn klientów B2B w ciągu 90 dni?` with branches `Symptomy`, `Hipotezy`, `Dowody`, `Segmenty klientów`, `Eksperymenty`, `Ryzyka`, plus third/fourth-level details. Five further named children were manually added: `Brak proaktywnego alertu ryzyka`, `NPS spadł o 12 punktów`, `Klienci enterprise bez onboardingu`, `Alert churn dla CSM`, `Fałszywie dodatnie alerty`. Runtime exposed 22 persisted edges and more than 18 content nodes. A comment on `Hipotezy` and an `Evidence` knowledge card were created. Reopen retained all five new labels.

Evidence: [mind-map__scene__churn-map-18plus-nodes.png](screens/mind-map__scene__churn-map-18plus-nodes.png), [mind-map__comments__hipothesis.png](screens/mind-map__comments__hipothesis.png), [mind-map__persistence__after-reopen.png](screens/mind-map__persistence__after-reopen.png)

### Chronological friction log

| Step | Result | Clicks / keys | Context loss | Assessment |
|---|---|---:|---|---|
| select branch → Add child → name → Enter | MOŻLIWE | 3 | no | NATURALNE 4/5; child vs sibling is explicit after selection |
| repeat across five branches | MOŻLIWE | 15 | no | OPTYMALNE 3/5; efficient but selection toolbar and rail duplicate insertion |
| PPM → AI Prioritize → Analyze → Apply | MOŻLIWE | 22 keyboard moves + 2 clicks | medium | NATURALNE 2/5; action is buried in a 50-item menu |
| Comments → type → submit | MOŻLIWE | 3 | no | NATURALNE 4/5 |
| Knowledge → Evidence card | MOŻLIWE | 2 | no | NATURALNE 3/5; creates an unlinked card named `Evidence` |
| cross-link two non-parent nodes | MOŻLIWE after repair | Connect + source + target, repeated | no | explicit two-click source→target flow; edge count 24→26 and persisted after reopen |
| save → URL reopen | MOŻLIWE | 3 | no | persistence PASS |

| Criterion | Result | Reason |
|---|---|---|
| possible | YES | hierarchy, 18+ nodes, comment, knowledge card, AI, two cross-links and persistence work |
| natural | PARTIAL | core insertion is quick; PPM and cross-link selection are not self-explanatory |
| optimal | NO | 50-item PPM, duplicate Present/export placement and ambiguous `Tool` inspector add choice cost |

## Findings

- `MM-P1-01`: mixed Add sibling/keyboard sequence can create two blank inline editors. Acceptance: one invocation creates exactly one sibling and one editor.
- `MM-P2-01`: Present appears in rail and More tools. Keep one canonical entry.
- `MM-P2-02`: Import/Export is document scope but occupies the creation rail. Move to Menu 1/overflow.
- `MM-P3-01`: rename left `Tool` to `Appearance`/`Style`.
- `MM-P1-03` **repaired**: Connect previously exposed pointer handles but node clicks only replaced selection. It now uses a visible source→target click sequence, confirms both stages, returns to Select, and persisted two required cross-links (24→26 edges). Evidence: [mind-map__scene__two-cross-links-after-repair.png](screens/mind-map__scene__two-cross-links-after-repair.png), [mind-map__persistence__two-cross-links-after-reopen.png](screens/mind-map__persistence__two-cross-links-after-reopen.png).
- Individual persistence for every font/color/shape permutation remains `NOT VERIFIED`; inventory records this per control rather than inferring from one save.
