#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const databaseUrl = process.env.DATABASE_URL || '';
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const root = process.cwd();
const worker = path.join(root, 'scripts/enterprise/e1-archive-memory-worker.ts');

const run = (mode, rows, width = 4096) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--expose-gc', '--import', 'tsx', worker],
      {
        cwd: root,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          E1_ARCHIVE_MODE: mode,
          E1_ARCHIVE_ROWS: String(rows),
          E1_ARCHIVE_WIDTH: String(width),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`worker ${mode}/${rows} failed (${code})\n${stderr}\n${stdout}`));
      const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith('E1_ARCHIVE_SCALING '));
      if (!line) return reject(new Error(`worker metric missing\n${stderr}\n${stdout}`));
      resolve(JSON.parse(line.slice('E1_ARCHIVE_SCALING '.length)));
    });
  });

const repetitions = Number(process.env.E1_ARCHIVE_MEMORY_REPETITIONS || 3);
if (!Number.isInteger(repetitions) || repetitions < 3) {
  throw new Error('E1 archive memory gate requires at least 3 repetitions');
}
const samples = [];
for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  const production = [];
  for (const rows of [2_000, 8_000, 20_001]) production.push(await run('production', rows));
  const mutant = await run('whole-file-mutant', 20_001);
  samples.push({ repetition, production, mutant });
}

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};
const medianMetric = (metrics) => ({
  mode: metrics[0].mode,
  rows: metrics[0].rows,
  width: metrics[0].width,
  baselineRssBytes: median(metrics.map((metric) => metric.baselineRssBytes)),
  peakRssBytes: median(metrics.map((metric) => metric.peakRssBytes)),
  peakDeltaBytes: median(metrics.map((metric) => metric.peakDeltaBytes)),
  jsonBytes: median(metrics.map((metric) => metric.jsonBytes)),
  csvBytes: median(metrics.map((metric) => metric.csvBytes)),
  totalArtifactBytes: median(metrics.map((metric) => metric.totalArtifactBytes)),
});
const production = [0, 1, 2].map((index) =>
  medianMetric(samples.map((sample) => sample.production[index]))
);
const mutant = medianMetric(samples.map((sample) => sample.mutant));

const mib = 1024 * 1024;
const [small, medium, large] = production;
// Fresh-process warmup and the 3,048-entry ZIP directory impose a fixed cost.
// After that controlled warmup, the envelope permits 0.90 byte of retained RSS
// per additional uncompressed artifact byte plus 16 MiB of measured cold-process
// jitter. A separate assertion keeps the observed marginal slope below 0.95.
// Whole-file buffering is superlinear here and must fail the identical envelope.
const allowedSlope = 0.9;
const coldProcessJitterBytes = 16 * 1024 * 1024;
const envelopeBytes = Math.max(small.peakDeltaBytes, medium.peakDeltaBytes) +
  allowedSlope * (large.totalArtifactBytes - medium.totalArtifactBytes) +
  coldProcessJitterBytes;
const passesEnvelope = (metric) => metric.peakDeltaBytes <= envelopeBytes;
const productionPass = passesEnvelope(large);
const mutantPass = passesEnvelope(mutant);
const productionMarginalSlope =
  (large.peakDeltaBytes - medium.peakDeltaBytes) /
  (large.totalArtifactBytes - medium.totalArtifactBytes);
const report = {
  format: 'e1-isolated-archive-memory-gate-v1',
  processModel: `${repetitions} repetitions; fresh child per point; node --expose-gc; 2ms RSS sampler; median gate`,
  childProcessCount: repetitions * 4,
  allowedSlopeBytesPerArtifactByte: allowedSlope,
  coldProcessJitterBytes,
  envelopeBytes: Math.floor(envelopeBytes),
  envelopeMiB: Number((envelopeBytes / mib).toFixed(2)),
  productionMarginalSlopeBytesPerArtifactByte: Number(productionMarginalSlope.toFixed(4)),
  production,
  mutant,
  samples,
  assertions: {
    productionLargePasses: productionPass,
    productionSlopeIsStrictlySublinear: productionMarginalSlope < 0.95,
    deliberateWholeFileMutantPasses: mutantPass,
    deliberateWholeFileMutantIsRed: !mutantPass,
  },
};
const output = process.env.E1_ARCHIVE_MEMORY_REPORT;
if (output) await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!productionPass || productionMarginalSlope >= 0.95 || mutantPass) process.exitCode = 1;
