# Zasada oszczędnej delegacji Claude — 7–12 sierpnia 2026

**Status:** nadrzędna reguła wykonawcza dla prac Consultify przez najbliższe 6 dni.
**Właściciel:** Codex jako CTO i Release Owner.
**Preferowany wykonawca dużych prac:** Claude Sonnet 5.0; jeżeli nie jest dostępny w danym środowisku, najbliższy dostępny model Sonnet/Claude o porównywalnym koszcie.

## 1. Podział odpowiedzialności

Codex zachowuje odpowiedzialność za:

- architekturę, priorytety, kryteria akceptacji i rozstrzyganie kompromisów;
- rozbicie problemu na niezależne, ograniczone pakiety;
- wybór plików i kontraktów, które agent może zmieniać;
- review diffu, ochronę cudzych zmian, integrację i kolejność commitów;
- testy przekrojowe, runtime QA, deployment demo i dowody acceptance;
- krótkie, krytyczne poprawki, gdy delegacja byłaby wolniejsza lub ryzykowniejsza.

Claude wykonuje domyślnie:

- każdą większą implementację obejmującą wiele plików lub ponad około 30–45 minut pracy;
- mechaniczne rozszerzenia modeli, endpointów, UI i testów;
- izolowane audyty, migracje, fixture'y i naprawy regresji;
- długie przebiegi testów oraz przygotowanie dokładnego raportu wyników.

## 2. Bramka przed pisaniem kodu

Przed rozpoczęciem implementacji Codex klasyfikuje pracę:

| Klasa | Przykład | Wykonawca |
| --- | --- | --- |
| `A — decyzja` | model danych, SSOT, lifecycle, security, migracja | Codex projektuje; Claude implementuje |
| `B — duża implementacja` | funkcja wieloplikowa, nowy workflow, większy refactor | Claude pod nadzorem Codex |
| `C — mały krytyczny patch` | 1–2 pliki, oczywisty fix, integracja lub konflikt | Codex może wykonać sam |
| `D — QA/integracja` | runtime proof, review, deploy, acceptance | Codex prowadzi; Claude może wykonywać izolowane przejścia |

Jeżeli zadanie jest klasy `B`, Codex nie zaczyna dużego kodowania lokalnie. Najpierw deleguje je z konkretnym kontraktem.

## 3. Kontrakt zadania dla Claude

Każde zadanie musi zawierać:

1. dokładny cel użytkownika i definicję sukcesu;
2. dozwolony zakres plików oraz pliki aktualnie edytowane przez innych agentów;
3. obowiązujące SSOT/kanony i istniejące API, których nie wolno forkować;
4. wymagane testy oraz runtime proof;
5. zakaz atrap, fake-success i rozszerzania zakresu bez raportu;
6. wymóg małych commitów, bez push/deploy;
7. raport: SHA, pliki, testy, braki, ryzyka i potrzebny kolejny krok.

## 4. Review i integracja

Kod Claude nie jest automatycznie zaakceptowany. Codex przed integracją:

- sprawdza `git diff`, zakres commitów i stan shared worktree;
- potwierdza, że implementacja używa kanonicznego modelu i wspólnych usług;
- uruchamia testy adekwatne do ryzyka oraz `git diff --check`;
- wdraża tylko czysty checkpoint;
- wykonuje ręczny runtime proof; test jednostkowy nie zastępuje przejścia UI;
- odsyła wykryte błędy do Claude jako kolejny mały pakiet.

## 5. Zasady oszczędności

- Preferuj jednego agenta z pełnym kontekstem dla spójnego pakietu zamiast wielu dublujących audyt.
- Równoległość stosuj wyłącznie dla niezależnych plików i przepływów.
- Do agenta przekazuj ścieżki i kryteria, nie duże kopie treści dostępnej w repo.
- Nie powtarzaj pełnych analiz wykonanych i zapisanych w audycie; pracuj od aktualnego dowodu.
- Po trzech kolejnych nieudanych próbach tego samego podejścia Codex zatrzymuje delegację i podejmuje decyzję architektoniczną.
- Nie deleguj prostego, kilkuwierszowego patcha, jeżeli koszt przekazania i review jest większy od bezpośredniej naprawy.

## 6. Wyjątki

Codex może sam wykonać większy fragment tylko gdy:

- agent Claude jest niedostępny lub wyczerpał limit;
- trwa incydent P0 wymagający natychmiastowego przywrócenia działania;
- zmiana dotyczy konfliktu integracyjnego, którego agent nie może bezpiecznie rozwiązać w shared worktree.

Wyjątek musi zostać odnotowany w aktualizacji pracy wraz z powodem.
