#!/usr/bin/env node
/**
 * recover-pending-kb.cjs
 *
 * Recovers globalne (organization_id IS NULL, scope='user') `knowledge_docs`
 * utknięte na embeddingu od 2026-03-19 (kolateral po padzie klucza OpenAI).
 * Dokumenty są JUŻ sczankowane (chunk_count>0, processing_error IS NULL) —
 * brakuje tylko `knowledge_chunks.embedding`.
 *
 * Format zapisu embeddingu = DOKŁADNIE jak istniejące chunki:
 *   knowledge_chunks.embedding (TEXT) = JSON.stringify(number[1536])
 * (zweryfikowane na żywej TROLLEY: sample chunk id 0098a51e-...,
 *  1536 wymiarów, JSON.parse OK, brak spacji między elementami).
 * Model: text-embedding-3-small (server/src/services/ai/embeddingService.ts),
 * wołany bezpośrednio przez OpenAI/OpenRouter API (bez importu serwisu, żeby
 * nie ciągnąć za sobą wewnętrznego poola DB na internal Railway URL).
 *
 * Idempotentne:
 *  - dotyka WYŁĄCZNIE knowledge_chunks.embedding IS NULL
 *  - rusza WYŁĄCZNIE knowledge_docs: status='pending' AND organization_id IS NULL
 *    AND scope='user' AND chunk_count>0 AND processing_error IS NULL
 *  - po zaembedowaniu WSZYSTKICH chunków danego doca -> status='indexed', indexed_at=now()
 *
 * Tryby:
 *   node recover-pending-kb.cjs canary   -> TYLKO 1 doc (LIMIT 1, ORDER BY id), weryfikacja, RAPORT, EXIT
 *   node recover-pending-kb.cjs run      -> WSZYSTKIE pozostałe pasujące docs
 *
 * Uruchomienie (wstrzykuje OPENAI_API_KEY + DATABASE_PUBLIC_URL):
 *   railway run --service consultify node server/scripts/recover-pending-kb.cjs canary
 */

const { Client } = require('pg');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_BATCH_SIZE = 20;
const BATCH_PAUSE_MS = 500;

function guardConnectionString(url) {
  if (!url) {
    throw new Error('DATABASE_PUBLIC_URL not set — abort.');
  }
  if (/centerbeam/i.test(url)) {
    throw new Error('ABORT: connection string references centerbeam (PROD). Refusing to run.');
  }
  if (!/trolley/i.test(url)) {
    throw new Error('ABORT: connection string does not reference trolley (expected staging/demo DB). Refusing to run.');
  }
}

async function generateEmbedding(text) {
  const routerKey = process.env.OPENROUTER_API_KEY;
  const embUrl = routerKey
    ? 'https://openrouter.ai/api/v1/embeddings'
    : 'https://api.openai.com/v1/embeddings';
  const embKey = routerKey || process.env.OPENAI_API_KEY;
  const embModel = routerKey ? `openai/${EMBEDDING_MODEL}` : EMBEDDING_MODEL;

  if (!embKey) {
    throw new Error('No OPENAI_API_KEY / OPENROUTER_API_KEY in environment.');
  }

  const res = await fetch(embUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${embKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: embModel, input: text.substring(0, 8000) }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Embedding API error: ${res.status} ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const embedding = data && data.data && data.data[0] && data.data[0].embedding;
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding shape: length=${embedding ? embedding.length : 'undefined'} (expected ${EMBEDDING_DIMENSIONS})`
    );
  }
  return embedding;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processDoc(client, doc) {
  const { rows: chunks } = await client.query(
    `SELECT id, content FROM knowledge_chunks WHERE doc_id = $1 AND embedding IS NULL ORDER BY chunk_index`,
    [doc.id]
  );

  let embedded = 0;
  let skippedEmpty = 0;

  for (let i = 0; i < chunks.length; i += CHUNK_BATCH_SIZE) {
    const batch = chunks.slice(i, i + CHUNK_BATCH_SIZE);
    for (const chunk of batch) {
      const text = (chunk.content || '').trim();
      if (!text) {
        skippedEmpty += 1;
        continue;
      }
      const vector = await generateEmbedding(text);
      // Bajt-w-bajt jak istniejące chunki: JSON.stringify(number[]) bez spacji.
      const stored = JSON.stringify(vector);
      await client.query(`UPDATE knowledge_chunks SET embedding = $1 WHERE id = $2`, [stored, chunk.id]);
      embedded += 1;
    }
    if (i + CHUNK_BATCH_SIZE < chunks.length) {
      await sleep(BATCH_PAUSE_MS);
    }
  }

  // Chunki z pustą treścią (jeśli jakieś istnieją) NIE blokują zamknięcia doca —
  // ale liczymy tylko realnie brakujące (niepuste, wciąż NULL) jako "remaining".
  const { rows: remainingRows } = await client.query(
    `SELECT count(*)::int AS n FROM knowledge_chunks
     WHERE doc_id = $1 AND embedding IS NULL AND content IS NOT NULL AND trim(content) <> ''`,
    [doc.id]
  );
  const remaining = remainingRows[0].n;

  if (remaining === 0) {
    await client.query(`UPDATE knowledge_docs SET status = 'indexed', indexed_at = now() WHERE id = $1`, [doc.id]);
  }

  return {
    docId: doc.id,
    filename: doc.filename,
    chunksTargeted: chunks.length,
    chunksEmbedded: embedded,
    chunksSkippedEmpty: skippedEmpty,
    remainingNullNonEmpty: remaining,
    markedIndexed: remaining === 0,
  };
}

async function main() {
  const mode = process.argv[2];
  if (mode !== 'canary' && mode !== 'run') {
    console.error('Usage: node recover-pending-kb.cjs <canary|run>');
    process.exit(1);
  }

  const url = process.env.DATABASE_PUBLIC_URL;
  guardConnectionString(url);
  console.log('[guard] OK — trolley confirmed in connection string, centerbeam absent.');

  const client = new Client({ connectionString: url, ssl: false });
  await client.connect();

  try {
    const baseQuery = `
      SELECT id, filename, chunk_count FROM knowledge_docs
      WHERE status = 'pending' AND organization_id IS NULL AND scope = 'user'
        AND chunk_count > 0 AND processing_error IS NULL
      ORDER BY id
    `;
    const { rows: candidateDocs } = await client.query(
      mode === 'canary' ? `${baseQuery} LIMIT 1` : baseQuery
    );

    console.log(`[scope] mode=${mode} matched docs=${candidateDocs.length}`);

    const results = [];
    for (const doc of candidateDocs) {
      console.log(`[doc] processing ${doc.id} (${doc.filename}) chunk_count=${doc.chunk_count}`);
      const r = await processDoc(client, doc);
      console.log(`[doc] result ${JSON.stringify(r)}`);
      results.push(r);
    }

    if (mode === 'canary') {
      const docId = candidateDocs[0] && candidateDocs[0].id;
      if (!docId) {
        console.log('[canary] No pending doc matched criteria — nothing to verify.');
        return;
      }

      const { rows: docAfter } = await client.query(
        `SELECT id, status, indexed_at FROM knowledge_docs WHERE id = $1`,
        [docId]
      );
      const { rows: chunkStats } = await client.query(
        `SELECT count(*)::int AS total, count(embedding)::int AS with_embedding
         FROM knowledge_chunks WHERE doc_id = $1`,
        [docId]
      );
      const { rows: sampleEmb } = await client.query(
        `SELECT embedding FROM knowledge_chunks WHERE doc_id = $1 AND embedding IS NOT NULL ORDER BY chunk_index LIMIT 1`,
        [docId]
      );

      let dims = null;
      let formatOk = false;
      if (sampleEmb[0]) {
        try {
          const parsed = JSON.parse(sampleEmb[0].embedding);
          dims = parsed.length;
          formatOk = Array.isArray(parsed) && typeof parsed[0] === 'number';
        } catch (e) {
          formatOk = false;
        }
      }

      const { rows: pendingAfter } = await client.query(
        `SELECT count(*)::int AS n FROM knowledge_docs
         WHERE status = 'pending' AND organization_id IS NULL AND scope = 'user'
           AND chunk_count > 0 AND processing_error IS NULL`
      );

      console.log('\n=== CANARY REPORT ===');
      console.log(
        JSON.stringify(
          {
            docId,
            statusAfter: docAfter[0] && docAfter[0].status,
            indexedAtAfter: docAfter[0] && docAfter[0].indexed_at,
            chunksTotal: chunkStats[0] && chunkStats[0].total,
            chunksWithEmbedding: chunkStats[0] && chunkStats[0].with_embedding,
            embeddingDims: dims,
            embeddingFormatLooksJsonArray: formatOk,
            remainingPendingMatchingCriteria: pendingAfter[0] && pendingAfter[0].n,
          },
          null,
          2
        )
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
