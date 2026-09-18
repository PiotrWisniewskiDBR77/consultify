-- QD3 rehearsal fixture: 3 ephemeral demo-session clone orgs shaped like the
-- staging residue (`ateliertoys-demo-session-<hash>-<suffix>`, name "Atelier Toys").
-- Runs ONLY against a local dump copy. Clone 3 additionally owns an append-only
-- `results_writer_observations` row, which is the blocker reported in KANAL 16.09.
\set ON_ERROR_STOP on

INSERT INTO organizations (id, name, organization_type, billing_status, created_at)
VALUES
  ('ateliertoys-demo-session-f786e8f37a-qd3t0001', 'Atelier Toys', 'DEMO', NULL, '2026-09-10T06:07:00Z'),
  ('ateliertoys-demo-session-f786e8f37a-qd3t0002', 'Atelier Toys', 'DEMO', NULL, '2026-09-11T07:27:00Z'),
  ('ateliertoys-demo-session-f786e8f37a-qd3t0003', 'Atelier Toys', 'DEMO', NULL, '2026-09-12T08:29:00Z') ON CONFLICT DO NOTHING;

INSERT INTO users (id, organization_id, email)
VALUES
  ('qd3-seed-1', 'ateliertoys-demo-session-f786e8f37a-qd3t0001', 'anna.kowalska+ateliertoys-demo-session-f786e8f37a-qd3t0001@demo.ateliertoys.com'),
  ('qd3-seed-2', 'ateliertoys-demo-session-f786e8f37a-qd3t0002', 'anna.kowalska+ateliertoys-demo-session-f786e8f37a-qd3t0002@demo.ateliertoys.com'),
  ('qd3-seed-3', 'ateliertoys-demo-session-f786e8f37a-qd3t0003', 'anna.kowalska+ateliertoys-demo-session-f786e8f37a-qd3t0003@demo.ateliertoys.com') ON CONFLICT DO NOTHING;

INSERT INTO organization_members (id, organization_id, user_id, role)
VALUES
  ('qd3-m-1', 'ateliertoys-demo-session-f786e8f37a-qd3t0001', 'qd3-seed-1', 'OWNER'),
  ('qd3-m-2', 'ateliertoys-demo-session-f786e8f37a-qd3t0002', 'qd3-seed-2', 'OWNER'),
  ('qd3-m-3', 'ateliertoys-demo-session-f786e8f37a-qd3t0003', 'qd3-seed-3', 'OWNER') ON CONFLICT DO NOTHING;

INSERT INTO access_requests (id, email, organization_id)
VALUES
  ('qd3-ar-1', 'probe1@demo.ateliertoys.com', 'ateliertoys-demo-session-f786e8f37a-qd3t0001'),
  ('qd3-ar-2', 'probe2@demo.ateliertoys.com', 'ateliertoys-demo-session-f786e8f37a-qd3t0002'),
  ('qd3-ar-3', 'probe3@demo.ateliertoys.com', 'ateliertoys-demo-session-f786e8f37a-qd3t0003') ON CONFLICT DO NOTHING;

-- artifact_lifecycle_events is deliberately NOT in the fixture: it carries a
-- composite FK (artifact_id, organization_id) -> finance_artifacts, so a row
-- would require seeding a finance artifact first. async_jobs below covers the
-- same NO-ACTION blocker class with a plain organization_id FK.

INSERT INTO async_jobs (id, type, organization_id, entity_id)
VALUES
  ('qd3-job-1', 'report.export', 'ateliertoys-demo-session-f786e8f37a-qd3t0001', 'qd3-art-1'),
  ('qd3-job-2', 'report.export', 'ateliertoys-demo-session-f786e8f37a-qd3t0002', 'qd3-art-2'),
  ('qd3-job-3', 'report.export', 'ateliertoys-demo-session-f786e8f37a-qd3t0003', 'qd3-art-3') ON CONFLICT DO NOTHING;

INSERT INTO initiatives (id, organization_id, name)
VALUES
  ('qd3-init-1', 'ateliertoys-demo-session-f786e8f37a-qd3t0001', 'QD3 rehearsal initiative 1'),
  ('qd3-init-2', 'ateliertoys-demo-session-f786e8f37a-qd3t0002', 'QD3 rehearsal initiative 2'),
  ('qd3-init-3', 'ateliertoys-demo-session-f786e8f37a-qd3t0003', 'QD3 rehearsal initiative 3') ON CONFLICT DO NOTHING;

INSERT INTO demo_sessions (id, user_id, base_org_id, session_org_id, anchor_date, expires_at, status)
VALUES
  ('qd3-ds-1', 'qd3-seed-1', '468b234c-66c4-54e1-b626-5e0fb3a92f6a', 'ateliertoys-demo-session-f786e8f37a-qd3t0001', '2026-09-10 06:07:00', '2026-09-10 08:07:00', 'expired'),
  ('qd3-ds-2', 'qd3-seed-2', '468b234c-66c4-54e1-b626-5e0fb3a92f6a', 'ateliertoys-demo-session-f786e8f37a-qd3t0002', '2026-09-11 07:27:00', '2026-09-11 09:27:00', 'expired'),
  ('qd3-ds-3', 'qd3-seed-3', '468b234c-66c4-54e1-b626-5e0fb3a92f6a', 'ateliertoys-demo-session-f786e8f37a-qd3t0003', '2026-09-12 08:29:00', '2026-09-12 10:29:00', 'expired') ON CONFLICT DO NOTHING;

-- Append-only residue: no FK to organizations, protected by
-- trg_results_writer_observation_no_delete. This is what blocked the TTL cleanup.
INSERT INTO results_writer_observations (organization_id, writer_family, operation, endpoint, correlation_id)
VALUES ('ateliertoys-demo-session-f786e8f37a-qd3t0003', 'execution_results', 'write', '/api/assessment/results', 'qd3-corr-3') ON CONFLICT DO NOTHING;
