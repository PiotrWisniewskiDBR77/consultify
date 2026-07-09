# PLAN ROZWOJU OXFORD (narzędzia merytoryczne) — gotowy do kodowania

> Napisany 2026-07-09 wieczorem, żeby jutro rano dało się ruszyć bez czekania na kolejne ustalenia.
> Zasada z całej sesji: **audyt na żywym kodzie, nie deklaracja** — ten plan jest zbudowany na dzisiejszych
> odkryciach (nie na starym `_PROJEKT_C_OXFORD.md`, który zaniżał stan). SSOT progresu: ten plik +
> `_STATUS_3_FILARY.html` (dashboard, kolumna „Twój odbiór").
> **Nic z tego planu nie jest wykonane w nocy — to jest instrukcja na jutro, napisana dziś.**

---

## 0. GDZIE REALNIE JESTEŚMY (skorygowane 07-09)

| Strumień | Stan realny (nie deklaracja) |
|---|---|
| **O1 Kanony (DRD/SIRI/ADMA)** | SIRI+ADMA gotowe. DRD zbudowany komplet (kanon 7 osi, q-bank 699 pytań, generator raportu 17/17 testów) — **czeka Twój odbiór + 5 decyzji P1-P5**. |
| **O2 Standard wniosków** | SSOT gotowy (formuła K1-K4, 12 walidatorów). Wdrożenia SIRI/ADMA zbudowane. Brak: outputy tooli, finanse, generatory doc/deck. |
| **O3 Q-banki (19 narzędzi)** | **SKORYGOWANE DZIŚ.** 7 w pełni dowiedzione (SWOT-wzorzec, Porter, Value Chain, Ansoff, Portfolio Priority, Market Forces, **Risk & Uncertainty** — jedyny z realną sesją użycia). **12 w pełni okablowanych** (config+UI+rejestracja+żywe w bazie, klikalne), ale **zero realnych sesji** — nikt ich nie kliknął end-to-end. Wspólny brak: interaktywne „Pogłęb pozycję" martwe (nowa funkcja UX, nie bug). |
| **O4 Finanse jako doradztwo** | **Całkowicie nietknięte.** 7 elementów: business case, scenariusze, value tree, współzależności, guidance WACC, analiza sprawozdań, post-mortem. |
| **O5 Biblioteka promptów** | 25 sekcji inicjatyw (12 przepisanych). Brak: guidance frameworków, przegląd persony Teresy, rejestr promptów. |
| **O6 Benchmarki/profile branż** | Profile 3 branż DRD zbudowane (7/7) ale **niewpięte w raport**. |
| **O7 Standardy treści** | CARD_CONTENT_FORMULA + INITIATIVE_FORMULA (walidatory) gotowe. Brak: jakość języka PL/EN. |
| **O8 Pomoc/edukacja** | productHelpDigest częściowy. Brak: hinty, słownik pojęć. |

**Najważniejszy wniosek dnia:** Oxford nie jest „10% zrobione" jak mówił stary dashboard. Realnie: **7/19 narzędzi dowiedzione, 12/19 gotowych-czeka-klik, O1/O2 blisko odbioru**. Największa realna dziura to **O4 (Finanse jako doradztwo) — zero, i to jest fundament dla wielu innych strumieni** (bez tego O2.4, benchmarki finansowe O6.2 nie mają na czym stanąć).

---

## 1. ŻELAZNA KOLEJNOŚĆ BLOKÓW NA JUTRO (O-A → O-G)

Zasada jak w Harvardzie: blok nie startuje, póki poprzedni nie przejdzie swojej bramki. Ale tu **większość bloków NIE wymaga Twojego live-klikania** (to nie UI-odbiór jak Vegas — to jakość merytoryczna, weryfikowana panelem adwersaryjnym, konsultify-test).

| Blok | Zakres | Model | Bramka wyjścia | Wymaga Ciebie? |
|---|---|---|---|---|
| **O-A** | **Live-verify 12 narzędzi O3** — dla każdego: 1 prawdziwa sesja w przeglądarce (Teresa lub ręcznie), sprawdź czy output ma sens, zbierz do bundla | Sonnet (12 równoległych, tanio) | Bundle 12 sesji + wstępna ocena „sensowne/śmieciowe" | NIE (ja mogę kliknąć jako test-user jeśli masz konto testowe; jeśli nie — pierwsze kliknięcie może wymagać Ciebie 5 min rano) |
| **O-B** | **Panel adwersaryjny na 12 narzędziach** (workflow `panel-adwersaryjny`) — ocena merytoryczna jakości q-banków/insight-staircase/synteza | Sonnet lekkie + **Opus** na obiektyw rygoru | Score + potwierdzone findingi per narzędzie | NIE |
| **O-C** | **Napraw findingi z O-B** — per narzędzie, wzorem SWOT-wzorca | Sonnet, Opus tylko trudne | Re-test ≥ próg (patrz `consultify-test`) | NIE |
| **O-D** | **Decyzja UX „Pogłęb pozycję"** — Ty wybierasz: (a) budować teraz jako 13. blok, (b) odłożyć na po-Vegas | — | Twoja decyzja (1 pytanie, patrz §3) | **TAK — 2 minuty rano** |
| **O-E** | **O4 Finanse jako doradztwo — FUNDAMENT** (7 elementów od zera) | Opus (rygor finansowy) + Sonnet (szkielet) | Panel `model_finansowy` ≥88 na 1 pilotażowym case | NIE (ale duży blok — patrz §2) |
| **O-F** | **O1 DRD — Twoje 5 decyzji P1-P5** + odbiór raportu | — | Twój podpis „podpisałbym to klientowi" | **TAK — sesja z Tobą, ~30-60 min** |
| **O-G** | **O6 wpięcie profili branżowych do raportu** + O5 rejestr promptów + O7 język PL/EN | Sonnet | Panel jakości językowej | NIE |

**Rekomendacja kolejności wykonania jutro rano:** O-A i O-B mogą ruszyć **natychmiast** (nie czekają na Ciebie) — to weryfikacja tego, co już zbudowane. Równolegle możesz rano dać mi 2 minuty na O-D (jedno pytanie). O-E (Finanse) to największy nowy budulec — warto zacząć go równolegle z O-A/O-B, bo nie koliduje. O-F (DRD) to jedyny blok wymagający dłuższej Twojej sesji — najlepiej zaplanować go jako osobne spotkanie, nie „przy okazji".

---

## 2. O-E SZCZEGÓŁOWO — Finanse jako doradztwo (największy nowy blok, 7 elementów)

To jest fundament, którego dziś kompletnie brakuje. Rozbijam na kroki wykonywalne przez agentów jutro:

1. **Architektura business case** (assumptions→model→scenariusze→rekomendacja jako narracja, nie tabelka) — wzorzec: ten sam 5-fazowy pipeline co `WorkbookGeneratorService` (PLAN→CONFIRM→GENERATE→REVIEW→BUILD), ale dla dokumentu narracyjnego, nie arkusza. **Reużyć całą infrastrukturę promptów z Excela.**
2. **Scenariusze nazwane** (dźwignie, nie ±15%) + edytor założeń + widok porównawczy — to jest UI-feature, może poczekać na Vegas-fala.
3. **Value tree** (savings/growth/risk, rozkład+ocena ryzyka per komponent) — logika czysta, jak q-banki.
4. **Współzależności inicjatyw** (sekwencje/synergie/budżet portfela) — to zazębia się z Initiative kręgosłupem (Powiązania first-class z doktryny artefaktów).
5. **Guidance parametrów** (WACC/stopy per branża) — to jest MOST z O6 (profile branżowe już zbudowane, 7/7, tylko niewpięte — **tani quick-win, zrób RAZEM z O-G**).
6. **Analiza sprawozdań** (trend+driver+prognoza) — najcięższy element, wymaga prawdziwych danych finansowych jako wejścia.
7. **Post-mortem realized-vs-projected** — najmniej pilny, zostawić na koniec.

**Pigułka startowa dla jutrzejszego agenta (Sonnet, diagnoza-najpierw):**
```
CEL: zbadaj czy istnieje JAKAKOLWIEK infrastruktura dla O4 (business case/scenariusze/value tree)
zanim zaczniesz budować od zera — wzorem dzisiejszego odkrycia (Oxford q-banki były dalej niż
sądziliśmy). Grep: "business_case", "valueTree", "scenario" w server/src i src.
Jeśli PUSTE — zacznij od elementu 1 (architektura business case) wzorem WorkbookGeneratorService
5-fazowego pipeline, ale output = dokument narracyjny (Word-archetyp), nie .xlsx.
Diagnoza PRZED kodowaniem, zawsze.
```

---

## 3. DECYZJA CZEKAJĄCA NA CIEBIE JUTRO RANO (1 pytanie, 2 minuty)

**„Pogłęb pozycję" (interaktywna drabinka pytań w 12 narzędziach):**
- **(a) Budować teraz** — nowy przycisk + wybór szczebla (surface→evidence→quantification→risk) + podpięcie do systemu akcji AI. Szacunek: ~2-3 dni agenta na wzorzec + rollout na 12.
- **(b) Odłożyć** — narzędzia są już użyteczne bez tego (treść drabinki i tak zasila syntezę), to jest „nice to have" głębi, nie blokada. Priorytet idzie na O4 (Finanse, kompletna dziura) i O-A/O-B (dowiedzenie że 12 narzędzi faktycznie daje dobry output).

**Moja rekomendacja: (b) odłożyć.** Value/effort jest gorszy niż O4 — 12 narzędzi już produkuje treść, „Pogłęb" to polish głębi, a Finanse to zero-do-jeden na całym strumieniu doradczym.

---

## 4. MODELE I EKONOMIA (ta sama polityka co Vegas — sprawdzona dziś)

- **Haiku** — grepy, agregacja bundli, mechanika.
- **Sonnet** (domyślny) — diagnoza-przed-budową, budowa szkieletów, panel-lekkie-obiektywy.
- **Opus TYLKO**: obiektyw rygoru/modelu finansowego w panelu, trudny hot-path O4 (business case pipeline), synteza sporna.
- **Zero Fable u robotników.**
- **Zasada z dziś, powtórzona bo się sprawdziła 3×**: PRZED budową każdego elementu — grep czy już istnieje. Dziś odkryliśmy że 12/19 narzędzi Oxford i całe fale Vegas były dalej niż plan mówił. Załóż, że to się powtórzy w O4/O5/O6.

---

## 5. CO NIE ROBIĆ JUTRO (świadomie, żeby nie rozjechać dnia)

- Nie zaczynaj Vegas-fali artefaktów równolegle z Oxford-blokami — jeden priorytet na raz (chyba że masz dwie oddzielnie nadzorowane sesje).
- Nie buduj UI dla O4.2 (scenariusz-edytor) przed logiką O4.1/O4.3 — to klasyczna pułapka „ładny interfejs na pustą logikę".
- Nie dotykaj kolorystyki/landing — to nadal osobny etap na koniec.
- Nie rób pełnego `tsc`/`vitest` — esbuild per plik, jak zawsze.

---

## 6. PIERWSZA RZECZ DO ZROBIENIA JUTRO (dosłownie pierwsza komenda)

```
Skill('consultify-petla')  → przypomnij sobie cykl
Uruchom O-A: 12 równoległych agentów Sonnet, każdy: zaloguj się (Twoje dane testowe),
otwórz 1 narzędzie z listy 12, wypełnij realnymi danymi przykładowego case'u,
zapisz output + zrzut. Zero decyzji, czysta mechanika — może ruszyć BEZ Ciebie
jeśli zostawisz agentowi dostęp testowy, albo z Twoim 5-minutowym klikiem na start.
```

---

**Koniec planu. Dobranoc, Boss. Rano wracasz — masz gotową kolejkę, nie pustą kartkę.**
