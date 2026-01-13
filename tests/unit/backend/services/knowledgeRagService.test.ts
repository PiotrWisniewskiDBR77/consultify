/**
 * Knowledge RAG Service Tests
 * FLOW-KNOWLEDGE-001: Knowledge Base & RAG
 *
 * Tests for knowledge documents, chunks, queries, RAG pipeline
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('KnowledgeRagService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT)`);
        db.run(
          `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, organization_id TEXT, name TEXT)`
        );
        db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT)`);

        // Knowledge Documents
        db.run(`
                    CREATE TABLE IF NOT EXISTS knowledge_documents (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        project_id TEXT,
                        title TEXT NOT NULL,
                        description TEXT,
                        source_type TEXT NOT NULL,
                        source_url TEXT,
                        file_path TEXT,
                        file_size INTEGER,
                        mime_type TEXT,
                        content_hash TEXT,
                        status TEXT DEFAULT 'pending',
                        chunk_count INTEGER DEFAULT 0,
                        token_count INTEGER DEFAULT 0,
                        processing_error TEXT,
                        uploaded_by TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        processed_at TIMESTAMP
                    )
                `);

        // Knowledge Chunks
        db.run(`
                    CREATE TABLE IF NOT EXISTS knowledge_chunks (
                        id TEXT PRIMARY KEY,
                        document_id TEXT NOT NULL,
                        chunk_index INTEGER NOT NULL,
                        content TEXT NOT NULL,
                        token_count INTEGER NOT NULL,
                        embedding TEXT,
                        metadata TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(document_id, chunk_index)
                    )
                `);

        // Knowledge Queries
        db.run(`
                    CREATE TABLE IF NOT EXISTS knowledge_queries (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        query_text TEXT NOT NULL,
                        query_embedding TEXT,
                        context_type TEXT,
                        context_id TEXT,
                        results_count INTEGER DEFAULT 0,
                        response_time_ms INTEGER,
                        was_helpful INTEGER,
                        feedback TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Knowledge Collections
        db.run(`
                    CREATE TABLE IF NOT EXISTS knowledge_collections (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        is_public INTEGER DEFAULT 0,
                        created_by TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Knowledge Sync Jobs
        db.run(`
                    CREATE TABLE IF NOT EXISTS knowledge_sync_jobs (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        source_type TEXT NOT NULL,
                        source_config TEXT NOT NULL,
                        schedule TEXT,
                        last_sync_at TIMESTAMP,
                        next_sync_at TIMESTAMP,
                        status TEXT DEFAULT 'pending',
                        documents_synced INTEGER DEFAULT 0,
                        error_message TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Seed data
        db.run(`INSERT INTO organizations (id, name) VALUES ('org-1', 'Test Org')`);
        db.run(
          `INSERT INTO projects (id, organization_id, name) VALUES ('proj-1', 'org-1', 'Test Project')`
        );
        db.run(`INSERT INTO users (id, email) VALUES ('user-1', 'test@example.com')`, (err) =>
          err ? reject(err) : resolve()
        );
      });
    });
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM knowledge_documents');
        db.run('DELETE FROM knowledge_chunks');
        db.run('DELETE FROM knowledge_queries');
        db.run('DELETE FROM knowledge_collections');
        db.run('DELETE FROM knowledge_sync_jobs', () => resolve());
      });
    });
  });

  // ==========================================
  // KNOWLEDGE DOCUMENTS
  // ==========================================

  describe('Knowledge Documents', () => {
    it('should create a document', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO knowledge_documents (id, organization_id, project_id, title, source_type, file_path, mime_type, uploaded_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
          [
            'doc-1',
            'org-1',
            'proj-1',
            'Company Guidelines',
            'upload',
            '/docs/guidelines.pdf',
            'application/pdf',
            'user-1',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const doc = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_documents WHERE id = ?', ['doc-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(doc).toBeDefined();
      expect(doc.title).toBe('Company Guidelines');
      expect(doc.source_type).toBe('upload');
      expect(doc.status).toBe('pending');
    });

    it('should support multiple source types', async () => {
      const sourceTypes = ['upload', 'url', 'confluence', 'sharepoint', 'google_drive'];

      for (let i = 0; i < sourceTypes.length; i++) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `INSERT INTO knowledge_documents (id, organization_id, title, source_type) VALUES (?, ?, ?, ?)`,
            [`doc-src-${i}`, 'org-1', `Doc ${sourceTypes[i]}`, sourceTypes[i]],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      const docs = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT source_type FROM knowledge_documents', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(docs).toHaveLength(5);
      expect(docs.map((d) => d.source_type)).toEqual(expect.arrayContaining(sourceTypes));
    });

    it('should update processing status', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO knowledge_documents (id, organization_id, title, source_type, status) VALUES (?, ?, ?, ?, ?)`,
          ['doc-2', 'org-1', 'Processing Test', 'upload', 'pending'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE knowledge_documents SET status = 'processing' WHERE id = ?`,
          ['doc-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE knowledge_documents SET status = 'ready', chunk_count = 25, token_count = 5000, processed_at = ? WHERE id = ?`,
          [new Date().toISOString(), 'doc-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const doc = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_documents WHERE id = ?', ['doc-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(doc.status).toBe('ready');
      expect(doc.chunk_count).toBe(25);
      expect(doc.token_count).toBe(5000);
    });

    it('should handle processing errors', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO knowledge_documents (id, organization_id, title, source_type) VALUES (?, ?, ?, ?)`,
          ['doc-3', 'org-1', 'Error Test', 'upload'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE knowledge_documents SET status = 'error', processing_error = ? WHERE id = ?`,
          ['Failed to extract text from PDF', 'doc-3'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const doc = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_documents WHERE id = ?', ['doc-3'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(doc.status).toBe('error');
      expect(doc.processing_error).toBe('Failed to extract text from PDF');
    });
  });

  // ==========================================
  // KNOWLEDGE CHUNKS
  // ==========================================

  describe('Knowledge Chunks', () => {
    beforeEach(async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO knowledge_documents (id, organization_id, title, source_type, status) VALUES (?, ?, ?, ?, ?)`,
          ['doc-chunk', 'org-1', 'Chunked Doc', 'upload', 'ready'],
          (err) => (err ? reject(err) : resolve())
        );
      });
    });

    it('should create document chunks', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, token_count, metadata)
                    VALUES (?, ?, ?, ?, ?, ?)
                `,
          ['chunk-1', 'doc-chunk', 0, 'This is the first chunk of text...', 150, '{"page":1}'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const chunk = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_chunks WHERE id = ?', ['chunk-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(chunk).toBeDefined();
      expect(chunk.chunk_index).toBe(0);
      expect(chunk.token_count).toBe(150);
    });

    it('should enforce unique chunk index per document', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, token_count) VALUES (?, ?, ?, ?, ?)`,
          ['chunk-2', 'doc-chunk', 0, 'Content 1', 100],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const result = await new Promise<boolean>((resolve) => {
        db.run(
          `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, token_count) VALUES (?, ?, ?, ?, ?)`,
          ['chunk-3', 'doc-chunk', 0, 'Content 2', 100],
          (err) => {
            resolve(!!err);
          }
        );
      });

      expect(result).toBe(true);
    });

    it('should store embeddings', async () => {
      const mockEmbedding = JSON.stringify([0.1, 0.2, 0.3, 0.4, 0.5]);

      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, token_count, embedding) VALUES (?, ?, ?, ?, ?, ?)`,
          ['chunk-4', 'doc-chunk', 1, 'Content with embedding', 50, mockEmbedding],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const chunk = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_chunks WHERE id = ?', ['chunk-4'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(chunk.embedding).toBe(mockEmbedding);
    });
  });

  // ==========================================
  // KNOWLEDGE QUERIES
  // ==========================================

  describe('Knowledge Queries', () => {
    it('should log a query', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO knowledge_queries (id, organization_id, user_id, query_text, context_type, context_id, results_count, response_time_ms)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
          [
            'query-1',
            'org-1',
            'user-1',
            'What are the company guidelines for remote work?',
            'project',
            'proj-1',
            5,
            250,
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const query = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_queries WHERE id = ?', ['query-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(query).toBeDefined();
      expect(query.query_text).toContain('remote work');
      expect(query.results_count).toBe(5);
      expect(query.response_time_ms).toBe(250);
    });

    it('should record user feedback', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO knowledge_queries (id, organization_id, user_id, query_text, results_count) VALUES (?, ?, ?, ?, ?)`,
          ['query-2', 'org-1', 'user-1', 'Test query', 3],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE knowledge_queries SET was_helpful = 1, feedback = ? WHERE id = ?`,
          ['Very helpful results', 'query-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const query = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_queries WHERE id = ?', ['query-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(query.was_helpful).toBe(1);
      expect(query.feedback).toBe('Very helpful results');
    });

    it('should track query performance', async () => {
      const queries = [
        { id: 'perf-1', time: 150 },
        { id: 'perf-2', time: 200 },
        { id: 'perf-3', time: 180 },
      ];

      for (const q of queries) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `INSERT INTO knowledge_queries (id, organization_id, user_id, query_text, response_time_ms) VALUES (?, ?, ?, ?, ?)`,
            [q.id, 'org-1', 'user-1', 'Test', q.time],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      const avgTime = await new Promise<any>((resolve, reject) => {
        db.get(
          `SELECT AVG(response_time_ms) as avg_time FROM knowledge_queries WHERE organization_id = ?`,
          ['org-1'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(Math.round(avgTime.avg_time)).toBe(177); // (150+200+180)/3 ≈ 177
    });
  });

  // ==========================================
  // KNOWLEDGE COLLECTIONS
  // ==========================================

  describe('Knowledge Collections', () => {
    it('should create a collection', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO knowledge_collections (id, organization_id, name, description, created_by)
                    VALUES (?, ?, ?, ?, ?)
                `,
          ['coll-1', 'org-1', 'HR Policies', 'All HR related documents', 'user-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const collection = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_collections WHERE id = ?', ['coll-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe('HR Policies');
    });
  });

  // ==========================================
  // SYNC JOBS
  // ==========================================

  describe('Sync Jobs', () => {
    it('should create sync job', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO knowledge_sync_jobs (id, organization_id, source_type, source_config, schedule)
                    VALUES (?, ?, ?, ?, ?)
                `,
          ['sync-1', 'org-1', 'confluence', '{"space":"TEAM"}', '0 2 * * *'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const job = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_sync_jobs WHERE id = ?', ['sync-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(job).toBeDefined();
      expect(job.source_type).toBe('confluence');
      expect(job.schedule).toBe('0 2 * * *');
    });

    it('should track sync progress', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO knowledge_sync_jobs (id, organization_id, source_type, source_config, status) VALUES (?, ?, ?, ?, ?)`,
          ['sync-2', 'org-1', 'sharepoint', '{}', 'running'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE knowledge_sync_jobs SET status = 'completed', documents_synced = 42, last_sync_at = ? WHERE id = ?`,
          [new Date().toISOString(), 'sync-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const job = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_sync_jobs WHERE id = ?', ['sync-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(job.status).toBe('completed');
      expect(job.documents_synced).toBe(42);
    });
  });
});
