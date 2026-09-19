-- ============================================================================
-- D-121 (Wpis 178 [D] pt 2) — STANDING RUNBOOK RULE, applied from D-121:
-- BEFORE any delete, list EVERY FK pointing at the target table with its
-- ON DELETE action (pg_constraint.confdeltype), and COUNT the rows that would
-- be cascade-modified / cascade-deleted. Those rows are INCLUDED in "touched"
-- in the checksum and in the report. The instrument must catch it, not the eye.
--
-- Target table: interview_evidence (deleting 2 orphaned answer_text rows).
-- confdeltype: a=NO ACTION r=RESTRICT c=CASCADE n=SET NULL d=SET DEFAULT
-- ============================================================================
\pset tuples_only on

-- (1) FKs pointing AT interview_evidence -> these govern cascade when WE delete its rows.
SELECT 'FK_POINTING_AT confdeltype=' || con.confdeltype::text || ' name=' || con.conname
       || ' from=' || cl.relname || '.'
       || (SELECT attname FROM pg_attribute WHERE attrelid=con.conrelid AND attnum=con.conkey[1])
FROM pg_constraint con
JOIN pg_class cl ON cl.oid = con.conrelid
WHERE con.contype='f' AND con.confrelid = 'interview_evidence'::regclass
ORDER BY cl.relname;

-- (2) COUNT of rows in ANY other table that reference the 2 target ids
--     (= rows that a CASCADE/SET NULL would touch). Expected: 0 (no FK points at ie).
SELECT 'CASCADE_AFFECTED_ROWS=' || (
  COALESCE((SELECT count(*) FROM interview_evidence ref
            WHERE ref.question_id IN ('03e3f1d9-e286-4a76-b547-599cdec53d7a','b140e82d-a38e-4a3a-af01-39a8e3a16c6b')),0)
);

-- (3) For completeness: FKs FROM interview_evidence (govern what happens to ie when
--     ITS parents change; NOT triggered by deleting ie rows, but recorded).
SELECT 'FK_FROM_IE name=' || con.conname || ' col='
       || (SELECT attname FROM pg_attribute WHERE attrelid=con.conrelid AND attnum=con.conkey[1])
       || ' -> ' || ref.relname || ' on_delete=' || con.confdeltype::text
FROM pg_constraint con
JOIN pg_class ref ON ref.oid = con.confrelid
WHERE con.contype='f' AND con.conrelid = 'interview_evidence'::regclass
ORDER BY ref.relname;

-- VERDICT recorded in LIVE-RUN.md:
--   FK_POINTING_AT interview_evidence = 0 rows  -> deleting ie rows cascades to NOTHING.
--   CASCADE_AFFECTED_ROWS = 0                    -> "touched" set == exactly the 2 deleted rows.
