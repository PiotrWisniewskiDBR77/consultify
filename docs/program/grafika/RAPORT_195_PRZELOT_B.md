# Raport — drugi przelot fotograficzny (przelot-B), moduły 09+

Data: 2026-09-01. Gałąź: `codex/m03-admin-20260824`. Katalog dowodowy:
`evidence/grafika/195-przelot-B/` (+ kopie płaskie `evidence/grafika/195-przelot-B--*/`
dla ekranów z zakładkami — patrz sekcja 6).

## 1. Granica podziału z drugim robotnikiem (przelot-A)

Drugi robotnik fotografuje moduły 01–08 (Czat, Moja praca, Wywiad, Narzędzia, Ocena,
Inicjatywy, Realizacja, Wyniki) do `195-przelot-A`. Ja wziąłem **moduły 09–18** wg
`docs/program/grafika/status.json` (`_kolejnosc`), oceny A/B:

| katalog | nazwa | ekranów A/B |
|---|---|---|
| 09-finanse | Finanse | 13 |
| 10-materialy | Materiały | 36 |
| 11-audyty | Audyty | 4 |
| 12-spotkania | Spotkania | 3 |
| 13-administracja | Administracja | 41 |
| 14-organizacja | Organizacja | 21 |
| 15-agent | Agent | 3 |
| 16-kanon | Kanon i elementy wspólne | 11 |
| 17-aios | Internal Tools / AI OS | 4 |
| 18-ustawienia | Ustawienia | 8 |
| **RAZEM** | | **144** |

Moduły 01–08 (przelot-A) = 109 ekranów. 109 + 144 = **253** — zgadza się z całością
kart A/B w `status.json`. Zero nakładania (policzone programowo, zbiory id rozłączne).

## 2. Wykonanie

Sfotografowano wszystkie 144 ekrany, faza `PO`, oba motywy (light/dark), parametry
z `docs/program/grafika/SPIS_PARAMETROW_ZRZUTOW.json`:

- **126 ekranów płaskich** (bez zakładek/specjalnych parametrów) — 9 partii po 14,
  narzędzie `scripts/dev/grafika-zrzuty.mjs`, domyślny klik w pierwszy wiersz tabeli
  (nowa zasada: cały ekran RAZEM z otwartym podglądem).
- **18 ekranów specjalnych** ze spisu (zakładki/tryby/parametry/klik/wynikSelektor) —
  rozbite na warianty: finance-hub (5 zakładek), finance-prediction-workspace (3 tryby),
  finance-baseline-workspace (2 widoki), b2-template-gallery (4 narzędzia),
  materialy-launcher (2 warianty), audyty-piec-powierzchni (5 zakładek),
  audyty-drd-report (2 warianty), meetings-module (4 widoki),
  admin-command-center-panel (6 zakładek) + pojedyncze warianty dla pozostałych.
  Łącznie 348 plików PNG w drzewie `195-przelot-B/`.

## 3. Dwa stany (z podglądem / bez podglądu)

Z listy 20 ekranów z przepełnioną tabelą (8+ kolumn, przypięta kolumna akcji zasłania
dane) w moim zakresie znalazło się **6**: `materials-registry`,
`excele-jeden-widok-materialy`, `model-catalog-table`, `agent-hub`,
`audyty-piec-powierzchni`, `finance-hub`.

**Sposób wyłączenia automatycznego klikania — ISTNIEJE w narzędziu**: flaga
`--bez-klika-domyslnego=1` (patrz `scripts/dev/grafika-zrzuty.mjs:153`). Użyłem jej dla
drugiego stanu wszystkich 6 ekranów.

Weryfikacja wzrokiem: `finance-hub` (statements) z podglądem chowa kolumnę
„AKTUALIZACJA" pod panelem; wersja bez podglądu pokazuje ją w pełni — dokładnie defekt,
który ta zasada miała wyłapać.

**Uwaga o `--faza`**: narzędzie sztywno wymusza `--faza=PRZED|PO` (walidacja w kodzie,
`grafika-zrzuty.mjs:197-200`) — wartość `PO-bez-podgladu` z instrukcji jest przez nie
odrzucana. Nie modyfikowałem narzędzia. Zamiast tego zakodowałem drugi stan w nazwie
katalogu (sufiks `-bez-podgladu` / `bez-podgladu/`), zachowując `--faza=PO`. Zgłaszam to
wprost zamiast kombinować z kodem narzędzia.

## 4. Ekrany bez otwartego podglądu (domyślny klik nie znalazł wiersza)

Podsumowania partii podają to per-partia; zbiorczo: część ekranów to NIE są tabele
(panele/workspace/formularze/canvas) — tam brak podglądu jest oczekiwany, nie defekt.
Przykładowe liczby z partii: 26/28, 24/28, 26/28, 4/28, 14/28, 16/28, 26/28, 2/28, 26/28
sfotografowano bez podglądu w kolejnych 9 partiach płaskich — dokładne przyczyny (ekran
nie jest listowy / tabela pusta) narzędzie nie rozróżnia, zgodnie z jego własnym
komentarzem.

## 5. Znaleziska — ekrany podejrzane / defekt

1. **`report-builder-library-template` — realny defekt SPIS, NIE produktu.** Domyślne
   wywołanie (`?screen=report-builder-library-template`, bez dodatkowych parametrów)
   renderuje **całkowicie pustą stronę** (potwierdzone: light i dark, oba puste, zero
   treści). Przyczyna: plik źródłowy `dev-render/screens/report-builder-library-template.tsx`
   wymaga `&new=true&templateArtifactId=fake-1` w URL, żeby komponent rozpoznał wejście
   jako `isLibraryTemplateEntry` — ale `dev-render/main.tsx` (etykieta linii 806) tego nie
   wspomina, więc `SPIS_PARAMETROW_ZRZUTOW.json` (budowany z etykiet) tego nie złapał.
   **Naprawione w mojej ewidencji**: zdjąłem ponownie z poprawnymi parametrami —
   `evidence/grafika/195-przelot-B/report-builder-library-template__PO__{light,dark}.png`
   teraz pokazuje prawidłowy modal „Nowy raport z wzorca". Zgłaszam lukę w SPIS (nie
   edytowałem tego pliku — to cudzy artefakt audytu).
2. **`deck-artifact` — kontrola pary (KSZTAŁT 13) zgłosiła ostrzeżenie**, nie błąd:
   różnica jasności light/dark = 118,3, próg 150 („para wygląda jak duplikat"). Obejrzałem
   oba zrzuty — to fałszywy alarm: tytułowy slajd decku ma z założenia ciemny
   niebiesko-turkusowy gradient w OBU motywach (kolor treści slajdu, nie UI), więc luma
   różni się mniej niż zwykła para light/dark. Zapisane w
   `evidence/grafika/195-przelot-B/_wynik-kontrola__PO.json`.
3. **Awaria harnessu w trakcie partii 7** (`org-*`, moduł 14): port 3020 przestał
   odpowiadać (`ERR_CONNECTION_RESET`/`REFUSED`) tuż przy `org-source-conflicts`.
   Zrestartowano przez `node scripts/dev/stanowisko.mjs restart`, ekran doszedł czysto
   przy powtórce. Nie stracono żadnego innego ekranu z tego okna.
4. **`finance-export-import-panel`** — narzędzie nie umie wgrać pliku (`setInputFiles`),
   więc stan „podgląd różnic po imporcie" (gwiazdkowany wymóg wg
   `scripts/dev/ap-client-screenshots.mjs`) jest poza możliwościami
   `grafika-zrzuty.mjs`. Sfotografowany tylko stan domyślny (pusty formularz importu).
   Zgłaszam ograniczenie zamiast obchodzić je hackiem.
5. **Ekrany z konsekwentnymi błędami konsoli** (nie blokują renderu, ale widoczne w
   każdej partii): wszystkie 4 ekrany `17-aios` (5 błędów/zrzut), wszystkie ekrany
   `org-*` w 14-organizacja (3 błędy/zrzut), `finance-model-workspace` (4),
   `document-studio-*` kilka (1–3), `admin-ai-*`/inne pojedyncze. Nie diagnozowałem
   przyczyny (poza zakresem fotografowania) — flaguję do dalszej analizy.
6. **`audyty-warsztat-kryterium`** — SPIS sam oznaczył ten ekran jako
   `nierozstrzygniete` (zbyt duża kombinatoryka parametrów, żeby ustalić którą
   kombinację oceniono A/B). Sfotografowałem domyślne wejście (`?screen=` bez dodatkowych
   parametrów) — nie potwierdzam, że to właściwa kombinacja.

Żaden ekran nie pokazał listy awaryjnej / crasha całej strony poza pkt 1 (naprawione) i
pkt 3 (naprawione restartem).

## 6. Organizacja plików — luka w `odbior-kontrola.mjs` i jej obejście

`scripts/dev/odbior-kontrola.mjs` skanuje TYLKO jeden poziom katalogów pod
`evidence/grafika/` (nie rekurencyjnie). Moje pierwotne zagnieżdżenie wariantów zakładek
(np. `195-przelot-B/finance-hub/statements/…`) było dla niego niewidoczne — zgłaszał
9 ekranów jako „STARY ZRZUT" (bo widział tylko starsze płaskie kopie z poprzednich sesji).

**Naprawa**: skopiowałem (nie przeniosłem — oryginały zostają w drzewie zagnieżdżonym
dla czytelności) każdy zagnieżdżony wariant do płaskiego katalogu-siostry pod
`evidence/grafika/195-przelot-B--<ekran>-<wariant>/` (34 katalogi × 2 pliki = 70 plików).
Po tej naprawie kontrola per-moduł jest czysta dla wszystkich 10 moich modułów (patrz
sekcja 7). Nie zmieniałem `odbior-kontrola.mjs` — to narzędzie nadzorcy, nie moje.

## 7. Wynik kontroli kart (`odbior-kontrola.mjs`)

Uruchomione per moduł (`--modul=<katalog>`), po naprawie z sekcji 6:

```
09-finanse        -> CZYSTO — można oddawać. (13 kart, 26 motywów, 26 bez zastrzeżeń)
10-materialy      -> CZYSTO — można oddawać. (36 kart, 72 motywy, 72 bez zastrzeżeń)
11-audyty         -> CZYSTO — można oddawać. (4 karty, 8 motywów, 8 bez zastrzeżeń)
12-spotkania      -> CZYSTO — można oddawać. (3 karty, 6 motywów, 6 bez zastrzeżeń)
13-administracja  -> CZYSTO — można oddawać. (41 kart, 82 motywy, 82 bez zastrzeżeń)
14-organizacja    -> CZYSTO — można oddawać. (21 kart, 42 motywy, 42 bez zastrzeżeń)
15-agent          -> CZYSTO — można oddawać. (3 karty, 6 motywów, 6 bez zastrzeżeń)
16-kanon          -> CZYSTO — można oddawać. (11 kart, 22 motywy, 22 bez zastrzeżeń)
17-aios           -> CZYSTO — można oddawać. (4 karty, 8 motywów, 8 bez zastrzeżeń)
18-ustawienia     -> CZYSTO — można oddawać. (8 kart, 16 motywów, 16 bez zastrzeżeń)
```

Uruchomienie globalne (bez `--modul=`) nadal zgłasza 34 „STARY ZRZUT" — wszystkie
zweryfikowane jako ekrany modułów 01–08 (`interview-*`, `assessment-*`, `results-vnext-*`,
`*-jedna-karta`, `capacity-advisor-a3`, `drd-*`, `siri-workspace`, `method-workspace`) —
zakres drugiego robotnika (przelot-A), nie mój. Zero nakładania potwierdzone programowo.

## 8. Dziesięć obejrzanych zrzutów (po jednym z każdego modułu, `Read`)

1. **`finance-hub` (statements, light)** — 6 sprawozdań w tabeli, prawy panel otwarty
   „Vantage Retail Partners" ze szczegółami i akcjami AI; podgląd w kadrze.
2. **`materials-registry` (light)** — 3 wiersze (Budżet pilotażu / 2× Plan transformacji),
   podgląd otwarty z sekcją „Stan zaufania" i AI.
3. **`audyty-piec-powierzchni` (library, light)** — 6 zakładek u góry, 5 wierszy audytów,
   podgląd „Audyt systemu zarządzania jakością" z pełnym Celem/Zakresem.
4. **`meetings-module` (list, light)** — 4 spotkania, podgląd „Warsztat mapowania strat
   OEE" z uczestnikami, agendą, decyzjami i notatką AI.
5. **`admin-team-members` (light)** — tabela 6 członków zespołu z rolami/statusami;
   pierwszy wiersz podświetlony (klik wykonany), ale ten ekran CRUD nie ma bocznego
   podglądu — zachowanie oczekiwane, nie defekt.
6. **`org-identity-operating` (z `ff_org_redesign_v1=1`, light)** — nowa powierzchnia
   „Tożsamość i model działania" z lewym menu, kartami pól i prawym panelem
   Stan danych/Wymaga decyzji — flaga poprawnie renderuje DOCELOWY ekran (nie starą
   powierzchnię, dokładnie pułapka z CLAUDE.md #7).
7. **`agent-hub` (light)** — 6 pozycji, podgląd „Program transformacji — Elkomtech" z
   listą kroków/bramek 1–5.
8. **`fab-rail-kebab` (light)** — lista „Ocena gotowości — obszar N", pierwszy wiersz
   podświetlony, FAB rail po prawej i pływający pasek akcji (Zatwierdź/Odrzuć) na dole.
9. **`aios-agents` (light)** — „Wave 8 — Katalog agentów", pełny formularz uruchamiania
   agenta + katalog + harmonogram + audyt uruchomień; treść realna, nie awaryjna (mimo
   5 błędów konsoli na zrzut, patrz pkt 5.5).
10. **`ustawienia-personalne` (light)** — ekran „Profil" z lewym menu ustawień i
    formularzem danych osobowych Piotra Wiśniewskiego, w pełni wypełniony.

Dodatkowo sprawdziłem parę z podglądem/bez podglądu (`finance-hub` statements) —
potwierdzone wzrokiem: wersja bez podglądu ujawnia kolumnę „AKTUALIZACJA" niewidoczną
w wersji z podglądem.

## 9. SHA / stan gałęzi

Gałąź `codex/m03-admin-20260824` w `/private/tmp/m03`. Zmiany tej sesji ograniczone do
`evidence/grafika/195-przelot-B/**`, `evidence/grafika/195-przelot-B--*/**` i tego
raportu — zero zmian w kodzie produktu lub narzędziach.
