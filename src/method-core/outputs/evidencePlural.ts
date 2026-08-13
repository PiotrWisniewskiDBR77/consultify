/**
 * Polska odmiana liczebnikowa dla „dowód źródłowy".
 *
 * ★ Jedno źródło, bo już raz się rozjechało: `MethodReportView` miał poprawną
 * odmianę, a `MethodPresentationView` — powstały w tej samej fali — pokazywał
 * klientowi „1 dowodów źródłowych". Ta sama klasa błędu co rozjazd semantyki
 * dowodu między trzema komponentami: dwa miejsca, dwie implementacje, jedno
 * z nich złe.
 */
export function evidenceCountLabel(n: number): string {
  if (n === 0) return 'Bez powiązanych dowodów';
  if (n === 1) return '1 dowód źródłowy';
  const last2 = n % 100;
  const last = n % 10;
  const few = last >= 2 && last <= 4 && (last2 < 10 || last2 >= 20);
  return few ? `${n} dowody źródłowe` : `${n} dowodów źródłowych`;
}
