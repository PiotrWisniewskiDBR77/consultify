/**
 * Demo data for all 6 Manager lanes.
 * Returns realistic sample analysis when real heuristics produce no observations
 * (e.g. empty database, no tasks/initiatives loaded).
 */

import type { LaneAnalysis, ObservationItem, InsightItem, EffectItem, SuggestionItem, DecisionItem, ExecutionPlanItem } from './types.js';

type LaneId = 'action-queue' | 'decisions' | 'blockers' | 'workload' | 'risk' | 'people-change';

// ---------------------------------------------------------------------------
// Action Queue
// ---------------------------------------------------------------------------

function demoActionQueue(): LaneAnalysis {
  const obs: ObservationItem[] = [
    { id: 'demo-aq-obs-1', metric: '12 overdue tasks (oldest: 21 days)', scope: 'portfolio', since: '2026-03-12', trend: 'rising', severity: 'critical' },
    { id: 'demo-aq-obs-2', metric: '5 tasks without due date', scope: 'portfolio', trend: 'stable', severity: 'warning' },
    { id: 'demo-aq-obs-3', metric: '3 unassigned tasks in active initiatives', scope: 'task', trend: 'stable', severity: 'warning' },
    { id: 'demo-aq-obs-4', metric: '2 overdue decisions blocking downstream', scope: 'decision', trend: 'rising', severity: 'critical', entityName: 'Budget Approval Q2' },
    { id: 'demo-aq-obs-5', metric: '4 KPI deviations without recovery plan', scope: 'portfolio', trend: 'rising', severity: 'warning' },
    { id: 'demo-aq-obs-6', metric: '7 stale items (no update ≥14 days)', scope: 'portfolio', trend: 'stable', severity: 'info' },
  ];

  const ins: InsightItem[] = [
    { id: 'demo-aq-ins-1', observationIds: ['demo-aq-obs-1', 'demo-aq-obs-3'], interpretation: 'Overdue pattern concentrates on Team Alpha (8 of 12 tasks) — likely capacity-driven, not prioritization issue', isSystemic: true, requiresAction: true, confidence: 'high' },
    { id: 'demo-aq-ins-2', observationIds: ['demo-aq-obs-4'], interpretation: '2 decisions overdue >10 days — blocking "Cloud Migration" and "Data Platform" initiatives', isSystemic: false, requiresAction: true, confidence: 'high' },
    { id: 'demo-aq-ins-3', observationIds: ['demo-aq-obs-2', 'demo-aq-obs-6'], interpretation: 'Planning discipline declining — more tasks lack dates and 7 items are stale', isSystemic: true, requiresAction: true, confidence: 'medium' },
  ];

  const eff: EffectItem[] = [
    { id: 'demo-aq-eff-1', insightId: 'demo-aq-ins-1', consequence: 'Milestone M3 (API release) shifts by ≥2 weeks, affecting 4 downstream tasks', blastRadius: 6, timelineImpact: '+14 days on M3', costImpact: '~15K EUR delay cost', affectedEntities: [{ id: 'e1', name: 'Cloud Migration', type: 'initiative' }, { id: 'e2', name: 'API Gateway v2', type: 'task' }] },
    { id: 'demo-aq-eff-2', insightId: 'demo-aq-ins-2', consequence: 'Budget Approval delay stalls procurement for Data Platform — vendor SLA risk', blastRadius: 3, timelineImpact: '+7 days per week of delay' },
    { id: 'demo-aq-eff-3', insightId: 'demo-aq-ins-3', consequence: 'Growing hidden backlog — true delivery date becomes unreliable', blastRadius: 5 },
  ];

  const sug: SuggestionItem[] = [
    { id: 'demo-aq-sug-1', action: 'Assign owners to 3 unassigned tasks', reason: 'Unassigned tasks cannot be tracked for delivery', expectedOutcome: 'Clear ownership, better progress visibility', cost: 'Low', feasibility: 'immediate', requiresApproval: false, category: 'operational' },
    { id: 'demo-aq-sug-2', action: 'Set due dates for 5 dateless tasks', reason: 'Missing dates prevent delay detection', expectedOutcome: 'Enables forecasting and alerts', cost: 'Low', feasibility: 'immediate', requiresApproval: false, category: 'operational' },
    { id: 'demo-aq-sug-3', action: 'Escalate 2 overdue decisions to CFO', reason: 'Budget decisions are blocking two major initiatives', expectedOutcome: 'Unblock Cloud Migration and Data Platform within 48h', cost: 'Low', feasibility: 'manager_decision', requiresApproval: true, category: 'governance' },
    { id: 'demo-aq-sug-4', action: 'Reassign 4 overdue tasks from Team Alpha to Team Beta', reason: 'Team Alpha at 140% capacity; Team Beta at 65%', expectedOutcome: 'Balance workload, recover 8+ overdue days', cost: 'Medium', feasibility: 'manager_decision', requiresApproval: true, category: 'operational' },
    { id: 'demo-aq-sug-5', action: 'Reduce scope of Q2 deliverables by 15%', reason: 'Current capacity cannot absorb overdue backlog without scope cut', expectedOutcome: 'Realistic delivery plan, reduced team stress', cost: 'High', feasibility: 'leadership_decision', requiresApproval: true, category: 'governance' },
  ];

  const dec: DecisionItem[] = [
    { id: 'demo-aq-dec-1', suggestionId: 'demo-aq-sug-1', state: 'approved', decidedBy: 'Anna Kowalska', decidedAt: '2026-04-02', notes: 'Assign to sprint 14 owners' },
    { id: 'demo-aq-dec-2', suggestionId: 'demo-aq-sug-3', state: 'pending_approval', notes: 'Waiting for PMO review' },
    { id: 'demo-aq-dec-3', suggestionId: 'demo-aq-sug-4', state: 'proposed' },
  ];

  const exec: ExecutionPlanItem[] = [
    { id: 'demo-aq-ep-1', decisionId: 'demo-aq-dec-1', tasks: [
      { title: 'Assign API Gateway task to M. Nowak', owner: 'PM Lead', deadline: '2026-04-04', status: 'done' },
      { title: 'Assign Data Pipeline task to K. Wiśniewska', owner: 'PM Lead', deadline: '2026-04-04', status: 'done' },
      { title: 'Assign Testing task to J. Zieliński', owner: 'PM Lead', deadline: '2026-04-05', status: 'in_progress' },
    ], beforeState: '3 tasks unassigned, no owner accountability', afterState: '3 tasks assigned to named owners with deadlines', verificationStatus: 'in_progress' },
  ];

  return { observations: obs, insights: ins, effects: eff, suggestions: sug, decisions: dec, executionPlan: exec, severity: 'critical', confidence: 'high', lastRefreshed: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Decisions & Approvals
// ---------------------------------------------------------------------------

function demoDecisions(): LaneAnalysis {
  const obs: ObservationItem[] = [
    { id: 'demo-dec-obs-1', metric: '8 pending decisions', scope: 'decision', trend: 'rising', severity: 'warning' },
    { id: 'demo-dec-obs-2', metric: '3 decisions overdue (oldest: 18 days)', scope: 'decision', trend: 'rising', severity: 'critical' },
    { id: 'demo-dec-obs-3', metric: 'Average decision latency: 11 days', scope: 'portfolio', trend: 'rising', severity: 'warning' },
    { id: 'demo-dec-obs-4', metric: '2 decisions without assigned approver', scope: 'decision', trend: 'stable', severity: 'warning' },
    { id: 'demo-dec-obs-5', metric: '5 initiatives blocked by pending decisions', scope: 'initiative', trend: 'rising', severity: 'critical', entityName: 'Cloud Migration' },
  ];

  const ins: InsightItem[] = [
    { id: 'demo-dec-ins-1', observationIds: ['demo-dec-obs-2', 'demo-dec-obs-3'], interpretation: 'Decision bottleneck: CFO office has 3 overdue approvals — governance cycle too slow for execution pace', isSystemic: true, requiresAction: true, confidence: 'high' },
    { id: 'demo-dec-ins-2', observationIds: ['demo-dec-obs-4'], interpretation: '2 orphaned decisions have no approver assigned — they will never resolve without intervention', isSystemic: false, requiresAction: true, confidence: 'high' },
    { id: 'demo-dec-ins-3', observationIds: ['demo-dec-obs-1', 'demo-dec-obs-5'], interpretation: 'Decision queue growing faster than resolution rate — 5 initiatives stalled', isSystemic: true, requiresAction: true, confidence: 'medium' },
  ];

  const eff: EffectItem[] = [
    { id: 'demo-dec-eff-1', insightId: 'demo-dec-ins-1', consequence: '5 initiatives stalled; estimated €45K/week in delay costs', blastRadius: 8, timelineImpact: '+11 days average per blocked initiative', costImpact: '~€45K/week' },
    { id: 'demo-dec-eff-2', insightId: 'demo-dec-ins-2', consequence: 'Vendor contract renewal decision unresolved — risk of service gap', blastRadius: 2, timelineImpact: 'Critical by Apr 15' },
  ];

  const sug: SuggestionItem[] = [
    { id: 'demo-dec-sug-1', action: 'Assign approver to 2 orphaned decisions', reason: 'No approver = no resolution path', expectedOutcome: 'Clear ownership for each pending decision', cost: 'Low', feasibility: 'immediate', requiresApproval: false, category: 'governance' },
    { id: 'demo-dec-sug-2', action: 'Request missing materials for Budget Approval Q2', reason: 'Decision stalled due to incomplete business case', expectedOutcome: 'Approver can decide within 48h of receiving materials', cost: 'Low', feasibility: 'immediate', requiresApproval: false, category: 'governance' },
    { id: 'demo-dec-sug-3', action: 'Assign substitute approver for CFO decisions', reason: 'CFO is the bottleneck with 3 overdue items', expectedOutcome: 'Delegate to VP Finance for items under €50K', cost: 'Low', feasibility: 'manager_decision', requiresApproval: true, category: 'governance' },
    { id: 'demo-dec-sug-4', action: 'Introduce weekly decision review cadence', reason: 'Ad-hoc cadence causes 11-day average latency', expectedOutcome: 'Reduce decision latency to <5 days', cost: 'Medium', feasibility: 'leadership_decision', requiresApproval: true, category: 'governance' },
  ];

  const dec: DecisionItem[] = [
    { id: 'demo-dec-dec-1', suggestionId: 'demo-dec-sug-1', state: 'approved', decidedBy: 'PMO Director', decidedAt: '2026-04-01' },
    { id: 'demo-dec-dec-2', suggestionId: 'demo-dec-sug-3', state: 'proposed' },
  ];

  const exec: ExecutionPlanItem[] = [
    { id: 'demo-dec-ep-1', decisionId: 'demo-dec-dec-1', tasks: [
      { title: 'Assign VP Finance to Vendor Contract decision', owner: 'PMO', deadline: '2026-04-04', status: 'done' },
      { title: 'Assign CTO to Technical Architecture decision', owner: 'PMO', deadline: '2026-04-04', status: 'in_progress' },
    ], beforeState: '2 decisions without approver', afterState: 'Both decisions have named approvers', verificationStatus: 'in_progress' },
  ];

  return { observations: obs, insights: ins, effects: eff, suggestions: sug, decisions: dec, executionPlan: exec, severity: 'critical', confidence: 'high', lastRefreshed: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Blockers & Escalations
// ---------------------------------------------------------------------------

function demoBlockers(): LaneAnalysis {
  const obs: ObservationItem[] = [
    { id: 'demo-blk-obs-1', metric: '6 blocked initiatives', scope: 'initiative', trend: 'rising', severity: 'critical' },
    { id: 'demo-blk-obs-2', metric: '4 dependency-blocked items', scope: 'initiative', trend: 'stable', severity: 'warning', entityName: 'API Gateway depends on Auth Service' },
    { id: 'demo-blk-obs-3', metric: '2 decision-blocked items', scope: 'decision', trend: 'rising', severity: 'critical' },
    { id: 'demo-blk-obs-4', metric: '3 blocked items also overdue', scope: 'portfolio', trend: 'rising', severity: 'critical' },
    { id: 'demo-blk-obs-5', metric: '1 external blocker (vendor delay)', scope: 'portfolio', trend: 'stable', severity: 'warning', entityName: 'SAP integration pending vendor hotfix' },
    { id: 'demo-blk-obs-6', metric: '8 critical/high risk signals active', scope: 'portfolio', trend: 'rising', severity: 'critical' },
  ];

  const ins: InsightItem[] = [
    { id: 'demo-blk-ins-1', observationIds: ['demo-blk-obs-1', 'demo-blk-obs-2', 'demo-blk-obs-3'], interpretation: 'Mixed blocker root causes: 4 dependency + 2 decision — both operational and governance resolution needed', isSystemic: true, requiresAction: true, confidence: 'high' },
    { id: 'demo-blk-ins-2', observationIds: ['demo-blk-obs-4'], interpretation: '3 blocked items are also overdue — compounding delay effect', isSystemic: false, requiresAction: true, confidence: 'high' },
    { id: 'demo-blk-ins-3', observationIds: ['demo-blk-obs-5'], interpretation: 'SAP vendor hotfix ETA unknown — external dependency with no workaround yet', isSystemic: false, requiresAction: true, confidence: 'low' },
  ];

  const eff: EffectItem[] = [
    { id: 'demo-blk-eff-1', insightId: 'demo-blk-ins-1', consequence: '14 downstream tasks at risk from 6 blocked initiatives', blastRadius: 14, timelineImpact: 'Portfolio milestone Q2 at risk', affectedEntities: [{ id: 'i1', name: 'Cloud Migration', type: 'initiative' }, { id: 'i2', name: 'Data Platform', type: 'initiative' }, { id: 'i3', name: 'API Gateway v2', type: 'initiative' }] },
    { id: 'demo-blk-eff-2', insightId: 'demo-blk-ins-3', consequence: 'SAP integration slip → ERP go-live shifts to Q3', blastRadius: 5, timelineImpact: '+6-8 weeks', costImpact: '~€80K additional vendor costs' },
  ];

  const sug: SuggestionItem[] = [
    { id: 'demo-blk-sug-1', action: 'Unblock Auth Service → API Gateway dependency by shipping Auth v1.1 early', reason: 'Auth Service blocker affects 3 downstream items', expectedOutcome: '3 items unblocked within 5 days', cost: 'Medium', feasibility: 'immediate', requiresApproval: false, category: 'operational' },
    { id: 'demo-blk-sug-2', action: 'Create workaround for SAP integration (mock API + later sync)', reason: 'Vendor ETA unknown — cannot wait indefinitely', expectedOutcome: 'Decouple ERP go-live from vendor hotfix timeline', cost: 'High', feasibility: 'manager_decision', requiresApproval: true, category: 'operational' },
    { id: 'demo-blk-sug-3', action: 'Escalate 2 decision-blocked items to Steering Committee', reason: 'Decisions overdue >10 days with no movement', expectedOutcome: 'Forced resolution within governance cycle', cost: 'Low', feasibility: 'manager_decision', requiresApproval: true, category: 'governance' },
    { id: 'demo-blk-sug-4', action: 'Create formal risk response plan for blocked portfolio segment', reason: '6 blocked items is systemic — needs structured recovery', expectedOutcome: 'Coordinated unblock across multiple root causes', cost: 'High', feasibility: 'manager_decision', requiresApproval: true, category: 'governance' },
    { id: 'demo-blk-sug-5', action: 'Accept scope reduction for "Legacy Decommission" initiative', reason: 'Lowest-priority blocked item — unblocking it requires disproportionate effort', expectedOutcome: 'Focus recovery on highest-value items', cost: 'High', feasibility: 'leadership_decision', requiresApproval: true, category: 'governance' },
  ];

  const dec: DecisionItem[] = [
    { id: 'demo-blk-dec-1', suggestionId: 'demo-blk-sug-1', state: 'approved', decidedBy: 'Tech Lead', decidedAt: '2026-04-02' },
    { id: 'demo-blk-dec-2', suggestionId: 'demo-blk-sug-2', state: 'pending_approval', notes: 'CTO reviewing workaround feasibility' },
  ];

  const exec: ExecutionPlanItem[] = [
    { id: 'demo-blk-ep-1', decisionId: 'demo-blk-dec-1', tasks: [
      { title: 'Cherry-pick Auth v1.1 fixes into release branch', owner: 'Dev Lead', deadline: '2026-04-05', status: 'in_progress' },
      { title: 'Run integration test suite for Auth+API', owner: 'QA Lead', deadline: '2026-04-06', status: 'pending' },
      { title: 'Deploy Auth v1.1 to staging', owner: 'DevOps', deadline: '2026-04-07', status: 'pending' },
    ], beforeState: '3 items blocked by Auth Service dependency', afterState: 'Auth v1.1 deployed, dependencies resolved', verificationStatus: 'in_progress' },
  ];

  return { observations: obs, insights: ins, effects: eff, suggestions: sug, decisions: dec, executionPlan: exec, severity: 'critical', confidence: 'medium', lastRefreshed: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Resource & Workload
// ---------------------------------------------------------------------------

function demoWorkload(): LaneAnalysis {
  const obs: ObservationItem[] = [
    { id: 'demo-wl-obs-1', metric: 'Marek Nowak: 18 tasks (12 in progress)', scope: 'owner', trend: 'rising', severity: 'critical', entityName: 'Marek Nowak' },
    { id: 'demo-wl-obs-2', metric: 'Anna Zielińska: 15 tasks (9 in progress)', scope: 'owner', trend: 'rising', severity: 'critical', entityName: 'Anna Zielińska' },
    { id: 'demo-wl-obs-3', metric: 'Katarzyna Wójcik: 3 tasks (1 in progress)', scope: 'owner', trend: 'stable', severity: 'info', entityName: 'Katarzyna Wójcik' },
    { id: 'demo-wl-obs-4', metric: '4 capacity leveling alerts active', scope: 'team', trend: 'rising', severity: 'warning' },
    { id: 'demo-wl-obs-5', metric: '9 unassigned tasks in active initiatives', scope: 'portfolio', trend: 'stable', severity: 'warning' },
    { id: 'demo-wl-obs-6', metric: '23 tasks without time estimates', scope: 'portfolio', trend: 'stable', severity: 'warning' },
  ];

  const ins: InsightItem[] = [
    { id: 'demo-wl-ins-1', observationIds: ['demo-wl-obs-1', 'demo-wl-obs-2', 'demo-wl-obs-3'], interpretation: 'Workload imbalance: 2 people overloaded (15-18 tasks) while 1 has capacity (3 tasks) — reallocation potential exists', isSystemic: true, requiresAction: true, confidence: 'high' },
    { id: 'demo-wl-ins-2', observationIds: ['demo-wl-obs-1'], interpretation: 'Marek Nowak at 180% capacity — structural overload, not temporary spike', isSystemic: false, requiresAction: true, confidence: 'high' },
    { id: 'demo-wl-ins-3', observationIds: ['demo-wl-obs-6'], interpretation: 'Over 35% of tasks lack estimates — overload analysis may be significantly understated', isSystemic: true, requiresAction: true, confidence: 'low' },
  ];

  const eff: EffectItem[] = [
    { id: 'demo-wl-eff-1', insightId: 'demo-wl-ins-1', consequence: 'Overloaded team members risk slippage on 21 in-progress tasks', blastRadius: 21, timelineImpact: '+1-2 weeks on overloaded work', affectedEntities: [{ id: 'p1', name: 'Marek Nowak', type: 'owner' }, { id: 'p2', name: 'Anna Zielińska', type: 'owner' }] },
    { id: 'demo-wl-eff-2', insightId: 'demo-wl-ins-2', consequence: 'Burnout risk for Marek Nowak — quality degradation and potential attrition', blastRadius: 18, costImpact: 'Replacement cost ~3 month salary if attrition' },
  ];

  const sug: SuggestionItem[] = [
    { id: 'demo-wl-sug-1', action: 'Reassign 5 tasks from Marek to Katarzyna', reason: 'Katarzyna at 30% capacity; Marek at 180%', expectedOutcome: 'Marek drops to ~130%, Katarzyna rises to ~80%', cost: 'Low', feasibility: 'immediate', requiresApproval: false, category: 'operational' },
    { id: 'demo-wl-sug-2', action: 'Add time estimates to 23 tasks', reason: 'Without estimates, capacity planning is unreliable', expectedOutcome: 'Accurate workload visibility and leveling', cost: 'Low', feasibility: 'immediate', requiresApproval: false, category: 'operational' },
    { id: 'demo-wl-sug-3', action: 'Reduce WIP limit to 8 tasks per person', reason: 'Multiple people above 15 tasks — context-switching kills productivity', expectedOutcome: 'Focus on completion over starting new work', cost: 'Medium', feasibility: 'manager_decision', requiresApproval: true, category: 'operational' },
    { id: 'demo-wl-sug-4', action: 'Smooth Q2 delivery schedule — defer 6 lower-priority tasks to Q3', reason: 'Current quarter has demand spike beyond team capacity', expectedOutcome: 'Realistic plan without quality compromises', cost: 'Medium', feasibility: 'manager_decision', requiresApproval: true, category: 'operational' },
    { id: 'demo-wl-sug-5', action: 'Hire senior developer (contractor, 3 months)', reason: 'No internal reallocation fully covers the gap — structural deficit', expectedOutcome: '+40h/week capacity, backlog recovery in 6 weeks', cost: 'High (€15K/month)', feasibility: 'leadership_decision', requiresApproval: true, category: 'organizational' },
  ];

  const dec: DecisionItem[] = [
    { id: 'demo-wl-dec-1', suggestionId: 'demo-wl-sug-1', state: 'approved', decidedBy: 'Team Lead', decidedAt: '2026-04-01' },
    { id: 'demo-wl-dec-2', suggestionId: 'demo-wl-sug-3', state: 'proposed' },
    { id: 'demo-wl-dec-3', suggestionId: 'demo-wl-sug-5', state: 'deferred', decidedBy: 'VP Engineering', decidedAt: '2026-03-28', notes: 'Review again if Q2 backlog not reduced by Apr 15' },
  ];

  const exec: ExecutionPlanItem[] = [
    { id: 'demo-wl-ep-1', decisionId: 'demo-wl-dec-1', tasks: [
      { title: 'Reassign "DB Migration" to Katarzyna', owner: 'Team Lead', deadline: '2026-04-03', status: 'done' },
      { title: 'Reassign "API Tests" to Katarzyna', owner: 'Team Lead', deadline: '2026-04-03', status: 'done' },
      { title: 'Reassign "Config Refactor" to Katarzyna', owner: 'Team Lead', deadline: '2026-04-04', status: 'in_progress' },
      { title: 'Reassign "Docs Update" to Katarzyna', owner: 'Team Lead', deadline: '2026-04-04', status: 'pending' },
      { title: 'Reassign "Monitoring Setup" to Katarzyna', owner: 'Team Lead', deadline: '2026-04-04', status: 'pending' },
    ], beforeState: 'Marek: 18 tasks / Katarzyna: 3 tasks', afterState: 'Marek: 13 tasks / Katarzyna: 8 tasks', verificationStatus: 'in_progress' },
  ];

  return { observations: obs, insights: ins, effects: eff, suggestions: sug, decisions: dec, executionPlan: exec, severity: 'critical', confidence: 'medium', lastRefreshed: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Execution Risk
// ---------------------------------------------------------------------------

function demoRisk(): LaneAnalysis {
  const obs: ObservationItem[] = [
    { id: 'demo-rsk-obs-1', metric: '7 risk signals (3 critical, 2 high)', scope: 'portfolio', trend: 'rising', severity: 'critical' },
    { id: 'demo-rsk-obs-2', metric: '12 delay signals (4 critical)', scope: 'portfolio', trend: 'rising', severity: 'critical' },
    { id: 'demo-rsk-obs-3', metric: '5 initiatives without baseline dates', scope: 'initiative', trend: 'stable', severity: 'warning' },
    { id: 'demo-rsk-obs-4', metric: '8 stale items (no update ≥14 days)', scope: 'portfolio', trend: 'stable', severity: 'info' },
    { id: 'demo-rsk-obs-5', metric: 'Delivery confidence score: 42%', scope: 'portfolio', trend: 'rising', severity: 'critical' },
    { id: 'demo-rsk-obs-6', metric: 'Decision latency: 11 days average', scope: 'portfolio', trend: 'rising', severity: 'warning' },
  ];

  const ins: InsightItem[] = [
    { id: 'demo-rsk-ins-1', observationIds: ['demo-rsk-obs-1', 'demo-rsk-obs-2', 'demo-rsk-obs-5'], interpretation: 'Execution health degraded: 3 critical risks + 12 delays → delivery confidence at 42%', isSystemic: true, requiresAction: true, confidence: 'high' },
    { id: 'demo-rsk-ins-2', observationIds: ['demo-rsk-obs-3'], interpretation: 'Primary risk factor is data quality — 5 initiatives without baselines means variance cannot be computed', isSystemic: true, requiresAction: true, confidence: 'high' },
    { id: 'demo-rsk-ins-3', observationIds: ['demo-rsk-obs-1'], interpretation: 'Critical risk: "Regulatory compliance deadline" has no mitigation plan and is due in 3 weeks', isSystemic: false, requiresAction: true, confidence: 'high' },
  ];

  const eff: EffectItem[] = [
    { id: 'demo-rsk-eff-1', insightId: 'demo-rsk-ins-1', consequence: 'Portfolio likely to miss Q2 deadline by 2-4 weeks; sponsor trust erosion', blastRadius: 15, timelineImpact: '+14-28 days overall', costImpact: '~€120K total delay impact' },
    { id: 'demo-rsk-eff-2', insightId: 'demo-rsk-ins-3', consequence: 'Regulatory non-compliance → potential €500K fine + project suspension', blastRadius: 1, costImpact: 'Up to €500K penalty', timelineImpact: 'Project halt until compliant' },
  ];

  const sug: SuggestionItem[] = [
    { id: 'demo-rsk-sug-1', action: 'Set baseline dates for 5 initiatives', reason: 'Variance analysis impossible without baseline', expectedOutcome: 'Delivery confidence tracking becomes reliable', cost: 'Low', feasibility: 'immediate', requiresApproval: false, category: 'quality' },
    { id: 'demo-rsk-sug-2', action: 'Assign mitigation owner to regulatory compliance risk', reason: 'Critical risk with no owner and 3-week deadline', expectedOutcome: 'Named owner driving resolution daily', cost: 'Low', feasibility: 'immediate', requiresApproval: false, category: 'governance' },
    { id: 'demo-rsk-sug-3', action: 'Update stale items or close obsolete ones', reason: '8 items with no activity erode data quality', expectedOutcome: 'Cleaner portfolio view, more accurate risk picture', cost: 'Low', feasibility: 'immediate', requiresApproval: false, category: 'quality' },
    { id: 'demo-rsk-sug-4', action: 'Create comprehensive risk management plan', reason: 'Delivery confidence at 42% — structured risk response needed', expectedOutcome: 'Systematic risk reduction with measurable targets', cost: 'Medium', feasibility: 'manager_decision', requiresApproval: true, category: 'governance' },
    { id: 'demo-rsk-sug-5', action: 'Escalation review with leadership — consider stop/slow for "Legacy Decommission"', reason: 'Delivery confidence critically low; resources better allocated elsewhere', expectedOutcome: 'Clear go/no-go decision frees capacity for viable initiatives', cost: 'High', feasibility: 'leadership_decision', requiresApproval: true, category: 'governance' },
  ];

  const dec: DecisionItem[] = [
    { id: 'demo-rsk-dec-1', suggestionId: 'demo-rsk-sug-2', state: 'approved', decidedBy: 'Risk Manager', decidedAt: '2026-04-01' },
    { id: 'demo-rsk-dec-2', suggestionId: 'demo-rsk-sug-4', state: 'in_execution', decidedBy: 'PMO Director', decidedAt: '2026-03-29' },
  ];

  const exec: ExecutionPlanItem[] = [
    { id: 'demo-rsk-ep-1', decisionId: 'demo-rsk-dec-1', tasks: [
      { title: 'Assign Compliance Lead to regulatory risk', owner: 'Risk Manager', deadline: '2026-04-03', status: 'done' },
      { title: 'Draft regulatory compliance action plan', owner: 'Compliance Lead', deadline: '2026-04-07', status: 'in_progress' },
      { title: 'Submit interim compliance report', owner: 'Compliance Lead', deadline: '2026-04-14', status: 'pending' },
    ], beforeState: 'No owner, no plan, 3 weeks to deadline', afterState: 'Named owner + action plan in progress', verificationStatus: 'in_progress' },
    { id: 'demo-rsk-ep-2', decisionId: 'demo-rsk-dec-2', tasks: [
      { title: 'Catalog all active risks with severity scoring', owner: 'Risk Manager', deadline: '2026-04-05', status: 'done' },
      { title: 'Assign mitigation owners to top 5 risks', owner: 'PMO Director', deadline: '2026-04-07', status: 'in_progress' },
      { title: 'Set weekly risk review cadence', owner: 'PMO Director', deadline: '2026-04-10', status: 'pending' },
      { title: 'Establish risk KPI dashboard', owner: 'BI Team', deadline: '2026-04-14', status: 'pending' },
    ], beforeState: 'Ad-hoc risk tracking, no structured reviews', afterState: 'Formal risk management with weekly reviews and KPIs', verificationStatus: 'in_progress' },
  ];

  return { observations: obs, insights: ins, effects: eff, suggestions: sug, decisions: dec, executionPlan: exec, severity: 'critical', confidence: 'medium', lastRefreshed: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// People & Change
// ---------------------------------------------------------------------------

function demoPeopleChange(): LaneAnalysis {
  const obs: ObservationItem[] = [
    { id: 'demo-pc-obs-1', metric: '6 initiatives without owner', scope: 'initiative', trend: 'rising', severity: 'critical' },
    { id: 'demo-pc-obs-2', metric: '4 initiatives without target date', scope: 'initiative', trend: 'stable', severity: 'warning' },
    { id: 'demo-pc-obs-3', metric: '11 tasks without assignee', scope: 'task', trend: 'stable', severity: 'warning' },
    { id: 'demo-pc-obs-4', metric: 'Ownership clarity: 62% (4 unique owners for 13 initiatives)', scope: 'portfolio', trend: 'rising', severity: 'warning' },
    { id: 'demo-pc-obs-5', metric: 'All initiatives owned by single person (PMO Director)', scope: 'portfolio', trend: 'stable', severity: 'critical', entityName: 'PMO Director' },
  ];

  const ins: InsightItem[] = [
    { id: 'demo-pc-ins-1', observationIds: ['demo-pc-obs-1', 'demo-pc-obs-4'], interpretation: 'Significant ownership gap — 6 unowned initiatives create decision vacuum and accountability void', isSystemic: true, requiresAction: true, confidence: 'high' },
    { id: 'demo-pc-ins-2', observationIds: ['demo-pc-obs-5'], interpretation: 'Single point of failure: PMO Director owns all key initiatives — bottleneck and bus-factor risk', isSystemic: true, requiresAction: true, confidence: 'high' },
    { id: 'demo-pc-ins-3', observationIds: ['demo-pc-obs-3'], interpretation: '11 unassigned tasks are invisible to workload tracking — hidden demand building up', isSystemic: false, requiresAction: true, confidence: 'medium' },
  ];

  const eff: EffectItem[] = [
    { id: 'demo-pc-eff-1', insightId: 'demo-pc-ins-1', consequence: '6 unowned initiatives drift without accountability — average 2x longer to deliver', blastRadius: 6, timelineImpact: '+100% delivery time on unowned work' },
    { id: 'demo-pc-eff-2', insightId: 'demo-pc-ins-2', consequence: 'If PMO Director is unavailable, entire portfolio loses decision authority', blastRadius: 13, costImpact: 'Total portfolio risk' },
  ];

  const sug: SuggestionItem[] = [
    { id: 'demo-pc-sug-1', action: 'Assign owners to 6 unowned initiatives', reason: 'No owner = no accountability, no decisions', expectedOutcome: 'Clear responsibility chain for each initiative', cost: 'Low', feasibility: 'immediate', requiresApproval: false, category: 'governance' },
    { id: 'demo-pc-sug-2', action: 'Assign 11 tasks to team members', reason: 'Unassigned tasks are invisible to workload and progress tracking', expectedOutcome: 'Full workload visibility', cost: 'Low', feasibility: 'immediate', requiresApproval: false, category: 'operational' },
    { id: 'demo-pc-sug-3', action: 'Update stakeholder map and RACI matrix', reason: 'Low ownership clarity (62%) indicates incomplete governance mapping', expectedOutcome: 'Clear roles and decision rights for all active work', cost: 'Medium', feasibility: 'manager_decision', requiresApproval: true, category: 'governance' },
    { id: 'demo-pc-sug-4', action: 'Launch bi-weekly SteerCo communication cadence', reason: 'Large portfolio needs structured stakeholder alignment', expectedOutcome: 'Faster decisions, shared visibility, reduced governance gaps', cost: 'Medium', feasibility: 'manager_decision', requiresApproval: true, category: 'governance' },
    { id: 'demo-pc-sug-5', action: 'Hire dedicated Change Manager', reason: 'PMO Director is single point of failure for 13 initiatives', expectedOutcome: 'Distributed ownership, reduced bus-factor risk', cost: 'High', feasibility: 'leadership_decision', requiresApproval: true, category: 'organizational' },
  ];

  const dec: DecisionItem[] = [
    { id: 'demo-pc-dec-1', suggestionId: 'demo-pc-sug-1', state: 'approved', decidedBy: 'PMO Director', decidedAt: '2026-04-02' },
    { id: 'demo-pc-dec-2', suggestionId: 'demo-pc-sug-4', state: 'proposed' },
    { id: 'demo-pc-dec-3', suggestionId: 'demo-pc-sug-5', state: 'rejected', decidedBy: 'VP Operations', decidedAt: '2026-03-30', notes: 'Budget not available in Q2. Revisit in Q3 planning.' },
  ];

  const exec: ExecutionPlanItem[] = [
    { id: 'demo-pc-ep-1', decisionId: 'demo-pc-dec-1', tasks: [
      { title: 'Assign "Cloud Migration" to Jan Kowalski', owner: 'PMO', deadline: '2026-04-04', status: 'done' },
      { title: 'Assign "Data Platform" to Ewa Nowicka', owner: 'PMO', deadline: '2026-04-04', status: 'done' },
      { title: 'Assign "Process Automation" to Piotr Mazur', owner: 'PMO', deadline: '2026-04-05', status: 'in_progress' },
      { title: 'Assign "Security Hardening" to Karolina Dąbrowska', owner: 'PMO', deadline: '2026-04-05', status: 'pending' },
      { title: 'Assign "Customer Portal" to Tomasz Lewandowski', owner: 'PMO', deadline: '2026-04-05', status: 'pending' },
      { title: 'Assign "Legacy Decommission" to Adam Szymański', owner: 'PMO', deadline: '2026-04-06', status: 'pending' },
    ], beforeState: '6 initiatives unowned, decisions stalled', afterState: 'All 6 initiatives assigned to named owners', verificationStatus: 'in_progress' },
  ];

  return { observations: obs, insights: ins, effects: eff, suggestions: sug, decisions: dec, executionPlan: exec, severity: 'critical', confidence: 'high', lastRefreshed: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const DEMO_MAP: Record<LaneId, () => LaneAnalysis> = {
  'action-queue': demoActionQueue,
  'decisions': demoDecisions,
  'blockers': demoBlockers,
  'workload': demoWorkload,
  'risk': demoRisk,
  'people-change': demoPeopleChange,
};

export function getDemoAnalysis(laneId: string): LaneAnalysis | null {
  const fn = DEMO_MAP[laneId as LaneId];
  return fn ? fn() : null;
}

export function isEmptyAnalysis(a: LaneAnalysis): boolean {
  return a.observations.length === 0 && a.insights.length === 0;
}
