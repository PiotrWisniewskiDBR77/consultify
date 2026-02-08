#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MOVIE_DIR = ROOT / "wdrozenia" / "modules" / "tools" / "catalog" / "movie"

STRATEGY = [
    {
        "slug": "mece-issue-tree",
        "tool": "MECE & Issue Trees",
        "pl_hook": "Gdy problem jest niejasny, najlepsi konsultanci najpierw go strukturyzują.",
        "en_hook": "When the problem is unclear, great consultants structure it first.",
        "outputs": "issue tree, hypotheses, prioritized workplan, initiative candidates",
        "visual": "tree diagram + hypothesis board",
        "impl": "tree.nodes/edges + hypotheses[] + prioritization[]; initiatives trace to leafNodeId",
    },
    {
        "slug": "hypothesis-driven-strategy",
        "tool": "Hypothesis-Driven Strategy",
        "pl_hook": "Zamiast zbierać „wszystkie dane świata”, zaczynasz od hipotez i testujesz je najszybciej jak się da.",
        "en_hook": "Instead of collecting ‘all the data’, you start with hypotheses and test them fast.",
        "outputs": "hypotheses, tests, evidence, decision-ready conclusions, initiatives",
        "visual": "hypothesis board + evidence links",
        "impl": "hypotheses[] with tests/evidence; status gating before approval",
    },
    {
        "slug": "pyramid-principle",
        "tool": "Pyramid Principle (Minto)",
        "pl_hook": "Jeśli komunikat jest chaotyczny, decyzje stoją. Pyramid Principle porządkuje myślenie i narrację.",
        "en_hook": "If your message is messy, decisions stall. The Pyramid Principle makes it clear.",
        "outputs": "answer-first story, supporting arguments, MECE structure, executive summary",
        "visual": "pyramid outline + storyline editor",
        "impl": "topMessage + supportingPoints[]; export-ready narrative section",
    },
    {
        "slug": "pestel",
        "tool": "PESTEL Analysis",
        "pl_hook": "Zanim wybierzesz strategię, musisz rozumieć otoczenie — trendy i regulacje, które zmienią grę.",
        "en_hook": "Before choosing a strategy, you need to understand the external forces changing the game.",
        "outputs": "trend map with evidence, impact×likelihood prioritization, implications, initiatives",
        "visual": "6-column PESTEL board + heatmap",
        "impl": "trends[] with evidence + scoring; initiatives trace to trendId",
    },
    {
        "slug": "market-sizing-tam-sam-som",
        "tool": "Market Sizing (TAM/SAM/SOM)",
        "pl_hook": "Rynek „ogromny” nic nie znaczy, dopóki nie policzysz go jak konsultant: od TAM do SOM.",
        "en_hook": "A ‘huge market’ means nothing until you size it like a consultant: TAM to SOM.",
        "outputs": "TAM/SAM/SOM model, assumptions, sensitivity, go-to-market implications",
        "visual": "funnel + assumptions table",
        "impl": "modelInputs + calculations + sensitivity; export includes assumptions register",
    },
    {
        "slug": "customer-segmentation",
        "tool": "Customer Segmentation (STP)",
        "pl_hook": "Nie da się wygrać mówiąc do wszystkich. Segmentacja pokazuje, komu i jak naprawdę sprzedajesz.",
        "en_hook": "You can’t win by talking to everyone. Segmentation clarifies who you serve and how.",
        "outputs": "segments, personas, targeting choice, positioning statement, initiatives",
        "visual": "segment matrix + persona cards",
        "impl": "segments[] with criteria and sizes; targeting decision + positioning output",
    },
    {
        "slug": "jobs-to-be-done",
        "tool": "Jobs To Be Done (JTBD)",
        "pl_hook": "Klienci nie kupują produktu — zatrudniają go do wykonania pracy.",
        "en_hook": "Customers don’t buy products—they hire them to get a job done.",
        "outputs": "job statements, pains/gains, outcome metrics, opportunity areas, initiatives",
        "visual": "job map + opportunity scoring",
        "impl": "jobs[] + outcomes[] + opportunityScores; initiatives trace to jobId",
    },
    {
        "slug": "competitive-benchmarking",
        "tool": "Competitive Benchmarking",
        "pl_hook": "Benchmarking pokazuje, gdzie realnie odstajesz od konkurencji — i co musisz poprawić, by dogonić lub przeskoczyć.",
        "en_hook": "Benchmarking shows where you truly lag competitors—and what to fix to catch up or leapfrog.",
        "outputs": "comparison metrics, gaps, best practices, recommendations, initiatives",
        "visual": "benchmark table + gap heatmap",
        "impl": "competitors[] + metrics[] + evidence; initiative mapping to gapId",
    },
    {
        "slug": "porter-generic-strategies",
        "tool": "Porter’s Generic Strategies",
        "pl_hook": "Strategia to wybór: koszt, zróżnicowanie albo focus — bez mieszania sygnałów.",
        "en_hook": "Strategy is choice: cost leadership, differentiation, or focus—without mixed signals.",
        "outputs": "chosen posture, proof points, trade-offs, initiative priorities",
        "visual": "strategy choice canvas + trade-off list",
        "impl": "choice + evidence + risks; report includes “what we will NOT do” section",
    },
    {
        "slug": "strategic-positioning",
        "tool": "Strategic Positioning (Porter)",
        "pl_hook": "Pozycjonowanie to decyzja o unikalnej wartości i spójnym zestawie działań, które ją dostarczają.",
        "en_hook": "Positioning is choosing unique value and a coherent set of activities to deliver it.",
        "outputs": "positioning statement, activity system, fit analysis, initiatives",
        "visual": "activity map + positioning statement",
        "impl": "positioning + activitySystem graph; initiatives trace to activityId",
    },
    {
        "slug": "vrio",
        "tool": "VRIO",
        "pl_hook": "VRIO mówi, które zasoby dają przewagę — a które są tylko „higieną rynkową”.",
        "en_hook": "VRIO reveals which resources create advantage—and which are just table stakes.",
        "outputs": "VRIO assessment, advantage classification, capability gaps, initiatives",
        "visual": "VRIO matrix/table with scoring",
        "impl": "resources[] with V/R/I/O flags and evidence; initiative mapping to resourceId",
    },
    {
        "slug": "core-competencies",
        "tool": "Core Competencies",
        "pl_hook": "Core competencies to to, co firma potrafi robić wyjątkowo dobrze — i na czym powinna budować wzrost.",
        "en_hook": "Core competencies are what your company does uniquely well—and should build growth on.",
        "outputs": "competency list, proof, gaps, build/buy/partner decisions, initiatives",
        "visual": "competency map + scoring",
        "impl": "competencies[] with evidence and gap actions; report includes capability roadmap",
    },
    {
        "slug": "blue-ocean-strategy",
        "tool": "Blue Ocean Strategy",
        "pl_hook": "Blue Ocean pozwala przestać walczyć ceną i stworzyć nową wartość dla klienta.",
        "en_hook": "Blue Ocean helps you stop competing on price and create new customer value.",
        "outputs": "strategy canvas, value innovation moves, differentiation levers, initiatives",
        "visual": "strategy canvas + value curve",
        "impl": "factors[] + valueCurve; initiatives trace to factor changes",
    },
    {
        "slug": "errc-grid",
        "tool": "ERRC Grid",
        "pl_hook": "ERRC szybko przekłada Blue Ocean na konkret: usuń, ogranicz, podnieś, stwórz.",
        "en_hook": "ERRC turns Blue Ocean into actions: eliminate, reduce, raise, create.",
        "outputs": "ERRC grid, prioritized moves, initiative backlog",
        "visual": "4-quadrant ERRC grid",
        "impl": "errc.{eliminate,reduce,raise,create} arrays with rationale and evidence",
    },
    {
        "slug": "ge-mckinsey-9-box",
        "tool": "GE–McKinsey 9-box",
        "pl_hook": "Gdy masz wiele biznesów lub produktów, 9-box pomaga zdecydować: inwestować, utrzymać czy wyjść.",
        "en_hook": "With multiple businesses or products, the 9-box helps decide: invest, hold, or exit.",
        "outputs": "portfolio positioning, strategic actions per cell, investment priorities",
        "visual": "9-box matrix (attractiveness × strength)",
        "impl": "units[] with scores and evidence; initiatives trace to unitId",
    },
    {
        "slug": "experience-curve",
        "tool": "Experience Curve (BCG)",
        "pl_hook": "Experience curve pokazuje, jak koszty spadają wraz z doświadczeniem — i gdzie szukać przewagi kosztowej.",
        "en_hook": "The experience curve shows how costs fall with cumulative output—and where cost advantage comes from.",
        "outputs": "cost curve, learning rate assumptions, cost-reduction levers, initiatives",
        "visual": "log-log curve + learning rate",
        "impl": "costPoints[] + fittedCurve params; assumptions register included in export",
    },
    {
        "slug": "bcg-advantage-matrix",
        "tool": "BCG Advantage Matrix",
        "pl_hook": "Ta macierz pomaga dobrać strategię przewagi do struktury konkurencji i możliwości różnicowania.",
        "en_hook": "This matrix aligns your advantage strategy to competitive structure and differentiation potential.",
        "outputs": "advantage type choice, implications, playbook actions, initiatives",
        "visual": "2×2 matrix with recommended plays",
        "impl": "industryFactors + position; recommendations are rule-based + evidence notes",
    },
    {
        "slug": "three-horizons",
        "tool": "Three Horizons (McKinsey)",
        "pl_hook": "Three Horizons porządkuje wzrost: dziś, jutro i przyszłość — z jasnymi inwestycjami w każdym horyzoncie.",
        "en_hook": "Three Horizons organizes growth: now, next, and future—with clear investments in each.",
        "outputs": "H1/H2/H3 portfolio, funding/effort split, timeline, initiatives",
        "visual": "three-horizon timeline/portfolio",
        "impl": "initiatives tagged by horizon with budget/effort; report includes balance analysis",
    },
    {
        "slug": "business-model-canvas",
        "tool": "Business Model Canvas",
        "pl_hook": "Canvas daje wspólny obraz modelu biznesowego — i szybko pokazuje, co trzeba zmienić, by strategia zadziałała.",
        "en_hook": "The Canvas creates a shared picture of the business model—and what must change for strategy to work.",
        "outputs": "BMC filled, coherence checks, risks, initiative backlog",
        "visual": "9-block canvas",
        "impl": "blocks keyed by BMC section; AI checks for contradictions and missing links",
    },
    {
        "slug": "balanced-scorecard",
        "tool": "Balanced Scorecard",
        "pl_hook": "Balanced Scorecard zamienia strategię w mierzalny system zarządzania: cele, miary, inicjatywy i odpowiedzialność.",
        "en_hook": "Balanced Scorecard turns strategy into execution: objectives, measures, initiatives, ownership.",
        "outputs": "objectives by perspective, KPIs, targets, initiatives, governance cadence",
        "visual": "4-perspective scorecard + strategy map (optional)",
        "impl": "objectives[] with KPI/target; initiative traceability to objectiveId",
    },
]


def render(tool: str, slug: str, pl_hook: str, en_hook: str, outputs: str, visual: str, impl: str) -> str:
    return f"""# {tool} — intro script (45–60s)

## Metadata
- **Tool**: {tool}
- **Slug**: `{slug}`
- **Length**: 45–60s

## VO (PL)
„{pl_hook} W narzędziu przechodzisz przez szybki setup, budujesz artefakt krok po kroku i dostajesz: {outputs}. Kluczowy moment to {visual} — tam widać priorytety i wnioski. Na koniec generujesz inicjatywy z przypięciem do źródła i eksportujesz raport gotowy do omówienia z klientem.”

## VO (EN)
"{en_hook} In the tool you do a quick setup, build the artifact step by step, and get: {outputs}. The key moment is the {visual}—that’s where priorities and insights become obvious. Finally, you generate initiatives with full traceability and export a client-ready report."

## On-screen (PL)
- „Cel → artefakt → wnioski”
- „Dowody i założenia”
- „{visual}”
- „Inicjatywy + eksport”

## On-screen (EN)
- "Goal → artifact → insights"
- "Evidence & assumptions"
- "{visual}"
- "Initiatives + export"

## Shot list
1. Start screen (tool name + purpose)
2. Setup (scope / horizon / key inputs)
3. Main visualization
4. Insights → initiatives
5. Export PDF

## Implementacja (1–2 zdania)
{impl}.
"""


def main() -> int:
    MOVIE_DIR.mkdir(parents=True, exist_ok=True)
    for t in STRATEGY:
        path = MOVIE_DIR / f"{t['slug']}.md"
        path.write_text(
            render(
                t["tool"],
                t["slug"],
                t["pl_hook"],
                t["en_hook"],
                t["outputs"],
                t["visual"],
                t["impl"],
            ),
            encoding="utf-8",
        )
    print(f"Updated {len(STRATEGY)} strategy movie scripts in {MOVIE_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

