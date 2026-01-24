/**
 * SEED: Complete DBR77 Data Expansion
 * 
 * Adds:
 * - 3 DRD Assessments (completed, in progress, draft)
 * - 2 SIRI Assessments (completed, in progress)
 * - Strategic & Operational Tools usage
 * - Initiatives across ALL stages (ideation, discovery, planning, pilot, execution, rollout)
 * - KPI Definitions and measurements
 * - Additional financial analyses
 * - Roadmap waves
 * - Status Reports
 * 
 * Run: node server/seed/seed_dbr77_complete_expansion.js
 */

import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'consultinity.db');
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const ORG_ID = 'org-dbr77-system';
const USER_ID = 'user-dbr77-admin';

// ============================================
// MULTI-FRAMEWORK ASSESSMENTS (3 DRD + 2 SIRI)
// ============================================
const multiFrameworkAssessments = [
    // DRD Assessments
    {
        id: 'mfa-drd-01',
        project_id: 'project-dbr77-dt2025',
        name: 'DRD Assessment - Digital Transformation 2025',
        framework: 'DRD',
        status: 'COMPLETED',
        progress: 100,
        total_dimensions: 5,
        framework_data: JSON.stringify({
            dimensions: [
                { id: 'planning', name: 'Strategic Planning', as_is: 3.8, to_be: 4.5, gap: 0.7 },
                { id: 'decision', name: 'Decision Making', as_is: 3.2, to_be: 4.5, gap: 1.3 },
                { id: 'execution', name: 'Execution Capability', as_is: 2.9, to_be: 4.5, gap: 1.6 },
                { id: 'monitoring', name: 'Monitoring & Control', as_is: 3.5, to_be: 4.5, gap: 1.0 },
                { id: 'collaboration', name: 'Collaboration', as_is: 3.4, to_be: 4.5, gap: 1.1 }
            ],
            overallScore: 3.36,
            targetScore: 4.5,
            industryBenchmark: 3.2,
            completedAt: '2024-10-15'
        })
    },
    {
        id: 'mfa-drd-02',
        project_id: 'project-dbr77-smart',
        name: 'DRD Assessment - Smart Factory Initiative',
        framework: 'DRD',
        status: 'IN_PROGRESS',
        progress: 65,
        total_dimensions: 5,
        framework_data: JSON.stringify({
            dimensions: [
                { id: 'planning', name: 'Strategic Planning', as_is: 3.2, to_be: 4.5, gap: 1.3 },
                { id: 'decision', name: 'Decision Making', as_is: 3.5, to_be: 4.5, gap: 1.0 },
                { id: 'execution', name: 'Execution Capability', as_is: 2.8, to_be: 4.5, gap: 1.7 },
                { id: 'monitoring', name: 'Monitoring & Control', as_is: null, to_be: 4.5, gap: null },
                { id: 'collaboration', name: 'Collaboration', as_is: null, to_be: 4.5, gap: null }
            ],
            overallScore: null,
            targetScore: 4.5,
            inProgress: true
        })
    },
    {
        id: 'mfa-drd-03',
        project_id: 'project-dbr77-opex',
        name: 'DRD Assessment - Operational Excellence',
        framework: 'DRD',
        status: 'DRAFT',
        progress: 10,
        total_dimensions: 5,
        framework_data: JSON.stringify({
            dimensions: [
                { id: 'planning', name: 'Strategic Planning', as_is: null, to_be: 4.0, gap: null },
                { id: 'decision', name: 'Decision Making', as_is: null, to_be: 4.0, gap: null },
                { id: 'execution', name: 'Execution Capability', as_is: null, to_be: 4.0, gap: null },
                { id: 'monitoring', name: 'Monitoring & Control', as_is: null, to_be: 4.0, gap: null },
                { id: 'collaboration', name: 'Collaboration', as_is: null, to_be: 4.0, gap: null }
            ],
            scheduledStart: '2025-02-01'
        })
    },
    // SIRI Assessments
    {
        id: 'mfa-siri-01',
        project_id: 'project-dbr77-smart',
        name: 'SIRI Assessment - Industry 4.0 Readiness',
        framework: 'SIRI',
        status: 'COMPLETED',
        progress: 100,
        total_dimensions: 8,
        framework_data: JSON.stringify({
            pillars: [
                { id: 'process', name: 'Process', score: 3.4, maturityLevel: 'Defined' },
                { id: 'technology', name: 'Technology', score: 2.8, maturityLevel: 'Developing' },
                { id: 'organization', name: 'Organization', score: 3.2, maturityLevel: 'Defined' }
            ],
            dimensions: [
                { pillar: 'process', id: 'operations', name: 'Operations', score: 3.5 },
                { pillar: 'process', id: 'supply_chain', name: 'Supply Chain', score: 3.2 },
                { pillar: 'process', id: 'product_lifecycle', name: 'Product Lifecycle', score: 3.5 },
                { pillar: 'technology', id: 'automation', name: 'Automation', score: 2.5 },
                { pillar: 'technology', id: 'connectivity', name: 'Connectivity', score: 3.0 },
                { pillar: 'technology', id: 'intelligence', name: 'Intelligence', score: 2.8 },
                { pillar: 'organization', id: 'talent', name: 'Talent Readiness', score: 3.5 },
                { pillar: 'organization', id: 'structure', name: 'Structure & Management', score: 2.9 }
            ],
            overallScore: 3.13,
            siriLevel: 'Band 2: Intermediate',
            completedAt: '2024-11-20'
        })
    },
    {
        id: 'mfa-siri-02',
        project_id: 'project-dbr77-dt2025',
        name: 'SIRI Assessment - Post-Implementation Review',
        framework: 'SIRI',
        status: 'IN_PROGRESS',
        progress: 40,
        total_dimensions: 8,
        framework_data: JSON.stringify({
            pillars: [
                { id: 'process', name: 'Process', score: 3.8, maturityLevel: 'Defined' },
                { id: 'technology', name: 'Technology', score: null, maturityLevel: null },
                { id: 'organization', name: 'Organization', score: null, maturityLevel: null }
            ],
            dimensions: [
                { pillar: 'process', id: 'operations', name: 'Operations', score: 4.0 },
                { pillar: 'process', id: 'supply_chain', name: 'Supply Chain', score: 3.6 },
                { pillar: 'process', id: 'product_lifecycle', name: 'Product Lifecycle', score: 3.8 },
                { pillar: 'technology', id: 'automation', name: 'Automation', score: null },
                { pillar: 'technology', id: 'connectivity', name: 'Connectivity', score: null },
                { pillar: 'technology', id: 'intelligence', name: 'Intelligence', score: null },
                { pillar: 'organization', id: 'talent', name: 'Talent Readiness', score: null },
                { pillar: 'organization', id: 'structure', name: 'Structure & Management', score: null }
            ],
            scheduledCompletion: '2025-02-15'
        })
    }
];

// ============================================
// ADDITIONAL INITIATIVES (covering ALL stages)
// ============================================
const additionalInitiatives = [
    // IDEATION stage
    {
        id: uuidv4(),
        project_id: 'project-dbr77-dt2025',
        name: 'Generative AI for Documentation',
        summary: 'Explore use of LLMs for automated technical documentation generation',
        status: 'DRAFT',
        current_stage: 'ideation',
        axis: 'technology',
        area: 'AI & Automation',
        hypothesis: 'AI-generated documentation could reduce documentation time by 70% and improve consistency',
        business_value: 200000,
        cost_capex: 50000,
        cost_opex: 20000,
        expected_roi: 150
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-cx',
        name: 'Voice Commerce Integration',
        summary: 'Integrate voice assistants (Alexa, Google Home) for ordering',
        status: 'DRAFT',
        current_stage: 'ideation',
        axis: 'customer',
        area: 'Innovation',
        hypothesis: 'Voice commerce could capture 5% additional market share in 3 years',
        business_value: 1000000,
        cost_capex: 200000,
        cost_opex: 50000,
        expected_roi: 200
    },
    // DISCOVERY stage
    {
        id: uuidv4(),
        project_id: 'project-dbr77-opex',
        name: 'Blockchain for Supply Chain Traceability',
        summary: 'Investigate blockchain technology for end-to-end supply chain transparency',
        status: 'IN_PROGRESS',
        current_stage: 'discovery',
        axis: 'technology',
        area: 'Supply Chain',
        hypothesis: 'Blockchain could reduce disputes by 40% and improve compliance',
        business_value: 500000,
        cost_capex: 300000,
        cost_opex: 80000,
        expected_roi: 133
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-smart',
        name: 'Computer Vision Quality Inspection',
        summary: 'Research CV-based automated quality inspection systems',
        status: 'IN_PROGRESS',
        current_stage: 'discovery',
        axis: 'technology',
        area: 'Quality',
        hypothesis: 'CV inspection could detect 99.5% of defects vs 85% manual inspection',
        business_value: 700000,
        cost_capex: 250000,
        cost_opex: 60000,
        expected_roi: 225
    },
    // PLANNING stage
    {
        id: uuidv4(),
        project_id: 'project-dbr77-dt2025',
        name: 'Master Data Management Platform',
        summary: 'Implement enterprise MDM for data governance and quality',
        status: 'APPROVED',
        current_stage: 'planning',
        axis: 'data',
        area: 'Data Governance',
        hypothesis: 'MDM will reduce data inconsistencies by 90% and improve reporting accuracy',
        business_value: 450000,
        cost_capex: 180000,
        cost_opex: 50000,
        expected_roi: 195
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-cx',
        name: 'Customer 360 Dashboard',
        summary: 'Create unified customer view dashboard for sales and service teams',
        status: 'APPROVED',
        current_stage: 'planning',
        axis: 'customer',
        area: 'Customer Insights',
        hypothesis: '360-degree view will increase cross-sell by 25% and reduce churn by 15%',
        business_value: 600000,
        cost_capex: 150000,
        cost_opex: 40000,
        expected_roi: 315
    },
    // PILOT stage
    {
        id: uuidv4(),
        project_id: 'project-dbr77-opex',
        name: 'Smart Warehouse Robotics Pilot',
        summary: 'Pilot AMR robots in main distribution center',
        status: 'IN_PROGRESS',
        current_stage: 'pilot',
        axis: 'operational',
        area: 'Warehouse',
        hypothesis: 'AMR robots can improve picking efficiency by 40% and reduce labor costs',
        business_value: 800000,
        cost_capex: 400000,
        cost_opex: 80000,
        expected_roi: 166
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-smart',
        name: 'AR Maintenance Assistance Pilot',
        summary: 'Test augmented reality for maintenance technician support',
        status: 'IN_PROGRESS',
        current_stage: 'pilot',
        axis: 'technology',
        area: 'Maintenance',
        hypothesis: 'AR guidance will reduce repair time by 25% and training time by 50%',
        business_value: 350000,
        cost_capex: 120000,
        cost_opex: 30000,
        expected_roi: 233
    },
    // EXECUTION stage
    {
        id: uuidv4(),
        project_id: 'project-dbr77-dt2025',
        name: 'API Management Platform',
        summary: 'Deploy enterprise API gateway for internal and external integrations',
        status: 'EXECUTING',
        current_stage: 'execution',
        axis: 'technology',
        area: 'Integration',
        hypothesis: 'API platform will reduce integration time by 60% and improve security',
        business_value: 400000,
        cost_capex: 200000,
        cost_opex: 60000,
        expected_roi: 153
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-cx',
        name: 'Self-Service Customer Portal',
        summary: 'Launch comprehensive self-service portal for B2B customers',
        status: 'EXECUTING',
        current_stage: 'execution',
        axis: 'customer',
        area: 'Digital Channels',
        hypothesis: 'Self-service will reduce support calls by 35% and improve customer satisfaction',
        business_value: 500000,
        cost_capex: 180000,
        cost_opex: 45000,
        expected_roi: 222
    },
    // ROLLOUT stage
    {
        id: uuidv4(),
        project_id: 'project-dbr77-dt2025',
        name: 'Electronic Document Management',
        summary: 'Organization-wide rollout of electronic document management system',
        status: 'DONE',
        current_stage: 'rollout',
        axis: 'operational',
        area: 'Document Management',
        hypothesis: 'EDM will reduce paper costs by 80% and improve document retrieval by 90%',
        business_value: 300000,
        cost_capex: 100000,
        cost_opex: 25000,
        expected_roi: 240
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-opex',
        name: 'Employee Mobile App',
        summary: 'Deploy mobile app for employee self-service and communication',
        status: 'DONE',
        current_stage: 'rollout',
        axis: 'people',
        area: 'HR Technology',
        hypothesis: 'Mobile app will improve employee engagement by 20% and reduce admin queries',
        business_value: 200000,
        cost_capex: 80000,
        cost_opex: 20000,
        expected_roi: 200
    }
];

// ============================================
// KPI DEFINITIONS
// ============================================
const kpiDefinitions = [
    // Financial KPIs
    { name: 'Total Cost Savings', code: 'FIN-001', category: 'Financial', unit: 'EUR', direction: 'UP', default_target: 2000000 },
    { name: 'ROI on Digital Investments', code: 'FIN-002', category: 'Financial', unit: '%', direction: 'UP', default_target: 200 },
    { name: 'IT Cost as % of Revenue', code: 'FIN-003', category: 'Financial', unit: '%', direction: 'DOWN', default_target: 3.5 },
    { name: 'Automation Savings', code: 'FIN-004', category: 'Financial', unit: 'EUR', direction: 'UP', default_target: 800000 },
    // Operational KPIs
    { name: 'Process Automation Rate', code: 'OPS-001', category: 'Operational', unit: '%', direction: 'UP', default_target: 60 },
    { name: 'First Time Right Rate', code: 'OPS-002', category: 'Operational', unit: '%', direction: 'UP', default_target: 95 },
    { name: 'Cycle Time Reduction', code: 'OPS-003', category: 'Operational', unit: '%', direction: 'UP', default_target: 40 },
    { name: 'Error Rate', code: 'OPS-004', category: 'Operational', unit: '%', direction: 'DOWN', default_target: 2 },
    { name: 'System Uptime', code: 'OPS-005', category: 'Operational', unit: '%', direction: 'UP', default_target: 99.9 },
    // Customer KPIs
    { name: 'Net Promoter Score (NPS)', code: 'CX-001', category: 'Customer', unit: 'points', direction: 'UP', default_target: 50 },
    { name: 'Customer Satisfaction (CSAT)', code: 'CX-002', category: 'Customer', unit: '%', direction: 'UP', default_target: 90 },
    { name: 'First Contact Resolution', code: 'CX-003', category: 'Customer', unit: '%', direction: 'UP', default_target: 85 },
    { name: 'Customer Effort Score (CES)', code: 'CX-004', category: 'Customer', unit: 'points', direction: 'DOWN', default_target: 2.0 },
    { name: 'Digital Channel Adoption', code: 'CX-005', category: 'Customer', unit: '%', direction: 'UP', default_target: 70 },
    // Technology KPIs
    { name: 'Cloud Migration Progress', code: 'TECH-001', category: 'Technology', unit: '%', direction: 'UP', default_target: 80 },
    { name: 'API Response Time', code: 'TECH-002', category: 'Technology', unit: 'ms', direction: 'DOWN', default_target: 200 },
    { name: 'Security Incidents', code: 'TECH-003', category: 'Technology', unit: 'count', direction: 'DOWN', default_target: 0 },
    { name: 'Technical Debt Reduction', code: 'TECH-004', category: 'Technology', unit: '%', direction: 'UP', default_target: 40 },
    // People & Adoption KPIs
    { name: 'Training Completion Rate', code: 'PPL-001', category: 'People', unit: '%', direction: 'UP', default_target: 95 },
    { name: 'Digital Skills Index', code: 'PPL-002', category: 'People', unit: 'points', direction: 'UP', default_target: 4.0 },
    { name: 'Employee Satisfaction', code: 'PPL-003', category: 'People', unit: 'points', direction: 'UP', default_target: 4.2 },
    { name: 'Change Adoption Rate', code: 'PPL-004', category: 'People', unit: '%', direction: 'UP', default_target: 85 }
];

// ============================================
// ADDITIONAL FINANCIAL ANALYSES
// ============================================
const additionalFinancialAnalyses = [
    {
        id: uuidv4(),
        initial_investment: 500000,
        implementation_cost: 250000,
        annual_operating_cost: 100000,
        training_cost: 40000,
        contingency_percent: 20,
        annual_cost_savings: 600000,
        annual_revenue_increase: 0,
        productivity_gains_percent: 20,
        risk_reduction_value: 200000,
        implementation_months: 24,
        benefit_realization_months: 6,
        analysis_horizon_years: 5,
        discount_rate: 10,
        npv: 1800000,
        irr: 45,
        payback_months: 18,
        roi_percent: 200,
        currency: 'EUR',
        assumptions: JSON.stringify([
            'Unplanned downtime reduction of 80%',
            'Maintenance labor savings of 25%',
            'Spare parts inventory reduction of 30%',
            'Equipment lifespan extension of 15%'
        ])
    },
    {
        id: uuidv4(),
        initial_investment: 180000,
        implementation_cost: 80000,
        annual_operating_cost: 50000,
        training_cost: 15000,
        contingency_percent: 15,
        annual_cost_savings: 200000,
        annual_revenue_increase: 100000,
        productivity_gains_percent: 30,
        risk_reduction_value: 50000,
        implementation_months: 9,
        benefit_realization_months: 3,
        analysis_horizon_years: 5,
        discount_rate: 10,
        npv: 650000,
        irr: 55,
        payback_months: 12,
        roi_percent: 250,
        currency: 'EUR',
        assumptions: JSON.stringify([
            'Customer 360 view improves cross-sell by 25%',
            'Reduced churn saves €100K annually',
            'Faster service reduces support costs by 20%',
            'Better targeting improves marketing ROI'
        ])
    },
    {
        id: uuidv4(),
        initial_investment: 120000,
        implementation_cost: 50000,
        annual_operating_cost: 30000,
        training_cost: 10000,
        contingency_percent: 10,
        annual_cost_savings: 150000,
        annual_revenue_increase: 0,
        productivity_gains_percent: 35,
        risk_reduction_value: 25000,
        implementation_months: 6,
        benefit_realization_months: 2,
        analysis_horizon_years: 5,
        discount_rate: 10,
        npv: 420000,
        irr: 62,
        payback_months: 10,
        roi_percent: 280,
        currency: 'EUR',
        assumptions: JSON.stringify([
            'RPA handles 80% of routine document tasks',
            'Reduction of 3 FTE in document processing',
            'Error rate drops from 5% to 0.5%',
            'Compliance audit time reduced by 50%'
        ])
    },
    {
        id: uuidv4(),
        initial_investment: 400000,
        implementation_cost: 180000,
        annual_operating_cost: 120000,
        training_cost: 60000,
        contingency_percent: 20,
        annual_cost_savings: 350000,
        annual_revenue_increase: 200000,
        productivity_gains_percent: 25,
        risk_reduction_value: 100000,
        implementation_months: 18,
        benefit_realization_months: 6,
        analysis_horizon_years: 5,
        discount_rate: 10,
        npv: 1100000,
        irr: 38,
        payback_months: 16,
        roi_percent: 175,
        currency: 'EUR',
        assumptions: JSON.stringify([
            'IoT sensors reduce unplanned downtime by 50%',
            'Predictive maintenance extends equipment life',
            'Real-time monitoring improves quality by 20%',
            'Energy consumption reduced by 15%'
        ])
    }
];

// ============================================
// ROADMAP WAVES
// ============================================
const roadmapWaves = [
    {
        id: 'wave-dbr77-01',
        name: 'Wave 1: Foundation',
        description: 'Core infrastructure and essential capabilities',
        start_date: '2024-01-01',
        end_date: '2024-06-30',
        sequence_order: 1
    },
    {
        id: 'wave-dbr77-02',
        name: 'Wave 2: Acceleration',
        description: 'Expanding automation and analytics capabilities',
        start_date: '2024-07-01',
        end_date: '2024-12-31',
        sequence_order: 2
    },
    {
        id: 'wave-dbr77-03',
        name: 'Wave 3: Intelligence',
        description: 'AI/ML integration and advanced analytics',
        start_date: '2025-01-01',
        end_date: '2025-06-30',
        sequence_order: 3
    },
    {
        id: 'wave-dbr77-04',
        name: 'Wave 4: Transformation',
        description: 'Full digital transformation and optimization',
        start_date: '2025-07-01',
        end_date: '2025-12-31',
        sequence_order: 4
    },
    {
        id: 'wave-dbr77-05',
        name: 'Wave 5: Excellence',
        description: 'Continuous improvement and innovation',
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        sequence_order: 5
    }
];

// ============================================
// ADDITIONAL STATUS REPORTS
// ============================================
const additionalStatusReports = [
    {
        id: uuidv4(),
        project_id: 'project-dbr77-dt2025',
        period_type: 'MONTHLY',
        period_start: '2024-12-01',
        period_end: '2024-12-31',
        period_label: 'December 2024',
        overall_status: 'GREEN',
        overall_trend: 'IMPROVING',
        executive_summary: 'Strong progress across all Digital Transformation workstreams. RPA Wave 1 delivered 11 bots to production with €350K savings realized. Cloud migration ahead of schedule.',
        accomplishments: JSON.stringify([
            'RPA Wave 1: 11 of 15 bots deployed to production',
            'Cloud Migration: 45% of workloads migrated to AWS',
            'Data Lake: Architecture finalized and POC completed',
            'Security: Zero Trust framework design approved'
        ]),
        next_steps: JSON.stringify([
            'Complete remaining 4 RPA bots',
            'Launch Data Lake pilot with Finance',
            'Begin application modernization Wave 1',
            'Start 24/7 SOC onboarding'
        ]),
        escalations: JSON.stringify([]),
        progress_percent: 48,
        budget_consumed_percent: 42,
        tasks_completed: 24,
        tasks_total: 52,
        open_risks: 4,
        open_issues: 2,
        pending_decisions: 1,
        generation_method: 'AI_ASSISTED',
        status: 'PUBLISHED'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-cx',
        period_type: 'MONTHLY',
        period_start: '2024-12-01',
        period_end: '2024-12-31',
        period_label: 'December 2024',
        overall_status: 'GREEN',
        overall_trend: 'STABLE',
        executive_summary: 'Customer Experience program on track. Salesforce implementation progressing well. AI Chatbot pilot exceeded expectations with 78% deflection rate.',
        accomplishments: JSON.stringify([
            'Salesforce Sales Cloud: 50% configuration complete',
            'AI Chatbot pilot: 78% deflection rate achieved',
            'Customer Journey Mapping: All 12 journeys documented',
            'VoC Analysis: Key improvement areas identified'
        ]),
        next_steps: JSON.stringify([
            'Complete Salesforce Service Cloud configuration',
            'Expand chatbot to all product categories',
            'Launch omnichannel routing pilot',
            'Begin personalization engine POC'
        ]),
        escalations: JSON.stringify([
            'Need executive decision on CDP vendor selection'
        ]),
        progress_percent: 42,
        budget_consumed_percent: 38,
        tasks_completed: 15,
        tasks_total: 38,
        open_risks: 3,
        open_issues: 2,
        pending_decisions: 2,
        generation_method: 'AI_ASSISTED',
        status: 'PUBLISHED'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-smart',
        period_type: 'WEEKLY',
        period_start: '2025-01-13',
        period_end: '2025-01-19',
        period_label: 'Week 3, 2025',
        overall_status: 'GREEN',
        overall_trend: 'IMPROVING',
        executive_summary: 'Smart Factory pilot line showing excellent results. First 200 IoT sensors deployed with real-time monitoring active. Predictive maintenance ML model training started.',
        accomplishments: JSON.stringify([
            'Deployed 200 IoT sensors on pilot production line',
            'Real-time monitoring dashboard live',
            'Edge computing infrastructure 80% complete',
            'Predictive maintenance model training initiated'
        ]),
        next_steps: JSON.stringify([
            'Complete edge computing deployment',
            'Deploy additional 300 sensors on Line 2',
            'Validate predictive maintenance model accuracy',
            'Begin digital twin vendor evaluation'
        ]),
        escalations: JSON.stringify([]),
        progress_percent: 35,
        budget_consumed_percent: 28,
        tasks_completed: 14,
        tasks_total: 42,
        open_risks: 3,
        open_issues: 1,
        pending_decisions: 1,
        generation_method: 'AI_ASSISTED',
        status: 'PUBLISHED'
    }
];

// ============================================
// SEED EXECUTION
// ============================================
async function seed() {
    console.log('🚀 Starting DBR77 Complete Expansion Seed...\n');

    try {
        // 1. Multi-Framework Assessments (3 DRD + 2 SIRI)
        console.log('📊 Inserting Multi-Framework Assessments...');
        for (const a of multiFrameworkAssessments) {
            await run(`
                INSERT OR REPLACE INTO multi_framework_assessments (id, project_id, organization_id, name, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            `, [a.id, a.project_id, ORG_ID, a.name]);
        }
        console.log(`   ✅ ${multiFrameworkAssessments.length} assessments (3 DRD + 2 SIRI)`);

        // 2. Additional Initiatives (all stages)
        console.log('💡 Inserting additional initiatives across ALL stages...');
        for (const i of additionalInitiatives) {
            await run(`
                INSERT INTO initiatives (id, organization_id, project_id, name, summary, status, current_stage, axis, area, hypothesis, business_value, cost_capex, cost_opex, expected_roi, owner_business_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [i.id, ORG_ID, i.project_id, i.name, i.summary, i.status, i.current_stage, i.axis, i.area, i.hypothesis, i.business_value, i.cost_capex, i.cost_opex, i.expected_roi, USER_ID]);
        }
        console.log(`   ✅ ${additionalInitiatives.length} initiatives (ideation→discovery→planning→pilot→execution→rollout)`);

        // 3. KPI Definitions
        console.log('📈 Inserting KPI Definitions...');
        for (const k of kpiDefinitions) {
            await run(`
                INSERT OR REPLACE INTO kpi_definitions (id, organization_id, name, code, category, unit, direction, default_target, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
            `, [uuidv4(), ORG_ID, k.name, k.code, k.category, k.unit, k.direction, k.default_target]);
        }
        console.log(`   ✅ ${kpiDefinitions.length} KPI definitions`);

        // 4. Additional Financial Analyses
        console.log('💰 Inserting additional financial analyses...');
        for (const f of additionalFinancialAnalyses) {
            const analysisId = uuidv4();
            await run(`
                INSERT OR REPLACE INTO analysis_financials (
                    id, analysis_id, organization_id,
                    initial_investment, implementation_cost, annual_operating_cost, training_cost, contingency_percent,
                    annual_cost_savings, annual_revenue_increase, productivity_gains_percent, risk_reduction_value,
                    implementation_months, benefit_realization_months, analysis_horizon_years, discount_rate,
                    npv, irr, payback_months, roi_percent, currency, assumptions,
                    created_by, created_at, updated_at, last_calculated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
            `, [
                f.id, analysisId, ORG_ID,
                f.initial_investment, f.implementation_cost, f.annual_operating_cost, f.training_cost, f.contingency_percent,
                f.annual_cost_savings, f.annual_revenue_increase, f.productivity_gains_percent, f.risk_reduction_value,
                f.implementation_months, f.benefit_realization_months, f.analysis_horizon_years, f.discount_rate,
                f.npv, f.irr, f.payback_months, f.roi_percent, f.currency, f.assumptions,
                USER_ID
            ]);
        }
        console.log(`   ✅ ${additionalFinancialAnalyses.length} additional financial analyses`);

        // 5. Roadmap Waves
        console.log('🗺️ Inserting Roadmap Waves...');
        for (const w of roadmapWaves) {
            await run(`
                INSERT OR REPLACE INTO roadmap_waves (id, organization_id, project_id, name, description, start_date, end_date, sequence_order, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [w.id, ORG_ID, 'project-dbr77-dt2025', w.name, w.description, w.start_date, w.end_date, w.sequence_order]);
        }
        console.log(`   ✅ ${roadmapWaves.length} roadmap waves`);

        // 6. Additional Status Reports
        console.log('📋 Inserting additional status reports...');
        for (const r of additionalStatusReports) {
            await run(`
                INSERT OR REPLACE INTO status_reports (
                    id, organization_id, initiative_id, project_id,
                    period_type, period_start, period_end, period_label,
                    overall_status, overall_trend, executive_summary,
                    accomplishments, next_steps, escalations,
                    progress_percent, budget_consumed_percent, tasks_completed, tasks_total,
                    open_risks, open_issues, pending_decisions,
                    generation_method, status, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [
                r.id, ORG_ID, r.id, r.project_id,
                r.period_type, r.period_start, r.period_end, r.period_label,
                r.overall_status, r.overall_trend, r.executive_summary,
                r.accomplishments, r.next_steps, r.escalations,
                r.progress_percent, r.budget_consumed_percent, r.tasks_completed, r.tasks_total,
                r.open_risks, r.open_issues, r.pending_decisions,
                r.generation_method, r.status, USER_ID
            ]);
        }
        console.log(`   ✅ ${additionalStatusReports.length} additional status reports`);

        console.log('\n✨ DBR77 Complete Expansion Seed finished successfully!');
        console.log('\n📈 Summary:');
        console.log(`   - Multi-Framework Assessments: ${multiFrameworkAssessments.length} (3 DRD + 2 SIRI)`);
        console.log(`   - Additional Initiatives: ${additionalInitiatives.length} (all stages covered)`);
        console.log(`   - KPI Definitions: ${kpiDefinitions.length}`);
        console.log(`   - Financial Analyses: ${additionalFinancialAnalyses.length}`);
        console.log(`   - Roadmap Waves: ${roadmapWaves.length}`);
        console.log(`   - Status Reports: ${additionalStatusReports.length}`);
        console.log('\n🎯 Initiative Stage Coverage:');
        console.log('   - Ideation: 2');
        console.log('   - Discovery: 2');
        console.log('   - Planning: 2');
        console.log('   - Pilot: 2');
        console.log('   - Execution: 2');
        console.log('   - Rollout: 2');

    } catch (error) {
        console.error('❌ Error during seed:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

seed();
