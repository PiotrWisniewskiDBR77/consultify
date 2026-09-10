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
  widoczna: (id: string) => boolean = () => true,
  idDlaKarty?: (karta: KanonicznaKarta) => string
): NModeSection[] {
  return katalog
    .flatMap((karta) => {
      const membership = karta.kompozycja.find((entry) => entry.artefakt === artefakt);
      if (!membership || membership.kolumna === 'right') return [];
      const id = idDlaKarty?.(karta) ?? membership.idWArtefakcie ?? karta.id;
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

/** Bramka DEC-432: ekran nie może dodać ani zgubić sekcji poza kontraktem. */
export function wymagajSekcjiZKontraktu(
  ekran: readonly Pick<NModeSection, 'id'>[],
  kontrakt: readonly Pick<NModeSection, 'id'>[]
): void {
  const ekranIds = ekran.map(({ id }) => id);
  const kontraktIds = kontrakt.map(({ id }) => id);
  if (JSON.stringify(ekranIds) !== JSON.stringify(kontraktIds)) {
    throw new Error(`SEKCJE_POZA_KONTRAKTEM: ekran=${ekranIds.join(',')} kontrakt=${kontraktIds.join(',')}`);
  }
}

/**
 * Wołacz `wymagajSekcjiZKontraktu` (odbiór A1, W1-A: 0 wołaczy produkcyjnych).
 * Karty N (Wniosek/Decyzja/Powiadomienie) wołają TĘ funkcję z ekranu zbudowanego
 * PO przypisaniu treści (sekcje bez komponentu = odfiltrowane), żeby złapać
 * dokładnie klasę defektu R1 (kontrakt deklaruje sekcję centrum, której ekran
 * nigdy nie renderuje). W produkcji/dev jeden zepsuty ekran nie może wywalić
 * całej karty (dev-warn), w testach ma się zaczerwienić (throw) — stąd osobna
 * funkcja zamiast gołego `wymagajSekcjiZKontraktu` w miejscu wołania.
 */
export function pilnujSekcjiZKontraktu(
  ekran: readonly Pick<NModeSection, 'id'>[],
  kontrakt: readonly Pick<NModeSection, 'id'>[]
): void {
  try {
    wymagajSekcjiZKontraktu(ekran, kontrakt);
  } catch (err) {
    const isTest =
      typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST);
    if (isTest) throw err;
    // eslint-disable-next-line no-console
    console.warn('[contractSections] ' + (err instanceof Error ? err.message : String(err)));
  }
}
