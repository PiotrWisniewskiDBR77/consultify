# J10 — moduł MATERIAŁY bez obcego języka (DEC-453)

Paczka J10 programu spójności językowej. Zasady: `docs/program/JEZYK_EN_PL_20260908/PLAN.md` §2.
Przyrząd: `node scripts/i18n/pomiar-jezyka.mjs --modul "10 Materials"`.

## Pomiar przed → po (przyrząd, nie deklaracja)

| Kategoria | Przed | Po | Uwaga |
| --- | --: | --: | --- |
| K1def — polski `defaultValue` w `t()` | 231 | **0** | z tego widocznych na stałe (K1defWID): 42 → **0** |
| K3a — klucz tylko w `pl` | 634 | **0** | z tego bez defaultu w kodzie (K3aKLUCZ): 215 → **0** |
| K4pl — polski hardcode w JSX | 165 | **0** | |
| K4en — angielski hardcode w JSX | 89 | **2** | 2 reszty to FRAGMENTY KODU, nie napisy (niżej) |
| K7 — daty/liczby bez locale | 67 | **8** | 8 reszt leży w plikach CUDZYCH modułów zamrożenia (STOP) |
| K3b — klucz tylko w `en` (angielski w PL) | 4 | **0** | naprawione przy okazji |

Poza zakresem paczki (serwer): K5pl 19, K5en 223 — komunikaty backendu, osobna paczka.
K2 = 1 to klucz spoza modułu, przypisany do niego przez prefiks.

**Dodatkowo 100 defektów, których przyrząd NIE widzi** (polskie napisy bez ani jednego
ogonka — „Raporty", „Tabele", „Pochodzenie i prawa"; etykiety w obiektach; słowniki
enumów w `.ts`). Znalazł je bezpiecznik źródłowy, nie skaner — patrz niżej.

## Dowód wizualny

`przed/` i `po/` — te same ekrany, konto `audyt@dbr77.local`, 1440×900, motyw jasny:
lista Materiałów (Wszystkie / Dokumenty / Prezentacje / Arkusze / Biblioteka wzorców),
Raporty, podgląd wiersza, kebab, modal „Nowy materiał", filtry Menu 3, galeria wzorców,
pstryczek kolumn. `po/` ma komplet w DWÓCH językach.

`liczniki.json` liczy obce słowa **wyłącznie w napisach interfejsu** (przyciski, zakładki,
nagłówki kolumn, `aria-label`, pozycje menu) — nie w komórkach z danymi. Detektor to
`wykryjPolski`/`wykryjAngielski` **z tego samego pliku, na którym stoi przyrząd pomiarowy**,
żeby dowód i pomiar nie rozjechały się definicją „polskiego".

Wynik po naprawie:

* **EN → 0 polskich napisów interfejsu.** Jedyne polskie trafienia to (a) plakietka
  środowiska „Środowisko LOCAL, wersja …" z `src/components/layout/EnvironmentBadge.tsx`
  — element wspólny spoza modułu, zgłoszony jako STOP; (b) dwie NAZWY szablonów z bazy
  DBR77 („Aktualizacja dla komitetu sterującego", „Program — Raport 3 osi") — to DANE,
  nie interfejs.
* **PL → 0 angielskich napisów interfejsu.** Jedyne trafienia to cztery nazwy szablonów
  z bazy („Tool Comparison Report", „[System] risk register report (EN)" …) — również DANE.

### Czym ten dowód kłamał, zanim zaczął mówić prawdę

Pierwsze trzy przebiegi dały zrzuty „EN" po polsku i „PL" po angielsku — w OBIE strony.
Przyczyna była w przyrządzie, nie w produkcie: `users.language` i `localStorage.i18nextLng`
były ustawione poprawnie, ale aplikacja przełącza język dopiero po dociągnięciu plików
tłumaczeń i po odpowiedzi z profilu, a zrzut robiony „po `networkidle` + 2 s" łapał stan
przejściowy. Dlatego `scripts/dev/jezyk-j10-zrzuty.mjs` ma dziś trzy zabezpieczenia:
świeżą sesję przeglądarki na każdy język (najpierw baza, potem logowanie), **kotwicę
językową** (nazwa zakładki Menu 1 musi być w żądanym języku) i do trzech podejść z
powtórzeniem CAŁEJ akcji — sam reload zamknąłby otwarty kebab albo modal i zrzut
pokazywałby inny ekran, niż mówi jego nazwa.

## Bezpiecznik w repozytorium

`src/components/ReportsAndPresentations/__tests__/jezykMaterialow.source.test.ts` czyta
ŹRÓDŁO (nie renderuje), więc obejmuje też ekrany, których żaden zrzut nie odwiedził.
Mutacja: zamiana dowolnego `t('klucz', 'English')` w zasięgu na polski tekst daje RED
(sprawdzone), przywrócenie — GREEN.

Bramka `pomiar-jezyka.mjs --baseline` przechodzi; mutacja baseline o 1 w K7 wywala ją
kodem 1 (sprawdzone), przywrócenie — kod 0.

## STOP-y (do decyzji właściciela)

1. **8 dat/liczb w plikach CUDZYCH modułów zamrożenia** — `src/components/ReportBuilder/**`
   (`04_ASSESSMENT`: ExportSharePanel, ReportEditor, ReviewPanel, InitiativeCards, KPICards)
   i `src/components/documents/DocumentSidePanel.tsx` (`07_MY_WORK_AGENT`). Naprawa była
   gotowa i została WYCOFANA — hook `mvp-final` słusznie ją zablokował, a paczka J10 ma
   znacznik odmrożenia tylko dla `11_MATERIALS`.
2. **Plakietka środowiska** (`layout/EnvironmentBadge.tsx`) ma polski `aria-label` na każdym
   ekranie EN. Komponent wspólny, poza modułem.
3. **2 resztki K4en to fragmenty kodu**, nie napisy: `DocChartBlock.tsx` („`) : (`"),
   `ReportSection.tsx` („`')`") — fałszywe trafienia przyrządu, nie ma czego tłumaczyć.
