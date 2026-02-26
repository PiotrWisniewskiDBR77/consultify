/**
 * ToolWizardView — V3-E03 bridge
 *
 * Wraps the ToolWizardShell with session loading/saving from the API.
 * Used as the primary runtime for non-licensed consulting tools.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';

import {
  createEmptyWizardSession,
  getToolWizardConfig,
  ToolWizardShell,
} from '../shared/ToolWizard';
import type { OutputType, WizardSessionData, WizardStepId } from '../shared/ToolWizard/types';
import type { ProcessStep } from './ProcessAutomation';
import { ProcessMapWorkSurface } from './ProcessAutomation';

interface ToolWizardViewProps {
  toolType: string;
  sessionId: string;
  onBack: () => void;
  onOpenInitiative?: (initiativeId: string) => void;
}

export const ToolWizardView: React.FC<ToolWizardViewProps> = ({
  toolType,
  sessionId,
  onBack,
  onOpenInitiative,
}) => {
  const { t } = useTranslation();
  const { currentProjectId } = useAppStore();

  const [sessionData, setSessionData] = useState<WizardSessionData>(() =>
    createEmptyWizardSession(sessionId, toolType)
  );
  const [isLoading, setIsLoading] = useState(true);

  const config = useMemo(() => getToolWizardConfig(toolType), [toolType]);

  const renderWorkSurface = useMemo(() => {
    if (toolType !== 'process-automation') return undefined;
    return (data: WizardSessionData, onChange: (workData: unknown) => void) => {
      const workData = data.workData as { steps?: ProcessStep[] } | null | undefined;
      const steps: ProcessStep[] = Array.isArray(workData?.steps) ? workData.steps : [];
      return (
        <ProcessMapWorkSurface
          steps={steps}
          onStepsChange={(newSteps) => onChange({ steps: newSteps })}
          locked={data.locked}
        />
      );
    };
  }, [toolType]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiSession = await Api.getToolSession(sessionId);
        if (cancelled) return;

        const wizardState = apiSession.wizard_state as Partial<WizardSessionData> | undefined;

        setSessionData({
          ...createEmptyWizardSession(sessionId, toolType),
          ...wizardState,
          sessionId,
          toolType,
          status:
            apiSession.status === 'COMPLETED' || apiSession.status === 'APPROVED'
              ? 'FINALIZED'
              : apiSession.status === 'REVIEW'
                ? 'REVIEW'
                : 'DRAFT',
          locked: apiSession.status === 'COMPLETED' || apiSession.status === 'APPROVED',
          createdAt: apiSession.createdAt || apiSession.created_at || new Date().toISOString(),
          updatedAt: apiSession.updatedAt || apiSession.updated_at || new Date().toISOString(),
        });
      } catch (error) {
        console.warn('[ToolWizardView] Failed to load session:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, toolType]);

  const handleSessionUpdate = useCallback(
    (partial: Partial<WizardSessionData>) => {
      setSessionData((prev) => {
        const updated = { ...prev, ...partial, updatedAt: new Date().toISOString() };
        // Debounced save to API
        Api.updateToolSession(sessionId, {
          wizard_state: updated,
        }).catch((err) => console.warn('[ToolWizardView] Auto-save failed:', err));
        return updated;
      });
    },
    [sessionId]
  );

  const handleStepChange = useCallback(
    (step: WizardStepId) => {
      trackFunnelEvent('tools_wizard_step_completed', { toolType, step });
    },
    [toolType]
  );

  const handleFinalize = useCallback(async () => {
    try {
      await Api.updateToolSession(sessionId, { status: 'COMPLETED' });
      setSessionData((prev) => ({
        ...prev,
        status: 'FINALIZED',
        locked: true,
        currentStep: 'outputs',
      }));
      trackFunnelEvent('tools_wizard_finalized', { toolType });
      toast.success(t('tools.wizard.finalized', 'Session finalized'));
    } catch (error) {
      toast.error(t('tools.wizard.finalizeError', 'Failed to finalize session'));
    }
  }, [sessionId, toolType, t]);

  const handleCreateOutput = useCallback(
    async (type: OutputType) => {
      try {
        if (type === 'initiative') {
          const result = await Api.post('/initiatives', {
            title: `${config.toolName.en} — Initiative`,
            description: sessionData.review?.summaries?.[0] || '',
            sourceType: 'tool',
            sourceId: sessionId,
            projectId: currentProjectId,
            status: 'DRAFT',
          });
          trackFunnelEvent('tools_wizard_output_created', { toolType, outputType: type });
          toast.success(t('tools.wizard.initiativeCreated', 'Initiative created'));

          setSessionData((prev) => ({
            ...prev,
            outputs: [
              ...prev.outputs,
              {
                id: result.id,
                type: 'initiative',
                title: result.title || result.name,
                status: 'created',
                sourceType: 'tool',
                sourceId: sessionId,
                createdAt: new Date().toISOString(),
              },
            ],
          }));

          if (onOpenInitiative) {
            onOpenInitiative(result.id);
          }
        } else {
          toast.success(t('tools.wizard.outputCreated', 'Output created'));
          trackFunnelEvent('tools_wizard_output_created', { toolType, outputType: type });
        }
      } catch (error) {
        toast.error(t('tools.wizard.outputError', 'Failed to create output'));
      }
    },
    [config, sessionData, sessionId, toolType, currentProjectId, t, onOpenInitiative]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span>{t('common.loading', 'Loading...')}</span>
        </div>
      </div>
    );
  }

  return (
    <ToolWizardShell
      config={config}
      sessionData={sessionData}
      onSessionUpdate={handleSessionUpdate}
      onStepChange={handleStepChange}
      onFinalize={handleFinalize}
      onCreateOutput={handleCreateOutput}
      onBack={onBack}
      renderWorkSurface={renderWorkSurface}
      locked={sessionData.locked}
    />
  );
};
