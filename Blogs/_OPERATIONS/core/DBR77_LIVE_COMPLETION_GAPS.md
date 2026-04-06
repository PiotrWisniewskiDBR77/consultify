# DBR77 Live Completion Gaps

## Purpose

This file records what is still required for true live completion after the repo-side implementation layer is in place.

It separates:

- completed repo preparation
- remaining live activation work

## Repo-Side Work Already Complete

- all six product libraries exist at `50`
- all six products now have `00_LP_ATTACHMENT_CHECK_01_50.md`
- all six products now have `00_PUBLICATION_CHECKLIST_PASS_01_50.md`
- upload runbook, manifests, batch sheet, pre-go decisions, and execution pack exist
- publication routing, LP implementation map, and distribution refresh docs exist

## Remaining Live Activation Work

These steps still require real execution outside static repo preparation:

1. upload all product article bodies into the LP knowledge bases
2. confirm locale handling in the LP platform for `EN`, `PL`, and `DE`
3. assign or verify LP sections inside the live system
4. verify slug behavior inside the live LP platform
5. run the batch spot-checks after each product import
6. activate the first publish queue in real calendar order
7. publish the first derivative set across website, personal channel, company channel, and email

## Hard Stop Conditions

Do not call the system fully live if any of these remain unresolved:

- archive content is mixed into `Marketplace`
- `00_*` operational files enter LP knowledge bases
- locales split into wrong record types
- article body is replaced by metadata during import
- section assignment in LP diverges from the attachment maps

## Practical Definition Of Full Completion

Treat DBR77 as fully completed only when:

- repo preparation is complete
- LP knowledge bases are actually populated
- publication queue is actually in use
- at least the first live derivative cycle has been executed
- the system is running as an operating process, not just as documentation
