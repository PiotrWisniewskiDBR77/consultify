---
doc_id: codex7-zatwierdzanie-inicjatyw
status: WYDANY 12.09 (decyzja właściciela: wydać od razu; wariant ceremonii wybiera właściciel w fali 2)
truth_type: codex-block-instruction
established: 2026-09-12
marker: 45c07b024c
baza: origin/integracja/20260911
---

# CODEX 7 — ZATWIERDZANIE INICJATYW (fala 2, poz. 3.20, DEC-465)

Dziś w produkcie **nie da się zatwierdzić inicjatywy**. Duży przycisk „Zatwierdź inicjatywę"
kończy się komunikatem „Brakuje aktualnej decyzji GO komitetu", a samej decyzji nie ma jak wystawić
z interfejsu. Właściciel widzi to przy każdym przejściu i to jest największa dziura w łańcuchu
„sygnał → wartość". Ten blok buduje **mechanikę** tej decyzji, za flagą domyślnie wyłączoną.

**Decyzja właściciela 12.09: wybór wariantu ceremonii zapada w fali 2, nie teraz.** Dlatego ten blok
ma dwa cele, w tej kolejności: (1) **opracować** rzecz do decyzji — zmierzyć stan, opisać trzy warianty
z konsekwencjami i dać właścicielowi jedną stronę do wyboru; (2) zbudować **rdzeń wspólny** dla wariantów
B i C, tak żeby późniejszy wybór był ustawieniem, a nie przepisywaniem modułu.

Warianty (nazwy używane w całym dokumencie):
- **A** — zatwierdzenie jednym kliknięciem, bez rekordu decyzji. Tani, ale znika ślad audytu.
- **B** — decyzja komitetu jako **osobny rekord z wersją**: zatwierdzenie wymaga aktualnej decyzji GO,
  a istotna zmiana treści inicjatywy unieważnia decyzję.
- **C** — pełny obieg wieloosobowy: kilku opiniujących, kworum, etapy.

**Rdzeń wspólny dla B i C** (to budujesz): rekord decyzji z wersją i uzasadnieniem, sprawdzenie
aktualności przy zatwierdzaniu, unieważnianie po istotnej zmianie, odmowy z kodem i komunikatem,
ślad audytu. **Ceremonia** (ilu ludzi, jakie etapy, czy kworum) ma być **parametrem**, nie wszytym
zachowaniem — wariant C musi dać się włączyć konfiguracją, a nie przebudową.

## §0 BEZPIECZNIKI

Obowiązują Z1–Z24 z `CODEX4_DLUG_MVP/01_INSTRUKCJA.md` (§0), z różnicami: kontener `cx-codex7-pg`
(port **6458**), bazy `cx7_*`, API **4217**, preview **5217**, harness **5598**, migracje
**20262190–20262199**, artefakty `~/Developer/codex-wt/codex7-artefakty`, gałąź
`codex/zatwierdzanie-inicjatyw-20260913` z markera `45c07b024c`.
Znaczniki commita: `[ODMROZENIE 05_INITIATIVES DEC-465] [ODMROZENIE WSPOLNE DEC-465]`.
**Flaga:** `ENABLE_INITIATIVE_APPROVAL_V2`, **domyślnie OFF**; przy OFF zachowanie **bit w bit**
jak dziś (z komunikatem o braku decyzji GO) — to jest warunek scalenia, nie życzenie.

## §1 CO JUŻ ISTNIEJE (zmierz, zanim zbudujesz cokolwiek)

Pomiar z 12.09 (do potwierdzenia własnym grepem — może być nieaktualny):
- trasa decyzji bramy: `POST /api/…/gates/definition/decisions`
  (`server/src/routes/initiativesExecutionRuntime.routes.ts` ~:2849), kontrakt:
  `expectedVersion ≥ 1` · `decisionId` · `outcome ∈ {APPROVED, RETURNED}` · `rationale`;
- bramka zdolności `initiative.review` (~:2867) — członek bez uprawnień dostaje **404**;
- lejek komunikatów gotowości: `initiativeReadinessCheckLabel`, kontrakt `blockingItems {key,label}`,
  40 kluczy w `pl` i `en`;
- **defekt D-1 z odbioru 12.09:** odmowa dla niepowołanego to **404 bez powodu i bez języka** —
  odmowa działa, komunikat nie.

**KROK 0:** potwierdź albo obal każdy z tych czterech punktów, z `plik:linia`. Jeżeli mechanika decyzji
jest kompletniejsza, niż tu napisano — tym lepiej, opisz to i **nie buduj drugiej obok istniejącej**.
Najgorszy możliwy wynik tego bloku to drugi magazyn decyzji obok pierwszego.

## §2 ETAP 0 — OPRACOWANIE DO DECYZJI WŁAŚCICIELA (robisz to PIERWSZE)

Jedna strona, po polsku, dla nie-kodera: `docs/ssot/ZATWIERDZANIE_INICJATYW_SSOT.md`.
Zawiera: (a) jak to działa dziś, w trzech zdaniach i bez żargonu, z tym, co realnie blokuje
zatwierdzenie; (b) trzy warianty A/B/C — co użytkownik klika w każdym, co zostaje w śladzie audytu,
co się dzieje po zmianie treści inicjatywy po zgodzie; (c) koszt każdego wariantu w dniach pracy;
(d) rekomendacja z jednym powodem; (e) pytanie do właściciela w formie „A / B / C" i nic więcej.
Bez tabel z nazwami plików i bez kodu — to strona dla właściciela, nie dla programisty.

## §3 DEFINICJA UKOŃCZENIA

1. **Wystawienie decyzji.** Osoba z uprawnieniem `initiative.review` wystawia decyzję GO albo zwrot
   z uzasadnieniem, przez realny ApiGateway; decyzja zapisuje się z wersją inicjatywy, autorem i czasem;
   powtórzone żądanie z tym samym identyfikatorem jest idempotentne (nie tworzy duplikatu).
2. **Zatwierdzenie inicjatywy** przechodzi wtedy i tylko wtedy, gdy istnieje **aktualna** decyzja GO;
   po zatwierdzeniu status inicjatywy zmienia się i **zostaje po pełnym przeładowaniu**.
3. **Unieważnienie.** Istotna zmiana treści inicjatywy po decyzji podbija jej wersję i decyzja
   przestaje być aktualna; kolejne zatwierdzenie odmawia z jasnym powodem. Zdefiniuj w raporcie,
   **co** jest „istotną zmianą" (lista pól) — i trzymaj się tej listy w kodzie.
4. **Odmowy mówią po ludzku** (naprawa D-1): brak uprawnienia, brak decyzji, decyzja nieaktualna,
   brak właściciela inicjatywy — każda odmowa ma kod, zrozumiałe zdanie i klucz w `en` **i** `pl`.
   Kod odpowiedzi: brak uprawnienia → **403** (nie 404), jeśli sam rekord jest widoczny dla wołającego.
5. **Ślad audytu:** kto, kiedy, na jakiej wersji, z jakim uzasadnieniem — czytelny zapytaniem, które
   wklejasz do raportu.
6. **Przewód w interfejsie — minimalny.** Podpinasz **istniejący** przycisk „Zatwierdź inicjatywę"
   i istniejące miejsce na decyzję. **Nie projektujesz nowych ekranów, paneli ani kolorów**
   (polerowanie wyglądu robią wewnętrzni robotnicy po prototypie zaakceptowanym przez właściciela).
   Jeżeli brakuje miejsca, w którym komitet wystawia decyzję — **STOP**, opisz, czego brakuje,
   i zostaw mechanikę gotową do podpięcia.
7. **Parytet OFF:** przy wyłączonej fladze wszystkie powyższe ścieżki zachowują się dokładnie jak dziś.
   Udowodnij to testem, nie zdaniem.
8. Testy realdb przez realny ApiGateway: ścieżka szczęśliwa, cztery odmowy, unieważnienie po zmianie,
   idempotencja, kontrola obcej organizacji (odmowa + wiersz nietknięty), **dowód mutacyjny** na każdą
   bramkę uprawnień.

## §4 POZA ZAKRESEM

Nowe ekrany i wygląd · zmiana słowników statusów inicjatyw w innych modułach (to osobny program) ·
magazyn kanoniczny inicjatyw (blok 2b) · Finanse · migracje niszczące (tylko addytywne, z zakresu §0).

## §5 RAPORT

`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX7_ZATWIERDZANIE_INICJATYW/98_RAPORT.md`:
stanowisko · KROK 0 (co z §1 potwierdzone, co obalone, `plik:linia`) · model danych decyzji
(tabela, kolumny, migracja) · definicja „istotnej zmiany" · per punkt §3 dowód · parytet OFF ·
testy RED→GREEN · SHA per etap · STOP-y · **czego nie sprawdziłeś**.
