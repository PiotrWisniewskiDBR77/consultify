/**
 * Czy odpowiedź respondenta da się w ogóle zrozumieć — reguła DETERMINISTYCZNA.
 *
 * P-T16 (pilotaż Tomka, DEC-496 pkt XVI): „odpowiedź AI niespójna na
 * tekst-bełkot — raz odrzucona, raz zamieniona w zmyślony akapit".
 *
 * ZMIERZONA PRZYCZYNA (linia `integracja/20260911`): `evaluateInterviewSessionAnswers`
 * (`server/src/controllers/InterviewController.ts:3044`) wysyła KAŻDĄ odpowiedź
 * ze statusem `answered` do modelu z instrukcją systemową:
 *   „For each criterion, write a one-sentence justification tied to the actual
 *    answer text (quote or paraphrase it) — never a generic statement."
 * Dla wejścia typu `asdasdasd` model nie ma czego sparafrazować, a instrukcja
 * zakazuje mu odpowiedzi ogólnej — więc raz zwraca zera z uwagą „nonsensical",
 * a raz dopisuje prawdopodobnie brzmiące zdanie o treści, której nie ma.
 * `temperature: 0.1` zmniejsza rozrzut, ale go nie usuwa: to jest ZMYŚLANIE
 * wymuszone promptem, nie szum próbkowania.
 *
 * LEKARSTWO (ten plik): odpowiedź nieczytelna NIE TRAFIA DO MODELU WCALE —
 * dokładnie tym samym wzorcem, którym plik obok odcina odpowiedzi puste
 * („#48a — Deterministic split: questions with no answer never go to the LLM
 * at all"). Dostaje stałą, przetłumaczoną odpowiedź „Nie rozumiem odpowiedzi —
 * doprecyzuj". Zero szansy na halucynację, bo zero wywołania.
 *
 * ZASADA PROJEKTOWA: fałszywe oskarżenie sensownej odpowiedzi o bełkot jest
 * DUŻO gorsze niż przepuszczenie bełkotu do modelu (ten dostanie wtedy 0 pkt
 * z rubryki i tak). Dlatego wszystkie reguły niżej są konserwatywne i
 * wystarczy JEDEN wiarygodny wyraz, żeby odpowiedź uznać za czytelną.
 */

/** Samogłoski PL+EN+DE (interfejs bywa niemiecki — DEC-493 E5). */
const SAMOGLOSKI = new Set('aeiouyąęóàáâäãåèéêëìíîïòóôöõùúûüæœ'.split(''));

/**
 * Ciągi z jednego rzędu klawiatury. Token je zawierający to naciśnięty rząd,
 * nie słowo — w żadnym z języków produktu nie występują.
 */
const CIAGI_KLAWIATURY = [
  'qwert',
  'werty',
  'ertyu',
  'rtyui',
  'tyuio',
  'yuiop',
  'asdf',
  'sdfg',
  'dfgh',
  'fghj',
  'ghjk',
  'hjkl',
  'zxcv',
  'xcvb',
  'cvbn',
  'vbnm',
  'qazwsx',
  'jkl;',
];

/** Litery tokenu, bez cyfr i interpunkcji, w jednym rejestrze. */
function sameLitery(token: string): string {
  return token.toLowerCase().replace(/[^\p{L}]/gu, '');
}

/** „aaaa", „jjjjj" — trzy i więcej tych samych liter pod rząd. */
function maPotrojnePowtorzenie(litery: string): boolean {
  return /(.)\1{2,}/u.test(litery);
}

/** „asdasdasd", „abcabcabc" — ten sam 2–4-znakowy kawałek powtórzony ≥3×. */
function jestPowtorzonymKawalkiem(litery: string): boolean {
  if (litery.length < 6) return false;
  for (let rozmiar = 2; rozmiar <= 4; rozmiar += 1) {
    if (litery.length % rozmiar !== 0) continue;
    const kawalek = litery.slice(0, rozmiar);
    if (kawalek.repeat(litery.length / rozmiar) === litery && litery.length / rozmiar >= 3) {
      return true;
    }
  }
  return false;
}

function maCiagKlawiatury(litery: string): boolean {
  return CIAGI_KLAWIATURY.some((ciag) => litery.includes(ciag));
}

/**
 * Czy pojedynczy token wygląda jak prawdziwe słowo / dana.
 *
 * Świadomie HOJNA: token z cyfrą (`2023`, `50%`, `ISO-9001`) i krótki skrót
 * pisany wersalikami (`SAP`, `WMS`, `CRM`, `ERP`) są czytelne, choć nie mają
 * samogłosek albo w ogóle liter.
 */
export function czyTokenWygladaJakSlowo(token: string): boolean {
  const surowy = token.trim();
  if (!surowy) return false;
  if (/\d/u.test(surowy)) return true; // liczby, daty, procenty, numery norm

  const litery = sameLitery(surowy);
  if (!litery) return false;
  if (maPotrojnePowtorzenie(litery)) return false;
  if (jestPowtorzonymKawalkiem(litery)) return false;
  if (maCiagKlawiatury(litery)) return false;

  // Skrót branżowy: krótki i pisany wersalikami w oryginale.
  if (litery.length <= 5 && surowy === surowy.toUpperCase() && /\p{L}/u.test(surowy)) return true;

  // Wyraz bez ani jednej samogłoski nie istnieje w PL/EN/DE powyżej 3 liter
  // („wstrząs" ma „ą", „rhythm" ma „y"). Do 3 liter zostawiamy margines
  // („w", „z", „by", „nr").
  const maSamogloske = litery.split('').some((znak) => SAMOGLOSKI.has(znak));
  if (!maSamogloske && litery.length > 3) return false;

  return true;
}

export interface OcenaCzytelnosci {
  /** true = odpowiedzi NIE DA SIĘ zrozumieć; nie wolno jej wysłać do modelu. */
  nieczytelna: boolean;
  /** Nazwa reguły, która zadecydowała — do logu i do audytu, nie do UI. */
  powod:
    | 'pusta'
    | 'brak-wiarygodnego-wyrazu'
    | 'jeden-dlugi-token-bez-samoglosek'
    | 'czytelna';
}

/**
 * Jedyna reguła prawdy dla „czy to bełkot".
 *
 * Odpowiedź jest NIECZYTELNA, gdy nie ma w niej ANI JEDNEGO tokenu, który
 * wygląda jak słowo lub dana. Jeden wiarygodny wyraz wystarczy, żeby poszła
 * do modelu normalną ścieżką — celowo, bo pomyłka w drugą stronę (odrzucenie
 * sensownej odpowiedzi) jest dla respondenta znacznie dotkliwsza.
 */
export function ocenCzytelnoscOdpowiedzi(answerText: unknown): OcenaCzytelnosci {
  const tekst = String(answerText ?? '').trim();
  if (!tekst) return { nieczytelna: true, powod: 'pusta' };

  const tokeny = tekst.split(/[\s.,;:!?/\\|()[\]{}"'—–-]+/u).filter(Boolean);
  if (tokeny.length === 0) return { nieczytelna: true, powod: 'brak-wiarygodnego-wyrazu' };

  const czytelne = tokeny.filter((token) => czyTokenWygladaJakSlowo(token));
  if (czytelne.length === 0) {
    // Jeden długi ciąg spółgłosek („gdfkjghdfkjg") ma własną nazwę reguły —
    // to najczęstszy kształt bełkotu i chcemy go rozróżnić w logu.
    const litery = sameLitery(tekst);
    const bezSamoglosek =
      tokeny.length === 1 &&
      litery.length > 3 &&
      !litery.split('').some((znak) => SAMOGLOSKI.has(znak));
    return {
      nieczytelna: true,
      powod: bezSamoglosek ? 'jeden-dlugi-token-bez-samoglosek' : 'brak-wiarygodnego-wyrazu',
    };
  }

  return { nieczytelna: false, powod: 'czytelna' };
}

/** Stała odpowiedź dla wejścia bez sensu — ta sama za każdym razem, w obu językach. */
export function komunikatNieczytelnejOdpowiedzi(lang: 'pl' | 'en'): string {
  return lang === 'pl'
    ? 'Nie rozumiem odpowiedzi — doprecyzuj. Napisz ją własnymi słowami, najlepiej z konkretem (nazwa systemu, liczba, data).'
    : "I can't interpret this answer — please clarify. Rewrite it in your own words, ideally with a specific detail (a system name, a number, a date).";
}

/** Uzasadnienie przy każdym kryterium rubryki — zero punktów, jawny powód. */
export function uzasadnienieNieczytelnejOdpowiedzi(lang: 'pl' | 'en'): string {
  return lang === 'pl'
    ? 'Treść odpowiedzi jest nieczytelna, więc tego kryterium nie da się ocenić.'
    : 'The answer text is unintelligible, so this criterion cannot be assessed.';
}

/** Zalecenie sesyjne dopisywane, gdy co najmniej jedna odpowiedź była nieczytelna. */
export function zalecenieNieczytelnychOdpowiedzi(lang: 'pl' | 'en'): string {
  return lang === 'pl'
    ? 'Popraw odpowiedzi oznaczone jako nieczytelne — bez zrozumiałej treści nie da się ich ocenić ani wykorzystać w analizie.'
    : 'Rewrite the answers marked as unintelligible — without readable content they cannot be assessed or used in the analysis.';
}
