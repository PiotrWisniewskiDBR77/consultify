/**
 * Quality Assessment Service
 * 
 * Evaluates forecast accuracy, methodology quality, and documentation completeness.
 * Captures lessons learned and generates improvement recommendations.
 * 
 * PMO Standards Compliance:
 * - ISO 21500:2021 - Lessons Learned Management
 * - PMI PMBOK 7 - Delivery Performance Domain
 * - PRINCE2 - Quality Theme
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const QualityAssessmentService = {
    // ============================================
    // Quality Score Calculations
    // ============================================

    /**
     * Calculate forecast accuracy score (0-100)
     * Based on variance between planned and actual values
     */
    calculateForecastAccuracy(planned, actual) {
        if (!planned || !actual) return null;
        
        const {
            costSavings: plannedSavings = 0,
            revenueIncrease: plannedRevenue = 0,
            timeline: plannedTimeline = 0
        } = planned;
        
        const {
            costSavings: actualSavings = 0,
            revenueIncrease: actualRevenue = 0,
            timeline: actualTimeline = 0
        } = actual;
        
        // Calculate individual variances (absolute percentage)
        const savingsVariance = plannedSavings > 0 
            ? Math.abs((actualSavings - plannedSavings) / plannedSavings) * 100 
            : 0;
        const revenueVariance = plannedRevenue > 0 
            ? Math.abs((actualRevenue - plannedRevenue) / plannedRevenue) * 100 
            : 0;
        const timelineVariance = plannedTimeline > 0 
            ? Math.abs((actualTimeline - plannedTimeline) / plannedTimeline) * 100 
            : 0;
        
        // Accuracy = 100 - average variance (capped at 0)
        const avgVariance = (savingsVariance + revenueVariance + timelineVariance) / 3;
        const accuracy = Math.max(0, 100 - avgVariance);
        
        return {
            score: Math.round(accuracy * 10) / 10,
            costVariancePercent: savingsVariance,
            benefitVariancePercent: revenueVariance,
            timelineVariancePercent: timelineVariance
        };
    },

    /**
     * Calculate methodology quality score (0-100)
     * Based on completeness and rigor of financial analysis
     */
    calculateMethodologyScore(financials) {
        if (!financials) return { score: 0, details: {} };
        
        let score = 0;
        const details = {};
        
        // Check for comprehensive cost analysis (20 points)
        const hasCostBreakdown = (
            financials.initialInvestment > 0 ||
            financials.implementationCost > 0 ||
            financials.annualOperatingCost > 0 ||
            financials.trainingCost > 0
        );
        if (hasCostBreakdown) {
            score += 10;
            details.costAnalysis = 'complete';
        }
        if (financials.contingencyPercent > 0) {
            score += 10;
            details.contingencyIncluded = true;
        }
        
        // Check for benefit analysis (20 points)
        const hasBenefitBreakdown = (
            financials.annualCostSavings > 0 ||
            financials.annualRevenueIncrease > 0
        );
        if (hasBenefitBreakdown) {
            score += 20;
            details.benefitAnalysis = 'complete';
        }
        
        // Check for time parameters (15 points)
        if (financials.implementationMonths > 0) {
            score += 5;
            details.implementationTimeline = true;
        }
        if (financials.benefitRealizationMonths > 0) {
            score += 5;
            details.benefitRealizationTimeline = true;
        }
        if (financials.analysisHorizonYears >= 3) {
            score += 5;
            details.adequateHorizon = true;
        }
        
        // Check for financial metrics calculated (25 points)
        if (financials.npv !== null) {
            score += 10;
            details.npvCalculated = true;
        }
        if (financials.irr !== null) {
            score += 5;
            details.irrCalculated = true;
        }
        if (financials.paybackMonths !== null) {
            score += 5;
            details.paybackCalculated = true;
        }
        if (financials.roiPercent !== null) {
            score += 5;
            details.roiCalculated = true;
        }
        
        // Check for assumptions documented (10 points)
        const assumptionsCount = financials.assumptions?.length || 0;
        if (assumptionsCount >= 3) {
            score += 10;
            details.assumptionsDocumented = true;
            details.assumptionsCount = assumptionsCount;
        } else if (assumptionsCount > 0) {
            score += 5;
            details.assumptionsPartial = true;
            details.assumptionsCount = assumptionsCount;
        }
        
        // Check for sensitivity analysis (10 points)
        if (financials.sensitivityResults) {
            score += 10;
            details.sensitivityAnalysis = true;
        }
        
        return {
            score: Math.min(100, score),
            details
        };
    },

    /**
     * Calculate documentation completeness score (0-100)
     */
    calculateDocumentationScore(analysis, financials, benefitTracking) {
        let score = 0;
        const details = {};
        
        // Analysis description (15 points)
        if (analysis?.description && analysis.description.length > 50) {
            score += 15;
            details.descriptionComplete = true;
        } else if (analysis?.description) {
            score += 5;
            details.descriptionPartial = true;
        }
        
        // Financials assumptions (20 points)
        const assumptionsCount = financials?.assumptions?.length || 0;
        if (assumptionsCount >= 5) {
            score += 20;
            details.assumptionsComplete = true;
        } else if (assumptionsCount >= 2) {
            score += 10;
            details.assumptionsPartial = true;
        }
        
        // Cash flow projections (15 points)
        if (financials?.cashFlowProjections) {
            score += 15;
            details.cashFlowDocumented = true;
        }
        
        // Benefit tracking records (25 points)
        const trackingCount = benefitTracking?.length || 0;
        if (trackingCount >= 6) { // 6 months of tracking
            score += 25;
            details.trackingComplete = true;
        } else if (trackingCount >= 3) {
            score += 15;
            details.trackingPartial = true;
        } else if (trackingCount > 0) {
            score += 5;
            details.trackingStarted = true;
        }
        details.trackingRecords = trackingCount;
        
        // Evidence links (15 points)
        const totalEvidence = (benefitTracking || []).reduce((sum, bt) => {
            return sum + (bt.evidenceLinks?.length || 0);
        }, 0);
        if (totalEvidence >= 10) {
            score += 15;
            details.evidenceComplete = true;
        } else if (totalEvidence >= 3) {
            score += 8;
            details.evidencePartial = true;
        }
        details.evidenceCount = totalEvidence;
        
        // Verification status (10 points)
        const verifiedCount = (benefitTracking || []).filter(bt => bt.verificationStatus === 'verified').length;
        if (trackingCount > 0) {
            const verificationRate = verifiedCount / trackingCount;
            if (verificationRate >= 0.8) {
                score += 10;
                details.verificationComplete = true;
            } else if (verificationRate >= 0.5) {
                score += 5;
                details.verificationPartial = true;
            }
            details.verificationRate = Math.round(verificationRate * 100);
        }
        
        return {
            score: Math.min(100, score),
            details
        };
    },

    /**
     * Calculate data quality score (0-100)
     */
    calculateDataQualityScore(benefitTracking) {
        if (!benefitTracking || benefitTracking.length === 0) {
            return { score: 0, details: { message: 'No tracking data available' } };
        }
        
        let score = 0;
        const details = {};
        
        // Completeness - all required fields filled (30 points)
        const completeRecords = benefitTracking.filter(bt => 
            bt.actualCostSavings !== null && 
            bt.actualRevenueIncrease !== null
        ).length;
        const completenessRate = completeRecords / benefitTracking.length;
        score += Math.round(completenessRate * 30);
        details.completenessRate = Math.round(completenessRate * 100);
        
        // Consistency - regular reporting periods (25 points)
        const periodTypes = [...new Set(benefitTracking.map(bt => bt.periodType))];
        if (periodTypes.length === 1) {
            score += 25;
            details.consistentPeriods = true;
        } else if (periodTypes.length <= 2) {
            score += 15;
            details.mostlyConsistent = true;
        }
        details.periodTypes = periodTypes;
        
        // Timeliness - records within expected timeframes (25 points)
        // Simplified: check if records exist for recent periods
        const now = new Date();
        const recentRecords = benefitTracking.filter(bt => {
            const endDate = new Date(bt.periodEnd);
            const daysSinceEnd = (now - endDate) / (1000 * 60 * 60 * 24);
            return daysSinceEnd <= 45; // Within last 45 days
        }).length;
        if (recentRecords > 0) {
            score += 25;
            details.timely = true;
        }
        details.recentRecords = recentRecords;
        
        // Variance explanation (20 points)
        const recordsWithNotes = benefitTracking.filter(bt => 
            bt.varianceNotes && bt.varianceNotes.length > 20
        ).length;
        const notesRate = recordsWithNotes / benefitTracking.length;
        score += Math.round(notesRate * 20);
        details.varianceNotesRate = Math.round(notesRate * 100);
        
        return {
            score: Math.min(100, Math.round(score)),
            details
        };
    },

    /**
     * Determine overall quality rating
     */
    determineOverallRating(scores) {
        const {
            forecastAccuracy = 0,
            methodology = 0,
            documentation = 0,
            dataQuality = 0
        } = scores;
        
        // Weighted average
        const weights = {
            forecastAccuracy: 0.35,
            methodology: 0.25,
            documentation: 0.20,
            dataQuality: 0.20
        };
        
        const overallScore = (
            forecastAccuracy * weights.forecastAccuracy +
            methodology * weights.methodology +
            documentation * weights.documentation +
            dataQuality * weights.dataQuality
        );
        
        let rating;
        if (overallScore >= 85) rating = 'excellent';
        else if (overallScore >= 70) rating = 'good';
        else if (overallScore >= 50) rating = 'acceptable';
        else rating = 'poor';
        
        return {
            score: Math.round(overallScore * 10) / 10,
            rating
        };
    },

    // ============================================
    // Lessons Learned Management
    // ============================================

    /**
     * Extract lessons learned from assessment data
     */
    extractLessonsLearned(assessmentData) {
        const lessons = [];
        const { forecastDetails, methodologyDetails, trackingData } = assessmentData;
        
        // Forecast accuracy lessons
        if (forecastDetails) {
            if (forecastDetails.costVariancePercent > 20) {
                lessons.push({
                    category: 'Cost Estimation',
                    type: 'improvement',
                    lesson: 'Cost estimates were significantly off target. Consider using historical data and expert validation for future estimates.',
                    impact: 'high'
                });
            }
            
            if (forecastDetails.benefitVariancePercent > 25) {
                lessons.push({
                    category: 'Benefit Estimation',
                    type: 'improvement',
                    lesson: 'Benefit projections did not match reality. Consider more conservative assumptions and phased benefit realization.',
                    impact: 'high'
                });
            }
            
            if (forecastDetails.timelineVariancePercent > 30) {
                lessons.push({
                    category: 'Timeline',
                    type: 'improvement',
                    lesson: 'Implementation timeline was significantly over/under estimated. Include buffer for unforeseen delays.',
                    impact: 'medium'
                });
            }
            
            if (forecastDetails.costVariancePercent < 10 && forecastDetails.benefitVariancePercent < 15) {
                lessons.push({
                    category: 'Estimation Process',
                    type: 'success',
                    lesson: 'Forecasting methodology was effective. Document and replicate the approach used.',
                    impact: 'medium'
                });
            }
        }
        
        // Methodology lessons
        if (methodologyDetails) {
            if (!methodologyDetails.sensitivityAnalysis) {
                lessons.push({
                    category: 'Risk Assessment',
                    type: 'improvement',
                    lesson: 'Sensitivity analysis was not performed. Include scenario analysis in future business cases.',
                    impact: 'medium'
                });
            }
            
            if (methodologyDetails.assumptionsCount < 3) {
                lessons.push({
                    category: 'Documentation',
                    type: 'improvement',
                    lesson: 'Assumptions were not adequately documented. Ensure all key assumptions are explicitly stated.',
                    impact: 'medium'
                });
            }
        }
        
        // Tracking lessons
        if (trackingData && trackingData.length > 0) {
            const challengePatterns = this.analyzeTrackingPatterns(trackingData);
            
            if (challengePatterns.commonChallenges.length > 0) {
                lessons.push({
                    category: 'Implementation',
                    type: 'improvement',
                    lesson: `Recurring challenges identified: ${challengePatterns.commonChallenges.join(', ')}. Develop mitigation strategies for future projects.`,
                    impact: 'high'
                });
            }
            
            if (challengePatterns.successFactors.length > 0) {
                lessons.push({
                    category: 'Success Factors',
                    type: 'success',
                    lesson: `Key success factors: ${challengePatterns.successFactors.join(', ')}. Incorporate these into future project planning.`,
                    impact: 'high'
                });
            }
        }
        
        return lessons;
    },

    /**
     * Analyze benefit tracking patterns for insights
     */
    analyzeTrackingPatterns(trackingData) {
        const challenges = [];
        const successes = [];
        
        trackingData.forEach(record => {
            // Extract challenges
            if (record.challenges && Array.isArray(record.challenges)) {
                challenges.push(...record.challenges);
            }
            
            // Extract achievements
            if (record.achievements && Array.isArray(record.achievements)) {
                successes.push(...record.achievements);
            }
        });
        
        // Find common themes (simplified - in production would use NLP)
        const commonChallenges = this.findCommonThemes(challenges);
        const successFactors = this.findCommonThemes(successes);
        
        return {
            commonChallenges,
            successFactors,
            totalChallenges: challenges.length,
            totalSuccesses: successes.length
        };
    },

    /**
     * Find common themes in text array (simplified)
     */
    findCommonThemes(textArray, maxThemes = 3) {
        if (!textArray || textArray.length < 2) return textArray.slice(0, maxThemes);
        
        // Simple keyword frequency (production would use NLP)
        const keywords = {};
        const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'and', 'for', 'in', 'on'];
        
        textArray.forEach(text => {
            if (typeof text === 'string') {
                text.toLowerCase().split(/\s+/).forEach(word => {
                    if (word.length > 3 && !stopWords.includes(word)) {
                        keywords[word] = (keywords[word] || 0) + 1;
                    }
                });
            }
        });
        
        // Return most frequent keywords
        return Object.entries(keywords)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxThemes)
            .map(([word]) => word);
    },

    /**
     * Generate improvement recommendations
     */
    generateImprovementRecommendations(scores, lessons) {
        const recommendations = [];
        
        // Based on scores
        if (scores.forecastAccuracy < 70) {
            recommendations.push({
                area: 'Forecasting',
                priority: 'high',
                recommendation: 'Improve forecasting methodology by using historical data, expert validation, and more conservative assumptions.',
                actions: [
                    'Create database of actual vs projected outcomes',
                    'Implement mandatory peer review for financial projections',
                    'Add confidence intervals to all estimates'
                ]
            });
        }
        
        if (scores.methodology < 70) {
            recommendations.push({
                area: 'Business Case Methodology',
                priority: 'high',
                recommendation: 'Enhance business case rigor with comprehensive analysis components.',
                actions: [
                    'Create business case template with all required sections',
                    'Implement sensitivity analysis as mandatory step',
                    'Document all assumptions with rationale'
                ]
            });
        }
        
        if (scores.documentation < 60) {
            recommendations.push({
                area: 'Documentation',
                priority: 'medium',
                recommendation: 'Improve documentation practices throughout the initiative lifecycle.',
                actions: [
                    'Create documentation checklist for each phase',
                    'Implement regular documentation reviews',
                    'Use standardized templates for all deliverables'
                ]
            });
        }
        
        if (scores.dataQuality < 60) {
            recommendations.push({
                area: 'Benefit Tracking',
                priority: 'medium',
                recommendation: 'Strengthen benefit tracking process for better data quality.',
                actions: [
                    'Establish regular benefit measurement cadence',
                    'Define clear data collection responsibilities',
                    'Implement automated data collection where possible'
                ]
            });
        }
        
        // Based on lessons
        const highImpactLessons = lessons.filter(l => l.impact === 'high' && l.type === 'improvement');
        highImpactLessons.forEach(lesson => {
            if (!recommendations.find(r => r.area.toLowerCase().includes(lesson.category.toLowerCase()))) {
                recommendations.push({
                    area: lesson.category,
                    priority: 'high',
                    recommendation: lesson.lesson,
                    actions: ['Review and implement lesson learned in future planning']
                });
            }
        });
        
        return recommendations;
    },

    // ============================================
    // Database Operations
    // ============================================

    /**
     * Get quality assessment for an initiative
     */
    async getQualityAssessment(initiativeId, organizationId) {
        try {
            const row = await db.get(
                `SELECT * FROM initiative_quality_assessment 
                 WHERE initiative_id = ? AND organization_id = ?
                 ORDER BY assessed_at DESC LIMIT 1`,
                [initiativeId, organizationId]
            );
            
            return row ? this.transformAssessmentRow(row) : null;
        } catch (error) {
            console.error('[QualityAssessmentService] getQualityAssessment error:', error);
            throw error;
        }
    },

    /**
     * Create quality assessment
     */
    async createQualityAssessment(initiativeId, data, organizationId, userId) {
        const id = uuidv4();
        const now = new Date().toISOString();
        
        // Get related data for scoring
        const FinancialService = require('./financialCalculatorService');
        const financials = await FinancialService.getFinancials(initiativeId, organizationId);
        const benefitTracking = await FinancialService.getBenefitTracking(initiativeId, {}, organizationId);
        
        // Calculate scores
        const methodologyResult = this.calculateMethodologyScore(financials);
        const documentationResult = this.calculateDocumentationScore(null, financials, benefitTracking);
        const dataQualityResult = this.calculateDataQualityScore(benefitTracking);
        
        // Get forecast accuracy if we have benefit tracking data
        let forecastAccuracyResult = { score: null };
        if (financials && benefitTracking.length > 0) {
            const planned = {
                costSavings: financials.annualCostSavings,
                revenueIncrease: financials.annualRevenueIncrease,
                timeline: financials.implementationMonths
            };
            
            // Aggregate actuals from tracking
            const actual = {
                costSavings: benefitTracking.reduce((s, bt) => s + (bt.actualCostSavings || 0), 0) / benefitTracking.length * 12,
                revenueIncrease: benefitTracking.reduce((s, bt) => s + (bt.actualRevenueIncrease || 0), 0) / benefitTracking.length * 12,
                timeline: financials.implementationMonths // Would need actual from project data
            };
            
            forecastAccuracyResult = this.calculateForecastAccuracy(planned, actual) || { score: null };
        }
        
        // Determine overall rating
        const overallResult = this.determineOverallRating({
            forecastAccuracy: forecastAccuracyResult.score || 50, // Default if not calculable
            methodology: methodologyResult.score,
            documentation: documentationResult.score,
            dataQuality: dataQualityResult.score
        });
        
        // Extract lessons learned
        const lessons = this.extractLessonsLearned({
            forecastDetails: forecastAccuracyResult,
            methodologyDetails: methodologyResult.details,
            trackingData: benefitTracking
        });
        
        // Combine with user-provided lessons
        const allLessons = [...lessons, ...(data.lessonsLearned || [])];
        
        // Generate recommendations
        const recommendations = this.generateImprovementRecommendations(
            {
                forecastAccuracy: forecastAccuracyResult.score || 50,
                methodology: methodologyResult.score,
                documentation: documentationResult.score,
                dataQuality: dataQualityResult.score
            },
            allLessons
        );
        
        // Combine with user-provided recommendations
        const allRecommendations = [...recommendations, ...(data.improvementRecommendations || [])];
        
        await db.run(
            `INSERT INTO initiative_quality_assessment (
                id, initiative_id, financial_id, organization_id,
                forecast_accuracy_score, cost_variance_percent, benefit_variance_percent, timeline_variance_percent,
                methodology_score, data_quality_score, assumption_validity_score,
                documentation_score, evidence_completeness_percent,
                lessons_learned, improvement_recommendations, best_practices_identified,
                overall_quality_rating, overall_quality_score,
                assessment_type, assessment_notes,
                assessed_by, assessed_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, initiativeId, financials?.id || null, organizationId,
                forecastAccuracyResult.score,
                forecastAccuracyResult.costVariancePercent || null,
                forecastAccuracyResult.benefitVariancePercent || null,
                forecastAccuracyResult.timelineVariancePercent || null,
                methodologyResult.score,
                dataQualityResult.score,
                null, // assumption_validity_score - would need additional analysis
                documentationResult.score,
                documentationResult.details.verificationRate || null,
                JSON.stringify(allLessons),
                JSON.stringify(allRecommendations),
                JSON.stringify([]), // best_practices_identified
                overallResult.rating,
                overallResult.score,
                data.assessmentType || 'post_implementation',
                data.assessmentNotes || null,
                userId, now, now, now
            ]
        );
        
        return this.getQualityAssessment(initiativeId, organizationId);
    },

    /**
     * Update quality assessment
     */
    async updateQualityAssessment(initiativeId, data, organizationId, userId) {
        const existing = await this.getQualityAssessment(initiativeId, organizationId);
        if (!existing) return null;
        
        const now = new Date().toISOString();
        
        await db.run(
            `UPDATE initiative_quality_assessment SET
                lessons_learned = COALESCE(?, lessons_learned),
                improvement_recommendations = COALESCE(?, improvement_recommendations),
                best_practices_identified = COALESCE(?, best_practices_identified),
                assessment_notes = COALESCE(?, assessment_notes),
                updated_at = ?
            WHERE id = ?`,
            [
                data.lessonsLearned ? JSON.stringify(data.lessonsLearned) : null,
                data.improvementRecommendations ? JSON.stringify(data.improvementRecommendations) : null,
                data.bestPractices ? JSON.stringify(data.bestPractices) : null,
                data.assessmentNotes,
                now,
                existing.id
            ]
        );
        
        return this.getQualityAssessment(initiativeId, organizationId);
    },

    /**
     * Recalculate quality scores based on current data
     */
    async recalculateQualityScores(initiativeId, organizationId) {
        const existing = await this.getQualityAssessment(initiativeId, organizationId);
        
        const FinancialService = require('./financialCalculatorService');
        const financials = await FinancialService.getFinancials(initiativeId, organizationId);
        const benefitTracking = await FinancialService.getBenefitTracking(initiativeId, {}, organizationId);
        
        // Recalculate all scores
        const methodologyResult = this.calculateMethodologyScore(financials);
        const documentationResult = this.calculateDocumentationScore(null, financials, benefitTracking);
        const dataQualityResult = this.calculateDataQualityScore(benefitTracking);
        
        let forecastAccuracyResult = { score: existing?.forecastAccuracyScore || null };
        if (financials && benefitTracking.length > 0) {
            const planned = {
                costSavings: financials.annualCostSavings,
                revenueIncrease: financials.annualRevenueIncrease,
                timeline: financials.implementationMonths
            };
            const actual = {
                costSavings: benefitTracking.reduce((s, bt) => s + (bt.actualCostSavings || 0), 0) / benefitTracking.length * 12,
                revenueIncrease: benefitTracking.reduce((s, bt) => s + (bt.actualRevenueIncrease || 0), 0) / benefitTracking.length * 12,
                timeline: financials.implementationMonths
            };
            forecastAccuracyResult = this.calculateForecastAccuracy(planned, actual) || forecastAccuracyResult;
        }
        
        const overallResult = this.determineOverallRating({
            forecastAccuracy: forecastAccuracyResult.score || 50,
            methodology: methodologyResult.score,
            documentation: documentationResult.score,
            dataQuality: dataQualityResult.score
        });
        
        const now = new Date().toISOString();
        
        if (existing) {
            await db.run(
                `UPDATE initiative_quality_assessment SET
                    forecast_accuracy_score = ?,
                    cost_variance_percent = ?,
                    benefit_variance_percent = ?,
                    methodology_score = ?,
                    data_quality_score = ?,
                    documentation_score = ?,
                    evidence_completeness_percent = ?,
                    overall_quality_rating = ?,
                    overall_quality_score = ?,
                    updated_at = ?
                WHERE id = ?`,
                [
                    forecastAccuracyResult.score,
                    forecastAccuracyResult.costVariancePercent || null,
                    forecastAccuracyResult.benefitVariancePercent || null,
                    methodologyResult.score,
                    dataQualityResult.score,
                    documentationResult.score,
                    documentationResult.details.verificationRate || null,
                    overallResult.rating,
                    overallResult.score,
                    now,
                    existing.id
                ]
            );
        }
        
        return this.getQualityAssessment(initiativeId, organizationId);
    },

    /**
     * Get lessons learned for an initiative
     */
    async getLessonsLearned(initiativeId, organizationId) {
        const assessment = await this.getQualityAssessment(initiativeId, organizationId);
        return assessment?.lessonsLearned || [];
    },

    // ============================================
    // Transformation Helpers
    // ============================================

    transformAssessmentRow(row) {
        if (!row) return null;
        
        return {
            id: row.id,
            initiativeId: row.initiative_id,
            financialId: row.financial_id,
            organizationId: row.organization_id,
            
            // Scores
            forecastAccuracyScore: row.forecast_accuracy_score,
            costVariancePercent: row.cost_variance_percent,
            benefitVariancePercent: row.benefit_variance_percent,
            timelineVariancePercent: row.timeline_variance_percent,
            
            methodologyScore: row.methodology_score,
            dataQualityScore: row.data_quality_score,
            assumptionValidityScore: row.assumption_validity_score,
            
            documentationScore: row.documentation_score,
            evidenceCompletenessPercent: row.evidence_completeness_percent,
            
            // Lessons and Recommendations
            lessonsLearned: row.lessons_learned ? JSON.parse(row.lessons_learned) : [],
            improvementRecommendations: row.improvement_recommendations ? JSON.parse(row.improvement_recommendations) : [],
            bestPracticesIdentified: row.best_practices_identified ? JSON.parse(row.best_practices_identified) : [],
            
            // Overall
            overallQualityRating: row.overall_quality_rating,
            overallQualityScore: row.overall_quality_score,
            
            // Metadata
            assessmentType: row.assessment_type,
            assessmentNotes: row.assessment_notes,
            
            assessedBy: row.assessed_by,
            assessedAt: row.assessed_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
};

module.exports = QualityAssessmentService;


