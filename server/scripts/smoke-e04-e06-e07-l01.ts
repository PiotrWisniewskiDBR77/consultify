#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function hasAll(content: string, needles: string[]): boolean {
  return needles.every((n) => content.includes(n));
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const toolsSpecs = read(path.join(root, 'docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md'));
  const toolsModel = read(path.join(root, 'docs/product/CONSULTING_TOOLS_V3.md'));
  const toolsAudit = read(path.join(root, 'docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md'));
  const menuConfig = read(path.join(root, 'src/components/navigation/Sidebar/menuConfig.ts'));
  const routeConfig = read(path.join(root, 'src/routes/routeConfig.ts'));
  const appRoutes = read(path.join(root, 'src/routes/AppRoutes.tsx'));
  const comingSoonView = read(path.join(root, 'src/views/V4ComingSoonView.tsx'));

  checks.push({
    name: 'E04: consulting tools specs include full set up to Tool #31',
    pass: hasAll(toolsSpecs, ['3.31 Tool #31', 'process-automation']),
  });
  checks.push({
    name: 'E04: known tools audit references consulting tools (31)',
    pass: hasAll(toolsAudit, ['Consulting tools (31)', 'library_content_translations']),
  });
  checks.push({
    name: 'E07: audit contains 6 missing tools with plan',
    pass: hasAll(toolsAudit, [
      'ambition-decomposer',
      'focus-tradeoff',
      'narrative-engine',
      'smed-planner',
      'dms-builder',
      'inventory-autopilot',
    ]),
  });
  checks.push({
    name: 'E07: audit table includes priority/owner/ETA governance',
    pass: hasAll(toolsAudit, ['Priorytet', 'Owner', 'ETA', 'L, KB, GFX, VID']),
  });

  checks.push({
    name: 'E06: methodology pack canonical model present',
    pass: hasAll(toolsModel, ['Canonical artefact: Methodology Pack', 'framework_code', 'SIRI', 'ADMA']),
  });
  checks.push({
    name: 'E06: v3 program spec includes SIRI/ADMA parity acceptance',
    pass: hasAll(
      read(path.join(root, 'docs/product/V3_IMPLEMENTATION_PROGRAM.md')),
      ['SIRI session', 'ADMA session', 'Open methodology']
    ),
  });

  checks.push({
    name: 'L01: sidebar contains MCP IRIS + MCP Marketplace with soon badge',
    pass: hasAll(menuConfig, ['MCP_IRIS', 'MCP_MARKETPLACE', "badge: 'soon'"]),
  });
  checks.push({
    name: 'L01: routes map MCP paths',
    pass: hasAll(routeConfig, ['MCP_IRIS', 'MCP_MARKETPLACE']),
  });
  checks.push({
    name: 'L01: AppRoutes wires coming soon view for both entries',
    pass: hasAll(appRoutes, ['MCP_IRIS', 'MCP Marketplace', 'V4ComingSoonView']),
  });
  checks.push({
    name: 'L01: coming soon screen has 3 bullets and no CTA',
    pass: hasAll(comingSoonView, ['Coming soon (V4)', 'bullets']) && !comingSoonView.includes('waitlist'),
  });

  const failed = checks.filter((c) => !c.pass);
  console.log('\n[smoke-e04-e06-e07-l01] Summary:');
  for (const c of checks) {
    console.log(` - ${c.pass ? 'OK' : 'FAIL'} ${c.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((f) => f.name).join(', ')}`);
  }

  console.log('\n[smoke-e04-e06-e07-l01] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-e04-e06-e07-l01] Failed:', (error as Error)?.message || error);
  process.exit(1);
}
