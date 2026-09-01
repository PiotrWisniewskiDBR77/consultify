---
doc_id: grafika-analiza-odrzucone-20260901
status: canonical
truth_type: investigation
established: 2026-09-01
zrodlo: odbior.sqlite tabela `decyzje` (4 ekrany z decyzją „nie", 30.08–01.09) + kod gałęzi codex/m03-admin-20260824
zrzuty: evidence/grafika/168-odrzucone/ (10 plików, oba motywy, stan zastany)
powod: właściciel poprosił o analizę każdego przypadku z osobna przed decyzją o zdjęciu
---

# Cztery odrzucone ekrany — co za nimi naprawdę stoi

**Po co ten dokument.** Właściciel odrzucił cztery ekrany i sam poprosił:
*„Omówmy każdy przypadek z osobna, bo prawdopodobnie jakiś sens może tych ekranów
być. Ja uważam, że nie są potrzebne, ale może masz inne [zdanie]."*

**Dlaczego to nie jest formalność.** Gdy w sierpniu padła decyzja o zdjęciu czterech
generatorów szablonów, sprawdzenie wykazało, że **trzy z czterech były jedynym
żywym wejściem do działającej mechaniki** — zdjęto ostatecznie tylko duplikat.
Reguła z `KANON_Z_ODBIOROW.md`: *ekranu nie zdejmuje się z drogi bez zbadania,
co za nim stoi*.

**Wynik w jednym zdaniu:** w dwóch przypadkach właściciel ma rację (jeden ekran
jest już martwy, drugi jest zdublowanym wejściem), a w dwóch — obraz jest inny,
niż wynika ze zrzutu, i zdjęcie odcięłoby działający kod.

---

## 1. `gen-excel-templates-tab` — „Szablony skoroszytów"

**Słowa właściciela (30.08, 11:43):** *„To samo nie wiem, po co on jest."*
Wcześniej tego samego dnia, o tym samym ekranie: *„Nie potrzebny w ogóle ten
arkusz. Z pozostałością w ogóle pierwszych jakichś prób."*

### Co ustaliłem

**A. Czy jest żywy.** Jako **osobna zakładka** — nie. Wejście menu („Nowy szablon"
→ pozycja „Generator szablonów") pokazuje się tylko przy włączonej fladze
`ff_workbook_templates`, a ta jest **domyślnie WYŁĄCZONA** na każdym środowisku
(`src/utils/workbookTemplatesFlag.ts:23` — „Default: OFF";
`ReportsAndPresentationsHub.tsx:1516-1517`).

**★ Ale sama powierzchnia jest osiągalna — i to sprostowanie mojego wcześniejszego
opisu w `ODLOZONE.md`.** Kod, który ją rysuje
(`ReportsAndPresentationsHub.tsx:1427-1438`), **nie sprawdza żadnej flagi**. Wchodzi
się na nią przez: Materiały → Biblioteka wzorców → „Nowy szablon" → Arkusz →
kreator → **Zapisz**. Po zapisie aplikacja sama przełącza widok na tę zakładkę
i pokazuje komunikat „Szablon zapisany — wybierz »Zbuduj skoroszyt«"
(`ReportsAndPresentationsHub.tsx:1631-1646`). Kreator jest **domyślnie włączony**
poza publiczną produkcją (`templateBuilderFlags.ts:55-62`). Działa też stary
adres `?tab=workbook_templates` (`ReportsAndPresentationsHub.tsx:224-226`).

**B. Co za nim stoi.** Rejestr parametrycznych modeli Excela (P&L 3 scenariusze,
budżet 12 miesięcy, wycena DCF) budujący prawdziwy plik `.xlsx` przez
`POST /api/workbook/templates/:id/build`. To realna mechanika, nie makieta.

**C. Czy jest zamiennik.** Tak, i to żywy: ten **sam komponent**
(`ExceleParametricTemplates`) jest osadzony w czacie `/excele` → zakładka
„Szablony" (`ArtifactModuleHome.tsx:222-224`) — tam bez żadnej flagi
(warunek `useTabeleLifecycleGrid` dotyczy wyłącznie ścieżki `tabele`,
linia 119). Trasa `/excele` jest domyślnie włączona od 22.07.

**D. Zrzut.** `gen-excel-templates-tab__PRZED__{light,dark}.png` — trzy karty
modeli po polsku, reszta ekranu pusta.

### REKOMENDACJA: **ZDJĄĆ z odbioru — ale nie kasować kodu**

Właściciel ma rację co do **wejścia**: zakładka huba to zdublowana droga do tej
samej rzeczy i nikt jej dziś nie widzi w menu. Ale **powierzchnia jest miejscem
lądowania po zapisie szablonu w kreatorze**, więc usunięcie komponentu zepsułoby
kreator. Praktycznie: nie pokazujemy jej jako osobnego ekranu do oceny,
zostawiamy jako końcówkę kreatora.

**Co się stanie, jeśli zdejmiemy (samo wejście menu):** nic. Flaga i tak jest OFF.
**Co się stanie, jeśli skasujemy komponent:** kreator „Nowy szablon → Arkusz"
straci ekran, na który ląduje po zapisie, i przestanie działać przycisk
„Zbuduj skoroszyt". **Tego robić nie wolno.**

---

## 2. `results-three-pairs` — „Trzy pary (KPI/ROI/OKR)"

**Słowa właściciela (01.09, 05:54):** *„To jest jakiś historyczny ekran. Chyba już
tak dawno nie wygląda — mam nadzieję."*

### Co ustaliłem

**A. Czy jest żywy. NIE — i nadzieja właściciela jest uzasadniona.** Ekran należał
do starego huba Wyników (`ResultsHub.tsx`, 2485 linii). Ten hub **nie ma dziś
żadnej trasy**. Adres `/results` prowadzi do komponentu, który robi jedną rzecz:
przekierowuje na rejestr KPI —

```
src/components/Results/ResultsOwnerReviewEntry.tsx:12
return <Navigate to={ROUTES.RESULTS_KPI.ROOT} replace />;
```

Komentarz w `AppRoutes.tsx:115-117` mówi to wprost: *„wycofany rozdzielony
ResultsHub nie jest już osiągalnym wariantem trasy"*. Wycofanie: commit
`8df1cd413d` z **24.08** („retire legacy root fallback"). Jedyne miejsca, gdzie
`<ResultsHub />` jest jeszcze montowany, to pliki testów.

**B. Co za nim stoi.** Nic, czego nie ma gdzie indziej. Komponent
`ResultsThreePairsView` jest bezstanowy — dane wstrzykuje rodzic. Rodzic
(stary hub) jest martwy. W harnessie dev-render dane są zmyślone.

**C. Zamiennik.** Rejestry Wyników vNext (KPI/OKR/ROI) — to je widzi dziś
użytkownik po kliknięciu „Wyniki" w menu bocznym.

**D. Zrzut.** `results-three-pairs__PRZED__{light,dark}.png` — ładny ekran
z prawdziwymi polskimi nazwami wskaźników („OEE linii pakowania"), paskiem
postępu i uczciwym „Brak danych" zamiast zera.

### REKOMENDACJA: **ZDJĄĆ**

Właściciel ma rację w całości. To zdjęcie z albumu, nie ekran produktu.

**Co się stanie, jeśli zdejmiemy:** nic — użytkownik i tak tego nie widzi od 24.08.

**★ Uwaga na marginesie, warta osobnej decyzji:** skoro cały `ResultsHub` jest
nieosiągalny, to martwe jest też wszystko, co tylko on montował — m.in. szuflada
szeregów czasowych KPI (`KPITimeSeriesDrawer`) wraz z kartą naprawczą i diagnostyką
odchyleń. To ~2,5 tys. linii kodu i kilka funkcji, o których dokumentacja mówi, że
istnieją. **Nie zdejmuję tego w tym dyżurze** — sygnalizuję, bo to znacznie
większa sprawa niż jeden zrzut. Jedna z tych funkcji (karta naprawcza) może być
tym, czego brakuje w nowej karcie wskaźnika.

---

## 3. `results-vnext-attention` — „Uwaga"

**Słowa właściciela (01.09, 05:54):** *„tu są tylko dwa przyciski w menu 2"*

### Co ustaliłem

**A. Właściciel widział prawdę, ale nie całą.** Menu 2 rzeczywiście ma **dwa
przyciski: KPI i OKR** — bo to przełącznik źródła, nie zakładki treści. Treść
wybiera się w **Menu 3**, którego jest **trzynaście pozycji**, każda z realnym
licznikiem: siedem pod KPI (Brak właściciela · Zaległe obowiązki · Powtarzające
się odchylenia · Nieskuteczne działania korygujące · Obciążenie właścicieli ·
Pokrycie procesów · Rozkład wyników) i sześć pod OKR (Nieaktualne check-iny ·
Cele o niskiej pewności · Otwarte prośby o wsparcie · Otwarte blokady ·
Eskalowane zestawy · Zdrowie zespołu).

Zrzut, na który patrzył właściciel, pokazuje **najgorszy z trzynastu kubełków** —
„Brak właściciela" ma z natury jedną kolumnę (kod wskaźnika), bo cała jego treść
to „ten wskaźnik nie ma właściciela". Sąsiedni kubełek wygląda inaczej: trzy
kolumny, prawdziwe nazwiska („Anna Kowalska · 6 aktywnych KPI · 2 otwarte
odchylenia"). **To ten sam kształt pomyłki co dziś rano z panelem: przyrząd
sfotografował stan domyślny, nie stan reprezentatywny.** Dowody:
`results-vnext-attention__PRZED__light__kubelek-obciazenie.png` i
`__zakladka-OKR.png`.

**B. Czy jest żywy — i tu jest prawdziwy problem, inny niż zgłoszony.** Ekran ma
własną trasę `/results/attention` (`routeConfig.ts:192`, `AppRoutes.tsx:3188`),
ale **nic w całej aplikacji do tej trasy nie prowadzi**. Sprawdziłem oba warianty
zapisu — `RESULTS_ATTENTION` i literalne `/results/attention` — poza definicją
trasy i harnessem nie ma ani jednego odwołania. Menu 2 modułu Wyniki ma
KPI/OKR/ROI (`resultsDomainNavigation.ts:7-11`); „Uwaga" tam nie ma. **Trafia się
tam tylko wpisując adres ręcznie.**

To znaczy, że zapis w `status.json` („Wyniki → sekcja »Uwaga«") jest **nieprawdziwy**
i wymaga poprawki niezależnie od tej decyzji.

**C. Co za nim stoi.** Trzy prawdziwe punkty serwera:
`GET /api/vnext/results/kpi/attention`, `.../okr/attention`, `.../okr/team-health`
(`kpiPerspectives.routes.ts:268`, `okr.routes.ts:3486` i `:1063`). Ten ekran jest
**jedynym miejscem w interfejsie**, które je czyta — poza nim nie ma ani jednego
wołacza. Same punkty przeżyją zdjęcie ekranu: czyta je również Teresa
(tryb „manager_brief" — `teresaCopilotCanon.ts:282`, gdzie zapisano, że to jego
**jedyne** źródło danych).

**D. Zrzuty.** Trzy: stan domyślny, kubełek „Obciążenie właścicieli", zakładka OKR.

### REKOMENDACJA: **ZOSTAWIĆ, ale przebudować wejście — nie ekran**

Za tym ekranem stoi trzynaście gotowych, wypełnionych danymi odpowiedzi na
pytanie „czym trzeba się dziś zająć". To jest dokładnie ta rzecz, której szuka się
w module Wyników rano. Problemem nie jest zawartość — problemem jest, że
**nikt nie ma jak tu trafić**, a pierwsze, co widać po wejściu, to najuboższy
z trzynastu widoków.

Co zmienić, żeby to było oczywiste:
1. **Dodać wejście** — pozycja „Uwaga" w Menu 2 Wyników albo kafel na wejściu
   do modułu z sumą wszystkich trzynastu liczników.
2. **Zmienić kubełek startowy** — otwierać na tym z największą liczbą pozycji,
   nie zawsze na „Brak właściciela".
3. **Nadać ekranowi tytuł** — dziś zaczyna się od gołych pigułek, bez nagłówka,
   więc nie wiadomo, na co się patrzy.
4. **Naprawić dwa surowe pola**, zgłoszone już w przeglądzie nocnym: kolumna
   „KOD KPI" bez nazwy wskaźnika i „SET ID"/data w formacie `2026-08-01T00:00:00Z`.

**Co się stanie, jeśli zdejmiemy:** znika jedyny widok trzynastu list roboczych.
Serwer i Teresa działają dalej, ale człowiek traci wgląd w to, co Teresa czyta.
**Ryzyko średnie** — nie dlatego, że coś przestanie działać, tylko dlatego,
że wyrzucamy gotową rzecz, której nikt jeszcze nie miał okazji użyć.

---

## 4. `results-vnext-okr-workspace` — „Warsztat zestawu OKR"

**Słowa właściciela (01.09, 05:55):** *„To miało być w N-type karcie"*

### Co ustaliłem

**A. Czy jest żywy. TAK — i to na demo.** Trasa `/results/okr/sets/:okrSetId`
(`AppRoutes.tsx:3105-3125`) jest **głównym działaniem „Otwórz"** w rejestrze
zestawów OKR (`okrRegistryPresenters.tsx:240-247`, `ResultsOkrHub.tsx:606-608`).
Flaga `okrRegistry` jest w kodzie domyślnie OFF, **ale na demo obowiązuje
`VITE_DEMO_ACCEPTANCE`**, które włącza wszystkie trzy rejestry naraz
(`resultsVNextFeatureFlags.ts:150-151`; potwierdzone przez właściciela w panelu
Railway — DEC-2026-08-28-216). Widzą to właściciel i administrator; konsultant nie.

**B. Co za nim stoi.** Sześć zakładek, z których każda montuje osobny, realny
widok: Przegląd · Cele i Kluczowe Rezultaty (z zejściem do KR i check-inów) ·
Dopasowania · Rozmowy i wsparcie · Przegląd i refleksja (tu wchodzi Teresa
z propozycją refleksji) · Historia. Plus **cały cykl życia zestawu** — złożenie,
akceptacja, żądanie poprawek, aktywacja, anulowanie — z wypisanymi wprost
regułami dostępności każdego przycisku. To jedyne wejście do tego wszystkiego.

**C. Czy istnieje nowszy zamiennik — i tu jest sedno.** **Nie, `cel-jedna-karta`
tego nie zastępuje, bo to inny poziom.**

Zgodnie z decyzją właściciela z 30.08 (`DECYZJA_WYNIKI_TRZY_POZIOMY.md`) Wyniki
mają **trzy poziomy**: rejestr zestawień → tabela zestawu → karta pojedynczego
wskaźnika/celu. Zmierzone na ekranie:

| Poziom | Dla wskaźników | Dla celów |
| --- | --- | --- |
| 1. rejestr | rejestr KPI | rejestr zestawów OKR |
| 2. **zestaw** | `results-vnext-kpi-scorecards` | **`results-vnext-okr-workspace` ← ten ekran** |
| 3. jedna karta N | `wskaznik-jedna-karta` | `cel-jedna-karta` |

Zrzut `__zakladka-cele.png` pokazuje to jednoznacznie: ścieżka u góry brzmi
„Zestawy OKR › **Wdrożyć MES na 3 liniach produkcyjnych** › Cele i Kluczowe
Rezultaty", a w środku jest **tabela dwóch celów**. `cel-jedna-karta` to karta
**jednego wiersza z tej tabeli**. Zdjęcie warsztatu zostawiłoby dziurę między
rejestrem a kartą celu — dokładnie ten brakujący poziom pośredni, który
właściciel kazał 30.08 dobudować.

**Ale intuicja właściciela jest trafna co do kształtu.** 30.08 rozstrzygnął
identyczną sprawę dla ROI: *„To musi być N-karta, gdzie będziemy mieli z nowej
strony te zakładki, które teraz masz w menu"* — i `results-vnext-roi-full-tool`
został tego samego dnia przebudowany w `roi-jedna-karta` (zakładki poziome →
sekcje w lewej kolumnie). Warsztat OKR ma **dokładnie tę samą wadę powłoki**:
sześć zakładek w poziomie, brak prawego panelu kanonu.

**D. Zrzuty.** `results-vnext-okr-workspace__PRZED__{light,dark}.png` (zakładka
Przegląd — właściwości zestawu + cykl życia z wyjaśnieniami) oraz
`__zakladka-cele.png` (tabela celów).

### REKOMENDACJA: **PRZEBUDOWAĆ — nie zdejmować**

Zastosować do zestawu OKR tę samą formułę, którą właściciel zatwierdził dla ROI:
sześć zakładek poziomych → sekcje jednej karty N zestawu, prawy panel wg kanonu
siedmiu sekcji, cykl życia jako blok akcji w prawym panelu zamiast rzędu
przycisków pod tabelą. **Treść zostaje w całości — zmienia się tylko powłoka.**

Przy okazji dwie drobne rzeczy widoczne na zrzucie: pola „Właściciel" i „Recenzent"
pokazują ucięte `user-ann…` / `user-tom…` zamiast nazwisk (ten sam defekt, który
w ekranie „Uwaga" został już naprawiony przez odczyt listy członków organizacji —
można przenieść to rozwiązanie).

**Co się stanie, jeśli zdejmiemy:** rejestr zestawów OKR straci działanie „Otwórz".
Przestaną być osiągalne: dopasowania celów, prośby o wsparcie, blokady, refleksja
z Teresą, historia i **cały cykl akceptacji zestawu**. Zniknie poziom 2 z decyzji
właściciela z 30.08. **Ryzyko wysokie.**

---

## Tabela zbiorcza

| Ekran | Czy widzi go dziś użytkownik | Rekomendacja | Ryzyko zdjęcia |
| --- | --- | --- | --- |
| `gen-excel-templates-tab` | nie jako zakładka; **tak** jako ekran końcowy kreatora szablonu | **ZDJĄĆ z odbioru**, kodu nie kasować | **niskie** dla wejścia menu · **wysokie** dla komponentu |
| `results-three-pairs` | **nie** — od 24.08 hub bez trasy | **ZDJĄĆ** | **niskie** (już nieosiągalny) |
| `results-vnext-attention` | tylko po ręcznym wpisaniu adresu | **ZOSTAWIĆ + dorobić wejście** | **średnie** |
| `results-vnext-okr-workspace` | **tak**, na demo — główne „Otwórz" w rejestrze OKR | **PRZEBUDOWAĆ** w kartę N zestawu | **wysokie** |

## Czego nie ustaliłem

1. **Czy ktokolwiek kiedykolwiek wszedł na `/results/attention`** — nie mam dostępu
   do telemetrii. Wiem tylko, że nie da się tam trafić klikaniem.
2. **Czy `VITE_DEMO_ACCEPTANCE` jest ustawione również na stagingu** — sprawdzałem
   wyłącznie repozytorium; wartości zmiennych Railway nie ruszam (Z28). Dla demo
   opieram się na potwierdzeniu właściciela z 28.08.
3. **Co dokładnie ginie razem z martwym `ResultsHub`** — naliczyłem szufladę KPI,
   kartę naprawczą i diagnostykę odchyleń, ale pełnego przeglądu 2485 linii nie
   robiłem. To zasługuje na osobny dyżur.
4. **Czy karta naprawcza KPI (`ff_recoveryCard`) ma odpowiednik w nowej karcie
   wskaźnika** — nie sprawdzałem; jeśli nie ma, zdjęcie starego huba oznacza
   realną utratę funkcji, a nie tylko wyglądu.
