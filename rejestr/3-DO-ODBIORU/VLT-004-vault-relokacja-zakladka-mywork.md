---
id: VLT-004
tytul: Vault → zakładka My Work (relokacja z menu głównego)
typ: zadanie
waga: srednia
obszar: VLT
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr 2026-07-22 (Vault jako funkcja My Work) + audyt origin/demo; przepisane z placeholdera D10d przez Mastera"
stare_id: D10d
utworzone: 2026-07-21
---

## 1. PROBLEM

Client Vault to osobna pozycja w menu głównym. Piotr: ma być **funkcją My Work**, nie osobnym modułem — „vault też tam".

## 2. PRZYCZYNA

Zadanie budowlane (relokacja komponentu — nie dotyka logiki dokumentów/scope). Vault renderuje `src/views/vault/ClientDocumentsVault.tsx` → `DocumentsRAGTab variant="client"`. My Work: `src/components/MyWork/MyWorkHub.tsx` (zakładki `ModuleTab` `:188`, `allTabs` `:1436`, switch `renderListContent` `:3413`, deep-link `parseMyWorkPath` `:454`).

## 3. ROZWIĄZANIE

1. Rozszerz `ModuleTab` (`MyWorkHub.tsx:188`) o `'vault'`; dodaj wpis do `allTabs` (ikona `Database`); dodaj `case 'vault'` w `renderListContent` renderujący `DocumentsRAGTab variant="client"`.
2. Dodaj `vault` do parsera deep-linków (`parseMyWorkPath`) → URL `#my-work?tab=vault`.
3. Usuń pozycję sidebara `CLIENT_VAULT` z `src/components/navigation/Sidebar/menuConfig.ts` (blok ~`:71-80` + etykieta). Route `ROUTES.CLIENT_VAULT` zostaw jako redirect na zakładkę (nie łam istniejących linków).
Zakres 3 poziomów robią VLT-001/003 — to zadanie tylko przenosi powierzchnię.

## 4. KRYTERIUM ODBIORU

Master robi zrzut: w menu głównym NIE ma osobnej pozycji „Client Vault"; w My Work jest zakładka „Vault", która pokazuje ten sam ekran dokumentów; wejście na stary link `/vault` przenosi do zakładki. Zrzuty dark+light. Dopiero potem Piotr patrzy.

## 5. DOWODY

Gałąź `feat/relokacja-mywork2` (`0610b2a0af`, baza origin/demo). Nie pushowana.
- `MyWorkHub.tsx`: `ModuleTab`+`'vault'` (`:215`), lazy `ClientDocumentsVault` gejtowany `isClientVaultEnabled()`, wpis zakładki „Client Vault" (Database) w `allTabs`, `case 'vault'`→`<ClientDocumentsVault/>` (`:3688`), deep-link `?tab=vault` (`:469`).
- `menuConfig.ts` (`:64`): usunięty wpis sidebara `CLIENT_VAULT`. `AppRoutes.tsx` (`:1283`): `/vault` → `<Navigate to="/my-work?tab=vault" replace/>`.
- ADOPTOWANE: `ClientDocumentsVault` reużyty 1:1 (zero zmian logiki).
- **Master zweryfikował esbuild (3 pliki) — zielone.** Wykonawca: sonda runtime `getMenuStructure()` → `CLIENT_VAULT present: false` (menu realnie oczyszczone). eslint 0 nowych.
- ⚠️ **Zrzut zakładki „Vault" w My Work — TODO Master.** MyWorkHub wymaga FeatureFlagsProvider+backend (nie montuje się w lekkim dev-render, precedens `crimson-mywork-wave2.tsx`). esbuild potwierdza bundling, nie runtime — zrzut Master zrobi na scalonej bazie / pełnym stacku.

## 6. DZIENNIK

**2026-07-22 — przepisane przez Mastera z placeholdera D10d.** Zakres = sama relokacja Vault→My Work (bez logiki scope), rozpisany z audytu `origin/demo`. Stan zablokowane→otwarte, właściciel master→wykonawca. Niezależne od VLT-001/002/003 (można robić równolegle). SSOT: `_SPEC_AGENT_VAULT_2026-07-22.md`.
**2026-07-23 — wykonane** (wykonawca, `feat/relokacja-mywork2`, wspólnie z AGT-003 — te same pliki). Zakładka Vault w My Work, `/vault`→redirect, pozycja zdjęta z menu (sonda runtime potwierdza). esbuild zielone (Master). → do-odbioru. Zrzut wizualny do zrobienia przez Mastera przed akceptem Piotra (reguła #7).
