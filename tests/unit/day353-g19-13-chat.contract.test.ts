// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru
import { expect, it } from 'vitest';

it('KONTRAKT DLA DYŻURU 353 — 13 Chat izoluje istniejącą rozmowę lub plan agenta między tenantami', () => {
  expect.fail('ai.agentHubRateLimitRouting jest kontraktem tekstowym limitera, nie parą ApiGateway/JWT/RealPG; brakuje cross-org odczytu istniejącej rozmowy lub agent planu i mutacji strażnika.');
});
