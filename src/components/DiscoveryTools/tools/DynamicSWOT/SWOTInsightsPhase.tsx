import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Check,
  Lightbulb,
  MessageSquare,
  Rocket,
  Shield,
  Sparkles,
  Swords,
  Target,
  Wrench,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  ProposalCardType,
  SWOTCorrelation,
  SWOTData,
  SWOTItem,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { ProposalCard } from '../../shared/ProposalCard';
import {
  normalizeUniversalSynthesis,
  ToolSynthesisSections,
} from '../../shared/ToolSynthesisSections';

const MOVE_CATEGORY_META: Record<
  string,
  { icon: typeof Zap; color: string; label: { en: string; pl: string } }
> = {
  'quick-win': {
    icon: Zap,
    color: 'text-emerald-600 dark:text-emerald-400',
    label: { en: 'Quick Win', pl: 'Quick Win' },
  },
  'big-bet': {
    icon: Target,
    color: 'text-primary-600 dark:text-primary-400',
    label: { en: 'Big Bet', pl: 'Big Bet' },
  },
  'defensive-move': {
    icon: Shield,
    color: 'text-amber-600 dark:text-amber-400',
    label: { en: 'Defensive Move', pl: 'Ruch obronny' },
  },
  'capability-build': {
    icon: Wrench,
    color: 'text-sky-600 dark:text-sky-400',
    label: { en: 'Capability Build', pl: 'Budowa kompetencji' },
  },
};

const TENSION_BUCKETS = [
  {
    type: 'attack' as const,
    label: 'ATTACK',
    title: { en: 'Strength + Opportunity', pl: 'Siła + Szansa' },
    icon: Swords,
    accent: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    type: 'repair' as const,
    label: 'REPAIR',
    title: { en: 'Weakness + Opportunity', pl: 'Słabość + Szansa' },
    icon: Wrench,
    accent: 'text-sky-700 dark:text-sky-300',
  },
  {
    type: 'defend' as const,
    label: 'DEFEND',
    title: { en: 'Strength + Threat', pl: 'Siła + Zagrożenie' },
    icon: Shield,
    accent: 'text-amber-700 dark:text-amber-300',
  },
  {
    type: 'protect' as const,
    label: 'PROTECT',
    title: { en: 'Weakness + Threat', pl: 'Słabość + Zagrożenie' },
    icon: AlertTriangle,
    accent: 'text-danger-700 dark:text-danger-300',
  },
] as const;

const QUADRANT_META: Record<
  string,
  { title: { en: string; pl: string }; border: string; bg: string; text: string; label: string }
> = {
  strengths: {
    title: { en: 'Strengths', pl: 'Mocne strony' },
    border: 'border-emerald-200/70 dark:border-emerald-900/40',
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    text: 'text-emerald-800 dark:text-emerald-300',
    label: 'text-emerald-600 dark:text-emerald-400',
  },
  weaknesses: {
    title: { en: 'Weaknesses', pl: 'Słabe strony' },
    border: 'border-amber-200/70 dark:border-amber-900/40',
    bg: 'bg-amber-50/60 dark:bg-amber-950/20',
    text: 'text-amber-800 dark:text-amber-300',
    label: 'text-amber-600 dark:text-amber-400',
  },
  opportunities: {
    title: { en: 'Opportunities', pl: 'Szanse' },
    border: 'border-sky-200/70 dark:border-sky-900/40',
    bg: 'bg-sky-50/60 dark:bg-sky-950/20',
    text: 'text-sky-800 dark:text-sky-300',
    label: 'text-sky-600 dark:text-sky-400',
  },
  threats: {
    title: { en: 'Threats', pl: 'Zagrożenia' },
    border: 'border-danger-200/70 dark:border-danger-900/40',
    bg: 'bg-danger-50/60 dark:bg-danger-900/20',
    text: 'text-danger-800 dark:text-danger-300',
    label: 'text-danger-600 dark:text-danger-400',
  },
};

function SectionHeader({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between border-b border-slate-200 px-6 pb-4 pt-5 dark:border-navy-800/60">
      <div className="flex-1">
        {children || (
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        )}
      </div>
      <span className="ml-4 flex-shrink-0 rounded-full border border-slate-200/70 bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:border-navy-700 dark:bg-navy-950/40 dark:text-slate-400">
        {badge}
      </span>
    </div>
  );
}

type ObsPriority = 'critical' | 'important' | 'monitor';

interface Observation {
  title: string;
  body: string;
  conclusion: string;
  priority: ObsPriority;
}

const PRIORITY_META: Record<ObsPriority, { label: { en: string; pl: string }; cls: string }> = {
  critical: {
    label: { en: 'Critical', pl: 'Krytyczne' },
    cls: 'border-danger-300 bg-danger-50 text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300',
  },
  important: {
    label: { en: 'Important', pl: 'Ważne' },
    cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
  },
  monitor: {
    label: { en: 'Monitor', pl: 'Monitoruj' },
    cls: 'border-slate-300 bg-slate-50 text-slate-600 dark:border-navy-600 dark:bg-navy-950/30 dark:text-slate-400',
  },
};

function deriveObservations(items: SWOTItem[], quadrant: string, isPolish: boolean): Observation[] {
  if (items.length === 0) return [];

  const hi = items.filter((i) => i.impact === 'high');
  const hiRatio = items.length > 0 ? hi.length / items.length : 0;
  const topItems = hi.length > 0 ? hi : items;
  const topNames = topItems
    .slice(0, 2)
    .map((i) => `"${i.text.length > 60 ? i.text.slice(0, 57) + '…' : i.text}"`)
    .join(isPolish ? ' i ' : ' and ');
  const obs: Observation[] = [];

  if (quadrant === 'strengths') {
    if (hi.length > 0) {
      obs.push({
        title: isPolish
          ? 'Wyraźna przewaga w kluczowych obszarach'
          : 'Clear advantage in key areas',
        body: isPolish
          ? `${hi.length} z ${items.length} mocnych stron ma wysoki wpływ strategiczny — w szczególności ${topNames}. To nie są jedynie atuty operacyjne; to realne dźwignie, które mogą kształtować pozycję konkurencyjną. Organizacja powinna traktować je jako fundament strategii ofensywnej, a nie jedynie jako „coś, co robimy dobrze".`
          : `${hi.length} of ${items.length} strengths carry high strategic impact — notably ${topNames}. These are not merely operational advantages; they are real levers that can shape competitive positioning. The organization should treat them as the foundation of an offensive strategy, not just "things we do well."`,
        conclusion: isPolish
          ? 'Rekomendacja: zbuduj strategię wokół tych atutów zanim konkurencja zniweluje przewagę.'
          : 'Recommendation: build strategy around these assets before competitors erode the advantage.',
        priority: 'critical',
      });
    }
    if (items.length >= 3 && hiRatio < 0.5) {
      obs.push({
        title: isPolish
          ? 'Szeroka, ale rozproszona baza kompetencji'
          : 'Broad but dispersed competency base',
        body: isPolish
          ? `Zidentyfikowano ${items.length} mocnych stron, ale tylko ${hi.length} z nich ma wysoki wpływ. Sugeruje to organizację, która robi wiele rzeczy przyzwoicie, ale niekoniecznie ma wyraźny „spike" — jedną dominującą przewagę, wokół której można zbudować narrację rynkową. Rozproszenie atutów oznacza ryzyko rozciągania zasobów.`
          : `${items.length} strengths identified, but only ${hi.length} carry high impact. This suggests an organization that does many things decently but may lack a clear "spike" — one dominant advantage around which to build a market narrative. Dispersed strengths risk stretching resources thin.`,
        conclusion: isPolish
          ? 'Pytanie strategiczne: na którym atucie postawić, a które traktować jako wsparcie?'
          : 'Strategic question: which strength to bet on, and which to treat as supporting?',
        priority: 'important',
      });
    }
    if (items.length > 0 && hi.length === 0) {
      obs.push({
        title: isPolish ? 'Brak wyraźnego lidera wśród atutów' : 'No standout strength identified',
        body: isPolish
          ? `Żadna z ${items.length} mocnych stron nie została oceniona jako „high impact". To nie oznacza, że organizacja jest słaba — ale że nie zidentyfikowano jeszcze czynnika, który mógłby być główną dźwignią wzrostu. W praktyce konsultingowej to częsty sygnał, że atuty są „ukryte" w codziennej operacji i wymagają wydobycia.`
          : `None of the ${items.length} strengths rated as high impact. This doesn't mean the organization is weak — but that no single factor has been identified as the primary growth lever. In consulting practice, this often signals that strengths are "hidden" in daily operations and need to be surfaced.`,
        conclusion: isPolish
          ? 'Następny krok: warsztat priorytetyzacji — która mocna strona ma największy potencjał dźwigni?'
          : 'Next step: prioritization workshop — which strength has the greatest leverage potential?',
        priority: 'important',
      });
    }
  } else if (quadrant === 'weaknesses') {
    if (hi.length > 0) {
      obs.push({
        title: isPolish
          ? 'Krytyczne luki ograniczające strategię'
          : 'Critical gaps constraining strategy',
        body: isPolish
          ? `${hi.length} słabości o wysokim wpływie — w szczególności ${topNames}. To nie są drobne niedociągnięcia do poprawy „kiedyś". To realne ograniczenia, które aktywnie blokują realizację celów strategicznych. Każda z nich działa jak wąskie gardło: nawet najlepsza strategia ofensywna nie zadziała, jeśli te luki pozostaną otwarte.`
          : `${hi.length} high-impact weaknesses — notably ${topNames}. These are not minor shortcomings to fix "someday." They are real constraints actively blocking strategic goals. Each acts as a bottleneck: even the best offensive strategy will fail if these gaps remain open.`,
        conclusion: isPolish
          ? 'Priorytet: zaadresuj te luki przed skalowaniem — inaczej inwestycje w wzrost będą nieefektywne.'
          : 'Priority: address these gaps before scaling — otherwise growth investments will be inefficient.',
        priority: 'critical',
      });
    }
    obs.push({
      title: isPolish ? 'Profil ryzyka wewnętrznego' : 'Internal risk profile',
      body: isPolish
        ? `${items.length} zidentyfikowanych słabości kształtuje wewnętrzny profil ryzyka organizacji. Kluczowe rozróżnienie: część z nich to słabości „akceptowalne" (świadomy trade-off), a część to luki „blokujące" (uniemożliwiające wzrost). Bez tego rozróżnienia organizacja traktuje wszystkie słabości jednakowo, co prowadzi do rozproszenia wysiłku naprawczego.`
        : `${items.length} identified weaknesses shape the organization's internal risk profile. The critical distinction: some are "acceptable" weaknesses (conscious trade-offs), while others are "blocking" gaps (preventing growth). Without this distinction, the organization treats all weaknesses equally, leading to scattered remediation effort.`,
      conclusion: isPolish
        ? 'Następny krok: sklasyfikuj słabości na „akceptowalne" vs „blokujące" — to zmieni alokację zasobów.'
        : 'Next step: classify weaknesses as "acceptable" vs "blocking" — this will change resource allocation.',
      priority: hi.length > 0 ? 'important' : 'monitor',
    });
  } else if (quadrant === 'opportunities') {
    if (hi.length > 0) {
      obs.push({
        title: isPolish ? 'Okna szans o ograniczonym czasie' : 'Time-sensitive opportunity windows',
        body: isPolish
          ? `${hi.length} szans o wysokim wpływie — w szczególności ${topNames}. Szanse rynkowe mają charakter okien czasowych: otwierają się i zamykają niezależnie od gotowości organizacji. Te konkretne szanse wymagają nie tylko rozpoznania, ale aktywnego przygotowania zasobów do ich wykorzystania. Pytanie nie brzmi „czy warto" — brzmi „czy zdążymy".`
          : `${hi.length} high-impact opportunities — notably ${topNames}. Market opportunities are time windows: they open and close regardless of organizational readiness. These specific opportunities require not just recognition but active resource preparation. The question is not "is it worth it" — it's "can we move fast enough."`,
        conclusion: isPolish
          ? 'Rekomendacja: dla każdej szansy high-impact określ deadline i minimalne zasoby do wejścia.'
          : 'Recommendation: for each high-impact opportunity, define a deadline and minimum resources to enter.',
        priority: 'critical',
      });
    }
    obs.push({
      title: isPolish ? 'Zdolność absorpcji szans' : 'Opportunity absorption capacity',
      body: isPolish
        ? `Zidentyfikowano ${items.length} szans w otoczeniu zewnętrznym. Samo ich rozpoznanie to dopiero początek — kluczowe pytanie strategiczne brzmi: ile z nich organizacja jest w stanie realnie zaadresować jednocześnie? Próba wykorzystania wszystkich prowadzi do rozproszenia i powierzchownego zaangażowania. Lepiej wybrać 2-3 i zrealizować je dobrze.`
        : `${items.length} opportunities identified in the external environment. Recognizing them is just the beginning — the key strategic question is: how many can the organization realistically pursue simultaneously? Attempting all leads to dispersion and shallow engagement. Better to select 2-3 and execute them well.`,
      conclusion: isPolish
        ? 'Pytanie strategiczne: które 2-3 szanse dają największy zwrot przy obecnych zasobach?'
        : 'Strategic question: which 2-3 opportunities yield the highest return given current resources?',
      priority: hi.length > 0 ? 'important' : 'monitor',
    });
  } else if (quadrant === 'threats') {
    if (hi.length > 0) {
      obs.push({
        title: isPolish
          ? 'Zagrożenia wymagające planu reakcji'
          : 'Threats requiring a response plan',
        body: isPolish
          ? `${hi.length} zagrożeń o wysokim wpływie — w szczególności ${topNames}. Te zagrożenia nie są hipotetyczne — to realne siły, które mogą zmienić warunki gry. Organizacja, która je rozpoznaje, ale nie przygotowuje scenariuszy reakcji, de facto akceptuje ryzyko bez zarządzania nim. Każde z tych zagrożeń wymaga minimum: triggera (kiedy reagujemy), planu B i właściciela.`
          : `${hi.length} high-impact threats — notably ${topNames}. These threats are not hypothetical — they are real forces that can change the rules of the game. An organization that recognizes them but doesn't prepare response scenarios is effectively accepting risk without managing it. Each requires at minimum: a trigger (when to react), a plan B, and an owner.`,
        conclusion: isPolish
          ? 'Priorytet: dla każdego zagrożenia high-impact zdefiniuj trigger, plan B i właściciela.'
          : 'Priority: for each high-impact threat, define a trigger, plan B, and owner.',
        priority: 'critical',
      });
    }
    obs.push({
      title: isPolish ? 'Kontrolowalność vs adaptacja' : 'Controllability vs adaptation',
      body: isPolish
        ? `${items.length} zagrożeń kształtuje presję zewnętrzną na organizację. Nie wszystkie zagrożenia wymagają tej samej odpowiedzi. Część z nich jest kontrolowalna (np. przez zmianę dostawcy, dywersyfikację), a część wymaga adaptacji (np. zmiany regulacyjne, trendy makro). Błędem jest traktowanie wszystkich zagrożeń jako „do naprawienia" — niektóre trzeba po prostu wbudować w model operacyjny.`
        : `${items.length} threats shape external pressure on the organization. Not all threats require the same response. Some are controllable (e.g., switching suppliers, diversification), while others require adaptation (e.g., regulatory changes, macro trends). The mistake is treating all threats as "fixable" — some simply need to be built into the operating model.`,
      conclusion: isPolish
        ? 'Następny krok: podziel zagrożenia na „kontrolowalne" i „do adaptacji" — to zmieni typ odpowiedzi.'
        : 'Next step: split threats into "controllable" and "adapt-to" — this changes the response type.',
      priority: hi.length > 0 ? 'important' : 'monitor',
    });
  }

  const totalFactors = items.length;
  const maxObs = totalFactors >= 6 ? 4 : totalFactors >= 4 ? 3 : 2;
  return obs.slice(0, maxObs);
}

const DEEP_THINKER_PROMPTS = {
  en: [
    'Challenge this observation — what could be wrong?',
    'What would a contrarian perspective look like?',
    'What are we not seeing here?',
    'How would this change in 12 months?',
    "What's the second-order effect?",
  ],
  pl: [
    'Zakwestionuj tę obserwację — co może być błędne?',
    'Jak wyglądałaby perspektywa kontrariańska?',
    'Czego tu nie widzimy?',
    'Jak to się zmieni za 12 miesięcy?',
    'Jaki jest efekt drugiego rzędu?',
  ],
};

function ObservationCard({
  obs,
  titleColor,
  isPolish,
}: {
  obs: Observation;
  titleColor?: string;
  isPolish: boolean;
}) {
  const { t } = useTranslation();
  const pm = PRIORITY_META[obs.priority];
  const [activeMode, setActiveMode] = useState<'comment' | 'deep-thinker' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [savedComment, setSavedComment] = useState('');

  const handleSubmit = () => {
    const value = activeMode === 'deep-thinker' ? selectedPrompt : inputValue;
    if (!value.trim()) return;
    setSavedComment(value.trim());
    setActiveMode(null);
    setInputValue('');
    setSelectedPrompt('');
  };

  const handleCancel = () => {
    setActiveMode(null);
    setInputValue('');
    setSelectedPrompt('');
  };

  const prompts = isPolish ? DEEP_THINKER_PROMPTS.pl : DEEP_THINKER_PROMPTS.en;

  return (
    <div className="rounded-xl bg-white/70 p-4 shadow-sm dark:bg-navy-950/40">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div
          className={`text-sm font-bold leading-snug ${titleColor || 'text-slate-900 dark:text-slate-100'}`}
        >
          {obs.title}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${pm.cls}`}
          >
            {isPolish ? pm.label.pl : pm.label.en}
          </span>
        </div>
      </div>
      <div className="text-[13px] leading-[1.7] text-slate-700 dark:text-slate-300">{obs.body}</div>
      <div className="mt-2.5 rounded-lg bg-slate-100/80 px-3 py-2 text-[12px] font-medium leading-relaxed text-slate-600 dark:bg-navy-900/50 dark:text-slate-400">
        {obs.conclusion}
      </div>

      {savedComment && (
        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200/60 bg-amber-50/40 px-3 py-2 dark:border-amber-900/30 dark:bg-amber-950/15">
          <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-500" />
          <span className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
            {savedComment}
          </span>
        </div>
      )}

      {activeMode === 'comment' && (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200/70 bg-white p-3 dark:border-navy-700 dark:bg-navy-950/60">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('discoveryToolsTools.common.yourCommentPlaceholder')}
            className="w-full resize-none rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 dark:border-navy-700 dark:bg-navy-950/40 dark:text-slate-300 dark:placeholder-slate-500 dark:focus:border-navy-600"
            rows={2}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md px-3 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800"
            >
              {t('discoveryToolsTools.common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputValue.trim()}
              className="rounded-md bg-slate-900 px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {t('discoveryToolsTools.common.save')}
            </button>
          </div>
        </div>
      )}

      {activeMode === 'deep-thinker' && (
        <div className="mt-3 space-y-2 rounded-lg border border-primary-200/70 bg-primary-50/30 p-3 dark:border-primary-900/40 dark:bg-primary-950/15">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
            {t('discoveryToolsTools.common.chooseDirection')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {prompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedPrompt(selectedPrompt === prompt ? '' : prompt)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  selectedPrompt === prompt
                    ? 'border-primary-400 bg-primary-100 text-primary-800 dark:border-primary-600 dark:bg-primary-900/40 dark:text-primary-200'
                    : 'border-primary-200/70 bg-white text-primary-700 hover:bg-primary-50 dark:border-primary-900/40 dark:bg-navy-950/40 dark:text-primary-300 dark:hover:bg-primary-950/20'
                }`}
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md px-3 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800"
            >
              {t('discoveryToolsTools.common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedPrompt}
              className="rounded-md bg-navy-900 dark:bg-[#F4F7FB] px-3 py-1 text-[11px] font-medium text-white dark:text-navy-950 transition-colors hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-40"
            >
              {t('discoveryToolsTools.common.explore')}
            </button>
          </div>
        </div>
      )}

      {!activeMode && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setActiveMode('comment')}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:bg-slate-50 dark:border-navy-700 dark:bg-navy-950/40 dark:text-slate-400 dark:hover:bg-navy-900/60"
          >
            <MessageSquare className="h-3 w-3" />
            {t('discoveryToolsTools.common.comment')}
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('deep-thinker')}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/50 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-600 transition-colors hover:bg-primary-50 dark:border-primary-900/40 dark:bg-navy-950/40 dark:text-primary-400 dark:hover:bg-primary-950/30"
          >
            <Brain className="h-3 w-3" />
            Deep thinker
          </button>
        </div>
      )}
    </div>
  );
}

function QuadrantObservationsBlock({
  quadrant,
  items,
  isPolish,
}: {
  quadrant: string;
  items: SWOTItem[];
  isPolish: boolean;
}) {
  const { t } = useTranslation();
  const meta = QUADRANT_META[quadrant];
  if (!meta || items.length === 0) return null;
  const observations = deriveObservations(items, quadrant, isPolish);
  if (observations.length === 0) return null;

  return (
    <div className={`rounded-2xl border ${meta.border} ${meta.bg} p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${meta.label}`}>
          {isPolish ? meta.title.pl : meta.title.en}
          <span className="ml-2 text-slate-600 dark:text-slate-500">
            ({items.length} {t('discoveryToolsTools.common.factorsWord')})
          </span>
        </div>
      </div>
      <div className="space-y-4">
        {observations.map((obs, idx) => (
          <ObservationCard key={idx} obs={obs} titleColor={meta.text} isPolish={isPolish} />
        ))}
      </div>
    </div>
  );
}

function deriveInternalObservations(
  strengths: SWOTItem[],
  weaknesses: SWOTItem[],
  correlations: SWOTCorrelation[],
  executiveSummary: string,
  isPolish: boolean
): Observation[] {
  const obs: Observation[] = [];
  const sHi = strengths.filter((i) => i.impact === 'high');
  const wHi = weaknesses.filter((i) => i.impact === 'high');
  const internalCorrs = correlations.filter((c) => c.type === 'SO' || c.type === 'ST');
  const sNames = sHi
    .slice(0, 2)
    .map((i) => `"${i.text.length > 50 ? i.text.slice(0, 47) + '…' : i.text}"`)
    .join(isPolish ? ' i ' : ' and ');
  const wNames = wHi
    .slice(0, 2)
    .map((i) => `"${i.text.length > 50 ? i.text.slice(0, 47) + '…' : i.text}"`)
    .join(isPolish ? ' i ' : ' and ');

  if (strengths.length > 0 && weaknesses.length > 0) {
    const ratio = strengths.length / (strengths.length + weaknesses.length);
    if (ratio >= 0.6) {
      obs.push({
        title: isPolish ? 'Pozycja wewnętrzna netto-pozytywna' : 'Net-positive internal position',
        body: isPolish
          ? `Organizacja wykazuje ${strengths.length} mocnych stron wobec ${weaknesses.length} słabości — bilans wewnętrzny jest korzystny. ${sHi.length > 0 ? `Kluczowe atuty (${sNames}) stanowią realną przewagę, na której można budować.` : 'Brak jednak wyraźnego „spike\'a" — jednego dominującego atutu.'} To pozycja, z której można grać ofensywnie, pod warunkiem że słabości nie blokują krytycznych ścieżek wzrostu. Pytanie nie brzmi „czy jesteśmy silni" — brzmi „czy nasze siły są tam, gdzie rynek ich potrzebuje".`
          : `The organization shows ${strengths.length} strengths against ${weaknesses.length} weaknesses — the internal balance is favorable. ${sHi.length > 0 ? `Key assets (${sNames}) represent real advantages to build upon.` : 'However, there is no clear "spike" — one dominant asset.'} This is a position from which to play offensively, provided weaknesses don't block critical growth paths. The question isn't "are we strong" — it's "are our strengths where the market needs them."`,
        conclusion: isPolish
          ? 'Wniosek: pozycja pozwala na strategię ofensywną, ale wymaga weryfikacji czy atuty odpowiadają na realne potrzeby rynku.'
          : 'Conclusion: position allows offensive strategy, but requires verifying that strengths match real market needs.',
        priority: 'important',
      });
    } else if (ratio <= 0.4) {
      obs.push({
        title: isPolish
          ? 'Pozycja wewnętrzna obciążona słabościami'
          : 'Internal position burdened by weaknesses',
        body: isPolish
          ? `${weaknesses.length} słabości wobec ${strengths.length} mocnych stron — bilans wewnętrzny jest niekorzystny. ${wHi.length > 0 ? `Szczególnie niepokojące są ${wNames}, które mają wysoki wpływ strategiczny.` : 'Choć żadna słabość nie jest krytyczna pojedynczo, ich kumulacja tworzy systemowe ograniczenie.'} Organizacja w tej sytuacji powinna unikać rozpraszania zasobów na zbyt wiele frontów i skupić się na naprawie fundamentów przed ekspansją.`
          : `${weaknesses.length} weaknesses against ${strengths.length} strengths — the internal balance is unfavorable. ${wHi.length > 0 ? `Particularly concerning are ${wNames}, which carry high strategic impact.` : 'While no single weakness is critical alone, their accumulation creates a systemic constraint.'} In this situation, the organization should avoid spreading resources across too many fronts and focus on fixing fundamentals before expansion.`,
        conclusion: isPolish
          ? 'Wniosek: priorytetem jest naprawa wewnętrzna — ekspansja bez solidnych fundamentów generuje ryzyko porażki.'
          : 'Conclusion: internal repair is the priority — expansion without solid fundamentals risks failure.',
        priority: 'critical',
      });
    } else {
      obs.push({
        title: isPolish ? 'Zrównoważony profil wewnętrzny' : 'Balanced internal profile',
        body: isPolish
          ? `${strengths.length} mocnych stron i ${weaknesses.length} słabości tworzą zrównoważony profil wewnętrzny. To typowa sytuacja dla organizacji w fazie dojrzewania — ma realne atuty, ale też wyraźne luki. Kluczowe jest nie tyle „naprawianie wszystkiego", co strategiczny wybór: które słabości zaakceptować jako trade-off, a które naprawić, bo blokują najważniejsze szanse.`
          : `${strengths.length} strengths and ${weaknesses.length} weaknesses create a balanced internal profile. This is typical for maturing organizations — real assets exist alongside clear gaps. The key is not "fixing everything" but strategic choice: which weaknesses to accept as trade-offs, and which to fix because they block the most important opportunities.`,
        conclusion: isPolish
          ? 'Wniosek: potrzebna jest priorytetyzacja — nie wszystkie słabości warto naprawiać, nie wszystkie siły warto rozwijać.'
          : 'Conclusion: prioritization is needed — not all weaknesses are worth fixing, not all strengths worth developing.',
        priority: 'important',
      });
    }
  }

  if (wHi.length > 0 && sHi.length > 0) {
    obs.push({
      title: isPolish ? 'Napięcie między siłami a lukami' : 'Tension between strengths and gaps',
      body: isPolish
        ? `Organizacja jednocześnie posiada ${sHi.length} atutów o wysokim wpływie (${sNames}) i ${wHi.length} krytycznych słabości (${wNames}). To klasyczny wzorzec „silnego gracza z piętą achillesową" — potencjał jest duży, ale konkretne luki mogą go zniwelować. W praktyce konsultingowej to sygnał, że organizacja potrzebuje nie tyle więcej zasobów, co lepszej alokacji istniejących. Siły i słabości nie istnieją w izolacji — pytanie brzmi, czy słabości podcinają właśnie te siły, które są najważniejsze.`
        : `The organization simultaneously has ${sHi.length} high-impact strengths (${sNames}) and ${wHi.length} critical weaknesses (${wNames}). This is the classic "strong player with an Achilles heel" pattern — potential is high, but specific gaps can neutralize it. In consulting practice, this signals that the organization needs not more resources but better allocation of existing ones. Strengths and weaknesses don't exist in isolation — the question is whether weaknesses undercut the very strengths that matter most.`,
      conclusion: isPolish
        ? 'Priorytet: sprawdź czy krytyczne słabości bezpośrednio osłabiają kluczowe atuty — jeśli tak, to napraw je najpierw.'
        : 'Priority: check if critical weaknesses directly undermine key strengths — if so, fix them first.',
      priority: 'critical',
    });
  }

  if (internalCorrs.length > 0) {
    obs.push({
      title: isPolish ? 'Zidentyfikowane powiązania wewnętrzne' : 'Identified internal linkages',
      body: isPolish
        ? `Analiza wykazała ${internalCorrs.length} powiązań między czynnikami wewnętrznymi (typy ${[...new Set(internalCorrs.map((c) => c.type))].join(', ')}). Powiązania te pokazują, jak mocne strony mogą kompensować słabości — lub jak słabości mogą neutralizować atuty. ${internalCorrs[0]?.insight ? `Przykład: "${internalCorrs[0].insight.length > 80 ? internalCorrs[0].insight.slice(0, 77) + '…' : internalCorrs[0].insight}"` : ''} To nie są abstrakcyjne zależności — to realne mechanizmy, które kształtują zdolność organizacji do działania.`
        : `Analysis revealed ${internalCorrs.length} linkages between internal factors (types ${[...new Set(internalCorrs.map((c) => c.type))].join(', ')}). These linkages show how strengths can compensate for weaknesses — or how weaknesses can neutralize assets. ${internalCorrs[0]?.insight ? `Example: "${internalCorrs[0].insight.length > 80 ? internalCorrs[0].insight.slice(0, 77) + '…' : internalCorrs[0].insight}"` : ''} These are not abstract dependencies — they are real mechanisms shaping the organization's ability to act.`,
      conclusion: isPolish
        ? 'Następny krok: wykorzystaj powiązania SO do budowy strategii ofensywnej, a ST do planowania obrony.'
        : 'Next step: use SO linkages for offensive strategy, ST linkages for defense planning.',
      priority: 'monitor',
    });
  }

  const totalFactors = strengths.length + weaknesses.length;
  const maxObs = totalFactors >= 8 ? 4 : totalFactors >= 5 ? 3 : 2;
  return obs.slice(0, maxObs);
}

function InternalSynthesisBlock({
  strengths,
  weaknesses,
  correlations,
  executiveSummary,
  isPolish,
  getItemText,
}: {
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  correlations: SWOTCorrelation[];
  executiveSummary: string;
  isPolish: boolean;
  getItemText: (id: string) => string;
}) {
  const { t } = useTranslation();
  const observations = useMemo(
    () =>
      deriveInternalObservations(strengths, weaknesses, correlations, executiveSummary, isPolish),
    [strengths, weaknesses, correlations, executiveSummary, isPolish]
  );
  const hasContent = observations.length > 0 || executiveSummary;

  return (
    <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
      <SectionHeader
        title=""
        badge={t('discoveryToolsTools.dynamicSwot.insightsPhase.internalSynthesis')}
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.dynamicSwot.insightsPhase.internalSynthesis')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.dynamicSwot.insightsPhase.internalSynthesisSubtitle')}
        </p>
      </SectionHeader>
      <div className="space-y-4 px-6 py-5">
        {!hasContent ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-5 text-center text-sm text-slate-600 dark:border-navy-700 dark:text-slate-500">
            {t('discoveryToolsTools.dynamicSwot.insightsPhase.internalSynthesisEmpty')}
          </div>
        ) : (
          <>
            {executiveSummary && (
              <div className="rounded-xl bg-slate-50/60 p-4 text-sm leading-relaxed text-slate-700 dark:bg-navy-950/30 dark:text-slate-300">
                {executiveSummary}
              </div>
            )}
            <div className="space-y-4">
              {observations.map((obs, idx) => (
                <ObservationCard key={idx} obs={obs} isPolish={isPolish} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function deriveExternalObservations(
  opportunities: SWOTItem[],
  threats: SWOTItem[],
  correlations: SWOTCorrelation[],
  isPolish: boolean
): Observation[] {
  const obs: Observation[] = [];
  const oHi = opportunities.filter((i) => i.impact === 'high');
  const tHi = threats.filter((i) => i.impact === 'high');
  const extCorrs = correlations.filter((c) => c.type === 'WO' || c.type === 'WT');
  const oNames = oHi
    .slice(0, 2)
    .map((i) => `"${i.text.length > 50 ? i.text.slice(0, 47) + '…' : i.text}"`)
    .join(isPolish ? ' i ' : ' and ');
  const tNames = tHi
    .slice(0, 2)
    .map((i) => `"${i.text.length > 50 ? i.text.slice(0, 47) + '…' : i.text}"`)
    .join(isPolish ? ' i ' : ' and ');

  if (opportunities.length > 0 && threats.length > 0) {
    const ratio = opportunities.length / (opportunities.length + threats.length);
    if (ratio >= 0.6) {
      obs.push({
        title: isPolish ? 'Otoczenie sprzyja ekspansji' : 'Environment favors expansion',
        body: isPolish
          ? `${opportunities.length} szans wobec ${threats.length} zagrożeń — rynek otwiera więcej drzwi niż zamyka. ${oHi.length > 0 ? `Szczególnie obiecujące są ${oNames}, które mogą fundamentalnie zmienić pozycję organizacji.` : 'Choć żadna szansa nie jest jeszcze oceniona jako przełomowa, sam wolumen możliwości jest znaczący.'} To okno, w którym organizacja powinna działać ofensywnie — ale z dyscypliną. Próba wykorzystania wszystkich szans jednocześnie to najszybsza droga do rozproszenia zasobów i porażki na każdym froncie.`
          : `${opportunities.length} opportunities against ${threats.length} threats — the market opens more doors than it closes. ${oHi.length > 0 ? `Particularly promising are ${oNames}, which could fundamentally change the organization's position.` : 'While no single opportunity is rated as breakthrough, the sheer volume of possibilities is significant.'} This is a window for offensive action — but with discipline. Trying to capture all opportunities simultaneously is the fastest path to resource dispersion and failure on every front.`,
        conclusion: isPolish
          ? 'Wniosek: wybierz 2-3 szanse o najwyższym zwrocie i skoncentruj zasoby — lepiej wygrać na 2 frontach niż przegrać na 5.'
          : 'Conclusion: select 2-3 highest-return opportunities and concentrate resources — better to win on 2 fronts than lose on 5.',
        priority: 'important',
      });
    } else if (ratio <= 0.4) {
      obs.push({
        title: isPolish
          ? 'Otoczenie generuje więcej zagrożeń niż szans'
          : 'Environment generates more threats than opportunities',
        body: isPolish
          ? `${threats.length} zagrożeń wobec ${opportunities.length} szans — presja zewnętrzna dominuje. ${tHi.length > 0 ? `Najpoważniejsze to ${tNames}, które mogą wymusić fundamentalną zmianę modelu działania.` : 'Zagrożenia są rozproszone, ale ich kumulacja tworzy trudne środowisko operacyjne.'} W tej sytuacji strategia „czekaj i obserwuj" jest najbardziej ryzykowna — organizacja musi aktywnie budować odporność i scenariusze reakcji. Jednocześnie nie należy ignorować istniejących szans — mogą być kluczem do wyjścia z defensywy.`
          : `${threats.length} threats against ${opportunities.length} opportunities — external pressure dominates. ${tHi.length > 0 ? `Most serious are ${tNames}, which may force fundamental changes to the operating model.` : 'Threats are dispersed, but their accumulation creates a difficult operating environment.'} In this situation, a "wait and see" strategy is the riskiest — the organization must actively build resilience and response scenarios. At the same time, existing opportunities shouldn't be ignored — they may be the key to escaping a defensive posture.`,
        conclusion: isPolish
          ? 'Wniosek: priorytet to budowa odporności i scenariuszy reakcji, jednocześnie szukając szans, które pozwolą przejść do ofensywy.'
          : 'Conclusion: priority is building resilience and response scenarios, while seeking opportunities that enable a shift to offense.',
        priority: 'critical',
      });
    } else {
      obs.push({
        title: isPolish ? 'Zrównoważone otoczenie zewnętrzne' : 'Balanced external environment',
        body: isPolish
          ? `${opportunities.length} szans i ${threats.length} zagrożeń tworzą zrównoważony krajobraz zewnętrzny. To nie jest ani „złoty wiek" ani „kryzys" — to normalny stan, w którym sukces zależy od jakości decyzji, nie od sprzyjających wiatrów. Organizacja musi jednocześnie wykorzystywać okna szans i budować ochronę przed zagrożeniami. Kluczowe jest tempo: kto szybciej zidentyfikuje, które szanse warto chwycić i które zagrożenia wymagają reakcji, ten wygra.`
          : `${opportunities.length} opportunities and ${threats.length} threats create a balanced external landscape. This is neither a "golden age" nor a "crisis" — it's a normal state where success depends on decision quality, not favorable winds. The organization must simultaneously exploit opportunity windows and build protection against threats. Speed is key: whoever identifies which opportunities to seize and which threats to respond to first, wins.`,
        conclusion: isPolish
          ? 'Wniosek: w zrównoważonym otoczeniu wygrywa szybkość i jakość decyzji — nie czekaj na „idealny moment".'
          : 'Conclusion: in a balanced environment, speed and decision quality win — don\'t wait for the "perfect moment."',
        priority: 'important',
      });
    }
  }

  if (oHi.length > 0 && tHi.length > 0) {
    obs.push({
      title: isPolish
        ? 'Wyścig między szansami a zagrożeniami'
        : 'Race between opportunities and threats',
      body: isPolish
        ? `Jednocześnie istnieją ${oHi.length} szans o wysokim wpływie (${oNames}) i ${tHi.length} zagrożeń o wysokim wpływie (${tNames}). To sytuacja „wyścigu" — pytanie nie brzmi „czy działać", ale „w jakiej kolejności". Jeśli organizacja najpierw zaadresuje szanse, zyska pozycję do obrony przed zagrożeniami. Jeśli najpierw zajmie się zagrożeniami, może stracić okno na szanse. Kolejność działań jest tu ważniejsza niż sam wybór.`
        : `Simultaneously, there are ${oHi.length} high-impact opportunities (${oNames}) and ${tHi.length} high-impact threats (${tNames}). This is a "race" situation — the question isn't "whether to act" but "in what order." If the organization addresses opportunities first, it gains a position to defend against threats. If it addresses threats first, it may lose the opportunity window. The sequence of actions matters more than the choice itself.`,
      conclusion: isPolish
        ? 'Pytanie strategiczne: co najpierw — chwycić szansę czy zabezpieczyć się przed zagrożeniem? Odpowiedź zależy od horyzontu czasowego obu.'
        : 'Strategic question: what first — seize the opportunity or protect against the threat? The answer depends on the time horizon of both.',
      priority: 'critical',
    });
  }

  if (extCorrs.length > 0) {
    const withProposals = extCorrs.filter((c) => c.initiativeProposal);
    obs.push({
      title: isPolish
        ? 'Powiązania zewnętrzne i hipotezy ruchów'
        : 'External linkages and move hypotheses',
      body: isPolish
        ? `Zidentyfikowano ${extCorrs.length} powiązań między czynnikami zewnętrznymi (typy ${[...new Set(extCorrs.map((c) => c.type))].join(', ')}). ${withProposals.length > 0 ? `${withProposals.length} z nich zawiera konkretne hipotezy ruchów strategicznych — to nie abstrakcyjne zależności, lecz gotowe punkty wyjścia do działania.` : 'Powiązania te pokazują, jak szanse i zagrożenia wzajemnie na siebie oddziałują.'} ${extCorrs[0]?.insight ? `Przykład: "${extCorrs[0].insight.length > 80 ? extCorrs[0].insight.slice(0, 77) + '…' : extCorrs[0].insight}"` : ''}`
        : `${extCorrs.length} linkages identified between external factors (types ${[...new Set(extCorrs.map((c) => c.type))].join(', ')}). ${withProposals.length > 0 ? `${withProposals.length} of them contain specific strategic move hypotheses — these are not abstract dependencies but ready starting points for action.` : 'These linkages show how opportunities and threats interact with each other.'} ${extCorrs[0]?.insight ? `Example: "${extCorrs[0].insight.length > 80 ? extCorrs[0].insight.slice(0, 77) + '…' : extCorrs[0].insight}"` : ''}`,
      conclusion: isPolish
        ? 'Następny krok: wykorzystaj powiązania WO do identyfikacji szans wymagających naprawy słabości, a WT do planowania obrony.'
        : 'Next step: use WO linkages to identify opportunities requiring weakness repair, WT for defense planning.',
      priority: 'monitor',
    });
  }

  const totalFactors = opportunities.length + threats.length;
  const maxObs = totalFactors >= 8 ? 4 : totalFactors >= 5 ? 3 : 2;
  return obs.slice(0, maxObs);
}

function ExternalSynthesisBlock({
  opportunities,
  threats,
  correlations,
  isPolish,
  getItemText,
}: {
  opportunities: SWOTItem[];
  threats: SWOTItem[];
  correlations: SWOTCorrelation[];
  isPolish: boolean;
  getItemText: (id: string) => string;
}) {
  const { t } = useTranslation();
  const observations = useMemo(
    () => deriveExternalObservations(opportunities, threats, correlations, isPolish),
    [opportunities, threats, correlations, isPolish]
  );

  return (
    <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
      <SectionHeader
        title=""
        badge={t('discoveryToolsTools.dynamicSwot.insightsPhase.externalSynthesis')}
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.dynamicSwot.insightsPhase.externalSynthesis')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.dynamicSwot.insightsPhase.externalSynthesisSubtitle')}
        </p>
      </SectionHeader>
      <div className="space-y-4 px-6 py-5">
        {observations.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-5 text-center text-sm text-slate-600 dark:border-navy-700 dark:text-slate-500">
            {t('discoveryToolsTools.dynamicSwot.insightsPhase.externalSynthesisEmpty')}
          </div>
        ) : (
          <div className="space-y-4">
            {observations.map((obs, idx) => (
              <ObservationCard key={idx} obs={obs} isPolish={isPolish} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STRATEGIC INSIGHTS — derive cross-quadrant observations
   ═══════════════════════════════════════════════════════════════ */

interface StrategicInsight extends Observation {
  type: 'tension' | 'leverage' | 'vulnerability' | 'opportunity-window';
}

const INSIGHT_TYPE_META: Record<
  StrategicInsight['type'],
  { label: { en: string; pl: string }; accent: string; icon: typeof Swords }
> = {
  tension: {
    label: { en: 'Strategic tension', pl: 'Napięcie strategiczne' },
    accent: 'text-danger-600 dark:text-danger-400',
    icon: Swords,
  },
  leverage: {
    label: { en: 'Leverage point', pl: 'Punkt dźwigni' },
    accent: 'text-emerald-600 dark:text-emerald-400',
    icon: Zap,
  },
  vulnerability: {
    label: { en: 'Critical vulnerability', pl: 'Krytyczna podatność' },
    accent: 'text-amber-600 dark:text-amber-400',
    icon: Shield,
  },
  'opportunity-window': {
    label: { en: 'Opportunity window', pl: 'Okno szansy' },
    accent: 'text-blue-600 dark:text-blue-400',
    icon: Target,
  },
};

function deriveStrategicInsights(
  strengths: SWOTItem[],
  weaknesses: SWOTItem[],
  opportunities: SWOTItem[],
  threats: SWOTItem[],
  correlations: SWOTCorrelation[],
  isPolish: boolean
): StrategicInsight[] {
  const insights: StrategicInsight[] = [];
  const sNames = strengths
    .slice(0, 3)
    .map((i) => i.text)
    .join(', ');
  const wNames = weaknesses
    .slice(0, 3)
    .map((i) => i.text)
    .join(', ');
  const oNames = opportunities
    .slice(0, 3)
    .map((i) => i.text)
    .join(', ');
  const tNames = threats
    .slice(0, 3)
    .map((i) => i.text)
    .join(', ');

  if (strengths.length > 0 && opportunities.length > 0) {
    insights.push({
      type: 'leverage',
      title: isPolish
        ? 'Siły × Szanse — punkt dźwigni'
        : 'Strengths × Opportunities — leverage point',
      body: isPolish
        ? `Organizacja dysponuje ${strengths.length} siłami (${sNames}) przy ${opportunities.length} szansach rynkowych (${oNames}). To klasyczna konfiguracja ofensywna — siły mogą być bezpośrednio użyte do przechwycenia szans. Kluczowe pytanie: czy zasoby są wystarczające, by działać na wielu frontach jednocześnie, czy trzeba wybrać 1-2 najważniejsze kierunki.`
        : `The organization has ${strengths.length} strengths (${sNames}) against ${opportunities.length} market opportunities (${oNames}). This is a classic offensive configuration — strengths can be directly leveraged to capture opportunities. The key question: are resources sufficient to act on multiple fronts, or must 1-2 priority directions be chosen.`,
      conclusion: isPolish
        ? 'Wniosek: zidentyfikuj, które siły najsilniej korelują z największymi szansami — tam leży największy zwrot z inwestycji strategicznej.'
        : 'Conclusion: identify which strengths correlate most strongly with the biggest opportunities — that is where the highest strategic ROI lies.',
      priority: 'critical',
    });
  }

  if (weaknesses.length > 0 && threats.length > 0) {
    insights.push({
      type: 'vulnerability',
      title: isPolish
        ? 'Słabości × Zagrożenia — krytyczna podatność'
        : 'Weaknesses × Threats — critical vulnerability',
      body: isPolish
        ? `${weaknesses.length} słabości (${wNames}) w połączeniu z ${threats.length} zagrożeniami (${tNames}) tworzy strefę ryzyka egzystencjalnego. Każde zagrożenie, które trafi w istniejącą słabość, ma efekt mnożnikowy. To nie jest kwestia "czy" się zmaterializuje, ale "kiedy" i "jak mocno uderzy". Organizacja musi mieć plan naprawczy dla najgroźniejszych kombinacji.`
        : `${weaknesses.length} weaknesses (${wNames}) combined with ${threats.length} threats (${tNames}) create a zone of existential risk. Every threat hitting an existing weakness has a multiplier effect. The question is not "if" it materializes but "when" and "how hard." The organization needs a remediation plan for the most dangerous combinations.`,
      conclusion: isPolish
        ? 'Wniosek: priorytetyzuj naprawę słabości, które są najbardziej narażone na istniejące zagrożenia — to Twoja "linia obrony".'
        : 'Conclusion: prioritize fixing weaknesses most exposed to existing threats — this is your "defense line."',
      priority: 'critical',
    });
  }

  if (strengths.length > 0 && threats.length > 0) {
    insights.push({
      type: 'tension',
      title: isPolish
        ? 'Siły × Zagrożenia — napięcie strategiczne'
        : 'Strengths × Threats — strategic tension',
      body: isPolish
        ? `Organizacja posiada siły (${sNames}), które mogą służyć jako tarcza przed zagrożeniami (${tNames}). Pytanie strategiczne: czy lepiej użyć sił defensywnie (ochrona pozycji) czy ofensywnie (przechwycenie szans)? To klasyczny dylemat alokacji zasobów — każda siła użyta do obrony to siła niedostępna do ataku.`
        : `The organization has strengths (${sNames}) that can serve as a shield against threats (${tNames}). The strategic question: is it better to use strengths defensively (protecting position) or offensively (capturing opportunities)? This is the classic resource allocation dilemma — every strength used for defense is unavailable for offense.`,
      conclusion: isPolish
        ? 'Wniosek: określ, które zagrożenia wymagają aktywnej obrony siłami, a które można zaakceptować jako ryzyko rezydualne.'
        : 'Conclusion: determine which threats require active defense using strengths, and which can be accepted as residual risk.',
      priority: 'important',
    });
  }

  if (weaknesses.length > 0 && opportunities.length > 0) {
    insights.push({
      type: 'opportunity-window',
      title: isPolish
        ? 'Słabości × Szanse — okno konwersji'
        : 'Weaknesses × Opportunities — conversion window',
      body: isPolish
        ? `Słabości (${wNames}) mogą blokować wykorzystanie szans (${oNames}). To frustrująca sytuacja — rynek oferuje możliwości, ale organizacja nie jest gotowa ich przechwycić. Kluczowe: czy słabości da się szybko naprawić (quick wins), czy wymagają głębokiej transformacji? Jeśli okno szansy zamknie się szybciej niż naprawa słabości, potrzebna jest alternatywna strategia.`
        : `Weaknesses (${wNames}) may block capturing opportunities (${oNames}). This is a frustrating situation — the market offers possibilities, but the organization isn't ready to capture them. Key question: can weaknesses be fixed quickly (quick wins), or do they require deep transformation? If the opportunity window closes faster than weakness repair, an alternative strategy is needed.`,
      conclusion: isPolish
        ? 'Wniosek: oceń czas naprawy każdej słabości vs. czas trwania każdej szansy — tam gdzie się nie pokrywają, szukaj partnerów lub akwizycji.'
        : "Conclusion: assess repair time for each weakness vs. duration of each opportunity — where they don't overlap, seek partners or acquisitions.",
      priority: 'important',
    });
  }

  if (correlations.length > 0) {
    const posCorr = correlations.filter((c) => c.type === 'SO' || c.type === 'ST');
    const negCorr = correlations.filter((c) => c.type === 'WO' || c.type === 'WT');
    if (posCorr.length > 0 || negCorr.length > 0) {
      insights.push({
        type: 'tension',
        title: isPolish ? 'Korelacje między czynnikami' : 'Cross-factor correlations',
        body: isPolish
          ? `Zidentyfikowano ${correlations.length} korelacji między czynnikami SWOT${posCorr.length > 0 ? `, w tym ${posCorr.length} wzmacniających się wzajemnie` : ''}${negCorr.length > 0 ? ` i ${negCorr.length} konfliktowych` : ''}. Korelacje wzmacniające oznaczają, że poprawa jednego czynnika automatycznie poprawia inny — to naturalne dźwignie. Korelacje konfliktowe wymagają świadomego wyboru: nie da się optymalizować obu jednocześnie.`
          : `Identified ${correlations.length} correlations between SWOT factors${posCorr.length > 0 ? `, including ${posCorr.length} mutually reinforcing` : ''}${negCorr.length > 0 ? ` and ${negCorr.length} conflicting` : ''}. Reinforcing correlations mean improving one factor automatically improves another — these are natural levers. Conflicting correlations require conscious choice: you cannot optimize both simultaneously.`,
        conclusion: isPolish
          ? 'Wniosek: wykorzystaj korelacje wzmacniające jako mnożniki efektu, a konfliktowe traktuj jako punkty decyzyjne wymagające trade-offu.'
          : 'Conclusion: use reinforcing correlations as effect multipliers, and treat conflicting ones as decision points requiring trade-offs.',
        priority: correlations.length >= 5 ? 'critical' : 'important',
      });
    }
  }

  const totalFactors = strengths.length + weaknesses.length + opportunities.length + threats.length;
  const maxInsights = totalFactors >= 12 ? 5 : totalFactors >= 8 ? 4 : totalFactors >= 5 ? 3 : 2;
  return insights.slice(0, maxInsights);
}

/* ═══════════════════════════════════════════════════════════════
   RECOMMENDATIONS — derive actionable recommendations
   ═══════════════════════════════════════════════════════════════ */

interface DerivedRecommendation {
  id: string;
  title: string;
  description: string;
  rationale: string;
  type: 'strategic' | 'operational' | 'defensive' | 'growth';
  estimatedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  linkedQuadrants: string[];
}

const REC_TYPE_META: Record<
  DerivedRecommendation['type'],
  { label: { en: string; pl: string }; color: string; icon: typeof Rocket }
> = {
  strategic: {
    label: { en: 'Strategic', pl: 'Strategiczna' },
    color: 'text-primary-600 dark:text-primary-400',
    icon: Target,
  },
  operational: {
    label: { en: 'Operational', pl: 'Operacyjna' },
    color: 'text-blue-600 dark:text-blue-400',
    icon: Wrench,
  },
  defensive: {
    label: { en: 'Defensive', pl: 'Defensywna' },
    color: 'text-amber-600 dark:text-amber-400',
    icon: Shield,
  },
  growth: {
    label: { en: 'Growth', pl: 'Wzrostowa' },
    color: 'text-emerald-600 dark:text-emerald-400',
    icon: Rocket,
  },
};

function deriveRecommendations(
  strengths: SWOTItem[],
  weaknesses: SWOTItem[],
  opportunities: SWOTItem[],
  threats: SWOTItem[],
  correlations: SWOTCorrelation[],
  isPolish: boolean
): DerivedRecommendation[] {
  const recs: DerivedRecommendation[] = [];
  let idx = 0;

  const hiStrengths = strengths.filter((i) => i.impact === 'high');
  const hiOpportunities = opportunities.filter((i) => i.impact === 'high');
  const hiThreats = threats.filter((i) => i.impact === 'high');
  const hiWeaknesses = weaknesses.filter((i) => i.impact === 'high');

  if (strengths.length > 0 && opportunities.length > 0) {
    recs.push({
      id: `rec-${++idx}`,
      title: isPolish
        ? 'Ofensywa: wykorzystaj siły do przechwycenia szans'
        : 'Offense: leverage strengths to capture opportunities',
      description: isPolish
        ? `Skoncentruj ${hiStrengths.length > 0 ? 'najsilniejsze atuty' : 'kluczowe siły'} organizacji na ${hiOpportunities.length > 0 ? 'szansach o najwyższym potencjale' : 'najbardziej obiecujących szansach rynkowych'}. Zbuduj dedykowany plan działania z kamieniami milowymi na 90 dni.`
        : `Concentrate the organization's ${hiStrengths.length > 0 ? 'strongest assets' : 'key strengths'} on ${hiOpportunities.length > 0 ? 'highest-potential opportunities' : 'the most promising market opportunities'}. Build a dedicated action plan with 90-day milestones.`,
      rationale: isPolish
        ? `${strengths.length} sił × ${opportunities.length} szans = konfiguracja ofensywna. Brak działania oznacza utratę okna szansy.`
        : `${strengths.length} strengths × ${opportunities.length} opportunities = offensive configuration. Inaction means losing the opportunity window.`,
      type: 'growth',
      estimatedImpact: hiStrengths.length > 0 && hiOpportunities.length > 0 ? 'high' : 'medium',
      estimatedEffort: 'medium',
      linkedQuadrants: ['strengths', 'opportunities'],
    });
  }

  if (weaknesses.length > 0 && threats.length > 0) {
    recs.push({
      id: `rec-${++idx}`,
      title: isPolish
        ? 'Naprawa: eliminuj słabości narażone na zagrożenia'
        : 'Repair: eliminate weaknesses exposed to threats',
      description: isPolish
        ? `Zidentyfikuj słabości, które są bezpośrednio narażone na istniejące zagrożenia i uruchom program naprawczy. Priorytet: ${hiWeaknesses.length > 0 ? 'słabości o wysokim wpływie' : 'najczęściej pojawiające się słabości'} w kontekście ${hiThreats.length > 0 ? 'zagrożeń krytycznych' : 'głównych zagrożeń'}.`
        : `Identify weaknesses directly exposed to existing threats and launch a remediation program. Priority: ${hiWeaknesses.length > 0 ? 'high-impact weaknesses' : 'most frequently occurring weaknesses'} in the context of ${hiThreats.length > 0 ? 'critical threats' : 'major threats'}.`,
      rationale: isPolish
        ? `${weaknesses.length} słabości × ${threats.length} zagrożeń = strefa ryzyka egzystencjalnego. Każdy dzień bez naprawy zwiększa ekspozycję.`
        : `${weaknesses.length} weaknesses × ${threats.length} threats = existential risk zone. Every day without repair increases exposure.`,
      type: 'defensive',
      estimatedImpact: 'high',
      estimatedEffort: hiWeaknesses.length > 2 ? 'high' : 'medium',
      linkedQuadrants: ['weaknesses', 'threats'],
    });
  }

  if (strengths.length > 0 && threats.length > 0) {
    recs.push({
      id: `rec-${++idx}`,
      title: isPolish
        ? 'Obrona: użyj sił jako tarczy przed zagrożeniami'
        : 'Defense: use strengths as a shield against threats',
      description: isPolish
        ? `Zmapuj, które siły mogą neutralizować które zagrożenia. Stwórz "matrycę obrony" — dla każdego zagrożenia wskaż siłę, która je osłabia. Tam, gdzie brakuje pokrycia, zaplanuj budowę nowych kompetencji.`
        : `Map which strengths can neutralize which threats. Create a "defense matrix" — for each threat, identify the strength that weakens it. Where coverage gaps exist, plan to build new capabilities.`,
      rationale: isPolish
        ? `Siły nie służą tylko do ataku — dobrze użyte mogą być najskuteczniejszą obroną przed zagrożeniami rynkowymi.`
        : `Strengths aren't just for offense — properly deployed, they can be the most effective defense against market threats.`,
      type: 'strategic',
      estimatedImpact: 'medium',
      estimatedEffort: 'low',
      linkedQuadrants: ['strengths', 'threats'],
    });
  }

  if (weaknesses.length > 0 && opportunities.length > 0) {
    recs.push({
      id: `rec-${++idx}`,
      title: isPolish
        ? 'Konwersja: napraw słabości, by odblokować szanse'
        : 'Conversion: fix weaknesses to unlock opportunities',
      description: isPolish
        ? `Oceń, które słabości bezpośrednio blokują wykorzystanie szans. Dla każdej pary słabość-szansa określ: czas naprawy vs. czas trwania szansy. Jeśli naprawa trwa dłużej — rozważ partnerstwa, outsourcing lub akwizycje.`
        : `Assess which weaknesses directly block opportunity capture. For each weakness-opportunity pair, determine: repair time vs. opportunity duration. If repair takes longer — consider partnerships, outsourcing, or acquisitions.`,
      rationale: isPolish
        ? `Szanse rynkowe mają datę ważności. Słabości, które blokują ich wykorzystanie, to koszt utraconych korzyści rosnący z każdym dniem.`
        : `Market opportunities have expiration dates. Weaknesses blocking their capture represent opportunity costs growing daily.`,
      type: 'operational',
      estimatedImpact: hiOpportunities.length > 0 ? 'high' : 'medium',
      estimatedEffort: 'high',
      linkedQuadrants: ['weaknesses', 'opportunities'],
    });
  }

  if (correlations.length >= 3) {
    recs.push({
      id: `rec-${++idx}`,
      title: isPolish
        ? 'Systemowa: wykorzystaj korelacje jako mnożniki'
        : 'Systemic: leverage correlations as multipliers',
      description: isPolish
        ? `${correlations.length} zidentyfikowanych korelacji między czynnikami SWOT wskazuje na systemowe zależności. Zamiast działać na pojedynczych czynnikach, zaprojektuj interwencje, które uruchamiają kaskadę pozytywnych zmian przez korelacje wzmacniające.`
        : `${correlations.length} identified correlations between SWOT factors indicate systemic dependencies. Instead of acting on individual factors, design interventions that trigger a cascade of positive changes through reinforcing correlations.`,
      rationale: isPolish
        ? `Podejście systemowe daje 2-3× lepszy zwrot niż punktowe interwencje — jeden ruch uruchamia wiele pozytywnych efektów.`
        : `A systemic approach yields 2-3× better returns than point interventions — one move triggers multiple positive effects.`,
      type: 'strategic',
      estimatedImpact: 'high',
      estimatedEffort: 'medium',
      linkedQuadrants: ['strengths', 'weaknesses', 'opportunities', 'threats'],
    });
  }

  const totalFactors = strengths.length + weaknesses.length + opportunities.length + threats.length;
  if (totalFactors >= 10) {
    recs.push({
      id: `rec-${++idx}`,
      title: isPolish
        ? 'Priorytetyzacja: stwórz macierz wpływ × wysiłek'
        : 'Prioritization: create impact × effort matrix',
      description: isPolish
        ? `Przy ${totalFactors} czynnikach SWOT organizacja nie może działać na wszystkich frontach jednocześnie. Stwórz macierz priorytetów: oś X = wysiłek implementacji, oś Y = oczekiwany wpływ. Skup się na kwadrancie "wysoki wpływ, niski wysiłek" (quick wins) i "wysoki wpływ, wysoki wysiłek" (projekty strategiczne).`
        : `With ${totalFactors} SWOT factors, the organization cannot act on all fronts simultaneously. Create a priority matrix: X-axis = implementation effort, Y-axis = expected impact. Focus on the "high impact, low effort" quadrant (quick wins) and "high impact, high effort" (strategic projects).`,
      rationale: isPolish
        ? `Złożoność analizy wymaga jasnego frameworku priorytetyzacji — bez niego zespół będzie paraliżowany liczbą opcji.`
        : `Analysis complexity demands a clear prioritization framework — without it, the team will be paralyzed by the number of options.`,
      type: 'operational',
      estimatedImpact: 'medium',
      estimatedEffort: 'low',
      linkedQuadrants: [],
    });
  }

  const maxRecs = totalFactors >= 12 ? 6 : totalFactors >= 8 ? 5 : totalFactors >= 5 ? 4 : 3;
  return recs.slice(0, maxRecs);
}

/* ═══════════════════════════════════════════════════════════════
   RECOMMENDATION CARD with governed Candidate handoff
   ═══════════════════════════════════════════════════════════════ */

function RecommendationCard({
  rec,
  index,
  isPolish,
  onCreateCandidate,
  candidateHandoffAllowed,
  showCandidateAction = true,
}: {
  rec: DerivedRecommendation;
  index: number;
  isPolish: boolean;
  onCreateCandidate: (rec: DerivedRecommendation) => Promise<void>;
  candidateHandoffAllowed: boolean;
  showCandidateAction?: boolean;
}) {
  const { t } = useTranslation();
  const meta = REC_TYPE_META[rec.type];
  const TypeIcon = meta.icon;
  const [expanded, setExpanded] = useState(false);
  const [candidateCreated, setCandidateCreated] = useState(false);
  const [isCreatingCandidate, setIsCreatingCandidate] = useState(false);

  const handleCreate = async () => {
    setIsCreatingCandidate(true);
    try {
      await onCreateCandidate(rec);
      setCandidateCreated(true);
    } catch {
      // Parent owns the user-facing error toast; keep the action retryable.
    } finally {
      setIsCreatingCandidate(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm transition-all hover:shadow-md dark:border-navy-700/50 dark:bg-navy-950/40">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-900">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TypeIcon className={`h-4 w-4 ${meta.color}`} />
            <span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${meta.color}`}>
              {isPolish ? meta.label.pl : meta.label.en}
            </span>
            <div className="ml-auto flex gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  rec.estimatedImpact === 'high'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                    : rec.estimatedImpact === 'medium'
                      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                      : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-navy-700 dark:bg-navy-950/40 dark:text-slate-400'
                }`}
              >
                {t('discoveryToolsTools.common.impact')}: {rec.estimatedImpact}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  rec.estimatedEffort === 'low'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                    : rec.estimatedEffort === 'medium'
                      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                      : 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300'
                }`}
              >
                {t('discoveryToolsTools.common.effort')}: {rec.estimatedEffort}
              </span>
            </div>
          </div>

          <h4 className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
            {rec.title}
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {rec.description}
          </p>

          {expanded && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-navy-700/40 dark:bg-navy-950/20">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-500">
                {t('discoveryToolsTools.common.rationale')}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {rec.rationale}
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              {expanded
                ? t('discoveryToolsTools.common.collapseRationale')
                : t('discoveryToolsTools.common.showRationale')}
            </button>

            {!showCandidateAction ? null : candidateCreated ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                {t('discoveryToolsTools.common.candidateCreated')}
              </span>
            ) : (
              <button
                onClick={handleCreate}
                disabled={isCreatingCandidate || !candidateHandoffAllowed}
                title={
                  candidateHandoffAllowed
                    ? undefined
                    : t('discoveryToolsTools.dynamicSwot.insightsPhase.candidateApprovalRequired')
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] px-3 py-2 text-xs font-semibold text-white dark:text-navy-950 shadow-sm transition-all hover:bg-navy-800 dark:hover:bg-[#DDE5EF] hover:shadow-md disabled:cursor-wait disabled:opacity-60"
              >
                <Rocket className="h-3.5 w-3.5" />
                {isCreatingCandidate
                  ? t('discoveryToolsTools.common.creatingCandidate')
                  : t('discoveryToolsTools.common.createCandidate')}
              </button>
            )}
          </div>
          {showCandidateAction && !candidateHandoffAllowed && (
            <p className="mt-2 text-right text-xs text-amber-700 dark:text-amber-300">
              {t('discoveryToolsTools.dynamicSwot.insightsPhase.candidateApprovalRequired')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function SWOTInsightsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: {
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}) {
  const { t } = useTranslation();
  const { acceptCard, rejectCard, acceptAllInPhase } = useToolStore();
  const swotData = session.inputData as SWOTData;
  const tensions = swotData.tensions || [];
  const correlations = swotData.correlations || [];
  const moves = swotData.recommendedMoves || [];
  const items = swotData.items || [];
  const summary = swotData.summary;
  const appliedConclusions = summary?.appliedConclusions || [];
  const keyInsights = summary?.keyInsights || [];
  const executiveSummary = summary?.executiveSummary || '';

  const activeMoves = useMemo(
    () => moves.filter((m) => !(m.estimatedEffort === 'high' && m.expectedImpact !== 'high')),
    [moves]
  );
  const deferredMoves = useMemo(
    () => moves.filter((m) => m.estimatedEffort === 'high' && m.expectedImpact !== 'high'),
    [moves]
  );

  const strengths = useMemo(() => items.filter((i) => i.quadrant === 'strengths'), [items]);
  const weaknesses = useMemo(() => items.filter((i) => i.quadrant === 'weaknesses'), [items]);
  const opportunities = useMemo(() => items.filter((i) => i.quadrant === 'opportunities'), [items]);
  const threats = useMemo(() => items.filter((i) => i.quadrant === 'threats'), [items]);

  const tensionsByType = useMemo(
    () =>
      TENSION_BUCKETS.reduce<Record<string, typeof tensions>>((acc, b) => {
        acc[b.type] = tensions.filter((t) => t.type === b.type);
        return acc;
      }, {}),
    [tensions]
  );

  const getItemText = (itemId: string) => items.find((item) => item.id === itemId)?.text || itemId;

  const hasProposals =
    tensions.some((t) => t.proposalStatus === 'ai-proposed') ||
    moves.some((m) => m.proposalStatus === 'ai-proposed');

  const derivedInsights = useMemo(
    () =>
      deriveStrategicInsights(
        strengths,
        weaknesses,
        opportunities,
        threats,
        correlations,
        isPolish
      ),
    [strengths, weaknesses, opportunities, threats, correlations, isPolish]
  );

  const derivedRecommendations = useMemo(
    () =>
      deriveRecommendations(strengths, weaknesses, opportunities, threats, correlations, isPolish),
    [strengths, weaknesses, opportunities, threats, correlations, isPolish]
  );

  const universalSynthesis = useMemo(
    () =>
      normalizeUniversalSynthesis(
        {
          'executive-answer': executiveSummary || summary?.verdict || '',
          'key-findings': items.map((item) => item.text),
          'key-insights': keyInsights,
          'business-implications': tensions.map((tension) => tension.insight || tension.title),
          conclusions: appliedConclusions,
          'decision-options': derivedRecommendations.map((recommendation) => recommendation.title),
          'consultant-recommendation': activeMoves.map((move) => move.title),
          'risks-assumptions-uncertainties': [
            ...threats.map((item) => item.text),
            ...(summary?.tradeoffs || []).map((tradeoff) => tradeoff.why),
          ],
          'management-questions': (swotData.outputCandidates || []).map(
            (candidate) => candidate.title
          ),
        },
        isPolish,
        {
          'executive-answer': summary?.proposalId ? [summary.proposalId] : [],
          'key-findings': items.map((item) => item.id),
          'key-insights': summary?.proposalId ? [summary.proposalId] : [],
          'business-implications': tensions.map((tension) => tension.id),
          conclusions: summary?.proposalId ? [summary.proposalId] : [],
          'decision-options': derivedRecommendations.map((recommendation) => recommendation.id),
          'consultant-recommendation': activeMoves.map((move) => move.id),
          'risks-assumptions-uncertainties': threats.map((item) => item.id),
          'management-questions': (swotData.outputCandidates || []).map(
            (candidate) => candidate.id
          ),
        }
      ),
    [
      activeMoves,
      appliedConclusions,
      derivedRecommendations,
      executiveSummary,
      isPolish,
      items,
      keyInsights,
      summary?.tradeoffs,
      summary?.verdict,
      swotData.outputCandidates,
      tensions,
      threats,
    ]
  );

  const handleCreateCandidate = async (rec: DerivedRecommendation) => {
    // TLS-07: hand off to the governed Candidate inbox. Candidate acceptance,
    // not this SWOT surface, owns eventual Initiative creation.
    try {
      await Api.handoffSwotCandidate(session.id, {
        id: rec.id,
      });
      toast.success(t('discoveryToolsTools.dynamicSwot.insightsPhase.candidateCreatedToast'));
    } catch (err) {
      console.error('[DynamicSWOT] initiative handoff failed:', err);
      toast.error(t('discoveryToolsTools.dynamicSwot.insightsPhase.candidateCreateErrorToast'));
      throw err;
    }
  };

  const candidateHandoffAllowed = ['APPROVED', 'FINALIZED'].includes(
    String(session.status || '')
      .trim()
      .toUpperCase()
  );

  type CandidateReceipt = {
    lineageState: 'PINNED' | 'HISTORICAL_UNRESOLVED';
    receiptId: string;
    recommendationId: string;
    candidateId: string;
    toolOutputId: string | null;
    toolOutputVersion: number | null;
    toolOutputContentHash: string | null;
    sourceRevision: number | null;
    createdAt: string;
  };
  const [candidateReceipts, setCandidateReceipts] = useState<Record<string, CandidateReceipt>>({});
  const [creatingRecommendationId, setCreatingRecommendationId] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateHandoffAllowed) {
      setCandidateReceipts({});
      return;
    }
    let cancelled = false;
    void Api.getSwotCandidateReceipts(session.id)
      .then(({ receipts }) => {
        if (cancelled) return;
        setCandidateReceipts(
          Object.fromEntries(receipts.map((receipt) => [receipt.recommendationId, receipt]))
        );
      })
      .catch(() => {
        if (!cancelled) setCandidateReceipts({});
      });
    return () => {
      cancelled = true;
    };
  }, [candidateHandoffAllowed, session.id]);

  const handoffFrozenMove = async (recommendationId: string) => {
    setCreatingRecommendationId(recommendationId);
    try {
      const result = await Api.handoffSwotCandidate(session.id, { id: recommendationId });
      setCandidateReceipts((current) => ({
        ...current,
        [recommendationId]: result.receipt,
      }));
      toast.success(t('discoveryToolsTools.dynamicSwot.insightsPhase.candidateCreatedToast'));
    } catch (error) {
      console.error('[DynamicSWOT] frozen recommendation handoff failed:', error);
      toast.error(t('discoveryToolsTools.dynamicSwot.insightsPhase.candidateCreateErrorToast'));
    } finally {
      setCreatingRecommendationId(null);
    }
  };

  return (
    <div className="space-y-5 p-1">
      <ToolSynthesisSections sections={universalSynthesis} isPolish={isPolish} />
      <details className="rounded-2xl border border-c-border bg-c-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-c-text">
          {isPolish ? 'Pokaż analizę źródłową' : 'Show supporting analysis'}
        </summary>
        <div className="space-y-5 border-t border-c-border p-4">
          {/* ═══════════════════════════════════════════════════
          FACTOR PICTURE — 2×2 SWOT grid
          ═══════════════════════════════════════════════════ */}
          {items.length > 0 && (
            <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
          <SectionHeader
            title={t('discoveryToolsTools.dynamicSwot.insightsPhase.factorPictureTitle')}
            badge={t('discoveryToolsTools.dynamicSwot.insightsPhase.evidenceBadge')}
          />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {(['strengths', 'weaknesses', 'opportunities', 'threats'] as const).map((q) => {
              const qItems = items.filter((i) => i.quadrant === q);
              const meta = QUADRANT_META[q];
              return (
                <div key={q} className="space-y-1.5">
                  <div
                    className={`mb-2 text-[11px] font-bold uppercase tracking-[0.16em] ${meta.label}`}
                  >
                    {isPolish ? meta.title.pl : meta.title.en} ({qItems.length})
                  </div>
                  {qItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border ${meta.border} ${meta.bg} px-3 py-2 text-sm leading-relaxed ${meta.text}`}
                    >
                      <span className="font-medium">{item.text}</span>
                      {item.impact === 'high' && (
                        <span className="ml-2 text-[9px] font-bold uppercase tracking-wider opacity-60">
                          high impact
                        </span>
                      )}
                    </div>
                  ))}
                  {qItems.length === 0 && (
                    <div className="text-sm text-slate-600">
                      {t('discoveryToolsTools.common.none')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════
          SYNTHESIS 1 — Per-quadrant observations
          ═══════════════════════════════════════════════════ */}
      <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
        <SectionHeader
          title=""
          badge={t('discoveryToolsTools.dynamicSwot.insightsPhase.synthesisBadge')}
        >
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t('discoveryToolsTools.dynamicSwot.insightsPhase.perAreaObservationsTitle')}
          </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('discoveryToolsTools.dynamicSwot.insightsPhase.perAreaObservationsSubtitle')}
              </p>
            </SectionHeader>
            <div className="space-y-4 p-5">
              <QuadrantObservationsBlock
                quadrant="strengths"
                items={strengths}
                isPolish={isPolish}
              />
              <QuadrantObservationsBlock
                quadrant="weaknesses"
                items={weaknesses}
                isPolish={isPolish}
              />
              <QuadrantObservationsBlock
                quadrant="opportunities"
                items={opportunities}
                isPolish={isPolish}
              />
          <QuadrantObservationsBlock quadrant="threats" items={threats} isPolish={isPolish} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SYNTHESIS 2 — Internal synthesis (S + W)
          ═══════════════════════════════════════════════════ */}
      <InternalSynthesisBlock
        strengths={strengths}
        weaknesses={weaknesses}
        correlations={correlations}
        executiveSummary={executiveSummary}
        isPolish={isPolish}
        getItemText={getItemText}
      />

      {/* ═══════════════════════════════════════════════════
          SYNTHESIS 3 — External synthesis (O + T)
          ═══════════════════════════════════════════════════ */}
      <ExternalSynthesisBlock
        opportunities={opportunities}
        threats={threats}
        correlations={correlations}
        isPolish={isPolish}
        getItemText={getItemText}
      />

      {/* ═══════════════════════════════════════════════════
          STRATEGIC INSIGHTS — ciało doradcze
          ═══════════════════════════════════════════════════ */}
      <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
        <SectionHeader
          title=""
          badge={t('discoveryToolsTools.dynamicSwot.insightsPhase.insightsBadge')}
        >
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t('discoveryToolsTools.dynamicSwot.insightsPhase.strategicInsightsTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('discoveryToolsTools.dynamicSwot.insightsPhase.strategicInsightsSubtitle')}
          </p>
        </SectionHeader>
        <div className="space-y-6 px-6 py-5">
          {hasProposals && (
            <div className="flex justify-end">
              <button
                onClick={() => acceptAllInPhase('insights')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
              >
                <Check className="h-3.5 w-3.5" />
                {t('discoveryToolsTools.common.acceptAllProposals')}
              </button>
            </div>
          )}

          {/* Key insights from AI */}
          {keyInsights.length > 0 && (
            <div>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
                {t('discoveryToolsTools.dynamicSwot.insightsPhase.keyInsightsTitle')}
              </div>
              <div className="space-y-2">
                {keyInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-amber-200/50 bg-amber-50/40 p-3.5 dark:border-amber-900/30 dark:bg-amber-950/15"
                  >
                    <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <span className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                      {insight}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applied conclusions from AI */}
          {appliedConclusions.length > 0 && (
            <div>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t('discoveryToolsTools.dynamicSwot.insightsPhase.appliedConclusionsTitle')}
              </div>
              <ul className="space-y-1.5">
                {appliedConclusions.map((c, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Strategic tensions from AI — TOWS */}
          {tensions.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {t('discoveryToolsTools.dynamicSwot.insightsPhase.towsTitle')}
                </span>
              </div>
              <div className="space-y-4">
                {TENSION_BUCKETS.map((bucket) => {
                  const bucketTensions = tensionsByType[bucket.type] || [];
                  if (bucketTensions.length === 0) return null;
                  const BucketIcon = bucket.icon;
                  return (
                    <div key={bucket.type}>
                      <div className="mb-2 flex items-center gap-2">
                        <BucketIcon className={`h-3.5 w-3.5 ${bucket.accent}`} />
                        <span
                          className={`text-[11px] font-bold uppercase tracking-[0.16em] ${bucket.accent}`}
                        >
                          {bucket.label}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          {isPolish ? bucket.title.pl : bucket.title.en}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {bucketTensions.map((tension) => {
                          const isProposal =
                            tension.proposalStatus === 'ai-proposed' ||
                            tension.proposalStatus === 'rethinking';
                          const content = (
                            <div>
                              <div className="text-sm font-semibold leading-relaxed text-slate-900 dark:text-slate-100">
                                {tension.title}
                              </div>
                              <div className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                {tension.insight}
                              </div>
                              {tension.whyNow && (
                                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold">
                                    {t('discoveryToolsTools.common.whyNowColon')}
                                  </span>{' '}
                                  {tension.whyNow}
                                </div>
                              )}
                              {(tension.linkedItemIds || []).length > 0 && (
                                <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-500">
                                  {(tension.linkedItemIds || [])
                                    .slice(0, 3)
                                    .map(getItemText)
                                    .join(' \u2022 ')}
                                </div>
                              )}
                            </div>
                          );
                          if (isProposal) {
                            return (
                              <ProposalCard
                                key={tension.id}
                                cardId={tension.id}
                                cardType="tension"
                                proposalStatus={tension.proposalStatus}
                                onAccept={onAcceptCard || acceptCard}
                                onReject={onRejectCard || rejectCard}
                                onRethink={onRethinkCard || (() => {})}
                                compact
                              >
                                {content}
                              </ProposalCard>
                            );
                          }
                          return (
                            <div
                              key={tension.id}
                              className="rounded-xl border border-slate-200/50 bg-slate-50/50 p-4 dark:border-navy-700/50 dark:bg-navy-950/30"
                            >
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Derived cross-quadrant insights (always shown when items exist) */}
          {items.length > 0 && derivedInsights.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {t('discoveryToolsTools.dynamicSwot.insightsPhase.crossFactorAnalysisTitle')}
                </span>
              </div>
              <div className="space-y-3">
                {derivedInsights.map((insight, idx) => {
                  const typeMeta = INSIGHT_TYPE_META[insight.type];
                  const InsightIcon = typeMeta.icon;
                  return (
                    <div key={idx} className="rounded-xl bg-white/70 dark:bg-navy-950/40">
                      <div className="flex items-center gap-2 px-4 pt-4">
                        <InsightIcon className={`h-4 w-4 ${typeMeta.accent}`} />
                        <span
                          className={`text-[10px] font-bold uppercase tracking-[0.14em] ${typeMeta.accent}`}
                        >
                          {isPolish ? typeMeta.label.pl : typeMeta.label.en}
                        </span>
                      </div>
                      <div className="px-4 pb-4">
                        <ObservationCard obs={insight} isPolish={isPolish} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* True empty state — no data at all */}
          {items.length === 0 && keyInsights.length === 0 && tensions.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-navy-700">
              <Lightbulb className="mx-auto h-8 w-8 text-slate-600 dark:text-slate-400" />
              <div className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                {t('discoveryToolsTools.dynamicSwot.insightsPhase.noInsightsEmptyState')}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          RECOMMENDATIONS — rekomendacje z "Utwórz inicjatywę"
          ═══════════════════════════════════════════════════ */}
      <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
        <SectionHeader
          title=""
          badge={t('discoveryToolsTools.dynamicSwot.insightsPhase.recommendationsBadge')}
        >
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t('discoveryToolsTools.dynamicSwot.insightsPhase.recommendationsBadge')}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('discoveryToolsTools.dynamicSwot.insightsPhase.recommendationsSubtitle')}
          </p>
        </SectionHeader>
        <div className="space-y-4 px-6 py-5">
          {/* AI-generated moves (when available) */}
          {activeMoves.length > 0 && (
            <div className="space-y-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary-600 dark:text-primary-400">
                {t('discoveryToolsTools.dynamicSwot.insightsPhase.aiRecommendationsTitle')}
              </div>
              {activeMoves.map((move, idx) => {
                const isProposal =
                  move.proposalStatus === 'ai-proposed' || move.proposalStatus === 'rethinking';
                const catMeta = MOVE_CATEGORY_META[move.category];
                const CatIcon = catMeta?.icon || ArrowRight;

                const moveContent = (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                        {idx + 1}
                      </span>
                      <CatIcon className={`h-4 w-4 ${catMeta?.color || 'text-slate-500'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                        {isPolish ? catMeta?.label.pl : catMeta?.label.en}
                      </span>
                      <div className="ml-auto flex gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            move.expectedImpact === 'high'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                              : move.expectedImpact === 'medium'
                                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-navy-700 dark:bg-navy-950/40 dark:text-slate-400'
                          }`}
                        >
                          {t('discoveryToolsTools.common.impact')}: {move.expectedImpact}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            move.estimatedEffort === 'low'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                              : move.estimatedEffort === 'medium'
                                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                                : 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300'
                          }`}
                        >
                          {t('discoveryToolsTools.common.effort')}: {move.estimatedEffort}
                        </span>
                      </div>
                    </div>
                    <div className="ml-9">
                      <div className="text-sm font-semibold leading-relaxed text-slate-900 dark:text-slate-100">
                        {move.title}
                      </div>
                      <div className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {move.rationale}
                      </div>
                      {move.firstStep && (
                        <div className="mt-3 rounded-lg bg-slate-50/80 px-3 py-2 text-xs text-slate-600 dark:bg-navy-950/40 dark:text-slate-400">
                          <span className="font-semibold">
                            {t('discoveryToolsTools.common.firstStepColon')}
                          </span>{' '}
                          {move.firstStep}
                        </div>
                      )}
                      {!isProposal && (
                        <div className="mt-3 flex justify-end">
                          {candidateReceipts[move.id] ? (
                            <span
                              data-testid={`swot-candidate-receipt-${move.id}`}
                              title={
                                candidateReceipts[move.id].lineageState === 'PINNED'
                                  ? `${candidateReceipts[move.id].toolOutputId}@${candidateReceipts[move.id].toolOutputVersion}`
                                  : 'NEEDS_DECISION: historical receipt has no frozen output lineage'
                              }
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                                candidateReceipts[move.id].lineageState === 'PINNED'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                  : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                              }`}
                            >
                              {candidateReceipts[move.id].lineageState === 'PINNED' ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5" />
                              )}
                              {candidateReceipts[move.id].lineageState === 'PINNED'
                                ? t('discoveryToolsTools.common.candidateCreated')
                                : 'NEEDS_DECISION'}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handoffFrozenMove(move.id)}
                                  disabled={
                                    !candidateHandoffAllowed || creatingRecommendationId === move.id
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#F4F7FB] dark:text-navy-950"
                                >
                                  <Rocket className="h-3.5 w-3.5" />
                                  {creatingRecommendationId === move.id
                                    ? t('discoveryToolsTools.common.creatingCandidate')
                                : t('discoveryToolsTools.common.createCandidate')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );

                if (isProposal) {
                  return (
                    <ProposalCard
                      key={move.id}
                      cardId={move.id}
                      cardType="move"
                      proposalStatus={move.proposalStatus}
                      onAccept={onAcceptCard || acceptCard}
                      onReject={onRejectCard || rejectCard}
                      onRethink={onRethinkCard || (() => {})}
                      compact
                    >
                      {moveContent}
                    </ProposalCard>
                  );
                }

                return (
                  <div
                    key={move.id}
                    className="rounded-2xl border border-slate-200/50 bg-slate-50/40 p-5 dark:border-navy-700/50 dark:bg-navy-950/30"
                  >
                    {moveContent}
                  </div>
                );
              })}
            </div>
          )}

          {/* Derived recommendations (always shown when items exist) */}
          {items.length > 0 && derivedRecommendations.length > 0 && (
            <div className="space-y-4">
              {activeMoves.length > 0 && (
                <div className="mt-2 border-t border-slate-200/50 pt-4 dark:border-navy-700/40">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {t(
                      'discoveryToolsTools.dynamicSwot.insightsPhase.analysisDerivedRecommendationsTitle'
                    )}
                  </div>
                </div>
              )}
              {derivedRecommendations.map((rec, idx) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  index={activeMoves.length > 0 ? activeMoves.length + idx : idx}
                  isPolish={isPolish}
                  onCreateCandidate={handleCreateCandidate}
                  candidateHandoffAllowed={candidateHandoffAllowed}
                  showCandidateAction={false}
                />
              ))}
            </div>
          )}

          {/* Deferred AI moves */}
          {deferredMoves.length > 0 && (
            <div className="mt-2">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-danger-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-danger-600 dark:text-danger-400">
                  {t('discoveryToolsTools.common.notNowDefer')}
                </span>
              </div>
              <div className="space-y-2">
                {deferredMoves.map((move) => (
                  <div
                    key={move.id}
                    className="rounded-xl border border-danger-200/40 bg-danger-50/30 p-3 dark:border-danger-900/25 dark:bg-danger-900/10"
                  >
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {move.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {move.rationale}
                    </div>
                    <div className="mt-1 text-xs text-danger-600 dark:text-danger-400">
                      {t('discoveryToolsTools.dynamicSwot.insightsPhase.deferredEffortNote')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* True empty state */}
          {items.length === 0 && activeMoves.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-navy-700">
              <ArrowRight className="mx-auto h-8 w-8 text-slate-600 dark:text-slate-400" />
              <div className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                {t('discoveryToolsTools.dynamicSwot.insightsPhase.noRecommendationsEmptyState')}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          INITIATIVES — created from recommendations
          ═══════════════════════════════════════════════════ */}
      {(session.generatedInitiatives || []).length > 0 && (
        <section className="rounded-[28px] border border-primary-200/70 bg-gradient-to-br from-primary-50/40 to-white dark:border-primary-900/40 dark:from-primary-950/20 dark:to-navy-900/40">
          <SectionHeader
            title=""
            badge={t('discoveryToolsTools.dynamicSwot.insightsPhase.initiativesBadge')}
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {t('discoveryToolsTools.dynamicSwot.insightsPhase.strategicInitiativesTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('discoveryToolsTools.dynamicSwot.insightsPhase.strategicInitiativesSubtitle')}
            </p>
          </SectionHeader>
          <div className="space-y-3 px-6 py-5">
            {(session.generatedInitiatives || []).map((initiative, idx) => {
              const iMeta = REC_TYPE_META[initiative.type] || REC_TYPE_META.strategic;
              const IIcon = iMeta.icon;
              return (
                <div
                  key={initiative.id}
                  className="flex items-start gap-3 rounded-xl border border-primary-200/50 bg-white/80 p-4 shadow-sm dark:border-primary-900/30 dark:bg-navy-950/40"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white dark:bg-primary-500">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <IIcon className={`h-3.5 w-3.5 ${iMeta.color}`} />
                      <span
                        className={`text-[10px] font-bold uppercase tracking-[0.14em] ${iMeta.color}`}
                      >
                        {isPolish ? iMeta.label.pl : iMeta.label.en}
                      </span>
                      <div className="ml-auto flex gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            initiative.estimatedImpact === 'high'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                              : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                          }`}
                        >
                          {t('discoveryToolsTools.common.impact')}: {initiative.estimatedImpact}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            initiative.estimatedEffort === 'low'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                              : initiative.estimatedEffort === 'medium'
                                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                                : 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300'
                          }`}
                        >
                          {t('discoveryToolsTools.common.effort')}: {initiative.estimatedEffort}
                        </span>
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {initiative.title}
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {initiative.description}
                    </p>
                    <div className="mt-2 rounded-lg bg-primary-50/60 px-3 py-2 text-xs text-slate-600 dark:bg-primary-950/20 dark:text-slate-400">
                      <span className="font-semibold">
                        {t('discoveryToolsTools.common.rationaleColon')}
                      </span>{' '}
                      {initiative.rationale}
                    </div>
                  </div>
                </div>
              );
                })}
              </div>
            </section>
          )}
        </div>
      </details>
    </div>
  );
}

export default SWOTInsightsPhase;
