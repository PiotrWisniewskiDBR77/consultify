/**
 * Risk Service Unit Tests
 * 
 * Tests for risk management and assessment.
 * 
 * @module tests/unit/backend/riskService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create risk service implementation
const createRiskService = () => {
    const risks = new Map();
    const mitigations = new Map();

    const calculateRiskScore = (probability, impact) => {
        return probability * impact;
    };

    const getRiskLevel = (score) => {
        if (score >= 15) return 'critical';
        if (score >= 10) return 'high';
        if (score >= 5) return 'medium';
        return 'low';
    };

    return {
        // Create risk
        create: async (data) => {
            if (!data.projectId || !data.title) {
                throw new Error('Project ID and title required');
            }

            const id = `risk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const probability = data.probability || 3;
            const impact = data.impact || 3;
            const score = calculateRiskScore(probability, impact);

            const risk = {
                id,
                projectId: data.projectId,
                title: data.title,
                description: data.description || '',
                category: data.category || 'operational',
                probability, // 1-5
                impact, // 1-5
                score,
                level: getRiskLevel(score),
                status: 'identified',
                ownerId: data.ownerId,
                dueDate: data.dueDate,
                createdAt: new Date().toISOString()
            };

            risks.set(id, risk);
            mitigations.set(id, []);
            return risk;
        },

        // Get risk by ID
        getById: async (id) => {
            return risks.get(id) || null;
        },

        // List risks for project
        listByProject: async (projectId, options = {}) => {
            const { level, status, category } = options;

            return Array.from(risks.values())
                .filter(r => {
                    if (r.projectId !== projectId) return false;
                    if (level && r.level !== level) return false;
                    if (status && r.status !== status) return false;
                    if (category && r.category !== category) return false;
                    return true;
                })
                .sort((a, b) => b.score - a.score);
        },

        // Update risk assessment
        updateAssessment: async (id, assessment) => {
            const risk = risks.get(id);
            if (!risk) throw new Error('Risk not found');

            const probability = assessment.probability ?? risk.probability;
            const impact = assessment.impact ?? risk.impact;
            const score = calculateRiskScore(probability, impact);

            const updated = {
                ...risk,
                probability,
                impact,
                score,
                level: getRiskLevel(score),
                updatedAt: new Date().toISOString()
            };

            risks.set(id, updated);
            return updated;
        },

        // Update risk status
        updateStatus: async (id, status) => {
            const risk = risks.get(id);
            if (!risk) throw new Error('Risk not found');

            const validStatuses = ['identified', 'analyzing', 'mitigating', 'resolved', 'accepted'];
            if (!validStatuses.includes(status)) {
                throw new Error('Invalid status');
            }

            risk.status = status;
            risk.updatedAt = new Date().toISOString();
            risks.set(id, risk);
            return risk;
        },

        // Add mitigation action
        addMitigation: async (riskId, data) => {
            const risk = risks.get(riskId);
            if (!risk) throw new Error('Risk not found');

            const mitigation = {
                id: `mit-${Date.now()}`,
                riskId,
                action: data.action,
                type: data.type || 'reduce', // reduce, avoid, transfer, accept
                assigneeId: data.assigneeId,
                dueDate: data.dueDate,
                status: 'pending',
                createdAt: new Date().toISOString()
            };

            const list = mitigations.get(riskId) || [];
            list.push(mitigation);
            mitigations.set(riskId, list);

            return mitigation;
        },

        // Get mitigations for risk
        getMitigations: async (riskId) => {
            return mitigations.get(riskId) || [];
        },

        // Complete mitigation
        completeMitigation: async (riskId, mitigationId) => {
            const list = mitigations.get(riskId) || [];
            const mitigation = list.find(m => m.id === mitigationId);
            if (!mitigation) throw new Error('Mitigation not found');

            mitigation.status = 'completed';
            mitigation.completedAt = new Date().toISOString();
            mitigations.set(riskId, list);

            return mitigation;
        },

        // Get risk matrix (aggregate by level)
        getRiskMatrix: async (projectId) => {
            const projectRisks = Array.from(risks.values())
                .filter(r => r.projectId === projectId);

            const matrix = {
                critical: projectRisks.filter(r => r.level === 'critical').length,
                high: projectRisks.filter(r => r.level === 'high').length,
                medium: projectRisks.filter(r => r.level === 'medium').length,
                low: projectRisks.filter(r => r.level === 'low').length,
                total: projectRisks.length
            };

            return matrix;
        },

        // Delete risk
        delete: async (id) => {
            mitigations.delete(id);
            return risks.delete(id);
        },

        // Clear for testing
        clear: () => {
            risks.clear();
            mitigations.clear();
        }
    };
};

describe('RiskService', () => {
    let riskService;

    beforeEach(() => {
        riskService = createRiskService();
    });

    describe('Risk Creation', () => {
        it('should create a risk', async () => {
            const risk = await riskService.create({
                projectId: 'proj-1',
                title: 'Budget Overrun',
                category: 'financial',
                probability: 4,
                impact: 5
            });

            expect(risk.id).toBeDefined();
            expect(risk.title).toBe('Budget Overrun');
            expect(risk.score).toBe(20); // 4 * 5
            expect(risk.level).toBe('critical');
        });

        it('should require project and title', async () => {
            await expect(riskService.create({}))
                .rejects.toThrow('Project ID and title required');
        });

        it('should default to medium probability and impact', async () => {
            const risk = await riskService.create({
                projectId: 'proj-1',
                title: 'Default Risk'
            });

            expect(risk.probability).toBe(3);
            expect(risk.impact).toBe(3);
            expect(risk.score).toBe(9);
        });
    });

    describe('Risk Assessment', () => {
        it('should calculate risk levels correctly', async () => {
            const critical = await riskService.create({
                projectId: 'proj-1',
                title: 'Critical',
                probability: 5,
                impact: 5
            });
            expect(critical.level).toBe('critical');

            const high = await riskService.create({
                projectId: 'proj-1',
                title: 'High',
                probability: 4,
                impact: 3
            });
            expect(high.level).toBe('high');

            const medium = await riskService.create({
                projectId: 'proj-1',
                title: 'Medium',
                probability: 2,
                impact: 3
            });
            expect(medium.level).toBe('medium');

            const low = await riskService.create({
                projectId: 'proj-1',
                title: 'Low',
                probability: 1,
                impact: 2
            });
            expect(low.level).toBe('low');
        });

        it('should update risk assessment', async () => {
            const risk = await riskService.create({
                projectId: 'proj-1',
                title: 'Reassess Me',
                probability: 2,
                impact: 2
            });

            const updated = await riskService.updateAssessment(risk.id, {
                probability: 5,
                impact: 4
            });

            expect(updated.score).toBe(20);
            expect(updated.level).toBe('critical');
        });
    });

    describe('Risk Status', () => {
        it('should update risk status', async () => {
            const risk = await riskService.create({
                projectId: 'proj-1',
                title: 'Track Status'
            });

            const updated = await riskService.updateStatus(risk.id, 'mitigating');
            expect(updated.status).toBe('mitigating');
        });

        it('should reject invalid status', async () => {
            const risk = await riskService.create({
                projectId: 'proj-1',
                title: 'Invalid Status'
            });

            await expect(riskService.updateStatus(risk.id, 'invalid'))
                .rejects.toThrow('Invalid status');
        });
    });

    describe('Mitigations', () => {
        it('should add mitigation action', async () => {
            const risk = await riskService.create({
                projectId: 'proj-1',
                title: 'Mitigate Me'
            });

            const mitigation = await riskService.addMitigation(risk.id, {
                action: 'Implement fallback system',
                type: 'reduce',
                assigneeId: 'user-1'
            });

            expect(mitigation.id).toBeDefined();
            expect(mitigation.status).toBe('pending');
        });

        it('should complete mitigation', async () => {
            const risk = await riskService.create({
                projectId: 'proj-1',
                title: 'Complete Me'
            });

            const mitigation = await riskService.addMitigation(risk.id, {
                action: 'Add backup'
            });

            const completed = await riskService.completeMitigation(risk.id, mitigation.id);

            expect(completed.status).toBe('completed');
            expect(completed.completedAt).toBeDefined();
        });
    });

    describe('Risk Matrix', () => {
        it('should generate risk matrix', async () => {
            await riskService.create({ projectId: 'proj-1', title: 'R1', probability: 5, impact: 5 }); // critical
            await riskService.create({ projectId: 'proj-1', title: 'R2', probability: 4, impact: 4 }); // critical
            await riskService.create({ projectId: 'proj-1', title: 'R3', probability: 3, impact: 3 }); // medium
            await riskService.create({ projectId: 'proj-1', title: 'R4', probability: 1, impact: 1 }); // low

            const matrix = await riskService.getRiskMatrix('proj-1');

            expect(matrix.critical).toBe(2);
            expect(matrix.medium).toBe(1);
            expect(matrix.low).toBe(1);
            expect(matrix.total).toBe(4);
        });
    });

    describe('Filtering', () => {
        beforeEach(async () => {
            await riskService.create({ projectId: 'proj-1', title: 'R1', probability: 5, impact: 5, category: 'financial' });
            await riskService.create({ projectId: 'proj-1', title: 'R2', probability: 2, impact: 2, category: 'operational' });
            await riskService.create({ projectId: 'proj-2', title: 'R3', probability: 3, impact: 3, category: 'technical' });
        });

        it('should filter by project', async () => {
            const risks = await riskService.listByProject('proj-1');
            expect(risks).toHaveLength(2);
        });

        it('should filter by level', async () => {
            const risks = await riskService.listByProject('proj-1', { level: 'critical' });
            expect(risks).toHaveLength(1);
        });

        it('should filter by category', async () => {
            const risks = await riskService.listByProject('proj-1', { category: 'financial' });
            expect(risks).toHaveLength(1);
        });
    });
});
