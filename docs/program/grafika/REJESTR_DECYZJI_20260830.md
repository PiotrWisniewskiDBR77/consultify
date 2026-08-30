---
doc_id: rejestr-decyzji-20260830
status: canonical
truth_type: decision-log
established: 2026-08-30
zrodlo: "docs/program/grafika/odbior.sqlite (tabele decyzje/poprawki/historia) + docs/program/KOORDYNACJA.md + docs/program/grafika/KANON_Z_ODBIOROW.md + git log 2026-08-30"
---

# Rejestr decyzji i działań — 30 sierpnia 2026

**Po co ten plik.** Właściciel powiedział dziś dwa razy: *„trwale zapisuj wszystkie
decyzje i działania"*. Tego dnia zapadło ich kilkadziesiąt, rozproszonych po
293 commitach, bazie odbioru (`odbior.sqlite`, 162 decyzje) i plikach koordynacji
dwóch torów. Ten dokument zbiera je w jednym miejscu, żeby następna sesja sięgnęła
po niego zamiast rekonstruować dzień z historii repozytorium.

**Zasada cytowania.** Cytaty właściciela są przepisane dosłownie z bazy odbioru
lub z plików źródłowych, w cudzysłowie. Tam, gdzie nie znalazłem dosłownego
cytatu — piszę to wprost, zamiast go zmyślać.

---

## 1. Decyzje właściciela

| Czego dotyczy | Co zdecydował | Dosłowny cytat | Gdzie zapisany na trwałe |
| --- | --- | --- | --- |
| Wyniki — struktura | **Trzy poziomy, nie dwa**: rejestr zestawień okresowych → tabela zestawu (dodawanie wskaźników, podsumowanie) → karta wskaźnika. | *(paragraf problemu, nie cytat wprost)*: „Klikasz wiersz w tabeli Wyników i od razu otwiera się pojedynczy wskaźnik. Brakuje poziomu pośredniego." | `docs/program/grafika/DECYZJA_WYNIKI_TRZY_POZIOMY.md` |
| Tożsamość wskaźnika | **Jeden wskaźnik, wiele okresów** — OEE z sierpnia i września to ten sam byt, nie dwa. Karta poziomu 3 musi nieść historię przez wszystkie okresy. | brak dosłownego cytatu w bazie; ustalenie zapisane wprost w dokumencie decyzji | `docs/program/grafika/DECYZJA_WYNIKI_TRZY_POZIOMY.md` (rozstrzygnięcie nr 1) |
| OKR — osoba | **Osoba/właściciel celu to KOLUMNA, po której filtrujesz, nie osobny poziom.** OKR ma tę samą konstrukcję trzech poziomów co wskaźniki. | brak dosłownego cytatu w bazie | `docs/program/grafika/DECYZJA_WYNIKI_TRZY_POZIOMY.md` (rozstrzygnięcie nr 3) |
| Podsumowanie w Wynikach | **Podsumowanie stanu tylko na poziomie 2 (tabela zestawu).** Karta pojedynczego wskaźnika otwiera się od razu na detalach, bez własnej strony podsumowania. | brak dosłownego cytatu w bazie | `docs/program/grafika/DECYZJA_WYNIKI_TRZY_POZIOMY.md` (rozstrzygnięcie nr 4) |
| ROI — struktura ekranu | **ROI = jedna karta N**, wzorem inicjatywy — zakładki z dzisiejszego menu poziomego przechodzą do sekcji jednej karty; menu poziome „już się nie wciśnie". | *„ROI to jedna analiza i powinna mieć formułę N-karty (…). To musi być n-karta, gdzie będziemy mieli z nowej strony te zakładki, które teraz masz w menu (…) Każda jedna analiza R[O]I, łącznie z modelem, to jest po prostu jedna karta."* | `odbior.sqlite`, tabela `decyzje`, ekran `results-vnext-roi-full-tool`, 2026-08-30T09:04:05Z; wdrożone tego samego dnia — `docs/program/grafika/historia` ekran `roi-jedna-karta`, 13:56 |
| Prawy panel — jedno źródło kolejności | Trzy panele (notatnik, idee, Excel) trzymały własne kopie listy sekcji; kolejność ma pochodzić z **jednego, kanonicznego źródła**. | *„prawe menu nie działa dobrze, nie jest logiczne, nie zostało przepracowane w poprzedniej rundzie, mimo że prosiłem."* | commit `23bc57aaf3`; SSOT: `src/components/standard/ArtifactRightPanel.tsx:41` (`ARTIFACT_PANEL_SECTION_ORDER`) |
| Prawy panel — notatnik vs idee | Notatnik i idee mają rządzić się **tymi samymi zasadami**, nawet jeśli dziś notatnik wygląda lepiej. | *„te dra[realizacj]e (…) powinny wyglądać tak samo, mieć te same elementy albo prawie zbliżone, ale na pewno rządzić się tymi samymi zasadami."* | `odbior.sqlite`, `decyzje`, ekran `mywork-notebook-rail-speca`, 2026-08-30T09:55:31Z |
| Teresa w prawym panelu | **Teresa jako TRYB szyny narzędzi** (pełna wysokość, przełączana ikoną), nie sekcja akordeonu i nie przycisk-wyjście — wzorzec rozpoznany jako już istniejący w Studiu Dokumentów (Word) i rozciągnięty na resztę. | brak dosłownego cytatu potwierdzającego architekturę wprost; wniosek wyprowadzony z analizy i zatwierdzony wdrożeniem tego samego dnia | `docs/program/grafika/ANALIZA_PRAWY_PANEL.md` §4/§8; wdrożenie za flagą — `historia`, ekran `ideas-teresa-panel`, 14:47: „Teresa WYJĘTA z akordeonu do ikony szyny — to jest ta naprawa, o którą prosiłeś." |
| Kolor — smuga Teresy | **Crimsonowa (czerwona) smuga wokół pola pisania Teresy ZOSTAJE czerwona.** Świadomy, zatwierdzony wyjątek od zasady „crimson tylko dla semantyki krytycznej". | brak dosłownego cytatu w bazie; decyzja opisana wprost w commitcie i kanonie | commit `6b48e34d9c`; `docs/program/grafika/KANON_Z_ODBIOROW.md` (wpis 30.08, `CHAT-OWN-012`, `src/index.css`) |
| Struktura menu | **Ocena i Audyt to DWA OSOBNE MODUŁY** — nigdy nie był to spór merytoryczny, tylko wada sposobu pokazywania (arkusz odbioru ułożony wg torów, nie wg menu). | *„Ocena to jest assessment, mamy cały moduł assessment, a audyt to cały moduł Audyt. Pomieszaliśmy, bo w jednym miejscu pokazywałeś mi ekrany z tych dwóch narzędzi."* | commit `6b48e34d9c`; `docs/program/grafika/KANON_Z_ODBIOROW.md` (wpis 30.08) |
| Kolejność odbioru | **Odbiór modułami w kolejności menu bocznego (16 modułów)**, nie wg torów roboczych — bezpośrednia przyczyna pomieszania Ocena/Audyt. | brak dosłownego cytatu; ustalenie wynika z powyższej decyzji | commit `7675160ba3` „odbiór: arkusz przebudowany na 16 MODUŁÓW w kolejności menu bocznego" |
| Tryb pracy dwóch torów | **Jedna wspólna paczka odbioru** — ekran wchodzi do odbioru dopiero, gdy gotowe są OBIE połowy: wygląd i to, co pod nim działa. | *„może zróbcie wszystko razem z funkcjami, a wtedy ja odbiorę większą paczkę."* | `docs/program/KOORDYNACJA.md`, sekcja „USTALENIE WŁAŚCICIELA: jedna wspólna paczka odbioru, dwa tory" |
| Test agenta | **Zgoda na odblokowanie agenta lokalnie** — na własnej bazie scratch i własnym Redisie, nie na demo/staging, żeby zmierzyć realne wykonanie planu agenta od końca do końca. | brak dosłownego cytatu; zapisane jako fakt zgody | `docs/program/KOORDYNACJA.md`, sekcja „AGENT DZIAŁA — i ma jeden precyzyjny defekt" |
| Priorytety toru funkcji | **Zgoda na dwa dyżury priorytetowe** dla toru funkcji (wskaźnik bez polityki widoczności, cel bez okien check-inu) — ważniejsze niż cokolwiek graficznego. | brak dosłownego cytatu wprost; commit mówi „zlecone przez właściciela wprost" | commit `18ba1bd3cf`; `docs/program/KOORDYNACJA.md`, sekcja „DWA DYŻURY PRIORYTETOWE" |
| Dwa różne „AI" na karcie decyzji | Górny pasek AI (całe narzędzie) i pasek arkusza „Analizuj z AI" (jedna karta) to **dwie różne funkcje** — nie scalać, nie ujednolicać etykiet. | *„mamy w górnym pasku przycisk »AI«, a później w pasku dalszego arkusza mamy »Analizuj z AI«. Pamiętaj, że to są dwie różne funkcjonalności. Górny pasek AI dotyczy wypełnienia całego narzędzia, a dolny pasek dotyczy danej karty."* | `odbior.sqlite`, `decyzje`, ekran `karta-decision`, 2026-08-30T08:21:05Z; `docs/program/grafika/KANON_Z_ODBIOROW.md` |
| Karta wniosku (Insight) | Trzy kolumny środkowego okna zamienić na **trzy duże wiersze z trzema kolorami**, czytane z góry na dół. | *„W oknie centralnym mamy trzy kolumny (…) Zróbmy to w trzech dużych wierszach z trzema kolorami, aby było czytelne od góry do dołu."* | `odbior.sqlite`, `decyzje`/`poprawki`, ekran `karta-insight`, 2026-08-30T08:21:39Z / 09:01:11Z |
| Macierz w Ocenie | Macierz odpowiedzi w asesmencie to **narzędzie interakcji**, nie prezentacja — zamiana na zwykłą tabelę jest niedopuszczalna, jeśli ma ją zastąpić. | *„w asesmencie mamy macierz odpowiedzi i ona jest ważna, bo jest narzędziem, które sprawia, że wchodzimy w interakcję (…) to nie jest tylko prezentacja."* | `odbior.sqlite`, `decyzje`, ekran `assessment-quality-review-panel`, 2026-08-30T10:39:42Z |
| Raport z oceny (DRD) | Raport ma **sformalizowaną strukturę**: wstęp z opisem badania → siedem osi (oś + obszar analityczny) → odpowiedzi i wstępna paleta wniosków → podsumowanie. Audyt ma większą dowolność, ale też ustaloną kolejność wniosków. | *„Audyt i oceny to dwie różne historie. Oceny mają swój framework i raporty (…) musimy zbudować raport o dosyć sformalizowanej strukturze."* | `odbior.sqlite`, `decyzje`, ekran `assessment-output-report`, 2026-08-30T10:32:45Z |
| Arkusz (Excel) | Tabela ma zaczynać się **od samej góry** — małe menu funkcji, potem nazwy kolumn i tabela; dziś jedna trzecia ekranu zużyta niepotrzebnie na panel, który powinien być bocznym, rozwijanym. | *„tabela w Excelu, sama tabela powinna zaczynać się od samej góry (…) Mamy upodobnić się tutaj do narzędzi tabelarycznych, takich jak Excel."* i (powtórzone trzykrotnie w dniu) *„wyrzucamy całą tę zabawę z góry do prawego menu, do prawego panelu i musimy dołożyć u góry listę narzędzi do pracy z tabelą."* | `odbior.sqlite`, `decyzje`, ekrany `sheet-artifact` (10:23:56Z) i `excele-edytowalna-siatka` (11:43:41Z) |

---

## 2. Pomiary, które obaliły przekonania

| Co uważaliśmy | Co się okazało | Czym zmierzone |
| --- | --- | --- |
| Wąskie tabele w harnessie odzwierciedlają produkt | **To było moje własne stanowisko pomiarowe, nie produkt.** Harness renderował tabele węższe niż realny layout aplikacji. | commit `54f450efb8` „tabele: PROSTUJE — wąskie tabele były MOIM stanowiskiem pomiarowym, nie produktem" |
| Wskaźnik, cel i ROI to warianty tej samej mechaniki | To są **trzy różne stany dojrzałości**. ROI: łańcuch przechodzi od końca do końca na serwerze (NPV 130 000 PLN, IRR 9,44%, `inputHash`/`engineVersion`). Wskaźnik: pomiar i automatyczne sprawy odchyleń działają, ale świeża organizacja dostaje `409 NO_ACTIVE_VISIBILITY_POLICY` przy pierwszym wskaźniku — żadna trasa nie publikuje polityki widoczności dla domeny `kpi`. Cel: rollup liczy się sam z kluczowych rezultatów, ale `generateCadenceOccurrencesAndSeedCheckInObligations` (`okrCheckInScheduler.ts:64`) nie ma ani jednego wywołania w uruchomionej aplikacji — check-in jest niewykonalny zwykłą drogą. | `docs/program/KOORDYNACJA.md`, sekcja „POMIAR MECHANIKI: wskaźniki, cele i ROI — trzy różne stany dojrzałości", zmierzone end-to-end na czystej bazie lokalnej |
| Agent tylko udaje pracę / nie da się go sprawdzić bez pełnego wdrożenia | **Agent WYKONUJE realną pracę.** `get_initiative_status` i `calculate_financial` dają prawdziwe wyniki (ROI 35,0% policzone z realnych liczb), `create_task` poprawnie zatrzymuje się na bramce zgody. Defekt jest wąski: klucz idempotencji `route:${planId}` jest identyczny przy pierwszym uruchomieniu i przy wznowieniu po akcepcie, więc wznowienie dostaje `REPLAY`, które API opisuje jako `'enqueued'`, choć do kolejki nic nie trafia — plan zostaje trwale w `awaiting_approval`. | `docs/program/KOORDYNACJA.md`, sekcja „AGENT DZIAŁA — i ma jeden precyzyjny defekt"; `server/src/routes/ai/agent-plan.routes.ts:184-188`, `server/src/services/ai/agentTaskDispatchService.ts:82-84`, odblokowane lokalnie za zgodą właściciela |
| Karta decyzji z zapisem tylko w przeglądarce to tryb awaryjny/rzadki przypadek | **To jest to, co widzi każdy użytkownik dzisiaj.** Realny zamiennik z zapisem na serwer (`DecisionWorkspace.tsx`, backend z 1 sierpnia — 27 tras w `pmo/decisions.routes.ts`) **był podłączony przez dwanaście dni i został po cichu usunięty** przy scaleniu `07bc597420` z 13 sierpnia („feat(integration): fan in and compose Initiatives and Execution"). Nikt nie zauważył, bo flaga była domyślnie wyłączona — usunięcie wpięcia nie zmieniło niczego na ekranie. | `docs/program/KOORDYNACJA.md`, sekcja „ODPOWIEDŹ NA PYTANIE WŁAŚCICIELA: dlaczego karta decyzji nie była podłączona", ze śledzeniem historii repo (`ecc112daa9`, `90c43c4aef`, `51e700c21a` → `07bc597420`) |
| `ENABLE_TERESA_NOTE_CREATE` jest sztandarowym przykładem flagi-fantoma (zero kodu) | **Flaga przestała być fantomem** — ma `notebookService.createNote`, krok potwierdzenia w `creationConfirmation.ts`, jest wymieniona w liście narzędzi Teresy i domyślnie WŁĄCZONA. Kiedyś była fantomem, dziś nie jest — lekcja: fantom bywa czasowy, trzeba mierzyć za każdym razem, nie pamiętać starego przykładu. | commit `9834fe8f9f` „kodeks: sprostowanie przykładu fantomu"; poprawka w `CLAUDE.md` §„ZŁOTE REGUŁY" |
| Migracje szeregują się przez sortowanie nazw plików | Kolejność ustala **`migrationOrdering.ts`**, nie `files.sort()` — bezpiecznik istnieje, ale ma ślepą plamkę inwersji w jednej fazie. | commit `f0339d2eb5` „sprostowanie: kolejność migracji ustala migrationOrdering.ts, nie files.sort()" |
| Istnieje jedna, osłonięta ścieżka zapisu do tabeli `tasks` | Istnieje **druga, nieosłonięta ścieżka** — poprzednia teza nadzorcy była za szeroka. | commit `d330187693` „sprostowanie odbioru 153: istnieje druga, nieosłonięta ścieżka zapisu do tabeli tasks" |
| Ekran, którego nie widać przez `?screen=X`, nie istnieje w produkcie | **Do harnessu prowadzą DWIE drogi** — `?screen=X` i osobne pliki `dev-render/X.html` (18 ekranów). Dwa ekrany SIRI dostały przez to fałszywą ocenę D, sześć ekranów Narzędzi opisano jako „nigdy niepodłączone", choć były osiągalne innymi drzwiami. | `docs/program/grafika/KANON_Z_ODBIOROW.md`, wpis „Do harnessu prowadzą DWIE drogi, nie jedna"; naprawione w `grafika-zrzuty.mjs --wejscie=html` |

---

## 3. Naprawy w warstwie wspólnej

Cztery poprawki, każda w jednym miejscu, każda dotykająca całej aplikacji naraz —
zgodnie z zasadą z `PLAN_PO_ODBIORZE.md`: *„Gdyby te (…) szły jako poprawki per
ekran, byłoby ich kilkadziesiąt i część zostałaby pominięta."*

| Naprawa | Objaw | Plik / linia | Commit |
| --- | --- | --- | --- |
| **Format daty** | Kanoniczny renderer dat w tabeli wywoływał `toLocaleDateString()` **bez locale** — dla dat starszych niż tydzień brał format z przeglądarki. Polski użytkownik na angielskim systemie widział `8/21/2026` obok „3 dni temu" w tej samej kolumnie. | `src/components/shared/ModuleHub/FilterableTable.tsx:932` (`d.toLocaleDateString(localeListy())`); SSOT formatu: `src/utils/listDateFormat.ts` | `5a022a4951` |
| **Polska liczba mnoga** | Klucz „N dni temu" nie miał form liczby mnogiej — `1 dni temu` zamiast `1 dzień temu`. | `public/locales/pl/translation.json:37581-37584` (`daysAgo_one` / `daysAgo_few` / `daysAgo_many`) | `5a022a4951` |
| **Angielskie nagłówki podglądu** | Domyślna etykieta kolumn kanonicznego panelu podglądu była po angielsku (`Property`/`Value`), więc każdy ekran, który nie podał własnej etykiety, pokazywał ją w polskim interfejsie. Wcześniejsza notatka w kodzie spychała naprawę na wywołujących zamiast poprawić wartość domyślną. | `src/components/standard/StandardPreview.tsx:521-524` (`propertyLabel`/`valueLabel` domyślnie `t('standardPreview.property', 'Właściwość')` / `'Wartość'`) | `33f418f2f2` |
| **Jedno źródło kolejności sekcji prawego panelu** | Notatnik, idee i Excel trzymały własne kopie listy sekcji prawego panelu (nazwana stała w jednym, niejawna kolejność literału w dwóch pozostałych) — kopie rozjeżdżały się niezależnie od siebie. | `src/components/standard/ArtifactRightPanel.tsx:41` (`ARTIFACT_PANEL_SECTION_ORDER`); konsumenci: `src/components/MyWork/notebook/NotebookRightRail.tsx`, `src/components/standard/IdeaRightPanel.tsx`, `src/components/AIChat/KimiWorkspace/ExceleRightPanel.tsx` | `23bc57aaf3` — zweryfikowane sześcioma parami zrzutów PRZED/PO w obu motywach jako zmiana bez efektu wizualnego |

---

## 4. Co zostaje otwarte

### Czeka na właściciela

- **Ocena kontra Audyt — zakres merytoryczny.** Prezentacja z oceny została dziś
  odrzucona wprost („musi być opis, muszą być macierze — teraz nie ma macierzy
  nawet"). Wymaga rozstrzygnięcia, zanim ktokolwiek narysuje kolejny ekran.
  (`docs/program/grafika/PLAN_PO_ODBIORZE.md`, FALA 2.3)
- **Teresa jako tryb szyny — trzy pytania architektoniczne**, jeszcze nierozstrzygnięte
  mimo wdrożenia prototypu: (1) czy „Źródła i założenia" mają jawnie pokazywać
  założenia przyjęte przez Teresę — to wymaganie do silnika, nie do panelu;
  (2) czy „Rezultaty" liczą tylko obiekty utworzone z danej notatki, czy też te,
  które ktoś ręcznie z nią powiązał. (`docs/program/grafika/ANALIZA_PRAWY_PANEL.md` §8)
- **Duplikat tabel inicjatyw** — właściciel: *„Nie wiem, czemu to jest inna tabela
  inicjatyw. Powinniśmy mieć JEDNĄ tabelę inicjatyw."* Wymaga decyzji, która wersja
  zostaje. (`docs/program/grafika/PLAN_PO_ODBIORZE.md`, FALA 4)
- **Ekrany pośrednie bez celu** — trzy generatory szablonów odrzucone wprost
  (*„Nie wiem, po co on w ogóle jest"*); docelowy przepływ podany przez właściciela:
  wybór „generuj szablon" → generator → gotowy szablon na liście. Czeka na budowę
  zgodną z tym przepływem. (FALA 2.4)

### Czeka na tor funkcji

- **Dyżur priorytetowy A** — wskaźnik: brak trasy publikującej politykę
  widoczności dla domeny `kpi` (świeża organizacja dostaje `409` na pierwszym
  wskaźniku). Bramka odbioru: pełna ścieżka na czystej bazie, dowód z bazy.
- **Dyżur priorytetowy B** — cel: `generateCadenceOccurrencesAndSeedCheckInObligations`
  nie jest wpięta w cykl życia zestawu celów, więc nikt nie tworzy okien check-inu.
- **`measurement_frequency_days`** — kolumna istnieje w bazie i jest czytana, ale
  nie występuje w żadnym schemacie zapisu (`CreateKpiDraftSchema`, `EditKpiDraftSchema`)
  — zawsze zostanie pusta.
- **Karta decyzji — kategoria i plan awaryjny ryzyka** nie mają kolumny w bazie
  (`decision_risks`, migracja `932_decision_workflow_canonical.sql`) — pola w UI
  resetują się po odświeżeniu.
- **Karta decyzji — przypomnienia, reguły eskalacji, powiązane elementy, notatki
  kontekstowe** nadal wyłącznie w pamięci przeglądarki, pod kluczem niezawężonym
  do użytkownika ani organizacji.
- **Karta decyzji — RACI (stakeholders)** ma wyłącznie odczyt, zero ścieżki zapisu.
- **Karta zadania — cztery sekcje bez ścieżki odczytu** (Pomysły realizacji, Ryzyka
  i alternatywy, Dowody) — `personalPayload` w `TaskDetailView.tsx:1231-1250` ich
  nie zawiera; RACI trafia do `localStorage`, który nigdy nie jest odczytywany.
  To jest FALA 0 planu — utrata pracy użytkownika, przed wszystkim innym.
- **Agent — klucz idempotencji** `route:${planId}` musi rozróżniać uruchomienie
  od wznowienia (np. dopisanie indeksu kroku), a `REPLAY` nie powinien być
  raportowany jako `'enqueued'`.
- **Waluta w kontraktach danych Finansów** — `ValuationResultsDto` i propsy paneli
  wartości nie niosą pola waluty; trzy ekrany Finansów pokazują kwoty bez waluty.
- **Jednostka wskaźnika w Analizie** — brak metadanych jednostki (0,12 zamiast 12%).
- **Nazwy wskaźników i osób** — `KpiScorecardItemDto` niesie wyłącznie `kpiId`,
  kolumna renderuje skrócony identyfikator zamiast nazwy.
- **Prawy panel dokumentów (Word/Excel/PowerPoint)** — pochodzenie dokumentu,
  rezultaty dokumentu i kontrola jakości (`qa`) poza Wordem: kontrakty danych,
  które muszą istnieć, zanim panel będzie miał co pokazać.
  (`docs/program/grafika/ANALIZA_PRAWY_PANEL.md`, uzupełnienie o dokumentach)
- **Inicjatywa — brak przycisku głównego** (`statusActions` twardo `[]`,
  `InitiativeDocumentView.tsx`, `DEC-104`) — ścieżka zapisu statusu rzuca wyjątkiem
  dla każdego statusu docelowego.
- **Pasek narzędzi edycji arkusza i prezentacji** — dziś to ekrany do oglądania,
  nie do pracy (zgłoszone przy pięciu ekranach niezależnie). (FALA 3)
- **Harness bez atrapy wywołania Bazy porównania** — ekran zawsze wpada w błąd.

### Czeka na tor grafiki

- **Tabela na pełną szerokość / wiersz w jednej linii** — zgłoszone przy ośmiu
  ekranach; dwie różne przyczyny (twardy `max-w-6xl` na raporcie DRD; ~300 px
  traconych na marginesach gdzie indziej). (FALA 1.1)
- **Jeden ujednolicony podgląd** — kanon istnieje (`consultify-preview`), nie jest
  stosowany; właściciel: *„to jest wartościowy obrazek, bo pokazuje, jak
  nieporównywalne są podglądy, które powinny być takie same."* (FALA 1.2)
- **Krok 2/3/4 prawego panelu** — rozstrzygnięcie o Teresie (patrz „czeka na
  właściciela"), pełne siedem sekcji dla notatki i idei, siedem szyn poza kanonem
  (po jednej, każda z osobnym odbiorem — zakaz włączania wielu naraz).
- **Kanon dat napisany i nieużyty** — `src/utils/listDateFormat.ts` istnieje od
  27.07, ale tylko 21 plików go używa; 198 go omijają (254 wywołania bez jawnego
  locale). To osobny dyżur z listą plików i odbiorem, nie poprawka przy okazji.
- **Procent czytany jako piksel** — `parsePx('26%')` w
  `src/components/shared/ModuleHub/FilterableTable.tsx:643` ucina do liczb i
  zwraca `26`, więc kolumna dostaje `26px` zamiast 26% szerokości. Naprawione na
  jednym zmierzonym ekranie (`fab-rail-kebab`); sześć plików `MyWork/*Queue.tsx`
  ma identyczny wzorzec, ale **żaden nie został wyrenderowany** — twierdzenie
  o nich jest wnioskiem z kodu, nie pomiarem.
- **„Zadanie ukończone 0/8"** — `src/components/AIChat/KimiWorkspace/ExceleView.tsx:312`,
  `effectiveCompleted` czyta inny stan niż licznik kroków; zielony ptaszek obok zera.
- **Fala 5 — polerowanie stylu** (9 ekranów): przyciski-słowa zamiast okrągłych
  przycisków w wycenie, stany błędu do wyśrodkowania, kontrolka potwierdzenia
  Teresy „za duża i toporna", chipy podpowiedzi, ikony warsztatu agenta startujące
  rozwinięte zamiast zwiniętych, synchronizacja Outlook, launcher materiałów.
- **Fala 4 — narzędzie odbioru odsiewa po nazwie ekranu, nie po komponencie** —
  własny błąd narzędziowy nadzorcy: kilka ekranów harnessu montuje ten sam
  komponent produkcyjny, więc właściciel oceniał to samo po kilka razy
  (*„Trzeci raz dajesz mi tę kartę do akceptacji."*).

---

## 5. Lekcje metodyczne

**Stanowisko pomiarowe kłamało wielokrotnie — nie raz.**
- Ekran za flagą trzeba mierzyć **Z** flagą: robotnik ocenił „Tożsamość i model
  działania" bez `ff_org_redesign_v1=1` i zobaczył starą powierzchnię, bo narzędzie
  zrzutów nie miało jak przekazać parametru adresu. Naprawione w
  `grafika-zrzuty.mjs --parametry=`. (`KANON_Z_ODBIOROW.md`)
- Do harnessu prowadzą dwie drogi (`?screen=X` i osobne pliki `dev-render/X.html`);
  narzędzie odpowiadało listą awaryjną, która wygląda dokładnie jak „ekran się nie
  renderuje" — dwa ekrany SIRI dostały przez to fałszywą ocenę D. (`KANON_Z_ODBIOROW.md`)
- Ruchoma ozdoba CSS (`.chat-composer-idle-pulse::before`) wyglądała na zrzucie jak
  defekt renderowania, bo zmienia pozycję między zrzutami — dwóch niezależnych
  robotników zgłosiło ją jako błąd. (`KANON_Z_ODBIOROW.md`)
- Własna lista odchyleń nadzorcy zawierała **5 defektów z 9, które nie były
  defektami** — trzy okazały się świadomymi decyzjami właściciela z lipca zapisanymi
  w komentarzach kodu, jeden artefaktem samego harnessu, jeden pomyłką kliknięcia.
  Reguła zapisana: „odchylenie od wzorca nie jest defektem, dopóki nie sprawdzę,
  czy nie jest decyzją." (commit `571f0dfaa7`)

**Szerokie dodawanie plików do commitów zagarniało pracę robotników i raz zepsuło
harness.** Ta lekcja została przekazana nadzorcy zlecającemu ten rejestr jako fakt
dnia; nie znalazłem w repozytorium pojedynczego commitu, którego treść i diff
jednoznacznie dokumentują ten konkretny incydent z plikiem i linią — patrz sekcja
6 poniżej. Osobny, potwierdzony incydent tej samej klasy: trzy ekrany harnessu
wskazywały na komponenty świadomie usunięte z produktu, ich błąd kompilacji
wyciekał na wspólny serwer deweloperski i zaśmiecał zrzuty niepowiązanych ekranów,
zaobserwowane w dwóch niezależnych torach naraz (commit `9a4c3286f6`).

**Fragment kodu wycięty z dwóch stron to nie jest dowód — sprawdzam sam, zanim
wejdzie do rejestru.** Robotnik zgłosił „potwierdzony błąd": pola `hypothesisDraft`
i `lessonsDraft` w `InitiativeDocumentView.tsx` rzekomo nigdy się nie hydratują
z rekordu. To była nieprawda — efekt hydratujący istnieje dokładnie między liniami,
które robotnik zacytował jako dowód braku (`InitiativeDocumentView.tsx:1573-1578`).
Pole zawierało wstrzykniętą treść, tylko w trybie tylko-do-odczytu, bo karta stała
w Podglądzie. (`docs/program/KOORDYNACJA.md`, „SPROSTOWANIE własnego zgłoszenia:
hipoteza inicjatywy DZIAŁA")

**„200 znaczy nic" — status HTTP poprawny nie dowodzi, że coś się wykonało.**
Uruchomienie planu agenta odpowiada `HTTP 200` z treścią `"dispatch":"unavailable"`,
a stan bazy po tym wywołaniu jest identyczny jak przed nim. Ten sam kształt
powtórzył się przy wznowieniu planu po akcepcie kroku: API zwraca `'enqueued'`,
a do kolejki nic nie trafia (`REPLAY` bez wstawienia zadania). Reguła zapisana
w kryteriach odbioru: bramka wymaga dowodu **z bazy**, nie statusu HTTP.
(`docs/program/KOORDYNACJA.md`)

**Fantom bywa czasowy — reguła brzmi „zmierz za każdym razem", nie „pamiętaj,
która flaga była pusta".** `ENABLE_TERESA_NOTE_CREATE` był sztandarowym przykładem
fantomu w `CLAUDE.md`; dziś zmierzony ma pełną implementację i jest domyślnie
włączony. Zapamiętany przykład sam stał się nieaktualną prawdą — poprawione
w `CLAUDE.md` §„ZŁOTE REGUŁY" (commit `9834fe8f9f`).

**Nadzorca decyduje sam we wszystkim technicznym — właściciela pyta się wyłącznie
o to, co widać na ekranie, i o decyzje biznesowe.** Zapisane jako REGUŁA NR 0,
słowami właściciela: *„Pytaj mnie o to, co masz mnie pytać, bo nie rozumiem, o co
teraz chodzi. Tego mniej decydujmy."* (`docs/program/grafika/00_ZASADY_PRACY.md`)

**Kanon rośnie z odbiorów, żeby nie pytać właściciela dwa razy o to samo.** Każda
decyzja właściciela, która wykracza poza opisany standard, ląduje jako jedna linia
w `KANON_Z_ODBIOROW.md` — data, reguła, ekran-źródło, tego samego dnia, nie na
koniec. (`docs/program/grafika/00_ZASADY_PRACY.md`, REGUŁA NR 4 i NR 6)

**Martwe odkładamy, nie kasujemy** — słowami właściciela: *„nie chcemy stracić
czegoś, co może mieć wartość."* Stąd katalog `ODLOZONE.md` z trzema obowiązkowymi
polami (dlaczego martwy, co niósł wartościowego, jak przywrócić) zamiast kasowania
kodu. (`docs/program/grafika/00_ZASADY_PRACY.md`, REGUŁA NR 5; `ODLOZONE.md`)

---

## 6. Czego NIE udało mi się ustalić

- **Drugi udokumentowany przypadek „potwierdzonego błędu robotnika, którego nie
  było".** Znalazłem jeden jednoznaczny, w pełni udokumentowany przypadek —
  hipoteza `InitiativeDocumentView` opisana w sekcji 5. Przeszukałem
  `docs/program/KOORDYNACJA.md`, pliki toru grafiki i historię git z dzisiaj
  frazami „nieprawda", „fałszyw", „sprostowanie", „obalon" — nie znalazłem
  drugiego przypadku spełniającego dokładnie ten wzorzec (raport ROBOTNIKA,
  nie nadzorcy, z fałszywym „potwierdzonym błędem"). Najbliższy kandydat to
  własna korekta nadzorcy (`571f0dfaa7`, „5 z 9 nie było defektami"), ale to jest
  nadzorca korygujący samego siebie, nie robotnika — zacytowałem to osobno
  w sekcji 5 zamiast podciągać pod ten sam punkt.
- **Konkretny commit/plik/linia dla „szerokiego dodawania plików do commitów,
  które zagarnęło pracę robotników i raz zepsuło harness".** Otrzymałem to jako
  ustalony fakt dnia od zlecającego ten rejestr, ale nie znalazłem w repozytorium
  pojedynczego commitu, który tę konkretną sekwencję (szerokie `git add` →
  przejęcie cudzych zmian → uszkodzenie harnessu) dokumentuje z nazwą pliku
  i linią. Zapisałem to w sekcji 5 jako przekazany fakt, nie jako coś, co sam
  zweryfikowałem w kodzie — i podałem obok niego jeden inny, w pełni potwierdzony
  incydent uszkodzenia harnessu tej samej klasy (`9a4c3286f6`).
- **Czy karta decyzji (`karta-decision`) w bazie odbioru ma dosłowny cytat
  potwierdzający architekturę „Teresa jako tryb szyny" jako wypowiedziane zdanie
  właściciela.** Baza `decyzje` kończy się o 11:50, a wdrożenie Teresy jako trybu
  szyny nastąpiło o 14:47 — poza oknem sesji odbioru zapisanej w SQLite. Oparłem
  wpis na `ANALIZA_PRAWY_PANEL.md` (wniosek architektoniczny nadzorcy) i na notce
  z commita historii („to jest ta naprawa, o którą prosiłeś"), zaznaczając brak
  dosłownego cytatu wprost w tabeli powyżej.
- **Pełna treść wszystkich 293 commitów z dzisiaj.** Przejrzałem log w całości
  (nazwy commitów) i otworzyłem diff/treść dla commitów istotnych dla wymaganej
  struktury dokumentu. Commity toru funkcji dotyczące szczegółów pojedynczych
  dyżurów (np. 130-169) nie zostały indywidualnie zweryfikowane co do treści —
  tam, gdzie się pojawiają w tym rejestrze, pochodzą z `KOORDYNACJA.md`, która sama
  jest zapisem z bezpośredniej weryfikacji nadzorcy tamtego dnia, nie z mojego
  własnego czytania kodu tych dyżurów.


---

## Uzupełnienie nadzorcy — luka nr 2 z sekcji „Czego NIE udało mi się ustalić"

Robotnik nie znalazł commitu dokumentującego, że szerokie dodawanie plików
zagarnęło pracę robotników. **Znalazłem go i zapisuję, bo to mój błąd i ma zostać
w rejestrze.**

**Commit `f8e3ff0744`** („Wyniki: wskaznik i cel dostaly te sama formule co ROI").
Dodałem do niego `dev-render/main.tsx` z **trzydziestoma trzema liniami**, w tym
rejestracją ekranu `prawy-pas-notatnik-system` — **należącą do zupełnie innego
robotnika**, który jeszcze pracował. Sam plik ekranu **nie wszedł do commitu**
(sprawdzone: `git show --name-only f8e3ff0744` nie zawiera go wcale).

**Skutek:** w gałęzi został wiszący import do nieistniejącego pliku. Na czystym
pobraniu repozytorium **wywalało to cały harness dev-render** — czyli jedyne
narzędzie, którym pokazujemy właścicielowi ekrany. U mnie działało, bo plik leżał
na dysku jako nieśledzony. **Defekt niewidoczny dokładnie dla tej osoby, która go
wprowadziła.**

Naprawione commitem, który dołożył brakujące pliki. Harness sprawdzony
odpowiedzią serwera, nie założeniem.

**Przyczyna:** dodawałem do commitów **całe katalogi** (`git add -A src/`,
`git add dev-render/`) zamiast konkretnych plików. Przy pięciu robotnikach
pracujących równolegle w jednym katalogu roboczym to zagarnia cudzą pracę w locie
— w tym pracę niedokończoną.

**Dwóch robotników zgłosiło mi to w swoich raportach, zanim wykryłem skutek.
Przeczytałem oba i potraktowałem jako szum organizacyjny.** To jest druga część
tego błędu i gorsza niż pierwsza: ostrzeżenie przyszło i zostało zignorowane.

**Reguła na przyszłość:** przy równoległych robotnikach w jednym katalogu do
commitu wchodzą **wyłącznie pliki wymienione z nazwy**. Nigdy `-A`, nigdy katalog.
