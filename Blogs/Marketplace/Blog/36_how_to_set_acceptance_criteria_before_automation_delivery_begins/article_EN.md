# How to Set Acceptance Criteria Before Automation Delivery Begins

Target persona: Engineering and quality leadership / technical buyer  
Funnel stage: Consideration to Evaluation (specification and award inputs)  
Core problem: acceptance is treated as a late commissioning argument instead of a written contract against which delivery is planned  
Main promise: a bounded method to define acceptance objects, evidence, and sequence before mobilization

Acceptance is not a mood at go-live. It is the operational definition of done. If you cannot test it, you cannot award it cleanly.

Set acceptance criteria before delivery begins by publishing a numbered list of acceptance objects, each with objective evidence, responsible verifier, and sequence dependencies, then align milestones and payment triggers to those objects.

Deferring acceptance definition converts commissioning into negotiation and erodes schedule accountability.

## Step 1: separate objects from activities

An acceptance object is an outcome you can verify.

Examples (illustrative): cycle time band under named SKU set and station conditions; error rate or reject handling behavior under defined inputs; safety functions validated under named scenarios; data handshake behavior at named interface points.

Activities like "training completed" belong in the plan, but they should still map to observable outcomes where possible.

## Step 2: define evidence per object

For each object, specify: measurement method; environment conditions; sample size or duration rule; pass or fail rule.

| weak evidence language | strong evidence language |
| --- | --- |
| "performance acceptable" | "throughput X to Y units per hour with scrap below Z under conditions A" |
| "integrated with MES" | "events E1 to E3 appear in system S within T seconds in test cases TC1 to TC5" |

## Step 3: sequence dependencies honestly

Some objects cannot be proven until others are stable.

Build a simple dependency list (illustrative): mechanical safety and guarding sign-off; basic motion and manual mode controls; automatic cycle under constrained SKU set; MES or quality system handshake under test loads; run-off under production-like conditions.

If procurement wants early invoices, map milestones to real intermediate objects, not calendar theater.

## Step 4: align internal approvals to acceptance roles

Name who can sign each object class: operations for throughput and staffing impacts; quality for defect and traceability impacts; IT for identity and network impacts; maintenance for serviceability impacts.

Missing approvers at definition time becomes missing approvers at sign-off time.

## What this means for DBR77 Marketplace

DBR77 Marketplace matters here because acceptance criteria are one of the clearest ways to compare suppliers on outcomes instead of promises.

That makes early acceptance design part of sourcing discipline, not something postponed to commissioning arguments.

For the closest continuity pieces, see [What FAT and SAT Should Actually Prove Before Go-Live](../25_what_fat_and_sat_should_actually_prove_before_go_live/article_EN.md), [What a Good Automation Offer Should Make Visible](../17_what_a_good_automation_offer_should_make_visible/article_EN.md), and [What a Clean Handoff From Selection to Delivery Should Look Like](../30_what_a_clean_handoff_from_selection_to_delivery_should_look_like/article_EN.md).

## Bottom line

Write acceptance as testable objects with evidence before mobilization. Late acceptance is expensive because it is late comparability.

---

*DBR77 Marketplace lets teams attach acceptance objects and evidence fields to comparable offers so integrator paths are judged on verifiable outcomes. [Compare offers](https://dbr77.com/marketplace) or [Describe your challenge](https://dbr77.com/demo).*
