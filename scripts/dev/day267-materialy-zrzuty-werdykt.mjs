import fs from 'node:fs';
import path from 'node:path';

import { checkScreenshotPairState } from './lib/checkScreenshotPairState.mjs';
import { meanLuma } from './lib/meanLuma.mjs';

export const REQUIRED_TABS = [
  'outputs_all',
  'outputs_documents',
  'presentations',
  'outputs_sheets',
  'templates',
];
export const REQUIRED_STATES = ['ready', 'empty'];

export async function verifyDay267Screenshots(outDir) {
  const pairs = [];
  const errors = [];
  for (const tab of REQUIRED_TABS) {
    for (const state of REQUIRED_STATES) {
      const noLlm = state === 'ready' && ['outputs_all', 'outputs_documents', 'presentations'].includes(tab)
        ? '-noLLMkey'
        : '';
      const light = path.join(outDir, `${tab}-${state}-light${noLlm}.png`);
      const dark = path.join(outDir, `${tab}-${state}-dark${noLlm}.png`);
      if (!fs.existsSync(light) || !fs.existsSync(dark)) {
        errors.push(`${tab}/${state}: brak pary light/dark`);
        continue;
      }
      const [lightMeanLuma, darkMeanLuma] = await Promise.all([meanLuma(light), meanLuma(dark)]);
      const verdict = checkScreenshotPairState({
        pairName: `${tab}/${state}`,
        lightMeanLuma,
        darkMeanLuma,
        requiresResultMarker: state === 'ready',
        lightHasResultMarker: true,
        darkHasResultMarker: true,
      });
      pairs.push({ tab, state, lightMeanLuma, darkMeanLuma, ...verdict });
      errors.push(...verdict.reasons);
    }
  }

  for (const tab of REQUIRED_TABS) {
    for (const theme of ['light', 'dark']) {
      const noLlm = ['outputs_all', 'outputs_documents', 'presentations'].includes(tab)
        ? '-noLLMkey'
        : '';
      const preview = path.join(outDir, `${tab}-ready-${theme}-preview-open${noLlm}.png`);
      if (!fs.existsSync(preview)) errors.push(`${tab}/${theme}: brak podglądu po kliknięciu`);
    }
  }
  return { ok: errors.length === 0, pairs, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = process.argv[2] || '/private/tmp/cx-day267-materialy-zrzuty-artefakty';
  const result = await verifyDay267Screenshots(outDir);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
