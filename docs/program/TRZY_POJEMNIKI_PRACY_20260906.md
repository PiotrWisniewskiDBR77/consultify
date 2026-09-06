---
doc_id: trzy-pojemniki-pracy-20260906
status: canonical
truth_type: program-plan
established: 2026-09-06 (rano)
author: CTO (Fable), na polecenie właściciela
wykonuje: następca (nadzorca) — po kolei, pojemnik po pojemniku
---

# Trzy pojemniki pracy: MVP rękami właściciela → MVP rękami klienta → Fala 2

Zasada: pojemnik zamyka się mierzalnie (kryteria poniżej), wpisem w „Rejestrze odbioru”
(`PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`) i słowem właściciela na jednym żywym obrazie.
Następny pojemnik nie startuje, zanim poprzedni nie ma wszystkich kryteriów odhaczonych. Rytm pracy,
podział ról i zakazy: `PRZEKAZANIE_20260906_RANO.md` §8–9 (nie powtarzam ich tutaj).

---

## Pojemnik 1 — MVP rękami właściciela (cel: 10 dni, do ~16.09)
**Definicja:** właściciel przechodzi cały system na stagingu na SWOICH danych, bez asysty, po ścieżce
z `PRZEKAZANIE_20260906_RANO.md` §3, i nie znajduje nic, co go zawstydza.

**Kryterium „gotowe” (wszystkie naraz):**
1. Przejście właściciela: 16 modułów, każdy z werdyktem „Tak” na jednym obrazie; defekty z przejścia = 0 otwartych BLOKER/WAŻNY.
2. Mechanika wartości działa end-to-end na żywo: rezultat KPI poza limitem → czerwony wiersz → wpis w Skrzynce odpowiedzialnego → otwarta karta działania → zadanie osoby (przepływ Playwright + zrzuty + `bledyKonsoli=0`).
3. Jeden dokument i jedna prezentacja z szablonu na danych DBR77 zaakceptowane przez właściciela JAKO PLIK (DOCX/PDF), nie jako zrzut.
4. Jeden prawy panel (Rekord | Teresa) na wszystkich 8 ekranach listowych z P1 (Skrzynka i Wywiad włącznie), zmierzony na żywo 1280/1440/1920.
5. Teresa w każdym module MVP zgodnie z `docs/ssot/KONTRAKTY_NARZEDZI_AI.md` (wejście widoczne, odpowiedź po polsku, źródła z modułu, zero „no_sources” tam, gdzie moduł ma dane).
6. Dane właściciela czyste: jedna ocena wypełniona w 100 %, oceny/inicjatywy/spotkania bez śmieci testowych, `PL · Silesia` = 0, legacy finanse DBR77 albo naprawione (bilans 2024), albo zarchiwizowane z decyzją.
7. Strażniki zielone i dług nie rośnie: `check-list-canon`, `check-artefakt`, `i18nTrescPolska` (ratchet ≤ 484, cel ≤ 300), 0 zmodyfikowanych migracji, tsc serwera.
8. **Środowisko demo dla pojemnika 2 gotowe** (dopisane 06.09 słowem właściciela): `demo.consultify.ai` ma WŁASNĄ bazę (dziś demo i staging dzielą bazę `trolley` — `topologia-srodowisk-staging-demo`, plan rozdziału w 5 fazach), własne zmienne (te same flagi ON co staging, `CSRF_MODE=report`, limiter AI z budżetem), dane pokazowe = DBR77 (Wyniki) + CD PROJEKT (Finanse) + czysta organizacja pilotażowa z jednym nazwanym użytkownikiem; promocja staging → demo opisana i przećwiczona (kopia zapasowa, migracje, health = SHA, cofnięcie); demo zamrożone tagiem `demo-safe-<data>`. Robotnicy nie dotykają demo bez procedury `consultify-promocja-demo`.

**Pozycje (kolejność):**
| # | Pozycja | Wykonawca | Sesje | Zależy od |
|---|---|---|---|---|
| 1.1 | Defekty z przejścia właściciela 06.09 (fale jak w nocy 05/06) | Sonnet/Opus | 1–3 | przejście |
| 1.2 | P1 dokończenie: Skrzynka (`InboxContent.tsx:4324`) i Wywiad (`InterviewHub.tsx:8620`) na wzorzec; 8×3 zrzuty na żywo | Sonnet | 1 | — |
| 1.3 | P9 karta działania + Skrzynka (Codex: 5 powierzchni, K2/K3, e2e, test createActionCard→Skrzynka, sieroty usunięte, rejestr kart N „przed”) | Codex, odbiór Sonnet | 2–3 | — |
| 1.4 | P7K część B: odchylenie → powiadomienie → Skrzynka → karta (na komponencie z 1.3) | Opus | 2 | 1.3 |
| 1.5 | P8 kontrakty Teresy (dokończenie 32 plików Codexa; wejście do Teresy w kanonie `ArtifactRightPanel`, Ocena bez flagi, martwe `AIActionSlot`/`AIConsultantPanel`, `canvasMutationRisk.ts` usunięty) | Codex/Sonnet | 2 | — |
| 1.6 | Dokument i prezentacja z szablonu jako plik (prototyp → akcept właściciela → generator; `szablony-dokumenty-strach-wlasciciela`) | Opus | 2–3 | — |
| 1.7 | Higiena danych właściciela (skrypty idempotentne z dry-run: oceny, śmieci, Silesia, legacy 2024) | Sonnet | 1 | decyzje właściciela |
| 1.8 | Dług i18n: 141 kluczy Czatu (374), 484 pl==en → ≤ 300, 16 testów z mockiem react-router | Sonnet | 1–2 | — |
| 1.9 | Re-audyt A/B na stagingu na sesji właściciela (nie na seedach) + zamrożenie `zamroz.mjs` per moduł | Sonnet ×2 | 1 | 1.1–1.8 |
| 1.10 | **Środowisko demo dla pojemnika 2**: rozdział bazy demo od stagingu (5 faz z `topologia-srodowisk-staging-demo`), zmienne, seedy pokazowe (DBR77 Wyniki, CD PROJEKT Finanse, organizacja pilotażowa), promocja staging → demo przećwiczona z cofnięciem, tag `demo-safe` | Opus + nadzorca | 2–3 | 1.9 |

**Stan (dopisywany, nie zmienia kryteriów):**
- 06.09 ~08:00: **DEC-399 (właściciel):** Finanse MINIMUM → pojemnik 2, pozycja 2.6; w pojemniku 1 Finanse = pokaz CD PROJEKT. Właściciel: „zgoda, zróbmy to i wypijmy szampana”; panel opublikowany (https://claude.ai/code/artifact/2a86e4bf-46b5-4056-a472-264dc4a26da6).
- 06.09 06:40 (sesja #23): 1.2 W TOKU (`mvp/p1-skrzynka-wywiad`, Sonnet) · 1.8 W TOKU (`mvp/i18n-dlug-1`, Sonnet) · 1.6 W TOKU (`mvp/dokument-prezentacja-plik`, Opus) · 1.3 i 1.5 WYDANE Codexowi jako funkcja celu (wklejki nr 2, wznowienie istniejących worktree) · 1.1 czeka na przejście właściciela · 1.4 czeka na 1.3 · 1.7 czeka na decyzje właściciela. Szczegóły i dowody: rejestr odbioru w `PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`.

**Decyzje właściciela w tym pojemniku (jedna dziennie):** Finanse MINIMUM do MVP (F1 §0) czy poza; grupowanie inicjatyw po zdjęciu Projektów (rekomendacja: płaska lista + obszar/oś); kropka „Model” w crimson.
### 🍾 Lista kontrolna szampana — koniec pojemnika 1 (co właściciel dowozi, kto potwierdza, jaki artefakt)
| # | Co musi być prawdą | Kto potwierdza | Artefakt dowodu |
|---|---|---|---|
| S1.1 | Przeszedłem 16 modułów na stagingu na swoich danych po ścieżce pokazu; każdy ma moje „Tak” | właściciel | karta per moduł na 3100 (jeden obraz, Tak) |
| S1.2 | Zero otwartych BLOKER/WAŻNY z mojego przejścia | nadzorca | rejestr odbioru: wiersze z SHA i zrzutem PO |
| S1.3 | Widziałem na żywo: rezultat poza limitem → Skrzynka → karta działania → zadanie osoby | właściciel + Playwright | nagranie/zrzuty przepływu + `bledyKonsoli=0` |
| S1.4 | Trzymam w ręku jeden dokument i jedną prezentację z szablonu na danych DBR77 i nie wstydzę się ich | właściciel | pliki DOCX/PDF/PPTX w `evidence/` z moim „Tak” |
| S1.5 | Jeden prawy panel na 8 listach, zwija się i nie wraca po zamknięciu | nadzorca | 8×3 zrzuty na żywo, `aside ≤ 1` |
| S1.6 | Teresa odpowiada po polsku ze źródłami w każdym module MVP | nadzorca | 16 odpowiedzi z `used_sources > 0` w `evidence/` |
| S1.7 | Moje dane są czyste (jedna ocena 100 %, zero śmieci, zero „Silesia”, legacy 2024 rozstrzygnięte) | nadzorca + właściciel | skrypty dry-run/apply z logiem, moje słowo |
| S1.8 | Strażniki zielone, dług nie rośnie, tsc serwera OK, 0 zmodyfikowanych migracji | nadzorca | wynik komend w rejestrze |
| S1.9 | Demo ma własną bazę, dane pokazowe i przećwiczoną promocję z cofnięciem | nadzorca + właściciel (klik na demo) | health demo = SHA, tag `demo-safe-<data>`, zrzuty z demo |
| S1.10 | Trzy decyzje podjęte i zapisane (Finanse MINIMUM, grupowanie inicjatyw, kropka „Model”) | właściciel | ledger decyzji (DEC-…) |
| S1.11 | Wszystkie 16 modułów + Wyniki + Finanse zamrożone tagiem | nadzorca | `zamroz.mjs`, tagi `mvp-wlasciciel-<data>` |
| S1.12 | Przekazanie dla pojemnika 2 napisane (stan, kolejka, decyzje) | nadzorca | `PRZEKAZANIE_<data>.md` + pamięć |
| S1.13 | Analiza kart N (DEC-411, słowo właściciela 06.09): dla każdej karty N ekran + kontrakt treści, tabela rozjazdów „kontrakt mówi / ekran pokazuje / rozjazd”, rozjazdy blokujące naprawione albo rozstrzygnięte słowem właściciela; start: Wnioski (kreator + karta) i Inicjatywy | Sonnet K1 + Codex wklejka nr 6 | `RAPORT_K1.md`, raport Codexa, tabela w rejestrze |
**Komunikat po S1.1–S1.13:** „MVP działa w moich rękach na moich danych, na demo z własną bazą.” Szampan nr 1.


---

## Pojemnik 2 — MVP rękami klienta (cel: 3 tygodnie po pojemniku 1, do ~7.10)
**Definicja (uściślona słowem właściciela 06.09):** pilotaż odbywa się **na demo** (własna baza z pozycji 1.10), rękami czterech nazwanych osób pierwszej linii kontaktu z klientem — **Tomek, Kasia, Irina, Justyna** — które zakładają organizację, wchodzą bez asysty właściciela i dochodzą od wywiadu do wyniku bez pytania „gdzie to jest”. Produkcja (`consultify.ai`) wchodzi dopiero po pilotażu, dla pierwszego klienta zewnętrznego. Po starcie pilotażu właściciel buduje **system reakcji** (jak zgłoszenia od czterech osób trafiają do nadzorcy i wracają naprawione — dziś: Feedback w aplikacji + dziennik; docelowo wg decyzji właściciela).

**Kryterium „gotowe”:**
1. Świeża organizacja od zera (rejestracja → kontekst → wywiad → ocena → inicjatywy → realizacja → wyniki) przechodzi przepływ Playwright „pusty stan → pierwsza wartość” w każdym module: puste stany po polsku z jedną akcją, zero ekranów „—” bez wskazówki.
2. Bezpieczeństwo: macierz cross-org 2725 tras zmierzona (dyżur 307) = 0 wycieków; CSRF `enforce` na stagingu po fazie 2 bez regresji; MFA z karencją sprawdzone na koncie obcym; 8 tras admina 403 nie 500 (już); brak 500 w logach stagingu przez 7 dni.
3. Onboarding: kreator „Krok 1 z 3” działa i kończy się, `TRIAL` nie blokuje po 3 pytaniach bez jasnego komunikatu, poczta (zaproszenia, reset hasła) żywa — dziś martwa w całej aplikacji.
4. Wydajność: każdy ekran flagowy < 3 s do treści na stagingu, szkielety z P5 potwierdzone na żywo, Megatrendy 200.
5. Dwa magazyny danych zlikwidowane albo trwale spięte projekcją w SSOT dla: inicjatyw (runtime-v1 vs SQL), ocen (jądro vs zastane), analiz finansowych, artefaktów (aliasy) — z testem, że nowy rekord z UI trafia do obu odczytów.
6. Finanse: jeśli decyzja „MINIMUM do MVP” → F‑M2/M3/M4/M6/M7 wykonane (F1); jeśli „poza” → moduł ukryty za jawnym „wkrótce”, nie za flagą w ciszy.
7. Dokumentacja użytkownika: jedna strona „jak zacząć” po polsku w aplikacji (nie PDF), ścieżka pokazu jako przewodnik.
8. Pilotaż: 2 tygodnie codziennego użycia przez DBR77 z dziennikiem zgłoszeń; 0 BLOKER otwartych na koniec.

**Kryteria dopisane 06.09 po pytaniu właściciela „czy coś pominąłem” (bez nich klient nie istnieje):**
9. **Produkcja:** opisana i przećwiczona ścieżka promocji staging → demo → produkcja (`consultify.ai`, osobna baza): kopia zapasowa przed, migracje addytywne z bramką, health = SHA, cofnięcie wg `_RUNBOOK_COFANIA.md` przećwiczone raz na demo. MVP klienta działa na produkcji, nie na stagingu.
10. **Obserwowalność:** alert na 500/5xx i na padnięcie health (kto dostaje, kanał), logi z `csrf_violation`/AI/błędów przeglądane raz dziennie przez 7 dni pilotażu.
11. **Koszt AI:** limiter AI z powrotem włączony z budżetem per organizacja i czytelnym komunikatem po wyczerpaniu (dziś wyłączony od 05.09 = rachunek bez sufitu).
12. **Dane i prawo:** eksport organizacji (JSON/CSV) i usunięcie na żądanie działają z UI; retencja opisana; umowa powierzenia jako szablon; produkcja nietykalna dla robotników.
13. **Playbook wdrożenia klienta (usługa, nie sklep):** kto zakłada organizację, kto ładuje kontekst, kto prowadzi pierwszy wywiad i ocenę, ile godzin ludzi DBR77 kosztuje pierwszy tydzień klienta — jedna strona, sprawdzona na pilotażu.
14. **Definicja pilotażu:** czterech nazwanych użytkowników (Tomek, Kasia, Irina, Justyna) z własnymi kontami na demo, każdy z własną organizacją testową albo wspólną (decyzja właściciela), dziennik zgłoszeń (Feedback w aplikacji) przeglądany codziennie przez nadzorcę, próg wyjścia: 0 BLOKER, ≤ 3 WAŻNE otwarte, każda z czterech osób potwierdza „doszłam/doszedłem do wyniku sam”.
15. **System reakcji (właściciel, po starcie pilotażu):** kanał zgłoszeń → nadzorca → naprawa → zwrot do zgłaszającego; czas reakcji i rytm przeglądu ustala właściciel; do czasu jego decyzji obowiązuje: Feedback w aplikacji + dziennik + codzienny przegląd nadzorcy.

**Pozycje (kolejność):** 2.0 produkcja i cofnięcie przećwiczone (Opus + nadzorca, 2 sesje) → 2.1 przepływ „pusty stan → pierwsza wartość” per moduł (Sonnet ×2, 2 sesje) → 2.2 macierz cross-org + CSRF enforce + poczta (Sonnet/Opus, 3) → 2.3 dwa magazyny → jedna projekcja (Opus, 3) → 2.4 onboarding i TRIAL (Sonnet, 1) → 2.5 wydajność ekranów flagowych (Sonnet, 1) → 2.6 Finanse wg decyzji (Codex, 5–8) → 2.7 przewodnik w aplikacji (Sonnet, 1) → 2.8 obserwowalność + limiter AI + eksport/usunięcie danych (Sonnet, 3) → 2.9 playbook wdrożenia klienta (właściciel + nadzorca, 1) → 2.10 pilotaż Tomek/Kasia/Irina/Justyna na demo z dziennikiem i systemem reakcji (2 tygodnie) → 2.11 zamrożenie „MVP klienta” tagiem.
### 🍾 Lista kontrolna szampana — koniec pojemnika 2
| # | Co musi być prawdą | Kto potwierdza | Artefakt dowodu |
|---|---|---|---|
| S2.1 | Tomek, Kasia, Irina i Justyna (każde z osobna) założyli organizację na demo i doszli od wywiadu do wyniku bez pytania „gdzie to jest” | czworo użytkowników pilotażu + nadzorca | dziennik pilotażu (Feedback) + 4 potwierdzenia |
| S2.2 | Przepływ „pusty stan → pierwsza wartość” zielony w każdym module na świeżej organizacji | nadzorca | Playwright w CI, raport |
| S2.3 | Bezpieczeństwo: macierz cross-org 2725 tras = 0 wycieków, CSRF enforce, MFA z karencją, 0×500 przez 7 dni | nadzorca | raport pomiaru + logi 7 dni |
| S2.4 | Produkcja gotowa NA klienta zewnętrznego: promocja demo → produkcja przećwiczona z kopią i cofnięciem; health = SHA (pilotaż sam idzie na demo) | nadzorca + właściciel | runbook z datami ćwiczeń, tag `prod-safe-<data>` |
| S2.5 | Alert na 5xx/health dociera do nazwanej osoby; był sprawdzony sztucznym błędem | nadzorca | zrzut alertu |
| S2.6 | Limiter AI z budżetem per organizacja działa i mówi po polsku, co się stało | nadzorca | test na wyczerpanie budżetu |
| S2.7 | Eksport i usunięcie danych organizacji działają z UI; umowa powierzenia jako szablon | nadzorca + właściciel | plik eksportu, zrzut usunięcia, szablon umowy |
| S2.8 | Poczta żywa (zaproszenie, reset hasła) na produkcji | nadzorca | dwa e-maile dostarczone |
| S2.9 | Dwa magazyny danych spięte projekcją z testem „nowy rekord z UI widać wszędzie” | nadzorca | testy + mutacja |
| S2.10 | Finanse wg decyzji: MINIMUM działa na CD PROJEKT albo moduł jawnie „wkrótce” | właściciel | jeden obraz, Tak |
| S2.11 | Przewodnik „jak zacząć” w aplikacji po polsku | właściciel | jeden obraz, Tak |
| S2.12 | Playbook wdrożenia klienta sprawdzony na pilotażu (godziny ludzi DBR77 policzone) | właściciel | jedna strona z liczbami |
| S2.13 | 2 tygodnie pilotażu czterech osób na demo: 0 BLOKER, ≤ 3 WAŻNE otwarte; system reakcji właściciela działa (zgłoszenie → naprawa → zwrot) | nadzorca + właściciel | dziennik z werdyktem, czasy reakcji |
| S2.14 | Zamrożenie „MVP klienta” + przekazanie dla fali 2 | nadzorca | tag `mvp-klient-<data>`, `PRZEKAZANIE_<data>.md` |
**Komunikat po S2.1–S2.14:** „Pierwsza linia pracuje sama na demo, produkcja czeka gotowa na klienta, a my wiemy, kiedy coś pęka.” Szampan nr 2.


---

## Pojemnik 3 — Fala 2 (po pilotażu; decyzje właściciela z 05.09, `MVP_BACKLOG_20260905.md` §E–K)
**Definicja:** funkcje świadomie wyjęte z MVP, każda jako osobny program z własnym SSOT, prototypem
i akceptem przed budową — nigdy hurtem, nigdy za flagą w ciszy.

| # | Program | Co to znaczy | Wejście | Szacunek |
|---|---|---|---|---|
| 3.1 | **Agent** | wykonawcy etapów (0/15 dziś), producent rozpoznawania sprawy, worker `ENABLE_AI_TASKS_WORKER`; zasady w `docs/ssot/ZASADY_AI_TERESA_SSOT.md` (Teresa nie jest silnikiem autonomicznym — Agent ma być jawny, z potwierdzeniem) | SSOT Agenta + prototyp | 6–8 sesji Opus |
| 3.2 | **Projekty / grupowanie inicjatyw** | wg decyzji właściciela (program/portfel/płaska lista) — `project_id` zostaje opcjonalne | decyzja | 2–3 |
| 3.3 | **Menedżer** (rola i widok kierownika) | kokpit dla przełożonego: zespół, Skrzynka zespołu, odchylenia, karty działania | SSOT roli | 3–4 |
| 3.4 | **SIRI** (pakiety metodyczne) | `seed-method-packs-siri`, narzędzia z „już wkrótce” (35/36) — każde narzędzie: sesja → artefakt → dalej | `_FORMULA_MENU_NARZEDZI_12.md` | 8–12 |
| 3.5 | **Finanse PEŁNY** | F‑P1…F‑P11 z F1: Baseline v3 (6 ogniw), prognoza, wycena, porównanie wersji, pełna tabela RZiS/BS/CF | F1 §PEŁNY | 16 |
| 3.6 | **Kręgosłup wartości — reszta konwersji** | 20 z 32 nieklikalnych (`docs/ssot/KREGOSLUP_WARTOSCI.md`), rodowód i zatwierdzenia między modułami | SSOT gotowy | 4–6 |
| 3.7 | **Korpus wiedzy organizacji dla Teresy** | indeksowanie dokumentów org (`teresa-indeksuj-org.ts`), flagi `ENABLE_ORG_KNOWLEDGE_RETRIEVAL` po zaindeksowaniu, limiter AI z powrotem | skrypt gotowy | 2 |
| 3.8 | **Tryb ciemny i dostępność jako bramka** | IV dokończone (E_TRYB_CIEMNY, klawiatura), bramka w CI | przyrząd gotowy | 1–2 |
| 3.9 | **Propozycje Teresy — prostszy przepływ wykonania planu** | mniej kart, mniej ceremonii, jedna decyzja użytkownika (słowo właściciela 06.09, Czat) | 1.1-A domknięte | 1–2 |
| 3.10 | **Dyktowanie notatek głosem** | mowa → tekst w edytorze notatki, na bazie głosu Teresy z 1.1-C (właściciel 06.09, Notatnik) | głos Teresy stabilny | 1–2 |
| 3.11 | **Foldery w Sejfach** | zakładka „Foldery” zdjęta z MVP (DEC-408), wraca jako osobny program (właściciel 06.09, Sejfy) | SSOT Sejfów | 1 |
| 3.12 | **Wywiad: zatwierdzanie i dopuszczanie odpowiedzi** | procedura, w której menedżer zwracający wywiad przyjmuje albo nie przyjmuje udzielonych odpowiedzi (właściciel 06.09, Wywiad); punkt wyjścia = dzisiejsze „zatwierdź / odeślij do poprawy” w Przydzielone; zakładka „Dopuszczenie” usunięta (DEC-410b) | SSOT Wywiadu, decyzja właściciela o krokach | 2–3 |
| 3.13 | **Warsztat sesji DRD — nowy układ graficzny** | „bardzo nawala tego tekstu; poprawimy cały układ graficzny na etapie fali drugiej” (właściciel 06.09, sesja DRD); w MVP tylko kolor stanu odpowiedzi, działające „Zapytaj Teresę” i „Podyktuj” (DEC-415) | prototyp + akcept właściciela | 2–3 |

Kolejność w fali 2 ustala właściciel jedną decyzją po pilotażu; rekomendacja CTO: 3.6 → 3.1 → 3.3 → 3.4 → 3.5 → 3.2 → 3.7 → 3.8 (najpierw to, co domyka formułę „sygnał → wartość”, potem Agent).
### 🍾 Lista kontrolna szampana — koniec fali 2 (per program, powtarzana dla każdego z 3.1–3.13)
| # | Co musi być prawdą | Kto potwierdza | Artefakt dowodu |
|---|---|---|---|
| S3.1 | Program ma własny SSOT (jedna strona) i prototyp zaakceptowany PRZED budową | właściciel | SSOT w `docs/ssot/`, karta prototypu z „Tak” |
| S3.2 | Zbudowany na kanonie (StandardTable/SPEC-A/ArtifactRightPanel), zero flag chowających, po polsku | nadzorca | strażniki + zrzuty |
| S3.3 | Mechanika działa end-to-end na produkcji na danych pilotażu, z testem mutacyjnym w zabezpieczenie | nadzorca | Playwright + testy |
| S3.4 | Użytkownik pilotażu użył funkcji sam i dziennik nie ma BLOKER | użytkownik + nadzorca | dziennik |
| S3.5 | Program zamrożony tagiem, rejestr i przekazanie zaktualizowane | nadzorca | tag `fala2-<program>-<data>` |
**Komunikat po każdym programie:** „<Program> działa u klienta.” Szampan nr 3+, po jednym na program — nigdy hurtem.


---

## Jak następca ma z tego korzystać
1. Otwiera ten plik i rejestr odbioru; bierze pierwszą niezamkniętą pozycję pojemnika 1.
2. Każda pozycja = zlecenie z §10 (komendy, progi, STOP) i §11 (wklejka) jak w `PROGRAM_NAPRAWCZY_20260905/00_SZABLON_PACZKI.md`; odbiór rytmem z `PRZEKAZANIE_20260906_RANO.md` §8.
3. Zamknięcie pojemnika = wszystkie kryteria z listy odhaczone w rejestrze z SHA i dowodem + słowo właściciela + tag `mvp-wlasciciel-<data>` / `mvp-klient-<data>`.
4. Ten plik aktualizuje się TYLKO przez dopisanie stanu przy pozycji (data, SHA, werdykt), nie przez zmianę kryteriów — kryteria zmienia właściciel słowem, zapisanym w ledgerze decyzji.

- 06.09 11:35 (słowo właściciela przy przejściu, Czat): „taki wielki plan wykonaj trzeba by też zrobić jakoś prościej i delikatniej — ale to już może iść do fazy 2” → **Fala 2, pozycja 3.9 (nowa): Propozycje Teresy — prostszy i delikatniejszy przepływ wykonania planu** (mniej kart, mniej ceremonii, jedna decyzja użytkownika); w pojemniku 1 tylko 1.1-A (wstaw do dokumentu, zero obiektów bez „Zatwierdź”).

- 06.09 12:33 (właściciel, Notatnik): **Fala 2, pozycja 3.10 (nowa): dyktowanie notatek głosem** — „ja sobie coś gadam, a tu notatki się tworzą” (mowa → tekst w edytorze notatki, na bazie głosu Teresy z 1.1-C).

- 06.09 13:00 (właściciel, Sejfy): **Fala 2, pozycja 3.11 (nowa): Foldery w Sejfach** — zakładka „Foldery” zdjęta z MVP, wraca jako osobny program po pilotażu.

- 06.09 13:31 (właściciel, Wywiad): **Fala 2, pozycja 3.12 (nowa): zatwierdzanie i dopuszczanie odpowiedzi w Wywiadzie** — „menedżer zwracający ma mieć możliwość przyjęcia albo nieprzyjęcia udzielonych odpowiedzi”. W pojemniku 1 tylko porządek: stepper etapów i zakładka „Dopuszczenie” usunięte (DEC-410, DEC-410b), istniejące „zatwierdź / odeślij” w Przydzielone zostaje.
