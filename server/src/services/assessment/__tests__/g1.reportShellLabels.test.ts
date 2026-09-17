/**
 * [ODMROZENIE 03_ASSESSMENT DEC-461] ETYKIETY POWŁOKI RAPORTU IDĄ ZA
 * `contract.language`, NIE za profilem dokumentu.
 *
 * ★ POMIAR, KTÓRY TEN PLIK PILNUJE. Na stagingu po wdrożeniu narracji EN
 * raport EN drukował polskie etykiety powłoki: `Tabela` ×9–10, `Rysunek` ×1
 * i stopkę `Strona` — bo `documentDocxRenderer.ts` wybierał je warunkiem
 * `drdProfile ? 'Tabela N.' : 'Table N'` (\":1048, :1079, :1137), a stopka
 * miała literał `'Strona '` (\":2240) mimo liczonego obok `defaultPageLabel`.
 * Licznik diakrytyków tego NIE łapie („Tabela"/„Strona" nie mają polskich
 * znaków) — dlatego asercja liczy SŁOWA, nie znaki.
 *
 * PL jest snapshotem bajtowym: suma treści document.xml + header*.xml +
 * footer*.xml zmierzona PRZED naprawą i przypięta na sztywno.
 *
 * DOWÓD MUTACYJNY: przywrócenie warunku `drdProfile ?` (bez języka) albo
 * literału `'Strona '` robi test EN czerwonym.
 */
import { createHash } from 'node:crypto';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../../documentStudio/documentDocxRenderer.js';
import {
  buildAssessmentDrdReportSchema,
  type AssessmentReportContract,
} from '../assessmentDrdReportSchemaService.js';
import {
  composeReportContract,
  type ReportContractInput,
} from '../assessmentReportContractComposer.js';
import { formatEmployeeCount } from '../assessmentReportContractService.js';

const POLSKIE_ETYKIETY_POWLOKI = /\b(Tabela|Rysunek|Strona)\b/gu;

const SHELL_PARTS = [
  /^word\/document\.xml$/u,
  /^word\/header\d*\.xml$/u,
  /^word\/footer\d*\.xml$/u,
];

function wejscie(language: 'pl' | 'en'): ReportContractInput {
  return {
    sessionId: 'assess-shell-labels',
    outputId: null,
    revision: 0,
    generatedAt: '2026-09-17T09:00:00.000Z',
    assessmentUpdatedAt: '2026-09-06T10:42:05.393Z',
    methodVersion: 'DRD assessment (recorded)',
    sourceKind: 'legacy',
    language,
    sessionLabel: {
      displayName: 'Operational Excellence Programme',
      source: 'project',
      projectId: null,
    },
    businessProfile: 'Manufacturing',
    employment: formatEmployeeCount(340, language),
    assessmentPeriod: language === 'en' ? '7 August 2026' : '7 sierpnia 2026',
    assessor: 'James Whitfield',
    clientSponsor: null,
    findings: [1, 2, 3].map((axisId) => ({
      id: `legacy:assess-shell-labels:${axisId}A`,
      outputId: 'legacy:assess-shell-labels',
      unitId: `${axisId}A`,
      unitName: `Area ${axisId}A`,
      currentLevel: 2,
      targetLevel: 5,
      gap: 3,
      supportingEvidence: [],
      contradictingEvidence: [],
      businessMeaning: '',
      rootCauseHypothesis: null,
      riskOrOpportunity: null,
      recommendation: '',
      prerequisite: null,
      expectedOutcome: null,
      kpiProposal: null,
      confidence: 'medium' as const,
      priorityRationale: null,
      sourceLocators: [],
      createdAt: '2026-09-06T06:29:09.104Z',
    })),
    limitations: [],
    skipReasons: [],
    assessorNotes: {},
  };
}

function kontrakt(language: 'pl' | 'en'): AssessmentReportContract {
  return composeReportContract(wejscie(language)) as unknown as AssessmentReportContract;
}

async function tekstPowloki(language: 'pl' | 'en'): Promise<string> {
  const zip = await JSZip.loadAsync(
    await renderDocumentSchemaToDocxBuffer(
      buildAssessmentDrdReportSchema(kontrakt(language), 'Northwind Manufacturing Ltd.')
    )
  );
  const names = Object.keys(zip.files)
    .filter((name) => SHELL_PARTS.some((pattern) => pattern.test(name)))
    .sort();
  expect(names.length, 'powłoka DOCX musi mieć document.xml + nagłówki + stopki').toBeGreaterThan(
    2
  );
  return (await Promise.all(names.map((name) => zip.file(name)!.async('string')))).join('\n');
}

describe('Etykiety powłoki raportu DRD idą za contract.language', () => {
  it('DOCX EN: 0 wystąpień „Tabela"/„Rysunek"/„Strona" w document.xml, nagłówkach i stopkach', async () => {
    const shell = await tekstPowloki('en');
    const trafienia = shell.match(POLSKIE_ETYKIETY_POWLOKI) ?? [];
    expect(trafienia).toEqual([]);
    // EN musi nieść angielskie etykiety — inaczej asercja byłaby zielona
    // także dla pustej powłoki.
    expect(shell).toContain('Table 1');
    expect(shell).toContain('Page ');
  });

  it('DOCX PL: powłoka bajt w bajt jak przed naprawą (snapshot treści)', async () => {
    const shell = await tekstPowloki('pl');
    // Zmierzone 2026-09-17 na linii b1ab38d4d6 PRZED naprawą renderera.
    expect(createHash('sha256').update(shell).digest('hex')).toBe(
      '6d780e5d2016d7f043ec153901353ff3dfaf1d5cbb3843f227adb4c67af35b0d'
    );
    expect(shell.match(POLSKIE_ETYKIETY_POWLOKI) ?? []).not.toEqual([]);
  });
});
