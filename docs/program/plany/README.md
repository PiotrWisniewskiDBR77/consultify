# Plany domknięcia Consultify — stan 2026-08-29 (noc)

Dwa plany, rozdzielone wg tego, KTO wykonuje. **Obowiązują wersje drugie.**

## OBOWIĄZUJĄCE

### Plan funkcji — `PLAN_FUNKCJE.html`
Siedem faz, tabela wszystkich szesnastu modułów (stan docelowy wg kontraktu ·
stan odbioru), trzy pytania do właściciela. Wykonawca: Codex, duże klocki
wydawane instrukcją z generatora; nadzorca pisze, odbiera adwersaryjnie, scala.

Definicja „stu procent" pochodzi z **kontraktów modułów** wskazanych w
`docs/SOURCE_OF_TRUTH.md`, nie z propozycji autora.

### Plan grafiki — `PLAN_GRAFIKA.html`
Cztery fale. Definicja „stu procent" wzięta ze **standardów UI**: 43 punkty
listy czekowania dla ekranu listowego, 18 pozycji definicji ukończenia dla
artefaktu, 6+1 bloków dla podglądu, rubryka trzech osi dla pliku wychodzącego
do klienta. Wykonawca: **nadzorca sam** — grafika nie idzie do Codexa.

## ZASTĄPIONE — zachowane, nie kasujemy przegranego źródła

- `PLAN_A_DYZURY_CODEX.html` → zastąpiony przez `PLAN_FUNKCJE.html`
- `PLAN_B_UIUX.html` → zastąpiony przez `PLAN_GRAFIKA.html`

**Powód zastąpienia:** panel trzech sceptyków i audyt liczb wykazały, że **żadna
liczba nagłówkowa pierwszych wersji nie wytrzymała pomiaru**. Najgroźniejsze:
faza pierwsza celowała w kod, którego nikt nie renderuje; przyczyna pustych
dokumentów była przypisana fladze, która jest włączona; miara wypełniaczy
pochodziła z nieaktualnego pliku. Wersje pierwsze zostają jako zapis tego, co
sądziliśmy — i jako przypomnienie, dlaczego liczba bez odtwarzalnej komendy nie
wchodzi do dokumentu.

## Wzorce wizualne — zaakceptowany język
- `WZORZEC_KSZTALTY_KART.html` · `WZORZEC_PRAWA_LICZBY.html` · `WZORZEC_EKRAN_INICJATYWA.html`

> Uwaga do liczby „104 karty" w `WZORZEC_KSZTALTY_KART.html`: narzędzie, które ją
> policzyło, ma zaszytą ścieżkę do **innego drzewa** niż to repozytorium, a jego
> wynik nie jest śledzony w gicie. Liczba wymaga przeliczenia przed użyciem.

## Naprawa dokumentacji wykonana przy tej okazji (2026-08-29)
- `SOURCE_OF_TRUTH.md` — deliverable jako osobny rodzaj prawdy (rubryka odbioru
  pliku, kanon eksportu, standard wniosków); rejestr decyzji właściciela jako
  źródło rozstrzygające; reguła odczytu martwych prefiksów `DRD/`
- `FUNCTIONAL_DOCUMENTATION.md` — aktualne statusy (Finanse w pełnym zakresie,
  Organizacja i Ustawienia domknięte) + ostrzeżenie o wzorcu „domknięte za flagą"
- Inicjatywy i Realizacja — **rozstrzygnięty spór o kanon** (dwa dokumenty
  `canonical` opisywały różne Menu 2, bez `superseded_by` w żadną stronę)
- Ocena — **napisany stan docelowy**, którego moduł jako jedyny nie miał
- Wszystkie siedem dokumentów planów — deklaracja kodowania (polskie znaki się
  sypały przy otwarciu z dysku) i naprawa układu wypunktowań
