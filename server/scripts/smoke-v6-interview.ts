#!/usr/bin/env tsx
/**
 * smoke-v6-interview — V6 Interview Knowledge Collection System
 *
 * Static code checks validating V6 Interview contracts:
 * Templates Studio, Runtime, Knowledge & Evidence, Insights, Library.
 */
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean; details?: string };

function read(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((n) => content.includes(n));
}

function fileExists(root: string, relativePath: string): boolean {
  return fs.existsSync(path.join(root, relativePath));
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  // ── WS-A: Foundations ──────────────────────────────────────────────────────

  // A01: Canonical V6 data contract
  checks.push({
    name: 'V6-A01 Migration 665: template foundation schema',
    pass: fileExists(root, 'server/migrations/665_v6_interview_templates_foundation.sql'),
  });
  checks.push({
    name: 'V6-A01 Migration 666: runtime answers schema',
    pass: fileExists(root, 'server/migrations/666_v6_interview_runtime_answers.sql'),
  });
  checks.push({
    name: 'V6-A01 Migration 668: question helper fields',
    pass: fileExists(root, 'server/migrations/668_v6_interview_question_helper_fields.sql'),
  });

  const m666 = read(root, 'server/migrations/666_v6_interview_runtime_answers.sql');
  checks.push({
    name: 'V6-A01 Runtime schema has voice/evidence columns',
    pass: includesAll(m666, ['answer_type', 'allow_voice', 'allow_file_upload', 'voice_transcript', 'voice_transcript_status', 'answer_payload', 'context_note']),
  });

  // A02: Surface split (hub tabs)
  const hub = read(root, 'src/components/Interview/InterviewHub.tsx');
  checks.push({
    name: 'V6-A02 Hub has 3 surfaces: sessions, templates, insights',
    pass: includesAll(hub, ['sessions', 'templates', 'insights', 'InterviewWorkspace', 'InsightViewer', 'TemplateBuilder']),
  });

  // A03: Scope and permissions
  const controller = read(root, 'server/src/controllers/InterviewController.ts');
  checks.push({
    name: 'V6-A03 canAccessTemplate with scope logic',
    pass: includesAll(controller, ['canAccessTemplate', 'template_scope', 'system', 'organization', 'private']),
  });

  // ── WS-C: Runtime ─────────────────────────────────────────────────────────

  const runtime = read(root, 'src/components/Interview/InterviewSingleQuestionRuntime.tsx');

  // C01: One-question flow
  checks.push({
    name: 'V6-C01 Left mini rail with category navigation',
    pass: includesAll(runtime, ['categorySummary', 'CATEGORY_ORDER', 'onCategoryChange']),
  });
  checks.push({
    name: 'V6-C01 Review screen before submit',
    pass: includesAll(runtime, ['runtimeView', 'review', 'requiredMissing']),
  });
  checks.push({
    name: 'V6-C01 Keyboard shortcuts',
    pass: includesAll(runtime, ['keydown', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight']),
  });
  checks.push({
    name: 'V6-C01 All answer types supported',
    pass: includesAll(runtime, ['multiChoice', 'dropdown', 'date', 'rating', 'yesNo', 'singleChoice', 'number', 'longText', 'shortText']),
  });

  // C02: Voice + transcript approval
  checks.push({
    name: 'V6-C02 Voice recording and transcription',
    pass: includesAll(runtime, ['startRecording', 'stopRecording', 'isTranscribing', 'voice/stt']),
  });
  checks.push({
    name: 'V6-C02 Transcript approval gate',
    pass: includesAll(runtime, ['voiceNeedsApproval', 'handleApproveTranscript', 'voiceTranscriptStatus']),
  });

  // C03: Evidence composer
  checks.push({
    name: 'V6-C03 File/link/context note support',
    pass: includesAll(runtime, ['allowFileUpload', 'allowUrl', 'allowContextNote', 'handleFilePicked', 'handleAddLink']),
  });
  checks.push({
    name: 'V6-C03 Evidence prompt display',
    pass: includesAll(runtime, ['evidencePrompt']),
  });
  checks.push({
    name: 'V6-C03 Helper text display',
    pass: includesAll(runtime, ['description', 'HelpCircle']),
  });

  // C04: Reviewer mode
  const workspace = read(root, 'src/components/Interview/InterviewWorkspace.tsx');
  checks.push({
    name: 'V6-C04 Reviewer mode detection',
    pass: includesAll(workspace, ['isReviewerMode', 'handleSendBack', 'handleApprove']),
    details: workspace.includes('isReviewerMode') ? undefined : 'isReviewerMode not found',
  });

  // C05: Mobile + accessibility
  checks.push({
    name: 'V6-C05 Mobile category switcher',
    pass: runtime.includes('md:hidden') && runtime.includes('overflow-x-auto'),
    details: runtime.includes('md:hidden') ? undefined : 'Mobile switcher not found',
  });
  checks.push({
    name: 'V6-C05 Accessibility labels',
    pass: includesAll(runtime, ['aria-label', 'aria-current']),
    details: runtime.includes('aria-label') ? undefined : 'aria-label not found',
  });

  // ── WS-D: Knowledge & Evidence ────────────────────────────────────────────

  // D01: Evidence ingestion
  checks.push({
    name: 'V6-D01 normalizeAnswerEvidence helper',
    pass: controller.includes('normalizeAnswerEvidence'),
  });

  // D02: Knowledge linking
  checks.push({
    name: 'V6-D02 Knowledge doc ID on questions',
    pass: includesAll(controller, ['answer_knowledge_doc_id', 'context_note_knowledge_doc_id']),
  });

  // D03: Link graph traceability
  checks.push({
    name: 'V6-D03 Link graph edges for evidence',
    pass: includesAll(controller, ['link_graph_edges', 'interview_evidence', 'created_from']),
  });

  // ── WS-E: Insights ────────────────────────────────────────────────────────

  const insightViewer = read(root, 'src/components/Interview/InsightViewer.tsx');

  // E01: Report shell
  checks.push({
    name: 'V6-E01 Insight report has V6 sections',
    pass: includesAll(insightViewer, ['themes', 'issues', 'opportunities', 'signals', 'evidence-map']),
  });

  // E02: AI synthesis
  const insightService = fileExists(root, 'server/src/services/InterviewInsightService.ts')
    ? read(root, 'server/src/services/InterviewInsightService.ts')
    : '';
  checks.push({
    name: 'V6-E02 Three-layer truth model in synthesis',
    pass: insightService.includes('themes_json') || controller.includes('themes_json'),
    details: 'themes_json column used in insight creation',
  });

  // E03: Evidence drilldown
  checks.push({
    name: 'V6-E03 Evidence map with drilldown',
    pass: includesAll(insightViewer, ['evidenceMap', 'evidence_refs']),
    details: insightViewer.includes('evidenceMap') ? undefined : 'evidenceMap not found',
  });

  // ── WS-F: Library & Delivery ──────────────────────────────────────────────

  // F01: Seed templates
  checks.push({
    name: 'V6-F01 18 system templates seeded',
    pass: fileExists(root, 'server/migrations/669_v6_seed_system_templates.sql'),
  });
  if (fileExists(root, 'server/migrations/669_v6_seed_system_templates.sql')) {
    const seed = read(root, 'server/migrations/669_v6_seed_system_templates.sql');
    const templateCount = (seed.match(/INSERT OR IGNORE INTO interview_library_templates/g) || []).length;
    checks.push({
      name: `V6-F01 Seed has ${templateCount} template INSERTs (expect 18)`,
      pass: templateCount >= 18,
    });
  }

  // F02: Modality guidance
  checks.push({
    name: 'V6-F02 Modality guidance service exists',
    pass: fileExists(root, 'server/src/services/interviewModalityGuide.ts'),
  });
  if (fileExists(root, 'server/src/services/interviewModalityGuide.ts')) {
    const guide = read(root, 'server/src/services/interviewModalityGuide.ts');
    checks.push({
      name: 'V6-F02 Has ANSWER_MODALITY_RULES and buildAIGenerationPromptPack',
      pass: includesAll(guide, ['ANSWER_MODALITY_RULES', 'buildAIGenerationPromptPack', 'QUESTION_FAMILY_MODALITY_MAP']),
    });
  }

  // ── Migration integrity ───────────────────────────────────────────────────
  checks.push({
    name: 'V6 Migration 670: insights three-layer columns',
    pass: fileExists(root, 'server/migrations/670_v6_interview_insights_three_layer.sql'),
  });

  // ── QuestionsList types ───────────────────────────────────────────────────
  const questionsList = read(root, 'src/components/Interview/QuestionsList.tsx');
  checks.push({
    name: 'V6 InterviewQuestion type has V6 fields',
    pass: includesAll(questionsList, ['description?', 'evidencePrompt?', 'voiceTranscript?', 'voiceTranscriptStatus?', 'allowVoice?']),
  });

  // ── Report ────────────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const total = checks.length;

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  V6 Interview Knowledge Collection System — Smoke Report');
  console.log('══════════════════════════════════════════════════════════════\n');

  for (const check of checks) {
    const icon = check.pass ? '✅' : '❌';
    console.log(`  ${icon}  ${check.name}`);
    if (!check.pass && check.details) {
      console.log(`      ↳ ${check.details}`);
    }
  }

  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`  TOTAL: ${passed}/${total} passed, ${failed} failed`);
  console.log(`──────────────────────────────────────────────────────────────\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
