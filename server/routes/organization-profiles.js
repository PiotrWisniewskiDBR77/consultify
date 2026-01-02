/**
 * Organization Profiles API Routes
 * 
 * Provides endpoints for extended organization profiles supporting
 * Enterprise AI Consulting System with BCG/McKinsey-level strategic context.
 * 
 * - GET /api/organization-profiles/:orgId - Get organization profile
 * - PUT /api/organization-profiles/:orgId - Update organization profile
 * - POST /api/organization-profiles/:orgId/analyze - AI-powered profile analysis
 * - GET /api/organization-profiles/:orgId/completeness - Get profile completeness score
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const verifyToken = require('../middleware/authMiddleware');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate profile completeness percentage
 */
function calculateProfileCompleteness(profile) {
    if (!profile) return 0;

    const fields = [
        { name: 'industry', weight: 10 },
        { name: 'industry_subsector', weight: 5 },
        { name: 'company_size', weight: 8 },
        { name: 'employee_count', weight: 5 },
        { name: 'annual_revenue', weight: 5 },
        { name: 'headquarters_country', weight: 3 },
        { name: 'strategic_priorities', weight: 10, isJson: true },
        { name: 'competitive_position', weight: 8 },
        { name: 'growth_stage', weight: 8 },
        { name: 'mission_statement', weight: 5 },
        { name: 'digital_maturity_overall', weight: 8 },
        { name: 'technology_stack', weight: 5, isJson: true },
        { name: 'primary_markets', weight: 5, isJson: true },
        { name: 'customer_segments', weight: 5, isJson: true },
        { name: 'key_competitors', weight: 5, isJson: true },
        { name: 'regulatory_environment', weight: 3, isJson: true },
        { name: 'risk_appetite', weight: 2 }
    ];

    let totalWeight = 0;
    let completedWeight = 0;

    fields.forEach(field => {
        totalWeight += field.weight;
        const value = profile[field.name];
        
        if (field.isJson) {
            try {
                const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    completedWeight += field.weight;
                }
            } catch {
                // Not complete
            }
        } else if (value !== null && value !== undefined && value !== '') {
            completedWeight += field.weight;
        }
    });

    return Math.round((completedWeight / totalWeight) * 100);
}

/**
 * Parse JSON fields safely
 */
function parseJsonFields(profile) {
    if (!profile) return null;
    
    const jsonFields = [
        'strategic_priorities',
        'technology_stack',
        'primary_markets',
        'customer_segments',
        'key_competitors',
        'regulatory_environment'
    ];

    const parsed = { ...profile };
    jsonFields.forEach(field => {
        if (parsed[field]) {
            try {
                parsed[field] = typeof parsed[field] === 'string' 
                    ? JSON.parse(parsed[field]) 
                    : parsed[field];
            } catch {
                parsed[field] = [];
            }
        } else {
            parsed[field] = [];
        }
    });

    return parsed;
}

// ============================================================================
// GET ORGANIZATION PROFILE
// ============================================================================

/**
 * GET /api/organization-profiles/:orgId
 * Get organization profile for strategic context
 */
router.get('/:orgId', verifyToken, async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.user.id;

        // Verify user has access to this organization
        const memberCheck = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?',
                [orgId, userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!memberCheck && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied to this organization' });
        }

        // Get profile
        const profile = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM organization_profiles WHERE organization_id = ?',
                [orgId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!profile) {
            // Return empty profile structure if none exists
            return res.json({
                exists: false,
                profile: null,
                completeness: 0
            });
        }

        const parsedProfile = parseJsonFields(profile);
        const completeness = calculateProfileCompleteness(profile);

        res.json({
            exists: true,
            profile: parsedProfile,
            completeness
        });

    } catch (error) {
        console.error('[OrganizationProfiles] Error getting profile:', error);
        res.status(500).json({ error: 'Failed to get organization profile' });
    }
});

// ============================================================================
// UPDATE ORGANIZATION PROFILE
// ============================================================================

/**
 * PUT /api/organization-profiles/:orgId
 * Update or create organization profile
 */
router.put('/:orgId', verifyToken, async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.user.id;
        const profileData = req.body;

        // Verify user has admin access to this organization
        const memberCheck = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ? AND role IN (\'OWNER\', \'ADMIN\')',
                [orgId, userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!memberCheck && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Admin access required to update profile' });
        }

        // Check if profile exists
        const existingProfile = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM organization_profiles WHERE organization_id = ?',
                [orgId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        // Stringify JSON fields
        const jsonFields = [
            'strategic_priorities',
            'technology_stack',
            'primary_markets',
            'customer_segments',
            'key_competitors',
            'regulatory_environment'
        ];

        jsonFields.forEach(field => {
            if (profileData[field] && typeof profileData[field] !== 'string') {
                profileData[field] = JSON.stringify(profileData[field]);
            }
        });

        const now = new Date().toISOString();

        if (existingProfile) {
            // Update existing profile
            const updateFields = [];
            const updateValues = [];

            const allowedFields = [
                'industry', 'industry_code', 'industry_subsector',
                'company_size', 'employee_count', 'annual_revenue', 'founding_year', 'headquarters_country',
                'strategic_priorities', 'competitive_position', 'growth_stage', 'mission_statement', 'vision_statement',
                'digital_maturity_overall', 'technology_stack', 'digital_budget_percent', 'cloud_adoption_level',
                'primary_markets', 'customer_segments', 'key_competitors', 'market_share_estimate',
                'regulatory_environment', 'risk_appetite', 'budget_constraints', 'timeline_constraints',
                'preferred_language', 'communication_style', 'industry_jargon_level'
            ];

            allowedFields.forEach(field => {
                if (profileData[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(profileData[field]);
                }
            });

            // Calculate completeness
            const tempProfile = { ...existingProfile, ...profileData };
            const completeness = calculateProfileCompleteness(tempProfile);

            updateFields.push('profile_completeness = ?', 'updated_at = ?', 'updated_by = ?');
            updateValues.push(completeness, now, userId);
            updateValues.push(orgId);

            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE organization_profiles SET ${updateFields.join(', ')} WHERE organization_id = ?`,
                    updateValues,
                    (err) => err ? reject(err) : resolve()
                );
            });

        } else {
            // Create new profile
            const profileId = uuidv4();
            const completeness = calculateProfileCompleteness(profileData);

            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO organization_profiles (
                        id, organization_id,
                        industry, industry_code, industry_subsector,
                        company_size, employee_count, annual_revenue, founding_year, headquarters_country,
                        strategic_priorities, competitive_position, growth_stage, mission_statement, vision_statement,
                        digital_maturity_overall, technology_stack, digital_budget_percent, cloud_adoption_level,
                        primary_markets, customer_segments, key_competitors, market_share_estimate,
                        regulatory_environment, risk_appetite, budget_constraints, timeline_constraints,
                        preferred_language, communication_style, industry_jargon_level,
                        profile_completeness, created_at, updated_at, created_by, updated_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    profileId, orgId,
                    profileData.industry || null,
                    profileData.industry_code || null,
                    profileData.industry_subsector || null,
                    profileData.company_size || null,
                    profileData.employee_count || null,
                    profileData.annual_revenue || null,
                    profileData.founding_year || null,
                    profileData.headquarters_country || null,
                    profileData.strategic_priorities || '[]',
                    profileData.competitive_position || null,
                    profileData.growth_stage || null,
                    profileData.mission_statement || null,
                    profileData.vision_statement || null,
                    profileData.digital_maturity_overall || null,
                    profileData.technology_stack || '[]',
                    profileData.digital_budget_percent || null,
                    profileData.cloud_adoption_level || null,
                    profileData.primary_markets || '[]',
                    profileData.customer_segments || '[]',
                    profileData.key_competitors || '[]',
                    profileData.market_share_estimate || null,
                    profileData.regulatory_environment || '[]',
                    profileData.risk_appetite || 'MODERATE',
                    profileData.budget_constraints || null,
                    profileData.timeline_constraints || null,
                    profileData.preferred_language || 'pl',
                    profileData.communication_style || 'PROFESSIONAL',
                    profileData.industry_jargon_level || 'MEDIUM',
                    completeness, now, now, userId, userId
                ], (err) => err ? reject(err) : resolve());
            });
        }

        // Fetch updated profile
        const updatedProfile = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM organization_profiles WHERE organization_id = ?',
                [orgId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        res.json({
            success: true,
            profile: parseJsonFields(updatedProfile),
            completeness: updatedProfile.profile_completeness
        });

    } catch (error) {
        console.error('[OrganizationProfiles] Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update organization profile' });
    }
});

// ============================================================================
// AI-POWERED PROFILE ANALYSIS
// ============================================================================

/**
 * POST /api/organization-profiles/:orgId/analyze
 * Generate AI-powered insights from organization profile
 */
router.post('/:orgId/analyze', verifyToken, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { analysisType = 'strategic_positioning' } = req.body;

        // Get profile
        const profile = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM organization_profiles WHERE organization_id = ?',
                [orgId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!profile) {
            return res.status(404).json({ error: 'Organization profile not found' });
        }

        const parsedProfile = parseJsonFields(profile);

        // Generate analysis based on type
        let analysis = {};

        switch (analysisType) {
            case 'strategic_positioning':
                analysis = generateStrategicPositioningAnalysis(parsedProfile);
                break;
            case 'digital_readiness':
                analysis = generateDigitalReadinessAnalysis(parsedProfile);
                break;
            case 'competitive_landscape':
                analysis = generateCompetitiveLandscapeAnalysis(parsedProfile);
                break;
            default:
                analysis = generateStrategicPositioningAnalysis(parsedProfile);
        }

        res.json({
            analysisType,
            profile: parsedProfile,
            analysis,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('[OrganizationProfiles] Error analyzing profile:', error);
        res.status(500).json({ error: 'Failed to analyze organization profile' });
    }
});

// ============================================================================
// PROFILE COMPLETENESS
// ============================================================================

/**
 * GET /api/organization-profiles/:orgId/completeness
 * Get profile completeness breakdown
 */
router.get('/:orgId/completeness', verifyToken, async (req, res) => {
    try {
        const { orgId } = req.params;

        const profile = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM organization_profiles WHERE organization_id = ?',
                [orgId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!profile) {
            return res.json({
                overall: 0,
                sections: {
                    industry: 0,
                    company: 0,
                    strategic: 0,
                    digital: 0,
                    market: 0,
                    constraints: 0
                },
                missingFields: ['All fields - profile not created']
            });
        }

        const sections = {
            industry: calculateSectionCompleteness(profile, ['industry', 'industry_code', 'industry_subsector']),
            company: calculateSectionCompleteness(profile, ['company_size', 'employee_count', 'annual_revenue', 'founding_year', 'headquarters_country']),
            strategic: calculateSectionCompleteness(profile, ['strategic_priorities', 'competitive_position', 'growth_stage', 'mission_statement', 'vision_statement']),
            digital: calculateSectionCompleteness(profile, ['digital_maturity_overall', 'technology_stack', 'digital_budget_percent', 'cloud_adoption_level']),
            market: calculateSectionCompleteness(profile, ['primary_markets', 'customer_segments', 'key_competitors', 'market_share_estimate']),
            constraints: calculateSectionCompleteness(profile, ['regulatory_environment', 'risk_appetite', 'budget_constraints', 'timeline_constraints'])
        };

        const missingFields = getMissingFields(profile);

        res.json({
            overall: profile.profile_completeness || calculateProfileCompleteness(profile),
            sections,
            missingFields
        });

    } catch (error) {
        console.error('[OrganizationProfiles] Error getting completeness:', error);
        res.status(500).json({ error: 'Failed to get profile completeness' });
    }
});

// ============================================================================
// HELPER ANALYSIS FUNCTIONS
// ============================================================================

function calculateSectionCompleteness(profile, fields) {
    let filled = 0;
    fields.forEach(field => {
        const value = profile[field];
        if (value !== null && value !== undefined && value !== '' && value !== '[]') {
            filled++;
        }
    });
    return Math.round((filled / fields.length) * 100);
}

function getMissingFields(profile) {
    const requiredFields = [
        { key: 'industry', label: 'Industry' },
        { key: 'company_size', label: 'Company Size' },
        { key: 'strategic_priorities', label: 'Strategic Priorities' },
        { key: 'competitive_position', label: 'Competitive Position' },
        { key: 'digital_maturity_overall', label: 'Digital Maturity Score' }
    ];

    return requiredFields
        .filter(field => {
            const value = profile[field.key];
            return value === null || value === undefined || value === '' || value === '[]';
        })
        .map(field => field.label);
}

function generateStrategicPositioningAnalysis(profile) {
    const position = profile.competitive_position || 'UNKNOWN';
    const stage = profile.growth_stage || 'UNKNOWN';
    
    const positionInsights = {
        'LEADER': {
            strength: 'Strong market position with competitive advantage',
            focus: 'Defend leadership, expand into adjacencies, drive innovation',
            risk: 'Complacency, disruption from below'
        },
        'CHALLENGER': {
            strength: 'Growing momentum with differentiated offering',
            focus: 'Attack leader weaknesses, build distinctive capabilities',
            risk: 'Resource constraints, competitive response'
        },
        'FOLLOWER': {
            strength: 'Stable position with proven business model',
            focus: 'Find uncontested niches, improve operational efficiency',
            risk: 'Commoditization, margin pressure'
        },
        'NICHE': {
            strength: 'Deep expertise in specific segment',
            focus: 'Deepen specialization, selective expansion',
            risk: 'Market size limitations, segment disruption'
        }
    };

    return {
        currentPosition: positionInsights[position] || positionInsights['LEADER'],
        growthStage: stage,
        strategicPriorities: profile.strategic_priorities || [],
        recommendations: generatePositionRecommendations(position, stage),
        confidence: profile.profile_completeness > 60 ? 'HIGH' : profile.profile_completeness > 30 ? 'MEDIUM' : 'LOW'
    };
}

function generateDigitalReadinessAnalysis(profile) {
    const maturity = profile.digital_maturity_overall || 0;
    const cloudLevel = profile.cloud_adoption_level || 'NONE';
    
    let readinessLevel = 'LOW';
    if (maturity >= 5) readinessLevel = 'HIGH';
    else if (maturity >= 3) readinessLevel = 'MEDIUM';

    return {
        overallMaturity: maturity,
        readinessLevel,
        cloudAdoption: cloudLevel,
        technologyStack: profile.technology_stack || [],
        digitalBudget: profile.digital_budget_percent,
        gaps: identifyDigitalGaps(profile),
        quickWins: suggestDigitalQuickWins(maturity, cloudLevel)
    };
}

function generateCompetitiveLandscapeAnalysis(profile) {
    return {
        position: profile.competitive_position,
        marketShare: profile.market_share_estimate,
        competitors: profile.key_competitors || [],
        markets: profile.primary_markets || [],
        customerSegments: profile.customer_segments || [],
        threatAssessment: assessCompetitiveThreats(profile),
        opportunityAreas: identifyOpportunities(profile)
    };
}

function generatePositionRecommendations(position, stage) {
    const recommendations = [];
    
    if (position === 'LEADER') {
        recommendations.push('Invest in innovation to maintain competitive moat');
        recommendations.push('Explore adjacent markets for growth');
    } else if (position === 'CHALLENGER') {
        recommendations.push('Focus resources on differentiated capabilities');
        recommendations.push('Target underserved customer segments');
    } else if (position === 'FOLLOWER') {
        recommendations.push('Optimize operations for cost efficiency');
        recommendations.push('Identify niche opportunities');
    } else if (position === 'NICHE') {
        recommendations.push('Deepen domain expertise');
        recommendations.push('Build strong customer relationships');
    }

    if (stage === 'STARTUP') {
        recommendations.push('Prioritize product-market fit');
    } else if (stage === 'SCALE_UP') {
        recommendations.push('Invest in scalable infrastructure');
    } else if (stage === 'TURNAROUND') {
        recommendations.push('Focus on core profitable activities');
    }

    return recommendations;
}

function identifyDigitalGaps(profile) {
    const gaps = [];
    
    if ((profile.digital_maturity_overall || 0) < 3) {
        gaps.push('Overall digital maturity below industry average');
    }
    if (profile.cloud_adoption_level === 'NONE' || profile.cloud_adoption_level === 'EXPLORING') {
        gaps.push('Limited cloud adoption');
    }
    if (!profile.technology_stack || profile.technology_stack.length < 3) {
        gaps.push('Technology stack not well defined');
    }
    if (!profile.digital_budget_percent || profile.digital_budget_percent < 5) {
        gaps.push('Digital investment below recommended levels');
    }

    return gaps;
}

function suggestDigitalQuickWins(maturity, cloudLevel) {
    const quickWins = [];
    
    if (maturity < 3) {
        quickWins.push('Implement basic workflow automation');
        quickWins.push('Deploy collaboration tools');
    }
    if (cloudLevel === 'NONE') {
        quickWins.push('Start with cloud-based SaaS tools');
    }
    if (maturity < 5) {
        quickWins.push('Establish data-driven decision making');
        quickWins.push('Implement customer analytics');
    }

    return quickWins;
}

function assessCompetitiveThreats(profile) {
    const threats = [];
    
    if (profile.competitive_position === 'FOLLOWER' || profile.competitive_position === 'NICHE') {
        threats.push({ level: 'HIGH', description: 'Market leaders expanding into segment' });
    }
    if ((profile.digital_maturity_overall || 0) < 3) {
        threats.push({ level: 'MEDIUM', description: 'Digital disruption from tech-native competitors' });
    }
    if (profile.growth_stage === 'MATURE') {
        threats.push({ level: 'MEDIUM', description: 'Emerging market entrants with lower cost base' });
    }

    return threats;
}

function identifyOpportunities(profile) {
    const opportunities = [];
    
    if (profile.competitive_position === 'LEADER') {
        opportunities.push('Platform ecosystem development');
        opportunities.push('International expansion');
    }
    if ((profile.digital_maturity_overall || 0) >= 4) {
        opportunities.push('Data monetization');
        opportunities.push('AI-powered service differentiation');
    }
    if (profile.growth_stage === 'SCALE_UP') {
        opportunities.push('Strategic partnerships');
        opportunities.push('Vertical integration');
    }

    return opportunities;
}

module.exports = router;



