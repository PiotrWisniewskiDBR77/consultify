# What FAT and SAT Should Actually Prove Before Go-Live

Target persona: Quality / Engineering Manager (manufacturer-side owner)  
Funnel stage: Decision to delivery handoff (pre go-live assurance)  
Core problem: FAT and SAT drift into ceremonial walkthroughs that sign paperwork but do not reduce operational risk  
Main promise: a manufacturer-first acceptance framework that ties evidence to what must be true on the first real production week

FAT and SAT are not morale events. They are risk controls.

They fail when teams treat them as: a demo with witnesses; a photo opportunity; a checkbox required by a template someone downloaded in 2014. They work when they answer one question:

what would make us refuse to run this in production, and how do we test for that before we commit the line?

FAT should prove that the integrated system meets the contract-defined acceptance criteria under supplier-controlled conditions, with traceable records.

SAT should prove that the same criteria hold in your plant context, with real interfaces, real materials where applicable, and real operational ownership. If FAT proves "it moves" and SAT proves "we hope," you bought theater.

## Define acceptance objects before you schedule dates

Start with objects, not ceremonies. Minimum acceptance objects (adjust to your category):

| Object | FAT intent | SAT intent |
| --- | --- | --- |
| safety functions | verified behavior at supplier site | verified behavior with plant guarding and LOTO reality |
| cycle and throughput band | demonstrated under agreed load model | demonstrated with plant feeding constraints |
| quality outputs | measured against agreed sampling plan | measured against plant metrology and norms |
| error handling and recovery | scripted fault cases pass | operator-realistic faults pass |
| data and MES handshake | interfaces pass agreed test messages | interfaces pass under plant network conditions |
| documentation and training | O&M package completeness | operators can execute standard work |

If an object is not listed, it will not be tested. It will be debated later at higher cost.

## FAT: what "pass" should mean

A useful FAT produces: a punch list with owners and due dates before shipment; traceable test records tied to requirement IDs; explicit exclusions (what was simulated versus what was real). A weak FAT produces: subjective opinions ("looks good"); moving targets ("we will tune it on site"); hidden substitutions (different tooling, different SKU, different software build).

Manufacturers should insist on frozen build identifiers for software and firmware at FAT.

## SAT: what "pass" should mean

A useful SAT produces: confirmation that plant-specific assumptions held; a bounded stabilization window with measurable exit criteria; a signed handoff that states what is supported day one versus what is a phase two improvement. A weak SAT produces: "we will optimize after start"; acceptance signed while bypassing interlocks "temporarily"; training deferred because production pressure wins.

## Reality check: acceptance usually breaks where the plant treats unresolved issues as manageable startup noise

That is why weak SATs can still feel operationally normal. People are tired. The line is almost ready. The missing item sounds small. But if a known gap affects safety, ownership, repeatability, or recovery behavior, it is not startup noise. It is unclosed risk waiting for the first real production week.

## A simple pass or fail gate (three questions)

Use the same three questions at FAT and SAT:

1. Does it meet the written acceptance criteria with agreed evidence?
2. Are known gaps documented with owners, dates, and risk acceptance where required?
3. Can operations run standard work without heroic intervention?

If question three is "no," go-live is a bet, not a decision.

## When to pause FAT or SAT

Pause when: scope changes arrive as "small tweaks" without change control; test materials are not representative and nobody documents the substitution; integrator staffing on site does not match the plan and critical tests are skipped; internal owners are missing (maintenance, IT, quality) and defects will be orphaned. Pausing is not drama. It is cheaper than rework on a live line.

## What this means for DBR77 Marketplace

DBR77 Marketplace matters here because acceptance discipline should be traceable all the way back to what was compared, contracted, and promised before award.

That is what keeps FAT and SAT from becoming ceremonies detached from the original buying logic.

For continuity across contract and execution handoff, see [What to Check Before Signing an Automation Contract](../20_what_to_check_before_signing_an_automation_contract/article_EN.md) and [What a Clean Handoff From Selection to Delivery Should Look Like](../30_what_a_clean_handoff_from_selection_to_delivery_should_look_like/article_EN.md).

## Bottom line

FAT proves the integrated system against contract criteria with traceable records.

SAT proves the same criteria in your plant context with operational ownership.

If acceptance is defined late, you will pay for ambiguity in the first production week.

---

*DBR77 Marketplace helps manufacturers keep scope, interfaces, and accountability visible early so acceptance criteria are harder to postpone into the go-live week. [Describe your challenge](https://dbr77.com/marketplace) or [Compare offers](https://dbr77.com/demo).*
