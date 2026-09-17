import { describe, expect, it } from 'vitest';

import {
  KPI_CARD_SET_LEGACY_PARAM,
  KPI_CARD_SET_PARAM,
  kpiCardFromSetPath,
  readKpiCardSetParam,
} from '../kpiCardSetPath';

describe('kpiCardSetPath — W193 URL param', () => {
  it('generuje angielski parametr set dla nowych linków', () => {
    const path = kpiCardFromSetPath('kpi-1', 'scorecard-7');

    expect(path).toBe('/results/kpi/kpi-1?set=scorecard-7');
    expect(path).not.toContain('zbior=');
    expect(KPI_CARD_SET_PARAM).toBe('set');
  });

  it('czyta stare linki zbior bez psucia zapisanych adresów', () => {
    const params = new URLSearchParams(`${KPI_CARD_SET_LEGACY_PARAM}=scorecard-old`);

    expect(readKpiCardSetParam(params)).toBe('scorecard-old');
  });
});
