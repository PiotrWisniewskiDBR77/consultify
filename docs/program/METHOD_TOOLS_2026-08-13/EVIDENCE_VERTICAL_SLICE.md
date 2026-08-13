# Vertical slice Dynamic SWOT — dowody wizualne

> Zgodnie z CLAUDE.md #7 zrzuty powstały ZANIM właściciel zobaczył ekran.
> Autor zrzutów: nadzorca sesji (Opus Tools), nie właściciel.

## Jak odtworzyć

```bash
npx vite --config /Users/piotrwisniewski/.codex/worktrees/method-tools/dev-render/vite.config.ts --port 3512
```

| Wariant | URL |
|---|---|
| Raport · Light (Executive Paper) | `http://localhost:3512/tools-swot-report.html?theme=light&kind=report` |
| Raport · Dark (Executive Night) | `http://localhost:3512/tools-swot-report.html?theme=dark&kind=report` |
| Prezentacja · Light | `http://localhost:3512/tools-swot-report.html?theme=light&kind=presentation` |
| Prezentacja · Dark | `http://localhost:3512/tools-swot-report.html?theme=dark&kind=presentation` |

## Co realnie przechodzi przez ekran

Harness NIE jest makietą. Renderuje pełny łańcuch:

```
stan sesji (SWOTItem · SWOTTension · SWOTMove)
  → buildSwotOutput()      reguły silnika: isAcceptedSwotItem, bramka W2
  → submitForReview() → approve()   niezmienny snapshot, zatwierdza człowiek
  → renderToolReport()     deterministyczny renderer
  → ToolReportView         Executive Paper / Executive Night
```

## Potwierdzone wzrokiem

| Wymóg | Stan |
|---|---|
| Pozycja niezaakceptowana nie wchodzi do Outputu | ✅ `i5` („hipoteza o subskrypcji", `ai-proposed`) nieobecna na ekranie |
| Typy dowodu widoczne i rozróżnione | ✅ `fakt` ×3, `hipoteza` ×1 — hipoteza nie udaje faktu |
| K1 policzone przez silnik | ✅ wagi 6 i 5, wyliczone z wpływu pozycji (3+3, 3+2) |
| Trade-off obowiązkowy (W2) | ✅ wybrane / odrzucone / dlaczego w każdej konkluzji |
| K4 ma adresata-rolę | ✅ „Dyrektor sprzedaży", „Dyrektor operacyjny" |
| Presentation usuwa kontrolki | ✅ znika metadana renderera |
| Presentation skraca, nie zmienia znaczenia | ✅ znika pełna lista dowodów, konkluzje identyczne |
| Light i Dark | ✅ pełna zamiana tokenów, brak crimsonu jako danej |

## Defekty wykryte na zrzucie i naprawione PRZED odbiorem

To jest powód, dla którego rzut oka wyprzedza właściciela.

| # | Defekt | Naprawa |
|---|---|---|
| D-1 | Action title był statystyką silnika („Ruch wynika z 1 napięć o łącznej wadze 6") zamiast wnioskiem, i dublował K1 | `buildActionTitle` bierze pierwszą rekomendację K3; fallback na K2 |
| D-2 | Błąd odmiany: „1 napięć" | `odmienNapiecia()` — 1 napięcie · 2-4 napięcia · 5+ napięć, z obsługą nastek 12-14 |
| D-3 | Surowy enum u klienta: „Oczekiwany wpływ: **high**" | mapa `IMPACT_PL` — wysoki/średni/niski |
| D-4 | Surowy enum postawy: „postawa: **attack**" | mapa `POSTURE_PL` — atak/naprawa/obrona/ochrona ekspozycji |

Każdy defekt ma test regresyjny w `src/toolOutputs/__tests__/buildSwotOutput.test.ts`.

## Czego ten dowód NIE obejmuje

Uczciwe ograniczenia — to nie jest jeszcze pełne DoD runtime:

- **brak sesji na żywym backendzie** — harness buduje Output z danych w pamięci,
  migracja 946 nie została uruchomiona na żadnej bazie;
- **brak persistence i reopen w runtime** — logika istnieje i jest przetestowana
  jednostkowo, ale nie przeszła przez realny zapis i odczyt z bazy;
- **brak Teresy i voice** na tym ekranie;
- **brak Live Artifact** — ekran pokazuje wynik, nie pracę na żywo;
- **brak formalnej oceny MPQ** — zrzuty są, ocena punktowa nie została wykonana;
- **brak odbioru właściciela** — zrzuty czekają na akcept.

Dopóki powyższe nie zostanie dowiezione, `RuntimeReadinessManifest` dla
`dynamic-swot` ma bramki `NOT_RUN`, a narzędzie **nie może** być RUNTIME_ACTIVE.
