/**
 * P7K — porównanie Rezultatu z CELEM okresu i DOPUSZCZALNYM LIMITEM [%].
 *
 * SSOT `docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md` §5:
 * „Wpis rezultatu → porównanie z CEL i limitem [%] → stan (w normie /
 * ostrzeżenie / krytyczne / brak danych)".
 *
 * DLACZEGO TO NIE JEST `targetGeometryEvaluator`: tamten ewaluator porównuje
 * wynik z ABSOLUTNYMI progami wersji definicji (`warning_low`,
 * `critical_high`, …) i to on wyznacza `performance_status` zapisywany przy
 * każdym pomiarze. Tutaj mowa o czymś innym — o celu KONKRETNEGO OKRESU
 * z raportu i o procentowym limicie z arkusza właściciela, którego progi
 * absolutne nie niosą (patrz `evidence/p7k-wyniki/KROK_0_…`: „progi
 * `warning_*`/`critical_*` są wartościami absolutnymi, nie procentowym
 * limitem z arkusza"). Stan pojedynczego OKRESU nadal bierzemy z zapisanego
 * `performance_status`, żeby nie było dwóch prawd; ta funkcja liczy stan
 * agregatów, których nikt przy zapisie nie policzył — dziś YTD.
 *
 * Zwraca `null`, gdy któregokolwiek składnika brakuje. To NIE jest „w normie":
 * brak limitu albo brak celu znaczy „nie wiadomo", a UI pokazuje wtedy „—".
 */

export type KpiPeriodVerdict = 'on_target' | 'warning' | 'critical';

/** Kierunek miernika z `target_geometry` wersji definicji. */
export type KpiTargetDirection = 'higher_is_better' | 'lower_is_better' | 'unknown';

export function resolveTargetDirection(targetGeometry: string | null): KpiTargetDirection {
  if (targetGeometry === 'threshold_min') return 'higher_is_better';
  if (targetGeometry === 'threshold_max') return 'lower_is_better';
  return 'unknown';
}

export interface EvaluateAgainstPeriodTargetInput {
  actualValue: number | null;
  targetValue: number | null;
  targetGeometry: string | null;
  /** Dopuszczalny limit [%] z kontraktu pozycji raportu. */
  limitPercent: number | null;
}

export function evaluateAgainstPeriodTarget(
  input: EvaluateAgainstPeriodTargetInput
): KpiPeriodVerdict | null {
  const { actualValue, targetValue, limitPercent } = input;
  if (actualValue === null || targetValue === null) return null;
  if (limitPercent === null) return null;
  const direction = resolveTargetDirection(input.targetGeometry);
  if (direction === 'unknown') return null;
  if (targetValue === 0) return null;

  // Dodatnie = lepiej niż cel, ujemne = gorzej. Mianownik na module celu,
  // żeby cel ujemny (np. „strata nie większa niż −X") nie odwracał znaku.
  const signedGap =
    direction === 'higher_is_better'
      ? (actualValue - targetValue) / Math.abs(targetValue)
      : (targetValue - actualValue) / Math.abs(targetValue);

  if (signedGap >= 0) return 'on_target';
  return Math.abs(signedGap) * 100 <= limitPercent ? 'warning' : 'critical';
}
