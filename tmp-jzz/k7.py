import re, sys, collections

# (plik, linia_hint, stare, nowe)
Z = [
 ('src/components/shared/BillingCore.tsx', 'used.toLocaleString()', 'formatListNumber(used)'),
 ('src/components/shared/BillingCore.tsx', 'limit.toLocaleString()', 'formatListNumber(limit)'),
 ('src/components/shared/BillingCore.tsx',
  "{new Date(inv.createdAt || inv.created_at || '').toLocaleDateString()}",
  "{formatListDate(inv.createdAt || inv.created_at)}"),
 ('src/components/ui/composed/MetricCard.tsx', '  return value.toLocaleString();', '  return formatListNumber(value);'),
 ('src/components/workspaces/FullROIWorkspace.tsx', '${cost.toLocaleString()}', '${formatListNumber(cost)}'),
 ('src/components/workspaces/FullROIWorkspace.tsx', '${benefit.toLocaleString()}', '${formatListNumber(benefit)}'),
 ('src/components/workspaces/ROIPaybackChart.tsx', '.toLocaleString()', '__SSOT_NUM__'),
 ('src/utils/initiativeHelpers.ts', "toLocaleDateString('en-US'", '__DATA_SSOT__'),
]
