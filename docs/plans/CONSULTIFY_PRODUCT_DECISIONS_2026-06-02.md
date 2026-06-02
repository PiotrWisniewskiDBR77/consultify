# Consultify — Katalog decyzji produktowo-biznesowych (przed planem rozwoju do 98/100)

**Data:** 2026-06-02
**Cel:** Zebrać decyzje właścicielskie/produktowe, które ukształtują detaliczny plan dokończenia softu (moduł po module, pełna integracja + pełna grafika).
**Założenie wstępne (potwierdzone przez właściciela):** Moduły **14 MCP IRIS** i **15 MCP Marketplace** wypadają z zakresu. Pozostałe **17 modułów** rozwijamy.
**Jak odpowiadać:** Przy każdej decyzji jest moja rekomendacja. Najszybciej: „akceptuję rekomendacje poza D-X, D-Y…" + Twoje warianty.

---

## ✅ Zarejestrowane odpowiedzi właściciela (2026-06-02)

- **D1 — ICP:** A + C (butikowy konsulting + firmy obsługujące wielu klientów). ✔ zgodne z rekomendacją.
- **D2 — Model sprzedaży:** C (hybryda). Start sales-led (B), cel: pełna automatyzacja self-serve (A). Ewolucja B → A.
- **D3 — Język:** **Angielski = język źródłowy/główny.** Wszystkie inne języki to tłumaczenia z EN. Start równolegle z klientami w PL i poza PL → potrzebne EN (źródło) + PL (tłumaczenie) na premierę.
- **D4 — Czas:** **6 dni, pełne dni, GA w niedzielę.** Właściciel pracuje ~18h/dobę z topowym AI. **Narzędzia (04) i Realizacja (06) MUSZĄ być w CORE od początku — to jest argument sprzedażowy.**
- **D6 — Rewizja zakresu (wg właściciela):**
  - **CORE GA (niedziela):** 01 Czat, 02 Moja Praca, 03 Wywiad, **04 Narzędzia**, 05 Inicjatywy, **06 Realizacja**, 09 Outputs, 10 Dokumenty, 11 Tabele, 12 Prezentacje, 16 Organizacja
  - **FAST-FOLLOW:** 07 Rezultaty, 08 Finanse, 17 Panel Admina, 18 Ustawienia
  - **PÓŹNIEJ:** 13 Meeting, 19 Portal Partnerski
  - **UKRYTE (rozwój później):** 14 MCP IRIS, 15 MCP Marketplace
  - *(Uwaga doradcza: minimalny podzbiór Ustawień i Admina będzie i tak potrzebny operacyjnie w v1 — rozdzielę „minimum operacyjne" od „pełny moduł" w planie.)*
- **D7 — IRIS + Marketplace:** chowamy całkowicie z produktu na ten moment, rozwój później.
- **D8 — Billing:** start od **ręcznych faktur + ręcznego nadawania limitów** (sprzedaż wśród znajomych). Stripe jest już podpięty do innych produktów właściciela → realne płatności da się dorobić szybko, ale nie są blokerem v1.
- **D9 — Pakiety:** właściciel prosi o propozycję pakietowania (sprzedażowo korzystne, ceny rynkowe). Kotwica: **1 seat ≈ 45 €** z określonym limitem tokenów i przestrzeni dyskowej; później add-ony. → **patrz `CONSULTIFY_PRICING_STRATEGY_2026-06-02.md`.**
- **D10 — Portal Partnerski: PRIORYTET (zmiana z „później").** Właściciel ma dużo zapytań partnerskich i chce mieć portal odpalony. → Moduł 19 przesuwam z „PÓŹNIEJ" do zakresu wczesnego.
  - *Uwaga doradcza:* moduł 19 jest dziś na 48/100 (12 endpointów = 503, zepsuty `/payouts` auth, `PerformanceSection` z hardkodem, demo-seed wycieka do prod). Do rozstrzygnięcia przy planie: **MVP partnerski** (rejestracja partnera + link referencyjny + podstawowy dashboard + atrybucja) na start, a pełne prowizje/wypłaty/licencje/faktury jako fast-follow — vs pełny portal od razu. Dochodzi też **model prowizyjny** (wpływa na pricing — dziś add-on Enterprise).
- **D11 — Teresa = rdzeń i symbol marki.** Teresa jest „symbolem prawdziwego konsultanta" i ogromną przewagą, bo **mało który produkt dziś realnie *rozmawia***. → Wymiar konwersacyjny (czat + **głos „mówiącej Teresy"**) to flagowy różnicownik, nie dodatek. Konsekwencje dla planu:
  - AI‑generowanie deliverabli (dok/deck/tabela) **musi być „world-class" w v1** (potwierdza rek. D11).
  - **Moduł 01 (Czat/Teresa) + warstwa głosowa** awansują do najwyższego priorytetu jakości/grafiki (hero‑feature, „wow" przy pierwszym kontakcie).
  - Waliduje to multimodal w pricingu (kredyty na głos, §4.C) — głos jest strategiczny, więc musi działać i być policzalny.
  - „Teresa rozmawia" powinna być widoczna w golden path (D5) i w demie sprzedażowym.
- **D12 — Źródło modeli AI: trzy osie (nie tylko BYOK).**
  1. **Platforma dostarcza** (Sonnet/Opus + image + voice przez API zewn.) — metrowane AI Credits = domyślne.
  2. **BYOK** — Enterprise może podłączyć dowolne własne klucze.
  3. **DBR77 Private/Dedicated AI** — strategiczny atut: DBR77 ma dostęp do serwerów i wstawia własne modele (np. Llama 3) jako **dedykowane prywatne API**; rozwija też **własny model `DBR77 Vector` (120B)** wyspecjalizowany w transformacji przemysłowej/operacyjnej (on‑prem / private API / isolated; „dane klienta nigdy nie trafiają do treningu"; serverless GPU, pay‑per‑use). Ref: vector.dbr77.com.
  - *Implikacje strategiczne:*
    - **Moat + marża:** własny model na własnej infrze = COGS staje się stały (nie per‑token API) → przy heavy‑userach radykalnie lepsza marża i możliwość pakietu „dedykowana pojemność" (flat) zamiast metrowanych kredytów.
    - **Suwerenność danych / on‑prem** = mocny argument Enterprise i compliance (spina się z D21) — wrażliwe dane konsultingowe nie wychodzą z sieci klienta.
    - **Synergia domenowa:** `DBR77 Vector` (operacje/przemysł) świetnie pasuje do modułów **04 Narzędzia** i **06 Realizacja** oraz ROI/ekonomii — Consultify może oferować „tryb operacyjny" napędzany własnym modelem.
    - **Pricing:** dodać ofertę **„Private / Dedicated AI (DBR77)"** jako add‑on Enterprise (flat za dedykowaną pojemność lub pay‑per‑use compute) — patrz strategia §5/§7.
- **D13 — Meeting: budujemy WŁASNE + wizja „Teresa na spotkaniu".**
  - Właściciel woli **własny stack** (nie integracja Recall.ai/Fireflies).
  - **Wizja docelowa (north‑star):** Teresa jest **żywym konsultantem w trakcie spotkania** — godzinne spotkanie, ona z nami: notuje na żywo, obsługuje Consultify (tworzy artefakty, podciąga dane, uruchamia narzędzia), reaguje. „Jak prawdziwy konsultant podłączony do kompa".
  - *Synergia:* spina się z D11 (głos „mówiącej Teresy"), D12 (własne serwery/GPU DBR77 → własna transkrypcja realtime tańsza i pod kontrolą) i agentowym działaniem Teresy w aplikacji.
  - *Uczciwe fazowanie (6 dni do GA):* pełna „live‑agentic Teresa na spotkaniu" to **flagowy roadmap, nie niedziela**. Proponowane etapy:
    - **Faza 0 (tania, możliwa szybko):** odsłonić `MeetingHub` (CRUD jest gotowy) + brief operatora; spotkania jako obiekt w systemie.
    - **Faza 1:** transkrypcja async + AI‑recap → notatki/decyzje/follow‑upy do Notatnika i Inicjatyw.
    - **Faza 2 (hero):** transkrypcja realtime (własny stack na infrze DBR77) + Teresa notuje na żywo.
    - **Faza 3 (north‑star):** Teresa agentowo *obsługuje Consultify* w trakcie spotkania (tworzy deliverable/insighty/zadania live).
- **D14 — Brand: kierunek Harvard/HBS (crimson) + dwuwarstwowy system kolorów.**
  - Logo Consultify już jest w repo (`Logo consultinity/`, `docs/branding/`).
  - **Pozycjonowanie:** leadership (w tym właściciel) to absolwenci **HBS** → marka ma mocno komunikować pedigree „klasy Harvard" (odpowiednik tego, czym elitarne prawo jest dla Harveya). Wiarygodność/autorytet = przewaga sprzedażowa, spina się z Teresą jako „prawdziwym konsultantem".
  - **System kolorów (dwuwarstwowy):**
    - *Warstwa marki/akcentów:* **Harvard Crimson `#A51C30`** + serif display do nagłówków + ink/parchment na landing/onboarding/Teresa.
    - *Warstwa użytkowa aplikacji:* zostaje **navy/neutral** (struktura, czytelność, stany). Crimson jako akcent na kluczowych CTA i „momentach marki", nie zalewa UI.
    - Kanon tokenów: `crimson` (brand) + `navy/neutral` (UI) + serif (display) / sans (UI).
  - **⚠️ Guardrail prawny (do trzymania się):** wolno mówić faktami „built/led by HBS alumni" i używać palety inspirowanej crimsonem; **NIE** używać logo/crestu/„Veritas" Harvardu ani sugerować afiliacji/endorsementu; przeformułować „mamy całą wiedzę Harvardu" → „frameworki/myślenie w duchu HBS", „wiedza konsultingowa klasy HBS". Ten sam efekt, zero ryzyka sporu.
  - *Do planu (design system):* zbudować warstwę tokenów brandowych (crimson + serif) na istniejącym systemie navy; to jest część naprawy „bałaganu" (jeden kanon).
  - **✔ Guardrail zaakceptowany przez właściciela:** zna i respektuje zasady HBS — żadnego logo, żadnego sugerowania afiliacji/stowarzyszenia. Duma z networku i wartości. Copy marki gra pedigree faktami i „w duchu HBS", bez znaków towarowych.
- **D15 — Poziom grafiki: zgodnie z rekomendacją.** (b) **Linear/Notion** dla aplikacji (premium, dopracowany) + (c) **Gamma/Canva** dla deliverabli (Dok/Deck/Tabela). „Pełna grafika" obejmuje też **ilustracje, empty‑states i onboarding**. To jest poprzeczka jakości dla całego planu UI/grafiki.
  - **Język wizualny = „tech 2026":** mocna **okrągłość** (duże border‑radius), miękkie cienie, sporo światła, czysto i minimalistycznie — w stylu **Google / OpenAI / Apple**. To jest nasz styl bazowy UI. Właściciel chce kontynuować obecny rounded look.
  - *Do pogodzenia w design‑systemie:* napięcie „prestiż HBS (serif/crimson)" × „rounded modern (OpenAI/Apple)". Rozwiązanie: **rounded, miękki sans jako UI**, crimson jako akcent marki; serif (jeśli zostaje) tylko na wybrane momenty brandowe/editorial (landing, hero, okładki deliverabli) — albo zastąpiony premium geometrycznym sansem, jeśli lepiej leży. Domknę przy design‑systemie.
- **D16 — Responsywność: OK z rekomendacją.** Desktop‑first (klucz) + responsywne tylko ekrany krytyczne (login, dashboard, podgląd deliverable). Pełne mobile później.
- **D17 — White‑label: OK z rekomendacją.** Nie w v1 (ewentualnie Enterprise później).
- **D18 — Collaboration: OK z rekomendacją.** Solidny single‑user first; presence/multiplayer jako fast‑follow.
  - *Warstwa realtime (WS):* aplikacja **już ma serwer Socket.IO** (`server/src/index.ts:1770`, realtime Tabel) — brakuje tylko wpięcia funkcji (np. collab prezentacji `/ws/presentations/*` bez handlera). **Railway obsługuje WS na tym samym porcie** co backend — bez osobnego serwisu; Redis adapter dopiero przy wielu instancjach.
  - *Decyzja architektoniczna do planu:* **jedna wspólna warstwa realtime** (Socket.IO/Railway) dla: presence/collab + streaming AI + głos Teresy (D11) + transkrypcja spotkań (D13). Jeden gateway, wiele zastosowań — fundament pod hero‑features.
- **D19 — Dane demo: TAK dla twardej bramki + kanoniczny tenant = Atelier Toys.**
  - **Twarda bramka:** demo tylko na jawny flag tenanta; **koniec z fallbackiem demo przy 404/503** i na `localhost`/`DEV` w ścieżkach prod (naprawa wycieków z audytu, 8 modułów).
  - **Kanoniczny demo‑org = „Atelier Toys"** (fikcyjna firma; istnieje już seed `db:seed:atelier` + `build-demo-dataset.ts`). **Dane demo mają być spójne z publiczną stroną https://ateliertoys.com.**
  - **Profil firmy (do seedu — ze strony):** edtech / produkcja STEM; B2B przez sieć dystrybutorów edukacyjnych; zał. **1948**, Lyon (HQ: 12 Avenue des Ingénieurs + Innovation Campus 45 Rue de l'Automatisation, 18 500 m² w 2 fabrykach); **1,2 mln+ subskrybentów aplikacji, 4 000+ instytucji, 45 krajów**. Produkty: **Atelier Core** (drewniane komponenty STEM CNC z czujnikami magnet.), **Atelier Motion** (łazik robot, steppery + LiDAR, drewniane podwozie), **Atelier Digital** (SaaS, Digital Twin). Wartości: 100% produkcja europejska, oak FSC, net‑zero, ISO 9001/14001; nagroda STEM Toy of the Year 2024. **Narracja: transformacja 2015** („tradycyjny producent z kurczącą się marżą → dane/automatyzacja/governance"; case „Ateliertoy Forward"). Ton: premium, technicznie rygorystyczny, heritage, długi horyzont.
  - *Synergia:* to operacyjno‑przemysłowy case → idealny pod golden path (D5) i pod **DBR77 Vector** (D12). Demo = ta sama historia, którą sprzedaje Consultify.
  - *Do planu:* zaudytować istniejący seed Ateliera i **dociągnąć go do profilu z public site**, potem twardo zbramkować demo wszędzie indziej.
- **D20 — Definicja „market‑ready / 98/100": ZATWIERDZONA.** Każdy widoczny element działa · zero placeholderów/„coming soon" w ścieżce płatnej · jeden spójny shell na ekran · wszystko wpięte do backendu (brak cichych 503) · smoke‑test per moduł · i18n kompletne dla EN (źródło) + PL · spójne tokeny/grafika (Linear/Notion + Gamma/Canva dla outputów). To jest oficjalna Definition of Done dla planu.
- **D21 — Compliance: OK z rekomendacją.** GDPR w v1 (pewne). SSO/SCIM + DPA + SOC 2‑readiness jako Enterprise fast‑follow (nie blokuje premiery; przygotowanie pod większe deale). Spina się z DBR77 on‑prem/private (D12) jako argument data‑sovereignty.
- **D22 — Onboarding + przełącznik danych demo w ustawieniach (pomysł właściciela).**
  - TAK dla onboardingu/empty‑states/sample project jako części „gotowości".
  - **Kluczowy mechanizm:** w **menu Ustawień użytkownika** przełącznik **„Pokaż dane demo (Atelier Toys)"** — user może w każdej chwili włączyć/wyłączyć i obejrzeć w pełni wypełniony workspace demo.
  - *To jest realizacja „jawnego flagu" z D19* — demo nigdy automatycznie/po cichu; zawsze świadoma decyzja usera.
  - **Zasady wykonania (do planu):** demo jako **osobny, wyraźnie oznaczony kontekst workspace** („DEMO — Atelier Toys", badge); **read‑only / sandbox** (nie da się popsuć ani zmieszać z realnymi danymi); przełączenie OFF wraca do realnego workspace; służy też jako onboarding dla pustego konta („zobacz, jak wygląda gotowy projekt → zbuduj swój").
- **D5 — Nie jeden golden path, lecz WIELE ścieżek wejścia (per persona / „zależy kto wchodzi").**
  - Ścieżki wejścia wskazane przez właściciela: **Teresa / Czat (+ Canvas)**, **Tools (frameworki)**, **Assessment (diagnostyka/dojrzałość)**, **Wywiad (discovery)**, **Model finansowy (business case/ROI)**.
  - **Mapowanie na persony (robocze):** Czat/Teresa = każdy, kto chce „pogadać z konsultantem" (najszersze, hero marki) · Tools = strateg lubiący frameworki · Assessment = ktoś prowadzący diagnozę/maturity · Wywiad = konsultant zbierający input interesariuszy · Model finansowy = budujący business case / typ CFO.
  - **Architektura „hub‑and‑spoke":** wiele drzwi wejściowych → **wspólny kręgosłup** (Insighty → Inicjatywy → Rezultaty) → **warstwa outputów** (Deliverable generowany przez Teresę → Outputs). Teresa rozmawia na każdym kroku (D11); wszystko opowiedziane na case'ie **Atelier Toys** (D19).
  - *Rekomendacja wykonawcza (6 dni):* perfekcyjnie dopracować **wspólny kręgosłup + warstwę outputów** (to dzielone przez wszystkie ścieżki) oraz **każde wejście solidnie**; jeśli czas ciśnie, „olśniewające" w pierwszej kolejności: **Teresa/Czat + Tools + Assessment** (najczęstsze pierwsze demo), Wywiad i Model finansowy zaraz za nimi.
  - *Uwaga (rozdzielenie pojęć):* „**Model finansowy**" jako ścieżka = narzędzie konsultingowe (business case/ROI dla klienta), to **co innego niż nasz billing**. Financial‑modeling musi być solidny w v1 jako ścieżka wejścia, nawet jeśli moduł 08 *w części billingowej* zostaje fast‑follow (D6/D8).

---

## ✅ Wszystkie decyzje (D1–D22) zarejestrowane — gotowe do planu

### Podział na fale (decyzja właściciela 2026-06-02)
- **WAVE 1 (priorytet, „Sunday push"):** kręgosłup konsultingowy + ścieżki wejścia + Teresa. Moduły: **01 Czat/Teresa, 02 Moja Praca, 03 Wywiad, 04 Narzędzia (w tym Assessment), 05 Inicjatywy, 06 Realizacja, 09 Outputs, 16 Organizacja** + ścieżka **Model finansowy** (samo narzędzie modelowania, nie billing) + fundamenty przekrojowe (design‑system crimson/rounded, bramka demo + Atelier, realtime/voice base, auth/onboarding/i18n EN+PL, minimalny operacyjny podzbiór Ustawień/Admina, higiena/P0).
- **WAVE 2:** **12 Prezentacje (Deck), 11 Tabele (Excel), 10 Dokumenty (Word)** — studia deliverabli do jakości Gamma/Canva; + dociągnięcie fast‑follow (07 Rezultaty pełne, 08 Finanse/billing, 17 Admin pełny, 18 Ustawienia pełne, 19 Partner pełny).
- **LATER:** 13 Meeting (własny stack, fazowo). **UKRYTE:** 14 IRIS, 15 Marketplace.

Następny krok: detaliczny plan moduł‑po‑module do 98/100 — najpierw Wave 1.

---

## Obszar 1 — Rynek i pozycjonowanie (kto kupuje i jak sprzedajemy)

**D1. Główny odbiorca (ICP)?**
Opcje: (a) solo/butikowa firma konsultingowa, (b) wewnętrzny zespół strategii w korporacji, (c) firma konsultingowa obsługująca wielu swoich klientów (multi-client), (d) mix.
→ *Rekomendacja:* (a)+(c) — butikowy konsulting jako podstawowy ICP („Harvey dla konsultingu"). To determinuje, że perfekcyjne muszą być: Wywiad → Insighty → Inicjatywy → Deliverable.

**D2. Model sprzedaży i wejścia?**
(a) self-serve (rejestracja + karta od razu), (b) sales-led (demo → onboarding ręczny), (c) hybryda.
→ *Rekomendacja:* (b) na start, ewolucja do (c). Konsekwencja: realny billing Stripe może poczekać (patrz D8).

**D3. Język interfejsu na start?**
(a) PL-first, (b) EN-first, (c) pełna dwujęzyczność PL+EN na premierę.
→ *Rekomendacja:* potrzebuję Twojej decyzji — to duży nakład na i18n. Domyślnie proponuję (c) dla rynku międzynarodowego, ale jeśli pierwsi klienci są PL, to (a) i EN jako fast-follow.

**D4. Horyzont/twarda data GA?**
Czy jest deadline (event, runda, klient pilotażowy)?
→ *Rekomendacja:* podaj datę lub „brak twardej" — plan rozpiszę w falach, ale sekwencja zależy od presji czasu.

---

## Obszar 2 — Zakres v1 (co musi być perfekcyjne na premierę)

**D5. „Golden path" — jeden przepływ E2E, który MUSI być bezbłędny i olśniewający?**
Kandydat: **Wywiad → Insighty → Inicjatywy → Rezultaty → Deliverable (Dok/Deck/Tabela) → Outputs**.
→ *Rekomendacja:* zatwierdź ten golden path jako „showcase #1". Na nim koncentrujemy najwięcej grafiki i integracji; reszta dostaje solidny, spójny standard.

**D6. Kategoryzacja 17 modułów na poziomy priorytetu v1.** Moja propozycja (do akceptacji/korekty):

| Poziom | Moduły | Uzasadnienie |
|---|---|---|
| **CORE GA (perfekcja)** | 01 Czat/Teresa, 03 Wywiad, 02 Moja Praca, 05 Inicjatywy, 07 Rezultaty, 09 Outputs, 10 Dokumenty, 11 Tabele, 12 Prezentacje, 16 Organizacja, 18 Ustawienia | Rdzeń wartości + golden path |
| **FAST-FOLLOW (solidne, nie perfekcja)** | 04 Narzędzia, 06 Realizacja, 17 Panel Admina | Ważne, ale nie blokują pierwszej sprzedaży |
| **PÓŹNIEJ** | 08 Finanse/Billing, 13 Meeting, 19 Portal Partnerski | Duży nakład / zależne od modelu sprzedaży |
→ *Rekomendacja:* zaakceptuj lub przesuń moduły między poziomami.

**D7. Co robimy z kodem IRIS + Marketplace?**
(a) usunąć całkowicie, (b) ukryć z nawigacji + zarchiwizować kod (feature-flag OFF), (c) zostawić jako „coming soon".
→ *Rekomendacja:* (b) — ukryć z sidebara i mapy, kod zostawić za flagą (backend MCP jest realny i przyda się później). NIE „coming soon" w UI.

---

## Obszar 3 — Monetyzacja i billing

**D8. Realne płatności (Stripe) w v1 czy faktury manualne na start?**
→ *Rekomendacja:* faktury manualne + ręczne nadawanie planu na start (sales-led). Odblokowuje to moduł 08 z krytycznej ścieżki (dziś płatność kartą jest fałszywa) — Stripe jako oddzielny strumień, gdy ruszymy self-serve.

**D9. Plany/pakiety — ile i czym się różnią?**
Czy są tiery (np. Starter/Pro/Enterprise)? Co różnicuje: limity (liczba projektów/AI), dostęp do modułów premium, liczba miejsc?
→ *Rekomendacja:* zdefiniuj 2–3 tiery na wysokim poziomie — wpłynie to na bramki dostępu i Ustawienia/Admin.

**D10. Portal Partnerski (19) — kanał resellerski w zakresie v1?**
→ *Rekomendacja:* PÓŹNIEJ. Dziś 12 endpointów to 503; inwestycja sensowna dopiero, gdy jest strategia kanału.

---

## Obszar 4 — AI / Teresa (różnicownik)

**D11. Jak centralna jest Teresa? Czy AI-generowanie deliverabli (dok/deck/tabela) musi być „world-class" w v1?**
→ *Rekomendacja:* TAK — to główny różnicownik vs zwykłe narzędzia PM. Generowanie treści w Dokumentach/Prezentacjach/Tabelach musi dawać efekt „gotowe do klienta", nie placeholder.

**D12. Klucze AI: platforma dostarcza (wliczone w cenę, limity per plan) czy BYOK (klient wnosi swój klucz)?**
→ *Rekomendacja:* platforma dostarcza + limity per plan; BYOK jako opcja Enterprise później.

**D13. Meeting (13) — czy przechwytywanie/transkrypcja spotkań jest w v1?** Jeśli tak: budować własne, czy integracja (Fireflies / Recall.ai / Zoom)?
→ *Rekomendacja:* defer do fast-follow; jeśli jednak v1 — integracja (Recall.ai/Fireflies), nie własny stack audio. `MeetingHub` jest gotowy, więc CRUD spotkań możemy odsłonić tanio nawet bez transkrypcji.

---

## Obszar 5 — Grafika, brand, design system (Twój ból #1: „grafiki nie są jednorodne")

**D14. Czy istnieje zdefiniowany brand (kolory, typografia, logo) i źródło prawdy (Figma)?** Czy paleta `navy` z `tailwind.config.js` ma być kanonem, do którego migrujemy wszystko?
→ *Rekomendacja:* ustal jeden kanon tokenów (proponuję `navy`/`primary` z configu) i jeśli masz Figmę — podłączymy ją jako SSOT. To warunek ujednolicenia UI.

**D15. Poziom „pełnej grafiki" — jaki jest wzorzec jakości?**
(a) czysto-funkcjonalny i spójny, (b) poziom Linear/Notion (dopracowany, premium), (c) poziom Gamma/Canva dla samych deliverabli (bogata grafika outputów).
→ *Rekomendacja:* (b) dla aplikacji + (c) dla outputów (Dok/Deck/Tabela). Czy „pełna grafika" obejmuje też ilustracje, empty-states i onboarding? (zakładam, że tak).

**D16. Responsywność/mobile w v1?**
(a) desktop-first (klucz), (b) responsywne kluczowe ekrany, (c) pełne mobile.
→ *Rekomendacja:* (a)+(b) — desktop-first, responsywne tylko ekrany krytyczne (login, dashboard, podgląd deliverable). Pełne mobile później.

**D17. White-label (firmy klienckie rebrandują UI)?**
→ *Rekomendacja:* NIE w v1.

---

## Obszar 6 — Współpraca i dane

**D18. Real-time collaboration (whiteboard, co-edycja decków/dokumentów) w v1?**
→ *Rekomendacja:* single-user solidny first; presence/multiplayer jako fast-follow (dziś kolaboracja jest wyłączona w kodzie, a serwera WS brak).

**D19. Strategia danych demo (krytyczne dla wiarygodności).**
Czy akceptujesz: kuratorowany **tenant demo** do sprzedaży/onboardingu + **twarda bramka** odcinająca dane demo od realnych tenantów (koniec z fałszywymi danymi przy 404/503)?
→ *Rekomendacja:* TAK. Plus osobny „sales demo mode" jako kontrolowana funkcja.

---

## Obszar 7 — Definicja jakości „98/100", bezpieczeństwo, onboarding

**D20. Definicja „market-ready / 98/100" — akceptujesz tę?**
Każdy widoczny element działa; **zero placeholderów/„coming soon" w ścieżce płatnej**; jeden spójny shell na ekran; wszystko wpięte do backendu (brak cichych 503); smoke-test per moduł; i18n kompletne dla wybranych języków; spójne tokeny/grafika.
→ *Rekomendacja:* zatwierdź lub dopisz kryteria (np. wydajność, dostępność).

**D21. Postawa compliance dla ICP?**
GDPR (jest) — na pewno. Czy ICP wymaga SOC2 / twardego enterprise security (audyt, SSO/SCIM, DPA)?
→ *Rekomendacja:* GDPR w v1; SSO/SCIM i SOC2-readiness jako Enterprise fast-follow.

**D22. Onboarding / empty-states / sample project jako element „gotowości"?**
→ *Rekomendacja:* TAK — pierwszy ekran po rejestracji to projekt-przykład + szablony + przewodnik. To podnosi odbiór jakości bardziej niż niejedna funkcja.

---

## Jak procedujemy dalej
1. Odpowiadasz na D1–D22 (możesz hurtem: „akceptuję poza…").
2. Na tej podstawie buduję **detaliczny plan moduł-po-module do 98/100**: dla każdego z 17 modułów — stan obecny → docelowy, backlog P0/P1/P2 z konkretnymi plikami, pełny wiring backendu, kompletna specyfikacja UI/grafiki (shell, tokeny, stany, empty/loading/error, onboarding), kryteria akceptacji i testy, oraz przekrojowe strumienie (design system, demo-data, testy, bezpieczeństwo).
3. Sekwencjonuję to w fale z zależnościami i właścicielami.
