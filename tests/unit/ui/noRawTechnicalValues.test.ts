import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { KpiScorecardDto } from '../../../src/components/ResultsVNext/kpiScorecards/kpiScorecardApi';
import { buildKpiScorecardPreview } from '../../../src/components/ResultsVNext/kpiScorecards/kpiScorecardPresenters';
import { getOkrSetChildEditLock } from '../../../src/components/ResultsVNext/okr/okrObjectiveMappers';
import { capacityUnitLabel } from '../../../src/labels/capacityUnitLabels';
import { fileFormatLabel } from '../../../src/labels/fileFormatLabels';
import { sourceLabel } from '../../../src/labels/ideaSourceLabels';
import { normalizeTemplateCategory } from '../../../src/labels/interviewCategoryLabels';

const UUID = 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2';
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SCREAMING_CASE_PATTERN = /\b[A-Z]{3,}(?:_[A-Z]+)+\b/;
const FORBIDDEN_COPY = new RegExp(['assert[A-Z]\\w+', 'kod' + ' serwera:', 'server rule:'].join('|'), 'i');

const valueText = (value: unknown) =>
  renderToStaticMarkup(
    React.createElement(React.Fragment, null, React.isValidElement(value) ? value : String(value ?? ''))
  );

function sevenScreenTexts(): Record<string, string> {
  const scorecard: KpiScorecardDto = {
    scorecardId: UUID,
    organizationId: 'org-1',
    name: 'Karta zarządu',
    description: null,
    scopeType: 'organization',
    scopeId: 'org-1',
    ownerUserId: UUID,
    ownerName: null,
    reviewFrequency: 'monthly',
    lifecycleStatus: 'draft',
    rowVersion: 1,
    createdBy: UUID,
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  };
  const preview = buildKpiScorecardPreview(scorecard, {
    isPolish: true,
    currentUserId: UUID,
    resolveMemberName: () => 'Piotr Wiśniewski',
    resolveScopeName: () => 'DBR77',
    busy: false,
    onActivate: () => {},
    onSuspend: () => {},
    onArchive: () => {},
    onClose: () => {},
  });
  const previewText = preview.details?.properties?.map((property) => valueText(property.value)).join(' ') ?? '';
  const lock = getOkrSetChildEditLock('active');

  return {
    'Pomysły — podgląd': `Źródło: ${sourceLabel('manual', true)}`,
    'Wywiad — Przydzielone i Szablony': normalizeTemplateCategory('COMMERCIAL', true),
    'Realizacja — Obciążenie': `2/2/2 ${capacityUnitLabel('MONTH', true)}`,
    'Materiały — biblioteka': fileFormatLabel('Unknown', true),
    'KPI — zestawienie i podgląd': previewText,
    'KPI — modal nowego zestawienia': 'Właściciel Ty',
    'OKR — blokada edycji': lock?.reason.pl ?? '',
  };
}

describe('no raw technical values in UI', () => {
  it('keeps all seven acceptance-screen fixtures free of UUID and technical enums', () => {
    const screens = sevenScreenTexts();
    expect(Object.keys(screens)).toHaveLength(7);
    Object.entries(screens).forEach(([screen, text]) => {
      expect(text, screen).not.toMatch(UUID_PATTERN);
      expect(text, screen).not.toMatch(SCREAMING_CASE_PATTERN);
      expect(text, screen).not.toMatch(FORBIDDEN_COPY);
      expect(text, screen).not.toMatch(/\bUnknown\b|\bmanual\b/);
    });
  });

  it('guards identity cells and the owner modal against direct id rendering', () => {
    const presenter = fs.readFileSync(
      path.resolve('src/components/ResultsVNext/kpiScorecards/kpiScorecardPresenters.tsx'),
      'utf8'
    );
    const modal = fs.readFileSync(
      path.resolve('src/components/ResultsVNext/kpiScorecards/CreateKpiScorecardModal.tsx'),
      'utf8'
    );
    expect(presenter).not.toMatch(
      /\{\s*(?:row|item)\.(?:ownerId|ownerUserId|addedBy|createdBy|publishedBy|scopeId)\s*\}/
    );
    expect(modal).not.toMatch(/\(\s*\{currentUserId\}\s*\)/);
  });
});
