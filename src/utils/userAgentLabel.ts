/**
 * userAgentLabel — surowy User-Agent → krótka, czytelna etykieta urządzenia.
 *
 * POWÓD (przegląd 149-admin-rodziny, 2026-08-31): `AdminSessionsPanel` pokazuje
 * kolumnę urządzenia jako `device_info || user_agent`. Gdy backend nie ustawi
 * `device_info` (np. sesje kont serwisowych / agentów provisioningu), na ekran
 * trafia surowy string typu
 * `Mozilla/5.0 (Windows NT 10.0; Win64; x64) okta-provision-agent/2.1` — nie do
 * odczytania dla właściciela. Ta funkcja rozpoznaje kilka najczęstszych
 * przypadków (system + przeglądarka, znany wzorzec „*-agent/*") i dla reszty
 * oddaje uczciwy fallback zamiast zmyślonej nazwy. Pełny UA zawsze zostaje
 * dostępny (wołający wstawia go np. w atrybut `title`) — ta funkcja tylko
 * SKRACA, nigdy nie ukrywa dowodu.
 */

import { humanizeEnum } from './enumLabels';

function detectOs(ua: string): string | null {
  if (/windows nt/i.test(ua)) return 'Windows';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/mac os x/i.test(ua)) return 'macOS';
  if (/android/i.test(ua)) return 'Android';
  if (/linux/i.test(ua)) return 'Linux';
  return null;
}

function detectBrowser(ua: string): string | null {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return 'Chrome';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return 'Safari';
  return null;
}

/** `foo-bar-agent/1.0` → `foo-bar` (the service/automation name), or `null`. */
function detectAutomationAgent(ua: string): string | null {
  const match = ua.match(/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)-agent\/[\d.]+/i);
  return match ? match[1] : null;
}

export interface UserAgentLabels {
  /** Shown when the UA cannot be classified at all. */
  unknown: string;
  /** Prefix for a recognized `*-agent/*` automation/service pattern. */
  automationAgent: string;
}

/**
 * Summarize a raw User-Agent string into a short, human-readable device
 * label. Labels are passed in (not hardcoded) so the call site controls
 * language — this module has no i18n access of its own.
 */
export function summarizeUserAgent(ua: string | null | undefined, labels: UserAgentLabels): string {
  const raw = String(ua ?? '').trim();
  if (!raw) return labels.unknown;

  const os = detectOs(raw);
  const browser = detectBrowser(raw);
  if (os && browser) return `${browser} · ${os}`;

  const agent = detectAutomationAgent(raw);
  if (agent) return `${labels.automationAgent} · ${humanizeEnum(agent)}`;

  if (browser) return browser;
  if (os) return os;
  return labels.unknown;
}
