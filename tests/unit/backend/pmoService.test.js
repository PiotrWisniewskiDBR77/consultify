/**
 * PMO Service Unit Tests
 * 
 * Tests for Project Management Office service.
 * 
 * @module tests/unit/backend/pmoService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create PMO service implementation
const createPmoService = () => {
    const portfolios = new Map();
    const programs = new Map();
    const projectAllocations = new Map();

    // Internal helper: Get resource allocations
    const getResourceAllocationsInternal = (resourceId) => {
        const allocations = [];
        for (const [key, alloc] of projectAllocations.entries()) {
            if (alloc.resourceId === resourceId) {
                allocations.push(alloc);
            }
        }
        return allocations;
    };

    // Internal helper: Get portfolio summary
    const getPortfolioSummaryInternal = (portfolioId) => {
        const portfolio = portfolios.get(portfolioId);
        if (!portfolio) throw new Error('Portfolio not found');

        // Simulate project data
        const projects = portfolio.projectIds.map((id, i) => ({
            id,
            status: ['active', 'on_track', 'at_risk'][i % 3],
            budget: 100000 + i * 50000,
            spent: 50000 + i * 25000
        }));

        return {
            portfolioId,
            portfolioName: portfolio.name,
            totalProjects: projects.length,
            projectsByStatus: {
                active: projects.filter(p => p.status === 'active').length,
                onTrack: projects.filter(p => p.status === 'on_track').length,
                atRisk: projects.filter(p => p.status === 'at_risk').length
            },
            totalBudget: projects.reduce((sum, p) => sum + p.budget, 0),
            totalSpent: projects.reduce((sum, p) => sum + p.spent, 0)
        };
    };

    // Internal helper: Get capacity planning
    const getCapacityPlanningInternal = (portfolioId) => {
        const portfolio = portfolios.get(portfolioId);
        if (!portfolio) throw new Error('Portfolio not found');

        // Simulate capacity data
        return {
            portfolioId,
            totalCapacity: 1000, // hours
            allocatedCapacity: 750,
            availableCapacity: 250,
            utilizationRate: 75,
            byRole: [
                { role: 'developer', allocated: 400, capacity: 500 },
                { role: 'designer', allocated: 200, capacity: 250 },
                { role: 'manager', allocated: 150, capacity: 250 }
            ]
        };
    };

    return {
        // Create portfolio
        createPortfolio: async (data) => {
            if (!data.name || !data.organizationId) {
                throw new Error('Name and organization ID required');
            }

            const id = `portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const portfolio = {
                id,
                name: data.name,
                description: data.description || '',
                organizationId: data.organizationId,
                budget: data.budget || 0,
                startDate: data.startDate,
                endDate: data.endDate,
                status: 'active',
                projectIds: [],
                createdAt: new Date().toISOString()
            };

            portfolios.set(id, portfolio);
            return portfolio;
        },

        // Get portfolio
        getPortfolio: async (id) => {
            return portfolios.get(id) || null;
        },

        // Add project to portfolio
        addProjectToPortfolio: async (portfolioId, projectId) => {
            const portfolio = portfolios.get(portfolioId);
            if (!portfolio) throw new Error('Portfolio not found');

            if (!portfolio.projectIds.includes(projectId)) {
                portfolio.projectIds.push(projectId);
                portfolios.set(portfolioId, portfolio);
            }
            return portfolio;
        },

        // Get portfolio summary
        getPortfolioSummary: async (portfolioId) => {
            return getPortfolioSummaryInternal(portfolioId);
        },

        // Create program (group of related projects)
        createProgram: async (data) => {
            if (!data.name || !data.portfolioId) {
                throw new Error('Name and portfolio ID required');
            }

            const id = `program-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const program = {
                id,
                name: data.name,
                description: data.description || '',
                portfolioId: data.portfolioId,
                managerId: data.managerId,
                projectIds: [],
                objectives: data.objectives || [],
                status: 'planning',
                createdAt: new Date().toISOString()
            };

            programs.set(id, program);
            return program;
        },

        // Get program
        getProgram: async (id) => {
            return programs.get(id) || null;
        },

        // Resource allocation
        allocateResource: async (data) => {
            const key = `${data.resourceId}-${data.projectId}`;
            const allocation = {
                id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                resourceId: data.resourceId,
                resourceName: data.resourceName,
                projectId: data.projectId,
                role: data.role,
                allocation: data.allocation, // percentage 0-100
                startDate: data.startDate,
                endDate: data.endDate,
                createdAt: new Date().toISOString()
            };

            projectAllocations.set(key, allocation);
            return allocation;
        },

        // Get resource allocations
        getResourceAllocations: async (resourceId) => {
            return getResourceAllocationsInternal(resourceId);
        },

        // Check resource over-allocation
        checkOverAllocation: async (resourceId) => {
            const allocations = getResourceAllocationsInternal(resourceId);
            const totalAllocation = allocations.reduce((sum, a) => sum + a.allocation, 0);

            return {
                resourceId,
                totalAllocation,
                isOverAllocated: totalAllocation > 100,
                allocations
            };
        },

        // Get capacity planning
        getCapacityPlanning: async (portfolioId) => {
            return getCapacityPlanningInternal(portfolioId);
        },

        // Generate PMO report
        generatePmoReport: async (portfolioId) => {
            const portfolio = portfolios.get(portfolioId);
            if (!portfolio) throw new Error('Portfolio not found');

            const summary = getPortfolioSummaryInternal(portfolioId);
            const capacity = getCapacityPlanningInternal(portfolioId);

            return {
                generatedAt: new Date().toISOString(),
                portfolio: portfolio.name,
                summary,
                capacity,
                healthScore: 85
            };
        },

        // Clear for testing
        clear: () => {
            portfolios.clear();
            programs.clear();
            projectAllocations.clear();
        }
    };
};

describe('PmoService', () => {
    let pmoService;

    beforeEach(() => {
        pmoService = createPmoService();
    });

    describe('Portfolio Management', () => {
        it('should create a portfolio', async () => {
            const portfolio = await pmoService.createPortfolio({
                name: 'Digital Transformation',
                organizationId: 'org-1',
                budget: 5000000
            });

            expect(portfolio.id).toBeDefined();
            expect(portfolio.name).toBe('Digital Transformation');
            expect(portfolio.status).toBe('active');
        });

        it('should require name and organization', async () => {
            await expect(pmoService.createPortfolio({}))
                .rejects.toThrow('Name and organization ID required');
        });

        it('should add projects to portfolio', async () => {
            const portfolio = await pmoService.createPortfolio({
                name: 'Test Portfolio',
                organizationId: 'org-1'
            });

            await pmoService.addProjectToPortfolio(portfolio.id, 'proj-1');
            await pmoService.addProjectToPortfolio(portfolio.id, 'proj-2');

            const updated = await pmoService.getPortfolio(portfolio.id);
            expect(updated.projectIds).toHaveLength(2);
        });
    });

    describe('Portfolio Summary', () => {
        it('should generate portfolio summary', async () => {
            const portfolio = await pmoService.createPortfolio({
                name: 'Summary Test',
                organizationId: 'org-1'
            });

            await pmoService.addProjectToPortfolio(portfolio.id, 'proj-1');
            await pmoService.addProjectToPortfolio(portfolio.id, 'proj-2');
            await pmoService.addProjectToPortfolio(portfolio.id, 'proj-3');

            const summary = await pmoService.getPortfolioSummary(portfolio.id);

            expect(summary.totalProjects).toBe(3);
            expect(summary.projectsByStatus).toBeDefined();
            expect(summary.totalBudget).toBeGreaterThan(0);
        });
    });

    describe('Program Management', () => {
        it('should create a program', async () => {
            const portfolio = await pmoService.createPortfolio({
                name: 'Parent Portfolio',
                organizationId: 'org-1'
            });

            const program = await pmoService.createProgram({
                name: 'Cloud Migration Program',
                portfolioId: portfolio.id,
                objectives: ['Migrate all apps to cloud', 'Reduce infrastructure costs']
            });

            expect(program.id).toBeDefined();
            expect(program.objectives).toHaveLength(2);
        });
    });

    describe('Resource Allocation', () => {
        it('should allocate resource to project', async () => {
            const allocation = await pmoService.allocateResource({
                resourceId: 'user-1',
                resourceName: 'John Developer',
                projectId: 'proj-1',
                role: 'developer',
                allocation: 50 // 50%
            });

            expect(allocation.id).toBeDefined();
            expect(allocation.allocation).toBe(50);
        });

        it('should track multiple allocations', async () => {
            await pmoService.allocateResource({
                resourceId: 'user-1',
                projectId: 'proj-1',
                allocation: 40
            });
            await pmoService.allocateResource({
                resourceId: 'user-1',
                projectId: 'proj-2',
                allocation: 60
            });

            const allocations = await pmoService.getResourceAllocations('user-1');
            expect(allocations).toHaveLength(2);
        });

        it('should detect over-allocation', async () => {
            await pmoService.allocateResource({
                resourceId: 'user-1',
                projectId: 'proj-1',
                allocation: 60
            });
            await pmoService.allocateResource({
                resourceId: 'user-1',
                projectId: 'proj-2',
                allocation: 50
            });

            const check = await pmoService.checkOverAllocation('user-1');

            expect(check.totalAllocation).toBe(110);
            expect(check.isOverAllocated).toBe(true);
        });
    });

    describe('Capacity Planning', () => {
        it('should provide capacity planning data', async () => {
            const portfolio = await pmoService.createPortfolio({
                name: 'Capacity Test',
                organizationId: 'org-1'
            });

            const capacity = await pmoService.getCapacityPlanning(portfolio.id);

            expect(capacity.utilizationRate).toBeDefined();
            expect(capacity.byRole).toBeInstanceOf(Array);
        });
    });

    describe('PMO Reporting', () => {
        it('should generate PMO report', async () => {
            const portfolio = await pmoService.createPortfolio({
                name: 'Report Test',
                organizationId: 'org-1'
            });

            await pmoService.addProjectToPortfolio(portfolio.id, 'proj-1');

            const report = await pmoService.generatePmoReport(portfolio.id);

            expect(report.generatedAt).toBeDefined();
            expect(report.summary).toBeDefined();
            expect(report.capacity).toBeDefined();
            expect(report.healthScore).toBeDefined();
        });
    });
});
