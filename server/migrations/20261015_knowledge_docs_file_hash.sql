-- ORG-BVP-001: bind governed organization-context snapshots to the exact
-- bytes of newly uploaded context documents. Historical rows remain NULL:
-- a filename/path is not evidence of content and must never be hashed as a
-- substitute for unavailable bytes.

DO $$
DECLARE
  actual_type TEXT;
  actual_check TEXT;
  malformed_count BIGINT;
BEGIN
  SELECT data_type INTO actual_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'knowledge_docs'
     AND column_name = 'file_hash';

  IF actual_type IS NOT NULL AND actual_type <> 'text' THEN
    RAISE EXCEPTION 'knowledge_docs.file_hash must be text, found %', actual_type;
  END IF;

  SELECT lower(regexp_replace(pg_get_constraintdef(c.oid), '[[:space:]()]', '', 'g'))
    INTO actual_check
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public'
     AND t.relname = 'knowledge_docs'
     AND c.conname = 'ck_knowledge_docs_file_hash_sha256';

  IF actual_check IS NOT NULL
     AND actual_check <> 'checkfile_hashisnullorfile_hash~''^[0-9a-f]{64}$''::text' THEN
    RAISE EXCEPTION 'ck_knowledge_docs_file_hash_sha256 has incompatible definition: %', actual_check;
  END IF;

  IF actual_type = 'text' THEN
    SELECT count(*) INTO malformed_count
      FROM public.knowledge_docs
     WHERE file_hash IS NOT NULL
       AND file_hash !~ '^[0-9a-f]{64}$';
    IF malformed_count > 0 THEN
      RAISE EXCEPTION 'knowledge_docs.file_hash contains % malformed historical value(s)', malformed_count;
    END IF;
  END IF;
END $$;

ALTER TABLE public.knowledge_docs
  ADD COLUMN IF NOT EXISTS file_hash TEXT;

ALTER TABLE public.knowledge_docs
  DROP CONSTRAINT IF EXISTS ck_knowledge_docs_file_hash_sha256;

ALTER TABLE public.knowledge_docs
  ADD CONSTRAINT ck_knowledge_docs_file_hash_sha256
  CHECK (file_hash IS NULL OR file_hash ~ '^[0-9a-f]{64}$') NOT VALID;

ALTER TABLE public.knowledge_docs
  VALIDATE CONSTRAINT ck_knowledge_docs_file_hash_sha256;
