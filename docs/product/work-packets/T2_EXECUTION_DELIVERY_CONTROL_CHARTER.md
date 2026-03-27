# T2 Charter — Execution / Delivery Control

Date: 2026-03-26
Lane: `Execution / delivery control`
Taxonomy: `T2`
Tranche: `Tranche 2`
Status: `done`

## Why now

`T0` and `T1` active lanes are closed. `Execution / delivery control` is the highest-value
next promotion candidate because it already has broad read proof, existing route/client
tests, and a clearly documented bounded gap around write continuity and mixed execution
authority.

## Goal

Promote one bounded execution parity slice that reduces mixed truth across:

- execution lane route authority
- execution-control read/write contract usage
- visible operator continuity on the live execution surface

## In scope

1. execution lane route/auth consistency
2. split-brain map for execution URLs, frontend surfaces, and runtime contracts
3. one bounded execution-control packet at a time
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. broad rollout workspace redesign
2. full PMO write parity across all execution surfaces
3. artifact execution spine expansion beyond the chosen bounded packet
4. unrelated T2 lanes (`Results`, `Finance`, `Partner`, `Sync`, `Multiplayer`)

## Initial bounded packet

Packet 1:

- align auth/route protection for `/implementation` and `/rollout` with `/execution`

Why this first:

- small
- low-risk
- removes immediate route inconsistency before deeper runtime convergence
