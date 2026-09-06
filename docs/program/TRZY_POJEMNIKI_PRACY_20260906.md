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

**Decyzje właściciela w tym pojemniku (jedna dziennie):** Finanse MINIMUM do MVP (F1 §0) czy poza; grupowanie inicjatyw po zdjęciu Projektów (rekomendacja: płaska lista + obszar/oś); kropka „Model” w crimson.

---

## Pojemnik 2 — MVP rękami klienta (cel: 3 tygodnie po pojemniku 1, do ~7.10)
**Definicja:** obcy użytkownik (klient pilotażowy, pierwszy: DBR77 jako firma, potem 1 klient zewnętrzny)
zakłada organizację, wchodzi bez asysty i dochodzi od wywiadu do wyniku bez pytania „gdzie to jest”.

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
14. **Definicja pilotażu:** jeden NAZWANY użytkownik, który nie jest właścicielem, jego dane, dziennik zgłoszeń (Feedback w aplikacji) przeglądany codziennie, próg wyjścia: 0 BLOKER, ≤ 3 WAŻNE otwarte.

**Pozycje (kolejność):** 2.0 produkcja i cofnięcie przećwiczone (Opus + nadzorca, 2 sesje) → 2.1 przepływ „pusty stan → pierwsza wartość” per moduł (Sonnet ×2, 2 sesje) → 2.2 macierz cross-org + CSRF enforce + poczta (Sonnet/Opus, 3) → 2.3 dwa magazyny → jedna projekcja (Opus, 3) → 2.4 onboarding i TRIAL (Sonnet, 1) → 2.5 wydajność ekranów flagowych (Sonnet, 1) → 2.6 Finanse wg decyzji (Codex, 5–8) → 2.7 przewodnik w aplikacji (Sonnet, 1) → 2.8 obserwowalność + limiter AI + eksport/usunięcie danych (Sonnet, 3) → 2.9 playbook wdrożenia klienta (właściciel + nadzorca, 1) → 2.10 pilotaż z nazwanym użytkownikiem i dziennikiem (2 tygodnie) → 2.11 zamrożenie „MVP klienta” tagiem.

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

Kolejność w fali 2 ustala właściciel jedną decyzją po pilotażu; rekomendacja CTO: 3.6 → 3.1 → 3.3 → 3.4 → 3.5 → 3.2 → 3.7 → 3.8 (najpierw to, co domyka formułę „sygnał → wartość”, potem Agent).

---

## Jak następca ma z tego korzystać
1. Otwiera ten plik i rejestr odbioru; bierze pierwszą niezamkniętą pozycję pojemnika 1.
2. Każda pozycja = zlecenie z §10 (komendy, progi, STOP) i §11 (wklejka) jak w `PROGRAM_NAPRAWCZY_20260905/00_SZABLON_PACZKI.md`; odbiór rytmem z `PRZEKAZANIE_20260906_RANO.md` §8.
3. Zamknięcie pojemnika = wszystkie kryteria z listy odhaczone w rejestrze z SHA i dowodem + słowo właściciela + tag `mvp-wlasciciel-<data>` / `mvp-klient-<data>`.
4. Ten plik aktualizuje się TYLKO przez dopisanie stanu przy pozycji (data, SHA, werdykt), nie przez zmianę kryteriów — kryteria zmienia właściciel słowem, zapisanym w ledgerze decyzji.
