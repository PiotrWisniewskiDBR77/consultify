-- Extend the canonical Initiative lifecycle gate owner for the governed
-- PROMOTED -> PLANNING transition.  This migration changes only the domain
-- CHECK; existing immutable decisions and their ordering remain untouched.

DO $$
DECLARE
  v_rel oid := to_regclass('initiative_lifecycle_gate_decisions');
  v_domain_attnum smallint;
  v_domain_type text;
  v_domain_not_null boolean;
  v_constraint_name text;
  v_constraint_count integer;
  v_definition text;
  v_old_definition constant text :=
    'checkpmo_domain=anyarray[schedule_milestones,governance_decision_making,closure]';
  v_new_definition constant text :=
    'checkpmo_domain=anyarray[schedule_milestones,resource_responsibility,governance_decision_making,closure]';
  v_trigger_enabled "char";
BEGIN
  IF v_rel IS NULL THEN
    RAISE EXCEPTION 'INITIATIVE_RESOURCE_GATE_DOMAIN_PREFLIGHT: initiative_lifecycle_gate_decisions is missing';
  END IF;

  SELECT a.attnum, format_type(a.atttypid, a.atttypmod), a.attnotnull
    INTO v_domain_attnum, v_domain_type, v_domain_not_null
    FROM pg_attribute a
   WHERE a.attrelid = v_rel AND a.attname = 'pmo_domain' AND NOT a.attisdropped;
  IF v_domain_attnum IS NULL OR v_domain_type <> 'text' OR NOT v_domain_not_null THEN
    RAISE EXCEPTION
      'INITIATIVE_RESOURCE_GATE_DOMAIN_PREFLIGHT: pmo_domain must be TEXT NOT NULL (found type %, not-null %)',
      coalesce(v_domain_type, '<missing>'), coalesce(v_domain_not_null::text, '<missing>');
  END IF;

  SELECT count(*), min(c.conname),
         min(lower(regexp_replace(regexp_replace(pg_get_constraintdef(c.oid), '::text', '', 'g'), '[[:space:]()'']', '', 'g')))
    INTO v_constraint_count, v_constraint_name, v_definition
    FROM pg_constraint c
   WHERE c.conrelid = v_rel
     AND c.contype = 'c'
     AND c.conkey = ARRAY[v_domain_attnum]::smallint[];
  IF v_constraint_count <> 1 OR v_definition NOT IN (v_old_definition, v_new_definition) THEN
    RAISE EXCEPTION
      'INITIATIVE_RESOURCE_GATE_DOMAIN_PREFLIGHT: pmo_domain CHECK must be exact old or target whitelist (count %, definition %)',
      v_constraint_count, coalesce(v_definition, '<missing>');
  END IF;

  SELECT t.tgenabled
    INTO v_trigger_enabled
    FROM pg_trigger t
   WHERE t.tgrelid = v_rel
     AND t.tgname = 'initiative_lifecycle_gate_decisions_immutable'
     AND NOT t.tgisinternal;
  IF v_trigger_enabled IS DISTINCT FROM 'O'::"char" THEN
    RAISE EXCEPTION
      'INITIATIVE_RESOURCE_GATE_DOMAIN_PREFLIGHT: immutable trigger missing or not enabled (state %)',
      coalesce(v_trigger_enabled::text, '<missing>');
  END IF;

  -- Repeat-safe: the exact target definition needs no DDL.
  IF v_definition = v_new_definition THEN
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', v_rel::regclass, v_constraint_name);
  EXECUTE format(
    'ALTER TABLE %s ADD CONSTRAINT %I CHECK (pmo_domain IN (%L,%L,%L,%L))',
    v_rel::regclass,
    v_constraint_name,
    'SCHEDULE_MILESTONES',
    'RESOURCE_RESPONSIBILITY',
    'GOVERNANCE_DECISION_MAKING',
    'CLOSURE'
  );
END $$;

-- Postcondition is deliberately separate and exact.  A transactional migration
-- runner rolls the preceding DDL back if this validation fails.
DO $$
DECLARE
  v_rel oid := to_regclass('initiative_lifecycle_gate_decisions');
  v_definition text;
BEGIN
  SELECT lower(regexp_replace(regexp_replace(pg_get_constraintdef(c.oid), '::text', '', 'g'), '[[:space:]()'']', '', 'g'))
    INTO v_definition
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
   WHERE c.conrelid = v_rel AND c.contype = 'c' AND a.attname = 'pmo_domain';
  IF v_definition IS DISTINCT FROM
     'checkpmo_domain=anyarray[schedule_milestones,resource_responsibility,governance_decision_making,closure]' THEN
    RAISE EXCEPTION
      'INITIATIVE_RESOURCE_GATE_DOMAIN_POSTCONDITION: unexpected pmo_domain CHECK %',
      coalesce(v_definition, '<missing>');
  END IF;
END $$;
