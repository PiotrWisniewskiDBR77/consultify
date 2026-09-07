import type { LucideIcon } from 'lucide-react';
import { BarChart3, CalendarRange, CheckSquare, FileText, Gauge, GitBranch, ListOrdered, Sparkles, Table2, Users } from 'lucide-react';

export interface DocumentCardSectionContract {
  readonly id: string;
  readonly label: { readonly pl: string; readonly en: string };
  readonly icon: LucideIcon;
  readonly iconName: string;
  readonly aiReason: string;
}

export const PLAN_CARD_CONTRACT = [
  { id: 'horizon', label: { pl: 'Horyzont', en: 'Horizon' }, icon: CalendarRange, iconName: 'Calendar', aiReason: 'Horyzont jest edytowany przez człowieka w generatorze.' },
  { id: 'scope', label: { pl: 'Zakres inicjatyw', en: 'Initiative scope' }, icon: CheckSquare, iconName: 'CheckSquare', aiReason: 'Zakres wybiera człowiek.' },
  { id: 'windows', label: { pl: 'Kolejność i okna', en: 'Sequence and windows' }, icon: ListOrdered, iconName: 'ListOrdered', aiReason: 'Propozycję tworzy istniejący solver planu.' },
  { id: 'dependencies', label: { pl: 'Zależności i konflikty', en: 'Dependencies and conflicts' }, icon: GitBranch, iconName: 'GitBranch', aiReason: 'Konflikty są wynikiem deterministycznego solvera.' },
  { id: 'capacity', label: { pl: 'Obciążenie ról', en: 'Role load' }, icon: Users, iconName: 'Users', aiReason: 'Podaż jest ręczna i pochodzi z analizy obciążenia.' },
  { id: 'decisions', label: { pl: 'Decyzje', en: 'Decisions' }, icon: BarChart3, iconName: 'BarChart3', aiReason: 'Decyzję publikacji podejmuje człowiek.' },
] as const satisfies readonly DocumentCardSectionContract[];

export const CAPACITY_ANALYSIS_CARD_CONTRACT = [
  { id: 'source', label: { pl: 'Plan źródłowy', en: 'Source plan' }, icon: CheckSquare, iconName: 'CheckSquare', aiReason: 'Źródłem jest opublikowany plan.' },
  { id: 'worksheet', label: { pl: 'Arkusz obciążenia', en: 'Load worksheet' }, icon: Table2, iconName: 'Table2', aiReason: 'Arkusz pokazuje zapisane dane.' },
  { id: 'pressure', label: { pl: 'Luki i presja', en: 'Gaps and pressure' }, icon: Gauge, iconName: 'Gauge', aiReason: 'Luki liczy ta sama reguła co doradca.' },
  { id: 'proposals', label: { pl: 'Propozycje zmian', en: 'Change proposals' }, icon: Sparkles, iconName: 'Sparkles', aiReason: 'Propozycje tworzy istniejący capacityOptionsAdvisor.' },
  { id: 'decisions', label: { pl: 'Decyzje', en: 'Decisions' }, icon: BarChart3, iconName: 'BarChart3', aiReason: 'Decyzję podejmuje człowiek.' },
] as const satisfies readonly DocumentCardSectionContract[];

export const EXECUTION_REPORT_CARD_CONTRACT = [
  { id: 'metrics', label: { pl: 'Mierniki', en: 'Metrics' }, icon: BarChart3, iconName: 'BarChart3', aiReason: 'Mierniki są zamrożoną migawką raportu.' },
  { id: 'content', label: { pl: 'Treść raportu', en: 'Report content' }, icon: FileText, iconName: 'FileText', aiReason: 'Treść pochodzi z opublikowanej migawki raportu.' },
] as const satisfies readonly DocumentCardSectionContract[];

export const MANAGEMENT_REPORT_CARD_CONTRACT = [
  { id: 'report', label: { pl: 'Raport', en: 'Report' }, icon: FileText, iconName: 'FileText', aiReason: 'Raport jest wynikiem istniejącego generatora zarządczego.' },
] as const satisfies readonly DocumentCardSectionContract[];
