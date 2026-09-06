import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpenCheck,
  Bot,
  Boxes,
  Brain,
  Building2,
  Calculator,
  Calendar,
  CheckSquare,
  Clock,
  Contact,
  Eye,
  EyeOff,
  FileText,
  Flag,
  FlaskConical,
  FolderOpen,
  GitBranch,
  GitCompare,
  Gauge,
  Goal,
  GraduationCap,
  Heart,
  History,
  Info,
  Layers,
  Lightbulb,
  Link,
  Link2,
  ListChecks,
  MapIcon,
  MessageSquare,
  Network,
  PackageCheck,
  Paperclip,
  Quote,
  Radio,
  Rocket,
  Scale,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Target,
  TrendingUp,
  UserMinus,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

import type { NModeSection } from '@/components/shared/NModeLayout/types';

import type { KanonicznaKarta } from './cardContract.types';
import type { KartaNKey } from './registry';

const IKONY: Record<string, LucideIcon> = {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpenCheck,
  Bot,
  Boxes,
  Brain,
  Building2,
  Calculator,
  Calendar,
  CheckSquare,
  Clock,
  Contact,
  Eye,
  EyeOff,
  FileText,
  Flag,
  FlaskConical,
  FolderOpen,
  GitBranch,
  GitCompare,
  Gauge,
  Goal,
  GraduationCap,
  Heart,
  History,
  Info,
  Layers,
  Lightbulb,
  Link,
  Link2,
  ListChecks,
  MapIcon,
  MessageSquare,
  Network,
  PackageCheck,
  Paperclip,
  Quote,
  Radio,
  Rocket,
  Scale,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Target,
  TrendingUp,
  UserMinus,
  Users,
  UsersRound,
};

/**
 * DEC-432: jedyny adapter kontrakt -> sekcje ekranu.
 * Id, etykieta, ikona i kolejność pochodzą wyłącznie z KanonicznaKarta.
 * Komponent powierzchni dostarcza tylko treść i data-driven widoczność.
 */
export function sekcjeZKontraktu(
  katalog: readonly KanonicznaKarta[],
  artefakt: KartaNKey,
  widoczna: (id: string) => boolean = () => true
): NModeSection[] {
  return katalog
    .flatMap((karta) => {
      const membership = karta.kompozycja.find((entry) => entry.artefakt === artefakt);
      if (!membership || membership.kolumna === 'right') return [];
      const id = membership.idWArtefakcie ?? karta.id;
      if (!widoczna(id)) return [];
      const icon = IKONY[karta.ikona];
      if (!icon) throw new Error(`Brak ikony kontraktu: ${karta.ikona} (${artefakt}/${id})`);
      return [{
        id,
        icon,
        label: karta.label,
        component: null,
        __kolejnosc: membership.kolejnosc ?? Number.MAX_SAFE_INTEGER,
      }];
    })
    .sort((a, b) => a.__kolejnosc - b.__kolejnosc)
    .map(({ __kolejnosc: _kolejnosc, ...section }) => section);
}
