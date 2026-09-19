-- Rollback for A12 / K-23 DRD method-pack content registration.
-- Remove only the immutable pack rows inserted by the matching migration.

DELETE FROM method_packs
WHERE pack_id = 'drd'
  AND version = '2.0.0-methodpack.2'
  AND id LIKE 'mp-drd-k23-%';
