# Manager Fala 1 Canonical Execution Map

> Date: 2026-03-28
> Owner: Manager
> Status: canonical working authority
> Purpose: establish one manager-owned truth for Phase 1 scope, agent assignments, output files, supervision rules, and legacy agent-doc status

---

## 1. Authority

From this point forward, this file is the single managerial source of truth for Fala 1.

It overrides:

- ambiguous placeholder-based agent scopes,
- accidental overlap between earlier agent outputs,
- and any historical grouping that no longer matches the latest product decision.

If another document disagrees with this file on:

- which streams are active now,
- which streams are later,
- who owns which stream,
- or which agent output is canonical,

this file wins.

---

## 2. Canonical scope for Fala 1

The current active scope is not the older 10-phase grouping anymore.

The canonical active scope is the following 16 streams:

1. `Anna`
2. `Radar`
3. `Notatki`
4. `Kalendarz`
5. `Integracja`
6. `Ankiety`
7. `Wnioski w Interview`
8. `Inicjatywy (automatic AI)`
9. `Wdrozenia (management)`
10. `KPI`
11. `Finanse`
12. `Mind map`
13. `Whiteboard`
14. `Proces flow`
15. `Tabele (Airtable-like)`
16. `Teresa (contextual voice chat)`

This means:

- `Landing` as a broad area is not an active stream now; only `Anna` remains active.
- `Komunikacja` is moved later.
- `Tools / Assessment` are moved later.
- `Outputs / Documents / Presentations / Word / Excel / Sheet` remain outside this wave.

---

## 3. Parked for later

The following are explicitly not part of Fala 1 execution planning:

- `Landing` as a standalone broad redesign program
- `Komunikacja` as a separate product
- `Tools`
- `Assessment`
- `Help / Baza wiedzy`
- `Program partnerski`
- `Superadmin`
- `Outputs / Documents / Presentations / Excel / Sheet`
- `Agenci / KIMI / Prompty / Palantir`
- `Organization / Settings / Admin / Edukacja / Mobile`

These may still be referenced as dependencies, but no agent should absorb them into active scope.

---

## 4. Canonical agent split

### Agent 1

Owns:

- `Anna`
- `Radar`
- `Notatki`

Manager brief file:

- `docs/product/work-packets/MANAGER_FALA_1_AGENT_1_BRIEF_ANNA_RADAR_NOTES_2026-03-28.md`

### Agent 2

Owns:

- `Kalendarz`
- `Integracja`
- `Teresa`

Manager brief file:

- `docs/product/work-packets/MANAGER_FALA_1_AGENT_2_BRIEF_CALENDAR_INTEGRATION_TERESA_2026-03-28.md`

### Agent 3

Owns:

- `Ankiety`
- `Wnioski w Interview`

Manager brief file:

- `docs/product/work-packets/MANAGER_FALA_1_AGENT_3_BRIEF_SURVEYS_INTERVIEW_INSIGHTS_2026-03-28.md`

### Agent 4

Owns:

- `Inicjatywy`
- `Wdrozenia`
- `KPI`
- `Finanse`

Manager brief file:

- `docs/product/work-packets/MANAGER_FALA_1_AGENT_4_BRIEF_INITIATIVES_EXECUTION_KPI_FINANCE_2026-03-28.md`

### Agent 5

Owns:

- `Mind map`
- `Whiteboard`
- `Proces flow`
- `Tabele`

Manager brief file:

- `docs/product/work-packets/MANAGER_FALA_1_AGENT_5_BRIEF_MINDMAP_WHITEBOARD_PROCESS_TABLE_2026-03-28.md`

---

## 5. Shared standard

All five agents must follow:

- `docs/product/work-packets/MANAGER_FALA_1_AGENT_STANDARD_2026-03-28.md`

No agent may define its own:

- scope philosophy,
- acceptance standard,
- benchmark methodology,
- or delivery packet format.

---

## 6. Status of earlier agent outputs

The following documents remain useful as source material, but they are no longer the canonical execution plans for Fala 1:

| File | Status | Reason | Manager action |
| --- | --- | --- | --- |
| `docs/product/work-packets/AGENT_1_FALA_1_CORE_SURFACES_EXECUTION_PLAN.md` | `deprecated` | absorbed too much scope, overlaps with Agents 4 and 5, reconstructed scope from placeholders | keep as source only; do not use as active plan |
| `docs/product/work-packets/AGENT_2_INITIATIVES_EXECUTION_KPI_FINANCE_EXECUTION_PLAN.md` | `supporting` | strong content, but must now be governed by manager split and output format | use as source for Agent 4 |
| `docs/product/work-packets/AGENT_3_NOTES_CALENDAR_INTEGRATION_COMMUNICATION_EXECUTION_PLAN.md` | `supporting` | valuable for `Notatki`, `Kalendarz`, `Integracja`, but includes communication which is now parked | use as source for Agents 1 and 2 |
| `docs/product/work-packets/AGENT_4_IDEA_MINDMAP_EXECUTION_PLAN.md` | `supporting` | strong content, but must stay limited to `Idea / Mind map` and no longer define full wave truth | use as source for Agent 5 mind-map-adjacent reasoning |
| `docs/product/work-packets/AGENT_5_WHITEBOARD_PROCESS_FLOW_TABLE_EXECUTION_PLAN.md` | `supporting` | strong content and likely best source for canvas/table cluster, but not canonical alone | use as source for Agent 5 |

Rule:

- no one should execute directly from the old `AGENT_*_EXECUTION_PLAN.md` files anymore
- execution should proceed only from the new manager-governed briefs

---

## 7. Manager supervision workflow

### Step 1

Manager issues exactly five clean briefs.

### Step 2

Each agent returns one final markdown plan in the required format.

### Step 3

Manager reviews all five against:

- scope discipline,
- benchmark quality,
- product ambition,
- overlap,
- dependency realism,
- and bounded delivery quality.

### Step 4

Manager creates one merged implementation order document after receiving all five outputs.

### Step 5

Only then may execution planning or coding begin.

---

## 8. Non-negotiable supervision rules

The manager must reject any agent output that:

- silently widens scope,
- falls back to “screen exists, so module is okay,”
- avoids competitor comparison,
- blurs `now` with `later`,
- turns a bounded packet into a hidden new platform program,
- or does not define a testable minimal acceptance state.

The manager must also reject any agent output that:

- contradicts this split,
- pulls `Outputs` back into active Fala 1,
- or reintroduces `Komunikacja`, `Tools`, `Assessment`, `Help`, `Partner`, or `Superadmin` as active ownership without explicit promotion.

---

## 9. Next canonical files

The manager layer for Fala 1 consists of:

1. `docs/product/work-packets/MANAGER_FALA_1_CANONICAL_EXECUTION_MAP_2026-03-28.md`
2. `docs/product/work-packets/MANAGER_FALA_1_AGENT_STANDARD_2026-03-28.md`
3. `docs/product/work-packets/MANAGER_FALA_1_AGENT_1_BRIEF_ANNA_RADAR_NOTES_2026-03-28.md`
4. `docs/product/work-packets/MANAGER_FALA_1_AGENT_2_BRIEF_CALENDAR_INTEGRATION_TERESA_2026-03-28.md`
5. `docs/product/work-packets/MANAGER_FALA_1_AGENT_3_BRIEF_SURVEYS_INTERVIEW_INSIGHTS_2026-03-28.md`
6. `docs/product/work-packets/MANAGER_FALA_1_AGENT_4_BRIEF_INITIATIVES_EXECUTION_KPI_FINANCE_2026-03-28.md`
7. `docs/product/work-packets/MANAGER_FALA_1_AGENT_5_BRIEF_MINDMAP_WHITEBOARD_PROCESS_TABLE_2026-03-28.md`

These seven files together define the clean managerial layer.
