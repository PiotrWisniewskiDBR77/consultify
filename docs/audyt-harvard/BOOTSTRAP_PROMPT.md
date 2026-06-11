# BOOTSTRAP — prompt startowy dla Claude'a na nowym komputerze

Wklej PONIŻSZY blok jako pierwszą wiadomość do Claude Code po sklonowaniu repo i `git checkout feat/deliverables-light` (lub aktualnego brancha roboczego — sprawdź `_TRACKER.md`).

---

Pracujemy nad projektem **Audyt Harvard** — dokończeniem aplikacji Consultify w 3 dni przez systematyczne audyty per-moduł i wdrożenia planów dokończenia.

Zanim cokolwiek zrobisz, przeczytaj W TEJ KOLEJNOŚCI:
1. `docs/audyt-harvard/SEKWENCJA.md` — GŁÓWNY PLAN: 8 kroków z bramkami; Ty zaczynasz od Kroku 3 (weryfikacja środowiska), potem Krok 4 (audyty WSZYSTKICH modułów — bez napraw, wyjątek: quick-fix ≤5 linijek)
2. `docs/audyt-harvard/README.md` — instrukcja działania i pętla pracy na moduł
3. `docs/audyt-harvard/KONTEKST.md` — snapshot pamięci projektowej (kim jest właściciel, stan środowisk, co już NAPRAWIONE, pułapki infra) — **zapisz kluczowe fakty do swojej pamięci**
4. `docs/audit/MODULE_AUDIT_PROTOCOL_V1.md` — protokół audytu (8 faz, rubryka /100, hard caps, DoD) — obowiązuje co do litery
5. `docs/audyt-harvard/_TRACKER.md` — aktualny status modułów
6. `docs/audyt-harvard/PLAN_3_DNI.md` — mapowanie sekwencji na dni
7. `docs/audit/2026-06-11/_MODULE_MAP_V2.md` — podział na moduły i charakterystyki

Zasady twarde: trzymaj się SEKWENCJI (audyty → plany → integracje → budowa → testy; nie przeplataj), prawda kodu (dowód `plik:linia`), verify-before-claiming (screenshot/uruchomiony test, nigdy samo tsc), dowody do `modules/<Mxx>/evidence/`, sekcja 1g (połączenia międzymodułowe) wypełniana w KAŻDEJ karcie, tracker aktualizowany + commit/push po każdym module.

Po przeczytaniu: wykonaj Krok 3 — zweryfikuj gotowość środowiska (checklist niżej; pliki .env powinny być już na tym komputerze przez synchronizację chmurową — POTWIERDŹ ich obecność i sprawdź, na którą bazę wskazuje DATABASE_URL, zanim cokolwiek zapiszesz), zgłoś braki, a potem rusz Krok 4 od pierwszego modułu ⬜ w kolejności z PLAN_3_DNI.md.

---

## Checklist środowiska na nowym komputerze (do zweryfikowania przy starcie)

**Przez git przyjeżdża:** kod + cała dokumentacja audytowa. **Resztę zapewnia synchronizacja chmurowa komputerów + właściciel (deklaracja w SEKWENCJA.md) — ale ZWERYFIKUJ każdy punkt przed Krokiem 4:**
- [ ] `.env` + `server/.env.local` obecne (przez cloud-sync) — POTWIERDŹ i sprawdź `DATABASE_URL` (na którą bazę wskazuje! dev bywa wpięty w PROD)
- [ ] Dostęp do Railway (CLI/dashboard — właściciel zbuduje) — Faza 3
- [ ] Konto testowe staging (admin + member) — Faza 4
- [ ] `npm install` w root i `server/` (uwaga na wzorzec Dockerfile-explicit-install przy rozjazdach)
- [ ] Działający preview/przeglądarka dla Claude'a (Faza 4 jest obowiązkowa — bez niej oceny max 70)
- [ ] Pamięć Claude'a: jeśli katalog pamięci NIE przyszedł z cloud-sync — fakty z `KONTEKST.md` zapisać do pamięci na starcie

## Synchronizacja dwóch komputerów
- Wszystkie wyniki (karty, evidence, tracker, logi wdrożeń) żyją w repo → `git pull` przed startem pracy, commit+push po każdym module/fali.
- Nie pracować równolegle nad TYM SAMYM modułem na dwóch maszynach; podział wg `_TRACKER.md` (kolumna „kto", jeśli potrzebna — dopisać).
