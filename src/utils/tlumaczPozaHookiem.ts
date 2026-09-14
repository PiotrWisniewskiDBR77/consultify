/**
 * TŁUMACZENIE POZA KOMPONENTEM — bezpieczny zamiennik `i18n.t(...)` dla
 * helperów modułowych (funkcje czyste, budowniczowie dokumentów, mapy etykiet),
 * które nie mogą użyć hooka `useTranslation`.
 *
 * POWÓD ISTNIENIA (zmierzone 2026-09-14, fala E2b-Exec / DEC-510):
 * `buildReportMarkdown` w `src/components/Execution/executionReports.ts` zaczął
 * wołać `i18n.t('execution.report.meta.audience', 'Audience')` na poziomie
 * modułu. W aplikacji działa to poprawnie, bo `i18n` jest już zainicjalizowany.
 * W `tests/unit/execution/executionReportPdfExport.test.ts` instancja `i18next`
 * NIE jest zainicjalizowana — i wtedy `i18n.t` nie zwraca wartości domyślnej,
 * tylko `undefined`. Eksportowany Markdown wyszedł z nagłówkiem
 * `**undefined:** ON TRACK`.
 *
 * To NIE był defekt samego testu. Ten sam warunek (moduł wykonany zanim `i18n`
 * zdąży się zainicjalizować, instancja podmieniona atrapą, brak zasobu
 * językowego) daje na ekranie napis „undefined" zamiast tekstu. Dlatego
 * wartość domyślna jest tu twardym zabezpieczeniem, a nie ozdobą: gdy `t` nie
 * zwróci NIEPUSTEGO NAPISU, oddajemy tekst angielski z kodu.
 *
 * Świadomie `i18next`, a NIE `@/i18n` — z tego samego powodu co w
 * `src/utils/listDateFormat.ts`: `@/i18n` to moduł inicjalizujący (detektor
 * języka + backend HTTP) i wciąganie go do każdego helpera wywracało zestawy
 * testów mockujące `react-i18next`.
 */
import i18n from 'i18next';

/**
 * @param klucz    klucz i18n, np. `execution.report.meta.audience`
 * @param domyslny tekst angielski z kodu — wartość domyślna ORAZ awaryjna
 * @param opcje    interpolacja (`{{count}}`, `{{from}}`, …)
 */
export function tlumaczPozaHookiem(
  klucz: string,
  domyslny: string,
  opcje?: Record<string, unknown>
): string {
  try {
    const wynik = i18n.t(klucz, { defaultValue: domyslny, ...(opcje ?? {}) });
    return typeof wynik === 'string' && wynik.length > 0 ? wynik : domyslny;
  } catch {
    return domyslny;
  }
}
