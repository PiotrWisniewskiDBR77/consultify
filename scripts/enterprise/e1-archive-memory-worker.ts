import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

import { Pool } from 'pg';

const rows = Number(process.env.E1_ARCHIVE_ROWS || 0);
const width = Number(process.env.E1_ARCHIVE_WIDTH || 0);
const mode = process.env.E1_ARCHIVE_MODE === 'whole-file-mutant' ? 'whole-file-mutant' : 'production';
const databaseUrl = process.env.DATABASE_URL || '';
if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(width) || width < 1 || !databaseUrl) {
  throw new Error('E1 archive memory worker requires rows, width and DATABASE_URL');
}

// A real deliberate mutation without changing the checked-out source: replace the
// built-in stream factory before dynamically importing the production archive module.
// The returned stream contains one complete file Buffer, reproducing a whole-file
// receipt regression while every other archive step remains identical.
if (mode === 'whole-file-mutant') {
  fs.createReadStream = ((filePath: fs.PathLike) =>
    Readable.from([fs.readFileSync(filePath)])) as typeof fs.createReadStream;
  syncBuiltinESMExports();
}

const [{ writeOrganizationExportArchiveStreaming }, { withOrganizationExportSnapshot }] =
  await Promise.all([
    import('../../server/src/services/organizationExportArchiveService.js'),
    import('../../server/src/services/organizationExportSnapshot.js'),
  ]);

const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const orgId = `e1-memory-${mode}-${randomUUID()}`;
const output = path.join(os.tmpdir(), `e1-memory-${mode}-${randomUUID()}.zip`);
try {
  await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2)', [orgId, 'E1 isolated memory probe']);
  await pool.query(
    `INSERT INTO public.v8_feature_flags(flag_id,organization_id,module,enabled,updated_at)
     SELECT $1 || '-' || series.sequence::text,$2,
            'wide-' || series.sequence::text || '-' || repeat('x',$3),1,$4
       FROM generate_series(1,$5) AS series(sequence)`,
    [`e1-memory-${orgId}`, orgId, width, new Date().toISOString(), rows]
  );

  global.gc?.();
  const baselineRss = process.memoryUsage().rss;
  let peakRss = baselineRss;
  const sample = () => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  };
  const sampler = setInterval(sample, 2);
  sampler.unref();
  const client = await pool.connect();
  const manifest = await withOrganizationExportSnapshot(client, orgId, (snapshot) =>
    writeOrganizationExportArchiveStreaming(snapshot, orgId, output, {
      batchSize: 500,
      onProgress: sample,
    })
  );
  sample();
  clearInterval(sampler);
  const jsonReceipt = manifest.files.find(
    (file) => file.path === 'json/public.v8_feature_flags.json'
  );
  const csvReceipt = manifest.files.find(
    (file) => file.path === 'csv/public.v8_feature_flags.csv'
  );
  const metric = {
    processId: process.pid,
    mode,
    rows,
    width,
    baselineRssBytes: baselineRss,
    peakRssBytes: peakRss,
    peakDeltaBytes: peakRss - baselineRss,
    jsonBytes: jsonReceipt?.bytes || 0,
    csvBytes: csvReceipt?.bytes || 0,
    totalArtifactBytes: (jsonReceipt?.bytes || 0) + (csvReceipt?.bytes || 0),
  };
  console.log(`E1_ARCHIVE_SCALING ${JSON.stringify(metric)}`);
} finally {
  await pool.query('DELETE FROM public.v8_feature_flags WHERE organization_id=$1', [orgId]).catch(() => undefined);
  await pool.query('DELETE FROM organizations WHERE id=$1', [orgId]).catch(() => undefined);
  await pool.end();
  await fsp.rm(output, { force: true });
}
