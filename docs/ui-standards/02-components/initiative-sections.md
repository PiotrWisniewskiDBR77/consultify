# Initiative Sections — Karty inicjatywy N-mode

> **Lokalizacja:** `docs/ui-standards/02-components/initiative-sections.md`  
> **Źródło:** artifact-shell §8, §19

---

## Kanoniczna kolejność sekcji Initiative N-mode

1. Initiative Scope
2. Success Criteria
3. KPI
4. Financial Analysis
5. Financial Impact
6. Team
7. RACI
8. Resources
9. Dependencies
10. Risk & RAID
11. Milestones
12. Timeline
13. Tasks
14. Decisions
15. Gates
16. Technical Specification
17. Attachments
18. Comments
19. Activity Log

**Wyłączone z kanonicznej wersji:** Overview, Pilot, Watchers, Standalone Intelligence tab

---

## Template-driven visibility

- `visibleSections[key] = true` → mapped tab visible
- `visibleSections[key] = false` → mapped tab hidden
- Jeśli explicit `visibleSections` istnieje, jest źródłem prawdy
- Brak automatycznego "show all defaults" override

---

## Initiative unfinished cards redesign backlog (v1.9)

10 kart inicjatywy znormalizowanych dla N-mode rebuild:

1. **Success Criteria** (baseline)
2. **KPI**
3. **Financial Analysis**
4. **Financial Impact**
5. **Resources**
6. **Milestones**
7. **Risk & RAID**
8. **Timeline**
9. **Decisions**
10. **Gates**

### Common card shell

- Header title po lewej
- Header actions po prawej: `+ Add`/`+ New` (outlined/light), lokalny AI button
- Body: table/card surface z minimalnymi ramkami
- Empty state: zawsze canonical message + opcjonalny add CTA

### Decisions card — specjalna reguła

- Ergonomia jak task-table: `title`, `type`, `status`, `due`
- Row actions po prawej
- Top-right `+ New` dla manual creation
- Opcjonalna akcja AI generation

### Per-card shape

1. **Success Criteria** — 3 podkarty: Target State, Success Criteria, Deliverables. `+ Add item` lekka akcja tekstowa. AI na poziomie podkarty.
2. **KPI** — Tabela: name, unit, baseline, current, target. `+ New` otwiera inline form. KPI tracking continuity: KPI z Initiative musi być widoczny w Benefits.
3. **Financial Analysis** — CAPEX, OPEX, ROI, NPV, Payback. AI dla estimate.
4. **Financial Impact** — P&L + progress bar. AI dla impact narrative.
5. **Resources** — Budget + allocation list + chips. Manual add + AI proposal.
6. **Milestones** — Tabela: title, status, date. `+ New` tworzy milestone task.
7. **Risk & RAID** — RAID counters + row list. Manual add + AI risk discovery.
8. **Timeline** — Start/end, duration, quarter, progress bar. Overdue signal.
9. **Decisions** — Task-like table z row actions. Empty state z add CTA.
10. **Gates** — Gate timeline, readiness checklist, approval actions. AI tylko hints.

### Success Criteria card — baseline

- Header: tylko tytuł sekcji (bez AI na headerze)
- 3 stacked sub-cards: Target State, Success Criteria, Deliverables
- Sub-card: `+ Add item` lightweight text action.
- Checklist row: checkbox → tekst inline → delete na hover
