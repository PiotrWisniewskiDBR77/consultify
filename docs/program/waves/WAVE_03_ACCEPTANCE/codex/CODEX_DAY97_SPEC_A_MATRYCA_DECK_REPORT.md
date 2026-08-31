# CODEX DAY 97 — SPEC-A MATRYCA / DECK

Data: 2026-08-29  
Marker: `188cb75f5b8f3b87eb8346160e5ee1aa56942988`  
Gałąź: `codex/day97-spec-a-matryca-deck-20260829`  
Werdykt: **PARTIAL / B.1 BLOCKED — zakończono na polecenie nadzorcy.**

## 1. Tożsamość wejścia

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity, dosłownie:

```text
188cb75f5b8f3b87eb8346160e5ee1aa56942988
```

`git status --short | head -3` nie zwrócił żadnej linii. Na `/` było `58Gi`
wolnego. Porty `5977`, `4854` i `4855` były wolne. Tip gałęzi bazowej był o
jeden commit dalej (`8c7a853a6c`); zgodnie z DEC-95 worktree utworzono dokładnie
z markera.

W1: `28` renderów `ArtifactRightPanel` znalezionych przez zadaną komendę.
W4: wejściowy G10 miał `EVIDENCE_PACKAGE_READY_WITH_FINDINGS`.
Migracje `202617*`: `0`.

## 2. STOP — B.1 Fixture i readback

Rodzaj: **MERYTORYCZNY / blokada infrastrukturalna potwierdzona poprawką nadzorcy**  
Powód: seeder Narzędzi wymaga istniejącego właściciela, którego nie tworzą ani
migracje, ani ten seeder; jedyny seeder tworzący właściciela ma niezgodny
strażnik rodziny nazwy bazy.  
Licencja, którą sprawdziłem: B.1 wymaga zielonego readbacku przed dalszym
przejściem; poprawka nadzorcy nakazuje wstrzymać B.1, nie seedować ponownie,
posprzątać i zakończyć.  
Dowód: `server/scripts/seed-wave3-tools-owner-review.ts:14-39` wymaga rodziny
`consultify_w3_tools_owner_*` i istniejącego użytkownika; oficjalny seeder
Materials tworzy użytkownika, ale jego manifest ma kontrakt
`W3-MATERIALS-OWNER-v1`, którego runtime nie przyjmuje dla rodziny Tools
(`scripts/dev/start-wave3-owner-runtime.mjs:67-70`).  
Co dostarczyłem zamiast zmiany: identyfikację rozjazdu kontraktów seedera,
manifestu i runtime’u; bez zmian w produkcie, seederach i migracjach.  
Co zrobiłbym po decyzji X: po dostarczeniu przez nadzorcę jednego oficjalnego
seedera tworzącego personę oraz fixture pod kontraktem Tools uruchomiłbym B.1
od zera na nowym efemerycznym kontenerze i dopiero po zielonym readbacku B.2.  
Rekomendacja dla nadzorcy: ujednolicić w jednym oficjalnym wejściu nazwę DB,
tworzenie persony, `fixtureId`, marker i allowlistę runtime’u.  
Stan: raport zacommitowany; produkt niezmieniony.  
Czy kontynuowałem pozostałe pozycje: **NIE — poprawka nadzorcy nakazała
zakończyć po B.1.**

### Chronologia i korekta własnego działania

Przed otrzymaniem poprawki wykonałem dwie pełne migracje (`863`, następnie
`Applying migrations: 0`) i próbowałem złożyć fixture z oficjalnych seederów
Materials oraz Tools, przekazując Tools jawne ID persony utworzonej przez
Materials. Otrzymałem techniczne readbacki i uruchomiłem runtime, lecz poprawka
nadzorcy rozstrzyga, że takiego obejścia nie wolno uznać za B.1.

W konsekwencji wszystkie wykonane wcześniej PNG i robocze obserwacje DoD są
**NIEDOPUSZCZONE DO ODBIORU**. Raport nie podaje wyników DoD, nie nazywa tych
zrzutów macierzą B.2 i nie zastępuje oględzin analizą kodu.

## 3. Stan pozycji

| Pozycja | Stan | Powód |
| --- | --- | --- |
| B.1 Fixture i readback | BLOCKED | brak pojedynczego zgodnego kontraktu seedera/persony/manifestu |
| B.2 Macierz 12 zrzutów | NIE WYKONANO / wcześniejszy materiał unieważniony | B.1 nieprzejściowe |
| B.3 DoD §18.1 per artefakt | NIE WYKONANO | zakaz zastępowania oględzin analizą kodu |
| B.4 MODULE_ACCEPTANCE | PARTIAL | odnotowano wyłącznie blokadę Day 97 |
| B.5 Twierdzenia niezweryfikowane | WYKONANO | lista poniżej |

## 4. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano żadnego z 16 punktów DoD dla Tabeli pomysłów.
- Nie zweryfikowano żadnego z 16 punktów DoD dla Arkusza.
- Nie zweryfikowano żadnego z 16 punktów DoD dla Prezentacji.
- Nie wykonano dopuszczalnej macierzy `3 × 2 × 2` po zielonym B.1.
- Nie zweryfikowano stanów pełnych/pustych, motywów, klawiatury, Esc, fokusów,
  relacji, slotu AI ani guardu niezapisanych zmian.
- Nie wykonano dowodu mutacyjnego red/green i nie wpisano `FIXED`, `VERIFIED`
  ani `ZROBIONE_WG_DoD`.

## 5. Z30 i sprzątanie

Nie ustawiono `SMTP_*`, `RESEND`, `SENDGRID`, `MAIL*` ani flagi wysyłki.
Efemeryczna baza miała `0` wierszy `smtp%`. Nie wykonano operacji tworzących
wiadomości, zaproszenia lub powiadomienia; nie wysłano niczego na zewnątrz.

Runtime uruchomiony przed poprawką został zatrzymany kanonicznym poleceniem
`start-wave3-owner-runtime.mjs stop`. Kontener `cx-day97-pg` został usunięty
z wolumenem przez `docker rm -fv cx-day97-pg`. Porty `5977`, `4854`, `4855`
zostały ponownie sprawdzone jako wolne.

## 6. Zakres zapisu

Jedynie:

- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY97_SPEC_A_MATRYCA_DECK_REPORT.md`
- `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md`

Zero zmian w `src/**`, `server/src/**`, seederach, migracjach i globalnej
infrastrukturze testowej.
