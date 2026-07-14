/**
 * recipientGovernance — W6.3/W6.4: governance odbiorców automatycznej dostawy.
 *
 * Pętla dostawy (scheduledReportService) wysyłała do KAŻDEGO adresu z listy bez
 * kontroli. Ten moduł — czysto, bez I/O — waliduje i filtruje odbiorców PRZED
 * wysyłką: poprawność adresu, deduplikacja (case-insensitive), lista opt-out
 * (rezygnacje) oraz twardy limit liczby odbiorców (ochrona przed nadużyciem/literówką
 * typu „cała książka adresowa").
 *
 * Każdy odrzucony odbiorca niesie POWÓD (audyt/diagnostyka). Deterministyczny, fail-soft.
 *
 * SSOT: M17 plan W6.3 (governance odbiorców) + W6.4 (opt-out).
 */

// ── Typy ─────────────────────────────────────────────────────────────────────

export type RejectReason = 'invalid_format' | 'duplicate' | 'opted_out' | 'over_limit';

export interface RejectedRecipient {
  email: string;
  reason: RejectReason;
}

export interface GovernanceResult {
  /** Adresy dopuszczone do wysyłki (znormalizowane: trim + lowercase). */
  allowed: string[];
  /** Odrzucone z powodem. */
  rejected: RejectedRecipient[];
}

export interface GovernanceOptions {
  /** Zbiór adresów, które zrezygnowały (opt-out). Porównanie case-insensitive. */
  optOut?: Iterable<string>;
  /** Maksymalna liczba odbiorców na jedną dostawę. Domyślnie 100. */
  maxRecipients?: number;
}

const DEFAULT_MAX = 100;

// Pragmatyczny walidator e-mail (nie RFC-kompletny, ale odrzuca śmieci):
// dokładnie jeden @, część lokalna i domena niepuste, domena z kropką i TLD ≥2.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/** Czy adres ma poprawny format? */
export function isValidEmail(email: unknown): boolean {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

/**
 * Filtruje listę odbiorców wg governance: format → opt-out → dedupe → limit.
 * Kolejność reguł jest istotna (powód odrzucenia = pierwsza naruszona reguła).
 * Zwraca dopuszczone (znormalizowane, unikalne) + odrzucone z powodem.
 */
export function governRecipients(
  recipients: unknown,
  opts: GovernanceOptions = {}
): GovernanceResult {
  const allowed: string[] = [];
  const rejected: RejectedRecipient[] = [];
  if (!Array.isArray(recipients)) return { allowed, rejected };

  const max = Number.isFinite(opts.maxRecipients)
    ? Math.max(0, opts.maxRecipients as number)
    : DEFAULT_MAX;
  const optOut = new Set<string>();
  for (const o of opts.optOut ?? []) {
    if (typeof o === 'string') optOut.add(normalize(o));
  }

  const seen = new Set<string>();
  for (const raw of recipients) {
    const original = typeof raw === 'string' ? raw : String(raw ?? '');
    // 1. format
    if (!isValidEmail(original)) {
      rejected.push({ email: original, reason: 'invalid_format' });
      continue;
    }
    const norm = normalize(original);
    // 2. opt-out
    if (optOut.has(norm)) {
      rejected.push({ email: norm, reason: 'opted_out' });
      continue;
    }
    // 3. dedupe
    if (seen.has(norm)) {
      rejected.push({ email: norm, reason: 'duplicate' });
      continue;
    }
    // 4. limit
    if (allowed.length >= max) {
      rejected.push({ email: norm, reason: 'over_limit' });
      continue;
    }
    seen.add(norm);
    allowed.push(norm);
  }

  return { allowed, rejected };
}
