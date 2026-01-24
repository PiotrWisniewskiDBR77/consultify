/**
 * Seed: Demo Feedback Data
 *
 * Populates the feedback system with realistic demo data:
 * - System feedback (bugs, ideas)
 * - Quick pulse ratings
 * - Feature requests
 * - AI analysis results
 *
 * Run: node server/seed/seed_feedback_demo.js
 */

import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Demo users for feedback
const DEMO_USERS = [
  { id: 'demo-user-1', email: 'jan.kowalski@acme.pl', name: 'Jan Kowalski' },
  { id: 'demo-user-2', email: 'anna.nowak@techcorp.com', name: 'Anna Nowak' },
  { id: 'demo-user-3', email: 'piotr.wisniewski@enterprise.io', name: 'Piotr Wiśniewski' },
  { id: 'demo-user-4', email: 'maria.zielinska@startup.pl', name: 'Maria Zielińska' },
  { id: 'demo-user-5', email: 'tomasz.kaczmarek@consulting.com', name: 'Tomasz Kaczmarek' },
  { id: 'demo-user-6', email: 'katarzyna.wojcik@industry.pl', name: 'Katarzyna Wójcik' },
  { id: 'demo-user-7', email: 'michal.lewandowski@digital.io', name: 'Michał Lewandowski' },
  { id: 'demo-user-8', email: 'agnieszka.kaminska@transform.com', name: 'Agnieszka Kamińska' },
];

// ==================== SYSTEM FEEDBACK ====================

const SYSTEM_FEEDBACK = [
  // BUGS - Critical
  {
    type: 'BUG',
    message:
      'Application crashes when exporting large assessment reports (>50 pages) to PDF. The browser freezes and eventually shows "Page Unresponsive" error. This is blocking our quarterly review process.',
    severity: 'CRITICAL',
    status: 'IN_PROGRESS',
    priority: 'critical',
    context: '/assessment/export',
    adminNotes: 'Investigating memory leak in PDF generation. Hotfix scheduled for next release.',
  },
  {
    type: 'BUG',
    message:
      'Login fails intermittently with SSO. About 20% of login attempts result in "Session expired" error even with fresh credentials. Users have to try 2-3 times to get in.',
    severity: 'HIGH',
    status: 'NEW',
    priority: 'high',
    context: '/login',
  },
  {
    type: 'BUG',
    message:
      'Dashboard charts not loading on Safari 17. Shows blank space where charts should be. Works fine on Chrome and Firefox.',
    severity: 'MEDIUM',
    status: 'PENDING',
    priority: 'medium',
    context: '/dashboard',
    adminNotes: 'Safari WebGL compatibility issue. Workaround in progress.',
  },
  {
    type: 'BUG',
    message:
      'Notification bell shows wrong count. It says 5 unread but when I click there are only 2 notifications.',
    severity: 'LOW',
    status: 'NEW',
    priority: 'low',
    context: '/notifications',
  },
  {
    type: 'BUG',
    message:
      'AI suggestions sometimes appear in English even when the app is set to Polish language. Inconsistent localization.',
    severity: 'MEDIUM',
    status: 'REVIEWED',
    priority: 'medium',
    context: '/ai-chat',
    adminResponse:
      'Thank you for reporting! We are working on improving AI response localization. Fix planned for v2.5.',
  },

  // BUGS - Various
  {
    type: 'BUG',
    message:
      'Cannot upload files larger than 10MB. The upload appears to complete but the file is not saved. No error message shown.',
    severity: 'MEDIUM',
    status: 'RESOLVED',
    priority: 'medium',
    context: '/documents',
    adminResponse: 'Fixed in v2.4.1. The file size limit has been increased to 50MB.',
  },
  {
    type: 'BUG',
    message:
      'Timeline view in Roadmap module overlaps items when there are more than 20 initiatives. Text becomes unreadable.',
    severity: 'MEDIUM',
    status: 'NEW',
    priority: 'medium',
    context: '/roadmap',
  },
  {
    type: 'BUG',
    message:
      'Print function cuts off right side of reports. About 2cm of content is missing when printing directly from browser.',
    severity: 'LOW',
    status: 'PENDING',
    priority: 'low',
    context: '/reports',
  },

  // IDEAS - High Impact
  {
    type: 'IDEA',
    message:
      'Would love to have a mobile app! I often need to check assessment status or approve initiatives when away from my desk. Even a simple read-only app would be incredibly useful.',
    severity: 'NORMAL',
    status: 'REVIEWED',
    priority: 'high',
    context: '/dashboard',
    adminResponse:
      'Great idea! Mobile app is on our roadmap for Q3 2026. We will start with iOS and Android apps with core features.',
    rating: 5,
  },
  {
    type: 'IDEA',
    message:
      'Integration with Microsoft Teams would be amazing. We could get notifications about initiative updates directly in our team channels. Many enterprise tools have this already.',
    severity: 'NORMAL',
    status: 'IN_PROGRESS',
    priority: 'high',
    context: '/settings/integrations',
    adminNotes: 'Teams integration in development. Beta expected in 6 weeks.',
    rating: 5,
  },
  {
    type: 'IDEA',
    message:
      'Add keyboard shortcuts for power users. Things like Ctrl+N for new initiative, Ctrl+S to save, Ctrl+/ for search. Would speed up daily work significantly.',
    severity: 'NORMAL',
    status: 'NEW',
    priority: 'medium',
    context: '/',
    rating: 4,
  },
  {
    type: 'IDEA',
    message:
      'Custom dashboard widgets would be great. I want to see my KPIs at a glance without navigating to different modules. Let users drag and arrange their own dashboard.',
    severity: 'NORMAL',
    status: 'PENDING',
    priority: 'medium',
    context: '/dashboard',
    rating: 4,
  },
  {
    type: 'IDEA',
    message:
      'Bulk actions for initiatives - select multiple and change status, assign owner, or move to different phase. Currently have to do each one individually.',
    severity: 'NORMAL',
    status: 'NEW',
    priority: 'medium',
    context: '/initiatives',
    rating: 4,
  },

  // IDEAS - Medium/Low
  {
    type: 'IDEA',
    message:
      'Dark mode please! Working late hours and the bright interface is harsh on the eyes. Many modern apps have this as standard.',
    severity: 'NORMAL',
    status: 'IN_PROGRESS',
    priority: 'medium',
    context: '/settings',
    adminNotes: 'Dark mode in final testing. Release expected next month.',
    rating: 5,
  },
  {
    type: 'IDEA',
    message:
      'Add templates for common initiative types. We often create similar initiatives (Process Automation, Digital Training, etc.) and having templates would save time.',
    severity: 'NORMAL',
    status: 'REVIEWED',
    priority: 'medium',
    context: '/initiatives/new',
    adminResponse:
      'Initiative templates are now available in the latest update! Check the "Templates" tab when creating new initiatives.',
    rating: 4,
  },
  {
    type: 'IDEA',
    message:
      'Would be nice to have a "Focus Mode" that hides all distractions and shows only the current task/assessment I am working on.',
    severity: 'NORMAL',
    status: 'NEW',
    priority: 'low',
    context: '/assessment',
    rating: 3,
  },
  {
    type: 'IDEA',
    message:
      'Export to PowerPoint format for executive presentations. Currently I have to screenshot charts and paste them manually.',
    severity: 'NORMAL',
    status: 'NEW',
    priority: 'medium',
    context: '/reports/export',
    rating: 4,
  },
  {
    type: 'IDEA',
    message:
      'AI should remember my preferences across sessions. It keeps asking about company size and industry every time I start a new chat.',
    severity: 'NORMAL',
    status: 'RESOLVED',
    priority: 'medium',
    context: '/ai-chat',
    adminResponse:
      'AI memory feature is now live! The AI will remember your context and preferences across conversations.',
    rating: 4,
  },

  // Praise
  {
    type: 'IDEA',
    message:
      'Just wanted to say the new assessment wizard is fantastic! It reduced our assessment time from 3 days to just 4 hours. The AI suggestions are spot-on. Great work team!',
    severity: 'NORMAL',
    status: 'REVIEWED',
    priority: 'low',
    context: '/assessment',
    adminResponse:
      'Thank you so much for the kind words! We are thrilled the new wizard is helping your team. Feel free to share any other feedback!',
    rating: 5,
  },
];

// ==================== QUICK PULSE ====================

const PULSE_FEEDBACK = [
  // Last 7 days - varied ratings
  { rating: 5, context: '/dashboard', comment: null, daysAgo: 0 },
  { rating: 4, context: '/assessment', comment: null, daysAgo: 0 },
  { rating: 5, context: '/initiatives', comment: null, daysAgo: 0 },
  { rating: 3, context: '/roadmap', comment: 'Charts could be more responsive', daysAgo: 1 },
  { rating: 4, context: '/dashboard', comment: null, daysAgo: 1 },
  { rating: 5, context: '/ai-chat', comment: 'AI is really helpful!', daysAgo: 1 },
  { rating: 2, context: '/reports/export', comment: 'PDF export is slow', daysAgo: 1 },
  { rating: 4, context: '/assessment', comment: null, daysAgo: 2 },
  { rating: 5, context: '/dashboard', comment: null, daysAgo: 2 },
  { rating: 4, context: '/initiatives', comment: null, daysAgo: 2 },
  { rating: 1, context: '/login', comment: 'SSO keeps failing, very frustrating', daysAgo: 2 },
  { rating: 5, context: '/economics', comment: 'Great ROI calculator!', daysAgo: 3 },
  { rating: 4, context: '/dashboard', comment: null, daysAgo: 3 },
  { rating: 3, context: '/settings', comment: null, daysAgo: 3 },
  { rating: 5, context: '/ai-chat', comment: null, daysAgo: 3 },
  { rating: 4, context: '/assessment', comment: null, daysAgo: 4 },
  { rating: 5, context: '/dashboard', comment: null, daysAgo: 4 },
  { rating: 2, context: '/documents', comment: 'Upload limit too low', daysAgo: 4 },
  { rating: 4, context: '/roadmap', comment: null, daysAgo: 5 },
  { rating: 5, context: '/initiatives', comment: null, daysAgo: 5 },
  { rating: 4, context: '/dashboard', comment: null, daysAgo: 5 },
  { rating: 3, context: '/reports', comment: 'Needs more chart types', daysAgo: 6 },
  { rating: 5, context: '/ai-chat', comment: 'Love the suggestions!', daysAgo: 6 },
  { rating: 4, context: '/assessment', comment: null, daysAgo: 6 },
  { rating: 5, context: '/dashboard', comment: null, daysAgo: 7 },
  // Older data
  { rating: 4, context: '/dashboard', comment: null, daysAgo: 10 },
  { rating: 5, context: '/assessment', comment: null, daysAgo: 12 },
  { rating: 3, context: '/roadmap', comment: null, daysAgo: 14 },
  { rating: 4, context: '/initiatives', comment: null, daysAgo: 16 },
  { rating: 5, context: '/ai-chat', comment: null, daysAgo: 18 },
  { rating: 4, context: '/dashboard', comment: null, daysAgo: 20 },
  { rating: 5, context: '/economics', comment: null, daysAgo: 22 },
  { rating: 3, context: '/settings', comment: null, daysAgo: 24 },
  { rating: 4, context: '/reports', comment: null, daysAgo: 26 },
  { rating: 5, context: '/dashboard', comment: null, daysAgo: 28 },
];

// ==================== FEATURE REQUESTS ====================

const FEATURE_REQUESTS = [
  {
    category: 'missing',
    featureName: 'Mobile Application',
    description:
      'Native mobile apps for iOS and Android to access key features on the go. Should include dashboard view, initiative status, notifications, and basic AI chat capabilities.',
    impact: 'high',
    status: 'PLANNED',
    votes: 47,
    targetRelease: 'Q3 2026',
    adminNotes: 'High priority. Design phase complete, development starting Q2.',
  },
  {
    category: 'integration',
    featureName: 'Microsoft Teams Integration',
    description:
      'Bi-directional integration with MS Teams: notifications in channels, ability to create initiatives from Teams, and embedded dashboard widgets.',
    impact: 'high',
    status: 'IN_PROGRESS',
    votes: 38,
    targetRelease: 'Q2 2026',
    adminNotes: 'Beta available for testing. Full release in 4 weeks.',
  },
  {
    category: 'improvement',
    featureName: 'Dark Mode',
    description:
      'System-wide dark theme option. Should respect OS preference and include manual toggle. All charts and graphs should adapt to dark theme.',
    impact: 'medium',
    status: 'IN_PROGRESS',
    votes: 52,
    targetRelease: 'February 2026',
    adminNotes: 'In final QA. Release imminent.',
  },
  {
    category: 'missing',
    featureName: 'Keyboard Shortcuts',
    description:
      'Global keyboard shortcuts for common actions: navigation, creating items, saving, searching. Include a shortcut cheat sheet accessible via Ctrl+?',
    impact: 'medium',
    status: 'PLANNED',
    votes: 29,
    targetRelease: 'Q2 2026',
  },
  {
    category: 'improvement',
    featureName: 'Customizable Dashboard',
    description:
      'Drag-and-drop dashboard builder. Users should be able to add/remove widgets, resize them, and save multiple dashboard layouts for different use cases.',
    impact: 'high',
    status: 'REVIEWING',
    votes: 41,
    adminNotes: 'Evaluating technical approach. Complex but high value.',
  },
  {
    category: 'missing',
    featureName: 'Bulk Actions for Initiatives',
    description:
      'Multi-select initiatives and perform bulk operations: change status, assign owner, update phase, add tags, or delete. Essential for portfolio management.',
    impact: 'high',
    status: 'PLANNED',
    votes: 34,
    targetRelease: 'Q1 2026',
  },
  {
    category: 'integration',
    featureName: 'Slack Integration',
    description:
      'Slack app with notifications, slash commands to check status, and ability to create quick notes/updates directly from Slack.',
    impact: 'medium',
    status: 'REVIEWING',
    votes: 25,
  },
  {
    category: 'missing',
    featureName: 'PowerPoint Export',
    description:
      'Export reports and dashboards directly to .pptx format with editable charts. Include multiple template options for different presentation styles.',
    impact: 'medium',
    status: 'NEW',
    votes: 31,
  },
  {
    category: 'improvement',
    featureName: 'Advanced Filtering & Search',
    description:
      'Global search across all modules with filters, saved searches, and search history. Include boolean operators and field-specific searches.',
    impact: 'medium',
    status: 'PLANNED',
    votes: 27,
    targetRelease: 'Q2 2026',
  },
  {
    category: 'usability',
    featureName: 'Onboarding Wizard',
    description:
      'Interactive onboarding for new users with step-by-step tutorials, sample data option, and contextual help throughout the first week.',
    impact: 'medium',
    status: 'COMPLETED',
    votes: 19,
    adminNotes: 'Shipped in v2.4. Great user feedback!',
  },
  {
    category: 'missing',
    featureName: 'API Webhooks',
    description:
      'Outbound webhooks for key events (initiative created, status changed, assessment completed). Include webhook management UI and retry logic.',
    impact: 'high',
    status: 'COMPLETED',
    votes: 22,
    adminNotes: 'Available since v2.3. Documentation at docs.consultinity.io/webhooks',
  },
  {
    category: 'improvement',
    featureName: 'AI Memory & Personalization',
    description:
      'AI should remember user preferences, company context, and past conversations. Build a knowledge graph of user interactions for personalized suggestions.',
    impact: 'high',
    status: 'COMPLETED',
    votes: 36,
    adminNotes: 'Shipped! AI now maintains context across sessions.',
  },
  {
    category: 'usability',
    featureName: 'Focus Mode',
    description:
      'Distraction-free mode that hides navigation, notifications, and other UI elements. Shows only the current task with a clean interface.',
    impact: 'low',
    status: 'NEW',
    votes: 14,
  },
  {
    category: 'missing',
    featureName: 'Gantt Chart View',
    description:
      'Traditional Gantt chart visualization for roadmap with dependencies, milestones, critical path highlighting, and resource allocation view.',
    impact: 'high',
    status: 'REVIEWING',
    votes: 33,
    adminNotes: 'High complexity. Evaluating build vs buy options.',
  },
  {
    category: 'integration',
    featureName: 'Jira/Linear Integration',
    description:
      'Two-way sync with Jira and Linear. Map initiatives to epics, sync status updates, and import existing projects.',
    impact: 'high',
    status: 'PLANNED',
    votes: 28,
    targetRelease: 'Q3 2026',
  },
];

// ==================== AI ANALYSIS DATA ====================

const generateAIAnalysis = (feedback) => {
  const sentiments = {
    BUG: { sentiment: 'negative', score: -0.6 },
    IDEA: { sentiment: 'positive', score: 0.4 },
  };

  const baseAnalysis = sentiments[feedback.type] || { sentiment: 'neutral', score: 0 };

  // Extract keywords (simple)
  const words = feedback.message.toLowerCase().split(/\s+/);
  const keywords = [...new Set(words.filter((w) => w.length > 5))].slice(0, 5);

  // Determine categories
  const categories = [];
  const msg = feedback.message.toLowerCase();
  if (msg.includes('crash') || msg.includes('error') || msg.includes('fail'))
    categories.push('stability');
  if (msg.includes('slow') || msg.includes('performance') || msg.includes('speed'))
    categories.push('performance');
  if (msg.includes('ui') || msg.includes('interface') || msg.includes('design'))
    categories.push('ui');
  if (msg.includes('feature') || msg.includes('add') || msg.includes('want'))
    categories.push('feature');
  if (msg.includes('mobile') || msg.includes('app')) categories.push('mobile');
  if (msg.includes('integration') || msg.includes('teams') || msg.includes('slack'))
    categories.push('integration');
  if (categories.length === 0) categories.push(feedback.type.toLowerCase());

  // Priority score
  let priorityScore = 50;
  if (feedback.severity === 'CRITICAL') priorityScore = 95;
  else if (feedback.severity === 'HIGH') priorityScore = 75;
  else if (feedback.severity === 'MEDIUM') priorityScore = 55;
  else priorityScore = 35;

  if (feedback.rating === 5) priorityScore -= 10;
  if (feedback.rating === 1) priorityScore += 20;

  return {
    sentiment: baseAnalysis.sentiment,
    sentimentScore: baseAnalysis.score,
    categories,
    keywords,
    priority:
      priorityScore >= 80
        ? 'critical'
        : priorityScore >= 60
          ? 'high'
          : priorityScore >= 40
            ? 'medium'
            : 'low',
    priorityScore,
    suggestedActions:
      feedback.type === 'BUG'
        ? ['Create bug ticket', 'Investigate root cause', 'Notify user when fixed']
        : ['Add to feature backlog', 'Evaluate user impact', 'Check for similar requests'],
    aiSummary: feedback.message.substring(0, 100) + '...',
  };
};

// ==================== DATABASE OPERATIONS ====================

async function seedFeedbackData(db) {
  console.log('🌱 Seeding feedback demo data...\n');

  const now = new Date();

  // Helper to get date X days ago
  const daysAgo = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  // 1. SYSTEM FEEDBACK
  console.log('📝 Inserting system feedback...');
  for (let i = 0; i < SYSTEM_FEEDBACK.length; i++) {
    const fb = SYSTEM_FEEDBACK[i];
    const user = DEMO_USERS[i % DEMO_USERS.length];
    const id = uuidv4();
    const createdAt = daysAgo(Math.floor(Math.random() * 30));

    try {
      await runQuery(
        db,
        `
                INSERT INTO system_feedback 
                (id, user_id, user_email, user_name, type, message, rating, severity, status, priority, metadata, admin_response, admin_notes, responded_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          id,
          user.id,
          user.email,
          user.name,
          fb.type,
          fb.message,
          fb.rating || null,
          fb.severity || 'NORMAL',
          fb.status,
          fb.priority,
          JSON.stringify({ context: fb.context, browser: 'Chrome 120', screenSize: '1920x1080' }),
          fb.adminResponse || null,
          fb.adminNotes || null,
          fb.adminResponse ? daysAgo(Math.floor(Math.random() * 5)) : null,
          createdAt,
        ]
      );

      // Insert AI analysis
      const analysis = generateAIAnalysis(fb);
      await runQuery(
        db,
        `
                INSERT INTO feedback_analysis 
                (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, priority, priority_score, similar_feedback_ids_json, suggested_actions_json, ai_summary, analyzed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          uuidv4(),
          id,
          analysis.sentiment,
          analysis.sentimentScore,
          JSON.stringify(analysis.categories),
          JSON.stringify(analysis.keywords),
          analysis.priority,
          analysis.priorityScore,
          '[]',
          JSON.stringify(analysis.suggestedActions),
          analysis.aiSummary,
          createdAt,
        ]
      );
    } catch (err) {
      console.error(`  ❌ Error inserting feedback: ${err.message}`);
    }
  }
  console.log(`  ✅ Inserted ${SYSTEM_FEEDBACK.length} feedback items with AI analysis\n`);

  // 2. PULSE FEEDBACK
  console.log('⚡ Inserting pulse feedback...');
  for (const pulse of PULSE_FEEDBACK) {
    const user = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
    const createdAt = daysAgo(pulse.daysAgo);

    try {
      await runQuery(
        db,
        `
                INSERT INTO feedback_pulse (id, user_id, rating, context, comment, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
        [uuidv4(), user.id, pulse.rating, pulse.context, pulse.comment, createdAt]
      );
    } catch (err) {
      console.error(`  ❌ Error inserting pulse: ${err.message}`);
    }
  }
  console.log(`  ✅ Inserted ${PULSE_FEEDBACK.length} pulse ratings\n`);

  // 3. FEATURE REQUESTS
  console.log('✨ Inserting feature requests...');
  for (let i = 0; i < FEATURE_REQUESTS.length; i++) {
    const fr = FEATURE_REQUESTS[i];
    const user = DEMO_USERS[i % DEMO_USERS.length];
    const id = uuidv4();
    const createdAt = daysAgo(Math.floor(Math.random() * 60) + 10);

    try {
      await runQuery(
        db,
        `
                INSERT INTO feature_requests 
                (id, user_id, user_email, category, feature_name, description, impact, context, status, votes_count, admin_notes, target_release, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          id,
          user.id,
          user.email,
          fr.category,
          fr.featureName,
          fr.description,
          fr.impact,
          '/feature-request',
          fr.status,
          fr.votes,
          fr.adminNotes || null,
          fr.targetRelease || null,
          createdAt,
        ]
      );

      // Add some votes
      const numVotes = Math.min(fr.votes, 8);
      for (let v = 0; v < numVotes; v++) {
        const voter = DEMO_USERS[v % DEMO_USERS.length];
        try {
          await runQuery(
            db,
            `
                        INSERT INTO feature_votes (id, feature_id, user_id, created_at)
                        VALUES (?, ?, ?, ?)
                    `,
            [uuidv4(), id, voter.id, daysAgo(Math.floor(Math.random() * 30))]
          );
        } catch (e) {
          // Ignore duplicate vote errors
        }
      }
    } catch (err) {
      console.error(`  ❌ Error inserting feature: ${err.message}`);
    }
  }
  console.log(`  ✅ Inserted ${FEATURE_REQUESTS.length} feature requests with votes\n`);

  // 4. TRENDING TOPICS
  console.log('📈 Generating trending topics...');
  const trendingTopics = [
    { topic: 'mobile', count: 12, sentiment: 'positive', trend: 'rising' },
    { topic: 'integration', count: 9, sentiment: 'positive', trend: 'rising' },
    { topic: 'performance', count: 7, sentiment: 'negative', trend: 'stable' },
    { topic: 'dark mode', count: 6, sentiment: 'positive', trend: 'falling' },
    { topic: 'export', count: 5, sentiment: 'neutral', trend: 'stable' },
  ];

  for (const t of trendingTopics) {
    try {
      await runQuery(
        db,
        `
                INSERT INTO feedback_trending_topics (id, topic, topic_count, sentiment, trend, period, calculated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
        [uuidv4(), t.topic, t.count, t.sentiment, t.trend, '7d', now.toISOString()]
      );
    } catch (err) {
      console.error(`  ❌ Error inserting trending: ${err.message}`);
    }
  }
  console.log(`  ✅ Inserted ${trendingTopics.length} trending topics\n`);

  console.log('🎉 Feedback demo data seeded successfully!\n');
  console.log('Summary:');
  console.log(`  • ${SYSTEM_FEEDBACK.length} system feedback items (bugs & ideas)`);
  console.log(`  • ${PULSE_FEEDBACK.length} quick pulse ratings`);
  console.log(`  • ${FEATURE_REQUESTS.length} feature requests`);
  console.log(`  • ${trendingTopics.length} trending topics`);
  console.log(`  • AI analysis for all feedback items`);
}

// ==================== DB HELPERS ====================

function runQuery(db, sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { lastID: result.lastInsertRowid, changes: result.changes };
  } catch (err) {
    throw err;
  }
}

// ==================== MAIN ====================

async function main() {
  let db;

  try {
    // Get database path
    const dbPath = join(__dirname, '..', 'consultinity.db');
    console.log(`📦 Connecting to database: ${dbPath}\n`);

    db = new Database(dbPath);

    // Run seed
    await seedFeedbackData(db);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Export for use as module
export { seedFeedbackData, SYSTEM_FEEDBACK, PULSE_FEEDBACK, FEATURE_REQUESTS };

// Run if called directly
main();
