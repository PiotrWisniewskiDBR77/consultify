/**
 * Consulting Frameworks Definitions
 * 
 * BCG/McKinsey-level strategic framework definitions for AI-powered analysis.
 * Each framework includes structure, prompts, and scoring logic.
 * 
 * Part of the Enterprise AI Consulting System.
 */

/**
 * BCG Growth-Share Matrix
 * Classifies initiatives based on market growth and relative market share
 */
const BCG_GROWTH_SHARE = {
    id: 'BCG_GROWTH_SHARE',
    name: 'BCG Growth-Share Matrix',
    description: 'Portfolio analysis framework for strategic resource allocation',
    source: 'Boston Consulting Group',
    
    quadrants: {
        STAR: {
            name: 'Stars',
            characteristics: 'High growth, high share',
            strategy: 'Invest heavily to maintain/grow position',
            resourceAllocation: 'HIGH',
            icon: '⭐'
        },
        QUESTION_MARK: {
            name: 'Question Marks',
            characteristics: 'High growth, low share',
            strategy: 'Selectively invest or divest',
            resourceAllocation: 'SELECTIVE',
            icon: '❓'
        },
        CASH_COW: {
            name: 'Cash Cows',
            characteristics: 'Low growth, high share',
            strategy: 'Harvest profits, minimal investment',
            resourceAllocation: 'LOW',
            icon: '🐄'
        },
        DOG: {
            name: 'Dogs',
            characteristics: 'Low growth, low share',
            strategy: 'Divest or turnaround',
            resourceAllocation: 'MINIMAL',
            icon: '🐕'
        }
    },
    
    axes: {
        x: { 
            name: 'Relative Market Share / Competitive Position',
            high: 'High',
            low: 'Low',
            threshold: 1.0
        },
        y: {
            name: 'Market Growth Rate / Strategic Value',
            high: 'High',
            low: 'Low',
            threshold: 10 // percent
        }
    },
    
    applicationCriteria: {
        forInitiatives: {
            xAxis: 'competitive_advantage_score',
            yAxis: 'strategic_value_score',
            size: 'investment_required'
        }
    },
    
    promptTemplate: `Analyze this digital initiative using BCG Growth-Share Matrix:

Initiative: {{name}}
Description: {{description}}
Investment Required: {{budget}}
Expected ROI: {{roi}}
Strategic Alignment: {{alignment}}

Evaluate on two dimensions:
1. STRATEGIC VALUE (Y-axis): Market growth potential, strategic importance, innovation value
2. COMPETITIVE POSITION (X-axis): Internal capability, competitive advantage, execution readiness

Return JSON:
{
  "quadrant": "STAR|QUESTION_MARK|CASH_COW|DOG",
  "strategicValue": 1-10,
  "competitivePosition": 1-10,
  "rationale": "Explanation",
  "recommendation": "Strategic recommendation"
}`
};

/**
 * McKinsey 7S Framework
 * Organizational alignment analysis
 */
const MCKINSEY_7S = {
    id: 'MCKINSEY_7S',
    name: 'McKinsey 7S Framework',
    description: 'Organizational effectiveness and transformation readiness',
    source: 'McKinsey & Company',
    
    elements: {
        STRATEGY: {
            name: 'Strategy',
            type: 'HARD',
            description: 'Plan to build competitive advantage',
            assessmentQuestions: [
                'Is there a clear digital strategy?',
                'Is the strategy aligned with business objectives?',
                'Is resource allocation aligned with strategic priorities?'
            ]
        },
        STRUCTURE: {
            name: 'Structure',
            type: 'HARD',
            description: 'Organizational hierarchy and coordination',
            assessmentQuestions: [
                'Does the structure support digital initiatives?',
                'Are there clear digital governance mechanisms?',
                'Is decision-making appropriately distributed?'
            ]
        },
        SYSTEMS: {
            name: 'Systems',
            type: 'HARD',
            description: 'Daily activities, processes, and IT',
            assessmentQuestions: [
                'Are core systems modern and integrated?',
                'Do processes support digital workflows?',
                'Is there effective data flow across systems?'
            ]
        },
        SHARED_VALUES: {
            name: 'Shared Values',
            type: 'SOFT',
            description: 'Core beliefs and culture',
            assessmentQuestions: [
                'Is there a culture of innovation?',
                'Are digital values embedded in the organization?',
                'Is there leadership commitment to transformation?'
            ]
        },
        STYLE: {
            name: 'Style',
            type: 'SOFT',
            description: 'Leadership approach and management style',
            assessmentQuestions: [
                'Does leadership champion digital change?',
                'Is there tolerance for experimentation?',
                'Is decision-making data-driven?'
            ]
        },
        STAFF: {
            name: 'Staff',
            type: 'SOFT',
            description: 'People, capabilities, and talent management',
            assessmentQuestions: [
                'Are digital skills present in the workforce?',
                'Is there a digital talent strategy?',
                'Is there investment in upskilling?'
            ]
        },
        SKILLS: {
            name: 'Skills',
            type: 'SOFT',
            description: 'Organizational capabilities',
            assessmentQuestions: [
                'Are there distinctive digital capabilities?',
                'Is there capability in emerging technologies?',
                'Can the organization execute digital projects?'
            ]
        }
    },
    
    alignmentAssessment: {
        levels: ['MISALIGNED', 'PARTIALLY_ALIGNED', 'ALIGNED', 'HIGHLY_ALIGNED'],
        scoring: {
            MISALIGNED: { min: 0, max: 25 },
            PARTIALLY_ALIGNED: { min: 26, max: 50 },
            ALIGNED: { min: 51, max: 75 },
            HIGHLY_ALIGNED: { min: 76, max: 100 }
        }
    },
    
    promptTemplate: `Assess organizational transformation readiness using McKinsey 7S:

Organization Profile:
- Industry: {{industry}}
- Size: {{size}}
- Growth Stage: {{growthStage}}
- Current Digital Maturity: {{maturity}}

Assessment Data:
{{assessmentSummary}}

For each of the 7S elements, score 1-10 and provide rationale:
1. Strategy - Digital strategy clarity and alignment
2. Structure - Organizational design for digital
3. Systems - Technology and process maturity
4. Shared Values - Digital culture
5. Style - Leadership approach
6. Staff - Digital talent
7. Skills - Digital capabilities

Return JSON:
{
  "scores": {
    "strategy": { "score": 1-10, "rationale": "..." },
    "structure": { "score": 1-10, "rationale": "..." },
    "systems": { "score": 1-10, "rationale": "..." },
    "sharedValues": { "score": 1-10, "rationale": "..." },
    "style": { "score": 1-10, "rationale": "..." },
    "staff": { "score": 1-10, "rationale": "..." },
    "skills": { "score": 1-10, "rationale": "..." }
  },
  "overallAlignment": "MISALIGNED|PARTIALLY_ALIGNED|ALIGNED|HIGHLY_ALIGNED",
  "alignmentScore": 0-100,
  "keyGaps": ["Gap 1", "Gap 2"],
  "transformationReadiness": "LOW|MEDIUM|HIGH",
  "recommendations": ["Rec 1", "Rec 2", "Rec 3"]
}`
};

/**
 * Porter's Five Forces
 * Competitive analysis framework
 */
const PORTER_5_FORCES = {
    id: 'PORTER_5_FORCES',
    name: "Porter's Five Forces",
    description: 'Industry competitive dynamics and strategic positioning',
    source: 'Michael Porter, Harvard Business School',
    
    forces: {
        COMPETITIVE_RIVALRY: {
            name: 'Competitive Rivalry',
            description: 'Intensity of competition among existing competitors',
            factors: [
                'Number of competitors',
                'Industry growth rate',
                'Product differentiation',
                'Switching costs',
                'Exit barriers'
            ],
            digitalFactors: [
                'Digital disruption from competitors',
                'Technology-enabled differentiation',
                'Data advantages'
            ]
        },
        THREAT_NEW_ENTRANTS: {
            name: 'Threat of New Entrants',
            description: 'How easy it is for new competitors to enter',
            factors: [
                'Capital requirements',
                'Economies of scale',
                'Brand identity',
                'Access to distribution',
                'Regulatory barriers'
            ],
            digitalFactors: [
                'Technology as barrier or enabler',
                'Platform network effects',
                'Digital-native competitors'
            ]
        },
        BARGAINING_POWER_SUPPLIERS: {
            name: 'Bargaining Power of Suppliers',
            description: 'Supplier influence on pricing and terms',
            factors: [
                'Supplier concentration',
                'Switching costs',
                'Supplier differentiation',
                'Forward integration threat'
            ],
            digitalFactors: [
                'Cloud provider dependency',
                'Technology vendor lock-in',
                'Data portability'
            ]
        },
        BARGAINING_POWER_BUYERS: {
            name: 'Bargaining Power of Buyers',
            description: 'Customer influence on pricing and terms',
            factors: [
                'Buyer concentration',
                'Switching costs',
                'Price sensitivity',
                'Information availability'
            ],
            digitalFactors: [
                'Digital comparison shopping',
                'Customer data leverage',
                'Experience expectations'
            ]
        },
        THREAT_SUBSTITUTES: {
            name: 'Threat of Substitutes',
            description: 'Availability of alternative products/services',
            factors: [
                'Substitute availability',
                'Price-performance ratio',
                'Switching costs',
                'Buyer propensity'
            ],
            digitalFactors: [
                'Digital disruption potential',
                'Platform alternatives',
                'Technology obsolescence'
            ]
        }
    },
    
    threatLevels: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
    
    promptTemplate: `Analyze competitive position using Porter's Five Forces:

Industry: {{industry}}
Sub-sector: {{subSector}}
Company Position: {{competitivePosition}}
Key Competitors: {{competitors}}

Industry Context:
{{industryContext}}

For each force, assess threat level (1-10) with digital transformation lens:

Return JSON:
{
  "forces": {
    "competitiveRivalry": { "score": 1-10, "level": "LOW|MODERATE|HIGH|CRITICAL", "rationale": "...", "digitalImpact": "..." },
    "threatNewEntrants": { "score": 1-10, "level": "...", "rationale": "...", "digitalImpact": "..." },
    "supplierPower": { "score": 1-10, "level": "...", "rationale": "...", "digitalImpact": "..." },
    "buyerPower": { "score": 1-10, "level": "...", "rationale": "...", "digitalImpact": "..." },
    "threatSubstitutes": { "score": 1-10, "level": "...", "rationale": "...", "digitalImpact": "..." }
  },
  "overallAttractivenessScore": 1-10,
  "industryAttractivenessLevel": "LOW|MODERATE|HIGH",
  "strategicImplications": ["Implication 1", "Implication 2"],
  "digitalDefenseStrategies": ["Strategy 1", "Strategy 2"]
}`
};

/**
 * PESTLE Analysis
 * External environment analysis
 */
const PESTLE = {
    id: 'PESTLE',
    name: 'PESTLE Analysis',
    description: 'Macro-environmental factors analysis',
    source: 'Strategic Management',
    
    factors: {
        POLITICAL: {
            name: 'Political',
            description: 'Government policies, stability, trade policies',
            considerations: [
                'Government stability',
                'Tax policy',
                'Trade regulations',
                'Political support for digitalization'
            ]
        },
        ECONOMIC: {
            name: 'Economic',
            description: 'Economic conditions and trends',
            considerations: [
                'Economic growth',
                'Interest rates',
                'Exchange rates',
                'Digital economy growth'
            ]
        },
        SOCIAL: {
            name: 'Social',
            description: 'Societal and cultural factors',
            considerations: [
                'Demographics',
                'Cultural attitudes',
                'Digital literacy',
                'Remote work trends'
            ]
        },
        TECHNOLOGICAL: {
            name: 'Technological',
            description: 'Technology trends and disruptions',
            considerations: [
                'R&D activity',
                'Automation',
                'Technology change rate',
                'AI/ML advancement'
            ]
        },
        LEGAL: {
            name: 'Legal',
            description: 'Legal framework and regulations',
            considerations: [
                'Data protection laws',
                'Employment law',
                'Industry regulations',
                'IP protection'
            ]
        },
        ENVIRONMENTAL: {
            name: 'Environmental',
            description: 'Environmental and sustainability factors',
            considerations: [
                'Climate change',
                'Sustainability requirements',
                'Green technology',
                'Carbon footprint regulations'
            ]
        }
    },
    
    impactLevels: ['MINIMAL', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
    
    promptTemplate: `Conduct PESTLE analysis for digital transformation context:

Organization:
- Industry: {{industry}}
- Markets: {{markets}}
- Regulatory Environment: {{regulations}}

For each PESTLE factor, analyze impact on digital transformation:

Return JSON:
{
  "factors": {
    "political": { "impact": 1-10, "level": "...", "opportunities": ["..."], "threats": ["..."] },
    "economic": { "impact": 1-10, "level": "...", "opportunities": ["..."], "threats": ["..."] },
    "social": { "impact": 1-10, "level": "...", "opportunities": ["..."], "threats": ["..."] },
    "technological": { "impact": 1-10, "level": "...", "opportunities": ["..."], "threats": ["..."] },
    "legal": { "impact": 1-10, "level": "...", "opportunities": ["..."], "threats": ["..."] },
    "environmental": { "impact": 1-10, "level": "...", "opportunities": ["..."], "threats": ["..."] }
  },
  "overallEnvironmentScore": 1-10,
  "favorability": "HOSTILE|CHALLENGING|NEUTRAL|FAVORABLE|HIGHLY_FAVORABLE",
  "keyOpportunities": ["Opp 1", "Opp 2"],
  "keyThreats": ["Threat 1", "Threat 2"],
  "strategicImplications": ["Implication 1", "Implication 2"]
}`
};

/**
 * Value Chain Analysis
 * Internal activity analysis for competitive advantage
 */
const VALUE_CHAIN = {
    id: 'VALUE_CHAIN',
    name: 'Value Chain Analysis',
    description: 'Analysis of activities that create value',
    source: 'Michael Porter',
    
    activities: {
        primary: {
            INBOUND_LOGISTICS: {
                name: 'Inbound Logistics',
                description: 'Receiving, storing, and distributing inputs',
                digitalOpportunities: ['Automated inventory', 'Supplier portals', 'IoT tracking']
            },
            OPERATIONS: {
                name: 'Operations',
                description: 'Transforming inputs into products/services',
                digitalOpportunities: ['Process automation', 'Digital twins', 'AI optimization']
            },
            OUTBOUND_LOGISTICS: {
                name: 'Outbound Logistics',
                description: 'Distributing products/services to customers',
                digitalOpportunities: ['Order management', 'Delivery tracking', 'Digital delivery']
            },
            MARKETING_SALES: {
                name: 'Marketing & Sales',
                description: 'Customer acquisition and relationship',
                digitalOpportunities: ['Digital marketing', 'CRM', 'E-commerce', 'Personalization']
            },
            SERVICE: {
                name: 'Service',
                description: 'Post-sale support and maintenance',
                digitalOpportunities: ['Self-service portals', 'Chatbots', 'Remote diagnostics']
            }
        },
        support: {
            FIRM_INFRASTRUCTURE: {
                name: 'Firm Infrastructure',
                description: 'General management, planning, finance',
                digitalOpportunities: ['Cloud infrastructure', 'Analytics platforms', 'Automated reporting']
            },
            HR_MANAGEMENT: {
                name: 'Human Resource Management',
                description: 'Recruiting, training, development',
                digitalOpportunities: ['HR tech', 'Learning platforms', 'Workforce analytics']
            },
            TECHNOLOGY_DEVELOPMENT: {
                name: 'Technology Development',
                description: 'R&D and technology improvement',
                digitalOpportunities: ['DevOps', 'Innovation labs', 'AI/ML capabilities']
            },
            PROCUREMENT: {
                name: 'Procurement',
                description: 'Purchasing inputs',
                digitalOpportunities: ['E-procurement', 'Supplier management', 'Contract automation']
            }
        }
    },
    
    promptTemplate: `Analyze digital transformation opportunities across the value chain:

Industry: {{industry}}
Current Digital Maturity: {{maturity}}
Strategic Priorities: {{priorities}}

For each value chain activity, assess:
1. Current digitalization level (1-7)
2. Transformation opportunity (1-10)
3. Investment priority (HIGH/MEDIUM/LOW)

Return JSON:
{
  "primary": {
    "inboundLogistics": { "current": 1-7, "opportunity": 1-10, "priority": "...", "initiatives": ["..."] },
    "operations": { "current": 1-7, "opportunity": 1-10, "priority": "...", "initiatives": ["..."] },
    "outboundLogistics": { "current": 1-7, "opportunity": 1-10, "priority": "...", "initiatives": ["..."] },
    "marketingSales": { "current": 1-7, "opportunity": 1-10, "priority": "...", "initiatives": ["..."] },
    "service": { "current": 1-7, "opportunity": 1-10, "priority": "...", "initiatives": ["..."] }
  },
  "support": {
    "infrastructure": { "current": 1-7, "opportunity": 1-10, "priority": "...", "initiatives": ["..."] },
    "hrManagement": { "current": 1-7, "opportunity": 1-10, "priority": "...", "initiatives": ["..."] },
    "techDevelopment": { "current": 1-7, "opportunity": 1-10, "priority": "...", "initiatives": ["..."] },
    "procurement": { "current": 1-7, "opportunity": 1-10, "priority": "...", "initiatives": ["..."] }
  },
  "overallDigitizationScore": 1-7,
  "highestOpportunityAreas": ["Area 1", "Area 2"],
  "recommendedSequence": ["First", "Second", "Third"],
  "estimatedValueCreation": "Description of value"
}`
};

/**
 * SWOT Analysis
 * Internal and external analysis
 */
const SWOT = {
    id: 'SWOT',
    name: 'SWOT Analysis',
    description: 'Strengths, Weaknesses, Opportunities, Threats analysis',
    source: 'Albert Humphrey, Stanford Research Institute',
    
    quadrants: {
        STRENGTHS: {
            name: 'Strengths',
            type: 'INTERNAL',
            nature: 'POSITIVE',
            description: 'Internal capabilities that give advantage'
        },
        WEAKNESSES: {
            name: 'Weaknesses',
            type: 'INTERNAL',
            nature: 'NEGATIVE',
            description: 'Internal limitations that hinder performance'
        },
        OPPORTUNITIES: {
            name: 'Opportunities',
            type: 'EXTERNAL',
            nature: 'POSITIVE',
            description: 'External factors that could be exploited'
        },
        THREATS: {
            name: 'Threats',
            type: 'EXTERNAL',
            nature: 'NEGATIVE',
            description: 'External factors that could cause problems'
        }
    },
    
    strategies: {
        SO: { name: 'Maxi-Maxi', description: 'Use strengths to exploit opportunities' },
        WO: { name: 'Mini-Maxi', description: 'Overcome weaknesses by exploiting opportunities' },
        ST: { name: 'Maxi-Mini', description: 'Use strengths to avoid threats' },
        WT: { name: 'Mini-Mini', description: 'Minimize weaknesses and avoid threats' }
    },
    
    promptTemplate: `Generate SWOT analysis for digital transformation:

Organization Context:
- Industry: {{industry}}
- Competitive Position: {{position}}
- Digital Maturity: {{maturity}}
- Key Assessment Findings: {{findings}}

Industry Intelligence:
{{industryContext}}

Return JSON:
{
  "strengths": [
    { "item": "...", "impact": "HIGH|MEDIUM|LOW", "relevance": "Digital relevance explanation" }
  ],
  "weaknesses": [
    { "item": "...", "impact": "HIGH|MEDIUM|LOW", "urgency": "CRITICAL|HIGH|MEDIUM|LOW" }
  ],
  "opportunities": [
    { "item": "...", "potential": "HIGH|MEDIUM|LOW", "timeframe": "SHORT|MEDIUM|LONG" }
  ],
  "threats": [
    { "item": "...", "severity": "HIGH|MEDIUM|LOW", "probability": "HIGH|MEDIUM|LOW" }
  ],
  "strategies": {
    "SO": ["Strategy leveraging strengths for opportunities"],
    "WO": ["Strategy overcoming weaknesses via opportunities"],
    "ST": ["Strategy using strengths against threats"],
    "WT": ["Strategy minimizing weaknesses and threats"]
  },
  "priorityActions": ["Action 1", "Action 2", "Action 3"]
}`
};

// ============================================================================
// FRAMEWORK CATALOG
// ============================================================================

const CONSULTING_FRAMEWORKS = {
    BCG_GROWTH_SHARE,
    MCKINSEY_7S,
    PORTER_5_FORCES,
    PESTLE,
    VALUE_CHAIN,
    SWOT
};

/**
 * Get framework by ID
 */
function getFramework(frameworkId) {
    return CONSULTING_FRAMEWORKS[frameworkId] || null;
}

/**
 * Get all framework IDs
 */
function getFrameworkIds() {
    return Object.keys(CONSULTING_FRAMEWORKS);
}

/**
 * Get framework metadata (without prompts)
 */
function getFrameworkMetadata(frameworkId) {
    const framework = CONSULTING_FRAMEWORKS[frameworkId];
    if (!framework) return null;
    
    const { promptTemplate, ...metadata } = framework;
    return metadata;
}

/**
 * Get all frameworks metadata
 */
function getAllFrameworksMetadata() {
    return Object.keys(CONSULTING_FRAMEWORKS).map(id => ({
        id,
        name: CONSULTING_FRAMEWORKS[id].name,
        description: CONSULTING_FRAMEWORKS[id].description,
        source: CONSULTING_FRAMEWORKS[id].source
    }));
}

/**
 * Recommend frameworks based on analysis needs
 */
function recommendFrameworks(analysisContext) {
    const recommendations = [];
    
    const { assessmentType, hasCompetitorData, hasIndustryData, focusArea } = analysisContext;
    
    // Always recommend SWOT for comprehensive view
    recommendations.push({
        frameworkId: 'SWOT',
        reason: 'Foundation for strategic analysis',
        priority: 1
    });
    
    // Recommend based on context
    if (assessmentType === 'TRANSFORMATION_READINESS') {
        recommendations.push({
            frameworkId: 'MCKINSEY_7S',
            reason: 'Organizational alignment assessment',
            priority: 2
        });
    }
    
    if (hasCompetitorData || focusArea === 'COMPETITIVE') {
        recommendations.push({
            frameworkId: 'PORTER_5_FORCES',
            reason: 'Competitive dynamics analysis',
            priority: 2
        });
    }
    
    if (hasIndustryData) {
        recommendations.push({
            frameworkId: 'PESTLE',
            reason: 'External environment analysis',
            priority: 3
        });
    }
    
    if (focusArea === 'OPERATIONS' || focusArea === 'EFFICIENCY') {
        recommendations.push({
            frameworkId: 'VALUE_CHAIN',
            reason: 'Operational digitalization opportunities',
            priority: 2
        });
    }
    
    if (focusArea === 'PORTFOLIO' || focusArea === 'INVESTMENT') {
        recommendations.push({
            frameworkId: 'BCG_GROWTH_SHARE',
            reason: 'Initiative prioritization and resource allocation',
            priority: 2
        });
    }
    
    return recommendations.sort((a, b) => a.priority - b.priority);
}

module.exports = {
    CONSULTING_FRAMEWORKS,
    getFramework,
    getFrameworkIds,
    getFrameworkMetadata,
    getAllFrameworksMetadata,
    recommendFrameworks,
    // Export individual frameworks for direct access
    BCG_GROWTH_SHARE,
    MCKINSEY_7S,
    PORTER_5_FORCES,
    PESTLE,
    VALUE_CHAIN,
    SWOT
};






