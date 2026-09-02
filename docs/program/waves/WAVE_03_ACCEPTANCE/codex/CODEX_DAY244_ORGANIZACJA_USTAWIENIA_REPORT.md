# CODEX DAY 244 — ORGANIZACJA + USTAWIENIA

Data: 2026-09-01  
Gałąź: `codex/day244-organizacja-ustawienia-20260901`  
Marker: `df7f13056f`  
Worktree: `/private/tmp/cx-day244-organizacja-ustawienia`  
Zasoby: PostgreSQL `127.0.0.1:6225` (`cx-day244-pg`), harnessy `5200` i `5201`

## Streszczenie

- Organizacja: odtworzono 22 PNG dla 11 realnych ekranów, light/dark; każda para ma różnicę `mean_luma > 150` (`229,6–234,3`). Seeder na lokalnym PostgreSQL zwrócił 4 persony, 27 zatwierdzonych twierdzeń, 1 snapshot i zgodny hash. Pakiet jest gotowy technicznie do pokazania, ale nie jest werdyktem właściciela.
- Ustawienia: wykonano 14 PNG dla siedmiu zamówionych tras i 4 PNG dowodu routingu `data-controls`. Tylko pięć paneli jest pełnym dowodem własnej treści. `auth-access` i `language` fallbackują w odziedziczonym harnessie do `ProfileSettings`; osobny dowód redirectu istnieje tylko dla `data-controls`, nie dla `billing` i `developer`. R4 jest więc `PARTIAL / EVIDENCE_MISSING`, nie pełnym pakietem siedmiu sekcji.
- `docs/FUNCTIONAL_DOCUMENTATION.md` nie został zmieniony: na markerze linie 55 i 57 nie dotyczą tych modułów, a właściwe wiersze 74 i 76 już zawierają adnotacje `ZAKWESTIONOWANE 1.09`. Licencja pozwalała zapisać wyłącznie linie 55 i 57, więc bezpieczniejszą interpretacją było nie modyfikować pliku.
- Globalny default `orgRedesignV1` pozostał `OFF`; redesign był włączony wyłącznie query-paramem lokalnego harnessu.

## R1 — stan wejściowy

### Marker i sanity — wyniki dosłowne

```text
818e9cec0b SCIEZKA WYJSCIA v2: zamykanie modulow staje sie torem ROWNOLEGLYM, nie ostatnim krokiem; rozdzielenie BLOKUJE/NIE BLOKUJE/CZEKA; 3 dyzury blokujace zamiast 56-91; brak daty konca do pierwszej partii werdyktow
fdac443d4d 242/243/244: marker podniesiony
df7f13056f instrukcje 242 Uprawnienia / 243 Podglad / 244 Organizacja+Ustawienia
MARKER OK
```

```text
df7f13056fa24995be07f64b0e8c877b3faeab45
```

`git status --short | head -3` nie wypisał żadnego wiersza. Tip gałęzi bazowej był przed markerem o dwa commity (`fdac443d4d`, `818e9cec0b`); praca rozpoczęła się dokładnie z markera, bez rebase.

Porty 6225, 5200 i 5201 nie miały listenerów. Przed utworzeniem worktree było 10 GiB wolnego, po utworzeniu 5,9 GiB — powyżej progu 5 GiB.

### Tezy T1–T9

| Teza | Wynik |
|---|---|
| T1 | **OBALONA.** `sed -n '55p;57p'` zwrócił wiersze Assessment i Execution. Organization/Settings są na 74/76 i już mają adnotacje o zakwestionowaniu. |
| T2 | Potwierdzona: G08 `PACKET_READY_WITH_FINDINGS / OWNER_NOT_REVIEWED`, G09 `PARTIAL_TECHNICAL / OWNER_NOT_REVIEWED`. |
| T3 | Potwierdzona: G08 i G09 Ustawień są `NOT_STARTED`. |
| T4 | Potwierdzona: `readEnvFlag()` zwraca `false` bez poprawnej wartości env; komentarz dokumentuje cofnięcie do OFF. |
| T5 | Potwierdzona realnym przebiegiem `--retry=0`: 5 testów, 3 PASS, 2 FAIL; padają pełne nazwy `isOrgRedesignV1Enabled domyślnie ON (DEC-2026-08-26-78)` i `isOrgRedesignV1Enabled śmieciowa wartość spada do niższego priorytetu, nie zmienia wyniku`. |
| T6 | Częściowo potwierdzona: seeder i harness istnieją i uruchamiają się; seeder ma `strategic.goals` w canonical claims, ale ekrany Celów/Wyzwań/Syntezy nadal pokazują dziedziczone uczciwe stany puste. |
| T7 | Potwierdzona liczebność: grep zwrócił 47 łącznie; poprzedni pomiar rozdziela to na 37 liści i 10 grup. Harness istnieje, lecz nie obsługuje poprawnie całej siedmiosekcyjnej próbki R4. |
| T8 | Potwierdzona: oba katalogi Day236/Day238 zwróciły `No such file or directory`. |
| T9 | Potwierdzona na wejściu; minimum 5 GiB zachowane. |

Artefakty testu przed zmianami: `day244-przed.json` (`033974998e8a…`) i `przed-nazwy.txt` (`b6c22af14632…`).

## R2 — korekta spisu funkcjonalnego

Nie wykonano zmiany. Wiążąca licencja wskazywała wyłącznie linie 55 i 57, ale te wiersze zawierają Assessment i Execution. Właściwe moduły są już na liniach 74 i 76 i zawierają uczciwe adnotacje:

```text
74: Organization ... CLOSED_FINAL 2026-08-25 ZAKWESTIONOWANE 1.09 — zamknięto na akcepcie PROTOTYPU; 11 ekranów nieosiągalnych, właściciel nie obejrzał
76: Settings ... CLOSED_FINAL 2026-08-25 ZAKWESTIONOWANE 1.09 — przegląd wizualny NIGDY nie rozpoczęty; 33 z 37 sekcji niedostępnych ...
```

Zmiana innych numerów przekroczyłaby licencję; zmiana 55/57 uszkodziłaby obce moduły.

## R3 — Organizacja

### Lokalny seeder i readback

Kontener `cx-day244-pg` używał obrazu `pgvector/pgvector:pg16`. Pierwszy przebieg migracji zakończył się `✅ Postgres migrations complete`, drugi zastosował `0` migracji i również zakończył się poprawnie. Seeder pracował wyłącznie na `127.0.0.1:6225/consultify_w3_organization_owner_day244`.

Readback: 4 persony, 2 aktywne członkostwa organizacji głównej, 1 revoked, 1 foreign, 27 context claims, 27 approved claims, 1 governed snapshot, 2 konflikty, `snapshot_hash_verified=true`, cold profile API status 200. Manifest: `organization-owner-manifest.json`, SHA-256 `6dea9c2b32a9da46e71d380628c6639198e88257e0c8120e12d0e8a46837a6f4`.

### Zrzuty

Powstały 22 PNG `day244-org-*.png`. Każdy URL przechodził przez `dev-render/main.tsx` → `day236-organizacja.tsx` → realny `OrganizationView`; flaga była włączona tylko `ff_org_redesign_v1=1`. Pełna tabela nazw, skrótów i opisów znajduje się w dopisanej sekcji karty modułu. Manifest PNG: `day244-screenshots.sha256`, SHA-256 `d2afaf251b877ea326bc2cf0eccfb3062c4f12539864a63399d8ded46ef91eb6`.

Cele i mierniki, Wyzwania i dowody oraz rodzina Syntezy strategicznej zachowują uczciwe stany puste. Nie dodawano danych ani nie maskowano pustki.

Końcowy dowód defaultu:

```text
59:    return parsed === null ? false : parsed;
65:    return false;
```

## R4 — Ustawienia

Powstało 14 PNG dla `profile`, `auth-access`, `language`, `theme`, `data-controls`, `billing`, `developer`; różnice light/dark: `227,4–232,6`. Dodatkowe cztery PNG pokazują żywy wynik `RouterSync` dla `data-controls`: MEMBER kończy na `/settings/profile`, OWNER na `/settings/data-controls`.

Ograniczenia zmierzone na ekranie i w kodzie harnessu:

- `Panel()` nie ma przypadków `auth-access` ani `language`, więc oba żądania wpadają do `default` i renderują `ProfileSettings`. Zrzuty dowodzą Sidebar/nagłówka, ale nie treści tych paneli.
- `RoutingProof()` ma `attempted` zapisane na stałe jako `/settings/data-controls` dla trybu restricted. Nie może samodzielnie dowieść przekierowania `billing` ani `developer`.
- Pełnym dowodem własnego panelu są: `profile`, `theme`, `data-controls`, `billing`, `developer` (5 z 7). Pełnym dowodem pary MEMBER/OWNER jest 1 z 3 sekcji niedozwolonych.
- Pozostałe 30 z 37 sekcji nie były objęte dyżurem.

## §0.4a — pomiar nazw testów

Przed i po uruchomiono ten sam pakiet jednostkowy z `RUN_DB_TESTS=0 MOCK_DB=true`, reporterem JSON i `--retry=0`. Pułapki Z33 (ApiGateway, V8 gate, beta visibility, auth bypass, PostgreSQL) nie leżą na ścieżce tego czysto jednostkowego testu flagi. Pułapka (e) jest przedmiotem testu: realny default OFF pozostawiono bez zmiany, dlatego dwa zastałe oczekiwania ON pozostają czerwone.

`diff przed-nazwy.txt po-nazwy.txt` jest pusty. Oba pliki mają identyczny SHA-256 `b6c22af14632152edd4c4152683bbc6748255e0522068209c3829577aa3e85db`. Wynik przed i po: 5 pełnych nazw, 3 PASS, 2 FAIL. Nie dodano ani nie usunięto testu.

## Z30 — zero wysyłki

Przed seederem:

```text
BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%';
(0 rows)
```

Grep drenaży w `server/src/Gateway.ts` zwrócił 0 trafień. Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Do zrzutów użyto wyłącznie Vite dev-render na portach 5200/5201; nie uruchamiano pełnego runtime'u ani modelu językowego.

## Korekty wobec instrukcji

1. `§0.1`/T1 mówi, że linie 55 i 57 zawierają dwa wpisy `CLOSED_FINAL`; pomiar zwrócił Assessment i Execution. Właściwe wpisy są na 74/76 i były już skorygowane. Bezpieczna decyzja: brak zapisu do `FUNCTIONAL_DOCUMENTATION.md`.
2. R4 nakazuje siedem konkretnych sekcji i trzy indywidualne przekierowania, natomiast istniejący, tylko-do-odczytu harness nie implementuje paneli `auth-access`/`language` i koduje próbę routingu na stałe jako `data-controls`. Bezpieczna decyzja: zachować prawdziwe braki jako `EVIDENCE_MISSING`/`NOT_PROVEN`, bez zmiany harnessu poza licencją.
3. T6 oczekuje braku danych `goals` w seederze, ale readback pokazuje canonical claim `strategic.goals`; mimo to odpowiednie powierzchnie renderują uczciwą pustkę. Rozróżniam obecność claimu od danych konsumowanych przez ekran.
4. Instrukcja oczekuje prawdopodobnie minionego tipa, lecz gałąź bazowa była dwa commity przed markerem. Zgodnie z regułą rozejścia rozpoczęto dokładnie z markera.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie udowodniono pełnej treści paneli `auth-access` i `language`.
- Nie udowodniono indywidualnego redirectu MEMBER oraz braku redirectu OWNER/ADMIN dla `billing` i `developer`.
- Nie wykonano pełnego przeglądu pozostałych 30 sekcji Ustawień.
- Nie wykonano odbioru właściciela; żaden wynik tego dyżuru nie rozstrzyga statusu zamknięcia modułów.
- Zrzuty są efemeryczne i nie będą trwałym dowodem po usunięciu `/private/tmp`; nadzorca musi je skopiować przed zamknięciem sesji.

## Zdanie dla nadzorcy

Organizacja: 11 ekranów gotowych do pokazania, ścieżka `/private/tmp/cx-day244-organizacja-ustawienia-artefakty`; Ustawienia: 5 z 7 paneli ma pełny materiał, 2 z 7 ma `EVIDENCE_MISSING`, a żywy redirect udowodniono dla 1 z 3 sekcji niedozwolonych; oba moduły czekają na decyzję właściciela, a pakiet Ustawień wymaga uzupełnienia przed przedstawieniem jako pełna siedmiosekcyjna próbka.
