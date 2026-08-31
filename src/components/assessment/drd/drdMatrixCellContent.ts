/**
 * Treść komórki i etykieta wiersza macierzy DRD — CZYSTA logika, bez Reacta.
 *
 * Wydzielone z `DRDAssessmentEditor.tsx`, żeby bramka liczbowa z
 * `docs/program/grafika/MACIERZ_TRESC_KOMOREK.md` mierzyła TEN kod, który
 * renderuje ekran, a nie jego kopię w skrypcie (pułapka „harness kłamie").
 */
import type { DRDArea } from '../../../services/drdStructure';

/**
 * SKRACANIE TERMINU DO KOMÓRKI — reguła DŁUGOŚCI, nie reguła przynależności.
 *
 * Poprzednik (biała lista 16 skrótów) miał słuszny cel i zły instrument:
 * komórka ma ~92–180 px i czcionkę 11 px, więc `Value Stream Mapping (VSM)`
 * rozwaliłoby siatkę. Lista skrótów rozwiązywała to przez wybór terminu
 * Z DOWOLNEGO miejsca listy — i tak kolumna 1F stawała się sześć razy „MES",
 * a szczyt drabiny AI w 1A pokazywał „CRM".
 *
 * Tu skracamy sam napis, nie zmieniając którego terminu dotyczy:
 *  1. `Value Stream Mapping (VSM)` → `VSM`  — nawias ze skrótem,
 *  2. `EDR/Antivirus (CrowdStrike, …)` → `EDR/Antivirus` — nawias z listą
 *     marek/przykładów (osie 4–7 mają takich wpisów kilkadziesiąt); poznajemy
 *     ją po przecinku albo po wielkiej literze (nazwa własna),
 *  3. `Next-Gen Firewall (segmentation)` → BEZ ZMIAN. Nawias pisany samą małą
 *     literą to DOPRECYZOWANIE, nie przykład — i bywa jedyną różnicą między
 *     dwoma poziomami tego samego obszaru (`Next-Gen Firewall` stoi na osi 6
 *     na poziomie 1 i 6). Obcięcie go zrobiłoby dwie identyczne komórki, czyli
 *     dokładnie ten defekt, który ta zmiana usuwa.
 *  4. `(Punkt startowy)` → bez zmian — nawias jest całym terminem.
 * Pełny termin zostaje w `title=` i w popoverze.
 */
export function skrocTerminDoKomorki(term: string): string {
  const t = (term || '').trim();
  if (!t) return '';
  const skrot = t.match(/^(.+?)\s*\(([A-Z0-9/&+.-]{2,6})\)$/);
  if (skrot) return skrot[2];
  const nawias = t.match(/^([^(]+?)\s*\(([^()]*)\)$/);
  if (nawias && nawias[1].trim() && /[A-Z,]/.test(nawias[2])) return nawias[1].trim();
  return t;
}

/**
 * „Technologia", która jest w całości nawiasem, technologią nie jest:
 * `(Punkt startowy)`, `(Brak — poziom wyjściowy)`, `(Punkt startowy — brak
 * formalnych wdrożeń)`. Cztery takie wpisy stoją na pozycji 0 na osiach 6 i 7
 * (poziom wyjściowy = z definicji brak narzędzia). W komórce mają ustąpić
 * miejsca tytułowi poziomu — na tych osiach tytuł jest różny w każdym obszarze,
 * więc nie grozi kolumnami-bliźniakami jak na osi 1.
 */
export function czyTerminToPlaceholder(term: string): boolean {
  return /^\(.*\)$/.test((term || '').trim());
}

/**
 * ETYKIETY WIERSZY — z metodyki (`drdStructure.ts`), nie z zaszytej tablicy.
 *
 * Bierzemy nazwę poziomu tylko wtedy, gdy obszary osi są co do niej zgodne
 * (większość bezwzględna): oś 1 ma 9/9 tę samą drabinę książkową
 * (`Basic Data Registration … AI Support`), osie 2–3 mają 5/5 skalę
 * `Basic … Expert` (na osi 3 poziom 4 ma wariant większościowy 4/5).
 * Na osiach 4–7 KAŻDY obszar ma własną nazwę poziomu — żadna z nich nie jest
 * prawdą dla całego wiersza, więc wiersz zostaje przy samym numerze zamiast
 * podawać nazwę jednego obszaru jako nazwę wszystkich.
 */
export function etykietyPoziomowZMetodyki(
  areas: DRDArea[],
  levelCount: number
): Record<number, string> {
  const out: Record<number, string> = {};
  for (let level = 1; level <= levelCount; level++) {
    const licznik = new Map<string, number>();
    for (const area of areas) {
      const tytul = area.levels?.find((l) => l.level === level)?.title?.trim();
      if (tytul) licznik.set(tytul, (licznik.get(tytul) ?? 0) + 1);
    }
    let best = '';
    let bestCount = 0;
    for (const [tytul, ile] of licznik) {
      if (ile > bestCount) {
        best = tytul;
        bestCount = ile;
      }
    }
    if (best && bestCount * 2 > areas.length) out[level] = best;
  }
  return out;
}
