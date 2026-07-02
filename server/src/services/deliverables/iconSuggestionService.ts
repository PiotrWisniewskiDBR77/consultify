/**
 * iconSuggestionService — W5 / X4 (Seria X, domena assety / ikony)
 *
 * Mapowanie keyword/intencja → nazwa ikony lucide (kompatybilna z lucide-react
 * na FE oraz Iconify pack `lucide:*`). Pure-function, deterministyczne, brak
 * I/O — nadaje się do bezpiecznego wpięcia w generację deliverable bez ryzyka
 * dla klientów.
 *
 * Kontrakt:
 *   - `suggestIconFor(text)` → nazwa lucide (kebab-case) lub fallback `circle`
 *   - matching: substring (case-insensitive), priorytet domeny biznesowej
 *     (initiative/risk/budget/...) PRZED generic ("file", "info")
 *   - fallback NIGDY null — zawsze coś zwracamy (renderer ma zawsze co
 *     pokazać; lepszy `circle` niż pusto).
 *
 * NIE jest LLM-em — to deterministyczny słownik. LLM-driven icon picking
 * to osobna sprawa (B-series mogą rozszerzyć).
 *
 * @module services/deliverables/iconSuggestionService
 */

// ──────────────────────────────────────────────────────────────
// Słownik keyword → lucide icon name
//
// Kolejność ma znaczenie: pierwsze trafienie wygrywa. Zaczynamy od
// najbardziej specyficznych (domena biznesowa DBR77), kończymy na
// generycznych (czas, dokument, użytkownik).
// ──────────────────────────────────────────────────────────────

interface IconRule {
  keywords: string[];
  icon: string;
}

const ICON_RULES: IconRule[] = [
  // ── Strategia / cele ──
  { keywords: ['strateg', 'wizja', 'mission', 'cel'], icon: 'target' },
  { keywords: ['roadmap', 'mapa drog', 'plan działań'], icon: 'map' },
  { keywords: ['priorytet', 'priority'], icon: 'flag' },

  // ── Ryzyka / problemy ──
  { keywords: ['ryzyk', 'risk', 'zagrożen'], icon: 'alert-triangle' },
  { keywords: ['problem', 'issue', 'błąd', 'incident'], icon: 'alert-circle' },
  { keywords: ['compliance', 'zgodność', 'audit', 'audyt'], icon: 'shield-check' },

  // ── Finanse / koszty ──
  { keywords: ['budżet', 'budget', 'koszt', 'cost'], icon: 'wallet' },
  { keywords: ['przychód', 'revenue', 'sprzedaż', 'sales'], icon: 'trending-up' },
  { keywords: ['oszczędn', 'savings', 'roi', 'zysk', 'profit'], icon: 'piggy-bank' },
  { keywords: ['rachunek', 'invoice', 'faktura'], icon: 'receipt' },

  // ── Procesy / operacje ──
  { keywords: ['proces', 'process', 'workflow'], icon: 'workflow' },
  { keywords: ['automatyz', 'automation', 'automat'], icon: 'bot' },
  { keywords: ['inicjat', 'initiative', 'projekt', 'project'], icon: 'rocket' },
  { keywords: ['kpi', 'metryk', 'wskaźnik', 'metric'], icon: 'gauge' },

  // ── Ludzie / zespół ──
  { keywords: ['zespół', 'team', 'pracownik', 'employee', 'kadra'], icon: 'users' },
  { keywords: ['klient', 'customer', 'client'], icon: 'user-check' },
  { keywords: ['partner', 'stakeholder'], icon: 'handshake' },
  { keywords: ['lider', 'leader', 'manager', 'ceo'], icon: 'user-star' },

  // ── Dane / analiza ──
  { keywords: ['dane', 'data', 'baza'], icon: 'database' },
  { keywords: ['analiz', 'analysis', 'insight', 'badani'], icon: 'bar-chart-3' },
  { keywords: ['raport', 'report', 'sprawozdani'], icon: 'file-bar-chart' },

  // ── Czas / harmonogram ──
  { keywords: ['termin', 'deadline', 'czas', 'time'], icon: 'clock' },
  { keywords: ['kalendarz', 'calendar', 'schedule', 'harmonogram'], icon: 'calendar' },
  { keywords: ['etap', 'milestone', 'kamień'], icon: 'milestone' },

  // ── Komunikacja ──
  { keywords: ['email', 'mail', 'wiadomość'], icon: 'mail' },
  { keywords: ['spotkani', 'meeting', 'call', 'rozmow'], icon: 'video' },
  { keywords: ['decyzj', 'decision'], icon: 'gavel' },
  { keywords: ['feedback', 'opinia', 'review'], icon: 'message-square' },

  // ── Technologia ──
  { keywords: ['ai', 'gpt', 'llm', 'sztuczna inteligencja'], icon: 'sparkles' },
  { keywords: ['kod', 'code', 'develop', 'programow'], icon: 'code' },
  { keywords: ['chmur', 'cloud', 'serwer', 'server'], icon: 'cloud' },
  { keywords: ['bezpiec', 'security', 'lock'], icon: 'lock' },

  // ── Edukacja / wiedza ──
  { keywords: ['szkolen', 'training', 'kurs', 'course'], icon: 'graduation-cap' },
  { keywords: ['wiedz', 'knowledge', 'baza wiedzy'], icon: 'book-open' },

  // ── Generic — na końcu ──
  { keywords: ['dokument', 'document', 'plik', 'file'], icon: 'file-text' },
  { keywords: ['info', 'informacja', 'notatka', 'note'], icon: 'info' },
  { keywords: ['gwiazd', 'star', 'wyróżni', 'highlight'], icon: 'star' },
  { keywords: ['check', 'zaznacz', 'gotow', 'done', 'complete'], icon: 'check-circle-2' },
];

/** Default fallback gdy nic nie pasuje. */
const FALLBACK_ICON = 'circle';

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

/**
 * Sugeruje ikonę lucide dla danego tekstu (np. tytuł sekcji, key_message
 * slajdu, etykieta KPI). Case-insensitive substring matching, pierwsze
 * trafienie wygrywa. Zwraca FALLBACK_ICON gdy nic nie pasuje (nigdy null).
 */
export function suggestIconFor(text: string): string {
  if (!text || typeof text !== 'string') return FALLBACK_ICON;
  const normalized = text.toLowerCase();
  for (const rule of ICON_RULES) {
    for (const kw of rule.keywords) {
      if (normalized.includes(kw)) return rule.icon;
    }
  }
  return FALLBACK_ICON;
}

/**
 * Suguje ikonę dla N tekstów (np. sekcji jednego slajdu) z deduplikacją —
 * w obrębie listy nie powtarza tej samej ikony 2× pod rząd (lepsza wizualnie
 * różnorodność). Drugie wystąpienie tej samej ikony → fallback.
 */
export function suggestIconsForList(texts: string[]): string[] {
  const out: string[] = [];
  for (const t of texts) {
    const candidate = suggestIconFor(t);
    if (out.length > 0 && out[out.length - 1] === candidate) {
      out.push(FALLBACK_ICON);
    } else {
      out.push(candidate);
    }
  }
  return out;
}

/** Default fallback ikona — exposed for downstream renderers. */
export const ICON_FALLBACK = FALLBACK_ICON;
