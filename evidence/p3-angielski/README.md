# P3 — raport końcowy i18n (2026-09-05)

## Wynik

- Stop-lista EN na 22 ekranach: **PRZED: >40 na samej pełnej karcie inicjatywy; PO: 0 na 22 ekranach**.
- Identyczne gałęzie `isPolish ? 'X' : 'X'`: **PRZED: 70 w 37 plikach; PO: 0**.
- Globalny pomiar kluczy: **BARE-MISSING 3023 → 3018**, więc dług nie wzrósł; `PL-DEBT = 1` jest odziedziczonym kluczem `vault`.
- Canon tabel: **364 → 361**; canon artefaktów: **9 → 8**.
- Testy P3: **5/5 PASS**. Serwer: `tsc --build` **PASS**.
- Każdy klucz dodany lub wymagany przez P3 istnieje w obu słownikach; oba pliki JSON parsują się. Repo ma odziedziczoną asymetrię całych słowników (23 klucze bez PL i 2060 bez EN), której mechaniczne uzupełnienie bez zatwierdzonej treści naruszałoby zasadę „zero zgadywania”.

Stop-lista użyta do pomiaru:

`Approve|Cancel|Overview|Tasks|Definition|Economics|Team|History|Not assigned|No tasks|Start Date|End Date|Business Owner|Drop initiatives|New conversation|sources|Unknown|Initiatives|Organization|Audits|Product|Triage|Summarize|Build an initial`

Wszystkie pliki `*.png.json` zawierają pole `tekst`, odczytane z `body`. Każdy z 22 plików ma 0 trafień. Zrzut 05 ma jeden błąd 501 z niepodłączonego źródła Google Calendar; sama karta została otwarta z wydarzenia kalendarza i wyrenderowana, a pozostałe 21 zrzutów ma 0 błędów konsoli.

## Ekrany dowodowe

1. Organizacja — profil/tożsamość
2. Wywiad
3. Narzędzia odkrywania
4. Ocena
5. Pełna karta inicjatywy otwarta z Kalendarza Mojej Pracy
6. Realizacja
7. Moja Praca — Skrzynka z chipem „Wstępna klasyfikacja AI”
8. Wyniki/KPI
9. Finanse — sprawozdania
10. Raporty zarządcze
11. Materiały/Dokumenty
12. Prezentacje
13. Tabele
14. Spotkania
15. Audyty
16. Czat z otwartą historią
17. Inicjatywy — Kanban
18. Inicjatywy — Plan (9 chipów Menu 3)
19. Inicjatywy — Obciążenie (9 chipów Menu 3)
20. Finanse — Wycena przedsiębiorstw
21. Ustawienia — profil
22. Administracja

## Dowód mutacyjny

Do `InitiativeFullView.tsx` tymczasowo dodano literał `Approve`. Test `koniecAngielskiegoP3.test.ts` przeszedł z GREEN na RED i wskazał dokładnie ten token. Mutację usunięto przez `apply_patch`, a ten sam zestaw testów wrócił do GREEN (5/5). Mutacja nie weszła do historii Git.

## Nazwy własne i skróty pozostawione po angielsku

Pozostawiono tylko nazwy produktów, firm, metodyk, skróty oraz tytuły treści zapisanych przez użytkowników: Consultify, DBR77, Teresa, Google Calendar, Outlook, Kanban, AI, KPI, OKR, CRM, CAPEX, OPEX, ROI, DCF, FCFF, NPV, EV, Monte Carlo, PowerPoint, Excel, S&OP, OEE, CD PROJEKT, Tesla, Tesco, Apator oraz nazwy zapisanych rozmów, wycen, inicjatyw i właścicieli. Systemowe etykiety i systemowo zasiane tytuły zadań/wzorców są tłumaczone w warstwie prezentacji; danych użytkownika nie zmieniano.

## Polecenia odbiorowe

```sh
npx vitest run tests/unit/angielskieResztkiPL.test.ts tests/unit/koniecAngielskiegoP3.test.ts
(cd server && NODE_OPTIONS=--max-old-space-size=4096 ../node_modules/.bin/tsc --build tsconfig.build.json --pretty false)
node scripts/dev/check-etykiety-dwujezyczne.mjs
node scripts/i18n-sweep/check-global.mjs
bash scripts/check-list-canon.sh
bash scripts/check-artefakt.sh
```

Nie użyto `--no-verify`, `git stash` ani `push`.
