/**
 * R12 — source-anchor guard (raw source-text assertions, no mount): the
 * canonical T35 table is wired in, and BenefitsRegisterPanel + the six lane
 * tiles are preserved (relocated, not deleted).
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const VIEW_PATH = path.resolve(
  __dirname,
  '../../../src/components/Execution/ExecutionManagementView.tsx'
);
const source = readFileSync(VIEW_PATH, 'utf-8');

describe('R12 ExecutionManagementView wiring — source anchors', () => {
  it('imports and mounts ExecutionManagementTable', () => {
    expect(source).toContain(
      "import { ExecutionManagementTable, type ManagementLaneRow } from './ExecutionManagementTable';"
    );
    expect(source).toContain('<ExecutionManagementTable rows={laneRows} onOpenLane={setSubview} />');
  });

  it('preserves BenefitsRegisterPanel and the six-tile grid below the table', () => {
    const tableIdx = source.indexOf('<ExecutionManagementTable');
    const panelIdx = source.indexOf("isExecutionFlagEnabled('benefits') && <BenefitsRegisterPanel />");
    const gridIdx = source.indexOf('filteredTiles.map((tile)');
    expect(tableIdx).toBeGreaterThan(-1);
    expect(panelIdx).toBeGreaterThan(tableIdx);
    expect(gridIdx).toBeGreaterThan(panelIdx);
  });

  it('lane row action opens the real existing subview transition (setSubview), not a new capability', () => {
    expect(source).toContain('onClick={() => setSubview(tile.id)}');
  });
});

describe('R12 ExecutionHub.tsx — untouched (mount site is a single clean prop-drilling call)', () => {
  it('mounts ExecutionManagementView unmodified at the people_change tab', () => {
    const HUB_PATH = path.resolve(__dirname, '../../../src/components/Execution/ExecutionHub.tsx');
    const hubSource = readFileSync(HUB_PATH, 'utf-8');
    expect(hubSource).toContain("if (activeTab === ('people_change' as ModuleTab)) {");
    expect(hubSource).toContain('<ExecutionManagementView');
    expect(hubSource).not.toContain('ExecutionManagementTable');
  });
});
