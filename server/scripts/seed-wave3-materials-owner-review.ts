#!/usr/bin/env tsx
/** Guarded Wave 3 Materials owner-review fixture. Disposable local PostgreSQL only. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

const YES = process.env.SEED_WAVE3_MATERIALS_OWNER_REVIEW;
const databaseUrl = process.env.DATABASE_URL ?? '';
const manifestPath = process.env.MATERIALS_OWNER_FIXTURE_MANIFEST ?? '';
const password = process.env.MATERIALS_OWNER_FIXTURE_PASSWORD ?? '';
const reset = process.argv.includes('--reset');
const FIXTURE_ID = 'W3-MATERIALS-OWNER-v1';
const FIXTURE_NAME = 'wave3-materials-owner-review-v1';
if (YES !== 'YES') throw new Error('SEED_WAVE3_MATERIALS_OWNER_REVIEW=YES is required');
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const parsed = new URL(databaseUrl);
const databaseName = parsed.pathname.replace(/^\//, '');
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname))
  throw new Error('Loopback PostgreSQL required');
if (!/^consultify_w3_materials_owner_[a-z0-9_]+$/.test(databaseName)) {
  throw new Error('Database name must match consultify_w3_materials_owner_*');
}
const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';

async function dropDatabase() {
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    throw new Error('Reset requires the existing MATERIALS_OWNER_FIXTURE_MANIFEST');
  }
  if ((fs.statSync(manifestPath).mode & 0o777) !== 0o600) {
    throw new Error('Reset manifest mode must be 0600');
  }
  const receipt = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (
    receipt.ownershipState !== 'FINAL' ||
    receipt.fixture !== FIXTURE_NAME ||
    receipt.fixtureId !== FIXTURE_ID ||
    receipt.databaseName !== databaseName ||
    receipt.marker?.table !== 'wave3_owner_fixture_markers' ||
    receipt.marker?.fixtureId !== FIXTURE_ID ||
    receipt.marker?.ownershipNonce !== receipt.ownershipNonce
  ) {
    throw new Error('Reset manifest is not the exact FINAL Materials ownership receipt');
  }
  const owned = new Client({ connectionString: databaseUrl });
  await owned.connect();
  try {
    const marker = await owned.query(
      `SELECT database_name FROM public.wave3_owner_fixture_markers
        WHERE fixture_id=$1 AND ownership_nonce=$2`,
      [FIXTURE_ID, receipt.ownershipNonce]
    );
    if (marker.rowCount !== 1 || marker.rows[0]?.database_name !== databaseName) {
      throw new Error('Reset refused: durable Materials ownership marker mismatch');
    }
  } finally {
    await owned.end();
  }
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`,
      [databaseName]
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    const check = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName]);
    if (check.rowCount) throw new Error('Materials fixture database remains in catalog');
    process.stdout.write(
      `${JSON.stringify({ fixture: FIXTURE_NAME, reset: true, catalogAbsent: true })}\n`
    );
  } finally {
    await admin.end();
  }
}
if (reset) {
  await dropDatabase();
  process.exit(0);
}
if (!manifestPath || !password)
  throw new Error(
    'MATERIALS_OWNER_FIXTURE_MANIFEST and MATERIALS_OWNER_FIXTURE_PASSWORD are required'
  );
if (fs.existsSync(manifestPath)) throw new Error('Refusing to overwrite existing manifest');

const I = {
  org: 'b1100000-0000-4000-8000-000000000001',
  user: 'b1110000-0000-4000-8000-000000000001',
  artifact: 'b1120000-0000-4000-8000-000000000001',
  docV1: 'b1130000-0000-4000-8000-000000000001',
  docV2: 'b1130000-0000-4000-8000-000000000002',
  docApproved: 'b1140000-0000-4000-8000-000000000001',
  docUnknown: 'b1140000-0000-4000-8000-000000000002',
  pptTemplate: 'b1150000-0000-4000-8000-000000000001',
  deck: 'b1160000-0000-4000-8000-000000000001',
  deckV1: 'b1170000-0000-4000-8000-000000000001',
  workbook: 'b1180000-0000-4000-8000-000000000001',
  workbookRev: 'b1190000-0000-4000-8000-000000000001',
};
const fixed = '2026-08-21T08:00:00.000Z';
const ownershipNonce = crypto.randomBytes(32).toString('hex');
const doc1 = {
  documentId: 'b1120000-0000-4000-8000-000000000001',
  artifactId: 'b1120000-0000-4000-8000-000000000001',
  title: 'Plan transformacji operacyjnej',
  documentType: 'executive_memo',
  language: 'pl',
  audience: ['Zarząd'],
  goal: 'decide',
  communicationRegister: 'executive',
  density: 'standard',
  languageStyle: 'consulting',
  confidentiality: 'internal',
  sections: [
    {
      sectionId: 'materials-owner-goal',
      orderIndex: 0,
      level: 1,
      title: 'Cel',
      blocks: [
        {
          blockId: 'materials-owner-goal-paragraph',
          type: 'paragraph',
          content: { text: 'Skrócić czas realizacji i zwiększyć przewidywalność.' },
        },
      ],
      sourceRefs: [],
    },
  ],
  sourceRefs: [],
  createdAt: fixed,
  updatedAt: fixed,
};
const doc2 = {
  ...doc1,
  sections: [
    ...doc1.sections,
    {
      sectionId: 'materials-owner-recommendations',
      orderIndex: 1,
      level: 1,
      title: 'Rekomendacje',
      blocks: [
        {
          blockId: 'materials-owner-recommendations-paragraph',
          type: 'paragraph',
          content: { text: 'Wprowadzić tygodniowy rytm decyzji i jawny rejestr ryzyk.' },
        },
      ],
      sourceRefs: [],
    },
  ],
};
const slides = [
  {
    id: 's1',
    title: 'Transformacja operacyjna',
    body: ['Cel i zakres'],
    notes: 'Otwórz kontekstem biznesowym.',
    image: { altText: 'Schemat zakresu transformacji' },
  },
  {
    id: 's2',
    title: 'Stan obecny',
    body: ['Długi czas realizacji', 'Niejawne zależności'],
    notes: 'Omów dwa główne problemy.',
    image: { altText: 'Mapa dwóch barier operacyjnych' },
  },
  {
    id: 's3',
    title: 'Plan 90 dni',
    body: ['0–30: pomiar', '31–60: pilotaż', '61–90: skalowanie'],
    notes: 'Podkreśl etapy i mierniki.',
    image: { altText: 'Oś czasu planu dziewięćdziesięciodniowego' },
  },
  {
    id: 's4',
    title: 'Decyzja',
    body: ['Zatwierdzić pilotaż'],
    notes: 'Poproś o decyzję właściciela.',
    image: { altText: 'Karta decyzji o pilotażu' },
  },
];
const unifiedDeck = {
  meta: {
    client: 'Wave 3 Materials Owner',
    project: 'Transformacja operacyjna',
    date: '2026-08-21',
    author: 'Materials Owner',
    confidentiality: 'internal',
    language: 'pl',
    template: 'corporate',
  },
  slides: slides.map((slide, index) => ({
    ...slide,
    intent: (['cover', 'key_messages', 'roadmap', 'next_steps'] as const)[index],
    key_message: slide.title,
    content: {
      type: (['cover', 'key_messages', 'roadmap', 'next_steps'] as const)[index],
      title: slide.title,
      messages: slide.body.map((text) => ({ title: text })),
    },
    speaker_notes: slide.notes,
  })),
};
const workbookV1 = {
  sheets: [
    {
      id: 'plan',
      name: 'Plan',
      cells: {
        A1: { value: 'Pozycja' },
        B1: { value: 'Kwota' },
        A2: { value: 'Przychody' },
        B2: { value: 120000 },
        A3: { value: 'Koszty' },
        B3: { value: 80000 },
        A4: { value: 'Wynik' },
        B4: { formula: '=B2-B3', cachedValue: 40000 },
      },
    },
  ],
};
const db = new Client({ connectionString: databaseUrl });
await db.connect();
try {
  const ident = await db.query('SELECT current_database() name');
  if (ident.rows[0]?.name !== databaseName) throw new Error('Database identity mismatch');
  const migrated = await db.query(
    `SELECT COUNT(*)::int count FROM schema_migrations WHERE status IN ('applied','success')`
  );
  if (Number(migrated.rows[0]?.count) < 800)
    throw new Error('Materials owner database is not migrated');
  const collision = await db.query(
    `SELECT 1 FROM organizations WHERE id=$1
     UNION ALL SELECT 1 FROM users WHERE id=$2
     LIMIT 1`,
    [I.org, I.user]
  );
  if (collision.rowCount)
    throw new Error('Materials fixture identities already exist; use --reset');
  const hash = await bcrypt.hash(password, 10);
  await db.query('BEGIN');
  await db.query(`CREATE TABLE IF NOT EXISTS public.wave3_owner_fixture_markers(
    fixture_id text PRIMARY KEY,
    ownership_nonce text NOT NULL,
    database_name text NOT NULL
  )`);
  await db.query(
    `INSERT INTO public.wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name)
     VALUES($1,$2,current_database())`,
    [FIXTURE_ID, ownershipNonce]
  );
  await db.query(`INSERT INTO organizations(id,name) VALUES($1,'Wave 3 Materials Owner')`, [I.org]);
  await db.query(
    `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status) VALUES($1,$2,'wave3.materials.owner.20260821@local.test',$3,'Materials','Owner','ADMIN','active')`,
    [I.user, I.org, hash]
  );
  await db.query(
    `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES(gen_random_uuid()::text,$1,$2,'OWNER','ACTIVE')`,
    [I.org, I.user]
  );
  await db.query(
    `INSERT INTO wave5_artifacts(artifact_id,organization_id,artifact_type,status,title,content,canonical_format,content_json_native,content_schema_version,current_version,created_by,created_at,updated_at) VALUES($1,$2,'document','draft','Plan transformacji operacyjnej',$3::text,'json_native',$3::jsonb,'document_studio_v1',2,$4,$5,$5)`,
    [I.artifact, I.org, JSON.stringify(doc2), I.user, fixed]
  );
  await db.query(
    // BUGFIX (materials registry fix, 2026-08-25): this row was seeded with
    // delivery_state='draft'/is_draft=1 despite the document itself being a
    // fully populated, two-section "ready for review" fixture (matching the
    // deck below). The server's default M17 junk filter
    // (matchesViewFilters, artifactRegistryService.ts) excludes is_draft
    // rows from GET /api/artifacts by default, so this row silently
    // disappeared from the common Materials registry while the presentation
    // (delivery_state='ready', is_draft=0) stayed visible — root cause of
    // "recovered common registry projects only the Presentation row"
    // (MODULE_ACCEPTANCE.md G05). Aligned to 'ready'/0, matching the deck.
    `INSERT INTO v8_output_artifacts(artifact_id,organization_id,output_type,delivery_state,artifact_family,title_snapshot,owner_user_id,canonical_home,visibility_scope,origin_summary_json,is_draft,created_by,created_at,last_transition_at) VALUES($1,$2,'report','ready','document','Plan transformacji operacyjnej',$3,'outputs_library','organization','{"fixture":"wave3-materials","origin":"native_artifact"}',0,$3,$4,$4)`,
    [I.artifact, I.org, I.user, fixed]
  );
  await db.query(
    `INSERT INTO v8_artifact_origin_links(link_id,artifact_id,organization_id,origin_runtime,origin_record_id,is_primary_origin,created_at) VALUES($1,$2,$3,'native_artifact',$2,1,$4)`,
    ['b1130000-0000-4000-8000-000000000099', I.artifact, I.org, fixed]
  );
  for (const [id, version, content] of [
    [I.docV1, 1, doc1],
    [I.docV2, 2, doc2],
  ] as const)
    await db.query(
      `INSERT INTO wave5_artifact_versions(version_id,artifact_id,organization_id,version,content,canonical_format,content_json_native,content_schema_version,provenance_json,created_by,created_at) VALUES($1,$2,$3,$4,$5::text,'json_native',$5::jsonb,'document_studio_v1','{"fixture":"wave3-materials"}',$6,$7)`,
      [id, I.artifact, I.org, version, JSON.stringify(content), I.user, fixed]
    );
  for (const [id, name, status] of [
    [I.docApproved, 'Approved consulting brief', 'approved'],
    [I.docUnknown, 'Imported template — rights UNKNOWN', 'draft'],
  ])
    await db.query(
      `INSERT INTO document_studio_templates(template_id,organization_id,name,category,document_type,purpose,audience,section_blueprint,status,version,created_by,created_at,updated_at,approved_by,approved_at,notes) VALUES($1,$2,$3,'strategy','brief','owner review','["executive"]','[]',$4,'1.0',$5,$6,$6,CASE WHEN $4='approved' THEN $5 END,CASE WHEN $4='approved' THEN $6::timestamptz END,CASE WHEN $4='draft' THEN 'RIGHTS_UNKNOWN_QUARANTINED' END)`,
      [id, I.org, name, status, I.user, fixed]
    );
  await db.query(
    `INSERT INTO presentation_templates(id,organization_id,name,deck_type,outline_json,min_slides,max_slides,is_system,is_active,created_by,created_at,updated_at) VALUES($1,$2,'Restricted native owner deck','strategy',$3,3,5,false,true,$4,$5,$5)`,
    [I.pptTemplate, I.org, JSON.stringify({ slides }), I.user, fixed]
  );
  await db.query(
    `INSERT INTO presentation_decks(id,organization_id,title,description,template_id,deck_type,unified_json,slide_count,status,generated_by,created_at,updated_at,version) VALUES($1,$2,'Plan transformacji — 90 dni','Native PPTX owner-review fixture',$3,'strategy',$4,4,'ready',$5,$6,$6,1)`,
    [
      I.deck,
      I.org,
      I.pptTemplate,
      JSON.stringify({ ...unifiedDeck, accessibility: { notesPresent: 4, altTextPresent: 4 } }),
      I.user,
      fixed,
    ]
  );
  await db.query(
    `INSERT INTO presentation_deck_versions(id,deck_id,version,deck_json_snapshot,slide_count,created_by,created_at) VALUES($1,$2,1,$3,4,$4,$5)`,
    [I.deckV1, I.deck, JSON.stringify(unifiedDeck), I.user, fixed]
  );
  // The editor record is not the Materials registry projection. Seed the
  // canonical output artifact and its primary origin explicitly, exactly as
  // the document and workbook lanes below do. Without these rows the full
  // presentation card exists but can disappear from the shared library.
  await db.query(
    `INSERT INTO v8_output_artifacts(artifact_id,organization_id,output_type,delivery_state,artifact_family,title_snapshot,owner_user_id,canonical_home,visibility_scope,origin_summary_json,is_draft,created_by,created_at,last_transition_at) VALUES($1,$2,'presentation','ready','presentation','Plan transformacji — 90 dni',$3,'outputs_library','organization',$4::jsonb,0,$3,$5,$5)`,
    [
      I.deck,
      I.org,
      I.user,
      JSON.stringify({
        fixture: 'wave3-materials',
        origin: 'presentation_decks',
        deckType: 'strategy',
        slideCount: 4,
      }),
      fixed,
    ]
  );
  await db.query(
    `INSERT INTO v8_artifact_origin_links(link_id,artifact_id,organization_id,origin_runtime,origin_record_id,is_primary_origin,created_at) VALUES($1,$2,$3,'presentation',$2,1,$4)`,
    ['b1170000-0000-4000-8000-000000000099', I.deck, I.org, fixed]
  );
  await db.query(
    `INSERT INTO generated_workbooks(id,organization_id,title,description,schema_json,sheet_count,created_by,created_at,lifecycle_status,version,quality_report_json) VALUES($1,$2,'Budżet pilotażu','Owner-review formula workbook',$3,1,$4,$5,'draft',1,'{"formulaCells":1,"fixture":"wave3-materials"}')`,
    [I.workbook, I.org, JSON.stringify(workbookV1), I.user, fixed]
  );
  await db.query(
    `INSERT INTO generated_workbook_revisions(id,workbook_id,organization_id,version,command_id,idempotency_key,base_schema_json,schema_json,operations_json,created_by,created_at) VALUES($1,$2,$3,1,'fixture-create','wave3-materials-workbook-v1','{}',$4,'[{"kind":"set_formula","cell":"B4"}]',$5,$6)`,
    [I.workbookRev, I.workbook, I.org, JSON.stringify(workbookV1), I.user, fixed]
  );
  // The Materials Sheets list reads the canonical V8 output registry, while
  // the editor reads generated_workbooks. Keep both projections linked so the
  // owner can open this workbook from the library instead of a hidden deep link.
  await db.query(
    // BUGFIX (materials registry fix, 2026-08-25): same root cause as the
    // document row above — a fully realized formula workbook seeded as
    // delivery_state='draft'/is_draft=1, silently dropped by the default
    // M17 draft filter. Aligned to 'ready'/0, matching the deck.
    `INSERT INTO v8_output_artifacts(artifact_id,organization_id,output_type,delivery_state,artifact_family,title_snapshot,owner_user_id,canonical_home,visibility_scope,origin_summary_json,is_draft,created_by,created_at,last_transition_at) VALUES($1,$2,'sheet','ready','sheet','Budżet pilotażu',$3,'outputs_library','organization','{"fixture":"wave3-materials","origin":"workbook"}',0,$3,$4,$4)`,
    [I.workbook, I.org, I.user, fixed]
  );
  await db.query(
    `INSERT INTO v8_artifact_origin_links(link_id,artifact_id,organization_id,origin_runtime,origin_record_id,is_primary_origin,created_at) VALUES($1,$2,$3,'sheet',$2,1,$4)`,
    ['b1190000-0000-4000-8000-000000000001', I.workbook, I.org, fixed]
  );
  await db.query('COMMIT');

  const rb = await db.query(
    `SELECT
    (SELECT count(*)::int FROM wave5_artifact_versions WHERE artifact_id=$1) doc_versions,
    (SELECT count(*)::int FROM presentation_decks WHERE id=$2 AND slide_count BETWEEN 3 AND 5) decks,
    (SELECT count(*)::int FROM presentation_deck_versions WHERE deck_id=$2) deck_versions,
    (SELECT count(*)::int FROM generated_workbook_revisions WHERE workbook_id=$3 AND schema_json LIKE '%=B2-B3%') workbook_revisions,
    (SELECT count(*)::int FROM v8_artifact_origin_links WHERE organization_id=$6 AND artifact_id=$1 AND origin_runtime='native_artifact') document_registry_projections,
    (SELECT count(*)::int FROM v8_artifact_origin_links WHERE organization_id=$6 AND artifact_id=$2 AND origin_runtime='presentation') presentation_registry_projections,
    (SELECT count(*)::int FROM v8_artifact_origin_links WHERE organization_id=$6 AND artifact_id=$3 AND origin_runtime='sheet') workbook_registry_projections,
    (SELECT count(*)::int FROM document_studio_templates WHERE template_id=$4 AND status='approved') approved_templates,
    (SELECT count(*)::int FROM document_studio_templates WHERE template_id=$5 AND notes='RIGHTS_UNKNOWN_QUARANTINED') unknown_templates,
    -- Registry-fix regression guard: GET /api/artifacts excludes is_draft=1
    -- rows by default (M17 junk filter, artifactRegistryService.ts
    -- matchesViewFilters). All three fixture artifacts must be is_draft=0
    -- so the common Materials registry ("All" tab) actually shows all
    -- three — this is the exact defect this readback would have caught.
    (SELECT count(*)::int FROM v8_output_artifacts WHERE organization_id=$6 AND artifact_id IN ($1,$2,$3) AND is_draft=0) non_draft_registry_rows`,
    [I.artifact, I.deck, I.workbook, I.docApproved, I.docUnknown, I.org]
  );
  const expected = {
    doc_versions: 2,
    decks: 1,
    deck_versions: 1,
    workbook_revisions: 1,
    document_registry_projections: 1,
    presentation_registry_projections: 1,
    workbook_registry_projections: 1,
    approved_templates: 1,
    unknown_templates: 1,
    non_draft_registry_rows: 3,
  };
  for (const [k, v] of Object.entries(expected))
    if (Number(rb.rows[0]?.[k]) !== v) throw new Error(`Readback failed: ${k}`);
  const manifest = {
    schemaVersion: 1,
    fixture: FIXTURE_NAME,
    fixtureId: FIXTURE_ID,
    ownershipState: 'FINAL',
    ownershipNonce,
    marker: { table: 'wave3_owner_fixture_markers', fixtureId: FIXTURE_ID, ownershipNonce },
    fixtureState: 'READY_FOR_LOCAL_OWNER_REVIEW',
    ownerReviewReady: false,
    generatedAt: fixed,
    databaseName,
    deepLinkVerified: false,
    persona: {
      email: 'wave3.materials.owner.20260821@local.test',
      role: 'ADMIN',
      membershipRole: 'OWNER',
      credentialsIncluded: false,
    },
    routes: {
      document: `/document-studio/${I.artifact}`,
      presentations: `/presentations/builder/${I.deck}`,
      workbook: `/excele?ff_excele=1&artifactId=${I.workbook}`,
    },
    artifacts: {
      document: { id: I.artifact, versions: 2 },
      presentation: { id: I.deck, slides: 4, notes: 4, altText: 4, versions: 1 },
      workbook: { id: I.workbook, sheets: 1, formula: 'B4 = B2-B3', revisions: 1 },
    },
    templates: {
      approved: { id: I.docApproved, status: 'approved' },
      unknown: { id: I.docUnknown, status: 'UNKNOWN_RIGHTS_QUARANTINED', runtimeStatus: 'draft' },
    },
    policy: {
      restrictedNativeOnly: true,
      policyConfirmationRequired: true,
      externalProvidersEnabled: false,
      unprovenTemplateFontImageRightsEnabled: false,
    },
    sharing: {
      seeded: false,
      providerState: 'UNAVAILABLE_NOT_SIMULATED',
      revokeEvidence: 'NOT_RUN_OWNER_GATE',
    },
    readback: expected,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
  if ((fs.statSync(manifestPath).mode & 0o777) !== 0o600)
    throw new Error('Manifest mode is not 0600');
  process.stdout.write(
    `${JSON.stringify({ fixture: manifest.fixture, seeded: true, readback: expected, manifestPath })}\n`
  );
} catch (error) {
  await db.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await db.end();
}
