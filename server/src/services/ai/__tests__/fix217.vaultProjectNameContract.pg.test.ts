/**
 * FIX-217 — moduł 17 domknięcie, `docs/program/funkcje/ODBIOR_217.md`.
 *
 * Dyżur 217 dowiódł na żywym modelu, że `search_knowledge_base` jest wołane
 * autonomicznie, ale model podał `vault_project_id: "Day217 R3 project"` —
 * NAZWĘ projektu zamiast identyfikatora (UUID). `executeKBSearch` zachował
 * się wtedy poprawnie fail-closed (pusty wynik), ale to zostawiało model bez
 * realnej odpowiedzi mimo trafnego pytania. DROGA B (ODBIOR_217.md): gdy
 * `vault_project_id` nie jest UUID-em, rozpoznaj go jako NAZWĘ projektu
 * WYŁĄCZNIE w obrębie organizacji wołającego, fail-closed przy zero lub
 * więcej niż jednym trafieniu.
 *
 * Ten plik dowodzi przez REALNĄ ścieżkę produkcyjną —
 * `executeToolCall('search_knowledge_base', ...)` → `executeKBSearch` →
 * (nowe: rozpoznanie nazwy projektu) → `KnowledgeService.getDocuments` →
 * `ragService.hybridSearch` (gałąź BM25, bez potrzeby atrapy embeddingów —
 * ten sam wzór co `day210.realchain.proof.pg.test.ts`) — NIE wewnętrzne
 * jednostki.
 *
 * BRAMKA 1 (test omijający + mutacja): "gdy sięgasz po projekt", scenariusz
 * `crossOrgSameName` dowodzi że TA SAMA nazwa projektu w INNEJ organizacji
 * nie przecieka. Mutacja usuwająca `organization_id = ?` z zapytania
 * rozpoznającego nazwę w `toolDefinitions.ts` MUSI dać czerwień na tym
 * teście — zmierzone ręcznie, patrz raport dyżuru (nie jest to zakodowane w
 * tym pliku jako osobny test, bo mutacja edytuje produkcyjne źródło).
 *
 * BRAMKA 2 (para dowodowa, zasada z 31.08 "zamknięte przez wygaszenie"):
 * każdy scenariusz cross-org ma bliźniaczy test "właściciel widzi swoje" —
 * sam negatyw (obcy nie widzi) byłby też spełniony, gdyby cała funkcja była
 * martwa.
 */
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import KnowledgeService from '../../KnowledgeService.js';
import { executeToolCall } from '../toolDefinitions.js';

describe('FIX-217: search_knowledge_base vault_project_id name-resolution contract on real PostgreSQL', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const orgA = 'fix217-org-a';
  const orgB = 'fix217-org-b';
  const userA = 'fix217-user-a';
  const userB = 'fix217-user-b';

  // Ta sama nazwa w DWÓCH różnych organizacjach — to jest dokładnie sytuacja,
  // w której granica organizacyjna (nie granica nazwy) musi rozstrzygać.
  const sharedProjectName = 'Day217 R3 project';
  const projectAId = uuidv4();
  const projectBId = uuidv4();

  const docAId = 'fix217-doc-a';
  const docBId = 'fix217-doc-b';
  const markerA = `FIX217-ORGA-${uuidv4().replace(/-/g, '')}`;
  const markerB = `FIX217-ORGB-${uuidv4().replace(/-/g, '')}`;

  // Ambiguity fixture: DWA projekty w tej samej organizacji, ta sama nazwa —
  // fail-closed musi wygrać z "zgadnij pierwszy z brzegu".
  const ambiguousName = 'Ambiguous FIX217 Project';
  const projectC1Id = uuidv4();
  const projectC2Id = uuidv4();
  const docC1Id = 'fix217-doc-c1';
  const docC2Id = 'fix217-doc-c2';
  const markerC1 = `FIX217-AMBIG1-${uuidv4().replace(/-/g, '')}`;
  const markerC2 = `FIX217-AMBIG2-${uuidv4().replace(/-/g, '')}`;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');

    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT (id) DO NOTHING`,
      [orgA, 'FIX217 Org A', orgB, 'FIX217 Org B']
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email) VALUES
         ($1, $3, 'fix217-a@example.invalid'),
         ($2, $4, 'fix217-b@example.invalid')
       ON CONFLICT (id) DO NOTHING`,
      [userA, userB, orgA, orgB]
    );
    await pool.query(
      `INSERT INTO projects (id, organization_id, name, status) VALUES
         ($1, $3, $5, 'active'),
         ($2, $4, $5, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [projectAId, projectBId, orgA, orgB, sharedProjectName]
    );
    await pool.query(
      `INSERT INTO projects (id, organization_id, name, status) VALUES
         ($1, $3, $4, 'active'),
         ($2, $3, $4, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [projectC1Id, projectC2Id, orgA, ambiguousName]
    );

    await KnowledgeService.addDocument(
      'fix217-a.txt',
      '/fix217/a.txt',
      orgA,
      projectAId,
      markerA.length,
      'test',
      [],
      docAId,
      userA,
      'project'
    );
    await KnowledgeService.processDocument(docAId, markerA, orgA);

    await KnowledgeService.addDocument(
      'fix217-b.txt',
      '/fix217/b.txt',
      orgB,
      projectBId,
      markerB.length,
      'test',
      [],
      docBId,
      userB,
      'project'
    );
    await KnowledgeService.processDocument(docBId, markerB, orgB);

    await KnowledgeService.addDocument(
      'fix217-c1.txt',
      '/fix217/c1.txt',
      orgA,
      projectC1Id,
      markerC1.length,
      'test',
      [],
      docC1Id,
      userA,
      'project'
    );
    await KnowledgeService.processDocument(docC1Id, markerC1, orgA);

    await KnowledgeService.addDocument(
      'fix217-c2.txt',
      '/fix217/c2.txt',
      orgA,
      projectC2Id,
      markerC2.length,
      'test',
      [],
      docC2Id,
      userA,
      'project'
    );
    await KnowledgeService.processDocument(docC2Id, markerC2, orgA);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM knowledge_chunks WHERE doc_id = ANY($1::text[])`, [
      [docAId, docBId, docC1Id, docC2Id],
    ]);
    await pool.query(`DELETE FROM knowledge_docs WHERE id = ANY($1::text[])`, [
      [docAId, docBId, docC1Id, docC2Id],
    ]);
    await pool.query(`DELETE FROM projects WHERE id = ANY($1::text[])`, [
      [projectAId, projectBId, projectC1Id, projectC2Id],
    ]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[userA, userB]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[orgA, orgB]]);
    await pool.end();
  });

  // ---------------------------------------------------------------------
  // BRAMKA 4 (dowód z atrapą modelu): dokładnie ten kształt argumentu, jaki
  // podał żywy model w dyżurze 217 — `vault_project_id` = NAZWA, nie UUID.
  // ---------------------------------------------------------------------
  it('resolves vault_project_id given as a NAME (not a UUID) to the caller org project and returns real content', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: markerA, vault_scope: 'project', vault_project_id: sharedProjectName },
      { userId: userA, organizationId: orgA }
    );
    const parsed = JSON.parse(raw);
    const joined = JSON.stringify(parsed.results || []);
    expect(joined, `raw tool output: ${raw}`).toContain(markerA);
  });

  // ---------------------------------------------------------------------
  // BRAMKA 1 + 2 — test omijający cross-org, w obie strony (para dowodowa).
  // ---------------------------------------------------------------------
  it('owner in org A sees org A project doc when resolving the SHARED name', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'FIX217 shared-name probe', vault_scope: 'project', vault_project_id: sharedProjectName },
      { userId: userA, organizationId: orgA }
    );
    const parsed = JSON.parse(raw);
    const joined = JSON.stringify(parsed.results || []);
    expect(joined, `raw tool output: ${raw}`).toContain(markerA);
    expect(joined, `raw tool output: ${raw}`).not.toContain(markerB);
  });

  it('owner in org B sees org B project doc when resolving the SAME SHARED name — proves it is not one-sided', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'FIX217 shared-name probe', vault_scope: 'project', vault_project_id: sharedProjectName },
      { userId: userB, organizationId: orgB }
    );
    const parsed = JSON.parse(raw);
    const joined = JSON.stringify(parsed.results || []);
    expect(joined, `raw tool output: ${raw}`).toContain(markerB);
    expect(joined, `raw tool output: ${raw}`).not.toContain(markerA);
  });

  it('caller in org A does NOT get org B project documents through the shared name (cross-tenant boundary)', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: markerB, vault_scope: 'project', vault_project_id: sharedProjectName },
      { userId: userA, organizationId: orgA }
    );
    const parsed = JSON.parse(raw);
    const joined = JSON.stringify(parsed.results || []);
    expect(joined, `raw tool output: ${raw}`).not.toContain(markerB);
  });

  // ---------------------------------------------------------------------
  // Fail-closed przy niejednoznacznej nazwie (dwa projekty, ta sama nazwa,
  // ta sama organizacja) — nie zgadujemy, nie zwracamy żadnego z nich.
  // ---------------------------------------------------------------------
  it('fails closed (no results) when the name matches more than one project in the same organization', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: 'ambiguous probe', vault_scope: 'project', vault_project_id: ambiguousName },
      { userId: userA, organizationId: orgA }
    );
    const parsed = JSON.parse(raw);
    const joined = JSON.stringify(parsed.results || []);
    expect(joined, `raw tool output: ${raw}`).not.toContain(markerC1);
    expect(joined, `raw tool output: ${raw}`).not.toContain(markerC2);
  });

  // ---------------------------------------------------------------------
  // Kontrola: prawdziwy UUID nadal działa tak jak przed FIX-217 (regresja
  // ścieżki, którą UI zawsze i tak wysyła — AgentPlanCanvas.tsx).
  // ---------------------------------------------------------------------
  it('still resolves a real UUID vault_project_id exactly as before (no regression on the UI path)', async () => {
    const raw = await executeToolCall(
      'search_knowledge_base',
      { query: markerA, vault_scope: 'project', vault_project_id: projectAId },
      { userId: userA, organizationId: orgA }
    );
    const parsed = JSON.parse(raw);
    const joined = JSON.stringify(parsed.results || []);
    expect(joined, `raw tool output: ${raw}`).toContain(markerA);
  });
});
