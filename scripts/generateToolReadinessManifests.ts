/**
 * Generuje docs/program/METHOD_TOOLS_2026-08-13/readiness/<toolType>.json
 * z src/toolPacks/readiness/manifests.ts (JEDYNE źródło prawdy — ten skrypt
 * tylko serializuje, nie decyduje o żadnej wartości).
 *
 * Uruchom: npx tsx scripts/generateToolReadinessManifests.ts
 *
 * `readinessManifests.test.ts` sprawdza, że plik na dysku zgadza się z
 * modułem TS — jeśli ktoś zmieni manifests.ts i zapomni odpalić ten skrypt,
 * test to złapie (nie cichy rozjazd).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { listToolReadinessRecords } from '../src/toolPacks/readiness/manifests';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../docs/program/METHOD_TOOLS_2026-08-13/readiness');

fs.mkdirSync(OUT_DIR, { recursive: true });

const records = listToolReadinessRecords();

for (const record of records) {
  const outPath = path.join(OUT_DIR, `${record.toolType}.json`);
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2) + '\n', 'utf8');
  // eslint-disable-next-line no-console
  console.log(`wrote ${outPath}`);
}

// eslint-disable-next-line no-console
console.log(`${records.length} manifests written to ${OUT_DIR}`);
