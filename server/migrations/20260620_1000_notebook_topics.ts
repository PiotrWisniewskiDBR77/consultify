/**
 * M04 Living Notebook — Topics as a first-class, aggregating entity.
 *
 * Tables:
 *  - notebook_topics       — org-scoped topic (id, organization_id, name, slug, created_at)
 *  - notebook_page_topics  — join page↔topic (page_id, topic_id, score, source 'ai'|'manual')
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS).
 * Cross-dialect: works on Postgres and SQLite (no dialect-specific column types).
 *
 * Applied by the CTO/orchestrator alongside the other `.ts` migrations
 * (same contract as 627_notebook_fts_v4_note03.ts: `export async function up(db)`).
 */

import type { IDatabase } from '../src/database/IDatabase.js';

export async function up(db: IDatabase): Promise<void> {
  // notebook_topics — one row per (org, topic). `slug` is the stable, normalized
  // handle used for idempotent upserts so the same derived topic does not duplicate.
  await db.run(`
    CREATE TABLE IF NOT EXISTS notebook_topics (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // One topic per slug within an org.
  await db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_notebook_topics_org_slug
      ON notebook_topics(organization_id, slug)
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_notebook_topics_org
      ON notebook_topics(organization_id)
  `);

  // notebook_page_topics — pin between a page and a topic.
  //  - score:  0..1 relevance (heuristic or AI confidence)
  //  - source: 'ai' (auto-derived) | 'manual' (pinned by user)
  await db.run(`
    CREATE TABLE IF NOT EXISTS notebook_page_topics (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      score REAL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'ai',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // A page may be pinned to a topic at most once (re-derivation upserts).
  await db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_notebook_page_topics_pair
      ON notebook_page_topics(page_id, topic_id)
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_notebook_page_topics_topic
      ON notebook_page_topics(topic_id)
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_notebook_page_topics_page
      ON notebook_page_topics(page_id)
  `);
}
