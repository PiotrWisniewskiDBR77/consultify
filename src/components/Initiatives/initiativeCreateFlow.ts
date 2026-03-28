import type { KanbanScope } from '../Portfolio/PortfolioKanbanView';

import { InitiativeStatus, type PortfolioInitiative } from '../../types';
import { ACTIVE_STATUSES } from '@/utils/initiativeHelpers';

export interface InitiativeCreateRevealState {
  scope: KanbanScope;
  activeStatusFilter: string | null;
}

export function normalizeInitiativeForPortfolio(
  initiative: Record<string, any> | null | undefined,
  fallbackId?: string | null
): PortfolioInitiative | null {
  const id = String(initiative?.id || fallbackId || '').trim();
  if (!id) return null;

  const normalizedStatus = String(initiative?.status || InitiativeStatus.DRAFT).toUpperCase();
  const status = (normalizedStatus || InitiativeStatus.DRAFT) as InitiativeStatus;

  return {
    id,
    name: String(initiative?.name || initiative?.title || 'Untitled initiative'),
    summary: initiative?.summary || undefined,
    description: initiative?.description || initiative?.summary || undefined,
    axis: String(initiative?.axis || 'operational'),
    status,
    priority: (initiative?.priority || 'MEDIUM') as PortfolioInitiative['priority'],
    progress:
      typeof initiative?.progress === 'number' && Number.isFinite(initiative.progress)
        ? initiative.progress
        : 0,
    budget:
      typeof initiative?.budget === 'number' && Number.isFinite(initiative.budget)
        ? initiative.budget
        : 0,
    expectedRoi:
      typeof initiative?.expectedRoi === 'number' && Number.isFinite(initiative.expectedRoi)
        ? initiative.expectedRoi
        : undefined,
    plannedStartDate: initiative?.plannedStartDate || initiative?.planned_start_date || undefined,
    plannedEndDate: initiative?.plannedEndDate || initiative?.planned_end_date || undefined,
    targetQuarter: initiative?.targetQuarter || initiative?.target_quarter || undefined,
    waveId: initiative?.waveId || initiative?.wave_id || undefined,
    waveName: initiative?.waveName || initiative?.wave_name || undefined,
    programId: initiative?.programId || initiative?.program_id || undefined,
    programName: initiative?.programName || initiative?.program_name || undefined,
    projectId: initiative?.projectId || initiative?.project_id || undefined,
    projectName: initiative?.projectName || initiative?.project_name || undefined,
    sourceId: initiative?.sourceId || initiative?.source_id || undefined,
    sourceType: initiative?.sourceType || initiative?.source_type || undefined,
    ownerBusiness: initiative?.ownerBusiness || undefined,
    ownerExecution: initiative?.ownerExecution || undefined,
    dependencies: Array.isArray(initiative?.dependencies) ? initiative.dependencies : undefined,
    isCriticalPath:
      typeof initiative?.isCriticalPath === 'boolean' ? initiative.isCriticalPath : undefined,
    riskScore:
      typeof initiative?.riskScore === 'number' && Number.isFinite(initiative.riskScore)
        ? initiative.riskScore
        : undefined,
    valueScore:
      typeof initiative?.valueScore === 'number' && Number.isFinite(initiative.valueScore)
        ? initiative.valueScore
        : undefined,
    createdAt: String(initiative?.createdAt || initiative?.created_at || new Date().toISOString()),
    updatedAt: String(initiative?.updatedAt || initiative?.updated_at || new Date().toISOString()),
  };
}

export function upsertPortfolioInitiative(
  list: PortfolioInitiative[],
  initiative: PortfolioInitiative | null
): PortfolioInitiative[] {
  if (!initiative) return list;
  const withoutCurrent = list.filter((item) => item.id !== initiative.id);
  return [initiative, ...withoutCurrent];
}

export function getCreatedInitiativeRevealState(
  current: InitiativeCreateRevealState,
  createdStatus: string | null | undefined
): InitiativeCreateRevealState {
  const normalizedStatus = String(createdStatus || '').toUpperCase();
  if (!normalizedStatus) return current;

  const status = normalizedStatus as InitiativeStatus;

  if (current.activeStatusFilter && current.activeStatusFilter.toUpperCase() !== normalizedStatus) {
    return {
      scope: 'all',
      activeStatusFilter: status,
    };
  }

  if (current.scope === 'active' && !ACTIVE_STATUSES.includes(status)) {
    return {
      scope: 'all',
      activeStatusFilter: status,
    };
  }

  return current;
}
