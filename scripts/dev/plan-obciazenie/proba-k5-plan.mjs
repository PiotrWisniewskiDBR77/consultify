#!/usr/bin/env node
/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K5 — PRZYGOTOWANIE danych do dowodu.
 *
 * Zaklada SZKIC planu z 5 zatwierdzonymi inicjatywami przez te same trasy, ktorych
 * uzywa generator (K2): `planning/initiatives/:id/register` + `plan-scenarios/:id`
 * z `portfolio: 'auto'`. Dzieki temu dowod klikany zaczyna sie tam, gdzie zaczyna
 * sie K5 — na sekcji „Obciazenie rol" — a nie na cudzym generatorze (K3 w toku).
 *
 * Uzycie: node scripts/dev/plan-obciazenie/proba-k5-plan.mjs <API> <PLIK_SESJI>
 */
import fs from 'node:fs';

// NAZWA jako argument (scalenie K3+K5, 07.09): dowod scalenia zaklada WLASNY szkic
// obok planu K5, wiec musi go umiec odroznic na liscie po nazwie.
const [
  ,
  ,
  API = 'http://127.0.0.1:4160',
  AUTH = '/private/tmp/wt-p15-k5/.auth-k5.json',
  NAZWA = 'proba-k5 — plan obciążenia ról',
] = process.argv;
const cookie = JSON.parse(fs.readFileSync(AUTH, 'utf8'))
  .cookies.map((c) => `${c.name}=${c.value}`)
  .join('; ');
const base = `${API}/api/initiatives/runtime-v1`;

async function call(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 300);
  }
  if (!response.ok) throw new Error(`${response.status} ${path} ${JSON.stringify(parsed).slice(0, 300)}`);
  return parsed;
}

const uuid = () => crypto.randomUUID();
const plannable = await call('/planning/plannable-initiatives');
const chosen = (plannable.initiatives ?? []).filter((item) => item.status === 'APPROVED').slice(0, 5);
if (chosen.length < 5) {
  console.error(`Za malo kandydatow: ${chosen.length}`);
  process.exit(2);
}
const windows = [];
for (const item of chosen) {
  const registered = await call(`/planning/initiatives/${encodeURIComponent(item.id)}/register`, {
    clientRequestId: uuid(),
  });
  windows.push({
    initiativeId: item.id,
    initiativeVersion: registered.aggregateVersion ?? registered.response?.version ?? 1,
    name: item.name,
  });
}

const start = new Date('2026-09-07T00:00:00.000Z');
const periods = Array.from({ length: 6 }, (_, index) => {
  const from = new Date(start.getTime() + index * 7 * 86400000);
  const to = new Date(from.getTime() + 7 * 86400000);
  return { periodId: `Tydzień ${index + 1}`, start: from.toISOString(), end: to.toISOString() };
});
// Wszystkie 5 inicjatyw celuje w tydzien 1-2 — to jest scenariusz, ktory MA
// wyprodukowac luke na jednej roli, a nie rozlozyc sie po calym horyzoncie.
const scenarioId = `proba-k5-plan-${uuid()}`;
const scenario = {
  scenarioId,
  name: NAZWA,
  scenarioVersion: 0,
  status: 'DRAFT',
  portfolioScenarioId: '',
  portfolioScenarioVersion: 0,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods,
  windows: windows.map((window, index) => ({
    initiativeId: window.initiativeId,
    initiativeVersion: window.initiativeVersion,
    earliest: periods[0].start,
    target: periods[index < 3 ? 0 : 1].start,
    latest: periods[index < 3 ? 1 : 2].end,
    confidence: 'MEDIUM',
    rationale: 'Okno probne P15-K5 — dowod arkusza okres x rola.',
    dependencySnapshot: [],
    constraintSnapshot: [],
  })),
  assumptions: ['Dane probne P15-K5'],
  createdBy: '',
  updatedBy: '',
  publishedBy: null,
  publishedAt: null,
};
const created = await call(`/plan-scenarios/${encodeURIComponent(scenarioId)}`, {
  expectedVersion: 0,
  clientRequestId: uuid(),
  operation: 'CREATE',
  portfolio: 'auto',
  scenario,
});
console.log(
  JSON.stringify(
    {
      scenarioId,
      aggregateVersion: created.aggregateVersion,
      inicjatywy: windows.map((w) => w.name),
    },
    null,
    2
  )
);
