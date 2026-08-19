import { Check, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  ProposalCardType,
  SWOTData,
  SWOTItem,
  SWOTSignal,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

type StreamId = SWOTItem['quadrant'];
type StreamActionMode = 'comment' | 'deepen';
type LocalizedProposal = { title: string; explanation: string };
type ActionTarget = 'proposal' | 'accepted';

const STREAM_ORDER: StreamId[] = ['strengths', 'weaknesses', 'opportunities', 'threats'];

const STREAM_META: Record<
  StreamId,
  {
    title: { en: string; pl: string };
    subtitle: { en: string; pl: string };
    badge: string;
    headerTone: string;
    surface: string;
    proposalTone: string;
  }
> = {
  strengths: {
    title: { en: 'Strengths', pl: 'Mocne strony' },
    subtitle: { en: 'Internal advantages', pl: 'Przewagi wewnętrzne' },
    badge: '1/4',
    headerTone: 'text-emerald-700 dark:text-emerald-300',
    surface: 'border-emerald-200/70 bg-emerald-500/5 dark:border-emerald-900/40',
    proposalTone:
      'border-emerald-200/70 bg-white/85 dark:border-emerald-900/30 dark:bg-navy-950/40',
  },
  weaknesses: {
    title: { en: 'Weaknesses', pl: 'Słabe strony' },
    subtitle: { en: 'Internal constraints', pl: 'Ograniczenia wewnętrzne' },
    badge: '2/4',
    headerTone: 'text-amber-700 dark:text-amber-300',
    surface: 'border-amber-200/70 bg-amber-500/5 dark:border-amber-900/40',
    proposalTone: 'border-amber-200/70 bg-white/85 dark:border-amber-900/30 dark:bg-navy-950/40',
  },
  opportunities: {
    title: { en: 'Opportunities', pl: 'Szanse' },
    subtitle: { en: 'External upside', pl: 'Upside zewnętrzny' },
    badge: '3/4',
    headerTone: 'text-sky-700 dark:text-sky-300',
    surface: 'border-sky-200/70 bg-sky-500/5 dark:border-sky-900/40',
    proposalTone: 'border-sky-200/70 bg-white/85 dark:border-sky-900/30 dark:bg-navy-950/40',
  },
  threats: {
    title: { en: 'Threats', pl: 'Zagrożenia' },
    subtitle: { en: 'External risk', pl: 'Ryzyko zewnętrzne' },
    badge: '4/4',
    headerTone: 'text-danger-700 dark:text-danger-300',
    surface: 'border-danger-200/70 bg-danger-500/5 dark:border-danger-900/40',
    proposalTone: 'border-danger-200/70 bg-white/85 dark:border-danger-900/30 dark:bg-navy-950/40',
  },
};

const DEEPEN_OPTIONS: Record<
  StreamId,
  Array<{
    id: string;
    label: { pl: string; en: string };
    description: { pl: string; en: string };
  }>
> = {
  strengths: [
    {
      id: 'evidence',
      label: { pl: 'Dowód przewagi', en: 'Evidence of advantage' },
      description: {
        pl: 'Pokaż, z czego realnie wynika ta siła.',
        en: 'Show what this strength is concretely built on.',
      },
    },
    {
      id: 'repeatability',
      label: { pl: 'Powtarzalność', en: 'Repeatability' },
      description: {
        pl: 'Wyjaśnij, czy tę przewagę da się skalować i powtarzać.',
        en: 'Explain whether this advantage can be scaled and repeated.',
      },
    },
    {
      id: 'strategic-value',
      label: { pl: 'Znaczenie strategiczne', en: 'Strategic importance' },
      description: {
        pl: 'Doprecyzuj, dlaczego ta siła ma znaczenie dla kierunku firmy.',
        en: 'Clarify why this strength matters for the company direction.',
      },
    },
  ],
  weaknesses: [
    {
      id: 'root-cause',
      label: { pl: 'Przyczyna źródłowa', en: 'Root cause' },
      description: {
        pl: 'Nazwij, skąd naprawdę bierze się to ograniczenie.',
        en: 'Name what truly drives this constraint.',
      },
    },
    {
      id: 'business-impact',
      label: { pl: 'Wpływ biznesowy', en: 'Business impact' },
      description: {
        pl: 'Pokaż, gdzie ta słabość uderza najmocniej.',
        en: 'Show where this weakness hurts the business the most.',
      },
    },
    {
      id: 'repair-priority',
      label: { pl: 'Priorytet naprawy', en: 'Repair priority' },
      description: {
        pl: 'Doprecyzuj, czy to ograniczenie trzeba naprawić teraz.',
        en: 'Clarify whether this constraint must be repaired now.',
      },
    },
  ],
  opportunities: [
    {
      id: 'market-window',
      label: { pl: 'Okno rynkowe', en: 'Market window' },
      description: {
        pl: 'Wyjaśnij, dlaczego właśnie teraz ta szansa jest realna.',
        en: 'Explain why this opportunity is real right now.',
      },
    },
    {
      id: 'fit-to-company',
      label: { pl: 'Dopasowanie do firmy', en: 'Fit to company' },
      description: {
        pl: 'Pokaż, dlaczego ta szansa pasuje do obecnego kierunku organizacji.',
        en: 'Show why this opportunity fits the current organization direction.',
      },
    },
    {
      id: 'upside-scale',
      label: { pl: 'Skala upside', en: 'Upside scale' },
      description: {
        pl: 'Doprecyzuj, jak duża może być korzyść z tej szansy.',
        en: 'Clarify how meaningful the upside could be.',
      },
    },
  ],
  threats: [
    {
      id: 'threat-mechanism',
      label: { pl: 'Mechanizm zagrożenia', en: 'Threat mechanism' },
      description: {
        pl: 'Pokaż, w jaki sposób to ryzyko może uderzyć w firmę.',
        en: 'Show how this threat could hit the company.',
      },
    },
    {
      id: 'likelihood',
      label: { pl: 'Prawdopodobieństwo', en: 'Likelihood' },
      description: {
        pl: 'Doprecyzuj, czy to ryzyko jest bliskie czy bardziej odległe.',
        en: 'Clarify whether this risk is near-term or more distant.',
      },
    },
    {
      id: 'defense-readiness',
      label: { pl: 'Gotowość obrony', en: 'Defense readiness' },
      description: {
        pl: 'Wyjaśnij, czy organizacja jest gotowa się przed tym bronić.',
        en: 'Explain whether the organization is ready to defend against it.',
      },
    },
  ],
};

const PROPOSAL_BANK: Record<
  StreamId,
  Array<{
    title: { en: string; pl: string };
    explanation: { en: string; pl: string };
  }>
> = {
  strengths: [
    {
      title: {
        en: 'The company already wins in narrow high-trust segments',
        pl: 'Firma już dziś wygrywa w wąskich segmentach wysokiego zaufania',
      },
      explanation: {
        en: 'This strength means the company does not start from zero. It already has proof that some clients are willing to choose it where trust, expertise, and responsiveness matter more than pure scale.',
        pl: 'Ta mocna strona oznacza, że firma nie startuje od zera. Ma już dowód, że część klientów wybiera ją tam, gdzie zaufanie, eksperckość i responsywność znaczą więcej niż sama skala.',
      },
    },
    {
      title: {
        en: 'The team can translate ambiguity into practical action',
        pl: 'Zespół potrafi zamieniać niejednoznaczność w praktyczne działanie',
      },
      explanation: {
        en: 'The strength is not only knowledge, but the ability to work through fuzzy situations and still move clients toward a usable decision, which is strategically valuable in consulting-style work.',
        pl: 'Siłą nie jest tylko wiedza, ale zdolność przepracowania niejednoznacznych sytuacji i doprowadzenia klienta do użytecznej decyzji, co jest strategicznie wartościowe w pracy konsultingowej.',
      },
    },
    {
      title: {
        en: 'The offer has credibility anchored in real delivery',
        pl: 'Oferta ma wiarygodność osadzoną w realnym delivery',
      },
      explanation: {
        en: 'The proposed strength is that the company can speak from operational reality rather than from abstract theory, which makes the strategic narrative more believable and more defensible.',
        pl: 'Proponowana siła polega na tym, że firma mówi z poziomu rzeczywistości operacyjnej, a nie abstrakcyjnej teorii, co czyni narrację strategiczną bardziej wiarygodną i łatwiejszą do obrony.',
      },
    },
    {
      title: {
        en: 'The company can combine strategic framing with execution logic',
        pl: 'Firma potrafi łączyć framing strategiczny z logiką execution',
      },
      explanation: {
        en: 'This matters because many competitors can either inspire or execute, but the stronger position comes from showing that strategic direction can actually be turned into next moves.',
        pl: 'To ma znaczenie, bo wielu konkurentów potrafi albo inspirować, albo wykonywać, ale mocniejsza pozycja wynika z pokazania, że kierunek strategiczny da się przełożyć na kolejne ruchy.',
      },
    },
    {
      title: {
        en: 'There is already a pattern of insight-led client conversations',
        pl: 'Istnieje już wzorzec rozmów z klientem opartych na insightach',
      },
      explanation: {
        en: 'AI suggests this as a strength because the company may already know how to structure conversations around diagnosis, trade-offs, and decision logic instead of generic service talk.',
        pl: 'AI proponuje to jako siłę, bo firma może już umieć prowadzić rozmowy wokół diagnozy, trade-offów i logiki decyzji, zamiast wokół generycznego opisu usług.',
      },
    },
    {
      title: {
        en: 'The business can operate with relatively high agility',
        pl: 'Biznes może działać z relatywnie wysoką zwinnością',
      },
      explanation: {
        en: 'This strength points to the ability to test, refine, and reposition faster than larger incumbents, which can become a meaningful strategic edge if used deliberately.',
        pl: 'Ta siła wskazuje na zdolność do szybszego testowania, dopracowywania i repozycjonowania niż u większych incumbentów, co może stać się realną przewagą strategiczną, jeśli zostanie użyte świadomie.',
      },
    },
  ],
  weaknesses: [
    {
      title: {
        en: 'The company still depends on too much implicit knowledge',
        pl: 'Firma nadal zależy od zbyt dużej ilości wiedzy ukrytej',
      },
      explanation: {
        en: 'This weakness means that part of the value may live in people rather than in a scalable operating model, which makes growth and repeatability harder than they appear.',
        pl: 'Ta słabość oznacza, że część wartości może żyć w ludziach, a nie w skalowalnym modelu operacyjnym, przez co wzrost i powtarzalność są trudniejsze, niż wyglądają.',
      },
    },
    {
      title: {
        en: 'Strategic positioning is stronger than commercial packaging',
        pl: 'Pozycjonowanie strategiczne jest silniejsze niż opakowanie handlowe',
      },
      explanation: {
        en: 'AI suggests that the company may know what it wants to stand for, but still not translate it clearly enough into a sales narrative, offer structure, or buying logic.',
        pl: 'AI sugeruje, że firma może wiedzieć, za czym chce stać, ale nadal nie przekłada tego wystarczająco jasno na narrację sprzedażową, strukturę oferty i logikę zakupu.',
      },
    },
    {
      title: {
        en: 'Delivery capacity may become a bottleneck before growth does',
        pl: 'Zdolność delivery może stać się wąskim gardłem szybciej niż sam wzrost',
      },
      explanation: {
        en: 'The weakness here is not lack of ambition, but the risk that the operating backbone is not yet strong enough to absorb a more ambitious strategic direction.',
        pl: 'Słabością nie jest tu brak ambicji, ale ryzyko, że kręgosłup operacyjny nie jest jeszcze wystarczająco mocny, by wchłonąć bardziej ambitny kierunek strategiczny.',
      },
    },
    {
      title: {
        en: 'The company may still be over-exposed to bespoke work',
        pl: 'Firma może być nadal zbyt mocno wystawiona na pracę bespoke',
      },
      explanation: {
        en: 'This weakness matters because excessive customization can erode margins, blur positioning, and make it hard to build a repeatable growth engine.',
        pl: 'Ta słabość jest ważna, bo nadmierna customizacja potrafi zjadać marżę, rozmywać pozycjonowanie i utrudniać zbudowanie powtarzalnego silnika wzrostu.',
      },
    },
    {
      title: {
        en: 'Decision-making may still be too distributed and too reactive',
        pl: 'Podejmowanie decyzji może być nadal zbyt rozproszone i reaktywne',
      },
      explanation: {
        en: 'AI proposes this because even a strong strategic thesis breaks down when too many decisions are made ad hoc and there is no clean hierarchy of what matters most.',
        pl: 'AI proponuje to, bo nawet mocna teza strategiczna rozpada się wtedy, gdy zbyt wiele decyzji zapada ad hoc i nie ma czystej hierarchii tego, co naprawdę najważniejsze.',
      },
    },
    {
      title: {
        en: 'The brand may not yet signal the full level of sophistication delivered',
        pl: 'Marka może jeszcze nie sygnalizować pełnego poziomu dostarczanej jakości',
      },
      explanation: {
        en: 'This weakness suggests a gap between what the company can actually do and what the market immediately understands about its level, ambition, and fit.',
        pl: 'Ta słabość sugeruje lukę między tym, co firma realnie potrafi, a tym, co rynek od razu rozumie o jej poziomie, ambicji i dopasowaniu.',
      },
    },
  ],
  opportunities: [
    {
      title: {
        en: 'Clients increasingly need structured strategic guidance, not just execution support',
        pl: 'Klienci coraz częściej potrzebują ustrukturyzowanego guidance strategicznego, a nie tylko execution support',
      },
      explanation: {
        en: 'This opportunity comes from the fact that many teams face complexity, uncertainty, and tool overload, which creates demand for sharper framing and decision support.',
        pl: 'Ta szansa wynika z tego, że wiele zespołów działa dziś w złożoności, niepewności i przeciążeniu narzędziowym, co tworzy popyt na mocniejszy framing i wsparcie decyzyjne.',
      },
    },
    {
      title: {
        en: 'The market is opening space for AI-assisted consulting workflows',
        pl: 'Rynek otwiera przestrzeń dla workflowów konsultingowych wspieranych przez AI',
      },
      explanation: {
        en: 'AI suggests this as a real upside because clients increasingly want speed and synthesis, but still need human-level structure, interpretation, and trust around the result.',
        pl: 'AI sugeruje to jako realny upside, bo klienci coraz częściej chcą szybkości i syntezy, ale nadal potrzebują ludzkiej struktury, interpretacji i zaufania wokół wyniku.',
      },
    },
    {
      title: {
        en: 'There is room to own a more premium strategic niche',
        pl: 'Istnieje przestrzeń, by zająć bardziej premium strategiczną niszę',
      },
      explanation: {
        en: 'The opportunity is not just to sell more, but to define a narrower category where the company can be perceived as more expert, more selective, and more decision-relevant.',
        pl: 'Szansa nie polega tylko na sprzedaniu większej ilości, ale na zdefiniowaniu węższej kategorii, w której firma może być postrzegana jako bardziej ekspercka, selektywna i ważna dla decyzji.',
      },
    },
    {
      title: {
        en: 'Competitive fragmentation creates room for a clearer point of view',
        pl: 'Rozdrobnienie konkurencji tworzy miejsce na wyraźniejszy point of view',
      },
      explanation: {
        en: 'Where many providers look interchangeable, a business that brings a stronger thesis and clearer logic of choice can stand out disproportionately.',
        pl: 'Tam, gdzie wielu dostawców wygląda zamiennie, biznes z mocniejszą tezą i wyraźniejszą logiką wyboru może wyróżnić się ponadproporcjonalnie.',
      },
    },
    {
      title: {
        en: 'Board-level communication can become a differentiating capability',
        pl: 'Komunikacja na poziomie zarządczym może stać się wyróżniającą kompetencją',
      },
      explanation: {
        en: 'This opportunity matters because many organizations have data and activity, but still lack a sharp narrative that helps leadership decide what to do next.',
        pl: 'Ta szansa ma znaczenie, bo wiele organizacji ma dane i aktywność, ale nadal nie ma ostrej narracji, która pomaga zarządowi zdecydować, co robić dalej.',
      },
    },
    {
      title: {
        en: 'There may be under-served clients between advisory and execution',
        pl: 'Mogą istnieć niedoobsłużeni klienci pomiędzy advisory a execution',
      },
      explanation: {
        en: 'AI proposes that there may be a valuable gap between high-level strategy shops and operational agencies, where clients need both framing and immediate next moves.',
        pl: 'AI proponuje, że może istnieć wartościowa luka pomiędzy high-level strategy shops a operacyjnymi agencjami, gdzie klienci potrzebują jednocześnie framingu i natychmiastowych next moves.',
      },
    },
  ],
  threats: [
    {
      title: {
        en: 'Competitors can commoditize the visible part of the offer',
        pl: 'Konkurenci mogą skomodytyzować widoczną część oferty',
      },
      explanation: {
        en: 'This threat means the market may copy the language, deliverables, or superficial format faster than it can copy the real operating depth behind them.',
        pl: 'To zagrożenie oznacza, że rynek może kopiować język, deliverables albo powierzchowny format szybciej, niż jest w stanie skopiować rzeczywistą głębię operacyjną stojącą za nimi.',
      },
    },
    {
      title: {
        en: 'AI tools can lower the perceived entry barrier for weaker competitors',
        pl: 'Narzędzia AI mogą obniżyć postrzeganą barierę wejścia dla słabszych konkurentów',
      },
      explanation: {
        en: 'The danger is not that AI replaces thoughtful work, but that it allows more players to look intelligent enough on the surface and confuse buyers.',
        pl: 'Niebezpieczeństwo nie polega na tym, że AI zastąpi przemyślaną pracę, ale że pozwoli większej liczbie graczy wyglądać powierzchownie wystarczająco inteligentnie i mieszać kupującym obraz.',
      },
    },
    {
      title: {
        en: 'Clients may still default to cheaper, narrower alternatives',
        pl: 'Klienci mogą nadal domyślnie wybierać tańsze, węższe alternatywy',
      },
      explanation: {
        en: 'Even if the integrated proposition is stronger, the buying process may still reward lower-friction, lower-commitment options unless value is framed extremely clearly.',
        pl: 'Nawet jeśli propozycja zintegrowana jest silniejsza, proces zakupowy może nadal premiować opcje mniej angażujące i tańsze, jeśli wartość nie zostanie pokazana wyjątkowo jasno.',
      },
    },
    {
      title: {
        en: 'Execution noise inside client organizations can kill momentum',
        pl: 'Szum wykonawczy po stronie klienta może zabijać momentum',
      },
      explanation: {
        en: 'This threat says that even good strategic work may stall when the client lacks ownership, time, governance, or capacity to move from insight to action.',
        pl: 'To zagrożenie mówi, że nawet dobra praca strategiczna może stanąć, gdy klientowi brakuje ownership, czasu, governance albo capacity, by przejść od insightu do działania.',
      },
    },
    {
      title: {
        en: 'The market can reward speed more than depth',
        pl: 'Rynek może nagradzać szybkość bardziej niż głębię',
      },
      explanation: {
        en: 'The threat here is that thoughtful, high-context work may appear slower or more expensive in comparison to faster, lighter, and easier-to-buy substitutes.',
        pl: 'Zagrożenie polega tu na tym, że przemyślana praca wysokokontekstowa może wydawać się wolniejsza lub droższa w porównaniu z szybszymi, lżejszymi i łatwiejszymi w zakupie substytutami.',
      },
    },
    {
      title: {
        en: 'Without sharper proof points, the strategy can remain too abstract',
        pl: 'Bez mocniejszych proof points strategia może pozostać zbyt abstrakcyjna',
      },
      explanation: {
        en: 'This threat matters because abstract strategic language can sound impressive but still fail to trigger real confidence, budget, or leadership commitment.',
        pl: 'To zagrożenie ma znaczenie, bo abstrakcyjny język strategiczny może brzmieć imponująco, a mimo to nie uruchamiać realnego zaufania, budżetu ani zaangażowania zarządu.',
      },
    },
  ],
};

const createInitialPointers = () =>
  STREAM_ORDER.reduce<Record<StreamId, number>>(
    (acc, streamId) => {
      acc[streamId] = 0;
      return acc;
    },
    {} as Record<StreamId, number>
  );

const createInitialAttempts = () =>
  STREAM_ORDER.reduce<Record<StreamId, number>>(
    (acc, streamId) => {
      acc[streamId] = 1;
      return acc;
    },
    {} as Record<StreamId, number>
  );

const sanitizeGeneratedSentence = (value: string) =>
  value
    .replace(/\s*W tej wersji mocniej uwzględniamy komentarz:[^.]+\./gi, '')
    .replace(/\s*Pogłębiamy ten punkt przez:[^.]+\./gi, '')
    .replace(/\s*This version now reflects the comment:[^.]+\./gi, '')
    .replace(/\s*We deepen this point by:[^.]+\./gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const getLocalizedProposal = (
  streamId: StreamId,
  pointer: number,
  isPolish: boolean
): LocalizedProposal => {
  const bank = PROPOSAL_BANK[streamId];
  const proposal = bank[pointer % bank.length];
  return {
    title: isPolish ? proposal.title.pl : proposal.title.en,
    explanation: isPolish ? proposal.explanation.pl : proposal.explanation.en,
  };
};

const buildContextHint = (
  swotData: SWOTData,
  streamId: StreamId,
  acceptedSignals: SWOTSignal[],
  isPolish: boolean
) => {
  const contextParts = [
    swotData.context.understanding,
    swotData.context.goal,
    swotData.context.scope,
  ].filter(Boolean) as string[];
  const acceptedTitles = acceptedSignals.map((signal) => signal.sourceLabel).filter(Boolean);

  if (isPolish) {
    const orgContext = contextParts.length
      ? `W kontekście tej organizacji trzymajmy się framingu: ${contextParts.slice(0, 2).join(' ')}.`
      : 'W kontekście tej organizacji trzymajmy się uzgodnionego framingu sesji.';
    const acceptedContext = acceptedTitles.length
      ? ` Ten kolejny punkt powinien budować na już uzgodnionych wątkach: ${acceptedTitles.join('; ')}.`
      : '';
    const streamFocus =
      streamId === 'strengths'
        ? ' Szukamy kolejnej przewagi wewnętrznej.'
        : streamId === 'weaknesses'
          ? ' Szukamy kolejnego ograniczenia wewnętrznego.'
          : streamId === 'opportunities'
            ? ' Szukamy kolejnej szansy zewnętrznej.'
            : ' Szukamy kolejnego zagrożenia zewnętrznego.';
    return `${orgContext}${acceptedContext}${streamFocus}`;
  }

  const orgContext = contextParts.length
    ? `Keep the organization framing in mind: ${contextParts.slice(0, 2).join(' ')}.`
    : 'Keep the agreed session framing for this organization in mind.';
  const acceptedContext = acceptedTitles.length
    ? ` This next point should build on the already accepted threads: ${acceptedTitles.join('; ')}.`
    : '';
  const streamFocus =
    streamId === 'strengths'
      ? ' We are looking for the next internal advantage.'
      : streamId === 'weaknesses'
        ? ' We are looking for the next internal constraint.'
        : streamId === 'opportunities'
          ? ' We are looking for the next external opportunity.'
          : ' We are looking for the next external threat.';
  return `${orgContext}${acceptedContext}${streamFocus}`;
};

const applyContextToProposal = (
  proposal: LocalizedProposal,
  contextHint: string,
  isPolish: boolean
): LocalizedProposal => ({
  title: proposal.title,
  explanation: `${sanitizeGeneratedSentence(proposal.explanation)} ${
    isPolish
      ? 'Ten kolejny punkt rozwijamy tak, aby był spójny z wcześniejszymi ustaleniami.'
      : 'This next point is framed to stay consistent with the earlier decisions.'
  } ${contextHint}`.trim(),
});

export function SWOTInputExplorationPhase({
  session,
  isPolish,
  onAcceptCard: _onAcceptCard,
  onRejectCard: _onRejectCard,
  onRethinkCard: _onRethinkCard,
}: {
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}) {
  const { t } = useTranslation();
  const { addSWOTSignal, removeSWOTSignal, updateSWOTSignal } = useToolStore();
  const swotData = session.inputData as SWOTData;
  const signals = React.useMemo(() => swotData.signals || [], [swotData.signals]);

  const [proposalPointerByStream, setProposalPointerByStream] =
    React.useState<Record<StreamId, number>>(createInitialPointers);
  const [attemptCountByStream, setAttemptCountByStream] =
    React.useState<Record<StreamId, number>>(createInitialAttempts);
  const [workingProposalByStream, setWorkingProposalByStream] = React.useState<
    Record<StreamId, LocalizedProposal>
  >(() =>
    STREAM_ORDER.reduce<Record<StreamId, LocalizedProposal>>(
      (acc, streamId) => {
        acc[streamId] = getLocalizedProposal(streamId, 0, isPolish);
        return acc;
      },
      {} as Record<StreamId, LocalizedProposal>
    )
  );
  const [activeAction, setActiveAction] = React.useState<{
    streamId: StreamId;
    mode: StreamActionMode;
    target: ActionTarget;
    signalId?: string;
  } | null>(null);
  const [feedbackInput, setFeedbackInput] = React.useState('');
  const [selectedDeepen, setSelectedDeepen] = React.useState('');
  const [expandedAcceptedById, setExpandedAcceptedById] = React.useState<Record<string, boolean>>(
    {}
  );
  const [activeStream, setActiveStream] = React.useState<StreamId>('strengths');
  const [guidanceExpanded, setGuidanceExpanded] = React.useState(false);
  const [manualItem, setManualItem] = React.useState('');
  const [fillAllBusy, setFillAllBusy] = React.useState(false);
  const [fillAllError, setFillAllError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const saved = window.localStorage.getItem(`swot-guidance:${session.id}`);
    setGuidanceExpanded(saved === 'expanded');
  }, [session.id]);

  const toggleGuidance = () => {
    setGuidanceExpanded((current) => {
      const next = !current;
      window.localStorage.setItem(`swot-guidance:${session.id}`, next ? 'expanded' : 'collapsed');
      return next;
    });
  };

  React.useEffect(() => {
    setWorkingProposalByStream((current) =>
      STREAM_ORDER.reduce<Record<StreamId, LocalizedProposal>>(
        (acc, streamId) => {
          const existing = current[streamId];
          if (!existing) {
            acc[streamId] = getLocalizedProposal(
              streamId,
              proposalPointerByStream[streamId] || 0,
              isPolish
            );
            return acc;
          }
          acc[streamId] = existing;
          return acc;
        },
        {} as Record<StreamId, LocalizedProposal>
      )
    );
  }, [isPolish, proposalPointerByStream]);

  const P = 'discoveryToolsTools.dynamicSwot.inputExplorationPhase';
  const labels = {
    consultantProposal: t(`${P}.consultantProposal`),
    draft: t(`${P}.draft`),
    totalAccepted: t(`${P}.totalAccepted`),
    confirmedAreas: t(`${P}.confirmedAreas`),
    activeDialogue: t(`${P}.activeDialogue`),
    maxTarget: t(`${P}.maxTarget`),
    aiProposal: t(`${P}.aiProposal`),
    acceptedList: t(`${P}.acceptedList`),
    accept: t(`${P}.accept`),
    nextProposal: t(`${P}.nextProposal`),
    comment: t('discoveryToolsTools.common.comment'),
    deepen: t(`${P}.deepen`),
    apply: t('discoveryToolsTools.common.apply'),
    close: t('discoveryToolsTools.common.close'),
    confirmSet: t(`${P}.confirmSet`),
    keepGoing: t(`${P}.keepGoing`),
    readyEnough: t(`${P}.readyEnough`),
    attempts: t(`${P}.attempts`),
    accepted: t(`${P}.accepted`),
    confirmed: t(`${P}.confirmed`),
    confirmedToMatrix: t(`${P}.confirmedToMatrix`),
    confirmedButOpen: t(`${P}.confirmedButOpen`),
    continueAdding: t(`${P}.continueAdding`),
    emptyAccepted: t(`${P}.emptyAccepted`),
    showExplanation: t(`${P}.showExplanation`),
    hideExplanation: t(`${P}.hideExplanation`),
    remove: t('discoveryToolsTools.common.remove'),
  };

  const acceptedSignalsByStream = React.useMemo(
    () =>
      STREAM_ORDER.reduce<Record<StreamId, SWOTSignal[]>>(
        (acc, streamId) => {
          acc[streamId] = signals.filter(
            (signal) => signal.tags?.includes(streamId) && signal.tags?.includes('input-proposal')
          );
          return acc;
        },
        {} as Record<StreamId, SWOTSignal[]>
      ),
    [signals]
  );

  const buildRewrittenProposal = (
    base: LocalizedProposal,
    instruction: string,
    mode: StreamActionMode
  ): LocalizedProposal => {
    const cleanTitle = sanitizeGeneratedSentence(base.title);
    const cleanExplanation = sanitizeGeneratedSentence(base.explanation);
    const detail = instruction.trim().replace(/\s*[.!?]\s*$/, '');

    if (!detail) return { title: cleanTitle, explanation: cleanExplanation };

    if (isPolish) {
      return {
        title: cleanTitle,
        explanation:
          mode === 'comment'
            ? `${cleanExplanation} W tej wersji mocniej uwzględniamy komentarz: ${detail}.`
            : `${cleanExplanation} Pogłębiamy ten punkt przez: ${detail}.`,
      };
    }

    return {
      title: cleanTitle,
      explanation:
        mode === 'comment'
          ? `${cleanExplanation} This version now reflects the comment: ${detail}.`
          : `${cleanExplanation} We deepen this point by: ${detail}.`,
    };
  };

  const getNextUniqueProposal = (streamId: StreamId, startPointer: number) => {
    const usedTitles = new Set(
      acceptedSignalsByStream[streamId].map((signal) => signal.sourceLabel)
    );
    const bank = PROPOSAL_BANK[streamId];

    for (let offset = 0; offset < bank.length; offset += 1) {
      const candidatePointer = (startPointer + offset) % bank.length;
      const candidate = getLocalizedProposal(streamId, candidatePointer, isPolish);
      if (!usedTitles.has(candidate.title)) {
        return { pointer: candidatePointer, proposal: candidate };
      }
    }

    return {
      pointer: startPointer % bank.length,
      proposal: getLocalizedProposal(streamId, startPointer, isPolish),
    };
  };

  const moveToNextProposal = (streamId: StreamId) => {
    const nextStart = proposalPointerByStream[streamId] + 1;
    const next = getNextUniqueProposal(streamId, nextStart);

    setProposalPointerByStream((current) => ({ ...current, [streamId]: next.pointer }));
    setAttemptCountByStream((current) => ({ ...current, [streamId]: current[streamId] + 1 }));
    setWorkingProposalByStream((current) => ({ ...current, [streamId]: next.proposal }));
    setActiveAction(null);
    setFeedbackInput('');
    setSelectedDeepen('');
  };

  const applyAction = (streamId: StreamId) => {
    if (!activeAction || activeAction.streamId !== streamId) return;
    const instruction =
      activeAction.mode === 'deepen' ? selectedDeepen.trim() : feedbackInput.trim();
    if (!instruction) return;

    if (activeAction.target === 'proposal') {
      setWorkingProposalByStream((current) => ({
        ...current,
        [streamId]: buildRewrittenProposal(current[streamId], instruction, activeAction.mode),
      }));
    }

    if (activeAction.target === 'accepted' && activeAction.signalId) {
      const acceptedSignal = acceptedSignalsByStream[streamId].find(
        (signal) => signal.id === activeAction.signalId
      );
      if (acceptedSignal) {
        const rewritten = buildRewrittenProposal(
          { title: acceptedSignal.sourceLabel, explanation: acceptedSignal.content },
          instruction,
          activeAction.mode
        );
        updateSWOTSignal(acceptedSignal.id, {
          sourceLabel: sanitizeGeneratedSentence(rewritten.title),
          content: sanitizeGeneratedSentence(rewritten.explanation),
          userComment: instruction,
        });
      }
    }

    setActiveAction(null);
    setFeedbackInput('');
    setSelectedDeepen('');
  };

  const acceptProposal = (streamId: StreamId) => {
    const proposal = applyContextToProposal(
      workingProposalByStream[streamId],
      buildContextHint(swotData, streamId, acceptedSignalsByStream[streamId], isPolish),
      isPolish
    );
    const acceptedCount = acceptedSignalsByStream[streamId].length;

    if (!proposal.title.trim() || acceptedCount >= 5) return;

    addSWOTSignal({
      type: 'ai',
      sourceLabel: proposal.title.trim(),
      content: proposal.explanation.trim(),
      confidence: 4,
      tags: [streamId, 'input-proposal'],
      evidenceType: 'observation',
      state: 'accepted',
      provenance: isPolish
        ? `AI proposal for ${STREAM_META[streamId].title.pl}`
        : `AI proposal for ${STREAM_META[streamId].title.en}`,
      proposalStatus: 'accepted',
    });

    if (acceptedCount + 1 < 5) {
      moveToNextProposal(streamId);
    } else {
      setActiveAction(null);
      setFeedbackInput('');
      setSelectedDeepen('');
    }
  };

  const addManualItem = (streamId: StreamId) => {
    const value = manualItem.trim();
    if (!value || acceptedSignalsByStream[streamId].length >= 5) return;
    addSWOTSignal({
      type: 'interview',
      sourceLabel: value,
      content: value,
      confidence: 5,
      tags: [streamId, 'input-proposal', 'manual-entry'],
      evidenceType: 'observation',
      state: 'accepted',
      provenance: 'Consultant manual entry',
      proposalStatus: 'accepted',
    });
    setManualItem('');
  };

  const fillAllWithAi = async () => {
    setFillAllBusy(true);
    setFillAllError(null);
    try {
      const response = await Api.createSwotProposals(session.id);
      setWorkingProposalByStream((current) => {
        const next = { ...current };
        for (const proposal of response.proposals || []) {
          if (proposal.status !== 'pending' || !proposal.proposedAfter?.text) continue;
          next[proposal.quadrant] = {
            title: proposal.proposedAfter.text,
            explanation: proposal.rationale,
          };
        }
        return next;
      });
    } catch {
      setFillAllError(
        isPolish
          ? 'Teresa nie mogła przygotować propozycji. Spróbuj ponownie.'
          : 'Teresa could not prepare proposals. Try again.'
      );
    } finally {
      setFillAllBusy(false);
    }
  };

  const confirmStreamSet = (streamId: StreamId) => {
    acceptedSignalsByStream[streamId].forEach((signal) => {
      updateSWOTSignal(signal.id, {
        tags: Array.from(new Set([...(signal.tags || []), 'confirmed-for-matrix'])),
      });
    });
  };

  const toggleAcceptedDetails = (signalId: string) => {
    setExpandedAcceptedById((current) => ({ ...current, [signalId]: !current[signalId] }));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_24%),linear-gradient(180deg,#0b1020,#0a0f1b)]">
        <div className="border-b border-slate-200/70 px-6 py-5 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-200">
                Input & Exploration
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                {labels.consultantProposal}
              </span>
            </div>
            <span className="inline-flex rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
              {labels.draft}
            </span>
          </div>
          <div className="mt-3 text-lg font-semibold leading-tight text-slate-900 dark:text-white">
            {t(`${P}.introTitle`)}
          </div>
          {guidanceExpanded && (
            <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t(`${P}.introSubtitle`)}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleGuidance}
              aria-expanded={guidanceExpanded}
              className="rounded-full border border-slate-300/60 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-200"
            >
              {guidanceExpanded ? (isPolish ? 'Mniej' : 'Less') : isPolish ? 'Więcej' : 'More'}
            </button>
            <button
              type="button"
              onClick={() => void fillAllWithAi()}
              disabled={fillAllBusy}
              data-testid="swot-fill-all-ai"
              className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-200"
            >
              {fillAllBusy
                ? isPolish
                  ? 'Teresa pracuje…'
                  : 'Teresa is working…'
                : isPolish
                  ? 'Wypełnij wszystkie z AI'
                  : 'Fill all with AI'}
            </button>
            {fillAllError ? (
              <span role="alert" className="text-xs text-danger-600">
                {fillAllError}
              </span>
            ) : null}
          </div>
        </div>

        <div className="xl:grid xl:grid-cols-[180px_minmax(0,1fr)]">
          <aside className="hidden border-r border-slate-200/70 p-4 dark:border-white/10 xl:block">
            <nav
              aria-label={isPolish ? 'Strumienie analizy SWOT' : 'SWOT analysis streams'}
              className="sticky top-24 space-y-2"
            >
              {STREAM_ORDER.map((streamId) => {
                const meta = STREAM_META[streamId];
                const count = acceptedSignalsByStream[streamId].length;
                return (
                  <button
                    key={streamId}
                    type="button"
                    onClick={() => setActiveStream(streamId)}
                    aria-current={activeStream === streamId ? 'step' : undefined}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold ${activeStream === streamId ? meta.surface : 'border-transparent text-slate-500 hover:border-slate-200 dark:text-slate-300'}`}
                  >
                    <span>{isPolish ? meta.title.pl : meta.title.en}</span>
                    <span>{count}/5</span>
                  </button>
                );
              })}
            </nav>
          </aside>
          <div className="min-w-0">
        <nav
          role="tablist"
          aria-label={isPolish ? 'Kategorie SWOT' : 'SWOT categories'}
          className="grid grid-cols-2 gap-2 border-b border-slate-200/70 px-6 py-4 dark:border-white/10 md:grid-cols-4"
        >
          {STREAM_ORDER.map((streamId) => {
            const meta = STREAM_META[streamId];
            const count = acceptedSignalsByStream[streamId].length;
            return (
              <button
                key={streamId}
                type="button"
                onClick={() => setActiveStream(streamId)}
                role="tab"
                aria-selected={activeStream === streamId}
                aria-controls={`swot-stream-panel-${streamId}`}
                data-testid={`swot-stream-${streamId}`}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold ${activeStream === streamId ? meta.surface : 'border-slate-200/70 bg-transparent text-slate-500 dark:border-white/10 dark:text-slate-300'}`}
              >
                <span>{isPolish ? meta.title.pl : meta.title.en}</span>
                <span className="ml-2 text-xs">{count}/5</span>
              </button>
            );
          })}
        </nav>

        <div className="grid gap-3 border-b border-slate-200/70 px-6 py-5 dark:border-white/10 md:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200/70 bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              {labels.totalAccepted}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {totalAcceptedPoints}
            </div>
          </div>
          <div className="rounded-[24px] border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {labels.confirmedAreas}
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-200">
              {confirmedAreasCount}/4
            </div>
          </div>
          <div className="rounded-[24px] border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
              {labels.activeDialogue}
            </div>
            <div className="mt-2 text-2xl font-semibold text-primary-700 dark:text-primary-200">
              4
            </div>
          </div>
          <div className="rounded-[24px] border border-sky-200/70 bg-sky-500/5 p-4 dark:border-sky-900/40">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
              {labels.maxTarget}
            </div>
            <div className="mt-2 text-2xl font-semibold text-sky-700 dark:text-sky-200">5</div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {STREAM_ORDER.filter((streamId) => streamId === activeStream).map((streamId) => {
            const meta = STREAM_META[streamId];
            const acceptedSignals = acceptedSignalsByStream[streamId];
            const acceptedCount = acceptedSignals.length;
            const isConfirmed =
              acceptedCount >= 2 &&
              acceptedSignals.every((signal) => signal.tags?.includes('confirmed-for-matrix'));
            const shouldSuggestEnough =
              attemptCountByStream[streamId] >= 10 &&
              acceptedCount >= 3 &&
              acceptedCount < 5 &&
              !isConfirmed;
            const currentProposal = applyContextToProposal(
              workingProposalByStream[streamId],
              buildContextHint(swotData, streamId, acceptedSignals, isPolish),
              isPolish
            );
            const previewProposal =
              activeAction?.streamId === streamId &&
              activeAction.target === 'proposal' &&
              (activeAction.mode === 'deepen' ? selectedDeepen.trim() : feedbackInput.trim())
                ? buildRewrittenProposal(
                    currentProposal,
                    activeAction.mode === 'deepen' ? selectedDeepen : feedbackInput,
                    activeAction.mode
                  )
                : currentProposal;

            return (
              <section
                key={streamId}
                id={`swot-stream-panel-${streamId}`}
                role="tabpanel"
                className={`rounded-[26px] border p-5 ${meta.surface}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.headerTone}`}
                    >
                      {isPolish ? meta.title.pl : meta.title.en}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {isPolish ? meta.subtitle.pl : meta.subtitle.en}
                    </div>
                  </div>
                  <span className="inline-flex rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                    {meta.badge}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex rounded-full border border-white/70 bg-white/70 px-2.5 py-1 font-semibold uppercase tracking-[0.16em] dark:border-white/10 dark:bg-white/[0.04]">
                    {labels.accepted}: {acceptedCount}/5
                  </span>
                  <span className="inline-flex rounded-full border border-white/70 bg-white/70 px-2.5 py-1 font-semibold uppercase tracking-[0.16em] dark:border-white/10 dark:bg-white/[0.04]">
                    {labels.attempts}: {attemptCountByStream[streamId]}
                  </span>
                  {isConfirmed && (
                    <span className="inline-flex rounded-full border border-emerald-300/50 bg-emerald-50 px-2.5 py-1 font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                      {labels.confirmed}
                    </span>
                  )}
                </div>

                <div className="mt-4 rounded-[24px] border border-white/70 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {labels.acceptedList}
                  </div>
                  {acceptedSignals.length === 0 ? (
                    <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      {labels.emptyAccepted}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {acceptedSignals.map((signal) => (
                        <div
                          className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.headerTone}`}
                        >
                          {isPolish ? meta.title.pl : meta.title.en}
                        </div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {isPolish ? meta.subtitle.pl : meta.subtitle.en}
                        </div>
                      </div>
                      <span className="inline-flex rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                        {meta.badge}
                      </span>
                    </div>

                    {isConfirmed && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="inline-flex rounded-full border border-emerald-300/50 bg-emerald-50 px-2.5 py-1 font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                          {labels.confirmed}
                        </span>
                      </div>
                    )}

                    {acceptedSignals.length > 0 && (
                      <div className="order-2 mt-4 rounded-[24px] border border-white/70 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                          {labels.acceptedList}
                        </div>
                        <div className="mt-4 space-y-3">
                          {acceptedSignals.map((signal) => (
                            <div
                              key={signal.id}
                              className="rounded-2xl border border-slate-200/70 bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-base font-semibold leading-tight text-slate-900 dark:text-white">
                                    {signal.sourceLabel}
                                  </div>
                                  {expandedAcceptedById[signal.id] && (
                                    <div className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                      {signal.content}
                                    </div>
                                  )}
                                </div>
                                <div className="rounded-full border border-emerald-300/40 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                                  {signal.tags?.includes('confirmed-for-matrix')
                                    ? labels.confirmed
                                    : labels.accepted}
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-white/10">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleAcceptedDetails(signal.id)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                                  >
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 transition-transform ${
                                        expandedAcceptedById[signal.id] ? 'rotate-180' : ''
                                      }`}
                                    />
                                    {expandedAcceptedById[signal.id]
                                      ? labels.hideExplanation
                                      : labels.showExplanation}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeSWOTSignal(signal.id)}
                                    aria-label={labels.remove}
                                    title={labels.remove}
                                    className="inline-flex items-center justify-center rounded-full border border-slate-200/70 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <div className="flex flex-wrap justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveAction({
                                        streamId,
                                        mode: 'comment',
                                        target: 'accepted',
                                        signalId: signal.id,
                                      });
                                      setFeedbackInput('');
                                    }}
                                    className="inline-flex items-center rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                                  >
                                    {labels.comment}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveAction({
                                        streamId,
                                        mode: 'deepen',
                                        target: 'accepted',
                                        signalId: signal.id,
                                      });
                                      setFeedbackInput('');
                                      setSelectedDeepen('');
                                    }}
                                    className="inline-flex items-center rounded-full border border-primary-300/50 bg-white px-3 py-1.5 text-xs font-medium text-primary-800 transition-colors hover:bg-primary-50 dark:border-primary-900/40 dark:bg-white/[0.04] dark:text-primary-200"
                                  >
                                    {labels.deepen}
                                  </button>
                                </div>
                              </div>

                              {activeAction?.target === 'accepted' &&
                                activeAction.signalId === signal.id &&
                                activeAction.streamId === streamId && (
                                  <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                                      {activeAction.mode === 'comment'
                                        ? labels.comment
                                        : labels.deepen}
                                    </div>
                                    {activeAction.mode === 'comment' ? (
                                      <textarea
                                        value={feedbackInput}
                                        onChange={(e) => setFeedbackInput(e.target.value)}
                                        rows={3}
                                        placeholder={t(`${P}.refineAcceptedPlaceholder`)}
                                        className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/20 dark:border-navy-700 dark:bg-navy-800 dark:text-white"
                                      />
                                    ) : (
                                      <div className="mt-3 grid gap-2">
                                        {DEEPEN_OPTIONS[streamId].map((option) => {
                                          const active =
                                            selectedDeepen ===
                                            (isPolish ? option.label.pl : option.label.en);
                                          return (
                                            <button
                                              key={option.id}
                                              type="button"
                                              onClick={() =>
                                                setSelectedDeepen(
                                                  isPolish ? option.label.pl : option.label.en
                                                )
                                              }
                                              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                                                active
                                                  ? 'border-primary-300 bg-primary-50 text-primary-900 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-100'
                                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.06]'
                                              }`}
                                            >
                                              <div className="text-sm font-semibold">
                                                {isPolish ? option.label.pl : option.label.en}
                                              </div>
                                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {isPolish
                                                  ? option.description.pl
                                                  : option.description.en}
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                    <div className="mt-3 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => applyAction(streamId)}
                                        disabled={
                                          activeAction.mode === 'comment'
                                            ? !feedbackInput.trim()
                                            : !selectedDeepen
                                        }
                                        className="inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900"
                                      >
                                        {labels.apply}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveAction(null);
                                          setFeedbackInput('');
                                          setSelectedDeepen('');
                                        }}
                                        className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800"
                                      >
                                        {labels.close}
                                      </button>
                                    </div>
                                  </div>
                                )}
                            </div>
                          ))}
                        </div>

                        {acceptedCount >= 2 && (
                          <div className="mt-4 space-y-3">
                            {isConfirmed ? (
                              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                                {acceptedCount < 5
                                  ? labels.confirmedButOpen
                                  : labels.confirmedToMatrix}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => confirmStreamSet(streamId)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/50 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                              >
                                <Check className="h-4 w-4" />
                                {labels.confirmSet}
                              </button>
                            )}

                            {acceptedCount >= 2 && acceptedCount < 5 && (
                              <div className="flex flex-wrap items-center gap-2">
                                {isConfirmed ? (
                                  <button
                                    type="button"
                                    onClick={() => moveToNextProposal(streamId)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                                  >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                    {labels.continueAdding}
                                  </button>
                                ) : null}
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                  {labels.keepGoing}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {shouldSuggestEnough && (
                          <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                            {labels.readyEnough}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="order-3 mt-4 flex flex-wrap gap-2">
                      {!manualEntryOpen ? (
                        <button
                          type="button"
                          onClick={() => setManualEntryOpen(true)}
                          disabled={acceptedCount >= 5}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300/60 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-white/10 dark:bg-navy-900 dark:text-slate-200"
                        >
                          <Plus className="h-4 w-4" />
                          {isPolish ? 'Dodaj punkt ręcznie' : 'Add point manually'}
                        </button>
                      ) : (
                        <>
                          <input
                            autoFocus
                            value={manualItem}
                            onChange={(event) => setManualItem(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                addManualItem(streamId);
                                setManualEntryOpen(false);
                              }
                              if (event.key === 'Escape') setManualEntryOpen(false);
                            }}
                            aria-label={isPolish ? 'Dodaj własny punkt' : 'Add your own point'}
                            placeholder={isPolish ? 'Dodaj własny punkt…' : 'Add your own…'}
                            className="min-w-0 flex-1 rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              addManualItem(streamId);
                              setManualEntryOpen(false);
                            }}
                            disabled={!manualItem.trim() || acceptedCount >= 5}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
                          >
                            {isPolish ? 'Dodaj' : 'Add'}
                          </button>
                        </>
                      )}
                    </div>

                    {acceptedCount < 5 && (
                      <div
                        className={`order-1 mt-4 rounded-[24px] border p-5 ${meta.proposalTone}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                            {labels.aiProposal}
                          </div>
                          <span className="inline-flex rounded-full border border-primary-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:border-primary-900/40 dark:bg-white/[0.05] dark:text-primary-200">
                            AI
                          </span>
                        </div>

                        <div className="mt-4 text-xl font-semibold leading-tight text-slate-900 dark:text-white">
                          {previewProposal.title}
                        </div>
                        <div className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {previewProposal.explanation}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => acceptProposal(streamId)}
                              disabled={acceptedCount >= 5}
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/50 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {labels.accept}
                            </button>
                            <button
                              type="button"
                              onClick={() => moveToNextProposal(streamId)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                              {labels.nextProposal}
                            </button>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveAction({ streamId, mode: 'comment', target: 'proposal' });
                                setFeedbackInput('');
                              }}
                              className="inline-flex items-center rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                            >
                              {labels.comment}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveAction({ streamId, mode: 'deepen', target: 'proposal' });
                                setFeedbackInput('');
                                setSelectedDeepen('');
                              }}
                              className="inline-flex items-center rounded-full border border-primary-300/50 bg-white px-3 py-1.5 text-xs font-medium text-primary-800 transition-colors hover:bg-primary-50 dark:border-primary-900/40 dark:bg-white/[0.04] dark:text-primary-200"
                            >
                              {labels.deepen}
                            </button>
                          </div>
                        </div>

                  {shouldSuggestEnough && (
                    <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                      {labels.readyEnough}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    value={manualItem}
                    onChange={(event) => setManualItem(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') addManualItem(streamId);
                    }}
                    aria-label={isPolish ? 'Dodaj własny punkt' : 'Add your own point'}
                    placeholder={isPolish ? 'Dodaj własny punkt…' : 'Add your own…'}
                    className="min-w-0 flex-1 rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
                  />
                  <button
                    type="button"
                    onClick={() => addManualItem(streamId)}
                    disabled={!manualItem.trim() || acceptedCount >= 5}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
                  >
                    {isPolish ? 'Dodaj' : 'Add'}
                  </button>
                </div>

                {acceptedCount < 5 && (
                  <div className={`mt-4 rounded-[24px] border p-5 ${meta.proposalTone}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {labels.aiProposal}
                      </div>
                      <span className="inline-flex rounded-full border border-primary-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:border-primary-900/40 dark:bg-white/[0.05] dark:text-primary-200">
                        AI
                      </span>
                    </div>

                    <div className="mt-4 text-xl font-semibold leading-tight text-slate-900 dark:text-white">
                      {previewProposal.title}
                    </div>
                    <div className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {previewProposal.explanation}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => acceptProposal(streamId)}
                          disabled={acceptedCount >= 5}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/50 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {labels.accept}
                        </button>
                        <button
                          type="button"
                          onClick={() => moveToNextProposal(streamId)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                          {labels.nextProposal}
                        </button>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAction({ streamId, mode: 'comment', target: 'proposal' });
                            setFeedbackInput('');
                          }}
                          className="inline-flex items-center rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                        >
                          {labels.comment}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAction({ streamId, mode: 'deepen', target: 'proposal' });
                            setFeedbackInput('');
                            setSelectedDeepen('');
                          }}
                          className="inline-flex items-center rounded-full border border-primary-300/50 bg-white px-3 py-1.5 text-xs font-medium text-primary-800 transition-colors hover:bg-primary-50 dark:border-primary-900/40 dark:bg-white/[0.04] dark:text-primary-200"
                        >
                          {labels.deepen}
                        </button>
                      </div>
                    </div>

                    {activeAction?.streamId === streamId && activeAction.target === 'proposal' && (
                      <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                          {activeAction.mode === 'comment' ? labels.comment : labels.deepen}
                        </div>
                        {activeAction.mode === 'comment' ? (
                          <textarea
                            value={feedbackInput}
                            onChange={(e) => setFeedbackInput(e.target.value)}
                            rows={3}
                            placeholder={t(`${P}.rewriteProposalPlaceholder`)}
                            className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/20 dark:border-navy-700 dark:bg-navy-800 dark:text-white"
                          />
                        ) : (
                          <div className="mt-3 grid gap-2">
                            {DEEPEN_OPTIONS[streamId].map((option) => {
                              const active =
                                selectedDeepen === (isPolish ? option.label.pl : option.label.en);
                              return (
                                <button
                                  type="button"
                                  onClick={() => applyAction(streamId)}
                                  disabled={
                                    activeAction.mode === 'comment'
                                      ? !feedbackInput.trim()
                                      : !selectedDeepen
                                  }
                                  className="inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900"
                                >
                                  {labels.apply}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveAction(null);
                                    setFeedbackInput('');
                                    setSelectedDeepen('');
                                  }}
                                  className="inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800"
                                >
                                  {labels.close}
                                </button>
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SWOTInputExplorationPhase;
