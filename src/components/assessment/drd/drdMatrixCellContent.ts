/**
 * Treść komórki i etykieta wiersza macierzy DRD — CZYSTA logika, bez Reacta.
 *
 * Wydzielone z `DRDAssessmentEditor.tsx`, żeby bramka liczbowa z
 * `docs/program/grafika/MACIERZ_TRESC_KOMOREK.md` mierzyła TEN kod, który
 * renderuje ekran, a nie jego kopię w skrypcie (pułapka „harness kłamie").
 */
import i18n from 'i18next';

import type { DRDArea } from '../../../services/drdStructure';
import { nazwaWJezyku } from './drdNazwa';

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

/**
 * NAZWA OBSZARU (I OSI) W MACIERZY — jedno źródło dla wszystkich czterech miejsc,
 * w których ta siatka żyje (edytor · sesja · raport z oceny · prezentacja).
 *
 * ★ ZGŁOSZENIE WŁAŚCICIELA 2026-09-05: w raporcie z oceny dolny pasek macierzy
 * podpisywał kolumny po angielsku („Sales Processes", „Marketing Processes"),
 * podczas gdy drzewo obszarów W TYM SAMYM OKNIE, dwadzieścia centymetrów obok,
 * pisało „Procesy Sprzedaży", „Procesy Marketingowe". Jeden ekran mówił dwoma
 * językami o tej samej rzeczy.
 *
 * ★ DLACZEGO TERAZ Z WARUNKIEM NA JĘZYK (fala J3, 2026-09-14). Poprzednia
 * wersja brała `namePL || name` BEZWARUNKOWO, a uzasadniała to tym, że
 * drzewo obszarów robi dokładnie to samo — więc warunek rozjechałby macierz
 * z drzewem. Ta przesłanka przestała być prawdziwa: fala J1 przestawiła
 * drzewo, panel jakości, warsztat i etykiety raportu na `nazwaWJezyku`
 * (`drdNazwa.ts`, `drdLabels.ts`), a macierz została ostatnim miejscem z
 * bezwarunkowym `namePL`. Zmierzone na koncie EN (staging a2b0a0fe32,
 * sesja 381966f5): dolny pasek obszarów i tabela AREA/AS/TO w raporcie
 * pisały „Procesy Sprzedaży", a karta dwadzieścia centymetrów niżej
 * „1A · Sales Processes" — ten sam rozjazd jednego ekranu, dla którego ta
 * funkcja powstała, tylko w drugą stronę. Kryterium odbioru „te same nazwy,
 * co w drzewie" jest więc dziś spełnione WŁAŚNIE przez warunek na język.
 *
 * ★ DECYZJA 01.09 („nie odpolszczamy tego, co polskie") NADAL OBOWIĄZUJE —
 * dotyczyła ekranu POLSKIEGO (slajd 6 zaakceptowany po polsku) i ten kod jej
 * nie łamie: dla `language=pl` zwracamy dokładnie to, co wcześniej.
 * Zmienia się wyłącznie zachowanie dla konta EN.
 *
 * ★ GRANICA JĘZYKOWA — CO SIĘ NIE ZMIENIA. `KANON_Z_ODBIOROW.md` (31.08)
 * stanowi, że metodyka DRD zostaje po angielsku, bo książka jest po angielsku.
 * Nazwy poziomów (etykiety wierszy) i technologie w komórkach zostają
 * angielskie — nie mają polskich odpowiedników w metodyce (`DRDLevel` nie ma
 * pola `titlePL`, patrz `MACIERZ_TRESC_KOMOREK.md` §2.4). Zmienia się
 * WYŁĄCZNIE nazwa obszaru, bo dla niej polski odpowiednik JEST w SSOT
 * (`DRDArea.namePL`, 48 wpisów) i cała reszta produktu już się nim posługuje.
 * Macierz była jedynym miejscem, które go ignorowało.
 */
export function etykietaObszaru(
  /**
   * Obszar ALBO oś — obie struktury metodyki mają tę samą parę pól
   * (`name` + opcjonalne `namePL`) i tę samą regułę podpisu, więc podpis osi
   * w selektorze edytora nie może rozjechać się z podpisem obszaru w siatce.
   */
  jednostka: Pick<DRDArea, 'name' | 'namePL'>,
  /**
   * Język interfejsu. Domyślnie czytany z `i18next` — sześć wołaczy w
   * `DRDAssessmentEditor` nie musi przeciągać flagi przez cztery poziomy
   * propsów, a test może podać ją wprost.
   */
  poPolsku: boolean = interfejsPoPolsku()
): string {
  return nazwaWJezyku(jednostka.namePL?.trim(), jednostka.name, poPolsku);
}

/**
 * Świadomie `i18next`, a NIE `@/i18n`: ten drugi jest modułem inicjalizującym
 * (backend HTTP, detektor) i wciągałby to wszystko do każdego testu, który
 * mockuje `react-i18next` — ten sam powód, dla którego robi tak
 * `src/components/assessment/report/drdLabels.ts`.
 */
function interfejsPoPolsku(): boolean {
  return String(i18n.language || '').toLowerCase().startsWith('pl');
}

export const MIN_CZYTELNA_KOLUMNA_PX = 56;

/**
 * MINIMUM SZEROKOŚCI KOLUMNY OBSZARU — liczone z faktycznego kadru siatki.
 *
 * `gridTemplateColumns` używa `minmax(min, 1fr)`: kolumny ROSNĄ, gdy jest
 * miejsce, i wypychają siatkę w przewijanie, gdy suma minimów przekracza kadr.
 * Sterujemy więc minimum:
 *  - kadr jeszcze nie zmierzony (`kadrPx <= 0`, pierwsza klatka albo jsdom) →
 *    minimum bazowe, czyli dokładnie zachowanie sprzed 05.09;
 *  - wszystkie kolumny mieszczą się przy minimum bazowym → zostaje bazowe
 *    (edytor i prezentacja mają szeroki kadr i nic tam nie chudnie);
 *  - nie mieszczą się → minimum schodzi do szerokości, która mieści komplet,
 *    ale nigdy poniżej `MIN_CZYTELNA_KOLUMNA_PX`.
 *
 * Zwracana liczba jest całkowita — ułamek piksela w `minmax()` potrafi dodać
 * 1 px zaokrąglenia na kolumnę, co przy 9 kolumnach wystarcza, żeby siatka
 * mimo wszystko wpadła w przewijanie.
 */
export function minimumKolumnyMacierzy(wejscie: {
  kadrPx: number;
  liczbaObszarow: number;
  labelColumnPx: number;
  gapPx: number;
  columnMinPx: number;
}): number {
  const { kadrPx, liczbaObszarow, labelColumnPx, gapPx, columnMinPx } = wejscie;
  const bazowy =
    liczbaObszarow >= 9
      ? Math.min(columnMinPx, 92)
      : liczbaObszarow >= 7
        ? Math.min(columnMinPx, 120)
        : columnMinPx;
  if (liczbaObszarow <= 0 || kadrPx <= 0) return bazowy;
  // `clientWidth` zawiera padding kadru (p-2 = 8 px z każdej strony) i jedną
  // przerwę na każdą granicę kolumn (etykieta + N obszarów = N przerw).
  const naKolumny = kadrPx - 16 - labelColumnPx - gapPx * liczbaObszarow;
  if (naKolumny <= 0) return bazowy;
  const zmieszczone = Math.floor(naKolumny / liczbaObszarow);
  if (zmieszczone >= bazowy) return bazowy;
  return Math.max(MIN_CZYTELNA_KOLUMNA_PX, zmieszczone);
}
