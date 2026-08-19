import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';
import { finalBatchService } from './finalBatchService.js';
import { ensureMeetingTables, getMeeting } from './meetingService.js';
import * as NotificationService from './notificationService.js';
import organizationContextService from './organizationContext/OrganizationContextService.js';

type OperatorPriority = 'critical' | 'high' | 'medium';
type WorkstreamStatus = 'ready' | 'partial' | 'blocked';
type OperatorInterventionStatus = 'suggested' | 'proposed' | 'accepted' | 'executed' | 'rejected';
type OperatorInterventionTemplateKey =
  | 'meeting_follow_up'
  | 'execution_escalation'
  | 'decision_brief'
  | 'value_brief';

type OperatorAction = {
  id: string;
  title: string;
  reason: string;
  entrypoint: string;
  priority: OperatorPriority;
  sourceType: string;
  sourceId?: string | null;
  recommendedPrompt?: string | null;
  interventionTemplateKey?: OperatorInterventionTemplateKey | null;
};

type OperatorProfileRow = {
  id: string;
  organization_id: string;
  user_id: string | null;
  current_stage: string | null;
  relationship_status: string | null;
  client_dna_json: string | null;
  preferences_json: string | null;
  notes: string | null;
  updated_at: string | null;
};

type OperatorInterventionRow = {
  id: string;
  organization_id: string;
  intervention_type: string;
  title: string;
  status: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  payload_json: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  typed_action_id?: string | null;
};

type OperatorPlanRow = {
  id: string;
  organization_id: string;
  current_stage: string | null;
  status: string | null;
  plan_json: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const safeJson = <T>(value: unknown, fallback: T): T => {
  if (!value) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const isPostgres = process.env.DB_TYPE === 'postgres';
const currentDateSql = () => (isPostgres ? 'CURRENT_DATE' : "date('now')");
const currentTimestampSql = () => 'CURRENT_TIMESTAMP';
const plusDaysTimestampSql = (days: number) =>
  isPostgres ? `CURRENT_TIMESTAMP + INTERVAL '${days} day'` : `datetime('now', '+${days} day')`;
const minusDaysTimestampSql = (days: number) =>
  isPostgres ? `CURRENT_TIMESTAMP - INTERVAL '${days} day'` : `datetime('now', '-${days} day')`;
// meetings.start_at is TEXT; on Postgres it must be cast to compare against timestamps.
// NULLIF guards against empty strings (would fail to parse). SQLite keeps lexicographic
// ISO-string comparison, which already works there.
const timestampColumnSql = (column: string) =>
  isPostgres ? `NULLIF(${column}, '')::timestamptz` : column;

class AIOperatorService {
  private schemaEnsured = false;

  async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return;
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS ai_operator_profiles (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT,
        current_stage TEXT DEFAULT 'discovery',
        relationship_status TEXT DEFAULT 'watch',
        client_dna_json TEXT DEFAULT '{}',
        preferences_json TEXT DEFAULT '{}',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (organization_id, user_id)
      )`
    );
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS ai_operator_interventions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        intervention_type TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT DEFAULT 'suggested',
        typed_action_id TEXT,
        source_entity_type TEXT,
        source_entity_id TEXT,
        payload_json TEXT DEFAULT '{}',
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS ai_operator_communications (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        communication_type TEXT NOT NULL,
        audience TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        payload_json TEXT DEFAULT '{}',
        status TEXT DEFAULT 'draft',
        source_entity_type TEXT,
        source_entity_id TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS ai_operator_plans (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        current_stage TEXT,
        status TEXT DEFAULT 'active',
        plan_json TEXT DEFAULT '{}',
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await this.safeSchemaChange(
      `ALTER TABLE ai_operator_interventions ADD COLUMN typed_action_id TEXT`
    );
    this.schemaEnsured = true;
  }

  async upsertProfile(input: {
    organizationId: string;
    userId?: string | null;
    currentStage?: string | null;
    relationshipStatus?: string | null;
    clientDna?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
    notes?: string | null;
  }) {
    await this.ensureSchema();
    const existing = await this.getProfile(input.organizationId, input.userId || null);
    const id = existing?.id || uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO ai_operator_profiles (
         id, organization_id, user_id, current_stage, relationship_status, client_dna_json,
         preferences_json, notes, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET
         current_stage = excluded.current_stage,
         relationship_status = excluded.relationship_status,
         client_dna_json = excluded.client_dna_json,
         preferences_json = excluded.preferences_json,
         notes = excluded.notes,
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        input.organizationId,
        input.userId || null,
        input.currentStage || existing?.current_stage || 'discovery',
        input.relationshipStatus || existing?.relationship_status || 'watch',
        JSON.stringify(input.clientDna || safeJson(existing?.client_dna_json, {})),
        JSON.stringify(input.preferences || safeJson(existing?.preferences_json, {})),
        input.notes ?? existing?.notes ?? null,
      ]
    );
    return this.getProfile(input.organizationId, input.userId || null);
  }

  async getProfile(organizationId: string, userId?: string | null) {
    await this.ensureSchema();
    return queryHelpers.queryFirst<OperatorProfileRow>(
      `SELECT *
       FROM ai_operator_profiles
       WHERE organization_id = ?
         AND user_id IS NOT DISTINCT FROM ?::text
       LIMIT 1`,
      [organizationId, userId || null]
    );
  }

  async getOverview(organizationId: string, userId?: string | null) {
    const [foundation, execution, communication, value, interventions, plan] = await Promise.all([
      this.getFoundationOverview(organizationId, userId || null),
      this.getExecutionOverview(organizationId, userId || null),
      this.getCommunicationOverview(organizationId, userId || null),
      this.getValueOverview(organizationId),
      this.getInterventionsOverview(organizationId),
      this.getCurrentPlan(organizationId, userId || null),
    ]);
    const ops = await this.getOpsOverview(organizationId, {
      foundation,
      execution,
      communication,
      value,
      interventions,
    });
    return { foundation, execution, communication, value, interventions, plan, ops };
  }

  async getFoundationOverview(organizationId: string, userId?: string | null) {
    await this.ensureSchema();
    const profile = await this.getProfile(organizationId, userId);
    const resolvedOrgContext = await organizationContextService
      .buildResolvedContext(organizationId)
      .catch(() => null);
    const orgRow = {
      id: organizationId,
      name: resolvedOrgContext?.profile?.companyName || 'Organization',
      industry: resolvedOrgContext?.profile?.industry || 'general',
      size: resolvedOrgContext?.profile?.companySize || 'unknown',
      updated_at: resolvedOrgContext?.snapshotUpdatedAt || null,
    };
    const [convoStats, meetingStats, initiativeStats, taskStats, decisionStats, reportStats] =
      await Promise.all([
        this.safeFirst<any>(
          `SELECT COUNT(*) as total, MAX(updated_at) as last_touch
           FROM conversations
           WHERE organization_id = ?`,
          [organizationId],
          { total: 0, last_touch: null }
        ),
        this.safeFirst<any>(
          `SELECT COUNT(*) as total, MAX(start_at) as last_touch
           FROM meetings
           WHERE organization_id = ?`,
          [organizationId],
          { total: 0, last_touch: null }
        ),
        this.safeFirst<any>(
          `SELECT
             COUNT(*) as total,
             SUM(CASE WHEN status IN ('ACTIVE', 'IN_PROGRESS', 'AT_RISK', 'BLOCKED', 'PLANNING') THEN 1 ELSE 0 END) as active_count
           FROM initiatives
           WHERE organization_id = ?`,
          [organizationId],
          { total: 0, active_count: 0 }
        ),
        this.safeFirst<any>(
          `SELECT
             COUNT(*) as total,
             SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('completed', 'done', 'validated') THEN 1 ELSE 0 END) as completed_count,
             SUM(CASE WHEN due_date IS NOT NULL AND due_date < ${currentDateSql()} AND LOWER(COALESCE(status, '')) NOT IN ('completed', 'done', 'validated') THEN 1 ELSE 0 END) as overdue_count
           FROM tasks
           WHERE organization_id = ?`,
          [organizationId],
          { total: 0, completed_count: 0, overdue_count: 0 }
        ),
        this.safeFirst<any>(
          `SELECT
             COUNT(*) as total,
             SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('pending', 'escalated') THEN 1 ELSE 0 END) as pending_count
           FROM decisions
           WHERE organization_id = ?`,
          [organizationId],
          { total: 0, pending_count: 0 }
        ),
        this.safeFirst<any>(
          `SELECT COUNT(*) as total
           FROM reports
           WHERE organization_id = ?`,
          [organizationId],
          { total: 0 }
        ),
      ]);

    const lastTouchCandidates = [
      convoStats?.last_touch,
      meetingStats?.last_touch,
      orgRow?.updated_at,
    ]
      .filter(Boolean)
      .map((value) => new Date(String(value)).getTime())
      .filter((value) => Number.isFinite(value));
    const lastTouchAt =
      lastTouchCandidates.length > 0
        ? new Date(Math.max(...lastTouchCandidates)).toISOString()
        : null;
    const daysSinceLastTouch = lastTouchAt
      ? Math.max(0, Math.round((Date.now() - new Date(lastTouchAt).getTime()) / 86400000))
      : null;
    const momentumScore = clamp(
      100 -
        Number(taskStats?.overdue_count || 0) * 8 -
        Number(decisionStats?.pending_count || 0) * 6 -
        (daysSinceLastTouch || 0) * 4 +
        Number(meetingStats?.total || 0) * 3,
      5,
      98
    );
    const relationshipHealth = (() => {
      if (daysSinceLastTouch === null) return 'stale';
      const recency = clamp(100 - daysSinceLastTouch * 5, 10, 100);
      const executionPenalty = Math.min(
        Number(taskStats?.overdue_count || 0) * 2 + Number(decisionStats?.pending_count || 0),
        25
      );
      const score = clamp(recency - executionPenalty, 10, 100);
      return score >= 65 ? 'strong' : score >= 35 ? 'watch' : 'stale';
    })();

    const derivedStage =
      profile?.current_stage ||
      this.inferStage({
        initiativeCount: Number(initiativeStats?.total || 0),
        activeInitiatives: Number(initiativeStats?.active_count || 0),
        totalTasks: Number(taskStats?.total || 0),
        completedTasks: Number(taskStats?.completed_count || 0),
        totalMeetings: Number(meetingStats?.total || 0),
        totalReports: Number(reportStats?.total || 0),
        totalDecisions: Number(decisionStats?.total || 0),
      });
    const discoveryCoveragePct = clamp(
      Number(meetingStats?.total || 0) * 12 +
        Number(convoStats?.total || 0) * 2 +
        Number(reportStats?.total || 0) * 10 +
        Number(initiativeStats?.total || 0) * 8,
      0,
      100
    );

    const storedClientDna = safeJson<Record<string, unknown>>(profile?.client_dna_json, {});
    const clientDna = {
      communicationStyle:
        String(storedClientDna.communicationStyle || '').trim() ||
        (Number(decisionStats?.pending_count || 0) >= 3
          ? 'structured_executive'
          : 'collaborative_adaptive'),
      decisionStyle:
        String(storedClientDna.decisionStyle || '').trim() ||
        (Number(initiativeStats?.active_count || 0) >= 4
          ? 'portfolio_driven'
          : 'guided_single_thread'),
      executionPace:
        String(storedClientDna.executionPace || '').trim() ||
        (Number(taskStats?.overdue_count || 0) > 4 ? 'needs_pressure' : 'cadenced'),
      engagementPreference:
        String(storedClientDna.engagementPreference || '').trim() ||
        ((daysSinceLastTouch || 99) > 10 ? 'proactive_followups' : 'scheduled_cadence'),
      industry: orgRow?.industry || 'general',
      companySize: orgRow?.size || 'unknown',
    };

    const nextBestActions = this.buildFoundationActions({
      derivedStage,
      overdueTasks: Number(taskStats?.overdue_count || 0),
      pendingDecisions: Number(decisionStats?.pending_count || 0),
      activeInitiatives: Number(initiativeStats?.active_count || 0),
      totalMeetings: Number(meetingStats?.total || 0),
      totalReports: Number(reportStats?.total || 0),
      daysSinceLastTouch: daysSinceLastTouch || 0,
    });

    return {
      organization: {
        id: organizationId,
        name: orgRow?.name || 'Organization',
        industry: orgRow?.industry || 'general',
        companySize: orgRow?.size || 'unknown',
      },
      profile: {
        currentStage: derivedStage,
        relationshipHealth,
        momentumScore,
        clientDna,
        lastTouchAt,
        daysSinceLastTouch,
      },
      discovery: {
        maturitySignal:
          discoveryCoveragePct >= 75
            ? 'structured'
            : discoveryCoveragePct >= 45
              ? 'emerging'
              : 'early',
        coveragePct: discoveryCoveragePct,
        evidence: {
          conversations: Number(convoStats?.total || 0),
          meetings: Number(meetingStats?.total || 0),
          initiatives: Number(initiativeStats?.total || 0),
          reports: Number(reportStats?.total || 0),
        },
        openQuestions: this.buildDiscoveryQuestions(derivedStage, orgRow?.industry || 'general'),
      },
      navigator: {
        currentStage: derivedStage,
        progressPct: this.stageProgressPct(derivedStage),
        nextBestActions,
        journeyRisks: this.buildJourneyRisks({
          overdueTasks: Number(taskStats?.overdue_count || 0),
          pendingDecisions: Number(decisionStats?.pending_count || 0),
          daysSinceLastTouch: daysSinceLastTouch || 0,
        }),
      },
    };
  }

  async getExecutionOverview(organizationId: string, _userId?: string | null) {
    await this.ensureSchema();
    const [taskStats, decisionStats, riskStats, delayStats, actionStats] = await Promise.all([
      this.safeFirst<any>(
        `SELECT
           SUM(CASE WHEN due_date IS NOT NULL AND due_date < ${currentDateSql()} AND LOWER(COALESCE(status, '')) NOT IN ('completed','done','validated') THEN 1 ELSE 0 END) as overdue_count,
           SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('todo','in_progress','pending','blocked') THEN 1 ELSE 0 END) as open_count,
           SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'blocked' THEN 1 ELSE 0 END) as blocked_count
         FROM tasks
         WHERE organization_id = ?`,
        [organizationId],
        { overdue_count: 0, open_count: 0, blocked_count: 0 }
      ),
      this.safeFirst<any>(
        `SELECT
           SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('pending','escalated') THEN 1 ELSE 0 END) as pending_count,
           SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'approved' THEN 1 ELSE 0 END) as approved_count
         FROM decisions
         WHERE organization_id = ?`,
        [organizationId],
        { pending_count: 0, approved_count: 0 }
      ),
      this.safeFirst<any>(
        `SELECT COUNT(*) as open_count
         FROM risk_signal_alerts
         WHERE organization_id = ? AND is_dismissed IS NOT TRUE`,
        [organizationId],
        { open_count: 0 }
      ),
      this.safeFirst<any>(
        `SELECT COUNT(*) as open_count
         FROM delay_signals
         WHERE organization_id = ? AND is_dismissed IS NOT TRUE`,
        [organizationId],
        { open_count: 0 }
      ),
      this.safeFirst<any>(
        `SELECT
           SUM(CASE WHEN status = 'proposed' THEN 1 ELSE 0 END) as proposed_count,
           SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
           SUM(CASE WHEN status = 'executed' THEN 1 ELSE 0 END) as executed_count
         FROM ai_typed_actions
         WHERE organization_id = ?`,
        [organizationId],
        { proposed_count: 0, accepted_count: 0, executed_count: 0 }
      ),
    ]);

    const overdueTasks = Number(taskStats?.overdue_count || 0);
    const blockedTasks = Number(taskStats?.blocked_count || 0);
    const pendingDecisions = Number(decisionStats?.pending_count || 0);
    const openRisks = Number(riskStats?.open_count || 0);
    const openDelays = Number(delayStats?.open_count || 0);
    const pulse =
      overdueTasks + blockedTasks + openRisks + openDelays >= 10
        ? 'critical'
        : overdueTasks + pendingDecisions + openRisks >= 4
          ? 'attention'
          : 'on_track';

    const actions: OperatorAction[] = [];
    if (overdueTasks > 0) {
      actions.push({
        id: 'recover-overdue-tasks',
        title: `Recover ${overdueTasks} overdue task(s)`,
        reason: 'Execution is slipping and needs owner-level follow-up.',
        entrypoint: '/execution',
        priority: overdueTasks > 5 ? 'critical' : 'high',
        sourceType: 'task',
        recommendedPrompt: 'Create a recovery plan for overdue execution items and assign owners.',
      });
    }
    if (pendingDecisions > 0) {
      actions.push({
        id: 'close-pending-decisions',
        title: `Close ${pendingDecisions} pending decision(s)`,
        reason: 'Decision debt is slowing the program.',
        entrypoint: '/my-work?tab=decisions',
        priority: pendingDecisions > 3 ? 'high' : 'medium',
        sourceType: 'decision',
        recommendedPrompt: 'Summarize pending decisions, trade-offs, and who needs to decide.',
      });
    }
    if (openRisks > 0 || openDelays > 0) {
      actions.push({
        id: 'dispatch-mitigation',
        title: 'Dispatch mitigations for active risks and delays',
        reason: 'Execution signals show emerging delivery threats.',
        entrypoint: '/execution-control',
        priority: openRisks + openDelays > 4 ? 'critical' : 'high',
        sourceType: 'signal',
        recommendedPrompt: 'Propose mitigations for open delivery risks and delays.',
      });
    }

    return {
      pulse,
      backlog: {
        openTasks: Number(taskStats?.open_count || 0),
        overdueTasks,
        blockedTasks,
        pendingDecisions,
      },
      approvalLoop: {
        proposed: Number(actionStats?.proposed_count || 0),
        accepted: Number(actionStats?.accepted_count || 0),
        executed: Number(actionStats?.executed_count || 0),
      },
      signals: {
        openRisks,
        openDelays,
      },
      actions,
    };
  }

  async getCommunicationOverview(organizationId: string, _userId?: string | null) {
    await ensureMeetingTables();
    const [upcomingMeetings, followUps, pendingDecisions, overdueTasks] = await Promise.all([
      this.safeAll<any>(
        `SELECT id, title, start_at
         FROM meetings
         WHERE organization_id = ?
           AND ${timestampColumnSql('start_at')} >= ${currentTimestampSql()}
           AND ${timestampColumnSql('start_at')} <= ${plusDaysTimestampSql(7)}
         ORDER BY start_at ASC
         LIMIT 5`,
        [organizationId],
        []
      ),
      this.safeAll<any>(
        `SELECT mf.id, mf.title, mf.owner, m.id as meeting_id, m.title as meeting_title
         FROM meeting_follow_ups mf
         INNER JOIN meetings m ON m.id = mf.meeting_id
         WHERE m.organization_id = ? AND COALESCE(mf.status, 'open') = 'open'
         ORDER BY m.start_at DESC
         LIMIT 5`,
        [organizationId],
        []
      ),
      this.safeAll<any>(
        `SELECT id, title, status
         FROM decisions
         WHERE organization_id = ? AND LOWER(COALESCE(status, '')) IN ('pending','escalated')
         ORDER BY updated_at DESC
         LIMIT 5`,
        [organizationId],
        []
      ),
      this.safeAll<any>(
        `SELECT id, title, due_date
         FROM tasks
         WHERE organization_id = ?
           AND due_date IS NOT NULL
           AND due_date < ${currentDateSql()}
           AND LOWER(COALESCE(status, '')) NOT IN ('completed','done','validated')
         ORDER BY due_date ASC
         LIMIT 5`,
        [organizationId],
        []
      ),
    ]);

    const nudges = [
      ...followUps.slice(0, 2).map((item: any) => ({
        id: `follow-up-${item.id}`,
        audience: item.owner || 'owner',
        title: `Follow up on ${item.meeting_title}`,
        summary: item.title,
        entrypoint: '/meeting',
      })),
      ...overdueTasks.slice(0, 2).map((item: any) => ({
        id: `task-${item.id}`,
        audience: 'task_owner',
        title: 'Overdue task nudge',
        summary: item.title,
        entrypoint: '/my-work?tab=tasks',
      })),
    ];

    const executiveBullets = [
      `${upcomingMeetings.length} meeting(s) in the next 7 days`,
      `${followUps.length} open meeting follow-up(s)`,
      `${pendingDecisions.length} decision(s) still waiting`,
      `${overdueTasks.length} overdue task(s) requiring reminder`,
    ];

    return {
      cadenceStatus:
        upcomingMeetings.length > 0 || followUps.length > 0 || pendingDecisions.length > 0
          ? 'active'
          : 'thin',
      upcomingMeetings: upcomingMeetings.map((meeting: any) => ({
        meetingId: meeting.id,
        title: meeting.title,
        startAt: meeting.start_at,
      })),
      followUpDrafts: followUps.map((item: any) => ({
        id: item.id,
        title: item.title,
        audience: item.owner || 'owner',
        summary: `Follow up after ${item.meeting_title}`,
        entrypoint: '/meeting',
      })),
      nudges,
      executiveBrief: {
        title: 'Operator brief',
        summary: 'Cadence check for meetings, follow-ups, and decision flow.',
        bullets: executiveBullets,
      },
    };
  }

  async getMeetingBrief(organizationId: string, meetingId: string) {
    await ensureMeetingTables();
    const meeting = await getMeeting({ organizationId, meetingId });
    if (!meeting) return null;

    const [projectTasks, projectDecisions] = await Promise.all([
      meeting.projectId
        ? this.safeAll<any>(
            `SELECT id, title, due_date, status
             FROM tasks
             WHERE organization_id = ? AND project_id = ?
             ORDER BY updated_at DESC
             LIMIT 6`,
            [organizationId, meeting.projectId],
            []
          )
        : Promise.resolve([]),
      meeting.projectId
        ? this.safeAll<any>(
            `SELECT id, title, status
             FROM decisions
             WHERE organization_id = ? AND project_id = ?
             ORDER BY updated_at DESC
             LIMIT 6`,
            [organizationId, meeting.projectId],
            []
          )
        : Promise.resolve([]),
    ]);

    const agendaGaps: string[] = [];
    if (meeting.preRead.length === 0) agendaGaps.push('Add pre-read materials before the meeting.');
    if (meeting.agenda.length < 3)
      agendaGaps.push('Expand the agenda to cover decisions, risks, and next steps.');
    if (meeting.attendees.length < 2)
      agendaGaps.push('Confirm the right decision-makers are invited.');

    const followUpSuggestions = [
      ...projectTasks
        .filter((task: any) => String(task.status || '').toLowerCase() !== 'completed')
        .slice(0, 3)
        .map((task: any) => `Review task: ${task.title}`),
      ...projectDecisions
        .filter((decision: any) =>
          ['pending', 'escalated'].includes(String(decision.status || '').toLowerCase())
        )
        .slice(0, 2)
        .map((decision: any) => `Force decision closure: ${decision.title}`),
    ];

    return {
      meetingId: meeting.id,
      title: meeting.title,
      prepSummary: `Focus the meeting on ${meeting.agenda[0] || 'delivery status'}, close open follow-ups, and convert discussion into owned next steps.`,
      stakeholderNotes: meeting.attendees.slice(0, 5).map((attendee) => ({
        name: attendee,
        note: 'Tailor the summary and decisions to this stakeholder after the meeting.',
      })),
      agendaGaps,
      followUpSuggestions,
      executiveBrief: {
        headline: `Meeting operator brief for ${meeting.title}`,
        bullets: [
          `${meeting.followUps.filter((item) => item.status === 'open').length} open follow-up(s)`,
          `${projectTasks.length} project task(s) to review`,
          `${projectDecisions.length} project decision(s) to reference`,
        ],
      },
    };
  }

  async getInterventionsOverview(organizationId: string) {
    await this.ensureSchema();
    const [suggested, queue] = await Promise.all([
      this.buildSuggestedInterventions(organizationId),
      this.listInterventions(organizationId),
    ]);
    return {
      suggested,
      queue,
    };
  }

  async getCurrentPlan(organizationId: string, userId?: string | null) {
    await this.ensureSchema();
    const latest = await this.safeFirst<OperatorPlanRow | null>(
      `SELECT *
       FROM ai_operator_plans
       WHERE organization_id = ? AND status = 'active'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [organizationId],
      null
    );
    if (latest?.plan_json) {
      return safeJson(latest.plan_json, null);
    }
    return this.regeneratePlan(organizationId, userId || null);
  }

  async regeneratePlan(organizationId: string, userId?: string | null) {
    await this.ensureSchema();
    const [foundation, execution, communication, value, interventions] = await Promise.all([
      this.getFoundationOverview(organizationId, userId || null),
      this.getExecutionOverview(organizationId, userId || null),
      this.getCommunicationOverview(organizationId, userId || null),
      this.getValueOverview(organizationId),
      this.getInterventionsOverview(organizationId),
    ]);

    const stage = String(foundation?.profile?.currentStage || 'discovery');
    const plan = this.buildPlanGraph({
      organizationId,
      stage,
      foundation,
      execution,
      communication,
      value,
      interventions,
    });

    await queryHelpers.queryRun(
      `UPDATE ai_operator_plans
       SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = ? AND status = 'active'`,
      [organizationId]
    );

    await queryHelpers.queryRun(
      `INSERT INTO ai_operator_plans (
         id, organization_id, current_stage, status, plan_json, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [`operator-plan-${uuidv4()}`, organizationId, stage, JSON.stringify(plan), userId || null]
    );

    return plan;
  }

  async listInterventions(organizationId: string) {
    await this.ensureSchema();
    const rows = await this.safeAll<any>(
      `SELECT
         i.*,
         a.status as action_status,
         a.action_type,
         a.target_entity_type,
         a.target_entity_id,
         a.preview_diff,
         a.proposed_changes,
         a.rbac_required_role,
         a.accepted_by,
         a.executed_at,
         a.execution_result
       FROM ai_operator_interventions i
       LEFT JOIN ai_typed_actions a ON a.id = i.typed_action_id
       WHERE i.organization_id = ?
       ORDER BY i.created_at DESC
       LIMIT 20`,
      [organizationId],
      []
    );
    return rows.map((row: any) => ({
      interventionId: row.id,
      actionId: row.typed_action_id || null,
      title: row.title,
      type: row.intervention_type,
      status: (row.action_status || row.status || 'suggested') as OperatorInterventionStatus,
      previewDiff: row.preview_diff || null,
      payload: safeJson(row.payload_json, {}),
      proposedChanges: safeJson(row.proposed_changes, {}),
      requiredRole: row.rbac_required_role || null,
      acceptedBy: row.accepted_by || null,
      executedAt: row.executed_at || null,
      executionResult: safeJson(row.execution_result, null),
      sourceEntityType: row.source_entity_type || row.target_entity_type || null,
      sourceEntityId: row.source_entity_id || row.target_entity_id || null,
      createdAt: row.created_at || null,
    }));
  }

  async proposeIntervention(
    organizationId: string,
    userId: string,
    input: { templateKey: OperatorInterventionTemplateKey }
  ) {
    await this.ensureSchema();
    const template = await this.buildInterventionTemplate(organizationId, input.templateKey);
    if (!template) return null;

    const proposed = await finalBatchService.proposeAction(organizationId, {
      actionType: template.actionType,
      targetEntityType: template.targetEntityType,
      targetEntityId: template.targetEntityId || undefined,
      proposedChanges: template.proposedChanges,
      previewDiff: template.previewDiff,
      rbacRequiredRole: template.rbacRequiredRole,
      idempotencyKey: template.idempotencyKey,
      proposedBy: userId,
    });

    const interventionId = `${template.actionType}-${proposed.id}`;
    await queryHelpers.queryRun(
      `INSERT INTO ai_operator_interventions (
         id, organization_id, intervention_type, title, status, typed_action_id,
         source_entity_type, source_entity_id, payload_json, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'proposed', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        interventionId,
        organizationId,
        template.actionType,
        template.title,
        proposed.id,
        template.targetEntityType,
        template.targetEntityId || null,
        JSON.stringify({
          templateKey: input.templateKey,
          summary: template.summary,
          audience: template.audience || null,
        }),
        userId,
      ]
    );

    return (
      (await this.listInterventions(organizationId)).find(
        (item) => item.actionId === proposed.id
      ) || null
    );
  }

  async acceptIntervention(
    organizationId: string,
    actionId: string,
    acceptedBy: string,
    actorRole?: string
  ) {
    const result = await finalBatchService.acceptAction(
      organizationId,
      actionId,
      acceptedBy,
      actorRole
    );
    if (result.ok) {
      await this.updateInterventionStatus(organizationId, actionId, 'accepted');
    }
    return result;
  }

  async rejectIntervention(organizationId: string, actionId: string) {
    const result = await finalBatchService.rejectAction(organizationId, actionId);
    if (result.ok) {
      await this.updateInterventionStatus(organizationId, actionId, 'rejected');
    }
    return result;
  }

  async executeIntervention(organizationId: string, actionId: string, actorUserId: string) {
    const action = await finalBatchService.getAction(organizationId, actionId);
    if (!action || String((action as any).status || '') !== 'accepted') {
      return { ok: false, reason: 'invalid_state' };
    }

    const actionType = String((action as any).action_type || '');
    const targetEntityId = String((action as any).target_entity_id || '').trim() || null;
    const proposedChanges = safeJson<Record<string, any>>((action as any).proposed_changes, {});
    let executionResult: Record<string, unknown> = {};

    if (actionType === 'operator_create_meeting_follow_up') {
      // MTG-BVP-001: the operator may propose meeting output, but it may not
      // bypass the mounted human-approval/material receipt boundary by calling
      // the legacy local follow-up writer.
      return { ok: false, reason: 'meeting_proposal_required' };
    } else if (actionType === 'operator_send_execution_escalation') {
      const recipients = await this.getOrganizationRecipients(organizationId, [
        'ADMIN',
        'SUPERADMIN',
        'OWNER',
      ]);
      await Promise.all(
        recipients.map((recipient) =>
          NotificationService.send({
            userId: recipient.id,
            organizationId,
            type: 'operator_execution_escalation',
            title: String(proposedChanges.title || 'Execution escalation'),
            body: String(
              proposedChanges.message ||
                'AI Operator detected execution drift and requests attention.'
            ),
            actionUrl: String(proposedChanges.actionUrl || '/execution'),
            priority: 'high',
            entityType: 'execution',
            entityId: targetEntityId || undefined,
          })
        )
      );
      executionResult = {
        effect: 'escalation_notified',
        recipientCount: recipients.length,
      };
    } else if (actionType === 'operator_publish_decision_brief') {
      const communicationId = await this.recordCommunication(organizationId, {
        communicationType: 'decision_brief',
        audience: 'executive',
        title: String(proposedChanges.title || 'Decision brief'),
        summary: String(proposedChanges.summary || ''),
        payload: {
          bullets: proposedChanges.bullets || [],
          actionUrl: proposedChanges.actionUrl || '/my-work?tab=decisions',
        },
        sourceEntityType: 'decision',
        sourceEntityId: targetEntityId,
        createdBy: actorUserId,
      });
      executionResult = {
        effect: 'decision_brief_published',
        communicationId,
      };
    } else if (actionType === 'operator_publish_value_brief') {
      const communicationId = await this.recordCommunication(organizationId, {
        communicationType: 'value_brief',
        audience: 'executive',
        title: String(proposedChanges.title || 'Value brief'),
        summary: String(proposedChanges.summary || ''),
        payload: {
          bullets: proposedChanges.bullets || [],
          actionUrl: proposedChanges.actionUrl || '/results',
        },
        sourceEntityType: 'value',
        sourceEntityId: targetEntityId,
        createdBy: actorUserId,
      });
      executionResult = {
        effect: 'value_brief_published',
        communicationId,
      };
    } else {
      return { ok: false, reason: 'unsupported_action_type' };
    }

    const result = await finalBatchService.executeAction(organizationId, actionId, executionResult);
    if (result.ok) {
      await this.updateInterventionStatus(organizationId, actionId, 'executed', executionResult);
    }
    return { ...result, executionResult };
  }

  async getValueOverview(organizationId: string) {
    const [initiativeStats, taskStats, decisionStats, kpiStats, reportStats] = await Promise.all([
      this.safeFirst<any>(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status IN ('AT_RISK', 'BLOCKED') THEN 1 ELSE 0 END) as at_risk_count
         FROM initiatives
         WHERE organization_id = ?`,
        [organizationId],
        { total: 0, at_risk_count: 0 }
      ),
      this.safeFirst<any>(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('completed','done','validated') AND updated_at >= ${minusDaysTimestampSql(30)} THEN 1 ELSE 0 END) as completed_30d
         FROM tasks
         WHERE organization_id = ?`,
        [organizationId],
        { total: 0, completed_30d: 0 }
      ),
      this.safeFirst<any>(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('approved','done','completed') AND updated_at >= ${minusDaysTimestampSql(30)} THEN 1 ELSE 0 END) as completed_30d
         FROM decisions
         WHERE organization_id = ?`,
        [organizationId],
        { total: 0, completed_30d: 0 }
      ),
      this.safeFirst<any>(
        `SELECT COUNT(*) as total
         FROM kpis
         WHERE organization_id = ?`,
        [organizationId],
        { total: 0 }
      ),
      this.safeFirst<any>(
        `SELECT COUNT(*) as total
         FROM reports
         WHERE organization_id = ?`,
        [organizationId],
        { total: 0 }
      ),
    ]);

    const trackedKpis = Number(kpiStats?.total || 0);
    const activeInitiatives = Number(initiativeStats?.total || 0);
    const atRiskInitiatives = Number(initiativeStats?.at_risk_count || 0);
    const totalTasks = Number(taskStats?.total || 0);
    const totalDecisions = Number(decisionStats?.total || 0);
    const dimensionScore =
      (activeInitiatives > 0 ? 15 : 0) +
      (trackedKpis > 0 ? 15 : 0) +
      (totalTasks > 0 ? 12 : 0) +
      (totalDecisions > 0 ? 10 : 0) +
      (Number(reportStats?.total || 0) > 0 ? 10 : 0);
    const valueCoveragePct = clamp(
      dimensionScore +
        activeInitiatives * 5 +
        trackedKpis * 8 +
        Number(reportStats?.total || 0) * 4 +
        Math.min(Number(taskStats?.completed_30d || 0), 10) * 2 +
        Math.min(Number(decisionStats?.completed_30d || 0), 5) * 3
    );

    return {
      status:
        trackedKpis === 0 && activeInitiatives === 0 && totalTasks === 0
          ? 'needs_instrumentation'
          : atRiskInitiatives > 2
            ? 'at_risk'
            : 'tracking',
      coveragePct: valueCoveragePct,
      activeInitiatives,
      atRiskInitiatives,
      completedTasks30d: Number(taskStats?.completed_30d || 0),
      completedDecisions30d: Number(decisionStats?.completed_30d || 0),
      trackedKpis,
      recommendations: [
        trackedKpis === 0
          ? 'Connect KPI tracking so the operator can link execution to value.'
          : 'Review KPI attribution and benefits evidence monthly.',
        atRiskInitiatives > 0
          ? 'Prioritize at-risk initiatives in the next executive review.'
          : 'Promote winning initiatives into reusable transformation patterns.',
      ],
    };
  }

  async getOpsOverview(
    organizationId: string,
    data?: {
      foundation?: any;
      execution?: any;
      communication?: any;
      value?: any;
      interventions?: any;
    }
  ) {
    const foundation = data?.foundation || (await this.getFoundationOverview(organizationId));
    const execution = data?.execution || (await this.getExecutionOverview(organizationId));
    const communication =
      data?.communication || (await this.getCommunicationOverview(organizationId));
    const value = data?.value || (await this.getValueOverview(organizationId));
    const interventions =
      data?.interventions || (await this.getInterventionsOverview(organizationId));
    const releaseStats = await this.safeFirst<any>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN release_bundle_id IS NOT NULL THEN 1 ELSE 0 END) as release_traced,
         SUM(CASE WHEN prompt_key IS NOT NULL AND prompt_version IS NOT NULL THEN 1 ELSE 0 END) as prompt_traced,
         SUM(CASE WHEN policy_version IS NOT NULL THEN 1 ELSE 0 END) as policy_traced
       FROM ai_purpose_assignments
       WHERE organization_id = ? AND is_active = 1`,
      [organizationId],
      { total: 0, release_traced: 0, prompt_traced: 0, policy_traced: 0 }
    );

    const totalAssignments = Number(releaseStats?.total || 0);
    const releaseCoveragePct =
      totalAssignments > 0
        ? Math.round((Number(releaseStats?.release_traced || 0) / totalAssignments) * 100)
        : 0;
    const promptTracePct =
      totalAssignments > 0
        ? Math.round((Number(releaseStats?.prompt_traced || 0) / totalAssignments) * 100)
        : 0;
    const policyTracePct =
      totalAssignments > 0
        ? Math.round((Number(releaseStats?.policy_traced || 0) / totalAssignments) * 100)
        : 0;

    const execOpen = Number(execution?.backlog?.openTasks || 0);
    const execOverdue = Number(execution?.backlog?.overdueTasks || 0);
    const execTotal = Math.max(execOpen, execOverdue);
    const execHealthy = execTotal > 0 ? (execTotal - execOverdue) / execTotal : 0;
    const executionCoveragePct =
      execTotal > 0
        ? clamp(Math.round(20 + execHealthy * 70 - Number(execution?.signals?.openRisks || 0) * 3))
        : 0;

    const workstreams = [
      {
        key: 'foundation',
        label: 'Relationship + Navigator',
        status: this.toStatus(
          foundation?.navigator?.progressPct || 0,
          foundation?.profile?.relationshipHealth === 'stale'
        ),
        coveragePct: Number(foundation?.navigator?.progressPct || 0),
      },
      {
        key: 'execution',
        label: 'Execution Core',
        status:
          execution?.pulse === 'critical'
            ? 'blocked'
            : execution?.pulse === 'attention'
              ? 'partial'
              : 'ready',
        coveragePct: executionCoveragePct,
      },
      {
        key: 'communication',
        label: 'Client Operating Layer',
        status: communication?.cadenceStatus === 'active' ? 'ready' : 'partial',
        coveragePct: clamp(
          Number(communication?.upcomingMeetings?.length || 0) * 15 +
            Number(communication?.followUpDrafts?.length || 0) * 10 +
            Number(communication?.nudges?.length || 0) * 10
        ),
      },
      {
        key: 'value',
        label: 'Value And Ops',
        status: this.toStatus(
          Number(value?.coveragePct || 0),
          value?.status === 'needs_instrumentation'
        ),
        coveragePct: Number(value?.coveragePct || 0),
      },
    ] as Array<{ key: string; label: string; status: WorkstreamStatus; coveragePct: number }>;

    const readinessScore = Math.round(
      workstreams.reduce((sum, item) => sum + Number(item.coveragePct || 0), 0) / workstreams.length
    );
    const guardrailPenalty =
      totalAssignments > 0
        ? (100 - releaseCoveragePct) * 0.2 +
          (100 - promptTracePct) * 0.15 +
          (100 - policyTracePct) * 0.1
        : 0;
    const autonomyScore = clamp(Math.round(readinessScore - guardrailPenalty));

    return {
      readinessScore,
      autonomyScore,
      workstreams,
      interventionStats: execution?.approvalLoop || { proposed: 0, accepted: 0, executed: 0 },
      interventions,
      guardrails: {
        releaseCoveragePct,
        promptTracePct,
        policyTracePct,
      },
    };
  }

  private inferStage(input: {
    initiativeCount: number;
    activeInitiatives: number;
    totalTasks: number;
    completedTasks: number;
    totalMeetings: number;
    totalReports: number;
    totalDecisions?: number;
  }) {
    const hasTasks = input.totalTasks > 0;
    const hasDecisions = (input.totalDecisions || 0) > 0;
    const hasSignificantWork = input.totalTasks > 3 || (hasTasks && hasDecisions);

    if (!hasTasks && !hasDecisions && input.initiativeCount === 0 && input.totalMeetings <= 1)
      return 'onboarding';
    if (
      hasSignificantWork &&
      input.completedTasks >= input.totalTasks * 0.6 &&
      input.totalReports > 0
    )
      return 'value_realization';
    if (hasSignificantWork) return 'execution';
    if (hasTasks || hasDecisions || input.initiativeCount > 0) return 'planning';
    if (input.totalMeetings > 1) return 'discovery';
    return 'onboarding';
  }

  private stageProgressPct(stage: string) {
    switch (stage) {
      case 'onboarding':
        return 20;
      case 'discovery':
        return 35;
      case 'planning':
        return 55;
      case 'execution':
        return 75;
      case 'value_realization':
        return 90;
      default:
        return 30;
    }
  }

  private buildFoundationActions(input: {
    derivedStage: string;
    overdueTasks: number;
    pendingDecisions: number;
    activeInitiatives: number;
    totalMeetings: number;
    totalReports: number;
    daysSinceLastTouch: number;
  }): OperatorAction[] {
    const actions: OperatorAction[] = [];
    if (input.derivedStage === 'onboarding' || input.derivedStage === 'discovery') {
      actions.push({
        id: 'run-discovery',
        title: 'Run guided discovery with the client',
        reason: 'The operator still needs stronger discovery coverage and stakeholder context.',
        entrypoint: '/chat?context=discovery',
        priority: 'high',
        sourceType: 'foundation',
        recommendedPrompt:
          'Run a discovery interview and map business goals, blockers, and stakeholders.',
      });
    }
    if (input.activeInitiatives === 0) {
      actions.push({
        id: 'create-first-initiative',
        title: 'Convert discovery into the first transformation initiative',
        reason: 'No active initiatives exist yet, so the journey cannot move into execution.',
        entrypoint: '/initiatives',
        priority: 'critical',
        sourceType: 'initiative',
      });
    }
    if (input.pendingDecisions > 0) {
      actions.push({
        id: 'resolve-decision-debt',
        title: 'Resolve decision debt before the next steering point',
        reason: 'Open decisions are slowing the client down.',
        entrypoint: '/my-work?tab=decisions',
        priority: input.pendingDecisions > 3 ? 'critical' : 'high',
        sourceType: 'decision',
      });
    }
    if (input.overdueTasks > 0) {
      actions.push({
        id: 'recover-execution',
        title: 'Recover overdue execution commitments',
        reason: 'Execution slippage is hurting momentum.',
        entrypoint: '/execution',
        priority: input.overdueTasks > 4 ? 'critical' : 'high',
        sourceType: 'task',
      });
    }
    if (input.totalMeetings === 0 || input.daysSinceLastTouch > 10) {
      actions.push({
        id: 're-establish-cadence',
        title: 'Re-establish client cadence',
        reason: 'The operator needs a fresh client touchpoint to maintain momentum.',
        entrypoint: '/meeting',
        priority: 'high',
        sourceType: 'meeting',
      });
    }
    if (input.totalReports === 0 && input.derivedStage === 'value_realization') {
      actions.push({
        id: 'publish-executive-brief',
        title: 'Publish the first executive transformation brief',
        reason: 'Value realization needs a management narrative and decision loop.',
        entrypoint: '/reports',
        priority: 'medium',
        sourceType: 'report',
      });
    }
    return actions.slice(0, 5);
  }

  private buildDiscoveryQuestions(stage: string, industry: string): string[] {
    if (stage === 'onboarding') {
      return [
        'What are the top three transformation outcomes expected this quarter?',
        'Who owns the client-side transformation mandate?',
        `What constraints are specific to ${industry}?`,
      ];
    }
    if (stage === 'discovery') {
      return [
        'Which blockers are political versus operational?',
        'Which initiative should be the lighthouse win?',
        'Where is stakeholder alignment still missing?',
      ];
    }
    return [
      'What signal would prove the transformation is working?',
      'Which stakeholder needs a different narrative?',
    ];
  }

  private buildJourneyRisks(input: {
    overdueTasks: number;
    pendingDecisions: number;
    daysSinceLastTouch: number;
  }) {
    const risks: string[] = [];
    if (input.overdueTasks > 3) risks.push('Execution commitments are drifting.');
    if (input.pendingDecisions > 2) risks.push('Decision latency is creating transformation drag.');
    if (input.daysSinceLastTouch > 10) risks.push('Client engagement cadence is weakening.');
    return risks;
  }

  private buildPlanGraph(input: {
    organizationId: string;
    stage: string;
    foundation: any;
    execution: any;
    communication: any;
    value: any;
    interventions: any;
  }) {
    const stage = input.stage;
    const stageObjective =
      stage === 'onboarding'
        ? 'Capture goals, stakeholders, and the first transformation signal.'
        : stage === 'discovery'
          ? 'Turn discovery into a concrete transformation path.'
          : stage === 'planning'
            ? 'Convert strategy into approved initiatives and owners.'
            : stage === 'execution'
              ? 'Drive execution, close blockers, and keep cadence tight.'
              : 'Prove value realization and scale the operating rhythm.';

    const nodes = [
      {
        key: 'relationship',
        title: 'Relationship calibration',
        description: 'Align the operator tone, stakeholder map, and engagement cadence.',
        status:
          input.foundation?.profile?.relationshipHealth === 'strong'
            ? 'done'
            : input.foundation?.profile?.relationshipHealth === 'watch'
              ? 'in_progress'
              : 'todo',
        ownerTrack: 'relationship',
        entrypoint: '/chat?context=discovery',
        interventionTemplateKey: null,
        dependsOn: [],
      },
      {
        key: 'discovery',
        title: 'Discovery evidence capture',
        description:
          'Collect meetings, conversations, reports, and pains into one grounded context.',
        status:
          Number(input.foundation?.discovery?.coveragePct || 0) >= 70
            ? 'done'
            : Number(input.foundation?.discovery?.coveragePct || 0) >= 40
              ? 'in_progress'
              : 'todo',
        ownerTrack: 'discovery',
        entrypoint: '/meeting',
        interventionTemplateKey: 'meeting_follow_up',
        dependsOn: ['relationship'],
      },
      {
        key: 'initiative_path',
        title: 'Transformation path',
        description: 'Define or refresh the milestone path and next best action for the client.',
        status:
          Number(input.foundation?.navigator?.progressPct || 0) >= 70
            ? 'done'
            : Number(input.foundation?.navigator?.progressPct || 0) >= 40
              ? 'in_progress'
              : 'todo',
        ownerTrack: 'navigator',
        entrypoint: '/initiatives',
        interventionTemplateKey: null,
        dependsOn: ['discovery'],
      },
      {
        key: 'execution_recovery',
        title: 'Execution recovery',
        description:
          'Reduce overdue work, unblock delivery, and make the delivery pulse predictable.',
        status:
          input.execution?.pulse === 'on_track'
            ? 'done'
            : input.execution?.pulse === 'attention'
              ? 'in_progress'
              : 'todo',
        ownerTrack: 'execution',
        entrypoint: '/execution',
        interventionTemplateKey: 'execution_escalation',
        dependsOn: ['initiative_path'],
      },
      {
        key: 'decision_velocity',
        title: 'Decision velocity',
        description: 'Close open decisions with executive-ready summaries and approvals.',
        status:
          Number(input.execution?.backlog?.pendingDecisions || 0) === 0
            ? 'done'
            : Number(input.execution?.backlog?.pendingDecisions || 0) <= 2
              ? 'in_progress'
              : 'todo',
        ownerTrack: 'governance',
        entrypoint: '/my-work?tab=decisions',
        interventionTemplateKey: 'decision_brief',
        dependsOn: ['initiative_path'],
      },
      {
        key: 'value_realization',
        title: 'Value realization narrative',
        description: 'Connect initiatives to KPI evidence and publish an executive value summary.',
        status:
          Number(input.value?.coveragePct || 0) >= 75
            ? 'done'
            : Number(input.value?.coveragePct || 0) >= 40
              ? 'in_progress'
              : 'todo',
        ownerTrack: 'value',
        entrypoint: '/results',
        interventionTemplateKey: 'value_brief',
        dependsOn: ['execution_recovery', 'decision_velocity'],
      },
    ];

    const completedNodes = nodes.filter((node) => node.status === 'done').length;
    const nextNode = nodes.find((node) => node.status !== 'done') || nodes[nodes.length - 1];
    const availableTemplates = new Set(
      (input.interventions?.suggested || []).map((item: any) => String(item.templateKey))
    );

    return {
      currentStage: stage,
      objective: stageObjective,
      progressPct: Math.round((completedNodes / nodes.length) * 100),
      nextMilestone: nextNode?.title || 'Maintain operator cadence',
      blockers: [
        ...(input.foundation?.navigator?.journeyRisks || []),
        ...(input.execution?.signals?.openRisks > 0
          ? ['Open execution risks require mitigation.']
          : []),
      ].slice(0, 4),
      nodes: nodes.map((node) => ({
        ...node,
        isInterventionAvailable: node.interventionTemplateKey
          ? availableTemplates.has(node.interventionTemplateKey)
          : false,
      })),
      summary: {
        meetings: Number(input.foundation?.discovery?.evidence?.meetings || 0),
        initiatives: Number(input.foundation?.discovery?.evidence?.initiatives || 0),
        overdueTasks: Number(input.execution?.backlog?.overdueTasks || 0),
        pendingDecisions: Number(input.execution?.backlog?.pendingDecisions || 0),
        trackedKpis: Number(input.value?.trackedKpis || 0),
      },
    };
  }

  private async buildSuggestedInterventions(organizationId: string) {
    const [meetingRow, taskStats, decisionStats, value] = await Promise.all([
      this.safeFirst<any>(
        `SELECT m.id, m.title, COUNT(mf.id) as open_follow_ups
         FROM meetings m
         LEFT JOIN meeting_follow_ups mf ON mf.meeting_id = m.id AND COALESCE(mf.status, 'open') = 'open'
         WHERE m.organization_id = ?
         GROUP BY m.id, m.title, m.start_at
         ORDER BY m.start_at DESC
         LIMIT 1`,
        [organizationId],
        null
      ),
      this.safeFirst<any>(
        `SELECT COUNT(*) as overdue_count
         FROM tasks
         WHERE organization_id = ?
           AND due_date IS NOT NULL
           AND due_date < ${currentDateSql()}
           AND LOWER(COALESCE(status, '')) NOT IN ('completed','done','validated')`,
        [organizationId],
        { overdue_count: 0 }
      ),
      this.safeFirst<any>(
        `SELECT COUNT(*) as pending_count
         FROM decisions
         WHERE organization_id = ?
           AND LOWER(COALESCE(status, '')) IN ('pending','escalated')`,
        [organizationId],
        { pending_count: 0 }
      ),
      this.getValueOverview(organizationId),
    ]);

    const suggestions: Array<Record<string, unknown>> = [];
    if (meetingRow?.id) {
      suggestions.push({
        templateKey: 'meeting_follow_up',
        title: `Prepare follow-up for ${meetingRow.title}`,
        summary: 'Create a concrete follow-up action directly on the meeting workspace.',
        priority: Number(meetingRow.open_follow_ups || 0) > 0 ? 'high' : 'medium',
      });
    }
    if (Number(taskStats?.overdue_count || 0) > 0) {
      suggestions.push({
        templateKey: 'execution_escalation',
        title: `Escalate ${taskStats.overdue_count} overdue task(s)`,
        summary: 'Notify admin stakeholders about execution drift before it spreads.',
        priority: Number(taskStats.overdue_count || 0) > 4 ? 'critical' : 'high',
      });
    }
    if (Number(decisionStats?.pending_count || 0) > 0) {
      suggestions.push({
        templateKey: 'decision_brief',
        title: `Publish decision brief for ${decisionStats.pending_count} pending decision(s)`,
        summary: 'Create an executive-ready brief to close decision debt faster.',
        priority: Number(decisionStats.pending_count || 0) > 3 ? 'high' : 'medium',
      });
    }
    if (Number(value?.coveragePct || 0) > 0) {
      suggestions.push({
        templateKey: 'value_brief',
        title: 'Publish value realization brief',
        summary: 'Summarize progress, KPI coverage, and at-risk initiative impact.',
        priority: value?.status === 'at_risk' ? 'high' : 'medium',
      });
    }
    return suggestions.slice(0, 4);
  }

  private async buildInterventionTemplate(
    organizationId: string,
    templateKey: OperatorInterventionTemplateKey
  ) {
    if (templateKey === 'meeting_follow_up') {
      const meeting = await this.safeFirst<any>(
        `SELECT m.id, m.title, COUNT(mf.id) as open_follow_ups
         FROM meetings m
         LEFT JOIN meeting_follow_ups mf ON mf.meeting_id = m.id AND COALESCE(mf.status, 'open') = 'open'
         WHERE m.organization_id = ?
         GROUP BY m.id, m.title, m.start_at
         ORDER BY m.start_at DESC
         LIMIT 1`,
        [organizationId],
        null
      );
      if (!meeting?.id) return null;
      const followUpTitle = `Follow up after ${meeting.title}`;
      return {
        actionType: 'operator_create_meeting_follow_up',
        title: `Prepare follow-up for ${meeting.title}`,
        summary: 'Create a concrete follow-up inside the meeting artifact.',
        targetEntityType: 'meeting',
        targetEntityId: String(meeting.id),
        proposedChanges: {
          followUpTitle,
          owner: 'AI Operator',
        },
        previewDiff: `Add follow-up "${followUpTitle}" to meeting "${meeting.title}".`,
        rbacRequiredRole: 'ADMIN',
        idempotencyKey: `${templateKey}:${meeting.id}`,
        audience: 'delivery',
      };
    }

    if (templateKey === 'execution_escalation') {
      const overdue = await this.safeFirst<any>(
        `SELECT COUNT(*) as overdue_count
         FROM tasks
         WHERE organization_id = ?
           AND due_date IS NOT NULL
           AND due_date < ${currentDateSql()}
           AND LOWER(COALESCE(status, '')) NOT IN ('completed','done','validated')`,
        [organizationId],
        { overdue_count: 0 }
      );
      if (!Number(overdue?.overdue_count || 0)) return null;
      return {
        actionType: 'operator_send_execution_escalation',
        title: `Escalate ${overdue.overdue_count} overdue task(s)`,
        summary: 'Notify admin stakeholders that execution is slipping.',
        targetEntityType: 'execution',
        targetEntityId: null,
        proposedChanges: {
          title: 'Execution escalation from AI Operator',
          message: `AI Operator detected ${overdue.overdue_count} overdue task(s) that require intervention.`,
          actionUrl: '/execution',
        },
        previewDiff: `Send escalation notification to org admins for ${overdue.overdue_count} overdue task(s).`,
        rbacRequiredRole: 'ADMIN',
        idempotencyKey: `${templateKey}:${overdue.overdue_count}`,
        audience: 'admin',
      };
    }

    if (templateKey === 'decision_brief') {
      const pending = await this.safeFirst<any>(
        `SELECT COUNT(*) as pending_count
         FROM decisions
         WHERE organization_id = ?
           AND LOWER(COALESCE(status, '')) IN ('pending','escalated')`,
        [organizationId],
        { pending_count: 0 }
      );
      if (!Number(pending?.pending_count || 0)) return null;
      return {
        actionType: 'operator_publish_decision_brief',
        title: `Decision brief for ${pending.pending_count} pending decision(s)`,
        summary: 'Generate an executive brief to accelerate approvals.',
        targetEntityType: 'decision',
        targetEntityId: null,
        proposedChanges: {
          title: 'AI Operator decision brief',
          summary: `${pending.pending_count} decision(s) require leadership attention.`,
          bullets: [
            `${pending.pending_count} pending decision(s) remain open.`,
            'Use the brief to focus approval discussions on blockers and trade-offs.',
          ],
          actionUrl: '/my-work?tab=decisions',
        },
        previewDiff: `Publish a decision brief for ${pending.pending_count} pending decision(s).`,
        rbacRequiredRole: 'ADMIN',
        idempotencyKey: `${templateKey}:${pending.pending_count}`,
        audience: 'executive',
      };
    }

    if (templateKey === 'value_brief') {
      const value = await this.getValueOverview(organizationId);
      if (!Number(value?.coveragePct || 0)) return null;
      return {
        actionType: 'operator_publish_value_brief',
        title: 'Value realization brief',
        summary: 'Generate a summary of KPI coverage and initiative impact.',
        targetEntityType: 'value',
        targetEntityId: null,
        proposedChanges: {
          title: 'AI Operator value brief',
          summary: `Current value coverage is ${value.coveragePct}%.`,
          bullets: [
            `${value.activeInitiatives || 0} active initiative(s)`,
            `${value.trackedKpis || 0} KPI(s) currently tracked`,
            `${value.atRiskInitiatives || 0} at-risk initiative(s)`,
          ],
          actionUrl: '/results',
        },
        previewDiff: `Publish value brief with ${value.trackedKpis || 0} KPI(s) and ${value.activeInitiatives || 0} initiative(s).`,
        rbacRequiredRole: 'ADMIN',
        idempotencyKey: `${templateKey}:${value.coveragePct}`,
        audience: 'executive',
      };
    }

    return null;
  }

  private async updateInterventionStatus(
    organizationId: string,
    actionId: string,
    status: OperatorInterventionStatus,
    executionResult?: Record<string, unknown>
  ) {
    const existing = await this.getInterventionRow(organizationId, actionId);
    const currentPayload = safeJson(existing?.payload_json, {});
    await queryHelpers.queryRun(
      `UPDATE ai_operator_interventions
       SET status = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = ? AND typed_action_id = ?`,
      [
        status,
        JSON.stringify(executionResult ? { ...currentPayload, executionResult } : currentPayload),
        organizationId,
        actionId,
      ]
    );
  }

  private async getInterventionRow(organizationId: string, actionId: string) {
    return this.safeFirst<OperatorInterventionRow | null>(
      `SELECT *
       FROM ai_operator_interventions
       WHERE organization_id = ? AND typed_action_id = ?
       LIMIT 1`,
      [organizationId, actionId],
      null
    );
  }

  private async recordCommunication(
    inputOrganizationId: string,
    input: {
      communicationType: string;
      audience: string;
      title: string;
      summary: string;
      payload: Record<string, unknown>;
      sourceEntityType?: string | null;
      sourceEntityId?: string | null;
      createdBy?: string | null;
    }
  ) {
    const id = `operator-comm-${uuidv4()}`;
    await queryHelpers.queryRun(
      `INSERT INTO ai_operator_communications (
         id, organization_id, communication_type, audience, title, summary, payload_json,
         status, source_entity_type, source_entity_id, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        inputOrganizationId,
        input.communicationType,
        input.audience,
        input.title,
        input.summary,
        JSON.stringify(input.payload || {}),
        input.sourceEntityType || null,
        input.sourceEntityId || null,
        input.createdBy || null,
      ]
    );
    return id;
  }

  private async getOrganizationRecipients(organizationId: string, roles: string[]) {
    if (!roles.length) return [];
    const placeholders = roles.map(() => '?').join(', ');
    return this.safeAll<{ id: string; role: string }>(
      `SELECT id, role
       FROM users
       WHERE organization_id = ? AND role IN (${placeholders}) AND (status IS NULL OR status = 'active')`,
      [organizationId, ...roles],
      []
    );
  }

  private toStatus(score: number, blocked: boolean): WorkstreamStatus {
    if (blocked) return 'blocked';
    if (score >= 70) return 'ready';
    if (score >= 40) return 'partial';
    return 'blocked';
  }

  private async safeSchemaChange(sql: string) {
    try {
      await queryHelpers.queryRun(sql);
    } catch {
      // ignore already-applied schema changes
    }
  }

  private async safeFirst<T>(sql: string, params: unknown[], fallback: T): Promise<T> {
    try {
      const row = await queryHelpers.queryFirst<T>(sql, params);
      return (row as T) || fallback;
    } catch {
      return fallback;
    }
  }

  private async safeAll<T>(sql: string, params: unknown[], fallback: T[]): Promise<T[]> {
    try {
      return (await queryHelpers.queryAll<T>(sql, params)) || fallback;
    } catch {
      return fallback;
    }
  }
}

export const aiOperatorService = new AIOperatorService();
export default aiOperatorService;
