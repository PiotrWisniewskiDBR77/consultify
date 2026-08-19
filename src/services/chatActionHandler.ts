/**
 * Chat Action Handler (V3-B02)
 * Unified handler that dispatches all chat action types.
 */

import type { NavigateFunction } from 'react-router-dom';

import { Api } from '@/services/api';
import {
  executeChatNavigate,
  type NavigateAction,
  type TargetModule,
} from '@/services/chatNavigator';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type { ActionContext, ChatActionPayload } from '@/types/domain/chatActions';
import { getArtifactPath } from '@/utils/artifactLinks';
import { initiativeDocumentPath } from '@/utils/initiativeLinks';

import { validateActionPayload } from './chatActionRegistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export interface ActionHandlerDeps {
  navigate: NavigateFunction;
  context: ActionContext;
  /** Open Report Builder wizard (e.g. navigate with new=1) */
  onOpenReportBuilder?: (params?: {
    sourceType?: string;
    sourceId?: string;
    templateId?: string;
  }) => void;
  /** Open Presentation wizard */
  onOpenPresentationWizard?: (params?: {
    sourceType?: string;
    sourceId?: string;
    templateId?: string;
  }) => void;
  /** Open Tool Wizard with tool type and context */
  onOpenToolWizard?: (toolType: string, context?: Record<string, unknown>) => void;
  /** Open preview pane for entity */
  onOpenPreview?: (entityType: string, entityId: string) => void;
  /** Open KPI time-series drawer */
  onOpenKpiDrawer?: (kpiId: string, initiativeId?: string) => void;
}

const TARGET_MODULES: TargetModule[] = [
  'tools',
  'initiatives',
  'reports',
  'presentations',
  'results',
  'assessment',
  'interview',
  'mywork',
];

function normalizeTargetModule(value: unknown): TargetModule {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return (TARGET_MODULES as string[]).includes(normalized)
    ? (normalized as TargetModule)
    : 'mywork';
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleChatAction(
  action: ChatActionPayload,
  deps: ActionHandlerDeps
): Promise<ActionResult> {
  const validation = validateActionPayload(action);
  if (!validation.valid) {
    const msg = validation.errors.join('; ');
    trackFunnelEvent('chat_action_failed', { type: action.type, reason: msg });
    return { success: false, error: msg };
  }

  const params = action.params ?? {};

  try {
    switch (action.type) {
      case 'NAVIGATE': {
        const navAction: NavigateAction = {
          type: 'NAVIGATE',
          targetModule: normalizeTargetModule(params.targetModule),
          entityType: params.entityType as string | undefined,
          entityId: params.entityId as string | undefined,
          surface: params.surface as
            | 'list'
            | 'detail'
            | 'wizard'
            | 'builder'
            | 'dashboard'
            | undefined,
          params: params.params as Record<string, string> | undefined,
        };
        const result = executeChatNavigate(navAction, deps.navigate);
        return {
          success: result.success,
          error: result.error,
        };
      }

      case 'CREATE_TASK': {
        const title = String(params.title || '').trim();
        if (!title) {
          return { success: false, error: 'Task title is required' };
        }
        await Api.post('/tasks', {
          title,
          description: String(params.description || ''),
          priority: String(params.priority || 'medium'),
          status: 'todo',
          dueDate: params.dueDate || null,
          initiativeId: params.initiativeId || deps.context.initiativeId || null,
        });
        return { success: true };
      }

      case 'CREATE_DECISION': {
        const title = String(params.title || '').trim();
        if (!title) {
          return { success: false, error: 'Decision title is required' };
        }
        await Api.post('/decisions', {
          title,
          description: String(params.description || ''),
          priority: String(params.priority || 'medium'),
          status: 'pending',
          dueDate: params.dueDate || null,
          initiativeId: params.initiativeId || deps.context.initiativeId || null,
        });
        return { success: true };
      }

      case 'CREATE_INITIATIVE': {
        const title = String(params.title || '').trim();
        if (!title) {
          return { success: false, error: 'Initiative title is required' };
        }
        const created = (await Api.post('/initiatives', {
          title,
          description: String(params.description || ''),
          templateId: params.templateId || undefined,
          projectId: deps.context.projectId,
        })) as { id?: string; initiative?: { id?: string } } | undefined;
        // M13 flow redesign: chat-created initiative lands the user straight
        // in its DOCUMENT (canonical deep link), not in a list/staging view.
        const createdId = String(created?.id || created?.initiative?.id || '').trim();
        if (createdId) {
          deps.navigate(initiativeDocumentPath(createdId));
        }
        return { success: true, data: createdId ? { createdId } : undefined };
      }

      case 'GENERATE_REPORT': {
        if (deps.onOpenReportBuilder) {
          deps.onOpenReportBuilder({
            sourceType: params.sourceType as string | undefined,
            sourceId: params.sourceId as string | undefined,
            templateId: params.templateId as string | undefined,
          });
        } else {
          deps.navigate(
            `/reports/builder?new=1${params.sourceType ? `&sourceType=${params.sourceType}` : ''}${params.sourceId ? `&sourceId=${params.sourceId}` : ''}${params.templateId ? `&templateId=${params.templateId}` : ''}`
          );
        }
        return { success: true };
      }

      case 'GENERATE_PRESENTATION': {
        if (deps.onOpenPresentationWizard) {
          deps.onOpenPresentationWizard({
            sourceType: params.sourceType as string | undefined,
            sourceId: params.sourceId as string | undefined,
            templateId: params.templateId as string | undefined,
          });
        } else {
          deps.navigate(
            `/presentations?new=1${params.sourceType ? `&sourceType=${params.sourceType}` : ''}${params.sourceId ? `&sourceId=${params.sourceId}` : ''}`
          );
        }
        return { success: true };
      }

      case 'START_TOOL': {
        const toolType = String(params.toolType || '').trim();
        if (!toolType) {
          return { success: false, error: 'Tool type is required' };
        }
        if (deps.onOpenToolWizard) {
          deps.onOpenToolWizard(toolType, params.context as Record<string, unknown> | undefined);
        } else {
          deps.navigate(`/discovery-tools?tool=${encodeURIComponent(toolType)}`);
        }
        return { success: true };
      }

      case 'OPEN_PREVIEW': {
        const entityType = String(params.entityType || '').trim();
        const entityId = String(params.entityId || '').trim();
        if (!entityType || !entityId) {
          return { success: false, error: 'Entity type and ID are required' };
        }
        if (deps.onOpenPreview) {
          deps.onOpenPreview(entityType, entityId);
        } else {
          if (entityType === 'initiative') {
            deps.navigate(`/initiatives?open=${encodeURIComponent(entityId)}&mode=doc`);
          } else if (entityType === 'task') {
            deps.navigate(`/my-work?openTask=${encodeURIComponent(entityId)}`);
          } else if (entityType === 'decision') {
            deps.navigate(`/my-work?openDecision=${encodeURIComponent(entityId)}`);
          } else if (entityType === 'report' || entityType === 'document') {
            deps.navigate(getArtifactPath('report', entityId));
          } else if (entityType === 'presentation') {
            deps.navigate(getArtifactPath('presentation', entityId));
          } else if (entityType === 'sheet') {
            deps.navigate(getArtifactPath('sheet', entityId));
          } else if (entityType === 'artifact') {
            deps.navigate(`/presentations?tab=all&artifactId=${encodeURIComponent(entityId)}`);
          } else {
            deps.navigate(`/my-work`);
          }
        }
        return { success: true };
      }

      case 'ASSIGN_INTERVIEW': {
        const templateId = String(params.templateId || '').trim();
        const assigneeUserIds = Array.isArray(params.assigneeUserIds)
          ? (params.assigneeUserIds as string[])
          : params.assigneeUserIds
            ? [String(params.assigneeUserIds)]
            : [];
        if (!templateId || assigneeUserIds.length === 0) {
          return { success: false, error: 'Template ID and at least one assignee are required' };
        }
        const template = (await Api.get(`/interview/templates/${encodeURIComponent(templateId)}`)) as {
          hasPublishedVersion?: boolean;
          version?: number;
        };
        const templateVersion = Number(params.templateVersion || template?.version || 0);
        if (!template?.hasPublishedVersion || !Number.isInteger(templateVersion) || templateVersion < 1) {
          return { success: false, error: 'Publish this template before assigning it' };
        }
        const stableRequest = JSON.stringify({
          assigneeUserIds: [...assigneeUserIds].sort(),
          dueAt: params.dueAt || null,
          projectId: params.projectId || deps.context.projectId || null,
          templateId,
          templateVersion,
        });
        let requestHash = 2166136261;
        for (let index = 0; index < stableRequest.length; index += 1) {
          requestHash ^= stableRequest.charCodeAt(index);
          requestHash = Math.imul(requestHash, 16777619);
        }
        await Api.post('/interview/assignments', {
          templateId,
          templateVersion,
          idempotencyKey: `chat-assign-${(requestHash >>> 0).toString(16)}`,
          assigneeUserIds,
          teamLeadId: assigneeUserIds[0],
          dueAt: params.dueAt ? new Date(params.dueAt as string).toISOString() : undefined,
          projectId: params.projectId || deps.context.projectId,
        });
        return { success: true };
      }

      case 'RECORD_KPI': {
        const kpiId = String(params.kpiId || '').trim();
        if (!kpiId) {
          return { success: false, error: 'KPI ID is required' };
        }
        if (deps.onOpenKpiDrawer) {
          deps.onOpenKpiDrawer(kpiId, params.initiativeId as string | undefined);
        } else {
          deps.navigate(`/benefits?kpi=${encodeURIComponent(kpiId)}`);
        }
        return { success: true };
      }

      case 'START_ARTIFACT_REVIEW': {
        const artifactId = String(params.artifactId || '').trim();
        if (!artifactId) {
          return { success: false, error: 'Artifact ID is required' };
        }
        await Api.post(`/artifacts/${encodeURIComponent(artifactId)}/start-review`, {});
        return { success: true };
      }

      case 'CHECK_TRUST_STATE': {
        const artifactId = String(params.artifactId || '').trim();
        if (!artifactId) {
          return { success: false, error: 'Artifact ID is required' };
        }
        deps.navigate(`/presentations?tab=all&artifactId=${encodeURIComponent(artifactId)}`);
        return { success: true };
      }

      case 'USE_TEMPLATE': {
        const templateArtifactId = String(params.templateArtifactId || '').trim();
        if (!templateArtifactId) {
          return { success: false, error: 'Template artifact ID is required' };
        }
        const outputType = String(params.outputType || '').toLowerCase();
        if (outputType === 'presentation') {
          // Scalenie wejść prezentacji 2026-07-27: generacja z szablonu idzie
          // teraz przez kanoniczne wejście Teresy (/prezentacje), tak samo jak
          // "Użyj wzorca" w bibliotece (artifactNavigation.ts
          // resolveTemplateUsePath) — PrezentacjeView czyta templateArtifactId
          // i woła POST /presentations/decks/from-template (R1.1, 26.07).
          // `/presentations/wizard` jest teraz redirect-only.
          deps.navigate(
            `/prezentacje?templateArtifactId=${encodeURIComponent(templateArtifactId)}`
          );
        } else {
          deps.navigate(
            `/reports/builder?new=true&templateArtifactId=${encodeURIComponent(templateArtifactId)}`
          );
        }
        return { success: true };
      }

      case 'BROWSE_TEMPLATES': {
        const qs = new URLSearchParams({ tab: 'templates' });
        if (params.templateType) qs.set('type', String(params.templateType));
        if (params.category) qs.set('category', String(params.category));
        deps.navigate(`/presentations?${qs.toString()}`);
        return { success: true };
      }

      case 'ANALYZE_STATEMENT': {
        const packId = String(params.statementPackId || '').trim();
        if (!packId) return { success: false, error: 'Statement pack ID is required' };
        deps.navigate(`/economics/statements/${encodeURIComponent(packId)}`);
        return { success: true };
      }

      case 'REVIEW_MODEL': {
        const modelId = String(params.modelId || '').trim();
        if (!modelId) return { success: false, error: 'Model ID is required' };
        deps.navigate(`/economics/models/${encodeURIComponent(modelId)}`);
        return { success: true };
      }

      case 'CHECK_LANE_STATUS': {
        const runId = params.runId ? String(params.runId).trim() : '';
        deps.navigate(runId ? `/my-work?runId=${encodeURIComponent(runId)}` : '/my-work');
        return { success: true };
      }

      default: {
        const exhaustive: never = action.type;
        return { success: false, error: `Unhandled action type: ${exhaustive}` };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    trackFunnelEvent('chat_action_failed', { type: action.type, reason: msg });
    return { success: false, error: msg };
  }
}
