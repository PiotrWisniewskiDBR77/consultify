/**
 * Financial Calculator Service
 * 
 * Provides comprehensive financial analysis calculations for initiative evaluation:
 * - NPV (Net Present Value)
 * - IRR (Internal Rate of Return)
 * - Payback Period
 * - ROI (Return on Investment)
 * - TCO (Total Cost of Ownership)
 * - Sensitivity Analysis
 * - Monte Carlo Simulation
 * - Business Case Generation
 * 
 * PMO Standards Compliance:
 * - ISO 21500:2021 - Cost Management
 * - PMI PMBOK 7 - Delivery Performance Domain
 * - PRINCE2 - Business Case Theme
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const FinancialCalculatorService = {
    // ============================================
    // Core Financial Calculations
    // ============================================

    /**
     * Calculate Net Present Value (NPV)
     * NPV = Σ [Cash Flow_t / (1 + r)^t] - Initial Investment
     */
    calculateNPV(cashFlows, discountRate, initialInvestment = 0) {
        const r = discountRate / 100;
        let npv = -initialInvestment;
        
        cashFlows.forEach((cf, t) => {
            npv += cf / Math.pow(1 + r, t + 1);
        });
        
        return Math.round(npv * 100) / 100;
    },

    /**
     * Calculate Internal Rate of Return (IRR)
     * Uses Newton-Raphson iteration method
     */
    calculateIRR(cashFlows, initialInvestment, maxIterations = 100, precision = 0.0001) {
        // Initial guess
        let irr = 0.1;
        
        // Cash flows including initial investment (negative)
        const allCashFlows = [-initialInvestment, ...cashFlows];
        
        for (let i = 0; i < maxIterations; i++) {
            let npv = 0;
            let derivative = 0;
            
            allCashFlows.forEach((cf, t) => {
                npv += cf / Math.pow(1 + irr, t);
                derivative -= t * cf / Math.pow(1 + irr, t + 1);
            });
            
            const newIrr = irr - npv / derivative;
            
            if (Math.abs(newIrr - irr) < precision) {
                return Math.round(newIrr * 10000) / 100; // Return as percentage
            }
            
            irr = newIrr;
        }
        
        // If no convergence, return null
        return null;
    },

    /**
     * Calculate Payback Period (in months)
     * Time to recover the initial investment from net cash flows
     */
    calculatePaybackPeriod(initialInvestment, annualCashFlows) {
        let cumulativeCashFlow = -initialInvestment;
        
        for (let year = 0; year < annualCashFlows.length; year++) {
            const monthlyCashFlow = annualCashFlows[year] / 12;
            
            for (let month = 0; month < 12; month++) {
                cumulativeCashFlow += monthlyCashFlow;
                
                if (cumulativeCashFlow >= 0) {
                    // Interpolate for fractional month
                    const remainingToPay = cumulativeCashFlow - monthlyCashFlow;
                    const fractionOfMonth = Math.abs(remainingToPay) / monthlyCashFlow;
                    
                    return Math.round((year * 12 + month + fractionOfMonth) * 10) / 10;
                }
            }
        }
        
        // Investment not recovered within analysis period
        return null;
    },

    /**
     * Calculate Simple ROI
     * ROI = (Total Benefits - Total Costs) / Total Costs * 100
     */
    calculateROI(totalBenefits, totalCosts) {
        if (totalCosts === 0) return null;
        return Math.round(((totalBenefits - totalCosts) / totalCosts) * 10000) / 100;
    },

    /**
     * Calculate Total Cost of Ownership (TCO)
     * Sum of all costs over the analysis period
     */
    calculateTCO(costs, years) {
        const {
            initialInvestment = 0,
            implementationCost = 0,
            trainingCost = 0,
            annualOperatingCost = 0,
            contingencyPercent = 15
        } = costs;
        
        const upfrontCosts = initialInvestment + implementationCost + trainingCost;
        const totalOperatingCosts = annualOperatingCost * years;
        const subtotal = upfrontCosts + totalOperatingCosts;
        const contingency = subtotal * (contingencyPercent / 100);
        
        return Math.round((subtotal + contingency) * 100) / 100;
    },

    /**
     * Generate annual cash flow projections
     */
    generateCashFlowProjections(financialData) {
        const {
            initialInvestment = 0,
            implementationCost = 0,
            trainingCost = 0,
            annualOperatingCost = 0,
            annualCostSavings = 0,
            annualRevenueIncrease = 0,
            productivityGainsPercent = 0,
            riskReductionValue = 0,
            implementationMonths = 12,
            benefitRealizationMonths = 6,
            analysisHorizonYears = 5,
            discountRate = 10
        } = financialData;

        const cashFlows = [];
        const totalAnnualBenefits = annualCostSavings + annualRevenueIncrease + riskReductionValue;
        
        for (let year = 1; year <= analysisHorizonYears; year++) {
            let yearCosts = annualOperatingCost;
            let yearBenefits = 0;
            
            // Year 1: Implementation costs and partial benefits
            if (year === 1) {
                yearCosts += implementationCost + trainingCost;
                // Benefits start after implementation + realization period
                const monthsOfBenefits = Math.max(0, 12 - implementationMonths - benefitRealizationMonths);
                yearBenefits = (totalAnnualBenefits * monthsOfBenefits) / 12;
            } else if (year === 2 && (implementationMonths + benefitRealizationMonths) > 12) {
                // Partial benefits in year 2 if implementation spans year boundary
                const monthsOfBenefits = 12 - ((implementationMonths + benefitRealizationMonths) - 12);
                yearBenefits = (totalAnnualBenefits * Math.max(0, monthsOfBenefits)) / 12;
            } else {
                yearBenefits = totalAnnualBenefits;
            }
            
            const netCashFlow = yearBenefits - yearCosts;
            const discountFactor = 1 / Math.pow(1 + discountRate / 100, year);
            
            cashFlows.push({
                year,
                costs: Math.round(yearCosts * 100) / 100,
                benefits: Math.round(yearBenefits * 100) / 100,
                netCashFlow: Math.round(netCashFlow * 100) / 100,
                discountFactor: Math.round(discountFactor * 10000) / 10000,
                discountedCashFlow: Math.round(netCashFlow * discountFactor * 100) / 100,
                cumulativeCashFlow: 0 // Will be calculated below
            });
        }
        
        // Calculate cumulative cash flows
        let cumulative = -initialInvestment;
        cashFlows.forEach(cf => {
            cumulative += cf.netCashFlow;
            cf.cumulativeCashFlow = Math.round(cumulative * 100) / 100;
        });
        
        return {
            initialInvestment,
            cashFlows,
            totalCosts: Math.round((initialInvestment + cashFlows.reduce((s, cf) => s + cf.costs, 0)) * 100) / 100,
            totalBenefits: Math.round(cashFlows.reduce((s, cf) => s + cf.benefits, 0) * 100) / 100,
            totalNetCashFlow: Math.round(cashFlows.reduce((s, cf) => s + cf.netCashFlow, 0) * 100) / 100
        };
    },

    // ============================================
    // Sensitivity Analysis
    // ============================================

    /**
     * Run sensitivity analysis on key variables
     */
    runSensitivityAnalysis(baseCase, variables, ranges) {
        const { min = -20, max = 20, steps = 5 } = ranges;
        const stepSize = (max - min) / (steps - 1);
        const results = {};
        
        variables.forEach(variable => {
            results[variable] = [];
            
            for (let i = 0; i < steps; i++) {
                const percentChange = min + (stepSize * i);
                const modifiedCase = { ...baseCase };
                
                // Apply percentage change to the variable
                if (modifiedCase[variable] !== undefined) {
                    modifiedCase[variable] = baseCase[variable] * (1 + percentChange / 100);
                }
                
                // Recalculate NPV with modified value
                const projections = this.generateCashFlowProjections(modifiedCase);
                const npv = this.calculateNPV(
                    projections.cashFlows.map(cf => cf.netCashFlow),
                    modifiedCase.discountRate || 10,
                    modifiedCase.initialInvestment || 0
                );
                
                results[variable].push({
                    percentChange,
                    value: modifiedCase[variable],
                    npv
                });
            }
        });
        
        // Generate tornado diagram data
        const tornado = this.generateTornadoData(baseCase, variables, ranges);
        
        return {
            baseCase: {
                npv: this.calculateNPV(
                    this.generateCashFlowProjections(baseCase).cashFlows.map(cf => cf.netCashFlow),
                    baseCase.discountRate || 10,
                    baseCase.initialInvestment || 0
                )
            },
            sensitivity: results,
            tornado
        };
    },

    /**
     * Generate tornado diagram data showing impact of each variable
     */
    generateTornadoData(baseCase, variables, ranges) {
        const { min = -20, max = 20 } = ranges;
        const baseCaseProjections = this.generateCashFlowProjections(baseCase);
        const baseCaseNpv = this.calculateNPV(
            baseCaseProjections.cashFlows.map(cf => cf.netCashFlow),
            baseCase.discountRate || 10,
            baseCase.initialInvestment || 0
        );
        
        const impacts = variables.map(variable => {
            // Low case (decrease by min%)
            const lowCase = { ...baseCase };
            lowCase[variable] = baseCase[variable] * (1 + min / 100);
            const lowProjections = this.generateCashFlowProjections(lowCase);
            const lowNpv = this.calculateNPV(
                lowProjections.cashFlows.map(cf => cf.netCashFlow),
                lowCase.discountRate || 10,
                lowCase.initialInvestment || 0
            );
            
            // High case (increase by max%)
            const highCase = { ...baseCase };
            highCase[variable] = baseCase[variable] * (1 + max / 100);
            const highProjections = this.generateCashFlowProjections(highCase);
            const highNpv = this.calculateNPV(
                highProjections.cashFlows.map(cf => cf.netCashFlow),
                highCase.discountRate || 10,
                highCase.initialInvestment || 0
            );
            
            return {
                variable,
                lowNpv,
                highNpv,
                impact: Math.abs(highNpv - lowNpv),
                baseValue: baseCase[variable],
                lowValue: lowCase[variable],
                highValue: highCase[variable]
            };
        });
        
        // Sort by impact (descending)
        impacts.sort((a, b) => b.impact - a.impact);
        
        return {
            baseCaseNpv,
            impacts
        };
    },

    /**
     * Generate scenario comparisons (best, worst, expected)
     */
    generateScenarioAnalysis(baseCase) {
        const scenarios = {
            best: {
                name: 'Best Case',
                description: '+20% benefits, -10% costs',
                modifications: {
                    annualCostSavings: 1.2,
                    annualRevenueIncrease: 1.2,
                    implementationCost: 0.9,
                    annualOperatingCost: 0.9
                }
            },
            expected: {
                name: 'Expected Case',
                description: 'Base case assumptions',
                modifications: {}
            },
            worst: {
                name: 'Worst Case',
                description: '-20% benefits, +20% costs',
                modifications: {
                    annualCostSavings: 0.8,
                    annualRevenueIncrease: 0.8,
                    implementationCost: 1.2,
                    annualOperatingCost: 1.2
                }
            }
        };
        
        const results = {};
        
        Object.entries(scenarios).forEach(([key, scenario]) => {
            const modifiedCase = { ...baseCase };
            
            Object.entries(scenario.modifications).forEach(([variable, multiplier]) => {
                if (modifiedCase[variable] !== undefined) {
                    modifiedCase[variable] = baseCase[variable] * multiplier;
                }
            });
            
            const projections = this.generateCashFlowProjections(modifiedCase);
            const annualCashFlows = projections.cashFlows.map(cf => cf.netCashFlow);
            
            results[key] = {
                ...scenario,
                npv: this.calculateNPV(annualCashFlows, modifiedCase.discountRate || 10, modifiedCase.initialInvestment || 0),
                irr: this.calculateIRR(annualCashFlows, modifiedCase.initialInvestment || 0),
                paybackMonths: this.calculatePaybackPeriod(modifiedCase.initialInvestment || 0, annualCashFlows),
                roi: this.calculateROI(projections.totalBenefits, projections.totalCosts)
            };
        });
        
        return results;
    },

    // ============================================
    // Database Operations
    // ============================================

    /**
     * Get financial analysis for an initiative
     */
    async getFinancials(initiativeId, organizationId) {
        try {
            const row = await db.get(
                `SELECT * FROM initiative_financials 
                 WHERE initiative_id = ? AND organization_id = ?`,
                [initiativeId, organizationId]
            );
            
            if (!row) return null;
            
            return this.transformFinancialRow(row);
        } catch (error) {
            console.error('[FinancialCalculatorService] getFinancials error:', error);
            throw error;
        }
    },

    /**
     * Create or update financial analysis
     */
    async createOrUpdateFinancials(initiativeId, data, organizationId, userId) {
        const existing = await this.getFinancials(initiativeId, organizationId);
        
        if (existing) {
            return this.updateFinancials(initiativeId, data, organizationId, userId);
        }
        
        const id = uuidv4();
        const now = new Date().toISOString();
        
        // Calculate metrics
        const projections = this.generateCashFlowProjections(data);
        const annualCashFlows = projections.cashFlows.map(cf => cf.netCashFlow);
        const npv = this.calculateNPV(annualCashFlows, data.discountRate || 10, data.initialInvestment || 0);
        const irr = this.calculateIRR(annualCashFlows, data.initialInvestment || 0);
        const paybackMonths = this.calculatePaybackPeriod(data.initialInvestment || 0, annualCashFlows);
        const roi = this.calculateROI(projections.totalBenefits, projections.totalCosts);
        const tco = this.calculateTCO(data, data.analysisHorizonYears || 5);
        
        await db.run(
            `INSERT INTO initiative_financials (
                id, initiative_id, analysis_id, organization_id,
                initial_investment, implementation_cost, annual_operating_cost, training_cost, contingency_percent,
                annual_cost_savings, annual_revenue_increase, productivity_gains_percent, risk_reduction_value,
                implementation_months, benefit_realization_months, analysis_horizon_years, discount_rate,
                npv, irr, payback_months, roi_percent, tco_5year,
                currency, assumptions, cash_flow_projections,
                created_by, created_at, updated_at, last_calculated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, initiativeId, data.analysisId || null, organizationId,
                data.initialInvestment || 0,
                data.implementationCost || 0,
                data.annualOperatingCost || 0,
                data.trainingCost || 0,
                data.contingencyPercent || 15,
                data.annualCostSavings || 0,
                data.annualRevenueIncrease || 0,
                data.productivityGainsPercent || 0,
                data.riskReductionValue || 0,
                data.implementationMonths || 12,
                data.benefitRealizationMonths || 6,
                data.analysisHorizonYears || 5,
                data.discountRate || 10,
                npv, irr, paybackMonths, roi, tco,
                data.currency || 'PLN',
                JSON.stringify(data.assumptions || []),
                JSON.stringify(projections),
                userId, now, now, now
            ]
        );
        
        // Record in history
        await this.recordAssumptionsHistory(id, data, 'initial', userId);
        
        return this.getFinancials(initiativeId, organizationId);
    },

    /**
     * Update existing financial analysis
     */
    async updateFinancials(initiativeId, data, organizationId, userId) {
        const existing = await this.getFinancials(initiativeId, organizationId);
        if (!existing) throw new Error('Financial analysis not found');
        
        // Merge with existing data
        const mergedData = {
            ...existing,
            ...data,
            initialInvestment: data.initialInvestment ?? existing.initialInvestment,
            implementationCost: data.implementationCost ?? existing.implementationCost,
            annualOperatingCost: data.annualOperatingCost ?? existing.annualOperatingCost,
            trainingCost: data.trainingCost ?? existing.trainingCost,
            annualCostSavings: data.annualCostSavings ?? existing.annualCostSavings,
            annualRevenueIncrease: data.annualRevenueIncrease ?? existing.annualRevenueIncrease,
            discountRate: data.discountRate ?? existing.discountRate,
            analysisHorizonYears: data.analysisHorizonYears ?? existing.analysisHorizonYears
        };
        
        // Recalculate metrics
        const projections = this.generateCashFlowProjections(mergedData);
        const annualCashFlows = projections.cashFlows.map(cf => cf.netCashFlow);
        const npv = this.calculateNPV(annualCashFlows, mergedData.discountRate, mergedData.initialInvestment);
        const irr = this.calculateIRR(annualCashFlows, mergedData.initialInvestment);
        const paybackMonths = this.calculatePaybackPeriod(mergedData.initialInvestment, annualCashFlows);
        const roi = this.calculateROI(projections.totalBenefits, projections.totalCosts);
        const tco = this.calculateTCO(mergedData, mergedData.analysisHorizonYears);
        
        const now = new Date().toISOString();
        
        await db.run(
            `UPDATE initiative_financials SET
                initial_investment = ?, implementation_cost = ?, annual_operating_cost = ?, training_cost = ?,
                contingency_percent = ?, annual_cost_savings = ?, annual_revenue_increase = ?,
                productivity_gains_percent = ?, risk_reduction_value = ?,
                implementation_months = ?, benefit_realization_months = ?, analysis_horizon_years = ?,
                discount_rate = ?, npv = ?, irr = ?, payback_months = ?, roi_percent = ?, tco_5year = ?,
                currency = ?, assumptions = ?, cash_flow_projections = ?,
                updated_at = ?, last_calculated_at = ?
            WHERE id = ?`,
            [
                mergedData.initialInvestment,
                mergedData.implementationCost,
                mergedData.annualOperatingCost,
                mergedData.trainingCost,
                mergedData.contingencyPercent,
                mergedData.annualCostSavings,
                mergedData.annualRevenueIncrease,
                mergedData.productivityGainsPercent,
                mergedData.riskReductionValue,
                mergedData.implementationMonths,
                mergedData.benefitRealizationMonths,
                mergedData.analysisHorizonYears,
                mergedData.discountRate,
                npv, irr, paybackMonths, roi, tco,
                mergedData.currency,
                JSON.stringify(data.assumptions || mergedData.assumptions || []),
                JSON.stringify(projections),
                now, now,
                existing.id
            ]
        );
        
        // Record in history
        await this.recordAssumptionsHistory(existing.id, mergedData, 'update', userId);
        
        return this.getFinancials(initiativeId, organizationId);
    },

    /**
     * Recalculate all metrics for an initiative
     */
    async recalculateMetrics(initiativeId, organizationId) {
        const financials = await this.getFinancials(initiativeId, organizationId);
        if (!financials) throw new Error('Financial analysis not found');
        
        const projections = this.generateCashFlowProjections(financials);
        const annualCashFlows = projections.cashFlows.map(cf => cf.netCashFlow);
        
        return {
            npv: this.calculateNPV(annualCashFlows, financials.discountRate, financials.initialInvestment),
            irr: this.calculateIRR(annualCashFlows, financials.initialInvestment),
            paybackMonths: this.calculatePaybackPeriod(financials.initialInvestment, annualCashFlows),
            roi: this.calculateROI(projections.totalBenefits, projections.totalCosts),
            tco: this.calculateTCO(financials, financials.analysisHorizonYears),
            projections
        };
    },

    /**
     * Get cash flow projections for an initiative
     */
    async getCashFlowProjections(initiativeId, organizationId) {
        const financials = await this.getFinancials(initiativeId, organizationId);
        if (!financials) return null;
        
        return this.generateCashFlowProjections(financials);
    },

    /**
     * Record assumptions history for audit trail
     */
    async recordAssumptionsHistory(financialId, data, changeType, userId) {
        const id = uuidv4();
        const now = new Date().toISOString();
        
        await db.run(
            `INSERT INTO financial_assumptions_history (
                id, financial_id, assumptions_snapshot, change_type, changed_by, changed_at
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, financialId, JSON.stringify(data), changeType, userId, now]
        );
    },

    // ============================================
    // Benefit Tracking Operations
    // ============================================

    /**
     * Get benefit tracking records for an initiative
     */
    async getBenefitTracking(initiativeId, filters = {}, organizationId) {
        let query = `SELECT * FROM benefit_tracking WHERE initiative_id = ? AND organization_id = ?`;
        const params = [initiativeId, organizationId];
        
        if (filters.periodType) {
            query += ` AND period_type = ?`;
            params.push(filters.periodType);
        }
        
        if (filters.startDate) {
            query += ` AND period_start >= ?`;
            params.push(filters.startDate);
        }
        
        if (filters.endDate) {
            query += ` AND period_end <= ?`;
            params.push(filters.endDate);
        }
        
        if (filters.verificationStatus) {
            query += ` AND verification_status = ?`;
            params.push(filters.verificationStatus);
        }
        
        query += ` ORDER BY period_start DESC`;
        
        const rows = await db.all(query, params);
        return rows.map(this.transformBenefitRow);
    },

    /**
     * Record a benefit measurement
     */
    async recordBenefitMeasurement(initiativeId, data, organizationId, userId) {
        const financials = await this.getFinancials(initiativeId, organizationId);
        if (!financials) throw new Error('Financial analysis not found for initiative');
        
        const id = uuidv4();
        const now = new Date().toISOString();
        
        // Calculate variances
        const varianceCostSavings = data.plannedCostSavings > 0 
            ? ((data.actualCostSavings - data.plannedCostSavings) / data.plannedCostSavings) * 100 
            : null;
        const varianceRevenue = data.plannedRevenueIncrease > 0 
            ? ((data.actualRevenueIncrease - data.plannedRevenueIncrease) / data.plannedRevenueIncrease) * 100 
            : null;
        const varianceProductivity = data.plannedProductivityGains > 0 
            ? ((data.actualProductivityGains - data.plannedProductivityGains) / data.plannedProductivityGains) * 100 
            : null;
        
        // Overall variance (weighted average of actual vs planned)
        const totalPlanned = (data.plannedCostSavings || 0) + (data.plannedRevenueIncrease || 0);
        const totalActual = (data.actualCostSavings || 0) + (data.actualRevenueIncrease || 0);
        const overallVariance = totalPlanned > 0 
            ? ((totalActual - totalPlanned) / totalPlanned) * 100 
            : null;
        
        await db.run(
            `INSERT INTO benefit_tracking (
                id, financial_id, initiative_id, organization_id,
                period_start, period_end, period_type,
                planned_cost_savings, planned_revenue_increase, planned_productivity_gains,
                actual_cost_savings, actual_revenue_increase, actual_productivity_gains,
                variance_cost_savings_percent, variance_revenue_percent, variance_productivity_percent,
                overall_variance_percent, variance_notes, achievements, challenges, evidence_links,
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, financials.id, initiativeId, organizationId,
                data.periodStart, data.periodEnd, data.periodType || 'monthly',
                data.plannedCostSavings || 0,
                data.plannedRevenueIncrease || 0,
                data.plannedProductivityGains || 0,
                data.actualCostSavings || 0,
                data.actualRevenueIncrease || 0,
                data.actualProductivityGains || 0,
                varianceCostSavings, varianceRevenue, varianceProductivity,
                overallVariance,
                data.varianceNotes || null,
                JSON.stringify(data.achievements || []),
                JSON.stringify(data.challenges || []),
                JSON.stringify(data.evidenceLinks || []),
                userId, now, now
            ]
        );
        
        return this.getBenefitMeasurement(id);
    },

    /**
     * Get a single benefit measurement
     */
    async getBenefitMeasurement(id) {
        const row = await db.get('SELECT * FROM benefit_tracking WHERE id = ?', [id]);
        return row ? this.transformBenefitRow(row) : null;
    },

    /**
     * Update benefit measurement
     */
    async updateBenefitMeasurement(id, data, organizationId, userId) {
        const existing = await this.getBenefitMeasurement(id);
        if (!existing || existing.organization_id !== organizationId) {
            return null;
        }
        
        const now = new Date().toISOString();
        
        await db.run(
            `UPDATE benefit_tracking SET
                actual_cost_savings = COALESCE(?, actual_cost_savings),
                actual_revenue_increase = COALESCE(?, actual_revenue_increase),
                actual_productivity_gains = COALESCE(?, actual_productivity_gains),
                variance_notes = COALESCE(?, variance_notes),
                achievements = COALESCE(?, achievements),
                challenges = COALESCE(?, challenges),
                evidence_links = COALESCE(?, evidence_links),
                updated_at = ?
            WHERE id = ?`,
            [
                data.actualCostSavings,
                data.actualRevenueIncrease,
                data.actualProductivityGains,
                data.varianceNotes,
                data.achievements ? JSON.stringify(data.achievements) : null,
                data.challenges ? JSON.stringify(data.challenges) : null,
                data.evidenceLinks ? JSON.stringify(data.evidenceLinks) : null,
                now,
                id
            ]
        );
        
        return this.getBenefitMeasurement(id);
    },

    /**
     * Verify a benefit measurement
     */
    async verifyBenefitMeasurement(id, userId) {
        const now = new Date().toISOString();
        
        await db.run(
            `UPDATE benefit_tracking SET
                verification_status = 'verified',
                verified_by = ?,
                verified_at = ?,
                updated_at = ?
            WHERE id = ?`,
            [userId, now, now, id]
        );
        
        return this.getBenefitMeasurement(id);
    },

    /**
     * Get benefit tracking summary
     */
    async getBenefitSummary(initiativeId, organizationId) {
        const measurements = await this.getBenefitTracking(initiativeId, {}, organizationId);
        
        if (measurements.length === 0) {
            return {
                totalMeasurements: 0,
                message: 'No benefit measurements recorded yet'
            };
        }
        
        const totalPlannedSavings = measurements.reduce((s, m) => s + (m.plannedCostSavings || 0), 0);
        const totalActualSavings = measurements.reduce((s, m) => s + (m.actualCostSavings || 0), 0);
        const totalPlannedRevenue = measurements.reduce((s, m) => s + (m.plannedRevenueIncrease || 0), 0);
        const totalActualRevenue = measurements.reduce((s, m) => s + (m.actualRevenueIncrease || 0), 0);
        
        const verifiedCount = measurements.filter(m => m.verificationStatus === 'verified').length;
        const pendingCount = measurements.filter(m => m.verificationStatus === 'pending').length;
        
        return {
            totalMeasurements: measurements.length,
            verifiedMeasurements: verifiedCount,
            pendingMeasurements: pendingCount,
            periodsCovered: {
                first: measurements[measurements.length - 1]?.periodStart,
                last: measurements[0]?.periodEnd
            },
            totals: {
                plannedCostSavings: totalPlannedSavings,
                actualCostSavings: totalActualSavings,
                costSavingsVariance: totalPlannedSavings > 0 
                    ? ((totalActualSavings - totalPlannedSavings) / totalPlannedSavings) * 100 
                    : null,
                plannedRevenueIncrease: totalPlannedRevenue,
                actualRevenueIncrease: totalActualRevenue,
                revenueVariance: totalPlannedRevenue > 0 
                    ? ((totalActualRevenue - totalPlannedRevenue) / totalPlannedRevenue) * 100 
                    : null,
                totalPlanned: totalPlannedSavings + totalPlannedRevenue,
                totalActual: totalActualSavings + totalActualRevenue
            },
            averageVariance: measurements.reduce((s, m) => s + (m.overallVariancePercent || 0), 0) / measurements.length
        };
    },

    /**
     * Get variance analysis details
     */
    async getVarianceAnalysis(initiativeId, organizationId) {
        const measurements = await this.getBenefitTracking(initiativeId, {}, organizationId);
        const financials = await this.getFinancials(initiativeId, organizationId);
        
        if (!financials || measurements.length === 0) {
            return {
                message: 'Insufficient data for variance analysis',
                hasFinancials: !!financials,
                measurementCount: measurements.length
            };
        }
        
        // Group by period type
        const byPeriod = {};
        measurements.forEach(m => {
            const key = m.periodType;
            if (!byPeriod[key]) byPeriod[key] = [];
            byPeriod[key].push(m);
        });
        
        // Trend analysis
        const chronological = [...measurements].reverse();
        const trend = chronological.map((m, i) => ({
            period: `${m.periodStart} - ${m.periodEnd}`,
            variance: m.overallVariancePercent,
            cumulative: chronological.slice(0, i + 1).reduce((s, x) => s + (x.overallVariancePercent || 0), 0) / (i + 1)
        }));
        
        return {
            originalProjection: financials.cashFlowProjections,
            actualPerformance: {
                totalSavings: measurements.reduce((s, m) => s + (m.actualCostSavings || 0), 0),
                totalRevenue: measurements.reduce((s, m) => s + (m.actualRevenueIncrease || 0), 0)
            },
            varianceByPeriodType: Object.entries(byPeriod).reduce((acc, [type, records]) => {
                acc[type] = {
                    count: records.length,
                    averageVariance: records.reduce((s, r) => s + (r.overallVariancePercent || 0), 0) / records.length
                };
                return acc;
            }, {}),
            trend,
            recommendations: this.generateVarianceRecommendations(measurements)
        };
    },

    /**
     * Generate recommendations based on variance patterns
     */
    generateVarianceRecommendations(measurements) {
        const recommendations = [];
        const avgVariance = measurements.reduce((s, m) => s + (m.overallVariancePercent || 0), 0) / measurements.length;
        
        if (avgVariance < -10) {
            recommendations.push({
                type: 'warning',
                message: 'Benefits are significantly below projections. Consider revising assumptions or investigating root causes.',
                priority: 'high'
            });
        } else if (avgVariance < 0) {
            recommendations.push({
                type: 'caution',
                message: 'Benefits are slightly below projections. Monitor closely for developing trends.',
                priority: 'medium'
            });
        } else if (avgVariance > 20) {
            recommendations.push({
                type: 'info',
                message: 'Benefits are exceeding projections significantly. Consider documenting success factors.',
                priority: 'low'
            });
        }
        
        // Check for verification backlog
        const pendingCount = measurements.filter(m => m.verificationStatus === 'pending').length;
        if (pendingCount > 3) {
            recommendations.push({
                type: 'action',
                message: `${pendingCount} benefit measurements are pending verification. Schedule verification reviews.`,
                priority: 'medium'
            });
        }
        
        return recommendations;
    },

    /**
     * Generate business case document data
     */
    async generateBusinessCase(initiativeId, options, organizationId) {
        const financials = await this.getFinancials(initiativeId, organizationId);
        if (!financials) throw new Error('Financial analysis not found');
        
        const projections = this.generateCashFlowProjections(financials);
        const scenarios = this.generateScenarioAnalysis(financials);
        const sensitivity = options.includeSensitivity 
            ? this.runSensitivityAnalysis(
                financials,
                ['annualCostSavings', 'annualRevenueIncrease', 'initialInvestment', 'discountRate'],
                { min: -20, max: 20, steps: 5 }
              )
            : null;
        
        return {
            generated: new Date().toISOString(),
            template: options.template,
            language: options.language,
            summary: {
                npv: financials.npv,
                irr: financials.irr,
                paybackMonths: financials.paybackMonths,
                roi: financials.roiPercent,
                tco: financials.tco5Year,
                recommendation: this.generateInvestmentRecommendation(financials)
            },
            financials,
            cashFlowProjections: projections,
            scenarios,
            sensitivity,
            assumptions: financials.assumptions,
            risks: this.identifyFinancialRisks(financials, scenarios)
        };
    },

    /**
     * Generate investment recommendation based on metrics
     */
    generateInvestmentRecommendation(financials) {
        const { npv, irr, paybackMonths } = financials;
        
        if (npv > 0 && irr > 15 && paybackMonths < 24) {
            return {
                verdict: 'STRONGLY_RECOMMENDED',
                summary: 'Strong financial case with positive NPV, high IRR, and quick payback.',
                confidence: 'high'
            };
        } else if (npv > 0 && irr > 10) {
            return {
                verdict: 'RECOMMENDED',
                summary: 'Positive financial case meeting investment thresholds.',
                confidence: 'medium'
            };
        } else if (npv > 0) {
            return {
                verdict: 'CONDITIONAL',
                summary: 'Marginal financial case. Consider strategic value and risk factors.',
                confidence: 'low'
            };
        } else {
            return {
                verdict: 'NOT_RECOMMENDED',
                summary: 'Negative NPV indicates investment may not meet return requirements.',
                confidence: 'high'
            };
        }
    },

    /**
     * Identify financial risks from analysis
     */
    identifyFinancialRisks(financials, scenarios) {
        const risks = [];
        
        // Payback risk
        if (financials.paybackMonths > 36) {
            risks.push({
                category: 'Payback',
                level: 'high',
                description: 'Long payback period increases exposure to changing business conditions.'
            });
        }
        
        // Sensitivity risk
        if (scenarios.worst.npv < 0 && scenarios.expected.npv > 0) {
            risks.push({
                category: 'Sensitivity',
                level: 'medium',
                description: 'Worst case scenario results in negative NPV. Benefits must be closely managed.'
            });
        }
        
        // Benefit concentration risk
        const totalBenefits = financials.annualCostSavings + financials.annualRevenueIncrease;
        if (financials.annualCostSavings / totalBenefits > 0.8 || financials.annualRevenueIncrease / totalBenefits > 0.8) {
            risks.push({
                category: 'Concentration',
                level: 'medium',
                description: 'Benefits are concentrated in a single category, increasing single-point-of-failure risk.'
            });
        }
        
        return risks;
    },

    // ============================================
    // Data Transformation Helpers
    // ============================================

    transformFinancialRow(row) {
        if (!row) return null;
        
        return {
            id: row.id,
            initiativeId: row.initiative_id,
            analysisId: row.analysis_id,
            organizationId: row.organization_id,
            
            // Costs
            initialInvestment: row.initial_investment,
            implementationCost: row.implementation_cost,
            annualOperatingCost: row.annual_operating_cost,
            trainingCost: row.training_cost,
            contingencyPercent: row.contingency_percent,
            
            // Benefits
            annualCostSavings: row.annual_cost_savings,
            annualRevenueIncrease: row.annual_revenue_increase,
            productivityGainsPercent: row.productivity_gains_percent,
            riskReductionValue: row.risk_reduction_value,
            
            // Time
            implementationMonths: row.implementation_months,
            benefitRealizationMonths: row.benefit_realization_months,
            analysisHorizonYears: row.analysis_horizon_years,
            discountRate: row.discount_rate,
            
            // Calculated
            npv: row.npv,
            irr: row.irr,
            paybackMonths: row.payback_months,
            roiPercent: row.roi_percent,
            tco5Year: row.tco_5year,
            
            // Metadata
            currency: row.currency,
            assumptions: row.assumptions ? JSON.parse(row.assumptions) : [],
            cashFlowProjections: row.cash_flow_projections ? JSON.parse(row.cash_flow_projections) : null,
            sensitivityResults: row.sensitivity_results ? JSON.parse(row.sensitivity_results) : null,
            
            // Audit
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastCalculatedAt: row.last_calculated_at
        };
    },

    transformBenefitRow(row) {
        if (!row) return null;
        
        return {
            id: row.id,
            financialId: row.financial_id,
            initiativeId: row.initiative_id,
            organizationId: row.organization_id,
            
            periodStart: row.period_start,
            periodEnd: row.period_end,
            periodType: row.period_type,
            
            plannedCostSavings: row.planned_cost_savings,
            plannedRevenueIncrease: row.planned_revenue_increase,
            plannedProductivityGains: row.planned_productivity_gains,
            
            actualCostSavings: row.actual_cost_savings,
            actualRevenueIncrease: row.actual_revenue_increase,
            actualProductivityGains: row.actual_productivity_gains,
            
            varianceCostSavingsPercent: row.variance_cost_savings_percent,
            varianceRevenuePercent: row.variance_revenue_percent,
            varianceProductivityPercent: row.variance_productivity_percent,
            overallVariancePercent: row.overall_variance_percent,
            
            varianceNotes: row.variance_notes,
            achievements: row.achievements ? JSON.parse(row.achievements) : [],
            challenges: row.challenges ? JSON.parse(row.challenges) : [],
            evidenceLinks: row.evidence_links ? JSON.parse(row.evidence_links) : [],
            
            verificationStatus: row.verification_status,
            verifiedBy: row.verified_by,
            verifiedAt: row.verified_at,
            
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
};

module.exports = FinancialCalculatorService;






