/**
 * TabeleView — Table Studio orchestrator.
 *
 * Mirrors the Wordy/Excele/Prezentacje KIMI workspace control flow while
 * keeping preview component ownership with Agent C.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Api } from '@/services/api';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { isMelsTabeleEnabled } from '@/utils/melsTabeleFlag';
import { buildTableBuilderOpenPath, downloadTabeleArtifactCsv } from '@/utils/tabeleArtifactOpen';

import { ArtifactModuleHome } from './ArtifactModuleHome';
import type { ArtifactPreview } from './KimiWorkspaceShell';
import { KimiWorkspaceShell } from './KimiWorkspaceShell';
import { loadTabelePreviewByTableId, resolveAccessibleTableId } from './tabele/loadTabelePreview';
import { TabeleMelsView } from './tabeleShell/TabeleMelsView';
import { useTabeleRightRailPanels } from './tabeleShell/useTabeleRightRailPanels';
import { TABELE_SYSTEM_PROMPT } from './tabeleSystemPrompt';
import { useKimiArtifactPipeline } from './useKimiArtifactPipeline';

// Note: Tabele preview builders + accessible-table resolver live in
// `./tabele/loadTabelePreview.ts` to keep this view thin and so the
// reopen flow and the materialization pipeline share a single shape.

/**
 * Internal wrapper: composes the MELS view with right-rail AI Editor + QA
 * panels so the connector hook can render only when needed.
 *
 * The `onAfterApply` callback is forwarded to `useTabeleRightRailPanels`
 * so the parent can refresh the table preview after the AI Editor
 * applies a proposal, eliminating the "applied but canvas stale" gap.
 */
const TabeleMelsViewWithPanels: React.FC<{
  preview: (ArtifactPreview & { type: 'tabele' }) | null;
  tableId: string | null | undefined;
  workspaceId: string | null | undefined;
  onShare: () => void;
  onRunPrimary: () => void;
  onAfterApply?: () => void;
}> = ({ preview, tableId, workspaceId, onShare, onRunPrimary, onAfterApply }) => {
  const { rightRailPanels } = useTabeleRightRailPanels({
    tableId: tableId ?? null,
    workspaceId: workspaceId ?? null,
    ...(onAfterApply ? { onAfterApply } : {}),
  });
  return (
    <TabeleMelsView
      preview={preview}
      topBarHandlers={{ onShare, onRun: onRunPrimary }}
      onRunPrimary={onRunPrimary}
      rightRailPanels={rightRailPanels}
    />
  );
};

export const TabeleView: React.FC = () => {
  const pipeline = useKimiArtifactPipeline('tabele');
  const activeMessages = useConversationStore((s) => s.activeMessages);
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  // Kickoff fix (fala 1c, 2026-07-27) — see the kickoff effect below.
  const chatKickoffMessage = useAppStore((s) => s.chatKickoffMessage);
  const clearChatKickoffMessage = useAppStore((s) => s.clearChatKickoffMessage);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const artifactId = searchParams.get('artifactId');
  const templateArtifactId = searchParams.get('templateArtifactId');
  const templatePrompt = searchParams.get('templatePrompt');
  const viewParam = searchParams.get('view');
  // Kickoff fix: a pending cross-module message must not flash the "home"
  // gate before the effect below has a chance to start the pipeline.
  const hasPendingKickoff = Boolean(chatKickoffMessage && chatKickoffMessage.trim());

  const showHome =
    !artifactId &&
    !templateArtifactId &&
    !templatePrompt &&
    !hasPendingKickoff &&
    viewParam !== 'new' &&
    !pipeline.currentRun &&
    !pipeline.isGenerating;

  const advanceRef = useRef(pipeline.advancePipeline);
  advanceRef.current = pipeline.advancePipeline;
  const autoTriggered = useRef(false);
  const startRef = useRef(pipeline.startGeneration);
  startRef.current = pipeline.startGeneration;

  const [reopenPreview, setReopenPreview] = useState<ArtifactPreview | null>(null);
  const [reopenTableId, setReopenTableId] = useState<string | null>(null);
  const reopenLoaded = useRef(false);

  const promptTriggered = useRef(false);
  useEffect(() => {
    if (!templatePrompt || promptTriggered.current || pipeline.currentRun || pipeline.isGenerating)
      return;
    promptTriggered.current = true;
    autoTriggered.current = true;
    void startRef.current(templatePrompt);
  }, [templatePrompt, pipeline.currentRun, pipeline.isGenerating]);

  // Kickoff fix (fala 1c, 2026-07-27): cross-module "ask Teresa about X" flows
  // call `setChatKickoffMessage` + navigate expecting the ONE Teresa panel to
  // open with a seeded first message. `hasEmbeddedModuleChat` (MainLayout)
  // turns the global panel off on `/tabele`, and this Studio has no embedded
  // chat of its own — the message was silently dropped. Consume it the same
  // way as `templatePrompt` above (pipeline.startGeneration IS the "send
  // first message" channel here), then clear the store so it can't re-fire.
  const kickoffTriggered = useRef(false);
  useEffect(() => {
    const message = (chatKickoffMessage || '').trim();
    if (
      !message ||
      kickoffTriggered.current ||
      artifactId ||
      templateArtifactId ||
      templatePrompt ||
      pipeline.currentRun ||
      pipeline.isGenerating
    )
      return;
    kickoffTriggered.current = true;
    autoTriggered.current = true;
    void startRef.current(message);
    clearChatKickoffMessage();
  }, [
    chatKickoffMessage,
    artifactId,
    templateArtifactId,
    templatePrompt,
    pipeline.currentRun,
    pipeline.isGenerating,
    clearChatKickoffMessage,
  ]);

  const templateTriggered = useRef(false);
  useEffect(() => {
    if (
      !templateArtifactId ||
      templateTriggered.current ||
      pipeline.currentRun ||
      pipeline.isGenerating
    )
      return;
    templateTriggered.current = true;
    autoTriggered.current = true;
    Api.get(`/artifacts/${templateArtifactId}`)
      .then((tmpl: any) => {
        const desc =
          tmpl?.originSummary?.template?.description || tmpl?.title || 'Table from template';
        void startRef.current(desc, templateArtifactId);
      })
      .catch(() => {
        void startRef.current('Create operational table from template', templateArtifactId);
      });
  }, [templateArtifactId, pipeline.currentRun, pipeline.isGenerating]);

  const refreshNonceRef = useRef(0);
  const [refreshTick, setRefreshTick] = useState(0);

  const triggerPreviewRefresh = useCallback(() => {
    refreshNonceRef.current += 1;
    setRefreshTick(refreshNonceRef.current);
  }, []);

  useEffect(() => {
    if (!artifactId) return;

    let cancelled = false;
    if (!reopenLoaded.current) {
      reopenLoaded.current = true;
    }

    const loadReopenPreview = async () => {
      const resolvedTableId = await resolveAccessibleTableId(artifactId, {
        preferArtifactRegistry: true,
      });
      if (cancelled) return;

      if (!resolvedTableId) {
        setReopenTableId(null);
        setReopenPreview({
          type: 'tabele',
          title: t('tabele.defaultTitle', 'Operational table'),
          fileName: 'table.csv',
          summary: t(
            'tabele.loadPreviewFailed',
            'Could not resolve artifact-to-table mapping. Table preview unavailable.'
          ),
          kpiItems: [],
          tableData: { columns: [], rows: [] },
          tabeleSchemaFields: [],
          tabeleRelations: [],
        });
        return;
      }

      const workspaceIdForProposals = currentOrganization?.id || currentProjectId || '';
      let previewLoadError: unknown = null;
      const fullPreview = await loadTabelePreviewByTableId(resolvedTableId, {
        titleFallback: t('tabele.defaultTitle', 'Operational table'),
        ...(workspaceIdForProposals ? { workspaceIdForProposals } : {}),
      }).catch((err: unknown) => {
        previewLoadError = err;
        return null;
      });

      if (cancelled) return;

      setReopenTableId(resolvedTableId);
      if (fullPreview) {
        setReopenPreview(fullPreview);
      } else {
        const is503 =
          (previewLoadError as any)?.status === 503 ||
          (previewLoadError as any)?.statusCode === 503;
        setReopenPreview({
          type: 'tabele',
          title: t('tabele.defaultTitle', 'Operational table'),
          fileName: 'table.csv',
          summary: is503
            ? t('tabele.loadPreviewUnavailable', 'Table platform is not available in your plan.')
            : t('tabele.loadPreviewFailed', 'Could not load table preview.'),
          kpiItems: [],
          tableId: resolvedTableId,
          tableData: { columns: [], rows: [] },
          tabeleSchemaFields: [],
          tabeleRelations: [],
        });
      }
    };

    void loadReopenPreview();
    return () => {
      cancelled = true;
    };
  }, [artifactId, currentOrganization?.id, currentProjectId, t, refreshTick]);

  useEffect(() => {
    if (!pipeline.isGenerating || pipeline.isBusy) return undefined;
    const timer = setInterval(() => {
      void advanceRef.current();
    }, 3000);
    return () => clearInterval(timer);
  }, [pipeline.isGenerating, pipeline.isBusy]);

  useEffect(() => {
    if (
      autoTriggered.current ||
      templatePrompt ||
      templateArtifactId ||
      artifactId ||
      viewParam === 'new' ||
      pipeline.currentRun ||
      pipeline.isGenerating ||
      reopenTableId
    )
      return;
    const userMessages = activeMessages.filter((m) => m.role === 'user');
    const aiMessages = activeMessages.filter((m) => m.role === 'ai');
    if (userMessages.length >= 1 && aiMessages.length >= 1) {
      const lastUserMsg = userMessages[userMessages.length - 1]?.content;
      if (lastUserMsg && lastUserMsg.trim().length > 5) {
        autoTriggered.current = true;
        void startRef.current(lastUserMsg.trim());
      }
    }
  }, [
    activeMessages,
    artifactId,
    templateArtifactId,
    templatePrompt,
    viewParam,
    pipeline.currentRun,
    pipeline.isGenerating,
    reopenTableId,
  ]);

  const effectivePreview = pipeline.preview || reopenPreview;
  const effectiveTableId =
    pipeline.preview?.tableId ||
    pipeline.currentRun?.materializationOrigin?.originRecordId ||
    reopenTableId;
  const effectiveCompleted = pipeline.isCompleted || (!!reopenPreview && !pipeline.currentRun);
  const workspaceIdForIntents = currentOrganization?.id || currentProjectId || '';

  const lastRoutedMsgRef = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveCompleted || !effectiveTableId) return;
    const userMessages = activeMessages.filter((m) => m.role === 'user');
    const lastMsg = userMessages[userMessages.length - 1];
    if (!lastMsg || lastMsg.id === lastRoutedMsgRef.current) return;
    if (userMessages.length <= 1) return;

    const text = lastMsg.content.trim();
    const normalizedText = text.toLowerCase();
    lastRoutedMsgRef.current = lastMsg.id;

    const proposeSchema = async (intent: string) => {
      if (!workspaceIdForIntents) {
        toast.error(t('tabele.intentRouted.workspaceMissing', 'Workspace context is required'));
        return;
      }
      const proposal = await TablePlatformApi.proposeSchemaChange(workspaceIdForIntents, intent, {
        tableId: effectiveTableId,
      });
      toast.success(
        t('tabele.intentRouted.schemaProposalCreated', {
          defaultValue: 'Schema proposal created: {{proposalId}}',
          proposalId: proposal.id,
        })
      );
    };

    const intentHandlers: Array<{ match: RegExp; handler: () => Promise<void> }> = [
      {
        match: /export\s*csv|pobierz\s*csv|download\s*csv/,
        handler: async () => {
          const ok = await downloadTabeleArtifactCsv(effectiveTableId);
          if (!ok) throw new Error('csv_export_failed');
          toast.success(t('tabele.intentRouted.exportCsv', 'CSV export started'));
        },
      },
      {
        match: /export\s*xlsx|pobierz\s*xlsx|download\s*xlsx/,
        handler: async () => {
          window.open(
            `/api/table-platform/tables/${encodeURIComponent(effectiveTableId)}/export/xlsx`,
            '_blank'
          );
          toast.success(t('tabele.intentRouted.exportXlsx', 'XLSX export started'));
        },
      },
      {
        match: /export\s*json|pobierz\s*json|download\s*json/,
        handler: async () => {
          window.open(
            `/api/table-platform/tables/${encodeURIComponent(effectiveTableId)}/export.json`,
            '_blank'
          );
          toast.success(t('tabele.intentRouted.exportJson', 'JSON export started'));
        },
      },
      {
        match: /add\s*column|dodaj\s*kolumn/,
        handler: async () => {
          await proposeSchema(text);
        },
      },
      {
        match: /summari[sz]e|podsum/,
        handler: async () => {
          await proposeSchema('Summarize this table');
        },
      },
      {
        match: /open\s*builder|otw[oó]rz\s*builder|edytuj/,
        handler: async () => {
          const path = await buildTableBuilderOpenPath(effectiveTableId);
          if (!path) {
            toast.error(
              t('tabele.builderUnreachable', 'Could not resolve workspace for this table')
            );
            return;
          }
          toast.success(t('tabele.openingBuilder', 'Opening Table Builder...'), {
            duration: 1500,
          });
          navigate(path);
        },
      },
      {
        match: /explain\s*relation|wyja[sś]nij\s*relacj/,
        handler: async () => {
          const rows = effectivePreview?.tableData?.rows ?? [];
          const firstRecord = rows[0] as { id?: unknown; recordId?: unknown } | undefined;
          const recordId = String(firstRecord?.id ?? firstRecord?.recordId ?? '');
          if (!recordId) {
            toast.error(
              t('tabele.intentRouted.relationRecordMissing', 'No record is available to explain')
            );
            return;
          }
          const response = await TablePlatformApi.explainRelation(effectiveTableId, recordId);
          const firstReason = response.relations[0]?.reason;
          toast.success(
            firstReason || t('tabele.intentRouted.explainRelation', 'Relation rationale loaded')
          );
        },
      },
      {
        match: /propose\s*schema|zaproponuj\s*schemat/,
        handler: async () => {
          await proposeSchema(text);
        },
      },
    ];

    for (const { match, handler } of intentHandlers) {
      if (match.test(normalizedText)) {
        handler().catch(() => {
          toast.error(t('tabele.intentRouted.failed', 'Could not process that instruction'));
        });
        return;
      }
    }
  }, [
    activeMessages,
    effectiveCompleted,
    effectivePreview,
    effectiveTableId,
    navigate,
    t,
    workspaceIdForIntents,
  ]);

  const handlePreviewFile = useCallback(async () => {
    if (!effectiveTableId) return;
    const path = await buildTableBuilderOpenPath(effectiveTableId);
    if (!path) {
      toast.error(t('tabele.builderUnreachable', 'Could not resolve workspace for this table'));
      return;
    }
    toast.success(t('tabele.openingBuilder', 'Opening Table Builder...'), { duration: 1500 });
    navigate(path);
  }, [effectiveTableId, navigate, t]);

  const handleAllFiles = useCallback(() => {
    navigate('/presentations?tab=sheets');
  }, [navigate]);

  const handleDownload = useCallback(async () => {
    if (!effectiveTableId) {
      await pipeline.handleDownload();
      return;
    }
    const ok = await downloadTabeleArtifactCsv(effectiveTableId);
    if (!ok) {
      toast.error(t('tabele.intentRouted.failed', 'Could not process that instruction'));
    }
  }, [effectiveTableId, pipeline, t]);

  if (showHome) {
    return <ArtifactModuleHome lane="tabele" />;
  }

  if (isMelsTabeleEnabled()) {
    const tabelePreview =
      effectivePreview && effectivePreview.type === 'tabele'
        ? (effectivePreview as ArtifactPreview & { type: 'tabele' })
        : null;
    return (
      <TabeleMelsViewWithPanels
        preview={tabelePreview}
        tableId={effectiveTableId}
        workspaceId={workspaceIdForIntents}
        onShare={handleAllFiles}
        onRunPrimary={handlePreviewFile}
        onAfterApply={triggerPreviewRefresh}
      />
    );
  }

  return (
    <KimiWorkspaceShell
      lane="tabele"
      taskSteps={pipeline.taskSteps}
      totalSteps={pipeline.totalSteps}
      completedSteps={pipeline.completedSteps}
      isGenerating={pipeline.isGenerating}
      isCompleted={effectiveCompleted}
      isFailed={pipeline.isFailed}
      failureReason={pipeline.failureReason}
      preview={effectivePreview}
      onReplay={pipeline.handleReplay}
      onRemix={pipeline.handleRemix}
      onDownload={handleDownload}
      onPreviewFile={handlePreviewFile}
      onAllFiles={handleAllFiles}
      onStartGeneration={pipeline.startGeneration}
      chatSystemPrompt={TABELE_SYSTEM_PROMPT}
    />
  );
};

export default TabeleView;
