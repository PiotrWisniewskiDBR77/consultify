# BOOTSTRAP — prompt startowy dla Claude'a na nowym komputerze

Wklej PONIŻSZY blok jako pierwszą wiadomość do Claude Code po sklonowaniu repo i `git checkout feat/deliverables-light` (lub aktualnego brancha roboczego — sprawdź `_TRACKER.md`).

---

Pracujemy nad projektem **Audyt Harvard** — dokończeniem aplikacji Consultify w 3 dni przez systematyczne audyty per-moduł i wdrożenia planów dokończenia.

Zanim cokolwiek zrobisz, przeczytaj W TEJ KOLEJNOŚCI:
1. `docs/audyt-harvard/README.md` — instrukcja działania i pętla pracy na moduł
2. `docs/audyt-harvard/KONTEKST.md` — snapshot pamięci projektowej (kim jestem, stan środowisk, co już NAPRAWIONE, pułapki infra) — **zapisz kluczowe fakty do swojej pamięci**
3. `docs/audit/MODULE_AUDIT_PROTOCOL_V1.md` — protokół audytu (8 faz, rubryka /100, hard caps, DoD) — obowiązuje co do litery
4. `docs/audyt-harvard/_TRACKER.md` — aktualny status 27 modułów
5. `docs/audyt-harvard/PLAN_3_DNI.md` — harmonogram
6. `docs/audit/2026-06-11/_MODULE_MAP_V2.md` — podział na moduły i charakterystyki

Zasady twarde: prawda kodu (dowód `plik:linia`), verify-before-claiming (screenshot/uruchomiony test, nigdy samo tsc), dowody do `modules/<Mxx>/evidence/`, tracker aktualizowany po każdym module, commituj docs na bieżąco.

Po przeczytaniu: zweryfikuj gotowość środowiska (patrz checklist niżej w tym pliku), zgłoś braki, a potem zacznij od pierwszego modułu ⬜ w kolejności z PLAN_3_DNI.md — chyba że wskażę inny.

---

## Checklist środowiska na nowym komputerze (do zweryfikowania przy starcie)

**Przez git przyjeżdża:** kod + cała dokumentacja audytowa. **NIE przyjeżdża (trzeba przenieść osobno/bezpiecznie):**
- [ ] `.env` + `server/.env.local` (DATABASE_URL!, GEMINI_LIVE_API_KEY, TAVILY, klucze LLM) — bez tego backend nie wstanie, a Faza 3 nie ruszy
- [ ] Dostęp do Railway (zalogowany `railway` CLI lub dashboard) — Faza 3
- [ ] Konto testowe staging (admin + member) — Faza 4
- [ ] `npm install` w root i `server/` (uwaga na wzorzec Dockerfile-explicit-install przy rozjazdach)
- [ ] Działający preview/przeglądarka dla Claude'a (Faza 4 jest obowiązkowa — bez niej oceny max 70)
- [ ] Pamięć Claude'a na nowej maszynie jest PUSTA — fakty z `KONTEKST.md` zapisać do pamięci na starcie

## Synchronizacja dwóch komputerów
- Wszystkie wyniki (karty, evidence, tracker, logi wdrożeń) żyją w repo → `git pull` przed startem pracy, commit+push po każdym module/fali.
- Nie pracować równolegle nad TYM SAMYM modułem na dwóch maszynach; podział wg `_TRACKER.md` (kolumna „kto", jeśli potrzebna — dopisać).
