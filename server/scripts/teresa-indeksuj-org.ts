/**
 * Teresa — indeksowanie korpusu dokumentów organizacji (2026-09-06).
 *
 * PO CO: ścieżka `ENABLE_ORG_KNOWLEDGE_RETRIEVAL` w `/api/ai/chat/stream` szuka
 * w `knowledge_chunks` (przez `ContextRetrievalService`). Jeśli dokumenty
 * organizacji nigdy nie zostały pocięte i zembedowane, ta ścieżka zwraca zero
 * i Teresa melduje `degraded: no_sources` — nawet z flagą włączoną.
 *
 * POMIAR NA STANOWISKU (baza `consultify_noc`, org DBR77, 2026-09-06):
 *   knowledge_docs = 0, knowledge_chunks = 0, ai_knowledge_embeddings = 0.
 * Czyli lokalnie NIE MA CZEGO indeksować — brak źródeł z korpusu dokumentów był
 * skutkiem braku danych, nie braku indeksu. Ten skrypt służy do sprawdzenia
 * tego samego na stagingu/demo, gdzie dokumenty mogą istnieć.
 *
 * UŻYCIE (domyślnie NIC nie zmienia):
 *   npx tsx server/scripts/teresa-indeksuj-org.ts --org=<uuid>            # dry-run
 *   npx tsx server/scripts/teresa-indeksuj-org.ts --org=<uuid> --apply    # zapis
 *   ... --limit=50    # ogranicz liczbę dokumentów w jednym przebiegu
 *
 * `--apply` woła `KnowledgeService.processDocument`, czyli DOKŁADNIE tę samą
 * ścieżkę, której używa wgranie pliku — żadnej równoległej implementacji
 * chunkowania ani embeddingów.
 */

import * as DbPromise from '../src/utils/DbPromise.js';

interface Args {
  org: string;
  apply: boolean;
  limit: number;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | null => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
  };
  const org = get('org') || '';
  const apply = argv.includes('--apply');
  const dryRun = argv.includes('--dry-run');
  if (apply && dryRun) {
    throw new Error('Podaj ALBO --dry-run ALBO --apply, nie oba naraz.');
  }
  const limit = Number.parseInt(get('limit') || '200', 10);
  return { org, apply, limit: Number.isFinite(limit) && limit > 0 ? limit : 200 };
}

async function count(sql: string, params: unknown[]): Promise<number> {
  try {
    const row: any = await DbPromise.get(sql, params as any);
    const value = row ? Object.values(row)[0] : 0;
    return Number(value) || 0;
  } catch (err: any) {
    console.log(`  (pominięto zapytanie: ${err?.message || err})`);
    return -1;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.org) {
    console.error('Brak --org=<uuid>. Przykład: --org=cc9db573-260f-4a19-927f-f3cc1fbaea38');
    process.exit(2);
  }

  console.log(`\n=== Teresa — indeksowanie korpusu org ===`);
  console.log(`org:   ${args.org}`);
  console.log(`tryb:  ${args.apply ? 'APPLY (zapisuje)' : 'DRY-RUN (nic nie zmienia)'}`);
  console.log(`limit: ${args.limit} dokumentów\n`);

  const docsTotal = await count(
    `SELECT COUNT(*) AS n FROM knowledge_docs WHERE organization_id = ? AND deleted_at IS NULL`,
    [args.org]
  );
  const chunksTotal = await count(
    `SELECT COUNT(*) AS n FROM knowledge_chunks c
      JOIN knowledge_docs d ON d.id = c.doc_id
     WHERE d.organization_id = ?`,
    [args.org]
  );
  const chunksNoEmbedding = await count(
    `SELECT COUNT(*) AS n FROM knowledge_chunks c
      JOIN knowledge_docs d ON d.id = c.doc_id
     WHERE d.organization_id = ? AND (c.embedding IS NULL OR c.embedding::text IN ('', '[]'))`,
    [args.org]
  );

  console.log(`STAN:`);
  console.log(`  knowledge_docs (żywe):            ${docsTotal}`);
  console.log(`  knowledge_chunks tej org:         ${chunksTotal}`);
  console.log(`  chunki BEZ embeddingu:            ${chunksNoEmbedding}`);

  if (docsTotal <= 0) {
    console.log(
      `\nWNIOSEK: organizacja nie ma ANI JEDNEGO dokumentu w korpusie.\n` +
        `Brak źródeł z korpusu dokumentów jest tu UCZCIWY — nie ma czego indeksować.\n` +
        `Teresa i tak dostaje kontekst modułu (services/ai/moduleContextGrounding.ts).\n`
    );
    process.exit(0);
  }

  let candidates: any[] = [];
  try {
    candidates = await DbPromise.all(
      `SELECT d.id, d.filename, d.normalized_md, d.normalized_json,
              (SELECT COUNT(*) FROM knowledge_chunks c WHERE c.doc_id = d.id) AS chunk_count
         FROM knowledge_docs d
        WHERE d.organization_id = ? AND d.deleted_at IS NULL
        ORDER BY d.created_at DESC
        LIMIT ?`,
      [args.org, args.limit] as any
    );
  } catch (err: any) {
    console.error(`Nie udało się odczytać dokumentów: ${err?.message || err}`);
    process.exit(1);
  }

  const textOf = (row: any): string => {
    if (typeof row.normalized_md === 'string' && row.normalized_md.trim()) return row.normalized_md;
    if (row.normalized_json) {
      try {
        const parsed =
          typeof row.normalized_json === 'string'
            ? JSON.parse(row.normalized_json)
            : row.normalized_json;
        if (typeof parsed?.text === 'string') return parsed.text;
        if (typeof parsed?.content === 'string') return parsed.content;
      } catch {
        /* ignore */
      }
    }
    return '';
  };

  const toIndex = candidates.filter((row) => Number(row.chunk_count) === 0 && textOf(row).trim());
  const noText = candidates.filter((row) => Number(row.chunk_count) === 0 && !textOf(row).trim());

  console.log(`\nPLAN (z ${candidates.length} przejrzanych dokumentów):`);
  console.log(`  do zaindeksowania (mają tekst, zero chunków): ${toIndex.length}`);
  console.log(`  bez tekstu (wymagają ponownego parsowania):   ${noText.length}`);
  for (const row of toIndex.slice(0, 20)) {
    console.log(`    - ${row.filename || row.id}`);
  }
  if (toIndex.length > 20) console.log(`    … i ${toIndex.length - 20} więcej`);

  if (!args.apply) {
    console.log(
      `\nDRY-RUN — nic nie zapisano. Aby wykonać:\n` +
        `  npx tsx server/scripts/teresa-indeksuj-org.ts --org=${args.org} --apply\n`
    );
    process.exit(0);
  }

  const { default: KnowledgeService } = await import('../src/services/KnowledgeService.js');
  let ok = 0;
  let failed = 0;
  for (const row of toIndex) {
    try {
      const stored = await (KnowledgeService as any).processDocument(
        row.id,
        textOf(row),
        args.org
      );
      ok += 1;
      console.log(`  OK  ${row.filename || row.id} → ${stored} chunków`);
    } catch (err: any) {
      failed += 1;
      console.log(`  BŁĄD ${row.filename || row.id}: ${err?.message || err}`);
    }
  }
  console.log(`\nZAKOŃCZONO: zaindeksowano ${ok}, błędów ${failed}.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
