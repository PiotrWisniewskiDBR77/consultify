#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((needle) => content.includes(needle));
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const inbox = read(path.join(root, 'src/components/MyWork/InboxContent.tsx'));
  const notebook = read(path.join(root, 'src/components/MyWork/NotebookContent.tsx'));
  const ideasList = read(path.join(root, 'src/components/MyWork/MyIdeasListContent.tsx'));
  const ideaMap = read(path.join(root, 'src/components/MyWork/IdeaMapWorkspace.tsx'));
  const focusCockpit = read(path.join(root, 'src/components/MyWork/FocusCockpit.tsx'));
  const decisionsTimeline = read(path.join(root, 'src/components/MyWork/DecisionsTimelineView.tsx'));
  const ideaCanvasSelector = read(path.join(root, 'src/components/MyWork/IdeaCanvasToolSelector.tsx'));
  const myWorkRoutes = read(path.join(root, 'server/src/routes/my-work.routes.ts'));
  const api = read(path.join(root, 'src/services/api.ts'));

  checks.push({
    name: 'C01 inbox preview pane + keyboard contract',
    pass: includesAll(inbox, [
      'PreviewPaneShell',
      "case 'Enter':",
      "case 'Escape':",
      'J/K',
      'single click',
      'double-click',
    ]),
  });

  checks.push({
    name: 'C02/C03 backend convert flow supports report/presentation + sourceSessionId',
    pass: includesAll(myWorkRoutes, [
      "target === 'report'",
      "type: 'presentation'",
      'sourceSessionId',
      'converted_to_json',
    ]),
  });

  checks.push({
    name: 'C02/C03 frontend convert analytics and session materialization events',
    pass:
      includesAll(notebook, ['mywork_convert_completed', 'mywork_session_materialized']) &&
      includesAll(ideasList, ['mywork_convert_completed', 'mywork_session_materialized']) &&
      includesAll(ideaMap, ['mywork_convert_completed', 'mywork_session_materialized']),
  });

  checks.push({
    name: 'C02/C03 API typing exposes sourceSessionId for convert endpoints',
    pass: includesAll(api, ['sourceSessionId?: string', 'convertNotebookPage', 'convertMyIdea']),
  });

  checks.push({
    name: 'C04 focus cockpit exists with three-lane model and drag/drop',
    pass: includesAll(focusCockpit, [
      'FocusCockpit',
      "'my_list' | 'today' | 'this_week'",
      'draggable',
      'onMoveTask',
      'onCreateTask',
    ]),
  });

  checks.push({
    name: 'C05 decisions timeline replaces queue and defines timeline zoom',
    pass: includesAll(decisionsTimeline, [
      'replaces the "queue view"',
      'zoomDay',
      'zoomWeek',
      'zoomMonth',
      'zoomQuarter',
    ]),
  });

  checks.push({
    name: 'C06 ideas tool selector uses shared nodes/edges core model',
    pass: includesAll(ideaCanvasSelector, [
      'IdeaCanvasToolSelector',
      'Shared data model',
      'nodes: IdeaNode[]',
      'edges: IdeaEdge[]',
    ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-c-ws] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-c-ws] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-c-ws] Failed:', (error as Error)?.message || error);
  process.exit(1);
}

