-- Bundle 28 (T097) — Partner Certification (academy + exam attempts + certificates + incentive floor)

-- Canonical tier (for incentives) is uppercase tier in partner_commission_rates.
ALTER TABLE partner_organizations
  ADD COLUMN IF NOT EXISTS tier_override TEXT,
  ADD COLUMN IF NOT EXISTS certification_tier_floor TEXT;

-- Extend partner_certifications with exam attempt tracking (audit)
ALTER TABLE partner_certifications
  ADD COLUMN IF NOT EXISTS passed_exam_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;

-- Relax/extend certification_type CHECK to allow sales certification track.
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
  CHECK (certification_type IN ('foundation', 'sales', 'pmo_standards', 'ai_modules', 'assessment_specialist', 'advanced', 'compliance'));

-- Add module metadata needed by Partner Portal UI
ALTER TABLE partner_learning_modules
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS required_for_certification BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS minutes INTEGER;

-- Exam question bank (minimum 20 Q per language for sales certification)
CREATE TABLE IF NOT EXISTS partner_exam_questions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  certification_type TEXT NOT NULL, -- sales
  language TEXT NOT NULL DEFAULT 'en',
  question_text TEXT NOT NULL,
  options_json JSONB NOT NULL, -- [{id,label}]
  correct_option_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_exam_questions_type_lang
  ON partner_exam_questions(certification_type, language);

-- Attempts (audit)
-- NOTE (strict-schema repair, 2026-08): certification_id/partner_org_id were
-- declared TEXT here but partner_certifications.id / partner_organizations.id
-- are UUID (215_partner_portal.sql) — Postgres refuses to create a FK across
-- mismatched types, so this CREATE TABLE could never succeed against a real
-- Postgres catalog regardless of migration order (fresh or otherwise). No
-- live table/rows exist under the old TEXT declaration to protect (the
-- statement always errored before committing), so retyping to UUID here is
-- replay-safe: it just lets the table finally get created.
CREATE TABLE IF NOT EXISTS partner_certification_attempts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  certification_id UUID NOT NULL REFERENCES partner_certifications(id) ON DELETE CASCADE,
  partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMP WITH TIME ZONE NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE,
  language TEXT NOT NULL DEFAULT 'en',
  questions_json JSONB NOT NULL, -- [{questionId}]
  answers_json JSONB, -- {questionId: optionId}
  score_percent INTEGER,
  passed BOOLEAN,
  ip_hash TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_partner_cert_attempts_cert_time
  ON partner_certification_attempts(certification_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_cert_attempts_org_user_time
  ON partner_certification_attempts(partner_org_id, user_id, started_at DESC);

-- Certificates (revocable)
-- Same UUID-vs-TEXT FK mismatch fix as partner_certification_attempts above.
CREATE TABLE IF NOT EXISTS partner_certificates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  certification_id UUID NOT NULL REFERENCES partner_certifications(id) ON DELETE CASCADE,
  certificate_type TEXT NOT NULL, -- sales
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by TEXT,
  revoke_reason TEXT,
  share_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_certificates_org_time
  ON partner_certificates(partner_org_id, earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_certificates_type
  ON partner_certificates(certificate_type);

-- Seed learning modules (EN + PL) for Sales certification baseline (MUST)
INSERT INTO partner_learning_modules
  (id, name, description, certification_type, module_order, duration_minutes, content_type, content_url, is_active, category, required_for_certification, language, minutes)
VALUES
  ('9f6d3e2a-1b3c-4a5d-9e7f-2c3d4e5f6011', 'Sales Certification — Discovery', 'Discovery questions, qualification and mapping needs to modules.', 'sales', 1, 35, 'document', NULL, TRUE, 'SALES', TRUE, 'en', 35),
  ('2d3e4f50-6a7b-48c9-9d0e-1f2a3b4c5d61', 'Sales Certification — Objections', 'Top objections: pricing, AI, security, data residency, PMO already exists.', 'sales', 2, 30, 'document', NULL, TRUE, 'SALES', TRUE, 'en', 30),
  ('3c4d5e6f-7081-4a92-9b03-4c5d6e7f8091', 'Sales Certification — Trial → Paid', 'How to guide a trial to paid with clear outcomes and next steps.', 'sales', 3, 25, 'document', NULL, TRUE, 'SALES', TRUE, 'en', 25),
  ('4d5e6f70-8192-4b03-9c14-5d6e7f8091a2', 'Sales Certification — Security & Legal', 'Security/compliance basics and safe claims.', 'sales', 4, 20, 'document', NULL, TRUE, 'COMPLIANCE', TRUE, 'en', 20),

  ('5e6f7081-92a3-4c14-9d25-6e7f8091a2b3', 'Certyfikacja sprzedażowa — Discovery', 'Pytania discovery, kwalifikacja i mapowanie potrzeb na moduły.', 'sales', 1, 35, 'document', NULL, TRUE, 'SALES', TRUE, 'pl', 35),
  ('6f708192-a3b4-4d25-9e36-7f8091a2b3c4', 'Certyfikacja sprzedażowa — Obiekcje', 'Top obiekcje: pricing, AI, security, rezydencja danych, “mamy PMO”.', 'sales', 2, 30, 'document', NULL, TRUE, 'SALES', TRUE, 'pl', 30),
  ('708192a3-b4c5-4e36-9f47-8091a2b3c4d5', 'Certyfikacja sprzedażowa — Trial → Paid', 'Prowadzenie trialu do paid z mierzalnymi rezultatami.', 'sales', 3, 25, 'document', NULL, TRUE, 'SALES', TRUE, 'pl', 25),
  ('8192a3b4-c5d6-4f47-9058-91a2b3c4d5e6', 'Certyfikacja sprzedażowa — Security & Legal', 'Podstawy security/compliance i safe claims.', 'sales', 4, 20, 'document', NULL, TRUE, 'COMPLIANCE', TRUE, 'pl', 20)
ON CONFLICT (id) DO NOTHING;

-- Seed exam questions (20 EN + 20 PL). Keeping them short and “safe-claim” oriented.
-- EN
INSERT INTO partner_exam_questions (certification_type, language, question_text, options_json, correct_option_id)
SELECT 'sales', 'en', q, o::jsonb, c FROM (
  VALUES
    ('Which statement is a safe claim?', '[{"id":"a","label":"Consultify guarantees 30% cost reduction in 90 days."},{"id":"b","label":"Consultify helps structure discovery and track progress with evidence-backed artifacts."},{"id":"c","label":"Consultify automatically replaces your PMO team."},{"id":"d","label":"Consultify includes every integration out of the box."}]', 'b'),
    ('What is the primary goal of a discovery call?', '[{"id":"a","label":"Pitch every feature."},{"id":"b","label":"Collect facts, constraints, unknowns and align on success criteria."},{"id":"c","label":"Negotiate contract terms only."},{"id":"d","label":"Avoid discussing risks."}]', 'b'),
    ('Which is the best next step when data is missing?', '[{"id":"a","label":"Invent a plausible answer."},{"id":"b","label":"Mark as unknown and ask a short follow-up question."},{"id":"c","label":"Ignore the gap."},{"id":"d","label":"Promise future automation."}]', 'b'),
    ('What should be avoided in partner messaging?', '[{"id":"a","label":"Evidence-backed outcomes."},{"id":"b","label":"Clear scope boundaries."},{"id":"c","label":"Over-claiming non-existent features."},{"id":"d","label":"Security disclaimers."}]', 'c'),
    ('A CFO objection: “Is AI safe?” Best response includes:', '[{"id":"a","label":"No risks at all."},{"id":"b","label":"Explain controls, data handling, and align with security policies."},{"id":"c","label":"We train on all customer data by default."},{"id":"d","label":"Ignore the question."}]', 'b'),
    ('Trial-to-paid success metric should be:', '[{"id":"a","label":"Number of meetings."},{"id":"b","label":"A measurable outcome agreed upfront (e.g. % questions answered, report generated)."},{"id":"c","label":"AI tokens used."},{"id":"d","label":"Time spent in UI."}]', 'b'),
    ('What is the recommended tone in outreach emails?', '[{"id":"a","label":"Aggressive urgency and hype."},{"id":"b","label":"Neutral, relevant, compliance-friendly, with opt-out."},{"id":"c","label":"No unsubscribe link."},{"id":"d","label":"All caps subject lines."}]', 'b'),
    ('Which persona is most interested in governance and decision cadence?', '[{"id":"a","label":"COO / PMO."},{"id":"b","label":"Intern."},{"id":"c","label":"Social media manager."},{"id":"d","label":"Retail cashier."}]', 'a'),
    ('What’s the best way to handle “We already have a PMO”?', '[{"id":"a","label":"PMO is useless."},{"id":"b","label":"Position as augmentation: evidence, workflow, faster alignment; ask about pain points."},{"id":"c","label":"Promise replacement."},{"id":"d","label":"End the call."}]', 'b'),
    ('Which is a compliant CTA?', '[{"id":"a","label":"Buy now or else."},{"id":"b","label":"Book a call / start trial; clear next steps."},{"id":"c","label":"Share your password."},{"id":"d","label":"Forward to 20 people."}]', 'b'),
    ('What should a partner do before sharing a deck?', '[{"id":"a","label":"Edit claims to add missing features."},{"id":"b","label":"Use latest version from Resources and keep safe claims."},{"id":"c","label":"Remove security slide."},{"id":"d","label":"Change branding randomly."}]', 'b'),
    ('If a prospect asks about data residency, answer should:', '[{"id":"a","label":"Make up a region."},{"id":"b","label":"State supported regions/policies or say it depends and confirm."},{"id":"c","label":"Refuse to discuss."},{"id":"d","label":"Guarantee any country."}]', 'b'),
    ('A good discovery question is:', '[{"id":"a","label":"Do you like AI?"},{"id":"b","label":"What decisions are currently slow or contested, and why?"},{"id":"c","label":"What’s your favorite color?"},{"id":"d","label":"Can you sign today?"}]', 'b'),
    ('Evidence in sponsor-ready output should come from:', '[{"id":"a","label":"Only imagination."},{"id":"b","label":"Interview answers, transcripts, and approved insights."},{"id":"c","label":"Rumors."},{"id":"d","label":"Competitor websites."}]', 'b'),
    ('Best practice for retakes:', '[{"id":"a","label":"Unlimited attempts instantly."},{"id":"b","label":"Cooldown and attempt limits with audit."},{"id":"c","label":"No logging."},{"id":"d","label":"Share answers publicly."}]', 'b'),
    ('Which is an acceptable promise?', '[{"id":"a","label":"Guaranteed ROI."},{"id":"b","label":"We will help create a structured, evidence-backed baseline."},{"id":"c","label":"100% automation of all operations."},{"id":"d","label":"Immediate compliance certification."}]', 'b'),
    ('When a module is completed, the system should:', '[{"id":"a","label":"Not track anything."},{"id":"b","label":"Persist progress and timestamps for audit."},{"id":"c","label":"Delete previous progress."},{"id":"d","label":"Lock the portal."}]', 'b'),
    ('What is the “facts-only” principle?', '[{"id":"a","label":"Only recommendations."},{"id":"b","label":"Store facts and unknowns; avoid invented plans in captured data."},{"id":"c","label":"Exclude constraints."},{"id":"d","label":"Only marketing statements."}]', 'b'),
    ('The partner toolkit should be:', '[{"id":"a","label":"Static forever."},{"id":"b","label":"Versioned, always current, and gated by tier."},{"id":"c","label":"Shared via random links."},{"id":"d","label":"Untracked downloads."}]', 'b'),
    ('One-click unsubscribe ensures:', '[{"id":"a","label":"More spam."},{"id":"b","label":"Compliance and suppression for future sends."},{"id":"c","label":"Higher bounce rate."},{"id":"d","label":"Ignoring lawful basis."}]', 'b')
) AS t(q,o,c)
WHERE NOT EXISTS (
  SELECT 1 FROM partner_exam_questions q
  WHERE q.certification_type = 'sales' AND q.language='en'
);

-- PL
INSERT INTO partner_exam_questions (certification_type, language, question_text, options_json, correct_option_id)
SELECT 'sales', 'pl', q, o::jsonb, c FROM (
  VALUES
    ('Które stwierdzenie jest “safe claim”?', '[{"id":"a","label":"Consultify gwarantuje 30% redukcji kosztów w 90 dni."},{"id":"b","label":"Consultify pomaga uporządkować discovery i śledzić postęp w oparciu o artefakty i dowody."},{"id":"c","label":"Consultify automatycznie zastąpi Twoje PMO."},{"id":"d","label":"Consultify ma wszystkie integracje out-of-the-box."}]', 'b'),
    ('Jaki jest główny cel rozmowy discovery?', '[{"id":"a","label":"Sprzedać wszystkie funkcje."},{"id":"b","label":"Zebrać fakty, ograniczenia, niewiadome i uzgodnić kryteria sukcesu."},{"id":"c","label":"Negocjować tylko umowę."},{"id":"d","label":"Unikać ryzyk."}]', 'b'),
    ('Co zrobić, gdy brakuje danych?', '[{"id":"a","label":"Wymyślić odpowiedź."},{"id":"b","label":"Oznaczyć jako unknown i zadać krótkie pytanie doprecyzowujące."},{"id":"c","label":"Zignorować lukę."},{"id":"d","label":"Obiecać automatyzację."}]', 'b'),
    ('Czego unikać w komunikacji partnera?', '[{"id":"a","label":"Wniosków opartych o dowody."},{"id":"b","label":"Jasnych granic scope."},{"id":"c","label":"Over-claimingu funkcji, których nie ma."},{"id":"d","label":"Notki o security."}]', 'c'),
    ('Obiekcja CFO: “Czy AI jest bezpieczne?” Najlepsza odpowiedź:', '[{"id":"a","label":"Nie ma żadnego ryzyka."},{"id":"b","label":"Wyjaśnić kontrolki, obsługę danych i odwołać się do polityk bezpieczeństwa."},{"id":"c","label":"Trenujemy na danych klientów domyślnie."},{"id":"d","label":"Zignorować."}]', 'b'),
    ('Metryka trial→paid powinna być:', '[{"id":"a","label":"Liczba spotkań."},{"id":"b","label":"Mierzalny rezultat uzgodniony na starcie (np. raport, % odpowiedzi, artefakt)."},{"id":"c","label":"Liczba tokenów AI."},{"id":"d","label":"Czas w UI."}]', 'b'),
    ('Ton w outreach emailach:', '[{"id":"a","label":"Hype i presja."},{"id":"b","label":"Neutralny, relewantny, zgodny z compliance, z opt-out."},{"id":"c","label":"Bez unsubscribe."},{"id":"d","label":"CAPS LOCK."}]', 'b'),
    ('Która persona najczęściej interesuje się governance i decyzjami?', '[{"id":"a","label":"COO / PMO."},{"id":"b","label":"Stażysta."},{"id":"c","label":"Social media manager."},{"id":"d","label":"Kasjer."}]', 'a'),
    ('Jak odpowiedzieć na “Mamy już PMO”?', '[{"id":"a","label":"PMO jest bez sensu."},{"id":"b","label":"Pozycjonować jako augmentację: dowody, workflow, szybsze uzgodnienia; dopytać o pain points."},{"id":"c","label":"Obiecać zastąpienie."},{"id":"d","label":"Zakończyć rozmowę."}]', 'b'),
    ('Zgodne CTA to:', '[{"id":"a","label":"Kup teraz albo…”"},{"id":"b","label":"Umów call / start trial; jasne next steps."},{"id":"c","label":"Podaj hasło."},{"id":"d","label":"Wyślij do 20 osób."}]', 'b'),
    ('Przed udostępnieniem decka partner powinien:', '[{"id":"a","label":"Dodać claimy o brakujących funkcjach."},{"id":"b","label":"Użyć najnowszej wersji z Resources i trzymać się safe claims."},{"id":"c","label":"Usunąć slajd o security."},{"id":"d","label":"Losowo zmienić branding."}]', 'b'),
    ('Pytanie o rezydencję danych:', '[{"id":"a","label":"Wymyślić region."},{"id":"b","label":"Podać wspierane regiony/polityki lub powiedzieć “to zależy” i potwierdzić."},{"id":"c","label":"Odmówić."},{"id":"d","label":"Zagwarantować każdy kraj."}]', 'b'),
    ('Dobre pytanie discovery to:', '[{"id":"a","label":"Lubisz AI?"},{"id":"b","label":"Które decyzje są dziś najwolniejsze lub sporne i dlaczego?"},{"id":"c","label":"Jaki masz ulubiony kolor?"},{"id":"d","label":"Podpiszesz dziś?"}]', 'b'),
    ('Evidence w raporcie powinno pochodzić z:', '[{"id":"a","label":"Wyobraźni."},{"id":"b","label":"Odpowiedzi wywiadów, transkryptów i zatwierdzonych insightów."},{"id":"c","label":"Plotek."},{"id":"d","label":"Stron konkurencji."}]', 'b'),
    ('Retake policy:', '[{"id":"a","label":"Nielimitowane próby od razu."},{"id":"b","label":"Cooldown i limity podejść z audytem."},{"id":"c","label":"Bez logów."},{"id":"d","label":"Publiczne odpowiedzi."}]', 'b'),
    ('Akceptowalna obietnica:', '[{"id":"a","label":"Gwarantowany ROI."},{"id":"b","label":"Pomagamy zbudować uporządkowaną, evidence‑backed bazę faktów."},{"id":"c","label":"100% automatyzacji operacji."},{"id":"d","label":"Natychmiastowa certyfikacja compliance."}]', 'b'),
    ('Po ukończeniu modułu system powinien:', '[{"id":"a","label":"Nic nie śledzić."},{"id":"b","label":"Zapisać postęp i timestampy dla audytu."},{"id":"c","label":"Skasować postęp."},{"id":"d","label":"Zablokować portal."}]', 'b'),
    ('Zasada facts‑only oznacza:', '[{"id":"a","label":"Tylko rekomendacje."},{"id":"b","label":"Zapis faktów i niewiadomych; bez wymyślonych planów."},{"id":"c","label":"Brak ograniczeń."},{"id":"d","label":"Tylko marketing."}]', 'b'),
    ('Toolkit partnerski powinien być:', '[{"id":"a","label":"Stały na zawsze."},{"id":"b","label":"Wersjonowany, zawsze aktualny i gated po tier."},{"id":"c","label":"Losowe linki."},{"id":"d","label":"Bez audytu pobrań."}]', 'b'),
    ('One‑click unsubscribe zapewnia:', '[{"id":"a","label":"Więcej spamu."},{"id":"b","label":"Compliance i suppression dla kolejnych wysyłek."},{"id":"c","label":"Więcej bounce."},{"id":"d","label":"Ignorowanie lawful basis."}]', 'b')
) AS t(q,o,c)
WHERE NOT EXISTS (
  SELECT 1 FROM partner_exam_questions q
  WHERE q.certification_type = 'sales' AND q.language='pl'
);

