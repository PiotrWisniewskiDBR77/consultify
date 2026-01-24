/**
 * SEED: Full Demo Data for PostgreSQL
 * 
 * Creates comprehensive demo data for piotr.wisniewski@dbr77.com
 * Including: Projects, Initiatives, Tasks, Assessments, and more
 * 
 * Usage:
 *   node server/scripts/seed-full-demo-postgres.js
 * 
 * Or via Railway CLI:
 *   railway run node server/scripts/seed-full-demo-postgres.js
 */

import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
  console.error('ERROR: DATABASE_URL must be a PostgreSQL connection string');
  console.error('Current DATABASE_URL:', databaseUrl ? 'Set but invalid' : 'Not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DB_SSL === 'true' 
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
});

async function seedFullDemo() {
  console.log('🚀 Starting Full Demo Data Seed for PostgreSQL...\n');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Get the DBR77 organization and user
    console.log('📋 Finding DBR77 organization and user...');
    
    const orgResult = await client.query(
      "SELECT id FROM organizations WHERE name LIKE '%DBR77%' OR id = 'dbr77' LIMIT 1"
    );
    
    if (orgResult.rows.length === 0) {
      console.error('❌ DBR77 organization not found! Run seed_dbr77_postgres.js first.');
      process.exit(1);
    }
    
    const ORG_ID = orgResult.rows[0].id;
    console.log(`   ✅ Found organization: ${ORG_ID}`);
    
    const userResult = await client.query(
      "SELECT id FROM users WHERE email = 'piotr.wisniewski@dbr77.com' LIMIT 1"
    );
    
    if (userResult.rows.length === 0) {
      console.error('❌ User piotr.wisniewski@dbr77.com not found!');
      process.exit(1);
    }
    
    const USER_ID = userResult.rows[0].id;
    console.log(`   ✅ Found user: ${USER_ID}`);
    
    // 2. Create Projects
    console.log('\n📁 Creating projects...');
    
    const projects = [
      {
        id: uuidv4(),
        name: 'Digital Transformation 2025',
        description: 'Kompleksowy program transformacji cyfrowej obejmujący automatyzację procesów, wdrożenie AI i modernizację infrastruktury IT. Cel: zwiększenie efektywności operacyjnej o 40%.',
        status: 'active',
        phase: 'execution'
      },
      {
        id: uuidv4(),
        name: 'Customer Experience Revolution',
        description: 'Modernizacja wszystkich punktów styku z klientem. Wdrożenie omnichannel, personalizacji AI, chatbotów i nowego CRM.',
        status: 'active',
        phase: 'pilot'
      },
      {
        id: uuidv4(),
        name: 'Operational Excellence Program',
        description: 'Program ciągłego doskonalenia operacyjnego oparty na Lean i Six Sigma. Optymalizacja łańcucha dostaw.',
        status: 'active',
        phase: 'planning'
      }
    ];
    
    for (const p of projects) {
      await client.query(`
        INSERT INTO projects (id, organization_id, name, description, status, phase, owner_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          phase = EXCLUDED.phase,
          updated_at = NOW()
      `, [p.id, ORG_ID, p.name, p.description, p.status, p.phase, USER_ID]);
    }
    console.log(`   ✅ ${projects.length} projects created`);
    
    // 3. Create Initiatives
    console.log('\n💡 Creating initiatives...');
    
    const initiatives = [
      // Digital Transformation 2025
      {
        project_id: projects[0].id,
        name: 'AI-Powered Process Automation',
        description: 'Wdrożenie inteligentnej automatyzacji procesów biznesowych wykorzystującej Machine Learning do optymalizacji workflow.',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 65,
        axis: 'operational',
        business_value: 1500000,
        cost_capex: 400000,
        cost_opex: 120000,
        expected_roi: 275
      },
      {
        project_id: projects[0].id,
        name: 'Cloud Migration & Modernization',
        description: 'Kompleksowa migracja infrastruktury on-premise do chmury hybrydowej AWS/Azure z modernizacją aplikacji.',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 45,
        axis: 'technology',
        business_value: 800000,
        cost_capex: 300000,
        cost_opex: 200000,
        expected_roi: 160
      },
      {
        project_id: projects[0].id,
        name: 'Data Analytics Platform',
        description: 'Budowa centralnej platformy danych z data lake, narzędziami BI i predykcyjnymi modelami AI.',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 30,
        axis: 'data',
        business_value: 600000,
        cost_capex: 250000,
        cost_opex: 80000,
        expected_roi: 182
      },
      {
        project_id: projects[0].id,
        name: 'Cybersecurity Enhancement',
        description: 'Program wzmocnienia bezpieczeństwa: Zero Trust Architecture, SOC 24/7, SIEM/SOAR.',
        status: 'APPROVED',
        priority: 'HIGH',
        progress: 15,
        axis: 'technology',
        business_value: 400000,
        cost_capex: 200000,
        cost_opex: 150000,
        expected_roi: 114
      },
      // Customer Experience Revolution
      {
        project_id: projects[1].id,
        name: 'Omnichannel Customer Platform',
        description: 'Wdrożenie zintegrowanej platformy omnichannel łączącej wszystkie kanały kontaktu.',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 55,
        axis: 'customer',
        business_value: 900000,
        cost_capex: 350000,
        cost_opex: 100000,
        expected_roi: 200
      },
      {
        project_id: projects[1].id,
        name: 'AI Customer Service Chatbot',
        description: 'Wdrożenie zaawansowanego chatbota AI z NLP, który obsłuży 70% zapytań Tier 1.',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        progress: 75,
        axis: 'customer',
        business_value: 500000,
        cost_capex: 150000,
        cost_opex: 50000,
        expected_roi: 250
      },
      {
        project_id: projects[1].id,
        name: 'Personalization Engine',
        description: 'Wdrożenie AI-powered recommendation engine do personalizacji oferty i komunikacji.',
        status: 'APPROVED',
        priority: 'MEDIUM',
        progress: 20,
        axis: 'customer',
        business_value: 700000,
        cost_capex: 200000,
        cost_opex: 60000,
        expected_roi: 269
      },
      // Operational Excellence
      {
        project_id: projects[2].id,
        name: 'Supply Chain Optimization',
        description: 'Wdrożenie AI-powered supply chain planning, demand forecasting i inventory optimization.',
        status: 'APPROVED',
        priority: 'HIGH',
        progress: 10,
        axis: 'operational',
        business_value: 800000,
        cost_capex: 250000,
        cost_opex: 80000,
        expected_roi: 242
      },
      {
        project_id: projects[2].id,
        name: 'Backoffice Automation',
        description: 'Automatyzacja procesów backoffice: AP/AR, reconciliation, reporting, compliance.',
        status: 'DRAFT',
        priority: 'MEDIUM',
        progress: 5,
        axis: 'operational',
        business_value: 400000,
        cost_capex: 150000,
        cost_opex: 40000,
        expected_roi: 210
      }
    ];
    
    for (const i of initiatives) {
      await client.query(`
        INSERT INTO initiatives (id, organization_id, project_id, name, description, status, priority, progress, axis, business_value, cost_capex, cost_opex, expected_roi, owner_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      `, [uuidv4(), ORG_ID, i.project_id, i.name, i.description, i.status, i.priority, i.progress, i.axis, i.business_value, i.cost_capex, i.cost_opex, i.expected_roi, USER_ID]);
    }
    console.log(`   ✅ ${initiatives.length} initiatives created`);
    
    // 4. Create Tasks
    console.log('\n✅ Creating tasks...');
    
    const tasks = [
      { title: 'Analiza procesów do automatyzacji', description: 'Przeprowadzić audyt 100+ procesów i wybrać top 50 do automatyzacji RPA', status: 'DONE', priority: 'HIGH', progress: 100 },
      { title: 'Wybór platformy RPA', description: 'Ewaluacja UiPath, Automation Anywhere, Power Automate - POC', status: 'DONE', priority: 'HIGH', progress: 100 },
      { title: 'Rozwój botów RPA Wave 1', description: 'Implementacja 15 botów RPA dla procesów finance', status: 'IN_PROGRESS', priority: 'HIGH', progress: 70 },
      { title: 'Integracja RPA z SAP', description: 'Połączenie botów z SAP ERP via API/UI automation', status: 'IN_PROGRESS', priority: 'HIGH', progress: 45 },
      { title: 'Training ML models', description: 'Przygotowanie i trening modeli do klasyfikacji faktur', status: 'IN_PROGRESS', priority: 'MEDIUM', progress: 60 },
      { title: 'UAT dla botów Wave 1', description: 'User Acceptance Testing dla pierwszych 15 botów', status: 'TODO', priority: 'HIGH', progress: 0 },
      { title: 'AWS Landing Zone setup', description: 'Konfiguracja multi-account AWS organization', status: 'DONE', priority: 'HIGH', progress: 100 },
      { title: 'Network architecture design', description: 'Projekt sieci hybrydowej AWS-Azure-OnPrem', status: 'DONE', priority: 'HIGH', progress: 100 },
      { title: 'Migracja aplikacji Wave 1', description: 'Lift & shift 20 aplikacji do AWS EC2/ECS', status: 'IN_PROGRESS', priority: 'HIGH', progress: 55 },
      { title: 'Kubernetes cluster setup', description: 'Konfiguracja EKS dla aplikacji kontenerowych', status: 'IN_PROGRESS', priority: 'MEDIUM', progress: 80 },
      { title: 'Salesforce implementation kick-off', description: 'Uruchomienie projektu wdrożenia Salesforce', status: 'DONE', priority: 'HIGH', progress: 100 },
      { title: 'Data migration plan', description: 'Plan migracji danych z legacy CRM do Salesforce', status: 'DONE', priority: 'HIGH', progress: 100 },
      { title: 'Salesforce Sales Cloud config', description: 'Konfiguracja Sales Cloud z custom objects', status: 'IN_PROGRESS', priority: 'HIGH', progress: 65 },
      { title: 'Chatbot NLP training', description: 'Trening modeli NLP dla chatbota obsługi klienta', status: 'IN_PROGRESS', priority: 'MEDIUM', progress: 80 },
      { title: 'Omnichannel routing setup', description: 'Konfiguracja routingu omnichannel', status: 'IN_PROGRESS', priority: 'HIGH', progress: 40 }
    ];
    
    for (const t of tasks) {
      await client.query(`
        INSERT INTO tasks (id, organization_id, project_id, title, description, status, priority, progress, assignee_id, reporter_id, due_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      `, [uuidv4(), ORG_ID, projects[0].id, t.title, t.description, t.status, t.priority, t.progress, USER_ID, USER_ID, new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000)]);
    }
    console.log(`   ✅ ${tasks.length} tasks created`);
    
    // 5. Create Maturity Assessments
    console.log('\n📊 Creating maturity assessments...');
    
    const assessments = [
      {
        project_id: projects[0].id,
        name: 'Digital Readiness Assessment Q4 2024',
        assessment_date: '2024-10-15',
        planning_score: 3.8,
        decision_score: 3.2,
        execution_score: 2.9,
        monitoring_score: 3.5,
        collaboration_score: 3.4,
        overall_score: 3.36,
        is_complete: true,
        gap_analysis_summary: 'Organizacja wykazuje dojrzałość na poziomie "Developing" (3.36/5). Główne luki w obszarze Execution (2.9).'
      },
      {
        project_id: projects[1].id,
        name: 'Customer Experience Maturity Assessment',
        assessment_date: '2024-11-01',
        planning_score: 3.5,
        decision_score: 3.0,
        execution_score: 3.2,
        monitoring_score: 2.8,
        collaboration_score: 3.6,
        overall_score: 3.22,
        is_complete: true,
        gap_analysis_summary: 'Program CX jest na etapie "Developing" z silną kolaboracją (3.6). Główna luka w Monitoring (2.8).'
      },
      {
        project_id: projects[2].id,
        name: 'Operational Excellence Baseline Assessment',
        assessment_date: '2024-12-01',
        planning_score: 2.8,
        decision_score: 2.5,
        execution_score: 2.6,
        monitoring_score: 2.4,
        collaboration_score: 2.9,
        overall_score: 2.64,
        is_complete: true,
        gap_analysis_summary: 'Program rozpoczyna się z poziomu "Initial" (2.64/5). Plan: 18-miesięczna roadmapa transformacji.'
      }
    ];
    
    for (const a of assessments) {
      await client.query(`
        INSERT INTO maturity_assessments (id, organization_id, project_id, name, assessment_date, planning_score, decision_score, execution_score, monitoring_score, collaboration_score, overall_score, is_complete, gap_analysis_summary, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, [uuidv4(), ORG_ID, a.project_id, a.name, a.assessment_date, a.planning_score, a.decision_score, a.execution_score, a.monitoring_score, a.collaboration_score, a.overall_score, a.is_complete, a.gap_analysis_summary, USER_ID]);
    }
    console.log(`   ✅ ${assessments.length} assessments created`);
    
    // 6. Create Notifications
    console.log('\n🔔 Creating notifications...');
    
    const notifications = [
      { type: 'task_assigned', title: 'Nowe zadanie', message: 'Zostałeś przypisany do zadania "Rozwój botów RPA Wave 1"' },
      { type: 'initiative_update', title: 'Aktualizacja inicjatywy', message: 'Inicjatywa "AI Customer Service Chatbot" osiągnęła 75% postępu' },
      { type: 'deadline_reminder', title: 'Zbliżający się termin', message: 'Zadanie "UAT dla botów Wave 1" ma termin za 3 dni' },
      { type: 'assessment_complete', title: 'Ocena zakończona', message: 'Digital Readiness Assessment Q4 2024 został zakończony' },
      { type: 'milestone_completed', title: 'Kamień milowy', message: 'Kamień milowy "AWS Landing Zone" został osiągnięty' }
    ];
    
    for (const n of notifications) {
      await client.query(`
        INSERT INTO notifications (id, user_id, organization_id, type, title, message, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, false, NOW() - INTERVAL '1 hour' * $7)
      `, [uuidv4(), USER_ID, ORG_ID, n.type, n.title, n.message, Math.floor(Math.random() * 48)]);
    }
    console.log(`   ✅ ${notifications.length} notifications created`);
    
    // 7. Create User Preferences
    console.log('\n⚙️ Creating user preferences...');
    
    const preferences = [
      { type: 'regional', data: { timezone: 'Europe/Warsaw', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', language: 'pl' } },
      { type: 'notifications', data: { email: true, push: true, digest: 'daily', mentions: true } },
      { type: 'ai-model', data: { preferredModel: 'gpt-4', autoSelect: true, preferQuality: true } },
      { type: 'dashboard', data: { defaultView: 'cards', showRecentProjects: true, showQuickActions: true } }
    ];
    
    // Check if user_preferences table exists
    try {
      for (const p of preferences) {
        await client.query(`
          INSERT INTO user_preferences (id, user_id, preferences_type, preferences_data, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [uuidv4(), USER_ID, p.type, JSON.stringify(p.data)]);
      }
      console.log(`   ✅ ${preferences.length} user preferences created`);
    } catch (err) {
      console.log(`   ⚠️ user_preferences table may not exist, skipping`);
    }
    
    await client.query('COMMIT');
    
    console.log('\n✨ Full Demo Seed completed successfully!');
    console.log('\n📈 Summary:');
    console.log(`   - Projects: ${projects.length}`);
    console.log(`   - Initiatives: ${initiatives.length}`);
    console.log(`   - Tasks: ${tasks.length}`);
    console.log(`   - Assessments: ${assessments.length}`);
    console.log(`   - Notifications: ${notifications.length}`);
    console.log(`   - User Preferences: ${preferences.length}`);
    console.log('\n🎯 User: piotr.wisniewski@dbr77.com');
    console.log('🏢 Organization: DBR77');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error during seed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed
seedFullDemo().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
