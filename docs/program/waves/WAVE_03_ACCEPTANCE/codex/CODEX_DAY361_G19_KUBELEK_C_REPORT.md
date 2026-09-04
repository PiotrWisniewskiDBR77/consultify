# CODEX — Dyżur 361 — G19 kubełek C

## Korekty wobec instrukcji

### Hipoteza „9 × oczy właściciela” obalona

Pomiar R2 daje `(a)=8`, `(b)=1`, `(c)=0`, nie dziewięć `(c)`. Osiem modułów nie ma ani jednego scenariusza wykonującego wskazany zmieniony przekrój, a `03_TOOLS` ma test komponentowy, lecz nie dowód ApiGateway + JWT + PostgreSQL. Szczegóły: `evidence/g19/day361/r2-triaz.md`.

### Tip gałęzi bazowej uciekł od markera

Marker `2a7273e087cbd3e44344725b524f6ddd79d5badc` jest przodkiem tipa. Tip zawiera późniejsze commity aż do `98db4e074a`; zgodnie z DEC-95 dyżur wystartował dokładnie z markera. Diff obejmuje instrukcje 359–366, zmianę `src/utils/initiativeSectionsCompleteFlag.ts`, jej test oraz rejestr. Nie scalano tipa.

### Wolny dysk zmniejszył się, ale pozostał ponad progiem

Przed materializacją było 20 GiB wolne; po pracy 7.7 GiB. Próg STOP (<5 GB) nie został przekroczony.

## R1 — etykieta

Dosłownie identyczne zdanie dowodu występuje w 8/9 wierszy. Test podmiany nazwy wykazał jednak hurtowy charakter dowodu w 9/9, bo także `02_INTERVIEW` podaje tylko liczby wspólnych bloków. Diagnozy braków są indywidualne w 9/9. Werdykt: to dziewięć indywidualnych hipotez opartych na dowodzie, który nie mierzy indywidualnej ścieżki. Pełne cytaty: `evidence/g19/day361/r1-etykieta.md`.

## R2 — triaż

| Moduł | Kategoria | Wykluczenie dwóch pozostałych |
| --- | --- | --- |
| 02 Interview | (a) | testy mockują `NModeLeftNav` i formularze; bez scenariusza nie można orzec (b) ani (c) |
| 03 Tools | (b) | scenariusz `ToolWizardShell` istnieje, więc nie (a); brak ApiGateway/JWT/PG, więc nie (c) |
| 07 My Work Agent | (a) | zero testów wykonujących `NModeLeftNav` w My Work; nie (b)/(c) bez scenariusza |
| 09 Results | (a) | zero testów `HelpButton` i zero pełnego przekroju; nie (b)/(c) |
| 10 Finance | (a) | zero scenariuszy realnego rekordu z PL/EN i stanami; nie (b)/(c) |
| 12 Audits | (a) | `MultiSelect` mockowany, lokalne ErrorState nie tworzą przekroju; nie (b)/(c) |
| 14 Admin | (a) | zero scenariuszy realnego konta z pomocą/błędem/danymi; nie (b)/(c) |
| 15 Settings | (a) | atrapy formularzy albo zero testów; nie (b)/(c) |
| 16 Partner | (a) | zero scenariuszy realnego partnera PL/EN; nie (b)/(c) |

Suma: `(a)=8`, `(b)=1`, `(c)=0`. Dla `(b)` gotowe zlecenie: `GET/PUT /api/tools/:toolId` (`server/src/routes/tools.routes.ts:52-53`), strażnicy `verifyToken`, `requireActiveTenantMembership`, `requireOrgAccess()` (`:35-37`), filtr `id + organization_id` (`server/src/controllers/ToolController.ts:1205-1206`). Dzisiejszy test `ToolWizardShell.canon-runtime` jest DOM-owy i nie wykonuje tego łańcucha.

## R3 — wynik maszynowy

Zero wierszy zamkniętych maszynowo. Powód per moduł znajduje się w `evidence/g19/day361/r3-maszynowe.md`. Kontener `cx-day361-pg` nie był potrzebny i nie powstał. Nie ogłoszono wyników testów, więc nie tworzono pozornego porównania `przed/po` nazw przypadków.

## R4 — pakiet właściciela

Powstał `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md`: data, SHA, wygaśnięcie 11.09, jawny brak twierdzenia o wersji stagingu, sekcje wspólne, dziewięć sekcji po cztery pola i tabela rat.

Potwierdzone w kodzie wskazania 353: `02` — NModeLeftNav i formularze; `03` — ToolWizardShell i ErrorState/łańcuch sesji; `07` — NModeLeftNav w trzech widokach; `09` — wspólne HelpButton/ErrorState oraz słowniki w dryfie; `10` — słowniki i flagowane przestrzenie; `12` — formularze oraz stany błędu/pustki; `14` — rola admin i wspólne komponenty; `15` — współdzielone formularze i sidebar; `16` — mapa wejścia, trasa partnera i PL/EN. Obalone: twierdzenie, że samo ich istnienie oznacza komplet scenariusza lub realnego łańcucha.

## R5 — wiersze

Podniesione wiersze: 0. Załączone dowody podniesienia: 0. `0 = 0`. Macierz nietknięta. Szablon pięciu pól zapisano w `evidence/g19/day361/r5-wiersze.md`; żadnego modułowego szablonu `(c)` nie ma, bo `(c)=0`.

## Pytania do właściciela

1. Czy najpierw finansujemy osiem kontraktów scenariuszowych, czy przelot obserwacyjny? Wariant A daje maszynowy mianownik i dopiero potem uzasadnia oczy właściciela; wariant B szybciej zbiera uwagi, ale nie podnosi G19.
2. Dla Tools: czy zlecić parę właściciel/obcy na istniejącej sesji `GET/PUT /api/tools/:toolId`? TAK pozwala domknąć lukę (b); NIE pozostawia G19 bez realnego łańcucha.
3. Który SHA faktycznie ma środowisko odbiorowe? Bez potwierdzenia zgodności z `2a7273e087…` wynik pakietu nie może wejść do G19.

## Niewykonane i dlaczego

- 02, 07, 09, 10, 12, 14, 15, 16: nie zamknięto — brakuje scenariusza wykonującego wskazaną zmianę.
- 03: nie zamknięto — brakuje realnej pary i mutacji filtra organizacji.
- Nie renderowano ekranów i nie łączono się ze stagingiem/demo/produkcją (`Z28`, `Z40`).
- Nie zmieniono kodu produktu ani macierzy.

## Stan wejściowy i zasoby

Marker, dosłownie:

```text
2a7273e087cbd3e44344725b524f6ddd79d5badc
MARKER OK
```

Sanity worktree, dosłownie:

```text
2a7273e087cbd3e44344725b524f6ddd79d5badc
```

`git status --short | head -3` nie wypisał nic.

`df -h /` przed:

```text
/dev/disk3s1s1   1.8Ti    12Gi    20Gi    38%
```

`df -h /` po:

```text
/dev/disk3s1s1   1.8Ti    12Gi   7.7Gi    61%
```

Słowniki przed/po: `pl 35199`, `en 33066`. Bramki przed/po: `focus=0`, `list=0`, `artefakt=0`, `reach=0`. Kod produktu w diffie: pusty. Porty 6432/5572 były wolne i nie zostały użyte.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiłem bazy, `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.
