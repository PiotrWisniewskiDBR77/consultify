# ★★★ ARTEFAKTY — INSTRUKCJE TREŚCI KART (McKinsey-grade) — v1.0 (2026-07-05)
> ŻELAZNY WYMÓG wypełniania każdej karty — dla człowieka i dla AI. Gdy użytkownik wywoła „wypisz karty",
> silnik generuje każdą kartę WEDŁUG TEGO DOKUMENTU. Jakość tych instrukcji = jakość Consultify jako konsultanta.
>
> Ten dokument opisuje TREŚĆ kart (co ma być w środku i kiedy jest dobre). Struktura UI kart = `_ARTEFAKTY_KARTY_KATALOG.md`.
> Doktryna jakości nadrzędna = `docs/standards/CARD_CONTENT_FORMULA.md` (walidatory B3, recenzja adversarialna B4, próg ≥90/100).
> Doktryna inicjatywy = `docs/initiatives/INITIATIVE_FORMULA.md` (MECE · charter+WBS · Kaplan–Norton · baseline→target · falsyfikowalna teza).
> Prompty w silniku = `initiative_section_types.ai_prompt_template` (migracje 530/542) — TEN dokument jest ich źródłem; przy rozjeździe wygrywa ten dokument.

---

# 0. KONTRAKT WSPÓLNY — obowiązuje KAŻDĄ generację karty

## 0.1 Reguły bezwzględne (skrót z CARD_CONTENT_FORMULA — nie powtarzamy ich w kartach)
1. **Język polski** (poza słownikiem §A5: RACI, RAID, KPI, CAPEX, OPEX, ROI, MECE, nazwy własne).
2. **Answer-first (Minto):** pierwsze zdanie niesie konkluzję.
3. **Ugruntowanie:** każda teza ma dowód (sesja/dokument/dane/H#); bez dowodu → jawna hipoteza z poziomem pewności.
4. **Kwantyfikacja z jawnym założeniem:** liczba + skąd + horyzont. Brak danych → **„do ustalenia (N…)" + jak ustalimy**. NIGDY nie zmyślamy liczb.
5. **MECE** wobec siatki istniejących inicjatyw/kart.
6. **Zakaz wypełniaczy:** ogólnik udający treść = rubryka niezaliczona. Pusta rubryka warunkowa → `— Pominięto: <powód>`.
7. **Bramka jakości:** każda wygenerowana karta przechodzi walidatory B3 + recenzję adversarialną B6; PASS ≥ 90/100; recenzent szuka powodów do FAIL.

## 0.2 Wymagane WEJŚCIA przed generacją (B2 — bez kompletu generacja się nie zaczyna)
1. **Dowody/lineage:** źródło karty (wniosek, sesje, dokumenty, dane) — skąd wiemy.
2. **Kontekst organizacji:** branża, value-drivery, cele strategiczne, ograniczenia, słownik klienta.
3. **Stan artefaktu + karty wcześniejsze w łańcuchu (0.3):** karta nie powstaje w próżni — czyta karty, od których zależy.
4. **Siatka istniejących inicjatyw** (MECE-check przy scope/zależnościach).

## 0.3 KOLEJNOŚĆ GENERACJI — łańcuch myślenia konsultanta (przy „wypisz karty")
Karty karmią się nawzajem. Generujemy w kolejności logiki wywodu, nie kolejności menu:
```
1. Definicja problemu        (dlaczego cokolwiek robimy)
2. Stan docelowy i kryteria  (jak wygląda świat po — teza)
3. Zakres i kill criteria    (granice i warunki stopu)
4. KPI i korzyści            (czym mierzymy sukces)
5. Analiza finansowa         (czy warto — CAPEX/OPEX/ROI)
6. Wpływ finansowy           (gdzie i kiedy pojawia się wartość)
7. Zadania i kamienie mil.   (jak dochodzimy — WBS)
8. Zasoby + Zespół + Kompet. (czym dochodzimy)
9. RAID + Zależności         (co może pójść źle)
10. Interesariusze/RACI       (kto niesie, kto może zabić)
11. Harmonogram               (kontrakt czasu)
12. Bramki + Decyzje(backlog) (governance i decyzje zawczasu)
13. Pilot (jeśli dotyczy)     (eksperyment przed skalą)
14. OPIS INICJATYWY — NA KOŃCU (synteza wszystkiego, answer-first)
```
Regeneracja jednej karty w środku łańcucha → recenzent sprawdza spójność z kartami zależnymi (0.4).

## 0.4 SPÓJNOŚĆ KRZYŻOWA (twardy wymóg; recenzent sprawdza PARAMI)
| Para kart | Warunek spójności |
|---|---|
| Kryteria sukcesu ↔ KPI | każde kryterium mierzalne ma odbicie w KPI lub jawny powód braku |
| Analiza finansowa ↔ Zasoby | CAPEX/OPEX = suma budżetu zasobów (lub jawnie wyjaśniona różnica) |
| Wpływ finansowy ↔ KPI | korzyść = delta KPI × wartość jednostkowa (pokazana logika) |
| Zakres-out ↔ siatka inicjatyw | każdy istotny out wskazuje, GDZIE ta praca żyje |
| Zadania ↔ Rezultaty (deliverables) | każdy deliverable ma ≥1 zadanie; zadania-sieroty = FAIL |
| Kamienie ↔ Harmonogram ↔ Bramki | te same daty/fazy; bramka spina fazę |
| RAID-dependency ↔ Zależności | zależność zewnętrzna występuje w OBU (typ DEPENDENCY) |
| Kompetencje ↔ Zadania | wymóg kompetencji uzasadniony konkretnym zadaniem/deliverable |
Sprzeczność między kartami = FAIL całego zestawu, nie jednej karty.

## 0.5 FORMAT instrukcji karty (poniżej, każda karta)
**CEL** (jaką decyzję/wartość obsługuje) · **CO MA ZAWIERAĆ** (myślenie, nie rubryki) · **DoD** (kiedy zaliczona) · **ANTY-WZORCE** (automatyczny FAIL) · **PROMPT AI** (delta — zakłada kontrakt §0).

## 0.6 Karty techniczne (Komentarze, Aktywność, Załączniki, Tagi, Przypomnienia, Panel sterowania)
Nie mają treści generowanej przez AI — mają REGUŁY HIGIENY (krótkie noty niżej). AI może wspierać (np. poprawa klarowności komentarza), nigdy nie tworzy zapisu za człowieka.

---

# 1. KARTY UNIWERSALNE (Initiative · Task · Decision — jedna instrukcja, jeden docelowy komponent)

## 1.1 RYZYKO / RAID (Initiative: „Rejestr RAID" · Task: „Risk & Alternatives" · Decision: „Risk & Impact")
**CEL.** Zawczasu nazywa, co może zabić lub wykoleić pracę — i co z tym PRE-emptywnie robimy. Karta odróżnia dojrzały plan od listy życzeń.
**CO MA ZAWIERAĆ.**
- **Rozróżnienie typów (dyscyplina pojęciowa):** Risk = przyszłe niepewne zdarzenie · Assumption = przyjęte za prawdę, falsyfikowalne, z planem walidacji · Issue = problem JUŻ istniejący (nie „ryzyko") · Dependency = zewnętrzny warunek z właścicielem po obu stronach.
- **Każdy Risk:** konkretne zdarzenie (co, gdzie, kiedy może zajść) · probability × impact (skala) · **response strategy** (avoid/mitigate/transfer/accept) · **mitigation = działanie z ownerem i terminem** (obniża prawdopodobieństwo) · **contingency = plan B** gdy się zmaterializuje · trigger/sygnał wczesny.
- **Miks minimalny (inicjatywa):** ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY.
- **Priorytetyzacja:** top-ryzyka na górze (P×I), nie chronologicznie.
**DoD.** Miks typów spełniony · każdy wpis ma P/I/strategię/mitygację-z-ownerem · assumptions mają plan walidacji · zero „ryzyk", które są issue.
**ANTY-WZORCE.** „Opór organizacji" bez P/I/mitygacji · mitygacja = „będziemy monitorować" · ryzyko-tautologia („projekt może się opóźnić") · brak ownera działania.
**PROMPT AI.** Kontrakt §0. Na podstawie {{karta problemu, zakres, plan, zależności, kontekst org}} wygeneruj rejestr RAID: [{type: RISK|ASSUMPTION|ISSUE|DEPENDENCY, title(zdarzenie konkretne), probability, impact, responseStrategy, mitigation{action, owner, due}, contingency, earlySignal}]. Wymuś miks ≥2R+1A+1D. Każdy risk = zdarzenie, nie stan. Posortuj po P×I.

## 1.2 RACI I ESKALACJA (Initiative: „Interesariusze/RACI" · Task/Decision: „RACI & Escalation")
**CEL.** Ustala prawa decyzyjne i drogę eskalacji ZANIM będą potrzebne. Zła RACI = paraliż decyzyjny albo decyzje niczyje.
**CO MA ZAWIERAĆ.**
- **Dokładnie JEDEN Accountable** na obiekt (żelazna zasada — 2×A = 0×A).
- **R = wykonawca z imienia** (osoba robiąca robotę, nie komitet i nie stanowisko).
- **C minimalne** (każdy Consulted to koszt czasu — ma być uzasadniony), **I szerokie** (informowanie jest tanie).
- **Eskalacja jako reguła, nie intencja:** warunek (np. „blokada > 3 dni robocze" / „impact HIGH") → do kogo → po jakim czasie → jakim kanałem.
- **(Initiative — delta interesariuszy):** mapa **władza × zainteresowanie** i strategia per ćwiartka (prowadź blisko / trzymaj zadowolonych / informuj / monitoruj); oporni nazwani z planem pozyskania.
**DoD.** 1×A, ≥1×R z imienia, C uzasadnione · ≥1 reguła eskalacji z progiem liczbowym · (Init) każdy kluczowy stakeholder ma strategię.
**ANTY-WZORCE.** Wielu Accountable · „wszyscy C" · RACI jako lista grzecznościowa · eskalacja „w razie potrzeby" bez progu.
**PROMPT AI.** Kontrakt §0. Dla {{obiekt, zespół, sponsor, kontekst org}} zaproponuj macierz RACI [{person, role: R|A|C|I, uzasadnienie-C}] z DOKŁADNIE jednym A, oraz reguły eskalacji [{condition(z progiem), escalateTo, afterDays, channel}]. (Init) dodaj mapę władza×zainteresowanie + strategię per stakeholder. Zwróć też listę konfliktów (np. A bez władzy budżetowej).

## 1.3 ZALEŻNOŚCI (Dependencies)
**CEL.** Ujawnia, od czego naprawdę zależy termin — zależność to przeniesione ryzyko i ukryta ścieżka krytyczna.
**CO MA ZAWIERAĆ.** Powiązania typowane (FS/SS/FF/SF) z lagiem w dniach · dla zależności MIĘDZY inicjatywami/zespołami: właściciel po OBU stronach + potwierdzenie drugiej strony · zależności zewnętrzne (dostawca, decyzja, dane) trafiają TEŻ do RAID jako DEPENDENCY · wskazanie, które zależności leżą na ścieżce krytycznej.
**DoD.** Każda zależność ma typ+lag · zewnętrzne mają obustronnych właścicieli · spójność z RAID (0.4).
**ANTY-WZORCE.** „Zależy od IT" bez osoby i terminu · zależność odkryta w dniu blokady · brak rozróżnienia twarda/miękka.
**PROMPT AI.** Kontrakt §0. Z {{plan zadań/kamieni, siatka inicjatyw, kontekst}} wyprowadź zależności [{from, to, type: FS|SS|FF|SF, lagDays, external: bool, ownerHere, ownerThere, critical: bool, note}]. Zewnętrzne oznacz do lustrzanego wpisu RAID.

## 1.4 KOMENTARZE — karta techniczna (higiena)
Komentarz niesie **decyzję, akcję albo pytanie** (nie „ok") · priorytet L/N/H świadomie · wątek kończy się konkluzją lub akcją (kto-co-kiedy) · AI-enhance tylko poprawia klarowność wpisu użytkownika — nie tworzy komentarzy samo.

## 1.5 ZAŁĄCZNIKI I POWIĄZANIA — karta techniczna (higiena)
Każdy załącznik ma ROLĘ: dowód / deliverable / referencja · nazewnictwo `RRRR-MM-DD_typ_nazwa` · link = lineage (źródło→karta→wynik), utrzymywany żywy · martwe linki się czyści, nie zostawia.

## 1.6 AKTYWNOŚĆ / HISTORIA — karta systemowa
Read-only, generowana przez system (zdarzenia old→new, kto, kiedy). Zero treści AI. Jakość = kompletność zapisu zdarzeń.

---

# 2. INITIATIVE — karty specyficzne

## 2.1 OPIS INICJATYWY (overview) — ⚠ generowany NA KOŃCU (synteza)
**CEL.** 30-sekundowy brief dla zarządu: przeczytawszy tylko to, członek zarządu wie CO, PO CO, ZA ILE i KIEDY. To synteza pozostałych kart — nie osobna twórczość.
**CO MA ZAWIERAĆ.**
- **Zdanie 1 = konkluzja** (co robimy i jaki efekt): „Skracamy lead-time uruchomień z 23 do ≤5 dni, odblokowując ~3-6,5 mln zł/rok sprzedaży."
- **Problem i wartość** z liczbą (z kart: problem, sizing).
- **Podejście i horyzont** (fazy, pierwszy efekt kiedy).
- **Status quo-vadis** (gdzie jesteśmy, najbliższa bramka/decyzja).
**DoD.** 40–90 słów rdzenia (do 150 z rozwinięciem) · answer-first · ≥1 liczba wartości · ZERO sprzeczności z pozostałymi kartami (0.4) · regenerowany po istotnej zmianie kart źródłowych.
**ANTY-WZORCE.** Narracja procesowa („odbyliśmy warsztaty…") · powtórzenie tytułu innymi słowami · obietnice bez liczb · treść, której nie ma w kartach źródłowych.
**PROMPT AI.** Kontrakt §0. NA WEJŚCIU pełny stan kart {{problem, target, KPI, sizing, fazy, status, bramka}}. Zsyntetyzuj executive summary (2-3 akapity, rdzeń 40-90 słów): konkluzja → problem+wartość(liczba) → podejście+horyzont → status+następny krok. Wyłącznie z treści kart — niczego nie dodawaj.

## 2.2 DEFINICJA PROBLEMU (problemDefinition)
**CEL.** Ustala falsyfikowalny, ugruntowany problem — fundament business case. Bez ostrego problemu inicjatywa jest rozwiązaniem szukającym problemu.
**CO MA ZAWIERAĆ.**
- **Symptom** — obserwowalny i mierzalny objaw z liczbą/benchmarkiem: „mediana lead-time uruchomień = 23 dni vs. benchmark 5" — nie „obsługa jest wolna".
- **Przyczyna źródłowa** — wynik root-cause (5×why / Ishikawa): MECHANIZM, nie skutek; powiązana z dowodem (sesja/dane/H#). Test: „gdyby usunąć tę przyczynę, symptom znika?"
- **Koszt zaniechania** — skwantyfikowany skutek NIC-nierobienia (zł/%/dni/utracone szanse) z jawnym założeniem: „~3-6,5 mln zł/rok (założenie: 5-10% sprzedaży blokowane przez wąskie gardło)".
**DoD.** 3 pola wypełnione, answer-first, całość 120–250 słów · przyczyna źródłowa ≥1 dowód · koszt skwantyfikowany LUB „do ustalenia (N…) + jak ustalimy".
**ANTY-WZORCE.** Symptom-frazes bez liczby · przyczyna = przeformułowany symptom · koszt „stracimy dużo" · problem opisany językiem rozwiązania („brak systemu X" — to nie problem, to brak konkretnego narzędzia).
**PROMPT AI.** Kontrakt §0. Z {{kontekst, dowody}} wygeneruj {symptom, rootCause, costOfInaction}. Symptom: obserwowalny+mierzalny (liczba/benchmark). rootCause: mechanizm z dowodem; wykonaj test usunięcia przyczyny. costOfInaction: kwota/%/dni z JAWNYM założeniem. Po 2-3 zdania.

## 2.3 STAN DOCELOWY I KRYTERIA SUKCESU (targetState)
**CEL.** Definiuje „nową normalność" — obserwowalny stan końcowy i warunki zaliczenia. To falsyfikowalna obietnica inicjatywy (INITIATIVE_FORMULA: „Jeśli X, to Y mierzalne, bo Z").
**CO MA ZAWIERAĆ.**
- **Opis stanu docelowego w czasie TERAŹNIEJSZYM,** jakby już istniał: „każde zgłoszenie wchodzi w mierzony przepływ; mediana ≤5 dni; eskalacje automatyczne" — obraz świata, NIE lista działań.
- **Kryteria sukcesu ≥4** — mierzalne/obserwowalne WARUNKI ZALICZENIA (binarne na koniec), spójne z KPI (kryterium = próg zaliczenia; KPI = miara ciągła, 0.4).
- **Deliverables ≥4** — RZECZOWNIKOWE artefakty/produkty (proces wdrożony, raport, narzędzie, przeszkolony zespół), nie czynności.
- **Jawne odróżnienie outcome od output:** deliverable ≠ sukces; sukces = zmiana w biznesie.
**DoD.** Target 3–6 zdań czasu teraźniejszego · ≥4 kryteria mierzalne · ≥4 deliverables rzeczownikowe · spójność kryteria↔KPI.
**ANTY-WZORCE.** Target jako to-do lista · kryterium-czynność („wdrożymy system") zamiast stanu („system obsługuje 100% zgłoszeń") · „lepsza współpraca" (niemierzalne) · deliverable czasownikowy.
**PROMPT AI.** Kontrakt §0. Z {{problem, hipoteza, kontekst}} wygeneruj {targetDescription (czas teraźniejszy, obserwowalny), successCriteria[≥4, mierzalne, binarne-na-koniec], deliverables[≥4, rzeczownikowe]}. Oznacz, które kryterium mapuje na który (przyszły) KPI.

## 2.4 ZAKRES I KRYTERIA REZYGNACJI (scope)
**CEL.** Kontrakt granic: chroni przed rozlaniem zakresu (scope creep) i przed syndromem kosztów utopionych (kill = pre-commit falsyfikacji).
**CO MA ZAWIERAĆ.**
- **In ≥3:** jednoznaczne (co, dla kogo, w jakim obszarze/procesie/segmencie).
- **Out ≥3, MECE Z ODESŁANIAMI:** najcenniejsza połowa karty — każdy istotny „out" wskazuje, GDZIE ta praca żyje („triage i SLA → N12; CRM → N5"), nie „inne tematy".
- **Kill criteria ≥2:** skonkretyzowany warunek stop = **próg + moment pomiaru + decyzja**: „jeśli po pilocie (T+8 tyg.) adopcja < 30% → stop i przegląd założeń A2".
**DoD.** 3/3/2 minimum · out z odesłaniami MECE · każdy kill ma próg liczbowy/obserwowalny i moment.
**ANTY-WZORCE.** Out = „inne tematy" · kill niemierzalny („jeśli nie będzie miało sensu") · kill, który nigdy nie może zajść · in tak szerokie, że nic nie jest out.
**PROMPT AI.** Kontrakt §0 + siatka inicjatyw. Wygeneruj {inScope[≥3], outScope[≥3 z polem refInitiative], killCriteria[≥2: {condition, threshold, measureAt, decision}]}. Każdy out spróbuj zmapować na istniejącą inicjatywę; brak mapowania oznacz jako lukę portfela.

## 2.5 ZADANIA I KAMIENIE MILOWE (tasks)
**CEL.** Przekłada deliverables na wykonywalny WBS z weryfikowalnymi kamieniami. Tu plan przestaje być esejem.
**CO MA ZAWIERAĆ.**
- **Dekompozycja z deliverables:** każdy deliverable → ≥1 zadanie (czasownik+obiekt), z ownerem, terminem, priorytetem (0.4: zadania-sieroty = FAIL).
- **Kamienie ≥3 = weryfikowalne ZMIANY STANU** („pilot zakończony raportem z decyzją", nie „prace nad pilotem"), fazowane 0-3/3-6/6-12 mies. (relatywne dozwolone przed startem programu).
- **Pierwsze 2 tygodnie KONKRETNE** (quick wins — buduje wiarygodność i momentum).
- **Sekwencja logiczna** (co przed czym) — wsad do Zależności i Harmonogramu.
**DoD.** Każdy deliverable pokryty · zadania mają ownera+due · ≥3 kamienie-stany fazowane · start szczegółowy.
**ANTY-WZORCE.** Zadania bez właściciela · kamień = trwająca czynność · wszystko z terminem na koniec horyzontu · 40 płaskich zadań bez faz.
**PROMPT AI.** Kontrakt §0. Z {{deliverables, target, zasoby-jeśli-znane}} wygeneruj tasks[{title(czasownik+obiekt), deliverableRef, owner?, due|faza, priority, sequenceHint}] + milestones[≥3: {title(stan), phase: 0-3|3-6|6-12, date|relative, verification(jak stwierdzimy)}]. Pierwsze 14 dni rozpisz konkretnie.

## 2.6 DECYZJE — backlog decyzji (decisions)
**CEL.** Nazywa decyzje, których inicjatywa BĘDZIE potrzebować, zanim zablokują pracę. Decyzja odkryta w dniu blokady = stracony tydzień.
**CO MA ZAWIERAĆ.** Każda pozycja: **pytanie decyzyjne** (co dokładnie rozstrzygamy) · **decydent = 1 osoba** · **deadline powiązany z planem** (przed którym zadaniem/bramką musi zapaść) · status · priorytet · flaga „blokująca" · duże decyzje → link do artefaktu Decision (pełny frame: opcje/konsekwencje).
**DoD.** Decyzje wyprzedzają plan (każda blokująca ma deadline ≥ tydzień przed zadaniem, które blokuje) · 1 decydent per decyzja.
**ANTY-WZORCE.** Decydent-komitet · brak powiązania z planem · decyzje wpisywane po fakcie.
**PROMPT AI.** Kontrakt §0. Z {{plan zadań/kamieni, bramki, zakres}} wyprowadź backlog decyzji [{question, decider(1), dueBefore(taskRef|gateRef), blocking: bool, priority}]. Szukaj decyzji ukrytych w założeniach (assumption, które ktoś musi ZATWIERDZIĆ, to decyzja).

## 2.7 BRAMKI DECYZYJNE (gates)
**CEL.** Dyscyplina stage-gate: czy inicjatywa jest GOTOWA przejść do następnej fazy. Chroni portfel przed przepalaniem zasobów na niedojrzałe pomysły.
**CO MA ZAWIERAĆ.**
- **Bramka bieżąca + checklista gotowości:** konkretne, weryfikowalne warunki wejścia w następną fazę („Plan→Execute: business case zatwierdzony · budżet przyznany · sponsor potwierdzony · RAID kompletny · zespół obsadzony"), każdy = spełniony/nie + dowód.
- **Readiness % POLICZONY z kryteriów** (spełnione/wszystkie), nie „na oko".
- **Jeden Accountable na bramkę** (kto zatwierdza).
- **Decyzja: GO / GO-with-conditions / HOLD / KILL** z uzasadnieniem odwołującym się do kryteriów; warunki GO-with-conditions mają ownera i termin.
**DoD.** Kryteria weryfikowalne · readiness z kryteriów · 1 zatwierdzający · decyzja uzasadniona kryteriami · **AI tylko podpowiada — decyzję podejmuje człowiek**.
**ANTY-WZORCE.** Kryteria-ogólniki · readiness subiektywny · GO bez uzasadnienia · bramka przechodzona „bo termin".
**PROMPT AI.** Kontrakt §0. Dla {{faza bieżąca, stan wszystkich kart}} wygeneruj checklistę current→next [{criterion, met: bool, evidence, gapAction?}] + readiness% + rekomendację {GO|GO_WITH_CONDITIONS|HOLD|KILL, rationale, conditions[{action, owner, due}]}. To HINT — nie podejmuj decyzji za człowieka.

## 2.8 ANALIZA FINANSOWA (financialAnalysis)
**CEL.** Odpowiada „czy warto": pełny rachunek CAPEX/OPEX/ROI/NPV/Payback z jawną logiką. Liczba bez założenia jest bezwartościowa.
**CO MA ZAWIERAĆ.**
- **CAPEX i OPEX per kategoria** z założeniem przy każdej pozycji (skąd liczba: oferta/benchmark/analogia) · **przedziały zamiast fałszywej precyzji** (min–max, scenariusz bazowy).
- **ROI z pokazaną matematyką:** co w liczniku (korzyści skąd), co w mianowniku, horyzont; krotność lub %.
- **NPV z JAWNĄ stopą dyskontową** (i skąd ona) · **Payback w miesiącach**.
- **Enabler → wartość proxy** (np. „% odblokowanego portfela"), jawnie oznaczona jako pośrednia.
- **Spójność (0.4):** CAPEX/OPEX ↔ budżet Zasobów; korzyści ↔ Wpływ finansowy ↔ KPI.
**DoD.** Każda liczba ma założenie · ROI z logiką · NPV ze stopą · przedziały tam, gdzie niepewność · spójność krzyżowa.
**ANTY-WZORCE.** Punktowe liczby bez założeń · ROI „5x" bez rachunku · NPV bez stopy · koszt inicjatywy ≠ suma budżetu zasobów bez wyjaśnienia.
**PROMPT AI.** Kontrakt §0. Z {{sizing problemu, zakres, zasoby, kontekst org}} wygeneruj {capex[{category, amountRange, assumption}], opex[…/rok], roi{formulaExplained, value, horizon}, npv{rate, rateSource, value}, paybackMonths, scenarioNote}. Brak danych → „do ustalenia (N…)" + proces. NIE zmyślaj.

## 2.9 WPŁYW FINANSOWY (financialImpact)
**CEL.** Widok P&L: GDZIE i KIEDY wartość faktycznie pojawia się w rachunku wyników — most między obietnicą a księgą.
**CO MA ZAWIERAĆ.**
- **Rozdzielone strumienie:** wzrost przychodu / redukcja kosztów / (uniknięte koszty osobno — słabszy dowód).
- **One-off vs run-rate** — jawnie.
- **Krzywa ramp-up:** od kiedy korzyści startują i jak dochodzą do pełni (nikt nie wierzy w 100% od dnia 1).
- **Właściciel korzyści** (business owner, który podpisze, że są realne — nie zespół projektu).
- **Logika: korzyść = ΔKPI × wartość jednostkowa** (0.4) · **zasada braku podwójnego liczenia** między inicjatywami (jawna deklaracja).
- **Benefits realization %** = zrealizowane/plan, z miesiącem odniesienia.
**DoD.** Strumienie rozdzielone · ramp-up określony · owner korzyści nazwany · logika ΔKPI pokazana · deklaracja no-double-counting.
**ANTY-WZORCE.** Korzyści bez timingu · podwójne liczenie z sąsiednią inicjatywą · % realizacji bez planu bazowego · „miękkie korzyści" wliczone do ROI bez oznaczenia.
**PROMPT AI.** Kontrakt §0. Z {{analiza finansowa, KPI}} wygeneruj {revenueImpact{amount, rampUp, startsAt}, costSavings{…}, oneOffVsRunRate, benefitsOwner, kpiLinkage[{kpi, delta, unitValue, logic}], doubleCountingCheck(vs siatka inicjatyw)}.

## 2.10 KPI I KORZYŚCI (kpis)
**CEL.** Kontrakt pomiaru: „po tym poznamy, że się udało". Łączy działanie z wartością (Kaplan–Norton) — bez KPI sukces jest opinią.
**CO MA ZAWIERAĆ.**
- **2–5 KPI, ≥1 primary** (rozstrzyga o sukcesie), reszta wspierające/strażnicze (guardrail — co nie może się pogorszyć).
- **Każdy KPI = pełny łańcuch:** nazwa · jednostka · **baseline → target** · kierunek · horyzont · częstotliwość pomiaru · źródło danych.
- **Baseline realny z danych;** brak → „do ustalenia (N…)" + KTO i KIEDY go ustali. Nigdy zmyślony.
- **Mapowanie na value-driver** (przychód/koszt/ryzyko/czas) — zero metryk-sierot.
- **Ciągłość:** KPI inicjatywy = TEN SAM byt śledzony w Results/Benefits (nie duplikat).
**DoD.** ≥2 KPI, ≥1 primary · target≠null; baseline≠null LUB „do ustalenia" z procesem · jednostka+kierunek wszędzie · mapowanie na driver.
**ANTY-WZORCE.** „OTIF: 90%" bez baseline · cel bez jednostki · „poprawa efektywności" jako KPI · KPI bez źródła danych · guardrail pominięty przy KPI optymalizacyjnym (np. szybciej kosztem jakości).
**PROMPT AI.** Kontrakt §0. Z {{kryteria sukcesu, cele org, dane bazowe}} wygeneruj [{name, unit, baseline|"do ustalenia (N…)", target, direction, horizon, frequency, dataSource, isPrimary, valueDriver, isGuardrail}]. ≥1 primary; rozważ ≥1 guardrail. Odrzuć metryki bez jednostki/kierunku/celu.

## 2.11 PILOT (pilot — opcjonalna)
**CEL.** Eksperyment przed skalą — najtańszy sposób zabicia złego pomysłu. Pilot to badanie hipotezy, nie mały rollout.
**CO MA ZAWIERAĆ.** Hipotezy falsyfikowalne („Jeśli X, to Y mierzalne, bo Z") · **kryteria sukcesu ORAZ PORAŻKI zdefiniowane PRZED startem** (pre-commit — koniec z przesuwaniem bramek) · zakres/próba/czas trwania z uzasadnieniem (czemu ta próba wystarczy) · plan pomiaru (co, kto, kiedy) · wyniki uczciwie vs kryteria · **decyzja po pilocie: scale / iterate / kill** + wpis do kill criteria inicjatywy.
**DoD.** ≥1 hipoteza falsyfikowalna · kryteria porażki istnieją PRZED startem · decyzja po pilocie zapisana z uzasadnieniem.
**ANTY-WZORCE.** Pilot bez kryteriów porażki · „sukces" ogłoszony post-hoc wg tego, co wyszło · próba niereprezentatywna bez zastrzeżenia.
**PROMPT AI.** Kontrakt §0. Z {{hipoteza inicjatywy, zakres}} wygeneruj {hypotheses[falsyfikowalne], successCriteria[z progami], failureCriteria[z progami], sample&duration+why-enough, measurementPlan, decisionRule: scale|iterate|kill}.

## 2.12 ZESPÓŁ (team)
**CEL.** Pojedyncza odpowiedzialność + osłona z góry. Inicjatywa bez ownera z pojemnością to życzenie.
**CO MA ZAWIERAĆ.** **Owner = 1 osoba z imienia** z realną pojemnością (jawny % czasu; konflikt z innymi inicjatywami nazwany) — codzienny driver · **Sponsor** = władza budżetowa + usuwanie barier, z określonym rytmem zaangażowania (np. przegląd 2-tyg.) · jawna granica: czego owner NIE może sam → ścieżka do sponsora (spójna z eskalacją 1.2).
**DoD.** Owner i sponsor z imienia · % czasu ownera · rytm sponsora określony.
**ANTY-WZORCE.** Owner-komitet · sponsor-figurant (tytuł bez zaangażowania) · rola zamiast nazwiska · owner w 5 inicjatywach po „20%".
**PROMPT AI (asysta, nie kreacja).** Kontrakt §0. Zwaliduj {{owner, sponsor, alokacje z Zasobów}}: konflikty pojemności, brak władzy budżetowej sponsora, braki rytmu. Zwróć listę problemów + sugestie — wybór ludzi należy do człowieka.

## 2.13 HARMONOGRAM (timeline)
**CEL.** Kontrakt czasu: fazy, baseline i uczciwy postęp. Harmonogram bez dyscypliny baseline to dekoracja.
**CO MA ZAWIERAĆ.** Zależnie od fazy: **ESTIMATE** (data celu + czas trwania + założenie) → **PLANNING** (fazy z datami, kamienie, zależności — logika dat wynika z sekwencji, nie z życzenia) → **TRACKING** (postęp vs baseline; odchylenie = liczba + powód + akcja) · **dyscyplina baseline:** zmiana daty = re-baseline z powodem i śladem (historia zmian) · bufor JAWNY (nie ukryty w zadaniach) · postęp liczony z kamieni/zadań (obiektywny), nie deklarowany.
**DoD.** Daty wynikają z sekwencji zadań/zależności · baseline z historią zmian · postęp obiektywny · spójność z kamieniami i bramkami (0.4).
**ANTY-WZORCE.** „90% ukończone" trzeci miesiąc z rzędu · ciche przesuwanie dat · daty okrągłe bez logiki („koniec kwartału") · brak bufora albo bufor ukryty.
**PROMPT AI.** Kontrakt §0. Z {{zadania, kamienie, zależności}} zaproponuj {phases[{name, start, end, rationale}], criticalPath[], buffer{where, size, why}, trackingRule(jak liczymy postęp)}. Odchylenia > X% → wymuś pole {reason, action}.

## 2.14 ZASOBY (resources)
**CEL.** Test rzeczywistości: plan bez zasobów to fikcja. Cztery tabele = pełny koszt posiadania inicjatywy.
**CO MA ZAWIERAĆ.** **Budżet** per kategoria + źródło finansowania (spójny z CAPEX/OPEX, 0.4) · **FTE z NAZWISKAMI**, % alokacji i datami od–do; konflikty alokacji z innymi inicjatywami JAWNE · **Narzędzia** z kosztem i statusem (mamy/kupujemy/decyzja) · **Niematerialne** (dostęp do danych, decyzje, wsparcie zewnętrzne) — najczęściej pomijane, najczęściej blokujące.
**DoD.** FTE z imieniem+%+datami · suma budżetu ↔ CAPEX/OPEX · konflikty alokacji nazwane · niematerialne przemyślane (albo „— Pominięto: <powód>").
**ANTY-WZORCE.** „Zespół znajdzie czas" · budżet jedną liczbą · narzędzie „do kupienia" bez kosztu i decydenta · pominięcie dostępu do danych.
**PROMPT AI.** Kontrakt §0. Z {{zadania, kompetencje, analiza finansowa}} wygeneruj {budget[{category, amount, source}], fte[{person|role-to-fill, allocation%, from, to, conflictNote?}], tools[{name, cost, status}], intangibles[{what, owner, neededBy}]}. Zsumuj i porównaj z CAPEX/OPEX — rozjazd zgłoś.

## 2.15 WYMAGANIA KOMPETENCJI (competencyRequirements)
**CEL.** Plan zdolności wyprowadzony z PRACY (WBS), nie lista życzeń HR.
**CO MA ZAWIERAĆ.** Każde wymaganie: zdolność (konkretna, nie „komunikatywność") · poziom minimalny (skala org) · liczność (headcount) · priorytet required/nice-to-have · **uzasadnienie = wskazanie zadania/deliverable, które jej wymaga** (0.4) · horyzont (kiedy potrzebna).
**DoD.** Każde wymaganie zmapowane na zadanie · poziom+liczność+horyzont komplet.
**ANTY-WZORCE.** Kompetencje generyczne · wymóg bez zadania · „senior wszystkiego".
**PROMPT AI.** Kontrakt §0. Z {{zadania/deliverables}} wyprowadź [{capability, minLevel, headcount, priority, justification: taskRef, neededBy}].

## 2.16 LUKA UMIEJĘTNOŚCI (skillsGap)
**CEL.** Zamienia analizę pokrycia w decyzję sourcingową: build / buy / borrow. Analiza bez decyzji to raport do szuflady.
**CO MA ZAWIERAĆ.** Pokrycie per wymaganie (covered/partial/missing/**unknown** — unknown jawnie: brak profili = ryzyko, nie zero) · widok per osoba (kto co wnosi, czego brak) · **rekomendacje KONKRETNE:** zatrudnij/przeszkol/wypożycz + czas + koszt + wpływ na plan (które zadania zagrożone luką).
**DoD.** Unknown nazwane · każda luka missing/partial ma rekomendację z czasem i kosztem · wpływ na plan wskazany.
**ANTY-WZORCE.** „Uzupełnić kompetencje" bez decyzji · ignorowanie unknown · rekomendacja bez kosztu/czasu.
**PROMPT AI.** Kontrakt §0. Z {{wymagania, profile zespołu}} wygeneruj {coverage[{requirement, status: covered|partial|missing|unknown, evidence}], recommendations[{gap, action: hire|train|borrow, time, cost, tasksAtRisk[]}]}.

## 2.17 Karty techniczne Initiative — noty higieny
- **Panel sterowania (control):** status ODZWIERCIEDLA rzeczywistość (nie aspirację); priorytet uzasadniony vs portfel. Systemowa.
- **Tagi (tags):** taksonomia organizacji, zero synonimów-dubli. Systemowa.
- **Przypomnienia i eskalacja (reminders):** progi liczbowe (dni-przed), kanał, spójne z eskalacją 1.2. Konfiguracyjna.
- **Watchers:** placeholder — bez treści.
- **Karty alternatywne/legacy (initiativeTeam · raciEscalation · linkedItems):** duplikują team/stakeholders/attachments — ⚠ DECYZJA PIOTRA: wybrać kanoniczną, alternatywy wygasić (rekomendacja: team + stakeholders-RACI + attachments jako kanon; alt = off).

---

# 3. TASK — karty specyficzne (uniwersalne: →1.1–1.6)

## 3.1 OPIS I ZAKRES (Description & Scope) — task charter
**CEL.** Zadanie wykonalne bez dopytywania: co, po co, po czym poznamy koniec. Task bez „done-when" nigdy się nie kończy.
**CO MA ZAWIERAĆ.** **Co:** czasownik+obiekt, granice („przygotuj pakiet dowodów SOC 2: narracje kontrolne + sign-offy działów — bez sekcji X, tę robi N5") · **Po co / lineage:** link do inicjatywy/celu (RELATED TO) — zadanie-sierota ma jawny powód samodzielności · **Done-when (expected outcome):** WERYFIKOWALNY stan końcowy („pakiet złożony w portalu audytora, potwierdzenie przyjęcia") — nie „zrobione" · kontekst minimalny wystarczający (linki do materiałów zamiast przepisywania).
**DoD.** Czasownik+obiekt · lineage lub powód braku · outcome weryfikowalny · wykonawca zrozumie bez rozmowy.
**ANTY-WZORCE.** Opis = tytuł innymi słowami · outcome „ukończone" · zadanie-worek („ogarnąć temat X").
**PROMPT AI.** Kontrakt §0. Z {{tytuł, inicjatywa/źródło, kontekst}} wygeneruj {description(co+granice), relatedTo, expectedOutcome(stan weryfikowalny), contextLinks[]}.

## 3.2 POMYSŁY REALIZACJI (Implementation Ideas)
**CEL.** Diverge-then-converge na poziomie zadania: dla nietrywialnych zadań ≥2 drogi wykonania ZANIM praca ruszy. Odrzucone pomysły z powodem = pamięć instytucjonalna.
**CO MA ZAWIERAĆ.** ≥2 opcje wykonania (dla zadań > ~2 dni pracy) · każda: opis, nakład, ryzyko · **selected z uzasadnieniem** (dlaczego ta) · **rejected z powodem** (zostaje w karcie) · źródło oznaczone (AI/zespół/manual).
**DoD.** Nietrywialne zadanie ma ≥2 rozważone opcje · selected uzasadnione · rejected z powodami.
**ANTY-WZORCE.** Jedna opcja „bo tak robimy zawsze" · usuwanie odrzuconych · opcje-strawmany.
**PROMPT AI.** Kontrakt §0. Dla {{zadanie, kontekst}} zaproponuj 2-3 realne drogi wykonania [{idea, effort, risk, tradeoff}] + rekomendację z uzasadnieniem.

## 3.3 CHECKLIST
**CEL.** Kroki wykonania jako binarna, weryfikowalna sekwencja — kontrola postępu bez rozmowy.
**CO MA ZAWIERAĆ.** 3–10 pozycji (więcej → rozbij zadanie) · każda = akcja BINARNA (zrobione/nie — bez „w trakcie") · sekwencja logiczna · **ostatnia pozycja = weryfikacja expected outcome** (domknięcie pętli z 3.1).
**DoD.** Pozycje binarne i weryfikowalne · ostatnia = weryfikacja outcome.
**ANTY-WZORCE.** „Pracować nad X" jako pozycja · 25 mikropozycji · brak pozycji weryfikującej.
**PROMPT AI.** Kontrakt §0. Z {{opis zadania, expected outcome}} wygeneruj checklistę 3-10 binarnych kroków; ostatni = weryfikacja outcome.

---

# 4. DECISION — karty specyficzne (uniwersalne: →1.1–1.6)

## 4.1 ZAKRES DECYZJI (Decision Scope) — frame pytania
**CEL.** Dobrze postawione pytanie to połowa decyzji. Karta ustala CO rozstrzygamy, w jakich ramach — i czy drzwi są jedno- czy dwustronne.
**CO MA ZAWIERAĆ.** **JEDNO pytanie decyzyjne** (pakiet → rozbij na osobne decyzje) · kontekst i ograniczenia (co jest stałe: budżet, termin, polityka) · założenia jawne (co przyjmujemy za prawdę — kandydaci do RAID) · **co NIE jest decydowane** (granica — zapobiega rozlaniu dyskusji) · **odwracalność: one-way / two-way door** → determinuje rygor (dwustronne drzwi = decyduj szybko; jednostronne = pełny frame).
**DoD.** 1 pytanie · ograniczenia+założenia jawne · granica „czego nie decydujemy" · odwracalność oceniona.
**ANTY-WZORCE.** Pytanie z wbudowaną odpowiedzią („czy wdrożyć świetne rozwiązanie X?") · pakiet decyzji w jednej · brak oceny odwracalności.
**PROMPT AI.** Kontrakt §0. Z {{kontekst, powiązany obiekt}} wygeneruj {question(jedno, neutralne), constraints[], assumptions[], notDeciding[], reversibility: one-way|two-way + why}.

## 4.2 OPCJE I TRADE-OFFY (Options & Trade-offs)
**CEL.** Prawdziwy wybór wymaga prawdziwych alternatyw ocenionych wspólnymi kryteriami. Bez tego „decyzja" jest ratyfikacją pierwszego pomysłu.
**CO MA ZAWIERAĆ.** **≥2 realne opcje + status quo jako baseline** (koszt nicnierobienia policzony — łączy się z „kosztem zaniechania") · **kryteria decyzyjne JAWNE** przed oceną (koszt/czas/ryzyko/odwracalność/dopasowanie strategiczne; wagi jeśli potrzebne) · każda opcja oceniona TYMI SAMYMI kryteriami: zalety/wady/koszt/ryzyko · **trade-off nazwany wprost** („wybierając A poświęcamy B") · **rekomendacja uzasadniona kryteriami**, nie preferencją; druga-najlepsza wskazana (plan B).
**DoD.** ≥2 realne + baseline · kryteria przed oceną · trade-off nazwany · rekomendacja z uzasadnieniem kryterialnym.
**ANTY-WZORCE.** Jedna realna opcja + strawmany · pros/cons bez wspólnych kryteriów · rekomendacja „czujemy, że" · pominięcie status quo.
**PROMPT AI.** Kontrakt §0. Dla {{pytanie decyzyjne, ograniczenia}} wygeneruj {criteria[{name, weight?}], options[≥2 + statusQuo: {description, assessmentPerCriterion, cost, risk, tradeoffNamed}], recommendation{option, rationaleByCriteria, runnerUp}}. Zero strawmanów — każda opcja musi mieć realnego zwolennika.

## 4.3 KONSEKWENCJE (Consequences)
**CEL.** Myślenie scenariuszowe PRZED decyzją: co się stanie, po czym poznamy że idzie źle, ile kosztuje odwrót. Zamienia decyzję w zakład z planem rewizji.
**CO MA ZAWIERAĆ.** **3 scenariusze (optymistyczny/neutralny/pesymistyczny)** w horyzontach **d7/d30/d90** · skutki DRUGIEGO rzędu (co ta decyzja uruchomi/zablokuje gdzie indziej) · **koszt odwrócenia** (spójny z odwracalnością z 4.1) · **sygnały wczesne scenariusza pesymistycznego + trigger rewizji** („jeśli do d30 X < Y → wracamy do decyzji") · decision note: co się dzieje bezpośrednio po zatwierdzeniu (kto informowany, co startuje).
**DoD.** 3 scenariusze × 3 horyzonty · ≥1 skutek drugiego rzędu · koszt odwrotu · trigger rewizji z progiem.
**ANTY-WZORCE.** Tylko pozytywne skutki · brak horyzontów czasowych · brak sygnałów rewizji („zobaczymy jak pójdzie").
**PROMPT AI.** Kontrakt §0. Dla {{decyzja, opcja rekomendowana}} wygeneruj {scenarios: {optimistic, neutral, pessimistic} × {d7, d30, d90}, secondOrderEffects[], reversalCost, earlySignals[{signal, threshold, reviewTrigger}], decisionNote}.

---

# 5. INSIGHT — stan i decyzja
Dziś Insight = widok read-only (banner, meta Impact/Confidence/Actionable, treść md, akcje Export/Approve/Regenerate). Treść Insightu JAKO CAŁOŚCI ma już pełny kanon w `CARD_CONTENT_FORMULA.md §A2` (tytuł ≤14 słów, summary 60-130, motywy ≥3 z dowodami, issues ≥2, evidence_map, missing_data ≥2, material_quality KOMPLET — twardy walidator).
**⚠ DECYZJA PIOTRA:** czy Insight zostaje read-only (kanon A2 wystarcza), czy rozbudowujemy do artefaktu-karty jak Task (wtedy propozycja zestawu: Podsumowanie · Motywy · Problemy/Szanse · Dowody · Braki danych · uniwersalne 1.4-1.6)?

---

# 6. OTWARTE DECYZJE (do Piotra)
1. **Karty alternatywne Initiative** (2.17): kanon = team + stakeholders + attachments; wygasić initiativeTeam/raciEscalation/linkedItems? (rekomendacja: tak)
2. **Insight** (§5): read-only vs rozbudowa do kart.
3. **Guardrail-KPI** (2.10): czy wymagać ≥1 przy każdym KPI optymalizacyjnym? (rekomendacja: tak — tanio chroni przed „szybciej kosztem jakości")

## Changelog
- **v1.0 (2026-07-05):** pełny katalog instrukcji — 6 uniwersalnych + 16 Initiative + 3 Task + 3 Decision + noty techniczne + kontrakt wspólny (łańcuch generacji 0.3, spójność krzyżowa 0.4). Zastępuje wzorzec 3-kartowy.
