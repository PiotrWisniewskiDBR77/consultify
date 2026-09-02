---
doc_id: grafika-poprawione-20260902
status: canonical
owner: piotr
truth_type: measurement
established: 2026-09-02
---

# Ekrany dotkniete dzisiejsza zmiana (2026-09-02) — pomiar, nie pamiec

POLECENIE WLASCICIELA (02.09, doslownie): "Tam gdzie mamy odbiory ekranow, ustaw status poprawione tam, gdzie byly wprowadzane zmiany, jakiekolwiek. Dzisiaj widze tylko trzy pozycje do poprawy i nie mam nic wiecej do kontrolowania."

## Jak zmierzono (nie z pamieci)

1. `git log --since=2026-09-02 --name-only` na linii `grafika/m03-20260902` → **63 zmienione pliki** (61 kodu + 2 slowniki).
2. Roznica slownikow wzgledem ostatniego commita sprzed polnocy (`ff6039c71b`) → **162 zmienione klucze i18n**.
3. Nowe narzedzie `scripts/dev/grafika-dotkniete.mjs` przechodzi PRZECHODNIO graf importow kazdego z 313 ekranow rejestru — od wpisu w `dev-render/main.tsx` (takze przez `lazy(() => import(...))`, ktorego zwykly grep po `<Nazwa` nie widzi) w glab `src/`. To narzedzie, a nie grep, jest zrodlem tej tabeli.
4. Cztery pliki-huby dostaly JAWNY warunek widocznosci zamiast automatycznego zaliczenia — bez tego wynik brzmialby "283 z 313 ekranow", co jest liczba bez wartosci:

| hub | ile ekranow trafial | werdykt |
| --- | ---: | --- |
| `src/i18n.ts` | 274 | ODRZUCONY. Zmiana dotyczy ostatecznego fallbacku jezyka dla anonimowego gościa — widoczna WYLACZNIE na ekranach przed zalogowaniem, ktore i tak sa w tej partii osobno. |
| `src/store/useConversationStore.ts` | 105 | ODRZUCONY. Dopisane pole TYPU, zero zmiany na ekranie. |
| `EntityStatusChip.tsx` | 219 | PRZYJETY WARUNKOWO jako rodzina czerwieni tam, gdzie ekran pokazuje stan cyklu zycia (anulowane/wygasle/cofniete). |
| `FilterableTable.tsx` | 162 | PRZYJETY WARUNKOWO — pelna lista konsumentow to nie jest lista ekranow ZMIENIONYCH WIDOCZNIE; przyjete tylko te, ktorych wlasny plik tez sie zmienil. |

## Wynik: **92 ekranow** rejestru + **6 ekranow logowania** dopisanych do rejestru = **98**

| rodzina defektu | ekranow | co widzi wlasciciel |
| --- | ---: | --- |
| angielskie resztki | 44 | Polskie nazwy zamiast angielskich resztek i literowek. |
| rodzina czerwieni | 22 | Czerwien tylko tam, gdzie cos wymaga reakcji; stany cyklu zycia i plakietka REKOMENDOWANY juz nie alarmuja. |
| liczebniki | 19 | Liczby odmieniaja sie po polsku: 1 dzien, 2 dni, 5 dni. |
| menu kanwy | 16 | Menu pod trzema kropkami na kanwie mowi po polsku; zniknal zargon inzynierski (REALNE/CZESCIOWE). |
| uciecia tekstu | 15 | Kolumny nie kurcza sie do kilkunastu pikseli, wyrazy nie rwa sie w polowie. |
| awaria Architekta szablonow | 15 | Klikniecie w szablon nie wywraca ekranu na czerwony komunikat bledu. |
| parytet harnessu | 12 | Ekran pokazuje to, co widzi klient — zdjete panele i szerokosci spoza produktu. |
| podglad Idei | 11 | Podglad Idei ma tabele Wlasciwosc/Wartosc; dwie rozjechane kopie scalone w jedna. |
| kafle KPI w ciemnym motywie | 9 | Kafle z liczbami i tabela w dokumencie przelaczaja sie na ciemny motyw. |
| szerokosc tabeli | 7 | Tabela nie jest sztucznie zwezana — ma pelna szerokosc produktu. |
| ustawienia | 3 | Polskie nazwy funkcji integracji zamiast angielskich. |

(Sumy rodzin nie sumuja sie do 92 — jeden ekran bywa dotkniety kilkoma rodzinami naraz.)

## Co ZOSTALO POZA partia — i dlaczego

| co | dlaczego nie idzie do wlasciciela |
| --- | --- |
| 6 kolejek decyzyjnych Mojej Pracy (`*DecisionQueue`, `GateSignoff`, `DefinitionRemediation`) | Naprawa szerokosci kolumn (procenty → piksele) jest w kodzie, ale ZADEN ekran harnessu ich nie montuje. Nie da sie zrobic zrzutu, wiec nie da sie tego pokazac. |
| 4 widoki Wynikow (`KpiQueueView`, `ReconciliationPanel`, `ResultsKpiReportsView`, `ResultsReportingEnterpriseViews`) | To samo: naprawa jest, ekranu w przyrzadzie nie ma. |
| `SystemSettings` (superadmin) | To samo. |
| 8 ekranow Ustawien poza Integracjami i Danymi | Trafienie bylo FALSZYWE: powloka zakladek importuje wszystkie zakladki, ale zmienily sie tylko dwie. Pokazanie osmiu byloby klamstwem o zakresie naprawy. |
| ekrany z ocena C i D | Swiadomie nie sa na stronie odbioru — nic sie tu nie zmienia. |

## Tabela ekran → powod

| modul | ekran | ocena | rodziny |
| --- | --- | :-: | --- |
| 01-czat | `chat-split-teresa-right` | A | menu kanwy · uciecia tekstu |
| 01-czat | `processflow-canvas` | A | menu kanwy · uciecia tekstu · podglad Idei · parytet harnessu |
| 01-czat | `canvas-kebab-restructure` | A | menu kanwy |
| 01-czat | `canvas-new-doc` | A | menu kanwy |
| 01-czat | `canvas-toolbar-md-history` | A | menu kanwy |
| 01-czat | `melscanvas-workspace` | B | menu kanwy · uciecia tekstu · podglad Idei · parytet harnessu |
| 01-czat | `mindmap-canvas` | B | menu kanwy · uciecia tekstu · podglad Idei · parytet harnessu |
| 01-czat | `chat-signals-feed` | B | uciecia tekstu |
| 01-czat | `whiteboard-canvas` | B | menu kanwy · uciecia tekstu · podglad Idei · parytet harnessu |
| 01-czat | `whiteboard-workshop` | B | menu kanwy · uciecia tekstu · podglad Idei · parytet harnessu |
| 01-czat | `teresa-chipy-panel-artefaktu` | A | menu kanwy · uciecia tekstu |
| 01-czat | `teresa-chipy-sugestii` | A | menu kanwy · uciecia tekstu |
| 02-moja-praca | `zwornik-projects` | A | parytet harnessu |
| 02-moja-praca | `idea-table-timeline-stuck` | A | menu kanwy · uciecia tekstu · podglad Idei · parytet harnessu |
| 02-moja-praca | `exec-summary-onelook` | B | liczebniki |
| 02-moja-praca | `mywork-idea-topbar` | B | podglad Idei · parytet harnessu · uciecia tekstu · menu kanwy |
| 02-moja-praca | `idea-table` | B | podglad Idei |
| 02-moja-praca | `mywork-inbox` | B | podglad Idei · parytet harnessu · uciecia tekstu · menu kanwy |
| 02-moja-praca | `mywork-calendar` | B | podglad Idei · parytet harnessu · uciecia tekstu · menu kanwy |
| 03-wywiad | `unified-create-launcher` | A | rodzina czerwieni |
| 07-realizacja | `execution-tab-list` | B | szerokosc tabeli · liczebniki |
| 07-realizacja | `execution-tab-work` | A | szerokosc tabeli · liczebniki |
| 07-realizacja | `execution-tab-resources` | A | szerokosc tabeli · liczebniki |
| 07-realizacja | `execution-tab-control` | A | szerokosc tabeli · liczebniki |
| 07-realizacja | `execution-tab-rollout` | B | szerokosc tabeli · liczebniki |
| 07-realizacja | `execution-tab-summary` | B | szerokosc tabeli · liczebniki |
| 08-wyniki | `results-vnext-legacy-archive` | A | angielskie resztki |
| 08-wyniki | `results-vnext-roi-model` | B | angielskie resztki |
| 08-wyniki | `results-vnext-roi-full-tool` | A | angielskie resztki |
| 08-wyniki | `results-vnext-okr-admin` | A | angielskie resztki |
| 08-wyniki | `results-vnext-roi-registry` | A | angielskie resztki |
| 08-wyniki | `results-vnext-kpi-registry` | B | angielskie resztki |
| 08-wyniki | `results-vnext-roi-pir-outcomes` | A | angielskie resztki |
| 08-wyniki | `results-vnext-search-registry` | A | angielskie resztki |
| 08-wyniki | `results-zestawienia` | A | angielskie resztki |
| 09-finanse | `finance-hub` | A | angielskie resztki |
| 09-finanse | `finance-prediction-workspace` | B | angielskie resztki |
| 10-materialy | `materialy-template-library-slice` | A | awaria Architekta szablonow |
| 10-materialy | `document-studio-resume-error` | A | awaria Architekta szablonow · kafle KPI w ciemnym motywie |
| 10-materialy | `document-studio-template-resolve-error` | A | awaria Architekta szablonow · kafle KPI w ciemnym motywie |
| 10-materialy | `document-artifact` | A | awaria Architekta szablonow · kafle KPI w ciemnym motywie |
| 10-materialy | `b2-template-gallery` | A | menu kanwy · uciecia tekstu · podglad Idei · parytet harnessu |
| 10-materialy | `word-intake-uselm-default` | A | awaria Architekta szablonow |
| 10-materialy | `gen-word-content-hints` | A | awaria Architekta szablonow |
| 10-materialy | `document-studio-context-chip` | A | awaria Architekta szablonow |
| 10-materialy | `document-studio-menu-pliku` | A | awaria Architekta szablonow · kafle KPI w ciemnym motywie |
| 10-materialy | `document-studio-nowy-dokument-martwe-przyciski` | A | awaria Architekta szablonow · kafle KPI w ciemnym motywie |
| 10-materialy | `document-studio-blocks-i18n` | A | kafle KPI w ciemnym motywie · awaria Architekta szablonow |
| 10-materialy | `document-studio-save-as-template` | A | awaria Architekta szablonow · kafle KPI w ciemnym motywie |
| 10-materialy | `materialy-draft-template-visibledraft-fix` | A | awaria Architekta szablonow |
| 10-materialy | `word-quality-badge` | A | awaria Architekta szablonow |
| 10-materialy | `document-studio-streaming-honesty-n3` | B | awaria Architekta szablonow · kafle KPI w ciemnym motywie |
| 10-materialy | `document-studio-ai-teresa` | B | awaria Architekta szablonow · kafle KPI w ciemnym motywie |
| 12-spotkania | `calendar-sync-settings` | A | ustawienia |
| 13-administracja | `admin-command-center-panel` | A | liczebniki · angielskie resztki |
| 13-administracja | `partner-settlements-view` | A | szerokosc tabeli |
| 13-administracja | `admin-command-overview` | A | liczebniki · angielskie resztki |
| 13-administracja | `admin-command-attention-queue` | B | liczebniki · angielskie resztki |
| 13-administracja | `admin-command-cost-capacity` | A | liczebniki · angielskie resztki |
| 13-administracja | `admin-command-organization-defaults` | B | liczebniki · angielskie resztki |
| 13-administracja | `admin-command-agent-trace` | A | liczebniki · angielskie resztki |
| 13-administracja | `admin-command-audit` | A | liczebniki · angielskie resztki |
| 13-administracja | `admin-command-dlp` | B | liczebniki · angielskie resztki |
| 13-administracja | `admin-command-residency` | A | liczebniki · angielskie resztki |
| 13-administracja | `admin-command-retention` | A | liczebniki · angielskie resztki |
| 13-administracja | `admin-command-ai-policy` | A | liczebniki · angielskie resztki |
| 13-administracja | `admin-command-benchmark` | A | liczebniki · angielskie resztki |
| 14-organizacja | `org-identity-operating` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-operating-model` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-position-direction` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-technology-culture-constraints` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-strategic-intent` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-success-metrics` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-scope-boundaries` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-stakeholder-expectations` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-declared-challenges` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-root-causes` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-goal-blockers` | B | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-evidence` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-risks-opportunities` | B | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-scenarios` | B | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-recommendation` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-executive-brief` | B | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-files` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-claims-sources` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-source-conflicts` | A | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-knowledge-graph` | B | angielskie resztki · rodzina czerwieni |
| 14-organizacja | `org-summary` | A | angielskie resztki · rodzina czerwieni |
| 15-agent | `agent-hub` | B | parytet harnessu |
| 16-kanon | `mw-007-calendar-narrow-viewport` | A | uciecia tekstu |
| 18-ustawienia | `ustawienia-integracje` | B | ustawienia |
| 18-ustawienia | `ustawienia-dane-prywatnosc` | B | ustawienia |

### Ekrany logowania — dopisane do rejestru dzisiaj

Szesc ekranow (`auth-login`, `auth-register`, `auth-code-entry`, `auth-forgot-password`, `auth-reset-password`, `auth-verify-email`) ISTNIALO w harnessie od dawna, ale NIGDY nie bylo ich w `status.json` — wiec wlasciciel nie mial ich na stronie odbioru ani razu. Dzisiejsza naprawa (polski jezyk calej rodziny + zdjeta czerwien z linkow) jest pierwsza okazja, zeby je zobaczyl.

## WYNIK OGLEDZIN — co poszlo do wlasciciela, a co wstrzymalem

Kazdy z 196 zrzutow zostal OBEJRZANY (nie zsyntetyzowany z meldunku): 7 robotnikow, jedna rodzina na robotnika, obowiazek jednego konkretnego zdania na zrzut (tytul, liczba wierszy, tresc komorki). Nadzorca obejrzal osobiscie kadr kontrolny (auth-login), chat-signals-feed, idea-table i org-scenarios.

**Zapalone na stronie odbioru: 69 kart** (64 swiecia na zielono; 5 ekranow logowania dostalo decyzje wlasciciela zanim znacznik zdazyl zadzialac).

**WSTRZYMANE: 28 ekranow** — zrzut ujawnil defekt, wiec NIE wystawiam ich do obejrzenia.

| ekran | dlaczego wstrzymany |
| --- | --- |
| `chat-split-teresa-right` | tresc dokumentu w edytorze jest CALA po angielsku (Company Work Note, Context, Working Draft) — to ciag z kodu produkcyjnego, nie dane przyrzadu |
| `canvas-kebab-restructure` | menu jest juz po polsku, ale w pasku stoi UTWORZ W WORKSPACE, a tresc dokumentu jest po angielsku |
| `canvas-new-doc` | menu szablonow po polsku, ale pozycja Zrob research zostala z angielskim slowem; tresc dokumentu po angielsku |
| `canvas-toolbar-md-history` | prawy panel jest pusty — nie widac tego, co ekran ma pokazywac; dodatkowo angielska tresc dokumentu |
| `whiteboard-canvas` | nazwa narzedzia w pasku to Whiteboard, choc slownik ma polskie Tablica; ramka DISCOVERY — WARSZTAT 1 miesza jezyki |
| `whiteboard-workshop` | jak wyzej + ramka PARKING LOT po angielsku |
| `teresa-chipy-panel-artefaktu` | na ciemnym motywie w kadrze stoi komunikat bledu (Nie udalo sie sprawdzic przerwanej odpowiedzi) |
| `teresa-chipy-sugestii` | trzy przyciski na dole sa uciete wielokropkiem (Wygeneruj insighty AI..., Eksportuj insight do in...) |
| `chat-signals-feed` | RODZINA UCIEC NIEDOKONCZONA: kolumna Sygnal ma 140 px i lamie wyrazy w polowie (Interpretac/ja AI, Ostrzezeni/e); poprawka zdjela zapadanie do 10 px, ale nie dala kolumnie uczciwej szerokosci |
| `idea-table-timeline-stuck` | podglad jest w stanie pustym — zrzut nie pokazuje tego, co mial pokazac |
| `execution-tab-work` | RODZINA LICZEBNIKA NIEDOKONCZONA: 1 powiazanych dowodow zamiast 1 powiazany dowod |
| `execution-tab-control` | w panelu POWIAZANIA wycieka slowo undefined zamiast nazwy powiazanego elementu (2 pozycje) |
| `execution-tab-rollout` | brak spacji miedzy liczba a jednostka: 8dni, 12dni, 6dni |
| `execution-tab-summary` | RODZINA LICZEBNIKA NIEDOKONCZONA: 1 pozycji i 1 blokery |
| `admin-command-center-panel` | RODZINA LICZEBNIKA NIEDOKONCZONA: 5 harmonogram(ow) — nawiasowa proteza zamiast odmiany |
| `admin-command-overview` | jak wyzej — 5 harmonogram(ow) |
| `admin-command-ai-policy` | RODZINA LICZEBNIKA NIEDOKONCZONA: skonfigurowano 0 regul(y) |
| `admin-command-audit` | naglowek kolumny uciety w polowie slowa (OPOZNIEN...) |
| `admin-command-retention` | przycisk Wykonaj retencje teraz ma pelne krwistoczerwone tlo, choc to zwykla akcja, nie stan krytyczny; kolumna ucieta (search_index_snap...) |
| `admin-command-agent-trace` | kolumny AKCJA i ROLA AI pokazuja surowe kody (SUGGESTION, AUTO_TAG, consultant-copilot) |
| `admin-command-dlp` | kolumna TYP pokazuje surowe kody regex, keyword, entity |
| `admin-command-benchmark` | karta pokazuje Run oczekuje — angielskie slowo w polskim zdaniu |
| `partner-settlements-view` | kolumna TYP po angielsku (Subscription, One Time); nazwy partnerow lamia sie na 3 linie |
| `agent-hub` | piec naglowkow i piec wartosci statusu uciete wielokropkiem; przycisk Anuluj ma czerwonawe tlo |
| `mw-007-calendar-narrow-viewport` | Wybrany dzien ma 1 pozycji (zla odmiana) oraz podpis wydarzenia Internal po angielsku |
| `results-zestawienia` | w komorce slowo lamie sie w polowie: 3 wskaznik / i |
| `finance-hub` | panel podgladu pokazuje angielskie DRAFT, gdy ten sam rekord w tabeli ma polskie Szkic |
| `ustawienia-dane-prywatnosc` | ikony zwyklych sekcji (Zarzadzanie zgodami, Retencja danych) sa malinowoczerwone, choc nic tam nie wymaga reakcji |

### ★ NAJWAZNIEJSZE ZNALEZISKO DNIA — trzy rodziny sa NIEDOKONCZONE

Ogledziny obalily czesc dzisiejszego meldunku o „jedenastu naprawionych rodzinach". Trzy z nich zyja dalej, kazda w kilku miejscach naraz — to dokladnie REGULA NR 20 (zlecenie obejmuje rodzine, nie punkt):

1. **Liczebnik** — poprawna odmiana dziala tam, gdzie ja podpieto (`1 dzien`, `1 test nieudany`), ale SZESC ekranow nadal pokazuje `1 pozycji`, `1 blokery`, `1 powiazanych dowodow`, `5 harmonogram(ow)`, `0 regul(y)`. Forma `regul(y)` w nawiasie to proteza, ktora ktos wpisal zamiast odmiany — czyli miejsce, o ktorym autor poprawki wiedzial i je pominal.
2. **Uciecia tekstu** — poprawka zdjela zapadanie kolumny do kilkunastu pikseli (procenty juz nie udaja pikseli), ale kolumna dostaje wtedy bezpieczne 140 px, co przy dlugim naglowku NADAL lamie wyraz w polowie (`Interpretac/ja AI`, `3 wskaznik/i`). Naprawiono przyczyne, nie skutek.
3. **Czerwien** — plakietki stanu sa juz neutralne, ale zostaly krwistoczerwone PRZYCISKI akcji (`Wykonaj retencje teraz`, `Anuluj`) i czerwone ikony zwyklych sekcji ustawien. Rodzina objela stany, nie objela przyciskow.

### Dwie uwagi wlasciciela z dzisiaj, ktore ZOSTAJA OTWARTE

W bazie odbioru sa jego wlasne slowa z 12:09 i 12:10. Opisy kart zostaly przepisane, zeby NIE powtarzac odpowiedzi, ktora juz odrzucil:

- `idea-table`: „Tutaj ciagle zobacz Preview nie jest zgodny z wzorem". Dolozylem brakujacy blok Szczegoly i scalilem dwie kopie podgladu — ale nie twierdze, ze to juz caly wzorzec. Karta pyta go wprost, czego brakuje.
- `admin-command-attention-queue`: „to ni jest szerokos strony". Zdjecie ograniczenia z przyrzadu nie zalatwilo sprawy, bo ograniczenie szerokosci ma SAM PRODUKT. To decyzja produktowa, nie usterka — karta pyta go, czy zdjac je w calej Administracji.
