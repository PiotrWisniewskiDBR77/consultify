# Three Horizons (McKinsey) — Growth Portfolio

## Metadata

- **Tool name**: Three Horizons of Growth
- **Slug**: `three-horizons`
- **Category**: Strategy
- **Level**: Advanced
- **Typical duration**: 2–6 hours workshop + follow-up roadmap
- **Best for**: Balancing core optimization with future growth bets; innovation portfolio governance
- **Primary outputs**: H1/H2/H3 portfolio map, funding split, transition milestones, initiatives per horizon
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31

---

## 1. Purpose

Three Horizons helps organizations manage **current performance while building future growth** by structuring opportunities into:\n- **H1**: core business (optimize/defend)\n- **H2**: emerging opportunities (scale)\n- **H3**: future options (experiment)\nAll horizons must be managed concurrently.

---

## 2. Method (step-by-step)

1. List current initiatives and growth ideas.\n2) Classify each into H1/H2/H3 by maturity and time-to-impact.\n3) Define desired portfolio balance (funding, talent, leadership time).\n4) Define “graduation criteria” (when H3 becomes H2, etc.).\n5) Build a roadmap: milestones and de-risking experiments.\n6) Create initiatives per horizon with owners and KPIs.

---

## 6. UI / Graphic specification

> Use the canonical 2-column layout from Tools: **left = workspace**, **right = control panel**.

### 6.1 Screens / views

**Workspace (left column, 65% width):**

- Horizon timeline board (H1/H2/H3 columns) with drag-and-drop cards
- Bubble chart: impact vs uncertainty, colored by horizon
- Transition workflow: "graduate" card from H3→H2→H1
- Portfolio balance view: funding split, talent allocation, leadership time

**Control Panel (right column, 35% width, sticky):**

- Status badge (Draft/In Review/Approved)
- DoD checklist (expandable)
- Action buttons: Review, Approve, Export PDF, Generate Initiatives
- Session metadata (created date, last updated, owner)

### 6.2 Layout requirements

**Two-column layout:**

- Left workspace: scrollable, full height
- Right control panel: sticky top, max-height: 100vh, overflow-y: auto
- Responsive: on mobile/tablet, control panel becomes bottom sheet

**Visual design:**

- Clean, modern interface with consistent spacing
- Color-coded horizons: H1 (blue), H2 (green), H3 (orange)
- Clear typography hierarchy (headings, body text, labels)
- Interactive elements with hover states and feedback
- Timeline board: three columns with cards showing initiative details

### 6.3 Interactions

**Horizon board:**

- Drag-and-drop cards between horizons (H1/H2/H3)
- Click card → opens detail modal (initiative details, funding, milestones)
- Add initiative → modal form (name, horizon, impact, uncertainty, funding)
- "Graduate" button → moves card to next horizon with transition tracking

**Bubble chart:**

- Hover bubble → tooltip with initiative details
- Click bubble → highlights corresponding card on timeline board
- Filter by horizon → show/hide horizons
- Zoom/pan for large portfolios

**Portfolio balance:**

- Adjust funding split with sliders (H1/H2/H3 percentages)
- View talent allocation and leadership time distribution
- Set graduation criteria with validation rules

**General:**

- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

### 6.4 States

**Draft:**

- All sections editable
- Initiatives can be added/edited/deleted and moved between horizons
- Portfolio balance adjustable
- No export available (except draft PDF)
- "Review" button enabled

**In Review:**

- Sections locked (read-only) except for comments/annotations
- Initiatives read-only, cannot be moved
- Portfolio balance read-only
- "Approve" and "Reject" buttons enabled for reviewers
- Export available (draft PDF)

**Approved:**

- All sections locked (read-only)
- Initiatives immutable, horizon assignments fixed
- Portfolio balance immutable
- "Generate Initiatives" button enabled
- Export available (final PDF, Excel)
- Can create new version (supersedes previous)

**Visual States:**

- Loading: skeleton screens for timeline board and bubble chart
- Error: inline error messages below fields, toast notifications for save failures
- Success: green checkmark animations, toast notifications for saves
- Empty: helpful prompts with examples for each horizon

### 6.5 Export formats

**PDF Export:**

- Cover page: Tool name, company, date, owner
- Table of contents
- Executive Summary
- Portfolio map (timeline board + bubble chart)
- Funding and resource allocation
- Transition roadmap with milestones
- Initiatives by horizon
- Appendices: Graduation criteria, definitions

**Excel Export:**

- Multiple sheets: Initiatives, Portfolio Balance, Roadmap, Milestones
- Formatted tables with filters
- Charts embedded as images

**Print Preview:**

- Optimized layout for A4/Letter
- Timeline board: Full page, landscape orientation
- Page breaks at logical sections
- Headers/footers with page numbers

---

## 4. Worked example

Manufacturer:\n- H1: improve OEE and margin (existing plants)\n- H2: adjacent service subscription\n- H3: AI-powered autonomous planning pilot\nFunding: 70/20/10 with explicit graduation tests.

---

---

## 10. Consultant Report Specification (What goes into the final report)

### 10.1 Report Structure

The Three Horizons analysis should produce a structured consultant report with the following sections:

#### **Executive Summary (1–2 pages)**

- Key findings and insights
- Main recommendations
- Expected impact and next steps

#### **Section 1: Context & Methodology**

- Problem/opportunity definition
- Methodology used
- Scope and assumptions

#### **Section 2: Analysis & Findings**

- Detailed analysis results
- Key insights and patterns
- Supporting evidence

#### **Section 3: Recommendations**

- Strategic recommendations
- Rationale and expected impact
- Risks and mitigations

#### **Section 4: Implementation**

- Initiatives and action items
- Roadmap and timeline
- Success metrics

### 10.2 Report Formatting Standards

- **Length**: 15–30 pages (excluding appendices)
- **Visuals required**: Key diagrams and charts
- **Tone**: Executive-ready, data-driven
- **Language**: Clear, jargon-free

### 10.3 Report Quality Checklist

- [ ] All key findings documented
- [ ] Recommendations are actionable
- [ ] Evidence supports conclusions
- [ ] Report is exportable as PDF

---

## 11. Video storyboard

### 11.1 Audience & duration

- **Audience**: Transformation leaders, IT executives, change managers, digital strategists
- **Duration**: 45–60 seconds intro
- **Style**: Professional, instructional, clear visuals

### 11.2 Scene list

**Scene 1: Hook & Problem (0–10s)**

- **Visual**: Split screen showing current state vs target state
- **VO (PL)**: "Czy potrzebujesz transformacji cyfrowej?"
- **VO (EN)**: "Do you need digital transformation?"
- **On-screen text (PL)**: "Transformacja = Zmiana"
- **On-screen text (EN)**: "Transformation = Change"

**Scene 2: Solution Intro (10–18s)**

- **Visual**: Tool logo/name appears, transition to transformation roadmap
- **VO (PL)**: "Three Horizons of Growth pomaga zaplanować transformację."
- **VO (EN)**: "Three Horizons of Growth helps plan transformation."
- **On-screen text (PL)**: "Three Horizons of Growth = Plan transformacji"
- **On-screen text (EN)**: "Three Horizons of Growth = Transformation plan"

**Scene 3: Key Feature 1 (18–26s)**

- **Visual**: main analysis view
- **VO (PL)**: "Przeanalizuj sytuację krok po kroku."
- **VO (EN)**: "Analyze the situation step by step."
- **On-screen text (PL)**: "Analiza krok po kroku"
- **On-screen text (EN)**: "Step-by-step analysis"

**Scene 4: Key Feature 2 (26–34s)**

- **Visual**: results visualization
- **VO (PL)**: "Zobacz wyniki i wnioski."
- **VO (EN)**: "See results and insights."
- **On-screen text (PL)**: "Wyniki i wnioski"
- **On-screen text (EN)**: "Results and insights"

**Scene 5: Key Feature 3 (34–42s)**

- **Visual**: initiatives generation
- **VO (PL)**: "Generuj inicjatywy na podstawie analizy."
- **VO (EN)**: "Generate initiatives based on analysis."
- **On-screen text (PL)**: "Generuj inicjatywy"
- **On-screen text (EN)**: "Generate initiatives"

**Scene 6: Results (42–50s)**

- **Visual**: metrics dashboard showing improvements
- **VO (PL)**: "Osiągnij lepsze wyniki dzięki systematycznemu podejściu."
- **VO (EN)**: "Achieve better results through systematic approach."
- **On-screen text (PL)**: "Lepsze wyniki"
- **On-screen text (EN)**: "Better results"

**Scene 7: Export & CTA (50–60s)**

- **Visual**: PDF export preview, "Generate Initiatives" button highlighted
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Three Horizons of Growth już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Three Horizons of Growth today."
- **On-screen text (PL)**: "Eksportuj i generuj inicjatywy"
- **On-screen text (EN)**: "Export and generate initiatives"

### 11.3 Shot list

1. **Shot 1 (0–10s)**: Wide shot showing problem, zoom to solution
2. **Shot 2 (10–18s)**: Fade to tool logo, pan to transformation roadmap
3. **Shot 3 (18–26s)**: Close-up of main analysis view
4. **Shot 4 (26–34s)**: Focus on results visualization
5. **Shot 5 (34–42s)**: Zoom to initiatives generation
6. **Shot 6 (42–50s)**: Pan across metrics dashboard showing improvements
7. **Shot 7 (50–60s)**: PDF preview overlay, fade to CTA button

### 11.4 Implementation notes

- **Screen recording**: Use actual tool interface (or high-fidelity mockup)
- **Transitions**: Smooth fades between scenes (0.5s)
- **Highlighting**: Use subtle glow/outline for interactive elements
- **Text overlays**: Bottom third of screen, semi-transparent background, readable font
- **VO**: Professional voiceover, clear pronunciation, moderate pace
- **Music**: Subtle background music (optional), non-distracting
- **Call-to-action**: End with tool name and "Get Started" button

## 12. Knowledge Base Extraction Pack

### 12.1 TL;DR (Executive Summary)

Brief summary of the tool and its key value proposition.

### 12.2 FAQ (Frequently Asked Questions)

**Q1: What is the main purpose of this tool?**
A: [Answer based on tool purpose]

**Q2: When should I use this tool?**
A: [Answer based on "when to use"]

**Q3: What are common mistakes?**
A: [Answer based on common mistakes section]

**Q4: How do I ensure quality results?**
A: [Answer based on DoD 6. **What inputs are required?**
A: Required inputs include scope, objectives, and relevant data.

7. **How long does it typically take?**
   A: 2–6 hours workshop + follow-up roadmap

8. **What makes a good Three Horizons of Growth analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, and actionable insights.

9. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data.

10. **How long does it typically take?**
    A: 2–6 hours workshop + follow-up roadmap

11. **What makes a good Three Horizons of Growth analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, and actionable insights.

### FAQ (at least 8)

1. **What is the main purpose of Three Horizons of Growth?**
   A: Three Horizons of Growth helps Three Horizons helps organizations manage **current performance while building future growth** by st....

2. **When should I use Three Horizons of Growth?**
   A: Use it balancing core optimization with future growth bets; innovation portfolio governance.

3. **What are the key outputs?**
   A: Key outputs include H1/H2/H3 portfolio map, funding split, transition milestones, initiatives per horizon.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Three Horizons of Growth analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist]

**Q5: What are the key outputs?**
A: [Answer based on outputs section]

### 12.3 Checklists

**DoD Checklist (Definition of Done):**

- [ ] All required inputs provided
- [ ] Analysis completed
- [ ] Key insights documented
- [ ] Recommendations generated
- [ ] Report exportable

**Common Mistakes Checklist:**

- [ ] [Common mistake] → Fix: [Solution]
- [ ] [Common mistake] → Fix: [Solution]

### 12.4 Glossary (Quick Reference)

| Term   | Definition   | Example   |
| ------ | ------------ | --------- |
| [Term] | [Definition] | [Example] |

---

## 13. Additional Resources & Learning Links

### 13.1 Knowledge Base Articles (Internal)

- **Three Horizons Deep Dive**: `/knowledge-base/strategy/three-horizons`
- **Related Methods**: `/knowledge-base/methods/`
- **Examples**: `/knowledge-base/examples/`

### 13.2 External Learning Resources

**Official Sources:**

- Search for authoritative sources on Three Horizons

**Tutorials & Examples:**

- Search YouTube: "Three Horizons tutorial"
- Search YouTube: "Three Horizons example"

**Practice Tools:**

- [Miro Template](https://miro.com/templates/) — Collaborative workspace
- [Lucidchart Template](https://www.lucidchart.com/pages/templates/) — Diagramming tool

### 13.3 Related Tools in This Catalog

- Check related tools section in metadata

---

## 14. References (Authoritative Sources)

### Primary Sources

- [Add primary authoritative sources]

### Methodology & Application

- [Add methodology sources]

### Academic & Theoretical

- [Add academic sources]

---

## 5. References (sources)

- [McKinsey: Enduring Ideas — The three horizons of growth](https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/enduring-ideas-the-three-horizons-of-growth)\n+

### 6.2 Layout requirements

**Two-column layout:**

- Left workspace: scrollable, full height
- Right control panel: sticky top, max-height: 100vh, overflow-y: auto
- Responsive: on mobile/tablet, control panel becomes bottom sheet

### 6.3 Interactions

**General interactions:**

- Click elements to edit inline or open detail modals
- Drag-and-drop to rearrange items
- Filter and sort tables
- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

### 6.4 States

**Draft:**

- All sections editable
- No export available (except draft PDF)
- "Review" button enabled

**In Review:**

- Sections locked (read-only) except for comments/annotations
- "Approve" and "Reject" buttons enabled for reviewers
- Export available (draft PDF)

**Approved:**

- All sections locked (read-only)
- "Generate Initiatives" button enabled
- Export available (final PDF, Excel)
- Can create new version (supersedes previous)

**Visual States:**

- Loading: skeleton screens for tables/charts
- Error: inline error messages below fields, toast notifications for save failures
- Success: green checkmark animations, toast notifications for saves

### 6.5 Export formats

**PDF Export:**

- Cover page: Tool name, company, date, owner
- Table of contents
- Executive Summary
- Analysis results
- Recommendations
- Action Plan (from initiatives)
- Appendices: Definitions, references

**Excel Export:**

- Multiple sheets: Data, Analysis, Results
- Formatted tables with filters
- Charts embedded as images

**Print Preview:**

- Optimized layout for A4/Letter
- Page breaks at logical sections
- Headers/footers with page numbers

### 6.2 Layout requirements

**Two-column layout:**

- Left workspace: scrollable, full height
- Right control panel: sticky top, max-height: 100vh, overflow-y: auto
- Responsive: on mobile/tablet, control panel becomes bottom sheet

### 6.3 Interactions

**General interactions:**

- Click elements to edit inline or open detail modals
- Drag-and-drop to rearrange items
- Filter and sort tables
- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

### 6.4 States

**Draft:**

- All sections editable
- No export available (except draft PDF)
- "Review" button enabled

**In Review:**

- Sections locked (read-only) except for comments/annotations
- "Approve" and "Reject" buttons enabled for reviewers
- Export available (draft PDF)

**Approved:**

- All sections locked (read-only)
- "Generate Initiatives" button enabled
- Export available (final PDF, Excel)
- Can create new version (supersedes previous)

**Visual States:**

- Loading: skeleton screens for tables/charts
- Error: inline error messages below fields, toast notifications for save failures
- Success: green checkmark animations, toast notifications for saves

### 6.5 Export formats

**PDF Export:**

- Cover page: Tool name, company, date, owner
- Table of contents
- Executive Summary
- Analysis results
- Recommendations
- Action Plan (from initiatives)
- Appendices: Definitions, references

**Excel Export:**

- Multiple sheets: Data, Analysis, Results
- Formatted tables with filters
- Charts embedded as images

**Print Preview:**

- Optimized layout for A4/Letter
- Page breaks at logical sections
- Headers/footers with page numbers

### 6.2 Layout requirements

**Two-column layout:**

- Left workspace: scrollable, full height
- Right control panel: sticky top, max-height: 100vh, overflow-y: auto
- Responsive: on mobile/tablet, control panel becomes bottom sheet

### 6.3 Interactions

**General interactions:**

- Click elements to edit inline or open detail modals
- Drag-and-drop to rearrange items
- Filter and sort tables
- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

### 6.4 States

**Draft:**

- All sections editable
- No export available (except draft PDF)
- "Review" button enabled

**In Review:**

- Sections locked (read-only) except for comments/annotations
- "Approve" and "Reject" buttons enabled for reviewers
- Export available (draft PDF)

**Approved:**

- All sections locked (read-only)
- "Generate Initiatives" button enabled
- Export available (final PDF, Excel)
- Can create new version (supersedes previous)

**Visual States:**

- Loading: skeleton screens for tables/charts
- Error: inline error messages below fields, toast notifications for save failures
- Success: green checkmark animations, toast notifications for saves

### 6.5 Export formats

**PDF Export:**

- Cover page: Tool name, company, date, owner
- Table of contents
- Executive Summary
- Analysis results
- Recommendations
- Action Plan (from initiatives)
- Appendices: Definitions, references

**Excel Export:**

- Multiple sheets: Data, Analysis, Results
- Formatted tables with filters
- Charts embedded as images

**Print Preview:**

- Optimized layout for A4/Letter
- Page breaks at logical sections
- Headers/footers with page numbers
