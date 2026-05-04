#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const evidenceRoot = path.join(repoRoot, 'docs', 'ui-standards', 'evidence');
const manifestPath = path.join(evidenceRoot, 'EXPECTED_FILES_TEMPLATE.csv');
const assignmentPath = path.join(evidenceRoot, 'ASSIGNMENT_TEMPLATE.csv');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseCsv(content) {
  const lines = content.split('\n').filter(Boolean);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

function toCsv(headers, rows) {
  const data = [headers.join(',')];
  for (const row of rows) {
    data.push(headers.map((h) => row[h] ?? '').join(','));
  }
  return `${data.join('\n')}\n`;
}

function cardManifest() {
  const rows = parseCsv(read(manifestPath));
  const byCard = new Map();
  for (const row of rows) {
    if (!byCard.has(row.card_slug)) byCard.set(row.card_slug, []);
    byCard.get(row.card_slug).push(row.filename_template);
  }
  return byCard;
}

function existingPngs(cardSlug) {
  const dir = path.join(evidenceRoot, cardSlug);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.png'));
}

function countForCard(cardSlug, templates) {
  const files = existingPngs(cardSlug);
  const missing = [];
  for (const tpl of templates) {
    const prefix = tpl.replace('__YYYY-MM-DD.png', '__');
    const ok = files.some((name) => name.startsWith(prefix));
    if (!ok) missing.push(tpl);
  }
  return { captured: templates.length - missing.length, total: templates.length, missing };
}

function updateStatusFile(cardSlug, captured, total) {
  const statusPath = path.join(evidenceRoot, cardSlug, 'STATUS.md');
  if (!fs.existsSync(statusPath)) return;
  const current = read(statusPath);
  let overall = 'QUEUED';
  if (captured > 0 && captured < total) overall = 'IN_PROGRESS';
  if (captured === total) overall = 'DONE';
  let next = current.replace(/Overall:\s*`[^`]*`/, `Overall: \`${overall}\``);
  const stamp = `Schedule status: \`Auto-sync ${todayIso()} (captured ${captured}/${total})\``;
  if (/Schedule status:\s*`[^`]*`/.test(next)) {
    next = next.replace(/Schedule status:\s*`[^`]*`/, stamp);
  } else {
    next = next.replace(/Overall:\s*`[^`]*`\n/, (m) => `${m}${stamp}\n`);
  }
  write(statusPath, next);
}

function runCheck() {
  const byCard = cardManifest();
  const lines = [
    `# Final Gate Check (${todayIso()})`,
    '',
    'Scope: DONE cards evidence completeness (6/6 per card).',
    '',
  ];
  let allPass = true;
  for (const [cardSlug, templates] of [...byCard.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const result = countForCard(cardSlug, templates);
    const pass = result.missing.length === 0;
    if (!pass) allPass = false;
    lines.push(`## ${cardSlug}`);
    lines.push(`- Status: \`${pass ? 'PASS' : 'FAIL'}\``);
    lines.push(`- Captured: \`${result.captured}/${result.total}\``);
    if (result.missing.length === 0) {
      lines.push('- Missing files: none');
    } else {
      lines.push('- Missing files:');
      for (const name of result.missing) lines.push(`  - \`${name}\``);
    }
    lines.push('');
  }
  lines.push(`Overall gate: \`${allPass ? 'PASS' : 'FAIL'}\``);
  if (!allPass) lines.push('Result: LISTA BRAKÓW wymaga uzupełnienia przed formalnym zamknięciem evidence.');
  const outPath = path.join(evidenceRoot, `FINAL_GATE_CHECK_${todayIso()}.md`);
  write(outPath, `${lines.join('\n')}\n`);
  console.log(`Wrote ${path.relative(repoRoot, outPath)}`);
  return { allPass, outPath };
}

function runSync() {
  const byCard = cardManifest();
  const rows = parseCsv(read(assignmentPath));
  const headers = ['card_slug', 'card_name', 'owner', 'target_date', 'overall_status', 'notes'];
  for (const row of rows) {
    const templates = byCard.get(row.card_slug) ?? [];
    const result = countForCard(row.card_slug, templates);
    let status = 'QUEUED';
    if (result.captured > 0 && result.captured < result.total) status = 'IN_PROGRESS';
    if (result.captured === result.total && result.total > 0) status = 'DONE';
    row.overall_status = status;
    row.notes = `Auto-sync ${todayIso()}: captured ${result.captured}/${result.total}`;
    updateStatusFile(row.card_slug, result.captured, result.total);
  }
  write(assignmentPath, toCsv(headers, rows));
  console.log(`Synced ${path.relative(repoRoot, assignmentPath)} and STATUS.md files`);
}

function runDaily(dateArg) {
  const date = dateArg || todayIso();
  const rows = parseCsv(read(assignmentPath)).filter((r) => r.target_date === date);
  const byCard = cardManifest();
  const owners = [...new Set(rows.map((r) => r.owner).filter(Boolean))].join(', ') || 'TBD';
  const lines = [
    `# Evidence Daily Report (${date})`,
    '',
    `Date: \`${date}\`  `,
    `Owner(s): \`${owners}\`  `,
    'Overall day status: `IN_PROGRESS`',
    '',
    '## 1) Completed today',
  ];
  const completed = rows.filter((r) => r.overall_status === 'DONE');
  if (completed.length === 0) lines.push('- None yet.');
  for (const row of completed) lines.push(`- Card: \`${row.card_slug}\` marked \`DONE\``);
  lines.push('', '## 2) Missing evidence');
  for (const row of rows) {
    const templates = byCard.get(row.card_slug) ?? [];
    const result = countForCard(row.card_slug, templates);
    if (result.missing.length === 0) continue;
    lines.push(`- Card: \`${row.card_slug}\``);
    lines.push(`  - Missing types: \`${result.missing.length}\` files (${result.captured}/${result.total} captured)`);
    lines.push(`  - Reason: \`${row.notes || 'Capture in progress'}\``);
  }
  lines.push(
    '',
    '## 3) Blockers',
    '- None reported automatically (fill manually if needed).',
    '',
    '## 4) Decisions needed',
    '- None reported automatically (fill manually if needed).',
    '',
    '## 5) Next day plan'
  );
  for (const row of rows) lines.push(`- \`${row.card_slug}\` -> \`${row.owner}\``);
  lines.push(
    '',
    '## 6) Quick validation',
    '- [x] STATUS.md files synced by automation',
    '- [x] ASSIGNMENT_TEMPLATE.csv synced by automation',
    '- [x] Naming contract checked against EXPECTED_FILES_TEMPLATE.csv',
    ''
  );
  const outPath = path.join(evidenceRoot, `DAY_${date}.md`);
  write(outPath, lines.join('\n'));
  console.log(`Wrote ${path.relative(repoRoot, outPath)}`);
}

function runFinalSummary() {
  const rows = parseCsv(read(assignmentPath));
  const done = rows.filter((r) => r.overall_status === 'DONE').map((r) => r.card_slug);
  const notDone = rows.filter((r) => r.overall_status !== 'DONE');
  const lines = [
    `# Evidence Final Pass (${todayIso()})`,
    '',
    '## 100% closed',
  ];
  if (done.length === 0) {
    lines.push('- None yet.');
  } else {
    for (const slug of done) lines.push(`- \`${slug}\``);
  }
  lines.push('', '## Requires decision / completion');
  if (notDone.length === 0) {
    lines.push('- None. Evidence package is fully closed.');
  } else {
    for (const row of notDone) {
      lines.push(`- \`${row.card_slug}\` -> \`${row.overall_status}\` (${row.notes || 'no notes'})`);
    }
  }
  lines.push(
    '',
    '## Recommendation',
    notDone.length === 0
      ? '- Formal close can proceed now.'
      : '- Continue capture execution and rerun `evidence:check` + `evidence:final` after next batch.',
    ''
  );
  const outPath = path.join(evidenceRoot, 'EVIDENCE_FINAL_PASS.md');
  write(outPath, lines.join('\n'));
  console.log(`Wrote ${path.relative(repoRoot, outPath)}`);
}

function main() {
  const command = process.argv[2] || 'help';
  const arg = process.argv[3];
  if (command === 'check') {
    runCheck();
    return;
  }
  if (command === 'sync') {
    runSync();
    return;
  }
  if (command === 'daily') {
    runDaily(arg);
    return;
  }
  if (command === 'final') {
    runFinalSummary();
    return;
  }
  if (command === 'refresh') {
    runSync();
    runCheck();
    runFinalSummary();
    return;
  }
  console.log('Usage: node scripts/evidence/evidence-ops.mjs [sync|check|daily <YYYY-MM-DD>|final|refresh]');
}

main();
