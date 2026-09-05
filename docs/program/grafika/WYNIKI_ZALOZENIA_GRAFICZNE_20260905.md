---
doc_id: wyniki-zalozenia-graficzne-20260905
status: draft-for-owner
truth_type: product-target
established: 2026-09-05
author: CTO (Fable) na podstawie decyzji właściciela 30.08 + 05.09 i załączników (Apator szablon.xlsx, OKR Planning Q4)
---

# Wyniki — założenia graficzne narzędzi KPI i OKR (do prototypu, przed budową)

## 0. Teoria OKR, na której stoi tabela (źródła: A. Grove „High Output Management”; J. Doerr „Measure What Matters”; Google re:Work OKR playbook; C. Wodtke „Radical Focus”)
1. **Cel (Objective)** jest jakościowy, inspirujący, krótki — kierunek, nie liczba. Na okres (kwartał) zespół/osoba ma **3–5 celów**, nie więcej.
2. **Kluczowy rezultat (Key Result)** jest mierzalny i ma datę; na cel **2–5 rezultatów**. Rezultat mówi „skąd wiemy, że cel osiągnięty”, nie „co robimy” (to są inicjatywy/zadania pod rezultatem).
3. **Ocena (grading)**: skala **0,0–1,0** (Google) albo % postępu; 0,6–0,7 dla celów aspiracyjnych to dobry wynik, 1,0 dla zobowiązań (**committed**) jest wymagane. Nasze pole „Ambicja: Zobowiązanie / Aspiracja” już to niesie.
4. **Pewność (confidence)**: cotygodniowy sygnał właściciela rezultatu (np. 5/10 → „zagrożony”), niezależny od postępu — Wodtke: „Monday commitments, Friday wins”.
5. **Check-in** co tydzień/dwa: aktualizacja bieżącej wartości, pewności i komentarza; **przegląd końca cyklu**: ocena, nauka, decyzja „kontynuować / zamknąć / przenieść”.
6. **Kaskada / wyrównanie**: cele zespołu wspierają cele firmy (alignment), rezultat może wspierać cel wyżej; ale własność jest **osobowa** (jedna osoba na rezultat) — to jest zasada właściciela „OKR dotyczy człowieka”.
7. **Publiczność**: OKR są jawne w organizacji; kto co ma dowieźć, widać w jednej tabeli.
8. Rozdzielność od KPI: KPI to **miernik zdrowia procesu**, mierzony cyklicznie bez daty końca; OKR to **zmiana** w okresie, z datą i właścicielem. KPI może stać się rezultatem („podnieść OEE z 71 do 78 % do końca Q4”) — wtedy KR wskazuje na KPI jako źródło pomiaru.

Z tego dla tabeli OKR: kolumny TEMAT · CEL (rozpięty) · REZULTAT · WŁAŚCICIEL · ZESPÓŁ · TERMIN (z załącznika) plus z teorii: **START / CEL / BIEŻĄCA**, **POSTĘP** (0–1,0 lub %), **PEWNOŚĆ** (wysoka/średnia/niska), **AMBICJA** (zobowiązanie/aspiracja), **OSTATNI CHECK-IN**, **STAN** (na dobrej drodze / zagrożony / krytyczny). Filtr domyślny: WŁAŚCICIEL. Grupowanie: TEMAT → CEL.

## 1. Wspólna powłoka (kanon, bez wyjątków)
- **Menu 1**: okruszek `Wyniki › KPI › <raport> › <miernik>`; nazwa obiektu, pigułka stanu, „Zapisano”, kebab pionowy; jeden neutralny CTA.
- **Menu 2** modułu Wyniki: **KPI · OKR · ROI** (trzy funkcje) + wyszukiwarka.
- **Menu 3** (dynamiczne): chipy filtrów danego poziomu; przy 2. poziomie jako artefakt: chipy raportu (obszar / właściciel / stan) i akcja „Dodaj miernik” / „Dodaj cel”.
- **Centrum**: `StandardTable` (poziomy 1–2) albo karta N (poziom 3). Lekkie: tabela + nagłówek raportu, nic więcej.
- **Prawy panel**: jeden, `StandardPreview` na listach (Rekord | Teresa), `ArtifactRightPanel` na karcie (Akcje · Właściwości · Powiązania · Źródła i założenia · Komentarze · Historia), Teresa jako zakładka. Zwijany, pamięta stan.
- **Kolor**: neutralne tony wszędzie; **czerwień wyłącznie dla „krytyczne / poza limitem / otwarta karta działania”**, bursztyn dla „ostrzeżenie / zagrożony”, zieleń tylko jako kropka stanu „w normie” (nie jako wypełnienie). Puste dane = „—” / „Brak danych”, nigdy 0.
- **Typografia i rytm**: jak reszta aplikacji (skala nagłówków SPEC-L/SPEC-A, siatka 8 px, chipy 24 px, wiersz tabeli 44 px, podwiersz CEL/Rezultat 32 px).

## 2. Narzędzie KPI (proces)
**Poziom 1 — Rejestr raportów KPI** (`/results/kpi`)
Tabela: NAZWA RAPORTU · ZAKRES (zakład / projekt / dział) · OKRES (miesiąc, kwartał, rok; edycja i rewizja w podglądzie) · MIERNIKI (liczba) · STAN (pasek czterech segmentów: w normie / ostrzeżenie / krytyczne / brak danych — jak w arkuszu, bez cyfr w komórce, cyfry w dymku) · OTWARTE DZIAŁANIA (liczba kart działania) · PRZYGOTOWAŁ · AKTUALIZACJA · kebab. Menu 3: chipy „Wszystkie · Bieżący okres · Z otwartymi działaniami · Archiwum”, przycisk „Nowy raport”. Podgląd (prawy panel, po kliknięciu wiersza): nagłówek raportu (opis, cel raportu), rozkład stanu **per obszar** (lista obszarów z paskiem), ostatnie zmiany, akcja „Otwórz raport”.

**Poziom 2 — Raport KPI** (`/results/kpi/scorecards/:id`, artefakt w Menu 3)
Nagłówek raportu (jedna linia + druga muted): nazwa, zakres, okres, edycja/rewizja, przygotował; po prawej podsumowanie stanu (cztery liczby z paskiem) i „Dodaj miernik”.
Tabela mierników, **grupowana po OBSZARZE** (wiersz grupy = nazwa obszaru, właściciel nadrzędny, mini-pasek stanu obszaru), kolumny stałe: MIERNIK (nazwa; metoda i definicja w dymku i w podglądzie) · KIERUNEK/JEDNOSTKA (↑ min. / ↓ max. + jednostka) · CZĘSTOTLIWOŚĆ · TYP (rozliczeniowy / informacyjny, chip) · ODPOWIEDZIALNOŚĆ (nazwisko) · BENCHMARK · LIMIT %; kolumny okresów (przewijane poziomo, przypięte kolumny stałe z lewej): dla każdego okresu **dwie liczby w komórce: CEL nad Rezultatem** (Rezultat kolorowany stanem: zwykły / bursztyn / czerwony), ostatnia kolumna **YTD**; na końcu STAN i ikona „karta działania otwarta” (jeśli jest) + kebab. Pod nagłówkiem grupy można zwinąć obszar. Klik w miernik → poziom 3; klik w komórkę rezultatu → edycja inline (wpis rezultatu = wyzwalacz odchylenia).
Puste komórki okresów = kropka „—” (nie 0). Kolumna okresu bieżącego lekko podświetlona. Szerokość: przy 1440 px widać kolumny stałe + 4–6 okresów, reszta przewijana, YTD przypięte z prawej.

**Poziom 3 — Karta miernika (N-type)** (`/results/kpi/:kpiId`)
Menu 1: `Wyniki › KPI › <raport> › <miernik>`, nazwa, chip stanu, jednostka. Lewa nawigacja karty: **Wyniki · Kontrakt · Pomiary · Odchylenia · Działania · Raporty · Historia**.
- *Wyniki*: ostatni okres (CEL / Rezultat / odchylenie / stan), mini-wykres 12 okresów z linią celu i pasmem limitu, YTD.
- *Kontrakt*: wszystkie elementy z arkusza (obszar, właściciel nadrzędny, metoda, definicja, kierunek, jednostka, częstotliwość, typ, odpowiedzialność, benchmark, limit) — tabela Właściwość/Wartość.
- *Pomiary*: tabela okresów CEL / Rezultat / odchylenie / stan / kto wpisał / kiedy; dodawanie pomiaru.
- *Odchylenia*: lista **kart działania** (jedna na okres poza limitem): miesiąc · cel osiągnięty? · działania wymagane? · problem · główna przyczyna · działania · odpowiedzialny · termin · komentarz · status OTWARTY/ZAMKNIĘTY; karta otwiera się jako N-type wewnątrz sekcji (pełna edycja).
- *Działania*: zbiorczo wszystkie działania korygujące z terminami i statusem.
- *Raporty*: w których raportach miernik występuje (jedna tożsamość, wiele okresów).
- *Historia*: zmiany definicji, progów, właściciela.
Prawy panel: Akcje (Dodaj pomiar · Otwórz kartę działania · Eksportuj) · Właściwości (skrót kontraktu) · Powiązania (inicjatywy, procesy) · Źródła · Komentarze · Historia; zakładka Teresa (objaśnia trend, proponuje przyczynę — nie fabrykuje pomiarów).

## 3. Narzędzie OKR (człowiek)
**Poziom 1 — Rejestr raportów OKR** (`/results/okr`)
Tabela: NAZWA (np. „OKR zakładu — Q4 2026”) · ZAKRES (firma / dział / projekt / zespół) · CYKL (Q4 2026; daty w dymku) · CELE · REZULTATY · STAN (pasek: na dobrej drodze / zagrożony / krytyczny / bez check-inu) · WŁAŚCICIELE (liczba osób) · OSTATNI CHECK-IN · kebab. Podgląd: opis i cel raportu (z załącznika: „Description”, „Goal”), **rozkład stanu per właściciel** (lista osób z paskiem — „Fred: 3 rezultaty, 1 zagrożony”), ostatnie check-iny, „Otwórz raport”.

**Poziom 2 — Raport OKR** (`/results/okr/sets/:id`)
Nagłówek: nazwa, zakres, cykl, opis, cel raportu; podsumowanie stanu; „Dodaj cel” / „Dodaj rezultat”.
Tabela **grupowana TEMAT → CEL**: wiersz tematu (nazwa, pasek stanu), pod nim cel jako komórka rozpięta na swoje rezultaty (nazwa celu, ambicja: zobowiązanie/aspiracja, właściciel celu), wiersze rezultatów: KLUCZOWY REZULTAT · WŁAŚCICIEL (awatar + nazwisko) · ZESPÓŁ · START / CEL / BIEŻĄCA · POSTĘP (pasek 0–100 % lub ocena 0,0–1,0) · PEWNOŚĆ (chip) · TERMIN · OSTATNI CHECK-IN · STAN · kebab. Menu 3: chipy „Wszystkie · Moje · Zagrożone · Bez check-inu” + filtr WŁAŚCICIEL (domyślnie widoczny, bo podmiotem jest człowiek). Klik w rezultat → karta celu przewinięta do rezultatu; klik w cel → karta celu.

**Poziom 3 — Karta celu (N-type)** (`/results/okr/:objectiveId`, dziś istnieje)
Menu 1: `Wyniki › OKR › <raport> › <cel>`. Nawigacja: **Cel · Kluczowe rezultaty · Check-iny · Powiązania · Refleksja**.
- *Cel*: co chcemy osiągnąć, dlaczego teraz, parametry (właściciel, zakres, cykl, ambicja, pewność, postęp).
- *Kluczowe rezultaty*: **sekcja, nie poziom** — każdy rezultat jako blok: nazwa, właściciel, zespół, termin, START / CEL / BIEŻĄCA, pasek postępu, pewność, ostatni komentarz; przycisk „Check-in” na bloku; rezultat zagrożony ma bursztynowy, krytyczny czerwony akcent na lewej krawędzi bloku i zgłoszenie do właściciela (ta sama mechanika co KPI).
- *Check-iny*: oś czasu (kto, kiedy, wartość, pewność, komentarz).
- *Powiązania*: cele nadrzędne/podrzędne (kaskada), inicjatywy realizujące, KPI używane jako pomiar rezultatu.
- *Refleksja*: ocena końca cyklu (0–1,0), nauka, decyzja kontynuuj/zamknij/przenieś.
Prawy panel jak w KPI; Teresa: podpowiada sformułowanie rezultatu jako mierzalnego, ostrzega przed „rezultatem będącym zadaniem”.

## 4. Narzędzie ROI (inwestycja) — dwa poziomy
**Poziom 1 — Tabela analiz** (`/results/roi`): NAZWA · PRZEDMIOT (maszyna / robotyzacja / IT / magazyn / linia / digitalizacja) · WARIANT (0/1/2/3) · CAPEX · ROCZNA KORZYŚĆ · ROI (z horyzontem) · PAYBACK · NPV · IRR · REKOMENDACJA (GO / CONDITIONAL GO / NO-GO jako chip neutralny) · FAZA (założenia / wyliczenia / realizacja) · WŁAŚCICIEL · AKTUALIZACJA. Podgląd: Executive Summary (11 wskaźników w tabeli Właściwość/Wartość) + faza + „Otwórz analizę”.
**Poziom 2 — Karta analizy N** (`/results/roi/cases/:id`), lewa nawigacja w **trzech częściach** (słowa właściciela: założenia → wyliczenia → realizacja):
- *Założenia*: Przedmiot i cel · Wariant bazowy i warianty · Horyzont · Nakłady (CAPEX z contingency, ΔNWC) · Koszty operacyjne (incremental) · Korzyści (osobno per kategoria: praca, produktywność, jakość, przestoje, energia, maintenance, zapasy, uniknięte, rezydualna; klasa Hard/Avoided/Soft/Strategic) · Łańcuch KPI → pieniądze · Ryzyka.
- *Wyliczenia*: Cash flow rok 0–n (tabela) · Wskaźniki (CAPEX, Annual Net Benefit, ROI nY, ARR, PP, DPP, NPV, IRR, PI, BCR, Break-even, Margin of Safety) · Wrażliwość (tabela ±20 % per zmienna) · Scenariusze (Conservative/Base/Upside) · Scoring wielokryterialny · Rekomendacja.
- *Realizacja*: Przegląd po 3/6/12 mies. (Expected vs Actual per KPI i korzyść, wariancja) · Prawdziwość założeń (per założenie: potwierdzone / częściowo / obalone, z opisem) · ROI po realizacji (przeliczone wskaźniki) · Wnioski.
Prawy panel: Akcje (Przelicz · Zmień scenariusz · Rozpocznij przegląd PIR · Eksportuj raport do Materiałów) · Właściwości · Powiązania (inicjatywa, KPI źródłowe, model finansowy) · Źródła i założenia · Komentarze · Historia; Teresa jako zakładka (objaśnia wrażliwość, wskazuje podwójne liczenie).
Puste/niepoliczone = „—” z powodem; liczby z jednostką i horyzontem („ROI 3Y 42 %”).

## 5. Sygnalizacja odchylenia (jedna mechanika dla KPI i OKR)
Wpis rezultatu / check-in → porównanie z celem i limitem → stan → kolor na wierszu poziomu 2, w podsumowaniu poziomu 1 i na bloku w karcie → zgłoszenie do osoby odpowiedzialnej (powiadomienie + Skrzynka Mojej Pracy) → **karta działania** otwarta automatycznie dla okresu, widoczna w karcie miernika/celu i w raporcie jako ikona przy wierszu, do zamknięcia działania.

## 6. Co dalej
Prototyp (dev-render, mock DBR77) trzech ekranów KPI i trzech OKR na tych założeniach → moje zrzuty → akcept właściciela → P7K (część A poziomy, część B odchylenie). Bez akceptu prototypu nie budujemy.
