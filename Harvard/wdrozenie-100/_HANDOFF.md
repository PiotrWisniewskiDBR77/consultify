# HANDOFF — start tu (nowy czat czyta TYLKO ten plik)

**Problem 8 miesięcy:** optymalizowaliśmy artefakty (audyty/oceny/teczki/dokumentację) zamiast dowozić działające przepływy. Koniec z tym.

## Metoda (umowa, nienegocjowalna)
1. Jednostka pracy = **1 moduł, 1 realny przepływ, wdrożony na staging i sprawdzony NA ŻYWO**. Done = klik na demo działa (nie „udokumentowany").
2. **ZAKAZ nowych audytów i dokumentów.** Wiedzy jest nadmiar. Pisanie dokumentacji zamiast kodu = błąd, przerwać.
3. Mały, częsty dowód: buduj → testuj na żywo → **screenshot że działa** → odbiór.
4. Jeden moduł na raz, do końca (głębia > szerokość).
5. „Działające-surowe" > „idealne-niewdrożone". Drobne decyzje: wg `_DECYZJE.md`, logować, nie blokować.

## Środowisko testowe (GOTOWE — autonomiczny loop)
- **Lokalnie (świeży kod):** `npm run dev` (= dev:staging; `DOTENV_IGNORE_LOCAL=1`, pomija prod). Frontend `localhost:3000` → backend `:3001` → **trolley** (żywa NIE-PROD baza; caboose martwy, centerbeam=PROD-NIE-DOTYKAĆ).
- **Auth lokalnie:** mint JWT dev-secretem (`JWT_SECRET` z `.env`), payload `{id,email,role,organizationId,jti}`, wstrzyknąć `localStorage.token` na localhost:3000. User: `piotr.wisniewski@dbr77.com` / OWNER / org `a3e05d4a-5397-419d-b486-8e44366c0063`. (middleware sprawdza jti tylko vs `revoked_tokens` — świeży token przechodzi).
- **Sterowanie:** Claude_in_Chrome (Browser 1) — navigate/click/type/screenshot + konsola + network. Backend: logi lokalne / `railway logs` staging.
- **Odbiór:** deploy domknięty moduł na **demo.consultify.ai** (już zalogowany OWNER), Piotr odbiera async.

## Stan kodu (Londyn — realnie zrobione)
- Canvas Tryb B mount `8a0e64b866` · detekcja PL `53e3f86e09` · „Otwórz" inicjatywy `18ed3e44f7` · **M18 data-loss: 6 warstw Map→Postgres `953955bc2b`+`8d2b5d8cf4`** (mig.780/781; cold-start proof na staging pozostaje).
- M20 IDOR już naprawione `e9c6cb9c0a`. M22/M19/M21/M23 = STALE/naprawione (R3, dowód w teczkach).

## Dokumentacja (komplet — NIE rozszerzać, tylko czytać przy module)
`Harvard/wdrozenie-100/`: `MASTER.md` (fazy + DoD 7/7 + procedura §0a) · `_WZORZEC_TECZKI.md` · 27 teczek `MXX-*.md` (stan docelowy + luki + DoD) · `_DECYZJE.md` (12 polityk rozstrzygniętych).

## DoD modułu = 7/7 (MASTER §0)
front↔back spięte · 0 P0/P1 · i18n `t()` · tokeny · §27 · E2E w PR-gate · **zgodność komponentów ze standardem UI/UX** (`docs/ui-standards/` GOLDEN_STANDARD/CANON_V3 + VISUAL_STANDARD; `EntityStatusChip`/`FilterableTable`). Krok „analiza zgodności komponentów" PRZED testem funkcjonalnym.

## Następny moduł
**CZEKA NA DECYZJĘ PIOTRA:** który moduł pierwszy + JEDNO zdanie „done" (jaki przepływ ma działać). Kandydat z dowodem buga: kręgosłup czat→canvas (prośba „pokaż w Canvasie" → wystawia „Initiatives·create" zamiast dokumentu).
