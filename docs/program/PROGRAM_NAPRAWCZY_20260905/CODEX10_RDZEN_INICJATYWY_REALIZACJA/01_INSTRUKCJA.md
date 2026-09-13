---
doc_id: codex10-rdzen
status: WYDANY 12.09 wieczór
truth_type: codex-block-instruction
baza: kandydat codex/integrator-mvp-20260912 po zamknięciu (blok 9) — jeśli blok 9 jeszcze trwa, baza = ta sama gałąź, a zmiany dokładasz po jego zamrożeniu
---

# CODEX 10 — DOMKNIĘCIE RDZENIA: INICJATYWY I REALIZACJA

**Decyzja właściciela z 12.09 (DEC-476):** „musimy na pewno dokończyć moduł inicjatywy i realizacja,
bo to serce aplikacji. Resztę możemy przerzucać do fali 2."

Od tej chwili obowiązuje twarda granica. Wszystko, co nie jest Inicjatywami albo Realizacją, idzie
do fali 2 — nawet jeśli wygląda na drobiazg i nawet jeśli jesteś w tym pliku o dwie linie.
Docelowy układ obu modułów jest opisany słowami właściciela w
`docs/program/FALA2/SPEC_FALA2_20260912.md`, sekcje „MODUŁ INICJATYWY" i „MODUŁ REALIZACJA".
**Ta specyfikacja jest wiążąca. Ten dokument jej nie streszcza i nie zmienia — odsyła do niej.**

## §0 BEZPIECZNIKI

Z1–Z24 jak w `CODEX4_DLUG_MVP/01_INSTRUKCJA.md` §0, z różnicami: kontener `cx-codex10-pg`
(port **6461**), bazy `cx10_*`, API **4220**, preview **5220**, migracje **20262220–20262239**,
gałąź `codex/rdzen-inicjatywy-realizacja-20260912`, artefakty `~/Developer/codex-wt/codex10-artefakty`.
Znaczniki commita: `[ODMROZENIE 05_INITIATIVES DEC-476] [ODMROZENIE 06_EXECUTION DEC-476]
[ODMROZENIE WSPOLNE DEC-476]`.
Wszystko nowe **za flagą domyślnie wyłączoną**; parytet przy fladze OFF udowodniony testem.

## §1 E0 — AUDYT LUKI (robisz pierwsze, nie pomijasz)

Dla **każdego** elementu układu docelowego z sekcji „MODUŁ INICJATYWY" i „MODUŁ REALIZACJA"
specyfikacji właściciela wystaw wiersz:

| element ze specyfikacji | stan | dowód | koszt |
|---|---|---|---|
| np. „kalendarz z Ganttem 1/3/6/12 miesięcy" | ISTNIEJE · CZĘŚCIOWO · BRAK | `plik:linia` albo „grep bez trafienia" | S / M / L |

Zasady tej tabeli:
- **ISTNIEJE** oznacza: renderuje się na ekranie i działa, sprawdzone przez ciebie w przeglądarce.
  Znaleziony komponent, którego nikt nie montuje, to **BRAK**, nie ISTNIEJE. Ta pomyłka kosztowała
  ten program już kilka tygodni.
- **CZĘŚCIOWO** wymaga jednego zdania: czego dokładnie brakuje.
- Koszt: S = do pół dnia, M = do dwóch dni, L = więcej. Szacuj uczciwie; zawyżony optymizm jest
  gorszy niż duża liczba.
- Osobno wypisz elementy, które **już są, a specyfikacja ich nie przewiduje** — kandydaci do usunięcia
  z menu (dziś Inicjatywy mają osiem zakładek, a właściciel chce czterech).

Raport z E0 zapisujesz jako `98_AUDYT_LUKI.md` **i zatrzymujesz się**: dalsze etapy wykonujesz
dopiero po nim, w kolejności z §2, zaczynając od rzeczy tanich i widocznych.

## §2 KOLEJNOŚĆ BUDOWY (po E0)

1. **Nawigacja.** Inicjatywy: cztery przyciski menu 2 — Inicjatywy (z dwoma przyciskami menu 3:
   lista i analiza), Plan, Obciążenie, Raport z pracy. Realizacja: cztery — Bank, Praca,
   Zarządzanie ryzykiem, Raporty. Istniejące ekrany **przenosisz** pod właściwe przyciski;
   nic nie usuwasz z kodu, nadmiarowe pozycje chowasz za flagą z notatką w raporcie.
2. **Lista inicjatyw:** filtr Archiwum/Aktualne, filtr projektami, widok kanban po statusie,
   kalendarz z Ganttem w horyzoncie 1/3/6/12 miesięcy (1 i 3 w tygodniach, 6 i 12 w miesiącach).
3. **Bank realizacji:** te same widoki plus kolorowa sygnalizacja opóźnień, zagrożeń i ryzyk,
   oraz pozycja na linii czasu w tabeli.
4. **Generatory analiz** — każdy jako osobny etap, w tej kolejności: analiza portfela inicjatyw →
   analiza kolejności i ścieżek krytycznych (Plan) → obciążenie z heat mapą tygodniową →
   analiza realizacji (Praca) → zarządzanie ryzykiem jako artefakt typu N.
5. **Raporty** obu modułów: kreator, pięć szablonów, wywołanie na żądanie i okresowe.

**Minimum tego bloku: E0 plus punkty 1 i 2.** Reszta to kolejne bloki, wydawane po twoim audycie,
z wyceną z tabeli E0. Nie zaczynaj punktu, którego nie skończysz w tej sesji — lepiej zamknąć trzy
rzeczy niż napocząć siedem.

## §3 CZEGO NIE ROBISZ

Nie dotykasz modułów spoza Inicjatyw i Realizacji · nie projektujesz nowych stylów ani kolorów poza
tym, co wymusza sygnalizacja ryzyka (wtedy używasz istniejących tokenów, czerwień tylko dla stanu
krytycznego) · nie przestawiasz domyślnych flag · nie pushujesz · zero połączeń do Railway,
stagingu, demo i produkcji.

## §4 ODBIÓR WZROKOWY

Każdy zbudowany ekran fotografujesz sam, w obu motywach, na realnych danych, i wynik odkładasz
w `evidence/rdzen-<etap>/`. Właściciel nigdy nie jest pierwszym testerem wizualnym — jeśli ekranu
nie widziałeś na obrazku, nie jest zrobiony.

Raport: `98_RAPORT.md` — per etap pomiar przed i po, `plik:linia`, dowody, SHA, STOP-y i sekcja
„czego nie sprawdziłem".
