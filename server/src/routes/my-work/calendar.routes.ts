/**
 * Calendar sub-router — extracted from my-work.routes.ts
 *
 * Simple task-based calendar plus unified calendar (tasks, initiatives, decisions, meetings).
 * Mounted under /api/my-work by the parent router.
 */

import type { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { requireTables, requireUser } from './_helpers.js';

// Reference requireTables so the import stays (available for future route-level table guards).
void requireTables;

const router = Router();

// FIX-1 (Day 3 acceptance, i18n audit): the server has no i18n mechanism — no
// Accept-Language handling, no locale-aware string tables, nothing — so this
// title CANNOT actually be translated per-request today. Named as a constant
// (rather than left as an inline literal) so it is at least a single,
// documented, searchable choice instead of a magic string, and so it is
// obvious this is Polish-only by deliberate omission, not an oversight. A
// real fix needs the client to redact per-locale from a stable status code
// (e.g. `status: 'busy_redacted'`) instead of receiving pre-localized text —
// tracked as follow-up, not done here to avoid changing the wire contract
// client code already depends on (row.title).
const FOREIGN_BUSY_EVENT_TITLE = 'Zajęte';

const isPostgres = process.env.DB_TYPE === 'postgres';
const nowSql = () => (isPostgres ? 'CURRENT_TIMESTAMP' : "datetime('now')");

/**
 * GET /api/my-work/calendar
 * Query:
 * - source=personal|project|all (default: all)
 * - projectId? (optional, for project filtering)
 * - includeDone=true|false (default: false)
 * - limit (default: 500)
 */
router.get(
  '/calendar',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const source = String(req.query.source || 'all').toLowerCase();
    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const includeDone = String(req.query.includeDone || 'false') === 'true';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 2000) : 500;

    const where: string[] = ['t.organization_id = ?', 't.assignee_id = ?'];
    const params: any[] = [orgId, userId];

    if (!includeDone) {
      where.push("lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')");
    }

    if (source === 'personal') {
      where.push("lower(coalesce(t.task_type,'')) = 'personal'");
    } else if (source === 'project') {
      where.push('t.project_id IS NOT NULL');
      where.push("lower(coalesce(t.task_type,'')) != 'personal'");
    } else if (source !== 'all') {
      return res.status(400).json({ error: 'Invalid source (expected personal|project|all)' });
    }

    if (projectId) {
      where.push('t.project_id = ?');
      params.push(projectId);
    }

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date as "dueDate",
          t.task_type as "taskType",
          t.project_id as "projectId",
          p.name as "projectName",
          t.initiative_id as "initiativeId",
          i.name as "initiativeName",
          t.created_at as "createdAt",
          t.updated_at as "updatedAt"
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
          date(COALESCE(t.due_date, '9999-12-31')) ASC,
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          t.updated_at DESC
        LIMIT ?
      `,
        [...params, limit]
      )) || [];

    res.json({ tasks: rows });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED CALENDAR ENDPOINT
// Merges tasks, initiative milestones, and decision deadlines into a single
// event stream. External calendar (Google/Outlook) events are fetched
// separately via /api/integrations/calendar/* and merged on the frontend.
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/calendar/unified',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const startRaw = req.query.start ? String(req.query.start).trim() : '';
    const endRaw = req.query.end ? String(req.query.end).trim() : '';
    const start = startRaw || null;
    const end = endRaw || null; // FullCalendar endStr is typically exclusive
    const hasRange = Boolean(start && end);
    if (
      (startRaw && !endRaw) ||
      (!startRaw && endRaw) ||
      (hasRange &&
        (!Number.isFinite(Date.parse(startRaw)) ||
          !Number.isFinite(Date.parse(endRaw)) ||
          Date.parse(endRaw) <= Date.parse(startRaw)))
    ) {
      return res.status(400).json({ error: 'start and end must define a valid increasing range' });
    }

    const sourcesParam = req.query.sources ? String(req.query.sources) : null;
    const requestedSources = sourcesParam
      ? sourcesParam
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : // FIX-13 (Day 3 layer-2 acceptance, P0): 'event' was missing from the default
        // source list. POST writes to `calendar_events` (confirmed in Postgres) but a
        // caller that omits `sources` — the common case, see src/services/api.ts
        // getMyWorkCalendarUnified()'s V8-detour fallback — got tasks/initiatives/
        // decisions only; a full reload silently dropped every own-calendar event and
        // layer counters read 0. The 'event' branch below already existed; it just
        // never ran by default.
        ['task', 'initiative', 'decision', 'event', 'outlook', 'google', 'consultify'];

    const projectId = req.query.projectId ? String(req.query.projectId).trim() : '';

    const toDateOnly = (val: unknown): string | null => {
      if (!val) return null;
      if (val instanceof Date) {
        if (Number.isNaN(val.getTime())) return null;
        return val.toISOString().slice(0, 10);
      }
      const raw = String(val).trim();
      if (!raw) return null;
      const d = raw.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    };

    const addDaysDateOnly = (dateOnly: string, days: number): string => {
      const d = new Date(`${dateOnly}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return dateOnly;
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };

    try {
      const events: Array<{
        id: string;
        title: string;
        start: string;
        end?: string;
        allDay: boolean;
        source: string;
        sourceId: string;
        color?: string;
        status?: string;
        priority?: string;
        description?: string;
      }> = [];

      // ── TASKS (due/start/end) ───────────────────────────────────────────────
      if (requestedSources.includes('task')) {
        const taskCols = await getTableColumns('tasks');
        const hasDue = taskCols.has('due_date');
        const hasStart = taskCols.has('start_date');
        const hasEnd = taskCols.has('end_date');
        const hasPlannedStart = taskCols.has('planned_start_date');
        const hasPlannedEnd = taskCols.has('planned_end_date');
        const hasProjectId = taskCols.has('project_id');
        const hasAssigneeId = taskCols.has('assignee_id');
        const hasAssignedTo = taskCols.has('assigned_to');
        const hasOwnerId = taskCols.has('owner_id');
        const hasCreatedBy = taskCols.has('created_by');

        const dateExprParts: string[] = [];
        if (hasDue) dateExprParts.push('t.due_date');
        if (hasStart) dateExprParts.push('t.start_date');
        if (hasPlannedStart) dateExprParts.push('t.planned_start_date');
        const primaryDateExpr =
          dateExprParts.length > 0 ? `COALESCE(${dateExprParts.join(', ')})` : null;

        const assignmentParts: string[] = [];
        if (hasAssigneeId) assignmentParts.push('t.assignee_id = ?');
        if (hasAssignedTo) assignmentParts.push('t.assigned_to = ?');
        if (hasOwnerId) assignmentParts.push('t.owner_id = ?');
        if (assignmentParts.length === 0 && hasCreatedBy) assignmentParts.push('t.created_by = ?');

        const where: string[] = ['t.organization_id = ?'];
        const params: any[] = [orgId];
        if (assignmentParts.length > 0) {
          where.push(`(${assignmentParts.join(' OR ')})`);
          for (let i = 0; i < assignmentParts.length; i++) params.push(userId);
        } else {
          where.push('1=0');
        }

        where.push("LOWER(COALESCE(t.status,'')) NOT IN ('done','completed','cancelled')");

        const hasAnyDateParts: string[] = [];
        if (hasDue) hasAnyDateParts.push('t.due_date IS NOT NULL');
        if (hasStart) hasAnyDateParts.push('t.start_date IS NOT NULL');
        if (hasPlannedStart) hasAnyDateParts.push('t.planned_start_date IS NOT NULL');
        if (hasAnyDateParts.length > 0) {
          where.push(`(${hasAnyDateParts.join(' OR ')})`);
        }

        if (projectId && hasProjectId) {
          where.push('t.project_id = ?');
          params.push(projectId);
        }

        if (hasRange && primaryDateExpr) {
          where.push(`${primaryDateExpr} >= ? AND ${primaryDateExpr} < ?`);
          params.push(start, end);
        }

        const select: string[] = ['t.id', 't.title', 't.status', 't.priority', 't.description'];
        if (hasDue) select.push('t.due_date as due_date');
        if (hasStart) select.push('t.start_date as start_date');
        if (hasEnd) select.push('t.end_date as end_date');
        if (hasPlannedStart) select.push('t.planned_start_date as planned_start_date');
        if (hasPlannedEnd) select.push('t.planned_end_date as planned_end_date');

        const rows =
          (await queryHelpers.queryAll<any>(
            `
            SELECT ${select.join(', ')}
            FROM tasks t
            WHERE ${where.join(' AND ')}
            ORDER BY ${primaryDateExpr ? `${primaryDateExpr} ASC` : 't.updated_at DESC'}
            LIMIT 800
          `,
            params
          )) || [];

        for (const t of rows) {
          const due = toDateOnly(t?.due_date);
          const s = toDateOnly(t?.start_date) || toDateOnly(t?.planned_start_date);
          const e = toDateOnly(t?.end_date) || toDateOnly(t?.planned_end_date);
          const startDate = due || s;
          if (!startDate) continue;

          const endExclusive =
            e && /^\d{4}-\d{2}-\d{2}$/.test(e) ? addDaysDateOnly(e, 1) : undefined;

          events.push({
            id: `task-${t.id}`,
            title: String(t.title || '').trim() || 'Task',
            start: startDate,
            end: due ? undefined : endExclusive,
            allDay: true,
            source: 'task',
            sourceId: String(t.id),
            color: '#2563eb',
            status: t.status,
            priority: t.priority,
            description: t.description,
          });
        }
      }

      // ── OWN CALENDAR EVENTS ────────────────────────────────────────────────
      if (requestedSources.includes('event')) {
        const params: unknown[] = [orgId, userId, `%"${userId}"%`];
        const rangeWhere = hasRange ? 'AND e.start_at < ? AND e.end_at >= ?' : '';
        if (hasRange) params.push(end, start);
        const rows = await queryHelpers.queryAll<any>(
          `SELECT e.* FROM calendar_events e
           WHERE e.organization_id = ?
             AND (e.owner_id = ? OR e.attendees_json LIKE ? OR e.visibility = 'org')
             ${rangeWhere}
             AND e.status <> 'cancelled'`,
          params
        );
        for (const row of rows || []) {
          const foreignBusy = row.visibility === 'busy' && String(row.owner_id) !== String(userId);
          events.push({
            id: `event-${row.id}`,
            title: foreignBusy ? FOREIGN_BUSY_EVENT_TITLE : row.title,
            start: row.start_at,
            end: row.end_at,
            allDay: Boolean(row.all_day),
            source: 'event',
            sourceId: row.id,
            status: row.status,
            ...(foreignBusy ? {} : { description: row.description || undefined }),
          });
        }
      }

      // ── INITIATIVES (planned ranges) + MILESTONES (target dates) ───────────
      if (requestedSources.includes('initiative')) {
        const initCols = await getTableColumns('initiatives');
        const hasInitPlannedStart = initCols.has('planned_start_date');
        const hasInitPlannedEnd = initCols.has('planned_end_date');
        const hasInitStart = initCols.has('start_date');
        const hasInitEnd = initCols.has('end_date');
        const hasInitTarget = initCols.has('target_date');
        const hasInitProjectId = initCols.has('project_id');
        const hasInitOwnerBusiness = initCols.has('owner_business_id');
        const hasInitOwnerExecution = initCols.has('owner_execution_id');
        const hasInitOwnerLegacy = initCols.has('owner_id');
        const hasInitSponsor = initCols.has('sponsor_id');
        const hasInitCreatedBy = initCols.has('created_by');
        const stakeholderCols = await getTableColumns('initiative_stakeholders');
        const hasStakeholders =
          stakeholderCols.has('initiative_id') && stakeholderCols.has('user_id');

        const startExpr =
          (hasInitPlannedStart && 'i.planned_start_date') ||
          (hasInitStart && 'i.start_date') ||
          (hasInitTarget && 'i.target_date') ||
          null;
        const endExpr =
          (hasInitPlannedEnd && 'i.planned_end_date') ||
          (hasInitEnd && 'i.end_date') ||
          (hasInitTarget && 'i.target_date') ||
          null;

        if (startExpr) {
          const relationParts: string[] = [];
          if (hasInitOwnerExecution) relationParts.push('i.owner_execution_id = ?');
          if (hasInitOwnerBusiness) relationParts.push('i.owner_business_id = ?');
          if (hasInitOwnerLegacy) relationParts.push('i.owner_id = ?');
          if (hasInitSponsor) relationParts.push('i.sponsor_id = ?');
          if (hasStakeholders) {
            relationParts.push(
              'EXISTS (SELECT 1 FROM initiative_stakeholders s WHERE s.initiative_id = i.id AND s.user_id = ?)'
            );
          }
          if (relationParts.length === 0 && hasInitCreatedBy)
            relationParts.push('i.created_by = ?');

          const where: string[] = ['i.organization_id = ?'];
          const params: any[] = [orgId];

          if (relationParts.length > 0) {
            where.push(`(${relationParts.join(' OR ')})`);
            for (let i = 0; i < relationParts.length; i++) params.push(userId);
          } else {
            where.push('1=0');
          }

          where.push(`${startExpr} IS NOT NULL`);
          where.push("LOWER(COALESCE(i.status,'')) NOT IN ('completed','done','cancelled')");

          if (projectId && hasInitProjectId) {
            where.push('i.project_id = ?');
            params.push(projectId);
          }

          // If we have a range, include overlaps: start <= end AND (endOrStart) >= start
          if (hasRange) {
            const endOrStart = endExpr ? `COALESCE(${endExpr}, ${startExpr})` : startExpr;
            where.push(`${startExpr} < ? AND ${endOrStart} >= ?`);
            params.push(end, start);
          }

          const rows =
            (await queryHelpers.queryAll<any>(
              `
              SELECT i.id, i.name, i.status,
                     ${startExpr} as start_date
                     ${endExpr ? `, ${endExpr} as end_date` : ''}
              FROM initiatives i
              WHERE ${where.join(' AND ')}
              ORDER BY ${startExpr} ASC
              LIMIT 400
            `,
              params
            )) || [];

          for (const i of rows) {
            const s = toDateOnly(i?.start_date);
            const e = toDateOnly(i?.end_date);
            if (!s) continue;
            const endExclusive =
              e && /^\d{4}-\d{2}-\d{2}$/.test(e) ? addDaysDateOnly(e, 1) : undefined;
            events.push({
              id: `initiative-${i.id}`,
              title: String(i.name || '').trim() || 'Initiative',
              start: s,
              end: endExclusive,
              allDay: true,
              source: 'initiative',
              sourceId: String(i.id),
              color: '#7c3aed',
              status: i.status,
            });
          }
        }

        // Optional milestones table (common in PMO schema)
        const msCols = await getTableColumns('initiative_milestones');
        const hasMilestones = msCols.has('target_date');
        const hasMsProjectId = msCols.has('project_id');
        if (hasMilestones) {
          const milestoneRelationParts: string[] = [];
          if (hasInitOwnerExecution) milestoneRelationParts.push('i.owner_execution_id = ?');
          if (hasInitOwnerBusiness) milestoneRelationParts.push('i.owner_business_id = ?');
          if (hasInitOwnerLegacy) milestoneRelationParts.push('i.owner_id = ?');
          if (hasInitSponsor) milestoneRelationParts.push('i.sponsor_id = ?');
          if (hasStakeholders) {
            milestoneRelationParts.push(
              'EXISTS (SELECT 1 FROM initiative_stakeholders s WHERE s.initiative_id = i.id AND s.user_id = ?)'
            );
          }
          if (milestoneRelationParts.length === 0 && hasInitCreatedBy) {
            milestoneRelationParts.push('i.created_by = ?');
          }

          const where: string[] = ['m.organization_id = ?', 'm.target_date IS NOT NULL'];
          const params: any[] = [orgId];

          if (milestoneRelationParts.length > 0) {
            where.push(`(${milestoneRelationParts.join(' OR ')})`);
            for (let i = 0; i < milestoneRelationParts.length; i++) params.push(userId);
          } else {
            where.push('1=0');
          }

          if (projectId && hasMsProjectId) {
            where.push('m.project_id = ?');
            params.push(projectId);
          }

          if (hasRange) {
            where.push('m.target_date >= ? AND m.target_date < ?');
            params.push(start, end);
          }

          const rows =
            (await queryHelpers.queryAll<any>(
              `
              SELECT
                m.id,
                m.initiative_id,
                m.name,
                m.status,
                m.target_date,
                i.name as initiative_name
              FROM initiative_milestones m
              LEFT JOIN initiatives i ON i.id = m.initiative_id
              WHERE ${where.join(' AND ')}
              ORDER BY m.target_date ASC
              LIMIT 600
            `,
              params
            )) || [];

          for (const m of rows) {
            const d = toDateOnly(m?.target_date);
            if (!d) continue;
            const initName = String(m?.initiative_name || '').trim();
            const msName = String(m?.name || '').trim();
            events.push({
              id: `initiative-ms-${m.id}`,
              title: initName ? `${initName}: ${msName || 'Milestone'}` : msName || 'Milestone',
              start: d,
              allDay: true,
              source: 'initiative',
              sourceId: String(m.initiative_id || m.id),
              color: '#7c3aed',
              status: m.status,
            });
          }
        }
      }

      // ── DECISIONS (deadlines) ──────────────────────────────────────────────
      if (requestedSources.includes('decision')) {
        const decisionCols = await getTableColumns('decisions');
        const hasDecisionMaker = decisionCols.has('decision_maker_id');
        const hasCreatedBy = decisionCols.has('created_by');
        const hasAssignedTo = decisionCols.has('assigned_to');
        const hasDecisionOwner = decisionCols.has('decision_owner_id');
        const hasProjectId = decisionCols.has('project_id');

        const ownerParts: string[] = [];
        if (hasDecisionOwner) ownerParts.push('d.decision_owner_id = ?');
        if (hasDecisionMaker) ownerParts.push('d.decision_maker_id = ?');
        if (hasAssignedTo) ownerParts.push('d.assigned_to = ?');
        if (ownerParts.length === 0 && hasCreatedBy) ownerParts.push('d.created_by = ?');
        if (ownerParts.length === 0) ownerParts.push('1=0');

        const where: string[] = [
          'd.organization_id = ?',
          'd.deadline IS NOT NULL',
          `(${ownerParts.join(' OR ')})`,
          "LOWER(COALESCE(d.status,'')) NOT IN ('resolved','done','completed','cancelled')",
        ];
        const params: any[] = [orgId];
        // add userId for each ownerPart placeholder we included
        const ownerParamCount =
          (hasDecisionOwner ? 1 : 0) +
          (hasDecisionMaker ? 1 : 0) +
          (hasAssignedTo ? 1 : 0) +
          (ownerParts.includes('d.created_by = ?') ? 1 : 0);
        for (let i = 0; i < ownerParamCount; i++) params.push(userId);

        if (projectId && hasProjectId) {
          where.push('d.project_id = ?');
          params.push(projectId);
        }

        if (hasRange) {
          where.push('d.deadline >= ? AND d.deadline < ?');
          params.push(start, end);
        }

        const rows =
          (await queryHelpers.queryAll<any>(
            `
            SELECT d.id, d.title, d.deadline, d.status,
                   ${decisionCols.has('priority') ? 'd.priority' : `'MEDIUM' as priority`}
            FROM decisions d
            WHERE ${where.join(' AND ')}
            ORDER BY d.deadline ASC
            LIMIT 400
          `,
            params
          )) || [];

        for (const d of rows) {
          const due = toDateOnly(d?.deadline);
          if (!due) continue;
          events.push({
            id: `decision-${d.id}`,
            title: String(d.title || '').trim() || 'Decision',
            start: due,
            allDay: true,
            source: 'decision',
            sourceId: String(d.id),
            color: '#d97706',
            status: d.status,
            priority: d.priority,
          });
        }
      }

      // ── MEETINGS (Outlook / Google / Consultify) ──────────────────────
      const wantOutlook = requestedSources.includes('outlook');
      const wantGoogle = requestedSources.includes('google');
      const wantConsultify =
        requestedSources.includes('consultify') || requestedSources.includes('meeting');
      if (wantOutlook || wantGoogle || wantConsultify) {
        const meetingCols = await getTableColumns('meetings');
        if (meetingCols.has('start_at') && meetingCols.has('end_at')) {
          const where: string[] = ['m.organization_id = ?'];
          const params: any[] = [orgId];

          if (meetingCols.has('created_by')) {
            if (meetingCols.has('attendees_json')) {
              where.push('(m.created_by = ? OR m.attendees_json LIKE ?)');
              params.push(userId, `%"${userId}"%`);
            } else {
              where.push('m.created_by = ?');
              params.push(userId);
            }
          }

          if (hasRange) {
            where.push('m.start_at >= ? AND m.start_at < ?');
            params.push(start, end);
          }

          const rows =
            (await queryHelpers.queryAll<any>(
              `SELECT m.id, m.title, m.start_at, m.end_at, m.location, m.status, m.agenda_json
               FROM meetings m
               WHERE ${where.join(' AND ')}
               ORDER BY m.start_at ASC
               LIMIT 200`,
              params
            )) || [];

          const sourceColorMap: Record<string, string> = {
            google: '#059669',
            outlook: '#4f46e5',
            consultify: '#6d28d9',
          };

          for (const m of rows) {
            let agenda: any = {};
            try {
              agenda = JSON.parse(m.agenda_json || '{}');
            } catch {
              /* ignore */
            }
            const calSource = agenda.calendarSource || 'outlook';
            if (calSource === 'outlook' && !wantOutlook) continue;
            if (calSource === 'google' && !wantGoogle) continue;
            if (calSource === 'consultify' && !wantConsultify) continue;

            const meetingType = agenda.meetingType || 'team';
            const prefix = meetingType === 'personal' ? '👤 ' : '👥 ';

            const startIso = m.start_at ? new Date(m.start_at).toISOString() : null;
            const endIso = m.end_at ? new Date(m.end_at).toISOString() : null;
            if (!startIso) continue;

            events.push({
              id: `${calSource}-${m.id}`,
              title: `${prefix}${String(m.title || '').trim() || 'Meeting'}`,
              start: startIso,
              end: endIso || undefined,
              allDay: false,
              source: calSource as any,
              sourceId: String(m.id),
              color: sourceColorMap[calSource] || '#4f46e5',
              status: m.status || 'confirmed',
              description: m.location ? `📍 ${m.location}` : undefined,
            });
          }
        }
      }

      // ── EXTERNAL CALENDAR EVENTS (v8 P02 bidirectional sync) ──────────────
      // Events pulled from a connected Google/Outlook account by the v8 sync
      // runtime land in v8_calendar_items. Surface them here so a connected
      // calendar actually shows up in My Work. Additive: when no source is
      // connected the table is empty and nothing changes.
      if (wantGoogle || wantOutlook) {
        const itemCols = await getTableColumns('v8_calendar_items');
        if (itemCols.has('start_at') && itemCols.has('source_system')) {
          const where: string[] = ['ci.organization_id = ?'];
          const params: any[] = [orgId];
          if (itemCols.has('user_id')) {
            where.push('(ci.user_id = ? OR ci.user_id IS NULL)');
            params.push(userId);
          }
          if (hasRange) {
            where.push('ci.start_at >= ? AND ci.start_at < ?');
            params.push(start, end);
          }

          const itemRows =
            (await queryHelpers.queryAll<any>(
              `SELECT ci.calendar_item_id, ci.title, ci.start_at, ci.end_at, ci.all_day,
                      ci.source_system, ci.item_type
               FROM v8_calendar_items ci
               WHERE ${where.join(' AND ')}
               ORDER BY ci.start_at ASC
               LIMIT 500`,
              params
            )) || [];

          const extColorMap: Record<string, string> = { google: '#059669', outlook: '#4f46e5' };

          for (const ci of itemRows) {
            const sys = String(ci.source_system || '').toLowerCase();
            const calSource = sys === 'microsoft' ? 'outlook' : sys === 'google' ? 'google' : null;
            if (!calSource) continue;
            if (calSource === 'google' && !wantGoogle) continue;
            if (calSource === 'outlook' && !wantOutlook) continue;

            const startIso = ci.start_at ? new Date(ci.start_at).toISOString() : null;
            if (!startIso) continue;
            const endIso = ci.end_at ? new Date(ci.end_at).toISOString() : null;

            events.push({
              id: `${calSource}-item-${ci.calendar_item_id}`,
              title: String(ci.title || '').trim() || 'Event',
              start: startIso,
              end: endIso || undefined,
              allDay: Boolean(ci.all_day),
              source: calSource as any,
              sourceId: String(ci.calendar_item_id),
              color: extColorMap[calSource],
              status: 'confirmed',
            });
          }
        }
      }

      // ── AI FOCUS TIME SUGGESTIONS ─────────────────────────────────────────
      // Generate ghost blocks for "own work" time in gaps between meetings
      if (hasRange && start && end) {
        const meetingStarts = events
          .filter(
            (e) =>
              !e.allDay &&
              (e.source === 'outlook' || e.source === 'google' || e.source === 'consultify')
          )
          .map((e) => ({
            start: new Date(e.start),
            end: e.end ? new Date(e.end) : new Date(new Date(e.start).getTime() + 3600000),
          }));

        const rangeStart = new Date(start);
        const rangeEnd = new Date(end);
        const dayMs = 86400000;

        for (let d = new Date(rangeStart); d < rangeEnd; d = new Date(d.getTime() + dayMs)) {
          const dow = d.getUTCDay();
          if (dow === 0 || dow === 6) continue; // skip weekends

          const dayStr = d.toISOString().slice(0, 10);
          const dayMeetings = meetingStarts
            .filter((m) => m.start.toISOString().slice(0, 10) === dayStr)
            .sort((a, b) => a.start.getTime() - b.start.getTime());

          // Find largest gap between 8:00-17:00 that's >= 90 min
          const workStart = new Date(`${dayStr}T08:00:00Z`);
          const workEnd = new Date(`${dayStr}T17:00:00Z`);

          // Build free slots: gaps between meetings within work hours
          const slots: Array<{ start: Date; end: Date }> = [];
          let cursor = workStart;
          for (const m of dayMeetings) {
            const mStart = m.start < workStart ? workStart : m.start;
            if (mStart > cursor) {
              slots.push({ start: cursor, end: mStart });
            }
            if (m.end > cursor) cursor = m.end;
          }
          if (cursor < workEnd) {
            slots.push({ start: cursor, end: workEnd });
          }

          let bestGap = { start: workStart, end: workStart, duration: 0 };
          for (const s of slots) {
            const dur = s.end.getTime() - s.start.getTime();
            if (dur > bestGap.duration) bestGap = { ...s, duration: dur };
          }

          if (dayMeetings.length > 0 && bestGap.duration >= 5400000) {
            // >= 90 min, only on days with meetings
            const focusStart = bestGap.start;
            const focusDur = Math.min(bestGap.duration, 7200000); // max 2h
            const focusEnd = new Date(focusStart.getTime() + focusDur);

            events.push({
              id: `ai-focus-${dayStr}`,
              title: '🧠 Focus time (AI suggestion)',
              start: focusStart.toISOString(),
              end: focusEnd.toISOString(),
              allDay: false,
              source: 'task' as any,
              sourceId: `ai-focus-${dayStr}`,
              color: 'rgba(124, 58, 237, 0.15)',
              status: 'ai_suggestion',
              description: 'AI-suggested deep work block based on your calendar gaps',
            });
          }
        }
      }

      events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      res.json({ events });
    } catch (err: any) {
      logger.error('[calendar-unified] failed', { err, correlationId: (req as any).correlationId });
      res.status(500).json({
        error: 'Failed to load unified calendar',
        code: 'MY_WORK_CALENDAR_UNIFIED_FAILED',
      });
    }
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR V2: EVENT CREATION + CONFLICT DETECTION (scaffolded for future use)
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/calendar/events',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db!;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    const schema = z.object({
      title: z.string().min(1).max(500),
      start: z.string().optional(),
      end: z.string().optional(),
      startAt: z.string().optional(),
      endAt: z.string().optional(),
      allDay: z.boolean().optional().default(false),
      source: z.enum(['event', 'task', 'initiative', 'decision']).optional().default('event'),
      description: z.string().max(10000).optional().default(''),
      location: z.string().max(1000).optional().default(''),
      attendees: z.array(z.string().min(1)).optional().default([]),
      visibility: z.enum(['private', 'busy', 'org']).optional().default('private'),
      relatedType: z.enum(['task', 'initiative', 'meeting']).nullable().optional(),
      relatedId: z.string().nullable().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid event data', details: parsed.error.issues });
    }

    const { title, source, description } = parsed.data;
    const start = parsed.data.startAt || parsed.data.start;
    const end = parsed.data.endAt || parsed.data.end;
    if (!start) return res.status(400).json({ error: 'startAt is required' });

    try {
      if (source === 'event') {
        if (
          !end ||
          !Number.isFinite(Date.parse(start)) ||
          !Number.isFinite(Date.parse(end)) ||
          Date.parse(end) <= Date.parse(start)
        ) {
          return res.status(400).json({ error: 'endAt must be later than startAt' });
        }
        if (parsed.data.attendees.length) {
          const placeholders = parsed.data.attendees.map(() => '?').join(',');
          const members = await db.query(
            `SELECT id FROM users WHERE organization_id = ? AND id IN (${placeholders})`,
            [orgId, ...parsed.data.attendees]
          );
          if ((members.rows || []).length !== new Set(parsed.data.attendees).size) {
            return res
              .status(400)
              .json({ error: 'Every attendee must belong to this organization' });
          }
        }
        const id = uuidv4();
        await db.query(
          `INSERT INTO calendar_events
           (id, organization_id, owner_id, title, description, location, start_at, end_at, all_day,
            attendees_json, visibility, status, related_type, related_id, recurrence_rule,
            recurrence_parent_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, NULL, NULL, ?, ${nowSql()}, ${nowSql()})`,
          [
            id,
            orgId,
            userId,
            title,
            description,
            parsed.data.location,
            start,
            end,
            parsed.data.allDay ? 1 : 0,
            JSON.stringify(parsed.data.attendees),
            parsed.data.visibility,
            parsed.data.relatedType || null,
            parsed.data.relatedId || null,
            userId,
          ]
        );
        return res.status(201).json({
          id,
          title,
          description,
          location: parsed.data.location,
          startAt: start,
          endAt: end,
          allDay: parsed.data.allDay,
          attendees: parsed.data.attendees,
          visibility: parsed.data.visibility,
          status: 'confirmed',
          relatedType: parsed.data.relatedType || null,
          relatedId: parsed.data.relatedId || null,
          source: 'event',
        });
      }
      if (source === 'task') {
        const id = uuidv4();
        await db.query(
          `INSERT INTO tasks (id, title, description, due_date, assignee_id, organization_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'todo', ${nowSql()}, ${nowSql()})`,
          [id, title, description || null, start, userId, orgId]
        );
        res.json({ id, source: 'task', message: 'Task created from calendar' });
      } else {
        res
          .status(501)
          .json({ error: `Creating ${source} events from calendar is not yet supported` });
      }
    } catch (err: any) {
      logger.error('[calendar-create-event]', err);
      res.status(500).json({ error: 'Failed to create calendar event' });
    }
  })
);

const calendarEventUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  location: z.string().max(1000).optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  allDay: z.boolean().optional(),
  attendees: z.array(z.string().min(1)).optional(),
  visibility: z.enum(['private', 'busy', 'org']).optional(),
  relatedType: z.enum(['task', 'initiative', 'meeting']).nullable().optional(),
  relatedId: z.string().nullable().optional(),
});

router.put(
  '/calendar/events/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const parsed = calendarEventUpdateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid event data', details: parsed.error.issues });
    const current = await queryHelpers.queryOne<any>(
      'SELECT * FROM calendar_events WHERE id = ? AND organization_id = ?',
      [req.params.id, identity.orgId]
    );
    if (!current) return res.status(404).json({ error: 'Event not found' });
    if (String(current.owner_id) !== String(identity.userId))
      return res.status(403).json({ error: 'Only the owner can edit this event' });
    const next = { ...current, ...parsed.data };
    const start = parsed.data.startAt ?? current.start_at;
    const end = parsed.data.endAt ?? current.end_at;
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs)
      return res.status(400).json({ error: 'endAt must be later than startAt' });
    if (parsed.data.attendees?.length) {
      const placeholders = parsed.data.attendees.map(() => '?').join(',');
      const members = await req.db!.query(
        `SELECT id FROM users WHERE organization_id = ? AND id IN (${placeholders})`,
        [identity.orgId, ...parsed.data.attendees]
      );
      if ((members.rows || []).length !== new Set(parsed.data.attendees).size) {
        return res.status(400).json({ error: 'Every attendee must belong to this organization' });
      }
    }
    await queryHelpers.queryRun(
      `UPDATE calendar_events SET title = ?, description = ?, location = ?, start_at = ?, end_at = ?, all_day = ?, attendees_json = ?, visibility = ?, related_type = ?, related_id = ?, updated_at = ${nowSql()} WHERE id = ? AND organization_id = ? AND owner_id = ?`,
      [
        next.title,
        next.description,
        next.location,
        start,
        end,
        next.allDay === undefined ? current.all_day : next.allDay ? 1 : 0,
        JSON.stringify(parsed.data.attendees ?? JSON.parse(current.attendees_json || '[]')),
        next.visibility,
        next.relatedType ?? current.related_type,
        next.relatedId ?? current.related_id,
        req.params.id,
        identity.orgId,
        identity.userId,
      ]
    );
    return res.json({
      id: req.params.id,
      ...parsed.data,
      startAt: start,
      endAt: end,
      source: 'event',
    });
  })
);

router.delete(
  '/calendar/events/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const current = await queryHelpers.queryOne<any>(
      'SELECT id, owner_id FROM calendar_events WHERE id = ? AND organization_id = ?',
      [req.params.id, identity.orgId]
    );
    if (!current) return res.status(404).json({ error: 'Event not found' });
    if (String(current.owner_id) !== String(identity.userId))
      return res.status(403).json({ error: 'Only the owner can delete this event' });
    await queryHelpers.queryRun(
      `UPDATE calendar_events SET status = 'cancelled', updated_at = ${nowSql()} WHERE id = ? AND organization_id = ? AND owner_id = ?`,
      [req.params.id, identity.orgId, identity.userId]
    );
    return res.json({ id: req.params.id, status: 'cancelled' });
  })
);

router.get(
  '/calendar/conflicts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db!;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    const date = req.query.date ? String(req.query.date) : new Date().toISOString().split('T')[0];

    try {
      const tasksOnDateResult = await db.query(
        `SELECT id, title, due_date FROM tasks
         WHERE assignee_id = ? AND organization_id = ?
           AND date(due_date) = date(?)
           AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','cancelled')
         ORDER BY due_date ASC`,
        [userId, orgId, date]
      );

      const decisionsOnDateResult = await db.query(
        `SELECT id, title, deadline FROM decisions
         WHERE organization_id = ?
           AND (created_by = ? OR assigned_to = ?)
           AND date(deadline) = date(?)
           AND LOWER(COALESCE(status,'')) NOT IN ('resolved','cancelled')
         ORDER BY deadline ASC`,
        [orgId, userId, userId, date]
      );
      const eventsOnDateResult = await db.query(
        `SELECT id, title, start_at, end_at FROM calendar_events
         WHERE organization_id = ? AND owner_id = ? AND status <> 'cancelled'
           AND date(start_at) = date(?) ORDER BY start_at ASC`,
        [orgId, userId, date]
      );

      const tasksOnDate = tasksOnDateResult.rows;
      const decisionsOnDate = decisionsOnDateResult.rows;
      const calendarEventsOnDate = eventsOnDateResult.rows;

      const hasConflicts =
        tasksOnDate.length + decisionsOnDate.length + calendarEventsOnDate.length > 3;

      res.json({
        date,
        tasks: tasksOnDate,
        decisions: decisionsOnDate,
        events: calendarEventsOnDate,
        totalItems: tasksOnDate.length + decisionsOnDate.length + calendarEventsOnDate.length,
        hasConflicts,
        suggestion: hasConflicts
          ? 'This day looks busy. Consider rescheduling lower-priority items.'
          : null,
      });
    } catch (err: any) {
      logger.error('[calendar-conflicts]', err);
      res.status(500).json({ error: 'Failed to check conflicts' });
    }
  })
);

router.patch(
  '/calendar/events/:eventId/reschedule',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = req.db!;
    const userId = req.userId!;
    const orgId = req.organizationId!;
    const { eventId } = req.params;

    const schema = z.object({
      newStart: z.string(),
      newEnd: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid reschedule data' });
    }

    const { newStart, newEnd } = parsed.data;

    try {
      // Determine source from eventId prefix
      if (eventId.startsWith('event-')) {
        if (!newEnd || Date.parse(newEnd) <= Date.parse(newStart))
          return res.status(400).json({ error: 'newEnd must be later than newStart' });
        const id = eventId.replace('event-', '');
        const result = await db.query(
          `UPDATE calendar_events SET start_at = ?, end_at = ?, updated_at = ${nowSql()} WHERE id = ? AND organization_id = ? AND owner_id = ? RETURNING id, start_at, end_at`,
          [newStart, newEnd, id, orgId, userId]
        );
        if (!(result.rows || []).length) return res.status(404).json({ error: 'Event not found' });
        return res.json({ success: true, source: 'event', id, startAt: newStart, endAt: newEnd });
      } else if (eventId.startsWith('task-')) {
        const taskId = eventId.replace('task-', '');
        await db.query(
          `UPDATE tasks SET due_date = ?, updated_at = ${nowSql()} WHERE id = ? AND assignee_id = ? AND organization_id = ?`,
          [newStart, taskId, userId, orgId]
        );
        res.json({ success: true, source: 'task', id: taskId });
      } else if (eventId.startsWith('decision-')) {
        const decisionId = eventId.replace('decision-', '');
        await db.query(
          `UPDATE decisions SET deadline = ?, updated_at = ${nowSql()} WHERE id = ? AND organization_id = ? AND (created_by = ? OR assigned_to = ?)`,
          [newStart, decisionId, orgId, userId, userId]
        );
        res.json({ success: true, source: 'decision', id: decisionId });
      } else {
        res.status(400).json({ error: 'Unknown event source' });
      }
    } catch (err: any) {
      logger.error('[calendar-reschedule]', err);
      res.status(500).json({ error: 'Failed to reschedule event' });
    }
  })
);

export default router;
