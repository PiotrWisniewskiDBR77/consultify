# Dowód J2 — moduł 02 MOJA PRACA, spójność językowa (09.09.2026)

Paczka **J2** programu `docs/program/JEZYK_EN_PL_20260908/PLAN.md`.
Gałąź `mvp/j2-mojapraca-0909`, baza `d7c7f3e437`.
Znacznik odmrożenia: `[ODMROZENIE 07_MY_WORK_AGENT DEC-453]`.

---

## 1. Pomiar przyrządem (`scripts/i18n/pomiar-jezyka.mjs --modul "02 My Work"`)

| Kategoria | PRZED | PO | Uwaga |
| --- | --: | --: | --- |
| K1def — polski `defaultValue` w `t()` | **182** | **0** | |
| K1defWID — z tego BEZ klucza w EN (polski na stałe) | **23** | **0** | |
| K3a — klucz w PL, brak w EN | **3** | **0** | |
| K2 — angielski w pliku PL | 3 | **2** | zostaje „what-if" — patrz STOP |
| K4pl — polski na sztywno w JSX | 78 | **62** | 61 z 62 to CaseWorkspace — patrz STOP |
| K4en — angielski na sztywno w JSX | 71 | **56** | 35 w martwych kolejkach, 15 fałszywych trafień — patrz STOP |
| K7 — daty/liczby bez locale albo z locale przybitym | **75** | **0** | |
| K5pl / K5en — zdania z serwera | 1 / 61 | 1 / 61 | paczka J17, nie ta |

`baseline.json` obniżony w tych samych commitach, w których poszła naprawa.
Bramka `pomiar-jezyka.mjs --baseline` przechodzi (nic nie wzrosło).

---

## 2. Zrzuty — 22 obrazy PRZED (baza) i 22 PO, EN i PL, 1440×900, motyw jasny

Konto `audyt@dbr77.local`, realny Postgres `consultify_kopia_final`
(API 4198, Vite 3216 dla gałęzi i 3217 dla czystej kopii bazy `d7c7f3e437`).
Przyrząd: `.pomiar/zrzuty-j2.mjs`, `.pomiar/zrzuty-glebokie.mjs`,
`.pomiar/zrzut-inspektor.mjs` (poza repo — pliki robocze paczki).

Ekrany: skrzynka · zadania (tabela) · notatnik · kalendarz · pomysły ·
decyzje · sejf · notatnik z otwartą stroną i prawym pasem · warsztat pomysłu
(mapa myśli) · warsztat pomysłu (tabela) · **inspektor elementu z zaznaczonym
węzłem** (tam mieszkały klucze `myWork.ideaInspector.*` bez pary w EN).

Licznik obcych słów interfejsu (`raport.json`, `raport-glebokie.json`):

* **EN: 0 obcych słów interfejsu na wszystkich 11 ekranach** (PRZED i PO).
* **PL: 1 → 0** (`myWork.hub.label51` / `label15`: „Moje prośby (pending)"
  → „(oczekujące)").

### ★ Uczciwie: zrzuty NIE pokazują różnicy, i wiem dlaczego

Na tych ekranach konto angielskie było czyste **już przed paczką**. Naprawione
182 `defaultValue` bronią ścieżek, których te zrzuty nie odwiedzają: pustych
stanów tabeli (`ideas.table.start.*` — tabela musi być pusta), kolejki
przekazań (`p9Handoff.*` — brak rekordów w tej bazie), dialogów sejfu
(`vault.folders.rename/deleteConfirm.*`), menu kebab i pasków edycji obiektu
na kanwie (`canvasEditBar.*`), inline-AI notatki (`myWorkNotebook.inlineAi.*`).
**23 z nich nie miały klucza w `en/translation.json`** — dla konta angielskiego
były polskie NA STAŁE, nie tylko przy pierwszym malowaniu. Dowodem na te
ścieżki jest pomiar i bezpiecznik źródłowy (§3), nie te obrazy.

Słowa polskie widoczne na zrzutach EN to **DANE** (tytuły zadań i pomysłów,
treść notatek, nazwy widoków i kolumn zapisane w pomyśle). Przyrząd odkłada je
do osobnego wiadra na podstawie **wartości pobranych z bazy**, nie po
selektorze CSS. Kategoria K6, osobna paczka.

---

## 3. Bezpiecznik źródłowy

`src/components/MyWork/__tests__/jezykMojejPracy.source.test.ts` — cztery
przypadki (lista plików niepusta · zero polskich defaultów w `t()` · zero
polskich napisów poza `t()` · zero dat bez locale).
Mutacja sprawdzona na `TaskRow.tsx`, każda osobno: polski default → RED,
polski `<span>` z ogonkami → RED, `toLocaleDateString()` → RED.
Zmierzone ograniczenie zapisane w nagłówku pliku: to samo zdanie BEZ ogonków
(„Warunki zamkniecia zadania") przechodzi na zielono.

**Bezpiecznik znalazł polski, którego przyrząd pomiarowy NIE widzi** (skaner
liczy default tylko w tej samej linii co `t(`): 5 komunikatów błędu kanbanu,
5 nagłówków grup PMO w Skrzynce, 6 etykiet `PMO_CATEGORY_CONFIG`, 5 przycisków
triażu i 4 poziomy pilności skrzynki, 4 bloki czasu Skupienia.

---

## 4. Znaleziska do decyzji właściciela (NIE naprawiane w tej paczce)

1. **`POST /api/auth/login` i `GET /api/users/me` nie zwracają pola
   `language`.** Zmierzone curlem: klucze `user` to `accessLevel … status`,
   bez `language`. Front woła wtedy `syncLanguageFromAccount(undefined)`,
   spada na domyślny język organizacji (dla DBR77 też pusty) i zostaje przy
   tym, co wygrał wyścig detektora — **ten sam ekran wychodzi raz po polsku,
   raz po angielsku**. Zmierzone A/B na jednym adresie, 3 próby każda:
   baza `d7c7f3e437` przeskoczyła 2 razy na 3, ta gałąź 3 na 3 w innej próbie
   — **defekt jest wcześniejszy niż ta paczka i dotyczy obu**. Ustawienie
   języka na koncie dziś NIE DZIAŁA. To zmiana kontraktu API → STOP zgodnie
   z §3 PLANU. Przyrząd dokłada brakujące pole (`page.route`), żeby mierzyć
   tłumaczenia, a nie wyścig — inaczej pomiar byłby losowy.
2. **11 kolejek nadzorczych bez ani jednego wołacza** (3 614 linii):
   Analysis/Definition/Schedule/Portfolio/GateSignoff/MaterialChange/
   ExecutionCanonicalWork/Closure/AIAnalysisProposalReview/
   DeliveryResultsAcceptance/EffectivenessClosure. Zamontowana jest tylko
   `HandoffAcceptanceQueue`. Siedzi w nich 35 z 56 pozostałych K4en.
   Podłączyć czy usunąć?
3. **CaseWorkspace (Zlecenia), 10 075 linii bez ani jednego `useTranslation`.**
   61 z 62 pozostałych K4pl. Trasa `/zlecenia` przy fladze OFF (domyślnie) nie
   jest nawet rejestrowana w `src/App.tsx`. Osobna paczka J2b.
4. **„what-if"** — termin fachowy spoza listy nazw własnych w
   `scripts/i18n/pomiar-jezyka.wyjatki.json` (plik wspólny). Zostawia K2=2.
   Ten sam przypadek zostawił J7b (K2=1).
