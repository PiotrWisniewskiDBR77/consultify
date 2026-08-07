# Zasada oszczędnej delegacji Claude — 7–12 sierpnia 2026

**Status:** nadrzędna reguła wykonawcza. **Owner:** Codex jako CTO/Release Owner. **Priorytet nadrzędny:** dowiezienie sprawnego projektu dzisiaj; oszczędność tokenów nie może ograniczać tempa ani jakości.  
**Preferowany wykonawca dużego kodowania:** Claude Code CLI z modelem Sonnet 5.0; gdy niedostępny, najbliższy dostępny Claude/Sonnet o porównywalnym koszcie. CLI jest preferowany wobec sesji przeglądarkowych, ponieważ izoluje połączenie od pracy innych agentów.

## Podział odpowiedzialności

Codex odpowiada za pełną analizę, architekturę, priorytety, kryteria akceptacji, rozbicie pracy, review diffów, ochronę shared worktree, integrację, runtime QA, deployment i dowody. Sam wykonuje proste oraz małe i średnie poprawki, gdy jest to szybsze niż delegacja; nie ogranicza swojej pracy do obserwowania i wydawania poleceń.

Claude domyślnie wykonuje każdą implementację wieloplikową, nowy workflow, większy refactor lub pracę szacowaną na ponad 30–45 minut, a także izolowane migracje, testy i audyty. Oszczędność tokenów jest pomocnicza: delegacja nie może istotnie opóźniać pracy. Liczba paczek nie jest ograniczona; ograniczony i jednoznaczny ma być zakres każdej paczki.

## Bramka przed kodowaniem

| Klasa | Zakres | Wykonawca |
| --- | --- | --- |
| A — decyzja | model, SSOT, lifecycle, security, migracja | Codex projektuje; Claude implementuje |
| B — duża implementacja | wiele plików, workflow, refactor, >30–45 min | Claude pod nadzorem Codex |
| C — mały krytyczny patch | 1–2 pliki, oczywista integracja/fix | Codex może wykonać sam |
| D — QA/release | review, runtime proof, deploy, acceptance | Codex prowadzi; Claude wykonuje izolowane przejścia |

Codex nie rozpoczyna sam dużego kodowania klasy B. Najpierw deleguje konkretny pakiet.

## Obowiązkowy kontrakt zadania Claude

Każdy brief zawiera: jeden precyzyjny cel i Definition of Done; dokładny zakres plików oraz aktywne cudze edycje; obowiązujące SSOT/API; wymagane testy i kontrole negatywne; zakaz atrap/fake-success; zakaz rozszerzania zakresu; oczekiwany raport diffu, plików, testów, wyników, ryzyk i pozostałych luk.

Claude nie może wykonywać `git commit`, `git push`, `git reset`, `git checkout`, `git clean` ani `git stash`. Nie może usuwać danych, baz, artefaktów ani zmian innych agentów. Wszystkie operacje git, integrację i publikację wykonuje wyłącznie Codex.

## Review i integracja

Kod agenta nie jest automatycznie zaakceptowany. Codex sprawdza diff i zakres commita, potwierdza kanoniczny model, uruchamia proporcjonalne testy i `git diff --check`, wdraża wyłącznie czysty checkpoint i wykonuje manualny runtime proof. Test jednostkowy nie zastępuje przejścia UI.

Codex utrzymuje krótki checkpoint: cel, wykonane elementy, status, zmienione pliki, walidacje, ryzyka oraz najbliższe pojedyncze zadanie. Po acceptance paczki natychmiast uruchamia następną. Podczas pracy Claude przygotowuje review, testy, dane i kolejne decyzje zamiast biernie czekać.

## Oszczędność i wyjątki

- Jedna sesja Claude prowadzi jeden spójny pakiet. Codex może uruchamiać wiele paczek sekwencyjnie lub równolegle; równoległość jest dozwolona wyłącznie dla niezależnych zakresów plików i kontraktów.
- Agent dostaje ścieżki i kryteria zamiast kopii treści dostępnej w repo.
- Po trzech nieudanych próbach Codex zatrzymuje podejście i rozstrzyga architekturę.
- Codex nie deleguje kilkuwierszowego patcha, jeśli koszt przekazania i review jest większy.
- Większy kod może wykonać sam wyłącznie przy niedostępności/limicie Claude, incydencie P0 albo konflikcie integracyjnym shared worktree; powód musi zostać jawnie odnotowany.
