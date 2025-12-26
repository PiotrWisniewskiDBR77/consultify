/**
 * Seed DBR77 Complete Training Data
 * 
 * Creates comprehensive test data for DBR77 organization:
 * - 10 unique DRD assessments at different workflow stages
 * - 20 initiatives linked to assessments
 * - 5 assessment reports
 * 
 * Usage:
 *   node server/seed/seed_dbr77_complete.js
 */

const { v4: uuidv4 } = require('uuid');

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
        const result = await db.query(pgSql, params);
        return result;
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
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
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

async function dbAll(sql, params = []) {
    if (isPostgres) {
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
        const result = await db.query(pgSql, params);
        return result.rows;
    } else {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

// ============================================================
// ASSESSMENT DATA - 10 UNIQUE PROFILES
// ============================================================

const ASSESSMENT_PROFILES = {
    logistics: {
        processes: { actual: 3, target: 5, justification: "Organizacja posiada podstawową automatyzację procesów logistycznych. Systemy TMS i WMS są wdrożone, jednak integracja między nimi jest ograniczona. Ręczne przekazywanie danych stanowi ok. 35% operacji magazynowych." },
        dataManagement: { actual: 2, target: 4, justification: "Dane są rozproszone w wielu systemach bez centralnego repozytorium. Brak Master Data Management. Jakość danych produktowych oscyluje na poziomie 65%. Raportowanie opiera się głównie na eksportach do Excel." },
        culture: { actual: 4, target: 5, justification: "Kultura organizacyjna sprzyja zmianom. Zespoły operacyjne są otwarte na nowe technologie. Regularne szkolenia z obsługi systemów. Wysoki poziom zaangażowania pracowników w projekty optymalizacyjne." }
    },
    healthcare: {
        processes: { actual: 3, target: 5, justification: "Procesy kliniczne częściowo zdigitalizowane. System HIS wdrożony w 70% oddziałów. Dokumentacja medyczna elektroniczna, ale integracja z laboratoriami manualna. Telemedycyna w fazie pilotażowej." },
        dataManagement: { actual: 3, target: 5, justification: "Dane medyczne w systemie HIS. Anonimizacja dla badań naukowych wdrożona. Brak hurtowni danych klinicznych. Raportowanie do NFZ zautomatyzowane. Analityka predykcyjna nieobecna." },
        culture: { actual: 3, target: 5, justification: "Kadra medyczna otwarta na innowacje technologiczne. Opór wśród personelu administracyjnego. Szkolenia cyfrowe nieregularne. Młodzi lekarze jako championowie digitalizacji." }
    },
    production: {
        processes: { actual: 4, target: 6, justification: "Procesy produkcyjne są w dużej mierze zautomatyzowane. System MES zintegrowany z ERP. Planowanie produkcji wspierane przez APS. Monitoring OEE w czasie rzeczywistym na 80% linii." },
        digitalProducts: { actual: 2, target: 4, justification: "Produkty fizyczne bez komponentów cyfrowych. Brak IoT w produktach końcowych. Dokumentacja techniczna nadal w formie papierowej. Portal klienta oferuje tylko podstawowe funkcje." },
        businessModels: { actual: 3, target: 5, justification: "Model biznesowy oparty na tradycyjnej sprzedaży produktów. Rozpoczęto transformację w kierunku modelu subskrypcyjnego dla części zamiennych. Brak przychodów z usług cyfrowych." },
        dataManagement: { actual: 3, target: 5, justification: "Dane produkcyjne zbierane z systemów SCADA i MES. Data Lake wdrożony, ale wykorzystanie analityczne ograniczone. Brak zaawansowanych dashboardów dla kierownictwa." },
        culture: { actual: 3, target: 5, justification: "Kultura produkcyjna nastawiona na efektywność operacyjną. Opór przed zmianami wśród starszych pracowników. Program szkoleń cyfrowych w fazie pilotażu." },
        cybersecurity: { actual: 5, target: 6, justification: "Dojrzały program bezpieczeństwa OT/IT. Segmentacja sieci przemysłowej. SOC działający 24/7. Regularne audyty bezpieczeństwa i testy penetracyjne." },
        aiMaturity: { actual: 1, target: 3, justification: "Brak wdrożonych rozwiązań AI/ML w produkcji. Dane historyczne dostępne, ale nieprzetworzone. Zespół nie posiada kompetencji Data Science." }
    },
    banking: {
        processes: { actual: 4, target: 6, justification: "Core banking system stabilny ale legacy. Procesy back-office zautomatyzowane w 60%. Onboarding klienta częściowo cyfrowy. KYC/AML procesy wymagają modernizacji." },
        digitalProducts: { actual: 4, target: 6, justification: "Bankowość mobilna z podstawowymi funkcjami. Płatności mobilne BLIK. Brak robo-advisory. PFM w wersji beta. API banking dla partnerów." },
        businessModels: { actual: 3, target: 5, justification: "Model tradycyjny oparty na marży odsetkowej. Przychody z opłat spadające. BaaS w fazie koncepcyjnej. Marketplace produktów partnerskich planowany." },
        dataManagement: { actual: 5, target: 6, justification: "Hurtownia danych dojrzała. 360-view klienta dla segmentu premium. Modele scoringowe regulowane. Data Lake wdrożony." },
        culture: { actual: 3, target: 5, justification: "Kultura konserwatywna, zorientowana na compliance. Agile wdrożone w IT, brak w biznesie. Silosy między departamentami." },
        cybersecurity: { actual: 6, target: 7, justification: "Dojrzały program cyberbezpieczeństwa zgodny z wymogami KNF. SOC 24/7. Red team exercises kwartalne. Bug bounty program." },
        aiMaturity: { actual: 3, target: 5, justification: "ML w scoringu kredytowym. AI w wykrywaniu fraudów transakcyjnych. Chatbot obsługuje 30% zapytań. Brak: NLP dla analizy dokumentów." }
    },
    smartFactory: {
        processes: { actual: 5, target: 6, justification: "Zaawansowana automatyzacja procesów produkcyjnych. Cyfrowy bliźniak dla kluczowych linii. Integracja pionowa od ERP do PLC." },
        digitalProducts: { actual: 3, target: 5, justification: "Produkty wyposażone w podstawowe sensory IoT. Aplikacja mobilna dla klientów w wersji beta. Dane z produktów zbierane, ale niewykorzystywane." },
        businessModels: { actual: 4, target: 5, justification: "Model hybrydowy: sprzedaż + usługi. Serwis zdalny stanowi 25% przychodów serwisowych. Pilotaż pay-per-use dla wybranych klientów." },
        dataManagement: { actual: 3, target: 5, justification: "Platforma danych przemysłowych wdrożona. Real-time analytics dla produkcji. Wyzwanie: integracja danych z IoT produktów." },
        culture: { actual: 2, target: 5, justification: "Silny opór przed zmianami wśród załogi produkcyjnej. Obawy o automatyzację i utratę miejsc pracy. Komunikacja transformacji niewystarczająca." },
        cybersecurity: { actual: 4, target: 6, justification: "Bezpieczeństwo IT na dobrym poziomie. Segmentacja OT/IT częściowa. Brak pełnej widoczności w sieci przemysłowej." },
        aiMaturity: { actual: 2, target: 4, justification: "Wdrożone podstawowe modele ML do kontroli jakości wizualnej. Predictive maintenance w fazie pilotażu na 2 maszynach." }
    },
    retail: {
        processes: { actual: 3, target: 5, justification: "Procesy magazynowe zautomatyzowane. POS zintegrowany z e-commerce. Zarządzanie zapasami wymaga optymalizacji. Click & Collect wdrożony." },
        digitalProducts: { actual: 3, target: 5, justification: "Sklep online z podstawową personalizacją. Aplikacja mobilna z programem lojalnościowym. Brak AR/VR dla product visualization." },
        businessModels: { actual: 3, target: 5, justification: "Model omnichannel rozwijany. Marketplace dla vendorów third-party. Subskrypcje dla produktów regularnych. Private label rozwijane." },
        dataManagement: { actual: 3, target: 5, justification: "CDP częściowo wdrożone. Unified customer view w trakcie budowy. Dane offline/online nie w pełni połączone." },
        culture: { actual: 4, target: 5, justification: "Kultura customer-centric. Pracownicy sklepów szkoleni z technologii. E-commerce team silny. Wyzwanie: integracja kultury retail i digital." },
        cybersecurity: { actual: 3, target: 5, justification: "PCI-DSS compliance dla płatności. Podstawowa ochrona e-commerce. Brak dedykowanego SOC. Szkolenia security nieregularne." },
        aiMaturity: { actual: 2, target: 4, justification: "Rekomendacje produktowe oparte na regułach. Demand forecasting z podstawowym ML. Brak: dynamic pricing AI, visual search." }
    },
    ecommerce: {
        processes: { actual: 4, target: 6, justification: "Procesy e-commerce zautomatyzowane end-to-end. Integracja z fulfillment centers. Automatyczne zarządzanie stanami magazynowymi." },
        digitalProducts: { actual: 5, target: 7, justification: "Platforma e-commerce jako główny produkt cyfrowy. Aplikacja mobilna z wysokim engagement. Personalizacja oparta na ML." },
        businessModels: { actual: 5, target: 6, justification: "Wielomodelowy biznes: marketplace, subskrypcje, reklama. Przychody z usług cyfrowych stanowią 40% total revenue." },
        dataManagement: { actual: 4, target: 6, justification: "Customer Data Platform wdrożona. 360-degree customer view dla top klientów. Real-time personalization." },
        culture: { actual: 4, target: 5, justification: "Kultura digital-native. Zespoły produktowe działające w Agile/Scrum. Eksperymenty i A/B testing jako standard." },
        cybersecurity: { actual: 4, target: 6, justification: "PCI-DSS compliance. WAF i DDoS protection. Bug bounty program aktywny. MFA dla wszystkich pracowników." },
        aiMaturity: { actual: 3, target: 5, justification: "ML w rekomendacjach produktowych (CTR +25%). Chatbot AI obsługuje 40% zapytań tier-1. Dynamic pricing z podstawowym ML." }
    },
    energy: {
        processes: { actual: 4, target: 6, justification: "Systemy SCADA dla infrastruktury krytycznej. Procesy utrzymania ruchu zdigitalizowane. Billing zautomatyzowany. Smart metering wdrażane." },
        digitalProducts: { actual: 2, target: 4, justification: "Portal klienta z podstawowymi funkcjami. Brak aplikacji mobilnej. E-faktura wdrożona. Brak: home energy management." },
        businessModels: { actual: 2, target: 5, justification: "Model regulowany tradycyjny. Taryfy dynamiczne w pilotażu. Usługi energetyczne (ESCO) rozwijane." },
        dataManagement: { actual: 3, target: 5, justification: "Dane pomiarowe zbierane, ale niewykorzystywane analitycznie. GIS dla sieci. Brak: predictive analytics dla demand." },
        culture: { actual: 2, target: 4, justification: "Kultura inżynierska, konserwatywna. Silny opór przed zmianami wśród pracowników z długim stażem." },
        cybersecurity: { actual: 5, target: 6, justification: "Cyberbezpieczeństwo OT priorytetem (infrastruktura krytyczna). Zgodność z NIS2. Segmentacja IT/OT." },
        aiMaturity: { actual: 1, target: 4, justification: "Brak wdrożeń AI/ML. Dane historyczne dostępne dla predykcji. Rozważany pilotaż: predictive maintenance turbin." }
    },
    transformation: {
        processes: { actual: 5, target: 6, justification: "Procesy konsultingowe są dobrze zdefiniowane i częściowo zautomatyzowane. CRM i PSA w pełni zintegrowane. Time tracking i billing zautomatyzowane." },
        digitalProducts: { actual: 4, target: 5, justification: "Platforma do zarządzania transformacją jako SaaS. Narzędzia assessment online. Biblioteka frameworków i templatek." },
        businessModels: { actual: 4, target: 6, justification: "Model hybrydowy: consulting + SaaS + szkolenia. Recurring revenue: 30%. Partnerstwa z vendorami technologicznymi." },
        dataManagement: { actual: 4, target: 6, justification: "Dane projektowe i klientów scentralizowane. Knowledge base z historią projektów. Benchmarki branżowe zbierane systematycznie." },
        culture: { actual: 5, target: 6, justification: "Kultura innowacji i ciągłego uczenia się. Konsultanci aktywni w społeczności eksperckiej. Internal mobility wysoka." },
        cybersecurity: { actual: 5, target: 6, justification: "SOC 2 Type II certified. Bezpieczeństwo danych klientów jako priorytet. Regularne szkolenia security awareness." },
        aiMaturity: { actual: 2, target: 4, justification: "AI wykorzystywane do wewnętrznych analiz i raportowania. Prototyp AI copilot dla konsultantów." }
    },
    pharma: {
        processes: { actual: 4, target: 6, justification: "Procesy produkcyjne zgodne z GMP. Systemy MES i LIMS wdrożone. Batch records elektroniczne. Łańcuch dostaw zdigitalizowany." },
        digitalProducts: { actual: 3, target: 5, justification: "Platformy clinical trials management. Aplikacje dla pacjentów w badaniach klinicznych. Brak: digital therapeutics." },
        businessModels: { actual: 3, target: 5, justification: "Tradycyjny model sprzedaży leków. Outcomes-based contracts z płatnikami. Value-based agreements rozwijane." },
        dataManagement: { actual: 4, target: 6, justification: "Real World Evidence platform. Clinical data management dojrzały. Dane produkcyjne scentralizowane." },
        culture: { actual: 4, target: 5, justification: "Kultura naukowa, evidence-based. Otwartość na innowacje w R&D. Commercial teams wymagają digital upskilling." },
        cybersecurity: { actual: 5, target: 6, justification: "Zgodność z 21 CFR Part 11 i Annex 11. Ochrona IP jako priorytet. Data integrity zapewnione." },
        aiMaturity: { actual: 3, target: 5, justification: "AI w drug discovery. ML w pharmacovigilance. Wdrożenia AI w manufacturing quality." }
    }
};

// ============================================================
// INITIATIVE TEMPLATES BY AXIS
// ============================================================

const INITIATIVE_TEMPLATES = {
    processes: [
        { name: "Automatyzacja procesów magazynowych", description: "Wdrożenie robotów AMR i systemu WCS dla automatyzacji operacji magazynowych", business_value: "HIGH", cost_capex: 500000, cost_opex: 50000, expected_roi: 180 },
        { name: "Integracja systemów ERP-MES", description: "Pełna integracja pionowa systemów zarządzania produkcją z ERP w czasie rzeczywistym", business_value: "HIGH", cost_capex: 300000, cost_opex: 30000, expected_roi: 150 },
        { name: "RPA dla procesów back-office", description: "Automatyzacja procesów administracyjnych poprzez wdrożenie platformy RPA", business_value: "MEDIUM", cost_capex: 150000, cost_opex: 20000, expected_roi: 200 }
    ],
    digitalProducts: [
        { name: "Aplikacja mobilna klienta", description: "Nowoczesna aplikacja mobilna z funkcjami self-service i personalizacją", business_value: "HIGH", cost_capex: 400000, cost_opex: 60000, expected_roi: 120 },
        { name: "IoT w produktach", description: "Wyposażenie produktów w sensory IoT do zbierania danych użytkowania", business_value: "MEDIUM", cost_capex: 600000, cost_opex: 80000, expected_roi: 90 },
        { name: "Portal B2B nowej generacji", description: "Platforma e-commerce B2B z integracją ERP i konfiguratorem produktów", business_value: "HIGH", cost_capex: 350000, cost_opex: 40000, expected_roi: 160 }
    ],
    businessModels: [
        { name: "Model subskrypcyjny", description: "Transformacja modelu biznesowego z jednorazowej sprzedaży na subskrypcję", business_value: "HIGH", cost_capex: 200000, cost_opex: 100000, expected_roi: 250 },
        { name: "Marketplace dla partnerów", description: "Uruchomienie platformy marketplace dla produktów i usług partnerskich", business_value: "MEDIUM", cost_capex: 300000, cost_opex: 50000, expected_roi: 140 }
    ],
    dataManagement: [
        { name: "Wdrożenie CDP", description: "Customer Data Platform z 360-stopniowym widokiem klienta", business_value: "HIGH", cost_capex: 400000, cost_opex: 80000, expected_roi: 170 },
        { name: "Data Lake & Analytics", description: "Centralne repozytorium danych z platformą self-service analytics", business_value: "HIGH", cost_capex: 500000, cost_opex: 100000, expected_roi: 130 },
        { name: "Master Data Management", description: "Wdrożenie systemu MDM dla danych produktowych i klientów", business_value: "MEDIUM", cost_capex: 250000, cost_opex: 30000, expected_roi: 110 }
    ],
    culture: [
        { name: "Program Digital Champions", description: "Program ambasadorów transformacji cyfrowej w całej organizacji", business_value: "MEDIUM", cost_capex: 100000, cost_opex: 50000, expected_roi: 180 },
        { name: "Digital Upskilling Academy", description: "Platforma e-learningowa i program certyfikacji kompetencji cyfrowych", business_value: "HIGH", cost_capex: 200000, cost_opex: 80000, expected_roi: 150 }
    ],
    cybersecurity: [
        { name: "SOC 24/7", description: "Uruchomienie Security Operations Center z monitoringiem 24/7", business_value: "HIGH", cost_capex: 600000, cost_opex: 200000, expected_roi: 95 },
        { name: "Zero Trust Architecture", description: "Wdrożenie modelu bezpieczeństwa Zero Trust", business_value: "HIGH", cost_capex: 400000, cost_opex: 100000, expected_roi: 80 }
    ],
    aiMaturity: [
        { name: "AI Predictive Maintenance", description: "Wdrożenie predykcyjnego utrzymania ruchu opartego na ML", business_value: "HIGH", cost_capex: 350000, cost_opex: 70000, expected_roi: 200 },
        { name: "AI Customer Service", description: "Chatbot AI i automatyzacja obsługi klienta", business_value: "MEDIUM", cost_capex: 200000, cost_opex: 40000, expected_roi: 160 },
        { name: "Computer Vision QC", description: "Automatyczna kontrola jakości oparta na wizji komputerowej", business_value: "HIGH", cost_capex: 300000, cost_opex: 50000, expected_roi: 180 }
    ]
};

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

async function seedDBR77Complete() {
    console.log('🌱 Seeding DBR77 Complete Training Data...\n');
    console.log(`   Database: ${isPostgres ? 'PostgreSQL' : 'SQLite'}\n`);

    try {
        // 1. Find DBR77 organization
        const org = await dbGet(`SELECT id FROM organizations WHERE name LIKE '%DBR77%' LIMIT 1`);
        if (!org) {
            console.error('❌ DBR77 organization not found. Run seed_dbr77 first.');
            process.exit(1);
        }
        const organizationId = org.id;
        console.log(`✅ Found DBR77 organization: ${organizationId}`);

        // 2. Find users
        const piotr = await dbGet(`SELECT id FROM users WHERE email LIKE '%piotr%' AND organization_id = ? LIMIT 1`, [organizationId]);
        const piotrId = piotr?.id || 'system';
        console.log(`✅ Found Piotr Wiśniewski: ${piotrId}`);

        let ctoId, cfoId;
        const existingCto = await dbGet(`SELECT id FROM users WHERE email = 'cto@dbr77.com'`);
        const existingCfo = await dbGet(`SELECT id FROM users WHERE email = 'cfo@dbr77.com'`);
        
        if (!existingCto) {
            ctoId = uuidv4();
            const bcrypt = require('bcryptjs');
            const password = bcrypt.hashSync('123456', 8);
            await dbRun(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status) 
                         VALUES (?, ?, 'cto@dbr77.com', ?, 'Tomasz', 'Kowalski', 'CTO', 'active')`,
                [ctoId, organizationId, password]);
            console.log(`✅ Created CTO user`);
        } else {
            ctoId = existingCto.id;
        }
        
        if (!existingCfo) {
            cfoId = uuidv4();
            const bcrypt = require('bcryptjs');
            const password = bcrypt.hashSync('123456', 8);
            await dbRun(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status) 
                         VALUES (?, ?, 'cfo@dbr77.com', ?, 'Anna', 'Nowak', 'CFO', 'active')`,
                [cfoId, organizationId, password]);
            console.log(`✅ Created CFO user`);
        } else {
            cfoId = existingCfo.id;
        }

        // ============================================================
        // 10 PROJECTS WITH ASSESSMENTS
        // ============================================================
        console.log('\n📁 Creating 10 projects with assessments...');

        const projectDefs = [
            { name: 'Transformacja Logistyki Q1 2025', profile: 'logistics', status: 'DRAFT', axes: 3 },
            { name: 'Digitalizacja Szpitala Miejskiego', profile: 'healthcare', status: 'DRAFT', axes: 3 },
            { name: 'Cyfryzacja Produkcji Q4 2024', profile: 'production', status: 'DRAFT', axes: 7 },
            { name: 'Bank Cyfrowy 2025', profile: 'banking', status: 'DRAFT', axes: 7 },
            { name: 'Smart Factory Initiative', profile: 'smartFactory', status: 'IN_REVIEW', axes: 7 },
            { name: 'Retail Omnichannel Program', profile: 'retail', status: 'IN_REVIEW', axes: 7 },
            { name: 'E-Commerce Platform', profile: 'ecommerce', status: 'AWAITING_APPROVAL', axes: 7 },
            { name: 'Smart Grid Transformation', profile: 'energy', status: 'AWAITING_APPROVAL', axes: 7 },
            { name: 'Digital Transformation 2025', profile: 'transformation', status: 'APPROVED', axes: 7 },
            { name: 'Pharma Digital Excellence', profile: 'pharma', status: 'APPROVED', axes: 7 }
        ];

        const createdProjects = [];

        for (const def of projectDefs) {
            const projectId = uuidv4();
            const assessmentId = uuidv4();
            const workflowId = uuidv4();

            // Create project
            await dbRun(`INSERT INTO projects (id, organization_id, name, status, owner_id, created_at) 
                         VALUES (?, ?, ?, 'active', ?, datetime('now'))`,
                [projectId, organizationId, def.name, piotrId]);

            // Build axis scores
            const profile = ASSESSMENT_PROFILES[def.profile];
            const allAxes = Object.keys(profile);
            const completedAxes = def.axes === 7 ? allAxes : allAxes.slice(0, def.axes);
            const axisScores = {};
            
            completedAxes.forEach(axis => {
                axisScores[axis] = profile[axis];
            });

            // Calculate overall scores
            let totalActual = 0, totalTarget = 0;
            Object.values(axisScores).forEach(a => {
                totalActual += a.actual;
                totalTarget += a.target;
            });
            const count = Object.keys(axisScores).length;
            const overallAsIs = (totalActual / count).toFixed(2);
            const overallToBe = (totalTarget / count).toFixed(2);
            const overallGap = (overallToBe - overallAsIs).toFixed(2);
            const isComplete = completedAxes.length >= 7 ? 1 : 0;
            const assessmentStatus = def.status === 'APPROVED' ? 'FINALIZED' : 'IN_PROGRESS';

            // Create assessment
            await dbRun(`INSERT INTO maturity_assessments 
                         (id, project_id, axis_scores, completed_axes, overall_as_is, overall_to_be, overall_gap, is_complete, assessment_status, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [assessmentId, projectId, JSON.stringify(axisScores), JSON.stringify(completedAxes),
                 overallAsIs, overallToBe, overallGap, isComplete, assessmentStatus]);

            // Create workflow - set both status and workflow_state for compatibility
            await dbRun(`INSERT INTO assessment_workflows 
                         (id, assessment_id, project_id, organization_id, workflow_state, status, created_by, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [workflowId, assessmentId, projectId, organizationId, def.status, def.status, piotrId]);

            createdProjects.push({
                ...def,
                projectId,
                assessmentId,
                workflowId,
                axisScores
            });

            console.log(`   ✅ ${def.name} (${def.status}, ${completedAxes.length}/7 axes)`);
        }

        // ============================================================
        // REVIEWS FOR IN_REVIEW AND AWAITING_APPROVAL
        // ============================================================
        console.log('\n👥 Creating reviews...');

        let reviewsCreated = 0;
        try {
            await dbGet(`SELECT 1 FROM assessment_reviews LIMIT 1`);
            
            for (const proj of createdProjects) {
                if (proj.status === 'IN_REVIEW' || proj.status === 'AWAITING_APPROVAL' || proj.status === 'APPROVED') {
                    const ctoReviewId = uuidv4();
                    const cfoReviewId = uuidv4();
                    const reviewStatus = proj.status === 'IN_REVIEW' ? 'PENDING' : 'COMPLETED';
                    
                    await dbRun(`INSERT INTO assessment_reviews 
                                 (id, workflow_id, reviewer_id, reviewer_role, status, rating, recommendation, requested_at)
                                 VALUES (?, ?, ?, 'CTO', ?, ?, ?, datetime('now'))`,
                        [ctoReviewId, proj.workflowId, ctoId, reviewStatus, 
                         reviewStatus === 'COMPLETED' ? 4 : null,
                         reviewStatus === 'COMPLETED' ? 'APPROVE' : null]);
                    
                    await dbRun(`INSERT INTO assessment_reviews 
                                 (id, workflow_id, reviewer_id, reviewer_role, status, rating, recommendation, requested_at)
                                 VALUES (?, ?, ?, 'CFO', ?, ?, ?, datetime('now'))`,
                        [cfoReviewId, proj.workflowId, cfoId, reviewStatus,
                         reviewStatus === 'COMPLETED' ? 4 : null,
                         reviewStatus === 'COMPLETED' ? 'APPROVE' : null]);
                    
                    reviewsCreated += 2;
                }
            }
            console.log(`   ✅ Created ${reviewsCreated} reviews`);
        } catch (e) {
            console.log('   ⚠️ assessment_reviews table not available');
        }

        // ============================================================
        // VERSIONS FOR APPROVED
        // ============================================================
        console.log('\n📜 Creating versions...');

        let versionsCreated = 0;
        try {
            await dbGet(`SELECT 1 FROM assessment_versions LIMIT 1`);
            
            for (const proj of createdProjects) {
                if (proj.status === 'APPROVED') {
                    const v1Id = uuidv4();
                    const v2Id = uuidv4();
                    
                    await dbRun(`INSERT INTO assessment_versions 
                                 (id, assessment_id, version, assessment_data, change_summary, created_by, created_at)
                                 VALUES (?, ?, 1, ?, 'Wersja początkowa', ?, datetime('now', '-14 days'))`,
                        [v1Id, proj.assessmentId, JSON.stringify({ axis_scores: proj.axisScores }), piotrId]);
                    
                    await dbRun(`INSERT INTO assessment_versions 
                                 (id, assessment_id, version, assessment_data, change_summary, created_by, created_at)
                                 VALUES (?, ?, 2, ?, 'Wersja zatwierdzona', ?, datetime('now', '-7 days'))`,
                        [v2Id, proj.assessmentId, JSON.stringify({ axis_scores: proj.axisScores }), piotrId]);
                    
                    versionsCreated += 2;
                }
            }
            console.log(`   ✅ Created ${versionsCreated} versions`);
        } catch (e) {
            console.log('   ⚠️ assessment_versions table not available');
        }

        // ============================================================
        // INITIATIVES (20 total)
        // ============================================================
        console.log('\n🚀 Creating initiatives...');

        const initiativeStatuses = ['DRAFT', 'PLANNED', 'APPROVED', 'IN_EXECUTION', 'COMPLETED'];
        let initiativesCreated = 0;

        // Get projects with complete assessments (7 axes)
        const completeProjects = createdProjects.filter(p => p.axes === 7);

        for (const proj of completeProjects) {
            // Get 2 initiatives per project from different axes
            const axesWithGaps = Object.entries(proj.axisScores)
                .filter(([_, data]) => data.target > data.actual)
                .slice(0, 2);

            for (const [axis, data] of axesWithGaps) {
                const templates = INITIATIVE_TEMPLATES[axis];
                if (!templates || templates.length === 0) continue;

                const template = templates[initiativesCreated % templates.length];
                const initiativeId = uuidv4();
                const status = initiativeStatuses[initiativesCreated % initiativeStatuses.length];
                const priority = ['HIGH', 'MEDIUM', 'LOW'][initiativesCreated % 3];

                await dbRun(`INSERT INTO initiatives 
                             (id, organization_id, project_id, name, description, axis, status, priority,
                              business_value, cost_capex, cost_opex, expected_roi, owner_business_id, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                    [initiativeId, organizationId, proj.projectId, 
                     `${template.name} - ${proj.name.split(' ')[0]}`,
                     template.description, axis, status, priority,
                     template.business_value, template.cost_capex, template.cost_opex, 
                     template.expected_roi, piotrId]);

                initiativesCreated++;
            }
        }
        console.log(`   ✅ Created ${initiativesCreated} initiatives`);

        // ============================================================
        // ASSESSMENT REPORTS (5 total)
        // ============================================================
        console.log('\n📊 Creating assessment reports...');

        let reportsCreated = 0;
        const approvedProjects = createdProjects.filter(p => p.status === 'APPROVED' || p.status === 'AWAITING_APPROVAL');

        for (const proj of approvedProjects.slice(0, 5)) {
            const reportId = uuidv4();
            const summary = `Raport z oceny dojrzałości cyfrowej dla projektu ${proj.name}. ` +
                           `Średnia ocena obecna: ${(Object.values(proj.axisScores).reduce((s, a) => s + a.actual, 0) / Object.keys(proj.axisScores).length).toFixed(1)}, ` +
                           `cel: ${(Object.values(proj.axisScores).reduce((s, a) => s + a.target, 0) / Object.keys(proj.axisScores).length).toFixed(1)}. ` +
                           `Zidentyfikowano kluczowe obszary wymagające rozwoju.`;

            await dbRun(`INSERT INTO assessment_reports 
                         (id, project_id, organization_id, title, assessment_snapshot, summary, created_by, generated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [reportId, proj.projectId, organizationId, 
                 `Raport DRD: ${proj.name}`,
                 JSON.stringify({ axisScores: proj.axisScores, generatedAt: new Date().toISOString() }),
                 summary, piotrId]);

            reportsCreated++;
        }
        console.log(`   ✅ Created ${reportsCreated} reports`);

        // ============================================================
        // SUMMARY
        // ============================================================
        console.log('\n' + '='.repeat(60));
        console.log('✅ DBR77 Complete Training Data seeding complete!');
        console.log('='.repeat(60));
        console.log('\n📋 Summary:');
        console.log(`   Projects: 10`);
        console.log(`   Assessments: 10`);
        console.log(`   - DRAFT (3/7 axes): 2`);
        console.log(`   - DRAFT (7/7 axes): 2`);
        console.log(`   - IN_REVIEW: 2`);
        console.log(`   - AWAITING_APPROVAL: 2`);
        console.log(`   - APPROVED: 2`);
        console.log(`   Reviews: ${reviewsCreated}`);
        console.log(`   Versions: ${versionsCreated}`);
        console.log(`   Initiatives: ${initiativesCreated}`);
        console.log(`   Reports: ${reportsCreated}`);
        console.log('\n   Users:');
        console.log('   - piotr.wisniewski@dbr77.com (ADMIN)');
        console.log('   - cto@dbr77.com (CTO reviewer)');
        console.log('   - cfo@dbr77.com (CFO reviewer)');
        console.log('   Password: 123456');

    } catch (error) {
        console.error('\n❌ Error seeding:', error);
        throw error;
    } finally {
        if (isPostgres) {
            await db.end();
        }
    }
}

// Run
if (require.main === module) {
    seedDBR77Complete()
        .then(() => {
            console.log('\n🎉 Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = seedDBR77Complete;

