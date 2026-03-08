#!/usr/bin/env tsx
/**
 * smoke-v5-ideas-workspace — V5-IDEA-49
 *
 * Static code checks validating V5 Ideas Workspace core contracts:
 * Seed Surface, chat handoff, SuperCanvas, 4 systems, knowledge layer,
 * artifact linking, conversion, visual system, telemetry.
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

  // ── Seed Surface ──────────────────────────────────────────────────────────
  const seedSurface = read(root, 'src/components/MyWork/table/IdeaStartupTemplates.tsx');
  checks.push({
    name: 'V5-04 Seed Surface component exists with templates',
    pass: includesAll(seedSurface, ['IdeaStartupTemplates', 'TEMPLATES', 'seed_surface']),
  });
  checks.push({
    name: 'V5-05 Hero input and primary start actions',
    pass: includesAll(seedSurface, ['heroText', 'PrimaryStartButton', 'handleSelect']),
  });
  checks.push({
    name: 'V5-06 Popular starts intent system',
    pass: includesAll(seedSurface, ['popularStarts', 'preferredSystem', 'promptEn']),
  });
  checks.push({
    name: 'V5-07 Structured brief mode',
    pass: includesAll(seedSurface, ['showStructuredBrief', 'structuredBrief', 'problem']),
  });

  // ── Entry types and handoff ───────────────────────────────────────────────
  const entryTypes = read(root, 'src/components/MyWork/ideaEntryTypes.ts');
  checks.push({
    name: 'V5-08 Chat-to-workspace handoff contract',
    pass: includesAll(entryTypes, [
      'IdeaWorkspaceSeedIntent',
      'startMode',
      'describe_with_ai',
      'blank_canvas',
      'use_template',
    ]),
  });

  // ── SuperCanvas types ─────────────────────────────────────────────────────
  const superCanvasTypes = read(root, 'src/components/MyWork/superCanvasTypes.ts');
  checks.push({
    name: 'V5-14 Object-family coexistence types',
    pass: includesAll(superCanvasTypes, ['ObjectFamily', 'NODE_TYPE_TO_FAMILY', 'mindmap']),
  });

  // ── Focus modes ────────────────────────────────────────────────────────────
  checks.push({
    name: 'V5-15 Focus modes defined',
    pass: includesAll(superCanvasTypes, ['focusMode', "'full'", "'system'", "'object'"]),
  });

  // ── Mind Map ──────────────────────────────────────────────────────────────
  const recMap = read(root, 'src/components/MyWork/IdeaRecommendationMap.tsx');
  checks.push({
    name: 'V5-17 Mind Map branch operations',
    pass: includesAll(recMap, ['detachBranch', 'duplicateBranch']),
  });
  checks.push({
    name: 'V5-43 Hierarchical color system',
    pass: includesAll(recMap, ['DEPTH_OPACITY', 'getNodeDepth', '_depth']),
  });

  // ── Process Flow ──────────────────────────────────────────────────────────
  const processFlow = read(root, 'src/components/MyWork/IdeaProcessFlowTool.tsx');
  checks.push({
    name: 'V5-21 Process Flow modes',
    pass: includesAll(processFlow, ['classic', 'automation', 'vsm']),
  });

  // ── Table ─────────────────────────────────────────────────────────────────
  const tableTool = read(root, 'src/components/MyWork/IdeaTableTool.tsx');
  checks.push({
    name: 'V5-24 Table views',
    pass: includesAll(tableTool, ['table', 'kanban', 'calendar']),
  });

  // ── Knowledge ─────────────────────────────────────────────────────────────
  checks.push({
    name: 'V5-27 Knowledge card nodes exist',
    pass: fileExists(root, 'src/components/MyWork/knowledge/KnowledgeCardNodes.tsx'),
  });

  // ── Artifact linking ──────────────────────────────────────────────────────
  const artifactLinks = read(root, 'src/utils/artifactLinks.ts');
  checks.push({
    name: 'V5-31 Unified artifact identity (19 types)',
    pass: includesAll(artifactLinks, [
      'ARTIFACT_IDENTITY',
      'ArtifactRef',
      'ArtifactIndex',
      'financial_model',
      'presentation',
      'meeting',
    ]),
  });
  checks.push({
    name: 'V5-32 Workspace object attachment contract',
    pass: includesAll(artifactLinks, [
      'WorkspaceObjectRef',
      'ObjectAttachment',
      'buildArtifactLink',
      'attachArtifactToObject',
    ]),
  });

  // ── Shared artifact UX components ─────────────────────────────────────────
  checks.push({
    name: 'V5-33 ArtifactPreviewCard exists',
    pass: fileExists(root, 'src/components/shared/NModeBlocks/ArtifactPreviewCard.tsx'),
  });
  checks.push({
    name: 'V5-33 ArtifactAttachPopover exists',
    pass: fileExists(root, 'src/components/shared/NModeBlocks/ArtifactAttachPopover.tsx'),
  });
  checks.push({
    name: 'V5-33 ArtifactLinkIndicator exists',
    pass: fileExists(root, 'src/components/shared/NModeBlocks/ArtifactLinkIndicator.tsx'),
  });

  // ── Conversion ────────────────────────────────────────────────────────────
  const workspace = read(root, 'src/components/MyWork/IdeaMapWorkspace.tsx');
  checks.push({
    name: 'V5-37 Convert whole idea supports finance targets',
    pass: includesAll(workspace, ['financial_model', 'budget', 'valuation', 'analysis']),
  });
  checks.push({
    name: 'V5-39 Traceability — LinkGraph edge on conversion',
    pass: includesAll(workspace, ['createLinkGraphEdge', 'outputLinks']),
  });

  // ── Export ────────────────────────────────────────────────────────────────
  const exportMenu = read(root, 'src/components/MyWork/IdeaExportMenu.tsx');
  checks.push({
    name: 'V5-40 Report/deck export formats',
    pass: includesAll(exportMenu, ['report', 'presentation', 'exportToReport', 'exportToPresentation']),
  });

  // ── Visual system ─────────────────────────────────────────────────────────
  checks.push({
    name: 'V5-42 Canvas background config exists',
    pass: fileExists(root, 'src/components/MyWork/canvas/canvasBackground.ts'),
  });
  checks.push({
    name: 'V5-45 Canvas zoom controls exist',
    pass: fileExists(root, 'src/components/MyWork/canvas/CanvasZoomControls.tsx'),
  });
  checks.push({
    name: 'V5-47 Motion tokens exist',
    pass: fileExists(root, 'src/components/MyWork/canvas/motionTokens.ts'),
  });

  // ── Living edges ──────────────────────────────────────────────────────────
  const gradientEdge = read(root, 'src/components/MyWork/mindmap/GradientEdge.tsx');
  checks.push({
    name: 'V5-44 Living edge with selection pulse',
    pass: includesAll(gradientEdge, ['selected', 'animate-pulse', 'group/edge']),
  });

  // ── Telemetry ─────────────────────────────────────────────────────────────
  const telemetry = read(root, 'src/services/funnelAnalytics.ts');
  checks.push({
    name: 'V5-48 V5 telemetry events defined',
    pass: includesAll(telemetry, [
      'ideas_v5_seed_surface_opened',
      'ideas_v5_system_switched',
      'ideas_v5_artifact_attached',
      'ideas_v5_convert_whole_idea',
      'ideas_v5_export_report',
    ]),
  });

  // ── Validators ────────────────────────────────────────────────────────────
  const validators = read(root, 'server/src/validators/ideaWorkspaceGraph.validators.ts');
  checks.push({
    name: 'V5-10 Workspace graph schema extended',
    pass: includesAll(validators, ['IdeaWorkspaceDocumentSchema', 'outputLinks', 'ObjectAttachmentSchema']),
  });

  // ── Report ────────────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.pass);
  const failed = checks.filter((c) => !c.pass);

  console.log(`\n[smoke:v5-ideas-workspace] ${passed.length}/${checks.length} passed\n`);

  for (const c of passed) {
    console.log(`  ✓ ${c.name}`);
  }
  for (const c of failed) {
    console.log(`  ✗ ${c.name}${c.details ? ` — ${c.details}` : ''}`);
  }

  if (failed.length > 0) {
    console.error(`\n[smoke:v5-ideas-workspace] FAILED — ${failed.length} checks did not pass\n`);
    process.exit(1);
  }

  console.log('\n[smoke:v5-ideas-workspace] ALL PASSED\n');
}

main();
