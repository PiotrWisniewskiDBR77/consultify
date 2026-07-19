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
    pass: fileExists(root, 'server/migrations/never-ran/665_v6_interview_templates_foundation.sql'),
  });
  checks.push({
    name: 'V6-A01 Migration 666: runtime answers schema',
    pass: fileExists(root, 'server/migrations/never-ran/666_v6_interview_runtime_answers.sql'),
  });
  checks.push({
    name: 'V6-A01 Migration 668: question helper fields',
    pass: fileExists(root, 'server/migrations/never-ran/668_v6_interview_question_helper_fields.sql'),
  });

  const m666 = read(root, 'server/migrations/never-ran/666_v6_interview_runtime_answers.sql');
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
    pass: includesAll(runtime, ['handleFilePicked', 'handleAddLink', 'contextDraft', 'fileInputRef', 'showLinkForm']),
  });
  checks.push({
    name: 'V6-C03 Evidence prompt display',
    pass: includesAll(runtime, ['evidencePrompt']),
  });
  checks.push({
    name: 'V6-C03 Helper text display',
    pass: includesAll(runtime, ['description', 'HelpCircle']),
  });

  // C03b: AI Improve + AI Explain in runtime
  checks.push({
    name: 'V6-C03 AI Improve answer in runtime',
    pass: includesAll(runtime, ['handleAiImprove', 'aiImproveResult', 'ai-improve']),
  });
  checks.push({
    name: 'V6-C03 AI Explain question in runtime',
    pass: includesAll(runtime, ['handleAiExplain', 'aiExplainResult', 'ai-explain']),
  });

  // C03c: AI Improve + AI Explain backend endpoints
  checks.push({
    name: 'V6-C03 AI Improve endpoint exists',
    pass: controller.includes('aiImproveAnswer') && read(root, 'server/src/routes/interview.routes.ts').includes('ai-improve'),
  });
  checks.push({
    name: 'V6-C03 AI Explain endpoint exists',
    pass: controller.includes('aiExplainQuestion') && read(root, 'server/src/routes/interview.routes.ts').includes('ai-explain'),
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

  // D04: Retrieval over interview knowledge
  checks.push({
    name: 'V6-D04 searchInterviewKnowledge handler',
    pass: controller.includes('searchInterviewKnowledge'),
  });
  const interviewRoutes = read(root, 'server/src/routes/interview.routes.ts');
  checks.push({
    name: 'V6-D04 knowledge/search route registered',
    pass: interviewRoutes.includes('/knowledge/search'),
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

  // E04: Multi-session aggregation
  checks.push({
    name: 'V6-E04 buildV6Prompt handles multi-session',
    pass: insightService.includes('CROSS-SESSION') || insightService.includes('cross_session_pattern'),
  });
  checks.push({
    name: 'V6-E04 crossSessionPattern in types/parsing',
    pass: insightService.includes('crossSessionPattern'),
  });
  checks.push({
    name: 'V6-E04 multi-session link graph edges',
    pass: controller.includes('sessionIds') && controller.includes('created_from'),
  });

  // ── WS-F: Library & Delivery ──────────────────────────────────────────────

  // F01: Seed templates
  // NOTE (E-MIG6XX): the original 669_v6_seed_system_templates.sql never actually ran on the
  // live DB -- it predates the boot autorun regex (/^(7\d{2}|\d{8})_.*\.sql$/) and used
  // SQLite-only `INSERT OR IGNORE`, so it is archived to never-ran/ as dead/historical. The
  // Postgres-native, autorun-eligible replacement is 20260720_seed_v6_interview_library_templates.sql.
  checks.push({
    name: 'V6-F01 18 system templates seeded',
    pass: fileExists(root, 'server/migrations/20260720_seed_v6_interview_library_templates.sql'),
  });
  if (fileExists(root, 'server/migrations/20260720_seed_v6_interview_library_templates.sql')) {
    const seed = read(root, 'server/migrations/20260720_seed_v6_interview_library_templates.sql');
    const templateCount = (seed.match(/^INSERT INTO interview_library_templates$/gm) || []).length;
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

  // ── WS-B: Template Lifecycle ────────────────────────────────────────────

  // B05: Archive / restore
  checks.push({
    name: 'V6-B05 Archive template handler exists',
    pass: controller.includes('archiveTemplate'),
  });
  checks.push({
    name: 'V6-B05 Restore template handler exists',
    pass: controller.includes('restoreTemplate'),
  });
  const routesFile = read(root, 'server/src/routes/interview.routes.ts');
  checks.push({
    name: 'V6-B05 Archive/restore routes registered',
    pass: routesFile.includes('/archive') && routesFile.includes('/restore'),
  });

  // ── WS-B: Templates Studio ────────────────────────────────────────────────

  // B04: Question quality evaluator
  const qualityRules = read(root, 'server/src/services/interviewQuestionQualityRules.ts');
  checks.push({
    name: 'V6-B04 Question quality evaluator service exists',
    pass: qualityRules.includes('evaluateQuestionQuality') && qualityRules.includes('calculateQuestionScore'),
  });
  checks.push({
    name: 'V6-B04 Quality rules cover key patterns',
    pass: includesAll(qualityRules, ['too_short', 'double_barreled', 'leading', 'missing_options', 'vague']),
  });

  // V6-B01: Templates Hub redesign — cards view
  const hubSrc = read(root, 'src/components/Interview/InterviewHub.tsx');
  checks.push({
    name: 'V6-B01 Templates cards view exists',
    pass: hubSrc.includes('renderTemplatesCards') && hubSrc.includes('templatesViewMode'),
  });
  checks.push({
    name: 'V6-B01 View toggle (cards/table)',
    pass: hubSrc.includes('LayoutGrid') || hubSrc.includes("'cards'"),
  });

  // V6-B02: AI brief -> draft template flow
  const builderSrc = read(root, 'src/components/Interview/TemplateBuilder.tsx');
  checks.push({
    name: 'V6-B02 AI generate template from brief',
    pass: builderSrc.includes('handleGenerateWithAI') && builderSrc.includes('sendMessageToAI'),
  });

  // V6-B03: Builder workspace layout
  checks.push({
    name: 'V6-B03 Builder has left panel + questions DnD',
    pass: builderSrc.includes('DndContext') && builderSrc.includes('SortableContext') && builderSrc.includes('w-[300px]'),
  });

  // V6-B05: Lifecycle — evaluate-quality route
  checks.push({
    name: 'V6-B05 evaluate-quality route registered',
    pass: interviewRoutes.includes('evaluate-quality'),
  });

  // ── Migration integrity ───────────────────────────────────────────────────
  checks.push({
    name: 'V6 Migration 670: insights three-layer columns',
    pass: fileExists(root, 'server/migrations/never-ran/670_v6_interview_insights_three_layer.sql'),
  });

  // ── QuestionsList types ───────────────────────────────────────────────────
  const questionsList = read(root, 'src/components/Interview/QuestionsList.tsx');
  checks.push({
    name: 'V6 InterviewQuestion type has V6 fields',
    pass: includesAll(questionsList, ['description?', 'evidencePrompt?', 'voiceTranscript?', 'voiceTranscriptStatus?', 'allowVoice?']),
  });

  // ── WS-G: Gap Closure Features ──────────────────────────────────────────

  // GAP-1: buildTemplateQuestionResponse returns description + evidencePrompt
  checks.push({
    name: 'V6-GAP1 buildTemplateQuestionResponse includes description & evidencePrompt',
    pass: includesAll(controller, ['buildTemplateQuestionResponse', "description: row.description", "evidencePrompt: row.evidence_prompt"]),
  });

  // GAP-2: evaluateSessionAnswers handler + route
  checks.push({
    name: 'V6-GAP2 evaluateSessionAnswers handler exists',
    pass: controller.includes('evaluateSessionAnswers'),
  });
  checks.push({
    name: 'V6-GAP2 evaluate-answers route registered',
    pass: interviewRoutes.includes('evaluate-answers'),
  });

  // GAP-3: Reviewer approve/send-back actions wired in InterviewWorkspace
  checks.push({
    name: 'V6-GAP3 Reviewer approve & send-back actions in workspace',
    pass: includesAll(workspace, ['handleApprove', 'handleSendBack', 'isReviewerMode', 'showSendBackForm']),
  });

  // GAP-4: Assignment deep link in InterviewHub
  checks.push({
    name: 'V6-GAP4 assignmentIdFromUrl deep link in InterviewHub',
    pass: includesAll(hub, ['assignmentIdFromUrl', 'openInterviewAssignmentFull']),
  });

  // GAP-5: confidence_score (not confidence) in interviewInferenceService
  const inferenceService = read(root, 'server/src/services/interviewInferenceService.ts');
  checks.push({
    name: 'V6-GAP5 interviewInferenceService uses confidence_score',
    pass: inferenceService.includes('confidence_score') && !inferenceService.includes('q.confidence,'),
  });

  // GAP-6: Auto-save timer in InterviewSingleQuestionRuntime
  checks.push({
    name: 'V6-GAP6 Auto-save timer ref and effect in runtime',
    pass: includesAll(runtime, ['autoSaveTimerRef', 'autoSaved', 'persistCurrentQuestion']),
  });

  // GAP-7: Voice transcript discard button in runtime
  checks.push({
    name: 'V6-GAP7 Voice transcript discard button exists',
    pass: includesAll(runtime, ['Discard', 'voiceTranscriptDraft']),
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
