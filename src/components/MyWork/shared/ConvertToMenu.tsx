import { ArrowRight, CheckSquare, FileText, Lightbulb, Scale, Target } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import type { MyWorkDerivedSource, MyWorkSession } from '@/types/domain/traceability';

import { ConvertToDialog } from '../ConvertToDialog';

interface ConvertToMenuProps {
  sourceType: 'task' | 'decision' | 'idea' | 'notebook';
  sourceId: string;
  sourceTitle: string;
  availableTargets?: ('task' | 'decision' | 'initiative' | 'idea' | 'notebook')[];
  onConverted?: (target: string, createdId: string) => void;
  className?: string;
}

function toDerivedSource(
  sourceType: 'task' | 'decision' | 'idea' | 'notebook',
  sourceId: string,
  sourceTitle: string
): MyWorkDerivedSource {
  const type = sourceType === 'notebook' ? 'notebook' : sourceType;
  return { type, id: sourceId, title: sourceTitle };
}

const TARGET_CONFIG = {
  task: {
    icon: CheckSquare,
    label: 'Task',
    labelPl: 'Zadanie',
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20',
  },
  decision: {
    icon: Scale,
    label: 'Decision',
    labelPl: 'Decyzja',
    color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20',
  },
  initiative: {
    icon: Target,
    label: 'Initiative',
    labelPl: 'Inicjatywa',
    color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20',
  },
  idea: {
    icon: Lightbulb,
    label: 'Idea',
    labelPl: 'Pomysł',
    color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20',
  },
  notebook: {
    icon: FileText,
    label: 'Note',
    labelPl: 'Notatka',
    color: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 hover:bg-slate-500/20',
  },
} as const;

export const ConvertToMenu: React.FC<ConvertToMenuProps> = ({
  sourceType,
  sourceId,
  sourceTitle,
  availableTargets,
  onConverted,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { emitMyWorkEvent } = useAppStore();
  const [converting, setConverting] = useState<string | null>(null);

  const targets =
    availableTargets ||
    (['task', 'decision', 'initiative', 'idea', 'notebook'] as const).filter(
      (t) => t !== sourceType
    );

  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  const handleConvert = async (target: string) => {
    // V3-C03: Initiative/report/presentation require ConvertToDialog (MyWork session materialization)
    if (target === 'initiative') {
      setConvertDialogOpen(true);
      return;
    }

    setConverting(target);
    try {
      let createdId = '';

      if (target === 'task') {
        const result = await Api.createPersonalTask({
          title: sourceTitle,
          description: `Converted from ${sourceType}: ${sourceTitle}`,
          tags: [`from-${sourceType}`],
        });
        createdId = result?.id || '';
      } else if (target === 'decision') {
        try {
          const result = await Api.createDecision({
            title: sourceTitle,
            description: `Converted from ${sourceType}: ${sourceTitle}`,
            source_type: sourceType,
            source_id: sourceId,
          });
          createdId = result?.id || '';
        } catch {
          /* fallback — API may not exist yet */
        }
      } else if (target === 'idea') {
        const result = await Api.createMyIdea({
          title: sourceTitle,
          body: `From ${sourceType}: ${sourceTitle}`,
        });
        createdId = result?.id || '';
      }

      emitMyWorkEvent({
        type: 'item:converted',
        entityType: sourceType as any,
        entityId: sourceId,
        meta: { target },
      });
      toast.success(t('myWork.convertToMenu.convertedTo', 'Converted to {{target}}', { target }));
      onConverted?.(target, createdId);
    } catch (err: any) {
      toast.error(err?.message || t('myWork.convertToMenu.conversionFailed', 'Conversion failed'));
    } finally {
      setConverting(null);
    }
  };

  const handleConvertDialogConfirm = async (session: MyWorkSession, targetType: string) => {
    setConverting('initiative');
    try {
      const created = await Api.createInitiative({
        name: sourceTitle,
        description: `Converted from ${sourceType}: ${sourceTitle}`,
        source_type: 'tool',
        source_id: session.id,
      });
      const createdId = created?.id ?? '';
      trackFunnelEvent('artifact_created', {
        type: 'initiative',
        source_type: 'tool',
        has_source: true,
      });
      emitMyWorkEvent({
        type: 'item:converted',
        entityType: sourceType as any,
        entityId: sourceId,
        meta: { target: 'initiative' },
      });
      toast.success(t('myWork.convertToMenu.toastSuccess', 'Initiative created'));
      onConverted?.('initiative', createdId);
    } catch (err: any) {
      toast.error(
        err?.message ||
          t('myWork.convertToMenu.failedToCreateInitiative', 'Failed to create initiative')
      );
    } finally {
      setConverting(null);
    }
  };

  const sources: MyWorkDerivedSource[] = [toDerivedSource(sourceType, sourceId, sourceTitle)];

  return (
    <>
      <ConvertToDialog
        open={convertDialogOpen}
        onClose={() => setConvertDialogOpen(false)}
        sources={sources}
        targetType="initiative"
        onConvert={handleConvertDialogConfirm}
      />
      <div className={`flex items-center gap-1.5 ${className}`}>
        {targets.map((target) => {
          const config = TARGET_CONFIG[target as keyof typeof TARGET_CONFIG];
          if (!config) return null;
          const Icon = config.icon;
          return (
            <button
              key={target}
              onClick={() => handleConvert(target)}
              disabled={converting !== null}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${config.color} ${converting === target ? 'opacity-60' : ''}`}
            >
              <Icon size={10} />
              {isPolish ? config.labelPl : config.label}
              <ArrowRight size={8} />
            </button>
          );
        })}
      </div>
    </>
  );
};
