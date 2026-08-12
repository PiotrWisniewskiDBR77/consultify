# 23 — Prompt for the next session

Copy everything between the rules into the new session as the first message.

---

Kontynuuj program Ideas Transformation w GŁÓWNYM worktree integracyjnym
(`ideas-transform/consultify`, branch `codex/ideas-transformation-20260809`) —
to jest KANONICZNA linia: każda gałąź strumienia, w tym dokumentacyjna, była z
niej wycięta i wraca do niej przez cherry-pick. Nie ma tu rozjazdu do
uzgadniania.

Worktree: /Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify
(albo /Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09, ta sama treść po `git checkout -B codex/ideas-s11-docs bcdda752b7`)
Branch:   codex/ideas-transformation-20260809
HEAD:     bcdda752b7   (dokumentacja; kod finalny przy f5cdc7b867 — tylko commity dokumentacyjne po nim)
Pozycja:  62 commitów przed origin/demo, 2 ZA — patrz KROK 0, drzewo czyste, NIGDY nie pushowane

KROK 0 — origin/demo się przesunęło w trakcie tej fali (9d17cac114 → f3e7df565e, "Slack Command
Center hardening", INNA sesja). Baza porównawcza dla KAŻDEGO A/B w tym pakiecie ZOSTAJE
zamrożona na 9d17cac114 — nie przestawiaj jej. Rozłączność zweryfikowana: te 2 commity dotykają
6 plików, zero przecięcia z czymkolwiek dotkniętym przez ten program.

KROK 1 — przeczytaj w całości, w tej kolejności:
1. docs/qa/ideas-complete-transformation-2026-08-09/RESUME_HANDOFF.md   ← zacznij tutaj
2. .../24_FINAL_ACCEPTANCE.md                     (rekomendacja + tabela zamknięcia E00-E15 + finalne liczby E15)
3. .../22_CODEX_REVIEW_REPORT.md
4. .../20_E15_TWO_CLEAN_ROUNDS.md          (finalny przebieg na f5cdc7b867 + dwie adjudykacje NOT CLEAN)
5. .../16_OPEN_RISKS_AND_LIMITATIONS.csv   (38 wierszy; parsuj PRAWDZIWYM parserem CSV — komórki mają przecinki w cudzysłowach)
6. .../19_VISUAL_CX_MATRIX.md              (sekcja PRODUCTION-SHAPE = nowe, nietriażowane znalezisko)

KROK 2 — sprawdź stan zanim cokolwiek zrobisz:
    cd "<worktree>" && git log --oneline -3 && git status --short && git rev-list --left-right --count origin/demo...HEAD
    for g in check-actions check-action-coverage check-list-canon check-ledger-csv check-artefakt check-focus-canon; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
Oczekiwane: HEAD bcdda752b7, 0 zmian, "2 62" (2 ZA origin/demo, 62 PRZED),
WSZYSTKIE bramki rc=0 (check-actions raportuje 234 akcje · 124 stringi runtime · 7 zdarzeń · 4 metody API).
Jeśli cokolwiek się nie zgadza — zatrzymaj się i ustal dlaczego, zanim ruszysz dalej.

KROK 3 — otwarte sprawy, w kolejności ważności (żadna nie blokuje technicznie —
jedyny prawdziwy brak to akcept wzrokowy właściciela):

1) NOWE, NIEZTRIAŻOWANE znalezisko wizualne: dokładnie przy 1280x800, kebab akcji wiersza w
   Tabeli Idei nie mieści się w kadrze w spoczynku w PRAWDZIWYM wrapperze produkcyjnym, bez
   widocznej podpowiedzi przewijania (kontener faktycznie się przewija —
   TableWithPreviewLayout.tsx — po prostu nie widać tego bez wcześniejszej wiedzy). Nie ma
   jeszcze własnego numeru ryzyka. Zdecyduj z właścicielem, czy to osobny wiersz P2/P3.

2) RISK-30 rezydualne: `confirmed:false` nadal nie wysyła wiadomości na czacie, więc 58
   niezmigrowanych akcji może dalej brzmieć jak sukces w odpowiedzi Teresy. Potrzebna ścieżka
   korekty w UI czatu, nie tylko uczciwa flaga.

3) RISK-31/RISK-36 wydajność: N>=500 (Process Flow) i N=5000/10000 (Tabela) NIE ZMIERZONE,
   dosłownie, decyzją właściciela — maszyna miała obciążenie 84-832 z procesów niezwiązanych z
   Consultify. Nie opisuj żadnej z tych zmian jako poprawę bez czystej liczby.

4) RISK-24 — konwergencja schematu na czystej bazie nadal zepsuta obydwoma runnerami. Dwie NOWE
   konkretne instancje znalezione w tej fali (role_change_audit_events, organization_context_
   snapshots) — opisane, nie naprawione, poza zakresem programu.

5) E15 mechaniczny werdykt to NOT CLEAN (nie "clean") — dwa oznaczone elementy, OBA
   zaadjudykowane z dowodem, ŻADEN nie jest realną wadą produktu (przywrócony test portalu
   context-menu; trzy testy dp5Heuristic zastąpione świadomie przez pracę E10). Przeczytaj pełne
   adjudykacje w 20_E15_TWO_CLEAN_ROUNDS.md zanim zgłosisz cokolwiek jako regresję.

ZAMKNIĘTE w tej fali, żeby nie tracić na to czasu (sprawdź `16_OPEN_RISKS_AND_LIMITATIONS.csv`
zanim zaczniesz naprawiać którekolwiek z poniższych — mogą już nie być otwarte):
- `scripts/check-actions.sh` — było rc=1 (3 niezarejestrowane handlery w FinancialCaseDialog.tsx),
  teraz rc=0 (234/124/7/4) po commicie a537a022e2 — droga przez rejestr, nie --update.
- Type-check klienta i serwera — PASS przy f5cdc7b867 (dwa defekty międzyplikowe znalezione i
  naprawione dopiero na scalonym drzewie, niewidoczne dla żadnego pojedynczego strumienia z
  konstrukcji — robotnicy nie uruchamiają pełnego tsc).
- E15 dwie czyste rundy — URUCHOMIONE na f5cdc7b867 (patrz punkt 5 wyżej).

ZASADY, które trzymają wiarygodność tego programu (każda kupiona defektem):
- Nie ufaj raportowi agenta — uruchom sam. Ta fala złapała: rozjazd między tekstem CSV a plikami
  faktycznie leżącymi na dysku (RISK-29 "tylko light/pl" — wszystkie 4 komórki były już czyste);
  liczbę kluczy lokalizacji, która przeszła dwie rewizje zanim wylądowała na prawdziwej (445/461
  → 478/494, ta pierwsza po prostu poprzedzała trzy ostatnie strumienie lokalizacyjne).
- Atakuj każdą zieleń, zanim ją przyjmiesz — także zieleń z WYŁĄCZENIA jednej warstwy
  dwuwarstwowej ochrony. Sabotaż OCC dla RISK-12 był dwuetapowy: wyłączenie SAMEGO
  szybkiego sprawdzenia wersji JS zostawiło zielone (warstwa SQL compare-and-swap złapała
  sama) — to redundancja, nie pusta asercja. Dopiero wyłączenie OBU warstw dało czerwone.
- Plik, który znika CAŁKOWICIE, potrafi ukryć się przed porównaniem, które patrzy tylko na
  przecięcie zbiorów plików. Wcześniejsza runda E15 zgłosiła "0 plików straciło testy" i
  przegapiła dokładnie taki plik (ContextMenuPortal.test.tsx, skasowany pierwszym commitem tego
  programu) — porównuj ZBIORY nazw plików, nie tylko liczniki testów na przecięciu.
- „Znana przedistniejąca porażka" to twierdzenie, nie fakt, dopóki nie porównasz A/B z
  origin/demo@9d17cac114 (RISK-13/16/17/18 są teraz formalnie zweryfikowane, nie tylko
  przyjęte na wiarę).
- Pytaj „harness czy produkt?" zanim naprawisz cokolwiek widziane na zrzucie — i pytaj to
  jeszcze raz zanim ogłosisz macierz aktualną: sprawdź pliki na dysku, nie tylko tekst CSV.
- Łap prawdziwe kody wyjścia. `cmd | tail` zwraca status `tail`. NODE_ENV=test bez
  RUN_DB_TESTS=1 i MOCK_DB=false = CICHA ATRAPA BAZY. Bramki czytają ścieżki względem cwd —
  uruchamiaj z korzenia worktree.

ŚRODOWISKO — oszczędzi Ci godziny:
- `tsc` uruchamiaj SZEREGOWO (klient, potem serwer). Na tej maszynie działa kilka sesji naraz —
  dokładnie tak znaleziono oba defekty międzyplikowe zamknięte w tej fali.
- `git stash` jest WSPÓLNY dla wszystkich worktree tego repo. Do porównań używaj
  `git diff > /tmp/x.patch` i `git apply -R`.
- Czyste `git apply` może wnieść złą treść BEZ konfliktu — sprawdzaj `git log --oneline
  <base>..HEAD -- <plik> | wc -l` = 0 znaczy „nie Twój".
- Bazy efemeryczne (127.0.0.1:54329 i :54331, ta druga teraz **1012 tabel** po migracji E09)
  po 24h prawdopodobnie już nie istnieją. Przepis odtworzenia: 13_RUNTIME_GATE_EVIDENCE.md §2.
  NIGDY demo (trolley:28146), NIGDY produkcja (centerbeam:37823), NIGDY dev (thomas:20221).
- Realne testy bazy potrzebują OBU: RUN_DB_TESTS=1 ORAZ MOCK_DB=false.

OGRANICZENIA: bez push, bez merge do demo, bez deployu, bez migracji na demo/produkcji.
Nie deklaruj READY_FOR_CODEX_REVIEW, dopóki Piotr nie da akceptu wzrokowego — to JEDYNY realny
brak; wszystko techniczne (type-check, persystencja, kontrast, E15) jest zamknięte, patrz
24_FINAL_ACCEPTANCE.md.

---
