# What FAT and SAT Should Actually Prove Before Go-Live

Target persona: Quality / Engineering Manager (manufacturer-side owner)  
Funnel stage: Decision to delivery handoff (pre go-live assurance)  
Core problem: FAT and SAT drift into ceremonial walkthroughs that sign paperwork but do not reduce operational risk  
Main promise: a manufacturer-first acceptance framework that ties evidence to what must be true on the first real production week

Factory Acceptance Testing and Site Acceptance Testing are not morale events. They are controls. They fail when teams treat them as demos with witnesses, photo opportunities, or checkbox exercises divorced from production reality. They work when they answer one question with evidence: what would make us refuse to run this in production, and how do we test for that before we commit the line?

FAT should show that the integrated system meets contract-defined acceptance criteria under supplier-controlled conditions, with traceable records tied to requirements—not “it moved” optimism.

SAT should show the same criteria hold in your plant: real interfaces, real materials where applicable, real guarding and lockout practice, and real operational ownership. If FAT proves motion and SAT proves hope, you bought theater.

## Start with acceptance objects, not ceremony dates

Before you schedule rooms and flights, list what must be true: safety functions behave as specified; cycle and throughput sit inside an agreed band under a defined load model; quality outputs meet the sampling plan; error handling and recovery work under realistic faults; data and MES handshakes pass agreed messages; documentation and training let operators run standard work. Anything not listed will not be tested—it will be argued about later at higher cost.

## What a serious FAT produces

You should leave FAT with traceable test records mapped to requirement IDs, a punch list with owners and dates before shipment, explicit notes on what was simulated versus exercised for real, and frozen identifiers for software and firmware builds. Weak FATs trade on subjective “looks good,” moving targets (“we will tune on site”), and quiet substitutions in tooling, parts, or builds. Manufacturers should refuse that ambiguity.

## What a serious SAT produces

SAT confirms plant-specific assumptions, closes gaps with a bounded stabilization window and measurable exit criteria, and produces a handoff that states what is supported on day one versus what is a later-phase improvement. Weak SATs sign acceptance while interlocks are bypassed “temporarily,” optimization is infinitely deferred, or training is sacrificed to production pressure.

## Plant-side reality: “small gaps” are not small

Under fatigue and schedule pressure, unresolved issues get rebranded as startup noise. If a gap touches safety, ownership, repeatability, or recovery behavior, it is not noise—it is unclosed risk waiting for the first real production week.

## A three-question gate (use at FAT and SAT)

Before you sign any acceptance step, ask: does it meet written criteria with agreed evidence; are known gaps documented with owners, dates, and explicit risk acceptance where required; can operations execute standard work without heroic intervention? If the third answer is no, go-live is a bet, not a decision.

## When to pause

Pause when scope changes arrive as casual tweaks without change control, test materials are unrepresentative and undocumented, site staffing does not match the test plan, or internal owners (maintenance, IT, quality) are absent so defects will have no home. Pausing is cheaper than rework on a live line.

## How DBR77 Marketplace ties back

Acceptance discipline should trace to what was compared, contracted, and promised before award. That keeps FAT and SAT connected to buying logic instead of floating as detached rituals.

For continuity across contract and execution handoff, see [What to Check Before Signing an Automation Contract](../20_what_to_check_before_signing_an_automation_contract/article_EN.md) and [What a Clean Handoff From Selection to Delivery Should Look Like](../30_what_a_clean_handoff_from_selection_to_delivery_should_look_like/article_EN.md).

## Acceptance as contract with the floor

FAT and SAT are where abstract scope becomes lived reality. Operators should recognize the tests as their world: real guarding, real materials where applicable, real recovery scenarios, real data paths. If tests are “close enough,” you are not validating production—you are validating a story. That distinction shows up the first time the line runs under customer pressure.

Good acceptance discipline also protects suppliers who did the work correctly. When criteria are explicit, strong performers can prove completion without endless opinion battles. Weak criteria punish everyone by turning completion into negotiation.

## Bottom line

FAT proves integrated performance against contract criteria with records. SAT proves the same in your context with operational ownership. Define acceptance early—or pay for ambiguity in the first real production week.

---

*DBR77 Marketplace helps manufacturers keep scope, interfaces, and accountability visible early so acceptance criteria are harder to postpone into the go-live week. [Describe your challenge](https://dbr77.com/marketplace) or [Compare offers](https://dbr77.com/demo).*
