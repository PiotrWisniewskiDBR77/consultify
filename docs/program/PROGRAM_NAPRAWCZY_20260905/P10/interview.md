# Wywiad — sesja (interview) — kontrakt karty N, AUDYT ZGODNOŚCI (P10-B0, DEC-429)

> B0 = audyt, nie budowa od zera. Tabela rundy 1 Codexa zachowana w §6a. Ten plik ją
> uzupełnia do formatu §0–§7 i dokłada pomiar NA ŻYWO flagi kontraktu (§6b) — dla tej
> karty wynik jest inny niż dla pozostałych 5: **ekran osiągalny z listy w ogóle nie
> wchodzi w tryb, który kontrakt steruje**, niezależnie od stanu flagi.

## §0. Tożsamość

- **Nazwa PL:** Sesja wywiadu · **moduł:** 02_INTERVIEW (Wywiad) · **archetyp:** D (Matryca/kreator)
- **Trasa:** `/interview?tab=sessions` (bez id w URL)
- **Jak otworzyć z listy:** Wywiad → Sesje → wiersz → „Otwórz”
- **Komponent:** `src/components/Interview/InterviewWorkspace.tsx:235` (3649 linii)
- **Powłoka dziś:** `NModeShell`; kontrakt: `src/components/Interview/interviewCardContract.ts`
  (import `:96`), 8 kart `KanonicznaKarta` — **jedyna karta z kontraktem i BEZ żadnego promptu AI
  systemowego poza `overview`/`questions`/`summary`** (5/8 kart mają `rolaAI:'dane'|'systemowa'`)
- **Rejestr:** `registry.ts` → `interview`

## §1. Sekcje (katalog kanoniczny, 8 kart — wg kodu, NIE wg ekranu realnie osiąganego, patrz §6b)

| sekcja | po co użytkownikowi | źródło danych | reguła pustki | kolejność |
|---|---|---|---|---|
| Podgląd (`interview-overview`) | podsumowanie jakości sesji | prompt `interview.overview-review` (`runAiQualityReview`, `InterviewWorkspace.tsx:2898`), asystuje | brak | 0 |
| Pytania (`interview-questions`) | lista pytań/odpowiedzi | tryb konwersacyjny (`ConversationalPanel`, `:2899`), asystuje | brak | 1 |
| Notatki (`interview-notes`) | notatki własne konsultanta | ręczny zapis (`:2902`), rolaAI `dane` | brak (nie generuje AI) | 2 |
| Pliki i linki (`attachments`) | załączniki sesji | wgrywane ręcznie (`:2903`), rolaAI `dane` | brak | 3 |
| Fakty (`interview-company-facts`) | twarde dane o firmie | zewnętrzne (`:2904`), rolaAI `dane` | brak | 4 |
| Interesariusze (`stakeholders`) | kto brał udział | ręczne (`:2905`), rolaAI `dane` | brak | 5 |
| Luki (`interview-open-gaps`) | co jeszcze nieodpowiedziane | wyliczane systemowo z braków | brak | 6 |
| Podsumowanie (`interview-summary`) | streszczenie faktów | prompt `interview.summary-generate` (`:2900`), pisze | brak | 7 |

**Rzeczywisty ekran z listy „Sesje → Otwórz” NIE renderuje tego katalogu w ogóle** — patrz §6b.
Renderuje zamiast tego „Obszar roboczy pytania”: listę pytań z odpowiedziami inline, bez Menu 5, bez
podziału na 8 sekcji wyżej. Rozjazd katalog↔ekran jest tu WIĘKSZY niż w Task/Decision/Initiative.

## §2. Prawy panel

Na ekranie „Obszar roboczy pytania” (rzeczywiście osiąganym) panel jest SKRÓCONY: „PRZEBIEG”
(Odpowiedzi X/10, Start, Aktywność, Właściciel) + AI (Podsumuj/Ryzyka/Następne kroki) + „POWIĄZANIA”
(Organizacja) + przypomnienia. **Brak** osobnych sekcji Akcje/Właściwości-jako-tabela/Źródła i
założenia/Komentarze/Historia w formie K6–K11 — panel tego ekranu nie jest `ArtifactRightPanel`
tylko własny układ. K7 (tabela Właściwość\|Wartość) NIE spełnione — „PRZEBIEG” to seria etykieta:wartość
bez nagłówka tabeli (zmierzone: `evidence/p10b0-kontrakty/interview-open-bez.png`).

## §3. Menu 5 i nawigacja

**Brak Menu 5 w ogóle** na ekranie osiąganym z listy (K12 ✗, potwierdzone na 3 stanach sesji: „W
trakcie” 40%, „Zatwierdzony” 70%, próba na „Zakończony” 100% zwróciła błąd ładowania pytań —
`evidence/p10b0-kontrakty/interview-done-bez.png.json`, niezwiązane z fladze kontraktu, ten sam błąd
wystąpił bez i z flagą). Nawigacja to lista pytań po lewej + edytor pytania na środku — model
formularza-krok-po-kroku, nie model karty N z sekcjami.

## §4. AI

Brak wspólnego „Pracuj z AI ▾” na tym ekranie — zamiast tego trzy osobne przyciski w prawym panelu:
„Podsumuj / Ryzyka / Następne kroki” (widoczne na zrzucie). To NIE jest `PracujZAI` (K21 ✗, potwierdza
matrycę „jedyna karta z kontraktem i BEZ żadnego AI” w rozumieniu wspólnego komponentu).

| sekcja | rubryka | AI może uzupełnić | tylko do odczytu |
|---|---|---|---|
| interview | `cardAnalysisRubric.ts:627` = `[]` — **BRAK kryteriów w rubryce** | do decyzji: notatka konsultanta, podsumowanie sesji | odpowiedzi respondenta, materiał |

## §5. Czytelność graficzna

Zrzut 1440 jasny (`interview-open-bez.png`) czysty, 0 błędów konsoli. Brak pigułki modułu widocznej w
formie karty N (ekran ma własny pasek „Wróć / [tytuł sesji]”, nie pasek modułu standardowy — K19 nie
zmierzone jako spełnione w tej rundzie, wygląda inaczej niż wzorzec `01-task.png`).

## §6a. Stan zastany vs kontrakt — tabela Codexa (runda 1, zachowana bez zmian)

| sekcja | kontrakt mówi (plik:linia) | ekran pokazuje (plik:linia + zrzut) | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Podgląd | `interviewCardContract.ts:66-90` | `InterviewWorkspace.tsx:2444`; brak rekordu | sesja/odpowiedzi → `InterviewController` | brak | kosmetyka |
| Pytania | `interviewCardContract.ts:91-115` | jw. | questions/answers → `InterviewController` | brak | kosmetyka |
| Notatki | `interviewCardContract.ts:116-140` | jw. | notes → `interview.routes.ts:433-443` | brak | kosmetyka |
| Pliki i linki | `interviewCardContract.ts:141-168` | jw. | attachment API → writer rozproszony | brak | kosmetyka |
| Fakty | `interviewCardContract.ts:169-193` | jw. | company facts → `OrganizationContextService.ts:411` | brak | kosmetyka |
| Interesariusze | `interviewCardContract.ts:194-211` | jw. | session context → `InterviewController` | brak | kosmetyka |
| Luki | `interviewCardContract.ts:212-242` | jw. | wyliczane z brakujących odpowiedzi | brak | kosmetyka |
| Podsumowanie | `interviewCardContract.ts:243-270` | jw. | summary → `interview.routes.ts:481-485` | brak | kosmetyka |

⚠ **Runda 1 oznaczyła wszystkie rozjazdy jako „brak”/„kosmetyka” z adnotacją „brak dowodu runtime”.**
Pomiar żywy P10-B0 (§6b) pokazuje, że rozjazd jest w rzeczywistości WIĘKSZY: ekran osiągalny z listy
w ogóle nie pokazuje TYCH 8 sekcji pod żadną postacią — waga powinna być realnie wyższa niż
„kosmetyka” dla całego katalogu, nie punktowo per-sekcja.

## §6b. POMIAR NA ŻYWO flagi `VITE_VF1_INTERVIEW_CARD_CONTRACT` (P10-B0, 06.09.2026)

**Mechanizm flagi identyczny jak w pozostałych 5 kartach** (`InterviewWorkspace.tsx:188-227`): URL
`?cardContract=1` → localStorage `ff.cardContract` → env → `false`. Da się włączyć jednym linkiem.

**Metoda:** vite port 3111, sesja `stanowisko-noc/auth.json`, 3 rekordy testowane: „Inbox — Quick
assessment (my assignment)” (W trakcie 40%), „Discovery — Operations bottlenecks (Plant A)”
(Zatwierdzony 70%), „Seed session: Governance and escalation map” (Zakończony 100%, zwrócił błąd
ładowania niezależnie od flagi). Dowody: `evidence/p10b0-kontrakty/interview-open-{bez,z}.png(.json)`,
`interview-done2-{bez,z}.png(.json)`.

**Wynik: 0 różnic tekstowych między bez/z na WSZYSTKICH 2 udanych rekordach** (`difflib` na pełnym
tekście strony — dokładnie zero linii różnicy, nie tylko „podobne”). To silniejszy wynik niż w
pozostałych 5 kartach (gdzie flaga zawsze zmieniała choć nazwy zestawów w managerze „Sekcje”): tu
manager „Sekcje” **nie istnieje na tym ekranie w żadnym z dwóch stanów flagi**, więc nie ma czego
zmienić. Kod referuje `interviewCardContractEnabled`/`INTERVIEW_CARD_SPEC`/`orderedSections`
(`:1940,1965,3218`) — to REALNY kod, nie martwy import — ale ścieżka UI, którą użytkownik osiąga
klikając „Sesje → wiersz → Otwórz”, jest ekranem „Obszar roboczy pytania” (krok-po-kroku formularz
pytań), który NIE JEST tą samą gałęzią renderu co `orderedSections`. Nie zlokalizowałem w tej rundzie,
pod jakim dokładnie warunkiem/widokiem komponent renderuje gałąź kontraktową (STOP — wymaga dalszego
śledzenia w kodzie, poza budżetem czasowym B0); przypuszczenie robocze: inny tryb tego samego
komponentu (np. widok recenzji/raportu sesji), nieosiągalny wprost z listy Sesji.

**Wniosek:** dla Interview flaga „da się włączyć”, ale efekt na REALNIE osiąganym ekranie jest ZEROWY
— nawet ten skromny, kosmetyczny wpływ (nazwy w managerze), jaki mają Task/Decision/Initiative, tu nie
występuje, bo manager się w ogóle nie pojawia. To najsłabszy z 6 wyników.

## §7. Luki → naprawa

| # | luka | rozmiar | decyzja właściciela? | rekomendacja |
|---|---|---|---|---|
| 7.1 | ekran osiągalny z listy Sesji nie wchodzi w tryb, który kontrakt/Menu5/PracujZAI steruje | L | tak — czy „Obszar roboczy pytania” ma zostać zastąpiony pełną kartą N (Menu5+prawy panel+PracujZAI), czy to świadomie inny archetyp (kreator kroków) i kontrakt ma dostać osobną definicję dla TEGO ekranu | ustalić z właścicielem, czy sesja W TRAKCIE ma w ogóle wyglądać jak karta N — dziś to formularz, nie dokument; zmiana architektury, nie kosmetyka |
| 7.2 | rubryka AI dla interview jest pusta (`cardAnalysisRubric.ts:627=[]`) mimo istniejącego kontraktu treści | M | tak — jedno pytanie z SSOT już czeka: notatka konsultanta / podsumowanie sesji jako pisane przez AI? | uzupełnić rubrykę zgodnie z odpowiedzią właściciela |
| 7.3 | trzy osobne przyciski „Podsumuj/Ryzyka/Następne kroki” zamiast `PracujZAI` | M | nie | zamienić na wspólny komponent po rozstrzygnięciu 7.1 (bo dotyczy tego samego ekranu) |

**STOP:** nie zlokalizowałem trybu InterviewWorkspace, w którym `orderedSections`/kontrakt faktycznie
się renderuje — bez tego dalszy pomiar K2/K4/K17 dla „prawdziwej” karty kontraktowej Interview jest
niemożliwy w tej rundzie. Błąd ładowania pytań na sesji „Zakończony 100%” (`interview-done-*.png`) nie
zbadany — wystąpił identycznie bez/z flagą, więc nie jest efektem tego zlecenia, ale osobnym zgłoszeniem.
