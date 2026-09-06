/**
 * [ODMROZENIE 07_MY_WORK_AGENT DEC-397]
 * DEC-406 punkt (2), 06.09 — ETYKIETA CHIPA W MENU 3 MOJEJ PRACY TO TYTUL REKORDU.
 *
 * Wlasciciel zobaczyl rzad chipow: „Lista | Zlozenie dokumentacji zg… | Dlaczego
 * tracimy klientow… | Task | Task | Task | inicjatywa". Trzy chipy nazwane
 * TYPEM zamiast rekordem biora sie stad, ze polowa wolaczy `handleTaskClick(id)`
 * /`handleDecisionClick(id)` NIE MA pod reka danych rekordu (klik z powiadomienia,
 * z gleboko-linku `?taskId=`, z panelu powiazan) — karta dostaje wtedy nazwe
 * zastepcza „Task"/„Zadanie".
 *
 * Ten modul jest CZYSTY (zero React, zero importu `Api`) — dzieki temu kontrakt
 * „chip nigdy nie zostaje na nazwie typu" da sie zmierzyc testem bez montowania
 * ~9k-liniowego `MyWorkHub`. Pobieranie wstrzykuje wolacz.
 */

/**
 * Nazwy, ktore rekord dostaje, gdy wolacz nie znal jeszcze tytulu. Porownanie
 * jest bez wielkosci liter i bez ogonkow bialych znakow. Trzymamy OBA jezyki,
 * bo nazwa zapisuje sie do sessionStorage w jezyku, ktory byl aktywny przy
 * otwarciu karty, a interfejs mozna przelaczyc pozniej.
 */
export const NAZWY_ZASTEPCZE_KART: Readonly<Record<string, readonly string[]>> = {
  task: ['task', 'zadanie', 'new task', 'nowe zadanie'],
  decision: ['decision', 'decyzja', 'new decision', 'nowa decyzja'],
  idea: ['idea', 'pomysl', 'pomysł', 'new idea', 'nowy pomysl', 'nowy pomysł'],
  notification: ['notification', 'powiadomienie'],
  initiative: ['initiative', 'inicjatywa'],
};

const znormalizuj = (wartosc: string): string =>
  String(wartosc ?? '')
    .trim()
    .toLowerCase();

/** Czy etykieta chipa jest nazwa TYPU (a nie tytulem rekordu)? */
export function czyNazwaZastepcza(nazwa: string | null | undefined, typ: string): boolean {
  const n = znormalizuj(nazwa ?? '');
  if (!n) return true;
  const zastepcze = NAZWY_ZASTEPCZE_KART[typ] ?? [];
  return zastepcze.includes(n);
}

/**
 * Sciezka API, spod ktorej da sie odczytac tytul rekordu. `null` = dla tego typu
 * nie dociagamy nic (pomysly maja wlasna zmiane nazwy, powiadomienia nie maja
 * osobnego zasobu tytulu).
 */
export function sciezkaTytuluRekordu(typ: string, id: string): string | null {
  const bezpieczneId = encodeURIComponent(String(id));
  if (typ === 'task') return `/my-work/personal-tasks/${bezpieczneId}`;
  if (typ === 'decision') return `/decisions/${bezpieczneId}/detail`;
  return null;
}

/** Wyluskaj tytul z odpowiedzi API — ksztalt roznia sie miedzy zasobami. */
export function wyciagnijTytul(odpowiedz: unknown): string | null {
  const kandydaci: unknown[] = [];
  const dodaj = (o: unknown) => {
    if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>;
      kandydaci.push(r.title, r.name, r.subject);
    }
  };
  dodaj(odpowiedz);
  if (odpowiedz && typeof odpowiedz === 'object') {
    const r = odpowiedz as Record<string, unknown>;
    dodaj(r.data);
    dodaj(r.task);
    dodaj(r.decision);
  }
  for (const k of kandydaci) {
    if (typeof k === 'string' && k.trim()) return k.trim();
  }
  return null;
}

/**
 * Dociagnij tytul rekordu. `pobierz` to wstrzykniety wolacz HTTP (`Api.get`) —
 * dzieki temu test kontraktu nie potrzebuje sieci ani atrapy modulu `services/api`.
 */
export async function pobierzTytulRekordu(
  typ: string,
  id: string,
  pobierz: (sciezka: string) => Promise<unknown>
): Promise<string | null> {
  const sciezka = sciezkaTytuluRekordu(typ, id);
  if (!sciezka) return null;
  try {
    return wyciagnijTytul(await pobierz(sciezka));
  } catch {
    return null;
  }
}
