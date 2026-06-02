-- Promote the 3 thematic Consultify KB collections from children to root-level
-- so they appear as separate lane cards on the public Knowledge Base homepage.
UPDATE kb_collections
SET parent_collection_id = NULL
WHERE slug IN (
  'consultify-why-transformations-fail',
  'consultify-the-money-question',
  'consultify-decisions-that-ship'
);

-- Deactivate the umbrella root collection so only the 3 lanes are visible
UPDATE kb_collections
SET status = 'inactive'
WHERE slug = 'consultify-knowledge-base';
