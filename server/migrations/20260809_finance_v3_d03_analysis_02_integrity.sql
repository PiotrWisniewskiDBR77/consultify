-- Finance v3 — Gate D (WP-D03b): Historical Analysis domain schema, part 2/4 — integrity controls.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D03_analysis_schema_ADR.md sections 5.2,
-- 6.1-6.3 (formula AST unit-resolution rules), 4.2/10 (maker-checker), 4.3/10 (kpi_values content
-- freeze), 4 point 5 / 10 (variance hybrid immutability). Runs after ..._01_tables.sql (these
-- functions/triggers reference tables created there) and before ..._03_kpi_p0_catalog.sql (the 18 P0 KPI
-- INSERTs exercise this file's compile trigger and formula_ref lookups) and ..._04_readiness.sql.
--
-- Same "cross-row lookup -> trigger, not CHECK" discipline WP-D01 already established
-- (WP-D01b_statements_migration_report.md section on constraint triggers): the formula compiler
-- below needs to SELECT other finance_analysis_kpi_catalog rows for formula_ref operands, which a
-- plain CHECK constraint cannot do (Postgres CHECK does not allow subqueries).
--
-- Unlike WP-D01's four balance/roll-forward checks, the formula compiler here does NOT need to be a
-- DEFERRABLE CONSTRAINT TRIGGER: it validates a single row's own formula_ast against catalog rows
-- that must already exist as ACTIVE/COMPILED_OK (dependency order enforced by insert order, exactly
-- like CASH_CONVERSION_CYCLE requiring DSO/DIO/DPO to already be ACTIVE — file 03), not a
-- whole-batch consistency check across rows written in the same transaction.

BEGIN;

-- ============================================================================
-- Layer 1 unit resolution (ADR section 6.1-6.2): structural/currency-agnostic. Recursively walks
-- the formula AST and returns one UnitType, or RAISE EXCEPTION with a literal
-- 'UNIT_MISMATCH_STRUCTURAL: ...' message (ADR section 10 test table quotes this exact prefix and
-- the exact "add MONETARY RATIO" shape for the BAD_FORMULA regression test).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_analysis_kpi_resolve_unit(p_node JSONB) RETURNS TEXT AS $$
DECLARE
  v_node_type TEXT;
  v_kind      TEXT;
  v_op        TEXT;
  v_left      TEXT;
  v_right     TEXT;
  v_ref_unit  TEXT;
  v_ref_status TEXT;
BEGIN
  IF p_node IS NULL THEN
    RAISE EXCEPTION 'UNIT_MISMATCH_STRUCTURAL: null formula node';
  END IF;

  v_node_type := p_node ->> 'node';

  IF v_node_type = 'operand' THEN
    v_kind := p_node ->> 'kind';

    IF v_kind = 'cell_ref' THEN
      -- P0 does not model non-monetary canonical lines (headcount/days-as-a-line are forward
      -- references, ADR section 6.2) -- every cell_ref resolves to MONETARY.
      RETURN 'MONETARY';

    ELSIF v_kind = 'literal' THEN
      IF p_node ? 'valueRef' THEN
        RETURN CASE p_node ->> 'valueRef'
          WHEN 'DAYS_IN_PERIOD' THEN 'DAYS'
          WHEN 'ANNUALIZATION_FACTOR' THEN 'DIMENSIONLESS'
          ELSE NULL -- caught by the outer NULL-return check in the caller (compile trigger) as an error
        END;
      ELSIF p_node ? 'unitType' THEN
        RETURN p_node ->> 'unitType';
      ELSE
        RETURN 'DIMENSIONLESS';
      END IF;

    ELSIF v_kind = 'formula_ref' THEN
      SELECT resolved_output_unit, compile_status INTO v_ref_unit, v_ref_status
        FROM finance_analysis_kpi_catalog
        WHERE kpi_code = (p_node ->> 'kpiCode') AND status = 'ACTIVE'
        ORDER BY catalog_version DESC LIMIT 1;
      IF v_ref_unit IS NULL OR v_ref_status IS DISTINCT FROM 'COMPILED_OK' THEN
        RAISE EXCEPTION 'UNIT_MISMATCH_STRUCTURAL: formula_ref % does not resolve to an ACTIVE COMPILED_OK catalog entry',
          p_node ->> 'kpiCode';
      END IF;
      RETURN v_ref_unit;

    ELSE
      RAISE EXCEPTION 'UNIT_MISMATCH_STRUCTURAL: unknown operand kind %', v_kind;
    END IF;

  ELSIF v_node_type = 'operator' THEN
    v_op := p_node ->> 'op';
    v_left := finance_analysis_kpi_resolve_unit(p_node -> 'left');
    v_right := finance_analysis_kpi_resolve_unit(p_node -> 'right');

    IF v_op IN ('add', 'subtract') THEN
      IF v_left = v_right THEN
        RETURN v_left;
      ELSE
        RAISE EXCEPTION 'UNIT_MISMATCH_STRUCTURAL: % % %', v_op, v_left, v_right;
      END IF;

    ELSIF v_op = 'multiply' THEN
      IF v_left = 'DIMENSIONLESS' THEN RETURN v_right;
      ELSIF v_right = 'DIMENSIONLESS' THEN RETURN v_left;
      ELSIF v_left = 'MONETARY' AND v_right IN ('RATIO', 'PERCENT', 'MULTIPLE', 'COUNT') THEN RETURN 'MONETARY';
      ELSIF v_right = 'MONETARY' AND v_left IN ('RATIO', 'PERCENT', 'MULTIPLE', 'COUNT') THEN RETURN 'MONETARY';
      ELSIF v_left = 'RATIO' AND v_right = 'RATIO' THEN RETURN 'RATIO';
      ELSE
        RAISE EXCEPTION 'UNIT_MISMATCH_STRUCTURAL: multiply % %', v_left, v_right;
      END IF;

    ELSIF v_op = 'divide' THEN
      IF v_left = 'MONETARY' AND v_right = 'MONETARY' THEN RETURN 'RATIO';
      ELSIF v_left = 'MONETARY' AND v_right = 'DAYS' THEN RETURN 'MONETARY_PER_DAY';
      ELSIF v_left = 'MONETARY' AND v_right = 'MONETARY_PER_DAY' THEN RETURN 'DAYS';
      ELSIF v_left = 'MONETARY' AND v_right = 'COUNT' THEN RETURN 'MONETARY';
      ELSIF v_left = 'DAYS' AND v_right = 'DAYS' THEN RETURN 'RATIO';
      ELSIF v_left = 'COUNT' AND v_right = 'COUNT' THEN RETURN 'RATIO';
      ELSIF v_right = 'DIMENSIONLESS' THEN RETURN v_left;
      ELSE
        RAISE EXCEPTION 'UNIT_MISMATCH_STRUCTURAL: divide % %', v_left, v_right;
      END IF;

    ELSIF v_op = 'ratio' THEN
      -- Reserved exclusively for the canonical "money / money of the same nature -> financial
      -- ratio" case (ADR section 5.2) -- every other combination is an error, even ones divide()
      -- would happily accept.
      IF v_left = 'MONETARY' AND v_right = 'MONETARY' THEN
        RETURN 'RATIO';
      ELSE
        RAISE EXCEPTION 'UNIT_MISMATCH_STRUCTURAL: ratio % %', v_left, v_right;
      END IF;

    ELSE
      RAISE EXCEPTION 'UNIT_MISMATCH_STRUCTURAL: unknown operator %', v_op;
    END IF;

  ELSE
    RAISE EXCEPTION 'UNIT_MISMATCH_STRUCTURAL: unknown node type %', v_node_type;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- finance_analysis_kpi_catalog write gate: maker-checker (ORG_CUSTOM activation) + formula compile
-- (Layer 1 unit resolution + cross-check against the author-declared unit_type).
--
-- Behavior (ADR section 10 test table, reproduced literally here):
--   - status='ACTIVE' with a structurally invalid / unit-mismatched formula -> INSERT/UPDATE
--     REJECTED (RAISE propagates).
--   - status='DRAFT' with the same invalid formula -> INSERT/UPDATE ACCEPTED, compile_status is
--     persisted as 'COMPILE_ERROR' (data, not a blocking error) so the author can keep editing.
--   - tier='ORG_CUSTOM' AND status='ACTIVE' AND (approved_by IS NULL OR approved_by = created_by)
--     -> REJECTED regardless of formula validity (maker-checker gate fires first).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_analysis_kpi_catalog_before_write() RETURNS TRIGGER AS $$
DECLARE
  v_resolved_unit TEXT;
  v_ratio_family TEXT[] := ARRAY['RATIO', 'PERCENT', 'MULTIPLE'];
BEGIN
  IF NEW.tier = 'ORG_CUSTOM' AND NEW.status = 'ACTIVE' THEN
    IF NEW.approved_by IS NULL OR NEW.approved_by = NEW.created_by THEN
      RAISE EXCEPTION 'finance_analysis_kpi_catalog: ORG_CUSTOM activation requires maker-checker (approved_by must be set and differ from created_by)';
    END IF;
  END IF;

  BEGIN
    v_resolved_unit := finance_analysis_kpi_resolve_unit(NEW.formula_ast);
  EXCEPTION WHEN OTHERS THEN
    IF NEW.status = 'ACTIVE' THEN
      RAISE; -- re-raise verbatim; blocks activation of a formula that fails to compile
    ELSE
      NEW.compile_status := 'COMPILE_ERROR';
      NEW.resolved_output_unit := NULL;
      NEW.updated_at := now();
      RETURN NEW;
    END IF;
  END;

  -- Cross-check the structurally-resolved unit against the author-declared unit_type.
  -- RATIO/PERCENT/MULTIPLE are three PRESENTATIONS of the same "money-over-money" structure
  -- (ADR section 6.2, last paragraph) -- the compiler only verifies the structure is from that
  -- family, the author picks which of the three presentations to show.
  IF (v_resolved_unit = 'RATIO' AND NOT (NEW.unit_type = ANY (v_ratio_family)))
     OR (v_resolved_unit != 'RATIO' AND NEW.unit_type != v_resolved_unit)
  THEN
    IF NEW.status = 'ACTIVE' THEN
      RAISE EXCEPTION 'UNIT_MISMATCH_STRUCTURAL: declared unit_type % incompatible with resolved %', NEW.unit_type, v_resolved_unit;
    ELSE
      NEW.compile_status := 'COMPILE_ERROR';
      NEW.resolved_output_unit := v_resolved_unit;
      NEW.updated_at := now();
      RETURN NEW;
    END IF;
  END IF;

  NEW.compile_status := 'COMPILED_OK';
  NEW.resolved_output_unit := v_resolved_unit;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_analysis_kpi_catalog_before_write ON finance_analysis_kpi_catalog;
CREATE TRIGGER trg_finance_analysis_kpi_catalog_before_write
  BEFORE INSERT OR UPDATE ON finance_analysis_kpi_catalog
  FOR EACH ROW EXECUTE FUNCTION finance_analysis_kpi_catalog_before_write();

-- ============================================================================
-- finance_analysis_kpi_values content freeze — exactly the finance_stmt_lines pattern (WP-D01
-- section 4.5 / finance_stmt_lines_enforce_parent_immutability), applied to this table (ADR
-- section 4.3, section 10 TEST D).
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_analysis_kpi_values_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_analysis_kpi_values: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_analysis_kpi_values_parent_immutability ON finance_analysis_kpi_values;
CREATE TRIGGER trg_finance_analysis_kpi_values_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_analysis_kpi_values
  FOR EACH ROW EXECUTE FUNCTION finance_analysis_kpi_values_enforce_parent_immutability();

-- ============================================================================
-- finance_analysis_variance HYBRID immutability (ADR section 4 point 5, section 10 TEST F/G):
-- once the parent business_version is APPROVED, no new rows and no deletes, and on UPDATE only the
-- owner/comment/action/due_date/status/resolved_by/resolved_at columns may change -- the numeric
-- facts (actual_value/comparison_value/variance_abs/variance_pct) and the dimensional key stay
-- frozen. Same to_jsonb(OLD)/to_jsonb(NEW) allow-list-diff technique as
-- finance_bv_enforce_immutability (WP-B01 migration, header note 3) -- applied here to a CONTENT
-- table for the first time in Gate D.
-- ============================================================================
CREATE OR REPLACE FUNCTION finance_analysis_variance_enforce_hybrid_immutability() RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
  allowed_keys TEXT[] := ARRAY['owner', 'comment', 'action', 'due_date', 'status', 'resolved_by', 'resolved_at', 'updated_at'];
  old_j JSONB;
  new_j JSONB;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);

  IF TG_OP = 'INSERT' THEN
    IF v_status = 'APPROVED' THEN
      RAISE EXCEPTION 'finance_analysis_variance: cannot create a new variance row against APPROVED business_version %', NEW.business_version_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF v_status = 'APPROVED' THEN
      RAISE EXCEPTION 'finance_analysis_variance: cannot delete a variance row against APPROVED business_version %', OLD.business_version_id;
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE'
  IF v_status = 'APPROVED' THEN
    old_j := to_jsonb(OLD);
    new_j := to_jsonb(NEW);
    IF (SELECT jsonb_object_agg(k, old_j -> k) FROM jsonb_object_keys(old_j) AS k WHERE NOT (k = ANY (allowed_keys)))
       IS DISTINCT FROM
       (SELECT jsonb_object_agg(k, new_j -> k) FROM jsonb_object_keys(new_j) AS k WHERE NOT (k = ANY (allowed_keys)))
    THEN
      RAISE EXCEPTION 'finance_analysis_variance: % is APPROVED; only owner/comment/action/due_date/status/resolved_* may change', OLD.id;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_analysis_variance_hybrid_immutability ON finance_analysis_variance;
CREATE TRIGGER trg_finance_analysis_variance_hybrid_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_analysis_variance
  FOR EACH ROW EXECUTE FUNCTION finance_analysis_variance_enforce_hybrid_immutability();

COMMIT;
