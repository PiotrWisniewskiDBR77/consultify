-- 20260603 — My Work — Process Flow dedicated V8 CRUD tables
--
-- The Process Flow tool (IdeaProcessFlowTool) persists its structural graph
-- (nodes + edges with BPMN-ish semantics) through the V8 process-flow service
-- (server/src/services/v8/processFlowService.ts). That service references
-- `v8.v8_process_flow_nodes` / `v8.v8_process_flow_edges` but no migration ever
-- created them, so it silently ran in TABLE_MISSING degraded mode and every
-- save collapsed into the shared my_idea_maps JSON blob (losing semantics).
--
-- This migration creates the schema + tables so tableExists('v8_process_flow_nodes')
-- resolves truthy and the real CRUD path engages.
--
-- Postgres-native. The SQLite dev migration runner strips the `v8.` schema
-- prefix handling via its dialect translation; on Postgres the schema is real.
-- Additive + idempotent (IF NOT EXISTS throughout).

CREATE SCHEMA IF NOT EXISTS v8;

-- ============================================================
-- NODES
-- ============================================================

CREATE TABLE IF NOT EXISTS v8.v8_process_flow_nodes (
  id                    TEXT PRIMARY KEY,
  process_id            TEXT NOT NULL,
  organization_id       TEXT NOT NULL,
  object_type           TEXT NOT NULL,
  label                 TEXT NOT NULL,
  lane_id               TEXT,
  pool_id               TEXT,
  parent_subprocess_id  TEXT,
  position_x            REAL NOT NULL DEFAULT 0,
  position_y            REAL NOT NULL DEFAULT 0,
  gateway_kind          TEXT,
  metadata              JSONB,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pf_nodes_process ON v8.v8_process_flow_nodes(process_id);
CREATE INDEX IF NOT EXISTS idx_pf_nodes_org ON v8.v8_process_flow_nodes(organization_id);

-- ============================================================
-- EDGES
-- ============================================================

CREATE TABLE IF NOT EXISTS v8.v8_process_flow_edges (
  id                TEXT PRIMARY KEY,
  process_id        TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  edge_type         TEXT NOT NULL DEFAULT 'sequence_flow',
  source_node_id    TEXT NOT NULL,
  target_node_id    TEXT NOT NULL,
  label             TEXT,
  metadata          JSONB,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pf_edges_process ON v8.v8_process_flow_edges(process_id);
CREATE INDEX IF NOT EXISTS idx_pf_edges_org ON v8.v8_process_flow_edges(organization_id);
CREATE INDEX IF NOT EXISTS idx_pf_edges_source ON v8.v8_process_flow_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_pf_edges_target ON v8.v8_process_flow_edges(target_node_id);
