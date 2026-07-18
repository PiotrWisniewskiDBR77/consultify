# Consultify — reguły pracy (dla każdej sesji i agenta)

Consultify to AI-native system realizacji doradztwa (nie generyczny SaaS-dashboard).
Właściciel: Piotr (product/strategy, nie-koder, komunikacja PO POLSKU, krótko, obrazkami).

## UI — PRAWO NADRZĘDNE
1. **Standard jest KODEM, nie opisem**: ekrany listowe budujemy WYŁĄCZNIE komponentami
   `src/components/standard/` (StandardModuleBar · StandardTable · StandardPreview).
   Moduł deklaruje treść, komponent narzuca wygląd. Zakaz własnych tabel/menu/preview per ekran.
2. **SSOT wyglądu: `docs/ui-standards/TRIADA_KANON.md`** (opis + twarde wartości + 40-punktowa
   lista czekowania + fotki referencyjne). Surowe słowa właściciela:
   `Harvard/wdrozenie-100/_STANDARD_TRIADA_NOTATKA.md`. Przy każdej pracy nad ekranem listowym
   użyj skilla `consultify-triada`.
3. **Pułapka nr 1: `primary` w tailwind = crimson #85182F.** Czerwień TYLKO semantyka krytyczna.
   CTA/stany aktywne = neutralne; fokus = niebieski `c-focus` (hook `check-list-canon.sh` blokuje naruszenia).
4. **Odbiór ekranu = lista czekowania część B, literalnie, ZA KAŻDYM RAZEM** (menu, tabela,
   pstryczek, kebab, preview, kanban, dark+light). Weryfikacja WZROKIEM (zrzuty), nigdy „testy przeszły".
5. **Nic nie wchodzi na demo bez akceptacji właściciela na zrzutach.** `origin/demo` = święta baza;
   push/deploy tylko nadzorca sesji głównej.
6. **ARTEFAKTY (ekrany-obiekty, nie listy): analogiczny standard = SPEC-A.** SSOT wyglądu:
   `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (§10.2/§11.2 powłoka, §13 per archetyp, §18.1 DoD).
   Powłoka wspólna (Menu 1 + prawy panel accordion `ArtifactRightPanel` + kebab + stany), archetyp
   zmienia TYLKO centrum (A Canvas·B Dokument·C Rekord·D Matryca·E Deck). Przy każdej pracy nad
   artefaktem użyj skilla `consultify-artefakty`. Pułapka: `primary-*` KAŻDY numer = crimson
   (hook `check-artefakt.sh` — zbudowany 2026-07-18 — blokuje w powłoce). Odbiór = DoD §18.1
   oczami. Plan: `_PROJEKT_B_VEGAS.md`.
7. **★ PIOTR NIGDY NIE JEST PIERWSZYM TESTEREM WIZUALNYM (nienaruszalne — powód: załamanie 07-11, „gwiazda").**
   Zanim Piotr zobaczy JAKIKOLWIEK ekran wizualny: (a) prototyp → wstępny OK Piotra; (b) JA renderuję realny
   ekran + robię ZRZUT sam (dev-render/harness z mock-danymi, bez logowania Piotra — wzór: harness EV
   football-field); (c) zrzut czysty (zero gwiazdek/ozdób, tokeny c-*, zgodny z prototypem); (d) DOPIERO wtedy
   Piotr patrzy — do AKCEPTU, nie do odkrywania zepsucia. Zakaz „włącz flagę i zobacz" jako pierwszego
   sprawdzenia. Wygląd tylko za flagą (default OFF) do akceptu. Po akcepcie → flaga domyślna + re-tag punktu.
8. **★ PRZYCISK COFANIA (`_RUNBOOK_COFANIA.md`).** Bezpieczny punkt = tag `demo-safe-<data>` (ostatni stan
   zaakceptowany przez Piotra), re-tagowany po każdej akcept-partii. Dramat wizualny→flaga OFF (natychmiast);
   zły deploy→Railway rollback/`git revert`; nuklearne→restore-commit DO PRZODU (checkout tagu→commit→push,
   NIGDY force-push na demo). Migracje sesji addytywne=bez rollbacku.

9. **★ ZAKAZ MASOWEGO WŁĄCZANIA + kanon tabel twardo (powód: krach 07-12, „tabelki jak dla trzylatka").**
   NIGDY nie włączaj wielu flag wizualnych naraz na żywo. Każdy ekran za flagą OFF idzie na demo
   TYLKO po akcepcie Piotra na CZYSTYM zrzucie, JEDEN po drugim (nie „daj wszystko"). Ekrany listowe
   WYŁĄCZNIE `StandardTable`/`StandardModuleBar` — powłoki NIE mogą kleić własnych tabel (to złamało
   zamrożony kanon 07-12: InitiativesLightShell/InterviewLightShell zrobiły bespoke grid zamiast
   StandardTable, poszły hurtem na żywo). Bezpiecznik: `scripts/check-list-canon.sh` (hook pre-commit
   + OBOWIĄZKOWO przed KAŻDYM push UI na demo) blokuje własne tabele. Materials/Tools = wzór poprawny
   (osadzają realny StandardTable).
## STRUKTURA PRAC (2026-07)
- Program 7 rozbudów narzędzi = mechanika NAJPIERW; artefakty (frontend) dorabiamy PO gotowej
  mechanice — patrz `Harvard/wdrozenie-100/_PROJEKT_B_VEGAS.md`.
- Rollout triady tabel (LISTA/SPEC-L) i artefaktów (ARTEFAKT/SPEC-A) — stan 12 narzędzi:
  `Harvard/wdrozenie-100/_FORMULA_MENU_NARZEDZI_12.md`.

## PRACA W PĘTLI (aktywny tryb od 07-08)
Program domykania = ŻELAZNA KOLEJNOŚĆ BLOKÓW B1→B9 (Harvard→Vegas→Oxford) — skill `consultify-petla`
(orkiestracja+pigułka+modele) i `consultify-test` (progi, panel, feed-forward kryteriów).
Dashboard statusu (aktualizuj po każdym bloku): `Harvard/wdrozenie-100/_STATUS_3_FILARY.html`.
SSOT statusów domknięcia fazy = `Harvard/wdrozenie-100/_REJESTR_DOKONCZENIA.md` (start/koniec każdej sesji).

## HIGIENA WYKONANIA
Robotnicy: modele tanie (Sonnet/Haiku) do mechaniki, Opus tylko trudny kod; świeża gałąź per krok
z `origin/demo`; isolation worktree; commit-per-krok; NIE push; zero sub-agentów;
zakaz pełnego tsc/vitest u robotników (esbuild per plik); NOWE pliki w `tests/` wymagają `git add -f`.
Dane demo = twarz produktu: probe'y sprzątają po sobie, zero rekordów testowych.

## ZŁOTE REGUŁY (dwie pułapki, które kosztowały tygodnie — nienaruszalne)
1. **Weryfikuj REALNY runtime, nie docy/flagi.** Audyty starzeją się w ~3 dni i zawyżają. Zanim
   powiesz „działa/gotowe": `grep` realnego callera w `src/`/`server/src/` (URL/handler), sprawdź
   czy flaga ma implementację (bywają FANTOMY — `ENABLE_TERESA_NOTE_CREATE` = 0 kodu), a stan danych
   czytaj z ŻYWEJ bazy, nie z kodu. „Testy przeszły" ≠ „działa".
2. **Baza gałęzi ZAWSZE `origin/demo`** (od 07-08: demo = target deployu, niesie ~130 commitów mechaniki,
   których Londyn nie ma; Londyn dostaje forward-port per-SHA osobnym blokiem B7 — skill `consultify-petla`).
   NIGDY `feat/tp-forms-polish`, NIGDY `tp-*`/`deliverables-w1`/`harvard-noc` (skażony re-skin nocy 3/4).

## FINISZ 8 NARZĘDZI (aktywny program)
SSOT: `Harvard/wdrozenie-100/_PLANY_KONCOWE_2026-07-07/00_PLAN_DOKONCZENIA_FINAL.md` (fazy 0-5, decyzje P-1…P-10).
Kończąc/audytując silnik·Teresę·kolaborację narzędzia → skill `consultify-finisz-modulu`.
Promocja na demo / migracja bazy → skill `consultify-promocja-demo` (demo=święte, merge nie force).
