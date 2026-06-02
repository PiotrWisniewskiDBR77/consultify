-- Purpose: Expand partner certification to multi-track, multi-level runtime with review states.

ALTER TABLE partner_certifications
  ADD COLUMN IF NOT EXISTS certification_track TEXT,
  ADD COLUMN IF NOT EXISTS certification_level TEXT,
  ADD COLUMN IF NOT EXISTS review_state TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS recertification_policy TEXT,
  ADD COLUMN IF NOT EXISTS tier_target TEXT,
  ADD COLUMN IF NOT EXISTS exam_mode TEXT NOT NULL DEFAULT 'exam',
  ADD COLUMN IF NOT EXISTS public_article_slug TEXT,
  ADD COLUMN IF NOT EXISTS partner_lifecycle_step TEXT,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

UPDATE partner_certifications
SET certification_track = COALESCE(certification_track, CASE
    WHEN certification_type LIKE 'sales%' THEN 'sales'
    WHEN certification_type LIKE 'delivery%' THEN 'delivery'
    WHEN certification_type LIKE 'strategic%' THEN 'strategic'
    ELSE 'sales'
  END),
  certification_level = COALESCE(certification_level, CASE
    WHEN certification_type LIKE '%advanced%' THEN 'advanced'
    WHEN certification_type LIKE '%practitioner%' THEN 'practitioner'
    ELSE 'foundation'
  END),
  recertification_policy = COALESCE(recertification_policy, 'annual_refresh'),
  tier_target = COALESCE(tier_target, 'BRONZE'),
  partner_lifecycle_step = COALESCE(partner_lifecycle_step, 'activate')
WHERE certification_track IS NULL OR certification_level IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_certifications_track_level
  ON partner_certifications(partner_org_id, user_id, certification_track, certification_level);
CREATE INDEX IF NOT EXISTS idx_partner_certifications_review_state
  ON partner_certifications(review_state, updated_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'partner_certifications_certification_type_check'
      AND conrelid = 'partner_certifications'::regclass
  ) THEN
    ALTER TABLE partner_certifications DROP CONSTRAINT partner_certifications_certification_type_check;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- ignore
END $$;

ALTER TABLE partner_certifications
  ADD CONSTRAINT partner_certifications_certification_type_check
  CHECK (
    certification_type IN (
      'foundation',
      'sales',
      'pmo_standards',
      'ai_modules',
      'assessment_specialist',
      'advanced',
      'compliance',
      'sales_foundation',
      'sales_practitioner',
      'sales_advanced',
      'delivery_foundation',
      'delivery_practitioner',
      'delivery_advanced',
      'strategic_foundation',
      'strategic_practitioner',
      'strategic_advanced'
    )
  );

ALTER TABLE partner_learning_modules
  ADD COLUMN IF NOT EXISTS certification_track TEXT,
  ADD COLUMN IF NOT EXISTS certification_level TEXT,
  ADD COLUMN IF NOT EXISTS module_kind TEXT NOT NULL DEFAULT 'lesson',
  ADD COLUMN IF NOT EXISTS resource_article_slug TEXT,
  ADD COLUMN IF NOT EXISTS resource_label TEXT,
  ADD COLUMN IF NOT EXISTS prerequisite_module_id UUID,
  ADD COLUMN IF NOT EXISTS partner_lifecycle_step TEXT,
  ADD COLUMN IF NOT EXISTS owner_role TEXT,
  ADD COLUMN IF NOT EXISTS review_required BOOLEAN DEFAULT FALSE;

UPDATE partner_learning_modules
SET certification_track = COALESCE(certification_track, CASE
    WHEN certification_type LIKE 'sales%' THEN 'sales'
    WHEN certification_type LIKE 'delivery%' THEN 'delivery'
    WHEN certification_type LIKE 'strategic%' THEN 'strategic'
    ELSE 'sales'
  END),
  certification_level = COALESCE(certification_level, CASE
    WHEN certification_type LIKE '%advanced%' THEN 'advanced'
    WHEN certification_type LIKE '%practitioner%' THEN 'practitioner'
    ELSE 'foundation'
  END),
  partner_lifecycle_step = COALESCE(partner_lifecycle_step, 'academy')
WHERE certification_track IS NULL OR certification_level IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_learning_modules_track_level_lang
  ON partner_learning_modules(certification_type, certification_track, certification_level, language, module_order);

ALTER TABLE partner_exam_questions
  ADD COLUMN IF NOT EXISTS certification_track TEXT,
  ADD COLUMN IF NOT EXISTS certification_level TEXT,
  ADD COLUMN IF NOT EXISTS passing_score INTEGER DEFAULT 70;

UPDATE partner_exam_questions
SET certification_track = COALESCE(certification_track, CASE
    WHEN certification_type LIKE 'sales%' THEN 'sales'
    WHEN certification_type LIKE 'delivery%' THEN 'delivery'
    WHEN certification_type LIKE 'strategic%' THEN 'strategic'
    ELSE 'sales'
  END),
  certification_level = COALESCE(certification_level, CASE
    WHEN certification_type LIKE '%practitioner%' THEN 'practitioner'
    ELSE 'foundation'
  END)
WHERE certification_track IS NULL OR certification_level IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_exam_questions_cert_matrix
  ON partner_exam_questions(certification_type, certification_track, certification_level, language);

ALTER TABLE partner_certificates
  ADD COLUMN IF NOT EXISTS certification_track TEXT,
  ADD COLUMN IF NOT EXISTS certification_level TEXT,
  ADD COLUMN IF NOT EXISTS review_state TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_partner_certificates_matrix
  ON partner_certificates(partner_org_id, certification_track, certification_level, earned_at DESC);

INSERT INTO partner_learning_modules (
  id,
  name,
  description,
  certification_type,
  certification_track,
  certification_level,
  module_order,
  duration_minutes,
  content_type,
  is_active,
  category,
  required_for_certification,
  language,
  minutes,
  module_kind,
  resource_article_slug,
  resource_label,
  partner_lifecycle_step,
  owner_role,
  review_required
)
VALUES
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de001', 'Sales Foundation: Positioning and fit', 'Public-safe positioning, ICP framing, and first-call fit logic.', 'sales_foundation', 'sales', 'foundation', 1, 25, 'document', TRUE, 'SALES', TRUE, 'en', 25, 'lesson', 'partner-program-overview', 'Program overview', 'discover', 'partner_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de002', 'Sales Foundation: Discovery and next step', 'Qualification flow, objections, and escalation rules for custom terms.', 'sales_foundation', 'sales', 'foundation', 2, 35, 'document', TRUE, 'SALES', TRUE, 'en', 35, 'lesson', 'partner-application-flow', 'Application flow', 'apply', 'partner_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de003', 'Sales Practitioner: Pipeline proof motion', 'Case-led qualification, proof packaging, and sponsor-ready business cases.', 'sales_practitioner', 'sales', 'practitioner', 1, 35, 'document', TRUE, 'SALES', TRUE, 'en', 35, 'lesson', 'partner-case-study-operations-rollout', 'Operations case study', 'earn', 'partner_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de004', 'Sales Practitioner: CFO and COO objections', 'Governance, ROI defense, and stakeholder mapping for complex buying cycles.', 'sales_practitioner', 'sales', 'practitioner', 2, 40, 'document', TRUE, 'SALES', TRUE, 'en', 40, 'lesson', 'partner-case-study-cfo-governance', 'Finance case study', 'earn', 'partner_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de005', 'Sales Advanced: Executive deal review', 'Scenario defense, exception handling, and custom commercials.', 'sales_advanced', 'sales', 'advanced', 1, 45, 'document', TRUE, 'SALES', TRUE, 'en', 45, 'case_defense', 'partner-faq', 'Partner FAQ', 'earn', 'partner_director', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de006', 'Sales Advanced: Expansion planning', 'Multi-workstream expansion design and premium governance motion.', 'sales_advanced', 'sales', 'advanced', 2, 40, 'document', TRUE, 'SALES', TRUE, 'en', 40, 'case_defense', 'partner-payout-and-activation', 'Activation and payout', 'payout', 'partner_director', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de007', 'Delivery Foundation: Onboarding and activation', 'Shared onboarding flow, activation gates, and first implementation hygiene.', 'delivery_foundation', 'delivery', 'foundation', 1, 30, 'document', TRUE, 'DELIVERY', TRUE, 'en', 30, 'lesson', 'partner-application-flow', 'Application flow', 'activate', 'delivery_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de008', 'Delivery Foundation: Payout and compliance basics', 'Billing readiness, payout preconditions, and safe delivery claims.', 'delivery_foundation', 'delivery', 'foundation', 2, 30, 'document', TRUE, 'COMPLIANCE', TRUE, 'en', 30, 'lesson', 'partner-payout-and-activation', 'Activation and payout', 'payout', 'delivery_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de009', 'Delivery Practitioner: Case pack execution', 'Reusable case-pack delivery, evidence hygiene, and repeatable rollout structure.', 'delivery_practitioner', 'delivery', 'practitioner', 1, 35, 'document', TRUE, 'DELIVERY', TRUE, 'en', 35, 'lesson', 'partner-case-study-operations-rollout', 'Operations case study', 'earn', 'delivery_manager', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de010', 'Delivery Practitioner: Partner/client governance', 'Weekly operating cadence, blockers, and superadmin escalation rules.', 'delivery_practitioner', 'delivery', 'practitioner', 2, 40, 'document', TRUE, 'DELIVERY', TRUE, 'en', 40, 'lesson', 'partner-faq', 'Partner FAQ', 'payout', 'delivery_manager', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de011', 'Delivery Advanced: Review board defense', 'Manual review for premium rollouts, risk posture, and exception control.', 'delivery_advanced', 'delivery', 'advanced', 1, 45, 'document', TRUE, 'DELIVERY', TRUE, 'en', 45, 'case_defense', 'partner-case-study-cfo-governance', 'Finance case study', 'payout', 'delivery_director', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de012', 'Delivery Advanced: Settlement readiness', 'Commercial closure, settlement evidence, and high-tier partner readiness.', 'delivery_advanced', 'delivery', 'advanced', 2, 35, 'document', TRUE, 'COMPLIANCE', TRUE, 'en', 35, 'case_defense', 'partner-payout-and-activation', 'Activation and payout', 'payout', 'delivery_director', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de013', 'Strategic Foundation: Program architecture', 'How the partner program, academy, certification, and ops layer work together.', 'strategic_foundation', 'strategic', 'foundation', 1, 25, 'document', TRUE, 'STRATEGY', TRUE, 'en', 25, 'lesson', 'partner-program-overview', 'Program overview', 'discover', 'strategy_lead', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de014', 'Strategic Foundation: Opportunity triage', 'Which deals stay self-serve and which require direct partner-team involvement.', 'strategic_foundation', 'strategic', 'foundation', 2, 25, 'document', TRUE, 'STRATEGY', TRUE, 'en', 25, 'lesson', 'partner-faq', 'Partner FAQ', 'apply', 'strategy_lead', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de015', 'Strategic Practitioner: Tier planning', 'Mapping certification progression to tier lift and commercial planning.', 'strategic_practitioner', 'strategic', 'practitioner', 1, 35, 'document', TRUE, 'STRATEGY', TRUE, 'en', 35, 'lesson', 'partner-certification-explainer', 'Certification explainer', 'earn', 'strategy_lead', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de016', 'Strategic Practitioner: Multi-stakeholder governance', 'Sponsor governance, blocked-reason diagnosis, and operator collaboration.', 'strategic_practitioner', 'strategic', 'practitioner', 2, 35, 'document', TRUE, 'STRATEGY', TRUE, 'en', 35, 'lesson', 'partner-case-study-cfo-governance', 'Finance case study', 'earn', 'strategy_lead', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de017', 'Strategic Advanced: Program design defense', 'Case defense for advanced partner motions and platinum-style exceptions.', 'strategic_advanced', 'strategic', 'advanced', 1, 40, 'document', TRUE, 'STRATEGY', TRUE, 'en', 40, 'case_defense', 'partner-case-study-cfo-governance', 'Finance case study', 'earn', 'strategy_director', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de018', 'Strategic Advanced: Executive review memo', 'Review queue submission and evidence package for top-tier governance.', 'strategic_advanced', 'strategic', 'advanced', 2, 35, 'document', TRUE, 'STRATEGY', TRUE, 'en', 35, 'case_defense', 'partner-certification-explainer', 'Certification explainer', 'payout', 'strategy_director', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de101', 'Sprzedaz Foundation: Pozycjonowanie i fit', 'Public-safe positioning, ICP oraz logika pierwszego calla.', 'sales_foundation', 'sales', 'foundation', 1, 25, 'document', TRUE, 'SALES', TRUE, 'pl', 25, 'lesson', 'partner-program-overview', 'Program overview', 'discover', 'partner_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de102', 'Sprzedaz Foundation: Discovery i next step', 'Kwalifikacja, obiekcje i zasady eskalacji dla custom conditions.', 'sales_foundation', 'sales', 'foundation', 2, 35, 'document', TRUE, 'SALES', TRUE, 'pl', 35, 'lesson', 'partner-application-flow', 'Application flow', 'apply', 'partner_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de103', 'Sprzedaz Practitioner: Proof motion', 'Kwalifikacja przez case study, proof pack i sponsor-ready business case.', 'sales_practitioner', 'sales', 'practitioner', 1, 35, 'document', TRUE, 'SALES', TRUE, 'pl', 35, 'lesson', 'partner-case-study-operations-rollout', 'Operations case study', 'earn', 'partner_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de104', 'Sprzedaz Practitioner: Obiekcje CFO i COO', 'Governance, ROI defense i mapa stakeholderow dla zlozonych decyzji.', 'sales_practitioner', 'sales', 'practitioner', 2, 40, 'document', TRUE, 'SALES', TRUE, 'pl', 40, 'lesson', 'partner-case-study-cfo-governance', 'Finance case study', 'earn', 'partner_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de105', 'Sprzedaz Advanced: Executive deal review', 'Scenario defense, exception handling i custom commercials.', 'sales_advanced', 'sales', 'advanced', 1, 45, 'document', TRUE, 'SALES', TRUE, 'pl', 45, 'case_defense', 'partner-faq', 'Partner FAQ', 'earn', 'partner_director', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de106', 'Sprzedaz Advanced: Expansion planning', 'Projektowanie ekspansji i premium governance motion.', 'sales_advanced', 'sales', 'advanced', 2, 40, 'document', TRUE, 'SALES', TRUE, 'pl', 40, 'case_defense', 'partner-payout-and-activation', 'Activation and payout', 'payout', 'partner_director', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de107', 'Delivery Foundation: Onboarding i activation', 'Shared onboarding, activation gates i pierwsza higiena delivery.', 'delivery_foundation', 'delivery', 'foundation', 1, 30, 'document', TRUE, 'DELIVERY', TRUE, 'pl', 30, 'lesson', 'partner-application-flow', 'Application flow', 'activate', 'delivery_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de108', 'Delivery Foundation: Payout i compliance basics', 'Billing readiness, payout preconditions i safe delivery claims.', 'delivery_foundation', 'delivery', 'foundation', 2, 30, 'document', TRUE, 'COMPLIANCE', TRUE, 'pl', 30, 'lesson', 'partner-payout-and-activation', 'Activation and payout', 'payout', 'delivery_manager', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de109', 'Delivery Practitioner: Case pack execution', 'Repeatable rollout structure, evidence hygiene i reusable case pack.', 'delivery_practitioner', 'delivery', 'practitioner', 1, 35, 'document', TRUE, 'DELIVERY', TRUE, 'pl', 35, 'lesson', 'partner-case-study-operations-rollout', 'Operations case study', 'earn', 'delivery_manager', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de110', 'Delivery Practitioner: Partner/client governance', 'Cadence tygodniowy, blockers i operator escalation rules.', 'delivery_practitioner', 'delivery', 'practitioner', 2, 40, 'document', TRUE, 'DELIVERY', TRUE, 'pl', 40, 'lesson', 'partner-faq', 'Partner FAQ', 'payout', 'delivery_manager', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de111', 'Delivery Advanced: Review board defense', 'Manual review dla premium rollouts i exception control.', 'delivery_advanced', 'delivery', 'advanced', 1, 45, 'document', TRUE, 'DELIVERY', TRUE, 'pl', 45, 'case_defense', 'partner-case-study-cfo-governance', 'Finance case study', 'payout', 'delivery_director', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de112', 'Delivery Advanced: Settlement readiness', 'Commercial closure, settlement evidence i high-tier readiness.', 'delivery_advanced', 'delivery', 'advanced', 2, 35, 'document', TRUE, 'COMPLIANCE', TRUE, 'pl', 35, 'case_defense', 'partner-payout-and-activation', 'Activation and payout', 'payout', 'delivery_director', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de113', 'Strategic Foundation: Architektura programu', 'Jak partner program, academy, certyfikacja i ops layer pracuja razem.', 'strategic_foundation', 'strategic', 'foundation', 1, 25, 'document', TRUE, 'STRATEGY', TRUE, 'pl', 25, 'lesson', 'partner-program-overview', 'Program overview', 'discover', 'strategy_lead', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de114', 'Strategic Foundation: Opportunity triage', 'Ktore deale zostaja self-serve, a ktore wymagaja bezposredniego kontaktu.', 'strategic_foundation', 'strategic', 'foundation', 2, 25, 'document', TRUE, 'STRATEGY', TRUE, 'pl', 25, 'lesson', 'partner-faq', 'Partner FAQ', 'apply', 'strategy_lead', FALSE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de115', 'Strategic Practitioner: Tier planning', 'Mapowanie certyfikacji do tier lift i commercial planning.', 'strategic_practitioner', 'strategic', 'practitioner', 1, 35, 'document', TRUE, 'STRATEGY', TRUE, 'pl', 35, 'lesson', 'partner-certification-explainer', 'Certification explainer', 'earn', 'strategy_lead', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de116', 'Strategic Practitioner: Multi-stakeholder governance', 'Sponsor governance, blocked reasons i wspolpraca z operatorem.', 'strategic_practitioner', 'strategic', 'practitioner', 2, 35, 'document', TRUE, 'STRATEGY', TRUE, 'pl', 35, 'lesson', 'partner-case-study-cfo-governance', 'Finance case study', 'earn', 'strategy_lead', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de117', 'Strategic Advanced: Program design defense', 'Case defense dla advanced partner motions i exception path.', 'strategic_advanced', 'strategic', 'advanced', 1, 40, 'document', TRUE, 'STRATEGY', TRUE, 'pl', 40, 'case_defense', 'partner-case-study-cfo-governance', 'Finance case study', 'earn', 'strategy_director', TRUE),
  ('c8fd7cf3-8cf7-4bf6-95cb-60c7712de118', 'Strategic Advanced: Executive review memo', 'Review queue submission i evidence package dla top-tier governance.', 'strategic_advanced', 'strategic', 'advanced', 2, 35, 'document', TRUE, 'STRATEGY', TRUE, 'pl', 35, 'case_defense', 'partner-certification-explainer', 'Certification explainer', 'payout', 'strategy_director', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO partner_exam_questions (certification_type, certification_track, certification_level, language, question_text, options_json, correct_option_id, passing_score)
VALUES
  ('sales_foundation', 'sales', 'foundation', 'en', 'What is the safest partner CTA when the lead needs custom commercials?', '[{"id":"a","label":"Promise pricing immediately."},{"id":"b","label":"Escalate to the partner team and explain why direct contact is appropriate."},{"id":"c","label":"Guarantee platinum terms."},{"id":"d","label":"Hide the exception path."}]', 'b', 70),
  ('sales_foundation', 'sales', 'foundation', 'en', 'What should discovery capture first?', '[{"id":"a","label":"Only product enthusiasm."},{"id":"b","label":"Pain, owner, blockers, and desired next step."},{"id":"c","label":"Only discount expectations."},{"id":"d","label":"Only AI features."}]', 'b', 70),
  ('sales_foundation', 'sales', 'foundation', 'en', 'How should a partner talk about certification?', '[{"id":"a","label":"As optional theater."},{"id":"b","label":"As a readiness signal tied to academy, review, and tier progression."},{"id":"c","label":"As a replacement for delivery."},{"id":"d","label":"As a legal guarantee."}]', 'b', 70),
  ('sales_foundation', 'sales', 'foundation', 'en', 'When should the application flow stay self-serve?', '[{"id":"a","label":"When the path is standard and no custom commercial exception is needed."},{"id":"b","label":"Only when the partner is platinum."},{"id":"c","label":"Never."},{"id":"d","label":"Only after payout setup."}]', 'a', 70),
  ('sales_foundation', 'sales', 'foundation', 'en', 'What creates proof in partner motion?', '[{"id":"a","label":"Made-up claims."},{"id":"b","label":"Case packs, explicit next steps, and governed onboarding."},{"id":"c","label":"Discount tables only."},{"id":"d","label":"Unverified screenshots."}]', 'b', 70),
  ('sales_foundation', 'sales', 'foundation', 'en', 'What is the right answer to “Can you guarantee ROI?”', '[{"id":"a","label":"Yes, always."},{"id":"b","label":"No guarantee; explain evidence-backed positioning and how outcomes are structured."},{"id":"c","label":"Only if they sign today."},{"id":"d","label":"Avoid the question."}]', 'b', 70),
  ('sales_practitioner', 'sales', 'practitioner', 'en', 'A strong practitioner proof pack should include:', '[{"id":"a","label":"Only a logo."},{"id":"b","label":"Case narrative, objections handled, target sponsor, and next operational step."},{"id":"c","label":"Only pricing."},{"id":"d","label":"Only certification badges."}]', 'b', 80),
  ('sales_practitioner', 'sales', 'practitioner', 'en', 'Which stakeholder usually needs ROI-defense language?', '[{"id":"a","label":"CFO."},{"id":"b","label":"Office intern."},{"id":"c","label":"Receptionist."},{"id":"d","label":"Warehouse temp."}]', 'a', 80),
  ('sales_practitioner', 'sales', 'practitioner', 'en', 'When a deal has many unknowns, the best motion is to:', '[{"id":"a","label":"Push for immediate closure."},{"id":"b","label":"Clarify blockers, shape a proof path, and only escalate where needed."},{"id":"c","label":"Invent missing answers."},{"id":"d","label":"Skip the governance story."}]', 'b', 80),
  ('sales_practitioner', 'sales', 'practitioner', 'en', 'How do case studies help partner motion?', '[{"id":"a","label":"They replace discovery."},{"id":"b","label":"They create proof, shorten trust-building, and anchor stakeholder conversations."},{"id":"c","label":"They guarantee purchase."},{"id":"d","label":"They remove the need for onboarding."}]', 'b', 80),
  ('sales_practitioner', 'sales', 'practitioner', 'en', 'Which answer respects safe claims?', '[{"id":"a","label":"Every client gets the same result."},{"id":"b","label":"We use governed workflows, evidence, and clear next-step design to improve execution quality."},{"id":"c","label":"We replace every PMO instantly."},{"id":"d","label":"We close all objections automatically."}]', 'b', 80),
  ('sales_practitioner', 'sales', 'practitioner', 'en', 'What should happen after a practitioner-level win?', '[{"id":"a","label":"Nothing."},{"id":"b","label":"Map it to tier progression, academy continuation, and repeatable proof assets."},{"id":"c","label":"Delete the evidence."},{"id":"d","label":"Hide blockers from operators."}]', 'b', 80),
  ('delivery_foundation', 'delivery', 'foundation', 'en', 'Delivery foundation primarily proves:', '[{"id":"a","label":"Ad copy quality."},{"id":"b","label":"Activation readiness, payout basics, and governed rollout hygiene."},{"id":"c","label":"Payroll setup."},{"id":"d","label":"Only exam speed."}]', 'b', 70),
  ('delivery_foundation', 'delivery', 'foundation', 'en', 'What blocks payout readiness most often?', '[{"id":"a","label":"No sales deck."},{"id":"b","label":"Missing billing/payout setup or unresolved compliance steps."},{"id":"c","label":"Too many screenshots."},{"id":"d","label":"A long FAQ."}]', 'b', 70),
  ('delivery_foundation', 'delivery', 'foundation', 'en', 'Shared onboarding should be:', '[{"id":"a","label":"Different for every entry path."},{"id":"b","label":"One governed flow whether entered from LP or in-product."},{"id":"c","label":"Manual only."},{"id":"d","label":"Invisible."}]', 'b', 70),
  ('delivery_foundation', 'delivery', 'foundation', 'en', 'Which delivery claim is safe?', '[{"id":"a","label":"Guaranteed go-live in 3 days."},{"id":"b","label":"Activation follows shared steps, evidence, and partner-team escalation where needed."},{"id":"c","label":"No operator review is ever needed."},{"id":"d","label":"Platinum access is automatic."}]', 'b', 70),
  ('delivery_foundation', 'delivery', 'foundation', 'en', 'The first delivery priority after application approval is:', '[{"id":"a","label":"Ignore the portal."},{"id":"b","label":"Confirm onboarding, resource access, and payout/compliance prerequisites."},{"id":"c","label":"Create an invoice immediately."},{"id":"d","label":"Skip academy."}]', 'b', 70),
  ('delivery_foundation', 'delivery', 'foundation', 'en', 'Why does the portal show blockers?', '[{"id":"a","label":"For decoration only."},{"id":"b","label":"To make activation, certification, and payout issues explicit and actionable."},{"id":"c","label":"To reduce downloads."},{"id":"d","label":"To hide review state."}]', 'b', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'en', 'Strategic foundation teaches partners to:', '[{"id":"a","label":"Ignore tier logic."},{"id":"b","label":"Understand the whole partner motion from public docs to academy, certification, and payouts."},{"id":"c","label":"Only sell screenshots."},{"id":"d","label":"Skip certification entirely."}]', 'b', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'en', 'When should a partner move from self-serve to contact?', '[{"id":"a","label":"Whenever the path needs custom commercial or governance handling."},{"id":"b","label":"After every click."},{"id":"c","label":"Never."},{"id":"d","label":"Only after advanced certification."}]', 'a', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'en', 'The purpose of partner docs is to:', '[{"id":"a","label":"Replace the portal."},{"id":"b","label":"Serve as the canonical public knowledge layer for program, flow, payouts, certification, and FAQ."},{"id":"c","label":"Store secrets."},{"id":"d","label":"Hide case studies."}]', 'b', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'en', 'What makes the model hybrid?', '[{"id":"a","label":"Public knowledge in docs, partner-only academy and certification in the portal."},{"id":"b","label":"Everything in email."},{"id":"c","label":"Everything public."},{"id":"d","label":"Everything private."}]', 'a', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'en', 'What is the right use of FAQ?', '[{"id":"a","label":"Replace governance decisions."},{"id":"b","label":"Resolve predictable friction and point to the right next step."},{"id":"c","label":"Gate every resource."},{"id":"d","label":"Hide application flow."}]', 'b', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'en', 'Which signal belongs in partner reporting?', '[{"id":"a","label":"Blocked reasons and review backlog."},{"id":"b","label":"Favorite colors."},{"id":"c","label":"Browser zoom."},{"id":"d","label":"Wallpaper choice."}]', 'a', 70),
  ('sales_foundation', 'sales', 'foundation', 'pl', 'Jaki jest najbezpieczniejszy CTA, gdy lead potrzebuje custom commercials?', '[{"id":"a","label":"Od razu obiecac pricing."},{"id":"b","label":"Przekazac do partner team i wyjasnic, dlaczego potrzebny jest direct contact."},{"id":"c","label":"Zagwarantowac platinum terms."},{"id":"d","label":"Ukryc exception path."}]', 'b', 70),
  ('sales_foundation', 'sales', 'foundation', 'pl', 'Co discovery powinno uchwycic najpierw?', '[{"id":"a","label":"Tylko entuzjazm wobec produktu."},{"id":"b","label":"Pain, ownera, blockers i desired next step."},{"id":"c","label":"Tylko oczekiwania discountowe."},{"id":"d","label":"Tylko AI features."}]', 'b', 70),
  ('sales_foundation', 'sales', 'foundation', 'pl', 'Jak partner powinien mowic o certyfikacji?', '[{"id":"a","label":"Jako o teatrze."},{"id":"b","label":"Jako o readiness signal polaczonym z academy, review i tier progression."},{"id":"c","label":"Jako o zamienniku delivery."},{"id":"d","label":"Jako o legal guarantee."}]', 'b', 70),
  ('sales_foundation', 'sales', 'foundation', 'pl', 'Kiedy application flow moze zostac self-serve?', '[{"id":"a","label":"Gdy sciezka jest standardowa i nie potrzeba commercial exception."},{"id":"b","label":"Tylko dla platinum."},{"id":"c","label":"Nigdy."},{"id":"d","label":"Dopiero po payout setup."}]', 'a', 70),
  ('sales_foundation', 'sales', 'foundation', 'pl', 'Co buduje proof w partner motion?', '[{"id":"a","label":"Wymyslone claimy."},{"id":"b","label":"Case packi, jawne next steps i governed onboarding."},{"id":"c","label":"Same discount tables."},{"id":"d","label":"Niezweryfikowane screenshoty."}]', 'b', 70),
  ('sales_foundation', 'sales', 'foundation', 'pl', 'Jaka jest poprawna odpowiedz na „Czy gwarantujecie ROI?”', '[{"id":"a","label":"Tak, zawsze."},{"id":"b","label":"Nie ma gwarancji; wyjasnij evidence-backed positioning i jak strukturyzowane sa rezultaty."},{"id":"c","label":"Tak, jesli podpisza dzis."},{"id":"d","label":"Unikaj pytania."}]', 'b', 70),
  ('sales_practitioner', 'sales', 'practitioner', 'pl', 'Silny proof pack practitioner powinien zawierac:', '[{"id":"a","label":"Tylko logo."},{"id":"b","label":"Case narrative, obiekcje, target sponsora i kolejny operational step."},{"id":"c","label":"Tylko pricing."},{"id":"d","label":"Tylko certification badges."}]', 'b', 80),
  ('sales_practitioner', 'sales', 'practitioner', 'pl', 'Ktory stakeholder zwykle potrzebuje jezyka ROI defense?', '[{"id":"a","label":"CFO."},{"id":"b","label":"Stazysta."},{"id":"c","label":"Recepcja."},{"id":"d","label":"Magazynier."}]', 'a', 80),
  ('sales_practitioner', 'sales', 'practitioner', 'pl', 'Gdy deal ma duzo unknowns, najlepszy motion to:', '[{"id":"a","label":"Docisnac do zamkniecia."},{"id":"b","label":"Wyjasnic blockers, zbudowac proof path i eskalowac tylko tam, gdzie trzeba."},{"id":"c","label":"Wymyslic brakujace odpowiedzi."},{"id":"d","label":"Pominac governance story."}]', 'b', 80),
  ('sales_practitioner', 'sales', 'practitioner', 'pl', 'Jak case studies pomagaja partnerowi?', '[{"id":"a","label":"Zastepuja discovery."},{"id":"b","label":"Budują proof, skracaja trust-building i kotwicza rozmowe ze stakeholderami."},{"id":"c","label":"Gwarantuja zakup."},{"id":"d","label":"Usuwaja onboarding."}]', 'b', 80),
  ('sales_practitioner', 'sales', 'practitioner', 'pl', 'Ktora odpowiedz respektuje safe claims?', '[{"id":"a","label":"Kazdy klient dostaje ten sam wynik."},{"id":"b","label":"Uzywamy governed workflows, evidence i jasnego next-step designu, by poprawiac execution quality."},{"id":"c","label":"Od razu zastepujemy PMO."},{"id":"d","label":"Automatycznie domykamy obiekcje."}]', 'b', 80),
  ('sales_practitioner', 'sales', 'practitioner', 'pl', 'Co powinno sie stac po wygranej na poziomie practitioner?', '[{"id":"a","label":"Nic."},{"id":"b","label":"Zmapowac to do tier progression, dalszej academy i repeatable proof assets."},{"id":"c","label":"Usunac evidence."},{"id":"d","label":"Ukryc blockers przed operatorem."}]', 'b', 80),
  ('delivery_foundation', 'delivery', 'foundation', 'pl', 'Delivery foundation przede wszystkim potwierdza:', '[{"id":"a","label":"Jakosc reklam."},{"id":"b","label":"Activation readiness, payout basics i governed rollout hygiene."},{"id":"c","label":"Setup payrollu."},{"id":"d","label":"Tylko szybkosc egzaminu."}]', 'b', 70),
  ('delivery_foundation', 'delivery', 'foundation', 'pl', 'Co najczesciej blokuje payout readiness?', '[{"id":"a","label":"Brak sales decka."},{"id":"b","label":"Brak billing/payout setup albo nierozwiazane compliance steps."},{"id":"c","label":"Za duzo screenshotow."},{"id":"d","label":"Dlugi FAQ."}]', 'b', 70),
  ('delivery_foundation', 'delivery', 'foundation', 'pl', 'Shared onboarding powinien byc:', '[{"id":"a","label":"Inny dla kazdego wejscia."},{"id":"b","label":"Jednym governed flow niezaleznie od wejscia z LP lub z produktu."},{"id":"c","label":"Tylko manualny."},{"id":"d","label":"Niewidoczny."}]', 'b', 70),
  ('delivery_foundation', 'delivery', 'foundation', 'pl', 'Ktory claim delivery jest safe?', '[{"id":"a","label":"Gwarantowany go-live w 3 dni."},{"id":"b","label":"Aktywacja podaza za wspolnymi krokami, evidence i escalation do partner team tam, gdzie trzeba."},{"id":"c","label":"Operator review nigdy nie jest potrzebny."},{"id":"d","label":"Platinum jest automatyczne."}]', 'b', 70),
  ('delivery_foundation', 'delivery', 'foundation', 'pl', 'Jaki jest pierwszy priorytet delivery po akceptacji aplikacji?', '[{"id":"a","label":"Zignorowac portal."},{"id":"b","label":"Potwierdzic onboarding, dostep do resources i payout/compliance prerequisites."},{"id":"c","label":"Wystawic invoice natychmiast."},{"id":"d","label":"Pominac academy."}]', 'b', 70),
  ('delivery_foundation', 'delivery', 'foundation', 'pl', 'Dlaczego portal pokazuje blockers?', '[{"id":"a","label":"Dla dekoracji."},{"id":"b","label":"Aby activation, certification i payout issues byly jawne i actionalne."},{"id":"c","label":"Aby ograniczyc downloady."},{"id":"d","label":"Aby ukryc review state."}]', 'b', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'pl', 'Strategic foundation uczy partnera, jak:', '[{"id":"a","label":"Ignorowac tier logic."},{"id":"b","label":"Rozumiec caly motion partnera od public docs do academy, certification i payouts."},{"id":"c","label":"Sprzedawac tylko screenshoty."},{"id":"d","label":"Pominac certyfikacje."}]', 'b', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'pl', 'Kiedy partner powinien przejsc z self-serve do contact?', '[{"id":"a","label":"Gdy sciezka wymaga custom commercial albo governance handling."},{"id":"b","label":"Po kazdym kliknieciu."},{"id":"c","label":"Nigdy."},{"id":"d","label":"Dopiero po advanced certification."}]', 'a', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'pl', 'Po co istnieja partner docs?', '[{"id":"a","label":"Aby zastapic portal."},{"id":"b","label":"Aby byc kanoniczna publiczna warstwa wiedzy o programie, flow, payouts, certification i FAQ."},{"id":"c","label":"Aby przechowywac sekrety."},{"id":"d","label":"Aby ukryc case studies."}]', 'b', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'pl', 'Co oznacza model hybrydowy?', '[{"id":"a","label":"Public knowledge w docs, a partner-only academy i certification w portalu."},{"id":"b","label":"Wszystko w emailu."},{"id":"c","label":"Wszystko publiczne."},{"id":"d","label":"Wszystko prywatne."}]', 'a', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'pl', 'Jaka jest dobra rola FAQ?', '[{"id":"a","label":"Zastapic governance decisions."},{"id":"b","label":"Rozwiazywac przewidywalne friction points i wskazywac poprawny next step."},{"id":"c","label":"Gate-owac wszystko."},{"id":"d","label":"Ukrywac application flow."}]', 'b', 70),
  ('strategic_foundation', 'strategic', 'foundation', 'pl', 'Ktory sygnal nalezy do partner reporting?', '[{"id":"a","label":"Blocked reasons i review backlog."},{"id":"b","label":"Ulubione kolory."},{"id":"c","label":"Zoom przegladarki."},{"id":"d","label":"Tapeta pulpitu."}]', 'a', 70)
ON CONFLICT DO NOTHING;
