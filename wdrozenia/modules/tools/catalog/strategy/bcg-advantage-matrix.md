# BCG Advantage Matrix

## Metadata

- **Tool name**: BCG Advantage Matrix
- **Slug**: `bcg-advantage-matrix`
- **Category**: Strategy
- **Level**: Advanced
- **Typical duration**: 60–180 minutes
- **Best for**: Matching strategy to the structure of advantage in an industry
- **Primary outputs**: quadrant classification, strategic implications, initiative themes
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31

---

## Purpose

The Advantage Matrix classifies industries by:\n- size of potential competitive advantage (small/large)\n- number of viable approaches to achieve advantage (few/many)\nleading to four contexts: **Volume**, **Specialized**, **Stalemated**, **Fragmented**.

---

## Method

1. Assess advantage size (scale economics, learning effects, network effects).\n2) Assess number of approaches (many ways to differentiate vs few).\n3) Place the business in the quadrant.\n4) Apply recommended strategic logic (scale vs specialization vs consolidation vs local differentiation).\n5) Convert into initiatives.

---

## 6. UI / Graphic specification

> Use the canonical 2-column layout from Tools: **left = workspace**, **right = control panel**.

### 6.1 Screens / views

**Workspace (left column, 65% width):**

- Setup and configuration
- Main analysis workspace
- Results visualization

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
- Color-coded elements for different states and categories
- Clear typography hierarchy (headings, body text, labels)
- Interactive elements with hover states and feedback

### 6.3 Interactions

**General interactions:**

- Click elements to edit inline or open detail modals
- Drag-and-drop to rearrange items
- Filter and sort tables
- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

**Specific interactions:**

- Add/edit/delete items with confirmation dialogs
- Bulk actions: select multiple items for batch operations
- Context menus: right-click for additional options
- Tooltips: hover over elements for additional information

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
- Empty: helpful prompts with examples and guidance

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

---

## 10. Consultant Report Specification (What goes into the final report)

### 10.1 Report Structure

The Bcg Advantage Matrix analysis should produce a structured consultant report with the following sections:

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
- **VO (PL)**: "BCG Advantage Matrix pomaga zaplanować transformację."
- **VO (EN)**: "BCG Advantage Matrix helps plan transformation."
- **On-screen text (PL)**: "BCG Advantage Matrix = Plan transformacji"
- **On-screen text (EN)**: "BCG Advantage Matrix = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij BCG Advantage Matrix już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start BCG Advantage Matrix today."
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
   A: 60–180 minutes

8. **What makes a good BCG Advantage Matrix analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, and actionable insights.

9. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data.

10. **How long does it typically take?**
    A: 60–180 minutes

11. **What makes a good BCG Advantage Matrix analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, and actionable insights.

### FAQ (at least 8)

1. **What is the main purpose of BCG Advantage Matrix?**
   A: BCG Advantage Matrix helps matching strategy to the structure of advantage in an industry.

2. **When should I use BCG Advantage Matrix?**
   A: Use it matching strategy to the structure of advantage in an industry.

3. **What are the key outputs?**
   A: Key outputs include quadrant classification, strategic implications, initiative themes.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good BCG Advantage Matrix analysis?**
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

- **Bcg Advantage Matrix Deep Dive**: `/knowledge-base/strategy/bcg-advantage-matrix`
- **Related Methods**: `/knowledge-base/methods/`
- **Examples**: `/knowledge-base/examples/`

### 13.2 External Learning Resources

**Official Sources:**

- Search for authoritative sources on Bcg Advantage Matrix

**Tutorials & Examples:**

- Search YouTube: "Bcg Advantage Matrix tutorial"
- Search YouTube: "Bcg Advantage Matrix example"

**Practice Tools:**

- [Miro Template](https://miro.com/templates/) — Collaborative workspace
- [Lucidchart Template](https://www.lucidchart.com/pages/templates/) — Diagramming tool

### 13.3 Related Tools in This Catalog

- Check related tools section in metadata

---

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
