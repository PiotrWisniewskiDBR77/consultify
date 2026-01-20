/**
 * ToolContextPanel
 * Right panel with org context, AI assist, and generated initiatives.
 */

import { BookOpen, CheckCircle2, MessageSquareText } from 'lucide-react';
import React from 'react';

import { PorterData, SWOTData, ToolSession, ToolType } from '@/store/useToolStore';

type CompletionItem = { label: string; done: boolean };

const getCompletionItems = (toolType: ToolType, session: ToolSession, isPolish: boolean) => {
  const items: CompletionItem[] = [];
  const data = session.inputData as SWOTData | PorterData;

  const label = (en: string, pl: string) => (isPolish ? pl : en);

  if (toolType === 'dynamic-swot') {
    const swot = data as SWOTData;
    items.push({
      label: label('Strategic goal defined', 'Cel strategiczny zdefiniowany'),
      done: !!swot.context.goal && !!swot.context.scope,
    });
    const quadrantLabels: Record<string, string> = {
      strengths: isPolish ? 'Mocne strony' : 'Strengths',
      weaknesses: isPolish ? 'Slabe strony' : 'Weaknesses',
      opportunities: isPolish ? 'Szanse' : 'Opportunities',
      threats: isPolish ? 'Zagrozenia' : 'Threats',
    };
    ['strengths', 'weaknesses', 'opportunities', 'threats'].forEach((q) => {
      items.push({
        label: label(`Items in ${quadrantLabels[q]}`, `Elementy: ${quadrantLabels[q]}`),
        done: swot.items.some((i) => i.quadrant === q),
      });
    });
    items.push({
      label: label('Correlations generated', 'Korelacje wygenerowane'),
      done: swot.correlations.length > 0,
    });
  } else if (toolType === 'market-forces') {
    const porter = data as PorterData;
    items.push({
      label: label('Industry defined', 'Branza zdefiniowana'),
      done: !!porter.context.industry,
    });
    items.push({
      label: label('Geographic scope defined', 'Zakres geograficzny zdefiniowany'),
      done: !!porter.context.geographicScope,
    });
    Object.values(porter.forces).forEach((force) => {
      items.push({
        label: label(`Drivers: ${force.name}`, `Czynniki: ${force.name}`),
        done: force.drivers.length > 0,
      });
    });
  }

  return items;
};

const calcConfidence = (items: CompletionItem[]) => {
  const done = items.filter((i) => i.done).length;
  if (items.length === 0) return 1;
  const ratio = done / items.length;
  if (ratio >= 0.9) return 5;
  if (ratio >= 0.7) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.3) return 2;
  return 1;
};

interface ToolContextPanelProps {
  toolType: ToolType;
  session: ToolSession;
  isPolish: boolean;
  orgName?: string | null;
  aiContent?: string;
  onOpenChat: () => void;
  onOpenInitiatives?: () => void;
  generatedInitiatives?: { id: string; title: string; status?: string }[];
}

export const ToolContextPanel: React.FC<ToolContextPanelProps> = ({
  toolType,
  session,
  isPolish,
  orgName,
  aiContent,
  onOpenChat,
  onOpenInitiatives,
  generatedInitiatives = [],
}) => {
  const completionItems = getCompletionItems(toolType, session, isPolish);
  const confidence = calcConfidence(completionItems);

  return (
    <div className="w-96 border-l border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white">
          {isPolish ? 'Kontekst i pomoc' : 'Context & Assist'}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {isPolish ? 'Organizacja' : 'Organization'}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {orgName || (isPolish ? 'Brak profilu organizacji' : 'No organization profile')}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {isPolish ? 'Completion checker' : 'Completion checker'}
              </span>
            </div>
            <span className="text-xs text-slate-500">{confidence}/5</span>
          </div>
          <div className="space-y-1">
            {completionItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                <span className={item.done ? 'text-emerald-500' : 'text-slate-300'}>●</span>
                <span className={item.done ? 'text-slate-700 dark:text-slate-300' : ''}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {isPolish ? 'AI Assist' : 'AI Assist'}
              </span>
            </div>
            <button
              onClick={onOpenChat}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              {isPolish ? 'Otworz chat' : 'Open chat'}
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {aiContent ||
              (isPolish
                ? 'Uzyj przycisku AI Sugestie, aby otrzymac podpowiedzi.'
                : 'Use AI Suggest to receive inline recommendations.')}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {isPolish ? 'Generated from this tool' : 'Generated from this tool'}
          </div>
          {onOpenInitiatives && (
            <button
              onClick={onOpenInitiatives}
              className="mb-2 text-xs text-primary-600 hover:text-primary-700"
            >
              {isPolish ? 'Otworz Initiatives' : 'Open Initiatives'}
            </button>
          )}
          {generatedInitiatives.length > 0 ? (
            <div className="space-y-2">
              {generatedInitiatives.map((initiative) => (
                <div key={initiative.id} className="text-xs text-slate-600 dark:text-slate-400">
                  {initiative.title}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {isPolish ? 'Brak wygenerowanych inicjatyw' : 'No initiatives generated yet'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolContextPanel;
