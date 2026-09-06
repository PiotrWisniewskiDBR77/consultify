---
doc_id: plan-demo-klienci-i-pokazy
status: canonical
truth_type: program-plan
established: 2026-09-06 (DEC-402, słowo właściciela)
author: CTO (Fable)
wykonuje: nadzorca z właścicielem (Railway) + robotnicy (skrypty)
---

# Plan: demo aktualne i czyste dla klientów i pokazów, staging do rozwoju

**Słowo właściciela (06.09):** „baza demo musi być aktualna i czysta, aby użytkownik miał na czym pracować;
przygotujmy demo do testowania przez klientów i dla mnie do pokazywania; a na stagingu dużo, abym miał
gdzie rozwijać aplikację.” Decyzja 1 z DEC-402: **osobne bazy, ta sama treść**.

## 1. Stan zmierzony (06.09, tylko odczyt Railway)
| | staging.consultify.ai | demo.consultify.ai |
|---|---|---|
| baza | `thomas` (własna od 02.09; dane właściciela, po porządku 06.09) | `trolley` (dawna wspólna; osad historyczny) |
| kod | `origin/staging`, auto-deploy, health = SHA | starszy commit (`APP_BUILD_SHA` przybity), gałąź `demo` |
| flagi | 30 ON (parytet z b852ade6) | brakuje 27 flag stagingu, brak `CSRF_MODE`, furtki testowe ON |
| limiter AI | wyłączony (od 05.09) | wyłączony |
Źródło pomiaru i skrypty: `RUNBOOK_ROZDZIAL_DEMO.md`, `LISTA_KONTROLNA_PROMOCJI.md`, `scripts/demo/*`,
próba na sucho `evidence/demo-pilotaz/PROBA_NA_SUCHO_20260906.md`.

## 2. Zasady (obowiązują od dziś)
1. **Staging = piaskownica właściciela.** Tam idzie każde scalenie; dane właściciela żyją tam i tam je rozwija.
2. **Demo = witryna i pilotaż.** Zawsze na zaakceptowanym kodzie (tag `demo-safe-<data>`), z danymi
   pokazowymi i organizacją pilotażu. Nikt nie testuje na demo półproduktów.
3. **Ta sama treść = kopia danych właściciela przy STARCIE demo** (raz, dziś/jutro) i potem **na żądanie
   właściciela** (odświeżenie pokazu). Codzienna promocja przenosi tylko kod i migracje, NIE dane — inaczej
   każda promocja kasowałaby pracę pilotażu (decyzja CTO; odświeżenie samej organizacji pokazowej bez
   ruszania organizacji pilotażu = narzędzie w pojemniku 2).
4. **Produkcja `consultify.ai` nietykalna** przez cały plan (osobna baza z danymi klientów).
5. Każda zmiana na demo = procedura `consultify-promocja-demo` + wpis w rejestrze + health = SHA.

## 3. Fazy
| # | Co | Kto | Komendy / dowód | STOP |
|---|---|---|---|---|
| F0 | Porządek na stagingu: runda 1 wykonana 06.09 (9 ocen archiwum, 16 rekordów testowych), **runda 2**: dane niepasujące do aplikacji (tabele bez konsumenta w UI, oceny SIRI/ADMA z zerem obszarów, stare wątki czatu, artefakty bez ekranu) — pomiar → lista → słowo właściciela → apply | Codex (pomiar+skrypt), nadzorca (apply), właściciel (Tak) | `server/scripts/higiena-wlasciciela/*`, nowy `niepasujace.ts --dry-run/--apply/--rollback`, manifesty w `evidence/higiena-danych/` | lista bez „Tak” właściciela |
| F1 | Zamrożenie kandydata: tag `demo-safe-<data>` na `origin/staging` po 1.9 (przejście właściciela 16 modułów) | nadzorca | `git tag demo-safe-20260906 <sha> && git push origin --tags` | przejście z otwartym BLOKER |
| F2 | Zmienne demo = parytet ze stagingiem: 27 flag ON, `CSRF_MODE=report`, `AI_BUDGETS_ENABLED=true` (budżet 50 USD/org/mies., komunikat PL), furtki testowe OFF (`ENABLE_TEST_GATEWAY`, `ENABLE_V8_SHADOW_MODE`), `APP_BUILD_SHA` USUNIĘTE (Dockerfile ma fallback = prawdziwy health) | nadzorca z właścicielem obok | `node scripts/demo/porownaj-flagi.mjs` → lista; `railway variables --environment demo --service <app> --set …` (RĘCZNIE, po jednej, z odczytem po); pułapka: redeploy po zmianie zmiennej bierze commit z GitHuba → F2 wykonać PO F3 albo bez redeploy | zmienna spoza listy |
| F3 | Promocja kodu staging → demo: merge `origin/staging` → `demo` (NIGDY force), workflow `railway-deploy.yml` (bramka `validate-deploy-target.sh` — baza demo bez zmiany, fingerprint OK), health demo `gitSha` = SHA merge | nadzorca | `LISTA_KONTROLNA_PROMOCJI.md` pkt 1–8; `curl demo/api/health` | health ≠ SHA po 15 min → rollback Railway |
| F4 | Dane: kopia zapasowa `trolley` (`kopia-bazy.sh`, sha256, manifest) → przywrócenie do `trolley` kopii `thomas` (po F0) → migracje strict → `seed-organizacja-pilotaz.ts --apply` (organizacja „DBR77 Pilotaż”, 7 kont na aliasach `+pilotaz` + admin właściciela; hasła poza repo) → `sprawdz-demo.sh` (health, tabele, więzy `pg_constraint`, 8 kont, flagi) | nadzorca (skrypty), właściciel (hasła) | logi w `evidence/demo-pilotaz/`; uwaga: przywrócenie może zgubić FK, gdy dane łamią więzy — `sprawdz-demo` liczy więzy i melduje | różnica więzów > 0 bez wyjaśnienia |
| F5 | Odbiór demo: nadzorca przechodzi ścieżkę pokazu (16 modułów) na demo zrzutami; właściciel patrzy na jeden żywy obraz per moduł; tag `demo-safe-<data>`; konta do pilotażu przekazane; Feedback + dziennik jako system reakcji | nadzorca, właściciel | `evidence/demo-pilotaz/odbior-<data>/`, wpis w rejestrze, S1.9 = TAK | dowolny BLOKER |
| F6 | Rytm stały: promocja per zaakceptowana partia (kod+migracje), odświeżenie danych pokazowych na żądanie, cofnięcie wg `_RUNBOOK_COFANIA.md`, przegląd Feedbacku codziennie | nadzorca | `LISTA_KONTROLNA_PROMOCJI.md` z datą każdego ćwiczenia | — |

## 4. Terminy
- F0 runda 2: 06.09 wieczór (Codex pomiar + skrypt) → 07.09 rano apply po słowie właściciela.
- F1–F5: 07.09 (po przejściu właściciela 06.09 po 16:00 i naprawach z 1.1).
- Pilotaż startuje w dniu, w którym S1.9 = TAK i konta są u ludzi.

## 5. Pytania rozstrzygnięte (DEC-402)
Jedna organizacja pilotażu; konta na aliasach; użytkownicy: Tomek, Kasia, Justyna, Irina Lebedjuk,
Torian Richardson, Bartłomiej Straszak (`db77.pl` — sprawdzić), Paweł Mroczkowski; budżet AI 50 USD.
Otwarte: nic, poza „Tak” właściciela na listę rundy 2 (F0).
