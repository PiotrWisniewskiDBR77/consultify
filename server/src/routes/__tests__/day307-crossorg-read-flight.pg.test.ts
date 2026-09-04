/** @vitest-environment node */
import fs from 'node:fs';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const matrixPath = process.env.DAY307_MATRIX_PATH ?? '';
const fixturePath = process.env.DAY307_FIXTURE_PATH ?? '';
const resultPath = process.env.DAY307_RESULT_PATH ?? '';
const registerPath = process.env.DAY307_REGISTER_PATH ?? '';

type Fixture = { organizationId: string; userId: string; token: string };
type MatrixRow = { included: boolean; route: string; file: string; line: number; guard: string; flag: string };

function concretePath(route: string, owner: Fixture) {
  return route
    .replace(/:organizationId\??|:orgId\??|:organization_id\??/g, owner.organizationId)
    .replace(/:userId\??|:ownerId\??/g, owner.userId)
    .replace(/:([A-Za-z0-9_]+)\??/g, (_match, name) => `day307-owner-${String(name).toLowerCase()}`)
    .replace(/\*/g, 'day307-owner-resource');
}

function redacted(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 3).map(redacted);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 20)
        .map(([key, item]) => [
          key,
          /token|secret|password|authorization|credential|api.?key/i.test(key)
            ? '<redacted>'
            : redacted(item),
        ])
    );
  }
  if (typeof value === 'string' && value.length > 160) return `${value.slice(0, 160)}…`;
  return value;
}

function contentSummary(response: { headers: Record<string, string | undefined>; body: unknown }) {
  const body = redacted(response.body);
  const serialized = JSON.stringify(body);
  return {
    contentType: response.headers['content-type'] ?? null,
    bytes: Buffer.byteLength(serialized),
    nonEmpty: !['', '{}', '[]', 'null', 'undefined'].includes(serialized),
    sample: serialized.slice(0, 500),
  };
}

function md(value: unknown) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

async function safeGet(app: express.Express, target: string, token: string) {
  try {
    return await request(app)
      .get(target)
      .set('Authorization', `Bearer ${token}`)
      .timeout({ response: 750, deadline: 1500 });
  } catch (error) {
    return {
      status: 0,
      headers: { 'content-type': 'application/x-day307-timeout' },
      body: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

describe('Day 307 paired cross-org GET flight through ApiGateway', NO_RETRY, () => {
  const app = express();
  let owner: Fixture;
  let foreign: Fixture;
  let routes: MatrixRow[] = [];

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(matrixPath).toBeTruthy();
    expect(fixturePath).toBeTruthy();
    expect(resultPath).toBeTruthy();
    expect(registerPath).toBeTruthy();
    await assertRealPostgresTestEnvironment();
    ({ owner, foreign } = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
      owner: Fixture;
      foreign: Fixture;
    });
    routes = (JSON.parse(fs.readFileSync(matrixPath, 'utf8')).rows as MatrixRow[]).filter(
      (row) => row.included
    );
    const { ApiGateway } = await import('../../Gateway.js');
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 60_000);

  afterAll(async () => {
    const pgModule = await import('../../database/PostgresDatabase.js');
    await (pgModule as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('records foreign and owner response for every mechanically included route', async () => {
    const results: Array<Record<string, unknown>> = [];
    for (const row of routes) {
      const target = concretePath(row.route.split(' | ')[0], owner);
      const foreignResponse = await safeGet(app, target, foreign.token);
      const ownerResponse = await safeGet(app, target, owner.token);
      const foreignContent = contentSummary(foreignResponse);
      const ownerContent = contentSummary(ownerResponse);
      const foreignSample = foreignContent.sample;
      const ownerSample = ownerContent.sample;
      const foreignContainsOwner =
        foreignSample.includes(owner.organizationId) || foreignSample.includes(owner.userId);
      const foreignContainsForeign =
        foreignSample.includes(foreign.organizationId) || foreignSample.includes(foreign.userId);
      const ownerContainsOwner =
        ownerSample.includes(owner.organizationId) || ownerSample.includes(owner.userId);
      const explicitOwnerTarget =
        target.includes(owner.organizationId) || target.includes(owner.userId);
      const verdict =
        foreignContainsOwner
          ? 'PODEJRZENIE_WYCIEKU'
          : explicitOwnerTarget &&
              [401, 403, 404].includes(foreignResponse.status) &&
        ownerResponse.status === 200 &&
        ownerContent.nonEmpty
          ? 'OK_PARA'
          : foreignResponse.status === 200 &&
              ownerResponse.status === 200 &&
              foreignContainsForeign &&
              ownerContainsOwner
            ? 'OK_TENANT_RELATIVE'
            : 'NIEZWERYFIKOWANA';
      results.push({
        route: row.route,
        target,
        file: row.file,
        line: row.line,
        guard: row.guard,
        flag: row.flag,
        foreignStatus: foreignResponse.status,
        foreignContent,
        ownerStatus: ownerResponse.status,
        ownerContent,
        verdict,
      });
    }
    fs.writeFileSync(resultPath, `${JSON.stringify({ count: results.length, results }, null, 2)}\n`);
    const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8')) as {
      rule: string;
      denominator: number;
      included: number;
      skipped: number;
      rows: Array<MatrixRow & { reason: string }>;
    };
    const verdictCounts = new Map<string, number>();
    for (const result of results) {
      const verdict = String(result.verdict);
      verdictCounts.set(verdict, (verdictCounts.get(verdict) ?? 0) + 1);
    }
    const lines = [
      '# Rejestr cross-org — przelot 2026-09-03 (dyżur 307)',
      '',
      '## Reguła i mianownik',
      '',
      matrix.rule,
      '',
      `- Mianownik tekstowy: ${matrix.denominator}.`,
      `- Objęte parą żądań: ${matrix.included}.`,
      `- Pominięte z jawnym powodem: ${matrix.skipped}.`,
      `- Werdykty: ${[...verdictCounts].map(([key, count]) => `${key}=${count}`).join(', ')}.`,
      '- `OK_PARA` wymaga jawnego celu właściciela, odrzucenia obcego i niepustego 200 właściciela.',
      '- `OK_TENANT_RELATIVE` oznacza, że oba tokeny dostały 200, ale odpowiedź obcego zawierała wyłącznie jego marker, a odpowiedź właściciela marker właściciela.',
      '- `PODEJRZENIE_WYCIEKU` oznacza, że odpowiedź tokenu obcego zawierała marker właściciela.',
      '- Każdy inny kształt jest `NIEZWERYFIKOWANA`; puste 200/200 nie jest sukcesem.',
      '',
      '## Trasy objęte',
      '',
      '| Trasa | Źródło | Strażnik | Flaga | Obcy kod | Obcy treść | Właściciel kod | Właściciel treść | Werdykt |',
      '|---|---|---|---|---:|---|---:|---|---|',
      ...results.map((result) =>
        `| ${md(result.route)} | ${md(result.file)}:${md(result.line)} | ${md(result.guard)} | ${md(result.flag)} | ${md(result.foreignStatus)} | ${md((result.foreignContent as { sample: string }).sample)} | ${md(result.ownerStatus)} | ${md((result.ownerContent as { sample: string }).sample)} | ${md(result.verdict)} |`
      ),
      '',
      '## Pominięte i dlaczego',
      '',
      '| Trasa | Źródło | Powód | Flaga |',
      '|---|---|---|---|',
      ...matrix.rows
        .filter((row) => !row.included)
        .map((row) => `| ${md(row.route)} | ${md(row.file)}:${row.line} | ${md(row.reason)} | ${md(row.flag)} |`),
      '',
      '## Zależne od flagi',
      '',
      ...matrix.rows
        .filter((row) => row.flag !== 'brak_wykrytej_flagi' && row.flag !== 'NIE_DOTYCZY')
        .map((row) => `- \`${md(row.route)}\` — ${md(row.flag)}.`),
      '',
      '## Pytania do żywego środowiska',
      '',
      '- Jaki jest faktyczny stan `ENABLE_V8_GLOBAL` i wierszy `v8_feature_flags` na demo/stagingu? Nie sprawdzano: Z28/Z40.',
      '- Czy organizacje bez wierszy flag istnieją na żywo? Nie sprawdzano: Z28/Z40.',
      '',
    ];
    fs.writeFileSync(registerPath, `${lines.join('\n')}\n`);
    expect(results).toHaveLength(routes.length);
  }, 15 * 60_000);
});
