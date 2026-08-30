---
doc_id: program-sciezka-wyjscia
status: canonical
owner: piotr
truth_type: plan
established: 2026-08-30
---

# ŚCIEŻKA WYJŚCIA — od dziś do końca programu

Odpowiedź na pytanie właściciela z 30.08 wieczór: „czas tworzyć ścieżkę do wyjścia".
Kotwica: plan 4-fazowy zaakceptowany 24.08. **Faza 0 i 1 zamknięte. Jesteśmy w Fazie 2**
(pętla per moduł). Ten dokument nie wymyśla nowej metodyki — wyznacza kroki do Fazy 3.

## Definicja KOŃCA (niezmieniona od 24.08)

1. **16 × `CLOSED_FINAL`** — każdy moduł: SHA + hash kompletu zrzutów + tag `final-XX`;
   zamknięty nie wraca, nowe pomysły → backlog po-MVP.
2. **Demo aktualne**: frozen SHA → staging → demo + tag `demo-safe` (Faza 3, 2-3 dni).
3. **Decyzja o agencie** podjęta po dyżurze 174 (włączyć albo świadomie nie).

## Gdzie jesteśmy (zmierzone 30.08)

- Moduły zamknięte: **2/16** (Organizacja, Ustawienia).
- Tor funkcji do domknięcia wszystkich: **~21-29 dyżurów**
  (`funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md` — zweryfikowany kodem).
- Gałąź **buduje się** (serwer+front PASS, ta sama ścieżka co Railway).
- Tor grafiki: „od ciula roboty" (słowa właściciela) — układa ekrany w 16 modułów,
  rejestr `grafika/REJESTR_EKRANOW.md`.
- Rozszerzenie 128→173 dyżurów to była głównie IDENTYFIKACJA (odbiory znajdowały
  realne defekty), nie rozrost zakresu — od rekonesansu obowiązuje: znalezisko →
  pozycja w karcie, nie nowy dyżur (wyjątek P0).

## KROKI — w kolejności, z warunkami przejścia

**K1 · Ogon funkcji (1-2 dni).** Wykonanie 171·172·173 (wydane), wydanie 163-bis
(poprawka regresji) i 174 (agent: stop+koszt+pisarz polityk). 170 scalony po FIX.
→ *bramka: zero dyżurów „w locie".*

**K2 · Fala Z1 funkcji (2-3 dni, równolegle z K1).** Admin·Ustawienia·Czat·Spotkania·
Partner·Narzędzia·Audyty — 5-9 małych dyżurów wg rekonesansu.
→ *bramka: 9 modułów w stanie „funkcje gotowe do zrzutów".*

**K3 · Scalanie modułowe funkcje+grafika (rytm ciągły od K2).** Per moduł: tor grafiki
domyka ekrany → komplet zrzutów (dark+light, pusta/pełna, kebab, preview, karta) →
pakiet odbiorczy → **werdykt właściciela w partiach 2-3 modułów** → `CLOSED_FINAL`+tag.
Kolejność podawana przez KOORDYNACJA.md; zaczynamy od modułów, gdzie oba tory gotowe.
→ *to jest główny licznik programu: 2→16.*

**K4 · Z2/Z3 funkcji (3-5 dni).** Finanse·Wyniki·Materiały (najpierw ekrany harnessem —
właściciel ich nie widział), potem NO_GO (Ocena·Inicjatywy) i architektura
(Realizacja·Moja praca) — PO decyzjach właściciela (8 pytań w rekonesansie).

**K5 · Faza 3 — droga na demo.** Po pierwszej partii CLOSED_FINAL: frozen SHA →
staging (pełny przebieg migracji od zera już pilnowany bramką CI) → demo, merge nie
force, tag `demo-safe-<data>`, skill `consultify-promocja-demo`. 3709 commitów
dystansu schodzi JEDNYM zaplanowanym scaleniem kandydata, nie kroplówką.
→ *bramka: właściciel widzi zamknięte moduły na demo.*

**K6 · Agent.** Po 174 + decyzji: `ENABLE_AI_TASKS_WORKER` ON albo świadome NIE.

## Rachunek czasu (uczciwy)

Tor funkcji: 21-29 dyżurów przy zmierzonym tempie 10-14 odebranych/dzień = **2-3 dni
robocze**. Wąskie gardła NIE są w funkcjach: (1) tor grafiki — nieoszacowany tutaj,
mierzy go drugi czat; (2) **werdykty właściciela** — 14 modułów × pakiet zrzutów;
proponowany rytm: partia 2-3 modułów na posiedzenie. Przy 5 posiedzeniach werdyktowych
i gotowej grafice: **horyzont zamknięcia Fazy 2 ≈ tydzień-półtora**, Faza 3 = +2-3 dni.

## Czego ten plan wymaga od właściciela

1. Odpowiedzi na 3 pytania fali Z1 (Spotkania-beta · producent sygnałów · powierzchnia
   Audytów) — już zadane w rozmowie.
2. Pozostałych 5 decyzji z rekonesansu przed falą Z3.
3. Zgody na rytm werdyktów (partie 2-3 modułów).
