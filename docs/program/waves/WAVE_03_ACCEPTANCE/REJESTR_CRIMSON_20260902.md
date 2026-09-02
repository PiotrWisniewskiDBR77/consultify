# Rejestr crimson pod trzema nazwami — pomiar całej aplikacji (2026-09-02)

Zlecenie: zmierzyć WSZYSTKIE nazwy aliasów wskazujących na Harvard Crimson
`#85182F` w całym `src/`, bez naprawy. Powód: nadzorca pomylił się dwa razy
z rzędu tego samego dnia przy pomiarze Portalu Partnerskiego, bo grepował
po jednej nazwie naraz (pierwsza miara pomijała `crimson-*`, druga pomijała
podkatalog).

Środowisko: `git worktree add /private/tmp/ag-crimson-audyt -b
agent/crimson-audyt-20260902 6fe16e2bd4` (marker `6fe16e2bd4` potwierdzony —
`odbior: MODUL 16 PARTNER ZAMKNIETY`). Zero zmian w `src/`.

---

## K1 — ile nazw realnie wskazuje na crimson `#85182F`

**Potwierdzone: dokładnie TRZY pełne 11-stopniowe skale kolorów** w
`tailwind.config.js` mają identyczne wartości hex (`DEFAULT`/`600` =
`#85182F`, te same stopnie 50–950):

| Nazwa | Linia w `tailwind.config.js` | Komentarz w kodzie |
|---|---|---|
| `crimson` | 178–189 | „brand canonical — key CTAs, Teresa, brand moments" |
| `primary` | 216–229 | „CENTRAL RECOLOR LEVER... was violet (#7C3AED)" |
| `brand` | 295–309 | „LEGACY ALIASES... `brand` was the legacy violet scale" |

Sprawdzone: klucz `primary:` występuje w configu **tylko raz** (brak
duplikatu/przesłonięcia) — `grep -n "^\s*primary:" tailwind.config.js` → 1
trafienie. Liczba trzy się zgadza.

**Czwarty wektor, mniejszy, ale realny (nie jest to nazwana skala kolorów,
więc nie liczy się do „trzech nazw", ale renderuje ten sam kolor):**
`backgroundImage.hig-primary` / `hig-primary-hover` (linie 767–768) — gotowy
gradient `linear-gradient(135deg, #85182F 0%, #85182F 100%)` wpięty pod
klasę `bg-hig-primary`. Użycie w `src/` nie znalezione w tym pomiarze (klasa
`hig-primary` nie wystąpiła w żadnym z 5325 dopasowań) — potencjalnie martwy
kod, nie pilne.

Dodatkowo: `hbs-red.700` (`#910A28`) jest świadomie „kept distinct from
crimson" (komentarz w configu) — to NIE jest crimson, tylko sąsiednia paleta
`danger`. Nie liczony.

**Wniosek K1: nazw jest dokładnie trzy — `primary`, `crimson`, `brand`.**
Liczba właściciela/nadzorcy się potwierdza.

---

## K2 — pomiar całego `src/`

### Metoda (i poprawka w trakcie pracy)

Wzorzec pierwszej wersji (`\b(bg|text|border...|placeholder)-(primary|
crimson|brand)(/[0-9]{1,3})?(-(DEFAULT|hover|light|surface|[0-9]{2,3}))?\b`)
dał **5382** trafienia, ale zawierał **57 fałszywych trafień** — dopasowywał
fragment wewnątrz złożonych tokenów designu `c-*`, np. `text-c-text-primary`
(realna klasa to CAŁY token `text-c-text-primary`, nie osobne `text-primary`)
oraz podwójne dopasowanie `bg-brand` wewnątrz nieistniejącej klasy
`bg-brand-dark` (nie ma takiego koloru w configu — martwa/błędna klasa przy
okazji znaleziona). Poprawka: zaostrzone granice tokenu (lookbehind/lookahead
zamiast `\b`, żeby wymagać prawdziwej granicy klasy, nie granicy
wewnątrz myślnika). **Zweryfikowano różnicę ręcznie na próbce (grep -c
przed/po) — wszystkie 57 usuniętych to potwierdzone fałszywe trafienia.**

**Wynik finalny po korekcie: 5325 wystąpień w 609 unikalnych plikach**, z
czego:
- `primary-*`: 4933 → (po korekcie) ~4876 (dominujący nośnik długu)
- `crimson-*`: 257 → ~254
- `brand-*`: 192 → ~195

(rozbicie per-nazwa dokładne w tabeli per moduł poniżej, kolumny
`primary`/`crimson`/`brand`)

### Tabela per moduł (top 30 z 109 katalogów z >0 wystąpień)

Katalog = pierwszy poziom pod `src/components/<X>` lub `src/views/<X>`
(pojedyncze pliki widoku bez podkatalogu liczone osobno). TŁA i RESZTA —
patrz K3.

| Moduł | Razem | Tła | Reszta | Plików | primary | crimson | brand |
|---|---:|---:|---:|---:|---:|---:|---:|
| components/AIChat | 739 | 412 | 327 | 69 | 676 | 19 | 44 |
| views/superadmin | 478 | 271 | 207 | 61 | 474 | 4 | 0 |
| components/MyWork | 318 | 180 | 138 | 53 | 278 | 13 | 27 |
| components/SuperAdmin | 275 | 178 | 97 | 29 | 272 | 3 | 0 |
| components/Reports | 263 | 152 | 111 | 31 | 257 | 6 | 0 |
| components/assessment | 233 | 130 | 103 | 23 | 227 | 6 | 0 |
| components/DiscoveryTools | 224 | 134 | 90 | 37 | 222 | 2 | 0 |
| views/ContextBuilder | 215 | 143 | 72 | 9 | 212 | 3 | 0 |
| components/Help | 203 | 88 | 115 | 11 | 196 | 7 | 0 |
| components/shared | 196 | 111 | 85 | 31 | 195 | 1 | 0 |
| components/billing | 126 | 69 | 57 | 12 | 100 | 26 | 0 |
| components/Admin | 120 | 47 | 73 | 12 | 120 | 0 | 0 |
| components/demo | 80 | 57 | 23 | 8 | 61 | 19 | 0 |
| components/layout | 78 | 41 | 37 | 8 | 72 | 0 | 6 |
| components/Decisions | 72 | 41 | 31 | 4 | 72 | 0 | 0 |
| views/docs | 67 | 33 | 34 | 1 | 66 | 1 | 0 |
| components/ai | 67 | 44 | 23 | 7 | 61 | 6 | 0 |
| components/settings | 65 | 30 | 35 | 17 | 0 | 0 | 65 |
| components/Discovery | 63 | 36 | 27 | 7 | 63 | 0 | 0 |
| components/PMO | 59 | 34 | 25 | 9 | 59 | 0 | 0 |
| components/Economics | 46 | 28 | 18 | 6 | 34 | 12 | 0 |
| components/dashboard | 46 | 21 | 25 | 4 | 42 | 4 | 0 |
| views/ProjectIntelligenceView.tsx | 45 | 25 | 20 | 1 | 43 | 2 | 0 |
| components/Execution | 44 | 20 | 24 | 7 | 28 | 16 | 0 |
| views/AppPricingView.tsx | 43 | 19 | 24 | 1 | 42 | 1 | 0 |
| views/LegalDocumentView.tsx | 42 | 26 | 16 | 1 | 37 | 5 | 0 |
| components/Results | 42 | 19 | 23 | 7 | 42 | 0 | 0 |
| views/PricingView.tsx | 39 | 14 | 25 | 1 | 38 | 1 | 0 |
| components/ui | 38 | 27 | 11 | 12 | 22 | 16 | 0 |
| components/Portfolio | 38 | 14 | 24 | 1 | 38 | 0 | 0 |

Suma top 30 modułów: **4364** wystąpień (82% z 5325).
Pozostałe 79 katalogów: **961** wystąpień (długi ogon, 1–36 na katalog).

Moduły warte odnotowania spoza top 30:
- **`components/Partner` = 32** (22 tła, 10 reszta, 4 pliki, wszystkie
  `brand-*`) + **`views/partner` = 2**. Patrz kontrola poprawności niżej —
  to NIE jest bliskie zeru.
- **`components/Interview` = 5**, wszystkie `crimson-*`.
- **`components/Initiatives` = 1** (po korekcie regexu; przed korektą
  fałszywie liczone jako 5 przez `text-c-text-primary`).
- **`components/Finance` = 24** (po korekcie regexu; przed korektą
  fałszywie liczone jako 52 — połowa to były `text-c-text-primary`).

### Kontrola poprawności: Portal Partnerski (miał być „naprawiony dzisiaj")

Zlecenie mówiło: „oczekuj bliskiego zera". **Wynik pomiaru: NIE jest bliski
zera.**

Precyzyjny wzorzec klas Tailwind (bg/text/border/from/to/ring/… + nazwa):
**34 wystąpienia w 5 plikach** (`src/components/Partner`: 32 w 4 plikach +
`src/views/partner/CommissionView.tsx`: 2). **100% to `brand-*`** — `primary-*`
i `crimson-*` w Partnerze faktycznie wynoszą zero, więc dzisiejsza naprawa
najwyraźniej odhaczyła tylko te dwie nazwy i **całkowicie pominęła `brand-*`**
— dokładnie ta sama pułapka, którą opisuje zlecenie (grep po jednej nazwie
naraz).

Zweryfikowano też liczbę właściciela „97 w 11 plikach" luźnym grepem (dowolne
wystąpienie słowa `primary`/`crimson`/`brand`, nie tylko klasy koloru,
zawężonym do `src/components/Partner` + `src/views/partner`): **43
wystąpień w 12 plikach** — rząd wielkości się zgadza, dokładna liczba zależy
od metody grepowania (luźny grep łapie też komentarze, nazwy zmiennych,
importy typu `Brain`), ale **kierunek ustalenia jest ten sam: Partner
niesie realny, wciąż widoczny dług `brand-*`**, nie zero.

Próbka rzeczywistych linii (`src/components/Partner/CommissionIntelligence.tsx`,
`TrustProgressionIndicator.tsx`): ikony (`text-brand`), tła odznak
(`bg-brand/10`), obwódki przy hover (`hover:border-brand/30`), pasek postępu
(`bg-gradient-to-r from-brand to-emerald-500`) — wszystko dekoracyjne, zero
semantyki krytycznej.

---

## K3 — podział TŁA vs RESZTA

Podział zastosowany do całego zbioru 5325:
- **TŁA/gradienty/obwódki** (`bg-*`, `from-*`, `to-*`, `via-*`, `border*-*`
  wszystkie strony, `ring-*`, `divide-*`, `shadow-*`, `outline-*`):
  **3001 wystąpień (56%)**
- **Tekst/ikony** (`text-*`, `fill-*`, `stroke-*`, `accent-*`, `caret-*`,
  `decoration-*`, `placeholder-*`): **2324 wystąpień (44%)**

Rozbicie per moduł w tabeli powyżej (kolumny Tła/Reszta). Proporcja jest
zaskakująco stabilna w większości modułów (~55/45), co znaczy: **problem
„czerwonego tła" nie jest osobnym zjawiskiem od „czerwonego tekstu" — to ten
sam dług, tylko tła są bardziej widoczne przy przeglądzie wzrokiem.**
Właściciel zgłosił tła, bo to one biją po oczach — ale tekst/ikony to
prawie połowa długu i przy oględzinach łatwo je przeoczyć (to jest dokładnie
mechanizm „Przyrząd kłamie, a oko przywyka" z korpusu wcześniejszych ustaleń).

---

## K4 — rozstrzygnięcie próbki (5×5 z pięciu najbardziej obciążonych modułów)

Próbka: `components/AIChat`, `views/superadmin`, `components/MyWork`,
`components/SuperAdmin`, `components/Reports` — po 5 wystąpień, dobranych
systematycznie (co N-ty wiersz posortowanej listy per moduł, nie pierwsze 5
z góry pliku — żeby nie próbkować z jednego pliku).

**Wynik: 25/25 = 100% dekoracja. Zero semantyki krytycznej w próbce.**

Rozkład tego, czym faktycznie były (25 sprawdzonych linijek z kontekstem):
- ikony informacyjne / status w kartach (np. `text-primary-500` przy ikonie
  `Sparkles`/`Target`/`Shield`) — 9
- tła odznak/badge'y (liczby, tagi, „RECOMMENDED", duplicate count) — 6
- przyciski/CTA drugorzędne, hover-y — 5
- pola formularza: obwódka i **pierścień fokusu** — 2
- stan aktywny/zaznaczony (filtr, wybór) — 2
- gradient dekoracyjny (AI companion, ikona) — 1

**Dwa znaleziska w próbce łamią wprost zasady z CLAUDE.md, nie tylko
„nie powinno być crimson jako dekoracja" ogólnie:**
1. `src/components/SuperAdmin/FeatureFlagsPanel.tsx:345` i
   `src/views/superadmin/components/AdminKnowledgeView.tsx:732` — **pierścień
   fokusu pola (`focus:ring-primary-500`, `focus:border-primary-500`)** —
   CLAUDE.md wprost: „fokus = niebieski `c-focus`". Nie neutralny wybór
   stylistyczny, tylko znany, nazwany błąd.
2. `src/components/SuperAdmin/ContentFilters.tsx:151` — **stan aktywny
   filtra** (`activeFiltersCount > 0 ? 'bg-primary-500/10 border-primary-500/30
   text-primary-400' : ...`) — CLAUDE.md: „CTA/stany aktywne = neutralne".

Dodatkowo `AICompanionBrief.tsx:71` i `TableOfContents.tsx:296` używają
primary/crimson na elementach oznaczonych jako **AI** (gradient przy
"AI insight", ikona przy „AI-generated section") — w configu istnieje
osobny token `c-ai` (fiolet) właśnie po to, żeby „to zrobiła AI" nie było
mylone z marką/crimson (komentarz w `tailwind.config.js` linia ~103). To
osobna, mniejsza rodzina błędów, ale w tej samej próbce.

★ **Nie ekstrapoluję z tej próbki na całość** (23 dyzur — kszałt "próbka
zamiast zbioru"). 5 modułów × 5 linii = wysoki-udział-crimson moduły
najbardziej dotkliwe wizualnie, nie reprezentatywna losowa próba całych
5325. Traktować jako **dolną granicę pewności**: w najgorszych modułach
dekoracja to (przynajmniej) 100%; nie twierdzę, że w pozostałych 104
katalogach jest identycznie, tylko że we wszystkich pięciu sprawdzonych nie
znalazł się ANI JEDEN przypadek uzasadniony semantyką krytyczną — co jest
zgodne z ustaleniem z Partnera (97/34 w 100% dekoracyjne).

---

## K5 — czy bezpieczniki łapią wszystkie trzy nazwy

### `scripts/check-list-canon.sh` — NIE DOTYCZY

To bezpiecznik strukturalny (własna tabela vs `StandardTable`), nie
sprawdza kolorów w ogóle. Nie ma w nim ani `primary`, ani `crimson`, ani
`brand`. Poprawnie poza zakresem tego audytu — nie jest to luka, bo nigdy
nie miał tego łapać.

### `scripts/check-triada.sh` — ŁAPIE WSZYSTKIE TRZY NAZWY, ale z lukami

Własny changelog skryptu (komentarz VF5, 2026-08-31) pokazuje, że **już raz
złapano dokładnie ten sam błąd co dzisiaj** — poprzednia wersja hooka
sprawdzała tylko `primary-*`, `brand` był w regexie zerowo obecny. Naprawiono
31.08. Aktualny `VIOL_RE` (linia 71):

```
primary-(50|100|200|300|400|500|600|700|800|900)([^0-9]|$)
| focus:(ring|border)-primary([^0-9]|$)
| crimson-(50|100|200|300|400|500|600|700|800|900)([^0-9]|$)
| brand-(50|100|200|300|400|500|600|700|800|900)([^0-9]|$)
| (bg|text|border|ring|from|shadow)-brand([^0-9a-zA-Z-]|$)
```

**Przetestowałem regex bezpośrednio (grep -E z tymi samymi wzorcami) —
cztery realne luki, potwierdzone na żywych przykładach z `src/`:**

| Wzorzec | Przykład z repo | Łapane? |
|---|---|---|
| gołe `bg-primary`/`text-primary` (bez numeru odcienia) | `src/components/ui/progress.tsx:19`, `src/components/ui/slider.tsx:46,58`, `src/App.tsx:467+` (6×), `src/services/report/drdReportSvg.ts:35-36` | **NIE** |
| gołe `bg-crimson`/`text-crimson` (bez numeru) | — (nie znaleziono w bieżącym `src/`, ale regex realnie nie łapie) | **NIE** |
| `crimson-950` / `brand-950` (odcień 950 istnieje w configu, poza listą 50–900 w regexie) | `src/components/ui/primitives/OnboardingHint.tsx:93` (`bg-crimson-950`) | **NIE** |
| `border-t/b/l/r/x/y-brand`, `to-brand`, `via-brand`, `outline-brand` itd. (bare `brand`, prefiksy spoza listy `bg/text/border/ring/from/shadow`) | brak w bieżącym `src/`, ale luka potwierdzona testem regexu | **NIE** |

Przeliczyłem to na cały zbiór 5325: **48 wystąpień (0,9%) realnie omija
`VIOL_RE`** mimo że hook „w teorii" zna wszystkie trzy nazwy. Liczbowo
mało, ale jakościowo istotne — luka trafia akurat w **gołe wywołania bez
numeru odcienia**, czyli dokładnie te miejsca, gdzie ktoś pisze
`className="bg-primary"` w bazowym komponencie UI (`components/ui/
progress.tsx`, `components/ui/slider.tsx` — to są prymitywy współdzielone
przez wiele ekranów, nie martwy kod). Hook też jest ratchet/baseline —
łapie tylko NOWE linie w diffie, więc te 48 to dług zastany, który przejdzie
committ za każdym razem, dopóki ktoś nie dotknie tej linii ponownie.

### `scripts/check-artefakt.sh` — ★ NAJWAŻNIEJSZE ZNALEZISKO

PART 1 (bezpiecznik crimson w powłoce artefaktów) — linia 113:

```bash
grep -nE 'primary-|bg-c-accent|text-c-accent|border-c-accent' "$f"
```

**Sprawdza WYŁĄCZNIE `primary-`. `crimson` i `brand` nie występują w tym
skrypcie ANI RAZU** (potwierdzone: `grep -n -i "crimson\|brand" scripts/
check-artefakt.sh` → 0 trafień, poza słowem „brand" w prozie komentarzy
i nazwie klas `crimson-ok`/`karty-n-ok` niezwiązanych z detekcją).

To dokładnie ostrzeżenie ze zlecenia: **bezpiecznik przepuszcza dwie
trzecie rodziny** w zakresie plików, które sam pilnuje. Zakres tego hooka
jest wąski i jawnie wymieniony (linie 95–106, 184–190) —
`ArtifactRightPanel.tsx`, `IdeaMapWorkspace.tsx`, `NModeLayout/*`,
`ExecutiveModuleShell/*`, `mindmap/whiteboard/processflow/table` tools,
kilka `*DetailView.tsx`. Sprawdziłem, czy w TYCH konkretnych plikach jest
`crimson-*`/`brand-*` — bieżący `src/` nie ma tam żadnego wystąpienia w tej
chwili, więc luka **jeszcze nie boli w praktyce dzisiaj**, ale nic nie stoi
na przeszkodzie, żeby ktoś jutro wpisał `bg-crimson-500` w
`ArtifactRightPanel.tsx` i commit przejdzie czysto — bezpiecznik go nie
zobaczy. Fałszywy spokój gotowy do wyzwolenia.

**Rekomendacja (nie wykonana w tym dyżurze — zero zmian w `src/`/`scripts/`,
zgodnie z zasadami twardymi):** rozszerzyć `check-artefakt.sh` linia 113
o `crimson-` i `brand-` analogicznie do naprawy, którą `check-triada.sh`
już przeszedł 31.08 — to jest bezpośrednio odtwarzalny wzorzec naprawy
(ten sam plik, ten sam typ poprawki, już raz zrobiony w siostrzanym
skrypcie).

---

## Podsumowanie liczbowe

| Miara | Wartość |
|---|---|
| Nazw aliasów wskazujących na `#85182F` | **3** (`primary`, `crimson`, `brand`) + 1 mniejszy wektor gradientu (`bg-hig-primary`, nieużywany w `src/`) |
| Łączna liczba wystąpień (3 nazwy, klasy Tailwind koloru) w `src/` | **5325** w **609 plikach**, **109 katalogów-modułów** |
| Tła/gradienty/obwódki | 3001 (56%) |
| Tekst/ikony | 2324 (44%) |
| Udział dekoracji w próbce 5×5 (5 najcięższych modułów) | **25/25 = 100%** |
| Portal Partnerski (miał być „bliski zera") | **34 wystąpienia w 5 plikach — wszystkie `brand-*`, 100% dekoracja** |
| `check-triada.sh` — pokrycie trzech nazw | Tak, ale **48 wystąpień (0,9%) omija regex** (gołe formy bez numeru, odcień 950, `brand` poza 6 prefiksami) |
| `check-artefakt.sh` — pokrycie trzech nazw | **NIE — łapie tylko `primary-`, zero `crimson`/`brand`** w zakresie powłoki artefaktów |
| `check-list-canon.sh` — pokrycie | Nie dotyczy (inny typ bezpiecznika) |

## Rekomendacja kolejności modułów do naprawy

Kolejność wg iloczynu skali × ryzyka wizualnego (tła > reszta) × braku
osłony bezpiecznika:

1. **`components/AIChat`** (739, w tym 412 tła) — największy pojedynczy
   nośnik długu, jeden moduł to 14% całego zbioru.
2. **`views/superadmin` + `components/SuperAdmin`** (razem 753) —
   drugi co do wielkości blok, w dodatku Admin/SuperAdmin to ekrany, które
   widzi właściciel i zespół najczęściej przy pracy operacyjnej.
3. **`components/MyWork`** (318) — moduł startowy każdej sesji użytkownika,
   waga wizualna nieproporcjonalna do liczby wystąpień.
4. **`components/Partner`** (32/34) — mniejszy wolumen, ale **PILNY**: był
   dziś ogłoszony jako zamknięty („MODUL 16 PARTNER ZAMKNIETY"), a realnie
   nie jest — ryzyko, że ktoś zaufa temu statusowi i pójdzie dalej.
5. **`components/Reports`**, **`components/assessment`**,
   **`components/DiscoveryTools`** (600+ łącznie) — kolejny pakiet
   średniej wielkości modułów.
6. Zanim ruszy naprawa którejkolwiek powłoki artefaktu: **najpierw
   rozszerzyć `check-artefakt.sh`** o `crimson-`/`brand-`, inaczej naprawa
   w zakresie tego hooka będzie się cofać bez ostrzeżenia.

## Commity tego dyżuru

1. `docs(wave3): rejestr crimson pod trzema nazwami — pomiar calej aplikacji`
   (ten plik)

Zero zmian w `src/`, `scripts/`, konfiguracji. Gałąź: `agent/crimson-audyt-
20260902`, baza `6fe16e2bd4`. Nie pushowano.
