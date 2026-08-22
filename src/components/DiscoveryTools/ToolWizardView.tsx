/**
 * ToolWizardView — V3-E03 bridge
 *
 * Wraps the ToolWizardShell with session loading/saving from the API.
 * Used as the primary runtime for non-licensed consulting tools.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

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

  const [sessionData, setSessionData] = useState<WizardSessionData>(() =>
    createEmptyWizardSession(sessionId, toolType)
  );
  const [isLoading, setIsLoading] = useState(true);
  const sessionVersionRef = useRef<number | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const config = useMemo(() => getToolWizardConfig(toolType), [toolType]);
  const normalizeWizardStatus = useCallback(
    (status?: string | null): WizardSessionData['status'] => {
      const normalized = String(status || 'DRAFT')
        .trim()
        .toUpperCase();
      if (normalized === 'REVIEW') return 'REVIEW';
      if (normalized === 'IN_PROGRESS') return 'IN_PROGRESS';
      if (normalized === 'FINALIZED' || normalized === 'APPROVED' || normalized === 'GENERATED') {
        return 'FINALIZED';
      }
      return 'DRAFT';
    },
    []
  );
  const normalizeWizardMissingItems = useCallback(
    (items: WizardSessionData['review']['missingItems']) =>
      (items || []).map((item) => ({
        id: item.id,
        label: item.label?.en || item.label?.pl || item.id,
        severity: item.severity === 'required' ? 'blocker' : 'warning',
        stepId: item.stepId,
        resolved: Boolean(item.resolved),
      })),
    []
  );

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

        const baseSession = createEmptyWizardSession(sessionId, toolType);
        const wizardState = apiSession.wizardState as Partial<WizardSessionData> | undefined;
        const normalizedStatus = normalizeWizardStatus(apiSession.status);
        if (!Number.isInteger(apiSession.version)) {
          throw new Error('Tool session readback returned no version');
        }
        sessionVersionRef.current = Number(apiSession.version);

        setSessionData({
          ...baseSession,
          ...wizardState,
          sessionId,
          toolType,
          status: normalizedStatus,
          review: {
            ...baseSession.review,
            ...(wizardState?.review || {}),
            missingItems: Array.isArray(apiSession.missingItems)
              ? apiSession.missingItems
              : wizardState?.review?.missingItems || [],
          },
          locked: normalizedStatus === 'FINALIZED',
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
  }, [normalizeWizardStatus, sessionId, toolType]);

  const queueSessionSave = useCallback(
    (updated: WizardSessionData, persistedStatus: string) => {
      saveChainRef.current = saveChainRef.current
        .catch(() => undefined)
        .then(async () => {
          if (!Number.isInteger(sessionVersionRef.current)) {
            throw new Error('Tool session version unavailable');
          }
          const result = await Api.updateToolSession(sessionId, {
            wizardState: updated as unknown as Record<string, unknown>,
            missingItems: normalizeWizardMissingItems(updated.review?.missingItems || []),
            status: persistedStatus,
            expectedVersion: sessionVersionRef.current as number,
          });
          sessionVersionRef.current = Number(result.version);
        })
        .catch((err) => console.warn('[ToolWizardView] Auto-save failed:', err));
    },
    [normalizeWizardMissingItems, sessionId]
  );

  const handleSessionUpdate = useCallback(
    (partial: Partial<WizardSessionData>) => {
      setSessionData((prev) => {
        const updated = { ...prev, ...partial, updatedAt: new Date().toISOString() };
        const persistedStatus =
          updated.locked || updated.status === 'FINALIZED'
            ? 'FINALIZED'
            : updated.status === 'REVIEW'
              ? 'REVIEW'
              : 'IN_PROGRESS';
        queueSessionSave(updated, persistedStatus);
        return updated;
      });
    },
    [queueSessionSave]
  );

  const handleStepChange = useCallback(
    (step: WizardStepId) => {
      trackFunnelEvent('tools_wizard_step_completed', { toolType, step });
    },
    [toolType]
  );

  const handleFinalize = useCallback(async () => {
    const unresolvedMissingItems = (sessionData.review?.missingItems || []).filter(
      (item) => !item.resolved
    );
    if (unresolvedMissingItems.length > 0) {
      toast.error(t('tools.wizard.finalizeBlocked', 'Resolve missing items before finalizing'));
      return;
    }

    try {
      await saveChainRef.current;
      if (!Number.isInteger(sessionVersionRef.current)) {
        throw new Error('Tool session version unavailable');
      }
      const finalizedSession: WizardSessionData = {
        ...sessionData,
        status: 'FINALIZED',
        locked: true,
        currentStep: 'outputs',
        updatedAt: new Date().toISOString(),
      };
      const result = await Api.updateToolSession(sessionId, {
        status: 'FINALIZED',
        wizardState: finalizedSession as unknown as Record<string, unknown>,
        missingItems: normalizeWizardMissingItems(finalizedSession.review?.missingItems || []),
        expectedVersion: sessionVersionRef.current as number,
      });
      sessionVersionRef.current = Number(result.version);
      setSessionData(finalizedSession);
      trackFunnelEvent('tools_wizard_finalized', { toolType });
      toast.success(t('tools.wizard.finalized', 'Session finalized'));
    } catch (error) {
      toast.error(t('tools.wizard.finalizeError', 'Failed to finalize session'));
    }
  }, [normalizeWizardMissingItems, sessionData, sessionId, toolType, t]);

  const handleCreateOutput = useCallback(
    async (type: OutputType) => {
      try {
        const description =
          sessionData.review?.summaries?.[0] ||
          sessionData.define?.intent ||
          `${config.toolName.en} output created from tool session ${sessionId}.`;
        const result = await Api.promoteToolOutput(sessionId, {
          outputType: type as 'initiative' | 'report' | 'presentation' | 'idea',
          title: `${config.toolName.en} — ${type.charAt(0).toUpperCase()}${type.slice(1)}`,
          description,
        });

        trackFunnelEvent('tools_wizard_output_created', { toolType, outputType: type });
        toast.success(
          type === 'initiative'
            ? t('tools.wizard.initiativeCreated', 'Initiative created')
            : type === 'idea'
              ? t('tools.wizard.ideaCreated', 'Idea created')
              : t('tools.wizard.outputCreated', 'Output created')
        );

        setSessionData((prev) => ({
          ...prev,
          outputs: [
            ...prev.outputs,
            {
              id: result.id,
              type,
              title: result.title,
              status: 'created',
              sourceType: 'tool',
              sourceId: sessionId,
              sourceVersion: result.sourceVersion,
              createdAt: result.createdAt || new Date().toISOString(),
            },
          ],
        }));

        if (type === 'initiative' && onOpenInitiative) {
          onOpenInitiative(result.id);
        }
      } catch (error) {
        toast.error(t('tools.wizard.outputError', 'Failed to create output'));
      }
    },
    [config, sessionData, sessionId, toolType, t, onOpenInitiative]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState variant="spinner" label={t('common.loading', 'Loading...')} />
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
