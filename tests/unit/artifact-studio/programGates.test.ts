import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ProgramGate {
  id: string;
  dependsOn: string[];
  status: 'pending' | 'in_progress' | 'verified' | 'blocked' | 'complete';
  checks: string[];
}

interface ProgramManifest {
  terminalGate: string;
  requiredEvidenceKinds: string[];
  gates: ProgramGate[];
}

const manifest = JSON.parse(readFileSync(resolve(
  process.cwd(),
  'docs/ui-standards/01-shell-layout/artifact-studio/program-gates.json',
), 'utf8')) as ProgramManifest;

describe('Artifact Studio program gates', () => {
  it('has unique gates with valid dependency references', () => {
    const ids = manifest.gates.map((gate) => gate.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const gate of manifest.gates) {
      for (const dependency of gate.dependsOn) expect(ids).toContain(dependency);
    }
  });

  it('is acyclic', () => {
    const byId = new Map(manifest.gates.map((gate) => [gate.id, gate]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error(`Cycle at ${id}`);
      if (visited.has(id)) return;
      visiting.add(id);
      byId.get(id)?.dependsOn.forEach(visit);
      visiting.delete(id);
      visited.add(id);
    };
    manifest.gates.forEach((gate) => visit(gate.id));
    expect(visited.size).toBe(manifest.gates.length);
  });

  it('requires the terminal gate to cover the complete evidence set', () => {
    const terminal = manifest.gates.find((gate) => gate.id === manifest.terminalGate);
    expect(terminal).toBeDefined();
    expect(new Set(terminal?.checks)).toEqual(new Set(manifest.requiredEvidenceKinds));
  });

  it('does not claim program completion while any gate is unfinished', () => {
    const unfinished = manifest.gates.filter((gate) => gate.status !== 'complete');
    expect(unfinished.length).toBeGreaterThan(0);
    expect(manifest.gates.find((gate) => gate.id === manifest.terminalGate)?.status).not.toBe('complete');
  });
});
