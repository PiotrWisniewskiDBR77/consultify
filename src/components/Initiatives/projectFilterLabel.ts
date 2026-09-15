/**
 * Etykieta opcji w filtrze projektow Inicjatyw (Menu 2, flaga
 * `VITE_INITIATIVES_FOUR_BUTTONS`).
 *
 * POWOD ISTNIENIA (F9, 15.09.2026): na stagingu `c458374bfa` filtr pokazywal
 * TRZY SUROWE UUID zamiast nazw projektow
 * (`wdrozenie-6-20260915/zrzuty/06-initiatives-l6.txt`). Regula mieszkala
 * w `useMemo` wewnatrz 3,5-tysiacznikowego `InitiativesHub.tsx` i konczyla sie
 * `|| id` — czyli wprost drukowala identyfikator, gdy rejestr nie przyniosl
 * nazwy. Tu jest ta sama regula jako osobna, wywolywalna funkcja, zeby dalo
 * sie ja ZMIERZYC testem, a nie tylko obejrzec na zrzucie.
 *
 * Kolejnosc: nazwa z rekordu inicjatywy → nazwa z katalogu projektow
 * (`/api/pmo/projects`) → neutralna etykieta. UUID nie jest etykieta NIGDY —
 * zyje wylacznie jako `value` opcji.
 */
export const resolveProjectFilterLabel = (
  projectId: string,
  projectNameFromInitiative: string | null | undefined,
  projectNamesById: Record<string, string>,
  fallbackLabel: string
): string => {
  const zRekordu = String(projectNameFromInitiative || '').trim();
  if (zRekordu) return zRekordu;
  const zKatalogu = String(projectNamesById?.[projectId] || '').trim();
  if (zKatalogu) return zKatalogu;
  return fallbackLabel;
};
