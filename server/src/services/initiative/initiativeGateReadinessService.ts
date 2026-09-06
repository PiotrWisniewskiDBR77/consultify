/**
 * V4-INIT-01: Gate readiness service
 * Shared logic for blocking items used by gate-readiness-check and updateInitiativeStatus.
 */
import { InitiativeStatus, isScheduledOnward } from '../../constants/initiativeStatuses.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

export interface BlockingItem {
  key: string;
  label: string;
  section: string;
  field: string;
  requirement: string;
  suggestedAction?: string;
}

export async function getBlockingReadinessItems(
  orgId: string,
  initiativeId: string
): Promise<BlockingItem[]> {
  const initiative = await queryHelpers.queryOne(
    `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, orgId]
  );
  if (!initiative) return [];
  const ini = initiative as Record<string, unknown>;
  const currentStatus = String(ini.status || 'DRAFT').toUpperCase();
  const blocking: BlockingItem[] = [];

  const add = (
    key: string,
    label: string,
    pass: boolean,
    suggestedAction: string,
    section: string,
    field: string,
    requirement: string
  ) => {
    if (!pass) blocking.push({ key, label, section, field, requirement, suggestedAction });
  };

  // Always required
  add(
    'title',
    'Title defined',
    !!ini.name,
    'Add a concise initiative title that clearly describes the change.',
    'overview',
    'name',
    'Initiative requires a non-empty title before gate progression.'
  );
  add(
    'owner',
    'Owner assigned',
    !!(ini.owner_business_id || ini.owner_execution_id),
    'Assign a business or execution owner who will be accountable.',
    'ownership',
    'ownerBusinessId|ownerExecutionId',
    'Initiative requires at least one accountable owner before gate progression.'
  );

  if (currentStatus === 'APPROVED') {
    const start = ini.planned_start_date || ini.start_date || null;
    const end = ini.planned_end_date || ini.end_date || null;
    add(
      'timeline_dates',
      'Planned dates set (start + end)',
      !!(start && end),
      'Set planned start and end dates before scheduling (baseline lock).',
      'timeline',
      'plannedStartDate|plannedEndDate',
      'Scheduling gate requires both planned start and end dates.'
    );
    try {
      const m = await queryHelpers.queryOne(
        `SELECT COUNT(*) as c FROM initiative_milestones WHERE initiative_id = ? AND organization_id = ?`,
        [initiativeId, orgId]
      );
      const c = Number((m as Record<string, unknown>)?.c || 0);
      add(
        'schedule_milestones',
        'Milestones defined',
        c > 0,
        'Add at least one milestone to lock the schedule baseline.',
        'timeline',
        'milestones',
        'Scheduling gate requires at least one milestone.'
      );
    } catch (e: unknown) {
      const msg = String((e as Error)?.message || e || '').toLowerCase();
      const missing =
        msg.includes('no such table') || msg.includes('does not exist') || msg.includes('relation');
      blocking.push({
        key: 'schedule_milestones',
        label: missing ? 'Milestones schema available' : 'Milestones defined',
        section: 'timeline',
        field: 'milestones',
        requirement: missing
          ? 'Scheduling gate requires milestone storage to be available.'
          : 'Scheduling gate requires at least one milestone.',
        suggestedAction: missing
          ? 'Milestones table is missing. Run migrations (initiative_milestones).'
          : 'Add at least one milestone to lock the schedule baseline.',
      });
    }
  }

  if (isScheduledOnward(currentStatus)) {
    const start = ini.planned_start_date || ini.start_date || null;
    const end = ini.planned_end_date || ini.end_date || null;
    add(
      'timeline',
      'Timeline set',
      !!(start && end),
      'Set planned start and end dates for baseline scheduling.',
      'timeline',
      'plannedStartDate|plannedEndDate',
      'Execution stages require a defined baseline timeline.'
    );
  }

  if (currentStatus === InitiativeStatus.CLOSED) {
    add(
      'benefits_owner',
      'Business Owner assigned (benefits owner)',
      !!ini.owner_business_id,
      'Assign the business owner who will track realized benefits.',
      'benefits',
      'ownerBusinessId',
      'Closure gate requires a business owner responsible for benefits realization.'
    );
    try {
      const kpiCount = await queryHelpers.queryOne(
        `SELECT COUNT(*) as c FROM initiative_kpis WHERE initiative_id = ?`,
        [initiativeId]
      );
      const cAll = Number((kpiCount as Record<string, unknown>)?.c || 0);
      add(
        'benefits_kpis',
        'KPIs defined',
        cAll > 0,
        'Define measurable KPIs that will prove business value.',
        'benefits',
        'kpis',
        'Closure gate requires at least one KPI to measure realized value.'
      );
    } catch {
      blocking.push({
        key: 'benefits_kpis',
        label: 'KPIs defined',
        section: 'benefits',
        field: 'kpis',
        requirement: 'Closure gate requires at least one KPI to measure realized value.',
        suggestedAction: 'Define measurable KPIs that will prove business value.',
      });
    }
  }

  return blocking;
}
