import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createConsultingMissionContext } from "@/config/consultingToolsStandard";
import { evaluateSwotAcceptGate, stampAcceptedSwotItem } from "@/config/swot/swotAcceptGate";
import {
  dynamicSwotPack,
  getDynamicSwotPackForCurrentFlags
} from "@/toolPacks/packs/dynamicSwot.pack";
const SWOT_STEPS = [
  {
    id: "mission",
    name: "Mission & Context",
    namePl: "Misja i kontekst",
    description: "Define the strategic question, scope, success criteria, and decision frame",
    descriptionPl: "Zdefiniuj pytanie strategiczne, zakres, kryteria sukcesu i ram\u0119 decyzji",
    required: true,
    aiAssisted: false
  },
  {
    id: "input",
    name: "Input & Exploration",
    namePl: "Wej\u015Bcie i eksploracja",
    description: "Capture interview notes, materials, and external context as shared signals",
    descriptionPl: "Zbierz wywiad, materia\u0142y i kontekst zewn\u0119trzny jako wsp\xF3lne sygna\u0142y",
    required: true,
    aiAssisted: true
  },
  {
    id: "swot",
    name: "SWOT Build",
    namePl: "Budowa SWOT",
    description: "Turn signals into a concrete matrix of strengths, weaknesses, opportunities, and threats",
    descriptionPl: "Zamie\u0144 sygna\u0142y w konkretn\u0105 macierz mocnych stron, s\u0142abych stron, szans i zagro\u017Ce\u0144",
    required: true,
    aiAssisted: true
  },
  {
    id: "insights",
    name: "Synthesis & Insights",
    namePl: "Synteza i napi\u0119cia",
    description: "Convert the matrix into tensions, applied conclusions, and strategic moves",
    descriptionPl: "Przekszta\u0142\u0107 macierz w napi\u0119cia, wnioski aplikowalne i ruchy strategiczne",
    required: true,
    aiAssisted: true
  },
  {
    id: "outputs",
    name: "Outputs & Actions",
    namePl: "Wyniki i dzia\u0142ania",
    description: "Prepare the final source summary and generate downstream outputs and initiatives",
    descriptionPl: "Przygotuj final source summary oraz wygeneruj outputy i inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const PORTER_STEPS = [
  {
    id: "mission",
    name: "Mission & Market Context",
    namePl: "Misja i kontekst rynku",
    description: "Define the market, scope, decision frame, and success signal",
    descriptionPl: "Zdefiniuj rynek, zakres, ram\u0119 decyzji i sygna\u0142 sukcesu",
    required: true,
    aiAssisted: false
  },
  {
    id: "input",
    name: "Input & Exploration",
    namePl: "Wej\u015Bcie i eksploracja",
    description: "Capture market evidence, interview notes, benchmarks, and competitive signals",
    descriptionPl: "Zbierz dowody rynkowe, wywiad, benchmarki i sygna\u0142y konkurencyjne",
    required: true,
    aiAssisted: true
  },
  {
    id: "forces",
    name: "Five Forces Build",
    namePl: "Budowa pi\u0119ciu si\u0142",
    description: "Turn signals into scored Porter forces with drivers, evidence, and confidence",
    descriptionPl: "Zamie\u0144 sygna\u0142y w ocenione si\u0142y Portera z driverami, dowodami i confidence",
    required: true,
    aiAssisted: true
  },
  {
    id: "insights",
    name: "Strategic Implications",
    namePl: "Implikacje strategiczne",
    description: "Synthesize market structure into margin pressure, levers, and strategic moves",
    descriptionPl: "Przekszta\u0142\u0107 struktur\u0119 rynku w presj\u0119 mar\u017Cy, d\u017Awignie i ruchy strategiczne",
    required: true,
    aiAssisted: true
  },
  {
    id: "outputs",
    name: "Outputs & Actions",
    namePl: "Wyniki i dzia\u0142ania",
    description: "Prepare the final source summary and generate downstream outputs and initiatives",
    descriptionPl: "Przygotuj final source summary oraz wygeneruj outputy i inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const VALUE_CHAIN_STEPS = [
  {
    id: "mission",
    name: "Mission & Scope",
    namePl: "Misja i zakres",
    description: "Define the business, value chain scope, strategic positioning, and success signal",
    descriptionPl: "Zdefiniuj biznes, zakres \u0142a\u0144cucha warto\u015Bci, pozycjonowanie i sygna\u0142 sukcesu",
    required: true,
    aiAssisted: false
  },
  {
    id: "input",
    name: "Input & Exploration",
    namePl: "Wej\u015Bcie i eksploracja",
    description: "Capture cost, operations, and differentiation signals from context and interviews",
    descriptionPl: "Zbierz sygna\u0142y kosztu, operacji i r\xF3\u017Cnicowania z kontekstu i wywiad\xF3w",
    required: true,
    aiAssisted: true
  },
  {
    id: "activities",
    name: "Value Chain Build",
    namePl: "Budowa \u0142a\u0144cucha warto\u015Bci",
    description: "Map the 9 activities with cost contribution, value contribution, and margin role",
    descriptionPl: "Zmapuj 9 aktywno\u015Bci wg kontrybucji kosztu, warto\u015Bci i roli w mar\u017Cy",
    required: true,
    aiAssisted: true
  },
  {
    id: "insights",
    name: "Margin Levers & Moves",
    namePl: "D\u017Awignie mar\u017Cy i ruchy",
    description: "Synthesize the chain into margin levers, a positioning verdict, and strategic moves",
    descriptionPl: "Przekszta\u0142\u0107 \u0142a\u0144cuch w d\u017Awignie mar\u017Cy, werdykt pozycjonowania i ruchy strategiczne",
    required: true,
    aiAssisted: true
  },
  {
    id: "outputs",
    name: "Outputs & Actions",
    namePl: "Wyniki i dzia\u0142ania",
    description: "Prepare the final source summary and generate downstream outputs and initiatives",
    descriptionPl: "Przygotuj final source summary oraz wygeneruj wyniki i inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const CAPABILITY_MAPPER_STEPS = [
  {
    id: "mission",
    name: "Mission & Scope",
    namePl: "Misja i zakres",
    description: "Define the strategic priorities, capability domains, and success signal",
    descriptionPl: "Zdefiniuj priorytety strategiczne, domeny zdolno\u015Bci i sygna\u0142 sukcesu",
    required: true,
    aiAssisted: false
  },
  {
    id: "input",
    name: "Input & Exploration",
    namePl: "Wej\u015Bcie i eksploracja",
    description: "Capture capability signals from context, interviews, and benchmarks",
    descriptionPl: "Zbierz sygna\u0142y o zdolno\u015Bciach z kontekstu, wywiad\xF3w i benchmark\xF3w",
    required: true,
    aiAssisted: true
  },
  {
    id: "capabilities",
    name: "Capability Map",
    namePl: "Mapa zdolno\u015Bci",
    description: "Score capabilities on current vs target maturity and strategic importance",
    descriptionPl: "Oce\u0144 zdolno\u015Bci wg dojrza\u0142o\u015Bci obecnej/docelowej i wa\u017Cno\u015Bci strategicznej",
    required: true,
    aiAssisted: true
  },
  {
    id: "insights",
    name: "Gaps & Moves",
    namePl: "Luki i ruchy",
    description: "Synthesize maturity gaps into priorities and build/buy/partner moves",
    descriptionPl: "Przekszta\u0142\u0107 luki dojrza\u0142o\u015Bci w priorytety i ruchy build/buy/partner",
    required: true,
    aiAssisted: true
  },
  {
    id: "outputs",
    name: "Outputs & Actions",
    namePl: "Wyniki i dzia\u0142ania",
    description: "Prepare the final source summary and generate downstream outputs and initiatives",
    descriptionPl: "Przygotuj final source summary oraz wygeneruj wyniki i inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const AMBITION_DECOMPOSER_STEPS = [
  {
    id: "mission",
    name: "Ambition & Scope",
    namePl: "Ambicja i zakres",
    description: "State the ambition, scope, time horizon, and success signal",
    descriptionPl: "Okre\u015Bl ambicj\u0119, zakres, horyzont czasowy i sygna\u0142 sukcesu",
    required: true,
    aiAssisted: false
  },
  {
    id: "input",
    name: "Input & Exploration",
    namePl: "Wej\u015Bcie i eksploracja",
    description: "Capture signals that inform how the ambition can be decomposed",
    descriptionPl: "Zbierz sygna\u0142y, jak roz\u0142o\u017Cy\u0107 ambicj\u0119 na czynniki",
    required: true,
    aiAssisted: true
  },
  {
    id: "themes",
    name: "Strategic Themes",
    namePl: "Tematy strategiczne",
    description: "Decompose the ambition into strategic themes with measurable targets",
    descriptionPl: "Roz\u0142\xF3\u017C ambicj\u0119 na tematy strategiczne z mierzalnymi celami",
    required: true,
    aiAssisted: true
  },
  {
    id: "insights",
    name: "Priorities & Moves",
    namePl: "Priorytety i ruchy",
    description: "Sequence themes into priorities and enabling strategic moves",
    descriptionPl: "U\u0142\xF3\u017C tematy w priorytety i wspieraj\u0105ce ruchy strategiczne",
    required: true,
    aiAssisted: true
  },
  {
    id: "outputs",
    name: "Outputs & Actions",
    namePl: "Wyniki i dzia\u0142ania",
    description: "Prepare the final source summary and generate downstream outputs and initiatives",
    descriptionPl: "Przygotuj final source summary oraz wygeneruj wyniki i inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const FOCUS_TRADEOFF_STEPS = [
  {
    id: "mission",
    name: "Focus Question & Criteria",
    namePl: "Pytanie i kryteria",
    description: "Frame the competing priorities, decision criteria, and success signal",
    descriptionPl: "Okre\u015Bl konkuruj\u0105ce priorytety, kryteria decyzji i sygna\u0142 sukcesu",
    required: true,
    aiAssisted: false
  },
  {
    id: "input",
    name: "Input & Exploration",
    namePl: "Wej\u015Bcie i eksploracja",
    description: "Capture signals about the competing options and what matters",
    descriptionPl: "Zbierz sygna\u0142y o konkuruj\u0105cych opcjach i tym, co si\u0119 liczy",
    required: true,
    aiAssisted: true
  },
  {
    id: "priorities",
    name: "Score Priorities",
    namePl: "Ocena priorytet\xF3w",
    description: "Score competing priorities on value, effort, and strategic fit",
    descriptionPl: "Oce\u0144 konkuruj\u0105ce priorytety wg warto\u015Bci, wysi\u0142ku i dopasowania",
    required: true,
    aiAssisted: true
  },
  {
    id: "insights",
    name: "Trade-offs & Decision",
    namePl: "Kompromisy i decyzja",
    description: "Expose trade-offs and decide what to commit, sequence, or cut",
    descriptionPl: "Poka\u017C kompromisy i zdecyduj, co podj\u0105\u0107, u\u0142o\u017Cy\u0107 w czasie lub odrzuci\u0107",
    required: true,
    aiAssisted: true
  },
  {
    id: "outputs",
    name: "Outputs & Actions",
    namePl: "Wyniki i dzia\u0142ania",
    description: "Prepare the final source summary and generate downstream outputs and initiatives",
    descriptionPl: "Przygotuj final source summary oraz wygeneruj wyniki i inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const NARRATIVE_ENGINE_STEPS = [
  {
    id: "mission",
    name: "Audience & Core Message",
    namePl: "Audytorium i przekaz",
    description: "Define the audience, the core message, and the success signal",
    descriptionPl: "Okre\u015Bl audytorium, g\u0142\xF3wny przekaz i sygna\u0142 sukcesu",
    required: true,
    aiAssisted: false
  },
  {
    id: "input",
    name: "Input & Exploration",
    namePl: "Wej\u015Bcie i eksploracja",
    description: "Capture proof points, audience insights, and supporting evidence",
    descriptionPl: "Zbierz dowody, insighty o audytorium i materia\u0142 wspieraj\u0105cy",
    required: true,
    aiAssisted: true
  },
  {
    id: "pillars",
    name: "Narrative Pillars",
    namePl: "Filary narracji",
    description: "Build message pillars, each with proof points and audience resonance",
    descriptionPl: "Zbuduj filary przekazu z dowodami i rezonansem u audytorium",
    required: true,
    aiAssisted: true
  },
  {
    id: "insights",
    name: "Storyline & Moves",
    namePl: "Narracja i ruchy",
    description: "Weave pillars into a storyline arc and decide delivery moves",
    descriptionPl: "U\u0142\xF3\u017C filary w \u0142uk narracyjny i zdecyduj o ruchach przekazu",
    required: true,
    aiAssisted: true
  },
  {
    id: "outputs",
    name: "Outputs & Actions",
    namePl: "Wyniki i dzia\u0142ania",
    description: "Prepare the final source summary and generate downstream outputs and initiatives",
    descriptionPl: "Przygotuj final source summary oraz wygeneruj wyniki i inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const GROWTH_PATHS_STEPS = [
  {
    id: "mission",
    name: "Growth Mission & Context",
    namePl: "Misja wzrostu i kontekst",
    description: "Define the growth ambition, scope, constraints, and success signal",
    descriptionPl: "Zdefiniuj ambicj\u0119 wzrostu, zakres, ograniczenia i sygna\u0142 sukcesu",
    required: true,
    aiAssisted: false
  },
  {
    id: "input",
    name: "Input & Exploration",
    namePl: "Wej\u015Bcie i eksploracja",
    description: "Capture growth signals from interviews, organization context, and market evidence",
    descriptionPl: "Zbierz sygna\u0142y wzrostu z wywiad\xF3w, kontekstu organizacji i rynku",
    required: true,
    aiAssisted: true
  },
  {
    id: "options",
    name: "Ansoff Options Build",
    namePl: "Budowa opcji Ansoffa",
    description: "Turn signals into growth options across the four Ansoff quadrants",
    descriptionPl: "Zamie\u0144 sygna\u0142y w opcje wzrostu w czterech polach Ansoffa",
    required: true,
    aiAssisted: true
  },
  {
    id: "insights",
    name: "Strategic Comparison",
    namePl: "Por\xF3wnanie strategiczne",
    description: "Compare options, expose trade-offs, and select recommended growth moves",
    descriptionPl: "Por\xF3wnaj opcje, poka\u017C trade-offy i wybierz rekomendowane ruchy wzrostu",
    required: true,
    aiAssisted: true
  },
  {
    id: "outputs",
    name: "Outputs & Actions",
    namePl: "Wyniki i dzia\u0142ania",
    description: "Prepare the final source summary and downstream growth initiatives",
    descriptionPl: "Przygotuj final source summary oraz dalsze inicjatywy wzrostowe",
    required: true,
    aiAssisted: true
  }
];
const PORTFOLIO_PRIORITY_STEPS = [
  {
    id: "mission",
    name: "Portfolio Mission & Context",
    namePl: "Misja portfela i kontekst",
    description: "Define the portfolio scope, decision frame, constraints, and success signal",
    descriptionPl: "Zdefiniuj zakres portfolio, ram\u0119 decyzji, ograniczenia i sygna\u0142 sukcesu",
    required: true,
    aiAssisted: false
  },
  {
    id: "input",
    name: "Input & Exploration",
    namePl: "Wej\u015Bcie i eksploracja",
    description: "Capture portfolio evidence, constraints, performance signals, and sponsor context",
    descriptionPl: "Zbierz dowody portfolio, ograniczenia, sygna\u0142y wynik\xF3w i kontekst sponsora",
    required: true,
    aiAssisted: true
  },
  {
    id: "items",
    name: "Portfolio Items & Matrix",
    namePl: "Elementy portfela i macierz",
    description: "Score portfolio items and classify them into BCG-style categories",
    descriptionPl: "Oce\u0144 elementy portfolio i sklasyfikuj je w kategoriach BCG",
    required: true,
    aiAssisted: true
  },
  {
    id: "insights",
    name: "Trade-offs & Priorities",
    namePl: "Trade-offy i priorytety",
    description: "Synthesize trade-offs, portfolio bets, and recommended resource moves",
    descriptionPl: "Syntezuj trade-offy, top bety i rekomendowane przesuni\u0119cia zasob\xF3w",
    required: true,
    aiAssisted: true
  },
  {
    id: "outputs",
    name: "Outputs & Actions",
    namePl: "Wyniki i dzia\u0142ania",
    description: "Prepare the final source summary and downstream portfolio actions",
    descriptionPl: "Przygotuj final source summary oraz dalsze dzia\u0142ania portfolio",
    required: true,
    aiAssisted: true
  }
];
const RISK_UNCERTAINTY_STEPS = [
  {
    id: "mission",
    name: "Risk Mission & Context",
    namePl: "Misja i kontekst",
    description: "Define the decision, uncertainty scope, constraints, and success signal",
    descriptionPl: "Zdefiniuj decyzj\u0119, zakres niepewno\u015Bci, ograniczenia i sygna\u0142 sukcesu",
    required: true,
    aiAssisted: false
  },
  {
    id: "input",
    name: "Input & Exploration",
    namePl: "Wej\u015Bcie i eksploracja",
    description: "Capture weak signals, constraints, evidence, and uncertainty cues",
    descriptionPl: "Zbierz s\u0142abe sygna\u0142y, ograniczenia, evidence i wskaz\xF3wki niepewno\u015Bci",
    required: true,
    aiAssisted: true
  },
  {
    id: "assumptions",
    name: "Assumptions & Risk Map",
    namePl: "Za\u0142o\u017Cenia i mapa ryzyk",
    description: "Turn signals into assumptions, risks, and plausible scenarios",
    descriptionPl: "Zamie\u0144 sygna\u0142y w za\u0142o\u017Cenia, ryzyka i scenariusze",
    required: true,
    aiAssisted: true
  },
  {
    id: "insights",
    name: "Risk Synthesis",
    namePl: "Synteza ryzyka",
    description: "Synthesize risk posture, early warnings, and recommended resilience moves",
    descriptionPl: "Syntezuj postaw\u0119 ryzyka, early warnings i rekomendowane ruchy odporno\u015Bci",
    required: true,
    aiAssisted: true
  },
  {
    id: "outputs",
    name: "Outputs & Actions",
    namePl: "Wyniki i dzia\u0142ania",
    description: "Prepare the final source summary and downstream resilience actions",
    descriptionPl: "Przygotuj final source summary oraz dalsze dzia\u0142ania odporno\u015Bci",
    required: true,
    aiAssisted: true
  }
];
const SOP_STEPS = [
  {
    id: "context",
    name: "SOP Context",
    namePl: "Kontekst SOP",
    description: "Define scope and critical operations",
    descriptionPl: "Zdefiniuj zakres i krytyczne operacje",
    required: true,
    aiAssisted: false
  },
  {
    id: "standards",
    name: "Standards",
    namePl: "Standardy",
    description: "List key standards and quality criteria",
    descriptionPl: "Lista standard\xF3w i kryteri\xF3w jako\u015Bci",
    required: true,
    aiAssisted: true
  },
  {
    id: "checklists",
    name: "Checklists",
    namePl: "Checklisty",
    description: "Define checklists and verification steps",
    descriptionPl: "Zdefiniuj checklisty i kroki weryfikacji",
    required: true,
    aiAssisted: true
  },
  {
    id: "summary",
    name: "Summary & Initiatives",
    namePl: "Podsumowanie i Inicjatywy",
    description: "Summarize SOP and generate initiatives",
    descriptionPl: "Podsumuj SOP i wygeneruj inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const A3_STEPS = [
  {
    id: "context",
    name: "Problem Context",
    namePl: "Kontekst Problemu",
    description: "Define the problem and scope",
    descriptionPl: "Zdefiniuj problem i zakres",
    required: true,
    aiAssisted: false
  },
  {
    id: "problem",
    name: "Problem Statement",
    namePl: "Opis Problemu",
    description: "Describe the problem and current impact",
    descriptionPl: "Opisz problem i wp\u0142yw",
    required: true,
    aiAssisted: true
  },
  {
    id: "root-cause",
    name: "Root Cause",
    namePl: "Przyczyna \u0179r\xF3d\u0142owa",
    description: "Identify root causes (5 Why)",
    descriptionPl: "Zidentyfikuj przyczyny \u017Ar\xF3d\u0142owe (5 Why)",
    required: true,
    aiAssisted: true
  },
  {
    id: "countermeasures",
    name: "Countermeasures",
    namePl: "\u015Arodki Zaradcze",
    description: "Define countermeasures and follow-up",
    descriptionPl: "Zdefiniuj \u015Brodki zaradcze i follow-up",
    required: true,
    aiAssisted: true
  },
  {
    id: "summary",
    name: "Summary & Initiatives",
    namePl: "Podsumowanie i Inicjatywy",
    description: "Summarize A3 and generate initiatives",
    descriptionPl: "Podsumuj A3 i wygeneruj inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const SMED_STEPS = [
  {
    id: "context",
    name: "Changeover Context",
    namePl: "Kontekst Przezbrojen",
    description: "Define scope and changeover baseline",
    descriptionPl: "Zdefiniuj zakres i baz\u0119 przezbroje\u0144",
    required: true,
    aiAssisted: false
  },
  {
    id: "changeover-steps",
    name: "Changeover Steps",
    namePl: "Kroki Przezbrojenia",
    description: "List internal/external steps and durations",
    descriptionPl: "Lista krok\xF3w wewn\u0119trznych/zewn\u0119trznych i czasu",
    required: true,
    aiAssisted: true
  },
  {
    id: "improvements",
    name: "Improvements",
    namePl: "Usprawnienia",
    description: "Identify quick wins and investments",
    descriptionPl: "Zidentyfikuj quick wins i inwestycje",
    required: true,
    aiAssisted: true
  },
  {
    id: "summary",
    name: "Summary & Initiatives",
    namePl: "Podsumowanie i Inicjatywy",
    description: "Summarize SMED and generate initiatives",
    descriptionPl: "Podsumuj SMED i wygeneruj inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const DMS_STEPS = [
  {
    id: "context",
    name: "DMS Context",
    namePl: "Kontekst DMS",
    description: "Define scope and governance",
    descriptionPl: "Zdefiniuj zakres i governance",
    required: true,
    aiAssisted: false
  },
  {
    id: "kpis",
    name: "KPIs",
    namePl: "KPI",
    description: "Define KPI boards and thresholds",
    descriptionPl: "Zdefiniuj KPI i progi",
    required: true,
    aiAssisted: true
  },
  {
    id: "escalation",
    name: "Escalation Rules",
    namePl: "Regu\u0142y Eskalacji",
    description: "Define escalation rules and cadence",
    descriptionPl: "Zdefiniuj regu\u0142y eskalacji i rytm",
    required: true,
    aiAssisted: true
  },
  {
    id: "summary",
    name: "Summary & Initiatives",
    namePl: "Podsumowanie i Inicjatywy",
    description: "Summarize DMS and generate initiatives",
    descriptionPl: "Podsumuj DMS i wygeneruj inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const INVENTORY_STEPS = [
  {
    id: "context",
    name: "Inventory Context",
    namePl: "Kontekst Zapas\xF3w",
    description: "Define scope and inventory objectives",
    descriptionPl: "Zdefiniuj zakres i cele zapas\xF3w",
    required: true,
    aiAssisted: false
  },
  {
    id: "sku-classification",
    name: "SKU Classification",
    namePl: "Klasyfikacja SKU",
    description: "Define ABC/XYZ classification",
    descriptionPl: "Zdefiniuj klasyfikacj\u0119 ABC/XYZ",
    required: true,
    aiAssisted: true
  },
  {
    id: "replenishment",
    name: "Replenishment Policies",
    namePl: "Polityki Uzupe\u0142niania",
    description: "Define policies and reorder triggers",
    descriptionPl: "Zdefiniuj polityki i punkty uzupe\u0142niania",
    required: true,
    aiAssisted: true
  },
  {
    id: "summary",
    name: "Summary & Initiatives",
    namePl: "Podsumowanie i Inicjatywy",
    description: "Summarize inventory and generate initiatives",
    descriptionPl: "Podsumuj zapasy i wygeneruj inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const TOOLSET_OPERATIONAL_STEPS = [
  {
    id: "context",
    name: "Operational Context",
    namePl: "Kontekst Operacyjny",
    description: "Define goal, scope, and time horizon for the operational tool",
    descriptionPl: "Zdefiniuj cel, zakres i horyzont czasowy narz\u0119dzia operacyjnego",
    required: true,
    aiAssisted: false
  },
  {
    id: "fill",
    name: "Fill",
    namePl: "Wype\u0142nij",
    description: "Capture current-state signals and improvement ideas",
    descriptionPl: "Zbierz sygna\u0142y stanu obecnego i pomys\u0142y usprawnie\u0144",
    required: true,
    aiAssisted: true
  },
  {
    id: "impact-hypothesis",
    name: "Impact Hypothesis",
    namePl: "Hipoteza wp\u0142ywu",
    description: "Define baseline \u2192 target and assumptions (measurable)",
    descriptionPl: "Zdefiniuj baseline \u2192 target i za\u0142o\u017Cenia (mierzalne)",
    required: true,
    aiAssisted: false
  },
  {
    id: "results",
    name: "Results",
    namePl: "Wyniki",
    description: "Summarize key findings and expected impact",
    descriptionPl: "Podsumuj kluczowe wnioski i oczekiwany wp\u0142yw",
    required: true,
    aiAssisted: true
  },
  {
    id: "reasoning",
    name: "Reasoning",
    namePl: "Uzasadnienie",
    description: "Explain why these results follow from inputs and evidence",
    descriptionPl: "Wyja\u015Bnij, dlaczego te wyniki wynikaj\u0105 z wej\u015B\u0107 i evidence",
    required: true,
    aiAssisted: true
  },
  {
    id: "prepare",
    name: "Prepare",
    namePl: "Przygotuj",
    description: "Define next steps, owners, and what data is needed",
    descriptionPl: "Zdefiniuj kolejne kroki, owner\xF3w i potrzebne dane",
    required: true,
    aiAssisted: false
  },
  {
    id: "report",
    name: "Report / Deck",
    namePl: "Raport / Deck",
    description: "Export and package outcomes for stakeholders",
    descriptionPl: "Wyeksportuj i zapakuj wyniki dla stakeholder\xF3w",
    required: false,
    aiAssisted: false
  },
  {
    id: "initiatives",
    name: "Initiatives",
    namePl: "Inicjatywy",
    description: "Turn findings into draft initiatives and execution plan",
    descriptionPl: "Prze\u0142\xF3\u017C wnioski na draft inicjatyw i plan realizacji",
    required: false,
    aiAssisted: true
  }
];
const TOOLSET_DIGITAL_STEPS = [
  {
    id: "context",
    name: "Digital Context",
    namePl: "Kontekst Cyfrowy",
    description: "Define the transformation scope and desired outcomes",
    descriptionPl: "Zdefiniuj zakres transformacji i po\u017C\u0105dane outcomes",
    required: true,
    aiAssisted: false
  },
  {
    id: "fill",
    name: "Fill",
    namePl: "Wype\u0142nij",
    description: "Capture pains, opportunities, constraints, and candidate solutions",
    descriptionPl: "Zbierz b\xF3le, szanse, ograniczenia i kandydat\xF3w rozwi\u0105za\u0144",
    required: true,
    aiAssisted: true
  },
  ...TOOLSET_OPERATIONAL_STEPS.filter((s) => !["context", "fill"].includes(s.id))
];
const AI_DISCOVERY_STEPS = [
  {
    id: "context",
    name: "Discovery Context",
    namePl: "Kontekst Odkrycia",
    description: "Define the function, data landscape, and AI ambition",
    descriptionPl: "Zdefiniuj funkcj\u0119, krajobraz danych i ambicj\u0119 AI",
    required: true,
    aiAssisted: false
  },
  {
    id: "use-cases",
    name: "Use cases",
    namePl: "Case'y u\u017Cycia",
    description: "Shortlist candidate AI use cases by value and feasibility",
    descriptionPl: "Wyselekcjonuj kandyduj\u0105ce case AI wg warto\u015Bci i wykonalno\u015Bci",
    required: true,
    aiAssisted: true
  },
  {
    id: "prerequisites",
    name: "Prerequisites",
    namePl: "Prerekwizyty",
    description: "Capture data, skills, and platform prerequisites",
    descriptionPl: "Zbierz prerekwizyty danych, kompetencji i platformy",
    required: true,
    aiAssisted: true
  },
  {
    id: "pilot-plan",
    name: "Pilot plan",
    namePl: "Plan pilota",
    description: "Define the first pilot, owners, and success signals",
    descriptionPl: "Zdefiniuj pierwszy pilot, owner\xF3w i sygna\u0142y sukcesu",
    required: true,
    aiAssisted: true
  },
  {
    id: "summary",
    name: "Summary & Initiatives",
    namePl: "Podsumowanie i Inicjatywy",
    description: "Summarize discovery and generate initiatives",
    descriptionPl: "Podsumuj odkrycie i wygeneruj inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const PAIN_EXPLORER_STEPS = [
  {
    id: "context",
    name: "Pain Context",
    namePl: "Kontekst B\xF3lu",
    description: "Define the process, stakeholders, and pain surface",
    descriptionPl: "Zdefiniuj proces, interesariuszy i powierzchni\u0119 b\xF3lu",
    required: true,
    aiAssisted: false
  },
  {
    id: "problems",
    name: "Problems",
    namePl: "Problemy",
    description: "Capture the observed problems and their symptoms",
    descriptionPl: "Zbierz zaobserwowane problemy i ich objawy",
    required: true,
    aiAssisted: true
  },
  {
    id: "hypotheses",
    name: "Hypotheses",
    namePl: "Hipotezy",
    description: "Frame root-cause hypotheses to validate",
    descriptionPl: "Sformu\u0142uj hipotezy przyczyn \u017Ar\xF3d\u0142owych do walidacji",
    required: true,
    aiAssisted: true
  },
  {
    id: "evidence-gaps",
    name: "Evidence gaps",
    namePl: "Luki w dowodach",
    description: "List the evidence still needed to confirm each hypothesis",
    descriptionPl: "Wypisz dowody potrzebne do potwierdzenia ka\u017Cdej hipotezy",
    required: true,
    aiAssisted: true
  },
  {
    id: "summary",
    name: "Summary & Initiatives",
    namePl: "Podsumowanie i Inicjatywy",
    description: "Summarize pains and generate initiatives",
    descriptionPl: "Podsumuj b\xF3le i wygeneruj inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const RPA_SCANNER_STEPS = [
  {
    id: "context",
    name: "Automation Context",
    namePl: "Kontekst Automatyzacji",
    description: "Define the process family and automation goal",
    descriptionPl: "Zdefiniuj rodzin\u0119 proces\xF3w i cel automatyzacji",
    required: true,
    aiAssisted: false
  },
  {
    id: "candidates",
    name: "Candidates",
    namePl: "Kandydaci",
    description: "List candidate processes for RPA",
    descriptionPl: "Wypisz procesy kandyduj\u0105ce do RPA",
    required: true,
    aiAssisted: true
  },
  {
    id: "sizing",
    name: "Sizing",
    namePl: "Sizing",
    description: "Size each candidate by volume, effort, and complexity",
    descriptionPl: "Oszacuj ka\u017Cdego kandydata wg wolumenu, wysi\u0142ku i z\u0142o\u017Cono\u015Bci",
    required: true,
    aiAssisted: true
  },
  {
    id: "backlog",
    name: "Backlog",
    namePl: "Backlog",
    description: "Prioritize the automation backlog",
    descriptionPl: "Spriorytetyzuj backlog automatyzacji",
    required: true,
    aiAssisted: true
  },
  {
    id: "summary",
    name: "Summary & Initiatives",
    namePl: "Podsumowanie i Inicjatywy",
    description: "Summarize the scan and generate initiatives",
    descriptionPl: "Podsumuj skan i wygeneruj inicjatywy",
    required: true,
    aiAssisted: true
  }
];
const PROCESS_AUTOMATION_STEPS = [
  {
    id: "context",
    name: "Identification",
    namePl: "Identyfikacja",
    description: "Identify the process and define the automation goal",
    descriptionPl: "Zidentyfikuj proces i zdefiniuj cel automatyzacji",
    required: true,
    aiAssisted: false
  },
  {
    id: "process-mapping",
    name: "Process Mapping",
    namePl: "Mapowanie procesu",
    description: "Capture the key steps and handoffs",
    descriptionPl: "Zbierz kluczowe kroki i handoffy",
    required: true,
    aiAssisted: true
  },
  {
    id: "measurement",
    name: "Measurement",
    namePl: "Pomiar",
    description: "Baseline volume, time, errors, and constraints",
    descriptionPl: "Baseline: wolumen, czas, b\u0142\u0119dy i ograniczenia",
    required: true,
    aiAssisted: false
  },
  {
    id: "redesign",
    name: "Redesign",
    namePl: "Redesign",
    description: "Define the redesigned flow and automation candidates",
    descriptionPl: "Zdefiniuj nowy flow i kandydat\xF3w automatyzacji",
    required: true,
    aiAssisted: true
  },
  {
    id: "re-estimation",
    name: "Re-estimation",
    namePl: "Re-estymacja",
    description: "Estimate target cycle times and error rates after redesign",
    descriptionPl: "Oszacuj target czasy i b\u0142\u0119dy po redesignie",
    required: true,
    aiAssisted: false
  },
  {
    id: "economics",
    name: "Economics",
    namePl: "Ekonomia",
    description: "Calculate savings, payback, and ROI assumptions",
    descriptionPl: "Policz oszcz\u0119dno\u015Bci, payback i za\u0142o\u017Cenia ROI",
    required: true,
    aiAssisted: false
  },
  {
    id: "initiatives",
    name: "Initiatives",
    namePl: "Inicjatywy",
    description: "Translate the redesign into an execution-ready initiative set",
    descriptionPl: "Prze\u0142\xF3\u017C redesign na zestaw inicjatyw gotowych do realizacji",
    required: false,
    aiAssisted: true
  },
  {
    id: "report",
    name: "Report / Deck",
    namePl: "Raport / Deck",
    description: "Export and share outcomes",
    descriptionPl: "Wyeksportuj i udost\u0119pnij wyniki",
    required: false,
    aiAssisted: false
  }
];
const createInitialSWOTData = () => ({
  context: createConsultingMissionContext(),
  signals: [],
  items: [],
  correlations: [],
  tensions: [],
  recommendedMoves: [],
  outputCandidates: []
});
const createInitialPorterData = () => ({
  context: {
    industry: "",
    geographicScope: "",
    position: "challenger",
    goal: "",
    scope: "",
    successSignal: "",
    timeframe: "medium",
    constraints: "",
    assumptions: "",
    kpiTarget: ""
  },
  signals: [],
  forces: {
    rivalry: { id: "rivalry", name: "Competitive Rivalry", score: 3, trend: "stable", drivers: [] },
    newEntrants: {
      id: "newEntrants",
      name: "New Entrants",
      score: 3,
      trend: "stable",
      drivers: []
    },
    substitutes: { id: "substitutes", name: "Substitutes", score: 3, trend: "stable", drivers: [] },
    buyerPower: { id: "buyerPower", name: "Buyer Power", score: 3, trend: "stable", drivers: [] },
    supplierPower: {
      id: "supplierPower",
      name: "Supplier Power",
      score: 3,
      trend: "stable",
      drivers: []
    }
  },
  implications: [],
  recommendedMoves: [],
  outputCandidates: []
});
const makeValueActivity = (id, name, kind) => ({
  id,
  name,
  kind,
  costContribution: "medium",
  valueContribution: "medium",
  marginRole: "neutral",
  drivers: [],
  evidence: []
});
const createInitialValueChainData = () => ({
  context: {
    industry: "",
    valueChainScope: "",
    position: "undefined",
    goal: "",
    scope: "",
    successSignal: "",
    timeframe: "medium",
    constraints: "",
    assumptions: "",
    kpiTarget: ""
  },
  signals: [],
  activities: {
    inboundLogistics: makeValueActivity("inboundLogistics", "Inbound Logistics", "primary"),
    operations: makeValueActivity("operations", "Operations", "primary"),
    outboundLogistics: makeValueActivity("outboundLogistics", "Outbound Logistics", "primary"),
    marketingSales: makeValueActivity("marketingSales", "Marketing & Sales", "primary"),
    service: makeValueActivity("service", "Service", "primary"),
    infrastructure: makeValueActivity("infrastructure", "Firm Infrastructure", "support"),
    hrManagement: makeValueActivity("hrManagement", "HR Management", "support"),
    technology: makeValueActivity("technology", "Technology Development", "support"),
    procurement: makeValueActivity("procurement", "Procurement", "support")
  },
  levers: [],
  recommendedMoves: [],
  outputCandidates: []
});
const createInitialNarrativeEngineData = () => ({
  context: {
    audience: "",
    coreMessage: "",
    goal: "",
    scope: "",
    successSignal: "",
    timeframe: "medium",
    constraints: "",
    assumptions: "",
    kpiTarget: ""
  },
  signals: [],
  pillars: [],
  threads: [],
  recommendedMoves: [],
  outputCandidates: []
});
const createInitialFocusTradeoffData = () => ({
  context: {
    competingPriorities: "",
    decisionCriteria: "",
    goal: "",
    scope: "",
    successSignal: "",
    timeframe: "medium",
    constraints: "",
    assumptions: "",
    kpiTarget: ""
  },
  signals: [],
  priorities: [],
  tradeoffs: [],
  recommendedMoves: [],
  outputCandidates: []
});
const createInitialAmbitionDecomposerData = () => ({
  context: {
    ambitionStatement: "",
    scope: "",
    goal: "",
    successSignal: "",
    timeframe: "medium",
    constraints: "",
    assumptions: "",
    kpiTarget: ""
  },
  signals: [],
  themes: [],
  priorities: [],
  recommendedMoves: [],
  outputCandidates: []
});
const createInitialCapabilityMapperData = () => ({
  context: {
    industry: "",
    capabilityDomains: "",
    strategicPriorities: "",
    goal: "",
    scope: "",
    successSignal: "",
    timeframe: "medium",
    constraints: "",
    assumptions: "",
    kpiTarget: ""
  },
  signals: [],
  capabilities: [],
  gaps: [],
  recommendedMoves: [],
  outputCandidates: []
});
const createInitialGrowthPathsData = () => ({
  context: createConsultingMissionContext(),
  signals: [],
  quadrants: {
    marketPenetration: [],
    marketDevelopment: [],
    productDevelopment: [],
    diversification: []
  },
  comparisons: [],
  recommendedMoves: [],
  outputCandidates: []
});
const createInitialPortfolioPriorityData = () => ({
  context: createConsultingMissionContext(),
  signals: [],
  initiatives: [],
  tradeOffs: [],
  recommendedMoves: [],
  outputCandidates: []
});
const createInitialRiskUncertaintyData = () => ({
  context: createConsultingMissionContext(),
  signals: [],
  assumptions: [],
  risks: [],
  scenarios: [],
  recommendedMoves: [],
  outputCandidates: []
});
const createInitialOperationalData = (steps) => {
  const sections = steps.filter((step) => !["context", "summary"].includes(step.id)).reduce((acc, step) => {
    acc[step.id] = [];
    return acc;
  }, {});
  return {
    context: createConsultingMissionContext(),
    sections
  };
};
const createInitialToolsetFlowData = (inputSectionIds) => {
  const sections = inputSectionIds.reduce((acc, id) => {
    acc[id] = [];
    return acc;
  }, {});
  return {
    context: createConsultingMissionContext(),
    sections,
    flow: {
      impactHypothesis: {
        metricName: "",
        baseline: null,
        target: null,
        unit: "",
        timeframe: "",
        assumptions: []
      },
      results: {
        executiveSummary: "",
        keyFindings: [],
        quickWins: [],
        strategicBets: [],
        prerequisites: [],
        risks: [],
        dependencies: []
      },
      reasoning: {
        narrative: "",
        evidence: [],
        openQuestions: []
      },
      prepare: {
        nextSteps: [],
        stakeholders: [],
        dataNeeded: [],
        timeline: ""
      },
      economics: {
        fullyLoadedCostPerHour: null,
        baselineHoursPerWeek: null,
        targetHoursPerWeek: null,
        oneTimeCost: null,
        monthlyCost: null
      },
      processAutomation: {
        processName: "",
        owner: "",
        volumePerWeek: null,
        baselineMinutesPerCycle: null,
        targetMinutesPerCycle: null,
        errorRateBaselinePct: null,
        errorRateTargetPct: null
      }
    }
  };
};
const TOOL_STEP_DEFINITIONS = {
  "dynamic-swot": SWOT_STEPS,
  "market-forces": PORTER_STEPS,
  "growth-paths": GROWTH_PATHS_STEPS,
  "value-chain": VALUE_CHAIN_STEPS,
  "portfolio-priority": PORTFOLIO_PRIORITY_STEPS,
  "ambition-decomposer": AMBITION_DECOMPOSER_STEPS,
  "focus-tradeoff": FOCUS_TRADEOFF_STEPS,
  "risk-uncertainty": RISK_UNCERTAINTY_STEPS,
  "capability-mapper": CAPABILITY_MAPPER_STEPS,
  "narrative-engine": NARRATIVE_ENGINE_STEPS,
  "sop-builder": SOP_STEPS,
  "a3-problem-solving": A3_STEPS,
  "smed-planner": SMED_STEPS,
  "dms-builder": DMS_STEPS,
  "inventory-autopilot": INVENTORY_STEPS,
  "vsm-builder": TOOLSET_OPERATIONAL_STEPS,
  "constraint-control": TOOLSET_OPERATIONAL_STEPS,
  "decision-engine": TOOLSET_OPERATIONAL_STEPS,
  "control-tower": TOOLSET_OPERATIONAL_STEPS,
  "automation-pipeline": TOOLSET_OPERATIONAL_STEPS,
  "robotics-feasibility": TOOLSET_DIGITAL_STEPS,
  "logistics-automation": TOOLSET_DIGITAL_STEPS,
  "rpa-scanner": RPA_SCANNER_STEPS,
  "ai-discovery": AI_DISCOVERY_STEPS,
  "integration-diagnostic": TOOLSET_DIGITAL_STEPS,
  "digital-value-pool": TOOLSET_DIGITAL_STEPS,
  "legacy-analyzer": TOOLSET_DIGITAL_STEPS,
  "data-inventory": TOOLSET_DIGITAL_STEPS,
  "pain-to-solution": TOOLSET_DIGITAL_STEPS,
  "pain-explorer": PAIN_EXPLORER_STEPS,
  "process-automation": PROCESS_AUTOMATION_STEPS
};
function resolveToolStepDefinitions(toolType) {
  if (toolType !== "dynamic-swot") return TOOL_STEP_DEFINITIONS[toolType] || PORTER_STEPS;
  const pack = getDynamicSwotPackForCurrentFlags();
  if (pack === dynamicSwotPack) return SWOT_STEPS;
  return pack.phases.map((phase) => ({
    id: phase.id,
    name: phase.title.en,
    namePl: phase.title.pl,
    description: phase.goal.en,
    descriptionPl: phase.goal.pl,
    required: true,
    aiAssisted: phase.id !== "mission" && phase.id !== "review"
  }));
}
const TOOL_INITIAL_DATA = {
  "dynamic-swot": createInitialSWOTData(),
  "market-forces": createInitialPorterData(),
  "growth-paths": createInitialGrowthPathsData(),
  "value-chain": createInitialValueChainData(),
  "portfolio-priority": createInitialPortfolioPriorityData(),
  "ambition-decomposer": createInitialAmbitionDecomposerData(),
  "focus-tradeoff": createInitialFocusTradeoffData(),
  "risk-uncertainty": createInitialRiskUncertaintyData(),
  "capability-mapper": createInitialCapabilityMapperData(),
  "narrative-engine": createInitialNarrativeEngineData(),
  "sop-builder": createInitialOperationalData(SOP_STEPS),
  "a3-problem-solving": createInitialOperationalData(A3_STEPS),
  "smed-planner": createInitialOperationalData(SMED_STEPS),
  "dms-builder": createInitialOperationalData(DMS_STEPS),
  "inventory-autopilot": createInitialOperationalData(INVENTORY_STEPS),
  "vsm-builder": createInitialToolsetFlowData(["fill"]),
  "constraint-control": createInitialToolsetFlowData(["fill"]),
  "decision-engine": createInitialToolsetFlowData(["fill"]),
  "control-tower": createInitialToolsetFlowData(["fill"]),
  "automation-pipeline": createInitialToolsetFlowData(["fill"]),
  "robotics-feasibility": createInitialToolsetFlowData(["fill"]),
  "logistics-automation": createInitialToolsetFlowData(["fill"]),
  "rpa-scanner": createInitialToolsetFlowData(["candidates", "sizing", "backlog"]),
  "ai-discovery": createInitialToolsetFlowData(["use-cases", "prerequisites", "pilot-plan"]),
  "integration-diagnostic": createInitialToolsetFlowData(["fill"]),
  "digital-value-pool": createInitialToolsetFlowData(["fill"]),
  "legacy-analyzer": createInitialToolsetFlowData(["fill"]),
  "data-inventory": createInitialToolsetFlowData(["fill"]),
  "pain-to-solution": createInitialToolsetFlowData(["fill"]),
  "pain-explorer": createInitialToolsetFlowData(["problems", "hypotheses", "evidence-gaps"]),
  "process-automation": createInitialToolsetFlowData(["process-mapping", "redesign"])
};
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const normalizeCanonicalStatus = (status) => {
  const normalized = String(status || "DRAFT").trim().toUpperCase();
  if (normalized === "DRAFT" || normalized === "IN_PROGRESS" || normalized === "REVIEW" || normalized === "FINALIZED" || normalized === "FAILED" || normalized === "APPROVED" || normalized === "GENERATED") {
    return normalized;
  }
  if (normalized === "COMPLETED") return "FINALIZED";
  return "DRAFT";
};
const DYNAMIC_SWOT_PHASE_SEQUENCE = [
  "mission",
  "input",
  "swot",
  "insights",
  "outputs"
];
const LEGACY_SWOT_STEP_TO_PHASE = {
  context: "mission",
  mission: "mission",
  input: "input",
  strengths: "swot",
  weaknesses: "swot",
  opportunities: "swot",
  threats: "swot",
  swot: "swot",
  correlations: "insights",
  insights: "insights",
  summary: "outputs",
  outputs: "outputs"
};
const getDynamicSwotPhaseIdFromStep = (stepId) => {
  if (!stepId) return "mission";
  return LEGACY_SWOT_STEP_TO_PHASE[stepId] || "mission";
};
const getDynamicSwotPhaseIndexFromLegacyStep = (step) => {
  if (step <= 1) return 1;
  if (step <= 5) return 3;
  if (step === 6) return 4;
  return 5;
};
const deriveSwotSignals = (input) => {
  if (Array.isArray(input.signals) && input.signals.length > 0) {
    return input.signals.map((signal) => ({
      ...signal,
      evidenceType: signal.evidenceType || (signal.type === "benchmark" ? "fact" : "observation"),
      state: signal.state || (signal.type === "ai" ? "proposed" : "accepted"),
      provenance: signal.provenance || signal.sourceLabel
    }));
  }
  const derived = (input.items || []).map((item) => ({
    id: `derived-${item.id}`,
    type: item.source === "ai" ? "ai" : item.source === "user" ? "interview" : "benchmark",
    content: item.text,
    sourceLabel: item.source === "ai" ? "AI suggestion" : item.source === "user" ? "User input" : "Imported evidence",
    confidence: item.confidence,
    tags: [item.quadrant],
    evidenceType: "observation",
    state: item.source === "ai" ? "proposed" : "accepted",
    provenance: item.source === "ai" ? "AI suggestion" : "Derived from accepted card"
  }));
  return derived;
};
const normalizeDynamicSwotData = (input) => ({
  ...input,
  signals: deriveSwotSignals(input),
  items: (input.items || []).map((item) => ({
    ...item,
    status: item.status || (item.source === "ai" ? "proposed" : "accepted"),
    linkedSignalIds: item.linkedSignalIds || []
  })),
  outputCandidates: (input.outputCandidates || []).map((candidate) => ({
    ...candidate,
    readiness: candidate.readiness || "keep-as-idea"
  }))
});
const normalizePorterData = (input) => {
  const initial = createInitialPorterData();
  return {
    ...initial,
    ...input,
    context: {
      ...initial.context,
      ...input.context || {}
    },
    signals: (input.signals || []).map((signal) => ({
      ...signal,
      evidenceType: signal.evidenceType || (signal.type === "benchmark" ? "fact" : "observation"),
      state: signal.state || (signal.type === "ai" ? "proposed" : "accepted"),
      provenance: signal.provenance || signal.sourceLabel,
      proposalStatus: signal.proposalStatus || (signal.type === "ai" ? "ai-proposed" : "accepted")
    })),
    forces: Object.keys(initial.forces).reduce(
      (acc, forceId) => {
        const current = input.forces?.[forceId];
        acc[forceId] = {
          ...initial.forces[forceId],
          ...current,
          drivers: current?.drivers || [],
          evidence: current?.evidence || [],
          proposalStatus: current?.proposalStatus || "accepted"
        };
        return acc;
      },
      { ...initial.forces }
    ),
    implications: (input.implications || []).map((implication) => ({
      ...implication,
      proposalStatus: implication.proposalStatus || "accepted"
    })),
    recommendedMoves: (input.recommendedMoves || []).map((move) => ({
      ...move,
      proposalStatus: move.proposalStatus || "accepted"
    })),
    outputCandidates: (input.outputCandidates || []).map((candidate) => ({
      ...candidate,
      readiness: candidate.readiness || "keep-as-idea",
      proposalStatus: candidate.proposalStatus || "accepted"
    }))
  };
};
const normalizeGrowthPathsData = (input) => {
  const initial = createInitialGrowthPathsData();
  const quadrants = {
    ...initial.quadrants,
    ...input.quadrants || {}
  };
  return {
    ...initial,
    ...input,
    context: {
      ...initial.context,
      ...input.context || {}
    },
    signals: (input.signals || []).map((signal) => ({
      ...signal,
      evidenceType: signal.evidenceType || (signal.type === "benchmark" ? "fact" : "observation"),
      state: signal.state || (signal.type === "ai" ? "proposed" : "accepted"),
      provenance: signal.provenance || signal.sourceLabel,
      proposalStatus: signal.proposalStatus || (signal.type === "ai" ? "ai-proposed" : "accepted")
    })),
    quadrants: Object.keys(initial.quadrants).reduce(
      (acc, quadrant) => {
        acc[quadrant] = (quadrants[quadrant] || []).map((option) => ({
          ...option,
          quadrant: option.quadrant || quadrant,
          evidence: option.evidence || [],
          riskLevel: option.riskLevel || "medium",
          confidence: option.confidence ?? 3,
          proposalStatus: option.proposalStatus || "accepted"
        }));
        return acc;
      },
      { ...initial.quadrants }
    ),
    comparisons: (input.comparisons || []).map((comparison) => ({
      ...comparison,
      linkedQuadrants: comparison.linkedQuadrants || [],
      priority: comparison.priority || "medium",
      proposalStatus: comparison.proposalStatus || "accepted"
    })),
    recommendedMoves: (input.recommendedMoves || []).map((move) => ({
      ...move,
      linkedOptionIds: move.linkedOptionIds || [],
      linkedQuadrants: move.linkedQuadrants || [],
      proposalStatus: move.proposalStatus || "accepted"
    })),
    outputCandidates: (input.outputCandidates || []).map((candidate) => ({
      ...candidate,
      linkedOptionIds: candidate.linkedOptionIds || [],
      linkedQuadrants: candidate.linkedQuadrants || [],
      readiness: candidate.readiness || "keep-as-idea",
      proposalStatus: candidate.proposalStatus || "accepted"
    })),
    summary: input.summary ? {
      ...input.summary,
      keyInsights: input.summary.keyInsights || [],
      appliedConclusions: input.summary.appliedConclusions || [],
      recommendedInitiatives: input.summary.recommendedInitiatives || [],
      proposalStatus: input.summary.proposalStatus || "accepted"
    } : void 0
  };
};
const updateGrowthProposalCard = (growthData, cardType, cardId, updates) => {
  const updateList = (items) => items.map((item) => item.id === cardId ? { ...item, ...updates } : item);
  if (cardType === "signal") {
    return { ...growthData, signals: updateList(growthData.signals) };
  }
  if (cardType === "item") {
    const quadrants = { ...growthData.quadrants };
    Object.keys(quadrants).forEach((quadrant) => {
      quadrants[quadrant] = updateList(quadrants[quadrant]);
    });
    return { ...growthData, quadrants };
  }
  if (cardType === "tension" || cardType === "correlation") {
    return { ...growthData, comparisons: updateList(growthData.comparisons) };
  }
  if (cardType === "move") {
    return { ...growthData, recommendedMoves: updateList(growthData.recommendedMoves) };
  }
  if (cardType === "output-candidate") {
    return { ...growthData, outputCandidates: updateList(growthData.outputCandidates) };
  }
  if (cardType === "conclusion" && growthData.summary) {
    return {
      ...growthData,
      summary: {
        ...growthData.summary,
        ...updates
      }
    };
  }
  return growthData;
};
const getPortfolioCategory = (growth, share) => {
  if (growth >= 4 && share >= 4) return "star";
  if (growth >= 4 && share < 4) return "question-mark";
  if (growth < 4 && share >= 4) return "cash-cow";
  return "dog";
};
const normalizePortfolioPriorityData = (input) => {
  const initial = createInitialPortfolioPriorityData();
  return {
    ...initial,
    ...input,
    context: {
      ...initial.context,
      ...input.context || {}
    },
    signals: (input.signals || []).map((signal) => ({
      ...signal,
      evidenceType: signal.evidenceType || (signal.type === "benchmark" ? "fact" : "observation"),
      state: signal.state || (signal.type === "ai" ? "proposed" : "accepted"),
      provenance: signal.provenance || signal.sourceLabel,
      proposalStatus: signal.proposalStatus || (signal.type === "ai" ? "ai-proposed" : "accepted")
    })),
    initiatives: (input.initiatives || []).map((item) => ({
      ...item,
      marketGrowth: item.marketGrowth ?? 3,
      marketShare: item.marketShare ?? 3,
      investmentLevel: item.investmentLevel ?? 3,
      category: item.category || getPortfolioCategory(item.marketGrowth ?? 3, item.marketShare ?? 3),
      evidence: item.evidence || [],
      confidence: item.confidence ?? 3,
      proposalStatus: item.proposalStatus || "accepted"
    })),
    tradeOffs: (input.tradeOffs || []).map((tradeOff) => ({
      ...tradeOff,
      linkedItemIds: tradeOff.linkedItemIds || [],
      priority: tradeOff.priority || "medium",
      proposalStatus: tradeOff.proposalStatus || "accepted"
    })),
    recommendedMoves: (input.recommendedMoves || []).map((move) => ({
      ...move,
      linkedItemIds: move.linkedItemIds || [],
      proposalStatus: move.proposalStatus || "accepted"
    })),
    outputCandidates: (input.outputCandidates || []).map((candidate) => ({
      ...candidate,
      linkedItemIds: candidate.linkedItemIds || [],
      readiness: candidate.readiness || "keep-as-idea",
      proposalStatus: candidate.proposalStatus || "accepted"
    })),
    summary: input.summary ? {
      ...input.summary,
      keyInsights: input.summary.keyInsights || [],
      appliedConclusions: input.summary.appliedConclusions || [],
      recommendedInitiatives: input.summary.recommendedInitiatives || [],
      proposalStatus: input.summary.proposalStatus || "accepted"
    } : void 0
  };
};
const updatePortfolioProposalCard = (portfolioData, cardType, cardId, updates) => {
  const updateList = (items) => items.map((item) => item.id === cardId ? { ...item, ...updates } : item);
  if (cardType === "signal")
    return { ...portfolioData, signals: updateList(portfolioData.signals) };
  if (cardType === "item")
    return { ...portfolioData, initiatives: updateList(portfolioData.initiatives) };
  if (cardType === "tension" || cardType === "correlation")
    return { ...portfolioData, tradeOffs: updateList(portfolioData.tradeOffs) };
  if (cardType === "move")
    return { ...portfolioData, recommendedMoves: updateList(portfolioData.recommendedMoves) };
  if (cardType === "output-candidate")
    return { ...portfolioData, outputCandidates: updateList(portfolioData.outputCandidates) };
  if (cardType === "conclusion" && portfolioData.summary) {
    return { ...portfolioData, summary: { ...portfolioData.summary, ...updates } };
  }
  return portfolioData;
};
const normalizeRiskUncertaintyData = (input) => {
  const initial = createInitialRiskUncertaintyData();
  return {
    ...initial,
    ...input,
    context: {
      ...initial.context,
      ...input.context || {}
    },
    signals: (input.signals || []).map((signal) => ({
      ...signal,
      evidenceType: signal.evidenceType || (signal.type === "benchmark" ? "fact" : "observation"),
      state: signal.state || (signal.type === "ai" ? "proposed" : "accepted"),
      provenance: signal.provenance || signal.sourceLabel,
      proposalStatus: signal.proposalStatus || (signal.type === "ai" ? "ai-proposed" : "accepted")
    })),
    assumptions: (input.assumptions || []).map((assumption) => ({
      ...assumption,
      confidence: assumption.confidence ?? 3,
      evidence: assumption.evidence || [],
      proposalStatus: assumption.proposalStatus || "accepted"
    })),
    risks: (input.risks || []).map((risk) => ({
      ...risk,
      probability: risk.probability ?? 3,
      impact: risk.impact ?? 3,
      mitigation: risk.mitigation || "",
      evidence: risk.evidence || [],
      confidence: risk.confidence ?? 3,
      proposalStatus: risk.proposalStatus || "accepted"
    })),
    scenarios: (input.scenarios || []).map((scenario) => ({
      ...scenario,
      likelihood: scenario.likelihood ?? 3,
      posture: scenario.posture || "base",
      signalsToWatch: scenario.signalsToWatch || [],
      proposalStatus: scenario.proposalStatus || "accepted"
    })),
    recommendedMoves: (input.recommendedMoves || []).map((move) => ({
      ...move,
      linkedRiskIds: move.linkedRiskIds || [],
      linkedAssumptionIds: move.linkedAssumptionIds || [],
      proposalStatus: move.proposalStatus || "accepted"
    })),
    outputCandidates: (input.outputCandidates || []).map((candidate) => ({
      ...candidate,
      linkedRiskIds: candidate.linkedRiskIds || [],
      linkedScenarioIds: candidate.linkedScenarioIds || [],
      readiness: candidate.readiness || "keep-as-idea",
      proposalStatus: candidate.proposalStatus || "accepted"
    })),
    summary: input.summary ? {
      ...input.summary,
      keyInsights: input.summary.keyInsights || [],
      appliedConclusions: input.summary.appliedConclusions || [],
      recommendedInitiatives: input.summary.recommendedInitiatives || [],
      proposalStatus: input.summary.proposalStatus || "accepted"
    } : void 0
  };
};
const updateRiskProposalCard = (riskData, cardType, cardId, updates) => {
  const updateList = (items) => items.map((item) => item.id === cardId ? { ...item, ...updates } : item);
  if (cardType === "signal") return { ...riskData, signals: updateList(riskData.signals) };
  if (cardType === "item")
    return {
      ...riskData,
      assumptions: updateList(riskData.assumptions),
      risks: updateList(riskData.risks),
      scenarios: updateList(riskData.scenarios)
    };
  if (cardType === "tension" || cardType === "move")
    return { ...riskData, recommendedMoves: updateList(riskData.recommendedMoves) };
  if (cardType === "output-candidate")
    return { ...riskData, outputCandidates: updateList(riskData.outputCandidates) };
  if (cardType === "conclusion" && riskData.summary) {
    return { ...riskData, summary: { ...riskData.summary, ...updates } };
  }
  return riskData;
};
const mergeToolAnswersWithInitialData = (toolType, answers) => {
  const base = structuredClone(TOOL_INITIAL_DATA[toolType] || {});
  const safeAnswers = answers || {};
  const merged = {
    ...base,
    ...safeAnswers,
    context: {
      ...base?.context || {},
      ...safeAnswers?.context || {}
    },
    summary: base?.summary || safeAnswers?.summary ? {
      ...base?.summary || {},
      ...safeAnswers?.summary || {}
    } : void 0,
    flow: base?.flow || safeAnswers?.flow ? {
      ...base?.flow || {},
      ...safeAnswers?.flow || {},
      impactHypothesis: {
        ...base?.flow?.impactHypothesis || {},
        ...safeAnswers?.flow?.impactHypothesis || {}
      },
      results: {
        ...base?.flow?.results || {},
        ...safeAnswers?.flow?.results || {}
      },
      reasoning: {
        ...base?.flow?.reasoning || {},
        ...safeAnswers?.flow?.reasoning || {}
      },
      prepare: {
        ...base?.flow?.prepare || {},
        ...safeAnswers?.flow?.prepare || {}
      },
      economics: {
        ...base?.flow?.economics || {},
        ...safeAnswers?.flow?.economics || {}
      },
      processAutomation: {
        ...base?.flow?.processAutomation || {},
        ...safeAnswers?.flow?.processAutomation || {}
      }
    } : void 0
  };
  if (toolType === "dynamic-swot") {
    return normalizeDynamicSwotData(merged);
  }
  if (toolType === "market-forces") {
    return normalizePorterData(merged);
  }
  if (toolType === "growth-paths") {
    return normalizeGrowthPathsData(merged);
  }
  if (toolType === "portfolio-priority") {
    return normalizePortfolioPriorityData(merged);
  }
  if (toolType === "risk-uncertainty") {
    return normalizeRiskUncertaintyData(merged);
  }
  return merged;
};
const computeStepStatusFromAnswers = (toolType, stepId, answers) => {
  try {
    if (!answers) return "pending";
    if (toolType === "dynamic-swot") {
      const swotAnswers = normalizeDynamicSwotData(answers);
      if (stepId === "mission") {
        return swotAnswers.context?.goal && swotAnswers.context?.scope && swotAnswers.context?.successSignal ? "completed" : "pending";
      }
      if (stepId === "input") {
        return (swotAnswers.signals?.length || 0) > 0 || (swotAnswers.items?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "swot") {
        return ["strengths", "weaknesses", "opportunities", "threats"].every(
          (quadrant) => swotAnswers.items?.some((item) => item.quadrant === quadrant)
        ) ? "completed" : "pending";
      }
      if (stepId === "insights") {
        return (swotAnswers.tensions?.length || 0) > 0 || (swotAnswers.correlations?.length || 0) > 0 || (swotAnswers.recommendedMoves?.length || 0) > 0 || (swotAnswers.summary?.appliedConclusions?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "outputs") {
        return swotAnswers.summary?.executiveSummary || (swotAnswers.summary?.keyInsights?.length || 0) > 0 || (swotAnswers.outputCandidates?.length || 0) > 0 ? "completed" : "pending";
      }
    }
    if (toolType === "market-forces") {
      const porterAnswers = normalizePorterData(answers);
      if (stepId === "mission") {
        return porterAnswers.context?.industry && porterAnswers.context?.geographicScope ? "completed" : "pending";
      }
      if (stepId === "input") {
        return (porterAnswers.signals?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "forces") {
        return Object.values(porterAnswers.forces || {}).every(
          (force) => (force.drivers?.length || 0) > 0
        ) ? "completed" : "pending";
      }
      if (stepId === "insights") {
        return (porterAnswers.implications?.length || 0) > 0 || (porterAnswers.recommendedMoves?.length || 0) > 0 || (porterAnswers.summary?.appliedConclusions?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "outputs") {
        return porterAnswers.summary?.executiveSummary || (porterAnswers.summary?.keyInsights?.length || 0) > 0 || (porterAnswers.outputCandidates?.length || 0) > 0 ? "completed" : "pending";
      }
    }
    if (toolType === "growth-paths") {
      const growthAnswers = normalizeGrowthPathsData(answers);
      if (stepId === "mission") {
        return growthAnswers.context?.goal && growthAnswers.context?.scope ? "completed" : "pending";
      }
      if (stepId === "input") {
        return (growthAnswers.signals?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "options") {
        return Object.values(growthAnswers.quadrants || {}).some(
          (items) => (items?.length || 0) > 0
        ) ? "completed" : "pending";
      }
      if (stepId === "insights") {
        return (growthAnswers.comparisons?.length || 0) > 0 || (growthAnswers.recommendedMoves?.length || 0) > 0 || (growthAnswers.summary?.appliedConclusions?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "outputs") {
        return growthAnswers.summary?.executiveSummary || (growthAnswers.summary?.keyInsights?.length || 0) > 0 || (growthAnswers.outputCandidates?.length || 0) > 0 ? "completed" : "pending";
      }
    }
    if (toolType === "portfolio-priority") {
      const portfolioAnswers = normalizePortfolioPriorityData(answers);
      if (stepId === "mission") {
        return portfolioAnswers.context?.goal && portfolioAnswers.context?.scope && portfolioAnswers.context?.successSignal ? "completed" : "pending";
      }
      if (stepId === "input") {
        return (portfolioAnswers.signals?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "items") {
        return (portfolioAnswers.initiatives?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "insights") {
        return (portfolioAnswers.tradeOffs?.length || 0) > 0 || (portfolioAnswers.recommendedMoves?.length || 0) > 0 || (portfolioAnswers.summary?.appliedConclusions?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "outputs") {
        return portfolioAnswers.summary?.executiveSummary || (portfolioAnswers.summary?.keyInsights?.length || 0) > 0 || (portfolioAnswers.outputCandidates?.length || 0) > 0 ? "completed" : "pending";
      }
    }
    if (toolType === "risk-uncertainty") {
      const riskAnswers = normalizeRiskUncertaintyData(answers);
      if (stepId === "mission") {
        return riskAnswers.context?.goal && riskAnswers.context?.scope && riskAnswers.context?.successSignal ? "completed" : "pending";
      }
      if (stepId === "input") {
        return (riskAnswers.signals?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "assumptions") {
        return (riskAnswers.assumptions?.length || 0) > 0 || (riskAnswers.risks?.length || 0) > 0 || (riskAnswers.scenarios?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "insights") {
        return (riskAnswers.recommendedMoves?.length || 0) > 0 || (riskAnswers.summary?.appliedConclusions?.length || 0) > 0 ? "completed" : "pending";
      }
      if (stepId === "outputs") {
        return riskAnswers.summary?.executiveSummary || (riskAnswers.summary?.keyInsights?.length || 0) > 0 || (riskAnswers.outputCandidates?.length || 0) > 0 ? "completed" : "pending";
      }
    }
    if (stepId === "context") {
      if (toolType === "market-forces") {
        return answers?.context?.industry && answers?.context?.geographicScope ? "completed" : "pending";
      }
      return answers?.context?.goal && answers?.context?.scope ? "completed" : "pending";
    }
    if (stepId === "summary") {
      const hasInsights = (answers?.summary?.keyInsights?.length || 0) > 0;
      const hasDrafts = (answers?.initiatives?.length || 0) > 0;
      return hasInsights || hasDrafts ? "completed" : "pending";
    }
    if (toolType === "dynamic-swot") {
      if (["strengths", "weaknesses", "opportunities", "threats"].includes(stepId)) {
        return answers?.items?.some((i) => i.quadrant === stepId) ? "completed" : "pending";
      }
      if (stepId === "correlations") {
        return (answers?.correlations?.length || 0) > 0 ? "completed" : "pending";
      }
    }
    if (toolType === "market-forces") {
      const force = answers?.forces?.[stepId];
      if (force) return (force?.drivers?.length || 0) > 0 ? "completed" : "pending";
    }
    if (toolType === "growth-paths") {
      const map = {
        "market-penetration": "marketPenetration",
        "market-development": "marketDevelopment",
        "product-development": "productDevelopment",
        diversification: "diversification"
      };
      const key = map[stepId];
      if (key) return (answers?.quadrants?.[key]?.length || 0) > 0 ? "completed" : "pending";
    }
    const sectionLen = answers?.sections?.[stepId]?.length || 0;
    if (sectionLen > 0) return "completed";
    if (stepId === "impact-hypothesis") {
      const ih = answers?.flow?.impactHypothesis;
      return ih?.metricName && ih?.unit && ih?.timeframe && ih?.baseline != null && ih?.target != null ? "completed" : "pending";
    }
    if (stepId === "results") {
      const r = answers?.flow?.results;
      return r?.executiveSummary || (r?.keyFindings?.length || 0) > 0 ? "completed" : "pending";
    }
    if (stepId === "reasoning") {
      const r = answers?.flow?.reasoning;
      return r?.narrative || (r?.evidence?.length || 0) > 0 ? "completed" : "pending";
    }
    if (stepId === "prepare") {
      const p = answers?.flow?.prepare;
      return p?.timeline || (p?.nextSteps?.length || 0) > 0 ? "completed" : "pending";
    }
    if (stepId === "economics") {
      const e = answers?.flow?.economics;
      return e?.fullyLoadedCostPerHour != null && e?.baselineHoursPerWeek != null && e?.targetHoursPerWeek != null ? "completed" : "pending";
    }
    if (stepId === "measurement") {
      const p = answers?.flow?.processAutomation;
      return p?.processName && p?.volumePerWeek != null && p?.baselineMinutesPerCycle != null ? "completed" : "pending";
    }
    if (stepId === "re-estimation") {
      const p = answers?.flow?.processAutomation;
      return p?.targetMinutesPerCycle != null ? "completed" : "pending";
    }
  } catch {
  }
  return "pending";
};
const buildToolSteps = (toolType, inputData) => {
  const defs = TOOL_STEP_DEFINITIONS[toolType] || PORTER_STEPS;
  return defs.map((step) => ({
    stepId: step.id,
    status: computeStepStatusFromAnswers(toolType, step.id, inputData),
    data: {}
  }));
};
const normalizeDynamicSwotSession = (session) => {
  const normalizedInputData = mergeToolAnswersWithInitialData(
    "dynamic-swot",
    session.inputData || {}
  );
  const currentPhaseId = session.currentPhaseId ? getDynamicSwotPhaseIdFromStep(session.currentPhaseId) : getDynamicSwotPhaseIdFromStep(
    session.steps?.[Math.max(0, (session.currentStep || 1) - 1)]?.stepId
  );
  const currentStep = typeof session.currentStep === "number" && session.currentStep <= DYNAMIC_SWOT_PHASE_SEQUENCE.length ? Math.max(1, session.currentStep) : getDynamicSwotPhaseIndexFromLegacyStep(session.currentStep || 1);
  return {
    ...session,
    currentStep,
    currentPhaseId,
    inputData: normalizedInputData,
    steps: buildToolSteps("dynamic-swot", normalizedInputData)
  };
};
const normalizeSessionForRuntime = (session) => {
  const normalizedBase = {
    ...session,
    status: normalizeCanonicalStatus(session.status)
  };
  if (session.toolType === "dynamic-swot") {
    return normalizeDynamicSwotSession(normalizedBase);
  }
  if (session.toolType === "market-forces") {
    const inputData = normalizePorterData(normalizedBase.inputData);
    return {
      ...normalizedBase,
      inputData,
      steps: buildToolSteps("market-forces", inputData)
    };
  }
  if (session.toolType === "growth-paths") {
    const inputData = normalizeGrowthPathsData(normalizedBase.inputData);
    return {
      ...normalizedBase,
      inputData,
      steps: buildToolSteps("growth-paths", inputData)
    };
  }
  if (session.toolType === "portfolio-priority") {
    const inputData = normalizePortfolioPriorityData(
      normalizedBase.inputData
    );
    return {
      ...normalizedBase,
      inputData,
      steps: buildToolSteps("portfolio-priority", inputData)
    };
  }
  if (session.toolType === "risk-uncertainty") {
    const inputData = normalizeRiskUncertaintyData(normalizedBase.inputData);
    return {
      ...normalizedBase,
      inputData,
      steps: buildToolSteps("risk-uncertainty", inputData)
    };
  }
  return normalizedBase;
};
const withRecomputedSteps = (session, inputData = session.inputData) => ({
  ...session,
  inputData,
  steps: buildToolSteps(session.toolType, inputData)
});
const useToolStore = create()(
  persist(
    (set, get) => ({
      currentSession: null,
      currentStep: 1,
      savedSessions: [],
      createSession: (toolType) => {
        const steps = TOOL_STEP_DEFINITIONS[toolType] || PORTER_STEPS;
        const initialData = TOOL_INITIAL_DATA[toolType] || createInitialPorterData();
        const isDynamicSwot = toolType === "dynamic-swot";
        const initialPhaseId = isDynamicSwot ? "mission" : steps[0]?.id;
        const session = {
          id: generateId(),
          toolType,
          name: `${toolType} - ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          currentStep: 1,
          currentPhaseId: initialPhaseId,
          steps: buildToolSteps(toolType, initialData),
          inputData: initialData,
          chatHistory: [],
          generatedInitiatives: [],
          status: "DRAFT"
        };
        set({ currentSession: session, currentStep: 1 });
      },
      loadSession: (sessionId) => {
        const { savedSessions } = get();
        const session = savedSessions.find((s) => s.id === sessionId);
        if (session) {
          const normalizedSession = normalizeSessionForRuntime(session);
          set({ currentSession: normalizedSession, currentStep: normalizedSession.currentStep });
        }
      },
      saveSession: () => {
        const { currentSession, savedSessions } = get();
        if (!currentSession) return;
        const updatedSession = {
          ...currentSession,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        const existingIndex = savedSessions.findIndex((s) => s.id === currentSession.id);
        const newSessions = existingIndex >= 0 ? savedSessions.map((s, i) => i === existingIndex ? updatedSession : s) : [...savedSessions, updatedSession];
        set({ currentSession: updatedSession, savedSessions: newSessions });
      },
      deleteSession: (sessionId) => {
        const { savedSessions, currentSession } = get();
        set({
          savedSessions: savedSessions.filter((s) => s.id !== sessionId),
          currentSession: currentSession?.id === sessionId ? null : currentSession
        });
      },
      setCurrentStep: (step) => {
        const { currentSession } = get();
        if (!currentSession) return;
        const steps = TOOL_STEP_DEFINITIONS[currentSession.toolType] || PORTER_STEPS;
        if (step >= 1 && step <= steps.length) {
          const stepId = steps[step - 1]?.id;
          set({
            currentStep: step,
            currentSession: {
              ...currentSession,
              currentStep: step,
              currentPhaseId: currentSession.toolType === "dynamic-swot" ? getDynamicSwotPhaseIdFromStep(stepId) : currentSession.currentPhaseId
            }
          });
        }
      },
      nextStep: () => {
        const { currentStep, currentSession } = get();
        if (!currentSession) return;
        const steps = TOOL_STEP_DEFINITIONS[currentSession.toolType] || PORTER_STEPS;
        if (currentStep < steps.length) {
          const updatedSteps = currentSession.steps.map(
            (s, i) => i === currentStep - 1 ? { ...s, status: "completed", completedAt: (/* @__PURE__ */ new Date()).toISOString() } : s
          );
          set({
            currentStep: currentStep + 1,
            currentSession: {
              ...currentSession,
              currentStep: currentStep + 1,
              currentPhaseId: currentSession.toolType === "dynamic-swot" ? getDynamicSwotPhaseIdFromStep(steps[currentStep]?.id) : currentSession.currentPhaseId,
              steps: updatedSteps
            }
          });
        }
      },
      prevStep: () => {
        const { currentStep, currentSession } = get();
        if (currentStep > 1 && currentSession) {
          const steps = TOOL_STEP_DEFINITIONS[currentSession.toolType] || PORTER_STEPS;
          set({
            currentStep: currentStep - 1,
            currentSession: {
              ...currentSession,
              currentStep: currentStep - 1,
              currentPhaseId: currentSession.toolType === "dynamic-swot" ? getDynamicSwotPhaseIdFromStep(steps[currentStep - 2]?.id) : currentSession.currentPhaseId
            }
          });
        }
      },
      canAdvanceStep: () => {
        const { currentSession, currentStep } = get();
        if (!currentSession) return false;
        const steps = TOOL_STEP_DEFINITIONS[currentSession.toolType] || PORTER_STEPS;
        const stepDef = steps[currentStep - 1];
        if (currentSession.toolType === "dynamic-swot") {
          const swotData = normalizeDynamicSwotData(currentSession.inputData);
          if (stepDef.id === "mission") {
            return Boolean(
              swotData.context?.goal && swotData.context?.scope && swotData.context?.successSignal
            );
          }
          if (stepDef.id === "input") {
            return (swotData.signals?.length || 0) > 0 || (swotData.items?.length || 0) > 0;
          }
          if (stepDef.id === "swot") {
            return ["strengths", "weaknesses", "opportunities", "threats"].every(
              (quadrant) => swotData.items.some((item) => item.quadrant === quadrant)
            );
          }
          if (stepDef.id === "insights") {
            return (swotData.tensions?.length || 0) > 0 || (swotData.correlations?.length || 0) > 0 || (swotData.recommendedMoves?.length || 0) > 0 || (swotData.summary?.appliedConclusions?.length || 0) > 0;
          }
          if (stepDef.id === "outputs") {
            return Boolean(
              swotData.summary?.executiveSummary || (swotData.summary?.keyInsights?.length || 0) > 0 || (swotData.outputCandidates?.length || 0) > 0
            );
          }
        }
        if (currentSession.toolType === "market-forces") {
          const porterData = normalizePorterData(currentSession.inputData);
          if (stepDef.id === "mission") {
            return Boolean(porterData.context?.industry && porterData.context?.geographicScope);
          }
          if (stepDef.id === "input") {
            return (porterData.signals?.length || 0) > 0;
          }
          if (stepDef.id === "forces") {
            return Object.values(porterData.forces || {}).every(
              (force) => (force.drivers?.length || 0) > 0
            );
          }
          if (stepDef.id === "insights") {
            return (porterData.implications?.length || 0) > 0 || (porterData.recommendedMoves?.length || 0) > 0 || (porterData.summary?.appliedConclusions?.length || 0) > 0;
          }
          if (stepDef.id === "outputs") {
            return Boolean(
              porterData.summary?.executiveSummary || (porterData.summary?.keyInsights?.length || 0) > 0 || (porterData.outputCandidates?.length || 0) > 0
            );
          }
        }
        if (currentSession.toolType === "growth-paths") {
          const growthData = normalizeGrowthPathsData(currentSession.inputData);
          if (stepDef.id === "mission") {
            return Boolean(
              growthData.context?.goal && growthData.context?.scope && growthData.context?.successSignal
            );
          }
          if (stepDef.id === "input") {
            return (growthData.signals?.length || 0) > 0;
          }
          if (stepDef.id === "options") {
            return Object.values(growthData.quadrants || {}).some(
              (items) => (items?.length || 0) > 0
            );
          }
          if (stepDef.id === "insights") {
            return (growthData.comparisons?.length || 0) > 0 || (growthData.recommendedMoves?.length || 0) > 0 || (growthData.summary?.appliedConclusions?.length || 0) > 0;
          }
          if (stepDef.id === "outputs") {
            return Boolean(
              growthData.summary?.executiveSummary || (growthData.summary?.keyInsights?.length || 0) > 0 || (growthData.outputCandidates?.length || 0) > 0
            );
          }
        }
        if (currentSession.toolType === "portfolio-priority") {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData
          );
          if (stepDef.id === "mission") {
            return Boolean(
              portfolioData.context?.goal && portfolioData.context?.scope && portfolioData.context?.successSignal
            );
          }
          if (stepDef.id === "input") {
            return (portfolioData.signals?.length || 0) > 0;
          }
          if (stepDef.id === "items") {
            return (portfolioData.initiatives?.length || 0) > 0;
          }
          if (stepDef.id === "insights") {
            return (portfolioData.tradeOffs?.length || 0) > 0 || (portfolioData.recommendedMoves?.length || 0) > 0 || (portfolioData.summary?.appliedConclusions?.length || 0) > 0;
          }
          if (stepDef.id === "outputs") {
            return Boolean(
              portfolioData.summary?.executiveSummary || (portfolioData.summary?.keyInsights?.length || 0) > 0 || (portfolioData.outputCandidates?.length || 0) > 0
            );
          }
        }
        if (currentSession.toolType === "risk-uncertainty") {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData
          );
          if (stepDef.id === "mission") {
            return Boolean(
              riskData.context?.goal && riskData.context?.scope && riskData.context?.successSignal
            );
          }
          if (stepDef.id === "input") {
            return (riskData.signals?.length || 0) > 0;
          }
          if (stepDef.id === "assumptions") {
            return (riskData.assumptions?.length || 0) > 0 || (riskData.risks?.length || 0) > 0 || (riskData.scenarios?.length || 0) > 0;
          }
          if (stepDef.id === "insights") {
            return (riskData.recommendedMoves?.length || 0) > 0 || (riskData.summary?.appliedConclusions?.length || 0) > 0;
          }
          if (stepDef.id === "outputs") {
            return Boolean(
              riskData.summary?.executiveSummary || (riskData.summary?.keyInsights?.length || 0) > 0 || (riskData.outputCandidates?.length || 0) > 0
            );
          }
        }
        if (stepDef.id === "context") {
          const data = currentSession.inputData;
          const ctx = data?.context;
          if (!ctx || typeof ctx !== "object") return false;
          if ("goal" in ctx) {
            const goal = typeof ctx.goal === "string" ? ctx.goal : "";
            const scope = typeof ctx.scope === "string" ? ctx.scope : "";
            const successSignal = typeof ctx.successSignal === "string" ? ctx.successSignal : "";
            return goal.length > 0 && scope.length > 0 && successSignal.length > 0;
          }
          if ("industry" in ctx) {
            const industry = typeof ctx.industry === "string" ? ctx.industry : "";
            return industry.length > 0;
          }
          return false;
        }
        if (["strengths", "weaknesses", "opportunities", "threats"].includes(stepDef.id)) {
          const swotData = currentSession.inputData;
          return swotData.items.some((item) => item.quadrant === stepDef.id);
        }
        if (stepDef.id === "correlations") {
          const swotData = currentSession.inputData;
          return (swotData.tensions?.length || 0) > 0 || (swotData.correlations?.length || 0) > 0;
        }
        if (stepDef.id === "summary") {
          const swotData = currentSession.inputData;
          return Boolean(swotData.summary?.executiveSummary || swotData.summary?.keyInsights?.length) && (swotData.recommendedMoves?.length || 0) > 0;
        }
        if ([
          "market-penetration",
          "market-development",
          "product-development",
          "diversification"
        ].includes(stepDef.id)) {
          const growthData = currentSession.inputData;
          const keyMap = {
            "market-penetration": "marketPenetration",
            "market-development": "marketDevelopment",
            "product-development": "productDevelopment",
            diversification: "diversification"
          };
          const key = keyMap[stepDef.id];
          return growthData.quadrants[key].length > 0;
        }
        const operationalData = currentSession.inputData;
        if (operationalData.sections && stepDef.id in operationalData.sections) {
          return operationalData.sections[stepDef.id].length > 0;
        }
        const flow = currentSession.inputData?.flow;
        if (stepDef.id === "impact-hypothesis") {
          const ih = flow?.impactHypothesis;
          return Boolean(
            ih?.metricName && ih?.unit && ih?.timeframe && ih?.baseline != null && ih?.target != null
          );
        }
        if (stepDef.id === "results") {
          const r = flow?.results;
          return Boolean(r?.executiveSummary || (r?.keyFindings?.length || 0) > 0);
        }
        if (stepDef.id === "reasoning") {
          const r = flow?.reasoning;
          return Boolean(r?.narrative || (r?.evidence?.length || 0) > 0);
        }
        if (stepDef.id === "prepare") {
          const p = flow?.prepare;
          return Boolean(p?.timeline || (p?.nextSteps?.length || 0) > 0);
        }
        if (stepDef.id === "measurement") {
          const p = flow?.processAutomation;
          return Boolean(
            p?.processName && p?.volumePerWeek != null && p?.baselineMinutesPerCycle != null
          );
        }
        if (stepDef.id === "re-estimation") {
          const p = flow?.processAutomation;
          return Boolean(p?.targetMinutesPerCycle != null);
        }
        if (stepDef.id === "economics") {
          const e = flow?.economics;
          return Boolean(
            e?.fullyLoadedCostPerHour != null && e?.baselineHoursPerWeek != null && e?.targetHoursPerWeek != null
          );
        }
        return true;
      },
      hydrateSessionFromApi: (payload) => {
        const steps = resolveToolStepDefinitions(payload.toolType);
        const answers = payload.answers || {};
        const wizardStepId = payload.wizardState?.currentStep;
        const wizardStepIndex = wizardStepId ? steps.findIndex((step) => step.id === wizardStepId) + 1 : 0;
        const currentStepFromApi = typeof payload.currentStep === "number" ? payload.currentStep : wizardStepIndex > 0 ? wizardStepIndex : 1;
        const normalizedAnswers = mergeToolAnswersWithInitialData(payload.toolType, answers);
        const isDynamicSwot = payload.toolType === "dynamic-swot";
        const normalizedCurrentStep = isDynamicSwot ? currentStepFromApi <= DYNAMIC_SWOT_PHASE_SEQUENCE.length ? currentStepFromApi : getDynamicSwotPhaseIndexFromLegacyStep(currentStepFromApi) : currentStepFromApi;
        const session = {
          id: payload.id,
          toolType: payload.toolType,
          name: payload.name || `${payload.toolType} - ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`,
          createdAt: payload.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: payload.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
          currentStep: normalizedCurrentStep,
          currentPhaseId: isDynamicSwot ? DYNAMIC_SWOT_PHASE_SEQUENCE[normalizedCurrentStep - 1] : steps[normalizedCurrentStep - 1]?.id,
          steps: buildToolSteps(payload.toolType, normalizedAnswers),
          inputData: normalizedAnswers,
          chatHistory: [],
          generatedInitiatives: [],
          status: normalizeCanonicalStatus(payload.status)
        };
        const normalizedSession = normalizeSessionForRuntime(session);
        set({ currentSession: normalizedSession, currentStep: normalizedSession.currentStep });
      },
      updateInputData: (data) => {
        const { currentSession } = get();
        if (!currentSession) return;
        const mergedInputData = { ...currentSession.inputData, ...data };
        const nextInputData = currentSession.toolType === "dynamic-swot" ? normalizeDynamicSwotData(mergedInputData) : currentSession.toolType === "market-forces" ? normalizePorterData(mergedInputData) : currentSession.toolType === "growth-paths" ? normalizeGrowthPathsData(mergedInputData) : mergedInputData;
        set({
          currentSession: withRecomputedSteps(currentSession, nextInputData)
        });
      },
      addSWOTSignal: (signal) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        const newSignal = { ...signal, id: generateId() };
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            signals: [...swotData.signals, newSignal]
          })
        });
      },
      updateSWOTSignal: (signalId, updates) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            signals: swotData.signals.map(
              (signal) => signal.id === signalId ? { ...signal, ...updates } : signal
            )
          })
        });
      },
      removeSWOTSignal: (signalId) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            signals: swotData.signals.filter((signal) => signal.id !== signalId)
          })
        });
      },
      addSWOTItem: (item) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        const newItem = { ...item, id: generateId() };
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            items: [...swotData.items, newItem]
          })
        });
      },
      removeSWOTItem: (itemId) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            items: swotData.items.filter((item) => item.id !== itemId)
          })
        });
      },
      updateSWOTItem: (itemId, updates) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            items: swotData.items.map(
              (item) => item.id === itemId ? { ...item, ...updates } : item
            )
          })
        });
      },
      setSWOTTensions: (tensions) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            tensions: tensions.map((tension) => ({ ...tension, id: generateId() }))
          })
        });
      },
      setSWOTMoves: (moves) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            recommendedMoves: moves.map((move) => ({ ...move, id: generateId() }))
          })
        });
      },
      setSWOTOutputCandidates: (candidates) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            outputCandidates: candidates.map((candidate) => ({ ...candidate, id: generateId() }))
          })
        });
      },
      setSWOTSummary: (summary) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            summary: {
              ...summary,
              proposalId: summary?.proposalId || swotData.summary?.proposalId || generateId()
            }
          })
        });
      },
      addAISuggestion: (stepId, suggestion) => {
        const { currentSession } = get();
        if (!currentSession) return;
        const updatedSteps = currentSession.steps.map(
          (step) => step.stepId === stepId ? { ...step, aiSuggestions: [...step.aiSuggestions || [], suggestion] } : step
        );
        set({
          currentSession: { ...currentSession, steps: updatedSteps }
        });
      },
      addCorrelation: (correlation) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        const newCorrelation = { ...correlation, id: generateId() };
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            correlations: [...swotData.correlations, newCorrelation]
          })
        });
      },
      addInitiative: (initiative) => {
        const { currentSession } = get();
        if (!currentSession) return;
        const newInitiative = { ...initiative, id: generateId() };
        set({
          currentSession: {
            ...currentSession,
            generatedInitiatives: [...currentSession.generatedInitiatives, newInitiative]
          }
        });
      },
      setInitiatives: (initiatives) => {
        const { currentSession } = get();
        if (!currentSession) return;
        set({
          currentSession: {
            ...currentSession,
            generatedInitiatives: initiatives.map((initiative) => ({
              ...initiative,
              id: generateId()
            }))
          }
        });
      },
      setSessionGenerationStatus: (status) => {
        const { currentSession } = get();
        if (!currentSession) return;
        set({ currentSession: { ...currentSession, sessionGenerationStatus: status } });
      },
      acceptCard: (cardType, cardId) => {
        const { currentSession } = get();
        if (!currentSession) return;
        if (currentSession.toolType === "risk-uncertainty") {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData
          );
          const updated2 = updateRiskProposalCard(riskData, cardType, cardId, {
            proposalStatus: "accepted"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "portfolio-priority") {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData
          );
          const updated2 = updatePortfolioProposalCard(portfolioData, cardType, cardId, {
            proposalStatus: "accepted"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "growth-paths") {
          const growthData = normalizeGrowthPathsData(currentSession.inputData);
          const updated2 = updateGrowthProposalCard(growthData, cardType, cardId, {
            proposalStatus: "accepted"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "market-forces") {
          const porterData = normalizePorterData(currentSession.inputData);
          const update2 = (arr) => arr.map(
            (item) => item.id === cardId ? { ...item, proposalStatus: "accepted" } : item
          );
          const updated2 = {};
          if (cardType === "signal") updated2.signals = update2(porterData.signals);
          else if (cardType === "item") {
            updated2.forces = { ...porterData.forces };
            if (updated2.forces[cardId]) {
              updated2.forces[cardId] = {
                ...updated2.forces[cardId],
                proposalStatus: "accepted"
              };
            }
          } else if (cardType === "tension") updated2.implications = update2(porterData.implications);
          else if (cardType === "move")
            updated2.recommendedMoves = update2(porterData.recommendedMoves);
          else if (cardType === "output-candidate")
            updated2.outputCandidates = update2(porterData.outputCandidates);
          else if (cardType === "conclusion" && porterData.summary) {
            updated2.summary = {
              ...porterData.summary,
              proposalStatus: "accepted"
            };
          }
          set({
            currentSession: withRecomputedSteps(currentSession, { ...porterData, ...updated2 })
          });
          return;
        }
        if (currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        const update = (arr) => arr.map(
          (item) => item.id === cardId ? { ...item, proposalStatus: "accepted" } : item
        );
        const updated = {};
        if (cardType === "signal") updated.signals = update(swotData.signals);
        else if (cardType === "item") {
          updated.items = swotData.items.map((item) => {
            if (item.id !== cardId) return item;
            const gate = evaluateSwotAcceptGate(item);
            if (!gate.ok) return item;
            return stampAcceptedSwotItem(item, gate);
          });
        } else if (cardType === "tension") updated.tensions = update(swotData.tensions);
        else if (cardType === "move") updated.recommendedMoves = update(swotData.recommendedMoves);
        else if (cardType === "correlation") updated.correlations = update(swotData.correlations);
        else if (cardType === "output-candidate")
          updated.outputCandidates = update(swotData.outputCandidates);
        else if (cardType === "conclusion" && swotData.summary) {
          updated.summary = { ...swotData.summary, proposalStatus: "accepted" };
        }
        set({ currentSession: withRecomputedSteps(currentSession, { ...swotData, ...updated }) });
      },
      rejectCard: (cardType, cardId) => {
        const { currentSession } = get();
        if (!currentSession) return;
        if (currentSession.toolType === "risk-uncertainty") {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData
          );
          const updated2 = updateRiskProposalCard(riskData, cardType, cardId, {
            proposalStatus: "rejected"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "portfolio-priority") {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData
          );
          const updated2 = updatePortfolioProposalCard(portfolioData, cardType, cardId, {
            proposalStatus: "rejected"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "growth-paths") {
          const growthData = normalizeGrowthPathsData(currentSession.inputData);
          const updated2 = updateGrowthProposalCard(growthData, cardType, cardId, {
            proposalStatus: "rejected"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "market-forces") {
          const porterData = normalizePorterData(currentSession.inputData);
          const update2 = (arr) => arr.map(
            (item) => item.id === cardId ? { ...item, proposalStatus: "rejected" } : item
          );
          const updated2 = {};
          if (cardType === "signal") updated2.signals = update2(porterData.signals);
          else if (cardType === "item") {
            updated2.forces = { ...porterData.forces };
            if (updated2.forces[cardId]) {
              updated2.forces[cardId] = {
                ...updated2.forces[cardId],
                proposalStatus: "rejected"
              };
            }
          } else if (cardType === "tension") updated2.implications = update2(porterData.implications);
          else if (cardType === "move")
            updated2.recommendedMoves = update2(porterData.recommendedMoves);
          else if (cardType === "output-candidate")
            updated2.outputCandidates = update2(porterData.outputCandidates);
          else if (cardType === "conclusion" && porterData.summary) {
            updated2.summary = {
              ...porterData.summary,
              proposalStatus: "rejected"
            };
          }
          set({
            currentSession: withRecomputedSteps(currentSession, { ...porterData, ...updated2 })
          });
          return;
        }
        if (currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        const update = (arr) => arr.map(
          (item) => item.id === cardId ? { ...item, proposalStatus: "rejected" } : item
        );
        const updated = {};
        if (cardType === "signal") updated.signals = update(swotData.signals);
        else if (cardType === "item") updated.items = update(swotData.items);
        else if (cardType === "tension") updated.tensions = update(swotData.tensions);
        else if (cardType === "move") updated.recommendedMoves = update(swotData.recommendedMoves);
        else if (cardType === "correlation") updated.correlations = update(swotData.correlations);
        else if (cardType === "output-candidate")
          updated.outputCandidates = update(swotData.outputCandidates);
        else if (cardType === "conclusion" && swotData.summary) {
          updated.summary = { ...swotData.summary, proposalStatus: "rejected" };
        }
        set({ currentSession: withRecomputedSteps(currentSession, { ...swotData, ...updated }) });
      },
      commentOnCard: (cardType, cardId, comment) => {
        const { currentSession } = get();
        if (!currentSession) return;
        if (currentSession.toolType === "risk-uncertainty") {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData
          );
          const updated2 = updateRiskProposalCard(riskData, cardType, cardId, {
            userComment: comment
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "portfolio-priority") {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData
          );
          const updated2 = updatePortfolioProposalCard(portfolioData, cardType, cardId, {
            userComment: comment
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "growth-paths") {
          const growthData = normalizeGrowthPathsData(currentSession.inputData);
          const updated2 = updateGrowthProposalCard(growthData, cardType, cardId, {
            userComment: comment
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "market-forces") {
          const porterData = normalizePorterData(currentSession.inputData);
          const update2 = (arr) => arr.map((item) => item.id === cardId ? { ...item, userComment: comment } : item);
          const updated2 = {};
          if (cardType === "signal") updated2.signals = update2(porterData.signals);
          else if (cardType === "item") {
            updated2.forces = { ...porterData.forces };
            if (updated2.forces[cardId]) {
              updated2.forces[cardId] = {
                ...updated2.forces[cardId],
                userComment: comment
              };
            }
          } else if (cardType === "tension") updated2.implications = update2(porterData.implications);
          else if (cardType === "move")
            updated2.recommendedMoves = update2(porterData.recommendedMoves);
          else if (cardType === "output-candidate")
            updated2.outputCandidates = update2(porterData.outputCandidates);
          else if (cardType === "conclusion" && porterData.summary) {
            updated2.summary = { ...porterData.summary, userComment: comment };
          }
          set({
            currentSession: withRecomputedSteps(currentSession, { ...porterData, ...updated2 })
          });
          return;
        }
        if (currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        const update = (arr) => arr.map((item) => item.id === cardId ? { ...item, userComment: comment } : item);
        const updated = {};
        if (cardType === "signal") updated.signals = update(swotData.signals);
        else if (cardType === "item") updated.items = update(swotData.items);
        else if (cardType === "tension") updated.tensions = update(swotData.tensions);
        else if (cardType === "move") updated.recommendedMoves = update(swotData.recommendedMoves);
        else if (cardType === "correlation") updated.correlations = update(swotData.correlations);
        else if (cardType === "output-candidate")
          updated.outputCandidates = update(swotData.outputCandidates);
        else if (cardType === "conclusion" && swotData.summary) {
          updated.summary = { ...swotData.summary, userComment: comment };
        }
        set({ currentSession: withRecomputedSteps(currentSession, { ...swotData, ...updated }) });
      },
      markRethinking: (cardType, cardId) => {
        const { currentSession } = get();
        if (!currentSession) return;
        if (currentSession.toolType === "risk-uncertainty") {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData
          );
          const updated2 = updateRiskProposalCard(riskData, cardType, cardId, {
            proposalStatus: "rethinking"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "portfolio-priority") {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData
          );
          const updated2 = updatePortfolioProposalCard(portfolioData, cardType, cardId, {
            proposalStatus: "rethinking"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "growth-paths") {
          const growthData = normalizeGrowthPathsData(currentSession.inputData);
          const updated2 = updateGrowthProposalCard(growthData, cardType, cardId, {
            proposalStatus: "rethinking"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "market-forces") {
          const porterData = normalizePorterData(currentSession.inputData);
          const update2 = (arr) => arr.map(
            (item) => item.id === cardId ? { ...item, proposalStatus: "rethinking" } : item
          );
          const updated2 = {};
          if (cardType === "signal") updated2.signals = update2(porterData.signals);
          else if (cardType === "item") {
            updated2.forces = { ...porterData.forces };
            if (updated2.forces[cardId]) {
              updated2.forces[cardId] = {
                ...updated2.forces[cardId],
                proposalStatus: "rethinking"
              };
            }
          } else if (cardType === "tension") updated2.implications = update2(porterData.implications);
          else if (cardType === "move")
            updated2.recommendedMoves = update2(porterData.recommendedMoves);
          else if (cardType === "output-candidate")
            updated2.outputCandidates = update2(porterData.outputCandidates);
          else if (cardType === "conclusion" && porterData.summary) {
            updated2.summary = {
              ...porterData.summary,
              proposalStatus: "rethinking"
            };
          }
          set({
            currentSession: withRecomputedSteps(currentSession, { ...porterData, ...updated2 })
          });
          return;
        }
        if (currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        const update = (arr) => arr.map(
          (item) => item.id === cardId ? { ...item, proposalStatus: "rethinking" } : item
        );
        const updated = {};
        if (cardType === "signal") updated.signals = update(swotData.signals);
        else if (cardType === "item") updated.items = update(swotData.items);
        else if (cardType === "tension") updated.tensions = update(swotData.tensions);
        else if (cardType === "move") updated.recommendedMoves = update(swotData.recommendedMoves);
        else if (cardType === "correlation") updated.correlations = update(swotData.correlations);
        else if (cardType === "output-candidate")
          updated.outputCandidates = update(swotData.outputCandidates);
        else if (cardType === "conclusion" && swotData.summary) {
          updated.summary = { ...swotData.summary, proposalStatus: "rethinking" };
        }
        set({ currentSession: withRecomputedSteps(currentSession, { ...swotData, ...updated }) });
      },
      updateCardAfterRethink: (cardType, cardId, updates) => {
        const { currentSession } = get();
        if (!currentSession) return;
        if (currentSession.toolType === "risk-uncertainty") {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData
          );
          const updated2 = updateRiskProposalCard(riskData, cardType, cardId, {
            ...updates,
            proposalStatus: "ai-proposed"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "portfolio-priority") {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData
          );
          const updated2 = updatePortfolioProposalCard(portfolioData, cardType, cardId, {
            ...updates,
            proposalStatus: "ai-proposed"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "growth-paths") {
          const growthData = normalizeGrowthPathsData(currentSession.inputData);
          const updated2 = updateGrowthProposalCard(growthData, cardType, cardId, {
            ...updates,
            proposalStatus: "ai-proposed"
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "market-forces") {
          const porterData = normalizePorterData(currentSession.inputData);
          const update2 = (arr) => arr.map(
            (item) => item.id === cardId ? { ...item, ...updates, proposalStatus: "ai-proposed" } : item
          );
          const updated2 = {};
          if (cardType === "signal") updated2.signals = update2(porterData.signals);
          else if (cardType === "item") {
            updated2.forces = { ...porterData.forces };
            if (updated2.forces[cardId]) {
              updated2.forces[cardId] = {
                ...updated2.forces[cardId],
                ...updates,
                proposalStatus: "ai-proposed"
              };
            }
          } else if (cardType === "tension") updated2.implications = update2(porterData.implications);
          else if (cardType === "move")
            updated2.recommendedMoves = update2(porterData.recommendedMoves);
          else if (cardType === "output-candidate")
            updated2.outputCandidates = update2(porterData.outputCandidates);
          else if (cardType === "conclusion" && porterData.summary) {
            updated2.summary = {
              ...porterData.summary,
              ...updates,
              proposalStatus: "ai-proposed"
            };
          }
          set({
            currentSession: withRecomputedSteps(currentSession, { ...porterData, ...updated2 })
          });
          return;
        }
        if (currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        const update = (arr) => arr.map(
          (item) => item.id === cardId ? { ...item, ...updates, proposalStatus: "ai-proposed" } : item
        );
        const updated = {};
        if (cardType === "signal") updated.signals = update(swotData.signals);
        else if (cardType === "item") updated.items = update(swotData.items);
        else if (cardType === "tension") updated.tensions = update(swotData.tensions);
        else if (cardType === "move") updated.recommendedMoves = update(swotData.recommendedMoves);
        else if (cardType === "correlation") updated.correlations = update(swotData.correlations);
        else if (cardType === "output-candidate")
          updated.outputCandidates = update(swotData.outputCandidates);
        else if (cardType === "conclusion" && swotData.summary) {
          updated.summary = {
            ...swotData.summary,
            ...updates,
            proposalStatus: "ai-proposed"
          };
        }
        set({ currentSession: withRecomputedSteps(currentSession, { ...swotData, ...updated }) });
      },
      acceptAllInPhase: (phaseId) => {
        const { currentSession } = get();
        if (!currentSession) return;
        if (currentSession.toolType === "risk-uncertainty") {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData
          );
          const acceptAll2 = (arr) => arr.map(
            (item) => item.proposalStatus === "ai-proposed" ? { ...item, proposalStatus: "accepted" } : item
          );
          const updated2 = { ...riskData };
          if (phaseId === "input") updated2.signals = acceptAll2(riskData.signals);
          else if (phaseId === "assumptions") {
            updated2.assumptions = acceptAll2(riskData.assumptions);
            updated2.risks = acceptAll2(riskData.risks);
            updated2.scenarios = acceptAll2(riskData.scenarios);
          } else if (phaseId === "insights") {
            updated2.recommendedMoves = acceptAll2(riskData.recommendedMoves);
          } else if (phaseId === "outputs") {
            if (updated2.summary?.proposalStatus === "ai-proposed") {
              updated2.summary = {
                ...updated2.summary,
                proposalStatus: "accepted"
              };
            }
            updated2.outputCandidates = acceptAll2(riskData.outputCandidates);
          }
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "portfolio-priority") {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData
          );
          const acceptAll2 = (arr) => arr.map(
            (item) => item.proposalStatus === "ai-proposed" ? { ...item, proposalStatus: "accepted" } : item
          );
          const updated2 = { ...portfolioData };
          if (phaseId === "input") updated2.signals = acceptAll2(portfolioData.signals);
          else if (phaseId === "items") updated2.initiatives = acceptAll2(portfolioData.initiatives);
          else if (phaseId === "insights") {
            updated2.tradeOffs = acceptAll2(portfolioData.tradeOffs);
            updated2.recommendedMoves = acceptAll2(portfolioData.recommendedMoves);
          } else if (phaseId === "outputs") {
            if (updated2.summary?.proposalStatus === "ai-proposed") {
              updated2.summary = {
                ...updated2.summary,
                proposalStatus: "accepted"
              };
            }
            updated2.outputCandidates = acceptAll2(portfolioData.outputCandidates);
          }
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "growth-paths") {
          const growthData = normalizeGrowthPathsData(currentSession.inputData);
          const acceptAll2 = (arr) => arr.map(
            (item) => item.proposalStatus === "ai-proposed" ? { ...item, proposalStatus: "accepted" } : item
          );
          const updated2 = { ...growthData };
          if (phaseId === "input") updated2.signals = acceptAll2(growthData.signals);
          else if (phaseId === "options") {
            updated2.quadrants = Object.fromEntries(
              Object.entries(growthData.quadrants).map(([quadrant, items]) => [
                quadrant,
                acceptAll2(items)
              ])
            );
          } else if (phaseId === "insights") {
            updated2.comparisons = acceptAll2(growthData.comparisons);
            updated2.recommendedMoves = acceptAll2(growthData.recommendedMoves);
          } else if (phaseId === "outputs") {
            if (updated2.summary?.proposalStatus === "ai-proposed") {
              updated2.summary = {
                ...updated2.summary,
                proposalStatus: "accepted"
              };
            }
            updated2.outputCandidates = acceptAll2(growthData.outputCandidates);
          }
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType === "market-forces") {
          const porterData = normalizePorterData(currentSession.inputData);
          const acceptAll2 = (arr) => arr.map(
            (item) => item.proposalStatus === "ai-proposed" ? { ...item, proposalStatus: "accepted" } : item
          );
          const updated2 = { ...porterData };
          if (phaseId === "input") updated2.signals = acceptAll2(porterData.signals);
          else if (phaseId === "forces") {
            updated2.forces = Object.fromEntries(
              Object.entries(porterData.forces).map(([forceId, force]) => [
                forceId,
                force.proposalStatus === "ai-proposed" ? { ...force, proposalStatus: "accepted" } : force
              ])
            );
          } else if (phaseId === "insights") {
            updated2.implications = acceptAll2(porterData.implications);
            updated2.recommendedMoves = acceptAll2(porterData.recommendedMoves);
          } else if (phaseId === "outputs") {
            if (updated2.summary?.proposalStatus === "ai-proposed") {
              updated2.summary = {
                ...updated2.summary,
                proposalStatus: "accepted"
              };
            }
            updated2.outputCandidates = acceptAll2(porterData.outputCandidates);
          }
          set({ currentSession: withRecomputedSteps(currentSession, updated2) });
          return;
        }
        if (currentSession.toolType !== "dynamic-swot") return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData);
        const acceptAll = (arr) => arr.map(
          (item) => item.proposalStatus === "ai-proposed" ? { ...item, proposalStatus: "accepted" } : item
        );
        const updated = { ...swotData };
        if (phaseId === "input") updated.signals = acceptAll(swotData.signals);
        else if (phaseId === "swot") updated.items = acceptAll(swotData.items);
        else if (phaseId === "insights") {
          updated.tensions = acceptAll(swotData.tensions);
          updated.correlations = acceptAll(swotData.correlations);
          updated.recommendedMoves = acceptAll(swotData.recommendedMoves);
        } else if (phaseId === "outputs") {
          if (updated.summary?.proposalStatus === "ai-proposed") {
            updated.summary = { ...updated.summary, proposalStatus: "accepted" };
          }
          updated.outputCandidates = acceptAll(swotData.outputCandidates);
        }
        set({ currentSession: withRecomputedSteps(currentSession, updated) });
      },
      addChatMessage: (message) => {
        const { currentSession, currentStep } = get();
        if (!currentSession) return;
        const newMessage = {
          ...message,
          id: generateId(),
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          stepId: currentSession.steps[currentStep - 1]?.stepId
        };
        set({
          currentSession: {
            ...currentSession,
            chatHistory: [...currentSession.chatHistory, newMessage]
          }
        });
      },
      getStepDefinitions: () => {
        const { currentSession } = get();
        if (!currentSession) return [];
        return resolveToolStepDefinitions(currentSession.toolType);
      },
      calculateProgress: () => {
        const { currentSession } = get();
        if (!currentSession) return 0;
        const completedSteps = currentSession.steps.filter((s) => s.status === "completed").length;
        return Math.round(completedSteps / currentSession.steps.length * 100);
      }
    }),
    {
      name: "tool-store",
      partialize: (state) => ({ savedSessions: state.savedSessions })
    }
  )
);
var useToolStore_default = useToolStore;
export {
  A3_STEPS,
  AI_DISCOVERY_STEPS,
  AMBITION_DECOMPOSER_STEPS,
  CAPABILITY_MAPPER_STEPS,
  DMS_STEPS,
  FOCUS_TRADEOFF_STEPS,
  GROWTH_PATHS_STEPS,
  INVENTORY_STEPS,
  NARRATIVE_ENGINE_STEPS,
  PAIN_EXPLORER_STEPS,
  PORTER_STEPS,
  PORTFOLIO_PRIORITY_STEPS,
  PROCESS_AUTOMATION_STEPS,
  RISK_UNCERTAINTY_STEPS,
  RPA_SCANNER_STEPS,
  SMED_STEPS,
  SOP_STEPS,
  SWOT_STEPS,
  TOOLSET_DIGITAL_STEPS,
  TOOLSET_OPERATIONAL_STEPS,
  TOOL_STEP_DEFINITIONS,
  VALUE_CHAIN_STEPS,
  useToolStore_default as default,
  useToolStore
};
