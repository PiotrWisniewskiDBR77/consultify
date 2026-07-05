# KANON METODYCZNY DRD — Digital Readiness Diagnostic (DBR77/Consultify)

> **Status:** v1.0 — kanon do zamrożenia (realizuje decyzję D2 z `ASSESSMENT_CONCEPT_V4_2026-06-28.md`)
> **Data:** 2026-07-02 · **Autor:** Claude (CTO) · **Właściciel metodyki:** DBR77 / Consultify
> **Rola dokumentu:** JEDYNE źródło prawdy o metodyce DRD. Kod, qbank, raporty, marketing i sprzedaż mają się zgadzać z TYM dokumentem — nie odwrotnie. Zmiana kanonu = nowa wersja tego pliku + wpis w §11 (governance).
> **Dokument siostrzany:** `docs/product/DRD_REPORT_SPEC.md` (specyfikacja raportu klienckiego).

---

## 0. Czym jest DRD i dlaczego kanon jest potrzebny

**DRD (Digital Readiness Diagnostic)** to autorski framework DBR77/Consultify do diagnozy gotowości cyfrowej przedsiębiorstwa. Nie ma zewnętrznego pierwowzoru ani licencjodawcy — pełne IP należy do nas. To nasza największa przewaga (swoboda) i największe ryzyko (nikt inny nie zamrozi kanonu za nas).

**Stan na 2026-07-02 (audyt kodu):** metodyka istnieje w kodzie w **dwóch rozjechanych kopiach** (§2), obietnica marketingowa („8 wymiarów") nie zgadza się ze strukturą pomiarową (7 osi), qbank jest wydmuszką (31 linii zasad ogólnych, zero pytań merytorycznych — §9), a liczba obszarów w dokumentach (34) nie zgadza się z kodem (39). Flagowy framework bez zamrożonego kanonu = ryzyko reputacyjne pierwszej klasy: dwóch konsultantów może dziś dostarczyć klientom dwa różne „DRD".

**Zasady nadrzędne (dziedziczone z V3/V4, obowiązują w DRD bezwzględnie):**
1. **Evidence discipline** — poziom bez dowodu nie jest osiągnięty; jest „do potwierdzenia" (needs evidence). Żadnego „score by opinion".
2. **Propose→accept** — AI proponuje poziom, człowiek zatwierdza. Wynik bez akceptacji człowieka nie istnieje.
3. **Liczby z silnika, nie z modelu** — każdy wynik liczbowy w outputach pochodzi z deterministycznych wzorów (§6), nigdy z generacji LLM.
4. **Wniosek, nie opis** — każdy wynik prezentujemy w standardzie: *co jest → co to znaczy → co robić najpierw → jaki efekt*.

---

## 1. Architektura metodyki — dwie warstwy

DRD ma **dwie warstwy o różnych rolach**. Mieszanie ich to źródło dzisiejszego chaosu „7 czy 8":

| Warstwa | Jednostka | Ile | Rola |
|---|---|---|---|
| **POMIAR** | 7 osi → 39 obszarów → poziomy (5/6/7 per oś) | 39 obszarów | Tu odbywa się assessment: pytania, dowody, achieved/target. Granularna, ekspercka, nie zmienia się bez wersjonowania. |
| **KOMUNIKACJA** | 8 wymiarów raportowych | 8 wymiarów | Tu odbywa się raportowanie: radar 8D, benchmark, executive summary. Każdy wymiar jest deterministyczną agregacją obszarów pomiaru (§3). |

**Zasada:** klient widzi 8 wymiarów; konsultant ocenia 39 obszarów. Mapowanie obszar→wymiar jest jawne, wersjonowane i jedno (§3.2). Nigdy nie raportujemy wymiaru, za którym nie stoi ani jeden zmierzony obszar (żadnych „wymiarów-widm").

---

## 2. SSOT struktury pomiarowej — rozstrzygnięcie dwóch rozjechanych map

### 2.1 Stan faktyczny (audyt 2026-07-02)

W kodzie istnieją **dwie niezależne, rozjechane definicje struktury DRD**:

| | **Mapa A (frontend)** | **Mapa B (backend)** |
|---|---|---|
| Plik | `src/services/drdStructure.ts` (1886 linii) | `server/src/data/drdStructure.ts` |
| Konsumenci | edytor DRD, formularz, viz adapter, raport FE | `reportBuilderService.ts`, `demoSeedService.ts` |
| Osie 1–4, 7 | identyczne | identyczne |
| **Oś 5 (Kultura) — skala** | **6 poziomów** | **5 poziomów** |
| **Oś 6 (Cyber) — skala** | **6 poziomów** | **5 poziomów** |
| Obszar 5A | Leadership Attitudes / „Postawy przywódcze" | Leadership Style / „Styl Przywództwa" |
| Obszar 5C | Continuous Competency Development / „Ciągły rozwój kompetencji" | Continuous Improvement / „Ciągłe Doskonalenie" |
| Obszar 6D | Security Education and System Quality / „Edukacja i jakość systemów" | Education and Training / „Edukacja i Szkolenia" |
| Obszar 6E | Contingency Plans / „Plany awaryjne" | Incident Response / „Reagowanie na Incydenty" |

**Skutek biznesowy rozjazdu:** dokument zbudowany po stronie serwera (report builder, dane demo) opisuje inną skalę (max 5) i inne nazwy obszarów niż to, co użytkownik ocenił w edytorze (max 6). Wynik 6/6 w Kulturze po stronie FE jest po stronie BE niereprezentowalny.

**Trzecia, miękka rozbieżność:** `server/src/services/assessmentDeckService.ts:81` opisuje osie DRD po angielsku jako „strategy, people, processes, technology, data, governance and culture" — lista **nie odpowiada żadnej** z dwóch map. Do poprawy przy wdrożeniu kanonu.

**Czwarta rozbieżność (dokumentacyjna):** `ASSESSMENT_CONCEPT_V4` mówi „7 osi × 34 obszary". Kod ma **39 obszarów** (9+5+5+5+5+5+5). Liczba 34 to stan sprzed dodania osi 7 (AI, 5 obszarów). Kanoniczna liczba = **39**.

### 2.2 Rozstrzygnięcie (decyzja kanoniczna)

**SSOT = Mapa A (frontend, `src/services/drdStructure.ts`) z dwiema korektami nazw.** Uzasadnienie:
- Mapa A jest **pełniejsza merytorycznie**: osie 5 i 6 mają kompletne, 6-stopniowe drabiny behawioralne (np. przywództwo: Pasywny→Autokratyczny→Dyrektywny→Wspierający→Innowator→Transformacyjny; zarządzanie zmianą wg pełnej sekwencji Kottera). Mapa B to ta sama drabina obcięta do 5 — utrata treści, nie inna metodyka.
- Mapa A jest tym, **czym faktycznie ocenia użytkownik** — wyniki historyczne są w jej skali.

**Korekty nazw (przejęte z Mapy B jako czytelniejsze, bez zmiany treści poziomów):**
- 6E: kanonicznie **„Reagowanie na incydenty" / Incident Response** (nie „Plany awaryjne" — nazwa B lepiej oddaje 6-stopniową drabinę identyfikacja→priorytety→procedury→szkolenia→testy→doskonalenie).
- 5A: kanonicznie **„Styl przywództwa" / Leadership Style** (drabina opisuje style, nie postawy).
- Pozostałe nazwy (5C „Ciągły rozwój kompetencji", 6D „Edukacja i jakość systemów") — wersja A, bo drabiny A dotyczą właśnie rozwoju kompetencji i jakości systemów szkoleń.

**Plan techniczny (bez kodu w tym dokumencie, kierunek wiążący):** struktura przenosi się do jednego modułu współdzielonego (docelowo `shared/` lub pakiet generowany), z którego korzystają FE i BE; do czasu refaktoru plik FE jest masterem, a plik serwerowy ma być z nim zsynchronizowany 1:1. Każda rozbieżność FE↔BE = bug P1.

### 2.3 Kanoniczna struktura pomiarowa: 7 osi × 39 obszarów

| Oś | Nazwa PL / EN | Obszary | Poziomy |
|---|---|---|---|
| 1 | Procesy cyfrowe / Digital Processes | 9: 1A Sprzedaż · 1B Marketing · 1C Technologia procesu i R&D · 1D Zakupy · 1E Logistyka · 1F Produkcja · 1G Jakość · 1H Finanse · 1I HR | **7** |
| 2 | Produkty cyfrowe / Digital Products | 5: 2A Produkty cyfrowe · 2B Produkty społecznościowe · 2C Produkty oparte na ICT · 2D Dopasowanie do oczekiwań klienta · 2E Skalowalność produktu | **5** |
| 3 | Cyfrowe modele biznesowe / Digital Business Models | 5: 3A E-commerce · 3B Platformy · 3C As-a-Service · 3D Współdzielenie zasobów · 3E Monetyzacja danych | **5** |
| 4 | Zarządzanie danymi / Data Management | 5: 4A Zbieranie danych · 4B Przechowywanie danych · 4C Komunikacja danych · 4D Analiza Big Data · 4E Moc obliczeniowa | **7** |
| 5 | Kultura transformacji / Culture of Transformation | 5: 5A Styl przywództwa · 5B Gotowość na zmianę · 5C Ciągły rozwój kompetencji · 5D Kultura innowacji · 5E Dostępność zasobów | **6** |
| 6 | Cyberbezpieczeństwo / Cybersecurity | 5: 6A Strategia i zarządzanie ryzykiem · 6B Ochrona sieci i systemów · 6C Ochrona danych · 6D Edukacja i jakość systemów · 6E Reagowanie na incydenty | **6** |
| 7 | Dojrzałość AI / AI Maturity | 5: 7A Dane i fundamenty AI · 7B Procesy wspierane AI · 7C AI w produktach i usługach · 7D Governance, bezpieczeństwo i etyka · 7E Kompetencje i kultura AI | **5** |

Mieszane skale (5/6/7) są **cechą metodyki**, nie błędem: drabiny odwzorowują realne trajektorie technologiczne (np. droga procesu produkcyjnego przez MES i ERP wymaga 7 szczebli; dojrzałość AI sensownie opisuje 5). Porównywalność między osiami zapewnia normalizacja (§6.1) — nigdy przycinanie drabin.

---

## 3. 7 osi → 8 wymiarów raportowych (rozstrzygnięcie D2)

### 3.1 Zasada rozstrzygnięcia

Obietnica „8 kluczowych wymiarów" (marketing/picker) vs 7 osi w kodzie. Odrzucamy dwa złe wyjścia: (a) przebudowę struktury pomiarowej pod marketing, (b) radar z wymiarem, którego nic nie mierzy (np. „Strategia" jako oś radaru bez ani jednego pytania o strategię — klient techniczny wyłapie to w 5 minut i podważy cały raport).

**Rozwiązanie: 8 wymiarów powstaje przez podział osi 4.** Oś „Zarządzanie danymi" zawiera dziś dwie różne rzeczy: dojrzałość **danych jako zasobu** (zbieranie, przechowywanie, analityka) i dojrzałość **infrastruktury technicznej** (sieci/komunikacja, moc obliczeniowa). Rozdzielenie ich jest merytorycznie poprawne (to różni właściciele budżetów i różne inicjatywy) i domyka liczbę 8 bez żadnego wymiaru-widma.

### 3.2 Kanoniczne mapowanie obszar → wymiar (wersja MAP-1.0)

| # | Wymiar raportowy PL / EN | Obszary źródłowe | Skala natywna |
|---|---|---|---|
| D1 | Procesy cyfrowe / Digital Processes | 1A–1I (9) | 7 |
| D2 | Produkty cyfrowe / Digital Products | 2A–2E (5) | 5 |
| D3 | Cyfrowe modele biznesowe / Digital Business Models | 3A–3E (5) | 5 |
| D4 | Dane i analityka / Data & Analytics | 4A, 4B, 4D (3) | 7 |
| D5 | Technologia i infrastruktura / Technology & Infrastructure | 4C, 4E (2) | 7 |
| D6 | Ludzie i kultura / People & Culture | 5A–5E (5) | 6 |
| D7 | Cyberbezpieczeństwo / Cybersecurity | 6A–6E (5) | 6 |
| D8 | Dojrzałość AI / AI Maturity | 7A–7E (5) | 5 |

Sumy: 9+5+5+3+2+5+5+5 = **39** — każdy obszar mapuje się do dokładnie jednego wymiaru (MECE).

**A gdzie „Strategia"?** Sygnał strategiczny istnieje w pomiarze (5A styl przywództwa, 5B–5C gotowość organizacji, 6A strategia bezpieczeństwa, 7D governance AI) i jest raportowany **narracyjnie** w executive summary oraz jako „oś pozioma" roadmapy — nie jako 9. ramię radaru. Jeśli Piotr chce „Strategii" w radarze (wariant marketingowy z D2 w V4), wymaga to dobudowania obszarów pomiarowych strategii (nowa mini-oś, ~3 obszary) — patrz decyzja **P1** w §12.

---

## 4. Pięć poziomów dojrzałości — opisy behawioralne per wymiar

### 4.1 Uniwersalna skala interpretacyjna DRD (poziomy I–V)

Wspólny język komunikacji wyniku (klient nie musi znać drabin 5/6/7):

| Poziom | Nazwa PL / EN | Uniwersalna charakterystyka |
|---|---|---|
| **I** | Analogowy / Analog | Praca oparta na papierze, pamięci ludzi i pojedynczych plikach. Cyfryzacja = rejestrowanie faktów post factum. |
| **II** | Wyspowy / Fragmented | Punktowe narzędzia cyfrowe bez integracji. Dane istnieją, ale w silosach; procesy „cyfrowe na końcach, ręczne w środku". |
| **III** | Zintegrowany / Connected | Kluczowe systemy połączone, dane płyną między działami, procesy mierzone. Firma „widzi się" w danych. |
| **IV** | Zoptymalizowany / Optimized | Systemy sterują pracą (nie tylko ją rejestrują), automatyzacja domyślna, decyzje na danych w rytmie zarządczym. |
| **V** | Samodoskonalący / Self-optimizing | AI i pętle zwrotne poprawiają działanie bez polecenia człowieka; cyfrowość jest modelem biznesowym, nie kosztem. |

**Mapowanie drabin natywnych → poziomy I–V (deterministyczne, wersjonowane):**

| Skala natywna | I | II | III | IV | V |
|---|---|---|---|---|---|
| 7-poziomowa (osie 1, 4) | 1 | 2–3 | 4–5 | 6 | 7 |
| 6-poziomowa (osie 5, 6) | 1 | 2 | 3–4 | 5 | 6 |
| 5-poziomowa (osie 2, 3, 7) | 1 | 2 | 3 | 4 | 5 |

### 4.2 Opisy behawioralne: co firma ROBI na każdym poziomie (per wymiar)

> Konwencja: opis behawioralny = obserwowalne zachowania, nie przymiotniki. Test: audytor musi umieć rozstrzygnąć poziom na podstawie dowodów (system, procedura, log, KPI), nie deklaracji.

**D1 Procesy cyfrowe** *(drabina natywna: Rejestracja danych → Kontrola stanowisk → Kontrola procesu → Automatyzacja → MES → ERP → Wsparcie AI)*
- **I** — Zdarzenia biznesowe (zamówienia, zlecenia, faktury) rejestrowane elektronicznie po fakcie; przebieg procesu poza systemem (telefon, e-mail, papier przy maszynie).
- **II** — Pojedyncze stanowiska/komórki mają narzędzia kontroli własnej pracy (arkusze, proste aplikacje, terminale); między stanowiskami dane przenosi człowiek.
- **III** — Proces end-to-end jest zdefiniowany, mierzony i częściowo zautomatyzowany; pojawiają się przepływy pracy (workflow), kody kreskowe, automatyczne raporty; kierownik widzi status procesu bez pytania ludzi.
- **IV** — Systemy klasy MES/ERP (lub odpowiedniki domenowe: CRM, WMS, QMS) prowadzą proces: harmonogramują, pilnują reguł, eskalują odchylenia; integracja międzydziałowa jest domyślna.
- **V** — AI wspiera lub przejmuje decyzje operacyjne (prognozy, harmonogramowanie, wykrywanie anomalii, automatyczna korespondencja); człowiek nadzoruje wyjątki, nie przebieg.

**D2 Produkty cyfrowe** *(drabina: Basic → Intermediate → Advanced → Interactive → Expert)*
- **I** — Produkt czysto fizyczny/usługowy; cyfrowa jest co najwyżej ulotka i cennik PDF.
- **II** — Produkt ma cyfrowe „opakowanie": dokumentacja online, konfigurator, podstawowa obsługa elektroniczna.
- **III** — Cyfrowe cechy są częścią wartości produktu: monitoring, aplikacja towarzysząca, treści i społeczność wokół produktu.
- **IV** — Produkt jest interaktywny i personalizowany: reaguje na dane użytkownika, uczy się preferencji, integruje się z ekosystemem klienta.
- **V** — Produkt cyfrowy generuje samodzielne strumienie wartości (dane, subskrypcje, sieć użytkowników); wersje fizyczna i cyfrowa są nierozdzielne.

**D3 Cyfrowe modele biznesowe** *(drabiny per obszar: e-commerce, platformy, as-a-service, sharing, monetyzacja danych)*
- **I** — Sprzedaż wyłącznie kanałami tradycyjnymi; brak przychodu, który istnieje dzięki cyfrowości.
- **II** — Pierwszy kanał cyfrowy działa (sklep www, obecność na marketplace), obsługiwany ręcznie, marginalny w przychodach.
- **III** — Kanały cyfrowe są istotną, mierzoną częścią przychodu; firma świadomie prowadzi min. jeden model poza prostą sprzedażą (platforma, abonament, wynajem).
- **IV** — Modele cyfrowe są personalizowane i skalowane (SEM/automatyzacja marketingu, dynamiczna oferta, samoobsługa klienta end-to-end).
- **V** — Firma monetyzuje dane i efekty sieciowe (płatne API/insighty, platforma wielostronna); potrafi uruchomić nowy model cyfrowy jako powtarzalną zdolność.

**D4 Dane i analityka** *(drabiny: zbieranie ręczne→optyczne/z maszyn; przechowywanie tradycyjne→hybrydowe; DBMS→ML)*
- **I** — Dane zbierane ręcznie, przechowywane w plikach lokalnych i segregatorach; raport = ktoś przepisuje liczby.
- **II** — Dane zbierane cyfrowo (formularze, skanery, część maszyn), składowane w rozproszonych bazach/dyskach; raporty okresowe z ręczną konsolidacją.
- **III** — Centralne repozytoria (bazy, hurtownia, chmura), ETL i narzędzia wizualizacji; jeden komplet liczb dla całej firmy; jakość danych zarządzana.
- **IV** — Analityka big data i symulacje w użyciu decyzyjnym; dane z maszyn i obiektów fizycznych (IoT) wpięte w analizę; architektura gotowa pod AI.
- **V** — Uczenie maszynowe w produkcji analitycznej; dane same wykrywają odchylenia i uruchamiają działania (closed loop); dane traktowane jak aktywo z właścicielem i rachunkiem wartości.

**D5 Technologia i infrastruktura** *(drabiny: komunikacja papier→chmura; obliczenia PC→edge/quantum)*
- **I** — Wymiana informacji papierowo/mailowo; obliczenia na pojedynczych komputerach; sieć „po kablu do drukarki".
- **II** — Sieć LAN/Ethernet spina biuro; serwery lokalne pod pojedyncze systemy; brak standardu integracji.
- **III** — Przemysłowa/segmentowana sieć (Industrial Ethernet, WLAN), architektura WAN/LAN, serwerownia lub chmura prywatna; systemy gadają przez interfejsy, nie przez eksporty.
- **IV** — Architektura chmurowa (public/hybrid) jako standard; skalowalna moc obliczeniowa na żądanie; integracja przez API/iPaaS.
- **V** — Edge computing przy maszynach, obliczenia elastycznie orkiestrowane (cloud+edge); infrastruktura jest produktem wewnętrznym z SLA, nie zbiorem urządzeń.

**D6 Ludzie i kultura** *(drabiny: przywództwo Pasywny→Transformacyjny; zmiana wg Kottera; kompetencje; innowacje; zasoby)*
- **I** — Przywództwo pasywne/autokratyczne wobec cyfryzacji; zmiany narzucane lub niepodejmowane; kompetencje cyfrowe przypadkowe.
- **II** — Lider dyrektywny: cyfryzacja „bo trzeba"; pojedyncze szkolenia zewnętrzne; zmiana ogłaszana, nie prowadzona.
- **III** — Przywództwo wspierające; działa koalicja zmiany i komunikacja wizji; systematyczne szkolenia (wewnętrzne i zewnętrzne), zespoły projektowe międzydziałowe; budżet i czas na rozwój są planowane.
- **IV** — Kultura innowacji jawnie zarządzana: promowanie pomysłów, eksperymenty z prawem do błędu, analiza trendów; mentoring i self-learning jako norma; zasoby (kapitał, eksperci, dane, technologia) dostępne na inicjatywy.
- **V** — Przywództwo transformacyjne; zmiana zinstytucjonalizowana (Kotter kroki 7–8); R&D i współpraca zewnętrzna (uczelnie, startupy, partnerzy) wpisane w strategię; organizacja uczy się szybciej niż otoczenie.

**D7 Cyberbezpieczeństwo** *(drabiny: strategia; ochrona sieci; ochrona danych; edukacja; incydenty)*
- **I** — Brak strategii bezpieczeństwa; antywirus i firewall „z pudełka"; hasła i dostępy nieuporządkowane; incydent = improwizacja.
- **II** — Podstawowa higiena: polityka haseł, backup, firewall zarządzany; świadomość zagrożeń u informatyków, nie w organizacji.
- **III** — Analiza ryzyka i plan działań; segmentacja sieci, VPN, kontrola dostępu i uwierzytelnianie; procedury postępowania z incydentami; cykliczne szkolenia z testami.
- **IV** — Bezpieczeństwo zarządzane systemowo: polityki wdrożone i audytowane (audytorzy wewnętrzni, plan audytów), SIEM/IDS z korelacją zdarzeń, monitoring i detekcja, testy planów awaryjnych, HR wpięty w strategię bezpieczeństwa.
- **V** — Ciągłe doskonalenie potwierdzone zewnętrznie (klasa ISO 27001): pełny cykl identyfikacja→reakcja→test→dokumentacja→poprawa; bezpieczeństwo mierzone i raportowane zarządowi jak wynik operacyjny.

**D8 Dojrzałość AI** *(drabina 5-poziomowa, wprost z kodu)*
- **I** — Dane fragmentaryczne, brak gotowości pod AI; użycie AI = prywatne eksperymenty pracowników, poza kontrolą firmy.
- **II** — Ustrukturyzowane dane w silosach; wspomaganie pracy (asystenci, automatyzacja dokumentów) w pojedynczych zespołach; podstawowe zasady użycia AI spisane.
- **III** — Dane scentralizowane i przygotowane pod AI; zintegrowane wsparcie decyzji w procesach; ogólnofirmowy framework governance AI; zorganizowany rozwój kompetencji.
- **IV** — Architektura danych w pełni AI-ready; procesy pół-autonomiczne (człowiek zatwierdza, AI prowadzi); ciągłe zarządzanie ryzykiem AI i monitoring modeli; AI jako rdzeń wybranych produktów; powszechna biegłość (AI fluency).
- **V** — Autonomiczna orkiestracja operacji i samodoskonaląca się inteligencja danych; oferta AI-native; governance etyczny i transparentny; organizacja AI-native w kompetencjach.

---

## 5. Ścieżka przejścia N→N+1 per wymiar (co konkretnie zbudować)

> Format: **przejście → 2–4 konkretne rzeczy do zbudowania** (system / praktyka / governance). To bezpośrednie wsad do generatora inicjatyw i sekcji „roadmapa" raportu. Reguła fundamentów: §7.3.

**D1 Procesy cyfrowe**
- **I→II:** elektroniczna rejestracja u źródła (nie post factum) w 2–3 procesach o największym wolumenie; standard danych podstawowych (indeksy, kontrahenci); właściciel procesu wskazany imiennie.
- **II→III:** mapowanie i standaryzacja procesu end-to-end (SOP); workflow dla obiegów zatwierdzeń; automatyczny raport operacyjny dzienny/tygodniowy; kody kreskowe/terminale tam, gdzie dane wpisuje człowiek.
- **III→IV:** wdrożenie/domknięcie systemu dziedzinowego (MES/ERP/CRM/WMS zależnie od luki) z integracją między działami; KPI procesowe w rytmie zarządczym; eliminacja podwójnego wprowadzania danych (integracje zamiast eksportów).
- **IV→V:** 2–3 przypadki użycia AI na procesach o największym koszcie odchyleń (prognoza, harmonogram, anomalie); pętla zamknięta alert→działanie→weryfikacja; pomiar efektu AI w złotówkach.

**D2 Produkty cyfrowe**
- **I→II:** cyfrowa warstwa obsługi produktu (dokumentacja online, konfigurator, portal zgłoszeń); pomiar użycia tej warstwy.
- **II→III:** funkcja cyfrowa wnosząca wartość (monitoring, aplikacja, treści); roadmapa produktu cyfrowego z ownerem po stronie biznesu, nie IT.
- **III→IV:** telemetria produktu + personalizacja na jej podstawie; integracje z ekosystemem klienta (API); proces discovery oparty o dane użycia.
- **IV→V:** model przychodowy na warstwie cyfrowej (subskrypcja, dane, usługi dodane); zespół produktowy z pełnym cyklem build-measure-learn.

**D3 Cyfrowe modele biznesowe**
- **I→II:** uruchomienie pierwszego kanału cyfrowego (e-commerce/marketplace) na istniejącej ofercie; podstawowa analityka konwersji.
- **II→III:** kanał cyfrowy z celem przychodowym i budżetem; pilotaż jednego modelu nietransakcyjnego (abonament, wynajem, platforma) na wycinku oferty.
- **III→IV:** automatyzacja marketingu i samoobsługa klienta end-to-end; dynamiczna personalizacja oferty; rachunek rentowności per kanał/model.
- **IV→V:** strategia monetyzacji danych (jakie dane, dla kogo, w jakiej formie, za ile) + pierwszy płatny produkt danych; zdolność uruchamiania nowego modelu w kwartał (playbook).

**D4 Dane i analityka**
- **I→II:** cyfrowe zbieranie danych u źródła (formularze, skanery, odczyty z kluczowych maszyn); jedna konwencja nazewnicza i miejsce składowania per dział.
- **II→III:** centralne repozytorium (hurtownia/lakehouse) + ETL z systemów źródłowych; narzędzie BI z jednym kompletem definicji wskaźników; proces zarządzania jakością danych (właściciele, reguły, czyszczenie).
- **III→IV:** dane maszynowe/IoT wpięte do analityki; analizy big data i symulacje w co najmniej 2 decyzjach cyklicznych (np. planowanie, utrzymanie ruchu); katalog danych.
- **IV→V:** modele ML w produkcji z monitoringiem (MLOps); automatyczne akcje na podstawie predykcji; wycena i rachunek wartości danych jako aktywa.

**D5 Technologia i infrastruktura**
- **I→II:** uporządkowana sieć LAN, centralny serwer plików/domena, inwentaryzacja sprzętu i systemów.
- **II→III:** segmentacja sieci (biuro/produkcja), przemysłowy Ethernet/WLAN tam gdzie maszyny, architektura integracji (szyna/API zamiast eksportów CSV).
- **III→IV:** strategia chmurowa (co public, co private, co on-prem) i migracja pierwszych obciążeń; skalowalna moc obliczeniowa na żądanie; IaC/standard środowisk.
- **IV→V:** edge computing przy procesach czasu rzeczywistego; orkiestracja obciążeń cloud+edge; infrastruktura jako produkt wewnętrzny z SLA i rachunkiem kosztów per usługa.

**D6 Ludzie i kultura**
- **I→II:** jawna deklaracja kierunku cyfrowego od zarządu; wskazanie lidera transformacji; pierwsze szkolenia dla kadry kierowniczej.
- **II→III:** koalicja zmiany (sponsor + liderzy obszarów); komunikacja wizji w rytmie (townhall, tablice); program szkoleń z budżetem; międzydziałowe zespoły projektowe.
- **III→IV:** system zgłaszania i nagradzania pomysłów; budżet na eksperymenty z jawnym prawem do porażki; mentoring i ścieżki kompetencji cyfrowych; przegląd trendów jako stały punkt agendy zarządu.
- **IV→V:** instytucjonalizacja (cele cyfrowe w ocenach i premiach); R&D i partnerstwa zewnętrzne w strategii; sukcesja kompetencji — organizacja rozwija liderów transformacji, nie wynajmuje.

**D7 Cyberbezpieczeństwo**
- **I→II:** polityka haseł + MFA; backup z testem odtworzenia; zarządzany firewall i antywirus; rejestr kont i dostępów.
- **II→III:** analiza ryzyka i plan postępowania; segmentacja sieci + VPN; procedury reagowania na incydenty (kto, co, w jakiej kolejności); coroczne szkolenie z testem dla wszystkich.
- **III→IV:** SIEM/IDS z korelacją; audyty wewnętrzne wg planu; testy planów awaryjnych (ćwiczenia); polityki bezpieczeństwa wpięte w HR (onboarding/offboarding, role).
- **IV→V:** system zarządzania klasy ISO 27001 (wdrożenie lub certyfikacja); pełna pętla doskonalenia po każdym incydencie i teście; raportowanie ryzyka cyber do zarządu w rytmie kwartalnym.

**D8 Dojrzałość AI**
- **I→II:** polityka użycia AI (co wolno, na jakich danych, jakie narzędzia); 2–3 pilotaże asystenckie w zespołach o pracy dokumentowej; podstawowa higiena danych pod pilotaże.
- **II→III:** centralizacja danych pod AI (patrz D4 III); framework governance (rejestr przypadków użycia, ocena ryzyka, właściciel); program kompetencji AI per rola.
- **III→IV:** procesy pół-autonomiczne z human-in-the-loop w 2–3 obszarach rdzeniowych; monitoring modeli (jakość, dryf, koszt); AI w co najmniej jednym produkcie/usłudze dla klienta.
- **IV→V:** orkiestracja wieloagentowa procesów operacyjnych; oferta AI-native; rada ds. etyki/transparentności AI z realnymi uprawnieniami; mierzony udział AI w wyniku firmy.

---

## 6. Scoring i agregacja (wzory jawne)

### 6.1 Definicje

Dla obszaru *a* o drabinie `Lmax(a)` ∈ {5, 6, 7}:

```
score_raw(a)   = achieved_level(a)                    ∈ {0, 1..Lmax(a)}   (0 = nieocenione)
score_norm(a)  = (achieved_level(a) − 1) / (Lmax(a) − 1)                  ∈ [0, 1]
target_norm(a) = (target_level(a) − 1) / (Lmax(a) − 1)
gap(a)         = max(0, target_norm(a) − score_norm(a))
```

Normalizacja liniowa min-max po drabinie natywnej: poziom 1 = 0.0, poziom maksymalny = 1.0. Dzięki temu osie o różnych drabinach są porównywalne na radarze bez przycinania treści.

### 6.2 Agregacje

```
Wynik wymiaru D:   S(D) = Σ_{a∈D} w(a)·score_norm(a) / Σ_{a∈D} w(a)      (domyślnie w(a)=1)
Wynik osi (7):     analogicznie po obszarach osi (dla widoków technicznych)
Wynik ogólny:      S = Σ_{D=1..8} W(D)·S(D) / Σ W(D)                      (domyślnie W(D)=1)
Poziom wymiaru:    I–V wg progów: [0–0.2) I · [0.2–0.4) II · [0.4–0.6) III · [0.6–0.8) IV · [0.8–1.0] V
Prezentacja:       procent 0–100% (S·100) + poziom I–V; NIE prezentujemy „x/7" klientowi
```

Zasady twarde:
- **Obszary nieocenione (score_raw = 0) nie wchodzą do średniej** — zamiast tego obniżają `completeness` i są jawnie listowane. Zakaz liczenia zera jako poziomu.
- **Wagi w(a), W(D) = 1 w wersji 1.0 kanonu.** Wagi branżowe to przyszła wersja MAP (wymaga danych, nie opinii).
- Uwaga wdrożeniowa: dzisiejsza implementacja (`calculateAxisScore`/`calculateOverallScore` w `src/services/drdStructure.ts`) uśrednia **surowe** poziomy między osiami o różnych skalach i liczy średnią po wszystkich wpisanych obszarach — do wyrównania z powyższym wzorem (normalizacja przed agregacją).

### 6.3 Dyscyplina dowodowa w scoringu

```
confidence(a) ∈ {evidence-backed, declared}    — poziom z dowodem vs deklaracja
confidence(D) = % obszarów wymiaru z dowodem
completeness  = liczba ocenionych obszarów / 39
```

Raport kliencki ma obowiązek pokazać `completeness` i `confidence` (metryka badania). Poziom „declared" jest oznaczany w macierzy obszarów. Wynik ogólny publikujemy przy `completeness ≥ 80%`; poniżej — raport ma status „diagnoza wstępna".

### 6.4 Wyróżnienie „Digital Frontrunner DRD" (propozycja — decyzja P2)

Analogicznie do ADMA „Factory of the Future": firma otrzymuje status **Digital Frontrunner**, gdy `S(D) ≥ 0.6` (poziom IV) **w każdym z 8 wymiarów** przy `completeness ≥ 90%` i `confidence ≥ 70%`. Element marki DBR77 — nazwa i progi do zatwierdzenia przez Piotra.

---

## 7. Priorytetyzacja i reguła fundamentów

### 7.1 Formuła priorytetu (wariant DRD wspólnego silnika V4 §4)

Dla każdego obszaru z luką (`gap(a) > 0`):

```
Priority(a) = [ w_b·BizImpact(a) + w_g·gap(a) + w_f·Foundation(a) ] / Effort(a)

BizImpact(a)  ∈ {1..5}  — wpływ domknięcia luki na wynik firmy (ocena konsultanta/AI propose→accept)
gap(a)        ∈ [0,1]   — z §6.1 (deterministyczne)
Foundation(a) ∈ {0,1}   — czy obszar jest fundamentem dla innych luk (graf §7.3)
Effort(a)     ∈ {1..5}  — koszt/czas/złożoność (ocena konsultanta/AI propose→accept)
wagi domyślne: w_b=0.5, w_g=0.3, w_f=0.2
```

Wynik: ranking obszarów → macierz impact×effort (quick wins / strategiczne / wypełniacze / unikać) → fale roadmapy.

### 7.2 Fale roadmapy (kanoniczne nazwy)

- **Fala 1 — Fundamenty (0–6 mies.):** obszary z Foundation=1 + quick wins (wysoki Priority, Effort ≤ 2).
- **Fala 2 — Skalowanie (6–18 mies.):** luki o wysokim BizImpact zależne od Fali 1.
- **Fala 3 — Przewaga (18–36 mies.):** poziomy IV→V, modele biznesowe, AI autonomiczne.

### 7.3 Graf zależności między wymiarami (reguła fundamentów)

```
D4 Dane  ──►  D8 AI          (bez danych ≥III nie ma AI ≥III)
D5 Infra ──►  D4 Dane        (bez sieci/mocy ≥II nie ma centralizacji danych)
D7 Cyber ──►  D3 Modele, D8 AI   (skalowanie kanałów/AI bez cyber ≥III = ryzyko niedopuszczalne)
D6 Ludzie ──► wszystkie      (żadne przejście →IV nie utrzyma się przy D6 < III)
D1 Procesy ──► D2 Produkty, D3 Modele   (cyfrowy front na analogowym zapleczu się wywraca)
```

Generator roadmapy MUSI respektować graf: inicjatywa podnosząca D8 do IV przy D4 = II dostaje automatyczny prerequisite z D4. To jest różnica między „listą pomysłów" a poradą, pod którą można się podpisać.

---

## 8. Profil referencyjny / benchmark

### 8.1 Mechanizm docelowy

Benchmark DRD budujemy z **własnych ocen na platformie** (jak ADMA „vs peers"): segment = branża × wielkość; publikacja segmentu od **n ≥ 10 ocen** (anonimizacja, mediana + kwartyle). Do tego czasu obowiązują profile eksperckie (§8.2) z jawną adnotacją w raporcie: *„profil referencyjny ekspercki DBR77; benchmark statystyczny w budowie"*.

### 8.2 Profile eksperckie v1 (⚠ hipoteza ekspercka — do kalibracji danymi DBR77)

Wartości = typowy poziom I–V rynku PL/CEE „solidny środek stawki", 2026:

| Wymiar | Produkcja dyskretna / automotive | Produkcja procesowa / batch | Usługi profesjonalne / SME |
|---|:--:|:--:|:--:|
| D1 Procesy | III–IV | III | III |
| D2 Produkty | II | II | III |
| D3 Modele biznesowe | II | II | III |
| D4 Dane i analityka | III | III | II–III |
| D5 Technologia i infra | III | III–IV | III |
| D6 Ludzie i kultura | II–III | II | III |
| D7 Cyberbezpieczeństwo | III | III | II–III |
| D8 Dojrzałość AI | I–II | I–II | II |

**Wymaga danych od DBR77 (jawnie):** (1) walidacja powyższych wartości na min. 10 zamkniętych ocenach per segment — źródłem mogą być oceny Apator/Elkomtech/VTS i kolejne; (2) decyzja, które segmenty branżowe są priorytetowe dla sprzedaży; (3) profil „best-in-class" per segment (potrzebny do formuły proximity w przyszłej wersji priorytetyzacji).

---

## 9. Mapowanie pytanie→wymiar→poziom — audyt qbanku i luka

### 9.1 Stan faktyczny (audyt 2026-07-02)

| Warstwa pytań | Stan | Ocena |
|---|---|---|
| `knowledge/tool-kb/drd/qbank/v1/drd-qbank.pl.md` | **31 linii**: zasady ogólne + 4 pytania uniwersalne + 4 pytania różnicujące. **Zero pytań per obszar/poziom.** | Wydmuszka. RAG coacha nie ma treści merytorycznej DRD do groundingu. |
| `drd-qbank.en.md` | 63 linie, ten sam charakter | j.w. |
| Runtime `src/services/assessmentKnowledge/drdKnowledge.ts` | 3 pytania per obszar×poziom generowane **szablonem** („Czy poziom N jest wdrożony jak opisano?", „Czy jest dowód?", „Czy działa w praktyce?") + technologie dobierane regexem z opisów | Mechanika jest, merytoryki brak: pytania są parafrazą opisu poziomu, nie pytaniami diagnostycznymi. |
| `DRD_KNOWLEDGE_OVERRIDES` (miejsce na pytania kuratorowane) | **puste** | 0/39 obszarów ma ręcznie napisane pytania. |

**Wniosek:** mapowanie pytanie→obszar→poziom istnieje **strukturalnie** (klucz `1A#3` jednoznacznie wiąże pytanie z obszarem 1A i poziomem 3 → przez §3.2 z wymiarem D1), ale **treściowo jest puste**. Luka dotyczy wszystkich 39 obszarów; łączna potrzeba: 39 obszarów × drabina (5/6/7) × 3 pytania ≈ **690 pytań diagnostycznych**.

### 9.2 Kanoniczny format qbank v2 (wiążący dla wypełnienia luki)

Każde pytanie ma identyfikator i pełne mapowanie:

```
ID:        DRD-{obszar}-L{poziom}-Q{n}        np. DRD-1F-L5-Q2
Mapuje na: obszar (→ oś → wymiar D1–D8 przez MAP-1.0) + poziom drabiny natywnej
Treść:     pytanie behawioralne (o zachowanie/artefakt, nie o samoocenę)
Dowód:     jakiego artefaktu oczekujemy przy „tak" (system / procedura / log / KPI / zrzut)
Sygnał:    co odpowiedź „nie" mówi o poziomie (potwierdza N−1 / neguje N)
Język:     PL + EN (pliki lustrzane)
```

Wzorzec jakości pytania: nie *„Czy macie MES?"*, tylko *„Kiedy ostatnio harmonogram produkcji zmienił się bez udziału planisty, bo system przeliczył go sam? Pokażcie ten przypadek."*

### 9.3 Plan wypełnienia (kierunek, bez kodu)

1. **Generacja wspomagana:** pytania-kandydaci generowane z opisów poziomów Mapy A (opisy są bogate, pochodzą z materiału książkowego) — po 3 na obszar×poziom, w formacie §9.2.
2. **Przegląd ekspercki:** akcept/kuratela per oś (właściciel merytoryczny: DBR77); minimum akceptowalne na start coacha: osie 1, 4, 7 (najczęściej badane).
3. **Wpięcie:** qbank v2 jako pliki `knowledge/tool-kb/drd/qbank/v2/*` (grounding RAG) + `DRD_KNOWLEDGE_OVERRIDES` zasilane z tego samego źródła (jedno źródło treści, dwa kanały konsumpcji).

---

## 10. Pozycjonowanie i nazewnictwo

- **Nazwa pełna:** rozjazd w kodzie/marketingu: „Digital Readiness **Diagnosis**" (kod, picker) vs „Digital Readiness **Diagnostic**" (materiały). Jedno słowo trafia na okładkę każdego raportu — decyzja P5.
- **Sygnatura własności:** DRD jest metodyką autorską DBR77 — raport nosi znak „DRD® by DBR77" lub „Consultify DRD" (decyzja P4). Nota metodyczna w każdym raporcie: wersja kanonu (np. „DRD Canon 1.0, MAP-1.0"), bez disclaimerów licencyjnych (nasze IP) — za to z klauzulą, że diagnoza opiera się na dowodach przedstawionych przez klienta.
- **Wersjonowanie widoczne dla klienta:** raporty porównawcze rok-do-roku wymagają tej samej wersji MAP; przy zmianie wersji raport przelicza historię wg nowej mapy i mówi to jawnie.

---

## 11. Governance kanonu

1. **Ten plik = SSOT metodyki.** Kod (`drdStructure` FE/BE), qbank, opisy w pickerze/deckach i materiały sprzedażowe są pochodnymi; rozbieżność z kanonem = bug P1.
2. **Zamrożone w v1.0:** struktura 7×39 (§2.3), mapowanie MAP-1.0 (§3.2), skala I–V i progi (§4.1, §6.2), wzory scoringu (§6), graf fundamentów (§7.3).
3. **Zmiana kanonu** wymaga: nowej wersji dokumentu + wpisu w changelogu poniżej + planu migracji wyników historycznych. Zmiany struktury pomiarowej (obszary/drabiny) — tylko w wersjach dużych (2.0).
4. **Otwarte pozycje v1.x:** wagi branżowe, benchmark statystyczny (§8.1), qbank v2 (§9.3), ewentualna mini-oś „Strategia" (P1).

**Changelog:** v1.0 (2026-07-02) — pierwsze zamrożenie; rozstrzygnięcie map A/B; mapowanie 7→8 (MAP-1.0); skala I–V; wzory scoringu; profile eksperckie v1.

---

## 12. Decyzje wymagane od Piotra (właścicielskie)

| # | Decyzja | Rekomendacja CTO |
|---|---|---|
| **P1** | **Radar 8D:** wariant „uczciwy pomiarowo" (D1–D8 wg §3.2, Strategia narracyjnie) czy wariant marketingowy ze „Strategią" jako ramieniem radaru (wymaga dobudowy ~3 obszarów pomiarowych)? | Wariant §3.2 teraz; mini-oś Strategia jako kandydat do kanonu 2.0. |
| **P2** | **Wyróżnienie „Digital Frontrunner DRD"** (§6.4): nazwa i progi (poziom IV we wszystkich 8 wymiarach) — zatwierdzić jako element marki? | Tak — daje klientom cel aspiracyjny i nam narrację sprzedażową. |
| **P3** | **Benchmark w raportach klienckich:** publikować profil ekspercki (§8.2) z adnotacją od razu, czy dopiero po kalibracji ≥10 ocen/segment? | Publikować od razu z adnotacją — raport bez odniesienia jest słabszy niż z jawnie oznaczoną hipotezą. |
| **P4** | **Branding raportu:** „DRD by DBR77" czy „Consultify DRD"? | „DRD by DBR77" na okładce, Consultify jako platforma w stopce. |
| **P5** | **Nazwa:** „Digital Readiness **Diagnostic**" czy „**Diagnosis**"? | Diagnostic (lepiej brzmi jako nazwa produktu; „diagnosis" sugeruje jednostkę chorobową). |
