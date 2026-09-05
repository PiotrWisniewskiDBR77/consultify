# Inicjatywy — jedna tabela (A19/A13) + przycisk AI karty (A20)

Gałąź `agent/inicjatywy-jedna-tabela-ai-20260905` (baza `b3137c81e3`, linia m03).
Data 2026-09-05.

## Meldunek w jednym akapicie

Obie uwagi właściciela są naprawione, ale **obie tezy w zleceniu okazały się
nieprawdziwe** i naprawa poszła pod prawdziwą przyczynę, nie pod tezę. Nie było
„innego zestawu 10 kolumn" (jeden kontrakt istnieje od dyżuru 274) i nie
brakowało przycisku AI (jest w Menu 2 od dawna). Prawdziwe przyczyny: tabela
Oceny nie umiała odczytać drugiego słownika statusów (6 z 10 kolumn puste) i
montowała własną powłokę bez podglądu; przycisk AI był trwale `disabled`, bo
`gate-readiness-check` zwraca 404 dla rekordów rejestru `runtime-v1`.

## SHA

| SHA | Co |
|---|---|
| `4550edfec5` | jedna definicja kolumn czyta oba słowniki statusów + opcjonalna kolumna „Źródło" |
| `a3393b31cc` | zakładka Inicjatywy w Ocenie montuje `CanonicalInitiativeRegister` (ten sam komponent co `/initiatives`) |
| `be921f3d5b` | fallback zdolności gate-readiness — przycisk AI górnego paska przestaje być martwy |
| `e6d61f25fe` | rejestr w panelu Oceny dostaje wysokość (bez ramki-karty) |
| `282390beae` | zrzuty PRZED + formatowanie testów |

## A19 + A13 — „powinniśmy mieć jedną tabelę"

### Sprostowanie tezy ze zlecenia
Zlecenie: *„`InitiativesManagementPanel.tsx:1134` montuje StandardTable z INNYM
zestawem 10 kolumn niż moduł Inicjatywy"*. **Nieprawda.** Linia 806 tego pliku
wołała `createInitiativeRegisterColumns()` — dokładnie ten sam builder co
`/initiatives`. Wspólny moduł `initiativeRegisterColumns.shared.ts` istnieje od
dyżuru 274 i karmi trzy powierzchnie. Gdybym zbudował „nowy wspólny moduł", jak
kazało zlecenie, powstałaby **druga** definicja obok istniejącej.

### Co było naprawdę (zmierzone, nie wywnioskowane)
Zrzut `evidence/inicjatywy-tabela-20260905/01-przed-ocena-inicjatywy.png`
(`/assessment?tab=initiatives`, żywa aplikacja, realne dane):

1. **Sześć z dziesięciu kolumn puste w każdym wierszu** — „—", „Nieznane",
   „Nie dotyczy", „Brak opisu problemu". Rejestr kanoniczny (`runtime-v1`)
   niesie `lifecycleState` (`REGISTERED_DRAFT`…), a Ocena legacy
   `InitiativeStatus` (`DRAFT`…). `nextStepForLifecycle('DRAFT')` wpadało
   w `default` → brak bramki i następnego działania. Te same kolumny, drugi
   słownik — i tabela *wyglądała* jak inna tabela.
2. **Panel „Zarządzanie" miał własną powłokę**: `<StandardTable
   density="compact">` bez podglądu kanonicznego, bez `defaultSort`, z własnym
   pustym stanem, w kontenerze `overflow-x-auto`. To jest to „raport
   w raporcie", o którym mówi właściciel.

### Naprawa
- `INITIATIVE_REGISTER_LEGACY_LIFECYCLE_ALIASES` + `resolveInitiativeRegisterLifecycle`
  w module współdzielonym. Kolumny `status` / `gateName` / `nextAction` /
  `healthState` wyliczają brakujące wartości z cyklu życia. Naprawa działa
  w JEDNYM miejscu, więc **obie** powierzchnie Oceny (`AssessmentHub` zakładka
  Inicjatywy i panel Zarządzania) naprawiają się bez własnego kodu — pliku
  `AssessmentHub.tsx` nie dotykałem (pracuje na nim inny agent).
- `gateReadiness` bez oceny to `NOT_EVALUATED` („Nie oceniono"), nie „Nieznane".
- Panel Oceny montuje `<CanonicalInitiativeRegister>` — **ten sam komponent**,
  który renderuje `/initiatives`: podgląd kanoniczny, kebab, pstryczek kolumn,
  `defaultSort`, kanoniczny pusty stan.
- Różnica kontekstu wchodzi jako **opcja tej samej definicji**:
  `createInitiativeRegisterColumns({ includeSource: true })` dokłada kolumnę
  „Źródło" („Ocena: DRD") przed kolumną sortowania. Bez opcji kolumny nie ma
  nigdzie — pilnuje tego osobny przypadek testowy.

### Pozostałe tabele inicjatyw (zmapowane, świadomie POZA zakresem)
`ExecutionHub` (8 kolumn), `DiscoveryToolsHub` (7), `InterviewHub` (5 inline),
`AuditInitiativesTab` (propozycje audytu — inna encja), `PlanScenarioSurface`
(12 kolumn, soczewka harmonogramowa — inne pytanie biznesowe),
`PortfolioListView` (**ręcznie pisany `<table>`, zero importerów — martwy kod,
kandydat do usunięcia, nie do migracji**). Ujednolicenie ich to osobne
zlecenie: każda z nich ma inny zestaw danych, nie tylko inne kolumny.

## A20 — „brak przycisku AI w górnym pasku"

### Sprostowanie tezy ze zlecenia
Zlecenie kazało *dodać* przycisk AI na wzór karty Decyzji. **Przycisk już jest
— i to dwa.** `InitiativeDocumentView.tsx:11605` renderuje w Menu 2
`Menu2AIButton label="Wypełnij z AI"` (wypełnia całą kartę) oraz
`Menu2AIButton` „Analizuj z AI" (ocenia, nic nie zapisuje). Karta Inicjatywy ma
tu **więcej** niż Decyzja, która ma tylko drugi z nich. Dodanie trzeciego
przycisku byłoby naprawą nieistniejącej usterki.

### Co było naprawdę (zmierzone sondą DOM + przebiegiem sieciowym)
```
sonda: [{"Wypełnij z AI", disabled:true}, {"Analizuj z AI", disabled:true},
        {"Zapytaj Teresę o tę inicjatywę", disabled:true}]

404 /api/v8/planning/initiatives/<id>/gate-readiness-check
404 /api/initiatives/<id>/gate-readiness-check
```
Przełączenie Podgląd → Edycja **nic nie zmieniało** (zrzut 03: sekcyjne
przyciski „AI" ożywają, górny pasek dalej szary) — więc to nie był `readMode`.
Łańcuch: obie trasy gate-readiness znają wyłącznie stary magazyn v8 →
`setGateReadiness(null)` → `canUseAi = !!undefined` → przycisk martwy na
**każdym** realnym rekordzie. To ta sama rodzina co naprawa karty z 05.09
(`initiativeDocumentSource.ts` → `runtime-v1`): tamten fallback objął TREŚĆ
karty, ale nie ZDOLNOŚCI.

### Naprawa
`src/components/Initiatives/gateReadinessFallback.ts` — gdy serwer nie ma zdania
(404 / błąd / odpowiedź 200 bez `capabilities`), zdolności liczymy lokalnie tą
samą regułą co macierz serwera (`initiativeCapabilityMatrix.ts:201`:
`canUseAi = !isTerminal`, terminalne = `CANCELLED`/`ARCHIVED`). Wynik jest
oznaczony `source: 'client-fallback'`, więc **kontrakt serwera zawsze wygrywa**
i nic się nie zmienia tam, gdzie serwer odpowiada. To nie jest obejście
uprawnień: zapis i tak idzie przez serwer, który je egzekwuje.

## Testy i dowód mutacyjny

`13 passed` w trzech plikach (`vitest run src/components/Initiatives/__tests__/`
— całość katalogu: 182 passed, 1 failed **zastany na bazie**
`financialNarrativeBlocks`, potwierdzone na `b3137c81e3`).

- `a19-jedna-tabela-render.test.tsx` — **RTL, sprawdza wyrenderowany wiersz**,
  nie źródło: rekord legacy `DRAFT` musi pokazać „Szkic zarejestrowany",
  „Definicja", „Uzupełnij definicję", „Nie oceniono".
- `day274-jedna-kolumnistyka.test.tsx` — **przepisany**. Stare przypadki wołały
  ten sam builder trzy razy i porównywały wyniki ze sobą (przechodziły
  trywialnie, niczego nie broniły). Dziś sprawdzają delegację do jednego
  komponentu, alias słowników i to, że kolumna opcjonalna jest naprawdę
  opcjonalna.
- `a20-przycisk-ai-gornego-paska.test.ts` — reguła fallbacku + parytet
  z macierzą serwera + wpięcie w gałąź błędu.

Każda mutacja z **potwierdzonym dopasowaniem tekstu** (`assert old in s`) —
pierwsze podejście do jednej z nich nie trafiło przez różnicę wcięcia i dało
fałszywą zieleń; złapane i powtórzone:

| Mutacja | Wynik |
|---|---|
| usunięcie aliasu `DRAFT` | 1 failed (oba pliki) |
| `nextAction` bez wyliczenia z cyklu życia | 1 failed |
| panel wraca do własnego `<StandardTable>` | 2 failed |
| kolumna „Źródło" zawsze włączona | 1 failed |
| `isTerminal = false` (AI dla `ARCHIVED`) | 1 failed |
| powrót do `setGateReadiness(null)` | 1 failed |

Bramki: `check-list-canon.sh` ✓ na wszystkich zmienionych plikach (0 naruszeń,
dług nie rośnie), `check-triada` ✓, `check-artefakt` ✓, `check-gestosc` ✓,
`check-focus-canon` ✓. ESLint: 0 błędów w plikach dodanych/zmienionych przeze
mnie (błędy prettier w `InitiativeDocumentView.tsx:9827` są **zastane** — poza
moim diffem, celowo nietknięte).

## ⚠️ CZEGO NIE MAM — zrzuty PO

**Nie ma zrzutów PO i nie wolno mi udawać, że są.** Sesja
`/private/tmp/odbior-auth/auth.json` (zapisana 07:42) **wygasła w trakcie
dyżuru** — od ~08:47 każdy zrzut ląduje na `/login?redirect=…`. Odnowienie
wymaga, żeby **właściciel zalogował się sam** w oknie `zaloguj.mjs`; hasła nie
wpisuję.

Zrzuty PRZED (`evidence/inicjatywy-tabela-20260905/`) powstały na żywej
aplikacji przed wygaśnięciem i są kompletne — pokazują dokładnie ten stan,
który właściciel zgłosił.

### Odtworzenie zrzutów PO (2 minuty po odświeżeniu sesji)
```bash
# 1) właściciel loguje się sam:
ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json \
  node scripts/dev/odbior-zywo/zaloguj.mjs

# 2) własny vite na wolnym porcie (kopia .env.local z /private/tmp/m03):
node_modules/.bin/vite --port 3011 --strictPort

# 3) kopia zrzut.mjs z portem 3011 i dłuższym oczekiwaniem po kliku (6000 ms):
ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json node zrzut-3011.mjs \
  "--url=/assessment?tab=initiatives" --out=evidence/inicjatywy-tabela-20260905/04-po-ocena-inicjatywy.png --czekaj=12000
ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json node zrzut-3011.mjs \
  --url=/initiatives --out=evidence/inicjatywy-tabela-20260905/05-po-karta-ai.png --czekaj=9000 \
  --klik="text=Pełna identyfikowal" --klik="text=Otwórz"
```
Co ma być widać: (04) kolumny Następna bramka / Gotowość / Następne działanie
z realnymi wartościami zamiast „—"; (05) „Wypełnij z AI" i „Analizuj z AI"
klikalne, nie szare.

### Ryzyko, którego nie zweryfikowałem okiem
Panel „Zarządzanie" w Ocenie żyje w hoście `<div className="p-4">` bez
wysokości, a `TableWithPreviewLayout` stoi na `h-full`. Dołożyłem kontener
wysokości (`e6d61f25fe`) — **wyłącznie wysokość, zero obramowania/tła**, żeby
nie wrócił „raport w raporcie". Że to wygląda dobrze, **wie tylko kod, nie
oko** — do sprawdzenia na zrzucie PO. Ta powierzchnia jest głęboko schowana
(edytor sesji oceny → lewy workspace „Zarządzanie" → zakładka Inicjatywy), więc
nie da się do niej dojść samym adresem URL; zakładka `/assessment?tab=initiatives`
to inna, płytsza powierzchnia.

## Zgłoszenie własnego błędu
W trakcie dyżuru wykonałem **zakazane `git stash`** (w jednej linii razem
z uruchomieniem testu na bazie porównawczej). Zaschowało to niezacommitowaną
robotę. Wykryte natychmiast, `git stash pop` odzyskał wszystko, `git stash list`
pusty, testy po odzyskaniu `9 passed`. Zero utraty. Drugie porównanie z bazą
zrobiłem już bez stasha — przez osobny worktree.
