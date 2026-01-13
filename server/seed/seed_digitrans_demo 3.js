/**
 * Seed DigiTrans Consulting Demo Data
 * 
 * Creates comprehensive demo data for Polish consulting company:
 * - DigiTrans Consulting organization
 * - Demo user (demo@digitrans.consulting / Demo123!)
 * - 5 team members
 * - 5 DRD assessments at different stages
 * - 15 initiatives with various statuses
 * - 25 tasks across multiple projects
 * - Notifications and activity logs
 * - Sample AI chat history
 * 
 * Usage:
 *   node server/seed/seed_digitrans_demo.js
 *   node server/seed/seed_digitrans_demo.js --reset  # Reset existing demo data
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Detect database type
const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');

let db;
if (isPostgres) {
    require('dotenv').config();
    const { Pool } = require('pg');
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
} else {
    db = require('../database');
}

// ============================================================
// DATABASE HELPERS
// ============================================================

async function dbRun(sql, params = []) {
    if (isPostgres) {
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
        pgSql = pgSql.replace(/datetime\('now'\)/gi, 'NOW()');
        pgSql = pgSql.replace(/datetime\('now', '([^']+)'\)/gi, "NOW() + INTERVAL '$1'");
        pgSql = pgSql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');
        pgSql = pgSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
        return await db.query(pgSql, params);
    } else {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
}

async function dbGet(sql, params = []) {
    if (isPostgres) {
        let pgSql = sql.replace(/\?/g, () => `$${params.indexOf(params[0]) + 1}`);
        let paramIndex = 0;
        pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
        const result = await db.query(pgSql, params);
        return result.rows[0];
    } else {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

// ============================================================
// DEMO DATA CONFIGURATION - DIGITRANS CONSULTING
// ============================================================

const DEMO_ORG_ID = 'org-digitrans-demo';
const DEMO_USER_ID = 'user-demo-digitrans';
const DEMO_PROJECT_ID = 'project-digitrans-main';

const DEMO_ORG = {
    id: DEMO_ORG_ID,
    name: 'DigiTrans Consulting',
    plan: 'enterprise',
    status: 'active',
    industry: 'Consulting & Professional Services',
    description: 'Wiodąca polska firma konsultingowa specjalizująca się w transformacji cyfrowej przedsiębiorstw.'
};

const DEMO_USER = {
    id: DEMO_USER_ID,
    email: 'demo@digitrans.consulting',
    password: 'Demo123!',
    firstName: 'Marek',
    lastName: 'Wiśniewski',
    role: 'ADMIN',
    title: 'Digital Transformation Director',
    avatar: 'https://i.pravatar.cc/150?u=marek-wisniewski'
};

// Polish team members
const TEAM_MEMBERS = [
    { 
        id: 'user-anna-kowalska', 
        firstName: 'Anna', 
        lastName: 'Kowalska', 
        role: 'USER', 
        title: 'Senior Consultant',
        email: 'anna.kowalska@digitrans.consulting', 
        avatar: 'https://i.pravatar.cc/150?u=anna-kowalska' 
    },
    { 
        id: 'user-piotr-nowak', 
        firstName: 'Piotr', 
        lastName: 'Nowak', 
        role: 'USER', 
        title: 'Project Manager',
        email: 'piotr.nowak@digitrans.consulting', 
        avatar: 'https://i.pravatar.cc/150?u=piotr-nowak' 
    },
    { 
        id: 'user-katarzyna-maj', 
        firstName: 'Katarzyna', 
        lastName: 'Maj', 
        role: 'USER', 
        title: 'Data Analyst',
        email: 'katarzyna.maj@digitrans.consulting', 
        avatar: 'https://i.pravatar.cc/150?u=katarzyna-maj' 
    },
    { 
        id: 'user-tomasz-lewandowski', 
        firstName: 'Tomasz', 
        lastName: 'Lewandowski', 
        role: 'USER', 
        title: 'AI/ML Specialist',
        email: 'tomasz.lewandowski@digitrans.consulting', 
        avatar: 'https://i.pravatar.cc/150?u=tomasz-lewandowski' 
    },
    { 
        id: 'user-marta-wozniak', 
        firstName: 'Marta', 
        lastName: 'Woźniak', 
        role: 'USER', 
        title: 'Change Management Lead',
        email: 'marta.wozniak@digitrans.consulting', 
        avatar: 'https://i.pravatar.cc/150?u=marta-wozniak' 
    },
];

// ============================================================
// ASSESSMENT DATA - 5 REALISTIC POLISH SCENARIOS
// ============================================================

const ASSESSMENT_SCENARIOS = [
    {
        id: 'assess-digital-factory',
        projectId: 'project-digital-factory',
        name: 'Cyfrowa Transformacja Produkcji',
        nameEn: 'Digital Factory 4.0',
        description: 'Kompleksowa ocena dojrzałości cyfrowej w kontekście Przemysłu 4.0. Obejmuje IoT, automatyzację i smart manufacturing.',
        status: 'APPROVED',
        scores: {
            processes: { asIs: 4, toBe: 6, justification: 'Automatyzacja kluczowych procesów produkcyjnych' },
            digitalProducts: { asIs: 3, toBe: 5, justification: 'Wdrożenie czujników IoT i systemów SCADA' },
            businessModels: { asIs: 3, toBe: 5, justification: 'Product-as-a-Service dla kluczowych klientów' },
            dataManagement: { asIs: 4, toBe: 6, justification: 'Centralne repozytorium danych produkcyjnych' },
            culture: { asIs: 5, toBe: 6, justification: 'Programy upskillingu dla załogi' },
            cybersecurity: { asIs: 5, toBe: 7, justification: 'Bezpieczeństwo OT/IT convergence' },
            aiMaturity: { asIs: 2, toBe: 5, justification: 'Predictive maintenance i optymalizacja produkcji' }
        }
    },
    {
        id: 'assess-supply-chain',
        projectId: 'project-supply-chain',
        name: 'Digitalizacja Łańcucha Dostaw',
        nameEn: 'Supply Chain Digitalization',
        description: 'Transformacja łańcucha dostaw w kierunku pełnej widoczności i predykcji. Integracja z dostawcami i optymalizacja zapasów.',
        status: 'IN_REVIEW',
        scores: {
            processes: { asIs: 3, toBe: 5, justification: 'E2E visibility całego łańcucha' },
            digitalProducts: { asIs: 2, toBe: 4, justification: 'Portal dostawców i tracking w czasie rzeczywistym' },
            businessModels: { asIs: 2, toBe: 4, justification: 'Collaborative planning z partnerami' },
            dataManagement: { asIs: 3, toBe: 5, justification: 'Control tower z danymi z wielu źródeł' },
            culture: { asIs: 4, toBe: 5, justification: 'Cross-functional collaboration' },
            cybersecurity: { asIs: 4, toBe: 6, justification: 'Bezpieczeństwo danych w sieci partnerskiej' },
            aiMaturity: { asIs: 1, toBe: 4, justification: 'Demand forecasting i inventory optimization' }
        }
    },
    {
        id: 'assess-cx-platform',
        projectId: 'project-cx-platform',
        name: 'Platforma Customer Experience',
        nameEn: 'Customer Experience Platform',
        description: 'Budowa omnichannelowej platformy obsługi klienta. Personalizacja, CRM nowej generacji i integracja touchpointów.',
        status: 'IN_REVIEW',
        scores: {
            processes: { asIs: 3, toBe: 6, justification: 'Unified customer journey across channels' },
            digitalProducts: { asIs: 4, toBe: 6, justification: 'Mobile app, web portal, chatbot' },
            businessModels: { asIs: 4, toBe: 6, justification: 'Subscription models i personalized offerings' },
            dataManagement: { asIs: 3, toBe: 6, justification: 'Customer 360 view i real-time analytics' },
            culture: { asIs: 4, toBe: 6, justification: 'Customer-centric mindset' },
            cybersecurity: { asIs: 5, toBe: 6, justification: 'GDPR compliance i data privacy' },
            aiMaturity: { asIs: 3, toBe: 5, justification: 'AI-powered recommendations i NLP chatbot' }
        }
    },
    {
        id: 'assess-ai-operations',
        projectId: 'project-ai-operations',
        name: 'Centrum Operacji AI/ML',
        nameEn: 'AI/ML Operations Center',
        description: 'Budowa zdolności AI/ML w organizacji. MLOps, governance modeli i demokratyzacja data science.',
        status: 'DRAFT',
        scores: {
            processes: { asIs: 2, toBe: 5, justification: 'Standaryzowane pipeline ML' },
            digitalProducts: { asIs: 2, toBe: 5, justification: 'Platforma MLOps i model registry' },
            businessModels: { asIs: 2, toBe: 5, justification: 'AI-as-a-Service dla jednostek biznesowych' },
            dataManagement: { asIs: 2, toBe: 6, justification: 'Feature store i data labeling platform' },
            culture: { asIs: 3, toBe: 5, justification: 'AI literacy w całej organizacji' },
            cybersecurity: { asIs: 4, toBe: 6, justification: 'Responsible AI i model security' },
            aiMaturity: { asIs: 1, toBe: 6, justification: 'Scalable AI/ML capabilities' }
        }
    },
    {
        id: 'assess-sustainability',
        projectId: 'project-sustainability',
        name: 'Cyfrowy Bliźniak Zrównoważonego Rozwoju',
        nameEn: 'Sustainability Digital Twin',
        description: 'Monitorowanie i raportowanie ESG w czasie rzeczywistym. Digital twin dla śladu węglowego i circular economy.',
        status: 'DRAFT',
        scores: {
            processes: { asIs: 3, toBe: 5, justification: 'Automated ESG reporting' },
            digitalProducts: { asIs: 3, toBe: 5, justification: 'Sustainability dashboard' },
            businessModels: { asIs: 3, toBe: 5, justification: 'Carbon-neutral offerings' },
            dataManagement: { asIs: 4, toBe: 6, justification: 'Comprehensive emissions tracking' },
            culture: { asIs: 4, toBe: 5, justification: 'Sustainability champions program' },
            cybersecurity: { asIs: 5, toBe: 6, justification: 'ESG data integrity' },
            aiMaturity: { asIs: 2, toBe: 4, justification: 'Predictive carbon footprint modeling' }
        }
    }
];

// ============================================================
// INITIATIVES
// ============================================================

const INITIATIVES = [
    // From Digital Factory
    { name: 'Integracja Linii Produkcyjnej 4.0', nameEn: 'Smart Production Line Integration', category: 'processes', priority: 'HIGH', status: 'IN_PROGRESS', effort: 'L', impact: 'HIGH', budget: 450000, roi: 285 },
    { name: 'System Predictive Maintenance', nameEn: 'Predictive Maintenance System', category: 'aiMaturity', priority: 'HIGH', status: 'APPROVED', effort: 'M', impact: 'HIGH', budget: 280000, roi: 340 },
    { name: 'Wdrożenie Digital Twin', nameEn: 'Digital Twin Implementation', category: 'digitalProducts', priority: 'MEDIUM', status: 'IN_PROGRESS', effort: 'L', impact: 'HIGH', budget: 520000, roi: 220 },
    
    // From Supply Chain
    { name: 'Real-time Inventory Tracking', nameEn: 'Real-time Inventory Tracking', category: 'dataManagement', priority: 'HIGH', status: 'COMPLETED', effort: 'M', impact: 'HIGH', budget: 180000, roi: 410 },
    { name: 'Portal Dostawców 2.0', nameEn: 'Supplier Portal 2.0', category: 'processes', priority: 'MEDIUM', status: 'IN_PROGRESS', effort: 'M', impact: 'MEDIUM', budget: 120000, roi: 180 },
    { name: 'AI Demand Forecasting', nameEn: 'Demand Forecasting AI', category: 'aiMaturity', priority: 'HIGH', status: 'APPROVED', effort: 'L', impact: 'HIGH', budget: 350000, roi: 295 },
    
    // From Customer Experience
    { name: 'Platforma Customer 360', nameEn: 'Customer 360 Platform', category: 'dataManagement', priority: 'HIGH', status: 'IN_PROGRESS', effort: 'L', impact: 'HIGH', budget: 380000, roi: 260 },
    { name: 'Wdrożenie AI Chatbot', nameEn: 'AI Chatbot Implementation', category: 'aiMaturity', priority: 'MEDIUM', status: 'COMPLETED', effort: 'S', impact: 'MEDIUM', budget: 85000, roi: 520 },
    { name: 'Redesign Aplikacji Mobilnej', nameEn: 'Mobile App Redesign', category: 'digitalProducts', priority: 'HIGH', status: 'IN_PROGRESS', effort: 'M', impact: 'HIGH', budget: 220000, roi: 310 },
    
    // From AI Operations
    { name: 'Budowa Platformy MLOps', nameEn: 'ML Platform Setup', category: 'aiMaturity', priority: 'HIGH', status: 'APPROVED', effort: 'L', impact: 'HIGH', budget: 480000, roi: 195 },
    { name: 'Architektura Data Lake', nameEn: 'Data Lake Architecture', category: 'dataManagement', priority: 'HIGH', status: 'IN_PROGRESS', effort: 'L', impact: 'HIGH', budget: 320000, roi: 240 },
    { name: 'Framework AI Ethics', nameEn: 'AI Ethics Framework', category: 'culture', priority: 'MEDIUM', status: 'DRAFT', effort: 'S', impact: 'MEDIUM', budget: 45000, roi: 0 },
    
    // From Sustainability
    { name: 'Dashboard Śladu Węglowego', nameEn: 'Carbon Footprint Dashboard', category: 'dataManagement', priority: 'MEDIUM', status: 'COMPLETED', effort: 'M', impact: 'MEDIUM', budget: 95000, roi: 150 },
    { name: 'Automatyzacja Raportowania ESG', nameEn: 'ESG Reporting Automation', category: 'processes', priority: 'HIGH', status: 'IN_PROGRESS', effort: 'M', impact: 'HIGH', budget: 150000, roi: 280 },
    { name: 'Circular Economy Tracker', nameEn: 'Circular Economy Tracker', category: 'businessModels', priority: 'LOW', status: 'DRAFT', effort: 'M', impact: 'MEDIUM', budget: 110000, roi: 120 },
];

// ============================================================
// TASKS
// ============================================================

const TASK_TEMPLATES = [
    // In Progress - Polish tasks
    { title: 'Konfiguracja pipeline ML dla prognozowania popytu', titleEn: 'Configure ML pipeline for demand forecasting', status: 'IN_PROGRESS', priority: 'HIGH', dueOffset: 3 },
    { title: 'Przegląd dokumentacji API integracji dostawców', titleEn: 'Review supplier integration API documentation', status: 'IN_PROGRESS', priority: 'MEDIUM', dueOffset: 2 },
    { title: 'Przygotowanie prezentacji dla stakeholderów Q1', titleEn: 'Prepare stakeholder presentation for Q1 review', status: 'IN_PROGRESS', priority: 'HIGH', dueOffset: 1 },
    { title: 'Testowanie flow autentykacji portalu klienta', titleEn: 'Test new customer portal authentication flow', status: 'IN_PROGRESS', priority: 'HIGH', dueOffset: 4 },
    { title: 'Dokumentacja polityk data governance', titleEn: 'Document data governance policies', status: 'IN_PROGRESS', priority: 'MEDIUM', dueOffset: 5 },
    
    // To Do
    { title: 'Zaplanowanie demo czujników IoT z dostawcą', titleEn: 'Schedule vendor demo for IoT sensors', status: 'TODO', priority: 'LOW', dueOffset: 7 },
    { title: 'Przygotowanie materiałów szkoleniowych ERP', titleEn: 'Create training materials for new ERP module', status: 'TODO', priority: 'MEDIUM', dueOffset: 10 },
    { title: 'Analiza zależności systemów legacy', titleEn: 'Analyze legacy system dependencies', status: 'TODO', priority: 'HIGH', dueOffset: 5 },
    { title: 'Konfiguracja dashboardów monitoringu', titleEn: 'Set up monitoring dashboards for production', status: 'TODO', priority: 'MEDIUM', dueOffset: 8 },
    { title: 'Przegląd wyników audytu bezpieczeństwa', titleEn: 'Review security audit findings', status: 'TODO', priority: 'HIGH', dueOffset: 3 },
    
    // Done (recently)
    { title: 'Zakończenie setup infrastruktury Fazy 1', titleEn: 'Complete Phase 1 infrastructure setup', status: 'DONE', priority: 'HIGH', dueOffset: -2 },
    { title: 'Finalizacja negocjacji kontraktu z vendorem', titleEn: 'Finalize vendor contract negotiations', status: 'DONE', priority: 'HIGH', dueOffset: -3 },
    { title: 'Deploy środowiska stagingowego', titleEn: 'Deploy staging environment', status: 'DONE', priority: 'MEDIUM', dueOffset: -1 },
    { title: 'Przeprowadzenie testów UAT', titleEn: 'Conduct user acceptance testing', status: 'DONE', priority: 'HIGH', dueOffset: -4 },
    { title: 'Aktualizacja dokumentacji projektu', titleEn: 'Update project timeline documentation', status: 'DONE', priority: 'LOW', dueOffset: -5 },
    
    // Upcoming
    { title: 'Planowanie kickoff meeting Fazy 2', titleEn: 'Plan Phase 2 kickoff meeting', status: 'TODO', priority: 'HIGH', dueOffset: 14 },
    { title: 'Przygotowanie propozycji budżetowej dla zarządu', titleEn: 'Prepare budget proposal for board', status: 'TODO', priority: 'HIGH', dueOffset: 12 },
    { title: 'Research technik optymalizacji modeli AI', titleEn: 'Research AI model optimization techniques', status: 'TODO', priority: 'MEDIUM', dueOffset: 15 },
    { title: 'Przygotowanie planu komunikacji go-live', titleEn: 'Draft communication plan for go-live', status: 'TODO', priority: 'MEDIUM', dueOffset: 20 },
    { title: 'Koordynacja z prawnym ws. compliance', titleEn: 'Coordinate with legal on data compliance', status: 'TODO', priority: 'HIGH', dueOffset: 7 },
    
    // More variety
    { title: 'Optymalizacja wydajności zapytań DB', titleEn: 'Optimize database query performance', status: 'IN_PROGRESS', priority: 'MEDIUM', dueOffset: 6 },
    { title: 'Przegląd metryk jakości kodu', titleEn: 'Review code quality metrics', status: 'TODO', priority: 'LOW', dueOffset: 9 },
    { title: 'Przygotowanie planu testów DR', titleEn: 'Prepare disaster recovery test plan', status: 'TODO', priority: 'HIGH', dueOffset: 11 },
    { title: 'Aktualizacja dokumentacji API', titleEn: 'Update API documentation', status: 'DONE', priority: 'MEDIUM', dueOffset: -6 },
    { title: 'Przeprowadzenie retrospektywy zespołu', titleEn: 'Conduct team retrospective', status: 'DONE', priority: 'MEDIUM', dueOffset: -7 },
];

// ============================================================
// NOTIFICATIONS
// ============================================================

const NOTIFICATION_TEMPLATES = [
    { type: 'task_assigned', title: 'Nowe zadanie przypisane', titleEn: 'New Task Assigned', message: 'Zostało Ci przypisane zadanie "Konfiguracja pipeline ML"', read: false },
    { type: 'assessment_approved', title: 'Ocena zatwierdzona', titleEn: 'Assessment Approved', message: 'Ocena "Cyfrowa Transformacja Produkcji" została zatwierdzona przez stakeholderów', read: false },
    { type: 'initiative_update', title: 'Zmiana statusu inicjatywy', titleEn: 'Initiative Status Changed', message: 'System Predictive Maintenance zmienił status na Zatwierdzony', read: false },
    { type: 'deadline_reminder', title: 'Zbliżający się termin', titleEn: 'Deadline Approaching', message: 'Zadanie "Prezentacja dla stakeholderów" jest do wykonania jutro', read: false },
    { type: 'comment_mention', title: 'Wspomniano Cię', titleEn: 'You were mentioned', message: 'Anna Kowalska wspomniała Cię w komentarzu projektu Data Lake', read: true },
    { type: 'report_ready', title: 'Raport gotowy', titleEn: 'Report Generated', message: 'Twój raport DRD Executive Summary jest gotowy do pobrania', read: true },
    { type: 'team_update', title: 'Nowy członek zespołu', titleEn: 'New Team Member', message: 'Tomasz Lewandowski dołączył do projektu Cyfrowa Transformacja Produkcji', read: true },
    { type: 'milestone_completed', title: 'Kamień milowy ukończony', titleEn: 'Milestone Completed', message: 'Faza 1 Digitalizacji Łańcucha Dostaw została zakończona', read: true },
];

// ============================================================
// ROADMAP DATA
// ============================================================

const ROADMAP_ITEMS = [
    { quarter: 'Q1 2026', name: 'Fundament Transformacji', initiatives: ['Architektura Data Lake', 'Analiza systemów legacy'], status: 'COMPLETED' },
    { quarter: 'Q1 2026', name: 'Quick Wins', initiatives: ['Dashboard Śladu Węglowego', 'Wdrożenie AI Chatbot'], status: 'COMPLETED' },
    { quarter: 'Q2 2026', name: 'Platformy Kluczowe', initiatives: ['Platforma Customer 360', 'Portal Dostawców 2.0'], status: 'IN_PROGRESS' },
    { quarter: 'Q2 2026', name: 'Automatyzacja', initiatives: ['System Predictive Maintenance', 'AI Demand Forecasting'], status: 'IN_PROGRESS' },
    { quarter: 'Q3 2026', name: 'Integracja 4.0', initiatives: ['Integracja Linii Produkcyjnej 4.0', 'Real-time Inventory Tracking'], status: 'PLANNED' },
    { quarter: 'Q3 2026', name: 'AI/ML Scale', initiatives: ['Budowa Platformy MLOps', 'Framework AI Ethics'], status: 'PLANNED' },
    { quarter: 'Q4 2026', name: 'Digital Twin', initiatives: ['Wdrożenie Digital Twin', 'Circular Economy Tracker'], status: 'PLANNED' },
    { quarter: 'Q4 2026', name: 'Sustainability', initiatives: ['Automatyzacja Raportowania ESG'], status: 'PLANNED' },
];

// ============================================================
// AI CHAT HISTORY (Sample conversations)
// ============================================================

const AI_CHAT_HISTORY = [
    {
        role: 'user',
        content: 'Jakie są główne ryzyka w naszym projekcie transformacji cyfrowej?',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        role: 'assistant',
        content: `Na podstawie analizy Waszych projektów, identyfikuję następujące kluczowe ryzyka:

**🔴 Ryzyka Wysokie:**
1. **Integracja systemów legacy** - Zależności od przestarzałych systemów mogą opóźnić wdrożenie Digital Twin
2. **Kompetencje AI/ML** - Brak wewnętrznych ekspertów MLOps może spowolnić skalowanie

**🟡 Ryzyka Średnie:**
1. **Change management** - Opór pracowników przy automatyzacji procesów
2. **Vendor lock-in** - Silne uzależnienie od jednego dostawcy chmury

**Rekomendacje:**
- Priorytetyzacja programu upskillingu dla zespołu Data Science
- Utworzenie dedykowanego Change Management Office
- Strategia multi-cloud dla krytycznych workloadów`,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5000).toISOString()
    },
    {
        role: 'user',
        content: 'Pokaż mi status wszystkich aktywnych inicjatyw',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        role: 'assistant',
        content: `**📊 Status Inicjatyw - DigiTrans Consulting**

| Inicjatywa | Status | Priorytet | ROI |
|------------|--------|-----------|-----|
| Integracja Linii Produkcyjnej 4.0 | 🔄 In Progress | HIGH | 285% |
| Wdrożenie Digital Twin | 🔄 In Progress | MEDIUM | 220% |
| Platforma Customer 360 | 🔄 In Progress | HIGH | 260% |
| Architektura Data Lake | 🔄 In Progress | HIGH | 240% |
| System Predictive Maintenance | ✅ Approved | HIGH | 340% |

**Podsumowanie:**
- ✅ Ukończone: 4 inicjatywy
- 🔄 W trakcie: 6 inicjatyw
- 📋 Do zatwierdzenia: 3 inicjatywy
- 📝 Draft: 2 inicjatywy

Średni ROI aktywnych projektów: **267%**`,
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 3000).toISOString()
    }
];

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

async function seedDigiTransDemo() {
    const resetMode = process.argv.includes('--reset');
    
    console.log('\n========================================');
    console.log('🚀 DigiTrans Consulting Demo Data Seeding');
    console.log(resetMode ? '   (RESET MODE - clearing existing data)' : '');
    console.log('========================================\n');

    try {
        // 0. Reset existing demo data if requested
        if (resetMode) {
            console.log('🗑️  Clearing existing demo data...');
            await dbRun(`DELETE FROM notifications WHERE organization_id = ?`, [DEMO_ORG_ID]);
            await dbRun(`DELETE FROM tasks WHERE organization_id = ?`, [DEMO_ORG_ID]);
            await dbRun(`DELETE FROM initiatives WHERE organization_id = ?`, [DEMO_ORG_ID]);
            await dbRun(`DELETE FROM projects WHERE organization_id = ?`, [DEMO_ORG_ID]);
            await dbRun(`DELETE FROM users WHERE organization_id = ?`, [DEMO_ORG_ID]);
            await dbRun(`DELETE FROM organizations WHERE id = ?`, [DEMO_ORG_ID]);
            console.log('   ✓ Existing demo data cleared\n');
        }

        // 1. Create Demo Organization
        console.log('📁 Creating Demo Organization...');
        await dbRun(`
            INSERT OR REPLACE INTO organizations (id, name, plan, status, industry, organization_type, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 'DEMO', 1, datetime('now'))
        `, [DEMO_ORG.id, DEMO_ORG.name, DEMO_ORG.plan, DEMO_ORG.status, DEMO_ORG.industry]);
        console.log(`   ✓ Created organization: ${DEMO_ORG.name}`);

        // 2. Create Demo User
        console.log('\n👤 Creating Demo User...');
        const hashedPassword = bcrypt.hashSync(DEMO_USER.password, 10);
        await dbRun(`
            INSERT OR REPLACE INTO users (id, organization_id, email, password, first_name, last_name, role, avatar_url, title, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
        `, [DEMO_USER.id, DEMO_ORG.id, DEMO_USER.email, hashedPassword, DEMO_USER.firstName, DEMO_USER.lastName, DEMO_USER.role, DEMO_USER.avatar, DEMO_USER.title]);
        console.log(`   ✓ Created user: ${DEMO_USER.email} (password: ${DEMO_USER.password})`);

        // 3. Create Team Members
        console.log('\n👥 Creating Team Members...');
        for (const member of TEAM_MEMBERS) {
            const memberPassword = bcrypt.hashSync('team123', 10);
            await dbRun(`
                INSERT OR REPLACE INTO users (id, organization_id, email, password, first_name, last_name, role, avatar_url, title, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
            `, [member.id, DEMO_ORG.id, member.email, memberPassword, member.firstName, member.lastName, member.role, member.avatar, member.title]);
            console.log(`   ✓ Created: ${member.firstName} ${member.lastName} (${member.title})`);
        }

        // 4. Create Main Demo Project
        console.log('\n📊 Creating Main Project...');
        await dbRun(`
            INSERT OR REPLACE INTO projects (id, name, organization_id, status, owner_id, description, created_at)
            VALUES (?, ?, ?, 'active', ?, ?, datetime('now'))
        `, [DEMO_PROJECT_ID, 'Program Transformacji Cyfrowej 2026', DEMO_ORG.id, DEMO_USER.id, 'Kompleksowy program transformacji cyfrowej DigiTrans Consulting obejmujący wszystkie kluczowe obszary biznesowe.']);
        console.log(`   ✓ Created project: Program Transformacji Cyfrowej 2026`);

        // 5. Create Assessment Projects and Maturity Data
        console.log('\n📈 Creating Assessments...');
        
        for (const scenario of ASSESSMENT_SCENARIOS) {
            // Create project for assessment
            await dbRun(`
                INSERT OR REPLACE INTO projects (id, name, organization_id, status, owner_id, description, created_at)
                VALUES (?, ?, ?, 'active', ?, ?, datetime('now', '-' || ? || ' days'))
            `, [scenario.projectId, scenario.name, DEMO_ORG.id, DEMO_USER.id, scenario.description, Math.floor(Math.random() * 60)]);
            
            // Calculate scores
            const axisScores = Object.entries(scenario.scores).map(([axis, data]) => ({
                axis,
                asIs: data.asIs,
                toBe: data.toBe,
                justification: data.justification
            }));
            const overallAsIs = axisScores.reduce((sum, s) => sum + s.asIs, 0) / 7;
            const overallToBe = axisScores.reduce((sum, s) => sum + s.toBe, 0) / 7;
            
            // Create maturity assessment
            await dbRun(`
                INSERT OR REPLACE INTO maturity_assessments (id, project_id, axis_scores, completed_axes, overall_as_is, overall_to_be, overall_gap, is_complete, assessment_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now', '-' || ? || ' days'))
            `, [
                scenario.id, 
                scenario.projectId, 
                JSON.stringify(axisScores), 
                JSON.stringify(Object.keys(scenario.scores)), 
                overallAsIs.toFixed(2), 
                overallToBe.toFixed(2), 
                (overallToBe - overallAsIs).toFixed(2), 
                scenario.status === 'APPROVED' ? 'FINALIZED' : 'IN_PROGRESS',
                Math.floor(Math.random() * 30)
            ]);
            
            console.log(`   ✓ ${scenario.name} (${scenario.status}) - Gap: ${(overallToBe - overallAsIs).toFixed(1)}`);
        }

        // 6. Create Initiatives
        console.log('\n🎯 Creating Initiatives...');
        for (let i = 0; i < INITIATIVES.length; i++) {
            const initiative = INITIATIVES[i];
            const id = `init-digitrans-${i}`;
            const owner = [DEMO_USER, ...TEAM_MEMBERS][Math.floor(Math.random() * 6)];
            
            await dbRun(`
                INSERT OR REPLACE INTO initiatives (
                    id, project_id, organization_id, name, description, axis, priority, 
                    status, cost_capex, business_value, owner_business_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))
            `, [
                id, DEMO_PROJECT_ID, DEMO_ORG.id, initiative.name,
                `Strategiczna inicjatywa: ${initiative.nameEn}. Szacowany ROI: ${initiative.roi}%`,
                initiative.category, initiative.priority, initiative.status,
                initiative.budget, initiative.impact, owner.id,
                Math.floor(Math.random() * 60)
            ]);
        }
        console.log(`   ✓ Created ${INITIATIVES.length} initiatives`);

        // 7. Create Tasks
        console.log('\n✅ Creating Tasks...');
        for (let i = 0; i < TASK_TEMPLATES.length; i++) {
            const task = TASK_TEMPLATES[i];
            const id = `task-digitrans-${i}`;
            const assignee = [DEMO_USER, ...TEAM_MEMBERS][Math.floor(Math.random() * 6)];
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + task.dueOffset);
            
            await dbRun(`
                INSERT OR REPLACE INTO tasks (
                    id, project_id, organization_id, title, description, status, priority,
                    assignee_id, due_date, reporter_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'), datetime('now'))
            `, [
                id, DEMO_PROJECT_ID, DEMO_ORG.id, task.title,
                `${task.titleEn}\n\nSzczegóły zadania dla projektu transformacji cyfrowej.`,
                task.status, task.priority, assignee.id,
                dueDate.toISOString().split('T')[0],
                DEMO_USER.id, Math.abs(task.dueOffset) + Math.floor(Math.random() * 10)
            ]);
        }
        console.log(`   ✓ Created ${TASK_TEMPLATES.length} tasks`);

        // 8. Create Notifications
        console.log('\n🔔 Creating Notifications...');
        for (let i = 0; i < NOTIFICATION_TEMPLATES.length; i++) {
            const notif = NOTIFICATION_TEMPLATES[i];
            const id = `notif-digitrans-${i}`;
            await dbRun(`
                INSERT OR REPLACE INTO notifications (
                    id, user_id, organization_id, type, title, message, is_read, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))
            `, [id, DEMO_USER.id, DEMO_ORG.id, notif.type, notif.title, notif.message, notif.read ? 1 : 0, Math.floor(Math.random() * 72)]);
        }
        console.log(`   ✓ Created ${NOTIFICATION_TEMPLATES.length} notifications`);

        // 9. Create AI Chat History
        console.log('\n🤖 Creating AI Chat History...');
        for (let i = 0; i < AI_CHAT_HISTORY.length; i++) {
            const chat = AI_CHAT_HISTORY[i];
            const id = `chat-digitrans-${i}`;
            await dbRun(`
                INSERT OR REPLACE INTO ai_chats (
                    id, user_id, organization_id, project_id, role, content, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [id, DEMO_USER.id, DEMO_ORG.id, DEMO_PROJECT_ID, chat.role, chat.content, chat.timestamp]);
        }
        console.log(`   ✓ Created ${AI_CHAT_HISTORY.length} chat messages`);

        // 10. Summary
        console.log('\n========================================');
        console.log('✅ DigiTrans Demo Data Seeding Complete!');
        console.log('========================================');
        console.log('\n📋 Summary:');
        console.log(`   • Organization: ${DEMO_ORG.name}`);
        console.log(`   • Demo User: ${DEMO_USER.email} / ${DEMO_USER.password}`);
        console.log(`   • Team Members: ${TEAM_MEMBERS.length}`);
        console.log(`   • Assessments: ${ASSESSMENT_SCENARIOS.length}`);
        console.log(`   • Initiatives: ${INITIATIVES.length}`);
        console.log(`   • Tasks: ${TASK_TEMPLATES.length}`);
        console.log(`   • Notifications: ${NOTIFICATION_TEMPLATES.length}`);
        console.log(`   • AI Chat Messages: ${AI_CHAT_HISTORY.length}`);
        console.log('\n🔐 Login Credentials:');
        console.log(`   Email: ${DEMO_USER.email}`);
        console.log(`   Password: ${DEMO_USER.password}`);
        console.log('\n👥 Team Credentials (all use password: team123):');
        for (const member of TEAM_MEMBERS) {
            console.log(`   • ${member.firstName} ${member.lastName}: ${member.email}`);
        }
        console.log('========================================\n');

        return {
            success: true,
            orgId: DEMO_ORG.id,
            userId: DEMO_USER.id,
            credentials: {
                email: DEMO_USER.email,
                password: DEMO_USER.password
            }
        };

    } catch (error) {
        console.error('\n❌ Error during seeding:', error);
        throw error;
    }
}

// ============================================================
// RUN
// ============================================================

if (require.main === module) {
    seedDigiTransDemo()
        .then(() => {
            console.log('Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Failed:', err);
            process.exit(1);
        });
}

export default seedDigiTransDemo;
export { DEMO_ORG, DEMO_USER, TEAM_MEMBERS, ASSESSMENT_SCENARIOS, INITIATIVES, TASK_TEMPLATES };
