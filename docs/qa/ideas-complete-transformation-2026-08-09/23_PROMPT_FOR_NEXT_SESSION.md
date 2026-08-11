# 23 — Prompt for the next session

Copy everything between the rules into the new session as the first message.

---

Kontynuuj program Ideas Transformation. Nie twórz nowej gałęzi, worktree ani nowej sesji programu.

Worktree: /Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify
Branch:   codex/ideas-transformation-20260809
HEAD:     d31dd37bd4   (40 commitów przed origin/demo, 0 za, drzewo czyste, NIGDY nie pushowane)

KROK 1 — przeczytaj w całości, w tej kolejności:
1. docs/qa/ideas-complete-transformation-2026-08-09/RESUME_HANDOFF.md   ← zacznij tutaj
2. .../22_CODEX_REVIEW_REPORT.md
3. .../16_OPEN_RISKS_AND_LIMITATIONS.csv   (37 wierszy; parsuj PRAWDZIWYM parserem CSV — komórki mają przecinki w cudzysłowach)
4. .../21_FOCUS_AND_CONTRAST.md            (tabela kontrastu = Twoje pierwsze zadanie)
5. .../20_E15_TWO_CLEAN_ROUNDS.md          (czytaj RETRACTION zanim przeczytasz wyniki)

KROK 2 — sprawdź stan zanim cokolwiek zrobisz:
    cd "<worktree>" && git log --oneline -3 && git status --short && git rev-list --left-right --count origin/demo...HEAD
    for g in check-actions check-action-coverage check-list-canon check-gestosc check-ledger-csv check-artefakt check-focus-canon; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
Oczekiwane: HEAD d31dd37bd4, 0 zmian, "0 40", wszystkie bramki rc=0. Jeśli cokolwiek się nie zgadza — zatrzymaj się i ustal dlaczego, zanim ruszysz dalej.

KROK 3 — kolejność prac (narzucona, nie zmieniaj):

1) ZAMKNIJ GATE 4. Zostały TRZY zmierzone porażki kontrastu (RISK-35, P2):
   - kebab akcji wiersza w Tabeli Idei: 1,93:1 (jasny) i 1,61:1 (ciemny) przy progu 3:1
   - ciemna plakietka „L2" w Mapie myśli: 3,22:1 przy progu 4,5:1
   - jasna etykieta toru „Klient" w Przepływie: 4,43:1 przy progu 4,5:1
   Napraw tokenami c-*. NIGDY primary-<dowolna liczba> — każdy numer to crimson #85182F,
   zarezerwowany wyłącznie na semantykę krytyczną. Po naprawie zrób nowe zrzuty
   dotkniętych komórek, OBEJRZYJ JE SAM, i dopiero wtedy proś Piotra o akcept.

2) NIE proś o akcept, dopóki jakikolwiek P1 albo widoczna kolizja siedzi w raportach
   lub obrazach tego programu. Ta reguła istnieje, bo złamałem ją 2026-08-10 i właściciel
   to wyłapał. Zgłoszenie defektu w zdaniu podrzędnym go nie zamyka.

3) Dopiero potem przekazanie Codexowi — 22_CODEX_REVIEW_REPORT.md jest napisany,
   ale zweryfikuj jego liczby względem kodu przed wysłaniem.

DECYZJA WŁAŚCICIELA DO UZYSKANIA:
RISK-12 (P1) — sprawa finansowa E09 NIE MA ŻADNEJ ŚCIEŻKI ZAPISU. Okno wyrzuca pracę
użytkownika przy zamknięciu. Udowodnione: mount bez onCaseChange, zero route'ów, zero
migracji, zero tabel w żywej bazie, test przypina brak. Flaga domyślnie WYŁĄCZONA, więc
zasięg ograniczony. Zbudowanie tego to FUNKCJA — zapytaj Piotra, czy ma powstać; luka jest
wyceniona w 10_FINANCIAL_CASE_ACCEPTANCE.md. Nie buduj bez jego zgody.

ZASADY, które trzymają wiarygodność tego programu (każda kupiona defektem):
- Nie ufaj raportowi agenta — uruchom sam. Ta sesja złapała: podział rejestru, który się nie
  kompilował; pusty sabotaż maskowany przez DEFAULT kolumny; dokument dowodowy sprzeczny
  z kodem, który opisywał; cztery defekty z moich własnych scaleń trójstronnych.
- Atakuj każdą zieleń, zanim ją przyjmiesz. Test, który nie potrafi się zaczerwienić, nie jest
  dowodem. Jeśli sabotaż zostawia zielone — pusta jest ASERCJA, nie kod. Powiedz to i popraw
  asercję, zamiast księgować pass.
- Porównuj LICZBĘ testów per plik, nie tylko czerwony/zielony. Plik, który już był czerwony,
  potrafi po cichu zgubić wszystkie swoje testy.
- ZAKRES nie jest zakresem, dopóki przebieg go nie udowodni. Asertuj liczbę plików ORAZ
  obecność nazwanego pliku, którego się spodziewasz. Cytowany glob podany vitestowi to FILTR
  ścieżki, nie glob — dopasował zero plików i 59 z 208 nigdy się nie uruchomiło.
- „Znana przedistniejąca porażka" to twierdzenie, nie fakt. Jedna z listy okazała się regresją
  tego programu, a obecność na liście zablokowała bisekcję. Każda pozycja, której nikt nie
  porównał z origin/demo, jest NIEZWERYFIKOWANA, nie odziedziczona.
- Pytaj „harness czy produkt?" zanim naprawisz cokolwiek widziane na zrzucie.
- Łap prawdziwe kody wyjścia. `cmd | tail` zwraca status `tail`. NODE_ENV=test bez
  RUN_DB_TESTS=1 i MOCK_DB=false = CICHA ATRAPA BAZY. Bramki czytają ścieżki względem cwd —
  uruchamiaj z korzenia worktree.

ŚRODOWISKO — oszczędzi Ci godziny:
- `tsc` uruchamiaj SZEREGOWO (klient, potem serwer). Na tej maszynie działa kilka sesji naraz;
  trzy równoległe przebiegi zostały zagłodzone (0% CPU przez 8+ minut).
- `git stash` jest WSPÓLNY dla wszystkich worktree tego repo. Dwa razy wciągnął tu WIP innej
  sesji. Do porównań używaj `git diff > /tmp/x.patch` i `git apply -R`. Kopie obcego WIP:
  /private/tmp/consultify-ideas-foreign-wip-backup/
- Czyste `git apply` może wnieść złą treść BEZ konfliktu — trzy obce pliki weszły cicho.
  Po scaleniu sprawdź: `git log --oneline 9d17cac114..HEAD -- <plik> | wc -l` = 0 znaczy „nie Twój".
- Bazy efemeryczne (127.0.0.1:54329 i :54331) po 24h prawdopodobnie już nie istnieją.
  Przepis odtworzenia: 13_RUNTIME_GATE_EVIDENCE.md §2. NIGDY demo (trolley:28146),
  NIGDY produkcja (centerbeam:37823), NIGDY dev (thomas:20221).

OGRANICZENIA: bez push, bez merge do demo, bez deployu, bez migracji na demo/produkcji.
Pracuj równolegle wieloma agentami Sonnet w izolowanych worktree; Ty orkiestrujesz, scalasz
i weryfikujesz SAM. Raportuj po każdej fali. Nie deklaruj READY_FOR_CODEX_REVIEW, dopóki
Gate 4 nie przejdzie i Piotr nie da akceptu wzrokowego.

---
