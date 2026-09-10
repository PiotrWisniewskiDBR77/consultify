/**
 * Bezpiecznik dla defektu zmierzonego 2026-09-10 na żywym stagingu:
 *
 * Świeżo zarejestrowana organizacja nie miała ANI JEDNEGO wiersza w
 * `v8_feature_flags`. `v8OrgGate` odpowiadał wtedy 404 `V8_ORG_DISABLED` na
 * CAŁEJ powierzchni `/api/v8/*` (Wywiad: Skrzynka/Przydzielone/Wnioski, ale też
 * My Work, Ocena, Realizacja, Czat), bo produkcyjna postawa wymaga JAWNYCH
 * wierszy — a staging i demo działają z NODE_ENV=production.
 *
 * Ten test pilnuje, że provisioning nowej organizacji zapisuje jawne wiersze i
 * że po nim bramka przepuszcza organizację RÓWNIEŻ przy NODE_ENV=production —
 * bez rozluźniania samej bramki.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbRun, mockDbGet, mockDbAll, mockTableExists, mockFeatureFlags } = vi.hoisted(() => ({
  mockDbRun: vi.fn().mockResolvedValue({ success: true }),
  mockDbGet: vi.fn().mockResolvedValue(null),
  mockDbAll: vi.fn().mockResolvedValue([]),
  mockTableExists: vi.fn().mockResolvedValue(true),
  mockFeatureFlags: { ENABLE_V8_GLOBAL: true, ENABLE_V8_SHADOW_MODE: false },
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
  tableExists: (...args: unknown[]) => mockTableExists(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../config/FeatureFlags.js', () => ({ featureFlags: mockFeatureFlags }));

import {
  clearFlagCache,
  isV8Enabled,
  provisionDefaultV8Flags,
  V8_MODULES,
} from '../featureFlagService.js';

const FRESH_ORG = '503f9c10-003f-45ca-bfc6-673fa3f88f0f';
const CREATOR = '00000000-0000-4000-8000-0000000000aa';
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe('provisionDefaultV8Flags (bezpiecznik: świeża organizacja nie dostaje 404 na /api/v8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFlagCache();
    process.env.NODE_ENV = 'production';
    mockFeatureFlags.ENABLE_V8_GLOBAL = true;
    mockTableExists.mockResolvedValue(true);
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    clearFlagCache();
  });

  it('ODTWARZA DEFEKT: bez provisioningu świeża organizacja jest wyłączona przy NODE_ENV=production', async () => {
    mockDbAll.mockResolvedValue([]); // zero wierszy = stan świeżej organizacji

    await expect(isV8Enabled(FRESH_ORG)).resolves.toBe(false);
  });

  it('zapisuje JAWNY wiersz dla każdego modułu V8 (enabled=1)', async () => {
    const result = await provisionDefaultV8Flags(FRESH_ORG, CREATOR);

    expect(result.seeded).toBe(true);
    expect(result.modules).toEqual([...V8_MODULES]);
    expect(mockDbRun).toHaveBeenCalledTimes(V8_MODULES.length);

    const written = mockDbRun.mock.calls.map((call) => {
      const params = call[1] as unknown[];
      return { module: params[2], enabled: params[3], updatedBy: params[5] };
    });
    expect(written.map((w) => w.module)).toEqual([...V8_MODULES]);
    expect(written.every((w) => w.enabled === 1)).toBe(true);
    expect(written.every((w) => w.updatedBy === CREATOR)).toBe(true);
  });

  it('po provisioningu bramka przepuszcza organizację MIMO NODE_ENV=production', async () => {
    await provisionDefaultV8Flags(FRESH_ORG, CREATOR);

    // Baza zwraca teraz wiersze zapisane przez provisioning.
    mockDbAll.mockResolvedValue(V8_MODULES.map((module) => ({ module, enabled: 1 })));
    clearFlagCache(FRESH_ORG);

    await expect(isV8Enabled(FRESH_ORG)).resolves.toBe(true);
    // moduł-po-module (createV8ModuleGate) też musi przechodzić
    await expect(isV8Enabled(FRESH_ORG, 'outputs')).resolves.toBe(true);
  });

  it('brak tabeli flag nie wywraca rejestracji — zgłasza pominięcie zamiast rzucać', async () => {
    mockTableExists.mockResolvedValue(false);

    const result = await provisionDefaultV8Flags(FRESH_ORG, CREATOR);

    expect(result).toEqual({ seeded: false, modules: [], reason: 'table-missing' });
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('błąd zapisu przy istniejącej tabeli JEST propagowany (rejestracja nie wydaje zepsutego workspace)', async () => {
    mockDbRun.mockRejectedValue(new Error('permission denied for table v8_feature_flags'));

    await expect(provisionDefaultV8Flags(FRESH_ORG, CREATOR)).rejects.toThrow(/permission denied/);
  });
});
