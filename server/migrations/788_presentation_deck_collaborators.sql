-- Migration 788: Presentation Deck Collaborators (P3.3 — per-user deck access)
--
-- P3.1 shipped deck collaboration as (a) a public share-link and (b) an
-- optimistic 409 conflict banner. It intentionally deferred a real per-user
-- membership model — the ShareModal "Collaborate" tab (behind
-- VITE_ENABLE_DECK_COLLABORATE) only handed off a share-link + mailto.
--
-- This table is the deferred piece: it tracks WHICH users have access to WHICH
-- deck and their ROLE (owner / editor / viewer). Inviting a collaborator now
-- writes a real row here instead of only minting a share token.
--
-- Mirrors the shape of collab_sessions (migration 648) — TEXT org/user ids,
-- UUID PK, TIMESTAMPTZ audit columns — for consistency with the rest of the
-- collaboration surface.
--
-- Schema-tolerant by design: the routes + WS gateway that read/write this table
-- swallow missing-table / missing-column errors so the deck editor keeps
-- working in SOLO mode when this table is absent (fail-open — presence and
-- membership are additive, never a hard dependency of core editing).

CREATE TABLE IF NOT EXISTS presentation_deck_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  -- The invited identity. user_id is nullable so an invite by email can exist
  -- before the invitee has an account / accepts; it is backfilled on accept.
  invited_email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner', 'editor', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'revoked')),
  invited_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One membership row per (deck, user). Partial unique so multiple pending
-- email-only invites (user_id NULL) to the same deck don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS uq_deck_collab_deck_user
  ON presentation_deck_collaborators(deck_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deck_collab_deck
  ON presentation_deck_collaborators(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_collab_org_user
  ON presentation_deck_collaborators(organization_id, user_id);
