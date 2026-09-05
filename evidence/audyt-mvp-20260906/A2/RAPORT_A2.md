# RAPORT A2 — Audyt gotowości MVP, 2026-09-06 (sesja nocna 05/06.09)

Stanowisko: lokalne, frontend `http://localhost:3090` → API `127.0.0.1:4100`, Postgres lokalny
z seedami (org DBR77, konto `audyt@dbr77.local`). Sesja Playwright `auth-A.json`. Zrzuty w
`evidence/audyt-mvp-20260906/A2/*.png` (+ `.png.json` z `tekst`/`bledyKonsoli`/`dom`).

## ⚠️ ZDARZENIE KRYTYCZNE W TRAKCIE AUDYTU — przerwało dalszy pomiar

W trakcie sesji (ok. 23:2x), między kolejnymi zrzutami, katalog roboczy `/private/tmp/m03`
**stracił `src/`, `public/`, `.github/`, `.husky/`, `.nx/`, `.cursor/`, `.agent/` oraz
`scripts/dev/odbior-zywo/`** (m.in. sam skrypt do zrzutów, `zrzut.mjs`, zniknął z dysku w
połowie audytu — kolejne wywołanie zwróciło `Cannot find module`). `git status` w tym momencie
zgłosił: **„You are in a sparse checkout with 1% of tracked files present."** — ktoś (inny
proces/agent współdzielący ten sam worktree, zgodnie z wcześniejszym wzorcem „Współdzielony
worktree m03 — kilka rąk naraz") zawęził `git sparse-checkout` na żywo. Dowód pośredni: dysk
`/` przeszedł ze 124–137 MiB wolnego (99–100% zajęte) na **6,0 GiB wolnego (67%)** dokładnie
w tym samym oknie czasowym — spójne z kolapsem >99% wcześniej wymaterializowanych plików.
Serwery `:3090`/`:4100` odpowiadały nadal (200/200) w chwili sprawdzenia, ale każda kolejna
próba użycia skryptów w `scripts/dev/` na dysku kończyła się błędem braku pliku.

**Nie próbowałem naprawiać** (zakaz restartu/pkill/edycji w zleceniu; to nie mój worktree do
naprawy). Efekt: **wszystkie kroki poniżej wykonane PRZED tym zdarzeniem są w pełni wiarygodne
(realny runtime, realne zrzuty)**; wszystko, co wymagałoby dodatkowych zrzutów/kliknięć PO tym
momencie (przepływy klikane poza pierwszym ekranem, Teresa per moduł, ciemny motyw, 1280/1920 px,
weryfikacja `docs/program/ODBIOR_CTO_20260905/*` — ten katalog też już nie istnieje na dysku)
**jest oznaczone „NIE ZMIERZONE" wprost, nie zgadywane.** To osobny, pilny temat dla nadzorcy:
ktoś inny na tym samym `m03` może właśnie tracić niecommitowaną robotę.

---

## Metoda

Dla każdego modułu: zrzut 1440×900 (skrypt wymuszał 1440 niezależnie od parametru), jasny motyw,
`--dom=body` (pełny tekst DOM) + `--dom=aside` (liczba paneli bocznych), błędy konsoli z
Playwright. Dla dwóch podejrzeń wskazanych w zleceniu (Inicjatywy=0, raport Oceny pusty)
dodatkowo: wywołania API bezpośrednio z tokenem sesji (`curl` + JWT z `auth-A.json`) i `grep`/
`git show HEAD:<plik>` po realnym kodzie źródłowym (repo w trybie sparse-checkout, więc część
odczytów zrobiona przez `git show HEAD:<path>`, co omija stan dysku).

---

## 1. Czat AI (`/chat`)

| # | ekran/krok | co | wynik | dowód | waga | plik:linia |
|---|---|---|---|---|---|---|
| 1.1 | Ekran startowy 1440 | zrzut, błędy konsoli, tekst DOM | OK — 0 błędów konsoli, brak angielskich słów/UUID/SCREAMING/kluczy i18n z listy | `01-chat-flagowy.png(.json)` | — | — |
| 1.2 | Otwarcie starszej rozmowy (ekran flagowy wg audytu wcześniejszego) | plakietka źródeł, dane testowe w historii | **NIE ZMIERZONE w tej sesji** — nie kliknąłem w konkretną starszą konwersację przed utratą narzędzia | brak | — | wg dok. naprawczego: `src/components/AIChat/TrustBadge.tsx:384`, `server/src/routes/ai.routes.ts:6446` |
| 1.3 | Teresa (moduł to sam Teresa) | — | nie dotyczy jako osobny check | — | — | — |

**Werdykt Czat AI: NIE ZMIERZONE w pełni** — ekran startowy czysty, ale flagowy ekran „otwarta
konwersacja" (znana z wcześniejszego audytu usterka: angielski fallback w plakietce źródeł) nie
został ponownie zweryfikowany na żywo w tej sesji z powodu zdarzenia krytycznego. Traktować
wcześniejsze ustalenia (`II_EKRANY_FLAGOWE.md` §1) jako wciąż otwarte, nie jako naprawione.

---

## 2. Moja Praca (`/my-work` — Skrzynka)

| # | ekran/krok | co | wynik | dowód | waga | plik:linia |
|---|---|---|---|---|---|---|
| 2.1 | Skrzynka, lista 1440 | zrzut, konsola, DOM | OK — 0 błędów konsoli, 0 aside otwartych domyślnie, tabela pełna (8 kolumn widocznych na 1440, nagłówki nie ucięte) | `07-mywork-flagowy.png(.json)` | — | — |
| 2.2 | Klik w wiersz „DBR77: Ustawić polityki bezpieczeństwa..." → podgląd | przepływ klikany | **NIE WYKONANE** — skrypt zrzutu zniknął z dysku w trakcie próby (zdarzenie krytyczne), komenda zwróciła `Cannot find module '.../zrzut.mjs'` | brak zrzutu | — | — |
| 2.3 | 1280 px — czy wszystkie kolumny mieszczą się bez ucinania (znana uwaga właściciela) | szerokość viewportu | **NIE ZMIERZONE** — skrypt zrzutu ma szerokość zablokowaną na 1440 (brak parametru szerokości), więc nie da się nim odtworzyć zgłoszenia właściciela o 1280 px | — | — | `src/components/shared/ModuleHub/FilterableTable.tsx:788-789` (cytowane w dok. naprawczym, nie zweryfikowane ponownie tu) |
| 2.4 | Panel Teresy — da się zamknąć/przywrócić | P1 z dok. naprawczego | **NIE ZMIERZONE** — utrata narzędzia przed testem | — | — | wzorzec docelowy: `src/components/standard/ArtifactRightPanel.tsx` |

**Werdykt Moja Praca: GOTOWY Z KOSMETYKĄ na tym, co zmierzone (ekran startowy czysty przy 1440);
znane zgłoszenia właściciela o 1280 px i panelu Teresy pozostają NIE ZMIERZONE dziś — nie
potwierdzam ani nie zaprzeczam ich naprawie.**

---

## 3. Wywiad (`/interview`)

| # | ekran/krok | co | wynik | dowód | waga | plik:linia |
|---|---|---|---|---|---|---|
| 3.1 | Skrzynka, lista 1440 | zrzut, konsola, DOM | OK technicznie — 0 błędów konsoli | `02-interview-flagowy.png(.json)` | — | — |
| 3.2 | Kolumna NAZWA | wszystkie 3 wiersze pokazują identyczną nazwę „Wywiad" (tak samo jak TYP) — nie do odróżnienia bez otwierania | Zachowanie **zamierzone** wg testu istniejącego (`InterviewHub.smoke.test.tsx:294-296`: „TYP and NAZWA columns both show the template name") — to nie defekt kodu, ale realny wygląd na żywych danych jest słaby: 3 identyczne wiersze | zrzut `02-interview-flagowy.png` | KOSMETYKA | `src/components/Interview/__tests__/InterviewHub.smoke.test.tsx:294` (komentarz potwierdzający zamierzone zachowanie) |
| 3.3 | Przepływ klikany (Skrzynka→sesja→powrót) | — | NIE WYKONANE (zdarzenie krytyczne) | — | — | — |

**Werdykt Wywiad: GOTOWY Z KOSMETYKĄ** (ekran startowy czysty; identyczne nazwy sesji to
kosmetyczna słabość seed-danych/domyślnego nazewnictwa, nie blokada).

---

## 4. Narzędzia (`/discovery-tools`)

| # | ekran/krok | co | wynik | dowód | waga | plik:linia |
|---|---|---|---|---|---|---|
| 4.1 | Biblioteka, lista 1440 | zrzut, konsola, DOM | OK — 0 błędów konsoli, tabela pełna | `03-tools-flagowy.png(.json)` | — | — |
| 4.2 | Nazwy narzędzi po angielsku („Dynamic SWOT", „Market Forces (Porter)", „Value Chain Analysis"...) | to nazwy własne metodyk konsultingowych (standard branżowy), nie stringi UI | Ocena: **nie flaguję jako defekt** — to nazewnictwo referencyjne (SWOT/Porter/Ansoff są rozpoznawalne globalnie), analogicznie do nazw metodyk w module Ocena (ADMA/SIRI/CMMI/DRD/LEAN) | zrzut | — | — |
| 4.3 | 35/36 narzędzi oznaczone „Już wkrótce" / „Nieaktywny" | realny stan produktu — większość biblioteki jest niefunkcjonalna | Jeśli to ma być pokazane jutro jako gotowe MVP — **ryzyko wizerunkowe**: użytkownik widzi 36 pozycji, z których tylko 1 działa (Dynamic SWOT) | zrzut | WAŻNY | `03-tools-flagowy.png` (tekst DOM: „Już wkrótce" ×10+ w pierwszym ekranie) |

**Werdykt Narzędzia: GOTOWY Z ZASTRZEŻENIEM** — ekran techniczny czysty, ale merytorycznie to
lista złożona głównie z pozycji „już wkrótce"/nieaktywnych; to nie jest defekt UI, ale realny stan
produktu, który właściciel powinien świadomie zaakceptować przed demo (może zawstydzić, jeśli ktoś
kliknie cokolwiek poza SWOT).

---

## 5. Ocena (`/assessment`)

| # | ekran/krok | co | wynik | dowód | waga | plik:linia |
|---|---|---|---|---|---|---|
| 5.1 | Biblioteka, lista 1440 | zrzut, konsola, DOM | OK — 0 błędów konsoli | `04-assessment-flagowy.png(.json)` | — | — |
| 5.2 | **`/assessment/outputs/assess-drd-enterprise-01/report`** (assessment „DRD — Finalny (Enterprise)", status APPROVED, progress 100%, zweryfikowane przez `GET /api/assessments`) | wejście na trasę raportu dla ukończonej/zatwierdzonej oceny | **POTWIERDZONE: trasa przekierowuje na `/assessment?tab=outputs`** zamiast pokazać raport — flaga `isAssessmentOutputArtifactsEnabled()` jest domyślnie OFF, więc `AssessmentOutputReportRoute` zawsze robi `<Navigate to="/assessment?tab=outputs" replace />`, niezależnie od statusu assessmentu. Cel „Finalne = ma dokument" **nie jest spełniony dla ŻADNEGO assessmentu** — funkcja jest wyłączona w całości. | `04-assessment-report-finalny.png(.json)` — URL końcowy `?tab=outputs` | **BLOKER** | `src/routes/AppRoutes.tsx:866-871` (`AssessmentOutputReportRoute`, `Navigate` na flagę OFF) |
| 5.3 | Ekran docelowy przekierowania — zakładka „Wnioski" (Outputs) | pusty stan | **Tekst po ANGIELSKU**: „No insights yet" / „Insights frozen from a completed assessment session will appear here." — w polskiej aplikacji, widoczne za każdym razem gdy nie ma zamrożonych insightów (czyli praktycznie zawsze dziś) | `04-assessment-report-finalny.png` (zrzut), tekst w `.json` | **BLOKER** | `src/components/assessment/AssessmentOutputsTab.tsx:394,397` — `t('assessment.outputs.emptyState.title', 'No insights yet')` z fallbackiem angielskim; **klucz `assessment.outputs.emptyState.title` potwierdzony jako NIEOBECNY** w `public/locales/pl/translation.json` (sprawdzone programowo — brak węzła `emptyState` pod `assessment.outputs`) |
| 5.4 | Pasek zakładek statusów w Wnioskach (Wszystkie/Szkic/W przeglądzie/.../AI Triage) | ucinanie na 1440 | Ostatnia zakładka „AI Triage" jest **ucięta** na prawej krawędzi (widać „AI Tr...") | zrzut `04-assessment-report-finalny.png` (widoczne wizualnie) | KOSMETYKA | `src/components/assessment/AssessmentOutputsTab.tsx` (pasek zakładek, brak `overflow-x`/przewijania lub zbyt wąski kontener) |

**Werdykt Ocena: NIEGOTOWY** — dwa BLOKERY na jednym ekranie (funkcja raportu całkowicie
niedostępna + angielski tekst w pustym stanie widziany przez każdego), oba dotyczą dokładnie
ekranu wskazanego w zleceniu jako podejrzany.

---

## 6. Inicjatywy (`/initiatives`) — POTWIERDZONA PRZYCZYNA

| # | ekran/krok | co | wynik | dowód | waga | plik:linia |
|---|---|---|---|---|---|---|
| 6.1 | Lista, 1440 | zrzut, konsola, DOM | Ekran pokazuje **„Brak inicjatyw"**, wszystkie liczniki zakładek = 0 (Wszystkie/W przygotowaniu/Do decyzji/.../Zamknięte) | `05-initiatives-flagowy.png(.json)` | **BLOKER** | — |
| 6.2 | `GET /api/initiatives` (legacy REST, ten sam token sesji) | czy dane istnieją w bazie | **200 OK, tablica 71 elementów** — dane SĄ w bazie | curl bezpośredni, potwierdzone programowo (`list len= 71`) | — | `server/src/routes/pmo/initiatives.routes.ts:1178` (`router.get('/', InitiativeController.getInitiatives)`) → `server/src/controllers/InitiativeController.ts:174` |
| 6.3 | `GET /api/initiatives/runtime-v1/initiatives` (endpoint faktycznie używany przez UI) | czy ten endpoint też ma dane | **200 OK, `{"initiatives":[],"nextCursor":null}` — PUSTO** | curl bezpośredni | **BLOKER (przyczyna źródłowa)** | `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:1949-1983` (`deps.reader.listInitiativesPage(...)` — czyta z osobnego, event-sourced read-modelu „runtime", nie z tabeli legacy) |
| 6.4 | Ścieżka wołania z UI | które wywołanie faktycznie odpytuje frontend | `InitiativesHub.tsx` woła `listRegisteredInitiatives()`, która trafia w **`/api/initiatives/runtime-v1/initiatives`** (nie w legacy `/api/initiatives`) | kod źródłowy | — | `src/components/Initiatives/InitiativesHub.tsx:506` → `src/services/initiatives-execution/runtimeApi.ts:1042-1057` |

**Diagnoza (potwierdzona, nie hipoteza):** Consultify ma dziś **dwa równoległe magazyny
inicjatyw** — starą tabelę relacyjną (71 rekordów seed, wystawianą przez `/api/initiatives`,
ale nieużywaną przez żaden aktualny ekran) i nowy event-sourced „runtime" read-model (pusty dla
tej organizacji, wystawiany przez `/api/initiatives/runtime-v1/initiatives`, **jedyny, którego
słucha `InitiativesHub.tsx`**). Seed 71 inicjatyw poszedł do złego/martwego magazynu. Efekt na
żywo: właściciel zobaczy jutro pustą listę Inicjatyw, mimo że baza „ma dane".

**Sugerowana naprawa (jedno zdanie):** albo (a) przepisać seed tak, żeby materializował
inicjatywy przez komendy runtime-v1 (np. `register`/`materialize`) zamiast wstawiać wprost do
tabeli legacy, albo (b) jeśli legacy ma zostać źródłem prawdy na MVP, przełączyć
`InitiativesHub.tsx:506` z powrotem na `/api/initiatives` — to decyzja architektoniczna, nie
punktowy fix, wymaga potwierdzenia z właścicielem/CTO które API jest kanoniczne na MVP.

**Werdykt Inicjatywy: NIEGOTOWY** — moduł wygląda na całkowicie pusty na żywym koncie demo mimo
71 rekordów w bazie; to jeden z najbardziej wstydliwych możliwych widoków na jutrzejszej
prezentacji (menu z ikoną, zero treści, duży napis „Brak inicjatyw").

---

## 7. Realizacja (`/execution`)

| # | ekran/krok | co | wynik | dowód | waga | plik:linia |
|---|---|---|---|---|---|---|
| 7.1 | Realizacje, tabela 1440 | zrzut, konsola, DOM | 0 błędów konsoli, dane obecne (13+ wierszy) | `06-execution-flagowy.png(.json)` | — | — |
| 7.2 | Kolumna TYP | **każdy wiersz pokazuje literalnie „EXE"** — kod wewnętrzny, nie etykieta po polsku | Potwierdzone w kodzie: `getTypeCode(axis)` mapuje znane osie (PROCESSES→PRC, DIGITAL→DIG, MODELS→MDL, DATA→DAT, CULTURE→CUL, CYBERSECURITY→SEC, AI→AI) na 3-literowe kody i pokazuje je wprost w UI; dla osi spoza tej listy (albo brak osi) zwraca domyślnie `'EXE'` — i to trafia na każdy wiersz na ekranie | zrzut `06-execution-flagowy.png` (kolumna TYP = „EXE" na wszystkich widocznych wierszach) | **BLOKER** | `src/components/Execution/ExecutionHub.tsx:493-505` (`getTypeCode`, fallback `'EXE'` w linii 505) — nawet „poprawne" trafienia w mapę (PRC/DIG/MDL/DAT/CUL/SEC) są kodami, nie polskimi etykietami — to sam mechanizm łamie zakaz „żadnych kodów w UI" |
| 7.3 | Nazwy inicjatyw w realizacji (Supply Chain Optimization, Digital Workplace Platform, ERP SAP Integration...) | angielskie nazwy projektów | To dane demo (treść biznesowa), nie stringi UI — spójne z tym, że nazwy klientowskich inicjatyw bywają angielskie; nie flaguję jako defekt UI | zrzut | — | — |
| 7.4 | Przepływ klikany (wiersz → karta inicjatywy → powrót) | — | NIE WYKONANE (zdarzenie krytyczne) | — | — | — |

**Werdykt Realizacja: NIEGOTOWY** — kolumna TYP pokazuje surowy kod wewnętrzny na 100% wierszy,
widoczne na pierwszy rzut oka na ekranie, który jest właśnie ekranem flagowym tego modułu
(„Realizacje" to domyślna zakładka `/execution`).

---

## Podsumowanie wag

| Waga | Liczba | Pozycje |
|---|---|---|
| **BLOKER** | 5 | 5.2 (raport Oceny wyłączony flagą), 5.3 (angielski pusty stan Wnioski), 6.1/6.3 (Inicjatywy = 0 mimo 71 rekordów — jedno zjawisko, dwie linie tabeli), 7.2 (kolumna TYP = „EXE") |
| **WAŻNY** | 1 | 4.3 (35/36 narzędzi nieaktywnych/„już wkrótce") |
| **KOSMETYKA** | 2 | 3.2 (identyczne nazwy sesji Wywiadu), 5.4 (ucięta zakładka „AI Triage") |
| **NIE ZMIERZONE** | 8+ | patrz sekcja „Zdarzenie krytyczne" — cały tor przepływów klikanych poza pierwszym ekranem, Teresa per moduł, 1280/1920 px, ciemny motyw, uwagi z `ODBIOR_CTO_20260905/*` (katalog już niedostępny), ekran flagowy Czatu „otwarta rozmowa" |

## Werdykty per moduł

| Moduł | Werdykt |
|---|---|
| 13 Czat AI | **NIE ZMIERZONE w pełni** (ekran startowy OK, ekran flagowy „konwersacja" nieprzebadany dziś) |
| 07 Moja Praca | GOTOWY Z KOSMETYKĄ (na tym, co zmierzone; 1280px i panel Teresy — nie zmierzone) |
| 02 Wywiad | GOTOWY Z KOSMETYKĄ |
| 03 Narzędzia | GOTOWY Z ZASTRZEŻENIEM (stan merytoryczny biblioteki, nie defekt UI) |
| 04 Ocena | **NIEGOTOWY** (2 BLOKERY) |
| 05 Inicjatywy | **NIEGOTOWY** (BLOKER — lista pusta mimo danych, przyczyna zlokalizowana) |
| 06 Realizacja | **NIEGOTOWY** (BLOKER — surowy kod „EXE" w kolumnie TYP na każdym wierszu) |

---

## Top defekty (dla nadzorcy)

1. **Inicjatywy: 0 zamiast 71** — `src/components/Initiatives/InitiativesHub.tsx:506` woła
   `/api/initiatives/runtime-v1/initiatives` (`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:1949`)
   który jest pusty; dane siedzą w legacy `/api/initiatives` (`server/src/routes/pmo/initiatives.routes.ts:1178`).
   Naprawa: decyzja architektoniczna, które API jest kanoniczne — potem albo re-seed przez
   runtime-v1, albo przełączenie czytania UI na legacy.
2. **Ocena: raport dla „Finalne" nie istnieje** — `src/routes/AppRoutes.tsx:866-871`, flaga
   `isAssessmentOutputArtifactsEnabled()` OFF dla wszystkich. Naprawa: świadoma decyzja
   właściciela — włączyć po akcepcie na zrzucie, albo ukryć/zmienić CTA „Uruchom raport" tak,
   żeby nie sugerowało istnienia funkcji.
3. **Ocena: angielski pusty stan „No insights yet"** — `src/components/assessment/AssessmentOutputsTab.tsx:394,397`,
   brakujący klucz `assessment.outputs.emptyState.title`/`.description` w
   `public/locales/pl/translation.json`. Naprawa: dodać 2 klucze PL (S, 15 minut).
4. **Realizacja: kolumna TYP = „EXE" na każdym wierszu** — `src/components/Execution/ExecutionHub.tsx:493-505`.
   Naprawa: zmapować `getTypeCode` na polskie etykiety (lub ukryć kolumnę, jeśli oś nie jest
   jeszcze modelowana dla executive initiatives).
5. **Narzędzia: 35/36 pozycji nieaktywne/„już wkrótce"** — ryzyko wizerunkowe, nie defekt kodu;
   decyzja produktowa czy pokazywać pełną listę czy przefiltrować do aktywnych na demo.
6. **Ocena: zakładka „AI Triage" ucięta na 1440** — `src/components/assessment/AssessmentOutputsTab.tsx`
   (pasek zakładek statusów), kosmetyka.
7. **Wywiad: 3 sesje o identycznej nazwie „Wywiad"** — zamierzone (test to potwierdza), ale
   słabo wygląda na żywych danych; do rozważenia: domyślna nazwa z datą/numerem zamiast gołego
   szablonu.
8. **[ŚRODOWISKO] Worktree `/private/tmp/m03` stracił `src/`/`public/`/narzędzia audytu w
   trakcie tej sesji** — sparse-checkout zawężony przez inny proces na żywo, dysk odzyskał
   ~6 GiB w tym samym momencie. Nie defekt produktu, ale **pilny sygnał dla nadzorcy**: ktoś
   inny na tym samym worktree może tracić niecommitowaną pracę.
9-10. Patrz „NIE ZMIERZONE" — cały tor przepływów klikanych, Teresa per moduł, dark theme,
   1280/1920 px i weryfikacja uwag z `ODBIOR_CTO_20260905/*` pozostają otwarte, nie fałszywie
   zamknięte na „OK".

## Czego nie zmierzono (wprost)

- Przepływy klikane pełne (lista→wiersz→podgląd→„Otwórz"→karta→powrót; „+Nowy"→formularz→anuluj)
  dla WSZYSTKICH 7 modułów poza pierwszym ekranem — narzędzie zrzutu zniknęło z dysku w trakcie
  próby na Mojej Pracy.
- Teresa: wejście/pytanie/odpowiedź PL vs EN, `degraded: no_sources` — nie sprawdzone w tej
  sesji dla żadnego modułu.
- Ciemny motyw — 0 zrzutów (zgodnie z wcześniejszym audytem, dług nie zmniejszony dziś).
- Viewporty 1280 i 1920 — skrypt miał szerokość zablokowaną na 1440, nie da się nim odtworzyć
  zgłoszenia właściciela o 1280 px bez modyfikacji skryptu (poza zakresem — czysty odczyt).
- Uwagi właściciela z `docs/program/ODBIOR_CTO_20260905/*.md` — katalog niedostępny na dysku od
  momentu zdarzenia krytycznego, nie zweryfikowano per pozycja.
- Assessment: pozostałe 3 assessmenty (ADMA draft, SIRI approved, DRD-manufacturing approved) —
  sprawdzony tylko `assess-drd-enterprise-01`; wszystkie 4 wylądowałyby na tym samym
  przekierowaniu (flaga globalna), ale nie potwierdzono zrzutem dla pozostałych trzech.
