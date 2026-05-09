/**
 * TabeleView — Table Studio orchestrator.
 *
 * Mirrors the Wordy/Excele/Prezentacje KIMI workspace control flow while
 * keeping preview component ownership with Agent C.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Api } from '@/services/api';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { isMelsTabeleEnabled } from '@/utils/melsTabeleFlag';
import { downloadTabeleArtifactCsv, openTableBuilderInNewTab } from '@/utils/tabeleArtifactOpen';

import { ArtifactModuleHome } from './ArtifactModuleHome';
import type { ArtifactPreview } from './KimiWorkspaceShell';
import { KimiWorkspaceShell } from './KimiWorkspaceShell';
import { TabeleMelsView } from './tabeleShell/TabeleMelsView';
import { useTabeleRightRailPanels } from './tabeleShell/useTabeleRightRailPanels';
import { TABELE_SYSTEM_PROMPT } from './tabeleSystemPrompt';
import { useKimiArtifactPipeline } from './useKimiArtifactPipeline';

function unwrapData<T>(value: T | { data?: T }): T {
  if (value && typeof value === 'object' && 'data' in value) {
    const wrapped = value as { data?: T };
    if (wrapped.data !== undefined) return wrapped.data;
  }
  return value as T;
}

function normalizeRecords(recordsResult: any): Array<Record<string, unknown>> {
  const records = Array.isArray(recordsResult?.records)
    ? recordsResult.records
    : Array.isArray(recordsResult)
      ? recordsResult
      : [];
  return records.slice(0, 25).map((record: any) => record?.data || record || {});
}

function normalizeColumns(tableInfo: any, rows: Array<Record<string, unknown>>): string[] {
  const fields = Array.isArray(tableInfo?.fields) ? tableInfo.fields : [];
  const fromFields = fields
    .map((field: any) => String(field?.name ?? '').trim())
    .filter((name: string) => name.length > 0);
  if (fromFields.length > 0) return fromFields;

  const firstRow = rows[0] || {};
  return Object.keys(firstRow).filter((key) => !['id', 'created_at', 'updated_at'].includes(key));
}

function buildTabelePreview(
  tableId: string,
  tableInfo: any,
  recordsResult: any,
  proposalsResult: unknown,
  titleFallback: string
): ArtifactPreview {
  const fields = Array.isArray(tableInfo?.fields) ? tableInfo.fields : [];
  const rows = normalizeRecords(recordsResult);
  const columns = normalizeColumns(tableInfo, rows);
  const rowCount = Number(recordsResult?.total ?? rows.length);
  const title = String(tableInfo?.name || tableInfo?.title || titleFallback);

  const proposalByFieldId = new Map<string, string>();
  for (const proposal of Array.isArray(proposalsResult) ? proposalsResult : []) {
    const targetFieldId = (proposal as any)?.targetFieldId;
    const proposalId = (proposal as any)?.id;
    if (typeof targetFieldId === 'string' && typeof proposalId === 'string') {
      proposalByFieldId.set(targetFieldId, proposalId);
    }
  }

  const tabeleSchemaFields = fields.map((field: any) => {
    const fieldId = String(field?.id ?? field?.fieldId ?? '');
    const proposalId = proposalByFieldId.get(fieldId);
    return {
      fieldId,
      name: String(field?.name ?? ''),
      fieldType: String(field?.type ?? field?.fieldType ?? 'text'),
      governanceState: proposalId ? ('proposed' as const) : ('committed' as const),
      ...(proposalId ? { proposalId } : {}),
    };
  });

  const tabeleRelations = fields
    .filter((field: any) => (field?.type ?? field?.fieldType) === 'relation')
    .map((field: any) => ({
      fieldId: String(field?.id ?? field?.fieldId ?? ''),
      fieldName: String(field?.name ?? ''),
      targetTableId: String(field?.targetTableId ?? field?.relation?.targetTableId ?? ''),
      targetTableName: String(field?.targetTableName ?? field?.relation?.targetTableName ?? ''),
      targetCount: Number(field?.targetCount ?? 0),
    }));

  return {
    type: 'tabele',
    title,
    fileName: `${title.replace(/\s+/g, '_')}.csv`,
    summary: `Operational table "${title}" - ${rowCount} rows, ${columns.length} columns.`,
    kpiItems: [
      { label: 'Rows', value: String(rowCount) },
      { label: 'Columns', value: String(columns.length) },
      { label: 'Status', value: 'Committed' },
      { label: 'Format', value: 'Table / CSV' },
    ],
    tableId,
    tableData: { columns, rows },
    tabeleSchemaFields,
    tabeleRelations,
    tabeleRationale: {
      summary:
        tabeleRelations.length > 0
          ? 'Relations are available for explainability review.'
          : 'No relation fields detected yet.',
      bullets: [],
      citedSourceIds: [],
      proposalStatus: 'none',
    },
  };
}

async function resolveAccessibleTableId(candidateId: string): Promise<string | null> {
  const normalized = String(candidateId || '').trim();
  if (!normalized) return null;

  try {
    await TablePlatformApi.getTable(normalized);
    return normalized;
  } catch {
    let fromArtifact: string | null = null;
    try {
      const actionTargetRaw = await Api.get(
        `/artifacts/${encodeURIComponent(normalized)}/action-target`
      );
      const actionTarget = unwrapData<any>(actionTargetRaw);
      const originRuntime = String(actionTarget?.originRuntime || '')
        .trim()
        .toLowerCase();
      const originRecordId = String(actionTarget?.originRecordId || '').trim();
      if (originRuntime === 'sheet' && originRecordId) {
        fromArtifact = originRecordId;
      }
    } catch {
      fromArtifact = null;
    }
    if (!fromArtifact || fromArtifact === normalized) return null;
    try {
      await TablePlatformApi.getTable(fromArtifact);
      return fromArtifact;
    } catch {
      return null;
    }
  }
}

/**
 * Internal wrapper: composes the MELS view with right-rail AI Editor + QA
 * panels so the connector hook can render only when needed.
 */
const TabeleMelsViewWithPanels: React.FC<{
  preview: (ArtifactPreview & { type: 'tabele' }) | null;
  tableId: string | null | undefined;
  workspaceId: string | null | undefined;
  onShare: () => void;
  onRunPrimary: () => void;
}> = ({ preview, tableId, workspaceId, onShare, onRunPrimary }) => {
  const { rightRailPanels } = useTabeleRightRailPanels({
    tableId: tableId ?? null,
    workspaceId: workspaceId ?? null,
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
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const artifactId = searchParams.get('artifactId');
  const templateArtifactId = searchParams.get('templateArtifactId');
  const templatePrompt = searchParams.get('templatePrompt');
  const viewParam = searchParams.get('view');

  const showHome =
    !artifactId &&
    !templateArtifactId &&
    !templatePrompt &&
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

  useEffect(() => {
    if (!artifactId || reopenLoaded.current) return;
    reopenLoaded.current = true;

    const loadReopenPreview = async () => {
      const resolvedTableId = await resolveAccessibleTableId(artifactId);
      if (!resolvedTableId) {
        setReopenTableId(artifactId);
        setReopenPreview({
          type: 'tabele',
          title: t('tabele.defaultTitle', 'Operational table'),
          fileName: 'table.csv',
          summary: t('tabele.loadPreviewFailed', 'Could not load table preview.'),
          kpiItems: [],
          tableId: artifactId,
          tableData: { columns: [], rows: [] },
          tabeleSchemaFields: [],
          tabeleRelations: [],
        });
        return;
      }

      const workspaceIdForProposals = currentOrganization?.id || currentProjectId || '';
      try {
        const [tableInfoRaw, recordsResult, proposalsResult] = await Promise.all([
          TablePlatformApi.getTable(resolvedTableId),
          TablePlatformApi.listRecords(resolvedTableId, { pageSize: 25 }).catch(() => null),
          workspaceIdForProposals
            ? TablePlatformApi.listSchemaProposals(workspaceIdForProposals, 'pending').catch(
                () => []
              )
            : Promise.resolve([]),
        ]);
        const tableInfo = unwrapData<any>(tableInfoRaw);
        setReopenTableId(resolvedTableId);
        setReopenPreview(
          buildTabelePreview(
            resolvedTableId,
            tableInfo,
            recordsResult,
            proposalsResult,
            t('tabele.defaultTitle', 'Operational table')
          )
        );
      } catch {
        setReopenTableId(resolvedTableId);
        setReopenPreview({
          type: 'tabele',
          title: t('tabele.defaultTitle', 'Operational table'),
          fileName: 'table.csv',
          summary: t('tabele.loadPreviewFailed', 'Could not load table preview.'),
          kpiItems: [],
          tableId: resolvedTableId,
          tableData: { columns: [], rows: [] },
          tabeleSchemaFields: [],
          tabeleRelations: [],
        });
      }
    };

    void loadReopenPreview();
  }, [artifactId, currentOrganization?.id, currentProjectId, t]);

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
          await openTableBuilderInNewTab(effectiveTableId, t);
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
    t,
    workspaceIdForIntents,
  ]);

  const handlePreviewFile = useCallback(() => {
    if (effectiveTableId) {
      void openTableBuilderInNewTab(effectiveTableId, t);
    }
  }, [effectiveTableId, t]);

  const handleAllFiles = useCallback(() => {
    window.open('/presentations?tab=sheets', '_blank');
  }, []);

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
