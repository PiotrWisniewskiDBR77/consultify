# RAPORT NOCNY — Oxford narzędzia merytoryczne (noc 09/10.07)

> Zlecenie Piotra: „działaj wg planu, ekonomicznie, jakość ceniona przez konsultantów, dowiezione na rano do kodowania".
> Wykonanie: 100% na Sonnetach (zero Opus — nie był potrzebny; zero Fable u robotników). Wszystko na demo, commit-per-krok.

## CO DOWIEZIONE (5 bloków planu wykonanych)

| Blok | Wynik | Demo SHA |
|---|---|---|
| **O-E · Business case (Finanse O4.1)** | ✅ Architektura 5-fazowa (PLAN→CONFIRM→MODEL→NARRATIVE→REVIEW): deterministyczny silnik NPV/IRR/payback/ROI, scenariusze nazwane dźwigniami, anty-fabrykacja (liczby tylko z modelu + auto-check + 1 retry). **18/18 testów.** TODO: endpoint + UI (świadomie po odbiorze). | `3cfa959c7c` |
| **O-G · Benchmark branżowy w raporcie DRD (O6.1)** | ✅ Strona 09 raportu, addytywnie: firma vs {typical, leader} branży, disclaimer expert-hypothesis-v1, D5 uczciwie „unmatched". **31/31 testów.** Próbka: `docs/qa/deliverables/runs/DRD-REPORT-SAMPLE.html` → **decyzja P3 rano**. | `ddcfd03e4a` |
| **O-A · Dowód 6 narzędzi Discovery** | ✅ 6/6 realnych sesji z outputami AI na żywym demo (case DBR77, pełny cykl DRAFT→REVIEW). Bundle v1+v2 w repo. Sesje OXV-- w bazie (1 dublet do sprzątnięcia: `b84d27d7`). | `7f68e5e6e2` |
| **O-B/O-C · Pętla jakości (2 rundy panelu)** | Trajektoria **66 → 69** + naprawa strukturalna (niżej). 31/31 agentów w obu panelach, zero padniętych. | — |
| **O-C/O-C2 · Naprawy systemowe** | ✅ `GROUNDING_RULES` centralnie w 29 builderach promptów + **deterministyczny walidator groundingu** w 1 choke-point (pokrywa 19 narzędzi) + QA-filtr + linkedItems w 9 narzędziach. **163/163 testów discovery.** | `3ebbe49599`, `46bcdba3c9` |

## PĘTLA JAKOŚCI — co się wydarzyło merytorycznie

**Panel v1 = 66/100** (19 potwierdzonych findingów) → 4 systemowe wzorce: (W1) fabrykacja kwot stemplowana jako „fakt klienta, confidence 5", (W2) target-drift między narzędziami (8% vs <5%), (W3) błąd arytmetyki %-czasu (4×), (W4) kontrakt danych obcinał pola hipotez.

**Naprawa 1 (prompt):** GROUNDING_RULES → **Panel v2 = 69** (rygor 68→72, logika 64→72, model 62→70). Realny efekt: A3 przestał zmyślać ROI i naprawił target, RPA ma derivation-stringi, Ambition wzorcowy. ALE panel złapał, że **prompt nie wystarcza**: capability-mapper dalej fabrykował i fabrykacja PROPAGOWAŁA w dół łańcucha do rekomendacji #1.

**Naprawa 2 (kod — trwała):** deterministyczny walidator post-parse (wzorem `checkNarrativeNumbers` z business case): każda liczba oznaczona jako fakt/wysoka pewność, nieobecna literalnie we wsadzie → auto-downgrade do hipotezy (confidence 2, requires_evidence). Zweryfikowany testami na DOKŁADNIE tych liczbach, które panel złapał („0/25", „14 anulowanych"). + filtr artefaktów QA (pain-explorer nie podnosi fixture'ów do „confirmed").

**Uczciwe zastrzeżenie:** wynik 69 to pomiar SPRZED walidatora (walidator działa w FE-runtime; bundle generowany był ścieżką API bez tej warstwy). Realny efekt walidatora potwierdzi panel v3 — patrz „pierwsza komenda rana". Etykiety bez liczb („PMO BASIC") walidator świadomie nie łapie (v1 = liczby).

## RANO — kolejka (w kolejności)

1. **Panel v3** (potwierdzenie walidatora): re-capture przez ścieżkę z walidatorem → oczekiwany skok, bo 7/15 findingów v2 to jeden rdzeń, który walidator ubija strukturalnie.
2. **Decyzja P3** — obejrzyj `DRD-REPORT-SAMPLE.html` (strona 09 benchmark): publikujemy?
3. **Decyzja pain-explorer** — po odcięciu fabrykacji jest uczciwszy ale płytszy; panel proponuje jawną sekcję „pokrycie success signal" zamiast milczącej luki. Zatwierdź kierunek.
4. **Business case: endpoint + pilotażowy case** przez panel `model_finansowy` (silnik gotowy, 18/18).
5. Sprzątnięcie dubletu OXV `b84d27d7` + ewentualnie sesje OXV zostają jako showcase.

## EKONOMIA NOCY
Robotnicy: 6× Sonnet (O-A×2, O-E, O-G, O-C, O-C2) + 2× panel (62 agentów, Sonnet+Opus tylko na obiektywach rygoru wewnątrz workflow). Zero eskalacji do Opusa u robotników — żaden nie utknął. Wszystkie merge zweryfikowane (zakres/kolory/testy) przed pushem; demo zdrowe po każdym.
