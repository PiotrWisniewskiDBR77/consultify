/**
 * English Test Data Seed Script
 *
 * Creates comprehensive English test data for manual testing of:
 * - SuperAdmin screens
 * - Admin screens
 * - Settings screens
 *
 * All data uses English language for testing purposes.
 *
 * Usage:
 *   node server/scripts/seedEnglishTestData.js [--clean] [--verify]
 *
 * Options:
 *   --clean   Remove existing test data before seeding
 *   --verify  Only verify existing data, don't seed
 *
 * @module seedEnglishTestData
 */

import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
const sqlite3 = require('sqlite3').verbose();

// Production guard
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Error: Test data seed script cannot run in production environment.');
  process.exit(1);
}

const DEFAULT_PASSWORD = String(process.env.SEED_USER_PASSWORD || '').trim();
if (!DEFAULT_PASSWORD) {
  console.error('[ODMOWA] Brak zmiennej SEED_USER_PASSWORD. Ustaw ją przed uruchomieniem seeda.');
  process.exit(1);
}

const dbPath = path.resolve(__dirname, '../consultinity.db');
const db = new sqlite3.Database(dbPath);

const HASHED_PASSWORD = bcrypt.hashSync(DEFAULT_PASSWORD, 8);

// Fixed IDs for test data
const TEST_IDS = {
  // SuperAdmin user
  SUPERADMIN: 'test-superadmin-001',

  // Organizations (5-10 test orgs)
  ORG_ACME: 'test-org-acme-001',
  ORG_TECHNOVA: 'test-org-technova-001',
  ORG_GLOBEX: 'test-org-globex-001',
  ORG_INNOVATE: 'test-org-innovate-001',
  ORG_DIGITAL: 'test-org-digital-001',

  // Users (20-30 test users)
  USER_JOHN: 'test-user-john-001',
  USER_JANE: 'test-user-jane-001',
  USER_MIKE: 'test-user-mike-001',
  USER_SARAH: 'test-user-sarah-001',
  USER_DAVID: 'test-user-david-001',
  USER_EMILY: 'test-user-emily-001',
  USER_CHRIS: 'test-user-chris-001',
  USER_LISA: 'test-user-lisa-001',
  USER_ROBERT: 'test-user-robert-001',
  USER_AMANDA: 'test-user-amanda-001',
  USER_JAMES: 'test-user-james-001',
  USER_MARIA: 'test-user-maria-001',
  USER_THOMAS: 'test-user-thomas-001',
  USER_JENNIFER: 'test-user-jennifer-001',
  USER_WILLIAM: 'test-user-william-001',
  USER_PATRICIA: 'test-user-patricia-001',
  USER_RICHARD: 'test-user-richard-001',
  USER_LINDA: 'test-user-linda-001',
  USER_JOSEPH: 'test-user-joseph-001',
  USER_BARBARA: 'test-user-barbara-001',
  USER_CHARLES: 'test-user-charles-001',
  USER_ELIZABETH: 'test-user-elizabeth-001',
  USER_DANIEL: 'test-user-daniel-001',
  USER_SUSAN: 'test-user-susan-001',
  USER_MATTHEW: 'test-user-matthew-001',
  USER_NANCY: 'test-user-nancy-001',
  USER_ANTHONY: 'test-user-anthony-001',
  USER_KAREN: 'test-user-karen-001',
  USER_MARK: 'test-user-mark-001',
  USER_BETTY: 'test-user-betty-001',
};

// English names for users
const USER_DATA = [
  {
    id: TEST_IDS.USER_JOHN,
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@acme.com',
    role: 'ADMIN',
    org: TEST_IDS.ORG_ACME,
  },
  {
    id: TEST_IDS.USER_JANE,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@acme.com',
    role: 'USER',
    org: TEST_IDS.ORG_ACME,
  },
  {
    id: TEST_IDS.USER_MIKE,
    firstName: 'Mike',
    lastName: 'Johnson',
    email: 'mike.johnson@acme.com',
    role: 'USER',
    org: TEST_IDS.ORG_ACME,
  },
  {
    id: TEST_IDS.USER_SARAH,
    firstName: 'Sarah',
    lastName: 'Williams',
    email: 'sarah.williams@technova.com',
    role: 'ADMIN',
    org: TEST_IDS.ORG_TECHNOVA,
  },
  {
    id: TEST_IDS.USER_DAVID,
    firstName: 'David',
    lastName: 'Brown',
    email: 'david.brown@technova.com',
    role: 'USER',
    org: TEST_IDS.ORG_TECHNOVA,
  },
  {
    id: TEST_IDS.USER_EMILY,
    firstName: 'Emily',
    lastName: 'Davis',
    email: 'emily.davis@technova.com',
    role: 'USER',
    org: TEST_IDS.ORG_TECHNOVA,
  },
  {
    id: TEST_IDS.USER_CHRIS,
    firstName: 'Chris',
    lastName: 'Miller',
    email: 'chris.miller@globex.com',
    role: 'ADMIN',
    org: TEST_IDS.ORG_GLOBEX,
  },
  {
    id: TEST_IDS.USER_LISA,
    firstName: 'Lisa',
    lastName: 'Wilson',
    email: 'lisa.wilson@globex.com',
    role: 'USER',
    org: TEST_IDS.ORG_GLOBEX,
  },
  {
    id: TEST_IDS.USER_ROBERT,
    firstName: 'Robert',
    lastName: 'Moore',
    email: 'robert.moore@innovate.com',
    role: 'ADMIN',
    org: TEST_IDS.ORG_INNOVATE,
  },
  {
    id: TEST_IDS.USER_AMANDA,
    firstName: 'Amanda',
    lastName: 'Taylor',
    email: 'amanda.taylor@innovate.com',
    role: 'USER',
    org: TEST_IDS.ORG_INNOVATE,
  },
  {
    id: TEST_IDS.USER_JAMES,
    firstName: 'James',
    lastName: 'Anderson',
    email: 'james.anderson@digital.com',
    role: 'ADMIN',
    org: TEST_IDS.ORG_DIGITAL,
  },
  {
    id: TEST_IDS.USER_MARIA,
    firstName: 'Maria',
    lastName: 'Thomas',
    email: 'maria.thomas@digital.com',
    role: 'USER',
    org: TEST_IDS.ORG_DIGITAL,
  },
  {
    id: TEST_IDS.USER_THOMAS,
    firstName: 'Thomas',
    lastName: 'Jackson',
    email: 'thomas.jackson@acme.com',
    role: 'VIEWER',
    org: TEST_IDS.ORG_ACME,
  },
  {
    id: TEST_IDS.USER_JENNIFER,
    firstName: 'Jennifer',
    lastName: 'White',
    email: 'jennifer.white@technova.com',
    role: 'VIEWER',
    org: TEST_IDS.ORG_TECHNOVA,
  },
  {
    id: TEST_IDS.USER_WILLIAM,
    firstName: 'William',
    lastName: 'Harris',
    email: 'william.harris@globex.com',
    role: 'USER',
    org: TEST_IDS.ORG_GLOBEX,
  },
  {
    id: TEST_IDS.USER_PATRICIA,
    firstName: 'Patricia',
    lastName: 'Martin',
    email: 'patricia.martin@innovate.com',
    role: 'USER',
    org: TEST_IDS.ORG_INNOVATE,
  },
  {
    id: TEST_IDS.USER_RICHARD,
    firstName: 'Richard',
    lastName: 'Thompson',
    email: 'richard.thompson@digital.com',
    role: 'USER',
    org: TEST_IDS.ORG_DIGITAL,
  },
  {
    id: TEST_IDS.USER_LINDA,
    firstName: 'Linda',
    lastName: 'Garcia',
    email: 'linda.garcia@acme.com',
    role: 'USER',
    org: TEST_IDS.ORG_ACME,
  },
  {
    id: TEST_IDS.USER_JOSEPH,
    firstName: 'Joseph',
    lastName: 'Martinez',
    email: 'joseph.martinez@technova.com',
    role: 'USER',
    org: TEST_IDS.ORG_TECHNOVA,
  },
  {
    id: TEST_IDS.USER_BARBARA,
    firstName: 'Barbara',
    lastName: 'Robinson',
    email: 'barbara.robinson@globex.com',
    role: 'USER',
    org: TEST_IDS.ORG_GLOBEX,
  },
  {
    id: TEST_IDS.USER_CHARLES,
    firstName: 'Charles',
    lastName: 'Clark',
    email: 'charles.clark@innovate.com',
    role: 'USER',
    org: TEST_IDS.ORG_INNOVATE,
  },
  {
    id: TEST_IDS.USER_ELIZABETH,
    firstName: 'Elizabeth',
    lastName: 'Rodriguez',
    email: 'elizabeth.rodriguez@digital.com',
    role: 'USER',
    org: TEST_IDS.ORG_DIGITAL,
  },
  {
    id: TEST_IDS.USER_DANIEL,
    firstName: 'Daniel',
    lastName: 'Lewis',
    email: 'daniel.lewis@acme.com',
    role: 'USER',
    org: TEST_IDS.ORG_ACME,
  },
  {
    id: TEST_IDS.USER_SUSAN,
    firstName: 'Susan',
    lastName: 'Lee',
    email: 'susan.lee@technova.com',
    role: 'USER',
    org: TEST_IDS.ORG_TECHNOVA,
  },
  {
    id: TEST_IDS.USER_MATTHEW,
    firstName: 'Matthew',
    lastName: 'Walker',
    email: 'matthew.walker@globex.com',
    role: 'USER',
    org: TEST_IDS.ORG_GLOBEX,
  },
  {
    id: TEST_IDS.USER_NANCY,
    firstName: 'Nancy',
    lastName: 'Hall',
    email: 'nancy.hall@innovate.com',
    role: 'USER',
    org: TEST_IDS.ORG_INNOVATE,
  },
  {
    id: TEST_IDS.USER_ANTHONY,
    firstName: 'Anthony',
    lastName: 'Allen',
    email: 'anthony.allen@digital.com',
    role: 'USER',
    org: TEST_IDS.ORG_DIGITAL,
  },
  {
    id: TEST_IDS.USER_KAREN,
    firstName: 'Karen',
    lastName: 'Young',
    email: 'karen.young@acme.com',
    role: 'USER',
    org: TEST_IDS.ORG_ACME,
  },
  {
    id: TEST_IDS.USER_MARK,
    firstName: 'Mark',
    lastName: 'King',
    email: 'mark.king@technova.com',
    role: 'USER',
    org: TEST_IDS.ORG_TECHNOVA,
  },
  {
    id: TEST_IDS.USER_BETTY,
    firstName: 'Betty',
    lastName: 'Wright',
    email: 'betty.wright@globex.com',
    role: 'USER',
    org: TEST_IDS.ORG_GLOBEX,
  },
];

// Organization data
const ORG_DATA = [
  {
    id: TEST_IDS.ORG_ACME,
    name: 'Acme Corporation',
    plan: 'professional',
    status: 'active',
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  },
  {
    id: TEST_IDS.ORG_TECHNOVA,
    name: 'Technova Solutions',
    plan: 'enterprise',
    status: 'active',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
  },
  {
    id: TEST_IDS.ORG_GLOBEX,
    name: 'Globex Industries',
    plan: 'professional',
    status: 'active',
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
  },
  {
    id: TEST_IDS.ORG_INNOVATE,
    name: 'Innovate Labs',
    plan: 'free',
    status: 'trial',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
  },
  {
    id: TEST_IDS.ORG_DIGITAL,
    name: 'Digital Dynamics',
    plan: 'enterprise',
    status: 'active',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
];

// Helper function to run SQL
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Seed SuperAdmin user
async function seedSuperAdmin() {
  console.log('Seeding SuperAdmin user...');
  try {
    await dbRun(
      `INSERT OR REPLACE INTO users (id, email, password, first_name, last_name, role, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        TEST_IDS.SUPERADMIN,
        'superadmin@consultinity.com',
        HASHED_PASSWORD,
        'Super',
        'Admin',
        'SUPERADMIN',
        'active',
      ]
    );
    console.log('✓ SuperAdmin user created: superadmin@consultinity.com / test<HASLO>');
  } catch (error) {
    console.error('Error seeding SuperAdmin:', error);
    throw error;
  }
}

// Seed Organizations
async function seedOrganizations() {
  console.log('Seeding Organizations...');
  for (const org of ORG_DATA) {
    try {
      await dbRun(
        `INSERT OR REPLACE INTO organizations (id, name, plan, status, created_at, organization_type)
                 VALUES (?, ?, ?, ?, ?, ?)`,
        [
          org.id,
          org.name,
          org.plan,
          org.status,
          org.createdAt.toISOString(),
          org.status === 'trial' ? 'TRIAL' : 'PAID',
        ]
      );
    } catch (error) {
      console.error(`Error seeding organization ${org.name}:`, error);
    }
  }
  console.log(`✓ Created ${ORG_DATA.length} organizations`);
}

// Seed Users
async function seedUsers() {
  console.log('Seeding Users...');
  for (const user of USER_DATA) {
    try {
      await dbRun(
        `INSERT OR REPLACE INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at, last_login)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '-' || abs(random() % 7) || ' days'))`,
        [
          user.id,
          user.org,
          user.email,
          HASHED_PASSWORD,
          user.firstName,
          user.lastName,
          user.role,
          'active',
        ]
      );
    } catch (error) {
      console.error(`Error seeding user ${user.email}:`, error);
    }
  }
  console.log(`✓ Created ${USER_DATA.length} users`);
}

// Seed Projects
async function seedProjects() {
  console.log('Seeding Projects...');
  const projectNames = [
    'Digital Transformation Initiative',
    'Cloud Migration Project',
    'AI Integration Program',
    'Customer Experience Enhancement',
    'Process Automation Initiative',
    'Data Analytics Platform',
    'Mobile App Development',
    'Security Enhancement Project',
    'Infrastructure Modernization',
    'Product Innovation Lab',
    'Supply Chain Optimization',
    'Marketing Automation System',
    'HR Digitalization',
    'Financial System Upgrade',
    'E-commerce Platform',
    'IoT Implementation',
    'Blockchain Pilot',
    'Machine Learning Platform',
    'DevOps Transformation',
    'Quality Assurance System',
  ];

  let projectCount = 0;
  for (const org of ORG_DATA) {
    // Create 3-4 projects per organization
    const numProjects = Math.floor(Math.random() * 2) + 3;
    const orgUsers = USER_DATA.filter((u) => u.org === org.id);
    const adminUser = orgUsers.find((u) => u.role === 'ADMIN') || orgUsers[0];

    for (let i = 0; i < numProjects && projectCount < projectNames.length; i++) {
      const projectId = uuidv4();
      const projectName = projectNames[projectCount % projectNames.length];
      const statuses = ['active', 'planning', 'completed', 'on_hold'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      try {
        await dbRun(
          `INSERT OR REPLACE INTO projects (id, organization_id, name, status, owner_id, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, datetime('now', '-' || abs(random() % 30) || ' days'), datetime('now'))`,
          [projectId, org.id, projectName, status, adminUser.id]
        );
        projectCount++;
      } catch (error) {
        console.error(`Error seeding project ${projectName}:`, error);
      }
    }
  }
  console.log(`✓ Created ${projectCount} projects`);
}

// Seed Billing Data
async function seedBillingData() {
  console.log('Seeding Billing Data...');

  // Create invoices
  for (const org of ORG_DATA) {
    if (org.status === 'trial') continue;

    // Create 3-6 invoices per organization
    const numInvoices = Math.floor(Math.random() * 4) + 3;
    for (let i = 0; i < numInvoices; i++) {
      const invoiceId = uuidv4();
      const amount =
        org.plan === 'enterprise' ? 999 + Math.random() * 500 : 299 + Math.random() * 200;
      const statuses = ['paid', 'pending', 'overdue'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const createdAt = new Date(Date.now() - (i * 30 + Math.random() * 10) * 24 * 60 * 60 * 1000);

      try {
        await dbRun(
          `INSERT OR REPLACE INTO invoices (id, organization_id, amount, status, created_at, due_date, paid_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            org.id,
            amount.toFixed(2),
            status,
            createdAt.toISOString(),
            new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status === 'paid'
              ? new Date(
                  createdAt.getTime() + Math.random() * 10 * 24 * 60 * 60 * 1000
                ).toISOString()
              : null,
          ]
        );
      } catch (error) {
        console.error(`Error seeding invoice for ${org.name}:`, error);
      }
    }
  }
  console.log('✓ Created invoices');
}

// Seed API Keys
async function seedApiKeys() {
  console.log('Seeding API Keys...');

  // Create API keys for some users
  const keyUsers = USER_DATA.slice(0, 8); // First 8 users get API keys
  for (const user of keyUsers) {
    const keyId = uuidv4();
    const keyPrefix = 'ck_live_';
    const keyValue = keyPrefix + crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(keyValue).digest('hex');

    try {
      await dbRun(
        `INSERT OR REPLACE INTO api_keys (id, user_id, organization_id, name, key_hash, prefix, scopes, rate_limit, quota_limit, quota_used, created_at, last_used_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '-' || abs(random() % 7) || ' days'))`,
        [
          keyId,
          user.id,
          user.org,
          `${user.firstName}'s API Key`,
          keyHash,
          keyPrefix,
          JSON.stringify(['read', 'write']),
          1000,
          100000,
          Math.floor(Math.random() * 50000),
        ]
      );
    } catch (error) {
      console.error(`Error seeding API key for ${user.email}:`, error);
    }
  }
  console.log(`✓ Created ${keyUsers.length} API keys`);
}

// Seed Audit Logs
async function seedAuditLogs() {
  console.log('Seeding Audit Logs...');

  const actions = ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'LOGIN', 'LOGOUT'];
  const resources = ['Project', 'Task', 'User', 'Organization', 'Settings', 'Document'];

  // Create 50-100 audit log entries
  const numLogs = 75;
  for (let i = 0; i < numLogs; i++) {
    const logId = uuidv4();
    const user = USER_DATA[Math.floor(Math.random() * USER_DATA.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const resource = resources[Math.floor(Math.random() * resources.length)];
    const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);

    try {
      await dbRun(
        `INSERT OR REPLACE INTO audit_logs (id, organization_id, user_id, action_type, resource_type, resource_id, details, ip_address, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logId,
          user.org,
          user.id,
          action,
          resource,
          uuidv4(),
          JSON.stringify({ description: `${action} ${resource}` }),
          `192.168.1.${Math.floor(Math.random() * 255)}`,
          timestamp.toISOString(),
        ]
      );
    } catch (error) {
      console.error(`Error seeding audit log ${i}:`, error);
    }
  }
  console.log(`✓ Created ${numLogs} audit log entries`);
}

// Seed Notifications
async function seedNotifications() {
  console.log('Seeding Notifications...');

  const notificationTypes = [
    {
      type: 'system',
      title: 'System Update Available',
      message: 'A new system update is available. Please review the release notes.',
    },
    {
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: 'You have been assigned a new task: Review Q1 Report',
    },
    {
      type: 'info',
      title: 'Feature Announcement',
      message: 'New AI capabilities have been added to the platform.',
    },
    { type: 'alert', title: 'Security Alert', message: 'New login detected from a new device.' },
    {
      type: 'ai_insight',
      title: 'AI Recommendation',
      message: 'Based on your recent activity, we suggest optimizing your workflow.',
    },
  ];

  // Create 30-40 notifications
  const numNotifications = 35;
  for (let i = 0; i < numNotifications; i++) {
    const notifId = uuidv4();
    const user = USER_DATA[Math.floor(Math.random() * USER_DATA.length)];
    const notifType = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
    const priority = ['high', 'normal', 'low'][Math.floor(Math.random() * 3)];
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const isRead = Math.random() > 0.3; // 70% read

    try {
      await dbRun(
        `INSERT OR REPLACE INTO notifications (id, user_id, organization_id, type, title, message, priority, is_read, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          notifId,
          user.id,
          user.org,
          notifType.type,
          notifType.title,
          notifType.message,
          priority,
          isRead ? 1 : 0,
          timestamp.toISOString(),
        ]
      );
    } catch (error) {
      console.error(`Error seeding notification ${i}:`, error);
    }
  }
  console.log(`✓ Created ${numNotifications} notifications`);
}

// Seed Webhooks
async function seedWebhooks() {
  console.log('Seeding Webhooks...');

  const webhookUsers = USER_DATA.slice(0, 5); // First 5 users get webhooks
  for (const user of webhookUsers) {
    const webhookId = uuidv4();
    const eventTypes = ['task.created', 'task.updated', 'project.created', 'user.created'];
    const selectedEvents = eventTypes.slice(0, Math.floor(Math.random() * eventTypes.length) + 1);

    try {
      await dbRun(
        `INSERT OR REPLACE INTO webhooks (id, user_id, organization_id, name, url, event_types, secret, is_active, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          webhookId,
          user.id,
          user.org,
          `${user.firstName}'s Webhook`,
          `https://api.example.com/webhooks/${webhookId}`,
          JSON.stringify(selectedEvents),
          crypto.randomBytes(32).toString('hex'),
          1,
        ]
      );
    } catch (error) {
      console.error(`Error seeding webhook for ${user.email}:`, error);
    }
  }
  console.log(`✓ Created ${webhookUsers.length} webhooks`);
}

// Seed Login History
async function seedLoginHistory() {
  console.log('Seeding Login History...');

  // Create login history for all users
  for (const user of USER_DATA) {
    // Create 3-8 login entries per user
    const numLogins = Math.floor(Math.random() * 6) + 3;
    for (let i = 0; i < numLogins; i++) {
      const loginId = uuidv4();
      const statuses = ['success', 'success', 'success', 'failed']; // Mostly success
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const locations = [
        'New York, USA',
        'London, UK',
        'San Francisco, USA',
        'Toronto, Canada',
        'Sydney, Australia',
      ];
      const location = locations[Math.floor(Math.random() * locations.length)];
      const ip = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      const userAgent = [
        'Chrome on Windows',
        'Safari on macOS',
        'Firefox on Linux',
        'Chrome on macOS',
      ][Math.floor(Math.random() * 4)];

      try {
        await dbRun(
          `INSERT OR REPLACE INTO login_history (id, user_id, ip_address, user_agent, location, status, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [loginId, user.id, ip, userAgent, location, status, timestamp.toISOString()]
        );
      } catch (error) {
        console.error(`Error seeding login history for ${user.email}:`, error);
      }
    }
  }
  console.log('✓ Created login history entries');
}

// Seed AI Usage Data
async function seedAIUsage() {
  console.log('Seeding AI Usage Data...');

  // Create AI audit logs for usage tracking
  const numEntries = 100;
  for (let i = 0; i < numEntries; i++) {
    const entryId = uuidv4();
    const org = ORG_DATA[Math.floor(Math.random() * ORG_DATA.length)];
    const user = USER_DATA.find((u) => u.org === org.id) || USER_DATA[0];
    const tokens = Math.floor(Math.random() * 50000) + 10000;
    const cost = tokens * 0.00001; // Approximate cost
    const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'];
    const model = models[Math.floor(Math.random() * models.length)];

    try {
      await dbRun(
        `INSERT OR REPLACE INTO ai_audit_logs (id, organization_id, user_id, model, tokens_used, cost_usd, capability, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [entryId, org.id, user.id, model, tokens, cost.toFixed(6), 'chat', timestamp.toISOString()]
      );
    } catch (error) {
      // Table might not exist, skip silently
    }
  }
  console.log(`✓ Created ${numEntries} AI usage entries`);
}

// Main seed function
async function seedAll() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  ENGLISH TEST DATA SEED SCRIPT');
  console.log('═══════════════════════════════════════════════════');

  try {
    await seedSuperAdmin();
    await seedOrganizations();
    await seedUsers();
    await seedProjects();
    await seedBillingData();
    await seedApiKeys();
    await seedAuditLogs();
    await seedNotifications();
    await seedWebhooks();
    await seedLoginHistory();
    await seedAIUsage();

    console.log('\n✅ All test data seeded successfully!');
    console.log('\nTest Accounts:');
    console.log('  SuperAdmin: superadmin@consultinity.com / test<HASLO>');
    console.log('  Admin (Acme): john.smith@acme.com / test<HASLO>');
    console.log('  Admin (Technova): sarah.williams@technova.com / test<HASLO>');
    console.log('  User: jane.doe@acme.com / test<HASLO>');
    console.log('\nAll users use password: test<HASLO>');
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  }
}

// Cleanup function
async function cleanup() {
  console.log('Cleaning up existing test data...');
  try {
    // Delete test data (identified by test- prefix in IDs)
    await dbRun(
      `DELETE FROM notifications WHERE user_id LIKE 'test-%' OR organization_id LIKE 'test-%'`
    );
    await dbRun(
      `DELETE FROM webhooks WHERE user_id LIKE 'test-%' OR organization_id LIKE 'test-%'`
    );
    await dbRun(
      `DELETE FROM api_keys WHERE user_id LIKE 'test-%' OR organization_id LIKE 'test-%'`
    );
    await dbRun(`DELETE FROM login_history WHERE user_id LIKE 'test-%'`);
    await dbRun(
      `DELETE FROM audit_logs WHERE user_id LIKE 'test-%' OR organization_id LIKE 'test-%'`
    );
    await dbRun(`DELETE FROM projects WHERE organization_id LIKE 'test-%'`);
    await dbRun(`DELETE FROM invoices WHERE organization_id LIKE 'test-%'`);
    await dbRun(`DELETE FROM users WHERE id LIKE 'test-%'`);
    await dbRun(`DELETE FROM organizations WHERE id LIKE 'test-%'`);
    console.log('✓ Cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Verify function
async function verify() {
  console.log('Verifying test data...');
  const checks = [];

  try {
    const orgCount = await dbGet(
      `SELECT COUNT(*) as count FROM organizations WHERE id LIKE 'test-%'`
    );
    checks.push({
      name: 'Organizations',
      passed: orgCount.count >= 5,
      details: `${orgCount.count} organizations`,
    });

    const userCount = await dbGet(`SELECT COUNT(*) as count FROM users WHERE id LIKE 'test-%'`);
    checks.push({
      name: 'Users',
      passed: userCount.count >= 20,
      details: `${userCount.count} users`,
    });

    const projectCount = await dbGet(
      `SELECT COUNT(*) as count FROM projects WHERE organization_id LIKE 'test-%'`
    );
    checks.push({
      name: 'Projects',
      passed: projectCount.count >= 15,
      details: `${projectCount.count} projects`,
    });

    const invoiceCount = await dbGet(
      `SELECT COUNT(*) as count FROM invoices WHERE organization_id LIKE 'test-%'`
    );
    checks.push({
      name: 'Invoices',
      passed: invoiceCount.count >= 10,
      details: `${invoiceCount.count} invoices`,
    });

    const apiKeyCount = await dbGet(
      `SELECT COUNT(*) as count FROM api_keys WHERE user_id LIKE 'test-%'`
    );
    checks.push({
      name: 'API Keys',
      passed: apiKeyCount.count >= 5,
      details: `${apiKeyCount.count} API keys`,
    });

    const auditCount = await dbGet(
      `SELECT COUNT(*) as count FROM audit_logs WHERE organization_id LIKE 'test-%'`
    );
    checks.push({
      name: 'Audit Logs',
      passed: auditCount.count >= 50,
      details: `${auditCount.count} audit logs`,
    });

    const notifCount = await dbGet(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id LIKE 'test-%'`
    );
    checks.push({
      name: 'Notifications',
      passed: notifCount.count >= 30,
      details: `${notifCount.count} notifications`,
    });

    const webhookCount = await dbGet(
      `SELECT COUNT(*) as count FROM webhooks WHERE user_id LIKE 'test-%'`
    );
    checks.push({
      name: 'Webhooks',
      passed: webhookCount.count >= 5,
      details: `${webhookCount.count} webhooks`,
    });

    const loginCount = await dbGet(
      `SELECT COUNT(*) as count FROM login_history WHERE user_id LIKE 'test-%'`
    );
    checks.push({
      name: 'Login History',
      passed: loginCount.count >= 50,
      details: `${loginCount.count} login entries`,
    });

    let allPassed = true;
    for (const check of checks) {
      const icon = check.passed ? '✓' : '✗';
      const color = check.passed ? '\x1b[32m' : '\x1b[31m';
      console.log(`${color}${icon} \x1b[0m ${check.name}: ${check.details}`);
      if (!check.passed) allPassed = false;
    }

    console.log('\n' + (allPassed ? '✅ All checks passed!' : '❌ Some checks failed'));
    return allPassed;
  } catch (error) {
    console.error('Error during verification:', error);
    return false;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const shouldClean = args.includes('--clean');
  const verifyOnly = args.includes('--verify');

  try {
    if (verifyOnly) {
      const passed = await verify();
      process.exit(passed ? 0 : 1);
    }

    if (shouldClean) {
      await cleanup();
    }

    await seedAll();

    // Verify after seeding
    console.log('\n');
    await verify();

    db.close();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    db.close();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { seedAll, cleanup, verify };

export default { seedAll, cleanup, verify };
