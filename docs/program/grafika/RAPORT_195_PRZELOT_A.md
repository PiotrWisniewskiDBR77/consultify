# Raport — pierwszy przelot fotograficzny (przelot-A), moduły 01–08

Data: 2026-09-01. Gałąź: `codex/m03-admin-20260824`. Katalog dowodowy:
`evidence/grafika/195-przelot-A/` (+ zagnieżdżone podkatalogi `195-przelot-A/<ekran>--<wariant>/`
dla ekranów z zakładkami, + `evidence/grafika/195-przelot-A-bez-podgladu/` dla drugiego
stanu przepełnionych tabel — patrz sekcja 3).

## 0. Awaria pierwszego podejścia — i naprawa

Pierwsze podejście uruchomiło cały przelot (112 wywołań) w tle i czekało na sygnał
zakończenia zamiast pracować partiami w pierwszym planie. To spowodowało: (a) DWA
procesy `run_plan.mjs` działające równolegle nad tym samym katalogiem (jeden nie
zabity po przerwaniu sesji), które nadpisywały sobie ten sam `progress.log` i dublowały
wywołania `grafika-zrzuty.mjs`; (b) harness `:3020` przestał odpowiadać pod obciążeniem.
Zabiłem oba osierocone procesy (`kill -9`), zrestartowałem harness
(`node scripts/dev/stanowisko.mjs start`) i wykonałem CAŁY przelot od nowa, tym razem
partiami po 3–10 wywołań w pierwszym planie, sprawdzając `progress.log` po każdej
partii. Druga (poprawiona) przyczyna błędów pierwszej próby: `--wynik-selektor=text=...`
używa wewnątrz narzędzia natywnego `document.querySelector()`, który NIE rozumie
składni `text=` Playwrighta (`SyntaxError`) — usunąłem `--wynik-selektor` z 6 wywołań,
które go używały (`ideas-teresa-panel`, `mywork-notebook-rail-speca`,
`interview-sessions-status`, `interview-creator-shell` ×3); zrzuty i tak powstają,
tylko bez opcjonalnej kontroli pary light/dark.

## 1. Zakres — moduły wzięte z `status.json`, oceny A/B

Wziąłem **moduły 01–08** wg `docs/program/grafika/status.json`, dopasowane do realnych
nazw katalogów (nie zgadywałem):

| katalog | nazwa | ekranów A/B |
|---|---|---|
| 01-czat | Czat | 15 |
| 02-moja-praca | Moja praca | 31 |
| 03-wywiad | Wywiad | 6 |
| 04-narzedzia | Narzędzia | 8 |
| 05-ocena | Ocena | 17 |
| 06-inicjatywy | Inicjatywy | 5 |
| 07-realizacja | Realizacja | 8 |
| 08-wyniki | Wyniki | 19 |
| **RAZEM** | | **109** |

109 (przelot-A) + 144 (przelot-B, moduły 09–18) = **253** — zgadza się z całością kart
A/B w `status.json`. Zero nakładania (zbiory id rozłączne, sprawdzone programowo).

## 2. Wykonanie — liczby dosłownie

```
ls evidence/grafika/195-przelot-A/*.png | wc -l                          → 218
ls evidence/grafika/195-przelot-A/*.png | sed 's/__.*//' | sort -u | wc -l → 109
find evidence/grafika/195-przelot-A -name "*.png" | wc -l                 → 348  (top + zakładki)
find evidence/grafika/195-przelot-A-bez-podgladu -name "*.png" | wc -l    → 20
find evidence/grafika/195-przelot-A -mindepth 1 -maxdepth 1 -type d | wc -l → 65 (podkatalogi zakładek)
```

218 = 109 unikalnych ekranów × 2 motywy — **wszystkie 109 ekranów z zakresu mają zrzut
top-level** (patrz sekcja 5, dlaczego to musi być top-level, nie tylko zagnieżdżone).
348 = 218 + 130 (65 podkatalogów zakładek × 2 motywy). 20 = 10 ekranów drugiego stanu ×
2 motywy.

Sfotografowano wg parametrów z `docs/program/grafika/SPIS_PARAMETROW_ZRZUTOW.json`
(pola `parametry`/`klik`/`klawisze`/`przewin`/`wynikSelektor`/`zakladki`), narzędziem
`scripts/dev/grafika-zrzuty.mjs`, faza `PO`, oba motywy:

- **85 ekranów płaskich** (bez zakładek) — partie po 8, domyślny klik w pierwszy wiersz
  tabeli (nowa zasada: cały ekran RAZEM z otwartym podglądem, gdy jest listowy).
- **19 ekranów z zakładkami** (`mindmap-i18n-smoke`, `siri-workspace`,
  `method-workspace`, `assessment-five-surfaces`, `assessment-manage-panel`,
  `drd-macierz-oceny` (7 osi!), `interview-creator-shell`, `interview-preview-canon`,
  `drd-http-workspace`, `cel/wskaznik/roi-jedna-karta`, `results-vnext-legacy-archive`,
  `results-vnext-okr-objectives`, `results-vnext-kpi-scorecards`,
  `results-vnext-roi-model`, `results-vnext-okr-admin`, `results-vnext-roi-registry`) —
  **każda zakładka osobno**, w zagnieżdżonym katalogu `<ekran>--<wartość>`.
- **5 ekranów z niestandardowym klikiem/selektorem** (`teresa-chipy-sugestii`,
  `ideas-teresa-panel`, `mywork-notebook-rail-speca`, `plan-scenario-d1`,
  `canvas-new-doc`) — selektory odtworzone ze starszych skryptów tego repo
  (`scripts/dev/idee-notatnik-116-screenshots.mjs`,
  `scripts/dev/menu3-104-suggestions-toggle-screenshots.mjs`,
  `scripts/dev/153-crimson-naprawa-capture.mjs`), nie zgadywane.

## 3. Dwa stany (z podglądem / bez podglądu)

Z listy 20 ekranów z przepełnioną tabelą w zleceniu, w moim zakresie (moduły 01–08)
znalazło się **10**: `vault-sejf-wnetrze`, `mywork-inbox`, `interview-sessions-status`,
`capacity-advisor-a3`, `plan-scenario-d1`, `execution-tab-list`, `execution-tab-resources`,
`results-vnext-okr-objectives`, `results-vnext-roi-model`, `results-vnext-okr-registry`.

**Sposób wyłączenia automatycznego klikania — ISTNIEJE w narzędziu**: flaga
`--bez-klika-domyslnego=1` (`scripts/dev/grafika-zrzuty.mjs:153`). Użyłem jej dla 9 z 10
(dla `plan-scenario-d1`, który ma WŁASNY jawny `--klik` otwierający narzędzia planu,
drugi stan pomija tylko drugi człon łańcucha kliknięć — klik w wiersz nowo odsłoniętej
tabeli — bo `--bez-klika-domyslnego` nie ma wpływu, gdy `--klik` jest już podany
jawnie).

Weryfikacja wzrokiem: `execution-tab-list` z podglądem pokazuje 6 kolumn
(Inicjatywa/Typ/Status/Przypisany/Postęp/Termin/Alerty); wersja bez podglądu ujawnia
DODATKOWĄ kolumnę „ZADANIA" niewidoczną w wersji z podglądem — dokładnie defekt, który
ta zasada miała wyłapać.

**Uwaga o `--faza`**: narzędzie sztywno wymusza `--faza=PRZED|PO` (walidacja w kodzie,
`grafika-zrzuty.mjs:197-200`) — wartość `PO-bez-podgladu` z instrukcji jest przez nie
odrzucana. Nie modyfikowałem narzędzia. Zamiast tego zakodowałem drugi stan w nazwie
katalogu (`195-przelot-A-bez-podgladu/`), zachowując `--faza=PO`. Zgłaszam to wprost
zamiast kombinować z kodem narzędzia — **ten sam wybór co przelot-B** (potwierdzone w
`RAPORT_195_PRZELOT_B.md`, niezależnie odkryte).

## 4. Ekrany bez otwartego podglądu (domyślny klik nie znalazł wiersza)

Zsumowane programowo ze WSZYSTKICH logów partii (`grep`+sumowanie, nie ręczne liczenie):

```
Domyślny klik PRÓBOWANY (ekran wyglądał na listowy): 340 zrzutów (z 368 wykonanych — 28 użyło jawnego --klik, poza tym licznikiem)
Klik wykonany (podgląd otwarty):                     120
BEZ podglądu (nie znaleziono wiersza do kliknięcia):  220
```

**220 z 340 prób (na poziomie pojedynczego zrzutu light/dark) poszło bez otwartego
podglądu.** Podobnie jak w przelocie-B: znaczna część mojego zakresu to ekrany-karty
pojedynczych obiektów (`karta-decision`, `karta-notification`, `karta-insight`,
`karta-task`, `karta-tool`, `karta-interview`, `karta-initiative`...), dokumenty/artefakty
(`tools-swot-report`, `decision-record`, `initiative-record`) i workspace'y bez tabeli
(`method-workspace`, `siri-workspace`, `plan-scenario-d1` przed kliknięciem) — tam brak
podglądu jest oczekiwany, nie defekt. Narzędzie samo nie rozróżnia „nie jest listowy" od
„tabela pusta" od „klik nie trafił" (własny komentarz w kodzie). Dwa konkretne przypadki,
gdzie WARTO by ktoś to sprawdził ręcznie (patrz sekcja 5, pkt 2–3): `idea-table` i
`assessment-reports-table` wyglądają na prawdziwe listy z danymi, ale podgląd się nie
otworzył.

## 5. Znaleziska — ekrany podejrzane / defekt

1. **`mywork-notebook-rail-speca` — częściowy klik.** Sekwencja kliknięć nagłówków
   akordeonu `"Komentarze","Historia i AI"` — drugi klik zgłosił `klik BRAK: text="Historia
   i AI"` (dokładny tekst nagłówka mógł się zmienić od czasu
   `scripts/dev/idee-notatnik-116-screenshots.mjs`, źródła tego selektora). Zrzut i tak
   powstał (sekcja „Komentarze" rozwinięta), plik zapisany poprawnie — nie jest to pusty
   ekran, tylko niepełne rozwinięcie akordeonu.
2. **`idea-table` — brak podglądu mimo realnej tabeli.** 5 wierszy z danymi
   (Ekspansja DE, Automatyzacja OEE, Program lojalnościowy...), ale kliknięcie pierwszego
   wiersza nie otworzyło panelu podglądu (`podgląd: BRAK` w logu partii). Nie
   diagnozowałem przyczyny (poza zakresem fotografowania) — flaguję do sprawdzenia: czy
   ten konkretny ekran demonstracyjny ma świadomie wyłączony podgląd, czy to defekt.
3. **`assessment-reports-table` — wiersz podświetlony, podgląd nie otwarty.** Pierwszy
   wiersz tabeli „Raporty" ma widoczne tło hover/selected, ale prawy panel podglądu się
   nie pojawił na zrzucie. Ten sam kształt co pkt 2 — flaguję, nie diagnozuję.
4. **`capacity-advisor-a3` — puste pola w panelu podglądu mimo danych w tabeli.** Wiersz
   „2026-W36" w tabeli pokazuje `11/12/13 FTE-week` (Potrzeba) i `7/8/9 FTE-week`
   (Zasoby), ale w otwartym panelu podglądu sekcja „Stan obciążenia i dowodów" pokazuje
   puste wartości przy `Zapotrzebowanie:` i `Dostępność:` (widać tylko etykiety, bez
   liczb). Może być defekt renderu panelu albo świadomy skrót w danych demo — flaguję.
5. **Ekrany z błędami konsoli** — `chat-split-teresa-right` zgłosił 21 błędów
   konsoli na zrzut (najwyższa liczba w moim zakresie); nie diagnozowałem przyczyny
   (poza zakresem fotografowania), flaguję do dalszej analizy.

Żaden ekran w moim zakresie nie pokazał listy awaryjnej, całkowitej pustki ani crasha
strony.

## 6. Organizacja plików — luka w `odbior-kontrola.mjs` i jej obejście

`scripts/dev/odbior-kontrola.mjs` skanuje TYLKO jeden poziom katalogów pod
`evidence/grafika/` (`fs.readdirSync` bez rekursji) — nie schodzi do zagnieżdżonych
podkatalogów zakładek (np. `195-przelot-A/interview-creator-shell--step1/`). Odkryłem to
PRZED uruchomieniem pełnego przelotu (test na małej próbce), więc naprawa jest wbudowana
w plan od początku, nie doklejona później: generator wywołań (`gen_plan.mjs`, w
scratchpadzie sesji, nie w repo) dopisuje automatycznie DODATKOWĄ płaską kopię
PIERWSZEGO/domyślnego wariantu każdego ekranu z zakładkami wprost do
`195-przelot-A/<ekran>__PO__<motyw>.png` (i analogicznie do
`195-przelot-A-bez-podgladu/` dla `results-vnext-okr-objectives` i
`results-vnext-roi-model`) — stąd 218 plików top-level dla dokładnie 109 unikalnych id
(sekcja 2). Zagnieżdżone warianty per-zakładka zostają dodatkowo, dla pełnego przeglądu.

## 7. Wynik kontroli kart (`odbior-kontrola.mjs`)

Uruchomione per moduł (`--modul=<katalog>`):

```
01-czat           -> CZYSTO — można oddawać. (15 kart, 30 motywów, 30 bez zastrzeżeń)
02-moja-praca     -> CZYSTO — można oddawać. (31 kart, 62 motywy, 62 bez zastrzeżeń)
03-wywiad         -> CZYSTO — można oddawać. (6 kart, 12 motywów, 12 bez zastrzeżeń)
04-narzedzia      -> CZYSTO — można oddawać. (8 kart, 16 motywów, 16 bez zastrzeżeń)
05-ocena          -> CZYSTO — można oddawać. (17 kart, 34 motywy, 34 bez zastrzeżeń)
06-inicjatywy     -> CZYSTO — można oddawać. (5 kart, 10 motywów, 10 bez zastrzeżeń)
07-realizacja     -> CZYSTO — można oddawać. (8 kart, 16 motywów, 16 bez zastrzeżeń)
08-wyniki         -> CZYSTO — można oddawać. (19 kart, 38 motywów, 38 bez zastrzeżeń)
```

Uruchomienie globalne (bez `--modul=`, cały `status.json`, 253 karty — obejmuje też
przelot-B drugiego robotnika):

```
Kart A/B: 253 (506 motywy)
Bez zastrzeżeń: 506
Wynik: CZYSTO — można oddawać.
```

## 8. Dziesięć obejrzanych zrzutów (po jednym z modułu, `Read`, min. 8 modułów × 1 + 2 dodatkowe)

1. **`chat-signals-feed` (01-czat, light)** — tabela sygnałów 6 wierszy (Sygnał/Domena/
   Waga/Źródło/Wiek/Status) z przyciskiem „Pokaż starsze"; prawy panel otwarty
   „Inicjatywa bez baseline" ze Szczegółami i Powiązaniami — podgląd w kadrze.
2. **`idea-table` (02-moja-praca, light)** — 5 wierszy (Tytuł/Etap/Tagi/Narzędzie/Data),
   BEZ otwartego podglądu mimo kliknięcia (patrz znalezisko §5.2).
3. **`vault-sejf-wnetrze` (02-moja-praca, light)** — 7-wierszowa tabela dokumentów,
   podgląd otwarty „MW10_wersjonowanie_demo.docx" z metadanymi i akcjami AI.
4. **`interview-sessions-status` (03-wywiad, light)** — 5 sesji wywiadu w tabeli, podgląd
   otwarty „Wywiad — Dział zakupów" ze statusem „Przydzielony", przebiegiem i akcjami AI.
5. **`interview-creator-shell` (03-wywiad, krok 2 „Materiał", light)** — modal kreatora
   z 3-krokowym paskiem postępu (krok 1 zaliczony, krok 2 aktywny), 5 zatwierdzonych
   sesji do wyboru checkboxami — potwierdza poprawne działanie fotografowania
   zakładka-po-zakładce.
6. **`tools-swot-report` (04-narzedzia, dark)** — pełny dokument „Dynamic SWOT — wejście
   na rynek DACH": macierz 2×2, napięcia strategiczne, dowody z etykietami FAKT/HIPOTEZA,
   karty rekomendacji z sekcją trade-off; czytelny w ciemnym motywie.
7. **`assessment-reports-table` (05-ocena, light)** — 5 raportów w tabeli, wiersz
   podświetlony, BEZ otwartego panelu podglądu (patrz znalezisko §5.3).
8. **`karta-initiative` (06-inicjatywy, light)** — pełny widok artefaktu „Skrócenie
   przezbrojeń linii pakowania L3 (SMED)": lewe menu sekcji, długi tekst Zakresu
   inicjatywy z danymi liczbowymi, prawy panel Akcje/Właściwości/Powiązania.
9. **`capacity-advisor-a3` (06-inicjatywy, light)** — 2-wierszowa tabela obciążenia,
   podgląd otwarty „2026-W36", ale z podejrzanie pustymi polami Zapotrzebowanie/
   Dostępność (patrz znalezisko §5.4).
10. **`execution-tab-list` (07-realizacja, dark, PARA dwóch stanów)** — z podglądem: 6
    kolumn + panel „Supply Chain Optimization" (56%, Scheduled); bez podglądu: TA SAMA
    tabela ujawnia dodatkową kolumnę „ZADANIA" — potwierdzony mechanizm dwóch stanów.
11. **`results-vnext-okr-registry` (08-wyniki, light)** — 9-wierszowy rejestr OKR, podgląd
    otwarty „Ograniczyć reklamacje..." ze statusem „Oczekuje na decyzję", właściwościami
    i powiązaniami.

(11 zamiast wymaganych 10 — dołożyłem `interview-creator-shell` krok 2 i parę
z/bez podglądu `execution-tab-list`, żeby pokazać mechanikę zakładek i dwóch stanów.)

## 9. SHA / stan gałęzi

Gałąź `codex/m03-admin-20260824` w `/private/tmp/m03`. Zmiany tej sesji ograniczone do
`evidence/grafika/195-przelot-A/**`, `evidence/grafika/195-przelot-A-bez-podgladu/**` i
tego raportu — zero zmian w kodzie produktu lub narzędziach (`grafika-zrzuty.mjs`
przeczytany, nie zmieniony; ograniczenia i luki tylko opisane wyżej).
