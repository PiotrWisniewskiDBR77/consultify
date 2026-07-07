-- Migration: durable structured columns for `decisions` (BCG decision anatomy)
--
-- Why: Teresa's create_decision flow AI-generates the full BCG decision structure
-- (MECE alternatives, a risk/impact matrix, consequences of inaction, an
-- answer-first recommendation, explicit assumptions), but the `decisions` table
-- had NO durable columns for any of it. The previous fix spilled everything into
-- a JSON blob in `description` + an ad-hoc `ai_generated_sections` sink that the
-- read API never returned. Result: `GET /api/decisions/:id` returned
-- `alternatives:null, riskImpact:null, consequences:null` and the BCG judge saw a
-- wall of text (structure invisible → un-scoreable → score ceiling ~54).
--
-- This gives the structure REAL columns so createDecision can persist them and the
-- controller (getDecisionById / getDecisions, both `SELECT d.*`) surfaces them as
-- camelCase fields the FE DecisionDetailView already consumes.
--
--   alternatives             JSONB  — [{title, description, pros[], cons[], estimatedCostTime, isRecommended?}]
--                                      (≥2 MECE options + always a "do nothing" option)
--   risk_impact              JSONB  — [{title, probability, impact, category, mitigation, contingency,
--                                       riskScore(1-5), impactScore(1-5)}]  (matrix, not prose)
--   consequences_of_inaction TEXT   — what happens over 7/30/90d if we do NOT decide (quantified)
--   recommendation           TEXT   — answer-first single recommendation (separate, surfaced field)
--   assumptions              JSONB  — [{assumption, confidence, whatWouldChangeIt}] — grounding /
--                                      falsifiability when data is missing
--
-- Idempotent: every ADD COLUMN uses IF NOT EXISTS. Fail-soft: adds only, no data
-- loss, safe to re-run. On Postgres JSONB is native; on the SQLite dev path these
-- are stored as TEXT and `parseMaybeJson` normalizes both on read.

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS alternatives JSONB;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS risk_impact JSONB;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS consequences_of_inaction TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS recommendation TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS assumptions JSONB;
