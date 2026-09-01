/**
 * Day 233: one governed entry for all 21 real finance panel components.
 * Existing screenshot harnesses provide result-shaped fixtures and mount the
 * production panels; this file only routes the requested panel to them.
 *
 * URL: ?screen=day233-finanse-panele&panel=<key>&state=populated|empty
 */
import React from 'react';

import { FinanceValuePanelsSurface } from '../../src/components/Economics/FinanceValuePanelsSurface';
import Day200FinancePanelsScreen from './day200-finance-panels';
import FinanceValuePanelsScreen from './finance-value-panels';

const FIRST_HARNESS = new Set([
  'value',
  'driver',
  'monte-carlo',
  'real-options',
  'frontier',
  'sensitivity',
  'scenarios',
]);

export default function Day233FinansePaneleScreen(): React.ReactElement {
  const panel = new URLSearchParams(window.location.search).get('panel') ?? 'monte-carlo';
  if (panel === 'list') {
    return <FinanceValuePanelsSurface />;
  }
  return FIRST_HARNESS.has(panel) ? (
    <FinanceValuePanelsScreen panelOverride={panel} />
  ) : (
    <Day200FinancePanelsScreen panelOverride={panel} />
  );
}
