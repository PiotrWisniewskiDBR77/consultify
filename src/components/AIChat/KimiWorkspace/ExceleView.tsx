/**
 * ExceleView — KIMI-style spreadsheet generation workspace (P23-B).
 *
 * Split-screen: chat left ↔ sheet preview right.
 * Wired to the real V8 artifact run pipeline via useKimiArtifactPipeline.
 * Auto-triggers pipeline when user sends first message in chat.
 *
 * SSOT: FINAL_IMPLEMENTATION_PLAN_23_EXCELE_2026-03-29.md
 */

import { Copy, Link2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { TriModeChooser } from '@/components/shared/TriModeChooser';
import { Api } from '@/services/api';
import { useConversationStore } from '@/store/useConversationStore';
import { buildArtifactCode, buildArtifactPermalink, buildMyWorkSheetTableOpenPath } from '@/utils/artifactLinks';
import {
  downloadSheetArtifactXlsx,
  resolveTablePlatformWorkspaceIdForTable,
} from '@/utils/sheetArtifactOpen';
import { isTriModeEnabled } from '@/utils/triModeFlag';
import { buildWorkbookGridSheets } from '@/utils/workbookGridPreview';

import { ArtifactModuleHome } from './ArtifactModuleHome';
import { ExceleRightPanel } from './ExceleRightPanel';
import type { ArtifactPreview } from './KimiWorkspaceShell';
import { KimiWorkspaceShell, type KimiHeaderKebabItem } from './KimiWorkspaceShell';
import { useKimiArtifactPipeline } from './useKimiArtifactPipeline';

const EXCELE_SYSTEM_PROMPT = `You are a professional spreadsheet architect in Consultify.
Your role is to help users create intelligent, multi-sheet Excel workbooks for ANY domain:
financial models, project plans, risk matrices, competitive analyses, recruitment plans, budgets, dashboards, and more.

When the user describes what they need:
1. Understand the domain, data structure, and analysis goals
2. Plan the workbook structure: which sheets, what columns, what formulas link them
3. Explain your plan clearly, then trigger generation
4. The system will build a real .xlsx file with Excel formulas, professional formatting, and multiple sheets

You can create workbooks with:
- Multiple interconnected sheets (e.g. Assumptions → P&L → Balance Sheet → Cash Flow)
- Real Excel formulas (=SUM, =IF, cross-sheet references like ='Assumptions'!B3*1.05)
- Professional formatting (headers, number formats, alternating rows, freeze panes)
- Summary/totals rows, merged cells, cell comments
- Any domain: finance, HR, operations, strategy, project management

When the user provides a prompt, explain your plan briefly, then the system will generate the workbook automatically.
If the user asks to modify the workbook, suggest changes and regenerate.`;

export const ExceleView: React.FC = () => {
  const { t } = useTranslation();
  const pipeline = useKimiArtifactPipeline('excele');
  const navigate = useNavigate();
  const activeMessages = useConversationStore((s) => s.activeMessages);
  const [searchParams] = useSearchParams();
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
  const [reopenWorkbookId, setReopenWorkbookId] = useState<string | null>(null);
  const reopenLoaded = useRef(false);

  // D3 (roboty tri-tryby): jawny wybór 3 trybów na wejściu `?view=new`, tylko za
  // flagą `ff_tri_tryby`. OFF → `triMode` false → widok bajt-identyczny (od razu
  // czat/pipeline AI). 'choose' = ekran wyboru; 'ai' = przejście do czatu.
  const triMode = isTriModeEnabled();
  const [entryMode, setEntryMode] = useState<'choose' | 'ai'>('choose');
  const [creatingBlank, setCreatingBlank] = useState(false);

  // Auto-trigger from builtin template prompt
  const promptTriggered = useRef(false);
  useEffect(() => {
    if (!templatePrompt || promptTriggered.current || pipeline.currentRun || pipeline.isGenerating)
      return;
    promptTriggered.current = true;
    autoTriggered.current = true;
    void startRef.current(templatePrompt);
  }, [templatePrompt, pipeline.currentRun, pipeline.isGenerating]);

  // Auto-trigger from API template
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
          tmpl?.originSummary?.template?.description || tmpl?.title || 'Spreadsheet from template';
        void startRef.current(desc, templateArtifactId);
      })
      .catch(() => {
        void startRef.current('Create spreadsheet from template', templateArtifactId);
      });
  }, [templateArtifactId, pipeline.currentRun, pipeline.isGenerating]);

  useEffect(() => {
    if (!artifactId || reopenLoaded.current) return;
    reopenLoaded.current = true;

    Api.get(`/workbook/${artifactId}`)
      .then((wbData: any) => {
        const title = wbData?.title || wbData?.schema_json?.title || 'Spreadsheet';
        const sheets = wbData?.schema_json?.sheets || [];
        setReopenWorkbookId(artifactId);
        setReopenPreview({
          type: 'xlsx',
          title,
          fileName: `${title.replace(/\s+/g, '_')}.xlsx`,
          summary: `Workbook "${title}" — ${sheets.length || 1} sheets.`,
          kpiItems: [
            { label: 'Sheets', value: String(sheets.length || 1) },
            { label: 'Format', value: 'XLSX' },
          ],
          sheetNames: sheets.map((s: any) => s.name || 'Sheet'),
          // B3 fix (2026-07-22, workstream Excel): GET /workbook/:id already
          // returns the full schema_json (cells + formulas) — no separate
          // fetch needed here, just map it into the grid shape the shell renders.
          perSheetData: buildWorkbookGridSheets(sheets),
          workbookId: artifactId,
          downloadUrl: `/api/workbook/${artifactId}/download`,
        });
      })
      .catch(() => {
        setReopenWorkbookId(artifactId);
        setReopenPreview({
          type: 'xlsx',
          title: 'Spreadsheet',
          fileName: 'spreadsheet.xlsx',
          summary: 'Workbook loaded from library.',
          kpiItems: [],
          sheetNames: ['Sheet1'],
          workbookId: artifactId,
          downloadUrl: `/api/workbook/${artifactId}/download`,
        });
      });
  }, [artifactId]);

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
      reopenWorkbookId
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
    reopenWorkbookId,
  ]);

  const effectivePreview = pipeline.preview || reopenPreview;
  const effectiveCompleted = pipeline.isCompleted || (!!reopenPreview && !pipeline.currentRun);

  const handlePreviewFile = useCallback(() => {
    const workbookId = (pipeline.preview as any)?.workbookId || reopenWorkbookId;
    if (workbookId) {
      window.open(`/api/workbook/${workbookId}/download`, '_blank');
      return;
    }
    if (pipeline.currentRun?.materializationOrigin?.originRecordId) {
      const tableId = pipeline.currentRun.materializationOrigin.originRecordId;
      void (async () => {
        const workspaceId = await resolveTablePlatformWorkspaceIdForTable(tableId);
        if (workspaceId) {
          window.open(buildMyWorkSheetTableOpenPath(workspaceId, tableId), '_blank');
          return;
        }
        const ok = await downloadSheetArtifactXlsx(tableId);
        if (!ok) {
          toast.error('Could not open the table workspace');
        }
      })();
    }
  }, [pipeline.currentRun, pipeline.preview, reopenWorkbookId]);

  const handleAllFiles = useCallback(() => {
    window.open('/presentations?tab=sheets', '_blank');
  }, []);

  // SPEC-A powłoka (§10.2/§11.2, G1 2026-07-22): workbookId = tożsamość
  // artefaktu-arkusza dla kebaba (kod obiektu/link) i prawego panelu.
  const effectiveWorkbookId =
    (effectivePreview as any)?.workbookId || reopenWorkbookId || artifactId || null;

  const copyObjectCode = useCallback(async () => {
    if (!effectiveWorkbookId) return;
    try {
      await navigator.clipboard.writeText(buildArtifactCode('sheet', effectiveWorkbookId));
      toast.success(t('sharedComponents.nModeHeader.copyCodeSuccess', 'Copied object code'));
    } catch {
      toast.error(t('sharedComponents.artifactPermalinkButton.copyFailed', 'Could not copy'));
    }
  }, [effectiveWorkbookId, t]);

  const copyPermalink = useCallback(async () => {
    if (!effectiveWorkbookId) return;
    try {
      await navigator.clipboard.writeText(buildArtifactPermalink('sheet', effectiveWorkbookId));
      toast.success(t('sharedComponents.artifactPermalinkButton.copied', 'Link copied'));
    } catch {
      toast.error(t('sharedComponents.artifactPermalinkButton.copyFailed', 'Could not copy'));
    }
  }, [effectiveWorkbookId, t]);

  const kebabItems: KimiHeaderKebabItem[] = useMemo(
    () =>
      effectiveWorkbookId
        ? [
            {
              id: 'copy-code',
              label: t('sharedComponents.nModeHeader.copyObjectCode', 'Copy object code'),
              icon: Copy,
              onClick: () => void copyObjectCode(),
            },
            {
              id: 'copy-link',
              label: t('sharedComponents.nModeHeader.copyLink', 'Copy link'),
              icon: Link2,
              onClick: () => void copyPermalink(),
            },
          ]
        : [],
    [effectiveWorkbookId, t, copyObjectCode, copyPermalink]
  );

  // D3 tryb ①CZYSTO — pusta siatka (1 arkusz, puste komórki) utworzona BEZ
  // pipeline'u AI przez `POST /api/workbook/blank` (ten sam builder/tabela/rejestr
  // co /generate, tylko deterministyczna pusta schema). Po utworzeniu przechodzimy
  // na `?artifactId=<id>`, co uruchamia istniejącą ścieżkę reopen (GET /workbook/:id)
  // → od razu podgląd + pobranie.
  const handleCreateEmptyGrid = useCallback(async (): Promise<void> => {
    if (creatingBlank) return;
    setCreatingBlank(true);
    try {
      const res = await Api.post('/workbook/blank', { title: 'Pusty arkusz' });
      const payload = (res as { data?: { id?: string } } | null)?.data;
      const workbookId = payload?.id;
      if (workbookId) {
        navigate(`/excele?artifactId=${encodeURIComponent(workbookId)}`);
      } else {
        toast.error('Nie udało się utworzyć pustego arkusza.');
      }
    } catch {
      toast.error('Nie udało się utworzyć pustego arkusza.');
    } finally {
      setCreatingBlank(false);
    }
  }, [creatingBlank, navigate]);

  if (showHome) {
    return <ArtifactModuleHome lane="excele" />;
  }

  // D3 tri-tryby: brama wyboru na wejściu „Start new" (`?view=new`). Poprzedza
  // czat/pipeline; OFF (triMode false) → warunek fałszywy → od razu czat jak dziś.
  const showTriChooser =
    triMode &&
    entryMode === 'choose' &&
    viewParam === 'new' &&
    !artifactId &&
    !templateArtifactId &&
    !templatePrompt &&
    !pipeline.currentRun &&
    !pipeline.isGenerating &&
    !reopenWorkbookId;

  if (showTriChooser) {
    return (
      <TriModeChooser
        busy={creatingBlank}
        showTemplate
        heading="Jak chcesz zacząć arkusz?"
        subheading="Wybierz tryb — wszystkie trzy są równorzędne."
        clean={{
          title: 'Czysto',
          desc: 'Pusta siatka (1 arkusz). Wypełniasz sam, bez AI.',
        }}
        ai={{
          title: 'Z AI',
          desc: 'Opisz arkusz — AI zbuduje wielo-arkuszowy skoroszyt z formułami.',
        }}
        template={{
          title: 'Z szablonu',
          desc: 'Zacznij od gotowego szablonu arkusza.',
        }}
        onClean={handleCreateEmptyGrid}
        onAi={() => setEntryMode('ai')}
        onTemplate={() => navigate('/excele')}
      />
    );
  }

  return (
    <KimiWorkspaceShell
      lane="excele"
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
      onDownload={pipeline.handleDownload}
      onPreviewFile={handlePreviewFile}
      onAllFiles={handleAllFiles}
      onStartGeneration={pipeline.startGeneration}
      chatSystemPrompt={EXCELE_SYSTEM_PROMPT}
      kebabItems={kebabItems}
      rightPanel={
        <ExceleRightPanel
          preview={effectivePreview}
          workbookId={effectiveWorkbookId}
          taskSteps={pipeline.taskSteps}
          isGenerating={pipeline.isGenerating}
          isFailed={pipeline.isFailed}
          failureReason={pipeline.failureReason}
          onDownload={pipeline.handleDownload}
          onPreviewFile={handlePreviewFile}
          onAllFiles={handleAllFiles}
        />
      }
    />
  );
};

export default ExceleView;
