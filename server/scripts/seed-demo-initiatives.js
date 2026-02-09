/**
 * Seed Script: 4 Demo Initiatives for Different Templates
 *
 * Creates 4 realistic demo initiatives representing different transformation areas:
 * 1. Strategic - AI-Powered Process Automation
 * 2. Operational - Supply Chain Digital Twin
 * 3. Transformational - Customer Experience Platform
 * 4. Compliance - Data Governance & Privacy Framework
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'consultinity.db');
const db = new sqlite3.Database(DB_PATH);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

async function seedDemoInitiatives() {
  console.log('🚀 Seeding 4 demo initiatives...\n');

  try {
    // 1. Find the organization
    const org = await get('SELECT * FROM organizations WHERE name LIKE ? LIMIT 1', ['%DBR77%']);
    if (!org) {
      console.error('❌ No DBR77 organization found. Trying any org...');
      const anyOrg = await get('SELECT * FROM organizations LIMIT 1');
      if (!anyOrg) {
        console.error('❌ No organizations found at all. Run the app first.');
        return;
      }
      Object.assign(org || {}, anyOrg);
    }
    const orgId = org.id;
    console.log(`✅ Organization: ${org.name} (${orgId})`);

    // 2. Find a project to attach
    const project = await get('SELECT * FROM projects WHERE organization_id = ? LIMIT 1', [orgId]);
    const projectId = project?.id || null;
    if (project) {
      console.log(`✅ Project: ${project.name} (${projectId})`);
    } else {
      console.log('⚠️  No project found — initiatives will be unassigned');
    }

    // 3. Find a user for owner
    const user = await get('SELECT * FROM users WHERE organization_id = ? LIMIT 1', [orgId]);
    const ownerId = user?.id || null;
    if (user) {
      console.log(`✅ Owner: ${user.first_name} ${user.last_name} (${ownerId})`);
    }

    // 4. Find an assessment to link as source
    const assessment = await get(
      'SELECT * FROM multi_framework_assessments WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1',
      [orgId]
    );
    const assessmentId = assessment?.id || null;
    if (assessment) {
      console.log(`✅ Assessment: ${assessment.name || assessment.id}`);
    }

    const now = new Date().toISOString();

    // 5. Define 4 demo initiatives
    const initiatives = [
      {
        id: uuidv4(),
        title: 'AI-Powered Process Automation',
        axis: 'strategic',
        area: 'Digital Processes',
        status: 'DRAFT',
        summary:
          'Implement intelligent process automation across key operational workflows using AI/ML models to reduce manual effort by 60% and improve accuracy. Focus areas include invoice processing, quality inspection, and production scheduling.',
        problemStatement:
          'Current manual processes in finance, quality, and production planning lead to delays, errors, and high operational costs. The organization spends approximately 2,400 FTE hours annually on tasks that can be automated.',
        hypothesis:
          'By deploying AI-driven automation for the top 5 high-volume processes, we can achieve 60% reduction in processing time and 85% reduction in error rates within 6 months of deployment.',
        businessValue: 850000,
        costCapex: 320000,
        costOpex: 45000,
        expectedRoi: 165,
        confidenceLevel: 'high',
        valueTiming: '6-12 months',
        priority: 'HIGH',
        plannedStartDate: '2026-03-01T00:00:00.000Z',
        plannedEndDate: '2026-09-30T00:00:00.000Z',
        deliverables: JSON.stringify([
          'AI model for invoice processing',
          'Automated quality inspection pipeline',
          'Production scheduling optimizer',
          'Integration with ERP system',
          'Training program for operations team',
        ]),
        successCriteria: JSON.stringify([
          '60% reduction in manual processing time',
          '85% reduction in data entry errors',
          'ROI positive within 8 months',
          '95% user adoption rate',
        ]),
        keyRisks: JSON.stringify([
          'Data quality insufficient for ML training',
          'Integration complexity with legacy ERP',
          'Change resistance from operations staff',
        ]),
      },
      {
        id: uuidv4(),
        title: 'Supply Chain Digital Twin',
        axis: 'operational',
        area: 'Logistics Processes',
        status: 'PLANNING',
        summary:
          'Build a real-time digital twin of the entire supply chain to enable predictive analytics, scenario planning, and proactive risk management. The digital twin will model suppliers, warehouses, transportation, and demand patterns.',
        problemStatement:
          'Supply chain disruptions cost the organization €2.1M annually in expediting costs, stockouts, and excess inventory. Current visibility is limited to T+1 day reporting with no predictive capability.',
        hypothesis:
          'A digital twin providing real-time visibility and predictive analytics will reduce supply chain disruption costs by 40% and improve inventory turnover by 25%.',
        businessValue: 1200000,
        costCapex: 480000,
        costOpex: 72000,
        expectedRoi: 130,
        confidenceLevel: 'medium',
        valueTiming: '12-18 months',
        priority: 'HIGH',
        plannedStartDate: '2026-04-01T00:00:00.000Z',
        plannedEndDate: '2027-03-31T00:00:00.000Z',
        deliverables: JSON.stringify([
          'Digital twin data model',
          'Real-time data integration layer',
          'Predictive disruption alert system',
          'Scenario planning dashboard',
          'Supplier risk scoring engine',
        ]),
        successCriteria: JSON.stringify([
          '40% reduction in disruption costs',
          '25% improvement in inventory turnover',
          'Real-time visibility across 90% of supply chain',
          'Predictive accuracy > 80% for disruptions',
        ]),
        keyRisks: JSON.stringify([
          'Supplier data sharing resistance',
          'Complex integration with 12+ data sources',
          'Model accuracy dependent on data completeness',
        ]),
      },
      {
        id: uuidv4(),
        title: 'Customer Experience Platform',
        axis: 'transformational',
        area: 'Sales Processes',
        status: 'DRAFT',
        summary:
          'Deploy an omnichannel customer experience platform that unifies all touchpoints (web, mobile, support, sales) with AI-powered personalization, real-time analytics, and automated journey orchestration.',
        problemStatement:
          'Customer satisfaction scores have dropped 12% YoY due to fragmented experiences across channels. Average resolution time is 48h and the customer churn rate has increased to 8.5%. There is no unified view of the customer journey.',
        hypothesis:
          'An integrated CX platform with AI-driven personalization will increase NPS by 20 points, reduce churn by 3 percentage points, and increase customer lifetime value by 30%.',
        businessValue: 2100000,
        costCapex: 650000,
        costOpex: 95000,
        expectedRoi: 180,
        confidenceLevel: 'medium',
        valueTiming: '9-15 months',
        priority: 'CRITICAL',
        plannedStartDate: '2026-03-15T00:00:00.000Z',
        plannedEndDate: '2027-01-31T00:00:00.000Z',
        deliverables: JSON.stringify([
          'Unified customer data platform (CDP)',
          'AI personalization engine',
          'Omnichannel journey orchestrator',
          'Real-time analytics dashboard',
          'Self-service portal redesign',
          'Customer feedback loop automation',
        ]),
        successCriteria: JSON.stringify([
          'NPS increase by 20 points within 12 months',
          'Customer churn reduced from 8.5% to 5.5%',
          '30% increase in customer lifetime value',
          'First contact resolution rate > 75%',
        ]),
        keyRisks: JSON.stringify([
          'Data privacy compliance (GDPR)',
          'Legacy CRM migration complexity',
          'Cross-departmental alignment required',
          'Customer adoption of new channels',
        ]),
      },
      {
        id: uuidv4(),
        title: 'Data Governance & Privacy Framework',
        axis: 'compliance',
        area: 'Quality Processes',
        status: 'PLANNING',
        summary:
          'Establish a comprehensive data governance framework with automated data quality monitoring, privacy compliance (GDPR/NIS2), data catalog, and role-based access controls across all enterprise data assets.',
        problemStatement:
          'The organization has no centralized data governance. Data quality issues affect 23% of reports, there are 4 known GDPR compliance gaps, and data silos prevent cross-functional analytics. Regulatory risk exposure is estimated at €5M.',
        hypothesis:
          'A mature data governance framework will eliminate compliance gaps within 6 months, improve data quality scores to >95%, and enable self-service analytics for 80% of business users.',
        businessValue: 600000,
        costCapex: 180000,
        costOpex: 35000,
        expectedRoi: 210,
        confidenceLevel: 'high',
        valueTiming: '3-6 months',
        priority: 'MEDIUM',
        plannedStartDate: '2026-02-15T00:00:00.000Z',
        plannedEndDate: '2026-08-31T00:00:00.000Z',
        deliverables: JSON.stringify([
          'Enterprise data catalog',
          'Automated data quality monitoring',
          'GDPR compliance automation toolkit',
          'Role-based access control framework',
          'Data stewardship program',
          'Executive data quality dashboard',
        ]),
        successCriteria: JSON.stringify([
          'Zero GDPR compliance gaps',
          'Data quality score > 95%',
          '80% of business users on self-service analytics',
          'Data incident response time < 4 hours',
        ]),
        keyRisks: JSON.stringify([
          'Organizational resistance to data ownership model',
          'Complexity of legacy data systems audit',
          'Resource allocation for data stewards',
        ]),
      },
    ];

    // 6. Insert initiatives (using actual DB column names)
    console.log('\n📋 Creating initiatives...');

    for (const init of initiatives) {
      try {
        await run(
          `INSERT INTO initiatives (
            id, organization_id, project_id, name, axis, area, summary, hypothesis, status,
            business_value, cost_capex, cost_opex, expected_roi, estimated_budget, estimated_roi, timeline,
            start_date, end_date,
            owner_business_id,
            problem_statement, deliverables, success_criteria, key_risks,
            source_type, source_id, source_assessment_id,
            risk_level, ai_generated, progress, charter_completeness,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            init.id,
            orgId,
            projectId,
            init.title,
            init.axis,
            init.area,
            init.summary,
            init.hypothesis,
            init.status,
            init.businessValue,
            init.costCapex,
            init.costOpex,
            init.expectedRoi,
            init.costCapex + init.costOpex, // estimated_budget
            init.expectedRoi, // estimated_roi
            init.valueTiming, // timeline
            init.plannedStartDate,
            init.plannedEndDate,
            ownerId,
            init.problemStatement,
            init.deliverables,
            init.successCriteria,
            init.keyRisks,
            assessmentId ? 'ASSESSMENT' : null,
            assessmentId,
            assessmentId,
            init.priority === 'CRITICAL' ? 'high' : init.priority === 'HIGH' ? 'medium' : 'low',
            0, // ai_generated
            init.status === 'PLANNING' ? 25 : 0,
            init.status === 'PLANNING' ? 40 : 15,
            now,
            now,
          ]
        );
        console.log(`  ✅ ${init.title} [${init.axis}] — ${init.status}`);
      } catch (err) {
        console.error(`  ❌ Failed to insert "${init.title}":`, err.message);
      }
    }

    // 7. Link to assessment if available
    if (assessmentId) {
      console.log('\n🔗 Linking initiatives to assessment...');
      const batchId = uuidv4();
      for (const init of initiatives) {
        try {
          await run(
            `INSERT INTO assessment_initiative_links (id, assessment_id, batch_id, initiative_id, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), assessmentId, batchId, init.id, now]
          );
        } catch {
          // Table might not exist — skip
        }
      }
      console.log('  ✅ Linked to assessment');
    }

    console.log('\n✨ Done! 4 demo initiatives created successfully.');
    console.log('   Refresh the Initiatives tab in the app to see them.\n');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    db.close();
  }
}

seedDemoInitiatives();
