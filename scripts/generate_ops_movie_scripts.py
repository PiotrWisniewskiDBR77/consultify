#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MOVIE_DIR = ROOT / "wdrozenia" / "modules" / "tools" / "catalog" / "movie"

# Mapping by operations slug -> metadata for script generation.
OPS = [
    {
        "slug": "value-stream-mapping-vsm",
        "tool": "Value Stream Mapping (VSM)",
        "pl": {
            "hook": "Jeśli dostawa jest wolna, a wszyscy są „zajęci”, problemem zwykle jest czekanie.",
            "outputs": "current state, future state, hot‑spoty, backlog inicjatyw",
            "visual": "mapa VSM + timeline VA vs wait",
            "impl": "steps[] (CT/wait/WIP) + futureState.rules[]; inicjatywy z traceability do stepId",
        },
        "en": {
            "hook": "If delivery is slow and everyone is ‘busy’, the problem is usually waiting.",
            "outputs": "current state, future state, hot spots, improvement backlog",
            "visual": "VSM map + VA vs wait timeline",
            "impl": "steps[] (CT/wait/WIP) + futureState.rules[]; initiatives trace to stepId",
        },
    },
    {
        "slug": "sipoc",
        "tool": "SIPOC (Process Scoping)",
        "pl": {
            "hook": "Zanim usprawnisz proces, musisz uzgodnić: co jest w zakresie, a co nie.",
            "outputs": "SIPOC, CTQ, zakres i pytania otwarte",
            "visual": "tabela SIPOC z CTQ",
            "impl": "sipoc[] + ctqs[] + openQuestions[]; szybka konwersja pytań do inicjatyw",
        },
        "en": {
            "hook": "Before you improve a process, you must agree what it is—and what it is not.",
            "outputs": "SIPOC, CTQs, scope, open questions",
            "visual": "SIPOC table with CTQ badges",
            "impl": "sipoc[] + ctqs[] + openQuestions[]; questions → initiatives",
        },
    },
    {
        "slug": "dmaic",
        "tool": "DMAIC (Six Sigma Project Flow)",
        "pl": {
            "hook": "DMAIC to sposób na problemy, które wracają — i wymagają danych, nie opinii.",
            "outputs": "charter, baseline, przyczyny, test poprawy, plan kontroli",
            "visual": "stepper DMAIC + wykresy baseline i SPC",
            "impl": "define/measure/analyze/improve/control; inicjatywy tylko z przyczyn zweryfikowanych",
        },
        "en": {
            "hook": "DMAIC is for recurring problems that need data—not opinions.",
            "outputs": "charter, baseline, validated causes, tested improvement, control plan",
            "visual": "DMAIC stepper + baseline charts + SPC",
            "impl": "define/measure/analyze/improve/control; initiatives only from validated causes",
        },
    },
    {
        "slug": "kaizen-pdca",
        "tool": "Kaizen / PDCA",
        "pl": {
            "hook": "PDCA to najszybsza pętla uczenia: zaplanuj zmianę, przetestuj, zmierz, wystandaryzuj.",
            "outputs": "hipoteza, eksperyment, wynik, decyzja, standard",
            "visual": "before/after + log eksperymentu",
            "impl": "problem+baseline+target+hypothesis+experiment+results; traceability do experimentId",
        },
        "en": {
            "hook": "PDCA is the fastest learning loop: plan a change, test it, measure it, standardize it.",
            "outputs": "hypothesis, experiment, result, decision, standard",
            "visual": "before/after chart + experiment log",
            "impl": "problem+baseline+target+hypothesis+experiment+results; trace to experimentId",
        },
    },
    {
        "slug": "gemba-walk",
        "tool": "Gemba Walk",
        "pl": {
            "hook": "Gemba Walk to nie audyt — to sposób, by zobaczyć pracę „na żywo” i usuwać przeszkody.",
            "outputs": "obserwacje, tematy strat, akcje i follow‑up",
            "visual": "log obserwacji + tagi tematów",
            "impl": "observations[] z evidence + actions[]; zamiana obserwacji na inicjatywy",
        },
        "en": {
            "hook": "A Gemba Walk is not an audit—it’s how leaders see real work and remove obstacles.",
            "outputs": "observations, waste themes, actions, follow-up",
            "visual": "observation log + theme tags",
            "impl": "observations[] with evidence + actions[]; convert to initiatives",
        },
    },
    {
        "slug": "standard-work",
        "tool": "Standard Work",
        "pl": {
            "hook": "Bez standardu nie ma poprawy — bo nie wiadomo, co jest „normalne”.",
            "outputs": "sekwencja kroków, punkty jakości, checklisty i audyt",
            "visual": "arkusz Standard Work + checklisty",
            "impl": "steps[] + qualityPoints[] + trainingChecklist[]; audyt i wersjonowanie",
        },
        "en": {
            "hook": "Without a standard, improvement is guesswork—there is no ‘normal’ to improve.",
            "outputs": "step sequence, quality points, checklists, audits",
            "visual": "Standard Work Sheet + checklists",
            "impl": "steps[] + qualityPoints[] + trainingChecklist[]; audit cadence and versioning",
        },
    },
    {
        "slug": "5s",
        "tool": "5S Workplace Organization",
        "pl": {
            "hook": "5S sprawia, że właściwy sposób pracy jest łatwy, a odchylenia widać od razu.",
            "outputs": "red‑tag, standardy wizualne, audyt 5S",
            "visual": "before/after + lista red‑tag + audit score",
            "impl": "redTags[] + standards[] + audit.questions[]; trend wyniku audytu",
        },
        "en": {
            "hook": "5S makes the right way easy and abnormalities immediately visible.",
            "outputs": "red-tag list, visual standards, 5S audits",
            "visual": "before/after + red-tag register + audit score trend",
            "impl": "redTags[] + standards[] + audit.questions[]; audit score trend",
        },
    },
    {
        "slug": "root-cause-5whys-fishbone",
        "tool": "Root Cause Analysis (5 Whys + Fishbone)",
        "pl": {
            "hook": "Jeśli problem wraca, to znaczy, że gasisz objawy, a nie przyczynę.",
            "outputs": "fishbone, łańcuch 5 Why, root cause, countermeasures",
            "visual": "diagram Ishikawy + łańcuch „dlaczego”",
            "impl": "fishbone[] + whyChains[] + countermeasures[]; inicjatywy z whyChainId",
        },
        "en": {
            "hook": "If the problem keeps coming back, you’re treating symptoms—not root causes.",
            "outputs": "fishbone, 5-Whys chain, root cause, countermeasures",
            "visual": "Ishikawa diagram + why-chain",
            "impl": "fishbone[] + whyChains[] + countermeasures[]; initiatives trace to whyChainId",
        },
    },
    {
        "slug": "kanban-wip-limits",
        "tool": "Kanban & WIP Limits",
        "pl": {
            "hook": "Jeśli wszystko jest pilne, nic nie jest kończone. Kanban z limitami WIP stabilizuje przepływ.",
            "outputs": "board, limity WIP, metryki flow, backlog usprawnień",
            "visual": "kolumny z licznikami WIP + lead time histogram",
            "impl": "workflow[] + policies + metrics; blokady i eskalacja",
        },
        "en": {
            "hook": "If everything is urgent, nothing gets finished. Kanban with WIP limits stabilizes flow.",
            "outputs": "board, WIP limits, flow metrics, improvement backlog",
            "visual": "columns with WIP counters + lead time histogram",
            "impl": "workflow[] + policies + metrics; blockers and escalation",
        },
    },
    {
        "slug": "bottleneck-analysis-toc",
        "tool": "TOC Bottleneck Analysis",
        "pl": {
            "hook": "Najczęściej jedna rzecz ogranicza przepustowość całego systemu — reszta to szum.",
            "outputs": "constraint, exploit plan, policies, elevation options",
            "visual": "heatmap kolejek + badge constraint",
            "impl": "constraintStepId + exploit/subordinate/elevate; powiązania do SMED/TPM",
        },
        "en": {
            "hook": "Usually one constraint limits system throughput—everything else is noise.",
            "outputs": "constraint, exploit plan, policies, elevation options",
            "visual": "queue heatmap + constraint badge",
            "impl": "constraintStepId + exploit/subordinate/elevate; links to SMED/TPM",
        },
    },
    {
        "slug": "smed",
        "tool": "SMED (Setup Reduction)",
        "pl": {
            "hook": "Jeśli przezbrojenia są długie, produkujesz duże partie — a to zabija elastyczność.",
            "outputs": "kroki setupu, internal/external, nowy standard, oszczędność czasu",
            "visual": "tabela kroków + wykres before/after",
            "impl": "steps[] z tagiem internal/external; checklisty i standard pracy",
        },
        "en": {
            "hook": "If changeovers are long, you run big batches—and lose flexibility.",
            "outputs": "setup steps, internal/external split, new standard, time savings",
            "visual": "step table + before/after chart",
            "impl": "steps[] with internal/external tags; checklist + standard work",
        },
    },
    {
        "slug": "oee",
        "tool": "Overall Equipment Effectiveness (OEE)",
        "pl": {
            "hook": "OEE mówi wprost, czy tracisz czas na awarie, wolną pracę czy braki jakości.",
            "outputs": "A/P/Q, loss tree, Pareto strat, backlog działań",
            "visual": "OEE gauge + Pareto strat",
            "impl": "inputs + computed + losses[]; linki do TPM/SMED/SPC",
        },
        "en": {
            "hook": "OEE tells you whether you’re losing output to downtime, speed losses, or quality.",
            "outputs": "A/P/Q, loss tree, Pareto, improvement backlog",
            "visual": "OEE gauge + loss Pareto",
            "impl": "inputs + computed + losses[]; links to TPM/SMED/SPC",
        },
    },
    {
        "slug": "tpm",
        "tool": "Total Productive Maintenance (TPM)",
        "pl": {
            "hook": "TPM zmniejsza awarie, bo utrzymanie ruchu staje się systemem, a nie reakcją.",
            "outputs": "krytyczne zasoby, checklisty operatorów, plan PM, KPI MTBF/MTTR",
            "visual": "Pareto awarii + checklisty AM",
            "impl": "assets[] + baseline + autonomousMaintenance + plannedMaintenance",
        },
        "en": {
            "hook": "TPM reduces breakdowns by making maintenance a system, not a reaction.",
            "outputs": "critical assets, operator checklists, PM plan, MTBF/MTTR KPIs",
            "visual": "downtime Pareto + autonomous maintenance checklists",
            "impl": "assets[] + baseline + autonomousMaintenance + plannedMaintenance",
        },
    },
    {
        "slug": "spc-control-charts",
        "tool": "SPC Control Charts",
        "pl": {
            "hook": "SPC rozróżnia sygnał od szumu — i mówi, kiedy naprawdę reagować.",
            "outputs": "wykres kontrolny, limity, sygnały, plan reakcji",
            "visual": "chart z UCL/LCL i markerami sygnałów",
            "impl": "chartType + limits + signals + responsePlan",
        },
        "en": {
            "hook": "SPC separates signal from noise—and tells you when to react.",
            "outputs": "control chart, limits, signals, response plan",
            "visual": "chart with UCL/LCL and signal markers",
            "impl": "chartType + limits + signals + responsePlan",
        },
    },
    {
        "slug": "process-capability-cpk",
        "tool": "Process Capability (Cp/Cpk)",
        "pl": {
            "hook": "Cp/Cpk pokazuje, czy proces mieści się w tolerancjach — i czy jest wycentrowany.",
            "outputs": "Cp, Cpk, histogram ze specyfikacją, rekomendacje",
            "visual": "histogram + LSL/USL overlay",
            "impl": "spec + data + results; bramka stabilności (SPC)",
        },
        "en": {
            "hook": "Cp/Cpk shows whether a stable process fits specs—and whether it is centered.",
            "outputs": "Cp, Cpk, spec-overlay histogram, recommendations",
            "visual": "histogram with LSL/USL overlay",
            "impl": "spec + data + results; stability gate via SPC",
        },
    },
    {
        "slug": "fmea",
        "tool": "FMEA (Failure Modes & Effects Analysis)",
        "pl": {
            "hook": "FMEA to proaktywne zarządzanie ryzykiem: zanim awaria trafi do klienta.",
            "outputs": "tabela FMEA, priorytety ryzyk, akcje zapobiegawcze",
            "visual": "ranking RPN/AP + heatmapa ryzyk",
            "impl": "rows[] (mode/effect/cause/controls/ratings) + actions[]",
        },
        "en": {
            "hook": "FMEA is proactive risk prevention—before failures reach customers.",
            "outputs": "FMEA table, risk priorities, prevention actions",
            "visual": "RPN/AP ranking + risk heatmap",
            "impl": "rows[] (mode/effect/cause/controls/ratings) + actions[]",
        },
    },
    {
        "slug": "abc-xyz-inventory",
        "tool": "Inventory Classification (ABC/XYZ)",
        "pl": {
            "hook": "Nie wszystkie SKU są równe. ABC/XYZ mówi, które wymagają kontroli, a które prostych zasad.",
            "outputs": "klasy ABC i XYZ, polityki uzupełniania, priorytety",
            "visual": "9‑box matrix + Pareto wartości",
            "impl": "skus[] z ABC/XYZ + progi; rekomendacje polityk",
        },
        "en": {
            "hook": "Not all SKUs are equal. ABC/XYZ tells you which need tight control and which need simple rules.",
            "outputs": "ABC and XYZ classes, replenishment policies, priorities",
            "visual": "9‑box matrix + value Pareto",
            "impl": "skus[] with ABC/XYZ + thresholds; policy recommendations",
        },
    },
    {
        "slug": "safety-stock-reorder-point",
        "tool": "Safety Stock & Reorder Point",
        "pl": {
            "hook": "Bufor magazynowy to nie magia — to matematyka niepewności i poziomu serwisu.",
            "outputs": "safety stock, ROP, założenia serwisu, wyjątki",
            "visual": "kalkulator SS/ROP + scenariusze",
            "impl": "demand/leadTime + target service; wynik SS i ROP na SKU/klasę",
        },
        "en": {
            "hook": "Inventory buffers are not magic—they are math for uncertainty and service level.",
            "outputs": "safety stock, ROP, service assumptions, exceptions",
            "visual": "SS/ROP calculator + scenarios",
            "impl": "demand/leadTime + target service; SS and ROP per SKU/class",
        },
    },
    {
        "slug": "sales-and-operations-planning-sn-op",
        "tool": "Sales & Operations Planning (S&OP)",
        "pl": {
            "hook": "S&OP tworzy jeden plan dla sprzedaży i operacji — i wymusza decyzje o kompromisach.",
            "outputs": "consensus plan, gap analysis, scenariusze, decision log",
            "visual": "demand vs supply overlay + lista decyzji",
            "impl": "demandPlan + supplyPlan + gaps + scenarios + decisions",
        },
        "en": {
            "hook": "S&OP creates one plan for sales and operations—and forces trade-off decisions.",
            "outputs": "consensus plan, gap analysis, scenarios, decision log",
            "visual": "demand vs supply overlay + decision log",
            "impl": "demandPlan + supplyPlan + gaps + scenarios + decisions",
        },
    },
    {
        "slug": "scor-model",
        "tool": "SCOR Model (Supply Chain Reference)",
        "pl": {
            "hook": "SCOR daje wspólny język dla łańcucha dostaw: Plan, Source, Make, Deliver, Return, Enable.",
            "outputs": "mapa SCOR, KPI baseline, luki, roadmap inicjatyw",
            "visual": "swimlane SCOR + gap heatmap",
            "impl": "processMap + kpis + gaps + roadmap; domeny SCOR jako oś raportu",
        },
        "en": {
            "hook": "SCOR gives a shared supply chain language: Plan, Source, Make, Deliver, Return, Enable.",
            "outputs": "SCOR map, KPI baseline, gaps, initiative roadmap",
            "visual": "SCOR swimlane map + gap heatmap",
            "impl": "processMap + kpis + gaps + roadmap; SCOR domains structure the report",
        },
    },
]


def render_script(tool: str, slug: str, pl: dict, en: dict) -> str:
    on_pl = [
        "„Po co to narzędzie?”",
        f"„Co dostajesz: {pl['outputs']}”",
        f"„Wizualizacja: {pl['visual']}”",
        "„Inicjatywy + eksport”",
    ]
    on_en = [
        '"Why this tool?"',
        f'"Outputs: {en["outputs"]}"',
        f'"Visual: {en["visual"]}"',
        '"Initiatives + export"',
    ]

    return f"""# {tool} — intro script (45–60s)

## Metadata
- **Tool**: {tool}
- **Slug**: `{slug}`
- **Length**: 45–60s

## VO (PL)
„{pl['hook']} W tej minucie zobaczysz: {pl['outputs']}. W aplikacji zaczynasz od krótkiego setupu, uzupełniasz kluczowe pola i budujesz artefakt w jednym widoku. Potem przechodzisz do {pl['visual']}, wyciągasz wnioski i zamieniasz je na inicjatywy z pełną ścieżką źródła. Na końcu eksportujesz raport gotowy dla klienta.”

## VO (EN)
"{en['hook']} In one minute you’ll see: {en['outputs']}. In the app you start with a short setup, fill the key inputs, and build the artifact in one workspace. Then you move to the {en['visual']}, capture insights, and convert them into initiatives with full traceability. Finally, you export a client-ready report."

## On-screen (PL)
{os.linesep.join([f"- {line}" for line in on_pl])}

## On-screen (EN)
{os.linesep.join([f"- {line}" for line in on_en])}

## Shot list
1. Start screen (tool name + goal)
2. Setup (scope / KPI / key inputs)
3. Main visualization
4. Insights → initiatives
5. Export PDF

## Implementacja (1–2 zdania)
{pl['impl']}.
"""


def main() -> int:
    MOVIE_DIR.mkdir(parents=True, exist_ok=True)

    created = 0
    for item in OPS:
        slug = item["slug"]
        path = MOVIE_DIR / f"{slug}.md"
        if path.exists():
            continue
        content = render_script(item["tool"], slug, item["pl"], item["en"])
        path.write_text(content, encoding="utf-8")
        created += 1

    print(f"Created {created} movie scripts in {MOVIE_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

