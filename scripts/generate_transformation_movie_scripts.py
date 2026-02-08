#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MOVIE_DIR = ROOT / "wdrozenia" / "modules" / "tools" / "catalog" / "movie"


TOOLS = [
    ("digital-transformation-assessment", "Digital Transformation Assessment (Maturity Baseline)",
     "Zanim zaczniesz transformację cyfrową, musisz mieć twardy baseline i dowody.",
     "Before you transform, you need an evidence-backed baseline.",
     "maturity by domain, evidence register, prioritized gaps, initiative candidates",
     "domain cards + radar chart + gap ranking",
     "scores[] with evidence + gaps[]; initiatives trace to domain/gap"),
    ("target-operating-model-tom", "Target Operating Model (TOM)",
     "TOM zamienia wizję transformacji w konkretny sposób działania: role, decyzje, governance.",
     "A TOM turns transformation vision into how you actually operate: roles, decisions, governance.",
     "TOM blueprint, decision log, governance cadence, initiative backlog",
     "TOM canvas + RACI + cadence calendar",
     "tom + raci + cadence; initiatives trace to TOM section"),
    ("transformation-roadmap", "Transformation Roadmap (Waves & Dependencies)",
     "Roadmapa transformacji to nie lista marzeń — to fale, zależności i realna pojemność zmian.",
     "A transformation roadmap is not a wish list—it is waves, dependencies, and real capacity.",
     "wave roadmap, dependency map, milestones, KPI checkpoints",
     "timeline + dependency graph",
     "waves[] + dependencies[]; initiatives trace to wave/milestone"),
    ("benefits-case-value-tracking", "Benefits Case & Value Tracking",
     "Jeśli nie mierzysz wartości, transformacja staje się kosztem. Ten moduł robi z value case system zarządzania.",
     "If you don't measure value, transformation becomes cost. This turns benefits into a management system.",
     "benefits tree, KPI owners, baseline/targets, traceability",
     "benefits tree + KPI cards",
     "benefitsTree + owners + tracking cadence"),
    ("current-state-architecture-map", "Current-State Architecture Map (As-is)",
     "Bez prawdziwego obrazu architektury 'as-is' nie da się planować bez ryzyka.",
     "Without a real as-is architecture picture, planning is guesswork.",
     "as-is map, integration inventory, constraints, modernization candidates",
     "C4-style map + integration table",
     "systems[] + integrations[]; constraints tagged"),
    ("target-architecture-blueprint", "Target Architecture Blueprint (To-be)",
     "To-be blueprint daje wzorce i zasady, dzięki którym zespoły budują spójnie i szybciej.",
     "A to-be blueprint gives patterns and principles so teams build consistently and faster.",
     "target blueprint, patterns, principles, decision log",
     "blueprint diagram + pattern cards",
     "principles + patterns + decisions; export-ready"),
    ("application-portfolio-rationalization", "Application Portfolio Rationalization",
     "Jeśli masz setki aplikacji, nie wygrasz szybkości ani kosztów. Racjonalizacja portfela wskazuje: keep/retire/replace/refactor.",
     "With hundreds of apps, you can't win on speed or cost. Rationalization gives keep/retire/replace/refactor decisions.",
     "app inventory, 6R decisions, savings/risk plan, roadmap",
     "6R matrix + dependency graph",
     "apps[] with 6R + dependencies; initiatives trace to appId"),
    ("technology-standards-guardrails", "Technology Standards & Guardrails",
     "Guardrails przyspieszają delivery: standardy, wzorce i proces wyjątków zamiast chaosu.",
     "Guardrails accelerate delivery: standards, patterns, and an exception process instead of chaos.",
     "standards catalog, reference patterns, exception workflow",
     "standards catalog + exception flow",
     "standards[] + exceptions[]; compliance checks"),
    ("data-strategy-data-operating-model", "Data Strategy & Data Operating Model",
     "Strategia danych to nie platforma — to priorytety domen i model odpowiedzialności.",
     "Data strategy is not a platform—it's domain priorities and operating responsibilities.",
     "data domains, operating model, priorities, roadmap initiatives",
     "domain map + operating model canvas",
     "domains + ownership + cadence"),
    ("data-governance", "Data Governance",
     "Data governance porządkuje decyzje o danych: kto decyduje, jakie są zasady i jak eskalujemy problemy.",
     "Data governance clarifies decisions: who decides, which policies apply, and how issues escalate.",
     "RACI, policies, issue workflow, decision log",
     "RACI + policy catalog",
     "policies + roles + workflow"),
    ("data-quality-management", "Data Quality Management (DQ SLAs)",
     "Jakość danych musi być mierzona i zarządzana jak SLO: reguły, SLA, monitoring i remediation.",
     "Data quality must be managed like SLOs: rules, SLAs, monitoring, remediation.",
     "DQ rules, SLAs, dashboards, remediation backlog",
     "DQ scorecards + rule catalog",
     "dqRules + slas + owners; initiatives trace to ruleId"),
    ("ai-use-case-factory", "AI Use-Case Factory",
     "AI Use-Case Factory zamienia pomysły na pipeline: intake, wykonalność, ryzyko, MVP i skala.",
     "An AI use-case factory turns ideas into a pipeline: intake, feasibility, risk, MVP, scale.",
     "use-case backlog, feasibility scoring, MVP definition, scale checklist",
     "funnel + scorecards",
     "useCases[] + scores + risk flags; traceability to business KPI"),
    ("process-mining", "Process Mining (Discovery & Conformance)",
     "Process mining pokazuje prawdziwy proces z danych, a nie z opinii: warianty, bottlenecks i odchylenia.",
     "Process mining shows the real process from data, not opinions: variants, bottlenecks, deviations.",
     "as-is model, conformance gaps, bottlenecks, candidates",
     "process model + variant chart",
     "eventLogs → model + gaps; initiatives trace to variant/bottleneck"),
    ("automation-opportunity-assessment", "Automation Opportunity Assessment",
     "Zamiast automatyzować wszystko, oceniasz ROI, wykonalność i ryzyko — i budujesz backlog automatyzacji.",
     "Instead of automating everything, you score ROI, feasibility, and risk—then build a backlog.",
     "automation backlog, scoring, delivery approach recommendation",
     "ROI vs feasibility matrix",
     "candidates[] scored; initiatives trace to candidateId"),
    ("customer-journey-digitization-map", "Customer Journey Digitization Map",
     "Mapa podróży klienta wskazuje momenty, które trzeba zdigitalizować, by poprawić doświadczenie i KPI.",
     "A journey digitization map identifies moments to digitize to improve experience and KPIs.",
     "journey map, moments that matter, enablers, initiatives",
     "journey map + heatmap",
     "journeySteps + painPoints; initiatives trace to momentId"),
    ("product-operating-model", "Product Operating Model",
     "Model produktowy definiuje ownership, zespoły i metryki — żeby delivery było przewidywalne.",
     "A product operating model defines ownership, teams, and metrics for predictable delivery.",
     "team topology, ownership model, OKRs, governance cadence",
     "team topology map + OKR tree",
     "teams + ownership + okrs; initiatives trace to objectiveId"),
    ("agile-at-scale", "Agile at Scale",
     "Skalowanie agile to spójny rytm i governance wielu zespołów — z metrykami flow i jakości.",
     "Agile at scale is a coherent cadence and governance across teams—with flow and quality metrics.",
     "ways of working, cadence, flow metrics, improvement backlog",
     "cadence calendar + flow dashboard",
     "cadence + policies + metrics"),
    ("capability-skills-gap-analysis", "Capability / Skills Gap Analysis",
     "Bez kompetencji transformacja się zatrzyma. Ten moduł mapuje luki i plan: build/buy/partner.",
     "Without capabilities, transformation stalls. This maps gaps and a build/buy/partner plan.",
     "capability map, gaps, hiring/training plan, initiatives",
     "capability heatmap",
     "capabilities + current/target levels; initiatives trace to capabilityId"),
    ("change-management-plan-adkar", "Change Management Plan (ADKAR + Adoption)",
     "Transformacja to zmiana zachowań. ADKAR daje plan adopcji: komunikacja, szkolenia, feedback i metryki.",
     "Transformation is behavior change. ADKAR provides an adoption plan: comms, training, feedback, metrics.",
     "stakeholders, ADKAR plan, training, adoption KPIs, risk log",
     "stakeholder map + ADKAR board",
     "adkar plan + adoption KPIs; traceability to initiative"),
    ("digital-risk-assessment", "Digital Risk Assessment (Security/Privacy/Compliance)",
     "Szybkość bez kontroli ryzyka kończy się incydentami. Ten moduł mapuje ryzyka i wymagane kontrole.",
     "Speed without risk control ends in incidents. This maps risks and required controls.",
     "risk register, required controls, mitigations, go/no-go flags",
     "risk register + control mapping",
     "risks[] + controls[]; mitigations as initiatives"),
]


def render(slug: str, tool: str, pl_hook: str, en_hook: str, outputs: str, visual: str, impl: str) -> str:
    return f"""# {tool} — intro script (45–60s)

## Metadata
- **Tool**: {tool}
- **Slug**: `{slug}`
- **Length**: 45–60s

## VO (PL)
„{pl_hook} W narzędziu przechodzisz szybki setup, zbierasz kluczowe dane i budujesz artefakt: {outputs}. Kluczowy moment to {visual} — tam widać priorytety i zależności. Na końcu generujesz inicjatywy z pełną traceability i eksportujesz raport gotowy do omówienia z zespołem lub zarządem.”

## VO (EN)
"{en_hook} In the tool you do a quick setup, collect the key inputs, and build the artifact: {outputs}. The key moment is the {visual}—that is where priorities and dependencies become clear. Finally, you generate initiatives with full traceability and export a client-ready report."

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
    created = 0
    for slug, tool, pl_hook, en_hook, outputs, visual, impl in TOOLS:
        path = MOVIE_DIR / f"{slug}.md"
        if path.exists():
            # do not overwrite existing strategy/ops scripts with the same slug (should not happen)
            continue
        path.write_text(render(slug, tool, pl_hook, en_hook, outputs, visual, impl), encoding="utf-8")
        created += 1
    print(f"Created {created} transformation movie scripts in {MOVIE_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

