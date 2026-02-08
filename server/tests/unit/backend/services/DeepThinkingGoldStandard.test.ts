/**
 * Deep Thinking Gold Standard Test Suite
 *
 * 5 English + 5 Polish golden prompts for regression testing.
 * Each prompt is evaluated against DoD, rubric, and pattern detection.
 *
 * This suite tests the evaluation pipeline itself (not LLM output),
 * using handcrafted "golden" outputs that MUST pass all checks.
 */

import { describe, expect, it } from 'vitest';

import {
  detectPatterns,
  scoreRubricV2,
} from '../../../../src/services/ai/deepThinkingEvaluationService.js';
import { validateDeepThinkingDoD } from '../../../../src/services/ai/deepThinkingQuality.js';
import { evaluatePassFail } from '../../../../src/services/ai/deepThinkingSelfCheck.js';

// ────────────────────────────────────────────────────────────────────
// Golden outputs (handcrafted decision-grade reports)
// ────────────────────────────────────────────────────────────────────

const GOLDEN_EN: Array<{ id: string; prompt: string; output: string }> = [
  {
    id: 'EN-1',
    prompt: 'Should we migrate from monolith to microservices?',
    output: `## Executive Summary
We recommend a phased strangler-fig migration starting with the payments domain, contingent on team readiness and CI/CD maturity. If we do nothing, technical debt compounds at ~15% per quarter, increasing deployment risk.

## Problem Framing
Decision horizon: 12 months. Stakeholders: Engineering, Product, Finance.
If we do nothing: coupling increases, deployment cadence drops, new feature velocity degrades.

## Options
1. Full rewrite to microservices (high risk, 9–12 months)
2. Strangler-fig pattern — incremental extraction (medium risk, ongoing)
3. Modular monolith refactor (low risk, 3–6 months)

## Trade-offs
Option 1 is fastest to target state but carries execution risk and team burnout. Option 2 balances speed vs safety. Option 3 avoids distributed complexity but limits scaling.

## Recommendation + boundary conditions
Do Option 2 unless: (a) team lacks distributed systems experience, or (b) budget is cut > 30%. In those cases, fall back to Option 3.

## Risks & Blind spots
Key assumption: current CI/CD pipeline can support parallel deployments. Blind spot: inter-service latency not benchmarked. Unknown: will vendor contracts allow service decomposition?

## Next actions
- Spike: extract payments service (2 weeks)
- Set up service mesh POC
- Establish SLOs for inter-service calls
Early signals: deployment frequency, P99 latency, team velocity.`,
  },
  {
    id: 'EN-2',
    prompt: 'How to allocate Q3 budget across marketing channels?',
    output: `## Executive Summary
Allocate 45% to digital performance, 30% to content/SEO, 15% to events, 10% reserve. If we do nothing and maintain Q2 allocation, CAC rises as paid channels saturate.

## Problem Framing
Horizon: Q3 (90 days). Stakeholders: CMO, Sales VP, CFO.
If we do nothing: diminishing returns on paid acquisition continue; organic pipeline stays flat.

## Options
1. Double down on paid performance (60% paid)
2. Balanced portfolio (45/30/15/10 split)
3. Content-first with minimal paid (20% paid, 50% content)

## Trade-offs
Option 1 maximizes short-term pipeline but risks CAC inflation. Option 3 builds long-term assets but slow payoff. Option 2 balances speed vs sustainability.

## Recommendation + boundary conditions
Go with Option 2 unless: paid CAC exceeds $120 (trigger rebalance to Option 3), or a major event opportunity arises (shift 10% from reserve to events).

## Risks & Blind spots
Assumption: content team can produce 3x output with current headcount. Blind spot: competitor ad spend unknown. Gap: attribution model accuracy for content channels.

## Next actions
- Finalize channel-level targets by week 1
- Set up weekly CAC monitoring dashboard
- Reserve fund release criteria defined
Early signals: weekly CAC trend, organic traffic growth rate, event registration conversion.`,
  },
  {
    id: 'EN-3',
    prompt: 'Should we hire a CTO or promote internally?',
    output: `## Executive Summary
Promote the VP Engineering to CTO role with a 6-month external advisory board, unless the board requires domain expertise we lack internally. If we do nothing, leadership vacuum persists and strategic initiatives stall.

## Problem Framing
Horizon: 30-day decision, 6-month transition. Stakeholders: CEO, Board, Engineering.
If we do nothing: technology direction remains unclear, key engineers at flight risk.

## Options
1. External CTO hire (executive search, 3-6 months)
2. Internal promotion of VP Engineering
3. Interim CTO from advisory network + parallel search

## Trade-offs
External hire brings fresh perspective but risks culture clash and 6-month ramp time. Internal promotion preserves culture but may lack strategic breadth. Interim option buys time but creates uncertainty.

## Recommendation + boundary conditions
Promote internally unless: (a) board requires public-company experience, or (b) upcoming IPO within 18 months demands external credibility.

## Risks & Blind spots
Assumption: VP Engineering wants the role and can grow into strategic scope. Gap: no formal assessment of strategic thinking capabilities done. Unknown: board's true priority — stability or transformation?

## Next actions
- Conduct CEO-VP alignment conversation (this week)
- Board sentiment check (informal)
- Draft 90-day CTO transition plan
Early signals: VP's strategic proposal quality, board feedback tone, engineering team retention.`,
  },
  {
    id: 'EN-4',
    prompt: 'Evaluate build vs buy for our analytics platform',
    output: `## Executive Summary
Buy a proven analytics platform (e.g., Looker/Metabase) and customize, unless core analytics is a competitive differentiator. If we do nothing, engineering spends 30% of capacity maintaining bespoke tooling.

## Problem Framing
Horizon: 6 months to decision, 12 months to full deployment. Stakeholders: Product, Engineering, Data, Finance.
If we do nothing: opportunity cost of $500K+ per year in engineering time on non-differentiating work.

## Options
1. Build custom analytics platform from scratch
2. Buy commercial solution (Looker, Metabase, Preset)
3. Hybrid: buy core platform, build custom connectors and dashboards

## Trade-offs
Build gives full control but 6-12 months to MVP and ongoing maintenance burden. Buy is fastest but may not cover all use cases. Hybrid balances customization vs speed to value.

## Recommendation + boundary conditions
Go with Option 3 (hybrid) unless: (a) analytics IS the product (then build), or (b) budget < $50K/year (then pure buy with constraints).

## Risks & Blind spots
Assumption: vendor APIs are stable and well-documented. Gap: no POC done with shortlisted vendors. Unknown: data governance requirements may limit cloud vendor choice.

## Next actions
- Vendor shortlist and POC with top 2 (2 weeks)
- Define custom connector requirements
- Security/compliance review of vendor data handling
Early signals: POC user satisfaction score, connector development velocity, data freshness SLA compliance.`,
  },
  {
    id: 'EN-5',
    prompt: 'How to handle a key client threatening to leave?',
    output: `## Executive Summary
Launch a structured retention engagement: executive alignment meeting within 48h, root cause analysis within 1 week, and a tailored retention offer. If we do nothing, estimated 70% probability of churn within 60 days.

## Problem Framing
Horizon: 14-day critical window. Stakeholders: Account Manager, VP Sales, Product, CS Lead.
If we do nothing: lose $1.2M ARR + negative reference risk + team morale impact.

## Options
1. Aggressive discount (20% off renewal)
2. Structured retention: align on gaps, create custom success plan, executive sponsorship
3. Strategic exit: negotiate favorable terms, secure reference, plan transition

## Trade-offs
Discount is fastest but sets bad precedent and doesn't address root cause. Structured retention takes effort but builds deeper relationship. Strategic exit protects brand but loses revenue.

## Recommendation + boundary conditions
Option 2 unless: (a) client's needs have fundamentally diverged from product roadmap, or (b) account is unprofitable even with retention investment.

## Risks & Blind spots
Assumption: client is open to dialogue (not already signed with competitor). Gap: NPS data for this account is 6 months old. Unknown: internal champion at client may have changed roles.

## Next actions
- Schedule executive call within 48h
- Pull full usage analytics and support ticket history
- Prepare 3 retention scenarios with ROI for each
Early signals: client response time to meeting request, engagement with proposed action items, internal champion status.`,
  },
];

const GOLDEN_PL: Array<{ id: string; prompt: string; output: string }> = [
  {
    id: 'PL-1',
    prompt: 'Czy powinniśmy wdrożyć OKR-y w organizacji?',
    output: `## Executive Summary
Rekomendujemy pilotażowe wdrożenie OKR w 2 zespołach przez Q3, z pełnym rollout pod warunkiem pozytywnej ewaluacji. Jeśli nic nie zrobimy, brak spójności celów między działami pogłębia się.

## Problem Framing
Horyzont decyzyjny: 6 miesięcy (pilot + ewaluacja). Interesariusze: CEO, HR, liderzy zespołów.
Jeśli nic nie zrobimy: cele pozostają rozbieżne, priorytetyzacja ad-hoc, trudności w mierzeniu postępów.

## Opcje
1. Pełne wdrożenie OKR we wszystkich zespołach od Q3
2. Pilotaż w 2 zespołach, ewaluacja po kwartale, potem rollout
3. Lekki framework celów (bez pełnych OKR) — kwartalny review

## Trade-offs
Opcja 1 jest szybka ale ryzykowna — brak doświadczenia może zabić inicjatywę. Opcja 2 balansuje szybkość vs bezpieczeństwo. Opcja 3 jest najłatwiejsza ale nie daje pełnych korzyści.

## Rekomendacja + warunki brzegowe
Wdróż Opcję 2, chyba że: (a) organizacja ma mniej niż 20 osób (wtedy Opcja 3 wystarczy), lub (b) CEO nie jest gotów na publiczne dzielenie się celami.

## Ryzyka & Blind spots
Założenie: liderzy zespołów mają czas na naukę frameworka. Luka: brak benchmarku obecnego poziomu alignment. Nieznane: czy kultura organizacyjna toleruje transparentność celów.

## Następne kroki
- Wybór 2 zespołów pilotażowych (tydzień 1)
- Szkolenie z OKR dla liderów (tydzień 2)
- Ustalenie kryteriów sukcesu pilotażu
Wczesne sygnały: jakość napisanych OKR-ów, frekwencja na check-inach, feedback zespołów.`,
  },
  {
    id: 'PL-2',
    prompt: 'Jak zoptymalizować proces rekrutacji w firmie technologicznej?',
    output: `## Executive Summary
Rekomendujemy wdrożenie strukturyzowanego pipeline rekrutacyjnego z 4 etapami i SLA na każdy etap. Jeśli nic nie zrobimy, time-to-hire rośnie średnio o 15% kwartalnie.

## Problem Framing
Horyzont: 90 dni na wdrożenie. Interesariusze: HR, Hiring Managers, CTO, Finance.
Jeśli nic nie zrobimy: tracimy top kandydatów do szybszej konkurencji, koszt rekrutacji rośnie.

## Opcje
1. Outsource rekrutacji do agencji (szybko, drogo)
2. Wewnętrzna optymalizacja: SLA + narzędzia + szkolenia HM
3. Hybrid: agencja na senior role, wewnętrzna na mid/junior

## Trade-offs
Agencja jest szybka ale kosztowna (20-25% wynagrodzenia) i nie buduje kompetencji wewnętrznych. Wewnętrzna optymalizacja wymaga inwestycji w proces ale daje długoterminowe korzyści. Hybrid balansuje koszt vs szybkość.

## Rekomendacja + warunki brzegowe
Opcja 2, chyba że: (a) mamy więcej niż 10 otwartych senior ról jednocześnie, lub (b) HR team ma mniej niż 2 rekruterów.

## Ryzyka & Blind spots
Założenie: hiring managers mają czas na szkolenia i feedback. Luka: brak danych o current drop-off rates per stage. Nieznane: oczekiwania kandydatów w aktualnym rynku.

## Następne kroki
- Audit obecnego procesu: time-to-hire, drop-off, source effectiveness (tydzień 1-2)
- Wdrożenie ATS z SLA tracking (tydzień 3-4)
- Szkolenie Hiring Managers z structured interviewing
Wczesne sygnały: time-to-hire trend, offer acceptance rate, candidate NPS.`,
  },
  {
    id: 'PL-3',
    prompt: 'Czy przenieść infrastrukturę do chmury?',
    output: `## Executive Summary
Rekomendujemy fazową migrację do chmury (lift-and-shift → optimize → cloud-native) zaczynając od środowisk dev/staging. Jeśli nic nie zrobimy, koszt utrzymania on-prem rośnie o 20% rocznie.

## Problem Framing
Horyzont: 18 miesięcy (pełna migracja). Interesariusze: CTO, DevOps, Finance, Security.
Jeśli nic nie zrobimy: hardware refresh za 8 miesięcy ($200K), rosnący dług infrastrukturalny.

## Opcje
1. Pełna migracja cloud-native (rewrite) — 18-24 miesiące
2. Fazowe lift-and-shift → optimize — 12-18 miesięcy
3. Hybrid: krytyczne systemy on-prem, reszta w chmurze

## Trade-offs
Cloud-native daje najlepszą architekturę ale najdłuższy czas i najwyższe ryzyko. Lift-and-shift jest bezpieczniejszy ale nie wykorzystuje pełni chmury. Hybrid minimalizuje ryzyko ale komplikuje operacje.

## Rekomendacja + warunki brzegowe
Opcja 2, chyba że: (a) regulacje zabraniają przeniesienia danych do chmury publicznej, lub (b) team nie ma doświadczenia cloud (wtedy najpierw szkolenia 3 miesiące).

## Ryzyka & Blind spots
Założenie: koszty chmury w steady-state niższe niż on-prem. Luka: brak TCO analizy dla top 3 providerów. Nieznane: czy wszystkie licencje software pozwalają na cloud deployment.

## Następne kroki
- TCO porównanie: AWS vs Azure vs GCP (2 tygodnie)
- POC: migracja staging environment (4 tygodnie)
- Security review i compliance mapping
Wczesne sygnały: koszt POC vs budżet, czas deploy w chmurze vs on-prem, incydenty bezpieczeństwa.`,
  },
  {
    id: 'PL-4',
    prompt: 'Jak wejść na rynek niemiecki z naszym produktem SaaS?',
    output: `## Executive Summary
Rekomendujemy wejście przez partnera channel w Niemczech z lokalizacją produktu i dedykowanym CS, zamiast bezpośredniej sprzedaży. Jeśli nic nie zrobimy, tracimy okno rynkowe — konkurent X już buduje pozycję.

## Problem Framing
Horyzont: 6 miesięcy do pierwszego klienta DE. Interesariusze: CEO, VP Sales, Product, Legal.
Jeśli nic nie zrobimy: rynek niemiecki zablokowany przez early movers, koszt wejścia rośnie z czasem.

## Opcje
1. Bezpośrednia sprzedaż: budowa zespołu DE od zera
2. Partner channel: współpraca z lokalnym resellerem/integratorem
3. PLG (Product-Led Growth): self-service + lokalizacja + content DE

## Trade-offs
Bezpośrednia sprzedaż daje kontrolę ale wymaga 6-12 miesięcy i €500K+ inwestycji. Partner jest szybszy ale marże niższe. PLG jest najtańszy ale wymaga silnego produktu i brand awareness.

## Rekomendacja + warunki brzegowe
Opcja 2, chyba że: (a) ACV > €50K (wtedy bezpośrednia sprzedaż), lub (b) produkt jest self-service ready (wtedy PLG jako uzupełnienie).

## Ryzyka & Blind spots
Założenie: istnieją partnerzy z dopasowanym portfolio klientów. Luka: brak analizy DSGVO compliance naszego produktu. Nieznane: willingness to pay na rynku DE vs PL.

## Następne kroki
- Shortlist 5 potencjalnych partnerów DE (2 tygodnie)
- DSGVO compliance gap analysis
- Lokalizacja produktu: UI + dokumentacja + wsparcie
Wczesne sygnały: response rate partnerów, wynik compliance review, pierwsze demo requests z DE.`,
  },
  {
    id: 'PL-5',
    prompt: 'Jak zarządzić konfliktem między działami sprzedaży i produktu?',
    output: `## Executive Summary
Rekomendujemy wdrożenie wspólnego systemu priorytetyzacji (RICE/ICE) z cotygodniowym joint review i transparentnym backlogiem. Jeśli nic nie zrobimy, konflikt eskaluje, morale spada, klienci odczuwają chaos.

## Problem Framing
Horyzont: 30 dni na quick wins, 90 dni na systemowe zmiany. Interesariusze: VP Sales, VP Product, CEO.
Jeśli nic nie zrobimy: feature requests ignorowane → sales frustracja → obietnice klientom bez konsultacji → product frustracja → spirala konfliktu.

## Opcje
1. Arbitraż CEO: CEO decyduje o priorytetach (szybkie ale nie skalowalne)
2. Joint prioritization framework: RICE/ICE + wspólny backlog
3. Embedded PM w Sales: dedykowany PM jako liaison

## Trade-offs
Arbitraż jest szybki ale uzależnia od jednej osoby i nie buduje kultury współpracy. Joint framework wymaga dyscypliny ale jest skalowalny. Embedded PM daje most ale to dodatkowy koszt i ryzyko single point of failure.

## Rekomendacja + warunki brzegowe
Opcja 2 z elementami Opcji 3, chyba że: (a) zespoły są zbyt małe na formalne procesy (< 10 osób łącznie), lub (b) CEO preferuje hands-on decydowanie.

## Ryzyka & Blind spots
Założenie: oba działy chcą współpracować (nie ma ukrytych agend). Luka: brak danych o tym, ile feature requests od sales faktycznie generuje revenue. Nieznane: prawdziwe źródło konfliktu — czy to priorytety czy komunikacja?

## Następne kroki
- 1:1 z VP Sales i VP Product osobno (tydzień 1)
- Audit: top 10 feature requests + ich revenue impact
- Setup joint weekly review (tydzień 2)
Wczesne sygnały: attendance i engagement na joint review, liczba eskalacji do CEO, NPS od sales na współpracę z product.`,
  },
];

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

describe('Deep Thinking Gold Standard — English (5 prompts)', () => {
  for (const golden of GOLDEN_EN) {
    describe(`${golden.id}: ${golden.prompt.slice(0, 50)}…`, () => {
      it('passes DoD validation', () => {
        const dod = validateDeepThinkingDoD(golden.output, 'en');
        expect(dod.ok).toBe(true);
      });

      it('scores rubric total >= 10 (PASS threshold)', () => {
        const rubric = scoreRubricV2(golden.output, 'en');
        expect(rubric.total).toBeGreaterThanOrEqual(10);
      });

      it('passes evaluatePassFail', () => {
        const rubric = scoreRubricV2(golden.output, 'en');
        const patterns = detectPatterns(golden.output, 'en');
        const { pass } = evaluatePassFail({ rubric, negativePatterns: patterns.negative });
        expect(pass).toBe(true);
      });

      it('has no critical negative patterns (N1, N2, N3)', () => {
        const patterns = detectPatterns(golden.output, 'en');
        expect(patterns.negative).not.toContain('N1'); // No framing
        expect(patterns.negative).not.toContain('N2'); // Single-path bias
        expect(patterns.negative).not.toContain('N3'); // No trade-offs
      });

      it('has positive patterns P1 + P2 + P3 at minimum', () => {
        const patterns = detectPatterns(golden.output, 'en');
        expect(patterns.positive).toContain('P1'); // Framed decision
        expect(patterns.positive).toContain('P2'); // Multiple options
        expect(patterns.positive).toContain('P3'); // Trade-offs
      });
    });
  }
});

describe('Deep Thinking Gold Standard — Polish (5 prompts)', () => {
  for (const golden of GOLDEN_PL) {
    describe(`${golden.id}: ${golden.prompt.slice(0, 50)}…`, () => {
      it('passes DoD validation', () => {
        const dod = validateDeepThinkingDoD(golden.output, 'pl');
        expect(dod.ok).toBe(true);
      });

      it('scores rubric total >= 10 (PASS threshold)', () => {
        const rubric = scoreRubricV2(golden.output, 'pl');
        expect(rubric.total).toBeGreaterThanOrEqual(10);
      });

      it('passes evaluatePassFail', () => {
        const rubric = scoreRubricV2(golden.output, 'pl');
        const patterns = detectPatterns(golden.output, 'pl');
        const { pass } = evaluatePassFail({ rubric, negativePatterns: patterns.negative });
        expect(pass).toBe(true);
      });

      it('has no critical negative patterns (N1, N2, N3)', () => {
        const patterns = detectPatterns(golden.output, 'pl');
        expect(patterns.negative).not.toContain('N1');
        expect(patterns.negative).not.toContain('N2');
        expect(patterns.negative).not.toContain('N3');
      });

      it('has positive patterns P1 + P2 at minimum', () => {
        const patterns = detectPatterns(golden.output, 'pl');
        expect(patterns.positive).toContain('P1');
        expect(patterns.positive).toContain('P2');
      });
    });
  }
});
