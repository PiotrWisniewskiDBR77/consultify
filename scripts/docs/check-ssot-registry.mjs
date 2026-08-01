#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const registryPath = path.join(root, 'docs/ssot/registry.json');
const problems = [];

function fail(message) {
  problems.push(message);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

if (!exists('docs/SOURCE_OF_TRUTH.md')) {
  fail('Brak centralnego punktu wejścia docs/SOURCE_OF_TRUTH.md');
}

const requiredSsotFiles = [
  'docs/ssot/README.md',
  'docs/ssot/APPLICATION.md',
  'docs/ssot/REPOSITORY_STRUCTURE.md',
  'docs/ssot/TECHNICAL_ARCHITECTURE.md',
  'docs/ssot/DATA_SECURITY_OPERATIONS.md',
  'docs/ssot/QUALITY_AND_DELIVERY.md',
  'docs/ssot/COMPLETENESS_MATRIX.md',
  'docs/ssot/COMPLETE_DOCUMENTATION_STANDARD.md',
  'docs/ssot/DOCUMENT_LIFECYCLE.md',
  'docs/ssot/RECONCILIATION_BACKLOG.md'
];
for (const required of requiredSsotFiles) {
  if (!exists(required)) fail(`Brak wymaganego źródła prawdy: ${required}`);
}

const requiredWeekendControlFiles = [
  'docs/program/WEEKEND_COMPLETION_2026-08-01/README.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/ACCEPTANCE_BOARD.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/ROLE_AND_HANDOFF_PROTOCOL.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/TASK_PACKET_TEMPLATE.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/CONCEPTUAL_WORK_PROTOCOL.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/EVIDENCE_AND_RELEASE_GATE.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/DECISION_REGISTER.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/CLAUDE_START_INSTRUCTIONS.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/INTEGRATION_CONSOLIDATION_PROGRAM.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/FRAGMENT_INVENTORY.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/INTEGRATION_GATE.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/AGENT_TEAM_OPERATING_MODEL.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/FULL_RECONNAISSANCE_AND_ROADMAP.md',
  'docs/program/WEEKEND_COMPLETION_2026-08-01/MASTER_EXECUTION_PLAN.md'
];
for (const required of requiredWeekendControlFiles) {
  if (!exists(required)) fail(`Brak pliku sterującego weekendu: ${required}`);
}

if (!fs.existsSync(registryPath)) {
  fail('Brak docs/ssot/registry.json');
} else {
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    fail(`Niepoprawny JSON rejestru: ${error.message}`);
  }

  if (registry) {
    const truthTypes = new Set(registry.truthTypes || []);
    const statuses = new Set(registry.statuses || []);
    const ids = new Set();
    const canonicalScopes = new Map();

    for (const entry of registry.authorities || []) {
      if (!entry.id) fail('Wpis authority bez id');
      if (ids.has(entry.id)) fail(`Powtórzone id: ${entry.id}`);
      ids.add(entry.id);
      if (!truthTypes.has(entry.truthType)) {
        fail(`${entry.id}: nieznany truthType ${entry.truthType}`);
      }
      if (!statuses.has(entry.status)) {
        fail(`${entry.id}: nieznany status ${entry.status}`);
      }
      if (!entry.path || !exists(entry.path)) {
        fail(`${entry.id}: brak ścieżki ${entry.path || '(pusta)'}`);
      }
      if (/\s[2-9]\.[^.]+$/i.test(entry.path || '')) {
        fail(`${entry.id}: kopia numerowana nie może być źródłem prawdy`);
      }
      if (entry.status === 'canonical') {
        const key = `${entry.truthType}:${entry.scope}`;
        if (canonicalScopes.has(key)) {
          fail(`${entry.id}: ten sam kanoniczny zakres ma ${canonicalScopes.get(key)}`);
        }
        canonicalScopes.set(key, entry.id);
      }
    }

    const menu = registry.functionalMenu;
    if (!menu?.index || !exists(menu.index)) {
      fail(`Brak indeksu funkcjonalnego menu: ${menu?.index || '(pusta ścieżka)'}`);
    }
    for (const runtimeSource of menu?.runtimeSources || []) {
      if (!exists(runtimeSource)) fail(`Brak źródła menu runtime: ${runtimeSource}`);
    }

    const menuIds = new Set();
    const menuOrders = new Set();
    const menuItems = menu?.items || [];
    for (const item of menuItems) {
      if (menuIds.has(item.id)) fail(`Powtórzone id menu: ${item.id}`);
      if (menuOrders.has(item.order)) fail(`Powtórzona kolejność menu: ${item.order}`);
      menuIds.add(item.id);
      menuOrders.add(item.order);
      for (const source of item.sources || []) {
        if (!exists(source)) fail(`Menu ${item.id}: brak ${source}`);
        if (/\s[2-9]\.md$/i.test(source)) {
          fail(`Menu ${item.id}: numerowana kopia nie może być źródłem`);
        }
      }
    }
    if (menuItems.length !== 16) {
      fail(`Menu funkcjonalne musi mieć 16 pozycji; ma ${menuItems.length}`);
    }
    const expectedOrders = Array.from({ length: 16 }, (_, index) => index + 1);
    for (const order of expectedOrders) {
      if (!menuOrders.has(order)) fail(`Brak pozycji menu nr ${order}`);
    }

    for (const subsystem of registry.nestedSubsystems || []) {
      if (!subsystem.path || !exists(subsystem.path)) {
        fail(`Podsystem ${subsystem.id}: brak ${subsystem.path || '(pusta ścieżka)'}`);
      }
    }
  }
}

const central = exists('docs/SOURCE_OF_TRUTH.md')
  ? fs.readFileSync(path.join(root, 'docs/SOURCE_OF_TRUTH.md'), 'utf8')
  : '';
for (const required of [
  'docs/product/DOCUMENTATION_REGISTRY.md',
  'docs/modules/README.md',
  'docs/ui-standards/README.md'
]) {
  const relativeFromDocs = required.replace(/^docs\//, '');
  if (!central.includes(relativeFromDocs) && !central.includes(required)) {
    fail(`Centralna mapa nie odsyła do ${required}`);
  }
}

if (problems.length) {
  console.error('check-ssot-registry: FAIL');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log('check-ssot-registry: OK');
console.log('- centralna mapa istnieje');
console.log('- wszystkie zarejestrowane źródła istnieją');
console.log('- 16 pozycji dokumentacji odpowiada menu aplikacji');
console.log('- podsystemy techniczne są przypisane do pozycji menu');
console.log('- brak numerowanych kopii w rejestrze kanonicznym');
console.log(`- komplet katalogu SSOT: ${requiredSsotFiles.length}/${requiredSsotFiles.length}`);
console.log(`- komplet centrum dowodzenia: ${requiredWeekendControlFiles.length}/${requiredWeekendControlFiles.length}`);
