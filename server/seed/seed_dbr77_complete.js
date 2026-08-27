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

import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

import { getDatabaseInstance as getSqliteDatabaseInstance } from '../legacy_archive/database.sqlite.js';

// Detect database type
dotenv.config();
const SEED_USER_PASSWORD = String(process.env.SEED_USER_PASSWORD || '').trim();
if (!SEED_USER_PASSWORD) {
  throw new Error('[ODMOWA] Brak zmiennej SEED_USER_PASSWORD. Ustaw ją przed uruchomieniem seeda.');
}
const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');

let db;
if (isPostgres) {
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
} else {
  db = getSqliteDatabaseInstance();
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

// ============================================================
// ASSESSMENT DATA - 10 UNIQUE PROFILES
// ============================================================

const ASSESSMENT_PROFILES = {
  logistics: {
    processes: {
      actual: 3,
      target: 5,
      justification:
        'Organization has basic logistic process automation. TMS and WMS systems are implemented, but integration between them is limited. Manual data transfer accounts for approx. 35% of warehouse operations.',
    },
    dataManagement: {
      actual: 2,
      target: 4,
      justification:
        'Data is scattered across multiple systems without a central repository. No Master Data Management. Product data quality hovers around 65%. Reporting relies mainly on Excel exports.',
    },
    culture: {
      actual: 4,
      target: 5,
      justification:
        'Organizational culture favors change. Operational teams are open to new technologies. Regular system training. High level of employee engagement in optimization projects.',
    },
  },
  healthcare: {
    processes: {
      actual: 3,
      target: 5,
      justification:
        'Clinical processes partially digitized. HIS system implemented in 70% of wards. Electronic medical records, but lab integration is manual. Telemedicine in pilot phase.',
    },
    dataManagement: {
      actual: 3,
      target: 5,
      justification:
        'Medical data in HIS system. Anonymization for research implemented. No clinical data warehouse. Automated reporting to NHF. Predictive analytics absent.',
    },
    culture: {
      actual: 3,
      target: 5,
      justification:
        'Medical staff open to technological innovations. Resistance among administrative staff. Irregular digital training. Young doctors as digitalization champions.',
    },
  },
  production: {
    processes: {
      actual: 4,
      target: 6,
      justification:
        'Production processes are largely automated. MES system integrated with ERP. Production planning supported by APS. Real-time OEE monitoring on 80% of lines.',
    },
    digitalProducts: {
      actual: 2,
      target: 4,
      justification:
        'Physical products without digital components. No IoT in end products. Technical documentation still in paper form. Customer portal offers only basic functions.',
    },
    businessModels: {
      actual: 3,
      target: 5,
      justification:
        'Business model based on traditional product sales. Started transformation towards subscription model for spare parts. No revenue from digital services.',
    },
    dataManagement: {
      actual: 3,
      target: 5,
      justification:
        'Production data collected from SCADA and MES systems. Data Lake implemented, but analytical usage is limited. No advanced dashboards for management.',
    },
    culture: {
      actual: 3,
      target: 5,
      justification:
        'Production culture focused on operational efficiency. Resistance to change among older employees. Digital training program in pilot phase.',
    },
    cybersecurity: {
      actual: 5,
      target: 6,
      justification:
        'Mature OT/IT security program. Industrial network segmentation. SOC operating 24/7. Regular security audits and penetration tests.',
    },
    aiMaturity: {
      actual: 1,
      target: 3,
      justification:
        'No AI/ML solutions implemented in production. Historical data available but unprocessed. Team lacks Data Science competencies.',
    },
  },
  banking: {
    processes: {
      actual: 4,
      target: 6,
      justification:
        'Core banking system stable but legacy. Back-office processes 60% automated. Client onboarding partially digital. KYC/AML processes require modernization.',
    },
    digitalProducts: {
      actual: 4,
      target: 6,
      justification:
        'Mobile banking with basic functions. Mobile payments (BLIK). No robo-advisory. PFM in beta. API banking for partners.',
    },
    businessModels: {
      actual: 3,
      target: 5,
      justification:
        'Traditional model based on interest margin. Fee revenues declining. BaaS in concept phase. Partner product marketplace planned.',
    },
    dataManagement: {
      actual: 5,
      target: 6,
      justification:
        'Mature data warehouse. 360-view of customer for premium segment. Regulated scoring models. Data Lake implemented.',
    },
    culture: {
      actual: 3,
      target: 5,
      justification:
        'Conservative culture, compliance-oriented. Agile implemented in IT, absent in business. Silos between departments.',
    },
    cybersecurity: {
      actual: 6,
      target: 7,
      justification:
        'Mature cybersecurity program compliant with KNF requirements. SOC 24/7. Quarterly red team exercises. Bug bounty program.',
    },
    aiMaturity: {
      actual: 3,
      target: 5,
      justification:
        'ML in credit scoring. AI in transaction fraud detection. Chatbot handles 30% of queries. Missing: NLP for document analysis.',
    },
  },
  smartFactory: {
    processes: {
      actual: 5,
      target: 6,
      justification:
        'Advanced production process automation. Digital twin for key lines. Vertical integration from ERP to PLC.',
    },
    digitalProducts: {
      actual: 3,
      target: 5,
      justification:
        'Products equipped with basic IoT sensors. Mobile app for clients in beta. Data from products collected but unused.',
    },
    businessModels: {
      actual: 4,
      target: 5,
      justification:
        'Hybrid model: sales + services. Remote service accounts for 25% of service revenue. Pay-per-use pilot for selected clients.',
    },
    dataManagement: {
      actual: 3,
      target: 5,
      justification:
        'Industrial data platform implemented. Real-time analytics for production. Challenge: integrating IoT data from products.',
    },
    culture: {
      actual: 2,
      target: 5,
      justification:
        'Strong resistance to change among production crew. Fears of automation and job loss. Transformation communication insufficient.',
    },
    cybersecurity: {
      actual: 4,
      target: 6,
      justification:
        'IT security at good level. Partial OT/IT segmentation. No full visibility in industrial network.',
    },
    aiMaturity: {
      actual: 2,
      target: 4,
      justification:
        'Basic ML models implemented for visual quality control. Predictive maintenance in pilot phase on 2 machines.',
    },
  },
  retail: {
    processes: {
      actual: 3,
      target: 5,
      justification:
        'Warehouse processes automated. POS integrated with e-commerce. Inventory management needs optimization. Click & Collect implemented.',
    },
    digitalProducts: {
      actual: 3,
      target: 5,
      justification:
        'Online store with basic personalization. Mobile app with loyalty program. No AR/VR for product visualization.',
    },
    businessModels: {
      actual: 3,
      target: 5,
      justification:
        'Omnichannel model being developed. Marketplace for third-party vendors. Subscriptions for regular products. Private label developing.',
    },
    dataManagement: {
      actual: 3,
      target: 5,
      justification:
        'CDP partially implemented. Unified customer view under construction. Offline/online data not fully connected.',
    },
    culture: {
      actual: 4,
      target: 5,
      justification:
        'Customer-centric culture. Store employees trained in technology. Strong e-commerce team. Challenge: integrating retail and digital cultures.',
    },
    cybersecurity: {
      actual: 3,
      target: 5,
      justification:
        'PCI-DSS compliance for payments. Basic e-commerce protection. No dedicated SOC. Irregular security training.',
    },
    aiMaturity: {
      actual: 2,
      target: 4,
      justification:
        'Rule-based product recommendations. Demand forecasting with basic ML. Missing: AI dynamic pricing, visual search.',
    },
  },
  ecommerce: {
    processes: {
      actual: 4,
      target: 6,
      justification:
        'E-commerce processes automated end-to-end. Integration with fulfillment centers. Automated inventory management.',
    },
    digitalProducts: {
      actual: 5,
      target: 7,
      justification:
        'E-commerce platform as main digital product. Mobile app with high engagement. ML-based personalization.',
    },
    businessModels: {
      actual: 5,
      target: 6,
      justification:
        'Multi-model business: marketplace, subscriptions, advertising. Revenue from digital services accounts for 40% of total revenue.',
    },
    dataManagement: {
      actual: 4,
      target: 6,
      justification:
        'Customer Data Platform implemented. 360-degree customer view for top clients. Real-time personalization.',
    },
    culture: {
      actual: 4,
      target: 5,
      justification:
        'Digital-native culture. Product teams working in Agile/Scrum. Experiments and A/B testing as standard.',
    },
    cybersecurity: {
      actual: 4,
      target: 6,
      justification:
        'PCI-DSS compliance. WAF and DDoS protection. Active bug bounty program. MFA for all employees.',
    },
    aiMaturity: {
      actual: 3,
      target: 5,
      justification:
        'ML in product recommendations (CTR +25%). AI Chatbot handles 40% of tier-1 queries. Dynamic pricing with basic ML.',
    },
  },
  energy: {
    processes: {
      actual: 4,
      target: 6,
      justification:
        'SCADA systems for critical infrastructure. Maintenance processes digitized. Billing automated. Smart metering being deployed.',
    },
    digitalProducts: {
      actual: 2,
      target: 4,
      justification:
        'Customer portal with basic functions. No mobile app. E-invoicing implemented. Missing: home energy management.',
    },
    businessModels: {
      actual: 2,
      target: 5,
      justification:
        'Traditional regulated model. Dynamic tariffs in pilot. Energy services (ESCO) developing.',
    },
    dataManagement: {
      actual: 3,
      target: 5,
      justification:
        'Measurement data collected but not used analytically. GIS for grid. Missing: predictive analytics for demand.',
    },
    culture: {
      actual: 2,
      target: 4,
      justification:
        'Engineering culture, conservative. Strong resistance to change among long-tenured employees.',
    },
    cybersecurity: {
      actual: 5,
      target: 6,
      justification:
        'OT cybersecurity is a priority (critical infrastructure). NIS2 compliance. IT/OT segmentation.',
    },
    aiMaturity: {
      actual: 1,
      target: 4,
      justification:
        'No AI/ML implementations. Historical data available for prediction. Considered pilot: turbine predictive maintenance.',
    },
  },
  transformation: {
    processes: {
      actual: 5,
      target: 6,
      justification:
        'Consulting processes are well defined and partially automated. CRM and PSA fully integrated. Time tracking and billing automated.',
    },
    digitalProducts: {
      actual: 4,
      target: 5,
      justification:
        'Transformation management platform as SaaS. Online assessment tools. Framework and template library.',
    },
    businessModels: {
      actual: 4,
      target: 6,
      justification:
        'Hybrid model: consulting + SaaS + training. Recurring revenue: 30%. Partnerships with technology vendors.',
    },
    dataManagement: {
      actual: 4,
      target: 6,
      justification:
        'Project and client data centralized. Knowledge base with project history. Industry benchmarks collected systematically.',
    },
    culture: {
      actual: 5,
      target: 6,
      justification:
        'Culture of innovation and continuous learning. Consultants active in expert community. High internal mobility.',
    },
    cybersecurity: {
      actual: 5,
      target: 6,
      justification:
        'SOC 2 Type II certified. Cliet data security as priority. Regular security awareness training.',
    },
    aiMaturity: {
      actual: 2,
      target: 4,
      justification:
        'AI used for internal analysis and reporting. AI copilot prototype for consultants.',
    },
  },
  pharma: {
    processes: {
      actual: 4,
      target: 6,
      justification:
        'Production processes GMP compliant. MES and LIMS systems implemented. Electronic batch records. Supply chain digitized.',
    },
    digitalProducts: {
      actual: 3,
      target: 5,
      justification:
        'Clinical trials management platforms. Patient apps for clinical trials. Missing: digital therapeutics.',
    },
    businessModels: {
      actual: 3,
      target: 5,
      justification:
        'Traditional drug sales model. Outcomes-based contracts with payers. Value-based agreements developing.',
    },
    dataManagement: {
      actual: 4,
      target: 6,
      justification:
        'Real World Evidence platform. Clinical data management mature. Production data centralized.',
    },
    culture: {
      actual: 4,
      target: 5,
      justification:
        'Scientific, evidence-based culture. Openness to innovation in R&D. Commercial teams require digital upskilling.',
    },
    cybersecurity: {
      actual: 5,
      target: 6,
      justification:
        'Compliance with 21 CFR Part 11 and Annex 11. IP protection as priority. Data integrity assured.',
    },
    aiMaturity: {
      actual: 3,
      target: 5,
      justification:
        'AI in drug discovery. ML in pharmacovigilance. AI deployments in manufacturing quality.',
    },
  },
};

// ============================================================
// INITIATIVE TEMPLATES BY AXIS
// ============================================================

const INITIATIVE_TEMPLATES = {
  processes: [
    {
      name: 'Warehouse Automation',
      description:
        'Implementation of AMR robots and WCS system for warehouse operations automation',
      business_value: 'HIGH',
      cost_capex: 500000,
      cost_opex: 50000,
      expected_roi: 180,
    },
    {
      name: 'ERP-MES Integration',
      description:
        'Full vertical integration of production management systems with ERP in real time',
      business_value: 'HIGH',
      cost_capex: 300000,
      cost_opex: 30000,
      expected_roi: 150,
    },
    {
      name: 'Back-office RPA',
      description: 'Automation of administrative processes through RPA platform deployment',
      business_value: 'MEDIUM',
      cost_capex: 150000,
      cost_opex: 20000,
      expected_roi: 200,
    },
  ],
  digitalProducts: [
    {
      name: 'Client Mobile App',
      description: 'Modern mobile application with self-service functions and personalization',
      business_value: 'HIGH',
      cost_capex: 400000,
      cost_opex: 60000,
      expected_roi: 120,
    },
    {
      name: 'IoT in Products',
      description: 'Equipping products with IoT sensors to collect usage data',
      business_value: 'MEDIUM',
      cost_capex: 600000,
      cost_opex: 80000,
      expected_roi: 90,
    },
    {
      name: 'Next Gen B2B Portal',
      description: 'B2B e-commerce platform with ERP integration and product configurator',
      business_value: 'HIGH',
      cost_capex: 350000,
      cost_opex: 40000,
      expected_roi: 160,
    },
  ],
  businessModels: [
    {
      name: 'Subscription Model',
      description: 'Transformation of business model from one-time sales to subscription',
      business_value: 'HIGH',
      cost_capex: 200000,
      cost_opex: 100000,
      expected_roi: 250,
    },
    {
      name: 'Partner Marketplace',
      description: 'Launch of marketplace platform for partner products and services',
      business_value: 'MEDIUM',
      cost_capex: 300000,
      cost_opex: 50000,
      expected_roi: 140,
    },
  ],
  dataManagement: [
    {
      name: 'CDP Implementation',
      description: 'Customer Data Platform with 360-degree customer view',
      business_value: 'HIGH',
      cost_capex: 400000,
      cost_opex: 80000,
      expected_roi: 170,
    },
    {
      name: 'Data Lake & Analytics',
      description: 'Central data repository with self-service analytics platform',
      business_value: 'HIGH',
      cost_capex: 500000,
      cost_opex: 100000,
      expected_roi: 130,
    },
    {
      name: 'Master Data Management',
      description: 'MDM system implementation for product and customer data',
      business_value: 'MEDIUM',
      cost_capex: 250000,
      cost_opex: 30000,
      expected_roi: 110,
    },
  ],
  culture: [
    {
      name: 'Digital Champions Program',
      description: 'Digital transformation ambassadors program across the organization',
      business_value: 'MEDIUM',
      cost_capex: 100000,
      cost_opex: 50000,
      expected_roi: 180,
    },
    {
      name: 'Digital Upskilling Academy',
      description: 'E-learning platform and digital competence certification program',
      business_value: 'HIGH',
      cost_capex: 200000,
      cost_opex: 80000,
      expected_roi: 150,
    },
  ],
  cybersecurity: [
    {
      name: 'SOC 24/7',
      description: 'Launch of Security Operations Center with 24/7 monitoring',
      business_value: 'HIGH',
      cost_capex: 600000,
      cost_opex: 200000,
      expected_roi: 95,
    },
    {
      name: 'Zero Trust Architecture',
      description: 'Implementation of Zero Trust security model',
      business_value: 'HIGH',
      cost_capex: 400000,
      cost_opex: 100000,
      expected_roi: 80,
    },
  ],
  aiMaturity: [
    {
      name: 'AI Predictive Maintenance',
      description: 'Implementation of ML-based predictive maintenance',
      business_value: 'HIGH',
      cost_capex: 350000,
      cost_opex: 70000,
      expected_roi: 200,
    },
    {
      name: 'AI Customer Service',
      description: 'AI Chatbot and customer service automation',
      business_value: 'MEDIUM',
      cost_capex: 200000,
      cost_opex: 40000,
      expected_roi: 160,
    },
    {
      name: 'Computer Vision QC',
      description: 'Automated quality control based on computer vision',
      business_value: 'HIGH',
      cost_capex: 300000,
      cost_opex: 50000,
      expected_roi: 180,
    },
  ],
};

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

async function seedDBR77Complete() {
  console.log('🌱 Seeding DBR77 Complete Training Data...\n');
  console.log(`   Database: ${isPostgres ? 'PostgreSQL' : 'SQLite'}\n`);

  try {
    // Ensure tables exist to prevent SQLITE_ERROR
    await dbRun(`CREATE TABLE IF NOT EXISTS assessment_workflows (
            id TEXT PRIMARY KEY,
            assessment_id TEXT NOT NULL,
            project_id TEXT,
            organization_id TEXT NOT NULL,
            assessment_type TEXT DEFAULT 'DRD',
            status TEXT DEFAULT 'DRAFT',
            workflow_state TEXT DEFAULT 'DRAFT',
            current_version INTEGER DEFAULT 1,
            submitted_by TEXT, submitted_at DATETIME,
            approved_by TEXT, approved_at DATETIME, approval_notes TEXT,
            rejected_by TEXT, rejected_at DATETIME, rejection_reason TEXT, axis_issues TEXT,
            created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS assessment_versions (
            id TEXT PRIMARY KEY,
            assessment_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            assessment_data TEXT NOT NULL,
            change_summary TEXT,
            changed_axes TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(assessment_id, version)
        )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS assessment_reports (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            organization_id TEXT,
            title TEXT,
            assessment_snapshot TEXT,
            summary TEXT,
            created_by TEXT,
            generated_at DATETIME
        )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS assessment_reviews (
             id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, reviewer_id TEXT NOT NULL, reviewer_role TEXT, status TEXT DEFAULT 'PENDING', rating INTEGER, comments TEXT, axis_comments TEXT, recommendation TEXT, requested_at DATETIME DEFAULT CURRENT_TIMESTAMP, due_date DATETIME, started_at DATETIME, completed_at DATETIME, FOREIGN KEY (workflow_id) REFERENCES assessment_workflows(id) ON DELETE CASCADE
        )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS assessment_axis_comments (
            id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, axis_id TEXT NOT NULL, user_id TEXT NOT NULL, comment TEXT NOT NULL, parent_comment_id TEXT, is_resolved BOOLEAN DEFAULT 0, resolved_by TEXT, resolved_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (parent_comment_id) REFERENCES assessment_axis_comments(id) ON DELETE SET NULL
        )`);

    console.log(
      '✅ Verified/Created assessment tables (workflows, versions, reports, reviews, comments)'
    );
    // 1. Find DBR77 organization (Prefer org-dbr77-test)
    let org = await dbGet(`SELECT id FROM organizations WHERE id = 'org-dbr77-test'`);
    if (!org) {
      console.log('⚠️ org-dbr77-test not found by ID, trying name search...');
      org = await dbGet(`SELECT id FROM organizations WHERE name = 'DBR77' LIMIT 1`);
    }
    if (!org) {
      // Fallback for system org if completely missing
      org = await dbGet(`SELECT id FROM organizations WHERE name LIKE '%DBR77%' LIMIT 1`);
    }

    if (!org) {
      console.error('❌ DBR77 organization not found. Run seed_dbr77 first.');
      process.exit(1);
    }
    const organizationId = org.id;
    console.log(`✅ Found DBR77 organization: ${organizationId}`);

    // 2. Find users
    const piotr = await dbGet(
      `SELECT id FROM users WHERE email LIKE '%piotr%' AND organization_id = ? LIMIT 1`,
      [organizationId]
    );
    const piotrId = piotr?.id || 'system';
    console.log(`✅ Found Piotr Wiśniewski: ${piotrId}`);

    let ctoId, cfoId;
    const existingCto = await dbGet(`SELECT id FROM users WHERE email = 'cto@dbr77.com'`);
    const existingCfo = await dbGet(`SELECT id FROM users WHERE email = 'cfo@dbr77.com'`);

    if (!existingCto) {
      ctoId = uuidv4();
      const password = bcrypt.hashSync(SEED_USER_PASSWORD, 8);
      await dbRun(
        `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status) 
                         VALUES (?, ?, 'cto@dbr77.com', ?, 'Tomasz', 'Kowalski', 'CTO', 'active')`,
        [ctoId, organizationId, password]
      );
      console.log(`✅ Created CTO user`);
    } else {
      ctoId = existingCto.id;
    }

    if (!existingCfo) {
      cfoId = uuidv4();
      const password = bcrypt.hashSync(SEED_USER_PASSWORD, 8);
      await dbRun(
        `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status) 
                         VALUES (?, ?, 'cfo@dbr77.com', ?, 'Anna', 'Nowak', 'CFO', 'active')`,
        [cfoId, organizationId, password]
      );
      console.log(`✅ Created CFO user`);
    } else {
      cfoId = existingCfo.id;
    }

    // ============================================================
    // 10 PROJECTS WITH ASSESSMENTS
    // ============================================================
    console.log('\n📁 Creating 10 projects with assessments...');

    const projectDefs = [
      { name: 'Logistics Transformation Q1 2025', profile: 'logistics', status: 'DRAFT', axes: 3 },
      { name: 'City Hospital Digitalization', profile: 'healthcare', status: 'DRAFT', axes: 3 },
      {
        name: 'Production Digitalization Q4 2024',
        profile: 'production',
        status: 'DRAFT',
        axes: 7,
      },
      { name: 'Digital Bank 2025', profile: 'banking', status: 'DRAFT', axes: 7 },
      { name: 'Smart Factory Initiative', profile: 'smartFactory', status: 'IN_REVIEW', axes: 7 },
      { name: 'Retail Omnichannel Program', profile: 'retail', status: 'IN_REVIEW', axes: 7 },
      { name: 'E-Commerce Platform', profile: 'ecommerce', status: 'AWAITING_APPROVAL', axes: 7 },
      {
        name: 'Smart Grid Transformation',
        profile: 'energy',
        status: 'AWAITING_APPROVAL',
        axes: 7,
      },
      {
        name: 'Digital Transformation 2025',
        profile: 'transformation',
        status: 'APPROVED',
        axes: 7,
      },
      { name: 'Pharma Digital Excellence', profile: 'pharma', status: 'APPROVED', axes: 7 },
    ];

    const createdProjects = [];

    for (const def of projectDefs) {
      const projectId = uuidv4();
      const assessmentId = uuidv4();
      const workflowId = uuidv4();

      // Create project
      await dbRun(
        `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at) 
                         VALUES (?, ?, ?, 'active', ?, datetime('now'))`,
        [projectId, organizationId, def.name, piotrId]
      );

      // Build axis scores
      const profile = ASSESSMENT_PROFILES[def.profile];
      const allAxes = Object.keys(profile);
      const completedAxes = def.axes === 7 ? allAxes : allAxes.slice(0, def.axes);
      const axisScores = {};

      completedAxes.forEach((axis) => {
        axisScores[axis] = profile[axis];
      });

      // Calculate overall scores
      let totalActual = 0,
        totalTarget = 0;
      Object.values(axisScores).forEach((a) => {
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
      await dbRun(
        `INSERT INTO maturity_assessments 
                         (id, project_id, axis_scores, completed_axes, overall_as_is, overall_to_be, overall_gap, is_complete, assessment_status, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          assessmentId,
          projectId,
          JSON.stringify(axisScores),
          JSON.stringify(completedAxes),
          overallAsIs,
          overallToBe,
          overallGap,
          isComplete,
          assessmentStatus,
        ]
      );

      // Create workflow - set both status and workflow_state for compatibility
      await dbRun(
        `INSERT INTO assessment_workflows 
                         (id, assessment_id, project_id, organization_id, workflow_state, status, created_by, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [workflowId, assessmentId, projectId, organizationId, def.status, def.status, piotrId]
      );

      createdProjects.push({
        ...def,
        projectId,
        assessmentId,
        workflowId,
        axisScores,
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
        if (
          proj.status === 'IN_REVIEW' ||
          proj.status === 'AWAITING_APPROVAL' ||
          proj.status === 'APPROVED'
        ) {
          const ctoReviewId = uuidv4();
          const cfoReviewId = uuidv4();
          const reviewStatus = proj.status === 'IN_REVIEW' ? 'PENDING' : 'COMPLETED';

          await dbRun(
            `INSERT INTO assessment_reviews 
                                 (id, workflow_id, reviewer_id, reviewer_role, status, rating, recommendation, requested_at)
                                 VALUES (?, ?, ?, 'CTO', ?, ?, ?, datetime('now'))`,
            [
              ctoReviewId,
              proj.workflowId,
              ctoId,
              reviewStatus,
              reviewStatus === 'COMPLETED' ? 4 : null,
              reviewStatus === 'COMPLETED' ? 'APPROVE' : null,
            ]
          );

          await dbRun(
            `INSERT INTO assessment_reviews 
                                 (id, workflow_id, reviewer_id, reviewer_role, status, rating, recommendation, requested_at)
                                 VALUES (?, ?, ?, 'CFO', ?, ?, ?, datetime('now'))`,
            [
              cfoReviewId,
              proj.workflowId,
              cfoId,
              reviewStatus,
              reviewStatus === 'COMPLETED' ? 4 : null,
              reviewStatus === 'COMPLETED' ? 'APPROVE' : null,
            ]
          );

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

          await dbRun(
            `INSERT INTO assessment_versions 
                                 (id, assessment_id, version, assessment_data, change_summary, created_by, created_at)
                                 VALUES (?, ?, 1, ?, 'Initial version', ?, datetime('now', '-14 days'))`,
            [v1Id, proj.assessmentId, JSON.stringify({ axis_scores: proj.axisScores }), piotrId]
          );

          await dbRun(
            `INSERT INTO assessment_versions 
                                 (id, assessment_id, version, assessment_data, change_summary, created_by, created_at)
                                 VALUES (?, ?, 2, ?, 'Approved version', ?, datetime('now', '-7 days'))`,
            [v2Id, proj.assessmentId, JSON.stringify({ axis_scores: proj.axisScores }), piotrId]
          );

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
    const completeProjects = createdProjects.filter((p) => p.axes === 7);

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

        await dbRun(
          `INSERT INTO initiatives 
                             (id, organization_id, project_id, title, summary, axis, status, 
                              business_value, cost_capex, cost_opex, expected_roi, owner_business_id, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            initiativeId,
            organizationId,
            proj.projectId,
            `${template.name} - ${proj.name.split(' ')[0]}`,
            template.description,
            axis,
            status,
            template.business_value,
            template.cost_capex,
            template.cost_opex,
            template.expected_roi,
            piotrId,
          ]
        );

        initiativesCreated++;
      }
    }
    console.log(`   ✅ Created ${initiativesCreated} initiatives`);

    // ============================================================
    // ASSESSMENT REPORTS (5 total)
    // ============================================================
    console.log('\n📊 Creating assessment reports...');

    let reportsCreated = 0;
    const approvedProjects = createdProjects.filter(
      (p) => p.status === 'APPROVED' || p.status === 'AWAITING_APPROVAL'
    );

    for (const proj of approvedProjects.slice(0, 5)) {
      const reportId = uuidv4();
      const summary =
        `Digital maturity assessment report for project ${proj.name}. ` +
        `Current Average Score: ${(Object.values(proj.axisScores).reduce((s, a) => s + a.actual, 0) / Object.keys(proj.axisScores).length).toFixed(1)}, ` +
        `Target: ${(Object.values(proj.axisScores).reduce((s, a) => s + a.target, 0) / Object.keys(proj.axisScores).length).toFixed(1)}. ` +
        `Key areas for improvement identified.`;

      await dbRun(
        `INSERT INTO assessment_reports 
                         (id, project_id, organization_id, title, assessment_snapshot, summary, created_by, generated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          reportId,
          proj.projectId,
          organizationId,
          `DRD Report: ${proj.name}`,
          JSON.stringify({ axisScores: proj.axisScores, generatedAt: new Date().toISOString() }),
          summary,
          piotrId,
        ]
      );

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
    console.log('   Password: <HASLO>');
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
if (import.meta.url === `file://${process.argv[1]}`) {
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

export default seedDBR77Complete;
