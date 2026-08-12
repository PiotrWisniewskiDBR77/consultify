# 23 — Prompt for the next session

Copy everything between the rules into the new session as the first message.

---

Kontynuuj program Ideas Transformation. Nie twórz nowej gałęzi ani nowej sesji programu bez
potwierdzenia — na dysku istnieje RÓWNOLEGŁA linia (`ideas-transform/consultify`, branch
`codex/ideas-transformation-20260809`, obserwowana ta sesja przy `fe2b8b7a82`, PRZED tą linią
multi-stream); to NIE jest ta sama praca — zapytaj właściciela, zanim ją dotkniesz.

Worktree: /Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09
Branch:   codex/ideas-s11-docs
HEAD:     6fec03f7a0   (57 commitów przed origin/demo, 2 ZA — patrz KROK 0, drzewo czyste, NIGDY nie pushowane)

KROK 0 — origin/demo się przesunęło w trakcie tej fali (9d17cac114 → f3e7df565e, "Slack Command
Center hardening", INNA sesja). Baza porównawcza dla KAŻDEGO A/B w tym pakiecie ZOSTAJE
zamrożona na 9d17cac114 — nie przestawiaj jej. Rozłączność zweryfikowana: te 2 commity dotykają
6 plików, zero przecięcia z czymkolwiek dotkniętym przez ten program.

KROK 1 — przeczytaj w całości, w tej kolejności:
1. docs/qa/ideas-complete-transformation-2026-08-09/RESUME_HANDOFF.md   ← zacznij tutaj
2. .../24_FINAL_ACCEPTANCE.md                     (rekomendacja + tabela zamknięcia E00-E15)
3. .../22_CODEX_REVIEW_REPORT.md
4. .../16_OPEN_RISKS_AND_LIMITATIONS.csv   (38 wierszy; parsuj PRAWDZIWYM parserem CSV — komórki mają przecinki w cudzysłowach)
5. .../19_VISUAL_CX_MATRIX.md              (sekcja PRODUCTION-SHAPE = nowe, nietriażowane znalezisko)

KROK 2 — sprawdź stan zanim cokolwiek zrobisz:
    cd "<worktree>" && git log --oneline -3 && git status --short && git rev-list --left-right --count origin/demo...HEAD
    for g in check-actions check-ledger-csv check-focus-canon check-list-canon check-artefakt; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
Oczekiwane: HEAD 6fec03f7a0, 0 zmian, "2 57" (2 ZA origin/demo, 57 PRZED),
check-actions rc=1 (udokumentowane, patrz KROK 3 punkt 4), reszta bramek rc=0.
Jeśli cokolwiek się nie zgadza — zatrzymaj się i ustal dlaczego, zanim ruszysz dalej.

KROK 3 — otwarte sprawy, w kolejności ważności:

1) E15 DWIE CZYSTE RUNDY jeszcze nie uruchomione na tym SHA. Ostatni zapisany czysty wynik jest
   przy c5b1b6e6b9, 16 commitów za HEAD. Właściciel uruchamia to osobno i dostarczy liczby —
   sprawdź, czy 24_FINAL_ACCEPTANCE.md nadal ma placeholder, czy liczby już przyszły.

2) NOWE, NIEZTRIAŻOWANE znalezisko wizualne: dokładnie przy 1280x800, kebab akcji wiersza w
   Tabeli Idei nie mieści się w kadrze w spoczynku w PRAWDZIWYM wrapperze produkcyjnym, bez
   widocznej podpowiedzi przewijania (kontener faktycznie się przewija —
   TableWithPreviewLayout.tsx — po prostu nie widać tego bez wcześniejszej wiedzy). Nie ma
   jeszcze własnego numeru ryzyka. Zdecyduj z właścicielem, czy to osobny wiersz P2/P3.

3) RISK-30 rezydualne: `confirmed:false` nadal nie wysyła wiadomości na czacie, więc 58
   niezmigrowanych akcji może dalej brzmieć jak sukces w odpowiedzi Teresy. Potrzebna ścieżka
   korekty w UI czatu, nie tylko uczciwa flaga.

4) `scripts/check-actions.sh` = rc=1, ŚWIADOMIE. 3 handlery-komendy w FinancialCaseDialog.tsx
   (save/saveAndClose/retry) nie są jeszcze śledzone do IDEA_ACTION_REGISTRY — naprawa wymaga
   src/actions/registry/sharedActions.ts, który był aktywnie przepisywany przez inny strumień
   (S5) w tej fali. Gotowa naprawa opisana w 10_FINANCIAL_CASE_ACCEPTANCE.md §6.9.

5) RISK-31/RISK-36 wydajność: N>=500 (Process Flow) i N=5000/10000 (Tabela) NIE ZMIERZONE,
   dosłownie, decyzją właściciela — maszyna miała obciążenie 84-832 z procesów niezwiązanych z
   Consultify. Nie opisuj żadnej z tych zmian jako poprawę bez czystej liczby.

6) RISK-24 — konwergencja schematu na czystej bazie nadal zepsuta obydwoma runnerami. Dwie NOWE
   konkretne instancje znalezione w tej fali (role_change_audit_events, organization_context_
   snapshots) — opisane, nie naprawione, poza zakresem programu.

ZASADY, które trzymają wiarygodność tego programu (każda kupiona defektem):
- Nie ufaj raportowi agenta — uruchom sam. Ta fala złapała: rozjazd między tekstem CSV a plikami
  faktycznie leżącymi na dysku (RISK-29 "tylko light/pl" — wszystkie 4 komórki były już czyste);
  liczbę kluczy lokalizacji, która się nie zgodziła z niezależnym liczeniem integratora (478/494
  vs 445/461) — zapisano obie, nie uzgodniono na siłę.
- Atakuj każdą zieleń, zanim ją przyjmiesz — także zieleń z WYŁĄCZENIA jednej warstwy
  dwuwarstwowej ochrony. Sabotaż OCC dla RISK-12 był dwuetapowy: wyłączenie SAMEGO
  szybkiego sprawdzenia wersji JS zostawiło zielone (warstwa SQL compare-and-swap złapała
  sama) — to redundancja, nie pusta asercja. Dopiero wyłączenie OBU warstw dało czerwone.
- „Znana przedistniejąca porażka" to twierdzenie, nie fakt, dopóki nie porównasz A/B z
  origin/demo@9d17cac114 (RISK-13/16/17/18 są teraz formalnie zweryfikowane, nie tylko
  przyjęte na wiarę).
- Pytaj „harness czy produkt?" zanim naprawisz cokolwiek widziane na zrzucie — i pytaj to
  jeszcze raz zanim ogłosisz macierz aktualną: sprawdź pliki na dysku, nie tylko tekst CSV.
- Łap prawdziwe kody wyjścia. `cmd | tail` zwraca status `tail`. NODE_ENV=test bez
  RUN_DB_TESTS=1 i MOCK_DB=false = CICHA ATRAPA BAZY. Bramki czytają ścieżki względem cwd —
  uruchamiaj z korzenia worktree.

ŚRODOWISKO — oszczędzi Ci godziny:
- `tsc` uruchamiaj SZEREGOWO (klient, potem serwer). Na tej maszynie działa kilka sesji naraz.
- `git stash` jest WSPÓLNY dla wszystkich worktree tego repo. Do porównań używaj
  `git diff > /tmp/x.patch` i `git apply -R`.
- Czyste `git apply` może wnieść złą treść BEZ konfliktu — sprawdzaj `git log --oneline
  <base>..HEAD -- <plik> | wc -l` = 0 znaczy „nie Twój".
- Bazy efemeryczne (127.0.0.1:54329 i :54331, ta druga teraz **1012 tabel** po migracji E09)
  po 24h prawdopodobnie już nie istnieją. Przepis odtworzenia: 13_RUNTIME_GATE_EVIDENCE.md §2.
  NIGDY demo (trolley:28146), NIGDY produkcja (centerbeam:37823), NIGDY dev (thomas:20221).
- Realne testy bazy potrzebują OBU: RUN_DB_TESTS=1 ORAZ MOCK_DB=false.

OGRANICZENIA: bez push, bez merge do demo, bez deployu, bez migracji na demo/produkcji.
Nie deklaruj READY_FOR_CODEX_REVIEW, dopóki E15 nie ma świeżego wyniku na 6fec03f7a0 i Piotr nie
da akceptu wzrokowego — to jedyne dwa realne braki, reszta techniczna jest zamknięta (patrz
24_FINAL_ACCEPTANCE.md).

---
