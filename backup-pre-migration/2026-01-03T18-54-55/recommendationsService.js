/**
 * Recommendations Service
 * Generates strategic recommendations based on assessment results
 * Implements: Development, Balance, and Stabilization recommendations
 */

const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

const RecommendationsService = {
    /**
     * Generate Development Recommendations
     * For each axis with current level X, recommend level X+1 (immediate) and X+2 (long-term)
     */
    generateDevelopmentRecommendations: (axes) => {
        const recommendations = [];
        
        Object.entries(axes).forEach(([axisId, axisData]) => {
            if (!axisData || !axisData.actual) return;
            
            const current = axisData.actual;
            const target = axisData.target || current;
            
            // Only recommend if current < target
            if (current < target) {
                const immediateTarget = Math.min(current + 1, target);
                const longTermTarget = Math.min(current + 2, target);
                
                // Immediate next level recommendation
                if (immediateTarget > current) {
                    recommendations.push({
                        id: deps.uuidv4(),
                        type: 'development',
                        axis: axisId,
                        currentLevel: current,
                        targetLevel: immediateTarget,
                        priority: RecommendationsService._calculatePriority(current, immediateTarget),
                        rationale: RecommendationsService._generateDevelopmentRationale(axisId, current, immediateTarget),
                        impact: RecommendationsService._calculateImpact(current, immediateTarget),
                        effort: RecommendationsService._calculateEffort(current, immediateTarget),
                        transformationPhase: RecommendationsService._getTransformationPhase(immediateTarget),
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
                
                // Long-term recommendation (if different from immediate)
                if (longTermTarget > immediateTarget) {
                    recommendations.push({
                        id: deps.uuidv4(),
                        type: 'development',
                        axis: axisId,
                        currentLevel: current,
                        targetLevel: longTermTarget,
                        priority: 'low', // Long-term is always lower priority
                        rationale: RecommendationsService._generateDevelopmentRationale(axisId, current, longTermTarget, true),
                        impact: RecommendationsService._calculateImpact(current, longTermTarget),
                        effort: RecommendationsService._calculateEffort(current, longTermTarget),
                        transformationPhase: RecommendationsService._getTransformationPhase(longTermTarget),
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
            }
        });
        
        return recommendations;
    },
    
    /**
     * Generate Balance Recommendations
     * Detects imbalances (gaps > 2 levels) and recommends alignment
     */
    generateBalanceRecommendations: (axes) => {
        const recommendations = [];
        const imbalances = this._detectImbalances(axes);
        
        imbalances.forEach(imbalance => {
            if (imbalance.gap > 2) {
                // Target level: raise the lower axis to min + 1
                const targetLevel = Math.min(...imbalance.levels) + 1;
                
                recommendations.push({
                    id: deps.uuidv4(),
                    type: 'balance',
                    axes: imbalance.axes,
                    targetLevel: targetLevel,
                    priority: 'high', // Balance is always high priority
                    rationale: RecommendationsService._generateBalanceRationale(imbalance.axes, imbalance.levels, targetLevel),
                    impact: 'high',
                    effort: RecommendationsService._calculateBalanceEffort(imbalance.axes, imbalance.levels, targetLevel),
                    transformationPhase: RecommendationsService._getTransformationPhase(targetLevel),
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        });
        
        return recommendations;
    },
    
    /**
     * Prioritize Recommendations
     * Order: Balance > Development (by priority) > Stabilization
     */
    prioritizeRecommendations: (recommendations, axes = {}) => {
        return recommendations.sort((a, b) => {
            // 1. Balance recommendations always first
            if (a.type === 'balance' && b.type !== 'balance') return -1;
            if (b.type === 'balance' && a.type !== 'balance') return 1;
            
            // 2. Priority order: high > medium > low
            const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            
            // 3. Larger gaps first
            const getCurrentLevel = (rec) => {
                if (rec.currentLevel) return rec.currentLevel;
                if (rec.axes && rec.axes.length > 0) {
                    return Math.min(...rec.axes.map(ax => axes[ax]?.actual || 0));
                }
                return 0;
            };
            
            const gapA = a.targetLevel - getCurrentLevel(a);
            const gapB = b.targetLevel - getCurrentLevel(b);
            return gapB - gapA;
        });
    },
    
    /**
     * Map Recommendations to Initiatives
     * Converts recommendations to initiative format
     */
    mapRecommendationsToInitiatives: (recommendations, assessment) => {
        return recommendations.map(rec => ({
            id: `init-${rec.id}`,
            name: RecommendationsService._generateInitiativeName(rec),
            description: rec.rationale,
            axis: rec.axis || rec.axes?.[0],
            targetLevel: rec.targetLevel,
            priority: rec.priority,
            estimatedEffort: RecommendationsService._estimateEffortMonths(rec.effort),
            expectedImpact: rec.impact,
            status: 'DRAFT',
            sourceRecommendationId: rec.id,
            // Additional fields for initiative
            businessValue: rec.impact === 'high' ? 'High' : rec.impact === 'medium' ? 'Medium' : 'Low',
            complexity: rec.effort === 'high' ? 'High' : rec.effort === 'medium' ? 'Medium' : 'Low'
        }));
    },
    
    /**
     * Generate all recommendations for an assessment
     */
    generateAllRecommendations: (axes) => {
        const development = RecommendationsService.generateDevelopmentRecommendations(axes);
        const balance = RecommendationsService.generateBalanceRecommendations(axes);
        
        const all = [...development, ...balance];
        return RecommendationsService.prioritizeRecommendations(all, axes);
    },
    
    // Private helper methods
    
    _detectImbalances: (axes) => {
        const imbalances = [];
        const axisEntries = Object.entries(axes);
        
        // Compare all pairs of axes
        for (let i = 0; i < axisEntries.length; i++) {
            for (let j = i + 1; j < axisEntries.length; j++) {
                const [axisA, dataA] = axisEntries[i];
                const [axisB, dataB] = axisEntries[j];
                
                if (!dataA?.actual || !dataB?.actual) continue;
                
                const gap = Math.abs(dataA.actual - dataB.actual);
                
                if (gap > 2) {
                    // Check if this imbalance is already covered
                    const existing = imbalances.find(imb => 
                        (imb.axes.includes(axisA) && imb.axes.includes(axisB))
                    );
                    
                    if (!existing) {
                        imbalances.push({
                            axes: [axisA, axisB],
                            levels: [dataA.actual, dataB.actual],
                            gap: gap
                        });
                    }
                }
            }
        }
        
        return imbalances;
    },
    
    _calculatePriority: (current, target) => {
        const gap = target - current;
        if (gap >= 2) return 'high';
        if (gap === 1) return 'medium';
        return 'low';
    },
    
    _calculateImpact: (current, target) => {
        const gap = target - current;
        if (gap >= 2) return 'high';
        if (gap === 1) return 'medium';
        return 'low';
    },
    
    _calculateEffort: (current, target) => {
        const gap = target - current;
        if (target >= 5) return 'high'; // Higher levels require more effort
        if (gap >= 2) return 'high';
        if (gap === 1 && target >= 4) return 'medium';
        return 'low';
    },
    
    _calculateBalanceEffort: (axes, levels, targetLevel) => {
        const maxGap = Math.max(...levels.map((l, i) => targetLevel - l));
        if (maxGap >= 2) return 'high';
        return 'medium';
    },
    
    _getTransformationPhase: (level) => {
        if (level <= 2) return 'measure';
        if (level <= 4) return 'optimize';
        return 'automate';
    },
    
    _generateDevelopmentRationale: (axisId, current, target, isLongTerm = false) => {
        const axisNames = {
            'processes': 'Processes',
            'digitalProducts': 'Digital Products',
            'businessModels': 'Business Models',
            'dataManagement': 'Data Management',
            'culture': 'Culture',
            'cybersecurity': 'Cybersecurity',
            'aiMaturity': 'AI Maturity'
        };
        
        const axisName = axisNames[axisId] || axisId;
        const timeframe = isLongTerm ? 'long-term' : 'immediate';
        
        return `Develop ${axisName} from Level ${current} to Level ${target}. This is the ${timeframe} next step in digital transformation maturity.`;
    },
    
    _generateBalanceRationale: (axes, levels, targetLevel) => {
        const axisNames = {
            'processes': 'Processes',
            'digitalProducts': 'Digital Products',
            'businessModels': 'Business Models',
            'dataManagement': 'Data Management',
            'culture': 'Culture',
            'cybersecurity': 'Cybersecurity',
            'aiMaturity': 'AI Maturity'
        };
        
        const axisNamesList = axes.map(ax => axisNames[ax] || ax).join(' and ');
        const minLevel = Math.min(...levels);
        
        return `Balance ${axisNamesList} by aligning to Level ${targetLevel}. Current imbalance (gap of ${Math.max(...levels) - minLevel} levels) creates transformation risks.`;
    },
    
    _generateInitiativeName: (rec) => {
        const axisNames = {
            'processes': 'Processes',
            'digitalProducts': 'Digital Products',
            'businessModels': 'Business Models',
            'dataManagement': 'Data Management',
            'culture': 'Culture',
            'cybersecurity': 'Cybersecurity',
            'aiMaturity': 'AI Maturity'
        };
        
        if (rec.type === 'balance') {
            const axesList = rec.axes.map(ax => axisNames[ax] || ax).join(' & ');
            return `Balance ${axesList} to Level ${rec.targetLevel}`;
        } else {
            const axisName = axisNames[rec.axis] || rec.axis;
            return `Advance ${axisName} to Level ${rec.targetLevel}`;
        }
    },
    
    _estimateEffortMonths: (effort) => {
        if (effort === 'high') return 6;
        if (effort === 'medium') return 3;
        return 1;
    }
};

module.exports = RecommendationsService;

