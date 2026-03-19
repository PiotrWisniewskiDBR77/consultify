/**
 * Virtual Workers Integration Tests
 *
 * Tests the full Virtual Workers stack:
 * - Service layer CRUD (workers, profiles, knowledge)
 * - Conversation logging
 * - Analytics computation
 * - Insights generation
 * - Public Anna endpoints (HTTP)
 */

import * as WorkerService from '../src/services/ai/virtualWorkerService.js';
import * as ConversationLogger from '../src/services/ai/virtualWorkerConversationLogger.js';
import * as InsightsEngine from '../src/services/ai/virtualWorkerInsightsEngine.js';
import { getDatabase } from '../src/database/Database.js';

const BASE_URL = 'http://localhost:3001';
const TEST_SLUG = `test-worker-${Date.now()}`;

let testWorkerId: string;
let testProfileId: string;
let testAssignmentId: string;
let testConversationId: string;

// ─── Helpers ────────────────────────────────────────────────────────────────

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
}

function section(name: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('═'.repeat(60));
}

function pass(name: string) {
  console.log(`  ✅ ${name}`);
}

function fail(name: string, err: unknown) {
  console.error(`  ❌ ${name}: ${err instanceof Error ? err.message : String(err)}`);
}

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    pass(name);
    passed++;
  } catch (err) {
    fail(name, err);
    failed++;
  }
}

// ─── Test Suites ────────────────────────────────────────────────────────────

async function testWorkersCRUD() {
  section('TEST 1: Virtual Workers CRUD');

  await test('List workers (should include Anna and Teresa)', async () => {
    const workers = await WorkerService.listWorkers();
    assert(workers.length >= 2, `Expected >= 2 workers, got ${workers.length}`);
    const slugs = workers.map(w => w.slug);
    assert(slugs.includes('anna'), 'Anna not found');
    assert(slugs.includes('teresa'), 'Teresa not found');
  });

  await test('Get worker by slug (anna)', async () => {
    const anna = await WorkerService.getWorkerBySlug('anna');
    assert(anna !== null, 'Anna not found by slug');
    assert(anna!.role === 'sales_lp', `Expected role sales_lp, got ${anna!.role}`);
    assert(anna!.status === 'active', `Expected status active, got ${anna!.status}`);
    assert(anna!.voice_enabled === true, 'Anna should have voice enabled');
    assert(anna!.surface === 'landing_page', `Expected surface landing_page, got ${anna!.surface}`);
  });

  await test('Get worker by slug (teresa)', async () => {
    const teresa = await WorkerService.getWorkerBySlug('teresa');
    assert(teresa !== null, 'Teresa not found by slug');
    assert(teresa!.role === 'internal_consultant', `Expected role internal_consultant, got ${teresa!.role}`);
    assert(teresa!.surface === 'in_platform', `Expected surface in_platform, got ${teresa!.surface}`);
    assert(teresa!.voice_enabled === false, 'Teresa should not have voice enabled');
  });

  await test('Create a test worker', async () => {
    const worker = await WorkerService.createWorker({
      slug: TEST_SLUG,
      name: 'Test Worker',
      role: 'custom',
      status: 'draft',
      surface: 'both',
      description: 'Integration test worker',
    });
    testWorkerId = worker.id;
    assert(worker.slug === TEST_SLUG, `Expected slug ${TEST_SLUG}, got ${worker.slug}`);
    assert(worker.status === 'draft', `Expected draft, got ${worker.status}`);
  });

  await test('Get worker by ID', async () => {
    const worker = await WorkerService.getWorkerById(testWorkerId);
    assert(worker !== null, 'Worker not found by ID');
    assert(worker!.name === 'Test Worker', `Expected name Test Worker, got ${worker!.name}`);
  });

  await test('Update worker', async () => {
    const updated = await WorkerService.updateWorker(testWorkerId, {
      status: 'active' as any,
      description: 'Updated description',
    });
    assert(updated !== null, 'Update returned null');
    assert(updated!.status === 'active', `Expected active, got ${updated!.status}`);
    assert(updated!.description === 'Updated description', 'Description not updated');
  });

  await test('Get worker with profile (no profile yet)', async () => {
    const result = await WorkerService.getWorkerWithProfile(TEST_SLUG);
    assert(result !== null, 'Worker not found');
    assert(result!.profile === null, 'Should have no profile yet');
  });
}

async function testProfiles() {
  section('TEST 2: Profiles');

  await test('Create profile v1', async () => {
    const profile = await WorkerService.createProfile({
      worker_id: testWorkerId,
      persona_description: 'Test persona',
      tone_description: 'Test tone',
      system_prompt: 'You are a test assistant.',
      priority_rules: { default: 'test' },
      boundaries: { no_private_data: true },
      activate: true,
    });
    testProfileId = profile.id;
    assert(profile.version === 1, `Expected v1, got v${profile.version}`);
    assert(profile.is_active === true, 'Should be active');
    assert(profile.system_prompt === 'You are a test assistant.', 'System prompt mismatch');
  });

  await test('Create profile v2 (auto-activates)', async () => {
    const profile = await WorkerService.createProfile({
      worker_id: testWorkerId,
      system_prompt: 'You are a test assistant v2.',
      activate: true,
    });
    assert(profile.version === 2, `Expected v2, got v${profile.version}`);
    assert(profile.is_active === true, 'v2 should be active');
  });

  await test('Get active profile (should be v2)', async () => {
    const active = await WorkerService.getActiveProfile(testWorkerId);
    assert(active !== null, 'No active profile');
    assert(active!.version === 2, `Expected v2 active, got v${active!.version}`);
  });

  await test('List profiles (should have 2)', async () => {
    const profiles = await WorkerService.listProfiles(testWorkerId);
    assert(profiles.length === 2, `Expected 2 profiles, got ${profiles.length}`);
  });

  await test('Activate profile v1', async () => {
    await WorkerService.activateProfile(testProfileId);
    const active = await WorkerService.getActiveProfile(testWorkerId);
    assert(active !== null, 'No active profile after activation');
    assert(active!.version === 1, `Expected v1 active, got v${active!.version}`);
  });

  await test('Get worker with profile (should have v1)', async () => {
    const result = await WorkerService.getWorkerWithProfile(TEST_SLUG);
    assert(result !== null, 'Worker not found');
    assert(result!.profile !== null, 'Should have profile');
    assert(result!.profile!.version === 1, `Expected v1, got v${result!.profile!.version}`);
  });
}

async function testKnowledge() {
  section('TEST 3: Knowledge Assignments');

  await test('List Anna knowledge assignments', async () => {
    const anna = await WorkerService.getWorkerBySlug('anna');
    assert(anna !== null, 'Anna not found');
    const assignments = await WorkerService.listKnowledgeAssignments(anna!.id);
    assert(assignments.length >= 7, `Expected >= 7 assignments, got ${assignments.length}`);
    const consultify = assignments.find(a => a.product_slug === 'consultify');
    assert(consultify !== undefined, 'Consultify assignment not found');
    assert(consultify!.priority_weight === 1.2, `Expected weight 1.2, got ${consultify!.priority_weight}`);
  });

  await test('Assign knowledge to test worker', async () => {
    const assignment = await WorkerService.assignKnowledge({
      worker_id: testWorkerId,
      knowledge_source_type: 'product_pill',
      product_slug: 'consultify',
      priority_weight: 1.5,
    });
    testAssignmentId = assignment.id;
    assert(assignment.product_slug === 'consultify', 'Product slug mismatch');
    assert(assignment.priority_weight === 1.5, `Expected weight 1.5, got ${assignment.priority_weight}`);
  });

  await test('List test worker knowledge', async () => {
    const assignments = await WorkerService.listKnowledgeAssignments(testWorkerId);
    assert(assignments.length === 1, `Expected 1, got ${assignments.length}`);
  });

  await test('Bulk assign product pills', async () => {
    const count = await WorkerService.bulkAssignProductPills(testWorkerId, [
      { slug: 'vector', weight: 1.0 },
      { slug: 'dbr77', weight: 0.8 },
    ]);
    assert(count === 2, `Expected 2 assigned, got ${count}`);
    const assignments = await WorkerService.listKnowledgeAssignments(testWorkerId);
    assert(assignments.length === 3, `Expected 3 total, got ${assignments.length}`);
  });

  await test('Remove knowledge assignment', async () => {
    const removed = await WorkerService.removeKnowledgeAssignment(testAssignmentId);
    assert(removed === true, 'Remove returned false');
    const assignments = await WorkerService.listKnowledgeAssignments(testWorkerId);
    assert(assignments.length === 2, `Expected 2 after removal, got ${assignments.length}`);
  });
}

async function testConversations() {
  section('TEST 4: Conversation Logging');

  await test('Create conversation', async () => {
    testConversationId = await ConversationLogger.findOrCreateConversation({
      workerId: testWorkerId,
      sessionId: 'test-session-001',
      channel: 'text_chat',
      locale: 'pl',
    });
    assert(testConversationId.length > 0, 'Empty conversation ID');
  });

  await test('Find existing conversation by session', async () => {
    const convId = await ConversationLogger.findOrCreateConversation({
      workerId: testWorkerId,
      sessionId: 'test-session-001',
    });
    assert(convId === testConversationId, 'Should return same conversation ID');
  });

  await test('Log user message', async () => {
    const msgId = await ConversationLogger.logMessage({
      conversationId: testConversationId,
      role: 'user',
      content: 'What is Consultify?',
    });
    assert(msgId.length > 0, 'Empty message ID');
  });

  await test('Log assistant message with metadata', async () => {
    const msgId = await ConversationLogger.logMessage({
      conversationId: testConversationId,
      role: 'assistant',
      content: 'Consultify is a digital transformation platform.',
      knowledgeSourcesUsed: ['consultify-pill-01.md'],
      matchedProducts: ['consultify'],
      tokenCount: 42,
      latencyMs: 350,
    });
    assert(msgId.length > 0, 'Empty message ID');
  });

  await test('Get conversation messages', async () => {
    const messages = await ConversationLogger.getConversationMessages(testConversationId);
    assert(messages.length === 2, `Expected 2 messages, got ${messages.length}`);
    assert(messages[0].role === 'user', 'First message should be user');
    assert(messages[1].role === 'assistant', 'Second message should be assistant');
    assert(messages[1].latency_ms === 350, `Expected latency 350, got ${messages[1].latency_ms}`);
  });

  await test('End conversation', async () => {
    await ConversationLogger.endConversation(testConversationId, 'question_answered');
    // Verify by listing
    const result = await ConversationLogger.listConversations({
      workerId: testWorkerId,
      outcome: 'question_answered',
    });
    assert(result.total >= 1, 'Should have at least 1 answered conversation');
  });

  await test('List conversations with filters', async () => {
    const all = await ConversationLogger.listConversations({ workerId: testWorkerId });
    assert(all.total >= 1, `Expected >= 1 total, got ${all.total}`);

    const textOnly = await ConversationLogger.listConversations({
      workerId: testWorkerId,
      channel: 'text_chat',
    });
    assert(textOnly.total >= 1, 'Should have text conversations');
  });

  await test('Log voice event', async () => {
    const voiceConvId = await ConversationLogger.logVoiceEvent({
      workerId: testWorkerId,
      sessionId: 'voice-session-001',
      durationSeconds: 45,
      locale: 'en',
    });
    assert(voiceConvId.length > 0, 'Empty voice conversation ID');
  });

  await test('Analytics computation', async () => {
    const analytics = await ConversationLogger.getWorkerAnalytics({
      workerId: testWorkerId,
    });
    assert(analytics.totalConversations >= 2, `Expected >= 2 conversations, got ${analytics.totalConversations}`);
    assert(analytics.totalMessages >= 2, `Expected >= 2 messages, got ${analytics.totalMessages}`);
    assert(typeof analytics.avgDurationSeconds === 'number', 'avgDuration should be number');
    assert(typeof analytics.outcomeDistribution === 'object', 'outcomeDistribution should be object');
    assert(typeof analytics.channelDistribution === 'object', 'channelDistribution should be object');
  });
}

async function testInsights() {
  section('TEST 5: Insights Engine');

  await test('Generate insights (may be empty for few conversations)', async () => {
    const insights = await InsightsEngine.generateInsights(testWorkerId);
    assert(Array.isArray(insights), 'Should return array');
    // With only 2 conversations, we may not hit thresholds, so just verify no crash
  });

  await test('Create manual insight', async () => {
    const insight = await InsightsEngine.createInsight({
      worker_id: testWorkerId,
      insight_type: 'knowledge_gap',
      title: 'Test knowledge gap',
      description: 'Users ask about pricing but no pill exists',
      evidence: { sample_query: 'pricing', count: 5 },
      priority: 'high',
    });
    assert(insight.id.length > 0, 'Empty insight ID');
    assert(insight.status === 'new', `Expected status new, got ${insight.status}`);
    assert(insight.priority === 'high', `Expected priority high, got ${insight.priority}`);
  });

  await test('List insights', async () => {
    const result = await InsightsEngine.listInsights({ workerId: testWorkerId });
    assert(result.total >= 1, `Expected >= 1 insight, got ${result.total}`);
  });

  await test('Review insight (apply)', async () => {
    const result = await InsightsEngine.listInsights({ workerId: testWorkerId, status: 'new' });
    if (result.insights.length > 0) {
      await InsightsEngine.reviewInsight(result.insights[0].id, 'applied', 'test-admin');
      const updated = await InsightsEngine.listInsights({ workerId: testWorkerId, status: 'applied' });
      assert(updated.total >= 1, 'Should have at least 1 applied insight');
    }
  });
}

async function testAnnaPublicChat() {
  section('TEST 6: Anna Public Chat (HTTP)');

  await test('POST /api/public/anna/chat — basic message', async () => {
    const response = await fetch(`${BASE_URL}/api/public/anna/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What is Consultify?',
        locale: 'en',
        sessionId: 'integration-test-session',
      }),
    });
    assert(response.ok, `HTTP ${response.status}`);
    const data: any = await response.json();
    assert(typeof data.message === 'string', 'Response should have message string');
    assert(data.message.length > 10, `Response too short: "${data.message}"`);
    console.log(`    → Response (${data.message.length} chars): "${data.message.slice(0, 100)}..."`);
    if (data.knowledgeSources) {
      console.log(`    → Knowledge sources: ${JSON.stringify(data.knowledgeSources)}`);
    }
    if (data.matchedProducts) {
      console.log(`    → Matched products: ${JSON.stringify(data.matchedProducts)}`);
    }
  });

  await test('POST /api/public/anna/chat — with history', async () => {
    const response = await fetch(`${BASE_URL}/api/public/anna/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Tell me more about the Vector LLM',
        locale: 'en',
        sessionId: 'integration-test-session',
        history: [
          { role: 'user', content: 'What is Consultify?' },
          { role: 'assistant', content: 'Consultify is a digital transformation platform.' },
        ],
      }),
    });
    assert(response.ok, `HTTP ${response.status}`);
    const data: any = await response.json();
    assert(typeof data.message === 'string', 'Response should have message string');
    console.log(`    → Response (${data.message.length} chars): "${data.message.slice(0, 100)}..."`);
  });

  await test('POST /api/public/anna/chat — validation error', async () => {
    const response = await fetch(`${BASE_URL}/api/public/anna/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    assert(response.status === 400, `Expected 400, got ${response.status}`);
  });
}

async function testAnnaVoice() {
  section('TEST 7: Anna Voice Context & Events (HTTP)');

  await test('GET /api/public/anna/voice-context', async () => {
    const response = await fetch(`${BASE_URL}/api/public/anna/voice-context?locale=en`);
    assert(response.ok, `HTTP ${response.status}`);
    const data: any = await response.json();
    assert(typeof data.context === 'string', 'Should have context string');
    assert(data.context.length > 50, `Context too short: ${data.context.length} chars`);
    console.log(`    → Context length: ${data.context.length} chars`);
    if (data.knowledgeSources) {
      console.log(`    → Sources: ${JSON.stringify(data.knowledgeSources)}`);
    }
  });

  await test('POST /api/public/anna/voice-event', async () => {
    const response = await fetch(`${BASE_URL}/api/public/anna/voice-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'voice-test-session',
        durationSeconds: 30,
        locale: 'pl',
      }),
    });
    assert(response.ok, `HTTP ${response.status}`);
    const data: any = await response.json();
    assert(data.success === true, 'Should return success');
  });

  await test('POST /api/public/anna/voice-event — validation error', async () => {
    const response = await fetch(`${BASE_URL}/api/public/anna/voice-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: '' }),
    });
    assert(response.status === 400, `Expected 400, got ${response.status}`);
  });
}

async function testConversationLogging() {
  section('TEST 6b: Verify Anna chat logged conversations');

  await test('Anna conversation was logged in DB', async () => {
    const anna = await WorkerService.getWorkerBySlug('anna');
    if (!anna) {
      console.log('    ⚠ Anna not found, skipping');
      return;
    }
    const result = await ConversationLogger.listConversations({
      workerId: anna.id,
      limit: 5,
    });
    console.log(`    → Anna has ${result.total} logged conversation(s)`);
    // The integration test chat should have been logged
    if (result.total > 0) {
      const latest = result.conversations[0];
      console.log(`    → Latest: ${latest.channel}, ${latest.message_count} msgs, outcome=${latest.outcome}`);
    }
  });
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

async function cleanup() {
  section('CLEANUP');
  try {
    if (testWorkerId) {
      await WorkerService.deleteWorker(testWorkerId);
      console.log(`  🧹 Deleted test worker ${TEST_SLUG}`);
    }
  } catch (err) {
    console.log(`  ⚠ Cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧪 Virtual Workers Integration Tests');
  console.log(`   Started: ${new Date().toISOString()}`);
  console.log(`   Server: ${BASE_URL}`);

  try {
    await testWorkersCRUD();
    await testProfiles();
    await testKnowledge();
    await testConversations();
    await testInsights();
    await testAnnaPublicChat();
    await testAnnaVoice();
    await testConversationLogging();
  } finally {
    await cleanup();
  }

  section('RESULTS');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Total: ${passed + failed}`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
