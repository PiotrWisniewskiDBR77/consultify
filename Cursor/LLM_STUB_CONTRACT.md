# Consultify — LLM Stub Contract (Your API)

## Goal
All automated tests must be deterministic and must not call real LLM providers. We stub **your API** and validate request/response contracts.

## Contract Principles
- Deterministic outputs by default (same input => same output).
- Explicit error simulation (timeouts, 429, 500, malformed response).
- Token/cost accounting simulated (to exercise cost-control logic).

## Required Scenarios
1. **Happy path**: valid prompt/context → structured response.
2. **Rate limited**: 429 with retry-after.
3. **Timeout**: request exceeds configured timeout.
4. **Provider failover**: primary fails → fallback path exercised.
5. **Policy violation**: content blocked/needs redaction.

## Notes
Implementation will be done as either:
- local stub server spun up in tests, or
- HTTP-layer mock (preferred for unit/component), with one shared contract fixture set.


