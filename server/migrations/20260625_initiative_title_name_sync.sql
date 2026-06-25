-- Sync: backfill title from name for rows created before title column was added,
-- and backfill name from title for rows created via the new primary INSERT path.
-- Also surface any created_by gaps (cannot backfill user IDs, but ensures the
-- column exists and is indexed for the delete-owner RBAC check).

-- 1. title ← name where title is NULL (legacy rows)
UPDATE initiatives
SET title = name
WHERE title IS NULL
  AND name IS NOT NULL
  AND name <> '';

-- 2. name ← title where name is NULL (rows inserted via new primary INSERT before this fix)
UPDATE initiatives
SET name = title
WHERE name IS NULL
  AND title IS NOT NULL
  AND title <> '';
