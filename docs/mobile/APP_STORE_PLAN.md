# Consultify → App Store + Google Play — Playbook

Strategia: **Capacitor** (opakowanie istniejącego buildu web `dist/`). Stan: Faza 1 w toku.

---

## 1. Dane projektu (SSOT — uzupełniane w trakcie)

### Tożsamość / konta
| Pole | Wartość | Status |
|---|---|---|
| Apple Order | `W1825378162` | ✅ opłacone |
| Apple Enrollment ID | `T4WUXL7PV5` | ⏳ aktywacja w toku (mail na db77.pl) |
| Bundle ID | `com.dbr77.consultify` | ✅ ustalony (używać wszędzie) |
| Developer name (App Store) | `Piotr Wisniewski` | ✅ |
| NIP | `8791182348` | ✅ |
| Adres | `Złotej Rybki 18, 87-100 Toruń` | ✅ |
| Email konta | `piotr.wisniewski@db77.pl` | ✅ |
| Google Play Account ID | `5109227218778911366` | ✅ konto istnieje |
| Google Play — weryfikacja tożsamości | — | ⏳ do zrobienia (dokument z adresem Złotej Rybki 18; jeśli dowód ma inny adres → rachunek bankowy/telefoniczny z <60 dni) |

### Konfiguracja techniczna (URL-e / kontakt)
> Źródło: staging w repo (`.env.staging.*`). Prod domeny NIE są zacommitowane (siedzą w zmiennych Railway na serwisie produkcyjnym) — potwierdzić w panelu Railway.

| Placeholder | Wartość (kandydat) | Status / jak potwierdzić |
|---|---|---|
| `<PROD_API_URL>` | `https://api.consultify.app/api` | ⏳ POTWIERDŹ — staging = `https://api.staging.consultify.app/api`. Sprawdź `VITE_API_URL` na prod-serwisie w Railway |
| `<PROD_WEB_URL>` | `https://consultify.app` | ⏳ POTWIERDŹ — staging = `https://staging.consultify.app`. Sprawdź `FRONTEND_URL` w Railway. ⚠️ `index.html` og:url = `https://consultinity.com` — wyjaśnić, która domena jest kanoniczna dla apki |
| `<PRIVACY_URL>` | `<PROD_WEB_URL>/legal/privacy` | ✅ trasa publiczna (potwierdzone w kodzie); treść z DB → sprawdzić na żywo, że nie pusta |
| `<TERMS_URL>` | `<PROD_WEB_URL>/legal/terms` | ✅ trasa publiczna; treść z DB → sprawdzić na żywo |
| `<SUPPORT_EMAIL>` | `support@consultify.app` | ✅ występuje w repo (alt: `contact@dbr77.com`) — potwierdzić, że skrzynka działa |

**Strony prawne (potwierdzone w kodzie):** publiczne, bez logowania — `/legal/privacy`, `/legal/terms`, `/legal/cookies`, centrum `/legal`. Stare `/privacy`, `/terms` → redirect do `/legal/...`. Treść ciągnięta z `/api/legal/active/{PRIVACY|TOS|COOKIES}` (DB-backed, zarządzane w SuperAdmin → Legal Panel).

---

## 2. Blokery mobilne do naprawy przed pakowaniem (Faza 2)
Znalezione podczas przejścia apki na 375px (zalogowany OWNER):
1. **Header przeładowany** — breadcrumb + „Data" + „Model" w jednym rzędzie; tytuł się zawija. Plik: `MainLayout`. Fix: kompaktowy header mobilny.
2. **„Więcej" otwiera desktopową belkę** (ikony bez podpisów). Plik: `src/components/navigation/BottomNavigation.tsx` (`action: 'openSidebar'` → `setIsSidebarOpen(true)`). Fix: mobilne menu z etykietami.
3. **Safe-area** — `viewport-fit=cover` + `env(safe-area-inset-*)`.
4. **Zimny start** — usunąć pusty ekran przy boot (oryginalne „nic nie działa”).
5. **Ekran offline** zamiast pustej strony (apka online-only).
6. Drobne: „Generate with Teresa” pill zawija/ucina; Radar zatłoczony na mobile; pływające FAB nakładają się na treść.

**Fałszywe alarmy (NIE naprawiać):** crash `useV8 must be used within V8Provider` = artefakt HMR; brak poziomego scrolla na żadnej stronie.

---

## 3. Fazy wdrożenia (skrót)
1. **Faza 1** — konta (Apple ✅opłacone/⏳aktywacja, Google ⏳weryfikacja) + URL-e prawne.
2. **Faza 2** — naprawa blokerów mobilnych (kod).
3. **Faza 3** — Capacitor: `npx cap init Consultify com.dbr77.consultify --web-dir=dist` → `cap add ios/android`; CORS na backendzie dla `capacitor://localhost` + `https://localhost`.
4. **Faza 4** — ikony/splash (`@capacitor/assets`, master 1024px bez alpha), status-bar, splash, push (FCM+APNs), deep links.
5. **Faza 5** — Android `.aab` → Play Internal testing (najszybszy test); iOS Archive → TestFlight.
6. **Faza 6** — listingi + App Privacy / Data Safety + konto recenzenta (login demo/PIN) + screenshoty.
7. **Faza 7** — review → release.

**Ryzyka:** Apple 4.2 (wrapper) → dlatego push + natywne pluginy; utrata keystore = koniec aktualizacji (backup + Play App Signing); lead-time weryfikacji kont.
