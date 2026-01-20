/**
 * SEED: Pełne dane demo dla DBR77
 * 
 * Uruchom z głównego katalogu: node server/seed/seed_dbr77_full_demo.js
 */

import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'consultinity.db');

const db = new sqlite3.Database(dbPath);

// Helper do promisify
const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// ============================================
// KONFIGURACJA
// ============================================
const ORG_ID = 'org-dbr77-system';
const USER_ID = 'user-dbr77-admin';

// ============================================
// PROJEKTY
// ============================================
const projects = [
    {
        id: 'project-dbr77-001',
        name: 'Digital Transformation 2025',
        description: 'Kompleksowy program transformacji cyfrowej obejmujący automatyzację procesów, wdrożenie AI i modernizację infrastruktury IT. Cel: zwiększenie efektywności operacyjnej o 40% i redukcja kosztów o 25%.',
        status: 'active',
        phase: 'execution',
        budget: 2500000,
        currency: 'PLN',
        priority: 'high',
        start_date: '2024-01-15',
        end_date: '2025-12-31'
    },
    {
        id: 'project-dbr77-002',
        name: 'Customer Experience Revolution',
        description: 'Modernizacja wszystkich punktów styku z klientem. Wdrożenie omnichannel, personalizacji AI, chatbotów i nowego CRM. Oczekiwany wzrost NPS o 30 punktów.',
        status: 'active',
        phase: 'pilot',
        budget: 1200000,
        currency: 'PLN',
        priority: 'high',
        start_date: '2024-06-01',
        end_date: '2025-06-30'
    },
    {
        id: 'project-dbr77-003',
        name: 'Operational Excellence Program',
        description: 'Program ciągłego doskonalenia operacyjnego oparty na Lean i Six Sigma. Optymalizacja łańcucha dostaw, automatyzacja backoffice, redukcja waste.',
        status: 'active',
        phase: 'planning',
        budget: 800000,
        currency: 'PLN',
        priority: 'medium',
        start_date: '2024-09-01',
        end_date: '2026-03-31'
    }
];

// ============================================
// INICJATYWY (pełne dane)
// ============================================
const initiatives = [
    // Digital Transformation 2025
    {
        id: uuidv4(),
        project_id: 'project-dbr77-001',
        name: 'AI-Powered Process Automation',
        title: 'Automatyzacja procesów z wykorzystaniem AI',
        description: 'Wdrożenie inteligentnej automatyzacji procesów biznesowych wykorzystującej Machine Learning do optymalizacji workflow, predykcji i automatycznego podejmowania decyzji w standardowych przypadkach.',
        summary: 'Automatyzacja 50+ procesów biznesowych z wykorzystaniem RPA i AI',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 65,
        axis: 'operational',
        area: 'Operations',
        hypothesis: 'Automatyzacja procesów z AI pozwoli zredukować czas obsługi o 60% i błędy ludzkie o 90%',
        problem_statement: 'Manualne procesy są czasochłonne, podatne na błędy i nie skalują się wraz ze wzrostem firmy',
        deliverables: JSON.stringify(['Platforma RPA zintegrowana z systemami ERP/CRM', 'Modele ML do klasyfikacji dokumentów', 'Dashboard monitoringu procesów', 'Dokumentacja i szkolenia']),
        success_criteria: JSON.stringify(['Redukcja czasu procesowania o 60%', 'Redukcja błędów o 90%', 'ROI > 200% w ciągu 18 miesięcy', 'Automatyzacja min. 50 procesów']),
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
        project_id: 'project-dbr77-001',
        name: 'Cloud Migration & Modernization',
        title: 'Migracja do chmury i modernizacja infrastruktury',
        description: 'Kompleksowa migracja infrastruktury on-premise do chmury hybrydowej AWS/Azure z modernizacją aplikacji do architektury mikroserwisowej i konteneryzacji.',
        summary: 'Migracja 80% workloadów do chmury i modernizacja kluczowych aplikacji',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 45,
        axis: 'technology',
        area: 'IT Infrastructure',
        hypothesis: 'Migracja do chmury zredukuje koszty infrastruktury o 35% i zwiększy elastyczność',
        business_value: 800000,
        cost_capex: 300000,
        cost_opex: 200000,
        expected_roi: 160,
        value_driver: 'Cost Reduction',
        current_stage: 'pilot'
    },
    {
        id: uuidv4(),
        project_id: 'project-dbr77-001',
        name: 'Data Analytics Platform',
        title: 'Platforma analityki danych i Business Intelligence',
        description: 'Budowa centralnej platformy danych z data lake, narzędziami BI, self-service analytics i predykcyjnymi modelami AI dla wszystkich działów.',
        summary: 'Centralna platforma danych z AI-powered analytics',
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
        project_id: 'project-dbr77-001',
        name: 'Cybersecurity Enhancement',
        title: 'Wzmocnienie cyberbezpieczeństwa',
        description: 'Kompleksowy program wzmocnienia bezpieczeństwa: Zero Trust Architecture, SOC 24/7, SIEM/SOAR, testy penetracyjne i szkolenia pracowników.',
        summary: 'Zero Trust security z SOC 24/7',
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
        project_id: 'project-dbr77-002',
        name: 'Omnichannel Customer Platform',
        title: 'Platforma omnichannel obsługi klienta',
        description: 'Wdrożenie zintegrowanej platformy omnichannel łączącej wszystkie kanały kontaktu: web, mobile, call center, chat, email, social media z jednym widokiem klienta.',
        summary: 'Jeden widok klienta we wszystkich kanałach',
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
        project_id: 'project-dbr77-002',
        name: 'AI Customer Service Chatbot',
        title: 'Inteligentny chatbot obsługi klienta',
        description: 'Wdrożenie zaawansowanego chatbota AI z NLP, który obsłuży 70% zapytań Tier 1, z płynnym przekazaniem do agenta gdy potrzebne.',
        summary: 'AI chatbot obsługujący 70% zapytań Tier 1',
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
        project_id: 'project-dbr77-002',
        name: 'Personalization Engine',
        title: 'Silnik personalizacji AI',
        description: 'Wdrożenie AI-powered recommendation engine do personalizacji oferty, komunikacji i doświadczeń klienta w czasie rzeczywistym.',
        summary: 'Real-time personalizacja z AI',
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
        project_id: 'project-dbr77-002',
        name: 'New CRM Implementation',
        title: 'Wdrożenie nowego CRM Salesforce',
        description: 'Migracja z legacy CRM do Salesforce z pełną customizacją, integracją z wszystkimi systemami i wdrożeniem Sales Cloud, Service Cloud i Marketing Cloud.',
        summary: 'Salesforce CRM dla 500+ użytkowników',
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
        project_id: 'project-dbr77-003',
        name: 'Supply Chain Optimization',
        title: 'Optymalizacja łańcucha dostaw',
        description: 'Wdrożenie AI-powered supply chain planning, demand forecasting i inventory optimization z integracją z dostawcami.',
        summary: 'AI-powered supply chain z demand forecasting',
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
        project_id: 'project-dbr77-003',
        name: 'Backoffice Automation',
        title: 'Automatyzacja backoffice',
        description: 'Automatyzacja procesów backoffice: AP/AR, reconciliation, reporting, compliance z wykorzystaniem RPA i workflow automation.',
        summary: 'RPA dla finance i HR backoffice',
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
        project_id: 'project-dbr77-003',
        name: 'Quality Management System',
        title: 'System zarządzania jakością',
        description: 'Wdrożenie cyfrowego QMS z automatyczną kontrolą jakości, SPC, root cause analysis i continuous improvement tracking.',
        summary: 'Cyfrowy QMS z automated quality control',
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
    }
];

// ============================================
// MATURITY ASSESSMENTS (Oceny DRD)
// ============================================
const maturityAssessments = [
    {
        id: uuidv4(),
        project_id: 'project-dbr77-001',
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
        gap_analysis_summary: 'Organizacja wykazuje dojrzałość na poziomie "Developing" (3.36/5). Główne luki zidentyfikowano w obszarze Execution (2.9) i Decision Making (3.2). Rekomendowane działania: wzmocnienie capability delivery, usprawnienie procesów decyzyjnych.',
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
        project_id: 'project-dbr77-002',
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
        gap_analysis_summary: 'Program CX jest na etapie "Developing" z silną kolaboracją międzydziałową (3.6). Główna luka w Monitoring (2.8) - brak zintegrowanych metryk CX. Priorytet: wdrożenie Customer Analytics Platform.',
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
        project_id: 'project-dbr77-003',
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
        gap_analysis_summary: 'Program Operational Excellence rozpoczyna się z poziomu "Initial" (2.64/5). Wszystkie obszary wymagają znaczących usprawnień. Największe luki: Monitoring (2.4) i Decision (2.5). Plan: 18-miesięczna roadmapa transformacji.',
        axis_scores: JSON.stringify([
            { axis: 'planning', as_is: 2.8, to_be: 4.0, gap: 1.2 },
            { axis: 'decision', as_is: 2.5, to_be: 4.0, gap: 1.5 },
            { axis: 'execution', as_is: 2.6, to_be: 4.0, gap: 1.4 },
            { axis: 'monitoring', as_is: 2.4, to_be: 4.0, gap: 1.6 },
            { axis: 'collaboration', as_is: 2.9, to_be: 4.0, gap: 1.1 }
        ]),
        is_approved: 0
    }
];

// ============================================
// TASKS (Zadania)
// ============================================
const tasks = [
    { project_id: 'project-dbr77-001', title: 'Analiza procesów do automatyzacji', description: 'Przeprowadzić audyt 100+ procesów i wybrać top 50 do automatyzacji RPA', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-001', title: 'Wybór platformy RPA', description: 'Ewaluacja UiPath, Automation Anywhere, Power Automate - POC', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-001', title: 'Rozwój botów RPA Wave 1', description: 'Implementacja 15 botów RPA dla procesów finance', status: 'in_progress', priority: 'high', progress: 70 },
    { project_id: 'project-dbr77-001', title: 'Integracja RPA z SAP', description: 'Połączenie botów z SAP ERP via API/UI automation', status: 'in_progress', priority: 'high', progress: 45 },
    { project_id: 'project-dbr77-001', title: 'Training ML models', description: 'Przygotowanie i trening modeli do klasyfikacji faktur i dokumentów', status: 'in_progress', priority: 'medium', progress: 60 },
    { project_id: 'project-dbr77-001', title: 'UAT dla botów Wave 1', description: 'User Acceptance Testing dla pierwszych 15 botów', status: 'todo', priority: 'high', progress: 0 },
    { project_id: 'project-dbr77-001', title: 'AWS Landing Zone setup', description: 'Konfiguracja multi-account AWS organization z Control Tower', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-001', title: 'Network architecture design', description: 'Projekt sieci hybrydowej AWS-Azure-OnPrem', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-001', title: 'Migracja aplikacji Wave 1', description: 'Lift & shift 20 aplikacji do AWS EC2/ECS', status: 'in_progress', priority: 'high', progress: 55 },
    { project_id: 'project-dbr77-001', title: 'Kubernetes cluster setup', description: 'Konfiguracja EKS dla aplikacji kontenerowych', status: 'in_progress', priority: 'medium', progress: 80 },
    { project_id: 'project-dbr77-002', title: 'Salesforce implementation kick-off', description: 'Uruchomienie projektu wdrożenia Salesforce', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-002', title: 'Data migration plan', description: 'Plan migracji danych z legacy CRM do Salesforce', status: 'completed', priority: 'high', progress: 100 },
    { project_id: 'project-dbr77-002', title: 'Salesforce Sales Cloud config', description: 'Konfiguracja Sales Cloud z custom objects', status: 'in_progress', priority: 'high', progress: 65 },
    { project_id: 'project-dbr77-002', title: 'Chatbot NLP training', description: 'Trening modeli NLP dla chatbota obsługi klienta', status: 'in_progress', priority: 'medium', progress: 80 },
    { project_id: 'project-dbr77-002', title: 'Omnichannel routing setup', description: 'Konfiguracja routingu omnichannel w Service Cloud', status: 'in_progress', priority: 'high', progress: 40 },
    { project_id: 'project-dbr77-002', title: 'Mobile app redesign', description: 'Redesign aplikacji mobilnej z nowym UX', status: 'in_progress', priority: 'medium', progress: 50 },
    { project_id: 'project-dbr77-003', title: 'Lean assessment workshop', description: 'Warsztaty oceny dojrzałości Lean w organizacji', status: 'completed', priority: 'medium', progress: 100 },
    { project_id: 'project-dbr77-003', title: 'Value stream mapping', description: 'Mapowanie strumieni wartości dla kluczowych procesów', status: 'in_progress', priority: 'high', progress: 30 },
    { project_id: 'project-dbr77-003', title: 'Supply chain diagnostic', description: 'Analiza diagnostyczna łańcucha dostaw', status: 'todo', priority: 'high', progress: 0 },
    { project_id: 'project-dbr77-003', title: 'Demand forecasting POC', description: 'Proof of concept dla ML demand forecasting', status: 'todo', priority: 'medium', progress: 0 }
];

// ============================================
// DECISIONS (Decyzje)
// ============================================
const decisions = [
    { project_id: 'project-dbr77-001', decision_type: 'TECHNOLOGY', title: 'Wybór platformy RPA: UiPath', description: 'Decyzja o wyborze UiPath jako głównej platformy RPA', status: 'APPROVED', priority: 'HIGH', outcome: 'UiPath Enterprise wybrany jako platforma RPA', rationale: 'Najlepszy wynik POC, integracja z SAP' },
    { project_id: 'project-dbr77-001', decision_type: 'STRATEGY', title: 'Cloud strategy: Multi-cloud AWS + Azure', description: 'Strategiczna decyzja o podejściu multi-cloud', status: 'APPROVED', priority: 'HIGH', outcome: 'Przyjęto strategię multi-cloud', rationale: 'Redukcja vendor lock-in' },
    { project_id: 'project-dbr77-001', decision_type: 'BUDGET', title: 'Zwiększenie budżetu Cloud Migration', description: 'Request na dodatkowy budżet na security', status: 'PENDING', priority: 'HIGH', outcome: null, rationale: 'Nieplanowane wymagania compliance' },
    { project_id: 'project-dbr77-002', decision_type: 'VENDOR', title: 'Wybór Salesforce jako CRM', description: 'Decyzja o migracji do Salesforce', status: 'APPROVED', priority: 'HIGH', outcome: 'Salesforce Cloud wybrany', rationale: 'Lepsza UX, ecosystem' },
    { project_id: 'project-dbr77-002', decision_type: 'SCOPE', title: 'Social Media do Omnichannel Phase 1', description: 'Rozszerzenie scope o social media', status: 'APPROVED', priority: 'MEDIUM', outcome: 'FB, IG, Twitter włączone', rationale: '40% klientów preferuje social' },
    { project_id: 'project-dbr77-002', decision_type: 'GO_LIVE', title: 'Go-live Chatbota AI - przesunięcie', description: 'Przesunięcie go-live o 2 tygodnie', status: 'APPROVED', priority: 'HIGH', outcome: 'Nowa data: 15.02.2025', rationale: 'UAT wykazało 15% false positive' },
    { project_id: 'project-dbr77-003', decision_type: 'STRATEGY', title: 'Podejście Lean vs Six Sigma', description: 'Wybór dominującego podejścia', status: 'APPROVED', priority: 'MEDIUM', outcome: 'Lean jako primary', rationale: 'Lean szybsze efekty' },
    { project_id: 'project-dbr77-003', decision_type: 'RESOURCE', title: 'Zatrudnienie Lean Consultant', description: 'External consultant vs internal', status: 'PENDING', priority: 'MEDIUM', outcome: null, rationale: 'Brak wewnętrznych kompetencji' }
];

// ============================================
// WYKONANIE SEED
// ============================================
async function seed() {
    console.log('🚀 Starting DBR77 Full Demo Seed...\n');
    
    try {
        // 1. Update/Insert Projects
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

        // 2. Insert Initiatives
        console.log('💡 Inserting initiatives...');
        for (const i of initiatives) {
            await run(`
                INSERT INTO initiatives (id, organization_id, project_id, name, title, description, summary, status, priority, progress, axis, area, hypothesis, problem_statement, deliverables, success_criteria, business_value, cost_capex, cost_opex, expected_roi, value_driver, confidence_level, current_stage, owner_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [i.id, ORG_ID, i.project_id, i.name, i.title, i.description, i.summary, i.status, i.priority, i.progress, i.axis, i.area, i.hypothesis || '', i.problem_statement || '', i.deliverables || '[]', i.success_criteria || '[]', i.business_value, i.cost_capex, i.cost_opex, i.expected_roi, i.value_driver, i.confidence_level || 'medium', i.current_stage, USER_ID]);
        }
        console.log(`   ✅ ${initiatives.length} initiatives`);

        // 3. Insert Maturity Assessments
        console.log('📊 Inserting maturity assessments...');
        for (const a of maturityAssessments) {
            await run(`
                INSERT INTO maturity_assessments (id, organization_id, project_id, name, assessment_date, planning_score, decision_score, execution_score, monitoring_score, collaboration_score, overall_as_is, overall_to_be, overall_gap, overall_score, is_complete, assessment_status, gap_analysis_summary, axis_scores, is_approved, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [a.id, ORG_ID, a.project_id, a.name, a.assessment_date, a.planning_score, a.decision_score, a.execution_score, a.monitoring_score, a.collaboration_score, a.overall_as_is, a.overall_to_be, a.overall_gap, a.overall_score, a.is_complete, a.assessment_status, a.gap_analysis_summary, a.axis_scores, a.is_approved, USER_ID]);
        }
        console.log(`   ✅ ${maturityAssessments.length} assessments`);

        // 4. Insert Tasks
        console.log('✅ Inserting tasks...');
        for (const t of tasks) {
            await run(`
                INSERT INTO tasks (id, organization_id, project_id, title, description, status, priority, progress, assignee_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [uuidv4(), ORG_ID, t.project_id, t.title, t.description, t.status, t.priority, t.progress, USER_ID]);
        }
        console.log(`   ✅ ${tasks.length} tasks`);

        // 5. Insert Decisions
        console.log('🎯 Inserting decisions...');
        for (const d of decisions) {
            await run(`
                INSERT INTO decisions (id, project_id, decision_type, related_object_type, related_object_id, decision_owner_id, status, priority, title, description, outcome, rationale, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [uuidv4(), d.project_id, d.decision_type, 'initiative', uuidv4(), USER_ID, d.status, d.priority, d.title, d.description, d.outcome, d.rationale]);
        }
        console.log(`   ✅ ${decisions.length} decisions`);

        // 6. Insert User Preferences for Settings module
        console.log('⚙️ Inserting user preferences...');
        
        // Ensure user_preferences table exists
        await run(`
            CREATE TABLE IF NOT EXISTS user_preferences (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                preferences_type TEXT NOT NULL,
                preferences_data TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        `);

        const userPreferences = [
            { 
                type: 'regional', 
                data: { 
                    timezone: 'Europe/Warsaw', 
                    dateFormat: 'DD/MM/YYYY',
                    timeFormat: '24h',
                    firstDayOfWeek: 'monday',
                    language: 'pl'
                } 
            },
            { 
                type: 'notifications', 
                data: { 
                    email: true, 
                    push: true, 
                    digest: 'daily',
                    mentions: true,
                    taskAssigned: true,
                    taskDue: true,
                    weeklyReport: true
                } 
            },
            { 
                type: 'ai-instructions', 
                data: { 
                    systemPrompt: 'Bądź zwięzły i profesjonalny. Odpowiadaj po polsku, chyba że pytanie jest w innym języku. Skup się na praktycznych rozwiązaniach dla zarządzania projektami.',
                    responseStyle: 'balanced',
                    includeContext: true,
                    maxContextLength: 4000
                } 
            },
            { 
                type: 'ai-model', 
                data: { 
                    preferredModel: 'gpt-4', 
                    fallbackModel: 'gpt-3.5-turbo',
                    autoSelect: true,
                    preferSpeed: false,
                    preferQuality: true
                } 
            },
            { 
                type: 'ai-parameters', 
                data: { 
                    temperature: 0.7, 
                    maxTokens: 2048,
                    topP: 1,
                    frequencyPenalty: 0,
                    presencePenalty: 0,
                    streamResponse: true
                } 
            },
            { 
                type: 'ai-personality', 
                data: { 
                    tone: 'professional',
                    formality: 'balanced',
                    verbosity: 'concise',
                    creativity: 'moderate',
                    customInstructions: 'Używaj polskiej terminologii PMO. Odnosił się do metodyk PRINCE2 i PMBOK gdzie to stosowne.'
                } 
            },
            { 
                type: 'privacy', 
                data: { 
                    showOnlineStatus: true, 
                    profileVisibility: 'organization',
                    shareActivityWithAI: true,
                    allowAnalytics: true
                } 
            },
            { 
                type: 'accessibility', 
                data: { 
                    fontSize: 'medium', 
                    highContrastMode: false,
                    reduceMotion: false,
                    screenReaderOptimized: false
                } 
            },
            { 
                type: 'shortcuts', 
                data: { 
                    aiAssistant: 'cmd+j', 
                    search: 'cmd+k',
                    newTask: 'cmd+n',
                    settings: 'cmd+,'
                } 
            },
            {
                type: 'dashboard',
                data: {
                    defaultView: 'cards',
                    showRecentProjects: true,
                    showQuickActions: true,
                    widgetLayout: ['tasks', 'initiatives', 'decisions', 'calendar']
                }
            },
            {
                type: 'work-preferences',
                data: {
                    workingHours: { start: '09:00', end: '17:00' },
                    workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                    focusTime: { enabled: true, start: '10:00', end: '12:00' }
                }
            }
        ];

        for (const pref of userPreferences) {
            await run(`
                INSERT OR REPLACE INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [uuidv4(), USER_ID, pref.type, JSON.stringify(pref.data)]);
        }
        console.log(`   ✅ ${userPreferences.length} user preferences`);

        // 7. Insert Email Signatures
        console.log('✉️ Inserting email signatures...');
        
        await run(`
            CREATE TABLE IF NOT EXISTS email_signatures (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                is_default INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        `);

        const emailSignatures = [
            {
                name: 'Professional',
                content: '<p style="font-family: Arial, sans-serif;">Z poważaniem,<br><strong>Piotr Wiśniewski</strong><br>PMO Manager | DBR77<br>📧 piotr.wisniewski@dbr77.com<br>📱 +48 500 123 456</p>',
                isDefault: true
            },
            {
                name: 'Casual',
                content: '<p style="font-family: Arial, sans-serif;">Pozdrawiam,<br>Piotr W.</p>',
                isDefault: false
            },
            {
                name: 'Short',
                content: '<p>Best,<br>PW</p>',
                isDefault: false
            }
        ];

        for (const sig of emailSignatures) {
            await run(`
                INSERT OR REPLACE INTO email_signatures (id, user_id, name, content, is_default, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [uuidv4(), USER_ID, sig.name, sig.content, sig.isDefault ? 1 : 0]);
        }
        console.log(`   ✅ ${emailSignatures.length} email signatures`);

        // 8. Insert Settings Templates
        console.log('📋 Inserting settings templates...');
        
        await run(`
            CREATE TABLE IF NOT EXISTS settings_templates (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                icon TEXT DEFAULT '📋',
                type TEXT DEFAULT 'custom',
                settings_data TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        `);

        const settingsTemplates = [
            {
                name: 'Mój setup PMO',
                description: 'Osobista konfiguracja dla pracy PMO z pełną integracją AI',
                icon: '🎯',
                settingsData: {
                    ai: { enabled: true, model: 'gpt-4' },
                    notifications: { email: true, push: true },
                    dashboard: { defaultView: 'kanban' }
                }
            },
            {
                name: 'Focus Mode',
                description: 'Minimalne rozpraszanie - tryb głębokiej pracy',
                icon: '🧘',
                settingsData: {
                    notifications: { email: false, push: false },
                    ai: { autoSuggestions: false },
                    dnd: true
                }
            }
        ];

        for (const template of settingsTemplates) {
            await run(`
                INSERT OR REPLACE INTO settings_templates (id, user_id, name, description, icon, type, settings_data, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'custom', ?, datetime('now'), datetime('now'))
            `, [uuidv4(), USER_ID, template.name, template.description, template.icon, JSON.stringify(template.settingsData)]);
        }
        console.log(`   ✅ ${settingsTemplates.length} settings templates`);

        // 9. Insert Partner Organization Data
        console.log('🤝 Inserting partner organization data...');
        
        const PARTNER_ORG_ID = 'partner-org-dbr77';
        
        // Partner Organization
        await run(`
            INSERT OR REPLACE INTO partner_organizations (
                id, name, legal_name, tax_id, contact_email, contact_phone, website,
                program_type, tier, status, partner_since, referral_code, referral_link,
                license_discount_percent, commission_rate_percent, performance_score,
                public_listing_enabled, specializations, regions, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, [
            PARTNER_ORG_ID,
            'DBR77 Consulting Partners',
            'DBR77 Sp. z o.o.',
            'PL1234567890',
            'partner@dbr77.com',
            '+48 22 123 45 67',
            'https://dbr77.com',
            'SOLUTION_PARTNER',
            'GOLD',
            'active',
            '2024-01-15',
            'DBR77PARTNER',
            'https://app.consultinity.com/r/DBR77PARTNER',
            20,
            25,
            85,
            1,
            JSON.stringify(['DRD', 'SIRI', 'Lean 4.0', 'ISO 21500']),
            JSON.stringify(['CEE', 'DACH', 'Baltics'])
        ]);
        console.log('   ✅ Partner organization');

        // Partner Payout Account
        await run(`
            INSERT OR REPLACE INTO partner_payout_accounts (
                id, partner_org_id, method, account_name, iban, bic, is_verified, is_default, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, [
            uuidv4(),
            PARTNER_ORG_ID,
            'BANK_TRANSFER',
            'DBR77 Sp. z o.o.',
            'PL61109010140000071219812874',
            'WBKPPLPP',
            1,
            1
        ]);
        console.log('   ✅ Partner payout account');

        // Partner Campaign Links
        const campaignLinks = [
            { name: 'LinkedIn Campaign Q1', utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'partner-q1-2026' },
            { name: 'Blog Post - DRD Guide', utm_source: 'blog', utm_medium: 'content', utm_campaign: 'drd-guide' },
            { name: 'Email Newsletter', utm_source: 'email', utm_medium: 'newsletter', utm_campaign: 'jan-2026' }
        ];

        for (const link of campaignLinks) {
            await run(`
                INSERT OR REPLACE INTO partner_campaign_links (
                    id, partner_org_id, name, url, utm_source, utm_medium, utm_campaign, click_count, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [
                uuidv4(),
                PARTNER_ORG_ID,
                link.name,
                \`https://app.consultinity.com/?ref=DBR77PARTNER&utm_source=\${link.utm_source}&utm_medium=\${link.utm_medium}&utm_campaign=\${link.utm_campaign}\`,
                link.utm_source,
                link.utm_medium,
                link.utm_campaign,
                Math.floor(Math.random() * 200) + 50
            ]);
        }
        console.log(\`   ✅ \${campaignLinks.length} partner campaign links\`);

        // Partner Attributions (referred clients)
        const attributions = [
            { org_name: 'TechVentures Polska', status: 'converted', revenue: 24000, commission: 6000 },
            { org_name: 'Baltic Manufacturing', status: 'converted', revenue: 48000, commission: 12000 },
            { org_name: 'Nordic Solutions AB', status: 'trial', revenue: 0, commission: 0 },
            { org_name: 'Silesian Tech Hub', status: 'converted', revenue: 12000, commission: 3000 }
        ];

        for (const attr of attributions) {
            const attrId = uuidv4();
            const orgId = uuidv4();
            
            await run(`
                INSERT OR REPLACE INTO partner_attributions (
                    id, partner_org_id, client_org_id, client_name, attribution_type, status,
                    ltv_total, commission_earned, created_at, converted_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'), ?, datetime('now'))
            `, [
                attrId,
                PARTNER_ORG_ID,
                orgId,
                attr.org_name,
                'REFERRAL_LINK',
                attr.status,
                attr.revenue,
                attr.commission,
                Math.floor(Math.random() * 90) + 30,
                attr.status === 'converted' ? new Date().toISOString() : null
            ]);
        }
        console.log(\`   ✅ \${attributions.length} partner attributions\`);

        // Partner Commission Transactions
        const commissions = [
            { amount: 6000, type: 'initial', status: 'approved' },
            { amount: 12000, type: 'initial', status: 'approved' },
            { amount: 3000, type: 'initial', status: 'pending' },
            { amount: 2400, type: 'renewal', status: 'approved' }
        ];

        for (const comm of commissions) {
            await run(`
                INSERT OR REPLACE INTO partner_commission_transactions (
                    id, partner_org_id, attribution_id, amount, currency, commission_type, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'), datetime('now'))
            `, [
                uuidv4(),
                PARTNER_ORG_ID,
                null,
                comm.amount,
                'EUR',
                comm.type,
                comm.status,
                Math.floor(Math.random() * 60) + 10
            ]);
        }
        console.log(\`   ✅ \${commissions.length} partner commissions\`);

        // Partner Payouts
        await run(`
            INSERT OR REPLACE INTO partner_payouts (
                id, partner_org_id, amount, currency, status, payout_method, processed_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-30 days'), datetime('now', '-35 days'), datetime('now'))
        `, [
            uuidv4(),
            PARTNER_ORG_ID,
            15000,
            'EUR',
            'completed',
            'BANK_TRANSFER'
        ]);
        console.log('   ✅ 1 partner payout');

        // Partner Certifications
        const certifications = [
            { name: 'Consultinity Foundations', status: 'completed', progress: 100, duration: '2 hours', modules: 5 },
            { name: 'PMO Standards (ISO/PMBOK/PRINCE2)', status: 'completed', progress: 100, duration: '4 hours', modules: 8 },
            { name: 'AI Intelligence Modules', status: 'in_progress', progress: 65, duration: '3 hours', modules: 6 },
            { name: 'Assessment Specialist', status: 'not_started', progress: 0, duration: '6 hours', modules: 12 }
        ];

        for (const cert of certifications) {
            await run(`
                INSERT OR REPLACE INTO partner_certifications (
                    id, partner_org_id, name, type, status, progress, duration, modules,
                    certificate_id, completed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [
                uuidv4(),
                PARTNER_ORG_ID,
                cert.name,
                'core',
                cert.status,
                cert.progress,
                cert.duration,
                cert.modules,
                cert.status === 'completed' ? \`CERT-\${Date.now()}\` : null,
                cert.status === 'completed' ? new Date().toISOString() : null
            ]);
        }
        console.log(\`   ✅ \${certifications.length} partner certifications\`);

        // Partner Client Organizations
        const clientOrgs = [
            { name: 'Nordic Manufacturing AB', industry: 'Manufacturing', users: 45, projects: 3, score: 3.8, status: 'active' },
            { name: 'Baltic Energy Group', industry: 'Energy', users: 120, projects: 5, score: 4.2, status: 'active' },
            { name: 'TechVentures Sp. z o.o.', industry: 'Technology', users: 28, projects: 2, score: 3.5, status: 'onboarding' }
        ];

        for (const client of clientOrgs) {
            await run(`
                INSERT OR REPLACE INTO partner_client_organizations (
                    id, partner_org_id, organization_id, client_name, industry, user_count, project_count,
                    assessment_score, status, onboarded_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'), datetime('now'), datetime('now'))
            `, [
                uuidv4(),
                PARTNER_ORG_ID,
                uuidv4(),
                client.name,
                client.industry,
                client.users,
                client.projects,
                client.score,
                client.status,
                Math.floor(Math.random() * 180) + 30
            ]);
        }
        console.log(\`   ✅ \${clientOrgs.length} partner client organizations\`);

        // Partner Resources
        const resources = [
            { title: 'Partner Onboarding Guide', type: 'PDF', size: '2.4 MB', category: 'documentation' },
            { title: 'Consultinity Platform Overview', type: 'PDF', size: '5.1 MB', category: 'documentation' },
            { title: 'Partner Logo Kit', type: 'ZIP', size: '12 MB', category: 'marketing' },
            { title: 'Sales Presentation Template', type: 'PPTX', size: '8.5 MB', category: 'marketing' },
            { title: 'Nordic Manufacturing Case Study', type: 'PDF', size: '3.2 MB', category: 'case_studies' },
            { title: 'PMO Setup Checklist', type: 'XLSX', size: '450 KB', category: 'templates' }
        ];

        for (const resource of resources) {
            await run(`
                INSERT OR REPLACE INTO partner_resources (
                    id, title, type, size, category, download_url, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
            `, [
                uuidv4(),
                resource.title,
                resource.type,
                resource.size,
                resource.category,
                \`/downloads/partner/\${resource.title.toLowerCase().replace(/\\s+/g, '-')}.\${resource.type.toLowerCase()}\`
            ]);
        }
        console.log(\`   ✅ \${resources.length} partner resources\`);

        console.log('\n✨ DBR77 Full Demo Seed completed successfully!');
        console.log('\n📈 Summary:');
        console.log(`   - Projects: ${projects.length}`);
        console.log(`   - Initiatives: ${initiatives.length}`);
        console.log(`   - Assessments: ${maturityAssessments.length}`);
        console.log(`   - Tasks: ${tasks.length}`);
        console.log(`   - Decisions: ${decisions.length}`);
        console.log(`   - User Preferences: ${userPreferences.length}`);
        console.log(`   - Email Signatures: ${emailSignatures.length}`);
        console.log(`   - Settings Templates: ${settingsTemplates.length}`);
        console.log(`   - Partner Organization: 1`);
        console.log(`   - Partner Campaign Links: ${campaignLinks.length}`);
        console.log(`   - Partner Attributions: ${attributions.length}`);
        console.log(`   - Partner Commissions: ${commissions.length}`);
        console.log(`   - Partner Certifications: ${certifications.length}`);
        console.log(`   - Partner Client Organizations: ${clientOrgs.length}`);
        console.log(`   - Partner Resources: ${resources.length}`);

    } catch (error) {
        console.error('❌ Error during seed:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

seed();
