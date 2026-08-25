import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findUnannotatedRangeRows } from '../verify-acceptance-packages.mjs';

const wrap = (registerBody) =>
  [
    '# Fixture module — denominator guard unit test',
    '',
    '## Contract',
    '',
    'Fixture contract text.',
    '',
    '## Owner UI/UX/CX register',
    '',
    '| Finding ID | Piotr wording |',
    '| ---------- | -------------- |',
    registerBody,
    '',
    '## Implementation/regression ledger',
    '',
    'Fixture ledger text.',
    '',
  ].join('\n');

test('a spelled-out Finding ID row is never flagged', () => {
  const text = wrap('| `MYW-IDEAS-003` | A single, individually rendered finding. |');
  assert.deepEqual(findUnannotatedRangeRows(text), []);
});

test('a condensed range row without an annotation is flagged with the correct atom count', () => {
  const text = wrap('| `MYW-IDEAS-003..015` | Thirteen findings collapsed into one row. |');
  const offenders = findUnannotatedRangeRows(text);
  assert.deepEqual(offenders, [{ id: 'MYW-IDEAS-003..015', from: 3, to: 15, count: 13 }]);
});

test('a two-item range row computes count as to - from + 1, not the raw digit span', () => {
  const text = wrap('| `MYW-NBK-003..006` | Four findings collapsed into one row. |');
  const offenders = findUnannotatedRangeRows(text);
  assert.equal(offenders[0].count, 4);
});

test('a condensed range row carrying the explicit RANGE_ROW_ACKNOWLEDGED token is permitted', () => {
  const text = wrap(
    '| `MYW-IDEAS-003..015` | Thirteen findings, deliberately kept as one row. `RANGE_ROW_ACKNOWLEDGED`: see detail packet. |'
  );
  assert.deepEqual(findUnannotatedRangeRows(text), []);
});

test('a range row outside the Owner UI/UX/CX register section is ignored', () => {
  const text = [
    '# Fixture module — denominator guard unit test',
    '',
    '## Contract',
    '',
    '## Owner UI/UX/CX register',
    '',
    '| Finding ID | Piotr wording |',
    '| ---------- | -------------- |',
    '| `MYW-IDEAS-003` | A single, individually rendered finding. |',
    '',
    '## Implementation/regression ledger',
    '',
    '| Finding IDs | Root cause |',
    '| ----------- | ---------- |',
    '| `MYW-IDEAS-003..015` | Ledger rows summarize, they are not the owner register denominator. |',
    '',
    '## Owner verdict',
    '',
  ].join('\n');
  assert.deepEqual(findUnannotatedRangeRows(text), []);
});

test('multiple offending rows in one module are all reported', () => {
  const text = wrap(
    [
      '| `MYW-IDEAS-003..015` | Thirteen findings collapsed into one row. |',
      '| `MYW-NBK-003..006` | Four findings collapsed into one row. |',
    ].join('\n')
  );
  const offenders = findUnannotatedRangeRows(text);
  assert.equal(offenders.length, 2);
  assert.deepEqual(
    offenders.map((offender) => offender.id),
    ['MYW-IDEAS-003..015', 'MYW-NBK-003..006']
  );
});

test('the real 07_MY_WORK_AGENT register carries zero unannotated range rows after Wave 0 remediation', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const path = resolve(
    import.meta.dirname,
    '../../../docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md'
  );
  const text = readFileSync(path, 'utf8');
  assert.deepEqual(
    findUnannotatedRangeRows(text),
    [],
    'MODULE_ACCEPTANCE.md must spell out every owner-register atom as its own row (Wave 0 denominator fix)'
  );
});
