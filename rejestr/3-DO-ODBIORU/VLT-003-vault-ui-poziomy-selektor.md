---
id: VLT-003
tytul: Vault UI — selektor poziomu, badge/filtr scope, wybór projektu
typ: zadanie
waga: srednia
obszar: VLT
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr 2026-07-22 (3 poziomy Vault) + audyt origin/demo; przepisane z placeholdera D10c przez Mastera"
stare_id: D10c
utworzone: 2026-07-21
ekran: vault-scope-selector
wysokosc: 780
klik: "Kliknij selektor „Level", przełącz filtr, zobacz badge na dokumentach."
---

## 1. PROBLEM

W Vault nie da się wskazać, czy dokument jest prywatny, projektowy czy organizacyjny — ani przy dodawaniu, ani na liście. Użytkownik nie widzi i nie ustawia poziomu.

## 2. PRZYCZYNA

`src/views/superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab.tsx` — brak pojęcia scope w UI: upload nie ma selektora poziomu, lista filtruje tylko po kategorii i tekście (client-side). Backend poziomów dostarcza VLT-001; encja `projects` istnieje do wyboru projektu.

## 3. ROZWIĄZANIE

W `DocumentsRAGTab` (wariant `client`):
1. **Selektor poziomu przy uploadzie**: Osoba / Projekt / Organizacja; dla „Projekt" pokaż listę projektów użytkownika (z encji `projects`).
2. **Badge/kolumna „poziom"** na kafelku dokumentu.
3. **Filtr** po poziomie obok istniejącego filtra kategorii.
4. Ostrzeżenie zmiany zakresu z VLT-002 wywołaj z UI (podnoszenie poziomu prywatny→org).
Trzymaj standard wyglądu list (skill `consultify-triada`) — to lista, nie artefakt.

## 4. KRYTERIUM ODBIORU

Master robi zrzut (dev-render lub żywe demo, sesja bez logowania Piotra): przy dodawaniu widać selektor Osoba/Projekt/Organizacja; wybór „Projekt" pokazuje listę projektów; na liście każdy dokument ma badge poziomu; filtr poziomu działa. Zrzuty dark+light. Dopiero potem Piotr patrzy — do akceptu.

## 5. DOWODY

Gałąź `feat/vlt-003-ui` (`2f80f664e2`, `f6be36775e`, `5dbdf7a246`, baza `feat/vlt-002-fix` = zawiera VLT-001+002). Nie pushowana.
- `src/services/api.ts` — klient scope 3-poziomowego (upload scope+project_id, GET ?scope=, getProjects, scope-impact, PATCH scope).
- `src/views/superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab.tsx` (variant client) — selektor poziomu przy uploadzie (Private/Project/Organization) + lista projektów gdy Project, badge poziomu na kafelku (tokeny neutralne, zero crimson), filtr serwerowy `?scope=`, ostrzeżenie zmiany zakresu (dry-run `GET /:id/scope-impact` → „N documents will become visible…" amber → Confirm/Cancel → `PATCH /:id/scope`; Cancel bez zapisu).
- `dev-render/screens/vault-scope-selector.tsx` — harness montujący REALNY `<DocumentsRAGTab variant="client">`.
- **Master zweryfikował esbuild (2 pliki) — zielone.** Wykonawca zweryfikował dev-render (port 3271): selektor+lista projektów, badge, filtr redukuje listę (scope=user→1 dok), ostrzeżenie amber z liczbą, Cancel przywraca / Confirm→PATCH→badge zmienia się. esbuild+eslint 0 nowych.
- ⚠️ **Master odtworzy oficjalny zrzut** (`?screen=vault-scope-selector`, dark+light) przed akceptem Piotra (reguła #7).

## 6. DZIENNIK

**2026-07-22 — przepisane przez Mastera z placeholdera D10c.** Zakres = warstwa UI 3 poziomów, rozpisany z audytu `origin/demo`. Zależne od VLT-001 (API poziomów). SSOT: `_SPEC_AGENT_VAULT_2026-07-22.md`.
**2026-07-22 — odblokowane (Master).** VLT-001 (API scope) + VLT-002 (prywatność) w toku/gotowe — UI bazuje na gałęzi Vault. Zależność [VLT-001] usunięta, stan→otwarte.
**2026-07-23 — wykonane** (wykonawca, `feat/vlt-003-ui` na bazie VLT-001+002). Pełny UI 3 poziomów + ostrzeżenie zmiany zakresu (DEC-003), zweryfikowany w dev-render. esbuild zielone (Master). → do-odbioru. Wątpliwości: (1) `getProjects` zwraca WSZYSTKIE projekty org, nie tylko member-only (do potwierdzenia z Piotrem); (2) footgun w dev-render `karta-task.tsx` (nadpisuje `Api.getProjects` globalnie) — do naprawy u źródła.
