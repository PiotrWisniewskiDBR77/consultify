# Demo Journey Redesign — "Showroom, not Onboarding"
**Date:** 2026-07-04 · **Owner decision pending (Piotr)** · **SSOT for the demo-experience rebuild**
**Trigger:** Piotr, after a live client meeting: *"To ma być sprzedażowe, a nie kłopotliwe. Lekkie, a nie ciężkie."*

---

## 1 · Diagnosis — how the demo formula works today (verified in code)

### The walkthrough board is theater
When anyone enters the demo, after 1.5 s a full-screen modal (`DemoWelcomeTour.tsx`, z-400) blocks the app:

| What the user sees | What actually happens |
|---|---|
| Persona picker (CEO / CTO / Consultant / Investor) — **mandatory** | Choice saved to `localStorage.demo_user_role` — **read by nothing, ever** |
| 7 "Guided scenarios" with promises ("Factory Operations · 10 min · Marc Dubois") | Choice saved to `localStorage.demo_story_scenario` — **read by nothing, ever**. `DemoScenario = {id,title,duration,audience,persona}` — no routes, no steps, no content (atelierToysDemoTemplate.ts:123) |
| "Start walkthrough" | Shows **the same 5 generic text slides** regardless of any choice (Dashboard → Assessment → Roadmap → Collaboration → Done). No navigation, no highlighting — just text + Next ×5 |
| "Skip tour" | Sets `demo_tour_skipped` — **checked by nothing** (DemoWelcomeTour.tsx:176-181 checks only `demo_tour_completed`). Session flags reset every 24 h ⇒ **skip = the board returns tomorrow**. The only permanent escape is sitting through all 5 slides |

### The rest of the chrome (workspace demo — what Piotr presents with)
- **Permanent floating card** bottom-left (`WorkspaceDemoNextSteps`) — no dismiss button; "Review the walkthrough" only scrolls to top. Covers content on every screen.
- **Two redundant banner layers**: `DemoModeBanner` (~60 px, org+stats+limitations+exit) AND `DemoTopbarStatus` pills (org+timer+AI/token+exit again).
- 🎉 gradient toast after the tour; session-warning modals at 1 h / 5 min / expiry.

### Sales demo adds (prospect exploring alone)
Up to **3 upgrade prompts** (5-min timer + "3 features explored" counter), **exit-intent modal**, persistent trial button, value-moment CTAs, signup modal. Modal stacking is possible.

### The friction chain (prospect → first real content)
signup → **forced persona choice** → **forced scenario choice** → 5 slides (or a skip that doesn't stick) → toast → dashboard with 100 px of demo chrome → first upgrade nag at minute 5. **~3–5 minutes and 8–10 decisions before any real data.** Meanwhile the actual product asset — the rich Atelier Forward story (22 initiatives, DRD 3.3, SWOT/Porter, €1.4M banked value, 17 deliverables) — sits behind all of it, unused as a guide.

**Verdict: the current formula optimizes for onboarding metrics, not for selling. It gates value instead of leading with it. And its centerpiece promise (guided scenarios) is fake.**

---

## 2 · Design principles

1. **First pixels = real data.** A demo's job is done in the first 10 seconds or never. No wall between entry and the money screen.
2. **The story is the guide.** We already built one coherent narrative (discovery → diagnosis → decision → execution → value). The demo journey should *be* that story — not slides about it.
3. **A rail, not a wall.** Guidance is a slim, dismissible strip that navigates to real screens. Dismiss once = gone forever.
4. **Sell at value peaks, not on timers.** CTAs appear when the user just saw something impressive (value-moment events already exist), and at the story's natural end. Never on a stopwatch.
5. **The presenter is not the prospect.** Piotr presenting live needs ZERO chrome; a prospect alone needs a light rail + conversion path. Two profiles, cleanly split by the existing `workspace_demo` / `sales_demo` types.

---

## 3 · Target journeys

### Journey A — Piotr presents live (`workspace_demo`, profile-menu toggle)
1. Toggle "Open Sample Workspace" → lands **directly on the chosen landing screen** (decision D1). No modal. No tour. Ever.
2. Chrome = **one slim pill row** in the topbar: `DEMO · Atelier Toys · [Exit]`. Nothing else. No floating cards, no prompts, no session-warning modals (24 h is irrelevant for a 40-min meeting).
3. Optional (hidden by default): a "Demo path" button in the pill row opens the story rail (same component as Journey B) if he ever wants on-screen prompts. Off unless clicked.

### Journey B — Prospect explores alone (`sales_demo`, landing/e-mail link)
1. Enters demo → lands **directly on the landing screen** with real data. No persona picker, no slides.
2. A **story rail** appears: one slim strip (top of content, ~40 px, dismissible ✕ forever):
   > **Atelier Forward — the 8-stop tour** · Stop 1/8: Discovery — five interviews became four insights · **[Next stop →]**
   Each stop = real route + one-line narration. Stops: Organization → Insights → DRD → SWOT/Porter → Initiatives (flagship Gantt) → Execution → Results&Finance (€1.4M banked) → Materials.
3. Scenario chips (optional, decision D3): instead of a blocking picker, the rail's first state offers 3 quick paths as chips — *Executive (8 min) · Operations (10 min) · Full story (15 min)* — clicking swaps the stop list. No choice required; default = Full story.
4. **Conversion:** value-moment CTAs stay (event-driven, good). At the final stop the rail itself becomes the close: *"That was Atelier's transformation. Want this for your company?"* **[Book 30 min] [Start trial]**. Kill the 5-minute timer prompt, the 3-features counter prompt, and the exit-intent modal (keep the analytics event).

### What gets KILLED (both journeys)
| Item | Why |
|---|---|
| `DemoWelcomeTour` (persona board + 5 slides) | Fake choices, generic slides, skip that doesn't stick |
| `WorkspaceDemoNextSteps` floating card | Permanent, non-dismissible, covers content, dead button |
| Time-based + feature-count upgrade prompts | Nagging on a stopwatch ≠ selling |
| Exit-intent modal | Intrusive; user already decided |
| `DemoModeBanner` 60 px layer | Redundant with topbar pills; fold "Limitations" into a small ⓘ popover on the pill |

### What gets BUILT
| Item | Effort | Notes |
|---|---|---|
| **StoryRail** component (strip + stops + next/prev + dismiss-forever + end-of-story CTA) | ~½ day | One component; no DOM-highlight engine needed |
| **Real scenario data**: extend `DemoScenario` with `stops: [{route, title, blurb}]` in seed template; 3 curated paths | ~½ day | Content from the existing run-sheet (docs/demo/ATELIER_CLIENT_DEMO_RUNSHEET.md) |
| **Landing redirect** on demo entry (decision D1) | ~1 h | |
| **Slim pill row** as the only chrome + ⓘ limitations popover | ~½ day | Reuse DemoTopbarStatus, delete DemoModeBanner |
| Journey-split logic (A: nothing; B: rail on) | trivial | `demoExperienceType` already exists |

Total: **~1.5–2 days** of build after decisions.

---

## 4 · Decisions for Piotr

- **D1 — Landing screen after demo entry:** Chat/Teresa hero ("Let's start your transformation") · **Results value dashboard (€1.4M banked)** ← CTO recommendation · Initiatives portfolio.
- **D2 — Scope:** kill-only first (deployable in hours, instantly lighter) vs. kill + StoryRail in one go (~2 days, complete new formula).
- **D3 — Scenario chips in the rail:** yes (3 curated paths) or single "Full story" path only.

## 5 · Success criteria
- Piotr's live flow: toggle → money screen in **≤ 5 s**, zero interruptions for the entire meeting.
- Prospect: real data on screen in **≤ 10 s**; guided story available in one click; one dismiss = silence forever; conversion CTA at the story end + value moments only.
- Nothing in the demo promises what it doesn't deliver.
