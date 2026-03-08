#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((needle) => content.includes(needle));
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const notebookContent = read(root, 'src/components/MyWork/NotebookContent.tsx');
  const notebookContext = read(root, 'src/components/MyWork/notebook/NotebookContextPanel.tsx');
  const notebookPrompt = read(root, 'src/components/MyWork/notebook/AICommandPrompt.tsx');
  const notebookInline = read(root, 'src/components/MyWork/notebook/AIInlineResponse.tsx');
  const notebookExtensions = read(root, 'src/components/MyWork/notebook/extensions.ts');
  const notebookService = read(root, 'server/src/services/notebookService.ts');
  const myWorkRoutes = read(root, 'server/src/routes/my-work.routes.ts');
  const interviewController = read(root, 'server/src/controllers/InterviewController.ts');
  const interviewRoutes = read(root, 'server/src/routes/interview.routes.ts');
  const interviewWorkspace = read(root, 'src/components/Interview/InterviewWorkspace.tsx');
  const evidencePanel = read(root, 'src/components/Interview/EvidencePanel.tsx');

  checks.push({
    name: 'Notebook create-from-note uses outline-first modal for report presentation and assessment',
    pass: includesAll(notebookContent, [
      "const [outlineDraft, setOutlineDraft]",
      "target === 'assessment' || target === 'report' || target === 'presentation'",
      'handleConfirmOutlineDraft',
      "handleConvertFromPanel('assessment')",
    ]),
  });

  checks.push({
    name: 'Notebook AI now uses propose accept instead of direct insert',
    pass:
      includesAll(notebookPrompt, [
        'Api.notebookCreateAIProposal',
        "proposalType: 'append'",
        'onProposalCreated?.()',
      ]) &&
      includesAll(notebookInline, [
        'Propose for note',
      ]) &&
      includesAll(notebookContent, [
        'pendingAIProposals',
        'resolveNotebookAIProposal',
        "AI propose -> accept",
      ]),
  });

  checks.push({
    name: 'Notebook embedded references are inline chips with preview metadata',
    pass:
      includesAll(notebookExtensions, [
        "name: 'embeddedRef'",
        "'data-embedded-ref'",
        "class: 'nb-embedded-ref'",
      ]) &&
      includesAll(notebookContext, [
        'insertEmbeddedRef',
        "type: 'embeddedRef'",
        "target: { type: 'notebook_page', id: n.id }",
      ]) &&
      includesAll(notebookContent, [
        'selectedEmbedPreview',
        "closest?.('[data-embedded-ref]')",
      ]) &&
      includesAll(notebookService, [
        'notebook_page',
        'assessment',
        'snippetCols',
      ]),
  });

  checks.push({
    name: 'Notebook backend conversion supports assessment artifacts',
    pass: includesAll(myWorkRoutes, [
      'task|decision|initiative|report|presentation|assessment',
      "target === 'assessment'",
      "sourceType: 'assessment'",
    ]),
  });

  checks.push({
    name: 'Interview supporting materials persist comments and linked object refs',
    pass:
      includesAll(interviewController, [
        'ensureInterviewEvidenceColumns',
        'category || null',
        'getLinkedItems',
        'addLinkedItem',
        'deleteLinkedItem',
      ]) &&
      includesAll(interviewRoutes, [
        '/sessions/:sessionId/linked-items',
        "router.post('/sessions/:sessionId/linked-items'",
      ]) &&
      includesAll(interviewWorkspace, [
        '/linked-items',
        'handleAddEvidenceComment',
        'setLinkedItems',
        "type: 'assessment'",
      ]) &&
      includesAll(evidencePanel, [
        "export type EvidenceType = 'file' | 'link' | 'comment'",
        'onAddComment',
        "setShowAddType('comment')",
      ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-v3-notebook-interview-closure] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-v3-notebook-interview-closure] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error(
    '[smoke-v3-notebook-interview-closure] Failed:',
    (error as Error)?.message || error
  );
  process.exit(1);
}
