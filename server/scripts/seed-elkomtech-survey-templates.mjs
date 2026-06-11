#!/usr/bin/env node
/**
 * Seed Elkomtech survey templates from the reviewed question docs:
 *   DRD/Apator/_BADANIE_ANKIETOWE/07_ANKIETY_UZUPELNIAJACE_PROCESY_GLOWNE.md  (P1–P9)
 *   DRD/Apator/_BADANIE_ANKIETOWE/08_ANKIETY_DZIALY_WSPIERAJACE.md            (D1–D8)
 *
 * Parses the markdown tables (| # | Pytanie | Typ | Domyka |) so the app templates
 * stay 1:1 with the accepted documents. Idempotent: re-running replaces templates
 * with the elkomtech__survey_* id prefix.
 *
 * Target tables: interview_library_templates + interview_library_template_questions
 * (the tables the Interview module's Szablony tab actually reads — verified on VTS wave 2).
 *
 * Usage: node server/scripts/seed-elkomtech-survey-templates.mjs   (DATABASE_URL from .env.local)
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const docsDir = resolve(repoRoot, '../Apator/_BADANIE_ANKIETOWE');

const envLocal = readFileSync(resolve(repoRoot, '.env.local'), 'utf8');
const dbUrl = envLocal.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!dbUrl) throw new Error('DATABASE_URL not found in .env.local');

const ORG = 'elkomtech';
const PREFIX = 'elkomtech__survey_';
const CREATED_BY = 'seed-elkomtech-survey-templates';

// Per-set metadata: app category code + question category + slug
const SET_META = {
  P1: { slug: 'p1_pozyskanie_sprzedaz', category: 'SALES', qcat: 'operations' },
  P2: { slug: 'p2_ofertowanie', category: 'SALES', qcat: 'operations' },
  P3: { slug: 'p3_przetargi', category: 'SALES', qcat: 'operations' },
  P4: { slug: 'p4_planowanie_sop', category: 'PLANNING_SOP', qcat: 'operations' },
  P5: { slug: 'p5_projektowanie', category: 'RND_PRODUCT', qcat: 'operations' },
  P6: { slug: 'p6_konfiguracja', category: 'OPERATIONS', qcat: 'operations' },
  P7: { slug: 'p7_uruchomienia', category: 'OPERATIONS', qcat: 'operations' },
  P8: { slug: 'p8_serwis_wsparcie', category: 'SERVICE_COMPLAINTS', qcat: 'operations' },
  P9: { slug: 'p9_szkolenia', category: 'HR_CHANGE', qcat: 'operations' },
  D1: { slug: 'd1_zakupy', category: 'PROCUREMENT_SUPPLY_CHAIN', qcat: 'operations' },
  D2: { slug: 'd2_magazyn_logistyka', category: 'WAREHOUSE_LOGISTICS', qcat: 'operations' },
  D3: { slug: 'd3_produkcja', category: 'PRODUCTION', qcat: 'operations' },
  D4: { slug: 'd4_modelowanie_scada', category: 'IT_OT_DATA', qcat: 'operations' },
  D5: { slug: 'd5_rnd_konstrukcja', category: 'RND_PRODUCT', qcat: 'operations' },
  D6: { slug: 'd6_controlling_finanse', category: 'FINANCE_CONTROLLING', qcat: 'finance' },
  D7: { slug: 'd7_hr', category: 'HR_CHANGE', qcat: 'hr' },
  D8: { slug: 'd8_dzial_prawny', category: 'LEGAL', qcat: 'legal' },
};

// Map the "Typ" column tokens to an answer-format instruction (evidence_prompt)
function typeToPrompt(typ) {
  const t = typ.trim();
  const parts = t.split('+').map((s) => s.trim());
  const out = [];
  for (const p of parts) {
    const mult = p.match(/liczba\s*×\s*(\d+)/i);
    if (mult) out.push(`Podaj ${mult[1]} konkretne liczby (każdą opisz, czego dotyczy).`);
    else if (/^liczba/i.test(p)) out.push('Podaj konkretną liczbę (z jednostką).');
    else if (/lista\s*×\s*(\d+)/i.test(p)) out.push('Wypisz dwie osobne listy punktowe.');
    else if (/^lista/i.test(p)) out.push('Odpowiedz listą punktów (po jednym na linię).');
    else if (/^ranking/i.test(p)) out.push('Uszereguj pozycje od najważniejszej do najmniej ważnej.');
    else if (/^T\/N/i.test(p)) out.push('Odpowiedz TAK lub NIE i dodaj 1–2 zdania komentarza.');
    else if (/^załącznik/i.test(p)) out.push('Załącz plik (eksport/zestawienie). Jeśli nie możesz — napisz, kto ma dane i kiedy dostarczy.');
    else if (/^opis/i.test(p)) out.push('Opisz własnymi słowami; konkrety (nazwy, czasy, przykłady) są cenniejsze niż oceny.');
    else if (/^tekst/i.test(p)) out.push('Wystarczy krótka odpowiedź (1–2 zdania).');
    else out.push('Odpowiedz swobodnie.');
  }
  return [...new Set(out)].join(' ');
}

function stripMd(s) {
  return s
    .replace(/\*\*/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFile(path) {
  const raw = readFileSync(path, 'utf8');
  const sections = [];
  // Split into sections at "## P1." / "## D1." headings
  const re = /^## ((?:P|D)\d+)\.\s+(.+)$/gm;
  const marks = [];
  let m;
  while ((m = re.exec(raw)) !== null) marks.push({ code: m[1], title: m[2], index: m.index });
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index;
    const end = i + 1 < marks.length ? marks[i + 1].index : raw.length;
    const body = raw.slice(start, end);
    // Description: the bold-intro lines before the table (Adresaci / Typ procesu / Mamy)
    const introLines = body
      .split('\n')
      .filter((l) => /^\*\*(Adresaci|Typ procesu|Mamy)/.test(l.trim()))
      .map((l) => stripMd(l));
    // Parse table rows: | 1 | question | typ | domyka |
    const rows = [];
    for (const line of body.split('\n')) {
      const cells = line.split('|').map((c) => c.trim());
      // valid row: ['', '1', 'question', 'typ', 'domyka', '']
      if (cells.length >= 5 && /^\d+$/.test(cells[1])) {
        rows.push({
          n: parseInt(cells[1], 10),
          text: stripMd(cells[2]),
          typ: stripMd(cells[3]),
          domyka: stripMd(cells[4]),
        });
      }
    }
    if (rows.length) sections.push({ code: marks[i].code, title: stripMd(marks[i].title), intro: introLines, rows });
  }
  return sections;
}

const file07 = parseFile(resolve(docsDir, '07_ANKIETY_UZUPELNIAJACE_PROCESY_GLOWNE.md'));
const file08 = parseFile(resolve(docsDir, '08_ANKIETY_DZIALY_WSPIERAJACE.md'));
const sections = [...file07, ...file08];

const expected = { P: 9, D: 8 };
const gotP = sections.filter((s) => s.code.startsWith('P')).length;
const gotD = sections.filter((s) => s.code.startsWith('D')).length;
if (gotP !== expected.P || gotD !== expected.D) {
  throw new Error(`Parse mismatch: got ${gotP} P-sets (want 9), ${gotD} D-sets (want 8)`);
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

try {
  await client.query('BEGIN');

  // Idempotency: wipe previous versions of these templates (questions cascade)
  const del = await client.query(`DELETE FROM interview_library_templates WHERE organization_id=$1 AND id LIKE $2`, [
    ORG,
    `${PREFIX}%`,
  ]);
  console.log(`Removed ${del.rowCount} previous template(s).`);

  let qTotal = 0;
  for (const sec of sections) {
    const meta = SET_META[sec.code];
    if (!meta) throw new Error(`No meta for set ${sec.code}`);
    const tplId = `${PREFIX}${meta.slug}_v1`;
    const isProcess = sec.code.startsWith('P');
    const name = `Elkomtech — ${sec.title}${isProcess ? ' (uzupełnienie)' : ''}`;
    const description =
      (isProcess
        ? 'Ankieta uzupełniająca dla procesu już częściowo zmapowanego — domyka liczby, rejestry i luki map; nie powtarza pytań, na które odpowiedź już mamy. '
        : 'Pierwsza ankieta procesowa dla działu dotąd nieobjętego badaniem — odpowiedzi ①–⑧ zastępują brakującą mapę SIPOC. ') +
      sec.intro.join(' · ');
    const minutes = Math.max(10, Math.round(sec.rows.length * 1.7));

    await client.query(
      `INSERT INTO interview_library_templates
        (id, organization_id, name, description, category, tags, questions_json, is_system, is_active,
         version, created_by, status, template_scope, estimated_time_minutes, runtime_mode_default, language)
       VALUES ($1,$2,$3,$4,$5,'[]','[]',0,1,1,$6,'approved','organization',$7,'one_question_per_screen','pl')`,
      [tplId, ORG, name, description, meta.category, CREATED_BY, minutes]
    );

    for (const row of sec.rows) {
      const qId = `${tplId}_q${String(row.n).padStart(2, '0')}`;
      const wantsFile = /załącznik/i.test(row.typ);
      await client.query(
        `INSERT INTO interview_library_template_questions
          (id, template_id, category, question_text, question_type, is_required, sort_order,
           description, evidence_prompt, answer_type, expected_answer_shape,
           allow_voice, allow_file_upload, allow_url, allow_context_note)
         VALUES ($1,$2,$3,$4,'open',1,$5,$6,$7,'long_text',$8,1,1,1,1)`,
        [
          qId,
          tplId,
          meta.qcat,
          row.text,
          row.n * 10,
          `Domyka: ${row.domyka}`,
          typeToPrompt(row.typ),
          wantsFile ? 'Załącznik (plik) + komentarz' : row.typ,
        ]
      );
      qTotal++;
    }
    console.log(`✔ ${tplId} — "${name}" (${sec.rows.length} pytań, ~${minutes} min)`);
  }

  await client.query('COMMIT');
  console.log(`\nDone: ${sections.length} templates, ${qTotal} questions inserted for org=${ORG}.`);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
