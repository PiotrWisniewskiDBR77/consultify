import re, sys, collections

# (plik, stare, nowe, ile)
Z = [
 ('src/components/shared/BillingCore.tsx', 'used.toLocaleString()', 'formatListNumber(used)', 1),
 ('src/components/shared/BillingCore.tsx', 'limit.toLocaleString()', 'formatListNumber(limit)', 1),
 ('src/components/shared/BillingCore.tsx',
  "{new Date(inv.createdAt || inv.created_at || '').toLocaleDateString()}",
  "{formatListDate(inv.createdAt || inv.created_at)}", 1),
 ('src/components/shared/BillingCore.tsx',
  "Renews on {new Date(billingData.billing.current_period_end).toLocaleDateString()}",
  "Renews on {formatListDate(billingData.billing.current_period_end)}", 1),
 ('src/components/ui/composed/MetricCard.tsx', '  return value.toLocaleString();', '  return formatListNumber(value);', 1),
 ('src/components/workspaces/FullROIWorkspace.tsx', 'cost.toLocaleString()', 'formatListNumber(cost)', 1),
 ('src/components/workspaces/FullROIWorkspace.tsx', 'benefit.toLocaleString()', 'formatListNumber(benefit)', 1),
 ('src/components/workspaces/FullROIWorkspace.tsx', 'economics.totalCost.toLocaleString()', 'formatListNumber(economics.totalCost)', 2),
 ('src/components/workspaces/FullROIWorkspace.tsx', 'economics.totalAnnualBenefit.toLocaleString()', 'formatListNumber(economics.totalAnnualBenefit)', 1),
 ('src/components/workspaces/FullROIWorkspace.tsx', '(economics.totalAnnualBenefit * 5 - economics.totalCost).toLocaleString()', 'formatListNumber(economics.totalAnnualBenefit * 5 - economics.totalCost)', 1),
 ('src/components/workspaces/ROIPaybackChart.tsx', 'returnAmount.toLocaleString()', 'formatListNumber(returnAmount)', 1),
 ('src/components/workspaces/FullStep4Workspace.tsx', 'economics.totalCost.toLocaleString()', 'formatListNumber(economics.totalCost)', 1),
 ('src/components/workspaces/FullStep4Workspace.tsx', 'economics.totalAnnualBenefit.toLocaleString()', 'formatListNumber(economics.totalAnnualBenefit)', 1),
 ('src/components/workspaces/FullStep6Workspace.tsx', 'econ.totalCost.toLocaleString()', 'formatListNumber(econ.totalCost)', 2),
 ('src/components/workspaces/FullStep6Workspace.tsx', 'econ.totalAnnualBenefit.toLocaleString()', 'formatListNumber(econ.totalAnnualBenefit)', 2),
 ('src/components/workspaces/FullStep6Workspace.tsx', 'new Date().toLocaleDateString()', 'formatListDate(new Date())', 1),
 ('src/components/ai/ActionAuditTrail.tsx', '{new Date(record.created_at).toLocaleString()}', '{formatListDateTime(record.created_at)}', 1),
 ('src/components/ai/EvidencePanel.tsx', 'return new Date(dateString).toLocaleString();', 'return formatListDateTime(dateString);', 1),
 ('src/components/ai/MAXModeToggle.tsx', '~{totalTokens.toLocaleString()} tokenów',
  "~{formatListNumber(totalTokens)} {t('ai.maxMode.tokens', 'tokens')}", 1),
 ('src/components/modals/LowBalanceModal.tsx', '{currentBalance.toLocaleString()} tokens', '{formatListNumber(currentBalance)} tokens', 1),
 ('src/components/shared/ModuleHub/GridView.tsx', '  return d.toLocaleDateString();', '  return formatListDate(d);', 1),
 ('src/components/shared/NModeSections/ActivityLogCanvas.tsx', '{new Date(entry.timestamp).toLocaleString()}', '{formatListDateTime(entry.timestamp)}', 1),
 ('src/components/shared/NModeSections/CommentsCanvas.tsx', '{new Date(c.createdAt).toLocaleDateString()}', '{formatListDate(c.createdAt)}', 1),
 ('src/views/StatusPageView.tsx', '{new Date(item.scheduledStart).toLocaleDateString()}', '{formatListDate(item.scheduledStart)}', 1),
 ('src/hooks/useAssessmentCollaboration.tsx', 'return new Date(date).toLocaleDateString();', 'return formatListDate(date);', 1),
 ('src/utils/safeFormat.ts', '  return date.toLocaleString();', '  return formatListDateTime(date);', 1),
 ('src/components/ai/DraftReviewPanel.tsx', "{new Date(draft.created_at).toLocaleString('pl-PL')}", '{formatListDateTime(draft.created_at)}', 1),
]

uzyte = collections.defaultdict(set)
for plik, stare, nowe, ile in Z:
    s = open(plik, encoding='utf-8').read()
    n = s.count(stare)
    if n == 0:
        print('  (juz zrobione albo brak):', plik, '::', stare[:60]); continue
    s = s.replace(stare, nowe)
    open(plik, 'w', encoding='utf-8').write(s)
    for fn in ('formatListNumber', 'formatListDateTime', 'formatListDate'):
        if fn + '(' in nowe: uzyte[plik].add(fn)

# import SSOT tam, gdzie go brakuje
for plik, funkcje in uzyte.items():
    s = open(plik, encoding='utf-8').read()
    brakujace = sorted(f for f in funkcje if f'\n' and not re.search(rf'\b{f}\b.*from .*listDateFormat', s) )
    ma = re.search(r"^import \{([^}]*)\} from '[^']*listDateFormat';\n", s, re.M)
    if ma:
        obecne = {x.strip() for x in ma.group(1).split(',') if x.strip()}
        nowe_f = sorted(obecne | funkcje)
        s = s[:ma.start()] + "import { " + ', '.join(nowe_f) + " } from " + ma.group(0).split('from ')[1]
        open(plik, 'w', encoding='utf-8').write(s)
        continue
    # wyznacz sciezke wzgledna do src/utils/listDateFormat
    glebokosc = plik.count('/') - 1  # src/ jest korzeniem aliasu
    sciezka = '@/utils/listDateFormat'
    m = re.search(r"^import .*?;\n(?![\s\S]*^import )", s, re.M)
    ostatni_import = None
    for mm in re.finditer(r"^import [\s\S]*?;\n", s, re.M):
        ostatni_import = mm
    if not ostatni_import:
        print('brak importow w', plik); sys.exit(1)
    s = s[:ostatni_import.end()] + f"import {{ {', '.join(sorted(funkcje))} }} from '{sciezka}';\n" + s[ostatni_import.end():]
    open(plik, 'w', encoding='utf-8').write(s)
print('ok, plikow:', len(uzyte))
