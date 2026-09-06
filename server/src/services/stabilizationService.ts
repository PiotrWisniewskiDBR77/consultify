// Stabilization Service - Phase 6 management
// Step 6: Stabilization, Reporting & Economics

import { v4 as uuidv4 } from 'uuid';

import * as DbPromise from '../utils/DbPromise.js';

export const STABILIZATION_STATUSES = {
  STABILIZED: 'STABILIZED',
  PARTIALLY_STABILIZED: 'PARTIALLY_STABILIZED',
  UNSTABLE: 'UNSTABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;

type StabilizationStatus = (typeof STABILIZATION_STATUSES)[keyof typeof STABILIZATION_STATUSES];

type CriteriaItem = {
  criterion: string;
  isMet: boolean;
  evidence: string;
};

type InitiativeStats = {
  total: number;
  closed: number;
};

type ValueStats = {
  total: number;
  validated: number;
};

const StabilizationService = {
  STABILIZATION_STATUSES,

  checkEntryCriteria: async (
    projectId: string
  ): Promise<{
    projectId: string;
    canEnterStabilization: boolean;
    completionCriteria: CriteriaItem[];
  }> => {
    const criteria: CriteriaItem[] = [];
    let allMet = true;

    const criticalIncomplete = await DbPromise.get<{ count?: number }>(
      `SELECT COUNT(*) as count FROM initiatives 
             -- DEC-424 (P12-int-c): 'COMPLETED'/'CANCELLED' never valid for initiatives; słownik 7 terminal = CLOSED/REJECTED.
             WHERE project_id = ? AND is_critical_path = 1 AND status NOT IN ('CLOSED', 'REJECTED')`,
      [projectId]
    );
    const criticalCount = criticalIncomplete?.count || 0;

    criteria.push({
      criterion: 'Critical initiatives completed',
      isMet: criticalCount === 0,
      evidence:
        criticalCount === 0
          ? 'All critical initiatives done'
          : `${criticalCount} critical initiatives pending`,
    });
    if (criticalCount > 0) allMet = false;

    const blockingDecisions = await DbPromise.get<{ count?: number }>(
      `SELECT COUNT(*) as count FROM decisions 
             WHERE project_id = ? AND status = 'PENDING' AND required = 1`,
      [projectId]
    );
    const blockingCount = blockingDecisions?.count || 0;

    criteria.push({
      criterion: 'No unresolved blocking decisions',
      isMet: blockingCount === 0,
      evidence:
        blockingCount === 0
          ? 'All required decisions resolved'
          : `${blockingCount} pending decisions`,
    });
    if (blockingCount > 0) allMet = false;

    const initiativeStats = await DbPromise.get<InitiativeStats>(
      `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('CLOSED', 'REJECTED') THEN 1 ELSE 0 END) as closed
             FROM initiatives WHERE project_id = ?`,
      [projectId]
    );

    const totalInitiatives = initiativeStats?.total || 0;
    const closedInitiatives = initiativeStats?.closed || 0;
    const completionRate =
      totalInitiatives > 0 ? Math.round((closedInitiatives / totalInitiatives) * 100) : 0;

    criteria.push({
      criterion: 'Roadmap execution ≥80% complete',
      isMet: completionRate >= 80,
      evidence: `${completionRate}% initiatives closed`,
    });
    if (completionRate < 80) allMet = false;

    return {
      projectId,
      canEnterStabilization: allMet,
      completionCriteria: criteria,
    };
  },

  setStabilizationStatus: async (
    initiativeId: string,
    status: StabilizationStatus,
    _userId: string
  ): Promise<{ updated: boolean; initiativeId: string; status: StabilizationStatus }> => {
    if (!Object.values(STABILIZATION_STATUSES).includes(status)) {
      throw new Error(`Invalid stabilization status: ${status}`);
    }

    const result = await DbPromise.run(
      `UPDATE initiatives SET stabilization_status = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
      [status, initiativeId],
      { fallback: false }
    );

    return { updated: (result.changes || 0) > 0, initiativeId, status };
  },

  getStabilizationSummary: async (
    projectId: string
  ): Promise<{
    stabilized: number;
    partiallyStabilized: number;
    unstable: number;
    notApplicable: number;
  }> => {
    const rows = await DbPromise.all<{ stabilization_status?: string; count?: number }>(
      `SELECT stabilization_status, COUNT(*) as count 
             FROM initiatives WHERE project_id = ? AND status = 'COMPLETED'
             GROUP BY stabilization_status`,
      [projectId]
    );

    const summary = {
      stabilized: 0,
      partiallyStabilized: 0,
      unstable: 0,
      notApplicable: 0,
    };

    (rows || []).forEach((row) => {
      switch (row.stabilization_status) {
        case STABILIZATION_STATUSES.STABILIZED:
          summary.stabilized = row.count || 0;
          break;
        case STABILIZATION_STATUSES.PARTIALLY_STABILIZED:
          summary.partiallyStabilized = row.count || 0;
          break;
        case STABILIZATION_STATUSES.UNSTABLE:
          summary.unstable = row.count || 0;
          break;
        default:
          summary.notApplicable = row.count || 0;
      }
    });

    return summary;
  },

  checkExitCriteria: async (
    projectId: string
  ): Promise<{
    projectId: string;
    canCloseProject: boolean;
    completionCriteria: CriteriaItem[];
  }> => {
    const criteria: CriteriaItem[] = [];
    let allMet = true;

    const unstableCountRow = await DbPromise.get<{ count?: number }>(
      `SELECT COUNT(*) as count FROM initiatives 
             WHERE project_id = ? AND stabilization_status = 'UNSTABLE'`,
      [projectId]
    );
    const unstableCount = unstableCountRow?.count || 0;

    criteria.push({
      criterion: 'No unstable initiatives',
      isMet: unstableCount === 0,
      evidence:
        unstableCount === 0 ? 'All initiatives stable' : `${unstableCount} unstable initiatives`,
    });
    if (unstableCount > 0) allMet = false;

    const valueStats = await DbPromise.get<ValueStats>(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_validated = 1 THEN 1 ELSE 0 END) as validated
             FROM value_hypotheses WHERE project_id = ?`,
      [projectId]
    );

    const totalHypotheses = valueStats?.total || 0;
    const validatedHypotheses = valueStats?.validated || 0;

    criteria.push({
      criterion: 'Value hypotheses reviewed',
      isMet: totalHypotheses === 0 || validatedHypotheses === totalHypotheses,
      evidence: `${validatedHypotheses}/${totalHypotheses} hypotheses validated`,
    });
    if (totalHypotheses > 0 && validatedHypotheses < totalHypotheses) allMet = false;

    return {
      projectId,
      canCloseProject: allMet,
      completionCriteria: criteria,
    };
  },

  closeProject: async (
    projectId: string,
    closureType: string,
    userId: string,
    lessonsLearned: string | null = null
  ): Promise<{
    closureId: string;
    projectId: string;
    closureType: string;
    initiativeStats: { total: number; completed: number; cancelled: number };
    valueStats: { total: number; validated: number };
  }> => {
    const stats = await DbPromise.get<{ total?: number; completed?: number; cancelled?: number }>(
      `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as cancelled
             FROM initiatives WHERE project_id = ?`,
      [projectId]
    );

    const valueStats = await DbPromise.get<ValueStats>(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_validated = 1 THEN 1 ELSE 0 END) as validated
             FROM value_hypotheses WHERE project_id = ?`,
      [projectId]
    );

    const closureId = uuidv4();
    const initiativeStats = {
      total: stats?.total || 0,
      completed: stats?.completed || 0,
      cancelled: stats?.cancelled || 0,
    };
    const finalValueStats = {
      total: valueStats?.total || 0,
      validated: valueStats?.validated || 0,
    };

    await DbPromise.run(
      `INSERT INTO project_closures 
                (id, project_id, closure_type, closed_by, lessons_learned, final_status,
                 total_initiatives, completed_initiatives, cancelled_initiatives,
                 value_hypotheses_validated, value_hypotheses_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        closureId,
        projectId,
        closureType,
        userId,
        lessonsLearned,
        closureType === 'COMPLETED' ? 'SUCCESS' : 'TERMINATED',
        initiativeStats.total,
        initiativeStats.completed,
        initiativeStats.cancelled,
        finalValueStats.validated,
        finalValueStats.total,
      ],
      { fallback: false }
    );

    await DbPromise.run(
      'UPDATE projects SET is_closed = 1, closed_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?',
      [closureType, projectId],
      { fallback: false }
    );

    return {
      closureId,
      projectId,
      closureType,
      initiativeStats,
      valueStats: finalValueStats,
    };
  },
};

export default StabilizationService;
