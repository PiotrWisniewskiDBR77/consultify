/**
 * SEED: Complete English data for DBR77 Module
 * 
 * Run: node server/seed/seed_dbr77_english_complete.js
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
// PROJECTS
// ============================================
const projects = [
    {
        id: 'project-dbr77-dt2025',
        name: 'Digital Transformation 2025',
        description: 'Comprehensive digital transformation program covering process automation, AI implementation, and IT infrastructure modernization. Target: 40% operational efficiency increase and 25% cost reduction.',
        status: 'active',
        phase: 'execution',
        budget: 2500000,
        currency: 'EUR',
        priority: 'high',
        start_date: '2024-01-15',
        end_date: '2025-12-31'
    },
    {
        id: 'project-dbr77-cx',
        name: 'Customer Experience Revolution',
        description: 'Modernization of all customer touchpoints. Implementation of omnichannel, AI personalization, chatbots, and new CRM. Expected NPS increase of 30 points.',
        status: 'active',
        phase: 'pilot',
        budget: 1200000,
        currency: 'EUR',
        priority: 'high',
        start_date: '2024-06-01',
        end_date: '2025-06-30'
    },
    {
        id: 'project-dbr77-opex',
        name: 'Operational Excellence Program',
        description: 'Continuous operational improvement program based on Lean and Six Sigma. Supply chain optimization, backoffice automation, waste reduction.',
        status: 'active',
        phase: 'planning',
        budget: 800000,
        currency: 'EUR',
        priority: 'medium',
        start_date: '2024-09-01',
        end_date: '2026-03-31'
    },
    {
        id: 'project-dbr77-smart',
        name: 'Smart Factory Initiative',
        description: 'Industry 4.0 transformation: IoT sensors, predictive maintenance, digital twin, and real-time production monitoring across all manufacturing sites.',
        status: 'active',
        phase: 'discovery',
        budget: 3200000,
        currency: 'EUR',
        priority: 'high',
        start_date: '2024-11-01',
        end_date: '2026-06-30'
    }
];

// ============================================
// INITIATIVES
// ============================================
const initiatives = [
    // Digital Transformation 2025
    {
        id: uuidv4(),
        project_id: 'project-dbr77-dt2025',
        name: 'AI-Powered Process Automation',
        title: 'Intelligent Business Process Automation with AI',
        description: 'Implementation of intelligent business process automation using Machine Learning for workflow optimization, prediction, and automated decision-making in standard cases.',
        summary: 'Automation of 50+ business processes using RPA and AI',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 65,
        axis: 'operational',
        area: 'Operations',
        hypothesis: 'AI-powered process automation will reduce processing time by 60% and human errors by 90%',
        problem_statement: 'Manual processes are time-consuming, error-prone, and do not scale with company growth',
        deliverables: JSON.stringify(['RPA platform integrated with ERP/CRM systems', 'ML models for document classification', 'Process monitoring dashboard', 'Documentation and training materials']),
        success_criteria: JSON.stringify(['60% reduction in processing time', '90% reduction in errors', 'ROI > 200% within 18 months', 'Minimum 50 automated processes']),
        business_value: 1500000,
        cost_capex: 400000,
        cost_opex: 120000,
        expected_roi: 275,
        value_driver: 'Cost Reduction',
        confidence_level: 'high',
        current_stage: 'execution'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-dt2025',
        name: 'Cloud Migration & Modernization',
        title: 'Hybrid Cloud Infrastructure Transformation',
        description: 'Comprehensive migration of on-premise infrastructure to AWS/Azure hybrid cloud with application modernization to microservices architecture and containerization.',
        summary: 'Migration of 80% workloads to cloud and modernization of key applications',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 45,
        axis: 'technology',
        area: 'IT Infrastructure',
        hypothesis: 'Cloud migration will reduce infrastructure costs by 35% and increase flexibility',
        business_value: 800000,
        cost_capex: 300000,
        cost_opex: 200000,
        expected_roi: 160,
        value_driver: 'Cost Reduction',
        current_stage: 'pilot'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-dt2025',
        name: 'Enterprise Data Analytics Platform',
        title: 'Central Data Platform with Business Intelligence',
        description: 'Building a central data platform with data lake, BI tools, self-service analytics, and AI-powered predictive models for all departments.',
        summary: 'Central data platform with AI-powered analytics',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 30,
        axis: 'data',
        area: 'Data & Analytics',
        business_value: 600000,
        cost_capex: 250000,
        cost_opex: 80000,
        expected_roi: 182,
        value_driver: 'Revenue Growth',
        current_stage: 'execution'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-dt2025',
        name: 'Zero Trust Security Framework',
        title: 'Enterprise Cybersecurity Enhancement',
        description: 'Comprehensive security program: Zero Trust Architecture, 24/7 SOC, SIEM/SOAR implementation, penetration testing, and employee security awareness training.',
        summary: 'Zero Trust security with 24/7 SOC',
        status: 'APPROVED',
        priority: 'HIGH',
        progress: 15,
        axis: 'technology',
        area: 'Security',
        business_value: 400000,
        cost_capex: 200000,
        cost_opex: 150000,
        expected_roi: 114,
        value_driver: 'Risk Reduction',
        current_stage: 'planning'
    },
    // Customer Experience Revolution
    {
        id: uuidv4(),
        project_id: 'project-dbr77-cx',
        name: 'Unified Omnichannel Platform',
        title: 'Integrated Customer Service Platform',
        description: 'Implementation of integrated omnichannel platform connecting all contact channels: web, mobile, call center, chat, email, social media with a unified customer view.',
        summary: 'Single customer view across all channels',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 55,
        axis: 'customer',
        area: 'Customer Service',
        business_value: 900000,
        cost_capex: 350000,
        cost_opex: 100000,
        expected_roi: 200,
        value_driver: 'Customer Retention',
        current_stage: 'pilot'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-cx',
        name: 'AI Customer Service Assistant',
        title: 'Intelligent Customer Support Chatbot',
        description: 'Implementation of advanced AI chatbot with NLP that will handle 70% of Tier 1 inquiries with seamless handover to human agents when needed.',
        summary: 'AI chatbot handling 70% of Tier 1 inquiries',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        progress: 75,
        axis: 'customer',
        area: 'Customer Service',
        business_value: 500000,
        cost_capex: 150000,
        cost_opex: 50000,
        expected_roi: 250,
        value_driver: 'Cost Reduction',
        current_stage: 'rollout'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-cx',
        name: 'Real-Time Personalization Engine',
        title: 'AI-Powered Customer Experience Personalization',
        description: 'Implementation of AI-powered recommendation engine for real-time personalization of offers, communications, and customer experiences.',
        summary: 'Real-time personalization with AI',
        status: 'APPROVED',
        priority: 'MEDIUM',
        progress: 20,
        axis: 'customer',
        area: 'Marketing',
        business_value: 700000,
        cost_capex: 200000,
        cost_opex: 60000,
        expected_roi: 269,
        value_driver: 'Revenue Growth',
        current_stage: 'planning'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-cx',
        name: 'Salesforce CRM Implementation',
        title: 'Enterprise CRM Modernization',
        description: 'Migration from legacy CRM to Salesforce with full customization, integration with all systems, and deployment of Sales Cloud, Service Cloud, and Marketing Cloud.',
        summary: 'Salesforce CRM for 500+ users',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 40,
        axis: 'technology',
        area: 'Sales & Marketing',
        business_value: 600000,
        cost_capex: 400000,
        cost_opex: 120000,
        expected_roi: 115,
        value_driver: 'Revenue Growth',
        current_stage: 'execution'
    },
    // Operational Excellence
    {
        id: uuidv4(),
        project_id: 'project-dbr77-opex',
        name: 'AI-Driven Supply Chain Optimization',
        title: 'Intelligent Supply Chain Management',
        description: 'Implementation of AI-powered supply chain planning, demand forecasting, and inventory optimization with supplier integration.',
        summary: 'AI-powered supply chain with demand forecasting',
        status: 'APPROVED',
        priority: 'HIGH',
        progress: 10,
        axis: 'operational',
        area: 'Supply Chain',
        business_value: 800000,
        cost_capex: 250000,
        cost_opex: 80000,
        expected_roi: 242,
        value_driver: 'Cost Reduction',
        current_stage: 'planning'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-opex',
        name: 'Backoffice Process Automation',
        title: 'Finance and HR Automation',
        description: 'Automation of backoffice processes: AP/AR, reconciliation, reporting, compliance using RPA and workflow automation.',
        summary: 'RPA for finance and HR backoffice',
        status: 'DRAFT',
        priority: 'MEDIUM',
        progress: 5,
        axis: 'operational',
        area: 'Finance & HR',
        business_value: 400000,
        cost_capex: 150000,
        cost_opex: 40000,
        expected_roi: 210,
        value_driver: 'Cost Reduction',
        current_stage: 'discovery'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-opex',
        name: 'Digital Quality Management System',
        title: 'Automated Quality Control Platform',
        description: 'Implementation of digital QMS with automated quality control, SPC, root cause analysis, and continuous improvement tracking.',
        summary: 'Digital QMS with automated quality control',
        status: 'DRAFT',
        priority: 'MEDIUM',
        progress: 0,
        axis: 'operational',
        area: 'Quality',
        business_value: 300000,
        cost_capex: 120000,
        cost_opex: 30000,
        expected_roi: 200,
        value_driver: 'Cost Reduction',
        current_stage: 'ideation'
    },
    // Smart Factory
    {
        id: uuidv4(),
        project_id: 'project-dbr77-smart',
        name: 'Industrial IoT Sensor Network',
        title: 'Connected Factory Floor Infrastructure',
        description: 'Deployment of comprehensive IoT sensor network across all production lines for real-time monitoring of equipment health, environmental conditions, and production metrics.',
        summary: '2000+ IoT sensors across 3 manufacturing sites',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 35,
        axis: 'technology',
        area: 'Manufacturing',
        business_value: 1200000,
        cost_capex: 500000,
        cost_opex: 100000,
        expected_roi: 200,
        value_driver: 'Cost Reduction',
        current_stage: 'execution'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-smart',
        name: 'Predictive Maintenance AI',
        title: 'Machine Learning for Equipment Reliability',
        description: 'AI-powered predictive maintenance system analyzing sensor data to predict equipment failures 72 hours in advance, reducing unplanned downtime by 80%.',
        summary: 'Predictive maintenance with 72h failure prediction',
        status: 'APPROVED',
        priority: 'HIGH',
        progress: 15,
        axis: 'operational',
        area: 'Maintenance',
        business_value: 900000,
        cost_capex: 300000,
        cost_opex: 80000,
        expected_roi: 237,
        value_driver: 'Cost Reduction',
        current_stage: 'planning'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-smart',
        name: 'Digital Twin Platform',
        title: 'Virtual Factory Simulation',
        description: 'Creation of comprehensive digital twin of manufacturing operations for simulation, optimization, and scenario planning before physical implementation.',
        summary: 'Digital twin of 3 production lines',
        status: 'DRAFT',
        priority: 'MEDIUM',
        progress: 5,
        axis: 'technology',
        area: 'Manufacturing',
        business_value: 600000,
        cost_capex: 400000,
        cost_opex: 60000,
        expected_roi: 130,
        value_driver: 'Revenue Growth',
        current_stage: 'discovery'
    }
];

// ============================================
// TASKS
// ============================================
const tasks = [
    // Digital Transformation tasks
    { project_id: 'project-dbr77-dt2025', title: 'Process automation audit', description: 'Conduct audit of 100+ processes and select top 50 for RPA automation', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-dt2025', title: 'RPA platform selection', description: 'Evaluate UiPath, Automation Anywhere, Power Automate - conduct POC', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-dt2025', title: 'RPA bot development Wave 1', description: 'Implement 15 RPA bots for finance processes', status: 'in_progress', priority: 'high', progress: 70 },
    { project_id: 'project-dbr77-dt2025', title: 'SAP RPA integration', description: 'Connect bots with SAP ERP via API/UI automation', status: 'in_progress', priority: 'high', progress: 45 },
    { project_id: 'project-dbr77-dt2025', title: 'ML model training', description: 'Prepare and train models for invoice and document classification', status: 'in_progress', priority: 'medium', progress: 60 },
    { project_id: 'project-dbr77-dt2025', title: 'Wave 1 bot UAT', description: 'User Acceptance Testing for first 15 bots', status: 'todo', priority: 'high', progress: 0 },
    { project_id: 'project-dbr77-dt2025', title: 'AWS Landing Zone setup', description: 'Configure multi-account AWS organization with Control Tower', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-dt2025', title: 'Network architecture design', description: 'Design hybrid network AWS-Azure-OnPrem', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-dt2025', title: 'Application migration Wave 1', description: 'Lift & shift 20 applications to AWS EC2/ECS', status: 'in_progress', priority: 'high', progress: 55 },
    { project_id: 'project-dbr77-dt2025', title: 'Kubernetes cluster setup', description: 'Configure EKS for containerized applications', status: 'in_progress', priority: 'medium', progress: 80 },
    { project_id: 'project-dbr77-dt2025', title: 'Data lake architecture', description: 'Design and implement S3-based data lake with Glue ETL', status: 'in_progress', priority: 'high', progress: 40 },
    { project_id: 'project-dbr77-dt2025', title: 'Security baseline assessment', description: 'Conduct comprehensive security posture assessment', status: 'completed', priority: 'high', progress: 100 },
    // Customer Experience tasks
    { project_id: 'project-dbr77-cx', title: 'Salesforce implementation kickoff', description: 'Launch Salesforce implementation project', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-cx', title: 'Data migration planning', description: 'Plan data migration from legacy CRM to Salesforce', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-cx', title: 'Sales Cloud configuration', description: 'Configure Sales Cloud with custom objects', status: 'in_progress', priority: 'high', progress: 65 },
    { project_id: 'project-dbr77-cx', title: 'Chatbot NLP training', description: 'Train NLP models for customer service chatbot', status: 'in_progress', priority: 'medium', progress: 80 },
    { project_id: 'project-dbr77-cx', title: 'Omnichannel routing setup', description: 'Configure omnichannel routing in Service Cloud', status: 'in_progress', priority: 'high', progress: 40 },
    { project_id: 'project-dbr77-cx', title: 'Mobile app redesign', description: 'Redesign mobile application with new UX', status: 'in_progress', priority: 'medium', progress: 50 },
    { project_id: 'project-dbr77-cx', title: 'Customer journey mapping', description: 'Map all customer journey touchpoints', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-cx', title: 'Voice of Customer analysis', description: 'Analyze NPS and CSAT feedback for improvement areas', status: 'in_progress', priority: 'medium', progress: 70 },
    // Operational Excellence tasks
    { project_id: 'project-dbr77-opex', title: 'Lean assessment workshop', description: 'Conduct Lean maturity assessment workshops', status: 'completed', priority: 'medium', progress: 100 },
    { project_id: 'project-dbr77-opex', title: 'Value stream mapping', description: 'Map value streams for key processes', status: 'in_progress', priority: 'high', progress: 30 },
    { project_id: 'project-dbr77-opex', title: 'Supply chain diagnostic', description: 'Conduct supply chain diagnostic analysis', status: 'todo', priority: 'high', progress: 0 },
    { project_id: 'project-dbr77-opex', title: 'Demand forecasting POC', description: 'Proof of concept for ML demand forecasting', status: 'todo', priority: 'medium', progress: 0 },
    { project_id: 'project-dbr77-opex', title: 'Process waste identification', description: 'Identify and document process waste across operations', status: 'in_progress', priority: 'high', progress: 45 },
    // Smart Factory tasks
    { project_id: 'project-dbr77-smart', title: 'IoT infrastructure assessment', description: 'Assess current infrastructure readiness for IoT deployment', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-smart', title: 'Sensor vendor selection', description: 'Evaluate and select IoT sensor vendors', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-smart', title: 'Network infrastructure upgrade', description: 'Upgrade factory network for IoT traffic', status: 'in_progress', priority: 'high', progress: 60 },
    { project_id: 'project-dbr77-smart', title: 'Pilot line sensor deployment', description: 'Deploy sensors on pilot production line', status: 'in_progress', priority: 'high', progress: 40 },
    { project_id: 'project-dbr77-smart', title: 'Edge computing setup', description: 'Set up edge computing infrastructure', status: 'in_progress', priority: 'medium', progress: 25 },
    { project_id: 'project-dbr77-smart', title: 'Digital twin vendor evaluation', description: 'Evaluate digital twin platform vendors', status: 'todo', priority: 'medium', progress: 0 }
];

// ============================================
// FINANCIAL ANALYSES
// ============================================
const financialAnalyses = [
    {
        id: uuidv4(),
        initiative_id: null,
        initial_investment: 400000,
        implementation_cost: 150000,
        annual_operating_cost: 120000,
        training_cost: 30000,
        contingency_percent: 15,
        annual_cost_savings: 450000,
        annual_revenue_increase: 0,
        productivity_gains_percent: 25,
        risk_reduction_value: 100000,
        implementation_months: 12,
        benefit_realization_months: 3,
        analysis_horizon_years: 5,
        discount_rate: 10,
        npv: 1250000,
        irr: 42,
        payback_months: 15,
        roi_percent: 275,
        currency: 'EUR',
        assumptions: JSON.stringify([
            'RPA licenses cost €2,500/bot/year',
            'Each bot saves 4 FTE hours daily',
            'Implementation partner rate €150/hour',
            '10% annual growth in automation scope'
        ])
    },
    {
        id: uuidv4(),
        initiative_id: null,
        initial_investment: 300000,
        implementation_cost: 200000,
        annual_operating_cost: 200000,
        training_cost: 50000,
        contingency_percent: 20,
        annual_cost_savings: 280000,
        annual_revenue_increase: 0,
        productivity_gains_percent: 35,
        risk_reduction_value: 50000,
        implementation_months: 18,
        benefit_realization_months: 6,
        analysis_horizon_years: 5,
        discount_rate: 10,
        npv: 580000,
        irr: 28,
        payback_months: 24,
        roi_percent: 160,
        currency: 'EUR',
        assumptions: JSON.stringify([
            'AWS/Azure reserved instance savings of 40%',
            'Reduction of 3 on-premise servers monthly',
            'DevOps labor savings of €80,000/year',
            'Disaster recovery improvements'
        ])
    },
    {
        id: uuidv4(),
        initiative_id: null,
        initial_investment: 350000,
        implementation_cost: 100000,
        annual_operating_cost: 100000,
        training_cost: 25000,
        contingency_percent: 15,
        annual_cost_savings: 150000,
        annual_revenue_increase: 200000,
        productivity_gains_percent: 15,
        risk_reduction_value: 0,
        implementation_months: 12,
        benefit_realization_months: 4,
        analysis_horizon_years: 5,
        discount_rate: 10,
        npv: 720000,
        irr: 35,
        payback_months: 18,
        roi_percent: 200,
        currency: 'EUR',
        assumptions: JSON.stringify([
            'Customer retention improvement of 5%',
            'Service call reduction of 30%',
            'First contact resolution increase to 85%',
            'Agent handle time reduction of 20%'
        ])
    },
    {
        id: uuidv4(),
        initiative_id: null,
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
    }
];

// ============================================
// STATUS REPORTS
// ============================================
const statusReports = [
    {
        id: uuidv4(),
        project_id: 'project-dbr77-dt2025',
        period_type: 'WEEKLY',
        period_start: '2025-01-13',
        period_end: '2025-01-19',
        period_label: 'Week 3, 2025',
        overall_status: 'GREEN',
        overall_trend: 'IMPROVING',
        executive_summary: 'Digital Transformation program is progressing well. RPA Wave 1 is 70% complete with 11 of 15 bots in production. Cloud migration on track with Landing Zone fully operational.',
        accomplishments: JSON.stringify([
            'Completed SAP integration for 4 additional RPA bots',
            'AWS EKS cluster fully operational',
            'Data lake architecture approved by security team',
            'ML model accuracy reached 94% for invoice classification'
        ]),
        next_steps: JSON.stringify([
            'Complete remaining 4 RPA bots by end of January',
            'Begin Wave 2 process analysis',
            'Start application modernization for legacy systems',
            'Deploy first BI dashboards to pilot users'
        ]),
        escalations: JSON.stringify([
            'Need additional cloud architect capacity for application modernization'
        ]),
        progress_percent: 55,
        budget_consumed_percent: 48,
        tasks_completed: 28,
        tasks_total: 52,
        open_risks: 5,
        open_issues: 3,
        pending_decisions: 2,
        generation_method: 'AI_ASSISTED',
        status: 'PUBLISHED'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-cx',
        period_type: 'WEEKLY',
        period_start: '2025-01-13',
        period_end: '2025-01-19',
        period_label: 'Week 3, 2025',
        overall_status: 'AMBER',
        overall_trend: 'STABLE',
        executive_summary: 'Customer Experience program facing minor delays in Salesforce data migration. Chatbot pilot showing excellent results with 72% deflection rate.',
        accomplishments: JSON.stringify([
            'Chatbot pilot launched with 72% query deflection',
            'Mobile app UX redesign approved',
            'Customer journey mapping completed',
            'Service Cloud configuration 65% complete'
        ]),
        next_steps: JSON.stringify([
            'Resolve data migration blockers',
            'Expand chatbot to additional product categories',
            'Begin omnichannel routing implementation',
            'Launch personalization engine POC'
        ]),
        escalations: JSON.stringify([
            'Data quality issues in legacy CRM causing migration delays',
            'Need executive decision on social media channel prioritization'
        ]),
        progress_percent: 48,
        budget_consumed_percent: 42,
        tasks_completed: 18,
        tasks_total: 38,
        open_risks: 4,
        open_issues: 5,
        pending_decisions: 3,
        generation_method: 'AI_ASSISTED',
        status: 'PUBLISHED'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-opex',
        period_type: 'MONTHLY',
        period_start: '2024-12-01',
        period_end: '2024-12-31',
        period_label: 'December 2024',
        overall_status: 'GREEN',
        overall_trend: 'STABLE',
        executive_summary: 'Operational Excellence program completed discovery phase. Lean assessment identified €2.4M annual savings opportunity. Value stream mapping 30% complete.',
        accomplishments: JSON.stringify([
            'Lean maturity assessment completed across 5 sites',
            'Identified 47 waste reduction opportunities',
            'Supply chain diagnostic scope defined',
            'Demand forecasting vendor shortlist finalized'
        ]),
        next_steps: JSON.stringify([
            'Complete value stream mapping for top 3 processes',
            'Launch supply chain diagnostic',
            'Begin demand forecasting POC',
            'Develop improvement roadmap'
        ]),
        escalations: JSON.stringify([]),
        progress_percent: 22,
        budget_consumed_percent: 15,
        tasks_completed: 8,
        tasks_total: 35,
        open_risks: 3,
        open_issues: 1,
        pending_decisions: 2,
        generation_method: 'MANUAL',
        status: 'APPROVED'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-smart',
        period_type: 'MONTHLY',
        period_start: '2024-12-01',
        period_end: '2024-12-31',
        period_label: 'December 2024',
        overall_status: 'GREEN',
        overall_trend: 'IMPROVING',
        executive_summary: 'Smart Factory initiative progressing ahead of schedule. IoT sensor vendor selected and pilot line deployment underway. Network upgrade 60% complete.',
        accomplishments: JSON.stringify([
            'Selected Siemens as primary IoT sensor vendor',
            'Network infrastructure assessment completed',
            'Edge computing architecture approved',
            'Pilot production line identified and prepared'
        ]),
        next_steps: JSON.stringify([
            'Complete network upgrade on pilot line',
            'Deploy first 200 sensors',
            'Configure data ingestion pipeline',
            'Begin digital twin vendor evaluation'
        ]),
        escalations: JSON.stringify([]),
        progress_percent: 28,
        budget_consumed_percent: 22,
        tasks_completed: 12,
        tasks_total: 42,
        open_risks: 4,
        open_issues: 2,
        pending_decisions: 1,
        generation_method: 'MANUAL',
        status: 'PUBLISHED'
    }
];

// ============================================
// DECISIONS
// ============================================
const decisions = [
    { project_id: 'project-dbr77-dt2025', decision_type: 'TECHNOLOGY', title: 'RPA Platform Selection: UiPath', description: 'Decision to select UiPath as the primary RPA platform', status: 'APPROVED', priority: 'HIGH', outcome: 'UiPath Enterprise selected as RPA platform', rationale: 'Best POC results, SAP integration, enterprise features' },
    { project_id: 'project-dbr77-dt2025', decision_type: 'STRATEGY', title: 'Multi-Cloud Strategy: AWS + Azure', description: 'Strategic decision on multi-cloud approach', status: 'APPROVED', priority: 'HIGH', outcome: 'Multi-cloud strategy adopted', rationale: 'Vendor lock-in reduction, best-of-breed services' },
    { project_id: 'project-dbr77-dt2025', decision_type: 'BUDGET', title: 'Cloud Migration Budget Increase', description: 'Request for additional security compliance budget', status: 'PENDING', priority: 'HIGH', outcome: null, rationale: 'Unplanned compliance requirements discovered' },
    { project_id: 'project-dbr77-dt2025', decision_type: 'VENDOR', title: 'Snowflake for Data Warehouse', description: 'Selection of Snowflake as enterprise data warehouse', status: 'APPROVED', priority: 'HIGH', outcome: 'Snowflake selected', rationale: 'Superior performance, usage-based pricing, ecosystem' },
    { project_id: 'project-dbr77-cx', decision_type: 'VENDOR', title: 'Salesforce CRM Selection', description: 'Decision to migrate to Salesforce', status: 'APPROVED', priority: 'HIGH', outcome: 'Salesforce Cloud selected', rationale: 'Better UX, ecosystem, AI capabilities' },
    { project_id: 'project-dbr77-cx', decision_type: 'SCOPE', title: 'Social Media in Omnichannel Phase 1', description: 'Scope expansion to include social media', status: 'APPROVED', priority: 'MEDIUM', outcome: 'Facebook, Instagram, Twitter included', rationale: '40% of customers prefer social channels' },
    { project_id: 'project-dbr77-cx', decision_type: 'GO_LIVE', title: 'Chatbot Go-Live Delay', description: 'Delay chatbot go-live by 2 weeks', status: 'APPROVED', priority: 'HIGH', outcome: 'New date: February 15, 2025', rationale: 'UAT revealed 15% false positive rate' },
    { project_id: 'project-dbr77-cx', decision_type: 'TECHNOLOGY', title: 'Personalization Engine Platform', description: 'Selection of Adobe Experience Platform for personalization', status: 'PENDING', priority: 'HIGH', outcome: null, rationale: 'Evaluating Adobe vs Salesforce Marketing Cloud' },
    { project_id: 'project-dbr77-opex', decision_type: 'STRATEGY', title: 'Lean vs Six Sigma Approach', description: 'Choice of dominant improvement methodology', status: 'APPROVED', priority: 'MEDIUM', outcome: 'Lean as primary methodology', rationale: 'Faster results, better cultural fit' },
    { project_id: 'project-dbr77-opex', decision_type: 'RESOURCE', title: 'External Lean Consultant', description: 'External consultant vs internal resources', status: 'PENDING', priority: 'MEDIUM', outcome: null, rationale: 'Lack of internal Lean expertise' },
    { project_id: 'project-dbr77-smart', decision_type: 'VENDOR', title: 'IoT Sensor Vendor: Siemens', description: 'Selection of Siemens as primary IoT sensor vendor', status: 'APPROVED', priority: 'HIGH', outcome: 'Siemens Industrial IoT selected', rationale: 'Best integration with existing PLCs, support quality' },
    { project_id: 'project-dbr77-smart', decision_type: 'TECHNOLOGY', title: 'Edge vs Cloud Processing', description: 'Architecture decision on data processing location', status: 'APPROVED', priority: 'HIGH', outcome: 'Hybrid edge-cloud architecture', rationale: 'Latency requirements for real-time alerts' }
];

// ============================================
// MATURITY ASSESSMENTS
// ============================================
const maturityAssessments = [
    {
        id: uuidv4(),
        project_id: 'project-dbr77-dt2025',
        name: 'Digital Readiness Assessment Q4 2024',
        assessment_date: '2024-10-15',
        planning_score: 3.8,
        decision_score: 3.2,
        execution_score: 2.9,
        monitoring_score: 3.5,
        collaboration_score: 3.4,
        overall_as_is: 3.36,
        overall_to_be: 4.5,
        overall_gap: 1.14,
        overall_score: 3.36,
        is_complete: 1,
        assessment_status: 'COMPLETED',
        gap_analysis_summary: 'Organization shows "Developing" maturity level (3.36/5). Main gaps identified in Execution (2.9) and Decision Making (3.2). Recommended actions: strengthen delivery capability, improve decision processes.',
        axis_scores: JSON.stringify([
            { axis: 'planning', as_is: 3.8, to_be: 4.5, gap: 0.7, weight: 1.0 },
            { axis: 'decision', as_is: 3.2, to_be: 4.5, gap: 1.3, weight: 1.0 },
            { axis: 'execution', as_is: 2.9, to_be: 4.5, gap: 1.6, weight: 1.0 },
            { axis: 'monitoring', as_is: 3.5, to_be: 4.5, gap: 1.0, weight: 1.0 },
            { axis: 'collaboration', as_is: 3.4, to_be: 4.5, gap: 1.1, weight: 1.0 }
        ]),
        is_approved: 1
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-cx',
        name: 'Customer Experience Maturity Assessment',
        assessment_date: '2024-11-01',
        planning_score: 3.5,
        decision_score: 3.0,
        execution_score: 3.2,
        monitoring_score: 2.8,
        collaboration_score: 3.6,
        overall_as_is: 3.22,
        overall_to_be: 4.2,
        overall_gap: 0.98,
        overall_score: 3.22,
        is_complete: 1,
        assessment_status: 'COMPLETED',
        gap_analysis_summary: 'CX program is at "Developing" stage with strong cross-departmental collaboration (3.6). Main gap in Monitoring (2.8) - lack of integrated CX metrics. Priority: implement Customer Analytics Platform.',
        axis_scores: JSON.stringify([
            { axis: 'planning', as_is: 3.5, to_be: 4.2, gap: 0.7 },
            { axis: 'decision', as_is: 3.0, to_be: 4.2, gap: 1.2 },
            { axis: 'execution', as_is: 3.2, to_be: 4.2, gap: 1.0 },
            { axis: 'monitoring', as_is: 2.8, to_be: 4.2, gap: 1.4 },
            { axis: 'collaboration', as_is: 3.6, to_be: 4.2, gap: 0.6 }
        ]),
        is_approved: 1
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-opex',
        name: 'Operational Excellence Baseline Assessment',
        assessment_date: '2024-12-01',
        planning_score: 2.8,
        decision_score: 2.5,
        execution_score: 2.6,
        monitoring_score: 2.4,
        collaboration_score: 2.9,
        overall_as_is: 2.64,
        overall_to_be: 4.0,
        overall_gap: 1.36,
        overall_score: 2.64,
        is_complete: 1,
        assessment_status: 'COMPLETED',
        gap_analysis_summary: 'Operational Excellence program starting from "Initial" level (2.64/5). All areas require significant improvements. Largest gaps: Monitoring (2.4) and Decision (2.5). Plan: 18-month transformation roadmap.',
        axis_scores: JSON.stringify([
            { axis: 'planning', as_is: 2.8, to_be: 4.0, gap: 1.2 },
            { axis: 'decision', as_is: 2.5, to_be: 4.0, gap: 1.5 },
            { axis: 'execution', as_is: 2.6, to_be: 4.0, gap: 1.4 },
            { axis: 'monitoring', as_is: 2.4, to_be: 4.0, gap: 1.6 },
            { axis: 'collaboration', as_is: 2.9, to_be: 4.0, gap: 1.1 }
        ]),
        is_approved: 0
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-smart',
        name: 'Industry 4.0 Readiness Assessment',
        assessment_date: '2024-11-15',
        planning_score: 3.2,
        decision_score: 3.5,
        execution_score: 2.8,
        monitoring_score: 2.6,
        collaboration_score: 3.3,
        overall_as_is: 3.08,
        overall_to_be: 4.5,
        overall_gap: 1.42,
        overall_score: 3.08,
        is_complete: 1,
        assessment_status: 'COMPLETED',
        gap_analysis_summary: 'Smart Factory initiative baseline at "Developing" level (3.08/5). Strong decision-making culture (3.5) but gaps in technical execution (2.8) and monitoring capabilities (2.6). Focus on IoT infrastructure first.',
        axis_scores: JSON.stringify([
            { axis: 'planning', as_is: 3.2, to_be: 4.5, gap: 1.3 },
            { axis: 'decision', as_is: 3.5, to_be: 4.5, gap: 1.0 },
            { axis: 'execution', as_is: 2.8, to_be: 4.5, gap: 1.7 },
            { axis: 'monitoring', as_is: 2.6, to_be: 4.5, gap: 1.9 },
            { axis: 'collaboration', as_is: 3.3, to_be: 4.5, gap: 1.2 }
        ]),
        is_approved: 1
    }
];

// ============================================
// SEED EXECUTION
// ============================================
async function seed() {
    console.log('🚀 Starting DBR77 English Complete Seed...\n');

    try {
        // 1. Projects
        console.log('📁 Processing projects...');
        for (const p of projects) {
            await run(`
                INSERT INTO projects (id, organization_id, name, description, status, phase, budget, currency, priority, start_date, end_date, owner_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    description = excluded.description,
                    status = excluded.status,
                    phase = excluded.phase,
                    budget = excluded.budget,
                    priority = excluded.priority,
                    updated_at = datetime('now')
            `, [p.id, ORG_ID, p.name, p.description, p.status, p.phase, p.budget, p.currency, p.priority, p.start_date, p.end_date, USER_ID]);
        }
        console.log(`   ✅ ${projects.length} projects`);

        // 2. Initiatives
        console.log('💡 Inserting initiatives...');
        for (const i of initiatives) {
            await run(`
                INSERT INTO initiatives (id, organization_id, project_id, name, summary, status, current_stage, axis, area, hypothesis, problem_statement, deliverables, success_criteria, business_value, cost_capex, cost_opex, expected_roi, social_impact, owner_business_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [i.id, ORG_ID, i.project_id, i.name, i.summary, i.status, i.current_stage, i.axis, i.area, i.hypothesis || '', i.problem_statement || '', i.deliverables || '[]', i.success_criteria || '[]', i.business_value, i.cost_capex, i.cost_opex, i.expected_roi, i.value_driver || '', USER_ID]);
        }
        console.log(`   ✅ ${initiatives.length} initiatives`);

        // 3. Tasks
        console.log('✅ Inserting tasks...');
        for (const t of tasks) {
            await run(`
                INSERT INTO tasks (id, organization_id, project_id, title, description, status, priority, progress, assignee_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [uuidv4(), ORG_ID, t.project_id, t.title, t.description, t.status, t.priority, t.progress, USER_ID]);
        }
        console.log(`   ✅ ${tasks.length} tasks`);

        // 4. Maturity Assessments
        console.log('📊 Inserting maturity assessments...');
        for (const a of maturityAssessments) {
            await run(`
                INSERT INTO maturity_assessments (id, project_id, axis_scores, overall_as_is, overall_to_be, overall_gap, is_complete, assessment_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [a.id, a.project_id, a.axis_scores, a.overall_as_is, a.overall_to_be, a.overall_gap, a.is_complete, a.assessment_status]);
        }
        console.log(`   ✅ ${maturityAssessments.length} assessments`);

        // 5. Decisions
        console.log('🎯 Inserting decisions...');
        for (const d of decisions) {
            await run(`
                INSERT INTO decisions (id, organization_id, project_id, title, description, outcome, decision_owner_id, priority, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [uuidv4(), ORG_ID, d.project_id, d.title, d.description, d.outcome, USER_ID, d.priority, d.status === 'APPROVED' ? 'approved' : 'pending']);
        }
        console.log(`   ✅ ${decisions.length} decisions`);

        // 6. Financial Analyses
        console.log('💰 Inserting financial analyses...');
        for (const f of financialAnalyses) {
            const analysisId = uuidv4();
            await run(`
                INSERT OR REPLACE INTO analysis_financials (
                    id, analysis_id, initiative_id, organization_id,
                    initial_investment, implementation_cost, annual_operating_cost, training_cost, contingency_percent,
                    annual_cost_savings, annual_revenue_increase, productivity_gains_percent, risk_reduction_value,
                    implementation_months, benefit_realization_months, analysis_horizon_years, discount_rate,
                    npv, irr, payback_months, roi_percent, currency, assumptions,
                    created_by, created_at, updated_at, last_calculated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
            `, [
                f.id, analysisId, f.initiative_id, ORG_ID,
                f.initial_investment, f.implementation_cost, f.annual_operating_cost, f.training_cost, f.contingency_percent,
                f.annual_cost_savings, f.annual_revenue_increase, f.productivity_gains_percent, f.risk_reduction_value,
                f.implementation_months, f.benefit_realization_months, f.analysis_horizon_years, f.discount_rate,
                f.npv, f.irr, f.payback_months, f.roi_percent, f.currency, f.assumptions,
                USER_ID
            ]);
        }
        console.log(`   ✅ ${financialAnalyses.length} financial analyses`);

        // 7. Status Reports
        console.log('📋 Inserting status reports...');
        for (const r of statusReports) {
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
        console.log(`   ✅ ${statusReports.length} status reports`);

        console.log('\n✨ DBR77 English Complete Seed finished successfully!');
        console.log('\n📈 Summary:');
        console.log(`   - Projects: ${projects.length}`);
        console.log(`   - Initiatives: ${initiatives.length}`);
        console.log(`   - Tasks: ${tasks.length}`);
        console.log(`   - Assessments: ${maturityAssessments.length}`);
        console.log(`   - Decisions: ${decisions.length}`);
        console.log(`   - Financial Analyses: ${financialAnalyses.length}`);
        console.log(`   - Status Reports: ${statusReports.length}`);

    } catch (error) {
        console.error('❌ Error during seed:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

seed();
