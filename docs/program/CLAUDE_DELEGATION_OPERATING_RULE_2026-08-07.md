# Zasada oszczędnej delegacji Claude — 7–12 sierpnia 2026

**Status:** nadrzędna reguła wykonawcza. **Owner:** Codex jako CTO/Release Owner.  
**Preferowany wykonawca dużego kodowania:** Claude Sonnet 5.0; gdy niedostępny, najbliższy dostępny Claude/Sonnet o porównywalnym koszcie.

## Podział odpowiedzialności

Codex odpowiada za architekturę, priorytety, kryteria akceptacji, rozbicie pracy, review diffów, ochronę shared worktree, integrację, runtime QA, deployment i dowody. Sam pisze krótkie krytyczne patche, gdy delegacja byłaby wolniejsza lub ryzykowniejsza.

Claude domyślnie wykonuje każdą implementację wieloplikową, nowy workflow, większy refactor lub pracę szacowaną na ponad 30–45 minut, a także izolowane migracje, testy i audyty.

## Bramka przed kodowaniem

| Klasa | Zakres | Wykonawca |
| --- | --- | --- |
| A — decyzja | model, SSOT, lifecycle, security, migracja | Codex projektuje; Claude implementuje |
| B — duża implementacja | wiele plików, workflow, refactor, >30–45 min | Claude pod nadzorem Codex |
| C — mały krytyczny patch | 1–2 pliki, oczywista integracja/fix | Codex może wykonać sam |
| D — QA/release | review, runtime proof, deploy, acceptance | Codex prowadzi; Claude wykonuje izolowane przejścia |

Codex nie rozpoczyna sam dużego kodowania klasy B. Najpierw deleguje konkretny pakiet.

## Obowiązkowy kontrakt zadania Claude

Każdy brief zawiera: cel i Definition of Done; dokładny zakres plików oraz aktywne cudze edycje; obowiązujące SSOT/API; wymagane testy i runtime proof; zakaz atrap/fake-success; małe commity bez push/deploy; raport SHA, plików, wyników, ryzyk i pozostałych luk.

## Review i integracja

Kod agenta nie jest automatycznie zaakceptowany. Codex sprawdza diff i zakres commita, potwierdza kanoniczny model, uruchamia proporcjonalne testy i `git diff --check`, wdraża wyłącznie czysty checkpoint i wykonuje manualny runtime proof. Test jednostkowy nie zastępuje przejścia UI.

## Oszczędność i wyjątki

- Jeden agent prowadzi spójny pakiet; równoległość tylko dla niezależnych plików.
- Agent dostaje ścieżki i kryteria zamiast kopii treści dostępnej w repo.
- Po trzech nieudanych próbach Codex zatrzymuje podejście i rozstrzyga architekturę.
- Codex nie deleguje kilkuwierszowego patcha, jeśli koszt przekazania i review jest większy.
- Większy kod może wykonać sam wyłącznie przy niedostępności/limicie Claude, incydencie P0 albo konflikcie integracyjnym shared worktree; powód musi zostać jawnie odnotowany.

