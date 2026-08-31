/**
 * Day 195 — real-path DOCX probe. A SCRIPT (tsx), deliberately not a vitest spec.
 *
 * WHY A SCRIPT. `tests/setup.ts` replaces `global.fetch` with a stub for every
 * vitest run, so NO vitest test can reach a provider — the day-195 acceptance
 * recorded the committed `day195.real-llm-docx-probe.pg.test.ts` as
 * "constructively dead" for exactly this reason, and Z18 forbids touching the
 * setup file. Day 190 proved the real path with a tsx script; this is the same
 * shape, committed so the run is reproducible.
 *
 * WHAT IT PROVES, end to end, on one LLM call:
 *   HTTP (real ApiGateway + signed JWT) → documentStudioService → prose layer
 *   → OpenRouter → final grounding boundary → PostgreSQL → DOCX export.
 * Plus a REAL boundary mutation: the persisted schema is pushed a second time
 * through a copy of the grounding boundary carrying the OLD homograph regex.
 * No second LLM call is involved (DEC-2026-08-29-317: the provider is paid for
 * by the owner, so this script makes at most ONE generate call and refuses to
 * start if the outline would need more than one batch).
 *
 * RUN (from the repository root):
 *   set -a; . ~/.consultify-openrouter; set +a
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:<port>/<db> \
 *   ENABLE_TEST_AUTH_BYPASS=false \
 *   npx tsx server/scripts/day195-real-llm-docx-probe.ts
 *
 * The key is read ONLY through `set -a; . ~/.consultify-openrouter; set +a`.
 * Its value is never printed, logged or written anywhere — the script reports
 * `TAK`/`NIE` only. Without the key it exits 2 with `DAY195_SKIPPED`: a silent
 * success would be a deterministic fallback masquerading as proof.
 */

import { mkdir, writeFile, copyFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';

import express from 'express';
import JSZip from 'jszip';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import config from '../src/config/Config.js';
import { ApiGateway } from '../src/Gateway.js';
import { get as dbGet, run as dbRun } from '../src/utils/DbPromise.js';
import { llmConfigService } from '../src/services/ai/llmConfigService.js';
import { enforceDocumentSchemaGrounding } from '../src/services/documentStudio/documentContentGenerator.js';
import type { DocumentSchema } from '../src/services/documentStudio/documentStudioTypes.js';
import { assertRealPostgresTestEnvironment } from '../../tests/integration/_helpers/assertRealPostgres.js';

const ORGANIZATION_ID = 'day195-document-org';
const USER_ID = 'day195-document-owner';
const MEMBERSHIP_ID = 'day195-document-membership';
const OUTPUT_DIR = process.env.DAY195_OUTPUT_DIR || '/private/tmp/cx-fix195-artefakty';

const BOUNDARY_SRC = path.resolve(
  process.cwd(),
  'server/src/services/documentStudio/documentContentGenerator.ts'
);
const BOUNDARY_LEGACY = path.resolve(
  process.cwd(),
  'server/src/services/documentStudio/documentContentGenerator.__day195_legacy_probe__.ts'
);

/** The four Polish homographs FIX-195/5 removed from `obviousEnglish`. */
const LEGACY_TOKEN_PATCHES: Array<[string, string]> = [
  ['|information|financial|', '|information|portfolio|financial|'],
  ['|mitigation|realization|', '|mitigation|total|plan|realization|'],
  ['|completed|high|low|scope|', '|completed|high|medium|low|scope|'],
];

const INTAKE = {
  title: 'Raport dla zarządu — gotowość programu transformacji',
  description:
    'Program transformacji przygotowuje organizację do uporządkowania odpowiedzialności, rytmu decyzji i wdrożenia mierzalnego portfela zmian. Potwierdzone fakty: rada programu spotyka się co dwa tygodnie; trzy strumienie prac obejmują procesy, dane i kompetencje; właściciele zatwierdzili etap diagnostyczny; decyzja o przejściu do pilotażu wymaga przeglądu ryzyk i gotowości operacyjnej. Napisz pełny materiał zarządczy po polsku, z planem wdrożenia. W streszczeniu zarządczym postaw jasną rekomendację (użyj słowa „rekomendujemy”). W sekcji rekomendacji podaj co najmniej dwa konkretne działania, każde z właścicielem (sponsor, PMO, CFO) i terminem (Q1 2026, 30 dni). W jednym akapicie zaproponuj niepotwierdzony cel 25% i oznacz wartość jako założenie; pozostałe akapity oprzyj na potwierdzonych faktach.',
  documentType: 'board_report',
  language: 'pl',
  density: 'comprehensive',
  goal: 'inform',
  audience: ['Zarząd'],
};

const OUTLINE = {
  documentType: 'board_report',
  title: INTAKE.title,
  recommendedDensity: 'comprehensive',
  recommendedRegister: 'executive',
  recommendedLanguageStyle: 'consulting',
  sections: [
    // The two titles are chosen so the completeness gate for `board_report`
    // is satisfied by a TWO-section outline: it requires an Executive Summary
    // and a Recommendations/Decisions section, and two prose targets is
    // exactly one model batch (DEC-317).
    {
      title: 'Streszczenie zarządcze',
      level: 1,
      purpose: 'Diagnoza gotowości organizacyjnej, zależności i luki decyzyjne',
      expectedLengthHint: 'long',
    },
    {
      title: 'Rekomendacje i kolejne kroki',
      level: 1,
      purpose: 'Rekomendowany model realizacji, sekwencja działań i kryteria kontroli',
      expectedLengthHint: 'long',
    },
  ],
};

const SOURCE_REFS = [
  {
    sourceType: 'organization',
    sourceId: 'day195-facts',
    sourceTitle: 'Potwierdzone fakty programu',
    sourceExcerpt:
      'Rada programu spotyka się co dwa tygodnie. Trzy strumienie prac obejmują procesy, dane i kompetencje. Właściciele zatwierdzili etap diagnostyczny. Przejście do pilotażu wymaga przeglądu ryzyk i gotowości operacyjnej.',
  },
];

/** Prose block types the generator sends to the model, one batch per two. */
const PROSE_BLOCK_TYPES = new Set(['paragraph', 'callout', 'bullet_list', 'numbered_list']);
const PROSE_BATCH_SIZE = 2;

function log(line: string): void {
  console.info(line);
}

function countProseTargets(schema: DocumentSchema): number {
  let n = 0;
  for (const section of schema.sections ?? []) {
    for (const block of section.blocks ?? []) {
      if (PROSE_BLOCK_TYPES.has(String(block.type))) n += 1;
    }
  }
  return n;
}

function countDocxWords(documentXml: string): number {
  const text = documentXml
    .replace(/<w:tab[^>]*\/>/g, ' ')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  return (text.match(/[0-9A-Za-zÀ-ÿĄĆĘŁŃÓŚŹŻąćęłńóśźż]+(?:-[0-9A-Za-zÀ-ÿĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)*/g) ?? [])
    .length;
}

async function seed(): Promise<void> {
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
    [MEMBERSHIP_ID, ORGANIZATION_ID, USER_ID]
  );
}

async function cleanup(artifactIds: string[]): Promise<void> {
  for (const artifactId of artifactIds) {
    await dbRun('DELETE FROM wave5_artifacts WHERE artifact_id = ? AND organization_id = ?', [
      artifactId,
      ORGANIZATION_ID,
    ]).catch(() => undefined);
  }
  await dbRun('DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?', [
    ORGANIZATION_ID,
    USER_ID,
  ]).catch(() => undefined);
  await dbRun('DELETE FROM users WHERE id = ?', [USER_ID]).catch(() => undefined);
  await dbRun('DELETE FROM organizations WHERE id = ?', [ORGANIZATION_ID]).catch(() => undefined);
  await rm(BOUNDARY_LEGACY, { force: true });
}

/**
 * REAL mutation on the SAME schema: build a copy of the grounding boundary
 * that still carries the four Polish homographs, import it, and run it against
 * the persisted schema. No reimplementation, no second model call — the file
 * is the shipped one with three textual reversals.
 */
async function runBoundaryMutation(schema: DocumentSchema): Promise<{
  legacyFlagged: number;
  fixedFlagged: number;
  legacyRemoved: number;
  fixedRemoved: number;
  homographHits: Record<string, number>;
}> {
  await copyFile(BOUNDARY_SRC, BOUNDARY_LEGACY);
  let source = await readFile(BOUNDARY_LEGACY, 'utf8');
  for (const [current, legacy] of LEGACY_TOKEN_PATCHES) {
    if (!source.includes(current)) {
      throw new Error(`Boundary mutation anchor not found: ${current}`);
    }
    source = source.replace(current, legacy);
  }
  await writeFile(BOUNDARY_LEGACY, source);
  const legacyModule = (await import(BOUNDARY_LEGACY)) as {
    enforceDocumentSchemaGrounding: typeof enforceDocumentSchemaGrounding;
  };

  const groundingSource = [INTAKE.title, INTAKE.description, SOURCE_REFS[0].sourceExcerpt].join(
    ' — '
  );
  const flagged = (result: DocumentSchema): number =>
    result.sections.reduce(
      (acc, section) =>
        acc + section.blocks.filter((block) => block.isAssumption === true).length,
      0
    );
  const removedCount = (result: DocumentSchema): number =>
    (JSON.stringify(result).match(/Treść usunięta/g) ?? []).length;

  const legacyResult = legacyModule.enforceDocumentSchemaGrounding(
    structuredClone(schema),
    groundingSource
  );
  const fixedResult = enforceDocumentSchemaGrounding(structuredClone(schema), groundingSource);
  await rm(BOUNDARY_LEGACY, { force: true });

  // How many of the four homographs the generated text actually contains —
  // without this the reader cannot tell a mutation that PROVED nothing changed
  // from a mutation that had nothing to bite on.
  const serialized = JSON.stringify(schema);
  const homographHits: Record<string, number> = {};
  for (const token of ['portfolio', 'total', 'plan', 'medium']) {
    homographHits[token] = (serialized.match(new RegExp(`\\b${token}\\b`, 'gi')) ?? []).length;
  }

  return {
    legacyFlagged: flagged(legacyResult),
    fixedFlagged: flagged(fixedResult),
    legacyRemoved: removedCount(legacyResult),
    fixedRemoved: removedCount(fixedResult),
    homographHits,
  };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Run with NODE_ENV=test — the local-Postgres guard requires it.');
  }
  if (process.env.DB_TYPE !== 'postgres') {
    throw new Error(`DB_TYPE=${process.env.DB_TYPE ?? '<absent>'} — expected postgres.`);
  }
  // Z31: no expectedDatabase, no host/port/name assertion. Any local Postgres.
  const proof = await assertRealPostgresTestEnvironment();
  log(`DAY195_DB database=${proof.database} schema=${proof.schema} version=${proof.serverVersion}`);

  // Provider resolution goes through the production sync, never a manual
  // INSERT: the platform resolves the provider from the database first and
  // falls back to the environment.
  await llmConfigService.initialize();
  const providerRow = await dbGet<{ provider: string; has_key: string }>(
    `SELECT provider, CASE WHEN COALESCE(api_key, '') <> '' THEN 'TAK' ELSE 'NIE' END AS has_key
     FROM llm_providers WHERE provider = 'openrouter' LIMIT 1`
  ).catch(() => null);
  const envKeyPresent = Boolean(process.env.OPENROUTER_API_KEY);
  log(
    `DAY195_PROVIDER database=${providerRow?.provider ?? 'brak wiersza'} key=${
      providerRow?.has_key ?? 'NIE'
    } env=${envKeyPresent ? 'TAK' : 'NIE'}`
  );

  // DAY195_DRY_RUN=1 exercises the whole harness — DB, gateway, JWT, generate,
  // readback, boundary mutation, export, word count — WITHOUT calling the
  // model, so the single paid run (DEC-317) is not spent debugging plumbing.
  // It is not evidence of the real path and says so in its own output.
  const dryRunOnly = process.env.DAY195_DRY_RUN === '1';
  if (dryRunOnly) log('DAY195_DRY_RUN=1 — harness rehearsal only, NOT evidence of the real path.');

  if (!dryRunOnly && !envKeyPresent && providerRow?.has_key !== 'TAK') {
    console.error(
      'DAY195_SKIPPED: brak klucza dostawcy (~/.consultify-openrouter niewczytany). ' +
        'Probe NIE udaje sukcesu — deterministyczny fallback nie jest dowodem.'
    );
    process.exit(2);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await seed();

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  ApiGateway.getInstance().initializeRoutes(app);
  const token = jwt.sign(
    { id: USER_ID, userId: USER_ID, organizationId: ORGANIZATION_ID, role: 'OWNER' },
    config.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );

  const createdArtifacts: string[] = [];
  try {
    // --- Pre-flight, ZERO model calls: materialize the same outline with
    // useLlm=false and count the prose blocks. `generateBlockProse` sends one
    // call per batch of two, so more than one batch would blow the DEC-317
    // budget. Refuse to start rather than discover it from the invoice.
    const dry = await request(app)
      .post('/api/document-studio/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ intake: INTAKE, outline: OUTLINE, sourceRefs: SOURCE_REFS, useLlm: false });
    if (dry.status !== 200) {
      throw new Error(`Pre-flight generate failed: ${dry.status} ${JSON.stringify(dry.body)}`);
    }
    const dryArtifactId = String(dry.body?.artifactId ?? '');
    if (dryArtifactId) createdArtifacts.push(dryArtifactId);
    const dryRow = await dbGet<{ content_json_native: string }>(
      `SELECT content_json_native FROM wave5_artifacts
       WHERE artifact_id = ? AND organization_id = ?`,
      [dryArtifactId, ORGANIZATION_ID]
    );
    const drySchema = JSON.parse(String(dryRow?.content_json_native || '{}')) as DocumentSchema;
    const targets = countProseTargets(drySchema);
    const batches = Math.ceil(targets / PROSE_BATCH_SIZE);
    log(`DAY195_BUDGET proseTargets=${targets} batchSize=${PROSE_BATCH_SIZE} calls=${batches}`);
    if (batches !== 1) {
      throw new Error(
        `DEC-317: the outline needs ${batches} model calls (${targets} prose blocks). ` +
          'Shrink the outline instead of paying for extra calls.'
      );
    }

    // --- The one real run. In a dry rehearsal the deterministic artifact from
    // the pre-flight plays the subject, so nothing below is left untested.
    const startedAt = Date.now();
    const generate = dryRunOnly
      ? dry
      : await request(app)
          .post('/api/document-studio/generate')
          .set('Authorization', `Bearer ${token}`)
          .send({ intake: INTAKE, outline: OUTLINE, sourceRefs: SOURCE_REFS, useLlm: true });
    const durationMs = dryRunOnly ? 0 : Date.now() - startedAt;
    const artifactId = String(generate.body?.artifactId ?? '');
    if (artifactId && !createdArtifacts.includes(artifactId)) createdArtifacts.push(artifactId);
    const warnings = generate.body?.generationWarnings ?? [];
    log(
      `DAY195_GENERATE status=${generate.status} artifactId=${artifactId || 'brak'} durationMs=${durationMs}`
    );
    log(`DAY195_WARNINGS ${JSON.stringify(warnings)}`);
    if (generate.status !== 200 || !artifactId) {
      throw new Error(`Generate failed: ${generate.status} ${JSON.stringify(generate.body)}`);
    }

    const persisted = await dbGet<{ artifact_id: string; content_json_native: string }>(
      `SELECT artifact_id, content_json_native FROM wave5_artifacts
       WHERE artifact_id = ? AND organization_id = ?`,
      [artifactId, ORGANIZATION_ID]
    );
    if (persisted?.artifact_id !== artifactId) {
      throw new Error('DB readback failed — the artifact is not in PostgreSQL.');
    }
    const schema = JSON.parse(String(persisted.content_json_native || '{}')) as DocumentSchema;
    const paragraphStats = schema.sections.map((section) => ({
      title: section.title,
      paragraphs: section.blocks.filter((block) => block.type === 'paragraph').length,
      flags: section.blocks
        .filter((block) => block.type === 'paragraph')
        .map((block) => block.isAssumption === true),
    }));
    log(`DAY195_READBACK ${JSON.stringify(paragraphStats)}`);

    const mutation = await runBoundaryMutation(schema);
    log(
      `DAY195_MUTATION legacyFlagged=${mutation.legacyFlagged} fixedFlagged=${mutation.fixedFlagged} ` +
        `legacyRemoved=${mutation.legacyRemoved} fixedRemoved=${mutation.fixedRemoved} ` +
        `homographHits=${JSON.stringify(mutation.homographHits)}`
    );

    // --- Export. A 403 `qa_blocking` is evidence too: it is recorded with its
    // reasons, never bypassed with `qaOverride`.
    const exported = await request(app)
      .get(`/api/document-studio/${artifactId}/export/docx`)
      .set('Authorization', `Bearer ${token}`);
    log(`DAY195_EXPORT status=${exported.status}`);

    let docxWords: number | null = null;
    let docxBytes = 0;
    let docxPath: string | null = null;
    if (exported.status === 200) {
      const bytes = Buffer.from(String(exported.body?.contentBase64 || ''), 'base64');
      docxBytes = bytes.length;
      if (bytes.subarray(0, 2).toString() !== 'PK') {
        throw new Error('Export did not return a ZIP container.');
      }
      docxPath = `${OUTPUT_DIR}/day195-dokument-pokazywalny.docx`;
      await writeFile(docxPath, bytes);
      const zip = await JSZip.loadAsync(bytes);
      const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
      docxWords = countDocxWords(documentXml);
      log(`DAY195_DOCX bytes=${docxBytes} words=${docxWords} path=${docxPath}`);
    } else {
      log(`DAY195_QA_GATE ${JSON.stringify(exported.body)}`);
    }

    await writeFile(
      `${OUTPUT_DIR}/day195-real-path-result.json`,
      JSON.stringify(
        {
          generateStatus: generate.status,
          exportStatus: exported.status,
          artifactId,
          durationMs,
          generationWarnings: warnings,
          proseTargets: targets,
          modelCalls: batches,
          paragraphStats,
          boundaryMutation: mutation,
          docxBytes,
          docxWords,
          docxPath,
          qaGateBody: exported.status === 200 ? null : exported.body,
        },
        null,
        2
      )
    );
    log('DAY195_DONE');
  } finally {
    await cleanup(createdArtifacts);
  }
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    await rm(BOUNDARY_LEGACY, { force: true }).catch(() => undefined);
    console.error(`DAY195_FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
