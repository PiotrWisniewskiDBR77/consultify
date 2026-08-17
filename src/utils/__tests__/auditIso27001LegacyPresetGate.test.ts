/**
 * @vitest-environment jsdom
 *
 * auditIso27001LegacyPresetGate.test — AMD-AUD-RIGHTS-001.
 *
 * The value assertion is nearly trivial (a literal `false`). The real work
 * here is the STRUCTURAL guard: prove, by reading the actual source, that
 * this gate exposes no runtime input at all — no query param, no storage, no
 * env var, no flag-registry key, no test/dev escape hatch. A future edit that
 * "helpfully" restores the sibling `auditProgramEditStubFlag.ts` override
 * pattern (the WRONG pattern for a rights boundary — see the gate's own
 * header) must fail here rather than silently reopening the self-activation
 * path the owner decision forbids.
 *
 * Comments are stripped before scanning: the gate's docstring necessarily
 * NAMES the mechanisms it forbids, so a raw-source regex would false-fail.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AUDIT_ISO27001_LEGACY_PRESET_ENABLED } from '../auditIso27001LegacyPresetGate';

const GATE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../auditIso27001LegacyPresetGate.ts',
);
const PRESETS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../components/Audit/auditPresets.ts',
);

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function readGateCode(): string {
  return stripComments(fs.readFileSync(GATE_PATH, 'utf8'));
}

describe('AUDIT_ISO27001_LEGACY_PRESET_ENABLED — hard-disabled, no runtime input', () => {
  it('is a literal false', () => {
    expect(AUDIT_ISO27001_LEGACY_PRESET_ENABLED).toBe(false);
  });

  it('the CODE has no query-string, storage, or env read of any kind', () => {
    const code = readGateCode();
    expect(code).not.toMatch(/URLSearchParams/);
    expect(code).not.toMatch(/window\.location/);
    expect(code).not.toMatch(/localStorage/i);
    expect(code).not.toMatch(/sessionStorage/i);
    expect(code).not.toMatch(/import\.meta\.env/);
    expect(code).not.toMatch(/process\.env/);
  });

  it('has no test-only or development-only escape hatch', () => {
    const code = readGateCode();
    expect(code).not.toMatch(/NODE_ENV/);
    expect(code).not.toMatch(/E2E/i);
    expect(code).not.toMatch(/\bDEV\b/);
    expect(code).not.toMatch(/__TEST__/);
  });

  it('exports exactly one constant binding — no resolver function that could compute a value', () => {
    const code = readGateCode();
    expect(code).not.toMatch(/export function/);
    expect(code).not.toMatch(/export default/);
    expect(code).toMatch(/export const AUDIT_ISO27001_LEGACY_PRESET_ENABLED = false as const;/);
    // Exactly one export statement in the whole file.
    expect(code.match(/export /g)?.length).toBe(1);
  });

  it('the gate is not registered in any feature-flag registry (product flags or G4 fixture overrides)', () => {
    // Neither the flag key nor the constant name may appear in a flag registry;
    // if it did, the flag resolver / g4_test_flag_overrides could reach it.
    const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const flagRegistryCandidates = ['utils/betaAccess.ts', 'config/featureFlags.ts'];
    for (const rel of flagRegistryCandidates) {
      const p = path.join(srcRoot, rel);
      if (!fs.existsSync(p)) continue;
      const registry = fs.readFileSync(p, 'utf8');
      expect(registry).not.toMatch(/AUDIT_ISO27001_LEGACY_PRESET_ENABLED/);
      expect(registry).not.toMatch(/audit_iso27001_preset/);
      expect(registry).not.toMatch(/auditIso27001Preset/);
    }
  });
});

describe('AUDIT_PRESETS — the ISO preset is excluded at the primary choke point', () => {
  it('auditPresets.ts gates AUDIT_PRESETS on the hard constant, not on any runtime resolver', () => {
    const code = stripComments(fs.readFileSync(PRESETS_PATH, 'utf8'));
    expect(code).toMatch(/AUDIT_ISO27001_LEGACY_PRESET_ENABLED/);
    expect(code).not.toMatch(/localStorage/i);
    expect(code).not.toMatch(/URLSearchParams/);
    expect(code).not.toMatch(/import\.meta\.env/);
  });

  it('at the shipped value, AUDIT_PRESETS omits the ISO preset and getPresetById cannot resolve it', async () => {
    const { AUDIT_PRESETS, getPresetById, ISO_27001_PRESET } = await import(
      '../../components/Audit/auditPresets'
    );
    expect(AUDIT_PRESETS.some((p) => p.id === ISO_27001_PRESET.id)).toBe(false);
    // The id-guessing path is closed too: no preset object comes back.
    expect(getPresetById('iso27001')).toBeNull();
    expect(getPresetById(ISO_27001_PRESET.id)).toBeNull();
  });

  it('query string and localStorage set to every truthy form do not change AUDIT_PRESETS or getPresetById', async () => {
    const mod = await import('../../components/Audit/auditPresets');
    for (const truthy of ['1', 'true', 'on', 'TRUE', 'yes']) {
      window.history.pushState({}, '', `/?ff_auditIso27001Preset=${truthy}`);
      window.localStorage.setItem('ff.audit_iso27001_preset', truthy);
      expect(mod.AUDIT_PRESETS.some((p) => p.id === 'iso27001')).toBe(false);
      expect(mod.getPresetById('iso27001')).toBeNull();
    }
    window.localStorage.removeItem('ff.audit_iso27001_preset');
    window.history.pushState({}, '', '/');
  });
});
