/**
 * Default Initiative Templates
 * 
 * Seed data for 12 initiative templates across 6 categories.
 * These templates provide pre-filled charter patterns for common transformation scenarios.
 */

const { v4: uuidv4 } = require('uuid');

const DEFAULT_TEMPLATES = [
    // ============= DATA Category =============
    {
        id: uuidv4(),
        name: 'Master Data Management Platform',
        category: 'DATA',
        description: 'Implement a centralized master data management platform to ensure data quality, consistency, and governance across the organization.',
        applicableAxes: ['dataManagement'],
        templateData: {
            problemStructured: {
                symptom: 'Inconsistent and duplicated data across systems leading to reporting errors and poor decision-making',
                rootCause: 'Lack of centralized data governance and fragmented data storage across multiple legacy systems',
                costOfInaction: 'Estimated 15-20% efficiency loss due to data reconciliation efforts and delayed decision cycles'
            },
            targetState: {
                process: [
                    'Single source of truth for all master data entities',
                    'Automated data quality checks and cleansing workflows'
                ],
                behavior: [
                    'Data stewards actively manage data quality',
                    'Business users trust and use centralized data'
                ],
                capability: [
                    'Enterprise MDM platform operational',
                    'Data governance framework established'
                ]
            },
            killCriteria: [
                'If data quality improvement is below 30% after 6 months, reassess approach',
                'If business adoption rate below 40% at pilot end, stop',
                'If integration costs exceed budget by 100%, pause project'
            ],
            suggestedTasks: [
                { title: 'Data Landscape Assessment', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 80, stepPhase: 'design' },
                { title: 'MDM Platform Selection', taskType: 'DECISION', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
                { title: 'Data Model Design', taskType: 'DESIGN', priority: 'high', estimatedHours: 120, stepPhase: 'design' },
                { title: 'Integration Architecture', taskType: 'DESIGN', priority: 'high', estimatedHours: 80, stepPhase: 'design' },
                { title: 'Pilot Implementation', taskType: 'BUILD', priority: 'high', estimatedHours: 200, stepPhase: 'pilot' },
                { title: 'Data Quality Validation', taskType: 'VALIDATION', priority: 'medium', estimatedHours: 60, stepPhase: 'pilot' },
                { title: 'User Training Program', taskType: 'CHANGE_MGMT', priority: 'medium', estimatedHours: 40, stepPhase: 'rollout' },
                { title: 'Production Rollout', taskType: 'BUILD', priority: 'high', estimatedHours: 120, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 100 },
                { role: 'SME', allocation: 60 },
                { role: 'STAKEHOLDER', allocation: 20 }
            ],
            typicalTimeline: '12 months',
            typicalBudgetRange: { min: 200000, max: 500000 }
        },
        isPublic: true
    },
    {
        id: uuidv4(),
        name: 'Data Lake Implementation',
        category: 'DATA',
        description: 'Build a modern data lake architecture to centralize data storage, enable advanced analytics, and support AI/ML initiatives.',
        applicableAxes: ['dataManagement', 'aiMaturity'],
        templateData: {
            problemStructured: {
                symptom: 'Inability to leverage data for advanced analytics and AI due to siloed data storage',
                rootCause: 'Legacy data warehouse architecture that cannot scale or handle unstructured data',
                costOfInaction: 'Missing competitive insights and ML opportunities worth estimated 5-10% revenue improvement'
            },
            targetState: {
                process: [
                    'Unified data ingestion from all sources',
                    'Self-service analytics available to business users'
                ],
                behavior: [
                    'Data scientists actively use the platform',
                    'Business analysts create own reports without IT'
                ],
                capability: [
                    'Cloud-native data lake operational',
                    'ML/AI-ready data pipelines'
                ]
            },
            killCriteria: [
                'If data ingestion latency exceeds SLA by 200%, pause',
                'If security audit fails, stop until resolved',
                'If cost exceeds 150% of budget at Phase 1 end, reassess'
            ],
            suggestedTasks: [
                { title: 'Cloud Platform Selection', taskType: 'DECISION', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
                { title: 'Architecture Design', taskType: 'DESIGN', priority: 'high', estimatedHours: 100, stepPhase: 'design' },
                { title: 'Data Pipeline Development', taskType: 'BUILD', priority: 'high', estimatedHours: 160, stepPhase: 'pilot' },
                { title: 'Security & Governance Setup', taskType: 'BUILD', priority: 'high', estimatedHours: 80, stepPhase: 'pilot' },
                { title: 'Analytics Layer Implementation', taskType: 'BUILD', priority: 'medium', estimatedHours: 120, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 100 },
                { role: 'SME', allocation: 80 },
                { role: 'REVIEWER', allocation: 30 }
            ],
            typicalTimeline: '9 months',
            typicalBudgetRange: { min: 150000, max: 400000 }
        },
        isPublic: true
    },

    // ============= PROCESS Category =============
    {
        id: uuidv4(),
        name: 'End-to-End Process Automation',
        category: 'PROCESS',
        description: 'Automate key business processes using RPA, workflow engines, and intelligent automation to improve efficiency and reduce errors.',
        applicableAxes: ['processes'],
        templateData: {
            problemStructured: {
                symptom: 'High volume of manual, repetitive tasks causing delays and errors',
                rootCause: 'Lack of integrated systems and reliance on manual handoffs',
                costOfInaction: 'FTE cost of $200k+ annually on tasks that could be automated'
            },
            targetState: {
                process: [
                    '80% reduction in manual processing time',
                    'Zero-touch processing for standard cases'
                ],
                behavior: [
                    'Staff focus on exceptions and value-add work',
                    'Continuous improvement of automation'
                ],
                capability: [
                    'RPA platform deployed and operational',
                    'Internal Center of Excellence for automation'
                ]
            },
            killCriteria: [
                'If process efficiency gain below 50% after pilot, stop',
                'If error rate increases, immediately halt',
                'If bot maintenance cost exceeds savings, reassess'
            ],
            suggestedTasks: [
                { title: 'Process Discovery & Mining', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 60, stepPhase: 'design' },
                { title: 'Automation Opportunity Assessment', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
                { title: 'RPA Platform Selection', taskType: 'DECISION', priority: 'high', estimatedHours: 30, stepPhase: 'design' },
                { title: 'Bot Development - Pilot', taskType: 'BUILD', priority: 'high', estimatedHours: 120, stepPhase: 'pilot' },
                { title: 'Integration & Testing', taskType: 'VALIDATION', priority: 'high', estimatedHours: 60, stepPhase: 'pilot' },
                { title: 'Production Deployment', taskType: 'BUILD', priority: 'high', estimatedHours: 80, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 100 },
                { role: 'SME', allocation: 50 },
                { role: 'STAKEHOLDER', allocation: 15 }
            ],
            typicalTimeline: '6 months',
            typicalBudgetRange: { min: 100000, max: 300000 }
        },
        isPublic: true
    },
    {
        id: uuidv4(),
        name: 'ERP Modernization Program',
        category: 'PROCESS',
        description: 'Modernize or replace legacy ERP systems to improve business process efficiency, enable real-time insights, and reduce technical debt.',
        applicableAxes: ['processes', 'digitalProducts'],
        templateData: {
            problemStructured: {
                symptom: 'Outdated ERP limiting business agility and causing operational inefficiencies',
                rootCause: 'Technical debt from years of customizations and lack of investment in upgrades',
                costOfInaction: 'Increasing maintenance costs, security risks, and inability to support business growth'
            },
            targetState: {
                process: [
                    'Streamlined end-to-end business processes',
                    'Real-time operational visibility'
                ],
                behavior: [
                    'Users adopt standard processes',
                    'Finance closes books in 3 days vs 10'
                ],
                capability: [
                    'Modern cloud ERP operational',
                    'Integration layer connecting all systems'
                ]
            },
            killCriteria: [
                'If data migration accuracy below 99.5%, stop and fix',
                'If key business process gaps discovered, pause',
                'If timeline extends beyond 24 months, reassess scope'
            ],
            suggestedTasks: [
                { title: 'Current State Assessment', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 120, stepPhase: 'design' },
                { title: 'Vendor Selection', taskType: 'DECISION', priority: 'high', estimatedHours: 80, stepPhase: 'design' },
                { title: 'Blueprint Design', taskType: 'DESIGN', priority: 'high', estimatedHours: 200, stepPhase: 'design' },
                { title: 'Build & Configure', taskType: 'BUILD', priority: 'high', estimatedHours: 400, stepPhase: 'pilot' },
                { title: 'Data Migration', taskType: 'BUILD', priority: 'high', estimatedHours: 200, stepPhase: 'pilot' },
                { title: 'User Acceptance Testing', taskType: 'VALIDATION', priority: 'high', estimatedHours: 120, stepPhase: 'pilot' },
                { title: 'Go-Live & Hypercare', taskType: 'BUILD', priority: 'high', estimatedHours: 160, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 100 },
                { role: 'SME', allocation: 80 },
                { role: 'STAKEHOLDER', allocation: 30 }
            ],
            typicalTimeline: '18 months',
            typicalBudgetRange: { min: 500000, max: 2000000 }
        },
        isPublic: true
    },

    // ============= PRODUCT Category =============
    {
        id: uuidv4(),
        name: 'Digital Product Launch',
        category: 'PRODUCT',
        description: 'Launch a new digital product or service from ideation through go-to-market, using agile methodologies and lean startup principles.',
        applicableAxes: ['digitalProducts'],
        templateData: {
            problemStructured: {
                symptom: 'Missing digital revenue streams and customer engagement channels',
                rootCause: 'Lack of digital product development capability and customer insight',
                costOfInaction: 'Competitors capturing digital market share, estimated 10-15% revenue at risk'
            },
            targetState: {
                process: [
                    'Agile product development cycles',
                    'Continuous customer feedback loops'
                ],
                behavior: [
                    'Product team operates autonomously',
                    'Data-driven decision making'
                ],
                capability: [
                    'MVP launched with paying customers',
                    'Product-market fit validated'
                ]
            },
            killCriteria: [
                'If customer validation fails after 3 pivots, stop',
                'If CAC exceeds LTV by 3x, reassess business model',
                'If NPS below 20 at launch, pause for fixes'
            ],
            suggestedTasks: [
                { title: 'Customer Discovery', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 60, stepPhase: 'design' },
                { title: 'Value Proposition Design', taskType: 'DESIGN', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
                { title: 'MVP Definition', taskType: 'DESIGN', priority: 'high', estimatedHours: 30, stepPhase: 'design' },
                { title: 'MVP Development', taskType: 'BUILD', priority: 'high', estimatedHours: 200, stepPhase: 'pilot' },
                { title: 'Beta Testing', taskType: 'VALIDATION', priority: 'high', estimatedHours: 60, stepPhase: 'pilot' },
                { title: 'Go-to-Market Execution', taskType: 'BUILD', priority: 'high', estimatedHours: 80, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 100 },
                { role: 'SME', allocation: 40 },
                { role: 'STAKEHOLDER', allocation: 25 }
            ],
            typicalTimeline: '6 months',
            typicalBudgetRange: { min: 150000, max: 400000 }
        },
        isPublic: true
    },
    {
        id: uuidv4(),
        name: 'Customer Portal Development',
        category: 'PRODUCT',
        description: 'Build a self-service customer portal to improve customer experience, reduce support costs, and increase engagement.',
        applicableAxes: ['digitalProducts', 'processes'],
        templateData: {
            problemStructured: {
                symptom: 'High customer support costs and poor customer experience',
                rootCause: 'Lack of self-service options and fragmented customer touchpoints',
                costOfInaction: 'Customer churn risk and increasing support costs'
            },
            targetState: {
                process: [
                    '70% of inquiries resolved via self-service',
                    'Omnichannel customer experience'
                ],
                behavior: [
                    'Customers prefer self-service for routine tasks',
                    'Support focuses on complex issues'
                ],
                capability: [
                    'Modern customer portal live',
                    'Integrated with backend systems'
                ]
            },
            killCriteria: [
                'If adoption rate below 30% after 3 months, reassess UX',
                'If CSAT drops below baseline, stop and fix',
                'If integration fails security audit, halt'
            ],
            suggestedTasks: [
                { title: 'Customer Journey Mapping', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
                { title: 'UX/UI Design', taskType: 'DESIGN', priority: 'high', estimatedHours: 80, stepPhase: 'design' },
                { title: 'Portal Development', taskType: 'BUILD', priority: 'high', estimatedHours: 200, stepPhase: 'pilot' },
                { title: 'Integration Development', taskType: 'BUILD', priority: 'high', estimatedHours: 100, stepPhase: 'pilot' },
                { title: 'UAT & Launch', taskType: 'VALIDATION', priority: 'high', estimatedHours: 60, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 100 },
                { role: 'SME', allocation: 50 },
                { role: 'REVIEWER', allocation: 30 }
            ],
            typicalTimeline: '6 months',
            typicalBudgetRange: { min: 100000, max: 300000 }
        },
        isPublic: true
    },

    // ============= CULTURE Category =============
    {
        id: uuidv4(),
        name: 'Digital Change Management Program',
        category: 'CULTURE',
        description: 'Comprehensive change management program to drive digital adoption, build digital skills, and shift organizational culture.',
        applicableAxes: ['culture'],
        templateData: {
            problemStructured: {
                symptom: 'Low adoption of digital tools and resistance to change',
                rootCause: 'Lack of change management, unclear communication, and skill gaps',
                costOfInaction: 'Failed digital initiatives and wasted technology investments'
            },
            targetState: {
                process: [
                    'Structured change management for all initiatives',
                    'Regular pulse surveys and feedback'
                ],
                behavior: [
                    'Leaders champion digital transformation',
                    'Teams embrace continuous learning'
                ],
                capability: [
                    'Change management office established',
                    'Digital skills baseline improved 40%'
                ]
            },
            killCriteria: [
                'If engagement survey shows decline after 6 months, pause',
                'If key stakeholders disengage, reassess approach',
                'If training completion rate below 50%, adjust program'
            ],
            suggestedTasks: [
                { title: 'Change Readiness Assessment', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
                { title: 'Stakeholder Mapping', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 20, stepPhase: 'design' },
                { title: 'Communication Strategy', taskType: 'DESIGN', priority: 'high', estimatedHours: 30, stepPhase: 'design' },
                { title: 'Training Program Development', taskType: 'BUILD', priority: 'high', estimatedHours: 100, stepPhase: 'pilot' },
                { title: 'Change Champion Network', taskType: 'CHANGE_MGMT', priority: 'high', estimatedHours: 40, stepPhase: 'pilot' },
                { title: 'Rollout & Reinforcement', taskType: 'CHANGE_MGMT', priority: 'medium', estimatedHours: 80, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 80 },
                { role: 'STAKEHOLDER', allocation: 30 },
                { role: 'REVIEWER', allocation: 20 }
            ],
            typicalTimeline: '9 months',
            typicalBudgetRange: { min: 80000, max: 200000 }
        },
        isPublic: true
    },
    {
        id: uuidv4(),
        name: 'Digital Skills Academy',
        category: 'CULTURE',
        description: 'Establish an internal digital skills academy to upskill workforce, reduce skill gaps, and build sustainable digital capabilities.',
        applicableAxes: ['culture', 'aiMaturity'],
        templateData: {
            problemStructured: {
                symptom: 'Skill gaps limiting digital initiative success and innovation',
                rootCause: 'Lack of structured digital learning programs and career paths',
                costOfInaction: 'Dependency on external resources and high turnover of digital talent'
            },
            targetState: {
                process: [
                    'Learning paths for all digital roles',
                    'Regular skill assessments'
                ],
                behavior: [
                    'Continuous learning is part of culture',
                    'Knowledge sharing is rewarded'
                ],
                capability: [
                    'Digital academy platform operational',
                    '30% of workforce upskilled'
                ]
            },
            killCriteria: [
                'If participation below 40% after launch, reassess',
                'If skill improvement not measurable, adjust curriculum',
                'If business impact not evident in 12 months, review'
            ],
            suggestedTasks: [
                { title: 'Skills Gap Assessment', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 60, stepPhase: 'design' },
                { title: 'Curriculum Development', taskType: 'BUILD', priority: 'high', estimatedHours: 120, stepPhase: 'design' },
                { title: 'Platform Selection/Setup', taskType: 'BUILD', priority: 'medium', estimatedHours: 40, stepPhase: 'pilot' },
                { title: 'Pilot Launch', taskType: 'BUILD', priority: 'high', estimatedHours: 60, stepPhase: 'pilot' },
                { title: 'Full Rollout', taskType: 'CHANGE_MGMT', priority: 'high', estimatedHours: 80, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 80 },
                { role: 'SME', allocation: 40 },
                { role: 'STAKEHOLDER', allocation: 20 }
            ],
            typicalTimeline: '9 months',
            typicalBudgetRange: { min: 100000, max: 250000 }
        },
        isPublic: true
    },

    // ============= SECURITY Category =============
    {
        id: uuidv4(),
        name: 'Zero Trust Security Implementation',
        category: 'SECURITY',
        description: 'Implement a Zero Trust security model to protect digital assets, reduce attack surface, and ensure compliance.',
        applicableAxes: ['cybersecurity'],
        templateData: {
            problemStructured: {
                symptom: 'Security incidents and compliance gaps increasing',
                rootCause: 'Perimeter-based security model inadequate for modern threats',
                costOfInaction: 'Risk of data breach with potential $1M+ impact and regulatory fines'
            },
            targetState: {
                process: [
                    'Every access request verified',
                    'Continuous monitoring and response'
                ],
                behavior: [
                    'Security-first mindset across organization',
                    'Least privilege access by default'
                ],
                capability: [
                    'Zero Trust architecture deployed',
                    'SOC operational 24/7'
                ]
            },
            killCriteria: [
                'If critical systems unavailable due to security controls, pause',
                'If user productivity drops significantly, adjust approach',
                'If major security gap discovered, stop and remediate'
            ],
            suggestedTasks: [
                { title: 'Security Assessment', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 60, stepPhase: 'design' },
                { title: 'Zero Trust Architecture Design', taskType: 'DESIGN', priority: 'high', estimatedHours: 80, stepPhase: 'design' },
                { title: 'Identity & Access Management', taskType: 'BUILD', priority: 'high', estimatedHours: 120, stepPhase: 'pilot' },
                { title: 'Network Segmentation', taskType: 'BUILD', priority: 'high', estimatedHours: 100, stepPhase: 'pilot' },
                { title: 'Monitoring & Detection', taskType: 'BUILD', priority: 'high', estimatedHours: 80, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 100 },
                { role: 'SME', allocation: 60 },
                { role: 'REVIEWER', allocation: 40 }
            ],
            typicalTimeline: '12 months',
            typicalBudgetRange: { min: 200000, max: 500000 }
        },
        isPublic: true
    },
    {
        id: uuidv4(),
        name: 'SIEM/SOC Enhancement',
        category: 'SECURITY',
        description: 'Upgrade Security Information and Event Management (SIEM) capabilities and establish or enhance Security Operations Center.',
        applicableAxes: ['cybersecurity'],
        templateData: {
            problemStructured: {
                symptom: 'Slow threat detection and incident response times',
                rootCause: 'Inadequate security monitoring tools and lack of dedicated security operations',
                costOfInaction: 'Extended breach dwell time increasing damage and recovery costs'
            },
            targetState: {
                process: [
                    'Real-time threat detection',
                    'Automated incident response for common threats'
                ],
                behavior: [
                    'Proactive threat hunting',
                    'Continuous security improvement'
                ],
                capability: [
                    'Modern SIEM platform operational',
                    'SOC team trained and effective'
                ]
            },
            killCriteria: [
                'If false positive rate exceeds 80%, tune before continuing',
                'If alert fatigue causes missed incidents, stop and fix',
                'If integration with critical systems fails, pause'
            ],
            suggestedTasks: [
                { title: 'Current State Assessment', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
                { title: 'SIEM Platform Selection', taskType: 'DECISION', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
                { title: 'Platform Implementation', taskType: 'BUILD', priority: 'high', estimatedHours: 160, stepPhase: 'pilot' },
                { title: 'Use Case Development', taskType: 'BUILD', priority: 'high', estimatedHours: 80, stepPhase: 'pilot' },
                { title: 'SOC Process Implementation', taskType: 'BUILD', priority: 'high', estimatedHours: 60, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 100 },
                { role: 'SME', allocation: 70 },
                { role: 'REVIEWER', allocation: 30 }
            ],
            typicalTimeline: '9 months',
            typicalBudgetRange: { min: 150000, max: 400000 }
        },
        isPublic: true
    },

    // ============= AI_ML Category =============
    {
        id: uuidv4(),
        name: 'AI Pilot Program',
        category: 'AI_ML',
        description: 'Launch an AI pilot program to prove value, build capabilities, and establish foundations for AI at scale.',
        applicableAxes: ['aiMaturity', 'dataManagement'],
        templateData: {
            problemStructured: {
                symptom: 'Competitors using AI for competitive advantage while we lag behind',
                rootCause: 'Lack of AI strategy, skills, and data infrastructure for AI',
                costOfInaction: 'Falling behind in automation and intelligence-driven decisions'
            },
            targetState: {
                process: [
                    'AI use case identification framework',
                    'Model development and deployment pipeline'
                ],
                behavior: [
                    'Business teams identify AI opportunities',
                    'Data-driven experimentation culture'
                ],
                capability: [
                    '2-3 AI models in production',
                    'Internal AI team established'
                ]
            },
            killCriteria: [
                'If no measurable business value after 2 pilots, reassess',
                'If data quality insufficient for ML, stop and fix data first',
                'If ethics/bias issues discovered, halt and remediate'
            ],
            suggestedTasks: [
                { title: 'AI Use Case Discovery', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
                { title: 'Data Readiness Assessment', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
                { title: 'Pilot Selection', taskType: 'DECISION', priority: 'high', estimatedHours: 20, stepPhase: 'design' },
                { title: 'Model Development', taskType: 'BUILD', priority: 'high', estimatedHours: 160, stepPhase: 'pilot' },
                { title: 'Model Validation', taskType: 'VALIDATION', priority: 'high', estimatedHours: 40, stepPhase: 'pilot' },
                { title: 'Production Deployment', taskType: 'BUILD', priority: 'high', estimatedHours: 60, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 100 },
                { role: 'SME', allocation: 80 },
                { role: 'STAKEHOLDER', allocation: 25 }
            ],
            typicalTimeline: '6 months',
            typicalBudgetRange: { min: 100000, max: 300000 }
        },
        isPublic: true
    },
    {
        id: uuidv4(),
        name: 'MLOps Foundation',
        category: 'AI_ML',
        description: 'Establish MLOps practices and platform to operationalize machine learning models at scale with proper governance.',
        applicableAxes: ['aiMaturity', 'processes'],
        templateData: {
            problemStructured: {
                symptom: 'ML models stuck in notebooks, not making it to production',
                rootCause: 'Lack of MLOps practices, tools, and collaboration between data science and engineering',
                costOfInaction: 'AI investments not delivering expected value, models degrading'
            },
            targetState: {
                process: [
                    'Automated ML pipelines from training to deployment',
                    'Model monitoring and retraining workflows'
                ],
                behavior: [
                    'Data scientists focus on models, not infrastructure',
                    'Engineering supports ML deployment as standard'
                ],
                capability: [
                    'MLOps platform operational',
                    'Model registry and versioning in place'
                ]
            },
            killCriteria: [
                'If model deployment time does not improve by 50%, reassess',
                'If platform adoption by data scientists below 60%, adjust',
                'If governance/compliance gaps found, stop and fix'
            ],
            suggestedTasks: [
                { title: 'Current ML Workflow Assessment', taskType: 'ANALYSIS', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
                { title: 'MLOps Platform Architecture', taskType: 'DESIGN', priority: 'high', estimatedHours: 60, stepPhase: 'design' },
                { title: 'Platform Implementation', taskType: 'BUILD', priority: 'high', estimatedHours: 160, stepPhase: 'pilot' },
                { title: 'CI/CD Pipeline Setup', taskType: 'BUILD', priority: 'high', estimatedHours: 80, stepPhase: 'pilot' },
                { title: 'Monitoring & Governance', taskType: 'BUILD', priority: 'medium', estimatedHours: 60, stepPhase: 'rollout' }
            ],
            suggestedRoles: [
                { role: 'CONTRIBUTOR', allocation: 100 },
                { role: 'SME', allocation: 70 },
                { role: 'REVIEWER', allocation: 30 }
            ],
            typicalTimeline: '9 months',
            typicalBudgetRange: { min: 150000, max: 400000 }
        },
        isPublic: true
    }
];

/**
 * Seed the database with default templates
 * @param {Object} db - Database instance
 */
async function seedTemplates(db) {
    const now = new Date().toISOString();

    for (const template of DEFAULT_TEMPLATES) {
        await new Promise((resolve, reject) => {
            const sql = `
                INSERT OR IGNORE INTO initiative_templates 
                (id, name, category, description, applicable_axes, template_data, is_public, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            `;

            db.run(sql, [
                template.id,
                template.name,
                template.category,
                template.description,
                JSON.stringify(template.applicableAxes),
                JSON.stringify(template.templateData),
                now,
                now
            ], (err) => {
                if (err) {
                    console.warn(`Failed to seed template ${template.name}:`, err.message);
                }
                resolve();
            });
        });
    }

    console.log(`[Seed] Inserted ${DEFAULT_TEMPLATES.length} initiative templates`);
}

module.exports = {
    DEFAULT_TEMPLATES,
    seedTemplates
};



