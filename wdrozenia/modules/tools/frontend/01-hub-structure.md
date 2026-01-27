# Tools - Hub Structure

## Cel
Opisac strukture UI modulu Tools (landing + workspace) i spojnosc z Golden Standard.

## Zrodla
- Plan: `wdrozenia/plan-tools-initiatives.md`
- Audyt: `wdrozenia/ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md`
- UI/UX: `wdrozenia/UI_UX_GOLDEN_STANDARD.md`
- Kod: `src/components/Discovery/DiscoveryToolsHub.tsx`

---

## Architektura UI

### Glowne komponenty

```
DiscoveryToolsHub
├── ModuleHub (shared component)
│   ├── Tabs: Discovery | Reports | Initiatives
│   ├── Category Buttons: Strategy | Operations | Digital | Process Auto
│   ├── Search + View Mode Toggle
│   └── Filter Chips
├── FilterableTable / GridView
├── ToolWorkspace (when document active)
└── Tool Selection Modal
```

### Hierarchia komponentow

```
src/components/Discovery/
├── DiscoveryToolsHub.tsx          # Main hub container
├── DiscoveryToolsView.tsx         # Landing page with categories
└── StrategicToolsView.tsx         # Strategic tools list

src/components/DiscoveryTools/
├── ToolWorkspace.tsx              # Main workspace container
├── ToolHeader.tsx                 # Top bar with status, progress, actions
├── ToolCanvas.tsx                 # Main content area with sections
├── ToolContextPanel.tsx           # Right sidebar with context
├── ToolReviewPanel.tsx            # Review mode panel
├── ToolActionBar.tsx              # Bottom action bar
├── InlineAssist.tsx               # AI micro-suggestions
├── GenerateInitiativesModal.tsx   # Initiative generation modal
└── tools/
    ├── DynamicSWOT/
    │   ├── SWOTCanvas.tsx
    │   ├── SWOTQuadrant.tsx
    │   └── SWOTCorrelations.tsx
    ├── MarketForces/
    │   ├── PorterCanvas.tsx
    │   └── ForceCard.tsx
    ├── GrowthPaths/
    │   ├── AnsoffMatrix.tsx
    │   └── GrowthOption.tsx
    ├── PortfolioPriority/
    │   ├── BCGMatrix.tsx
    │   └── ProductCard.tsx
    └── RiskUncertainty/
        ├── RiskMatrix.tsx
        └── RiskItem.tsx
```

---

## Zakladki (Tabs)

| Tab | Ikona | Opis | Dane | Licznik |
|-----|-------|------|------|---------|
| Discovery | Target | Sesje w trakcie pracy | DRAFT, REVIEW | 12 |
| Reports | FileText | Zakonczone analizy | APPROVED, COMPLETED | 8 |
| Initiatives | Lightbulb | Wygenerowane inicjatywy | DRAFT initiatives | 23 |

### Przyklad danych dla kazdej zakladki

**Discovery Tab:**
| Name | Type | Status | Progress | Updated |
|------|------|--------|----------|---------|
| SWOT Analysis - Manufacturing | Dynamic SWOT | DRAFT | 75% | 2h ago |
| Porter Analysis - EU Market | Market Forces | REVIEW | 100% | 1d ago |
| Growth Strategy - APAC | Growth Paths | DRAFT | 45% | 3h ago |
| BCG Matrix - Products Q1 | Portfolio Priority | DRAFT | 60% | 5h ago |
| Risk Assessment - Digital | Risk & Uncertainty | REVIEW | 100% | 2d ago |

**Reports Tab:**
| Name | Type | Completed | Initiatives | Rating |
|------|------|-----------|-------------|--------|
| SWOT Analysis - Q4 2025 | Dynamic SWOT | Jan 15 | 5 generated | ★★★★☆ |
| Porter Analysis - NA Market | Market Forces | Jan 10 | 3 generated | ★★★★★ |
| Growth Strategy - EMEA | Growth Paths | Dec 20 | 4 generated | ★★★☆☆ |

**Initiatives Tab:**
| Title | Source | Category | Priority | Status |
|-------|--------|----------|----------|--------|
| Implement lean manufacturing | SWOT Q4 | Strategy | P1 | DRAFT |
| APAC market expansion | Growth EMEA | Strategy | P1 | IN_PROGRESS |
| Green technology program | SWOT Q4 | Strategy | P2 | DRAFT |
| Workforce upskilling | Porter NA | Operations | P2 | APPROVED |

---

## Przyciski kategorii

| Kategoria | Ikona | Kolor | Liczba narzedzi | Opis |
|-----------|-------|-------|-----------------|------|
| Strategy | Target | Emerald | 10 | Narzedzia strategiczne |
| Operations | Settings | Blue | 10 | Narzedzia operacyjne |
| Digital | Cpu | Purple | 10 | Narzedzia cyfrowe |
| Process Auto | Zap | Amber | 1 | Automatyzacja procesow |

### Narzedzia w kazdej kategorii

**Strategy (10):**
| ID | Name | Status | Description |
|----|------|--------|-------------|
| dynamic-swot | Dynamic SWOT | Active | AI-driven SWOT analysis |
| market-forces | Market Forces (Porter) | Active | 5 forces competitive analysis |
| growth-paths | Growth Paths (Ansoff) | Active | Market/product expansion |
| portfolio-priority | Portfolio Priority (BCG) | Active | Product portfolio matrix |
| risk-uncertainty | Risk & Uncertainty | Active | Risk assessment matrix |
| value-chain | Value Chain | Coming Soon | Value chain analysis |
| ambition-decomposer | Ambition Decomposer | Coming Soon | Strategic ambition breakdown |
| focus-tradeoff | Focus & Trade-off | Coming Soon | Strategic focus analysis |
| capability-mapper | Capability Mapper | Coming Soon | Organizational capabilities |
| narrative-engine | Narrative Engine | Coming Soon | Strategic storytelling |

**Operations (10):**
| ID | Name | Status | Description |
|----|------|--------|-------------|
| vsm-builder | VSM Builder | Coming Soon | Value stream mapping |
| sop-builder | SOP Builder | Coming Soon | Standard operating procedures |
| a3-problem | A3 Problem Solving | Coming Soon | Lean problem solving |
| smed-planner | SMED Planner | Coming Soon | Quick changeover planning |
| dms-builder | DMS Builder | Coming Soon | Daily management system |
| automation-pipeline | Automation Pipeline | Coming Soon | Process automation |
| constraint-control | Constraint Control | Coming Soon | Theory of constraints |
| decision-engine | Decision Engine | Coming Soon | Decision support system |
| control-tower | Control Tower | Coming Soon | Operations monitoring |
| inventory-autopilot | Inventory Autopilot | Coming Soon | Inventory optimization |

**Digital (10):**
| ID | Name | Status | Description |
|----|------|--------|-------------|
| robotics-feasibility | Robotics Feasibility | Coming Soon | Robotics assessment |
| logistics-automation | Logistics Automation | Coming Soon | Logistics optimization |
| rpa-scanner | RPA Scanner | Coming Soon | RPA opportunity finder |
| ai-discovery | AI Discovery | Coming Soon | AI use case discovery |
| integration-diagnostic | Integration Diagnostic | Coming Soon | System integration |
| digital-value-pool | Digital Value Pool | Coming Soon | Digital value assessment |
| legacy-analyzer | Legacy Analyzer | Coming Soon | Legacy system analysis |
| data-inventory | Data Inventory | Coming Soon | Data asset mapping |
| pain-to-solution | Pain-to-Solution | Coming Soon | Problem-solution mapping |
| pain-explorer | Pain Explorer | Coming Soon | Pain point discovery |

**Process Auto (1):**
| ID | Name | Status | Description |
|----|------|--------|-------------|
| process-automation-builder | Process Automation Builder | Coming Soon | End-to-end automation |

---

## Widoki

### Table View (domyslny)

| Kolumna | Szerokosc | Sortowalna | Opis |
|---------|-----------|------------|------|
| Type | 120px | Tak | Badge + ikona kategorii |
| Name | flex | Tak | Nazwa sesji |
| Category | 100px | Tak | Kategoria narzedzia |
| Status | 100px | Tak | Badge statusu |
| Progress | 120px | Tak | Progress bar |
| Updated | 100px | Tak | Data aktualizacji |
| Actions | 80px | Nie | Menu kontekstowe |

### Grid View

Karty 280x200px z:
- Ikona typu (48x48)
- Nazwa (max 2 linie)
- Status badge
- Progress bar z procentem
- Data aktualizacji
- Quick actions (Edit, Delete)

---

## Tool Selection Modal

Po kliknieciu kategorii:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Strategy Tools                                                         [X] │
│  10 tools available                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🎯 Dynamic SWOT                                              [Start] │   │
│  │    AI-driven SWOT analysis with correlations                        │   │
│  │    ★★★★★ Most popular · 156 sessions created                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📊 Market Forces (Porter)                                    [Start] │   │
│  │    5 forces competitive analysis                                    │   │
│  │    ★★★★☆ Popular · 89 sessions created                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📈 Growth Paths (Ansoff)                                     [Start] │   │
│  │    Market/product expansion matrix                                  │   │
│  │    ★★★★☆ Popular · 67 sessions created                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🔲 Portfolio Priority (BCG)                                  [Start] │   │
│  │    Product portfolio matrix                                         │   │
│  │    ★★★☆☆ · 45 sessions created                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ⚠️ Risk & Uncertainty                                        [Start] │   │
│  │    Risk assessment matrix                                           │   │
│  │    ★★★☆☆ · 34 sessions created                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ── Coming Soon ──────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🔗 Value Chain                                               [Soon]  │   │
│  │    Value chain analysis                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🎯 Ambition Decomposer                                       [Soon]  │   │
│  │    Strategic ambition breakdown                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Cancel]                                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ToolWorkspace

Gdy uzytkownik wybierze narzedzie, otwiera sie `ToolWorkspace`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [← Back to Hub]                                                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🎯 Dynamic SWOT                                                     │   │
│  │  SWOT Analysis - Manufacturing Division                              │   │
│  │                                                                      │   │
│  │  [DRAFT]  ████████████░░░░ 75%  Confidence: 4/5                      │   │
│  │                                                                      │   │
│  │  Step 1: Context > Step 2: SWOT > Step 3: Correlations > Step 4: Review │
│  │                                                                      │   │
│  │  [💡 Help]  [📥 Export]  [📤 Import]  [Request Review]               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────┐  ┌───────────────────────┐  │
│  │                                           │  │  Context Panel        │  │
│  │     Tool Canvas                           │  │  ─────────────────    │  │
│  │     (sekcje narzedzia)                    │  │                       │  │
│  │                                           │  │  Organization         │  │
│  │  ┌─────────────────────────────────────┐  │  │  Acme Corporation     │  │
│  │  │ Strategic Context                   │  │  │  Manufacturing        │  │
│  │  │ Goal: Identify opportunities...     │  │  │  Enterprise (5000+)   │  │
│  │  │ Scope: European facilities          │  │  │                       │  │
│  │  │ Timeframe: Q1-Q2 2026               │  │  │  ─────────────────    │  │
│  │  └─────────────────────────────────────┘  │  │                       │  │
│  │                                           │  │  Completion           │  │
│  │  ┌─────────────────────────────────────┐  │  │  ████████████░░ 75%   │  │
│  │  │ SWOT Matrix                         │  │  │                       │  │
│  │  │ ┌─────────┬─────────┐               │  │  │  ✓ Context defined    │  │
│  │  │ │ S (5)   │ W (3)   │               │  │  │  ✓ Strengths (5)      │  │
│  │  │ │ ████    │ ███     │               │  │  │  ✓ Weaknesses (3)     │  │
│  │  │ ├─────────┼─────────┤               │  │  │  ○ Opportunities (0)  │  │
│  │  │ │ O (2)   │ T (2)   │               │  │  │  ○ Threats (0)        │  │
│  │  │ │ ██      │ ██      │               │  │  │  ○ Correlations (0)   │  │
│  │  │ └─────────┴─────────┘               │  │  │                       │  │
│  │  └─────────────────────────────────────┘  │  │  Confidence: 3.5/5    │  │
│  │                                           │  │  ████████░░           │  │
│  │  ┌─────────────────────────────────────┐  │  │                       │  │
│  │  │ Correlations                        │  │  │  ─────────────────    │  │
│  │  │ No correlations yet                 │  │  │                       │  │
│  │  │ [+ Add correlation]                 │  │  │  AI Assist            │  │
│  │  └─────────────────────────────────────┘  │  │  [💬 Open Chat]       │  │
│  │                                           │  │                       │  │
│  │                                           │  │  Suggestions:         │  │
│  │                                           │  │  • Add opportunities  │  │
│  │                                           │  │  • Define threats     │  │
│  │                                           │  │  • Create correlations│  │
│  │                                           │  │                       │  │
│  │                                           │  │  ─────────────────    │  │
│  │                                           │  │                       │  │
│  │                                           │  │  Generated (0)        │  │
│  │                                           │  │  No initiatives yet   │  │
│  │                                           │  │                       │  │
│  │                                           │  │  Recent (5)           │  │
│  │                                           │  │  • Lean manufacturing │  │
│  │                                           │  │  • APAC expansion     │  │
│  │                                           │  │  • Green tech program │  │
│  │                                           │  │  • Workforce training │  │
│  │                                           │  │  • Supply chain div.  │  │
│  └───────────────────────────────────────────┘  └───────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [← Prev]  [💡 Get Suggestions] [🔄 Generate Analysis]  [Next →]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Review Panel

Gdy status = REVIEW:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Review Mode                                                                │
│  SWOT Analysis - Manufacturing Division                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────┐  ┌───────────────────────┐  │
│  │  Analysis Summary                         │  │  Review Actions       │  │
│  │  ─────────────────────────────────────    │  │  ─────────────────    │  │
│  │                                           │  │                       │  │
│  │  Quadrants                                │  │  Status: REVIEW       │  │
│  │  • Strengths: 5 items                     │  │  Requested: Jan 27    │  │
│  │  • Weaknesses: 3 items                    │  │  Due: Feb 5           │  │
│  │  • Opportunities: 4 items                 │  │  Priority: High       │  │
│  │  • Threats: 2 items                       │  │                       │  │
│  │                                           │  │  ─────────────────    │  │
│  │  Correlations: 8 total                    │  │                       │  │
│  │  • S-O: 3 (leverage)                      │  │  [✓] I confirm the    │  │
│  │  • W-O: 2 (address)                       │  │      analysis is      │  │
│  │  • S-T: 2 (defend)                        │  │      complete         │  │
│  │  • W-T: 1 (avoid)                         │  │                       │  │
│  │                                           │  │  ─────────────────    │  │
│  │  ─────────────────────────────────────    │  │                       │  │
│  │                                           │  │  [✅ Approve]         │  │
│  │  Gaps                                     │  │                       │  │
│  │  ✓ No gaps detected. Ready to approve.    │  │  [↩️ Send back]       │  │
│  │                                           │  │                       │  │
│  │  ─────────────────────────────────────    │  │  ─────────────────    │  │
│  │                                           │  │                       │  │
│  │  Generate Initiatives                     │  │  Comment              │  │
│  │  Methodology: Impact x Feasibility        │  │  ┌─────────────────┐  │  │
│  │  Count: 5                                 │  │  │                 │  │  │
│  │  Include chat: Yes                        │  │  │                 │  │  │
│  │  [⚙️ Configure]                           │  │  │                 │  │  │
│  │                                           │  │  └─────────────────┘  │  │
│  │  ─────────────────────────────────────    │  │                       │  │
│  │                                           │  │                       │  │
│  │  Decision Gates                           │  │                       │  │
│  │  ┌─────────────────────────────────────┐  │  │                       │  │
│  │  │ Request Review    ✅ APPROVED       │  │  │                       │  │
│  │  │ Jan 20, 10:00 · by John Smith       │  │  │                       │  │
│  │  ├─────────────────────────────────────┤  │  │                       │  │
│  │  │ Approve Tool      ⏳ PENDING        │  │  │                       │  │
│  │  │ Waiting for review                  │  │  │                       │  │
│  │  ├─────────────────────────────────────┤  │  │                       │  │
│  │  │ Generate Init.    ⬜ NOT STARTED    │  │  │                       │  │
│  │  │ Requires approval                   │  │  │                       │  │
│  │  └─────────────────────────────────────┘  │  │                       │  │
│  │                                           │  │                       │  │
│  └───────────────────────────────────────────┘  └───────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stany UI

| Stan | Opis | UI | Akcje dostepne |
|------|------|-----|----------------|
| `loading` | Ladowanie danych | Spinner + "Loading..." | Brak |
| `error` | Blad API | Error message + Retry button | Retry, Go back |
| `empty` | Brak danych | Empty state + CTA | Create new |
| `idle` | Normalny | Lista/Grid | All actions |
| `saving` | Auto-save | Subtle indicator (top-right) | Continue editing |
| `generating` | AI generuje | Modal z progress bar | Cancel |
| `reviewing` | W trakcie review | Review panel | Approve, Send back |

### Przykladowe komunikaty

| Stan | Komunikat PL | Komunikat EN |
|------|--------------|--------------|
| loading | Ladowanie narzedzi... | Loading tools... |
| error | Nie udalo sie zaladowac. Sprobuj ponownie. | Failed to load. Please try again. |
| empty | Brak sesji. Utworz pierwsza analize. | No sessions yet. Create your first analysis. |
| saving | Zapisywanie... | Saving... |
| generating | Generowanie inicjatyw (3/5)... | Generating initiatives (3/5)... |

---

## Responsywnosc

| Breakpoint | Layout | Zmiany |
|------------|--------|--------|
| Desktop (>1280px) | 3-kolumnowy | Full layout |
| Tablet (768-1280px) | 2-kolumnowy | Context panel collapsible |
| Mobile (<768px) | 1-kolumnowy | Bottom sheet dla context |

### Mobile-specific

- Swipe gestures dla nawigacji miedzy sekcjami
- Bottom sheet dla Context Panel
- Floating action button dla quick actions
- Simplified table view (card-based)

---

## Pliki zrodlowe

- `src/components/Discovery/DiscoveryToolsHub.tsx`
- `src/components/DiscoveryTools/ToolWorkspace.tsx`
- `src/components/DiscoveryTools/ToolReviewPanel.tsx`
- `src/components/DiscoveryTools/ToolCanvas.tsx`
- `src/components/DiscoveryTools/ToolContextPanel.tsx`
- `src/components/DiscoveryTools/ToolHeader.tsx`
- `src/components/DiscoveryTools/ToolActionBar.tsx`
- `src/components/shared/ModuleHub/`
