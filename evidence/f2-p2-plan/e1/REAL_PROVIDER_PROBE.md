# Real provider probe — DEC-497 P2 E1

Verdict: **NOT_PROVEN in this local environment**.

The production-shaped `analyzePlanDependencies` entry point was executed with a real three-initiative snapshot. The local runtime had no configured PREMIUM provider and no `OPENAI_API_KEY`, so the provider call failed with `AI_LoadAPIKeyError` after the service retries. No synthetic response or deterministic fallback was substituted.

The implementation fails closed as `AI_UNAVAILABLE` and the HTTP route maps that condition to 503. The focused transport test proves that the exact snapshot is passed through `llmService.call`, but successful behavior against a configured external provider remains an integration acceptance item for an authorized environment.

No secret values were printed or retained.
