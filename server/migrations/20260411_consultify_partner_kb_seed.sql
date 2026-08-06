-- Purpose: Seed public Consultify partner knowledge articles and case studies.

INSERT INTO kb_categories (id, slug, icon, sort_order, is_active, is_public)
VALUES
  ('kb-cat-consultify-partner-program', 'consultify-partner-program', 'Handshake', 31, 1, 1),
  ('kb-cat-consultify-partner-operations', 'consultify-partner-operations', 'ShieldCheck', 32, 1, 1),
  ('kb-cat-consultify-partner-case-studies', 'consultify-partner-case-studies', 'BriefcaseBusiness', 33, 1, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO kb_category_translations (id, category_id, language, name, description)
VALUES
  ('kb-cat-consultify-partner-program-en', 'kb-cat-consultify-partner-program', 'en', 'Partner Program', 'How the program works, who it is for, and what the application path looks like.'),
  ('kb-cat-consultify-partner-program-pl', 'kb-cat-consultify-partner-program', 'pl', 'Program partnerski', 'Jak dziala program, dla kogo jest i jak wyglada sciezka aplikacji.'),
  ('kb-cat-consultify-partner-operations-en', 'kb-cat-consultify-partner-operations', 'en', 'Partner Operations', 'Activation, payouts, certification, FAQ, and escalation logic for active partners.'),
  ('kb-cat-consultify-partner-operations-pl', 'kb-cat-consultify-partner-operations', 'pl', 'Operacje partnera', 'Aktywacja, payouty, certyfikacja, FAQ i zasady eskalacji dla aktywnych partnerow.'),
  ('kb-cat-consultify-partner-case-studies-en', 'kb-cat-consultify-partner-case-studies', 'en', 'Partner Case Studies', 'Proof-layer narratives that show how partners create commercial and delivery value.'),
  ('kb-cat-consultify-partner-case-studies-pl', 'kb-cat-consultify-partner-case-studies', 'pl', 'Case studies partnera', 'Narracje proof-layer pokazujace, jak partnerzy buduja wartosc handlowa i delivery.')
ON CONFLICT (category_id, language) DO NOTHING;

INSERT INTO kb_collections (
  id, slug, parent_collection_id, visibility, featured, sort_order, status
)
VALUES
  ('kb-coll-consultify-partner', 'consultify-partner-program', NULL, 'public', TRUE, 31, 'active'),
  ('kb-coll-consultify-partner-program', 'consultify-partner-program-guides', 'kb-coll-consultify-partner', 'public', TRUE, 1, 'active'),
  ('kb-coll-consultify-partner-operations', 'consultify-partner-operations-guides', 'kb-coll-consultify-partner', 'public', TRUE, 2, 'active'),
  ('kb-coll-consultify-partner-cases', 'consultify-partner-case-studies', 'kb-coll-consultify-partner', 'public', TRUE, 3, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO kb_collection_translations (id, collection_id, language, title, description)
VALUES
  ('kb-coll-consultify-partner-en', 'kb-coll-consultify-partner', 'en', 'Consultify Partner Program', 'Canonical public partner knowledge for discovery, application, operations, and proof.'),
  ('kb-coll-consultify-partner-pl', 'kb-coll-consultify-partner', 'pl', 'Consultify Partner Program', 'Kanoniczna publiczna wiedza partnera: discovery, aplikacja, operacje i proof layer.'),
  ('kb-coll-consultify-partner-program-en', 'kb-coll-consultify-partner-program', 'en', 'Program Guides', 'Program overview, application flow, and qualification logic.'),
  ('kb-coll-consultify-partner-program-pl', 'kb-coll-consultify-partner-program', 'pl', 'Przewodniki programu', 'Overview programu, application flow i logika kwalifikacji.'),
  ('kb-coll-consultify-partner-operations-en', 'kb-coll-consultify-partner-operations', 'en', 'Operations Guides', 'Activation, payouts, certification, and partner FAQ.'),
  ('kb-coll-consultify-partner-operations-pl', 'kb-coll-consultify-partner-operations', 'pl', 'Przewodniki operacyjne', 'Aktywacja, payouty, certyfikacja i FAQ partnera.'),
  ('kb-coll-consultify-partner-cases-en', 'kb-coll-consultify-partner-cases', 'en', 'Partner Case Studies', 'Real proof narratives for sponsor and operator conversations.'),
  ('kb-coll-consultify-partner-cases-pl', 'kb-coll-consultify-partner-cases', 'pl', 'Case studies partnera', 'Realne proof narratives do rozmow sponsorskich i operatorskich.')
ON CONFLICT (collection_id, language) DO NOTHING;

INSERT INTO kb_articles (
  id,
  category_id,
  slug,
  status,
  is_featured,
  is_public,
  reading_time_minutes,
  related_modules,
  target_audience,
  created_at,
  updated_at
)
VALUES
  ('kb-consultify-partner-program-overview', 'kb-cat-consultify-partner-program', 'partner-program-overview', 'published', 1, 1, 6, '["partner","program","overview"]', '["Partner Lead","Sales Lead","Managing Partner"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-consultify-partner-application-flow', 'kb-cat-consultify-partner-program', 'partner-application-flow', 'published', 1, 1, 7, '["partner","application","onboarding"]', '["Partner Lead","Business Development"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-consultify-partner-payout-and-activation', 'kb-cat-consultify-partner-operations', 'partner-payout-and-activation', 'published', 1, 1, 7, '["activation","payout","operations"]', '["Partner Ops","Finance","Delivery Lead"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-consultify-partner-certification-explainer', 'kb-cat-consultify-partner-operations', 'partner-certification-explainer', 'published', 1, 1, 7, '["academy","certification","tier"]', '["Partner Lead","Academy Owner","Delivery Lead"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-consultify-partner-faq', 'kb-cat-consultify-partner-operations', 'partner-faq', 'published', 0, 1, 6, '["faq","partner","operations"]', '["Partner Lead","Commercial Lead"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-consultify-partner-case-study-operations', 'kb-cat-consultify-partner-case-studies', 'partner-case-study-operations-rollout', 'published', 1, 1, 5, '["case-study","operations","proof"]', '["Partner Lead","COO","Delivery Lead"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-consultify-partner-case-study-cfo', 'kb-cat-consultify-partner-case-studies', 'partner-case-study-cfo-governance', 'published', 1, 1, 5, '["case-study","finance","proof"]', '["Partner Lead","CFO","Strategy Lead"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO kb_article_translations (id, article_id, language, title, summary, content)
VALUES
  (
    'kb-consultify-partner-program-overview-en',
    'kb-consultify-partner-program-overview',
    'en',
    'Consultify Partner Program Overview',
    'What the program is, who it fits, and how public docs, onboarding, academy, certification, and payouts fit together.',
    '# Consultify Partner Program Overview

Consultify''s partner program is designed for operators, advisors, implementation leaders, and commercial teams that want a governed path from discovery to partner revenue.

## What the program is for

The program is not just a referral badge. It is a structured path that helps a partner:

- explain the Consultify value proposition with safe claims
- qualify whether a lead should stay self-serve or move to direct commercial handling
- complete shared onboarding
- activate delivery and payout readiness
- progress through academy and certification

## The canonical public path

The public path is intentionally simple:

1. Discover the program and review the operating logic.
2. Start the partner application.
3. Complete the shared onboarding flow.
4. Activate partner operations and payout readiness.
5. Progress through academy and certification to unlock stronger trust signals.

## Why the model is hybrid

Public knowledge lives in the Consultify docs because prospects and new partners need a canonical source of truth before they log in.

Partner-only enablement lives in the portal because structured learning, review states, and certificates should be visible only to active partners and operators.

## When direct contact is the right next step

Use the self-serve path when the motion is standard.

Escalate to direct contact when:

- the deal requires custom commercial terms
- governance expectations are unusually complex
- the partner needs an exception path toward premium tier motion

## What happens after application

Application is not the end state. It is the handoff into onboarding, academy, and operational readiness. The partner portal then becomes the place where progress, blockers, review states, and certificates are visible.'
  ),
  (
    'kb-consultify-partner-program-overview-pl',
    'kb-consultify-partner-program-overview',
    'pl',
    'Overview programu partnerskiego Consultify',
    'Czym jest program, dla kogo pasuje oraz jak lacza sie public docs, onboarding, academy, certyfikacja i payouty.',
    '# Overview programu partnerskiego Consultify

Program partnerski Consultify jest zaprojektowany dla operatorow, doradcow, liderow wdrozen i zespolow komercyjnych, ktore chca miec governed path od discovery do przychodu partnera.

## Do czego sluzy program

To nie jest tylko referral badge. To uporzadkowana sciezka, ktora pomaga partnerowi:

- tlumaczyc wartosc Consultify przy uzyciu safe claims
- kwalifikowac, czy lead powinien zostac self-serve, czy przejsc do direct commercial handling
- przejsc wspolny onboarding
- aktywowac delivery i payout readiness
- rozwijac academy i certyfikacje

## Kanoniczna publiczna sciezka

Sciezka publiczna ma byc prosta:

1. Odkryj program i zrozum operating logic.
2. Rozpocznij partner application.
3. Skoncz wspolny onboarding flow.
4. Aktywuj partner operations i payout readiness.
5. Przechodz przez academy i certyfikacje, aby budowac trust signal.

## Dlaczego model jest hybrydowy

Public knowledge zyje w docs Consultify, bo prospect i nowy partner potrzebuja kanonicznego source of truth zanim sie zaloguja.

Partner-only enablement zyje w portalu, bo structured learning, review states i certificates powinny byc widoczne tylko dla aktywnych partnerow i operatorow.

## Kiedy direct contact jest dobrym next step

Uzyj self-serve, gdy motion jest standardowy.

Przejdz do direct contact, gdy:

- deal wymaga custom commercial terms
- governance expectations sa nietypowo zlozone
- partner potrzebuje exception path do premium tier motion

## Co dzieje sie po application

Application nie jest koncem procesu. To handoff do onboardingu, academy i operational readiness. Potem partner portal staje sie miejscem, gdzie widac progress, blockers, review states i certificates.'
  ),
  (
    'kb-consultify-partner-application-flow-en',
    'kb-consultify-partner-application-flow',
    'en',
    'Partner Application Flow',
    'How the shared application flow works across LP and in-product entry points, and where custom handling begins.',
    '# Partner Application Flow

The program uses one shared application flow whether the partner starts from the public landing page or from inside the product.

## Why one flow matters

One governed path means:

- no split experience between marketing and product
- consistent qualification inputs
- easier operator review
- cleaner handoff to activation, payout, and academy

## The standard automation path

The standard application path should collect:

- partner identity and company basics
- contact details and role
- expected go-to-market motion
- geography and delivery scope
- why the partner wants to join now

Once submitted, the flow moves into a shared onboarding state rather than a disconnected email thread.

## The custom-conditions path

Not every partner should stay inside the standard path.

Switch to direct contact when:

- the commercial model is non-standard
- payout or billing requires special handling
- a premium strategic partnership is being discussed

The contact path is not a failure of automation. It is the governed exception path.

## What good completion looks like

A completed application leaves the team with enough signal to decide the next action:

- approve and move to activation
- request clarification
- route to direct partner-team handling'
  ),
  (
    'kb-consultify-partner-application-flow-pl',
    'kb-consultify-partner-application-flow',
    'pl',
    'Partner Application Flow',
    'Jak dziala wspolny flow aplikacji z LP i z produktu oraz gdzie zaczyna sie custom handling.',
    '# Partner Application Flow

Program korzysta z jednego wspolnego flow aplikacji niezaleznie od tego, czy partner startuje z publicznego LP, czy z wnętrza produktu.

## Dlaczego jeden flow jest wazny

Jedna governed sciezka oznacza:

- brak rozjazdu miedzy marketingiem a produktem
- spojne inputs do kwalifikacji
- prostszy operator review
- czystszy handoff do activation, payout i academy

## Standardowa sciezka automatyzacji

Standardowy path powinien zbierac:

- tozsamosc partnera i podstawy firmy
- dane kontaktowe i role
- oczekiwany go-to-market motion
- geografie i scope delivery
- powod, dla ktorego partner dolacza teraz

Po wyslaniu flow przechodzi do wspolnego onboardingu zamiast do nieuporzadkowanego watku emailowego.

## Sciezka custom conditions

Nie kazdy partner powinien zostac w standardowym path.

Przejdz do direct contact, gdy:

- model komercyjny jest niestandardowy
- payout albo billing wymaga specjalnej obslugi
- rozmawiamy o premium strategic partnership

Sciezka contact nie oznacza porazki automatyzacji. To governed exception path.

## Jak wyglada dobre zamkniecie

Skonczona aplikacja zostawia zespolowi wystarczajacy sygnal, aby podjac kolejny krok:

- zatwierdzic i przejsc do activation
- poprosic o doprecyzowanie
- przekierowac do partner team'
  ),
  (
    'kb-consultify-partner-payout-and-activation-en',
    'kb-consultify-partner-payout-and-activation',
    'en',
    'Activation and Payout Readiness',
    'The operational checkpoints between approval, delivery activation, and payout eligibility.',
    '# Activation and Payout Readiness

Approval alone does not make a partner payout-ready.

## Activation comes first

Activation means the partner can operate cleanly:

- onboarding completed
- essential resources available
- academy path visible
- billing and payout basics understood

## What payout readiness means

Payout readiness is a governed state, not a button.

A partner should be able to show:

- correct billing details
- the expected payout method
- no unresolved compliance blockers
- a visible status for certification and review where relevant

## Common blockers

The most common blockers are operational rather than commercial:

- missing billing setup
- unclear payout route
- incomplete certification progression
- unreviewed exceptions

## When an operator should step in

Operator handling is appropriate when the portal shows a blocker that cannot be resolved inside the standard self-serve path.'
  ),
  (
    'kb-consultify-partner-payout-and-activation-pl',
    'kb-consultify-partner-payout-and-activation',
    'pl',
    'Activation i payout readiness',
    'Operational checkpoints miedzy approval, aktywacja delivery i payout eligibility.',
    '# Activation i payout readiness

Sam approval nie czyni partnera payout-ready.

## Najpierw activation

Activation oznacza, ze partner moze pracowac czysto:

- onboarding jest zakonczony
- podstawowe resources sa dostepne
- academy path jest widoczny
- billing i payout basics sa zrozumiale

## Co oznacza payout readiness

Payout readiness to governed state, a nie sam przycisk.

Partner powinien umiec pokazac:

- poprawne dane billingowe
- oczekiwana metode payout
- brak nierozwiazanych compliance blockers
- widoczny status certyfikacji i review tam, gdzie jest potrzebny

## Najczestsze blockers

Najczestsze blockers sa raczej operacyjne niz komercyjne:

- brak billing setup
- niejasna sciezka payout
- niepelna certyfikacja
- nieprzejrzane exceptions

## Kiedy operator powinien wejsc

Operator handling jest potrzebny wtedy, gdy portal pokazuje blocker, ktorego nie da sie zamknac w standardowej self-serve sciezce.'
  ),
  (
    'kb-consultify-partner-certification-explainer-en',
    'kb-consultify-partner-certification-explainer',
    'en',
    'Partner Academy and Certification',
    'How tracks, levels, reviews, and certificates support partner trust and tier progression.',
    '# Partner Academy and Certification

Certification is the structured readiness layer of the partner program.

## Tracks and levels

The program supports three tracks:

- sales
- delivery
- strategic

Each track can progress across:

- foundation
- practitioner
- advanced

## What certification is supposed to signal

Certification should show that a partner can operate with governed quality, not that they watched a few videos.

The runtime can therefore combine:

- module completion
- exam-based verification
- manual review for case-defense levels

## Why review states matter

Not every certification should auto-complete.

Advanced or exception-heavy motions often need operator review before the status becomes a credible trust signal.

## How certification connects to tiers

Certification is not the whole tier model, but it supports tier progression by making partner capability more visible and auditable.'
  ),
  (
    'kb-consultify-partner-certification-explainer-pl',
    'kb-consultify-partner-certification-explainer',
    'pl',
    'Partner Academy i certyfikacja',
    'Jak tracki, poziomy, review i certificates wspieraja zaufanie do partnera i tier progression.',
    '# Partner Academy i certyfikacja

Certyfikacja jest structured readiness layer programu partnerskiego.

## Tracki i poziomy

Program wspiera trzy tracki:

- sales
- delivery
- strategic

Kazdy track moze przechodzic przez:

- foundation
- practitioner
- advanced

## Co ma sygnalizowac certyfikacja

Certyfikacja ma pokazywac, ze partner pracuje z governed quality, a nie tylko obejrzal kilka modulow.

Dlatego runtime moze laczyc:

- completion modulow
- verification przez exam
- manual review dla case-defense levels

## Dlaczego review states sa wazne

Nie kazda certyfikacja powinna domykac sie automatycznie.

Zaawansowane albo exception-heavy motions czesto potrzebuja operator review zanim status stanie sie wiarygodnym trust signal.

## Jak certyfikacja laczy sie z tierami

Certyfikacja nie jest calym tier modelem, ale wspiera tier progression, bo czyni capability partnera widoczniejszym i audytowalnym.'
  ),
  (
    'kb-consultify-partner-faq-en',
    'kb-consultify-partner-faq',
    'en',
    'Partner FAQ',
    'Short answers to the most common friction points in partner discovery, onboarding, certification, and payouts.',
    '# Partner FAQ

## Is the application flow different from LP and in-product?

No. Both entry points should end in the same governed application and onboarding path.

## When should a partner ask for direct contact?

When the motion requires custom commercial terms, premium governance, or operator-led exception handling.

## Do I need certification before I can start working?

No, but academy and certification increase trust, clarify readiness, and reduce delivery and payout blockers over time.

## Why does the portal show review or blocked states?

Because the program is designed to make blockers explicit instead of hiding them in emails or spreadsheets.

## Are case studies optional?

No. They are part of the proof layer that helps a partner explain why the program works in real operating conditions.'
  ),
  (
    'kb-consultify-partner-faq-pl',
    'kb-consultify-partner-faq',
    'pl',
    'Partner FAQ',
    'Krotkie odpowiedzi na najczestsze friction points w discovery, onboardingu, certyfikacji i payoutach.',
    '# Partner FAQ

## Czy application flow rozni sie miedzy LP i produktem?

Nie. Oba wejscia powinny konczyc sie w tym samym governed application i onboarding path.

## Kiedy partner powinien poprosic o direct contact?

Gdy motion wymaga custom commercial terms, premium governance albo operator-led exception handling.

## Czy trzeba miec certyfikacje, zeby zaczac pracowac?

Nie, ale academy i certyfikacja buduja trust, porzadkuja readiness i z czasem redukuja delivery oraz payout blockers.

## Dlaczego portal pokazuje review albo blocked states?

Bo program ma ujawniac blockers zamiast ukrywac je w emailach i arkuszach.

## Czy case studies sa opcjonalne?

Nie. Sa czescia proof layer, ktora pomaga partnerowi pokazac, dlaczego program dziala w realnych warunkach operacyjnych.'
  ),
  (
    'kb-consultify-partner-case-study-operations-en',
    'kb-consultify-partner-case-study-operations',
    'en',
    'Case Study: Operations Rollout Motion',
    'A partner turns a cautious operations team into an activated client by using proof, onboarding discipline, and academy readiness.',
    '# Case Study: Operations Rollout Motion

A regional implementation partner approached a COO-led prospect that was interested in faster execution but skeptical of abstract transformation language.

## What changed the conversation

The partner did not start with a feature pitch.

They used:

- a concise program overview
- a concrete operations-focused case narrative
- a shared application and onboarding path

## Why the motion worked

The COO could see what would happen next after the first yes:

- who would own the application
- what onboarding would look like
- how partner delivery would stay governed
- what had to happen before payouts or expansion

## Commercial impact

The proof layer shortened trust-building, reduced ambiguity, and made the partner look operationally credible.'
  ),
  (
    'kb-consultify-partner-case-study-operations-pl',
    'kb-consultify-partner-case-study-operations',
    'pl',
    'Case study: operations rollout motion',
    'Partner zamienia ostrozny zespol operacyjny w aktywowanego klienta dzieki proof, onboarding discipline i academy readiness.',
    '# Case study: operations rollout motion

Regionalny partner wdrozeniowy wszedl do prospecta prowadzonego przez COO, ktory chcial szybszej egzekucji, ale byl sceptyczny wobec abstrakcyjnego jezyka transformacji.

## Co zmienilo rozmowe

Partner nie zaczal od pitchu funkcji.

Uzyto:

- zgrabnego program overview
- konkretnej case narrative z perspektywy operations
- wspolnego application i onboarding path

## Dlaczego motion zadzialal

COO widzial, co stanie sie po pierwszym „tak”:

- kto bedzie ownerem application
- jak bedzie wygladal onboarding
- jak partner delivery zostanie governed
- co musi wydarzyc sie przed payout albo ekspansja

## Efekt komercyjny

Proof layer skrocil trust-building, zmniejszyl niejednoznacznosc i sprawil, ze partner wygladal na operacyjnie wiarygodnego.'
  ),
  (
    'kb-consultify-partner-case-study-cfo-en',
    'kb-consultify-partner-case-study-cfo',
    'en',
    'Case Study: CFO Governance Conversation',
    'A partner uses certification logic and sponsor-ready proof to move a finance-led conversation forward without unsafe promises.',
    '# Case Study: CFO Governance Conversation

A finance-driven buyer did not need more enthusiasm. They needed a credible governance story.

## What the partner used

The partner combined:

- a certification explainer
- a clear FAQ on activation and payouts
- a sponsor-oriented case narrative

## Why it mattered

The CFO did not hear inflated ROI promises. They saw a governed path:

- application and onboarding are shared
- academy and certification make readiness visible
- review states make exceptions explicit
- payout readiness is operationally defined

## Result

The conversation moved from vague curiosity to a governed next-step decision because the partner could explain not just value, but control.'
  ),
  (
    'kb-consultify-partner-case-study-cfo-pl',
    'kb-consultify-partner-case-study-cfo',
    'pl',
    'Case study: rozmowa z CFO o governance',
    'Partner wykorzystuje logike certyfikacji i sponsor-ready proof, aby ruszyc rozmowe finansowa bez unsafe promises.',
    '# Case study: rozmowa z CFO o governance

Kupujacy prowadzony przez finanse nie potrzebowal wiecej entuzjazmu. Potrzebowal wiarygodnej historii o governance.

## Czego uzyl partner

Partner polaczyl:

- certification explainer
- jasne FAQ o activation i payoutach
- sponsor-oriented case narrative

## Dlaczego to zadzialalo

CFO nie uslyszal napompowanych obietnic ROI. Zobaczyl governed path:

- application i onboarding sa wspolne
- academy i certyfikacja ujawniaja readiness
- review states pokazuja exceptions
- payout readiness jest zdefiniowany operacyjnie

## Rezultat

Rozmowa przeszla od niejasnej ciekawosci do governed next-step decision, bo partner umial wyjasnic nie tylko wartosc, ale tez kontrole.'
  )
ON CONFLICT (article_id, language) DO NOTHING;

INSERT INTO kb_surface_bindings (id, article_id, surface)
VALUES
  ('kb-consultify-partner-program-overview-public', 'kb-consultify-partner-program-overview', 'public_docs'),
  ('kb-consultify-partner-program-overview-lp', 'kb-consultify-partner-program-overview', 'lp'),
  ('kb-consultify-partner-application-flow-public', 'kb-consultify-partner-application-flow', 'public_docs'),
  ('kb-consultify-partner-application-flow-lp', 'kb-consultify-partner-application-flow', 'lp'),
  ('kb-consultify-partner-payout-public', 'kb-consultify-partner-payout-and-activation', 'public_docs'),
  ('kb-consultify-partner-payout-help', 'kb-consultify-partner-payout-and-activation', 'help'),
  ('kb-consultify-partner-cert-public', 'kb-consultify-partner-certification-explainer', 'public_docs'),
  ('kb-consultify-partner-cert-help', 'kb-consultify-partner-certification-explainer', 'help'),
  ('kb-consultify-partner-faq-public', 'kb-consultify-partner-faq', 'public_docs'),
  ('kb-consultify-partner-case-ops-public', 'kb-consultify-partner-case-study-operations', 'public_docs'),
  ('kb-consultify-partner-case-finance-public', 'kb-consultify-partner-case-study-cfo', 'public_docs')
ON CONFLICT (id) DO NOTHING;

INSERT INTO kb_article_collections (article_id, collection_id, sort_order)
VALUES
  ('kb-consultify-partner-program-overview', 'kb-coll-consultify-partner', 1),
  ('kb-consultify-partner-program-overview', 'kb-coll-consultify-partner-program', 1),
  ('kb-consultify-partner-application-flow', 'kb-coll-consultify-partner', 2),
  ('kb-consultify-partner-application-flow', 'kb-coll-consultify-partner-program', 2),
  ('kb-consultify-partner-payout-and-activation', 'kb-coll-consultify-partner', 3),
  ('kb-consultify-partner-payout-and-activation', 'kb-coll-consultify-partner-operations', 1),
  ('kb-consultify-partner-certification-explainer', 'kb-coll-consultify-partner', 4),
  ('kb-consultify-partner-certification-explainer', 'kb-coll-consultify-partner-operations', 2),
  ('kb-consultify-partner-faq', 'kb-coll-consultify-partner', 5),
  ('kb-consultify-partner-faq', 'kb-coll-consultify-partner-operations', 3),
  ('kb-consultify-partner-case-study-operations', 'kb-coll-consultify-partner', 6),
  ('kb-consultify-partner-case-study-operations', 'kb-coll-consultify-partner-cases', 1),
  ('kb-consultify-partner-case-study-cfo', 'kb-coll-consultify-partner', 7),
  ('kb-consultify-partner-case-study-cfo', 'kb-coll-consultify-partner-cases', 2)
ON CONFLICT DO NOTHING;
