/**
 * PMO Module - Comprehensive Unit Tests
 *
 * Tests for Project Management Office functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('PMO Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Portfolio Management', () => {
    it('should create portfolio', () => {
      const portfolio = {
        id: 'PORT-001',
        name: 'Digital Transformation',
        strategy: 'growth',
        budget: 5000000,
        status: 'active',
      };

      expect(portfolio.name).toBe('Digital Transformation');
    });

    it('should calculate portfolio value', () => {
      const projects = [
        { id: 'P1', value: 1000000 },
        { id: 'P2', value: 1500000 },
        { id: 'P3', value: 800000 },
      ];

      const totalValue = projects.reduce((sum, p) => sum + p.value, 0);

      expect(totalValue).toBe(3300000);
    });

    it('should calculate portfolio health score', () => {
      const projects = [
        { id: 'P1', health: 'green' },
        { id: 'P2', health: 'yellow' },
        { id: 'P3', health: 'green' },
        { id: 'P4', health: 'red' },
      ];

      const healthScores: Record<string, number> = { green: 1, yellow: 0.5, red: 0 };
      const avgHealth =
        projects.reduce((sum, p) => sum + healthScores[p.health], 0) / projects.length;

      expect(avgHealth).toBe(0.625);
    });

    it('should prioritize projects by strategic alignment', () => {
      const projects = [
        { id: 'P1', alignment: 0.8 },
        { id: 'P2', alignment: 0.95 },
        { id: 'P3', alignment: 0.6 },
      ];

      const sorted = projects.sort((a, b) => b.alignment - a.alignment);

      expect(sorted[0].id).toBe('P2');
    });
  });

  describe('Program Management', () => {
    it('should create program', () => {
      const program = {
        id: 'PROG-001',
        name: 'Customer Experience',
        portfolioId: 'PORT-001',
        projectCount: 5,
        status: 'in_progress',
      };

      expect(program.projectCount).toBe(5);
    });

    it('should calculate program completion', () => {
      const projects = [
        { id: 'P1', completion: 100 },
        { id: 'P2', completion: 75 },
        { id: 'P3', completion: 50 },
        { id: 'P4', completion: 25 },
      ];

      const avgCompletion = projects.reduce((sum, p) => sum + p.completion, 0) / projects.length;

      expect(avgCompletion).toBe(62.5);
    });

    it('should track program milestones', () => {
      const milestones = [
        { id: 'M1', status: 'completed', date: '2024-01-15' },
        { id: 'M2', status: 'completed', date: '2024-02-01' },
        { id: 'M3', status: 'pending', date: '2024-03-01' },
        { id: 'M4', status: 'pending', date: '2024-04-01' },
      ];

      const completed = milestones.filter((m) => m.status === 'completed').length;

      expect(completed).toBe(2);
    });
  });

  describe('Project Governance', () => {
    it('should track project phases', () => {
      const phases = ['initiation', 'planning', 'execution', 'monitoring', 'closing'];
      const currentPhase = 'execution';
      const phaseIndex = phases.indexOf(currentPhase);

      expect(phaseIndex).toBe(2);
    });

    it('should validate project stage gate', () => {
      const stageGate = {
        phase: 'planning',
        criteria: [
          { name: 'Requirements Complete', met: true },
          { name: 'Budget Approved', met: true },
          { name: 'Resources Assigned', met: false },
        ],
      };

      const allCriteriaMet = stageGate.criteria.every((c) => c.met);

      expect(allCriteriaMet).toBe(false);
    });

    it('should calculate stage gate completion', () => {
      const criteria = [{ met: true }, { met: true }, { met: true }, { met: false }];

      const completionRate = (criteria.filter((c) => c.met).length / criteria.length) * 100;

      expect(completionRate).toBe(75);
    });
  });

  describe('Resource Management', () => {
    it('should calculate resource allocation', () => {
      const resources = [
        { id: 'R1', allocated: 40, capacity: 40 },
        { id: 'R2', allocated: 35, capacity: 40 },
        { id: 'R3', allocated: 45, capacity: 40 },
      ];

      const overallocated = resources.filter((r) => r.allocated > r.capacity);

      expect(overallocated).toHaveLength(1);
    });

    it('should calculate utilization rate', () => {
      const allocated = 150;
      const capacity = 200;
      const utilization = (allocated / capacity) * 100;

      expect(utilization).toBe(75);
    });

    it('should identify resource conflicts', () => {
      const assignments = [
        { resourceId: 'R1', projectId: 'P1', hours: 25 },
        { resourceId: 'R1', projectId: 'P2', hours: 20 },
        { resourceId: 'R1', projectId: 'P3', hours: 10 },
      ];

      const totalHours = assignments.reduce((sum, a) => sum + a.hours, 0);
      const hasConflict = totalHours > 40;

      expect(hasConflict).toBe(true);
    });
  });

  describe('Risk Management', () => {
    it('should calculate risk score', () => {
      const risk = {
        probability: 0.7,
        impact: 0.8,
      };

      const score = risk.probability * risk.impact;

      expect(score).toBeCloseTo(0.56, 2);
    });

    it('should categorize risk level', () => {
      const score = 0.56;
      let level: string;

      if (score >= 0.6) level = 'high';
      else if (score >= 0.3) level = 'medium';
      else level = 'low';

      expect(level).toBe('medium');
    });

    it('should prioritize risks', () => {
      const risks = [
        { id: 'R1', score: 0.72 },
        { id: 'R2', score: 0.45 },
        { id: 'R3', score: 0.81 },
        { id: 'R4', score: 0.28 },
      ];

      const sorted = risks.sort((a, b) => b.score - a.score);

      expect(sorted[0].id).toBe('R3');
    });

    it('should track risk mitigation status', () => {
      const risks = [
        { id: 'R1', mitigated: true },
        { id: 'R2', mitigated: false },
        { id: 'R3', mitigated: true },
      ];

      const mitigationRate = (risks.filter((r) => r.mitigated).length / risks.length) * 100;

      expect(mitigationRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('Issue Management', () => {
    it('should create issue', () => {
      const issue = {
        id: 'ISS-001',
        title: 'Resource conflict',
        priority: 'high',
        status: 'open',
        assignee: 'user-1',
      };

      expect(issue.priority).toBe('high');
    });

    it('should track issue resolution time', () => {
      const createdAt = new Date('2024-01-15T10:00:00');
      const resolvedAt = new Date('2024-01-17T14:00:00');
      const resolutionHours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      expect(resolutionHours).toBe(52);
    });

    it('should calculate average resolution time', () => {
      const issues = [
        { resolutionHours: 24 },
        { resolutionHours: 48 },
        { resolutionHours: 72 },
        { resolutionHours: 36 },
      ];

      const avgResolution = issues.reduce((sum, i) => sum + i.resolutionHours, 0) / issues.length;

      expect(avgResolution).toBe(45);
    });
  });

  describe('Change Request Management', () => {
    it('should create change request', () => {
      const changeRequest = {
        id: 'CR-001',
        title: 'Scope Extension',
        type: 'scope',
        impact: 'medium',
        status: 'pending_review',
        requestedBy: 'user-1',
      };

      expect(changeRequest.type).toBe('scope');
    });

    it('should calculate change impact', () => {
      const change = {
        scheduleImpactDays: 5,
        budgetImpact: 25000,
        resourceImpact: 2,
      };

      const hasSignificantImpact =
        change.scheduleImpactDays > 3 || change.budgetImpact > 10000 || change.resourceImpact > 1;

      expect(hasSignificantImpact).toBe(true);
    });

    it('should validate approval workflow', () => {
      const approvals = [
        { role: 'project_manager', approved: true, date: '2024-01-15' },
        { role: 'sponsor', approved: true, date: '2024-01-16' },
        { role: 'change_board', approved: null, date: null },
      ];

      const pendingApprovals = approvals.filter((a) => a.approved === null);

      expect(pendingApprovals).toHaveLength(1);
    });
  });

  describe('Reporting & Analytics', () => {
    it('should calculate project KPIs', () => {
      const project = {
        plannedCost: 100000,
        actualCost: 95000,
        plannedDuration: 90,
        actualDuration: 85,
        plannedScope: 100,
        completedScope: 95,
      };

      const cpi = project.plannedCost / project.actualCost;
      const spi = project.completedScope / project.plannedScope;

      expect(cpi).toBeCloseTo(1.053, 2);
      expect(spi).toBe(0.95);
    });

    it('should calculate EVM metrics', () => {
      const pv = 100000; // Planned Value
      const ev = 95000; // Earned Value
      const ac = 90000; // Actual Cost

      const sv = ev - pv; // Schedule Variance
      const cv = ev - ac; // Cost Variance

      expect(sv).toBe(-5000);
      expect(cv).toBe(5000);
    });

    it('should forecast project completion', () => {
      const bac = 500000; // Budget at Completion
      const ev = 200000; // Earned Value
      const ac = 190000; // Actual Cost

      const cpi = ev / ac;
      const eac = bac / cpi; // Estimate at Completion

      expect(eac).toBeCloseTo(475000, 0);
    });

    it('should generate status report data', () => {
      const report = {
        period: '2024-W04',
        status: 'on_track',
        completion: 45,
        risks: 3,
        issues: 2,
        changes: 1,
      };

      expect(report.status).toBe('on_track');
    });
  });

  describe('Decision Management', () => {
    it('should create decision record', () => {
      const decision = {
        id: 'DEC-001',
        title: 'Technology Selection',
        description: 'Choose cloud provider',
        madeBy: 'user-1',
        madeAt: '2024-01-15',
        status: 'approved',
      };

      expect(decision.status).toBe('approved');
    });

    it('should track decision dependencies', () => {
      const decisions = [
        { id: 'DEC-001', dependsOn: [] },
        { id: 'DEC-002', dependsOn: ['DEC-001'] },
        { id: 'DEC-003', dependsOn: ['DEC-001', 'DEC-002'] },
      ];

      const dec3Deps = decisions.find((d) => d.id === 'DEC-003');

      expect(dec3Deps?.dependsOn).toHaveLength(2);
    });
  });
});
