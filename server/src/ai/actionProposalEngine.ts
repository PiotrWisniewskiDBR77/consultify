// @ts-nocheck
import { getDatabase } from '../database/index.js';
// PolicyEngine is imported lazily if needed in the future
// const PolicyEngine = await import('./policyEngine.js');
import * as auditLogger from '../utils/auditLogger.js';
import ActionProposalMapper from './actionProposalMapper.js';
import RecommendationEngine from './recommendationEngine.js';
import SignalEngine from './signalEngine.js';
import SimulationEngine from './simulationEngine.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

import AiService from '../services/aiService.js';

interface ActionProposal {
  proposal_id: string;
  [key: string]: unknown;
}

interface Signal {
  type: string;
  entity_id: string;
  [key: string]: unknown;
}

interface Recommendation {
  signal_type: string;
  entity_id: string;
  title: string;
  [key: string]: unknown;
}

interface Simulation {
  recommendation_title: string;
  [key: string]: unknown;
}

/**
 * ActionProposalEngine
 * Transforms AI Signals into human-readable Action Proposals.
 * Deterministic and read-only.
 */
const ActionProposalEngine = {
  /**
   * Generates action proposals for a given organization context.
   * @param {Object} context - The AI_CONTEXT snapshot.
   * @returns {Array<Object>} List of final action proposals.
   */
  generateProposals: (context: unknown): ActionProposal[] => {
    // 1. Detect Signals
    const signals = SignalEngine.detectSignals(context) as Signal[];

    // 2. Map Signals to Recommendations
    const recommendations = RecommendationEngine.generateRecommendations(
      signals
    ) as Recommendation[];

    // 3. Simulate Impacts for recommendations - create instance
    const simulationEngine = new SimulationEngine();
    const simulations = simulationEngine.simulateImpacts(recommendations) as Simulation[];

    const allProposals: ActionProposal[] = [];

    // 4. Map everything to Action Proposals
    signals.forEach((signal) => {
      // Find associated recommendation and simulation for this signal
      const relevantRec = recommendations.find(
        (r: Recommendation) => r.signal_type === signal.type && r.entity_id === signal.entity_id
      );
      const relevantSim = simulations.find(
        (s: Simulation) => s.recommendation_title === relevantRec?.title
      );

      const proposals = ActionProposalMapper.mapSignalToProposals(signal, relevantRec, relevantSim);

      if (proposals && proposals.length > 0) {
        allProposals.push(...proposals);
      }
    });

    // Ensure deterministic output (sort by proposal_id)
    return allProposals.sort((a, b) => a.proposal_id.localeCompare(b.proposal_id));
  },

  /**
   * Gets a specific proposal by ID for server-side verification.
   * @param {string} orgId - The organization ID.
   * @param {string} proposalId - The target proposal ID.
   * @returns {Promise<Object|null>} The proposal if found.
   */
  getProposalById: async (orgId: string, proposalId: string): Promise<ActionProposal | null> => {
    // In a real system, we'd build context first.
    // For simplicity, we use the AICoach to get all proposals and filter.
    const AICoach = require('./aiCoach');
    const report = await AICoach.getAdvisoryReport(orgId);
    const proposals = ActionProposalEngine.generateProposals({ data: report.context_snapshot });

    return proposals.find((p) => p.proposal_id === proposalId) || null;
  },
};

export async function executeProposedAction({
  action,
  userId,
  organizationId,
}: {
  action: any;
  userId: string;
  organizationId: string;
}): Promise<Record<string, unknown>> {
  const actionType = String(action?.actionType || action?.type || 'custom');
  const params = action?.params || {};

  switch (actionType) {
    case 'create_task': {
      const taskId = `task_${uuidv4()}`;
      const title = String(params.title || action.label || 'AI proposed task');
      const description = params.description ? String(params.description) : null;
      const status = String(params.status || 'todo');
      const priority = String(params.priority || 'medium');
      const assigneeId = params.assigneeId ? String(params.assigneeId) : null;

      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO tasks (id, organization_id, title, description, status, priority, assignee_id, created_by, updated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [taskId, organizationId, title, description, status, priority, assigneeId, userId, userId],
          (err: any) => (err ? reject(err) : resolve()),
        );
      });

      return { success: true, actionType, taskId, created: true };
    }
    case 'update_status': {
      const targetId = String(params.taskId || params.id || '');
      const status = String(params.status || '');
      if (!targetId || !status) {
        throw new Error('update_status requires taskId and status');
      }

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE tasks SET status = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`,
          [status, userId, targetId, organizationId],
          (err: any) => (err ? reject(err) : resolve()),
        );
      });

      return { success: true, actionType, taskId: targetId, status };
    }
    case 'assign_user': {
      const targetId = String(params.taskId || params.id || '');
      const assigneeId = String(params.assigneeId || params.userId || '');
      if (!targetId || !assigneeId) {
        throw new Error('assign_user requires taskId and assigneeId');
      }

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE tasks SET assignee_id = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`,
          [assigneeId, userId, targetId, organizationId],
          (err: any) => (err ? reject(err) : resolve()),
        );
      });

      return { success: true, actionType, taskId: targetId, assigneeId };
    }
    case 'set_field': {
      const targetId = String(params.taskId || params.id || '');
      const field = String(params.field || '');
      const value = params.value;
      if (!targetId || !field) {
        throw new Error('set_field requires taskId and field');
      }

      const existingTask = await new Promise<any>((resolve, reject) => {
        db.get(
          `SELECT custom_fields_json FROM tasks WHERE id = ? AND organization_id = ?`,
          [targetId, organizationId],
          (err: any, row: any) => (err ? reject(err) : resolve(row || null)),
        );
      });

      const customFields = existingTask?.custom_fields_json
        ? JSON.parse(existingTask.custom_fields_json)
        : {};
      customFields[field] = value;

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE tasks SET custom_fields_json = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`,
          [JSON.stringify(customFields), userId, targetId, organizationId],
          (err: any) => (err ? reject(err) : resolve()),
        );
      });

      return { success: true, actionType, taskId: targetId, field, value };
    }
    default:
      return {
        success: false,
        actionType,
        queued: true,
        message: 'Action type not yet executable; kept as proposal only',
      };
  }
}

export default ActionProposalEngine;
