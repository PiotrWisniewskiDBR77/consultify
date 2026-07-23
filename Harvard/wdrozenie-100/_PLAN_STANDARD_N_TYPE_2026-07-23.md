# Plan dojścia do standardu n-Type v1.0

> Decyzja: **najpierw wspólny szkielet, potem przepięcie sześciu kart.**
> Źródło wymagań: `_STANDARD_N_TYPE_2026-07-23/` (ma pierwszeństwo nad uwagami z panelu).
> Zakres: Decyzja · Zadanie · Powiadomienie · Insight · Narzędzie · Inicjatywa.

---

## Dlaczego szkielet najpierw

Sześć list błędów to w większości **ta sama zmiana opisana sześć razy**: przełącznik N/C,
„Nowa karta", układ drugiego menu, kolejność sekcji panelu, nazwa „Historia".
Naprawa per karta oznacza sześciokrotne wykonanie tej samej roboty i szóstą okazję do rozjazdu.
Po zrobieniu szkieletu znaczna część pozycji z list znika bez dotykania poszczególnych kart.

Ryzyko tej kolejności: przez pierwszy etap nie widać efektu na żadnej karcie z osobna.
Mitygacja — etap 1 kończy się na **Inicjatywie** (jest wzorcem panelu), więc pierwszy widoczny
rezultat pojawia się od razu po nim.

---

## Etap 1 — wspólny szkielet (fundament)

| # | Zakres | Efekt dla właściciela |
|---|---|---|
| 1.1 | **Menu 1**: usunąć przełącznik N/C ze wszystkich kart; jedna akcja główna wg reguły „dokładnie jedna oczywista"; kebab przejmuje techniczne | znika najczęściej zgłaszany błąd (4× w uwagach) |
| 1.2 | **Menu 2**: jeden komponent — lewo `Sekcje`, geometryczny środek `Edycja \| Podgląd`, prawo `How to`, skrajnie `Analizuj z AI` (fiolet). Usunąć „Nowa karta" | wszystkie karty wyglądają tak samo |
| 1.3 | **Prawy panel**: wyciągnąć wzorzec z Inicjatywy jako jeden komponent; stała kolejność Akcje → Właściwości → Powiązania → Źródła i założenia → Rezultaty → Komentarze → Historia | koniec „każda karta ma inny panel" |
| 1.4 | **Historia**: zmiana nazwy z „Historia / AI"; AI jako filtr/typ wpisu | |
| 1.5 | **Pole tekstowe n-Type**: auto-fit, ręczny resize z zapamiętaniem, powrót do auto, AI w rogu, ukrycie kontrolek w Podglądzie | jedno zachowanie pól wszędzie |
| 1.6 | **Przewijanie**: przewija się tylko centrum, panele nieruchome | |

## Etap 2 — przepięcie kart (od najcięższej)

| Kolejność | Karta | Dlaczego tu |
|---|---|---|
| 2.1 | **Powiadomienie** | największa niespójność: pełna wymiana panelu, 3 akcje z nagłówka, brak Edycja\|Podgląd |
| 2.2 | **Narzędzie** | wymiana panelu, Sekcje na lewo, pola centralne jako standardowe; blokada odbioru: nie da się wystartować sesji |
| 2.3 | **Decyzja** | „Zatwierdź decyzję" do Akcji, pasek workflow przestaje udawać Menu 2 |
| 2.4 | **Zadanie** | banner „Created from decision" → Właściwości/Powiązania/Źródła; pasek Ukończ/Zablokuj/Przydziel → Akcje |
| 2.5 | **Insight** | Eksportuj i Dalsze → Rezultaty/kebab |
| 2.6 | **Inicjatywa** | najlżejsza: usunąć „Zakres" i nazwę aktywnej karty z paska |

## Etap 3 — funkcje AI

- `Analizuj z AI` per karta: braki / ryzyka / sugestie / proponowane zmiany, każda z akcją
  Zastosuj · Pokaż różnicę · Odrzuć; AI nie nadpisuje bez potwierdzenia.
- AI w nagłówku: rozmowa w kontekście całego artefaktu, nie zastępuje prawego panelu.
- Kryteria oceny per typ artefaktu — wg list błędów (każdy plik ma własną sekcję „Analizuj z AI").

## Etap 4 — dług wizualny

- 20 miejsc `dark:via-*` w 13 plikach (martwy wariant Tailwinda).
- Czerwień w Prezentacji (30) i Arkuszu (12).
- Nieczytelne napisy w ciemnym: Dokument (1), Prezentacja (2).

---

## Jak mierzymy postęp

Matryca ocen na stronie odbioru: **6 kart × 5 osi (Menu · Nawigacja · Funkcja · Merytoryka · Grafika)**,
skala 0–10, zapis do `odbior-uwagi/_oceny.json`. Punkt odniesienia = standard n-Type v1.0,
więc oceny sprzed standardu nie są porównywalne — zaczynamy pomiar od nowa.

Bramka etapu 1: wszystkie sześć kart używa tego samego nagłówka, drugiego menu i panelu —
sprawdzalne automatem, nie deklaracją.
