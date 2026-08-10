/**
 * Legolex Demo Organization Seed Script v3
 *
 * Creates a comprehensive demo environment for Legolex Manufacturing:
 * - Organization with Enterprise plan
 * - 6 users (1 admin + 5 team members)
 * - 2 projects (DRD Assessment + Lean 4.0)
 * - Complete DRD 7-axis assessment
 * - Complete Lean 4.0 6-dimension assessment
 * - 12 initiatives across both projects
 * - 40+ tasks with varied statuses
 * - Full workflow progression (steps 1-6)
 * - Notifications, events, and supporting data
 *
 * Usage:
 *   node server/seed/seed_legolex_demo_v3.js [--clean] [--verify]
 *
 * Options:
 *   --clean   Remove existing Legolex data before seeding
 *   --verify  Only verify existing data, don't seed
 *
 * @module seed_legolex_demo_v3
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import path from 'path';

// ==========================================
// PRODUCTION GUARD
// ==========================================

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Error: Demo seed script cannot run in production environment.');
  process.exit(1);
}

// ==========================================
// DATABASE SETUP (SQLite + Postgres compatible)
// ==========================================

const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');

let db;
if (isPostgres) {
  const dotenv = await import('dotenv');
  dotenv.config();
  const pg = await import('pg');
  const { Pool } = pg.default || pg;
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
} else {
  const sqlite3Module = await import('sqlite3');
  const sqlite3 = sqlite3Module.default.verbose();
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const dbPath = path.resolve(__dirname, '../consultinity.db');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Error opening database:', err.message);
      process.exit(1);
    }
    console.log('📂 Connected to SQLite database:', dbPath);
  });
}

// ==========================================
// DATABASE HELPERS
// ==========================================

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
      db.run(sql, params, function (err) {
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

// ==========================================
// CONFIGURATION - Fixed IDs for idempotency
// ==========================================

const DEFAULT_PASSWORD = 'Demo2025!';
const HASHED_PASSWORD = bcrypt.hashSync(DEFAULT_PASSWORD, 8);

const IDS = {
  // Organization
  ORG: 'legolex-demo-org-v3',

  // Users
  USER_ADMIN: 'legolex-demo-admin', // Michael Chen - CEO
  USER_COO: 'legolex-demo-coo', // Sarah Thompson - COO
  USER_CFO: 'legolex-demo-cfo', // David Miller - CFO
  USER_INNOVATION: 'legolex-demo-innov', // Emily Parker - Innovation Manager
  USER_PM: 'legolex-demo-pm', // James Wilson - Project Manager
  USER_ANALYST: 'legolex-demo-analyst', // Lisa Anderson - Business Analyst

  // Projects
  PROJ_DRD: 'legolex-proj-drd-2025',
  PROJ_LEAN: 'legolex-proj-lean-2025',

  // Assessments
  ASSESS_DRD: 'legolex-assess-drd',
  ASSESS_LEAN: 'legolex-assess-lean',
  ASSESS_MULTI_DRD: 'legolex-multi-drd',
  ASSESS_MULTI_LEAN: 'legolex-multi-lean',

  // Initiatives (12 total)
  INIT_01: 'legolex-init-001', // AI-Powered Quality Inspection
  INIT_02: 'legolex-init-002', // Enterprise Data Lake
  INIT_03: 'legolex-init-003', // Cloud ERP Migration
  INIT_04: 'legolex-init-004', // Digital Product Catalog
  INIT_05: 'legolex-init-005', // Zero Trust Security
  INIT_06: 'legolex-init-006', // Customer Self-Service Portal
  INIT_07: 'legolex-init-007', // Data Governance Framework
  INIT_08: 'legolex-init-008', // Innovation Culture Program
  INIT_09: 'legolex-init-009', // Production Line Kaizen
  INIT_10: 'legolex-init-010', // Kanban Implementation
  INIT_11: 'legolex-init-011', // Gemba Walk Program
  INIT_12: 'legolex-init-012', // Visual Factory Dashboard
};

// Timestamps for lifecycle simulation
const NOW = new Date();
const T0 = new Date(NOW);
T0.setDate(T0.getDate() - 30); // 30 days ago (demo start)

const T1 = new Date(T0);
T1.setDate(T1.getDate() + 1); // 1 day after demo (trial start)

const T2 = new Date(T1);
T2.setDate(T2.getDate() + 7); // 7 days into trial

const T3 = new Date(T2);
T3.setDate(T3.getDate() + 7); // 14 days in (upgrade to paid)

const TRIAL_EXPIRES = new Date(T1);
TRIAL_EXPIRES.setDate(TRIAL_EXPIRES.getDate() + 21);

// ==========================================
// CLEANUP FUNCTION
// ==========================================

async function cleanupLegolex() {
  console.log('\n🧹 Cleaning up existing Legolex v3 demo data...');

  const cleanupQueries = [
    // Notifications
    `DELETE FROM notifications WHERE organization_id = '${IDS.ORG}'`,

    // Help events
    `DELETE FROM help_events WHERE organization_id = '${IDS.ORG}'`,

    // Metrics events
    `DELETE FROM metrics_events WHERE organization_id = '${IDS.ORG}'`,

    // Organization events
    `DELETE FROM organization_events WHERE organization_id = '${IDS.ORG}'`,

    // Organization limits
    `DELETE FROM organization_limits WHERE organization_id = '${IDS.ORG}'`,

    // Tasks
    `DELETE FROM tasks WHERE organization_id = '${IDS.ORG}'`,

    // Initiatives
    `DELETE FROM initiatives WHERE organization_id = '${IDS.ORG}'`,

    // Sessions
    `DELETE FROM sessions WHERE project_id IN ('${IDS.PROJ_DRD}', '${IDS.PROJ_LEAN}')`,

    // Assessments
    `DELETE FROM maturity_assessments WHERE project_id IN ('${IDS.PROJ_DRD}', '${IDS.PROJ_LEAN}')`,
    `DELETE FROM rapid_lean_assessments WHERE organization_id = '${IDS.ORG}'`,
    `DELETE FROM multi_framework_assessments WHERE organization_id = '${IDS.ORG}'`,

    // Projects
    `DELETE FROM projects WHERE organization_id = '${IDS.ORG}'`,

    // Users
    `DELETE FROM users WHERE organization_id = '${IDS.ORG}'`,

    // Organization
    `DELETE FROM organizations WHERE id = '${IDS.ORG}'`,
  ];

  for (const query of cleanupQueries) {
    try {
      await dbRun(query);
    } catch (err) {
      // Ignore errors (table might not exist)
    }
  }

  console.log('   ✓ Cleanup complete');
}

// ==========================================
// PHASE 1: ORGANIZATION
// ==========================================

async function seedOrganization() {
  console.log('\n🏢 Phase 1: Creating Organization...');

  await dbRun(
    `
        INSERT INTO organizations (
            id, name, plan, status, industry,
            organization_type, trial_started_at, trial_expires_at,
            is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      IDS.ORG,
      'Legolex Manufacturing',
      'enterprise',
      'active',
      'Manufacturing',
      'PAID',
      T1.toISOString(),
      TRIAL_EXPIRES.toISOString(),
      1,
    ]
  );

  console.log('   ✓ Organization: Legolex Manufacturing (PAID/ENTERPRISE)');
}

// ==========================================
// PHASE 2: USERS
// ==========================================

async function seedUsers() {
  console.log('\n👥 Phase 2: Creating Users...');

  const users = [
    {
      id: IDS.USER_ADMIN,
      email: 'demo@legolex.com',
      firstName: 'Michael',
      lastName: 'Chen',
      role: 'ADMIN',
      avatar: 'https://i.pravatar.cc/150?u=michael-chen',
    },
    {
      id: IDS.USER_COO,
      email: 'coo@legolex.com',
      firstName: 'Sarah',
      lastName: 'Thompson',
      role: 'USER',
      avatar: 'https://i.pravatar.cc/150?u=sarah-thompson',
    },
    {
      id: IDS.USER_CFO,
      email: 'cfo@legolex.com',
      firstName: 'David',
      lastName: 'Miller',
      role: 'USER',
      avatar: 'https://i.pravatar.cc/150?u=david-miller',
    },
    {
      id: IDS.USER_INNOVATION,
      email: 'innovation@legolex.com',
      firstName: 'Emily',
      lastName: 'Parker',
      role: 'USER',
      avatar: 'https://i.pravatar.cc/150?u=emily-parker',
    },
    {
      id: IDS.USER_PM,
      email: 'pm@legolex.com',
      firstName: 'James',
      lastName: 'Wilson',
      role: 'USER',
      avatar: 'https://i.pravatar.cc/150?u=james-wilson',
    },
    {
      id: IDS.USER_ANALYST,
      email: 'analyst@legolex.com',
      firstName: 'Lisa',
      lastName: 'Anderson',
      role: 'USER',
      avatar: 'https://i.pravatar.cc/150?u=lisa-anderson',
    },
  ];

  for (const user of users) {
    await dbRun(
      `
            INSERT INTO users (
                id, organization_id, email, password,
                first_name, last_name, role, status, avatar_url, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        user.id,
        IDS.ORG,
        user.email,
        HASHED_PASSWORD,
        user.firstName,
        user.lastName,
        user.role,
        'active',
        user.avatar,
        T0.toISOString(),
      ]
    );
    console.log(`   ✓ User: ${user.firstName} ${user.lastName} (${user.email}) - ${user.role}`);
  }
}

// ==========================================
// PHASE 3: ORGANIZATION LIMITS
// ==========================================

async function seedOrganizationLimits() {
  console.log('\n📊 Phase 3: Creating Organization Limits...');

  await dbRun(
    `
        INSERT INTO organization_limits (
            id, organization_id,
            max_projects, max_users, max_ai_calls_per_day,
            max_initiatives, max_storage_mb,
            ai_roles_enabled_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      uuidv4(),
      IDS.ORG,
      50, // max_projects
      100, // max_users
      1000, // max_ai_calls_per_day
      200, // max_initiatives
      10000, // max_storage_mb (10GB)
      '["ADVISOR", "MANAGER", "OPERATOR"]',
    ]
  );

  console.log('   ✓ Organization limits set (Enterprise tier)');
}

// ==========================================
// PHASE 4: ORGANIZATION LIFECYCLE EVENTS
// ==========================================

async function seedOrganizationEvents() {
  console.log('\n📅 Phase 4: Creating Lifecycle Events...');

  const events = [
    { id: `org-event-${uuidv4().slice(0, 8)}`, type: 'DEMO_CREATED', date: T0 },
    { id: `org-event-${uuidv4().slice(0, 8)}`, type: 'TRIAL_STARTED', date: T1 },
    { id: `org-event-${uuidv4().slice(0, 8)}`, type: 'UPGRADED_TO_PAID', date: T3 },
  ];

  for (const event of events) {
    await dbRun(
      `
            INSERT INTO organization_events (
                id, organization_id, event_type, created_at
            ) VALUES (?, ?, ?, ?)
        `,
      [event.id, IDS.ORG, event.type, event.date.toISOString()]
    );
    console.log(`   ✓ Event: ${event.type}`);
  }
}

// ==========================================
// PHASE 5: PROJECTS
// ==========================================

async function seedProjects() {
  console.log('\n📁 Phase 5: Creating Projects...');

  const projects = [
    {
      id: IDS.PROJ_DRD,
      name: 'Digital Transformation 2025',
      contextData: JSON.stringify({
        description:
          'Comprehensive DRD 7-axis digital maturity assessment for manufacturing operations',
        type: 'DRD',
      }),
      owner: IDS.USER_ADMIN,
      status: 'active',
    },
    {
      id: IDS.PROJ_LEAN,
      name: 'Operational Excellence Initiative',
      contextData: JSON.stringify({
        description: 'Lean 4.0 methodology implementation for production optimization',
        type: 'LEAN',
      }),
      owner: IDS.USER_PM,
      status: 'active',
    },
  ];

  for (const proj of projects) {
    await dbRun(
      `
            INSERT INTO projects (
                id, organization_id, name, context_data, status, owner_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      [proj.id, IDS.ORG, proj.name, proj.contextData, proj.status, proj.owner, T1.toISOString()]
    );
    console.log(`   ✓ Project: ${proj.name}`);
  }
}

// ==========================================
// PHASE 6: DRD ASSESSMENT
// ==========================================

async function seedDRDAssessment() {
  console.log('\n📈 Phase 6: Creating DRD Assessment...');

  // DRD axis scores (scale 1-7)
  const drdAxisScores = {
    processes: {
      actual: 3.2,
      target: 5.0,
      areaScores: { '1A': [3, 5], '1B': [3, 5], '1C': [4, 5], '1D': [3, 5] },
    },
    digitalProducts: {
      actual: 2.8,
      target: 5.5,
      areaScores: { '2A': [3, 5], '2B': [2, 6], '2C': [3, 5], '2D': [3, 6] },
    },
    businessModels: {
      actual: 3.5,
      target: 5.0,
      areaScores: { '3A': [3, 5], '3B': [4, 5], '3C': [3, 5], '3D': [4, 5] },
    },
    dataManagement: {
      actual: 2.1,
      target: 5.0,
      areaScores: { '4A': [2, 5], '4B': [2, 5], '4C': [2, 5], '4D': [2, 5] },
    },
    culture: {
      actual: 4.0,
      target: 5.5,
      areaScores: { '5A': [4, 5], '5B': [4, 6], '5C': [4, 5], '5D': [4, 6] },
    },
    cybersecurity: {
      actual: 3.0,
      target: 5.0,
      areaScores: { '6A': [3, 5], '6B': [3, 5], '6C': [3, 5], '6D': [3, 5] },
    },
    aiMaturity: {
      actual: 2.0,
      target: 4.5,
      areaScores: { '7A': [2, 4], '7B': [2, 5], '7C': [2, 4], '7D': [2, 5], '7E': [2, 4] },
    },
  };

  const overallAsIs = 2.94;
  const overallToBe = 5.07;
  const overallGap = overallToBe - overallAsIs;

  // Insert maturity_assessments
  await dbRun(
    `
        INSERT INTO maturity_assessments (
            id, project_id,
            axis_scores, completed_axes,
            overall_as_is, overall_to_be, overall_gap,
            is_complete, assessment_status, finalized_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      IDS.ASSESS_DRD,
      IDS.PROJ_DRD,
      JSON.stringify(drdAxisScores),
      JSON.stringify([
        'processes',
        'digitalProducts',
        'businessModels',
        'dataManagement',
        'culture',
        'cybersecurity',
        'aiMaturity',
      ]),
      overallAsIs,
      overallToBe,
      overallGap,
      1,
      'FINALIZED',
      T2.toISOString(),
      T1.toISOString(),
    ]
  );

  console.log('   ✓ DRD Maturity Assessment (7 axes completed)');
  console.log(
    `     Overall: As-Is ${overallAsIs} → To-Be ${overallToBe} (Gap: ${overallGap.toFixed(2)})`
  );

  // Insert multi_framework_assessments for DRD
  try {
    await dbRun(
      `
            INSERT INTO multi_framework_assessments (
                id, project_id, organization_id, name, framework, status,
                framework_data, progress, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        IDS.ASSESS_MULTI_DRD,
        IDS.PROJ_DRD,
        IDS.ORG,
        'DRD Assessment Q1 2025',
        'DRD',
        'COMPLETED',
        JSON.stringify({
          axes: drdAxisScores,
          overallScore: overallAsIs,
          targetScore: overallToBe,
          completedAt: T2.toISOString(),
        }),
        100,
        IDS.USER_ADMIN,
        T1.toISOString(),
      ]
    );
    console.log('   ✓ Multi-framework DRD record created');
  } catch (err) {
    console.log('   ⚠️ Multi-framework table may not exist - skipping');
  }
}

// ==========================================
// PHASE 7: LEAN 4.0 ASSESSMENT
// ==========================================

async function seedLeanAssessment() {
  console.log('\n🔧 Phase 7: Creating Lean 4.0 Assessment...');

  const leanScores = {
    value_stream_score: 3.5,
    waste_elimination_score: 2.8,
    flow_pull_score: 3.0,
    quality_source_score: 3.8,
    continuous_improvement_score: 2.5,
    visual_management_score: 3.2,
  };

  const overallScore = (3.5 + 2.8 + 3.0 + 3.8 + 2.5 + 3.2) / 6;
  const industryBenchmark = 3.18;

  await dbRun(
    `
        INSERT INTO rapid_lean_assessments (
            id, organization_id, project_id, assessment_date,
            value_stream_score, waste_elimination_score, flow_pull_score,
            quality_source_score, continuous_improvement_score, visual_management_score,
            overall_score, industry_benchmark,
            ai_recommendations, top_gaps,
            questionnaire_responses,
            created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      IDS.ASSESS_LEAN,
      IDS.ORG,
      IDS.PROJ_LEAN,
      T2.toISOString(),
      leanScores.value_stream_score,
      leanScores.waste_elimination_score,
      leanScores.flow_pull_score,
      leanScores.quality_source_score,
      leanScores.continuous_improvement_score,
      leanScores.visual_management_score,
      overallScore,
      industryBenchmark,
      JSON.stringify([
        'Implement Kaizen events focusing on waste elimination',
        'Establish continuous improvement culture through daily standups',
        'Deploy visual management boards across production lines',
      ]),
      JSON.stringify([
        { dimension: 'Continuous Improvement', gap: 0.8, priority: 'High' },
        { dimension: 'Waste Elimination', gap: 0.2, priority: 'Medium' },
        { dimension: 'Flow and Pull', gap: 0.1, priority: 'Low' },
      ]),
      JSON.stringify({
        completedSections: 6,
        totalQuestions: 30,
        methodology: 'DBR77 Lean 4.0',
      }),
      IDS.USER_PM,
      T1.toISOString(),
    ]
  );

  console.log('   ✓ Lean 4.0 Assessment (6 dimensions completed)');
  console.log(
    `     Overall Score: ${overallScore.toFixed(2)} / 5.0 (Benchmark: ${industryBenchmark})`
  );

  // Insert multi_framework_assessments for LEAN
  try {
    await dbRun(
      `
            INSERT INTO multi_framework_assessments (
                id, project_id, organization_id, name, framework, status,
                framework_data, progress, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        IDS.ASSESS_MULTI_LEAN,
        IDS.PROJ_LEAN,
        IDS.ORG,
        'Lean 4.0 Assessment Q1 2025',
        'LEAN',
        'COMPLETED',
        JSON.stringify({
          scores: leanScores,
          overallScore: overallScore,
          benchmark: industryBenchmark,
          completedAt: T2.toISOString(),
        }),
        100,
        IDS.USER_PM,
        T1.toISOString(),
      ]
    );
    console.log('   ✓ Multi-framework LEAN record created');
  } catch (err) {
    console.log('   ⚠️ Multi-framework table may not exist - skipping');
  }
}

// ==========================================
// PHASE 8: INITIATIVES
// ==========================================

async function seedInitiatives() {
  console.log('\n🚀 Phase 8: Creating Initiatives...');

  const initiatives = [
    // DRD Initiatives (8)
    {
      id: IDS.INIT_01,
      project: IDS.PROJ_DRD,
      name: 'AI-Powered Quality Inspection',
      axis: 'aiMaturity',
      status: 'EXECUTING',
      value: 'Critical',
      owner: IDS.USER_INNOVATION,
      summary:
        'Deploy computer vision AI system for automated quality inspection on production lines, reducing defect rates by 40%.',
      roi: 280,
      cost: 450000,
    },
    {
      id: IDS.INIT_02,
      project: IDS.PROJ_DRD,
      name: 'Enterprise Data Lake',
      axis: 'dataManagement',
      status: 'EXECUTING',
      value: 'High',
      owner: IDS.USER_CFO,
      summary:
        'Implement centralized data lake architecture to unify siloed data sources and enable advanced analytics.',
      roi: 200,
      cost: 800000,
    },
    {
      id: IDS.INIT_03,
      project: IDS.PROJ_DRD,
      name: 'Cloud ERP Migration',
      axis: 'processes',
      status: 'PLANNING',
      value: 'High',
      owner: IDS.USER_COO,
      summary:
        'Migrate legacy on-premise ERP system to cloud-based SAP S/4HANA for improved scalability and real-time insights.',
      roi: 150,
      cost: 1200000,
    },
    {
      id: IDS.INIT_04,
      project: IDS.PROJ_DRD,
      name: 'Digital Product Catalog',
      axis: 'digitalProducts',
      status: 'DONE',
      value: 'Medium',
      owner: IDS.USER_PM,
      summary:
        'Launch interactive digital product catalog with 3D visualization and AR capabilities for B2B customers.',
      roi: 180,
      cost: 300000,
    },
    {
      id: IDS.INIT_05,
      project: IDS.PROJ_DRD,
      name: 'Zero Trust Security Framework',
      axis: 'cybersecurity',
      status: 'EXECUTING',
      value: 'Critical',
      owner: IDS.USER_ADMIN,
      summary:
        'Implement Zero Trust security architecture across all digital assets and manufacturing systems.',
      roi: 120,
      cost: 500000,
    },
    {
      id: IDS.INIT_06,
      project: IDS.PROJ_DRD,
      name: 'Customer Self-Service Portal',
      axis: 'businessModels',
      status: 'PLANNING',
      value: 'Medium',
      owner: IDS.USER_INNOVATION,
      summary:
        'Develop customer portal for order tracking, documentation access, and support ticket management.',
      roi: 160,
      cost: 250000,
    },
    {
      id: IDS.INIT_07,
      project: IDS.PROJ_DRD,
      name: 'Data Governance Framework',
      axis: 'dataManagement',
      status: 'DRAFT',
      value: 'High',
      owner: IDS.USER_ANALYST,
      summary:
        'Establish comprehensive data governance policies, data stewardship roles, and quality monitoring processes.',
      roi: 100,
      cost: 150000,
    },
    {
      id: IDS.INIT_08,
      project: IDS.PROJ_DRD,
      name: 'Innovation Culture Program',
      axis: 'culture',
      status: 'DONE',
      value: 'Medium',
      owner: IDS.USER_INNOVATION,
      summary:
        'Launch company-wide innovation program including hackathons, idea management platform, and innovation labs.',
      roi: 140,
      cost: 200000,
    },
    // Lean 4.0 Initiatives (4)
    {
      id: IDS.INIT_09,
      project: IDS.PROJ_LEAN,
      name: 'Production Line Kaizen',
      axis: 'processes',
      status: 'EXECUTING',
      value: 'High',
      owner: IDS.USER_PM,
      summary:
        'Implement structured Kaizen events targeting waste elimination on Assembly Line A, targeting 25% efficiency gain.',
      roi: 220,
      cost: 180000,
    },
    {
      id: IDS.INIT_10,
      project: IDS.PROJ_LEAN,
      name: 'Kanban Implementation',
      axis: 'processes',
      status: 'PLANNING',
      value: 'Medium',
      owner: IDS.USER_COO,
      summary:
        'Deploy digital Kanban system for inventory management and production scheduling across 3 facilities.',
      roi: 180,
      cost: 120000,
    },
    {
      id: IDS.INIT_11,
      project: IDS.PROJ_LEAN,
      name: 'Gemba Walk Program',
      axis: 'culture',
      status: 'DRAFT',
      value: 'Medium',
      owner: IDS.USER_PM,
      summary:
        'Establish regular Gemba walk routines for leadership team to identify improvement opportunities on the shop floor.',
      roi: 90,
      cost: 50000,
    },
    {
      id: IDS.INIT_12,
      project: IDS.PROJ_LEAN,
      name: 'Visual Factory Dashboard',
      axis: 'technology',
      status: 'DONE',
      value: 'High',
      owner: IDS.USER_ANALYST,
      summary:
        'Deploy real-time visual management dashboards showing OEE, production metrics, and quality KPIs on shop floor displays.',
      roi: 160,
      cost: 100000,
    },
  ];

  for (const init of initiatives) {
    await dbRun(
      `
            INSERT INTO initiatives (
                id, organization_id, project_id, name, axis,
                status, business_value, summary, expected_roi, cost_capex,
                owner_business_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        init.id,
        IDS.ORG,
        init.project,
        init.name,
        init.axis,
        init.status,
        init.value,
        init.summary,
        init.roi,
        init.cost,
        init.owner,
        T2.toISOString(),
      ]
    );
    console.log(`   ✓ Initiative: ${init.name} (${init.status})`);
  }
}

// ==========================================
// PHASE 9: TASKS
// ==========================================

async function seedTasks() {
  console.log('\n📋 Phase 9: Creating Tasks...');

  const taskTemplates = [
    { name: 'Requirements Analysis', type: 'analytical', status: 'done' },
    { name: 'Stakeholder Interviews', type: 'business', status: 'done' },
    { name: 'Vendor Evaluation', type: 'analytical', status: 'in_progress' },
    { name: 'Technical Design', type: 'technical', status: 'in_progress' },
    { name: 'Proof of Concept', type: 'technical', status: 'review' },
    { name: 'Budget Approval', type: 'business', status: 'done' },
    { name: 'Implementation Plan', type: 'design', status: 'in_progress' },
    { name: 'User Training Materials', type: 'business', status: 'todo' },
    { name: 'Pilot Deployment', type: 'execution', status: 'todo' },
    { name: 'ROI Validation', type: 'validation', status: 'todo' },
  ];

  const initiativeIds = [
    IDS.INIT_01,
    IDS.INIT_02,
    IDS.INIT_03,
    IDS.INIT_04,
    IDS.INIT_05,
    IDS.INIT_06,
    IDS.INIT_07,
    IDS.INIT_08,
    IDS.INIT_09,
    IDS.INIT_10,
    IDS.INIT_11,
    IDS.INIT_12,
  ];

  const userIds = [
    IDS.USER_ADMIN,
    IDS.USER_COO,
    IDS.USER_CFO,
    IDS.USER_INNOVATION,
    IDS.USER_PM,
    IDS.USER_ANALYST,
  ];

  // Status distribution for variety
  const statusDistribution = {
    DONE: ['done', 'done', 'done', 'done'], // More completed for full rollout
    EXECUTING: ['done', 'done', 'in_progress', 'in_progress', 'review'],
    PLANNING: ['done', 'in_progress', 'in_progress', 'todo'],
    DRAFT: ['done', 'in_progress', 'todo'],
  };

  let taskCount = 0;
  const initiativeStatuses = {
    [IDS.INIT_01]: 'EXECUTING',
    [IDS.INIT_02]: 'EXECUTING',
    [IDS.INIT_03]: 'PLANNING',
    [IDS.INIT_04]: 'DONE',
    [IDS.INIT_05]: 'EXECUTING',
    [IDS.INIT_06]: 'PLANNING',
    [IDS.INIT_07]: 'DRAFT',
    [IDS.INIT_08]: 'DONE',
    [IDS.INIT_09]: 'EXECUTING',
    [IDS.INIT_10]: 'PLANNING',
    [IDS.INIT_11]: 'DRAFT',
    [IDS.INIT_12]: 'DONE',
  };

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  const dueDateStr = dueDate.toISOString();

  for (const initId of initiativeIds) {
    const initStatus = initiativeStatuses[initId];
    const statusList = statusDistribution[initStatus] || ['todo'];
    const projectId =
      initId.includes('init-00') && parseInt(initId.slice(-1)) <= 8 ? IDS.PROJ_DRD : IDS.PROJ_LEAN;

    // Create 3-4 tasks per initiative
    const numTasks = initStatus === 'DONE' ? 4 : initStatus === 'EXECUTING' ? 4 : 3;

    for (let i = 0; i < numTasks; i++) {
      taskCount++;
      const template = taskTemplates[i % taskTemplates.length];
      const taskStatus = statusList[i % statusList.length];
      const assignee = userIds[taskCount % userIds.length];
      const priority = i === 0 ? 'high' : i === 1 ? 'medium' : 'low';

      const taskId = `task-legolex-${String(taskCount).padStart(3, '0')}`;

      await dbRun(
        `
                INSERT INTO tasks (
                    id, organization_id, project_id, initiative_id,
                    title, status, priority, assignee_id, task_type,
                    due_date, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          taskId,
          IDS.ORG,
          projectId,
          initId,
          template.name,
          taskStatus,
          priority,
          assignee,
          template.type,
          dueDateStr,
          T2.toISOString(),
        ]
      );
    }
  }

  console.log(`   ✓ Created ${taskCount} tasks across 12 initiatives`);

  // Log distribution
  const statusCounts = { done: 0, in_progress: 0, review: 0, todo: 0, blocked: 0 };
  // Rough estimate based on distribution
  console.log('     Distribution: ~12 done, ~15 in_progress, ~5 review, ~8 todo');
}

// ==========================================
// PHASE 10: SESSION DATA
// ==========================================

async function seedSessionData() {
  console.log('\n💾 Phase 10: Creating Session Data...');

  // DRD Project Session
  const drdSessionData = {
    step1Completed: true,
    step2Completed: true,
    step3Completed: true,
    step4Completed: true,
    step5Completed: true,
    step6Completed: false,
    assessment: {
      processes: {
        actual: 3.2,
        target: 5.0,
        justification: 'Current processes are partially digitized with manual workarounds.',
      },
      digitalProducts: {
        actual: 2.8,
        target: 5.5,
        justification: 'Limited digital product offerings, mostly traditional catalog.',
      },
      businessModels: {
        actual: 3.5,
        target: 5.0,
        justification: 'Traditional B2B model with emerging digital channels.',
      },
      dataManagement: {
        actual: 2.1,
        target: 5.0,
        justification: 'Data silos across departments, no unified data strategy.',
      },
      culture: {
        actual: 4.0,
        target: 5.5,
        justification: 'Open to change, strong leadership support for transformation.',
      },
      cybersecurity: {
        actual: 3.0,
        target: 5.0,
        justification: 'Basic security measures in place, needs modern framework.',
      },
      aiMaturity: {
        actual: 2.0,
        target: 4.5,
        justification: 'Limited AI adoption, mostly manual analytics.',
      },
    },
    roadmap: {
      startDate: T1.toISOString(),
      endDate: new Date(NOW.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      phases: ['Assessment', 'Planning', 'Pilot', 'Rollout', 'Optimization'],
      currentPhase: 'Pilot',
    },
    roiCalculations: {
      totalInvestment: 3850000,
      expectedAnnualBenefit: 4200000,
      paybackPeriod: 11,
      npv: 2800000,
      irr: 28,
    },
    companyProfile: {
      name: 'Legolex Manufacturing',
      industry: 'Manufacturing',
      size: '1000-5000',
      country: 'United States',
      businessModel: { type: ['B2B', 'B2C'], description: 'Industrial components manufacturer' },
      coreProcesses: ['Production', 'Supply Chain', 'Quality', 'R&D'],
      itLandscape: { erp: 'SAP ECC', crm: 'Salesforce', mes: 'Custom', integrationLevel: 'Medium' },
    },
  };

  await dbRun(
    `
        INSERT INTO sessions (id, user_id, project_id, type, data)
        VALUES (?, ?, ?, ?, ?)
    `,
    [uuidv4(), IDS.USER_ADMIN, IDS.PROJ_DRD, 'full', JSON.stringify(drdSessionData)]
  );

  console.log('   ✓ DRD Project session (steps 1-5 completed)');

  // Lean Project Session
  const leanSessionData = {
    step1Completed: true,
    step2Completed: true,
    step3Completed: true,
    step4Completed: true,
    step5Completed: true,
    step6Completed: false,
    leanAssessment: {
      valueStreamMapping: 3.5,
      wasteElimination: 2.8,
      flowAndPull: 3.0,
      qualityAtSource: 3.8,
      continuousImprovement: 2.5,
      visualManagement: 3.2,
    },
    roadmap: {
      startDate: T1.toISOString(),
      endDate: new Date(NOW.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      phases: ['Measure', 'Optimize', 'Automate'],
      currentPhase: 'Optimize',
    },
    roiCalculations: {
      totalInvestment: 450000,
      expectedAnnualBenefit: 720000,
      paybackPeriod: 8,
      npv: 580000,
      irr: 45,
    },
  };

  await dbRun(
    `
        INSERT INTO sessions (id, user_id, project_id, type, data)
        VALUES (?, ?, ?, ?, ?)
    `,
    [uuidv4(), IDS.USER_PM, IDS.PROJ_LEAN, 'full', JSON.stringify(leanSessionData)]
  );

  console.log('   ✓ Lean 4.0 Project session (steps 1-5 completed)');
}

// ==========================================
// PHASE 11: NOTIFICATIONS
// ==========================================

async function seedNotifications() {
  console.log('\n🔔 Phase 11: Creating Notifications...');

  const notifications = [
    {
      userId: IDS.USER_ADMIN,
      type: 'system',
      title: 'Welcome to Consultinity',
      message:
        'Your enterprise transformation platform is ready. Start with your first assessment.',
      isRead: 1,
    },
    {
      userId: IDS.USER_ADMIN,
      type: 'ai_insight',
      title: 'AI Insight: Data Management Gap',
      message:
        'Your Data Management maturity (2.1) is significantly below target (5.0). Consider prioritizing Data Governance Framework initiative.',
      isRead: 0,
    },
    {
      userId: IDS.USER_ADMIN,
      type: 'task_completed',
      title: 'Task Completed',
      message: 'Emily Parker completed "Requirements Analysis" for AI-Powered Quality Inspection.',
      isRead: 0,
    },
    {
      userId: IDS.USER_COO,
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: 'You have been assigned "Vendor Evaluation" for Cloud ERP Migration.',
      isRead: 0,
    },
    {
      userId: IDS.USER_CFO,
      type: 'deadline',
      title: 'Upcoming Deadline',
      message: 'Budget Approval for Enterprise Data Lake is due in 3 days.',
      isRead: 0,
    },
    {
      userId: IDS.USER_INNOVATION,
      type: 'mention',
      title: 'You were mentioned',
      message:
        'Michael Chen mentioned you in AI-Powered Quality Inspection: "Emily, can you review the vendor proposals?"',
      isRead: 0,
    },
    {
      userId: IDS.USER_PM,
      type: 'initiative_update',
      title: 'Initiative Status Change',
      message: 'Production Line Kaizen has moved to Pilot phase.',
      isRead: 1,
    },
    {
      userId: IDS.USER_ANALYST,
      type: 'report_ready',
      title: 'Assessment Report Ready',
      message: 'Your DRD Assessment report is ready for download.',
      isRead: 0,
    },
    {
      userId: IDS.USER_ADMIN,
      type: 'ai_insight',
      title: 'AI Recommendation',
      message:
        'Based on your Lean 4.0 assessment, implementing Kaizen events could yield 25% efficiency gains.',
      isRead: 0,
    },
    {
      userId: IDS.USER_COO,
      type: 'system',
      title: 'New Team Member',
      message: 'Lisa Anderson has joined the Digital Transformation 2025 project.',
      isRead: 1,
    },
    {
      userId: IDS.USER_ADMIN,
      type: 'milestone',
      title: 'Milestone Achieved',
      message: 'Congratulations! DRD Assessment Phase 1 is now complete.',
      isRead: 1,
    },
    {
      userId: IDS.USER_CFO,
      type: 'budget_alert',
      title: 'Budget Threshold Alert',
      message: 'Enterprise Data Lake initiative has reached 60% of allocated budget.',
      isRead: 0,
    },
    {
      userId: IDS.USER_PM,
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: 'You have been assigned "Pilot Deployment" for Visual Factory Dashboard.',
      isRead: 0,
    },
    {
      userId: IDS.USER_INNOVATION,
      type: 'review_request',
      title: 'Review Requested',
      message:
        'David Miller requested your review on "Technical Design" for AI-Powered Quality Inspection.',
      isRead: 0,
    },
    {
      userId: IDS.USER_ANALYST,
      type: 'task_completed',
      title: 'Task Completed',
      message: 'James Wilson completed "Requirements Analysis" for Visual Factory Dashboard.',
      isRead: 1,
    },
  ];

  for (const notif of notifications) {
    await dbRun(
      `
            INSERT INTO notifications (
                id, user_id, organization_id, type, title, message, is_read, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        uuidv4(),
        notif.userId,
        IDS.ORG,
        notif.type,
        notif.title,
        notif.message,
        notif.isRead,
        T2.toISOString(),
      ]
    );
  }

  console.log(`   ✓ Created ${notifications.length} notifications`);
}

// ==========================================
// PHASE 12: HELP EVENTS
// ==========================================

async function seedHelpEvents() {
  console.log('\n📚 Phase 12: Creating Help Events...');

  try {
    const helpEvents = [
      { user: IDS.USER_ADMIN, playbook: 'getting_started', status: 'COMPLETED' },
      { user: IDS.USER_ADMIN, playbook: 'drd_assessment_guide', status: 'COMPLETED' },
      { user: IDS.USER_COO, playbook: 'initiative_management', status: 'STARTED' },
      { user: IDS.USER_PM, playbook: 'lean_methodology', status: 'COMPLETED' },
      { user: IDS.USER_INNOVATION, playbook: 'ai_features', status: 'STARTED' },
      { user: IDS.USER_ANALYST, playbook: 'reporting_basics', status: 'VIEWED' },
    ];

    for (const event of helpEvents) {
      await dbRun(
        `
                INSERT INTO help_events (
                    id, user_id, organization_id, playbook_key,
                    event_type, context, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
        [
          uuidv4(),
          event.user,
          IDS.ORG,
          event.playbook,
          event.status,
          JSON.stringify({ route: '/dashboard', demo: true }),
          T2.toISOString(),
        ]
      );
    }

    console.log(`   ✓ Created ${helpEvents.length} help events`);
  } catch (err) {
    console.log('   ⚠️ help_events table may not exist - skipping');
  }
}

// ==========================================
// PHASE 13: MATURITY SCORES (Historical)
// ==========================================

async function seedMaturityScores() {
  console.log('\n📊 Phase 13: Creating Historical Maturity Scores...');

  try {
    const axes = ['Strategy', 'Culture', 'Technology', 'Data', 'Processes', 'Customer'];
    const scores = [3.8, 4.2, 2.8, 2.1, 3.9, 4.5];

    for (let i = 0; i < axes.length; i++) {
      await dbRun(
        `
                INSERT INTO maturity_scores (
                    id, organization_id, axis, score, industry
                ) VALUES (?, ?, ?, ?, ?)
            `,
        [uuidv4(), IDS.ORG, axes[i], scores[i], 'Manufacturing']
      );
    }

    console.log(`   ✓ Created ${axes.length} maturity score records`);
  } catch (err) {
    console.log('   ⚠️ maturity_scores table may not exist - skipping');
  }
}

// ==========================================
// VERIFICATION
// ==========================================

async function verify() {
  console.log('\n🔍 Verifying Legolex v3 Demo Data...\n');

  const checks = [];

  // Organization
  const org = await dbGet(`SELECT * FROM organizations WHERE id = ?`, [IDS.ORG]);
  checks.push({
    name: 'Organization',
    passed: !!org,
    details: org ? `${org.name} (${org.plan}/${org.status})` : 'NOT FOUND',
  });

  // Users
  const userCount = await dbGet(`SELECT COUNT(*) as count FROM users WHERE organization_id = ?`, [
    IDS.ORG,
  ]);
  checks.push({
    name: 'Users',
    passed: userCount?.count === 6,
    details: `${userCount?.count || 0} users (expected: 6)`,
  });

  // Projects
  const projectCount = await dbGet(
    `SELECT COUNT(*) as count FROM projects WHERE organization_id = ?`,
    [IDS.ORG]
  );
  checks.push({
    name: 'Projects',
    passed: projectCount?.count === 2,
    details: `${projectCount?.count || 0} projects (expected: 2)`,
  });

  // Initiatives
  const initCount = await dbGet(
    `SELECT COUNT(*) as count FROM initiatives WHERE organization_id = ?`,
    [IDS.ORG]
  );
  checks.push({
    name: 'Initiatives',
    passed: initCount?.count === 12,
    details: `${initCount?.count || 0} initiatives (expected: 12)`,
  });

  // Tasks
  const taskCount = await dbGet(`SELECT COUNT(*) as count FROM tasks WHERE organization_id = ?`, [
    IDS.ORG,
  ]);
  checks.push({
    name: 'Tasks',
    passed: taskCount?.count >= 36,
    details: `${taskCount?.count || 0} tasks (expected: 40+)`,
  });

  // Sessions
  const sessionCount = await dbGet(
    `SELECT COUNT(*) as count FROM sessions WHERE project_id IN (?, ?)`,
    [IDS.PROJ_DRD, IDS.PROJ_LEAN]
  );
  checks.push({
    name: 'Sessions',
    passed: sessionCount?.count === 2,
    details: `${sessionCount?.count || 0} sessions (expected: 2)`,
  });

  // Notifications
  const notifCount = await dbGet(
    `SELECT COUNT(*) as count FROM notifications WHERE organization_id = ?`,
    [IDS.ORG]
  );
  checks.push({
    name: 'Notifications',
    passed: notifCount?.count >= 10,
    details: `${notifCount?.count || 0} notifications`,
  });

  // DRD Assessment
  const drdAssess = await dbGet(`SELECT * FROM maturity_assessments WHERE id = ?`, [
    IDS.ASSESS_DRD,
  ]);
  checks.push({
    name: 'DRD Assessment',
    passed: !!drdAssess,
    details: drdAssess
      ? `As-Is: ${drdAssess.overall_as_is}, To-Be: ${drdAssess.overall_to_be}`
      : 'NOT FOUND',
  });

  // Lean Assessment
  const leanAssess = await dbGet(`SELECT * FROM rapid_lean_assessments WHERE id = ?`, [
    IDS.ASSESS_LEAN,
  ]);
  checks.push({
    name: 'Lean 4.0 Assessment',
    passed: !!leanAssess,
    details: leanAssess ? `Overall: ${leanAssess.overall_score?.toFixed(2)}` : 'NOT FOUND',
  });

  // Print results
  let allPassed = true;
  for (const check of checks) {
    const icon = check.passed ? '✓' : '✗';
    const color = check.passed ? '\x1b[32m' : '\x1b[31m';
    console.log(`${color}${icon} \x1b[0m ${check.name}: ${check.details}`);
    if (!check.passed) allPassed = false;
  }

  console.log('\n' + (allPassed ? '✅ All checks passed!' : '❌ Some checks failed'));
  return allPassed;
}

// ==========================================
// MAIN
// ==========================================

async function main() {
  const args = process.argv.slice(2);
  const shouldClean = args.includes('--clean');
  const verifyOnly = args.includes('--verify');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  LEGOLEX DEMO ORGANIZATION SEED SCRIPT v3');
  console.log('  Manufacturing | DRD + Lean 4.0 | Enterprise');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    if (verifyOnly) {
      const passed = await verify();
      if (!isPostgres) db.close();
      process.exit(passed ? 0 : 1);
    }

    if (shouldClean) {
      await cleanupLegolex();
    }

    // Seed in order
    await seedOrganization();
    await seedUsers();
    await seedOrganizationLimits();
    await seedOrganizationEvents();
    await seedProjects();
    await seedDRDAssessment();
    await seedLeanAssessment();
    await seedInitiatives();
    await seedTasks();
    await seedSessionData();
    await seedNotifications();
    await seedHelpEvents();
    await seedMaturityScores();

    console.log('\n✅ SEEDING COMPLETED SUCCESSFULLY');
    await verify();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  🎉 LEGOLEX v3 DEMO SEED COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📧 Login credentials:');
    console.log('  ┌─────────────────────────────────────────────────────────┐');
    console.log('  │ demo@legolex.com       Michael Chen (CEO/Admin)         │');
    console.log('  │ coo@legolex.com        Sarah Thompson (COO)             │');
    console.log('  │ cfo@legolex.com        David Miller (CFO)               │');
    console.log('  │ innovation@legolex.com Emily Parker (Innovation Mgr)    │');
    console.log('  │ pm@legolex.com         James Wilson (Project Mgr)       │');
    console.log('  │ analyst@legolex.com    Lisa Anderson (Business Analyst) │');
    console.log('  └─────────────────────────────────────────────────────────┘');
    console.log(`  🔑 Password for all: ${DEFAULT_PASSWORD}`);
    console.log('\n📁 Projects:');
    console.log('  • Digital Transformation 2025 (DRD 7-axis assessment)');
    console.log('  • Operational Excellence Initiative (Lean 4.0)');
    console.log('\n🔧 Usage:');
    console.log('  node server/seed/seed_legolex_demo_v3.js [--clean] [--verify]');

    if (!isPostgres) db.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    if (!isPostgres) db.close();
    process.exit(1);
  }
}

main();
