-- RN-G1 Platform Foundation — management-chain closure table.
--
-- Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §B.2.
-- Materialized ancestor/descendant closure over the manager relationship,
-- maintained by the SERVICE LAYER (not a DB trigger — decision #1,
-- EXECUTION_LEDGER.md §7) in the SAME transaction as
-- `UPDATE user_profile_extended SET manager_id=...`. On a manager change the
-- service recomputes closure rows for the affected subtree only, never the
-- whole organization, and MUST enforce cycle protection (hard step bound =
-- org size, reject a write that never reaches the root as a typed error)
-- BEFORE writing any closure row.
--
-- No trigger, no maintenance logic here — this migration is schema only.

CREATE TABLE IF NOT EXISTS rvn_platform_management_chain_closure (
  organization_id    TEXT NOT NULL,
  ancestor_user_id    TEXT NOT NULL,
  descendant_user_id   TEXT NOT NULL,
  depth           INT NOT NULL,
  PRIMARY KEY (organization_id, ancestor_user_id, descendant_user_id)
);
CREATE INDEX IF NOT EXISTS idx_rvn_mgmt_descendant ON rvn_platform_management_chain_closure(organization_id, descendant_user_id);
CREATE INDEX IF NOT EXISTS idx_rvn_mgmt_ancestor ON rvn_platform_management_chain_closure(organization_id, ancestor_user_id);
