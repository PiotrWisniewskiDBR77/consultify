/**
 * Value Chain (Porter) — laddered question bank (OXFORD O3, tool #4).
 *
 * Sibling of src/config/swot/dynamicSwotQuestionBank.ts. Where SWOT walks a
 * ladder per QUADRANT, the value chain walks a ladder per ACTIVITY. All 9
 * activities share the SAME 4-rung deepening protocol (the methodology spine),
 * so the ladder is defined once as a template and specialized per activity with
 * activity-specific probes. The branches encode the doctrine:
 *
 *   L1 surface     — how is this activity actually run? (locate the practice)
 *   L2 cost/value  — its share of cost AND its effect on willingness-to-pay
 *                    (branch on which side dominates — the lever differs)
 *   L3 benchmark   — maturity vs a reference: in-house/outsourced, manual/digital,
 *                    vs best-in-class (branch on where the gap is)
 *   L4 potential   — the improvement lever the gap unlocks: improve / automate /
 *                    outsource / integrate (branch selects the move family)
 *
 * Every function is pure — the runtime interview and the wizard render the SAME
 * question (single source of truth). The branch keys are stable and persisted.
 */

import type { ValueActivityId, ValueActivityKind } from '@/store/useToolStore';

export type ValueChainQuestionLevel = 1 | 2 | 3 | 4;

/** The move family a completed ladder points at — a hypothesis, confirmed by the AI. */
export type ValueChainLeverFamily = 'improve' | 'automate' | 'outsource' | 'integrate';

/** How a cost-value proof lands — decides whether the lever is cost- or value-led. */
export type ValueChainCostValuePole = 'cost-drain' | 'value-creator' | 'mixed' | 'neutral';

export interface ValueChainAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextQuestionId. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (steers the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface ValueChainQuestionNode {
  id: string;
  activityId: ValueActivityId;
  level: ValueChainQuestionLevel;
  /** Why a partner asks this (surfaced to the AI, optionally as a tooltip). */
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  /** Follow-up probe when the answer is vague. */
  probeEn?: string;
  probePl?: string;
  answerOptions: ValueChainAnswerOption[];
  /** answerKey -> next question id. `null` = ladder complete for this path. */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

export interface ValueChainActivityMeta {
  id: ValueActivityId;
  kind: ValueActivityKind;
  nameEn: string;
  namePl: string;
  /** The one thing this activity is really about (steers the L1 surface probe). */
  probeEn: string;
  probePl: string;
}

export const VALUE_CHAIN_ACTIVITIES: ValueChainActivityMeta[] = [
  {
    id: 'inboundLogistics',
    kind: 'primary',
    nameEn: 'Inbound Logistics',
    namePl: 'Logistyka wejścia',
    probeEn: 'receiving, storing and distributing inputs',
    probePl: 'przyjmowanie, magazynowanie i rozdział surowców/wejść',
  },
  {
    id: 'operations',
    kind: 'primary',
    nameEn: 'Operations',
    namePl: 'Operacje',
    probeEn: 'transforming inputs into the final product/service',
    probePl: 'przekształcanie wejść w gotowy produkt/usługę',
  },
  {
    id: 'outboundLogistics',
    kind: 'primary',
    nameEn: 'Outbound Logistics',
    namePl: 'Logistyka wyjścia',
    probeEn: 'collecting, storing and delivering the product to buyers',
    probePl: 'kompletowanie, magazynowanie i dostarczanie produktu klientom',
  },
  {
    id: 'marketingSales',
    kind: 'primary',
    nameEn: 'Marketing & Sales',
    namePl: 'Marketing i sprzedaż',
    probeEn: 'how buyers learn about and choose to buy',
    probePl: 'jak klienci poznają ofertę i decydują się na zakup',
  },
  {
    id: 'service',
    kind: 'primary',
    nameEn: 'Service',
    namePl: 'Serwis',
    probeEn: 'maintaining or enhancing product value after the sale',
    probePl: 'utrzymanie lub zwiększenie wartości produktu po sprzedaży',
  },
  {
    id: 'infrastructure',
    kind: 'support',
    nameEn: 'Firm Infrastructure',
    namePl: 'Infrastruktura firmy',
    probeEn: 'management, finance, planning, legal, quality systems',
    probePl: 'zarządzanie, finanse, planowanie, prawo, systemy jakości',
  },
  {
    id: 'hrManagement',
    kind: 'support',
    nameEn: 'HR Management',
    namePl: 'Zarządzanie ludźmi',
    probeEn: 'recruiting, developing and retaining the people the chain needs',
    probePl: 'rekrutacja, rozwój i utrzymanie ludzi, których łańcuch potrzebuje',
  },
  {
    id: 'technology',
    kind: 'support',
    nameEn: 'Technology Development',
    namePl: 'Rozwój technologii',
    probeEn: 'know-how, R&D, tools and systems that improve the chain',
    probePl: 'know-how, B+R, narzędzia i systemy usprawniające łańcuch',
  },
  {
    id: 'procurement',
    kind: 'support',
    nameEn: 'Procurement',
    namePl: 'Zakupy',
    probeEn: 'sourcing and buying the inputs each activity consumes',
    probePl: 'pozyskiwanie i zakup wejść zużywanych przez poszczególne ogniwa',
  },
];

const qid = (activityId: ValueActivityId, level: number, suffix = '') =>
  `${activityId}-l${level}${suffix ? `-${suffix}` : ''}`;

/**
 * Builds the 4-rung ladder for one activity. The shape is identical across
 * activities (the methodology spine); only the surface probe is specialized.
 * Branching: L2 splits on which side of the cost-value proof dominates; L4
 * splits into the move family (improve/automate/outsource/integrate).
 */
export function buildActivityLadder(meta: ValueChainActivityMeta): ValueChainQuestionNode[] {
  const a = meta.id;
  const l1 = qid(a, 1);
  const l2 = qid(a, 2);
  const l3cost = qid(a, 3, 'cost');
  const l3value = qid(a, 3, 'value');
  const l4 = qid(a, 4);

  return [
    {
      id: l1,
      activityId: a,
      level: 1,
      intentEn: 'Locate the real practice before rating it.',
      intentPl: 'Zlokalizować realną praktykę, zanim ją ocenimy.',
      textEn: `For ${meta.nameEn} (${meta.probeEn}) — how is it actually run today, in one concrete sentence? Who does it, with what, and how much of it is manual?`,
      textPl: `Dla ogniwa „${meta.namePl}" (${meta.probePl}) — jak jest DZIŚ realizowane, w jednym konkretnym zdaniu? Kto to robi, czym i jak dużo jest ręczne?`,
      probeEn: 'Describe the last time it broke or slowed down — that is where the practice really lives.',
      probePl: 'Opisz ostatni raz, kiedy to się zacięło lub spowolniło — tam naprawdę żyje ta praktyka.',
      answerOptions: [
        {
          key: 'described',
          labelEn: 'I can describe how it runs concretely',
          labelPl: 'Potrafię konkretnie opisać, jak działa',
          consultantSignalEn: 'Surface located — move to the cost-value proof.',
          consultantSignalPl: 'Powierzchnia zlokalizowana — przejdź do dowodu kosztowo-wartościowego.',
        },
        {
          key: 'unclear',
          labelEn: 'It is not clearly owned / varies a lot',
          labelPl: 'Nie ma jasnego właściciela / bardzo się różni',
          consultantSignalEn: 'Inconsistency itself is a finding — probe the variance, then proceed.',
          consultantSignalPl: 'Sama niespójność jest wnioskiem — zbadaj rozrzut, potem idź dalej.',
        },
      ],
      branches: { described: l2, unclear: l2 },
      defaultNextId: l2,
    },
    {
      id: l2,
      activityId: a,
      level: 2,
      intentEn: 'Force the cost-value proof — a score without it is folklore.',
      intentPl: 'Wymusić dowód kosztowo-wartościowy — ocena bez niego to folklor.',
      textEn: `Where does ${meta.nameEn} show up in the P&L and in what the customer will pay? Roughly what share of total cost does it drive, and does the customer notice it (would they pay less if it were worse)?`,
      textPl: `Gdzie „${meta.namePl}" widać w rachunku wyników i w tym, ile klient zapłaci? Jaki mniej więcej udział w koszcie całkowitym generuje i czy klient to zauważa (zapłaciłby mniej, gdyby było gorsze)?`,
      probeEn: 'If you cannot name the share, who owns that number and by when can we get it? Until then it is "declared".',
      probePl: 'Jeśli nie znasz udziału — kto ma tę liczbę i na kiedy ją zdobędziemy? Do tego czasu to „deklaracja".',
      answerOptions: [
        {
          key: 'cost-heavy',
          labelEn: 'Big cost, customer barely notices',
          labelPl: 'Duży koszt, klient prawie nie zauważa',
          consultantSignalEn: 'Cost drain — candidate to automate/outsource; test maturity next.',
          consultantSignalPl: 'Wyciek kosztowy — kandydat do automatyzacji/outsourcingu; testuj dojrzałość.',
        },
        {
          key: 'value-heavy',
          labelEn: 'Modest cost, but customers value it strongly',
          labelPl: 'Umiarkowany koszt, ale klienci mocno to cenią',
          consultantSignalEn: 'Value creator — protect and widen; test maturity for headroom.',
          consultantSignalPl: 'Twórca wartości — chroń i poszerzaj; testuj dojrzałość pod zapas.',
        },
        {
          key: 'both-high',
          labelEn: 'Both — big cost AND strongly valued',
          labelPl: 'Oba — duży koszt I mocno ceniony',
          consultantSignalEn: 'The margin fulcrum — highest stakes; benchmark rigorously.',
          consultantSignalPl: 'Punkt podparcia marży — najwyższa stawka; benchmarkuj rygorystycznie.',
        },
        {
          key: 'neither',
          labelEn: 'Neither large cost nor differentiating',
          labelPl: 'Ani duży koszt, ani wyróżnik',
          consultantSignalEn: 'Low priority — park it; do not over-analyze.',
          consultantSignalPl: 'Niski priorytet — odłóż; nie przeanalizowuj.',
        },
      ],
      branches: {
        'cost-heavy': l3cost,
        'value-heavy': l3value,
        'both-high': l3cost,
        neither: l4,
      },
      defaultNextId: l3cost,
    },
    {
      id: l3cost,
      activityId: a,
      level: 3,
      intentEn: 'Benchmark the cost side — locate the maturity gap that unlocks a cut.',
      intentPl: 'Benchmarkuj stronę kosztową — zlokalizuj lukę dojrzałości, która odblokuje cięcie.',
      textEn: `Compared to how the best in your industry run ${meta.nameEn} — is yours in-house or outsourced, manual or digitalized? Where exactly is the gap that makes it cost more than it should?`,
      textPl: `W porównaniu z tym, jak najlepsi w branży realizują „${meta.namePl}" — u Was jest to in-house czy outsourcing, ręcznie czy cyfrowo? Gdzie dokładnie jest luka, przez którą kosztuje więcej niż powinno?`,
      probeEn: 'Name one competitor or reference you would benchmark against — vague "the market" is not a benchmark.',
      probePl: 'Wskaż jednego konkurenta lub punkt odniesienia do benchmarku — mgliste „rynek" to nie benchmark.',
      answerOptions: [
        {
          key: 'manual-inhouse',
          labelEn: 'Mostly manual / in-house, behind peers',
          labelPl: 'Głównie ręcznie / in-house, w tyle za innymi',
          consultantSignalEn: 'Automate if core, outsource if not — L4 decides.',
          consultantSignalPl: 'Zautomatyzuj jeśli rdzeń, outsourcuj jeśli nie — L4 decyduje.',
        },
        {
          key: 'at-par',
          labelEn: 'Roughly at parity with peers',
          labelPl: 'Mniej więcej na poziomie innych',
          consultantSignalEn: 'Little cost headroom — look for linkage gains instead.',
          consultantSignalPl: 'Mały zapas kosztowy — szukaj zysków z integracji zamiast tego.',
        },
      ],
      branches: { 'manual-inhouse': l4, 'at-par': l4 },
      defaultNextId: l4,
    },
    {
      id: l3value,
      activityId: a,
      level: 3,
      intentEn: 'Benchmark the value side — is the differentiation defensible and has it room to grow?',
      intentPl: 'Benchmarkuj stronę wartości — czy wyróżnienie jest do obrony i ma zapas wzrostu?',
      textEn: `On the value ${meta.nameEn} creates — is it something only you do well, or does every serious competitor match it? And is your capability strong, or is the differentiation fragile?`,
      textPl: `Co do wartości, którą tworzy „${meta.namePl}" — to coś, co robicie dobrze tylko Wy, czy dorównuje każdy poważny konkurent? I czy Wasza zdolność jest silna, czy wyróżnienie jest kruche?`,
      probeEn: 'What would a customer switch to if this got 10% worse? That reveals how defensible it really is.',
      probePl: 'Na co klient by się przerzucił, gdyby to było o 10% gorsze? To pokazuje, jak bardzo jest to do obrony.',
      answerOptions: [
        {
          key: 'defensible-immature',
          labelEn: 'Distinctive but our capability is still weak',
          labelPl: 'Wyróżniające, ale nasza zdolność jeszcze słaba',
          consultantSignalEn: 'Invest to widen the moat — value-enhancement lever.',
          consultantSignalPl: 'Inwestuj, by poszerzyć fosę — dźwignia wzmocnienia wartości.',
        },
        {
          key: 'commodity',
          labelEn: 'Everyone matches it — it is table stakes',
          labelPl: 'Każdy dorównuje — to standard rynkowy',
          consultantSignalEn: 'Not a differentiator — manage it for cost, not value.',
          consultantSignalPl: 'To nie wyróżnik — zarządzaj kosztem, nie wartością.',
        },
      ],
      branches: { 'defensible-immature': l4, commodity: l3cost },
      defaultNextId: l4,
    },
    {
      id: l4,
      activityId: a,
      level: 4,
      intentEn: 'Convert the gap into a move family, with its inherent trade-off named.',
      intentPl: 'Przekuć lukę w rodzinę ruchów, nazywając wpisany w nią trade-off.',
      textEn: `Given the cost-value proof and the benchmark gap for ${meta.nameEn} — which move fits: IMPROVE (raise maturity in-house), AUTOMATE (remove manual cost), OUTSOURCE (buy it cheaper/better outside), or INTEGRATE (tie it tighter to adjacent activities)? What do you give up by choosing it?`,
      textPl: `Biorąc pod uwagę dowód kosztowo-wartościowy i lukę benchmarku dla „${meta.namePl}" — który ruch pasuje: USPRAWNIJ (podnieś dojrzałość in-house), ZAUTOMATYZUJ (usuń koszt ręczny), OUTSOURCUJ (kup taniej/lepiej na zewnątrz), czy ZINTEGRUJ (spnij mocniej z sąsiednimi ogniwami)? Co tracisz, wybierając ten ruch?`,
      probeEn: 'For outsource: what control do you give up and what dependency do you take on? Name both or it is not a decision.',
      probePl: 'Dla outsourcingu: jaką kontrolę oddajesz i jaką zależność przyjmujesz? Nazwij oba, inaczej to nie decyzja.',
      answerOptions: [
        {
          key: 'improve',
          labelEn: 'Improve in-house (raise maturity)',
          labelPl: 'Usprawnij in-house (podnieś dojrzałość)',
          consultantSignalEn: 'Capability build — trade-off is time/focus vs faster external options.',
          consultantSignalPl: 'Budowa zdolności — trade-off to czas/uwaga vs szybsze opcje zewnętrzne.',
        },
        {
          key: 'automate',
          labelEn: 'Automate (remove manual cost)',
          labelPl: 'Zautomatyzuj (usuń koszt ręczny)',
          consultantSignalEn: 'Cost-reduction — trade-off is upfront investment + change vs recurring savings.',
          consultantSignalPl: 'Redukcja kosztu — trade-off to inwestycja + zmiana vs oszczędności powtarzalne.',
        },
        {
          key: 'outsource',
          labelEn: 'Outsource (buy it outside)',
          labelPl: 'Outsourcuj (kup na zewnątrz)',
          consultantSignalEn: 'Outsource — trade-off is lost control + new dependency vs lower cost; force both.',
          consultantSignalPl: 'Outsourcing — trade-off to utrata kontroli + nowa zależność vs niższy koszt; wymuś oba.',
        },
        {
          key: 'integrate',
          labelEn: 'Integrate with adjacent activities',
          labelPl: 'Zintegruj z sąsiednimi ogniwami',
          consultantSignalEn: 'Linkage-optimization — trade-off is coordination cost vs end-to-end gain.',
          consultantSignalPl: 'Optymalizacja powiązań — trade-off to koszt koordynacji vs zysk end-to-end.',
        },
      ],
      branches: { improve: null, automate: null, outsource: null, integrate: null },
      defaultNextId: null,
    },
  ];
}

/** Answer key on the L4 node -> the lever/move family it selects. */
export const L4_KEY_TO_FAMILY: Record<string, ValueChainLeverFamily> = {
  improve: 'improve',
  automate: 'automate',
  outsource: 'outsource',
  integrate: 'integrate',
};

/** Answer key on the L2 node -> which pole of the cost-value proof dominates. */
export const L2_KEY_TO_POLE: Record<string, ValueChainCostValuePole> = {
  'cost-heavy': 'cost-drain',
  'value-heavy': 'value-creator',
  'both-high': 'mixed',
  neither: 'neutral',
};

/** All 9 ladders, keyed by activity id. */
export function getAllActivityLadders(): Record<ValueActivityId, ValueChainQuestionNode[]> {
  const out = {} as Record<ValueActivityId, ValueChainQuestionNode[]>;
  VALUE_CHAIN_ACTIVITIES.forEach((meta) => {
    out[meta.id] = buildActivityLadder(meta);
  });
  return out;
}

/** Flat lookup of every node across all activities. */
export function getQuestionNode(id: string): ValueChainQuestionNode | undefined {
  for (const meta of VALUE_CHAIN_ACTIVITIES) {
    const node = buildActivityLadder(meta).find((n) => n.id === id);
    if (node) return node;
  }
  return undefined;
}

/**
 * Given the current node id and the chosen answer key, return the next node id
 * (or null when the ladder path is complete). Unknown key falls back to the
 * node's defaultNextId — the interview never dead-ends.
 */
export function getNextQuestionId(currentId: string, answerKey: string): string | null {
  const node = getQuestionNode(currentId);
  if (!node) return null;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

/** Renders one activity's ladder as a prompt block (single source of truth). */
export function buildActivityLadderPromptBlock(
  activityId: ValueActivityId,
  language: 'pl' | 'en'
): string {
  const meta = VALUE_CHAIN_ACTIVITIES.find((m) => m.id === activityId);
  if (!meta) return '';
  const nodes = buildActivityLadder(meta);
  return nodes
    .map((n) => {
      const text = language === 'pl' ? n.textPl : n.textEn;
      const intent = language === 'pl' ? n.intentPl : n.intentEn;
      const options = n.answerOptions
        .map((o) => {
          const label = language === 'pl' ? o.labelPl : o.labelEn;
          const branch = n.branches[o.key];
          const target = branch === null ? (language === 'pl' ? 'KONIEC' : 'END') : branch;
          return `    · [${o.key}] ${label} -> ${target}`;
        })
        .join('\n');
      return `  L${n.level} (${n.id}) — ${intent}\n    Q: ${text}\n${options}`;
    })
    .join('\n');
}
