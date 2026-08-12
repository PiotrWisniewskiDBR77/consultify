# VoiceOver — runbook ręczny dla właściciela

**Status bramki:** `BLOCKED_BY_HOST_PERMISSION — VOICEOVER_MANUAL_EVIDENCE`

**To NIE jest PASS ani N/A.** VoiceOver pozostaje wymagany dla candidate na macOS.
NVDA ma osobne, zatwierdzone `N/A_WITH_CODEX_APPROVAL` wyłącznie na etapie candidate.

---

## Dlaczego to trafiło do Ciebie

Dwie próby automatyczne, oba okna uprawnień odrzucone:

| próba | godzina (UTC) | żądane aplikacje | wynik |
|---|---|---|---|
| 1 | 2026-08-12 ~13:05 | Google Chrome, VoiceOver Utility, System Settings | `user_denied` ×3 |
| 2 | 2026-08-12 ~14:0x | Google Chrome, VoiceOver Utility, System Settings | `user_denied` ×3 |

Bez zgody na podgląd ekranu nie da się:

- odczytać **panelu napisów VoiceOver** (jedyny sposób, w jaki agent „słyszy" czytnik — audio jest niedostępne);
- potwierdzić, że ustawienie hosta zostało **przywrócone** po teście.

Włączenie czytnika ekranu bez możliwości weryfikacji wyłączenia zostawiłoby Twój
system w nieznanym stanie. **Trzeciej automatycznej próby nie wykonano i nie
obchodzono zabezpieczenia** — dwie odmowy w oknie uprawnień to odpowiedź, nie
przeszkoda techniczna.

**AX tree i axe NIE zastępują VoiceOver** — sprawdzają strukturę, nie to, co
faktycznie zostaje wypowiedziane.

---

## Stan wyjściowy — ZMIERZONY, do przywrócenia

```
data pomiaru:        2026-08-12T13:09:16Z
proces VoiceOver:    NIE działa   (pgrep -x VoiceOver → brak)
pliki plist:         BRAK         (~/Library/Preferences/com.apple.VoiceOver* → nic)
domena preferencji:  BRAK         (defaults read com.apple.VoiceOver4/default → nic)
```

Czyli **VoiceOver nigdy nie był na tej maszynie konfigurowany**. Przywrócenie
stanu = wyłączyć go i usunąć pliki, które sam utworzy.

---

## Wariant A — pozwól agentowi (najszybszy, ~20 min Twojej nieobecności)

1. Powiedz w czacie, że możesz oddać maszynę.
2. Agent poprosi o dostęp — **zatwierdź okno** dla: Google Chrome, VoiceOver Utility, System Settings.
3. Odejdź od klawiatury. VoiceOver przejmuje klawiaturę i dźwięk.
4. Agent zapisze stan, przeprowadzi ścieżkę, wyłączy i **potwierdzi przywrócenie zrzutem ekranu**.

Chrome dostajesz tylko w trybie **odczytu** — agent go widzi, ale nie klika;
sterowanie idzie przez rozszerzenie Chrome.

---

## Wariant B — zrób to sam (pełna kontrola)

### 1. Zapisz stan początkowy

```bash
pgrep -x VoiceOver >/dev/null && echo "BYŁ WŁĄCZONY" || echo "BYŁ WYŁĄCZONY"
ls ~/Library/Preferences/com.apple.VoiceOver* 2>/dev/null || echo "brak plistów"
```

### 2. Włącz panel napisów (żeby WIDZIEĆ, co czytnik mówi)

Włącz VoiceOver: **⌘ + F5**.
Przy pierwszym uruchomieniu pojawi się okno powitalne — wybierz **„Use VoiceOver"**.

Potem: **VO + ⌘ + F10** włącza panel napisów (VO = **Ctrl + Option**).
Alternatywnie: VoiceOver Utility → Visuals → Caption Panel → zaznacz „Show caption panel".

### 3. Uruchom stack

```bash
cd /Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809
bash scripts/dev/case-workspace-local-backend.sh    # :3001
# frontend: vite --port 4501
```
Logowanie: `cw.local@local.test` / `CaseWorkspaceLocal!2026`

### 4. Ścieżka krytyczna — przejdź VO + strzałkami

Dla każdego punktu zapisz, co **faktycznie zostało wypowiedziane**.

| # | krok | czego oczekiwać |
|---|---|---|
| 1 | Lista Zleceń | nagłówek tabeli, liczba wierszy, nazwy kolumn |
| 2 | Wybór wiersza | nazwa zlecenia + status, nie „wiersz 1 kolumna 1" |
| 3 | Panel podglądu | ogłoszenie otwarcia, sensowna kolejność czytania |
| 4 | Otwarcie pełnego Case | tytuł jako nagłówek |
| 5 | **Przycisk Wstecz** | **„Wstecz, przycisk"** — to była naprawa krytycznego axe |
| 6 | **Dolna nawigacja** | nazwy zakładek + **stan „zaznaczone"** dla aktywnej (`aria-current="page"`) |
| 7 | Plan → Realizacja → Rezultaty | zmiana zakładki ogłoszona, nie cicha |
| 8 | Stan `partial` | „Częściowo zakończone" |
| 9 | Stan `skipped` | „Nie dotyczy" |
| 10 | Approvals | rola przycisku, stan disabled jeśli występuje |
| 11 | Wait / blocked | powód, nie sam kod |
| 12 | Otwarcie deliverable | ogłoszenie nawigacji |
| 13 | Powrót do Case | fokus wraca na element, z którego wyszedłeś |
| 14 | Komunikat błędu | ogłoszony przez `aria-live`, nie tylko wizualny |
| 15 | Deep link po odświeżeniu | ekran ogłoszony poprawnie od zera |

### 5. Na co patrzeć

- sensowna **kolejność czytania** (nie skacze);
- **nazwy** kontrolek (żadnego „przycisk", „bez etykiety");
- **role** (przycisk/link/tabela/nagłówek);
- stany **expanded / selected / disabled**;
- nagłówki i landmarki;
- tabele czytane jako tabele;
- **brak pułapki fokusa** (da się wyjść klawiaturą);
- zmiany stanu **ogłaszane**;
- **zero żargonu programisty** (`caseId`, `nodeRun`, `SUCCEEDED` surowe);
- **zero kontrolek ikonowych bez opisu**.

### 6. Wyłącz i PRZYWRÓĆ stan

```bash
# ⌘ + F5 wyłącza VoiceOver
pgrep -x VoiceOver >/dev/null && echo "NADAL DZIAŁA — wyłącz" || echo "wyłączony ✓"

# stan wyjściowy = brak plistów, więc usuń to, co VoiceOver utworzył:
ls ~/Library/Preferences/com.apple.VoiceOver* 2>/dev/null
# jeśli coś jest, a chcesz stan sprzed testu:
# rm ~/Library/Preferences/com.apple.VoiceOver4.plist
defaults read com.apple.VoiceOver4/default 2>/dev/null || echo "domena usunięta ✓"
```

### 7. Zapisz dowód

Katalog: `docs/product/case-workspace/evidence/voiceover-manual-<data>/`

Każdy wiersz musi mieć: **SHA**, środowisko, trasę, scenariusz, element,
**wypowiedzianą nazwę**, PASS/FAIL, ograniczenie, timestamp, kto wykonał.

```
SHA:        <git rev-parse HEAD>
środowisko: macOS <wersja>, VoiceOver, Chrome <wersja>, backend :3001, PG :55432
wykonał:    Piotr, <data/godz>

| # | trasa | element | wypowiedziane | PASS/FAIL | uwaga |
|---|-------|---------|---------------|-----------|-------|
| 5 | /zlecenia/<id> | przycisk wstecz | „Wstecz, przycisk" | PASS | |
```

Na koniec dopisz potwierdzenie: **„VoiceOver wyłączony, stan przywrócony do
wyjściowego (brak plistów)"**.

---

## Co to znaczy dla candidate

Jeżeli **wszystko poza VoiceOver** przejdzie, stan terminalny to:

`BLOCKED_BY_HOST_PERMISSION — VOICEOVER_MANUAL_EVIDENCE ONLY`

**Nie** `READY_FOR_CODEX_REVIEW`. Po uzupełnieniu dowodu VoiceOver bramka się
domyka i candidate może zostać zgłoszony.
