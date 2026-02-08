/**
 * ContextStep - First step for all tools
 *
 * Collects strategic goal, scope, and timeframe.
 * Adapts labels based on tool type.
 */

import { Calendar, MapPin, Target } from 'lucide-react';
import React from 'react';

import {
  GrowthPathsData,
  OperationalToolData,
  PorterData,
  PortfolioPriorityData,
  RiskUncertaintyData,
  SWOTData,
  ToolSession,
  ToolType,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../InlineAssist';

// ==================== TYPES ====================

interface ContextStepProps {
  toolType: ToolType;
  session: ToolSession;
  isPolish: boolean;
}

// ==================== LABELS ====================

interface ToolLabels {
  title: { en: string; pl: string };
  goalLabel: { en: string; pl: string };
  goalPlaceholder: { en: string; pl: string };
  scopeLabel: { en: string; pl: string };
  scopePlaceholder: { en: string; pl: string };
  timeframeLabel?: { en: string; pl: string };
  positionLabel?: { en: string; pl: string };
}

const LABELS: Record<string, ToolLabels> = {
  'dynamic-swot': {
    title: { en: 'Strategic Context', pl: 'Kontekst Strategiczny' },
    goalLabel: { en: 'Strategic Goal', pl: 'Cel Strategiczny' },
    goalPlaceholder: {
      en: 'e.g., Increase market share by 15% in premium segment',
      pl: 'np. Zwiększenie udziału w rynku o 15% w segmencie premium',
    },
    scopeLabel: { en: 'Scope / Business Area', pl: 'Zakres / Obszar Biznesowy' },
    scopePlaceholder: {
      en: 'e.g., Sales and Marketing department - B2B segment',
      pl: 'np. Dział Sprzedaży i Marketingu - segment B2B',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'market-forces': {
    title: { en: 'Industry Context', pl: 'Kontekst Branżowy' },
    goalLabel: { en: 'Industry / Market', pl: 'Branża / Rynek' },
    goalPlaceholder: {
      en: 'e.g., Enterprise SaaS - Project Management Software',
      pl: 'np. Enterprise SaaS - Oprogramowanie do zarządzania projektami',
    },
    scopeLabel: { en: 'Geographic Scope', pl: 'Zakres Geograficzny' },
    scopePlaceholder: {
      en: 'e.g., European Union market',
      pl: 'np. Rynek Unii Europejskiej',
    },
    positionLabel: { en: 'Market Position', pl: 'Pozycja Rynkowa' },
  },
  'growth-paths': {
    title: { en: 'Growth Context', pl: 'Kontekst Wzrostu' },
    goalLabel: { en: 'Growth Goal', pl: 'Cel Wzrostu' },
    goalPlaceholder: {
      en: 'e.g., Increase revenue in core segment by 20%',
      pl: 'np. Zwiększenie przychodów w segmencie core o 20%',
    },
    scopeLabel: { en: 'Scope / Business Area', pl: 'Zakres / Obszar Biznesowy' },
    scopePlaceholder: {
      en: 'e.g., Existing products for SMB customers',
      pl: 'np. Obecne produkty dla klientów SMB',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'portfolio-priority': {
    title: { en: 'Portfolio Context', pl: 'Kontekst Portfolio' },
    goalLabel: { en: 'Portfolio Goal', pl: 'Cel Portfolio' },
    goalPlaceholder: {
      en: 'e.g., Balance growth and cash generation',
      pl: 'np. Balans wzrostu i generowania gotówki',
    },
    scopeLabel: { en: 'Portfolio Scope', pl: 'Zakres Portfolio' },
    scopePlaceholder: {
      en: 'e.g., Strategic initiatives for 2026',
      pl: 'np. Inicjatywy strategiczne na 2026',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'risk-uncertainty': {
    title: { en: 'Risk Context', pl: 'Kontekst Ryzyka' },
    goalLabel: { en: 'Risk Scope', pl: 'Zakres Ryzyk' },
    goalPlaceholder: {
      en: 'e.g., Transformation program risks',
      pl: 'np. Ryzyka programu transformacji',
    },
    scopeLabel: { en: 'Business Scope', pl: 'Zakres Biznesowy' },
    scopePlaceholder: {
      en: 'e.g., Enterprise transformation',
      pl: 'np. Transformacja całej organizacji',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'sop-builder': {
    title: { en: 'SOP Context', pl: 'Kontekst SOP' },
    goalLabel: { en: 'Operational Goal', pl: 'Cel Operacyjny' },
    goalPlaceholder: {
      en: 'e.g., Standardize order picking process',
      pl: 'np. Standaryzacja procesu kompletacji zamówień',
    },
    scopeLabel: { en: 'Scope / Process', pl: 'Zakres / Proces' },
    scopePlaceholder: {
      en: 'e.g., Warehouse operations',
      pl: 'np. Operacje magazynowe',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'a3-problem-solving': {
    title: { en: 'Problem Context', pl: 'Kontekst Problemu' },
    goalLabel: { en: 'Problem Statement', pl: 'Opis Problemu' },
    goalPlaceholder: {
      en: 'e.g., Late deliveries exceed SLA by 12%',
      pl: 'np. Opóźnienia dostaw przekraczają SLA o 12%',
    },
    scopeLabel: { en: 'Scope / Area', pl: 'Zakres / Obszar' },
    scopePlaceholder: {
      en: 'e.g., Fulfillment operations',
      pl: 'np. Operacje realizacji zamówień',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'smed-planner': {
    title: { en: 'Changeover Context', pl: 'Kontekst Przezbrojeń' },
    goalLabel: { en: 'Changeover Goal', pl: 'Cel Przezbrojeń' },
    goalPlaceholder: {
      en: 'e.g., Reduce changeover time by 30%',
      pl: 'np. Redukcja czasu przezbrojeń o 30%',
    },
    scopeLabel: { en: 'Scope / Line', pl: 'Zakres / Linia' },
    scopePlaceholder: {
      en: 'e.g., Packaging line 2',
      pl: 'np. Linia pakowania 2',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'dms-builder': {
    title: { en: 'DMS Context', pl: 'Kontekst DMS' },
    goalLabel: { en: 'DMS Goal', pl: 'Cel DMS' },
    goalPlaceholder: {
      en: 'e.g., Improve daily KPI tracking',
      pl: 'np. Usprawnienie codziennego monitoringu KPI',
    },
    scopeLabel: { en: 'Scope / Teams', pl: 'Zakres / Zespoły' },
    scopePlaceholder: {
      en: 'e.g., Production + Maintenance',
      pl: 'np. Produkcja + Utrzymanie ruchu',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
  'inventory-autopilot': {
    title: { en: 'Inventory Context', pl: 'Kontekst Zapasów' },
    goalLabel: { en: 'Inventory Goal', pl: 'Cel Zapasów' },
    goalPlaceholder: {
      en: 'e.g., Reduce stockouts below 2%',
      pl: 'np. Redukcja braków poniżej 2%',
    },
    scopeLabel: { en: 'Scope / SKUs', pl: 'Zakres / SKU' },
    scopePlaceholder: {
      en: 'e.g., Top 500 SKUs',
      pl: 'np. Top 500 SKU',
    },
    timeframeLabel: { en: 'Time Horizon', pl: 'Horyzont Czasowy' },
  },
};

// ==================== COMPONENT ====================

export const ContextStep: React.FC<ContextStepProps> = ({ toolType, session, isPolish }) => {
  const { updateInputData } = useToolStore();

  const labels = LABELS[toolType as keyof typeof LABELS] || LABELS['dynamic-swot'];
  const lang = isPolish ? 'pl' : 'en';

  // Get current context data
  const contextData = (
    session.inputData as
      | SWOTData
      | PorterData
      | GrowthPathsData
      | PortfolioPriorityData
      | RiskUncertaintyData
      | OperationalToolData
  ).context;

  // Handle input changes
  const handleChange = (field: string, value: string) => {
    updateInputData({
      context: {
        ...contextData,
        [field]: value,
      },
    } as Partial<SWOTData | PorterData>);
  };

  // Handle timeframe change (SWOT)
  const handleTimeframeChange = (value: 'short' | 'medium' | 'long') => {
    updateInputData({
      context: {
        ...contextData,
        timeframe: value,
      },
    } as Partial<
      SWOTData | GrowthPathsData | PortfolioPriorityData | RiskUncertaintyData | OperationalToolData
    >);
  };

  // Handle position change (Porter)
  const handlePositionChange = (value: 'leader' | 'challenger' | 'follower' | 'niche') => {
    updateInputData({
      context: {
        ...contextData,
        position: value,
      },
    } as Partial<PorterData>);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
          <Target className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {labels.title[lang]}
        </h2>
      </div>

      {/* Goal / Industry */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {labels.goalLabel[lang]} *
        </label>
        <textarea
          value={(contextData as any).goal || (contextData as any).industry || ''}
          onChange={(e) =>
            handleChange(toolType === 'market-forces' ? 'industry' : 'goal', e.target.value)
          }
          placeholder={labels.goalPlaceholder[lang]}
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
        <InlineAssist
          hint={
            isPolish
              ? 'Dodaj konkretne KPI lub oczekiwany wynik.'
              : 'Add concrete KPIs or expected outcome.'
          }
        />
      </div>

      {/* Scope / Geographic */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {labels.scopeLabel[lang]} *
        </label>
        <textarea
          value={(contextData as any).scope || (contextData as any).geographicScope || ''}
          onChange={(e) =>
            handleChange(toolType === 'market-forces' ? 'geographicScope' : 'scope', e.target.value)
          }
          placeholder={labels.scopePlaceholder[lang]}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
        <InlineAssist
          hint={
            isPolish
              ? 'Wskaz obszar biznesowy i interesariuszy.'
              : 'Specify business area and stakeholders.'
          }
        />
      </div>

      {/* Timeframe (SWOT) or Position (Porter) */}
      {toolType === 'dynamic-swot' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{labels.timeframeLabel?.[lang] || 'Time Horizon'}</span>
            </div>
          </label>
          <div className="flex gap-3">
            {(['short', 'medium', 'long'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={`
                  flex-1 px-4 py-3 rounded-lg border-2 transition-colors
                  ${
                    (contextData as SWOTData['context']).timeframe === tf
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-slate-200 dark:border-navy-700 hover:border-primary-300 text-slate-600 dark:text-slate-400'
                  }
                `}
              >
                <div className="text-sm font-medium">
                  {tf === 'short'
                    ? isPolish
                      ? 'Krótki'
                      : 'Short'
                    : tf === 'medium'
                      ? isPolish
                        ? 'Średni'
                        : 'Medium'
                      : isPolish
                        ? 'Długi'
                        : 'Long'}
                </div>
                <div className="text-xs mt-1 opacity-70">
                  {tf === 'short' ? '< 1 rok' : tf === 'medium' ? '1-3 lata' : '3+ lata'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {toolType === 'market-forces' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{labels.positionLabel?.[lang] || 'Market Position'}</span>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(['leader', 'challenger', 'follower', 'niche'] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => handlePositionChange(pos)}
                className={`
                  px-4 py-3 rounded-lg border-2 transition-colors text-left
                  ${
                    (contextData as PorterData['context']).position === pos
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-slate-200 dark:border-navy-700 hover:border-primary-300 text-slate-600 dark:text-slate-400'
                  }
                `}
              >
                <div className="text-sm font-medium">
                  {pos === 'leader'
                    ? isPolish
                      ? 'Lider rynku'
                      : 'Market Leader'
                    : pos === 'challenger'
                      ? isPolish
                        ? 'Pretendent'
                        : 'Challenger'
                      : pos === 'follower'
                        ? isPolish
                          ? 'Naśladowca'
                          : 'Follower'
                        : isPolish
                          ? 'Gracz niszowy'
                          : 'Niche Player'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {isPolish
            ? '💡 Jasno zdefiniowany cel pomoże AI generować bardziej trafne sugestie w kolejnych krokach.'
            : '💡 A clearly defined goal will help AI generate more relevant suggestions in the following steps.'}
        </p>
      </div>
    </div>
  );
};

export default ContextStep;
