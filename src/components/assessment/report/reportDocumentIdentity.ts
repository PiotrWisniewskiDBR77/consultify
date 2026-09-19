/**
 * [ODMROZENIE 04_ASSESSMENT DEC-496] Tożsamość dokumentu raportu oceny.
 *
 * ★ PO CO (zgłoszenie pilotażu P-P10 `8e27e4eb`, zmierzone lokalnie 2026-09-14
 * na kopii danych stagingu). Paweł otworzył w zakładce „Ocena → Raporty" wiersz
 * podpisany `DBR77 Staging Assessment Executive Report` (status FINAL), a
 * dokument, który się otworzył, przedstawiał się jako
 * `DRD · 2.0.0-methodpack.2` / `Analiza gotowości AI` i raportował 0 z 39
 * obszarów. Wnioskiem właściciela było „raport otwiera obcą, pustą ocenę".
 *
 * ★ CO JEST NAPRAWDĘ (pomiar, nie hipoteza — `assessment_reports` na stagingu):
 * wiersz `staging-dbr77-assessment-report` (nazwa „DBR77 Staging Assessment
 * Executive Report", status FINAL, organizacja `a3e05d4a-…`) ma
 * `assessment_id = dbr77-assess-002`, a ta ocena nazywa się „Analiza gotowości
 * AI", jest `archived` i ma `answers_json = NULL`. OBA rekordy należą do TEJ
 * SAMEJ organizacji — to NIE jest wyciek między organizacjami ani zły routing.
 * To jest (a) wada danych zasiewu i (b) wada dokumentu: dokument drukował
 * WYŁĄCZNIE nazwę oceny źródłowej (`output.scope`) i ani jednym słowem nie
 * mówił, który REKORD RAPORTU użytkownik otworzył. Ciągłość „nazwa na liście →
 * nazwa w dokumencie" była przerwana, więc rozbieżność danych wyglądała jak
 * pomyłka identyfikatora.
 *
 * ★ REGUŁA. Gdy raport ma własny rekord (magazyn zastany `assessment_reports`,
 * tu jako `narrative`), to JEGO nazwa jest tytułem dokumentu, a nazwa oceny
 * źródłowej zostaje pokazana OSOBNO i wprost. Gdy rekordu nie ma (zamrożony
 * Output jądra), nic się nie zmienia — tytułem zostaje metodyka, podtytułem
 * zakres. Nic tu nie jest zgadywane ani dopisywane: obie nazwy pochodzą z
 * danych, zmienia się tylko to, która z nich jest tytułem, a która podpisem.
 */

export interface WejscieTozsamosciRaportu {
  /** Nazwa rekordu raportu (`assessment_reports.name`), gdy raport go ma. */
  readonly reportName?: string | null;
  /** Status rekordu raportu (`assessment_reports.status`), np. `FINAL`. */
  readonly reportStatus?: string | null;
  /** Nazwa oceny źródłowej — `output.scope`. */
  readonly scope?: string | null;
  /** Metodyka + wersja, dotychczasowy tytuł dokumentu. */
  readonly methodPackId: string;
  readonly methodPackVersion: string | null;
}

export interface TozsamoscRaportu {
  /** Napis w `<h1>`. */
  readonly title: string;
  /** Drugi wiersz pod tytułem — metodyka, gdy tytułem jest nazwa raportu. */
  readonly subtitle: string | null;
  /**
   * Nazwa oceny, z której raport został zbudowany, albo `null`, gdy dokument
   * i tak już nią jest podpisany (przypadek zamrożonego Outputu jądra).
   */
  readonly sourceAssessmentName: string | null;
  /** Status rekordu raportu do plakietki, wielkimi literami. `null` = brak. */
  readonly reportStatusLabel: string | null;
}

function tekstAlboNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function tozsamoscDokumentuRaportu(wejscie: WejscieTozsamosciRaportu): TozsamoscRaportu {
  const metodyka = `${wejscie.methodPackId.toUpperCase()}${
    wejscie.methodPackVersion ? ` · ${wejscie.methodPackVersion}` : ''
  }`;
  const nazwaRaportu = tekstAlboNull(wejscie.reportName);
  const nazwaOceny = tekstAlboNull(wejscie.scope);

  if (!nazwaRaportu) {
    return {
      title: metodyka,
      subtitle: null,
      sourceAssessmentName: nazwaOceny,
      reportStatusLabel: null,
    };
  }

  return {
    title: nazwaRaportu,
    subtitle: metodyka,
    // Nazwa oceny zostaje pokazana także wtedy, gdy jest identyczna z nazwą
    // raportu — czytelnik ma widzieć, że to JEDEN łańcuch, a nie dwie różne
    // rzeczy, których zgodności nikt nie sprawdził.
    sourceAssessmentName: nazwaOceny,
    reportStatusLabel: tekstAlboNull(wejscie.reportStatus)?.toUpperCase() ?? null,
  };
}
