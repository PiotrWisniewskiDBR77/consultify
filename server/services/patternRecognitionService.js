/**
 * Pattern Recognition Service
 * 
 * Learns from historical project data to identify:
 * - Success patterns that can be replicated
 * - Failure patterns to avoid
 * - Industry-specific patterns
 * - Cross-project learning opportunities
 * - Best practices extraction
 */

// Dependency injection for testing
const deps = {
    _db: null,
    _uuidv4: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../src/database/Database.ts');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
}

// Pattern categories
const PATTERN_TYPES = {
    SUCCESS: 'success',
    FAILURE: 'failure',
    RISK: 'risk',
    EFFICIENCY: 'efficiency',
    ADOPTION: 'adoption',
    COLLABORATION: 'collaboration'
};

// Pattern confidence levels
const CONFIDENCE = {
    HIGH: 0.8,      // 80%+ correlation
    MEDIUM: 0.6,    // 60-80% correlation
    LOW: 0.4        // 40-60% correlation
};

const PatternRecognitionService = {
    PATTERN_TYPES,
    CONFIDENCE,

    /**
     * Analyze all projects to extract patterns
     */
    analyzeAllProjects: async () => {
        const projects = await PatternRecognitionService.getCompletedProjects();
        const patterns = [];

        console.log(`[PatternRecognition] Analyzing ${projects.length} completed projects`);

        // Group by outcome
        const successful = projects.filter(p => p.outcome === 'success' || p.health === 'green');
        const failed = projects.filter(p => p.outcome === 'failed' || p.health === 'red');

        // Extract success patterns
        const successPatterns = await PatternRecognitionService.extractSuccessPatterns(successful);
        patterns.push(...successPatterns);

        // Extract failure patterns
        const failurePatterns = await PatternRecognitionService.extractFailurePatterns(failed);
        patterns.push(...failurePatterns);

        // Industry patterns
        const industryPatterns = await PatternRecognitionService.extractIndustryPatterns(projects);
        patterns.push(...industryPatterns);

        // Store patterns
        for (const pattern of patterns) {
            await PatternRecognitionService.storePattern(pattern);
        }

        return {
            projectsAnalyzed: projects.length,
            patternsExtracted: patterns.length,
            byType: {
                success: successPatterns.length,
                failure: failurePatterns.length,
                industry: industryPatterns.length
            }
        };
    },

    /**
     * Get completed projects for analysis
     */
    getCompletedProjects: async () => {
        return new Promise((resolve) => {
            deps.db.all(`
                SELECT p.*, o.industry, o.employee_count, o.name as org_name
                FROM projects p
                LEFT JOIN organizations o ON p.organization_id = o.id
                WHERE p.status IN ('completed', 'closed')
                OR p.progress >= 90
                ORDER BY p.created_at DESC
                LIMIT 500
            `, [], async (err, projects) => {
                if (err) return resolve([]);

                // Enrich with additional data
                const enriched = [];
                for (const project of projects || []) {
                    const details = await PatternRecognitionService.getProjectDetails(project.id);
                    enriched.push({ ...project, ...details });
                }

                resolve(enriched);
            });
        });
    },

    /**
     * Get project details for pattern analysis
     */
    getProjectDetails: async (projectId) => {
        return new Promise((resolve) => {
            const details = {
                initiativeCount: 0,
                taskCompletionRate: 0,
                milestoneHitRate: 0,
                teamSize: 0,
                durationDays: 0,
                hasChangeManagement: false,
                hasRiskManagement: false,
                stakeholderEngagement: 0
            };

            deps.db.get(`
                SELECT 
                    COUNT(*) as initiative_count,
                    AVG(progress) as avg_progress
                FROM initiatives WHERE project_id = ?
            `, [projectId], (err, row) => {
                if (row) {
                    details.initiativeCount = row.initiative_count || 0;
                }

                deps.db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
                    FROM tasks WHERE project_id = ?
                `, [projectId], (err, row) => {
                    if (row && row.total > 0) {
                        details.taskCompletionRate = row.completed / row.total;
                    }

                    deps.db.get(`
                        SELECT COUNT(DISTINCT user_id) as team_size
                        FROM project_members WHERE project_id = ?
                    `, [projectId], (err, row) => {
                        if (row) {
                            details.teamSize = row.team_size || 0;
                        }
                        resolve(details);
                    });
                });
            });
        });
    },

    /**
     * Extract patterns from successful projects
     */
    extractSuccessPatterns: async (projects) => {
        const patterns = [];

        if (projects.length < 3) return patterns; // Need minimum sample

        // Analyze common attributes
        const avgTeamSize = projects.reduce((sum, p) => sum + (p.teamSize || 0), 0) / projects.length;
        const avgInitiatives = projects.reduce((sum, p) => sum + (p.initiativeCount || 0), 0) / projects.length;
        const avgTaskCompletion = projects.reduce((sum, p) => sum + (p.taskCompletionRate || 0), 0) / projects.length;

        // Team size pattern
        if (avgTeamSize >= 3 && avgTeamSize <= 10) {
            patterns.push({
                id: uuidv4(),
                type: PATTERN_TYPES.SUCCESS,
                name: 'Optimal Team Size',
                description: `Successful projects tend to have teams of 3-10 members (avg: ${Math.round(avgTeamSize)})`,
                attributes: { avgTeamSize, minTeamSize: 3, maxTeamSize: 10 },
                confidence: PatternRecognitionService.calculateConfidence(projects.length),
                occurrences: projects.length,
                recommendations: [
                    'Keep core team size between 3-10 members',
                    'Add specialists as needed but avoid team bloat',
                    'Ensure clear roles and responsibilities'
                ]
            });
        }

        // Task completion pattern
        if (avgTaskCompletion >= 0.85) {
            patterns.push({
                id: uuidv4(),
                type: PATTERN_TYPES.SUCCESS,
                name: 'High Task Completion Discipline',
                description: `Successful projects maintain ${Math.round(avgTaskCompletion * 100)}% task completion rate`,
                attributes: { avgTaskCompletion },
                confidence: CONFIDENCE.HIGH,
                occurrences: projects.length,
                recommendations: [
                    'Regularly review and close completed tasks',
                    'Break large tasks into smaller, completable items',
                    'Track and celebrate completion milestones'
                ]
            });
        }

        // Industry-specific success factors
        const byIndustry = PatternRecognitionService.groupByIndustry(projects);
        for (const [industry, indProjects] of Object.entries(byIndustry)) {
            if (indProjects.length >= 3) {
                patterns.push({
                    id: uuidv4(),
                    type: PATTERN_TYPES.SUCCESS,
                    name: `${industry} Success Factors`,
                    description: `Common patterns in successful ${industry} transformations`,
                    attributes: {
                        industry,
                        avgDuration: Math.round(indProjects.reduce((s, p) => s + (p.durationDays || 90), 0) / indProjects.length),
                        avgInitiatives: Math.round(indProjects.reduce((s, p) => s + (p.initiativeCount || 0), 0) / indProjects.length)
                    },
                    confidence: PatternRecognitionService.calculateConfidence(indProjects.length),
                    occurrences: indProjects.length,
                    industry,
                    recommendations: []
                });
            }
        }

        return patterns;
    },

    /**
     * Extract patterns from failed projects
     */
    extractFailurePatterns: async (projects) => {
        const patterns = [];

        if (projects.length < 2) return patterns;

        // Analyze common failure attributes
        const lowTaskCompletion = projects.filter(p => (p.taskCompletionRate || 0) < 0.5);
        const smallTeams = projects.filter(p => (p.teamSize || 0) < 2);
        const noChangeManagement = projects.filter(p => !p.hasChangeManagement);

        if (lowTaskCompletion.length >= projects.length * 0.5) {
            patterns.push({
                id: uuidv4(),
                type: PATTERN_TYPES.FAILURE,
                name: 'Low Task Completion Warning',
                description: `${Math.round((lowTaskCompletion.length / projects.length) * 100)}% of failed projects had less than 50% task completion`,
                attributes: { threshold: 0.5 },
                confidence: CONFIDENCE.HIGH,
                occurrences: lowTaskCompletion.length,
                recommendations: [
                    'Implement weekly task review sessions',
                    'Use task blocking analysis to identify bottlenecks',
                    'Consider reducing scope if completion rate is low'
                ]
            });
        }

        if (smallTeams.length >= projects.length * 0.4) {
            patterns.push({
                id: uuidv4(),
                type: PATTERN_TYPES.FAILURE,
                name: 'Insufficient Resources',
                description: 'Projects with fewer than 2 team members are at higher risk of failure',
                attributes: { minRecommendedSize: 3 },
                confidence: CONFIDENCE.MEDIUM,
                occurrences: smallTeams.length,
                recommendations: [
                    'Ensure minimum viable team size',
                    'Identify backup resources early',
                    'Consider project scope vs. available resources'
                ]
            });
        }

        return patterns;
    },

    /**
     * Extract industry-specific patterns
     */
    extractIndustryPatterns: async (projects) => {
        const patterns = [];
        const byIndustry = PatternRecognitionService.groupByIndustry(projects);

        for (const [industry, indProjects] of Object.entries(byIndustry)) {
            if (indProjects.length < 5) continue;

            // Calculate industry-specific metrics
            const avgDuration = indProjects.reduce((s, p) => s + (p.durationDays || 90), 0) / indProjects.length;
            const avgTeamSize = indProjects.reduce((s, p) => s + (p.teamSize || 0), 0) / indProjects.length;
            const successRate = indProjects.filter(p => p.outcome === 'success' || p.health === 'green').length / indProjects.length;

            patterns.push({
                id: uuidv4(),
                type: 'industry_benchmark',
                name: `${industry} Transformation Benchmark`,
                description: `Baseline metrics for ${industry} digital transformations`,
                industry,
                attributes: {
                    avgDurationDays: Math.round(avgDuration),
                    avgTeamSize: Math.round(avgTeamSize),
                    successRate: Math.round(successRate * 100),
                    sampleSize: indProjects.length
                },
                confidence: PatternRecognitionService.calculateConfidence(indProjects.length),
                occurrences: indProjects.length,
                recommendations: [
                    `Plan for approximately ${Math.round(avgDuration)} days duration`,
                    `Target team size of ${Math.round(avgTeamSize)} members`,
                    `Industry success rate is ${Math.round(successRate * 100)}%`
                ]
            });
        }

        return patterns;
    },

    /**
     * Group projects by industry
     */
    groupByIndustry: (projects) => {
        const groups = {};
        for (const project of projects) {
            const industry = project.industry || 'Unknown';
            if (!groups[industry]) groups[industry] = [];
            groups[industry].push(project);
        }
        return groups;
    },

    /**
     * Calculate confidence based on sample size
     */
    calculateConfidence: (sampleSize) => {
        if (sampleSize >= 20) return CONFIDENCE.HIGH;
        if (sampleSize >= 10) return CONFIDENCE.MEDIUM;
        return CONFIDENCE.LOW;
    },

    /**
     * Store pattern in database
     */
    storePattern: async (pattern) => {
        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT OR REPLACE INTO recognized_patterns (
                    id, type, name, description, industry, attributes,
                    confidence, occurrences, recommendations, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                pattern.id,
                pattern.type,
                pattern.name,
                pattern.description,
                pattern.industry || null,
                JSON.stringify(pattern.attributes || {}),
                pattern.confidence,
                pattern.occurrences,
                JSON.stringify(pattern.recommendations || [])
            ], function(err) {
                if (err) return reject(err);
                resolve(pattern);
            });
        });
    },

    /**
     * Get relevant patterns for a project
     */
    getRelevantPatterns: async (projectContext) => {
        const { industry, teamSize, phase, riskLevel } = projectContext;

        return new Promise((resolve) => {
            let sql = `SELECT * FROM recognized_patterns WHERE 1=1`;
            const params = [];

            if (industry) {
                sql += ` AND (industry = ? OR industry IS NULL)`;
                params.push(industry);
            }

            sql += ` ORDER BY confidence DESC, occurrences DESC LIMIT 20`;

            deps.db.all(sql, params, (err, rows) => {
                if (err) return resolve([]);

                const patterns = (rows || []).map(r => ({
                    ...r,
                    attributes: JSON.parse(r.attributes || '{}'),
                    recommendations: JSON.parse(r.recommendations || '[]')
                }));

                // Filter by relevance
                const relevant = patterns.filter(p => {
                    if (p.type === PATTERN_TYPES.FAILURE && riskLevel !== 'high') return false;
                    if (p.attributes.minTeamSize && teamSize < p.attributes.minTeamSize) return true;
                    return true;
                });

                resolve(relevant);
            });
        });
    },

    /**
     * Apply cross-project learning to a project
     */
    applyCrossProjectLearning: async (projectId) => {
        // Get project context
        const project = await new Promise((resolve) => {
            deps.db.get(`
                SELECT p.*, o.industry FROM projects p
                LEFT JOIN organizations o ON p.organization_id = o.id
                WHERE p.id = ?
            `, [projectId], (err, row) => resolve(row));
        });

        if (!project) return { error: 'Project not found' };

        // Get project details
        const details = await PatternRecognitionService.getProjectDetails(projectId);

        // Get relevant patterns
        const patterns = await PatternRecognitionService.getRelevantPatterns({
            industry: project.industry,
            teamSize: details.teamSize,
            phase: project.phase,
            riskLevel: project.health
        });

        // Generate recommendations based on patterns
        const learnings = {
            projectId,
            patterns: patterns.slice(0, 10),
            recommendations: [],
            benchmarks: {}
        };

        // Extract actionable recommendations
        for (const pattern of patterns) {
            if (pattern.type === PATTERN_TYPES.SUCCESS) {
                // Compare with pattern attributes
                if (pattern.attributes.avgTeamSize && details.teamSize < pattern.attributes.avgTeamSize * 0.7) {
                    learnings.recommendations.push({
                        source: pattern.name,
                        recommendation: `Consider increasing team size. Successful projects average ${Math.round(pattern.attributes.avgTeamSize)} members.`,
                        priority: 'medium'
                    });
                }
            }

            if (pattern.type === PATTERN_TYPES.FAILURE) {
                // Check for warning signs
                if (pattern.attributes.threshold && details.taskCompletionRate < pattern.attributes.threshold) {
                    learnings.recommendations.push({
                        source: pattern.name,
                        recommendation: pattern.recommendations?.[0] || 'Review project execution',
                        priority: 'high'
                    });
                }
            }

            if (pattern.type === 'industry_benchmark') {
                learnings.benchmarks[pattern.name] = pattern.attributes;
            }
        }

        return learnings;
    },

    /**
     * Get pattern statistics
     */
    getPatternStats: async () => {
        return new Promise((resolve) => {
            deps.db.all(`
                SELECT 
                    type,
                    COUNT(*) as count,
                    AVG(confidence) as avg_confidence,
                    SUM(occurrences) as total_occurrences
                FROM recognized_patterns
                GROUP BY type
            `, [], (err, rows) => {
                resolve(rows || []);
            });
        });
    },

    /**
     * Initialize database tables
     */
    initialize: async () => {
        return new Promise((resolve, reject) => {
            deps.db.run(`
                CREATE TABLE IF NOT EXISTS recognized_patterns (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    industry TEXT,
                    attributes TEXT,
                    confidence REAL,
                    occurrences INTEGER,
                    recommendations TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) return reject(err);
                deps.db.run(`CREATE INDEX IF NOT EXISTS idx_rp_type ON recognized_patterns(type)`);
                deps.db.run(`CREATE INDEX IF NOT EXISTS idx_rp_industry ON recognized_patterns(industry)`);
                resolve();
            });
        });
    }
};

export default PatternRecognitionService;






