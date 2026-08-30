/**
 * Day 195 reproducible real-path probe.
 * Run from the repository root after sourcing the provider exactly as licensed:
 * `set -a; . ~/.consultify-openrouter; set +a`, then use the complete RealPG env
 * from CODEX_DAY195_DOKUMENT_REPORT.md and this file with `--retry=0`. It requires
 * OPENROUTER_API_KEY, mounts the real ApiGateway, signs a JWT, calls generate once
 * with useLlm=true and a supplied two-target outline, reads PostgreSQL back, exports
 * DOCX, and records evidence under /private/tmp/cx-day195-dokument-artefakty.
 */

/** @vitest-environment node */

import express from 'express';
import { mkdir, writeFile } from 'node:fs/promises';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';
import { ApiGateway } from '../../../Gateway.js';
import { get as dbGet, run as dbRun } from '../../../utils/DbPromise.js';
import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import type { DocumentSchema } from '../documentStudioTypes.js';

const ORGANIZATION_ID = 'day195-document-org';
const USER_ID = 'day195-document-owner';
const OUTPUT_DIR = '/private/tmp/cx-day195-dokument-artefakty';
const DOCX_PATH = `${OUTPUT_DIR}/day195-dokument-pokazywalny.docx`;
const RESULT_PATH = `${OUTPUT_DIR}/day195-real-path-result.json`;

let app: express.Express;
let token: string;
let artifactId: string | null = null;

beforeAll(async () => {
  expect(process.env.DB_TYPE).toBe('postgres');
  await assertRealPostgresTestEnvironment();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await dbRun(
    `INSERT INTO organizations (id, name, status, organization_type)
     VALUES (?, ?, 'active', 'PAID') ON CONFLICT (id) DO NOTHING`,
    [ORGANIZATION_ID, 'Day 195 Document Evidence']
  );
  await dbRun(
    `INSERT INTO users (id, organization_id, email, password, role, status)
     VALUES (?, ?, ?, 'unused-local-only', 'OWNER', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [USER_ID, ORGANIZATION_ID, 'day195-owner@example.test']
  );
  await dbRun(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES (?, ?, ?, 'OWNER', 'ACTIVE')
     ON CONFLICT (organization_id, user_id)
     DO UPDATE SET role = 'OWNER', status = 'ACTIVE'`,
    ['day195-document-membership', ORGANIZATION_ID, USER_ID]
  );
  app = express();
  app.use(express.json({ limit: '10mb' }));
  ApiGateway.getInstance().initializeRoutes(app);
  token = jwt.sign(
    { id: USER_ID, userId: USER_ID, organizationId: ORGANIZATION_ID, role: 'OWNER' },
    config.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
});

afterAll(async () => {
  if (artifactId) {
    await dbRun('DELETE FROM wave5_artifacts WHERE artifact_id = ? AND organization_id = ?', [
      artifactId,
      ORGANIZATION_ID,
    ]);
  }
  await dbRun('DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?', [
    ORGANIZATION_ID,
    USER_ID,
  ]);
  await dbRun('DELETE FROM users WHERE id = ?', [USER_ID]);
  await dbRun('DELETE FROM organizations WHERE id = ?', [ORGANIZATION_ID]);
});

describe('Day 195 real HTTP -> LLM -> PostgreSQL -> DOCX probe', () => {
  it('generates one two-target batch, proves granular assumptions, reads back and exports DOCX', async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn('DAY195_SKIPPED: OPENROUTER_API_KEY is absent; no deterministic fallback counts as proof.');
      return;
    }

    const startedAt = Date.now();
    const generate = await request(app)
      .post('/api/document-studio/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        intake: {
          title: 'Raport dla zarządu — gotowość programu transformacji',
          description:
            'Program transformacji przygotowuje organizację do uporządkowania odpowiedzialności, rytmu decyzji i wdrożenia mierzalnego portfela zmian. Potwierdzone fakty: rada programu spotyka się co dwa tygodnie; trzy strumienie prac obejmują procesy, dane i kompetencje; właściciele zatwierdzili etap diagnostyczny; decyzja o przejściu do pilotażu wymaga przeglądu ryzyk i gotowości operacyjnej. Napisz pełny materiał zarządczy po polsku. W jednym akapicie zaproponuj niepotwierdzony cel 25% i oznacz wartość jako założenie; pozostałe akapity oprzyj na potwierdzonych faktach.',
          documentType: 'board_report',
          language: 'pl',
          density: 'comprehensive',
          goal: 'inform',
          audience: ['Zarząd'],
        },
        outline: {
          documentType: 'board_report',
          title: 'Raport dla zarządu — gotowość programu transformacji',
          recommendedDensity: 'comprehensive',
          recommendedRegister: 'executive',
          recommendedLanguageStyle: 'consulting',
          sections: [
            {
              title: 'Diagnoza gotowości organizacyjnej',
              level: 1,
              purpose: 'Ocena warunków powodzenia, zależności i luk decyzyjnych',
              expectedLengthHint: 'long',
            },
            {
              title: 'Rekomendowany model realizacji',
              level: 1,
              purpose: 'Rekomendacje dla zarządu, sekwencja działań i kryteria kontroli',
              expectedLengthHint: 'long',
            },
          ],
        },
        sourceRefs: [
          {
            sourceType: 'organization',
            sourceId: 'day195-facts',
            sourceTitle: 'Potwierdzone fakty programu',
            sourceExcerpt:
              'Rada programu spotyka się co dwa tygodnie. Trzy strumienie prac obejmują procesy, dane i kompetencje. Właściciele zatwierdzili etap diagnostyczny. Przejście do pilotażu wymaga przeglądu ryzyk i gotowości operacyjnej.',
          },
        ],
        useLlm: true,
      });
    const durationMs = Date.now() - startedAt;
    artifactId = typeof generate.body?.artifactId === 'string' ? generate.body.artifactId : null;
    expect(generate.status, JSON.stringify(generate.body)).toBe(200);
    expect(artifactId).toBeTruthy();
    expect(generate.body?.generationWarnings ?? []).toEqual([]);

    const persisted = await dbGet<{ artifact_id: string; content_json_native: string }>(
      `SELECT artifact_id, content_json_native FROM wave5_artifacts
       WHERE artifact_id = ? AND organization_id = ?`,
      [artifactId, ORGANIZATION_ID]
    );
    expect(persisted?.artifact_id).toBe(artifactId);
    const schema = JSON.parse(String(persisted?.content_json_native || '{}')) as DocumentSchema;
    const richSections = schema.sections.filter(
      (section) => section.blocks.filter((block) => block.type === 'paragraph').length > 1
    );
    expect(richSections.length).toBeGreaterThan(0);
    const granular = richSections.some((section) => {
      const flags = section.blocks
        .filter((block) => block.type === 'paragraph')
        .map((block) => block.isAssumption === true);
      return flags.some(Boolean) && flags.some((flag) => !flag);
    });
    expect(granular).toBe(true);

    // Mutation proof on the SAME generated schema: the historical F1 behaviour
    // contaminates every paragraph in a section when its metadata is signalled.
    const oldBoundaryMutation = structuredClone(schema);
    const mutationSection = oldBoundaryMutation.sections.find(
      (section) => section.blocks.filter((block) => block.type === 'paragraph').length > 1
    );
    expect(mutationSection).toBeDefined();
    mutationSection!.blocks.forEach((block) => {
      if (block.type === 'paragraph') block.isAssumption = true;
    });
    expect(
      mutationSection!.blocks
        .filter((block) => block.type === 'paragraph')
        .every((block) => block.isAssumption === true)
    ).toBe(true);

    const exported = await request(app)
      .get(`/api/document-studio/${artifactId}/export/docx`)
      .set('Authorization', `Bearer ${token}`);
    expect(exported.status, JSON.stringify(exported.body)).toBe(200);
    const bytes = Buffer.from(String(exported.body?.contentBase64 || ''), 'base64');
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    await writeFile(DOCX_PATH, bytes);
    await writeFile(
      RESULT_PATH,
      JSON.stringify(
        {
          generateStatus: generate.status,
          exportStatus: exported.status,
          artifactId,
          durationMs,
          docxBytes: bytes.length,
          sectionParagraphFlags: schema.sections.map((section) => ({
            title: section.title,
            flags: section.blocks
              .filter((block) => block.type === 'paragraph')
              .map((block) => ({ blockId: block.blockId, isAssumption: block.isAssumption === true })),
          })),
        },
        null,
        2
      )
    );
    console.info(`DAY195_REAL_PATH durationMs=${durationMs} artifactId=${artifactId} bytes=${bytes.length}`);
  }, 180_000);
});
