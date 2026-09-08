# J4 — moduł NARZĘDZIA bez obcego języka (DEC-453)

Paczka J4 programu spójności językowej. Zasady: `docs/program/JEZYK_EN_PL_20260908/PLAN.md` §2.
Przyrząd: `node scripts/i18n/pomiar-jezyka.mjs --modul "04 Tools"`.
Zrzuty: `node scripts/dev/jezyk-j4-zrzuty.mjs evidence/jezyk-j4/<katalog> en,pl`.

## Pomiar przed → po (przyrząd, nie deklaracja)

| Kategoria | Przed | Po | Uwaga |
| --- | --: | --: | --- |
| K1def — polski `defaultValue` w `t()` | 75 | **0** | z tego widocznych na stałe (K1defWID): 3 → **0** |
| K3a — klucz tylko w `pl` | 61 | **0** | z tego bez defaultu w kodzie (K3aKLUCZ): 9 → **0** |
| K4pl — polski hardcode w JSX | 81 | **0** | |
| K4en — angielski hardcode w JSX | 35 | **10** | 9 z 10 leży w MARTWYM poddrzewie, 1 to fałszywe trafienie (niżej) |
| K7 — daty/liczby bez locale | 7 | **0** | wszystko przez SSOT `src/utils/listDateFormat.ts` |
| K1 / K3b — polski w `en` / brak w `pl` | 0 / 0 | **0 / 0** | |

Poza zakresem paczki (serwer): K5pl 49, K5en 112 — komunikaty backendu, paczka J17.
K2 = 1 to klucz spoza modułu, przypisany do niego przez prefiks.

**Liczby PRZED zgadzają się co do jednego z `baseline.json`** — premisa zlecenia
zmierzona i potwierdzona (zlecenie podawało K4pl 83 / K4en 36 / K7 9; przyrząd na
`33a5b12c2c` pokazał 81 / 35 / 7, czyli MNIEJ — różnicę zdjęły wcześniejsze paczki).

**Dodatkowo 34 defekty, których przyrząd NIE widzi.** Znalazł je bezpiecznik
źródłowy, nie skaner: polskie napisy bez ani jednego ogonka („Strategiczne”,
„Operacyjne”, „Sekcje”, „Slajdy”, „Arkusze”, „Macierz”, „Ustawienia”, „Dalej”,
„Wstecz”, „Nowa kolumna”), etykiety w obiektach (`TEMPLATE_RIGHT_TOOLS`,
`CATEGORY_META`), tytuły z fabryk (`newDocSection`, `newWorkbookSheet`) i cały
pasek płótna Studia, który po polsku mówił wyłącznie po angielsku.

## Dowód wizualny

`przed/` i `po/` — te same 15 ekranów w DWÓCH językach, konto `audyt-j4@dbr77.local`,
1440×900, motyw jasny: Biblioteka · Sesje · Insighty · Raporty · Inicjatywy,
okruszki czterech podkategorii, picker „Add tool” (nazwy kategorii), kebab wiersza,
podgląd wiersza, pstryczek kolumn, Megatrendy, Studio.

`liczniki.json` liczy obce słowa **wyłącznie w napisach interfejsu** (przyciski,
zakładki, nagłówki kolumn, `aria-label`, pozycje menu, okruszki i **komórki kolumny
CATEGORY**) — nie w komórkach z danymi. Detektor to `wykryjPolski`/`wykryjAngielski`
**z tego samego pliku, na którym stoi przyrząd pomiarowy**, żeby dowód i pomiar nie
rozjechały się definicją „polskiego”.

Wynik po naprawie:

* **EN → 0 polskich napisów interfejsu modułu.** Jedyne polskie trafienie na każdym
  z 15 ekranów to plakietka środowiska „Środowisko LOCAL, wersja …”
  (`src/components/layout/EnvironmentBadge.tsx`) — element WSPÓLNY spoza modułu,
  zgłoszony jako STOP (ten sam, który zgłosiła paczka J10).
* **PL → 0 angielskich napisów interfejsu.** Zero na każdym z 15 ekranów.
  Angielskie zostają wyłącznie NAZWY WŁASNE narzędzi konsultingowych („Dynamic SWOT”,
  „Market Forces (Porter)”, „Ansoff”) i tagi katalogu — to DANE, nie interfejs.

### Czym ten dowód kłamał, zanim zaczął mówić prawdę

1. **Modal powitalny „Meet Teresa” zasłaniał CAŁY produkt** na pierwszym przebiegu.
   Zrzut nazywał się „01-biblioteka-en”, a pokazywał okno onboardingu — klasa
   „przyrząd pokazuje nie produkt”. Skrypt zamyka je dziś raz na sesję i przed
   każdym zrzutem (`zamknijOnboarding`).
2. **Detektor pomijał kolumnę CATEGORY**, bo reguła „bez komórek z danymi” wyrzuca
   `td`. Kolumna kategorii to jednak ENUM renderowany przez UI: ekran z dwunastoma
   „Strategiczne” raportował „2 polskie napisy”. Skrypt zbiera dziś komórki
   dokładnie tej jednej kolumny, po nazwie jej nagłówka.
3. Pułapki przejęte z J10 (świeża sesja na język, kotwica językowa, trzy podejścia
   z powtórzeniem całej akcji) — bez nich zrzuty „EN” wychodzą po polsku.

## Bezpiecznik w repozytorium

`src/components/Discovery/__tests__/jezykNarzedzi.source.test.ts` czyta ŹRÓDŁO
(nie renderuje), więc obejmuje też ekrany, których żaden zrzut nie odwiedził.

**Mutacje (dowód, że nie jest dekoracją) — obie sprawdzone 09.09:**

* `t('methodWorkspace.saveState.dirty', 'Unsaved changes')` → `'Niezapisane zmiany'` = **RED**;
* `formatListDate(…)` → `toLocaleDateString('en-US')` = **RED**;
* przywrócenie obu = **GREEN**.

**Bezpiecznik po drodze NAGRADZAŁ defekt.** Pierwsza wersja przepuściła mutację
„Niezapisane zmiany" na zielono — polski w stu procentach, ale bez ani jednego
ogonka i bez słowa z listy `polskieSilne`. Dopiero rozszerzenie słownika o rdzenie
widziane w TYM module zrobiło z niego bramkę zamiast dekoracji. Komentarze są
wycinane przed skanowaniem — inaczej test świecił na własnym opisie naprawy.

Bramka `pomiar-jezyka.mjs --baseline` przechodzi (kod 0); mutacja baseline o 1
w `04 Tools / K4en` wywala ją **kodem 1** (zmierzone bez potoku — `| tail` zwracał
kod `tail`, nie bramki), przywrócenie — kod 0. `baseline.json` obniżony dla modułu
04 o dokładnie zmierzoną deltę (K1def −75, K3a −61, K4pl −81, K4en −25, K7 −7,
K1defWID −3, K3aKLUCZ −9), ślad w `_meta.obnizenia`.

## STOP-y (do decyzji właściciela)

1. **Martwe poddrzewo `src/views/ContextBuilder/**` — 9 z 10 pozostałych K4en.**
   `ContextBuilderView.tsx`, `modules/CompanyProfileModule.tsx`
   i `modules/MegatrendScannerModule.tsx` są **NIEOSIĄGALNE z `AppRoutes.tsx`**
   (zmierzone przechodzeniem grafu importów od `AppRoutes`/`main`/`App`; P30-D
   zastąpił je `OrganizationProfileModule`, a `/context/*` przekierowuje na
   `/organization/*`). Nie tłumaczyłem martwego kodu — to praca bez użytkownika.
   **Rekomendacja: usunąć te trzy pliki osobną decyzją** (wtedy K4en modułu spada
   do 1). Żywe pliki tego katalogu (`organizationProfileTaxonomy`,
   `ContextDocUploader`, `DynamicList`, `StrategicSynthesisModule`) zostają —
   K7 w `StrategicSynthesisModule` naprawiony.
2. **Ostatnie K4en to fałszywe trafienie przyrządu:** `shared/ProposalCard.tsx:116`
   — łańcuch `0 ? (` z kodu, nie napis. Nie ma czego tłumaczyć.
3. **Plakietka środowiska** (`layout/EnvironmentBadge.tsx`) ma polski `aria-label`
   na KAŻDYM ekranie EN. Komponent wspólny (`layout`), poza zakresem paczki —
   ten sam STOP zgłosiła J10, więc defekt żyje co najmniej dwie paczki.
4. **Jeden napis w `Megatrend/CustomTrendCard.tsx` („Add to list?”) NIE został
   przeniesiony do `t()`.** Linia niesie token crimson, a hook `check-triada`
   liczy każdą nowo dodaną linię z crimsonem jako naruszenie kanonu — naprawa
   językowa wymagałaby przy okazji zmiany koloru, czyli zmiany WIZUALNEJ poza
   zakresem paczki. Powód zapisany w kodzie obok.
5. **Rozjazd map modułów.** Przyrząd językowy liczy do „04 Tools” katalogi, które
   rejestr zamrożenia MVP przypisuje do CZTERECH różnych modułów: `TemplateBuilder`
   → `11_MATERIALS`, `method-workspace` → `04_ASSESSMENT`,
   `views/ContextBuilder` → `01_ORGANIZATION`, reszta → `03_TOOLS`. Naprawa
   językowa modułu 04 była niewykonalna bez dotknięcia wszystkich czterech —
   commity noszą znaczniki odmrożenia dla każdego dotkniętego modułu, rozdzielone
   tak, żeby dało się cofnąć pojedynczy. **Do rozstrzygnięcia: która mapa jest
   prawdą** (przyrząd językowy czy rejestr zamrożenia).
6. **`common.tableWithPreview` dodany do obu plików tłumaczeń** — klucz obsługuje
   `src/components/shared/TableWithPreviewLayout.tsx` (komponent WSPÓLNY). Kodu
   shared NIE dotykałem; brakowało wyłącznie wartości w słowniku, przez co PL miał
   angielski `aria-label` na 13 z 15 ekranów. Jeśli paczka ZZ dopisuje ten sam
   klucz — konflikt na jednej linii `translation.json`.
7. **Dług K6 (dane, nie interfejs):** domyślne nazwy dokumentów Studia
   („Untitled Diagram” w `useStudioDocument.tsx`) zapisują się do bazy po angielsku
   niezależnie od języka konta. To kategoria „etykiety z danych/seed”, nie mierzona
   tym skanerem.

## Zmienione obszary

`Discovery` · `DiscoveryTools` (+ `live`, `report`, `shared`) · `Studio` (+ `nodes`
przez toolbar) · `Megatrend` · `PlaybookEditor` · `TemplateBuilder` · `Knowledge` ·
`method-workspace` · `views/StudioView` · `views/StudioUnavailableView` ·
`views/knowledge/KnowledgeBaseArticlePage` ·
`views/ContextBuilder/modules/StrategicSynthesisModule` (tylko K7) ·
`routes/AppRoutes.tsx` (6 literałów okruszków „Narzędzia” i podkategorii —
sprawdzone, że paczka ZZ ich nie ruszyła) · oba pliki `translation.json`
i oba `discovery.json`.

Testy modułu: 397 zielonych, 1 czerwony **zastany** — `toolCanvas.smoke.test.tsx`
oczekuje napisu „This step is being prepared”, którego nie ma nigdzie w źródle;
`ToolCanvas.tsx` nie był w tej paczce zmieniany (poza jednym `t()` dla
„Loading step…”), więc ten fail poprzedza J4.
