---
doc_id: przekazanie-20260905-wieczor
status: canonical
truth_type: program-status
established: 2026-09-05 (wieczór)
author: CTO (Fable), sesja 727cd91f
---

# Przekazanie na koniec 05.09.2026 — stan, decyzje, następne kroki

## 1. Stan produktu
- **MVP odebrane i zamrożone: 14 modułów** (13 zatwierdzonych przez właściciela na ekranie finalnym + Czat). Tagi `mvp-final-*-20260905` na `origin` i `github-backup`. Rejestr: `docs/program/MVP_FINAL_ZAMROZONE.json`; bezpiecznik `scripts/mvp-final/check-freeze.sh` blokuje commit w module zamrożonym bez markera `[ODMROZENIE <MODUL> DEC-397]`.
- **Wyniki** — NIE zatwierdzone; budowa z 05.09 rano niezgodna z koncepcją; nowe SSOT (`docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md`) i paczka P7K (prototyp przed kodem, części A/B/C).
- **Finanse** — poza MVP słowem właściciela („nie jesteś w stanie tego zrobić”); założenia CTO w `docs/program/grafika/FINANSE_ZALOZENIA_CTO_20260905.md` (czekają na słowo → SSOT); program 6 ogniw `PROGRAM_NAPRAWCZY_20260905/F_FINANSE_PELNA_TABELA.md`.
- **Fala 2 (decyzje właściciela 05.09):** Agent (0/15 etapów z wykonawcą; worker `ENABLE_AI_TASKS_WORKER` wyłączony), Projekty, Menedżer, SIRI, porównanie wersji finansowych, Baseline v3 poza MVP.
- **Staging** `staging.consultify.ai` = `origin/staging` (auto-deploy z gałęzi; usługa podpięta do gałęzi `staging` TYLKO w env staging). Ostatni kod produktu: `dda794943e` (+ commity docs). Produkcja i demo nietknięte (ostatnie wdrożenia 25/26.08).
- **Linia robocza:** `/private/tmp/m03` (gałąź `codex/m03-admin-20260824`, kopia `github-backup/grafika/m03-20260902`). Lokalny frontend `localhost:3000` → staging (`scripts/dev/lokalnie-staging-20260905.sh`). Strona odbioru `http://127.0.0.1:3100/` (`PORT_ODBIOR=3100 ODBIOR_START=final ODBIOR_PAKIETY=<scratchpad>/odbior-zywo node scripts/dev/odbior-serwer.mjs`), sesja automatu `/private/tmp/odbior-auth/auth.json` (właściciel loguje się sam w `zaloguj.mjs`).

## 2. Dokumenty, do których się wraca (zamiast tłumaczyć po raz piętnasty)
- Mapa prawdy: `docs/SOURCE_OF_TRUTH.md` (sekcja Wyniki dodana 05.09).
- Wyniki: `docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md` + `docs/program/grafika/{DECYZJA_WYNIKI_TRZY_POZIOMY,WYNIKI_ZALOZENIA_GRAFICZNE_20260905,ROI_METODYKA_WLASCICIELA_20260905}.md` + załączniki `docs/modules/07_rezultaty/zalaczniki/`.
- Finanse: `docs/program/grafika/FINANSE_ZALOZENIA_CTO_20260905.md` (projekt).
- Audyt CES 2027 (125 ekranów, A 2,25 / B 2,00): `docs/program/AUDYT_AWARD_20260905/{README,A,B,C,D_SYNTEZA_I_PLAN}.md`.
- Program naprawczy (11 paczek + P7K, każda z §10 samokontrolą Codexa i §11 wklejką): `docs/program/PROGRAM_NAPRAWCZY_20260905/` (indeks `01_INDEKS_I_HARMONOGRAM.md`).
- Audyt formuły pracy 16 narzędzi: `docs/program/AUDYT_FORMULY_PRACY_20260905.md` (8 kryteriów, luki, kolejność domykania).
- Decyzje właściciela dnia: `docs/program/MVP_BACKLOG_20260905.md` §E–K; ledger `OWNER_DECISION_LEDGER_2026-08-24.md` DEC-397.
- Odbiór CTO per moduł: `docs/program/ODBIOR_CTO_20260905/*.md`, `status.json`.

## 3. Uchwała — zasady pracy potwierdzone 05.09 (właściciel + CTO)
1. **Zero pytań do właściciela** o szczegóły; CTO decyduje z dokumentów i zapisuje jako „decyzja CTO”. Pytanie tylko o kierunek produktu, produkcję/dane klientów, znaczące wydatki — i najwyżej jedno dziennie.
2. **Właściciel ocenia tylko obraz na żywo** — nigdy pary obrazów; karta odbioru = jeden obraz, Tak/Nie, jedno zdanie; odpowiedź pada raz.
3. **Prototyp → zrzut nadzorcy → akcept → budowa.** Właściciel nigdy nie jest pierwszym testerem wizualnym.
4. **Praca do celu (Codex):** każda paczka ma mierzalne §10 (komendy, progi z .json zrzutów, STOP) i §11 wklejkę w jednym bloku.
5. **Zamrażanie jako rytm:** moduł po ekranie flagowym i przepływie klikanym → `zamroz.mjs` tego samego dnia; odmrożenie tylko z markerem DEC-397 w zakresie programu.
6. **Formuła Harvey po MVP:** ekran flagowy per moduł jako miara, przepływ klikany zamiast zrzutu, jedna mechanika „coś źle → ktoś działa” (karta działania + Skrzynka) dla wszystkich narzędzi.
7. **Tanie modele domyślnie** (Sonnet), Opus tylko do projektowania i trudnego serwera; Fable = scalenia, odbiór, rejestry.
8. **Bezpieczniki procesu z dnia:** przed pushem na staging `cd server && tsc --build tsconfig.build.json`; zmiana zmiennej na Railway = redeploy z gałęzi (już naprawione); nigdy `merge …; worktree remove && branch -D` bez sprawdzenia `merge-base --is-ancestor`; `FORCE_SUPERADMIN_EMAILS` zapisuje rolę w bazie na stałe.

## 4. Pierwsza fala u Codexa (wydana 05.09 ~18:50)
P1 jeden panel · P2 tabela nie ucina · P3 koniec angielskiego · P4 kody techniczne · P5 szkielety i 404 · IV tryb ciemny; osobno **P7K Wyniki** (prototyp najpierw). Odbiór każdej: nadzorca wg §10 (własne zrzuty), merge `--no-ff` do m03, push `origin/staging`, wpis w rejestrze.

## 5. Otwarte na jutro (kolejność)
1. Odbiór raportów Codexa z pierwszej fali (gdy właściciel prześle).
2. Prototyp Wyników (P7K krok 1) — oglądam, poprawiam, dopiero potem właściciel.
3. Finanse: słowo właściciela do założeń → SSOT; program F na „jedziemy”.
4. Kręgosłup wartości (jedna strona SSOT konwersji między modułami) — krok 1 z audytu formuły.
5. Karta działania jako komponent wspólny + Skrzynka jako jedyny odbiornik.
6. Elementy obiektu dla pomysłu/decyzji/inicjatywy/spotkania/dokumentu; wzorzec „dobry dokument z szablonu”.
7. Jedyne pytanie do właściciela: co grupuje inicjatywy po zdjęciu Projektów (program/portfel/nic).
