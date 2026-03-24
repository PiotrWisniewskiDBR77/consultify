import { getDatabase } from '../database/index.js';
import AiService from '../services/aiService.js';
import * as auditLogger from '../utils/auditLogger.js';
import AIContextBuilder from './aiContextBuilder.js';
import RecommendationEngine from './recommendationEngine.js';
import SignalEngine from './signalEngine.js';
import SimulationEngineClass from './simulationEngine.js';
const db = getDatabase();

const SimulationEngine = new SimulationEngineClass();

/**
 * AICoach Facade
 * Orchestrates the AI Advisor pipeline:
 * Context -> Signals -> Recommendations -> Simulation
 */
const AICoach: {
  deps: {
    AIContextBuilder: typeof AIContextBuilder;
    SignalEngine: typeof SignalEngine;
    RecommendationEngine: typeof RecommendationEngine;
    SimulationEngine: typeof SimulationEngine;
  };
  setDependencies: (newDeps: Partial<typeof AICoach.deps>) => void;
  getAdvisoryReport: (orgId: string) => Promise<unknown>;
  _calculateHealthScore: (context: any, signals: Array<{ severity: string }>) => number;
} = {
  // Dependencies wrapper for injection
  deps: {
    AIContextBuilder,
    SignalEngine,
    RecommendationEngine,
    SimulationEngine,
  },

  /**
   * Override dependencies for testing
   * @param {Object} newDeps - Partial dependency object to merge
   */
  setDependencies(newDeps: Partial<typeof AICoach.deps>): void {
    Object.assign(this.deps, newDeps);
  },

  /**
   * Gets a full health report for the organization.
   * @param {string} orgId - The organization ID.
   * @returns {Promise<Object>} The full advisory report.
   */
  getAdvisoryReport: async (orgId: string) => {
    // 1. Build Context
    const context = await AICoach.deps.AIContextBuilder.buildContext(orgId);

    // 2. Detect Signals
    const signals = AICoach.deps.SignalEngine.detectSignals(context);

    // 3. Generate Recommendations
    const recommendations =
      await AICoach.deps.RecommendationEngine.generateRecommendations(signals);

    // 4. Simulate Impacts
    const simulations = AICoach.deps.SimulationEngine.simulateImpacts(recommendations);

    return {
      orgId,
      orgName: context.orgName,
      timestamp: context.timestamp,
      summary: {
        task_count: context.data.task_distribution.total,
        active_initiatives: context.data.initiative_status.length,
        health_score: AICoach._calculateHealthScore(context, signals),
      },
      signals,
      recommendations,
      simulations,
      context_snapshot: context.data, // For audit/verification
      audit: {
        context_id: context.timestamp, // In real system, would be a UUID
        data_sources: [
          'tasks',
          'initiatives',
          'help_events',
          'metrics_events',
          'organization_events',
          ...(context.data?.organization_context_os ? ['organization_context_os'] : []),
        ],
        version: '1.0.0-governed',
      },
    };
  },

  /**
   * Simple health score calculation (0-100)
   */
  _calculateHealthScore: (context: any, signals: Array<{ severity: string }>) => {
    let score = 100;

    // Penalty for high-severity signals
    signals.forEach((s: { severity: string }) => {
      if (s.severity === 'CRITICAL') score -= 15;
      if (s.severity === 'HIGH') score -= 10;
      if (s.severity === 'MEDIUM') score -= 5;
    });

    // Penalties for blocked initiatives
    const blockedCount = context.data.initiative_status.filter(
      (i: { is_blocked: boolean }) => i.is_blocked
    ).length;
    score -= blockedCount * 5;

    return Math.max(0, score);
  },
};

export default AICoach;
