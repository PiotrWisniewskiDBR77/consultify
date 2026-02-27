#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean; details?: string };

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function countMatches(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const siriStructure = read(path.join(root, 'src/services/siriStructure.ts'));
  const admaStructure = read(path.join(root, 'src/services/admaStructure.ts'));
  const siriKnowledge = read(path.join(root, 'src/services/assessmentKnowledge/siriKnowledge.ts'));
  const admaKnowledge = read(path.join(root, 'src/services/assessmentKnowledge/admaKnowledge.ts'));
  const siriEditor = read(path.join(root, 'src/components/assessment/siri/SIRIAssessmentEditor.tsx'));
  const admaEditor = read(path.join(root, 'src/components/assessment/adma/ADMAAssessmentEditor.tsx'));
  const siriMap = read(path.join(root, 'src/components/assessment/maps/SIRIAssessmentMap.tsx'));
  const admaMap = read(path.join(root, 'src/components/assessment/maps/ADMAAssessmentMap.tsx'));

  const siriDimensions = countMatches(siriStructure, /id:\s*'[^']+'/g);
  const admaDimensions = countMatches(admaStructure, /id:\s*'[^']+'/g);
  const siriLevels = countMatches(siriStructure, /level:\s*[0-9]+/g);
  const admaLevels = countMatches(admaStructure, /level:\s*[0-9]+/g);

  checks.push({
    name: 'E06 structure: both frameworks define dimensions',
    pass: siriDimensions >= 8 && admaDimensions >= 12,
    details: `SIRI dimensions=${siriDimensions}, ADMA dimensions=${admaDimensions}`,
  });

  checks.push({
    name: 'E06 structure: both frameworks define maturity/scoring levels',
    pass: siriLevels >= 6 && admaLevels >= 5,
    details: `SIRI levels=${siriLevels}, ADMA levels=${admaLevels}`,
  });

  checks.push({
    name: 'E06 structure: both frameworks expose scoring helpers',
    pass:
      siriStructure.includes('calculateOverallSIRIScore') &&
      admaStructure.includes('calculateOverallADMAScore') &&
      siriStructure.includes('calculateBlockScore') &&
      admaStructure.includes('calculatePillarScore'),
  });

  checks.push({
    name: 'E06 knowledge: both frameworks expose evidence/common mistakes and level meaning',
    pass:
      siriKnowledge.includes('evidenceGuidance') &&
      siriKnowledge.includes('commonMistakes') &&
      siriKnowledge.includes('levelMeaning') &&
      admaKnowledge.includes('evidenceGuidance') &&
      admaKnowledge.includes('commonMistakes') &&
      admaKnowledge.includes('levelMeaning'),
  });

  checks.push({
    name: 'E06 editors: both frameworks have dedicated assessment editors',
    pass:
      siriEditor.includes('export const SIRIAssessmentEditor') &&
      admaEditor.includes('export const ADMAAssessmentEditor'),
  });

  checks.push({
    name: 'E06 maps: both frameworks have dedicated assessment map views',
    pass:
      siriMap.includes('export const SIRIAssessmentMap') &&
      admaMap.includes('export const ADMAAssessmentMap'),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-e06-methodology-parity] Summary:');
  for (const check of checks) {
    const suffix = check.details ? ` (${check.details})` : '';
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}${suffix}`);
  }

  if (failed.length > 0) {
    throw new Error(`Parity failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-e06-methodology-parity] Parity checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-e06-methodology-parity] Failed:', (error as Error)?.message || error);
  process.exit(1);
}

