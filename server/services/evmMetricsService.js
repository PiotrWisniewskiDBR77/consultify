/**
 * EVM (Earned Value Management) Metrics Service
 * 
 * Calculates Earned Value metrics for project performance measurement.
 * 
 * PMO Standards:
 * - PMBOK 7: Measurement Performance Domain - Earned Value Analysis
 * - ISO 21500: Performance Measurement (Clause 4.4.22)
 * - PRINCE2: Progress Theme - Tolerance Management
 * 
 * Key Metrics:
 * - PV (Planned Value) - Budgeted Cost of Work Scheduled (BCWS)
 * - EV (Earned Value) - Budgeted Cost of Work Performed (BCWP)
 * - AC (Actual Cost) - Actual Cost of Work Performed (ACWP)
 * - SV (Schedule Variance) = EV - PV
 * - CV (Cost Variance) = EV - AC
 * - SPI (Schedule Performance Index) = EV / PV
 * - CPI (Cost Performance Index) = EV / AC
 * - EAC (Estimate at Completion)
 * - ETC (Estimate to Complete)
 * - VAC (Variance at Completion)
 * - TCPI (To-Complete Performance Index)
 */

const db = require('../database');

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

const EVMMetricsService = {
    /**
     * Calculate all EVM metrics for a project
     * 
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} EVM metrics
     */
    calculateEVM: async (projectId) => {
        // Get budget data
        const budget = await dbGet(`
            SELECT 
                planned_budget as bac,
                actual_spend as ac,
                forecast_at_completion
            FROM project_budgets 
            WHERE project_id = ?
        `, [projectId]);

        // Get project progress data
        const projectProgress = await dbGet(`
            SELECT 
                start_date,
                target_end_date,
                actual_end_date,
                status
            FROM projects 
            WHERE id = ?
        `, [projectId]);

        // Get task completion data for EV calculation
        const taskStats = await dbGet(`
            SELECT 
                COUNT(*) as total_tasks,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
                SUM(CASE WHEN status = 'done' THEN effort_estimated ELSE 0 END) as completed_effort,
                SUM(effort_estimated) as total_effort,
                SUM(effort_actual) as actual_effort
            FROM tasks 
            WHERE project_id = ?
        `, [projectId]);

        // Get milestone data for schedule analysis
        const milestones = await dbAll(`
            SELECT 
                planned_date,
                actual_date,
                status
            FROM milestones 
            WHERE project_id = ?
            ORDER BY planned_date ASC
        `, [projectId]);

        // Calculate schedule progress (based on time elapsed)
        const now = new Date();
        const startDate = projectProgress?.start_date ? new Date(projectProgress.start_date) : now;
        const endDate = projectProgress?.target_end_date ? new Date(projectProgress.target_end_date) : now;
        const totalDuration = Math.max(1, endDate.getTime() - startDate.getTime());
        const elapsedDuration = Math.max(0, now.getTime() - startDate.getTime());
        const scheduledProgress = Math.min(100, (elapsedDuration / totalDuration) * 100);

        // Calculate actual progress (based on completed work)
        const totalTasks = taskStats?.total_tasks || 0;
        const completedTasks = taskStats?.completed_tasks || 0;
        const percentComplete = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // Budget values
        const bac = budget?.bac || 100000; // Budget at Completion (default to 100k if not set)
        const ac = budget?.ac || 0; // Actual Cost

        // Calculate PV (Planned Value) - What we planned to have done by now
        const pv = (scheduledProgress / 100) * bac;

        // Calculate EV (Earned Value) - Value of work actually completed
        const ev = (percentComplete / 100) * bac;

        // Variances
        const sv = ev - pv; // Schedule Variance
        const cv = ev - ac; // Cost Variance

        // Performance Indices
        const spi = pv > 0 ? ev / pv : 1; // Schedule Performance Index
        const cpi = ac > 0 ? ev / ac : 1; // Cost Performance Index

        // Forecasts
        // EAC - Estimate at Completion
        // Using typical formula: EAC = BAC / CPI (assumes future work at current efficiency)
        const eac = cpi > 0 ? bac / cpi : bac;

        // ETC - Estimate to Complete
        const etc = Math.max(0, eac - ac);

        // VAC - Variance at Completion
        const vac = bac - eac;

        // TCPI - To-Complete Performance Index
        // TCPI = (BAC - EV) / (BAC - AC) - required efficiency to complete on budget
        const tcpi = (bac - ac) > 0 ? (bac - ev) / (bac - ac) : 1;

        // Status determination
        const evmStatus = EVMMetricsService._determineStatus(spi, cpi, cv, sv);

        return {
            // Base values
            pv: Math.round(pv),
            ev: Math.round(ev),
            ac: Math.round(ac),
            bac: Math.round(bac),
            
            // Variances
            sv: Math.round(sv),
            cv: Math.round(cv),
            
            // Indices (2 decimal places)
            spi: Math.round(spi * 100) / 100,
            cpi: Math.round(cpi * 100) / 100,
            
            // Forecasts
            eac: Math.round(eac),
            etc: Math.round(etc),
            vac: Math.round(vac),
            tcpi: Math.round(tcpi * 100) / 100,
            
            // Progress
            percentComplete: Math.round(percentComplete),
            scheduledProgress: Math.round(scheduledProgress),
            
            // Status
            status: evmStatus,
            asOfDate: now.toISOString(),
            
            // Raw data for charts
            chartData: {
                cumulative: {
                    pv: Math.round(pv),
                    ev: Math.round(ev),
                    ac: Math.round(ac)
                },
                indices: {
                    spi: Math.round(spi * 100) / 100,
                    cpi: Math.round(cpi * 100) / 100
                }
            }
        };
    },

    /**
     * Get EVM metrics for a specific point in time
     * 
     * @param {string} projectId - Project ID
     * @param {string} periodEnd - End date for calculation
     * @returns {Promise<Object>} Point-in-time EVM metrics
     */
    getEVMForReport: async (projectId, periodEnd) => {
        // For simplicity, we calculate current EVM
        // In production, this would query historical snapshots
        const evm = await EVMMetricsService.calculateEVM(projectId);
        
        return {
            ...evm,
            periodEnd
        };
    },

    /**
     * Get EVM trend data over time
     * 
     * @param {string} projectId - Project ID
     * @param {number} periods - Number of periods to retrieve
     * @returns {Promise<Array>} Historical EVM data
     */
    getEVMTrend: async (projectId, periods = 12) => {
        // This would ideally query from a historical EVM snapshots table
        // For now, we return simulated historical data based on current state
        const current = await EVMMetricsService.calculateEVM(projectId);
        
        const trend = [];
        const now = new Date();
        
        for (let i = periods - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - (i * 7)); // Weekly snapshots
            
            // Simulate progression
            const factor = (periods - i) / periods;
            
            trend.push({
                date: date.toISOString().split('T')[0],
                pv: Math.round(current.bac * factor * 0.95),
                ev: Math.round(current.bac * factor * current.spi * 0.9),
                ac: Math.round(current.bac * factor / current.cpi * 0.9),
                spi: current.spi + (Math.random() - 0.5) * 0.1,
                cpi: current.cpi + (Math.random() - 0.5) * 0.1
            });
        }
        
        // Last entry should be current
        trend[trend.length - 1] = {
            date: now.toISOString().split('T')[0],
            pv: current.pv,
            ev: current.ev,
            ac: current.ac,
            spi: current.spi,
            cpi: current.cpi
        };
        
        return trend;
    },

    /**
     * Determine EVM status based on indices and variances
     * @private
     */
    _determineStatus: (spi, cpi, cv, sv) => {
        const scheduleStatus = 
            spi >= 0.95 ? 'ON_SCHEDULE' :
            spi >= 0.85 ? 'BEHIND_SCHEDULE' :
            'SIGNIFICANTLY_BEHIND';
            
        const costStatus = 
            cpi >= 0.95 ? 'ON_BUDGET' :
            cpi >= 0.85 ? 'OVER_BUDGET' :
            'SIGNIFICANTLY_OVER';

        // Overall health
        let health = 'GREEN';
        if (spi < 0.95 || cpi < 0.95) health = 'AMBER';
        if (spi < 0.85 || cpi < 0.85) health = 'RED';

        return {
            schedule: scheduleStatus,
            cost: costStatus,
            health,
            recommendations: EVMMetricsService._generateRecommendations(spi, cpi, cv, sv)
        };
    },

    /**
     * Generate recommendations based on EVM metrics
     * @private
     */
    _generateRecommendations: (spi, cpi, cv, sv) => {
        const recommendations = [];

        if (spi < 0.9) {
            recommendations.push({
                priority: 'HIGH',
                area: 'SCHEDULE',
                message: 'Schedule performance is below target. Consider fast-tracking or crashing critical path activities.'
            });
        }

        if (cpi < 0.9) {
            recommendations.push({
                priority: 'HIGH',
                area: 'COST',
                message: 'Cost performance is below target. Review resource allocation and identify cost reduction opportunities.'
            });
        }

        if (spi >= 1.1) {
            recommendations.push({
                priority: 'INFO',
                area: 'SCHEDULE',
                message: 'Project is ahead of schedule. Consider rebaselining or pulling in future work.'
            });
        }

        if (cpi >= 1.1) {
            recommendations.push({
                priority: 'INFO',
                area: 'COST',
                message: 'Project is under budget. Review if scope is being fully delivered or if budget can be reallocated.'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                priority: 'INFO',
                area: 'GENERAL',
                message: 'Project is performing within acceptable tolerances. Continue monitoring.'
            });
        }

        return recommendations;
    },

    /**
     * Calculate portfolio-level EVM by aggregating project EVMs
     * 
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Portfolio EVM metrics
     */
    calculatePortfolioEVM: async (organizationId) => {
        const projects = await dbAll(`
            SELECT id, name FROM projects 
            WHERE organization_id = ? AND status != 'CLOSED'
        `, [organizationId]);

        if (projects.length === 0) {
            return {
                pv: 0, ev: 0, ac: 0, bac: 0,
                spi: 1, cpi: 1,
                projectCount: 0,
                projectMetrics: []
            };
        }

        const projectMetrics = await Promise.all(
            projects.map(async (project) => {
                const evm = await EVMMetricsService.calculateEVM(project.id);
                return {
                    projectId: project.id,
                    projectName: project.name,
                    ...evm
                };
            })
        );

        // Aggregate metrics
        const totals = projectMetrics.reduce((acc, pm) => ({
            pv: acc.pv + pm.pv,
            ev: acc.ev + pm.ev,
            ac: acc.ac + pm.ac,
            bac: acc.bac + pm.bac
        }), { pv: 0, ev: 0, ac: 0, bac: 0 });

        const portfolioSpi = totals.pv > 0 ? totals.ev / totals.pv : 1;
        const portfolioCpi = totals.ac > 0 ? totals.ev / totals.ac : 1;

        return {
            ...totals,
            spi: Math.round(portfolioSpi * 100) / 100,
            cpi: Math.round(portfolioCpi * 100) / 100,
            projectCount: projects.length,
            projectMetrics,
            status: EVMMetricsService._determineStatus(portfolioSpi, portfolioCpi, totals.ev - totals.ac, totals.ev - totals.pv)
        };
    }
};

module.exports = EVMMetricsService;



