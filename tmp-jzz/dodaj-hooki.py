import re, sys

# (plik, kotwica_deklaracji, import_react_linia)
HOOKI = [
 ('src/components/Charts/ComparisonRadarChart.tsx',
  'export const ComparisonRadarChart: React.FC<ComparisonRadarChartProps> = ({'),
 ('src/components/Charts/RadarChart.tsx',
  'export const RadarChart: React.FC<RadarChartProps> = ({'),
 ('src/components/EmptyStates/AxisEmptyState.tsx',
  'export const AxisEmptyState: React.FC<AxisEmptyStateProps> = ({'),
 ('src/components/EmptyStates/EmptyStateWithActions.tsx',
  'export const EmptyStateWithActions: React.FC<EmptyStateWithActionsProps> = ({'),
 ('src/components/ModelSelector.tsx',
  'const StatusDot: React.FC<{ isConnected: boolean; isLoading?: boolean }> = ({'),
 ('src/components/access/ForbiddenAccessBanner.tsx',
  'export const ForbiddenAccessBanner: React.FC = () => {'),
 ('src/components/ai/DiffView.tsx', 'export function DiffView({'),
 ('src/components/ai/MAXModeToggle.tsx', 'export function MAXModeToggle({'),
 ('src/components/layout/SplitLayout.tsx', 'export const SplitLayout: React.FC<SplitLayoutProps> = ({'),
 ('src/components/shared/CanonicalWorkHardeningPanel.tsx',
  'export const CanonicalWorkHardeningPanel: React.FC<Props> = ({ item, actorId, onReadback }) => {'),
 ('src/components/shared/TaskMilestoneBlastRadius.tsx',
  'export const TaskMilestoneBlastRadius: React.FC<Props> = ({ task }) => {'),
 ('src/views/V4ComingSoonView.tsx', 'export const V4ComingSoonView: React.FC = () => {'),
]

for plik, kotwica in HOOKI:
    s = open(plik, encoding='utf-8').read()
    if 'useTranslation' not in s:
        m = re.search(r"^import React.*?;\n", s, re.M)
        if not m:
            m = re.search(r"^import .*?from 'react';\n", s, re.M)
        if not m:
            print('BRAK importu react w', plik); sys.exit(1)
        s = s[:m.end()] + "import { useTranslation } from 'react-i18next';\n" + s[m.end():]
    i = s.find(kotwica)
    if i < 0:
        print('BRAK kotwicy w', plik, '::', kotwica[:50]); sys.exit(1)
    # znajdz koniec sygnatury: pierwsze "{\n" po kotwicy na poziomie ciala
    if kotwica.endswith('=> {') or kotwica.endswith(') {'):
        koniec = i + len(kotwica)
    else:
        j = s.find('}) => {', i)
        k = s.find('}: ', i)
        if j >= 0 and (k < 0 or j < k):
            koniec = j + len('}) => {')
        else:
            m2 = re.compile(r'\}:\s*\w+(?:Props)?\)\s*\{').search(s, i)
            if not m2:
                print('nie umiem znalezc konca sygnatury w', plik); sys.exit(1)
            koniec = m2.end()
    if 'const { t } = useTranslation();' in s[koniec:koniec + 400]:
        continue
    s = s[:koniec] + "\n  const { t } = useTranslation();" + s[koniec:]
    open(plik, 'w', encoding='utf-8').write(s)
    print('ok', plik)
