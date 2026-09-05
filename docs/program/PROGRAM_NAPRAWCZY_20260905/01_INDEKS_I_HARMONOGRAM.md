# Program naprawczy „Award Winning / CES 2027” — indeks i harmonogram (05.09.2026)

Źródło znalezisk: `docs/program/AUDYT_AWARD_20260905/` (125 ekranów, A 2,25 / B 2,00). Każda paczka niżej ma §1–§9 (co, gdzie, jak, testy, odbiór, ryzyko, nakład) oraz **§10 „Cel osiągnięty” = mechaniczna samokontrola Codexa** i **§11 gotową wklejkę**. Zasada pracy: Codex pracuje do celu z §10, nadzorca odbiera zrzuty własnymi oczami i scala; właściciel widzi tylko efekt („moduł X gotowy do obejrzenia”).

## Paczki

| # | Plik | Co daje użytkownikowi | Nakład | Zależności | Odmrożenia |
| --- | --- | --- | :-: | --- | --- |
| P1 | `P1_JEDEN_PANEL_ZWIJANY.md` | jeden prawy panel na listach (Rekord \| Teresa), zwijany; Skrzynka przy 1280 px z 294 → 1024 px | 4,3 d | — | 6 modułów |
| P2 | `P2_TABELA_NIE_UCINA.md` | żadna tabela nie ucina nagłówków/wartości bez dymka (jedno źródło: `FilterableTable`) | 3,5 d | — | 0 |
| P3 | `P3_KONIEC_ANGIELSKIEGO.md` | zero angielskiego w polskim UI (15 źródeł, 3 023 brakujące klucze, karta inicjatywy 100 % EN) | ~8 d | — | 8 modułów |
| P4 | `P4_KODY_TECHNICZNE_W_UI.md` | zero enumów/UUID/nazw funkcji w UI; słowniki SSOT + resolver nazw + mapper błędów | ~4 d | — | 4 moduły |
| P5 | `P5_SZKIELETY_I_404.md` | nic nie ładuje się w ciszy; brak = 200/null, nie 404; Megatrendy ożywają | ~8 d | — | 3 moduły |
| P6 | `P6_CZERWIEN_I_1440.md` | czerwień tylko dla krytycznych; nagłówki bez nakładania przy 1440 px | ~3,5 d | P4 (mapa tonów) | 2 moduły |
| P7 | — | nawigacja KPI tabela → lista → karta N | **WYKONANE 05.09** (`dda794943e`) | — | — |
| P8 | (w P3/P5) | sprzątanie danych testowych z historii Czatu | 0,5 d | — | dane, nie kod |
| F | `F_FINANSE_PELNA_TABELA.md` | CFO: import → zatwierdzenie → analiza → model → **pełna tabela RZiS/Bilans/CF** → wycena ze źródłem (6 ogniw + opcjonalne 7) | 6,75 d Opus + 2,5 d Sonnet; ścieżka krytyczna 6,25 d | — (osobny tor) | 0 (Finanse niezamrożone) |
| II | `II_EKRANY_FLAGOWE.md` | 16 ekranów flagowych do poziomu sceny (A=3, B=3, 1280/1440/1920, jasny+ciemny) | 22–24 d (równolegle) | P1–P6 per ekran | 8 modułów |
| III | `III_PRZEPLYWY_KLIKANE.md` | 16 scenariuszy konsultanta klikanych end-to-end (26 kroków dziś zablokowanych) | ~1 d na scenariusz | P1–P6 dla blokad | 0 (testy) |
| IV | `IV_TRYB_CIEMNY_I_LUKI_POMIAROWE.md` | tryb ciemny mierzony (dziś 0 ekranów), klawiatura, superadmin, kalendarz „Dzień” | 8,5–10,5 d | — | 0 (narzędzia) |

## Harmonogram (kolejność wymuszona zależnościami; równoległość = osobne worktree Codexa)

**Tydzień 1 — fundamenty (równolegle, 5 worktree):** P1, P2, P3 (kroki 1–2 słowniki najpierw), P4 (krok 1 katalog `labels/` najpierw — P6 na nim stoi), P5 (kroki 1–2 hook + szkielety), IV (4.1–4.2 flaga i bezpiecznik — odblokowuje pomiar ciemny dla wszystkich). Nadzorca: odbiór każdej paczki wg §10, scalenie do `origin/staging`, jedna paczka = jedno wdrożenie.

**Tydzień 2 — fundamenty c.d. + Finanse start:** P3 (kroki 3–11), P5 (kroki 3–12), P6 (po P4 krok 1), IV (4.3 przebieg ciemny 16 modułów → raport E). F: ogniwa 1–2 (Opus, osobny tor od poniedziałku; nie czeka na P1–P6).

**Tydzień 3 — ekrany flagowe:** II dla modułów, których paczki P weszły (Ocena, Wyniki, Materiały, Admin, Ustawienia, Partner, Organizacja od razu; Moja Praca, Wywiad, Narzędzia po P1/P2/P5). F: ogniwa 3–4.

**Tydzień 4 — przepływy + domknięcie:** III (16 scenariuszy, blokady powinny znikać w miarę scaleń), II reszta, F: ogniwa 5–6 + komplet zrzutów §6 + przepływ CFO. IV: klawiatura, kalendarz „Dzień”, superadmin (jeśli konto).

**Rytm zamrażania:** moduł przechodzi II + III → tego samego dnia `zamroz.mjs` (re-tag), bez powrotu do dyskusji.

## Jedna decyzja właściciela na start

Wszystkie paczki dotykają modułów zamrożonych 05.09 (bezpiecznik `check-freeze.sh` blokuje commit bez markera). Proponuję **jedną** decyzję: **DEC-397 = „Program naprawczy Award/CES 2027 może odmrażać moduły zamrożone 05.09 wyłącznie w zakresie paczek P1–P6, II, III z tego katalogu; każdy commit niesie `[ODMROZENIE <MODUL> DEC-397]`; po zakończeniu paczki moduł jest ponownie zamrażany tego samego dnia.”** Bez tej decyzji Codex zatrzyma się na pierwszym commicie w module zamrożonym. To jedyne pytanie do właściciela w tym programie.

## Jak podać paczkę Codexowi

1. Skopiuj blok z §11 paczki (jeden blok kodu) — zawiera cel, kroki, kanon, §10 i zakazy.
2. Codex pracuje w świeżym worktree z `origin/staging`, commit per krok, bez push.
3. Codex melduje dopiero, gdy §10 spełnione (liczby, ścieżki zrzutów, SHA) lub gdy trafi na STOP (decyzja, nie obejście).
4. Nadzorca: `git merge --no-ff` do m03 po własnym obejrzeniu zrzutów, `tsc --build` serwera gdy dotknięty, push na `origin/staging` (auto-deploy), wpis w rejestrze.

## Czego ten program nie obejmuje (fala 2 poza nim)
Agent (wykonawcy etapów + producent rozpoznawania sprawy; worker `ENABLE_AI_TASKS_WORKER`), Projekty, Menedżer, SIRI, porównanie wersji finansowych poza opcjonalnym ogniwem 7 — patrz `docs/program/MVP_BACKLOG_20260905.md` §G–K.

## Rejestr odbioru (nadzorca; aktualizowany po każdym odbiorze)

| Paczka | Gałąź | Stan | Data | SHA scalenia | Dowód / uwagi |
| --- | --- | --- | --- | --- | --- |
| P4 | `codex/p4-kody` | **ODEBRANE, scalone** | 05.09 wieczór | `0a288a8f4f` | §10 zmierzone niezależnie (Sonnet): testy PASS, 2 mutacje RED→GREEN, 7 ekranów 0 UUID/SCREAMING/Unknown/manual, 0 błędów konsoli; CTO obejrzał zrzuty 05 i 07; serwer nietknięty |
| P2 | `codex/p2-tabela` | W TOKU u Codexa | 05.09 | — | mechanika w SSOT (`FilterableTable.tsx`, +160/−30, 38/38 testów, mutacja RED); brakuje `evidence/p2-tabela/`, pomiaru na żywo 5 ekranów × 3 szerokości, zrzutów jasny+ciemny, raportu |
| P7K | `codex/p7k-wyniki` | KROK 1 **NIE** — korekta 1b | 05.09 | — | werdykt `P7K_KROK1_WERDYKT_20260905.md` (9 korekt: crimson w stanach aktywnych, liczby łamane, nagłówki i FAZA ucięte, pill 3 linie, wiersze grup z „—”, panel bez accordionu/Teresy); KROK 2 zakazany |
| P1 | `codex/p1-jeden-panel` | W TOKU (14 commitów + 4 pliki niecommitowane) | 05.09 | — | czeka na raport |
| P3 | `codex/p3-angielski` | W TOKU (21 commitów + 10 plików niecommitowanych) | 05.09 | — | czeka na raport |
| P5 | `codex/p5-ladowanie` | W TOKU (9 commitów + 4 niecommitowane) | 05.09 | — | czeka na raport |
| IV | `codex/iv-tryb-ciemny` | W TOKU (2 commity + evidence niecommitowane) | 05.09 | — | czeka na raport |
| F0/F1 | — | **GOTOWE (dokumenty)** | 05.09 wieczór | — | `F0_FINANSE_AUDYT_LUKI_20260905.md` (teza „backend kompletny, frontend nieprzygotowany” obalona w obie strony: 6 tabel bez producenta, 23 % zdolności z pełnym przewodem, 27 % za 3 flagami; 21 etykiet EN) + `F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md` (MINIMUM 7 paczek ≈ 8 sesji Codexa, PEŁNY +11 ≈ 24; blokada F‑P4: nikt nie zakłada wierszy selekcji KPI). Decyzja właściciela: MINIMUM do MVP czy nie — po powrocie |
| P9 | — | **GOTOWE (paczka)** | 05.09 noc | — | `docs/ssot/KREGOSLUP_WARTOSCI.md` (32 konwersje: DZIAŁA 12 · ZA FLAGĄ 4 · WOŁACZ BEZ EKRANU 7 · EKRAN BEZ WOŁACZA 6 · BRAK 3; 8 osobnych kart działania, 14 rodzin tabel; Skrzynka zna 3 źródła) + `P9_KREGOSLUP_I_KARTA_DZIALANIA.md`. Decyzja CTO: DEC-397 obejmuje także P8/P9 (właściciel może uchylić). Rekomendacja CTO na pytanie o grupowanie inicjatyw: płaska lista + kolumna obszar/oś, program/portfel po MVP |
