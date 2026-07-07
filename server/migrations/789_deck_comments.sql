-- M19 Presentations (Deck) — reviewer comments (full-stack, wzór Word Epic E6).
-- Deck had NO comment system (grep-confirmed: presentations.routes.ts zero comments).
-- Reference pattern: 776_document_studio_wave5_persistence.sql (document_comments) +
-- server/src/services/documentStudio/documentCommentsService.ts (Epic E6).
--
-- Anchor model for a deck: comments hang off the DECK (deck-level) or a single
-- SLIDE (slide_id). Word anchors to document/section/block; a deck's natural
-- granularity is the slide, so the anchor is {kind, slideId?}. Threading is the
-- same flat 2-level model as Word: root sets thread_id = comment_id; replies
-- inherit the root's thread_id + slide anchor. resolve/reopen are thread-wide.
--
-- Tenant safety: every read/write carries organization_id in the WHERE; the
-- deck existence check (presentation_decks.id + organization_id) happens in the
-- route layer, so a comment can never target a cross-tenant deck.

CREATE TABLE IF NOT EXISTS deck_comments (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  slide_id TEXT,                       -- NULL = deck-level; else the slide/card id
  parent_comment_id TEXT,
  anchor JSONB NOT NULL DEFAULT '{"kind":"deck"}',
  author TEXT NOT NULL,                -- author user id
  body TEXT NOT NULL DEFAULT '',
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_by TEXT,
  resolved_at TEXT,
  reopened_by TEXT,
  reopened_at TEXT,
  deleted_by TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_deck_comments_deck ON deck_comments(deck_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_deck_comments_org ON deck_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_deck_comments_thread ON deck_comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_deck_comments_slide ON deck_comments(deck_id, slide_id);
