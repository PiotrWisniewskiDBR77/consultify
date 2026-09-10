-- E2b — fixture pomiarowy dla bramek edycji INICJATYW (tylko kopia consultify_kopia_e2b)
-- Organizacja DBR77 a3e05d4a-5397-419d-b486-8e44366c0063
BEGIN;

DELETE FROM initiatives WHERE id LIKE 'e2b-ini-%';
DELETE FROM project_members WHERE user_id LIKE 'e2b-%';
DELETE FROM organization_members WHERE user_id LIKE 'e2b-%';
DELETE FROM users WHERE id LIKE 'e2b-%';
DELETE FROM projects WHERE id = 'e2b-project';

INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
VALUES ('e2b-project','a3e05d4a-5397-419d-b486-8e44366c0063','E2b projekt pomiarowy','active',NOW(),NOW());

INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
VALUES
 ('e2b-member-a','a3e05d4a-5397-419d-b486-8e44366c0063','e2b.member.a@dbr77.local','$2b$10$Tg2lteCiCJGR/NR8/dfdlO6vAcg.L/qvif2XemsMbz24NXa/fvnUa','E2b','Czlonek A','MEMBER','active'),
 ('e2b-member-b','a3e05d4a-5397-419d-b486-8e44366c0063','e2b.member.b@dbr77.local','$2b$10$Tg2lteCiCJGR/NR8/dfdlO6vAcg.L/qvif2XemsMbz24NXa/fvnUa','E2b','Czlonek B','MEMBER','active'),
 ('e2b-ini-owner','a3e05d4a-5397-419d-b486-8e44366c0063','e2b.iniowner@dbr77.local','$2b$10$Tg2lteCiCJGR/NR8/dfdlO6vAcg.L/qvif2XemsMbz24NXa/fvnUa','E2b','Wlasciciel Inicjatywy','MEMBER','active'),
 ('e2b-admin','a3e05d4a-5397-419d-b486-8e44366c0063','e2b.admin@dbr77.local','$2b$10$Tg2lteCiCJGR/NR8/dfdlO6vAcg.L/qvif2XemsMbz24NXa/fvnUa','E2b','Administrator','ADMIN','active');

INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
VALUES
 ('e2b-om-a','a3e05d4a-5397-419d-b486-8e44366c0063','e2b-member-a','MEMBER','ACTIVE',NOW()),
 ('e2b-om-b','a3e05d4a-5397-419d-b486-8e44366c0063','e2b-member-b','MEMBER','ACTIVE',NOW()),
 ('e2b-om-o','a3e05d4a-5397-419d-b486-8e44366c0063','e2b-ini-owner','MEMBER','ACTIVE',NOW()),
 ('e2b-om-adm','a3e05d4a-5397-419d-b486-8e44366c0063','e2b-admin','ADMIN','ACTIVE',NOW());

INSERT INTO project_members (id, project_id, user_id, project_role, normalized_project_role, created_at, updated_at)
VALUES
 ('e2b-pm-a','e2b-project','e2b-member-a','TASK_ASSIGNEE','TASK_ASSIGNEE',NOW(),NOW()),
 ('e2b-pm-b','e2b-project','e2b-member-b','TASK_ASSIGNEE','TASK_ASSIGNEE',NOW(),NOW()),
 ('e2b-pm-o','e2b-project','e2b-ini-owner','INITIATIVE_OWNER','INITIATIVE_OWNER',NOW(),NOW()),
 ('e2b-pm-adm','e2b-project','e2b-admin','PROJECT_LEADER','PROJECT_LEADER',NOW(),NOW());

-- A: twórca i właściciel wykonawczy własnej inicjatywy
INSERT INTO initiatives (id, organization_id, project_id, name, title, status, created_by, owner_execution_id, created_at, updated_at)
VALUES ('e2b-ini-own-a','a3e05d4a-5397-419d-b486-8e44366c0063','e2b-project','E2b inicjatywa A','E2b inicjatywa A','DRAFT','e2b-member-a','e2b-member-a',NOW(),NOW());

-- B: cudza dla A (twórca i właściciel = B)
INSERT INTO initiatives (id, organization_id, project_id, name, title, status, created_by, owner_execution_id, created_at, updated_at)
VALUES ('e2b-ini-other-b','a3e05d4a-5397-419d-b486-8e44366c0063','e2b-project','E2b inicjatywa B','E2b inicjatywa B','DRAFT','e2b-member-b','e2b-member-b',NOW(),NOW());

-- C: twórcą jest B, właścicielem wykonawczym e2b-ini-owner (właściciel != twórca)
INSERT INTO initiatives (id, organization_id, project_id, name, title, status, created_by, owner_execution_id, created_at, updated_at)
VALUES ('e2b-ini-owned-c','a3e05d4a-5397-419d-b486-8e44366c0063','e2b-project','E2b inicjatywa C','E2b inicjatywa C','DRAFT','e2b-member-b','e2b-ini-owner',NOW(),NOW());

-- D: inicjatywa bez projektu (kontekst projektu = brak) — kontrola regresji
INSERT INTO initiatives (id, organization_id, project_id, name, title, status, created_by, owner_execution_id, created_at, updated_at)
VALUES ('e2b-ini-noproject-b','a3e05d4a-5397-419d-b486-8e44366c0063',NULL,'E2b inicjatywa bez projektu','E2b inicjatywa bez projektu','DRAFT','e2b-member-b','e2b-member-b',NOW(),NOW());

COMMIT;

-- runtime-v1: agregaty inicjatyw (ie_aggregate_state) — wlasciciel = initiativeOwnerId
DELETE FROM ie_aggregate_state WHERE aggregate_id LIKE 'e2b-rt-%';
INSERT INTO ie_aggregate_state (organization_id, aggregate_type, aggregate_id, version, payload_json, updated_at)
VALUES
 ('a3e05d4a-5397-419d-b486-8e44366c0063','initiative','e2b-rt-own-owner',1,
  jsonb_build_object('initiativeId','e2b-rt-own-owner','projectId','e2b-project','title','E2b runtime wlasna wlasciciela',
    'problem','problem e2b','initiativeOwnerId','e2b-ini-owner','lifecycleState','REGISTERED','updatedAt',to_char(NOW(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')), NOW()),
 ('a3e05d4a-5397-419d-b486-8e44366c0063','initiative','e2b-rt-other-b',1,
  jsonb_build_object('initiativeId','e2b-rt-other-b','projectId','e2b-project','title','E2b runtime cudza (B)',
    'problem','problem e2b','initiativeOwnerId','e2b-member-b','lifecycleState','REGISTERED','updatedAt',to_char(NOW(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')), NOW());
