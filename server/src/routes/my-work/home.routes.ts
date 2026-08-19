/**
 * Home sub-router — extracted from my-work.routes.ts
 *
 * Handles /home/v2, /home/brief, /home/spark, /home/pulse, /home/nudge, /outputs.
 * Mounted under /api/my-work by the parent aggregator.
 */

import type { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getAiNews, pickTipOfDay } from '../../services/homeCoverFeedService.js';
import inboxService from '../../services/inboxService.js';
import organizationContextService from '../../services/organizationContext/OrganizationContextService.js';
import * as artifactRegistryService from '../../services/v8/artifactRegistryService.js';
import { getActiveRoomsByOrg, getRoomHealth } from '../../services/v8/collaborationRoomService.js';
import { rollupSignals } from '../../services/v8/executionVisibilityService.js';
import { getPendingDecisions } from '../../services/v8/planningContinuityService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

function resolveHomeCorrelationId(req: AuthRequest): string | null {
  return (req as any).correlationId || req.get('X-Correlation-ID') || null;
}

function buildHomeFailClosedError(
  req: AuthRequest,
  statusCode: number,
  code: string,
  message: string
) {
  return {
    status: statusCode >= 500 ? 'error' : 'fail',
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
    correlationId: resolveHomeCorrelationId(req),
  };
}

const isPostgres = process.env.DB_TYPE === 'postgres';
const nowSql = () => (isPostgres ? 'CURRENT_TIMESTAMP' : "datetime('now')");
const daysAgoSql = (days: number) =>
  isPostgres ? `CURRENT_TIMESTAMP - INTERVAL '${days} days'` : `datetime('now', '-${days} days')`;

// ─── Home-specific types & helpers ───────────────────────────────────────────

type HomeV2IndustryPreset = {
  industryLabel: string;
  marketSignalTitle: string;
  marketSignalSummary: string;
  technologySignalTitle: string;
  technologySignalSummary: string;
  benchmarkLabel: string;
  benchmarkValue: string;
  benchmarkDelta: string;
  benchmarkImplication: string;
  peerCaseTitle: string;
  peerCaseSummary: string;
  peerCaseImplication: string;
};

type HomeV2ResponsePayload = {
  timeMode: 'morning' | 'liveDay' | 'eveningWrap';
  updatedAt: string;
  pulseLabel: string;
  blocks: any[];
};

const HOME_V2_CACHE_TTL_MS = Number(process.env.HOME_V2_CACHE_TTL_MS || 15_000);
const homeV2ResponseCache = new Map<
  string,
  {
    expiresAt: number;
    payload: HomeV2ResponsePayload;
  }
>();
const homeV2Inflight = new Map<string, Promise<HomeV2ResponsePayload>>();

const DEFAULT_HOME_V2_PRESET: HomeV2IndustryPreset = {
  industryLabel: 'Transformation',
  marketSignalTitle: 'Transformation funding is moving toward cross-functional value pools',
  marketSignalSummary:
    'Leaders are backing programs that connect strategy, execution, and capability-building rather than isolated pilots.',
  technologySignalTitle:
    'AI copilots are being embedded into operating models, not launched as side tools',
  technologySignalSummary:
    'The strongest programs redesign rituals, decisions, and flows around AI assistance instead of adding another disconnected interface.',
  benchmarkLabel: 'Transformation benchmark',
  benchmarkValue: '10-15%',
  benchmarkDelta: 'value capture in 12 months',
  benchmarkImplication:
    'Programs that tie governance, workflow redesign, and AI adoption together capture value faster.',
  peerCaseTitle: 'Transformation office reframed AI as a portfolio lane',
  peerCaseSummary:
    'Instead of scattered pilots, one organization grouped initiatives into a single leadership narrative with weekly decision cadences.',
  peerCaseImplication:
    'Use the Home screen to sharpen one storyline, not to display disconnected updates.',
};

const MANUFACTURING_HOME_V2_PRESET: HomeV2IndustryPreset = {
  industryLabel: 'Manufacturing',
  marketSignalTitle: 'Energy pressure is changing transformation prioritization in manufacturing',
  marketSignalSummary:
    'Manufacturing programs are getting funded fastest when they connect planning, quality, and efficiency levers rather than isolated automation ideas.',
  technologySignalTitle:
    'Computer vision and planning copilots are moving from pilot to operating lane',
  technologySignalSummary:
    'Plants are redesigning quality triage, maintenance decisions, and production planning around AI-assisted workflows.',
  benchmarkLabel: 'Manufacturing transformation benchmark',
  benchmarkValue: '14-18%',
  benchmarkDelta: 'value uplift in 12 months',
  benchmarkImplication:
    'Programs that combine quality, planning, and governance outperform single-tool pilots.',
  peerCaseTitle: 'Tier-1 supplier shifted from AI PoC to transformation lane',
  peerCaseSummary:
    'The team stopped framing AI as a one-off experiment and created one cross-functional lane with owners, KPIs, and weekly steering decisions.',
  peerCaseImplication:
    'Your strongest opportunity likely needs the same reframing: initiative, owner, and executive storyline.',
};

function inferHomeV2TimeMode(date: Date): 'morning' | 'liveDay' | 'eveningWrap' {
  const hour = date.getHours();
  if (hour < 11) return 'morning';
  if (hour < 17) return 'liveDay';
  return 'eveningWrap';
}

function inferRoleLens(role: unknown, isPolish: boolean): string {
  const normalized = String(role || '')
    .trim()
    .toLowerCase();
  if (['owner', 'admin', 'administrator', 'superadmin', 'super_admin'].includes(normalized)) {
    return isPolish ? 'Sponsor wykonawczy' : 'Executive sponsor';
  }
  if (['manager'].includes(normalized)) {
    return isPolish ? 'Lider transformacji' : 'Transformation lead';
  }
  return isPolish ? 'Współtwórca programu' : 'Program contributor';
}

function selectHomeV2Preset(industry: string | null | undefined): HomeV2IndustryPreset {
  const normalized = String(industry || '')
    .trim()
    .toLowerCase();
  if (
    normalized.includes('manufact') ||
    normalized.includes('factory') ||
    normalized.includes('plant') ||
    normalized.includes('production') ||
    normalized.includes('automotive') ||
    normalized.includes('industrial')
  ) {
    return MANUFACTURING_HOME_V2_PRESET;
  }
  return DEFAULT_HOME_V2_PRESET;
}

function computePriorityWeight(base: number, freshness: number, extra = 0): number {
  return Math.max(40, Math.min(100, base + Math.round(freshness / 5) + extra));
}

function computeRecommendedSize(
  priorityWeight: number,
  preferred: 'sm' | 'md' | 'lg' | 'hero'
): 'sm' | 'md' | 'lg' | 'hero' {
  if (preferred === 'hero') return 'hero';
  if (priorityWeight >= 88) return 'lg';
  if (priorityWeight >= 72) return 'md';
  return preferred;
}

// ─── /home/v2 ────────────────────────────────────────────────────────────────

router.get(
  '/home/v2',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db;
    const userId = req.userId!;
    const orgId = req.organizationId!;
    const appLanguage = req.headers['x-app-language'] ?? req.headers['accept-language'];
    const langRaw = Array.isArray(appLanguage) ? appLanguage.join(',') : String(appLanguage || '');
    const isPolish = langRaw.trim().toLowerCase().startsWith('pl');
    const cacheKey = `${orgId}:${userId}:${String(req.user?.role || '')}:${isPolish ? 'pl' : 'en'}`;

    if (!db) {
      return res
        .status(503)
        .json(
          buildHomeFailClosedError(
            req,
            503,
            'MY_WORK_HOME_DATABASE_UNAVAILABLE',
            'My Work Home data is temporarily unavailable.'
          )
        );
    }

    try {
      const now = new Date();
      const signalWindowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const timeMode = inferHomeV2TimeMode(now);
      const cached = homeV2ResponseCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json(cached.payload);
      }
      const inflight = homeV2Inflight.get(cacheKey);
      if (inflight) {
        return res.json(await inflight);
      }
      const L = (en: string, pl: string) => (isPolish ? pl : en);

      const payloadPromise = (async (): Promise<HomeV2ResponsePayload> => {
        const roleLens = inferRoleLens(req.user?.role, isPolish);
        const orgContext = await organizationContextService
          .buildResolvedContext(orgId)
          .catch((err) => {
            logger.warn('[home-v2] buildResolvedContext failed, using fallback', {
              error: err?.message,
            });
            return {
              organizationId: orgId,
              schemaVersion: 1,
              snapshotUpdatedAt: null,
              counts: { items: 0, claims: 0, conflicts: 0 },
              profile: {
                companyName: null,
                description: null,
                industry: null,
                industryCode: null,
                industrySubsector: null,
                companySize: null,
                location: null,
                employeeCount: null,
                annualRevenue: null,
                website: null,
                defaultLanguage: null,
                defaultTimezone: null,
                currency: null,
                linkedinUrl: null,
                twitterUrl: null,
                customDomain: null,
                brandColor: null,
                accentColor: null,
              },
              strategic: {
                goals: [],
                priorities: [],
                mission: null,
                vision: null,
                values: [],
                competitiveAdvantage: null,
                targetMarket: null,
              },
              operations: { constraints: [], techStack: [], tools: [], processes: [], kpis: [] },
              culture: { style: null, communicationPreferences: [], decisionMaking: null },
              metadata: [],
              timeline: [],
              claims: [],
            } as any;
          });
        const preset = selectHomeV2Preset(orgContext.profile.industry);

        const safeHomeV2Query = async <T = any>(
          label: string,
          attempts: Array<{ sql: string; params: unknown[] }>
        ): Promise<T[]> => {
          for (const attempt of attempts) {
            try {
              const rows = await db.query(attempt.sql, attempt.params);
              return Array.isArray(rows) ? (rows as T[]) : [];
            } catch (err: any) {
              logger.warn(`[home-v2] ${label} query fallback`, {
                message: err?.message,
              });
            }
          }
          return [];
        };

        const [
          tasks,
          decisions,
          ideas,
          notes,
          orgIdeas,
          peerTipEvents,
          initiatives,
          aiNews,
          outputs,
          inboxStats,
          executionSignalRollup,
          activeRooms,
          pendingDecisionChains,
        ] = await Promise.all([
          safeHomeV2Query('tasks', [
            {
              sql: `SELECT id, title, description, status, priority, due_date, updated_at
                  FROM tasks
                  WHERE organization_id = ? AND assignee_id = ?
                    AND due_date IS NOT NULL
                    AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','cancelled')
                  ORDER BY due_date ASC, updated_at DESC
                  LIMIT 8`,
              params: [orgId, userId],
            },
            {
              sql: `SELECT id, title, description, status, NULL::int as priority, due_date, updated_at
                  FROM tasks
                  WHERE organization_id = ? AND assignee_id = ?
                    AND due_date IS NOT NULL
                    AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','cancelled')
                  ORDER BY due_date ASC, updated_at DESC
                  LIMIT 8`,
              params: [orgId, userId],
            },
          ]),
          safeHomeV2Query('decisions', [
            {
              sql: `SELECT id, title, status, priority, deadline, created_at
                  FROM decisions
                  WHERE organization_id = ? AND (created_by = ? OR decision_maker_id = ?)
                    AND LOWER(COALESCE(status,'')) NOT IN ('resolved','cancelled')
                  ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC, created_at DESC
                  LIMIT 6`,
              params: [orgId, userId, userId],
            },
            {
              sql: `SELECT id, title, status, NULL::int as priority, deadline, created_at
                  FROM decisions
                  WHERE organization_id = ? AND (created_by = ? OR decision_maker_id = ?)
                    AND LOWER(COALESCE(status,'')) NOT IN ('resolved','cancelled')
                  ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC, created_at DESC
                  LIMIT 6`,
              params: [orgId, userId, userId],
            },
          ]),
          safeHomeV2Query('ideas', [
            {
              sql: `SELECT i.id, i.title, i.description, i.stage, i.updated_at, COUNT(t.id) as task_count
                  FROM ideas i
                  LEFT JOIN tasks t ON t.idea_id = i.id
                  WHERE i.organization_id = ? AND i.created_by = ?
                  GROUP BY i.id, i.title, i.description, i.stage, i.updated_at
                  ORDER BY i.updated_at DESC
                  LIMIT 4`,
              params: [orgId, userId],
            },
            {
              sql: `SELECT i.id, i.title, NULL::text as description, i.stage, i.updated_at, 0::int as task_count
                  FROM ideas i
                  WHERE i.organization_id = ? AND i.created_by = ?
                  ORDER BY i.updated_at DESC
                  LIMIT 4`,
              params: [orgId, userId],
            },
          ]),
          safeHomeV2Query('notes', [
            {
              sql: `SELECT id, title, content_text as content, updated_at
                  FROM notebook_pages
                  WHERE organization_id = ? AND owner_user_id = ?
                  ORDER BY updated_at DESC
                  LIMIT 3`,
              params: [orgId, userId],
            },
            {
              sql: `SELECT id, title, NULL::text as content, updated_at
                  FROM notebook_pages
                  WHERE organization_id = ? AND owner_user_id = ?
                  ORDER BY updated_at DESC
                  LIMIT 3`,
              params: [orgId, userId],
            },
          ]),
          safeHomeV2Query('org_ideas', [
            {
              sql: `SELECT i.id, i.title, i.description, i.stage, i.updated_at, COUNT(t.id) as task_count
                  FROM ideas i
                  LEFT JOIN tasks t ON t.idea_id = i.id
                  WHERE i.organization_id = ? AND i.created_by <> ?
                  GROUP BY i.id, i.title, i.description, i.stage, i.updated_at
                  ORDER BY i.updated_at DESC
                  LIMIT 3`,
              params: [orgId, userId],
            },
            {
              sql: `SELECT i.id, i.title, NULL::text as description, i.stage, i.updated_at, 0::int as task_count
                  FROM ideas i
                  WHERE i.organization_id = ? AND i.created_by <> ?
                  ORDER BY i.updated_at DESC
                  LIMIT 3`,
              params: [orgId, userId],
            },
          ]),
          safeHomeV2Query('peer_tips', [
            {
              sql: `SELECT id, event_data, created_at
                  FROM organization_events
                  WHERE organization_id = ? AND event_type = 'peer_tip'
                  ORDER BY created_at DESC
                  LIMIT 6`,
              params: [orgId],
            },
            {
              sql: `SELECT id, event_data, created_at
                  FROM organization_events
                  WHERE organization_id = ?
                  ORDER BY created_at DESC
                  LIMIT 6`,
              params: [orgId],
            },
          ]),
          safeHomeV2Query('initiatives_upcoming', [
            {
              sql: `SELECT id, name as title, end_date as target_date, status
                  FROM initiatives
                  WHERE organization_id = ?
                    AND end_date IS NOT NULL
                    AND LOWER(COALESCE(status,'')) NOT IN ('completed','cancelled')
                  ORDER BY end_date ASC
                  LIMIT 12`,
              params: [orgId],
            },
            {
              sql: `SELECT id, name as title, end_date as target_date, status
                  FROM initiatives
                  WHERE organization_id = ?
                    AND end_date IS NOT NULL
                  ORDER BY end_date ASC
                  LIMIT 12`,
              params: [orgId],
            },
          ]),
          getAiNews(now, 6).catch(() => []),
          artifactRegistryService
            .listMyWorkArtifacts({
              organizationId: orgId,
              userId,
              roleKey: req.user?.role ? String(req.user.role) : null,
              limit: 8,
            })
            .catch((err) => {
              logger.warn('[home-v2] listMyWorkArtifacts failed, degrading gracefully', {
                error: err?.message,
              });
              return { mine: [], review: [], recent: [] };
            }),
          inboxService.getInboxStats(userId, orgId).catch(() => ({
            total: 0,
            bySection: {},
            bySlaStatus: {},
            byPriority: {},
            byStatus: {},
          })),
          rollupSignals(orgId, signalWindowStart.toISOString(), now.toISOString()).catch(() => ({
            byType: new Map<string, number>(),
            byInitiative: new Map<string, number>(),
            total: 0,
          })),
          getActiveRoomsByOrg(orgId, 12).catch(() => []),
          getPendingDecisions(orgId).catch(() => []),
        ]);

        const roomHealths = await Promise.all(
          (activeRooms || [])
            .slice(0, 6)
            .map((room) => getRoomHealth(room.roomId, orgId).catch(() => null))
        );

        const { appTip, aiPlaybookTip } = pickTipOfDay(now);

        const peerTips = (Array.isArray(peerTipEvents) ? peerTipEvents : [])
          .map((e: any) => {
            const raw = e?.event_data ?? e?.eventData ?? e?.event_json ?? e?.metadata ?? '{}';
            let data: any = {};
            try {
              data = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
            } catch {
              data = {};
            }
            const text = String(data?.text || data?.tip || '').trim();
            if (!text) return null;
            return {
              id: String(e?.id || uuidv4()),
              text,
              authorName: data?.authorName ? String(data.authorName) : undefined,
              createdAt: e?.created_at ? String(e.created_at) : now.toISOString(),
            };
          })
          .filter(Boolean)
          .slice(0, 4);

        const orgIdeasPayload = (Array.isArray(orgIdeas) ? orgIdeas : []).map((i: any) => ({
          id: String(i.id),
          type: 'idea' as const,
          title: String(i.title || ''),
          snippet: String(i.description || '').substring(0, 220),
          stage: i.stage || 'spark',
          updatedAt: String(i.updated_at || now.toISOString()),
          nodeCount: 0,
          taskCount: typeof i.task_count === 'number' ? i.task_count : 0,
        }));

        const outputFlow = (outputs?.recent || []).slice(0, 3).map((artifact: any) => ({
          id: String(artifact.originRecordId || artifact.artifactId),
          artifactId: String(artifact.artifactId),
          title: String(artifact.resolvedTitle || artifact.titleSnapshot || 'Untitled artifact'),
          outputType: String(artifact.outputType || 'report'),
          originRuntime: String(artifact.originRuntime || artifact.outputType || 'report'),
          deliveryState: String(artifact.deliveryState || 'draft'),
          visibilityScope: String(artifact.visibilityScope || 'private'),
          publishState: artifact.publishState ? String(artifact.publishState) : null,
          reviewGateCount:
            typeof artifact.reviewGateCount === 'number' ? artifact.reviewGateCount : 0,
        }));

        const executionSignalTypes = Array.from(executionSignalRollup.byType.entries()).sort(
          (left, right) => right[1] - left[1]
        );
        const topExecutionSignalType = executionSignalTypes[0]?.[0] ?? null;
        const formatExecutionSignalType = (value: string | null): string => {
          if (!value) {
            return L('no dominant pattern yet', 'brak dominujacego wzorca');
          }

          const normalized = value.replace(/_/g, ' ').trim();
          if (!normalized) {
            return L('no dominant pattern yet', 'brak dominujacego wzorca');
          }

          return normalized;
        };

        const collaborationHealth = roomHealths.filter(Boolean);
        const inboxByStatus = (inboxStats.byStatus || {}) as Record<string, number>;
        const inboxBySlaStatus = (inboxStats.bySlaStatus || {}) as Record<string, number>;
        const degradedRoomCount = collaborationHealth.filter(
          (room) => room && (room.state === 'error' || room.degradedSince)
        ).length;
        const activePresenceCount = collaborationHealth.reduce(
          (sum, room) => sum + (room?.activePresenceCount ?? 0),
          0
        );
        const inboxPendingCount = Number(inboxByStatus.pending || 0);
        const inboxAtRiskCount = Number(inboxBySlaStatus.at_risk || 0);
        const reviewSharedOutputCount = outputFlow.filter(
          (artifact) => artifact.visibilityScope === 'review_shared'
        ).length;
        const governedPendingDecisionChainCount = (pendingDecisionChains || []).length;
        const governedPendingDecisionStepCount = (pendingDecisionChains || []).reduce(
          (sum, chain) => {
            const pendingSteps = Array.isArray(chain?.decisions)
              ? chain.decisions.filter((decision) => decision?.status === 'pending').length
              : 0;
            return sum + pendingSteps;
          },
          0
        );

        const nextUpCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const todayKey = now.toISOString().slice(0, 10);
        const nextUp = [
          ...tasks
            .filter((t: any) => t?.due_date)
            .map((t: any) => ({
              source: 'task' as const,
              id: String(t.id),
              title: String(t.title || ''),
              date: String(t.due_date),
            })),
          ...decisions
            .filter((d: any) => d?.deadline)
            .map((d: any) => ({
              source: 'decision' as const,
              id: String(d.id),
              title: String(d.title || ''),
              date: String(d.deadline),
            })),
          ...(Array.isArray(initiatives) ? initiatives : [])
            .filter((i: any) => i?.target_date)
            .map((i: any) => ({
              source: 'initiative' as const,
              id: String(i.id),
              title: String(i.title || ''),
              date: String(i.target_date),
            })),
        ]
          .map((e) => {
            const dt = new Date(e.date);
            const key = Number.isFinite(dt.getTime()) ? dt.toISOString().slice(0, 10) : '';
            const urgency =
              Number.isFinite(dt.getTime()) && dt.getTime() < now.getTime()
                ? 'overdue'
                : key === todayKey
                  ? 'today'
                  : 'soon';
            return { ...e, urgency, _ts: dt.getTime() };
          })
          .filter((e) => Number.isFinite(e._ts) && e._ts <= nextUpCutoff.getTime())
          .sort((a, b) => a._ts - b._ts)
          .slice(0, 6)
          .map(({ _ts, ...e }) => e);

        const overdueTasks = tasks.filter(
          (task: any) => task.due_date && new Date(task.due_date) < now
        );
        const tasksDueSoon = tasks.slice(0, 3);
        const pendingDecisions = decisions;
        const blockedCount = overdueTasks.length + (pendingDecisions.length > 2 ? 1 : 0);
        const weekProgress = Math.round((((now.getDay() + 6) % 7) / 5) * 100);

        const focusItems = [
          tasksDueSoon[0]
            ? {
                id: String(tasksDueSoon[0].id),
                type: 'task',
                title: String(tasksDueSoon[0].title),
                meta:
                  overdueTasks.length > 0
                    ? L(
                        'Execution needs a clean next move',
                        'Wykonanie potrzebuje czystego „next move"'
                      )
                    : L('Closest execution commitment', 'Najbliższe zobowiązanie wykonawcze'),
                priority: overdueTasks.length > 0 ? 'high' : 'medium',
              }
            : null,
          pendingDecisions[0]
            ? {
                id: String(pendingDecisions[0].id),
                type: 'decision',
                title: String(pendingDecisions[0].title),
                meta: isPolish
                  ? `${pendingDecisions.length} aktywne decyzje`
                  : `${pendingDecisions.length} active decision${pendingDecisions.length === 1 ? '' : 's'}`,
                priority: 'high',
              }
            : null,
          ideas[0]
            ? {
                id: String(ideas[0].id),
                type: 'idea',
                title: String(ideas[0].title),
                meta: L(
                  'Strongest current transformation concept',
                  'Najsilniejszy obecny koncept transformacyjny'
                ),
                priority: 'medium',
              }
            : null,
        ].filter(Boolean);

        const pulseScore = Math.max(
          55,
          Math.min(
            96,
            68 +
              Math.min(ideas.length * 4, 12) +
              Math.min(notes.length * 2, 6) +
              Math.min(tasksDueSoon.length * 3, 9) -
              Math.min(pendingDecisions.length * 2, 10)
          )
        );

        const pulseHeadline =
          timeMode === 'morning'
            ? L(
                'Start the day with one move that sharpens narrative and execution.',
                'Zacznij dzień od jednego ruchu, który ostrzy narrację i wykonanie.'
              )
            : timeMode === 'liveDay'
              ? L(
                  'Protect momentum while clearing the single blocker shaping the week.',
                  'Chroń momentum i zdejmij jeden blocker, który kształtuje tydzień.'
                )
              : L(
                  'Close the loop on what moved and carry one strong storyline into tomorrow.',
                  'Domknij pętlę tego, co ruszyło, i przenieś jedną silną narrację na jutro.'
                );

        const pulseSummary =
          pendingDecisions.length > 0
            ? L(
                `The program has movement, but decision flow is still shaping pace. ${pendingDecisions.length} active decisions and ${tasksDueSoon.length} near-term actions are competing for attention.`,
                `Program ma ruch, ale tempo nadal kształtuje przepływ decyzji. ${pendingDecisions.length} aktywnych decyzji i ${tasksDueSoon.length} działań na teraz konkuruje o uwagę.`
              )
            : L(
                `Execution is moving without major friction. This is the right moment to convert the strongest idea into a more formal transformation lane.`,
                `Wykonanie idzie bez większego tarcia. To dobry moment, żeby zamienić najsilniejszy pomysł w bardziej formalny „pas transformacji".`
              );

        const isManufacturingPreset = preset.industryLabel === 'Manufacturing';
        const presetPl: HomeV2IndustryPreset = isManufacturingPreset
          ? {
              industryLabel: 'Produkcja',
              marketSignalTitle:
                'Presja kosztów energii zmienia priorytety transformacji w produkcji',
              marketSignalSummary:
                'Programy dostają finansowanie najszybciej, gdy łączą planowanie, jakość i efektywność zamiast izolowanych pomysłów automatyzacji.',
              technologySignalTitle:
                'Wizja komputerowa i copiloci planistyczni przechodzą z pilota do "pasa operacyjnego"',
              technologySignalSummary:
                'Zakłady przeprojektowują triage jakości, decyzje utrzymania i planowanie produkcji pod AI‑asystowane workflowy.',
              benchmarkLabel: 'Benchmark transformacji (produkcja)',
              benchmarkValue: '14-18%',
              benchmarkDelta: 'wzrost wartości w 12 miesięcy',
              benchmarkImplication:
                'Programy, które łączą jakość, planowanie i governance, wypadają lepiej niż pilotaże pojedynczych narzędzi.',
              peerCaseTitle: 'Dostawca Tier‑1 przeszedł od PoC AI do pasa transformacji',
              peerCaseSummary:
                'Zespół przestał traktować AI jak jednorazowy eksperyment i zbudował jeden cross‑functional lane z ownerami, KPI i tygodniowym steeringiem.',
              peerCaseImplication:
                'Twoja najsilniejsza szansa prawdopodobnie potrzebuje tego samego reframingu: inicjatywa, owner i "executive storyline".',
            }
          : {
              industryLabel: 'Transformacja',
              marketSignalTitle:
                'Finansowanie transformacji przesuwa się w stronę cross‑functional "value pools"',
              marketSignalSummary:
                'Liderzy wspierają programy, które łączą strategię, wykonanie i budowanie kompetencji, zamiast izolowanych pilotów.',
              technologySignalTitle:
                'Copiloci AI są wbudowywani w model operacyjny, a nie uruchamiani jako narzędzia "obok"',
              technologySignalSummary:
                'Najmocniejsze programy przeprojektowują rytuały, decyzje i przepływy wokół AI‑asysty, zamiast dokładać kolejny odłączony interfejs.',
              benchmarkLabel: 'Benchmark transformacji',
              benchmarkValue: '10-15%',
              benchmarkDelta: 'pozyskanie wartości w 12 miesięcy',
              benchmarkImplication:
                'Programy, które spinają governance, redesign workflow i adopcję AI, szybciej materializują wartość.',
              peerCaseTitle: 'Biuro transformacji przeformułowało AI jako "pas portfelowy"',
              peerCaseSummary:
                'Zamiast rozproszonych pilotów organizacja pogrupowała inicjatywy w jedną narrację przywódczą z tygodniowym rytmem decyzji.',
              peerCaseImplication:
                'Użyj Home do ostrzenia jednej narracji, a nie do pokazywania odłączonych update\u2019ów.',
            };

        const p = isPolish ? presetPl : preset;
        const industry = orgContext.profile.industry || p.industryLabel;
        const priorities = (orgContext.strategic.priorities || []).slice(0, 2).join(', ');
        const constraints = (orgContext.operations.constraints || []).slice(0, 2).join(', ');

        const momentumFreshness = ideas.length > 0 ? 76 : 58;
        const sparkFreshness = Math.min(95, 65 + ideas.length * 6 + notes.length * 4);
        const decisionFreshness = pendingDecisions.length > 0 ? 82 : 55;
        const industryFreshness = 74;

        const aiPulsePriority = computePriorityWeight(88, 84, pendingDecisions.length > 0 ? 4 : 0);
        const momentumPriority = computePriorityWeight(
          72,
          momentumFreshness,
          ideas.length > 1 ? 4 : 0
        );
        const sparkPriority = computePriorityWeight(78, sparkFreshness, ideas.length > 0 ? 4 : 0);
        const decisionPriority = computePriorityWeight(74, decisionFreshness, blockedCount * 2);
        const industryPriority = computePriorityWeight(70, industryFreshness, priorities ? 3 : 0);
        const executionPriority = computePriorityWeight(68, 62, tasksDueSoon.length > 0 ? 4 : 0);
        const teamPriority = computePriorityWeight(64, 58, blockedCount > 1 ? 4 : 0);

        const blocks = [
          {
            id: 'aiPulseCore',
            title: L('AI Pulse Core', 'AI Pulse Core'),
            subtitle: L(
              'Your highest-signal transformation readout',
              'Najbardziej "wysokosygnałowy" odczyt transformacji'
            ),
            accent: 'ai',
            size: 'hero',
            priorityWeight: aiPulsePriority,
            relevanceScore: 96,
            freshnessScore: 84,
            ctaIntents: [
              'prioritize_transformation',
              'challenge_storyline',
              'summarize_for_leadership',
            ],
            payload: {
              greeting: isPolish
                ? `Dzień dobry${req.user?.firstName ? `, ${req.user.firstName}` : ''}`
                : `Good ${timeMode === 'morning' ? 'morning' : timeMode === 'liveDay' ? 'day' : 'evening'}${req.user?.firstName ? `, ${req.user.firstName}` : ''}`,
              headline: pulseHeadline,
              summary: pulseSummary,
              insight: priorities
                ? L(
                    `The strongest storyline today sits at the intersection of ${priorities}. Use Home to keep the narrative transformational, not operational.`,
                    `Najsilniejsza narracja na dziś leży na styku: ${priorities}. Użyj Home, żeby trzymać narrację transformacyjną (nie operacyjną).`
                  )
                : L(
                    `The strongest storyline today is to connect ideas, decisions, and execution into one transformation lane with clear ownership.`,
                    `Najsilniejsza narracja na dziś: połącz pomysły, decyzje i wykonanie w jeden „pas transformacji" z jasnym ownerem.`
                  ),
              weekProgress,
              pulseScore,
              focusItems,
              appTipOfDay: appTip,
              aiPlaybookTip,
            },
          },
          {
            id: 'momentum',
            title: L('Momentum', 'Momentum'),
            subtitle: L(
              'Where the program is gaining or losing speed',
              'Gdzie program przyspiesza, a gdzie traci prędkość'
            ),
            accent: 'success',
            size: computeRecommendedSize(momentumPriority, 'md'),
            priorityWeight: momentumPriority,
            relevanceScore: 88,
            freshnessScore: momentumFreshness,
            ctaIntents: ['summarize_momentum', 'prioritize'],
            payload: {
              headline:
                governedPendingDecisionChainCount > 0
                  ? L(
                      'Governed decision chains are setting the pace.',
                      'Governed decision chains nadają dziś tempo.'
                    )
                  : executionSignalRollup.total > 0
                    ? L(
                        'Governed execution is carrying the week.',
                        'Governed execution niesie ten tydzień.'
                      )
                    : inboxPendingCount > 0
                      ? L(
                          'Follow-through is waiting in the inbox.',
                          'Follow-through czeka teraz w inboxie.'
                        )
                      : L(
                          'Governed momentum is stable but still light.',
                          'Governed momentum jest stabilny, ale wciąż lekkie.'
                        ),
              summary:
                governedPendingDecisionChainCount > 0
                  ? isPolish
                    ? `${governedPendingDecisionChainCount} governed chainów i ${governedPendingDecisionStepCount} oczekujących kroków nadal spowalnia przejście od execution do decyzji.`
                    : `${governedPendingDecisionChainCount} governed chains and ${governedPendingDecisionStepCount} pending decision steps are still slowing the move from execution into closure.`
                  : executionSignalRollup.total > 0
                    ? isPolish
                      ? `${executionSignalRollup.total} sygnałów execution z ostatnich 7 dni wskazuje, że program ma realny ruch operacyjny, a nie tylko deklaratywny status.`
                      : `${executionSignalRollup.total} execution signals from the last 7 days show that the program has real operational movement, not just narrative status.`
                    : inboxPendingCount > 0
                      ? isPolish
                        ? `${inboxPendingCount} pozycji pending w inboxie i ${inboxAtRiskCount} zagrożonych SLA pokazuje, gdzie follow-through może osłabić momentum bez kolejnych decyzji.`
                        : `${inboxPendingCount} pending inbox items and ${inboxAtRiskCount} at-risk SLA items show where follow-through can weaken momentum even without new decisions.`
                      : L(
                          'The governed rails are quiet right now, so the next lift should come from shaping a stronger lane rather than clearing operational drag.',
                          'Governed rails są teraz spokojne, więc kolejny lift powinien wynikać z lepszego ukształtowania lane, a nie z usuwania operacyjnego tarcia.'
                        ),
              stats: [
                {
                  label: L('Execution signals', 'Sygnały execution'),
                  value: String(executionSignalRollup.total),
                  trend:
                    executionSignalRollup.total > 0
                      ? formatExecutionSignalType(topExecutionSignalType)
                      : L('quiet window', 'spokojne okno'),
                },
                {
                  label: L('Decision chains', 'Decision chains'),
                  value: String(governedPendingDecisionChainCount),
                  trend:
                    governedPendingDecisionChainCount > 0
                      ? isPolish
                        ? `${governedPendingDecisionStepCount} kroków pending`
                        : `${governedPendingDecisionStepCount} pending steps`
                      : L('currently clear', 'obecnie czyste'),
                },
                {
                  label: L('Inbox pending', 'Inbox pending'),
                  value: String(inboxPendingCount),
                  trend:
                    inboxAtRiskCount > 0
                      ? isPolish
                        ? `${inboxAtRiskCount} SLA zagrożone`
                        : `${inboxAtRiskCount} SLA at risk`
                      : L('under control', 'pod kontrolą'),
                },
              ],
              signals: [
                {
                  id: 'momentum-1',
                  title:
                    executionSignalRollup.total > 0
                      ? L(
                          'Governed execution is producing real movement',
                          'Governed execution generuje realny ruch'
                        )
                      : L(
                          'The execution lane is currently quiet',
                          'Lane wykonawczy jest teraz spokojny'
                        ),
                  summary:
                    executionSignalRollup.total > 0
                      ? isPolish
                        ? `${executionSignalRollup.total} sygnałów execution z ostatnich 7 dni pokazuje, że program ma aktywny governed heartbeat; top pattern: ${formatExecutionSignalType(topExecutionSignalType)}.`
                        : `${executionSignalRollup.total} execution signals in the last 7 days show that the program has an active governed heartbeat; top pattern: ${formatExecutionSignalType(topExecutionSignalType)}.`
                      : L(
                          'The execution signal rail is quiet right now, so momentum depends more on shaping and commitment than on active delivery pull.',
                          'Rail execution signals jest teraz cichy, więc momentum zależy bardziej od kształtowania i commitmentu niż od aktywnego delivery pull.'
                        ),
                  tag: 'Execution rail',
                  tone: executionSignalRollup.total > 0 ? 'positive' : 'neutral',
                },
                {
                  id: 'momentum-2',
                  title:
                    governedPendingDecisionChainCount > 0
                      ? L(
                          'Decision chains are still constraining throughput',
                          'Decision chains nadal ograniczają throughput'
                        )
                      : L(
                          'Decision throughput is currently clean',
                          'Decision throughput jest obecnie czysty'
                        ),
                  summary:
                    governedPendingDecisionChainCount > 0
                      ? isPolish
                        ? `${governedPendingDecisionChainCount} chainów i ${governedPendingDecisionStepCount} kroków pending nadal czeka na domknięcie w planning spine.`
                        : `${governedPendingDecisionChainCount} chains and ${governedPendingDecisionStepCount} pending steps are still waiting for closure in the planning spine.`
                      : L(
                          'The planning spine is not currently reporting governed pending chains, which creates space to convert movement into commitment.',
                          'Planning spine nie raportuje teraz governed pending chains, co daje przestrzeń, by zamienić ruch w commitment.'
                        ),
                  tag: 'Planning spine',
                  tone: governedPendingDecisionChainCount > 0 ? 'warning' : 'neutral',
                },
                {
                  id: 'momentum-3',
                  title:
                    inboxPendingCount > 0 || reviewSharedOutputCount > 0
                      ? L(
                          'Follow-through is accumulating in governed queues',
                          'Follow-through kumuluje się w governed queues'
                        )
                      : L(
                          'Follow-through pressure is currently light',
                          'Presja follow-through jest obecnie lekka'
                        ),
                  summary:
                    inboxPendingCount > 0 || reviewSharedOutputCount > 0
                      ? isPolish
                        ? `${inboxPendingCount} pozycji inbox pending i ${reviewSharedOutputCount} outputów review_shared pokazuje, gdzie ruch wymaga domknięcia, a nie kolejnych nowych startów.`
                        : `${inboxPendingCount} pending inbox items and ${reviewSharedOutputCount} review-shared outputs show where movement needs closure rather than additional fresh starts.`
                      : L(
                          'There is little governed queue pressure right now, so momentum can be directed toward shaping the strongest next lane.',
                          'Presja na governed queues jest teraz mała, więc momentum można skierować na kształtowanie najmocniejszego kolejnego lane.'
                        ),
                  tag: 'Follow-through',
                  tone:
                    inboxPendingCount > 0 || reviewSharedOutputCount > 0 ? 'warning' : 'neutral',
                },
              ],
            },
          },
          {
            id: 'sparkField',
            title: L('Spark Field', 'Spark Field'),
            subtitle: L(
              'Ideas and notes with transformation gravity',
              'Pomysły i notatki z "grawitacją transformacji"'
            ),
            accent: 'warm',
            size: computeRecommendedSize(sparkPriority, 'lg'),
            priorityWeight: sparkPriority,
            relevanceScore: 92,
            freshnessScore: sparkFreshness,
            ctaIntents: ['expand_idea', 'convert_to_initiative', 'challenge_assumptions'],
            payload: {
              ideas: ideas.map((idea: any) => ({
                id: String(idea.id),
                type: 'idea',
                title: String(idea.title),
                snippet: String(idea.description || '').slice(0, 220),
                stage: String(idea.stage || 'spark'),
                updatedAt: String(idea.updated_at || ''),
                nodeCount: null,
                taskCount: Number(idea.task_count || 0),
              })),
              notes: notes.map((note: any) => ({
                id: String(note.id),
                type: 'note',
                title: String(note.title),
                snippet: String(note.content || '')
                  .replace(/<[^>]*>/g, '')
                  .slice(0, 220),
                updatedAt: String(note.updated_at || ''),
              })),
              orgIdeas: orgIdeasPayload,
              runtimeSummary: {
                ideasWithTasks: ideas.filter((idea: any) => Number(idea.task_count || 0) > 0)
                  .length,
                recentNotes: notes.length,
                recentOutputs: outputFlow.length,
                orgSignals: orgIdeasPayload.length,
              },
              nudge:
                ideas[0] && Number(ideas[0].task_count || 0) === 0
                  ? {
                      text: L(
                        `The idea "${ideas[0].title}" still has no formal execution lane. This is the cleanest available unlock.`,
                        `Pomysł "${ideas[0].title}" nadal nie ma formalnego pasa wykonania. To najczystszy możliwy unlock.`
                      ),
                      ideaId: String(ideas[0].id),
                    }
                  : null,
            },
          },
          {
            id: 'decisionTemperature',
            title: L('Decision Temperature', 'Decision Temperature'),
            subtitle: L(
              'Where approvals and blockers are heating up',
              'Gdzie approvals i blockery się podgrzewają'
            ),
            accent: 'alert',
            size: computeRecommendedSize(decisionPriority, 'md'),
            priorityWeight: decisionPriority,
            relevanceScore: 87,
            freshnessScore: decisionFreshness,
            ctaIntents: ['unblock_decision', 'draft_decision', 'analyze_tradeoffs'],
            payload: {
              pendingCount: pendingDecisions.length,
              blockedCount,
              hottestDecision: pendingDecisions[0]
                ? {
                    id: String(pendingDecisions[0].id),
                    title: String(pendingDecisions[0].title),
                    ownerLabel: roleLens,
                    priority: String(pendingDecisions[0].priority || 'high'),
                    deadlineLabel: pendingDecisions[0].deadline
                      ? isPolish
                        ? `Docelowe domknięcie: ${String(pendingDecisions[0].deadline)}`
                        : `Target close: ${String(pendingDecisions[0].deadline)}`
                      : L('Needs closure this week', 'Wymaga domknięcia w tym tygodniu'),
                  }
                : null,
              signals: [
                {
                  id: 'decision-heat-governed-chain',
                  title:
                    governedPendingDecisionChainCount > 0
                      ? L(
                          'Governed decision chains are still open in the planning spine',
                          'W planning spine nadal sa otwarte governed decision chains'
                        )
                      : L(
                          'Governed decision chains are currently clear',
                          'Governed decision chains sa obecnie czyste'
                        ),
                  summary:
                    governedPendingDecisionChainCount > 0
                      ? isPolish
                        ? `${governedPendingDecisionChainCount} aktywnych chainow i ${governedPendingDecisionStepCount} oczekujacych krokow decyzyjnych nadal czeka na domkniecie.`
                        : `${governedPendingDecisionChainCount} active chains and ${governedPendingDecisionStepCount} pending decision steps are still waiting for closure.`
                      : L(
                          'The governed planning spine does not currently report any pending decision chains for this organization.',
                          'Governed planning spine nie raportuje obecnie zadnych oczekujacych decision chains dla tej organizacji.'
                        ),
                  tag: 'Governed planning',
                  tone: governedPendingDecisionChainCount > 0 ? 'warning' : 'neutral',
                },
                {
                  id: 'decision-heat-1',
                  title:
                    pendingDecisions.length > 0
                      ? L(
                          'Decision drag is now visible at Home level',
                          'Drag decyzyjny jest już widoczny na poziomie Home'
                        )
                      : L(
                          'No high-temperature decision detected',
                          'Brak decyzji "wysokotemperaturowej"'
                        ),
                  summary:
                    pendingDecisions.length > 0
                      ? L(
                          'The right move is not another update. It is a tighter decision frame and a clearer owner path.',
                          'Właściwym ruchem nie jest kolejny update. To ciaśniejsza rama decyzji i jaśniejsza ścieżka ownera.'
                        )
                      : L(
                          'Decision flow is currently calm, which creates space for stronger shaping work.',
                          'Przepływ decyzji jest teraz spokojny, co tworzy przestrzeń na mocniejszy shaping.'
                        ),
                  tag: 'Governance',
                  tone: pendingDecisions.length > 0 ? 'warning' : 'neutral',
                },
                {
                  id: 'decision-heat-2',
                  title:
                    blockedCount > 1
                      ? L(
                          'Execution and approvals are colliding',
                          'Wykonanie i approvals się zderzają'
                        )
                      : L('Governance is manageable', 'Governance jest do udźwignięcia'),
                  summary:
                    blockedCount > 1
                      ? L(
                          'A blocked work item is now amplifying decision pressure. This is a sequencing problem, not just a backlog problem.',
                          'Zablokowany element pracy wzmacnia presję decyzyjną. To problem sekwencjonowania, nie tylko backlogu.'
                        )
                      : L(
                          'The current level of governance pressure should be absorbable if one decision is framed clearly.',
                          'Aktualny poziom presji governance powinien być do wchłonięcia, jeśli jedna decyzja będzie jasno zramowana.'
                        ),
                  tag: 'Sequencing',
                  tone: blockedCount > 1 ? 'warning' : 'neutral',
                },
              ],
            },
          },
          {
            id: 'industryLens',
            title: L('Industry Lens', 'Industry Lens'),
            subtitle: L(
              'External signals translated into transformation relevance',
              'Sygnały z zewnątrz przetłumaczone na znaczenie dla transformacji'
            ),
            accent: 'cool',
            size: computeRecommendedSize(industryPriority, 'lg'),
            priorityWeight: industryPriority,
            relevanceScore: 85,
            freshnessScore: industryFreshness,
            ctaIntents: ['translate_signal', 'compare_peer_case', 'turn_signal_into_action'],
            payload: {
              industryLabel: industry || p.industryLabel,
              roleLens,
              marketSignal: {
                id: 'industry-market',
                title: p.marketSignalTitle,
                summary: p.marketSignalSummary,
                tag: L('Market signal', 'Sygnał rynkowy'),
                tone: 'warning',
              },
              technologySignal: {
                id: 'industry-tech',
                title: p.technologySignalTitle,
                summary: p.technologySignalSummary,
                tag: L('Technology signal', 'Sygnał technologiczny'),
                tone: 'positive',
              },
              aiNews: Array.isArray(aiNews) ? aiNews : [],
              benchmark: {
                label: p.benchmarkLabel,
                value: p.benchmarkValue,
                delta: p.benchmarkDelta,
                implication: constraints
                  ? `${p.benchmarkImplication} ${L('Current constraints in context', 'Bieżące ograniczenia w kontekście')}: ${constraints}.`
                  : p.benchmarkImplication,
              },
              peerCase: {
                title: p.peerCaseTitle,
                summary: p.peerCaseSummary,
                implication: p.peerCaseImplication,
              },
            },
          },
          {
            id: 'executionCurrent',
            title: L('Execution Current', 'Execution Current'),
            subtitle: L(
              'Transformation execution without drifting into operations control',
              'Wykonanie transformacji bez dryfu w "operational control"'
            ),
            accent: 'cool',
            size: computeRecommendedSize(executionPriority, 'md'),
            priorityWeight: executionPriority,
            relevanceScore: 82,
            freshnessScore: 63,
            ctaIntents: ['sequence_execution', 'review_dependencies'],
            payload: {
              headline:
                tasksDueSoon.length > 0
                  ? L(
                      'Execution is visible. Use it to support narrative and decision clarity.',
                      'Wykonanie jest widoczne. Użyj go, żeby wspierać narrację i klarowność decyzji.'
                    )
                  : L(
                      'Execution is relatively light. This is a shaping window.',
                      'Wykonanie jest relatywnie lekkie. To okno na shaping.'
                    ),
              streams: [
                executionSignalRollup.total > 0
                  ? {
                      id: 'execution-signal-rollup',
                      label: L('Governed execution signals', 'Governed execution signals'),
                      progressLabel: isPolish
                        ? `${executionSignalRollup.total} sygnalow z ostatnich 7 dni · top: ${formatExecutionSignalType(topExecutionSignalType)}`
                        : `${executionSignalRollup.total} signals in the last 7 days · top: ${formatExecutionSignalType(topExecutionSignalType)}`,
                      status:
                        executionSignalRollup.total >= 5 ||
                        topExecutionSignalType?.includes('block')
                          ? 'blocked'
                          : 'steady',
                    }
                  : null,
                tasksDueSoon[0]
                  ? {
                      id: `task-${tasksDueSoon[0].id}`,
                      label: String(tasksDueSoon[0].title),
                      progressLabel:
                        overdueTasks.length > 0
                          ? L('Needs immediate attention', 'Wymaga natychmiastowej uwagi')
                          : L('Closest active move', 'Najbliższy aktywny ruch'),
                      status: overdueTasks.length > 0 ? 'blocked' : 'accelerating',
                      entityType: 'task',
                      entityId: String(tasksDueSoon[0].id),
                    }
                  : null,
                tasksDueSoon[1]
                  ? {
                      id: `task-${tasksDueSoon[1].id}`,
                      label: String(tasksDueSoon[1].title),
                      progressLabel: L('Execution lane in motion', 'Pas wykonania w ruchu'),
                      status: 'steady',
                      entityType: 'task',
                      entityId: String(tasksDueSoon[1].id),
                    }
                  : null,
                pendingDecisions[0]
                  ? {
                      id: `decision-${pendingDecisions[0].id}`,
                      label: String(pendingDecisions[0].title),
                      progressLabel: L(
                        'Waiting on decision closure',
                        'Czeka na domknięcie decyzji'
                      ),
                      status: 'blocked',
                      entityType: 'decision',
                      entityId: String(pendingDecisions[0].id),
                    }
                  : null,
              ].filter(Boolean),
              nextUp,
              artifactOutputs: outputFlow,
            },
          },
          {
            id: 'teamSignal',
            title: L('Team Signal', 'Team Signal'),
            subtitle: L(
              'Organizational alignment around the transformation storyline',
              'Wyrównanie organizacji wokół narracji transformacji'
            ),
            accent: 'neutral',
            size: computeRecommendedSize(teamPriority, 'md'),
            priorityWeight: teamPriority,
            relevanceScore: 77,
            freshnessScore: 58,
            ctaIntents: ['prepare_alignment_message', 'summarize_team_signal'],
            payload: {
              headline:
                pendingDecisions.length > 1
                  ? L(
                      'The team has energy, but alignment still needs a cleaner narrative.',
                      'Zespół ma energię, ale alignment nadal potrzebuje czystszej narracji.'
                    )
                  : L(
                      'The system looks collaborative enough to push one strong storyline forward.',
                      'System wygląda wystarczająco współpracująco, żeby pchać jedną silną narrację do przodu.'
                    ),
              summary: priorities
                ? L(
                    `Current priorities in context: ${priorities}. Home should keep these visible without turning into an operational cockpit.`,
                    `Aktualne priorytety w kontekście: ${priorities}. Home ma je trzymać widoczne, ale bez zamiany w "operational cockpit".`
                  )
                : L(
                    'Home should help the team align around transformation direction, not just task status.',
                    'Home ma pomagać zespołowi alignować się na kierunku transformacji, nie tylko na statusie zadań.'
                  ),
              signals: [
                {
                  id: 'team-signal-collaboration',
                  title:
                    activeRooms.length > 0
                      ? L(
                          'Live collaboration is visible in the workspace layer',
                          'W warstwie workspace widac zywa wspolprace'
                        )
                      : L(
                          'Collaboration substrate is quiet right now',
                          'Substrat wspolpracy jest teraz cichy'
                        ),
                  detail:
                    activeRooms.length > 0
                      ? isPolish
                        ? `${activeRooms.length} aktywnych pokoi, ${activePresenceCount} aktywnych obecnosci i ${degradedRoomCount} pokojow zdegradowanych.`
                        : `${activeRooms.length} active rooms, ${activePresenceCount} active presences, and ${degradedRoomCount} degraded rooms.`
                      : L(
                          'No active collaboration rooms are currently bound to this organization, so alignment still depends mostly on narrative and decision rhythm.',
                          'Brak aktywnych pokoi wspolpracy dla tej organizacji, wiec alignment nadal opiera sie glownie na narracji i rytmie decyzji.'
                        ),
                  tone:
                    degradedRoomCount > 0
                      ? 'warning'
                      : activeRooms.length > 0
                        ? 'positive'
                        : 'neutral',
                },
                {
                  id: 'team-signal-1',
                  title: L('There is enough movement in the system', 'W systemie jest dość ruchu'),
                  detail: L(
                    'The risk is fragmentation, not inactivity. Use one storyline to align effort.',
                    'Ryzykiem jest fragmentacja, nie bezczynność. Użyj jednej narracji, żeby alignować wysiłek.'
                  ),
                  tone: 'positive',
                },
                {
                  id: 'team-signal-2',
                  title:
                    pendingDecisions.length > 0
                      ? L('Leadership attention is the lever', 'Uwaga liderów jest dźwignią')
                      : L('Leadership attention is available', 'Uwaga liderów jest dostępna'),
                  detail:
                    pendingDecisions.length > 0
                      ? L(
                          'One cleaner approval path will likely unlock more than another status review.',
                          'Jedna czystsza ścieżka approval prawdopodobnie odblokuje więcej niż kolejny status review.'
                        )
                      : L(
                          'This is a good moment to package the strongest idea for leadership conversation.',
                          'To dobry moment, żeby spakować najsilniejszy pomysł do rozmowy z leadershipem.'
                        ),
                  tone: pendingDecisions.length > 0 ? 'warning' : 'positive',
                },
                {
                  id: 'team-signal-3',
                  title: L(
                    'Narrative discipline matters more than more updates',
                    "Dyscyplina narracji jest ważniejsza niż kolejne update'y"
                  ),
                  detail: L(
                    'If Home keeps showing isolated signals, the team will see a dashboard. If it tells one story, they will see direction.',
                    'Jeśli Home pokazuje izolowane sygnały, zespół zobaczy dashboard. Jeśli opowiada jedną historię, zobaczy kierunek.'
                  ),
                  tone: 'neutral',
                },
              ],
              peerTips,
            },
          },
          {
            id: 'commandDock',
            title: L('Command Dock', 'Command Dock'),
            subtitle: L('Immediate moves', 'Natychmiastowe ruchy'),
            accent: 'neutral',
            size: 'hero',
            priorityWeight: 100,
            relevanceScore: 100,
            freshnessScore: 100,
            ctaIntents: ['create', 'navigate', 'chat'],
            payload: {
              actions: [
                { id: 'new-idea', label: L('+ Idea', '+ Pomysł'), kind: 'create', target: 'idea' },
                { id: 'new-note', label: L('+ Note', '+ Notatka'), kind: 'create', target: 'note' },
                { id: 'new-task', label: L('+ Task', '+ Zadanie'), kind: 'create', target: 'task' },
                {
                  id: 'new-decision',
                  label: L('+ Decision', '+ Decyzja'),
                  kind: 'create',
                  target: 'decision',
                },
                {
                  id: 'open-calendar',
                  label: L('Calendar', 'Kalendarz'),
                  kind: 'navigate',
                  target: 'calendar',
                },
                {
                  id: 'ask-ai',
                  label: L('Ask AI', 'Zapytaj AI'),
                  kind: 'chat',
                  starterPrompt: L(
                    'Turn the current Home signals into one clear transformation narrative, three priorities, and one next decision.',
                    'Zamień sygnały z Home w jedną klarowną narrację transformacji, trzy priorytety i jedną następną decyzję.'
                  ),
                },
              ],
              runtimeSummary: {
                inboxPending: Number(inboxByStatus.pending || 0),
                inboxAtRisk: Number(inboxBySlaStatus.at_risk || 0),
                recentOutputs: outputFlow.length,
                reviewSharedOutputs: outputFlow.filter(
                  (artifact) => artifact.visibilityScope === 'review_shared'
                ).length,
              },
            },
          },
        ];

        return {
          timeMode,
          updatedAt: now.toISOString(),
          pulseLabel:
            pendingDecisions.length > 0
              ? L(
                  'Transformation pressure is rising in the right places',
                  'Presja transformacji rośnie we właściwych miejscach'
                )
              : L('Transformation momentum is building', 'Momentum transformacji się buduje'),
          blocks,
        };
      })();

      homeV2Inflight.set(cacheKey, payloadPromise);
      const payload = await payloadPromise;
      homeV2ResponseCache.set(cacheKey, {
        payload,
        expiresAt: Date.now() + Math.max(1_000, HOME_V2_CACHE_TTL_MS),
      });
      return res.json(payload);
    } catch (err: any) {
      logger.error('[home-v2]', err);
      res
        .status(500)
        .json(
          buildHomeFailClosedError(
            req,
            500,
            'MY_WORK_HOME_V2_BUILD_FAILED',
            'Failed to build My Work Home view.'
          )
        );
    } finally {
      homeV2Inflight.delete(cacheKey);
    }
  })
);

// ─── /home/brief ─────────────────────────────────────────────────────────────

router.get(
  '/home/brief',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    if (!db) {
      logger.error('[home-brief] request DB context missing');
      return res
        .status(500)
        .json(
          buildHomeFailClosedError(
            req,
            500,
            'MY_WORK_HOME_BRIEF_READ_FAILED',
            'Failed to load My Work brief.'
          )
        );
    }

    try {
      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.getDay();
      const weekProgress = Math.round((dayOfWeek / 5) * 100);

      const overdueTasksResult = await db.query<{ id: string; title: string }>(
        `SELECT id, title FROM tasks WHERE assignee_id = ? AND organization_id = ? AND status NOT IN ('done','cancelled') AND due_date < ${nowSql()} ORDER BY due_date ASC LIMIT 3`,
        [userId, orgId]
      );

      const pendingDecisionsResult = await db.query<{ id: string; title: string }>(
        `SELECT id, title FROM decisions WHERE organization_id = ? AND status = 'pending' AND (created_by = ? OR decision_maker_id = ?) ORDER BY created_at DESC LIMIT 3`,
        [orgId, userId, userId]
      );

      const recentIdeasResult = await db.query<{ id: string; title: string }>(
        `SELECT id, title FROM ideas WHERE created_by = ? AND organization_id = ? ORDER BY updated_at DESC LIMIT 1`,
        [userId, orgId]
      );

      const overdueTasks = overdueTasksResult.rows;
      const pendingDecisions = pendingDecisionsResult.rows;
      const recentIdeas = recentIdeasResult.rows;

      const focusItems: Array<{
        id: string;
        type: string;
        title: string;
        meta: string;
        priority: string;
      }> = [];

      if (overdueTasks.length > 0) {
        focusItems.push({
          id: overdueTasks[0].id,
          type: 'task',
          title: overdueTasks[0].title,
          meta: 'Overdue',
          priority: 'high',
        });
      }

      if (pendingDecisions.length > 0) {
        focusItems.push({
          id: pendingDecisions[0].id,
          type: 'decision',
          title: pendingDecisions[0].title,
          meta: `${pendingDecisions.length} pending`,
          priority: 'high',
        });
      }

      if (recentIdeas.length > 0) {
        focusItems.push({
          id: recentIdeas[0].id,
          type: 'idea',
          title: recentIdeas[0].title,
          meta: 'Recently updated',
          priority: 'medium',
        });
      }

      res.json({
        greeting: hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening',
        insight: null,
        focusItems,
        weekProgress,
      });
    } catch (err: any) {
      logger.error('[home-brief]', err);
      res
        .status(500)
        .json(
          buildHomeFailClosedError(
            req,
            500,
            'MY_WORK_HOME_BRIEF_READ_FAILED',
            'Failed to load My Work brief.'
          )
        );
    }
  })
);

// ─── /home/spark ─────────────────────────────────────────────────────────────

router.get(
  '/home/spark',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db!;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    try {
      const ideasResult = await db.query<{
        id: string;
        title: string;
        description: string | null;
        stage: string | null;
        updated_at: string;
      }>(
        `SELECT id, title, description, stage, updated_at FROM ideas WHERE created_by = ? AND organization_id = ? ORDER BY updated_at DESC LIMIT 4`,
        [userId, orgId]
      );

      const notesResult = await db.query<{
        id: string;
        title: string;
        content_text: string | null;
        updated_at: string;
      }>(
        `SELECT id, title, content_text, updated_at FROM notebook_pages WHERE owner_user_id = ? AND organization_id = ? ORDER BY updated_at DESC LIMIT 2`,
        [userId, orgId]
      );

      const ideasWithoutTasksResult = await db.query<{ id: string; title: string }>(
        `SELECT i.id, i.title FROM ideas i LEFT JOIN tasks t ON t.idea_id = i.id WHERE i.created_by = ? AND i.organization_id = ? AND t.id IS NULL ORDER BY i.updated_at DESC LIMIT 1`,
        [userId, orgId]
      );

      const ideas = ideasResult.rows;
      const notes = notesResult.rows;
      const ideasWithoutTasks = ideasWithoutTasksResult.rows;

      const aiNudge =
        ideasWithoutTasks.length > 0
          ? {
              text: `"${ideasWithoutTasks[0].title}" has no tasks yet. Want to break it into actionable steps?`,
              ideaId: ideasWithoutTasks[0].id,
              action: 'Expand idea',
            }
          : null;

      res.json({
        ideas: ideas.map((i: any) => ({
          id: i.id,
          type: 'idea',
          title: i.title,
          snippet: (i.description || '').substring(0, 200),
          stage: i.stage || 'spark',
          updatedAt: i.updated_at,
        })),
        notes: notes.map((n: any) => ({
          id: n.id,
          type: 'note',
          title: n.title,
          snippet: (n.content_text || '').replace(/<[^>]*>/g, '').substring(0, 200),
          updatedAt: n.updated_at,
        })),
        aiNudge,
      });
    } catch (err: any) {
      logger.error('[home-spark]', err);
      res
        .status(500)
        .json(
          buildHomeFailClosedError(
            req,
            500,
            'MY_WORK_HOME_SPARK_READ_FAILED',
            'Failed to load My Work spark data.'
          )
        );
    }
  })
);

// ─── /home/pulse ─────────────────────────────────────────────────────────────

router.get(
  '/home/pulse',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({
      articles: [],
      frameworkOfDay: {
        name: 'Jobs-to-be-Done',
        description:
          "People don't buy products — they hire them to do a job. Understand the underlying job your client's customers are trying to accomplish.",
      },
      benchmark: null,
    });
  })
);

// ─── /home/nudge ─────────────────────────────────────────────────────────────

router.get(
  '/home/nudge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db!;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    try {
      const pendingDecisionsResult = await db.query(
        `SELECT COUNT(*) as cnt FROM decisions WHERE organization_id = ? AND status = 'pending' AND (created_by = ? OR decision_maker_id = ?) AND created_at < ${daysAgoSql(1)}`,
        [orgId, userId, userId]
      );

      const overdueTasksResult = await db.query(
        `SELECT COUNT(*) as cnt FROM tasks WHERE assignee_id = ? AND organization_id = ? AND status NOT IN ('done','cancelled') AND due_date < ${nowSql()}`,
        [userId, orgId]
      );

      const pendingDecisions = Number((pendingDecisionsResult.rows[0] as any)?.cnt || 0);
      const overdueTasks = Number((overdueTasksResult.rows[0] as any)?.cnt || 0);

      res.json({
        pendingDecisions,
        overdueTasks,
        message: null,
      });
    } catch (err: any) {
      logger.error('[home-nudge]', err);
      res
        .status(500)
        .json(
          buildHomeFailClosedError(
            req,
            500,
            'MY_WORK_HOME_NUDGE_READ_FAILED',
            'Failed to load My Work nudge data.'
          )
        );
    }
  })
);

// ─── /outputs ────────────────────────────────────────────────────────────────

router.get(
  '/outputs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = String(req.userId || req.user?.id || '');
    const organizationId = String(req.organizationId || req.user?.organizationId || '');
    const roleKey = req.user?.role ? String(req.user.role) : null;

    const outputs = await artifactRegistryService.listMyWorkArtifacts({
      organizationId,
      userId,
      roleKey,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
    });

    res.json(outputs);
  })
);

export default router;
