# RUNBOOK: od teraz do „gotowe do testowania" (2026-07-24)

> ŹRÓDŁO PRAWDY o postępie mandatu końcowego. Czytaj PIERWSZY po wybudzeniu/kompakcji.
> Mandat: jedź autonomicznie aż WSZYSTKO zrobione → wypchnij na demo → posprzątaj gałęzie →
> sygnał „gotowe do testowania". Autoryzacja demo udzielona. Demo=trolley, NIE prod.

## BRAMKA WYJŚCIA (kiedy wolno dać Piotrowi do testowania)
Wszystkie prawdziwe:
- [ ] §4 audytu: 7/7 domknięte (dziś 6/7; zostaje powłoka §4.5/4.6)
- [ ] 6 kart n-Type na JEDNEJ powłoce, jedna szerokość, Menu 1==2==3 w 2 viewportach (szeroki+wąski)
- [ ] Wszystkie gałęzie tej doby scalone na hub (nic wartościowego nie wisi luzem)
- [ ] Trzecia runda 3 sędziów zmierzona; brak pozycji krytycznych
- [ ] Bramki realnie zielone (nie fałszywa zieleń): crimson-check na diff vs demo = 0, check-list-canon zielony
- [ ] Promocja na demo: gitSha na /api/health zgodny, deploy SUCCESS, re-tag demo-safe
- [ ] Migracje bazy (jeśli nowe) puszczone ręcznie na trolley, NIE centerbeam

## FAZY

### FAZA A — domknąć powłokę prerekwizyt + prace Piotra  [W TOKU]
- powłoka Etap 0+1 (`fix/powloka-etap0-etap1`, Opus) — wyrównanie NModeShell:170 + podpięcie Insight/Narzędzie do StandardArtifactShell
- fallbackRefineText (sesja Piotra) — atrapa AIFieldEnhancer
- bramki fałszywa zieleń (sesja Piotra) — 4 check-*.sh
CZEKAM na task-notifications. Nie odpalać Etapu 2 przed prerekwizytem.

### FAZA B — Etap 2 powłoki (4 karty ręczne na StandardArtifactShell)
Kolejność wg ciężaru (registry M-fale): notification → decision → task → **initiative (Opus)**.
Jedna karta = jedna gałąź od huba (po scaleniu prerekwizytu). Zdejmij własny max-w-*, wepnij w
StandardArtifactShell, flip statusMigracji. Weryfikacja: 2 viewporty, 3 pasy równe, wąski nie rozjechany.
★ Initiative = 26 sekcji, ~10.8k linii, prawy panel do zbudowania — Opus, osobno, na końcu.

### FAZA C — scalać partiami z twardą weryfikacją
Po każdej partii: merge --no-ff, grep fizycznej obecności kluczowych zmian (lekcja 2 delecji),
esbuild parse-only, crimson-check na diff vs demo = 0, check-list-canon zielony. Aktualizuj §9 audytu.

### FAZA D — trzecia runda 3 sędziów (Grafika/Merytoryka/IT)
Na SCALONYM kompletnym stanie. Skala 0-10. Pierwszy uczciwy pomiar od 7,1. Prompt sędziego:
patrz `_PETLA_NOCNA_9_5_2026-07-23.md` §1. Weryfikacja w realnym runtime (render+DOM+kod), nie docy.

### FAZA E — pętla napraw (jeśli sędziowie znajdą krytyczne)
Fale robotnicze na TOP brakach, rozłączne pliki. Wróć do C. Wyjście gdy brak krytycznych + spójne.

### FAZA F — PROMOCJA NA DEMO (procedura consultify-promocja-demo)
1. git fetch, pre-flight merge-tree. 2. Bramki + esbuild. 3. Merge do demo w izolowanym worktree.
4. Twarda weryfikacja plików. 5. Migracje ręcznie na trolley (host-guard!). 6. Push. 7. Railway monitor.
8. gitSha na /api/health == wypchnięty SHA. 9. Re-tag demo-safe-2026-07-24 (lub nowy dzień).

### FAZA G — SPRZĄTANIE GAŁĘZI (żeby nic nie utracić)
Cel: każda gałąź TEJ DOBY albo scalona na demo, albo świadomie zarchiwizowana z notatką.
- Wypisz gałęzie sesji (n-type/powloka/regresje/pasek/eksport/podglad/atrapy/grafika/rubryka).
- Potwierdź, że ich commity są osiągalne z demo po promocji (git merge-base --is-ancestor).
- Gałęzie NIEscalone a wartościowe → dołącz albo otaguj `zachowane/<nazwa>-2026-07-24`.
- NIE force-push, NIE kasować cudzych gałęzi spoza sesji. „Nie utracić" > „posprzątać ładnie".

### FAZA H — SYGNAŁ „GOTOWE DO TESTOWANIA"
Jasny komunikat: co testować (6 kart + tryby + light/dark), co zmienione od nocy, link/URL demo,
punkt cofania, znane ograniczenia. Piotr klika, nie odkrywa zepsucia.

## LOG POSTĘPU (dopisuj po każdej fazie)
- 2026-07-24: partia 1 scalona (17 ponad demo). §4 6/7. Runbook założony. Faza A w toku.
