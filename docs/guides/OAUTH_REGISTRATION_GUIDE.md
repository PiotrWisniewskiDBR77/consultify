# Przewodnik rejestracji OAuth — Consultify Integrations

> **Cel:** Jednorazowa rejestracja 12 aplikacji developerskich, aby użytkownicy Consultify mogli self-service łączyć się z 20 serwisami.
>
> **Koszt:** $0 (wszystkie rejestracje są darmowe)
>
> **Czas:** ~2-3 godziny na wszystkie 12 rejestracji
>
> **Callback URL:** `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`

---

## Spis treści

1. [Google (Gmail, Calendar, Drive)](#1-google--gmail-calendar-drive)
2. [Microsoft (Outlook, Teams, OneDrive, Calendar)](#2-microsoft--outlook-teams-onedrive-calendar)
3. [Slack](#3-slack)
4. [Atlassian / Jira](#4-atlassian--jira)
5. [Asana](#5-asana)
6. [ClickUp](#6-clickup)
7. [Monday.com](#7-mondaycom)
8. [Notion](#8-notion)
9. [Todoist](#9-todoist)
10. [Linear](#10-linear)
11. [Calendly](#11-calendly)
12. [Dropbox](#12-dropbox)
13. [Box](#13-box)
14. [Trello](#14-trello)
15. [Apple Calendar (iCal)](#15-apple-calendar-ical)
16. [Zmienne .env — podsumowanie](#16-zmienne-env--podsumowanie)
17. [Weryfikacja Google OAuth](#17-weryfikacja-google-oauth)

---

## 1. Google — Gmail, Calendar, Drive

**Jedna rejestracja obsługuje 3 konektory: Gmail, Google Calendar, Google Drive.**

### Krok po kroku:

1. Wejdź na: https://console.cloud.google.com
2. Utwórz nowy projekt: `Consultify Integrations`
3. W menu bocznym: **APIs & Services → OAuth consent screen**
4. Wybierz **External** → Create
5. Wypełnij:
   - App name: `Consultify`
   - User support email: twój email
   - Developer contact email: twój email
   - Logo: opcjonalne (ale przyda się przy weryfikacji)
6. **Scopes** → Add or Remove Scopes → dodaj:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/gmail.labels
   https://www.googleapis.com/auth/contacts.readonly
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/drive.file
   ```
7. **Test users** → dodaj swoje konto (w trybie testowym max 100 użytkowników)
8. **Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Consultify Web`
   - Authorized redirect URIs: `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
   - (Dla dev:) `http://localhost:3005/api/settings/integrations/oauth/callback`
9. Skopiuj `Client ID` i `Client Secret`

### Włącz wymagane API:

W **APIs & Services → Library** włącz:
- Gmail API
- Google Calendar API
- Google Drive API

### Zmienne .env:
```
GOOGLE_CLIENT_ID=xxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxx
```

---

## 2. Microsoft — Outlook, Teams, OneDrive, Calendar

**Jedna rejestracja obsługuje 4 konektory: Outlook, Outlook Calendar, Teams, OneDrive.**

### Krok po kroku:

1. Wejdź na: https://entra.microsoft.com (lub https://portal.azure.com → Azure Active Directory)
2. **App registrations → New registration**
3. Wypełnij:
   - Name: `Consultify`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: **Web** → `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
4. Po utworzeniu → skopiuj **Application (client) ID**
5. **Certificates & secrets → New client secret**
   - Description: `Consultify OAuth`
   - Expires: 24 months
   - Skopiuj **Value** (to jest Client Secret — widoczny tylko raz!)
6. **API permissions → Add a permission → Microsoft Graph → Delegated permissions:**
   ```
   Mail.Read
   Mail.Send
   Contacts.Read
   Calendars.ReadWrite
   Team.ReadBasic.All
   Channel.ReadBasic.All
   ChannelMessage.Send
   Chat.ReadWrite
   Files.ReadWrite
   User.Read
   offline_access
   ```
7. Kliknij **Grant admin consent** (jeśli masz uprawnienia)

### Zmienne .env:
```
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 3. Slack

### Krok po kroku:

1. Wejdź na: https://api.slack.com/apps
2. **Create New App → From scratch**
   - App Name: `Consultify`
   - Workspace: wybierz swój workspace (do testów)
3. **OAuth & Permissions**:
   - Redirect URLs: `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
   - Bot Token Scopes:
     ```
     channels:read
     chat:write
     users:read
     users:read.email
     im:write
     ```
4. **Basic Information** → skopiuj `Client ID` i `Client Secret`

### Zmienne .env:
```
SLACK_CLIENT_ID=xxxxxxxxxxxx.xxxxxxxxxxxx
SLACK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 4. Atlassian / Jira

### Krok po kroku:

1. Wejdź na: https://developer.atlassian.com/console/myapps/
2. **Create → OAuth 2.0 integration**
   - Name: `Consultify`
3. **Authorization → Add → OAuth 2.0 (3LO)**
   - Callback URL: `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
4. **Permissions → Jira API:**
   - `read:jira-work`
   - `write:jira-work`
   - `read:jira-user`
   - `offline_access`
5. **Settings** → skopiuj `Client ID` i `Secret`

### Zmienne .env:
```
ATLASSIAN_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ATLASSIAN_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 5. Asana

### Krok po kroku:

1. Wejdź na: https://app.asana.com/0/developer-console
2. **Create New App**
   - App Name: `Consultify`
   - Redirect URL: `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
3. W sekcji **OAuth** → skopiuj `Client ID` i `Client Secret`

### Zmienne .env:
```
ASANA_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
ASANA_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 6. ClickUp

### Krok po kroku:

1. Wejdź na: https://app.clickup.com/settings/integrations (w swoim workspace)
2. **ClickUp API → Create an App**
   - App Name: `Consultify`
   - Redirect URL: `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
3. Skopiuj `Client ID` i `Client Secret`

> **Uwaga:** ClickUp nie ma granularnych scopes — token daje pełny dostęp do workspace.

### Zmienne .env:
```
CLICKUP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLICKUP_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 7. Monday.com

### Krok po kroku:

1. Wejdź na: https://monday.com/developers/apps
2. **Create App**
   - App Name: `Consultify`
3. **OAuth → Redirect URLs:** `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
4. **Scopes:**
   ```
   me:read
   boards:read
   boards:write
   users:read
   ```
5. Skopiuj `Client ID` i `Client Secret`

### Zmienne .env:
```
MONDAY_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MONDAY_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 8. Notion

### Krok po kroku:

1. Wejdź na: https://www.notion.so/my-integrations
2. **New integration**
   - Name: `Consultify`
   - Type: **Public** (wymagane dla OAuth)
   - Redirect URI: `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
3. **Capabilities:** zaznacz:
   - Read content
   - Update content
   - Insert content
   - Read user information (with email)
4. Skopiuj `OAuth client ID` i `OAuth client secret`

> **Uwaga:** Notion używa Basic Auth do wymiany tokenu (code → token). To jest już zaimplementowane w silniku OAuth.

### Zmienne .env:
```
NOTION_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTION_CLIENT_SECRET=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 9. Todoist

### Krok po kroku:

1. Wejdź na: https://developer.todoist.com/appconsole.html
2. **Create a new app**
   - App Name: `Consultify`
   - OAuth redirect URL: `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
3. Skopiuj `Client ID` i `Client Secret`

> **Uwaga:** Token Todoist NIE wygasa — nie trzeba refresha.

### Zmienne .env:
```
TODOIST_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TODOIST_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 10. Linear

### Krok po kroku:

1. Wejdź na: https://linear.app → Settings → API → **OAuth Applications**
2. **New Application**
   - Name: `Consultify`
   - Redirect callback URLs: `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
3. Skopiuj `Client ID` i `Client Secret`

### Zmienne .env:
```
LINEAR_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LINEAR_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 11. Calendly

### Krok po kroku:

1. Wejdź na: https://developer.calendly.com
2. **Create an App** (wymaga konta Calendly)
   - App Name: `Consultify`
   - Redirect URI: `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
3. Skopiuj `Client ID` i `Client Secret`

### Zmienne .env:
```
CALENDLY_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CALENDLY_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 12. Dropbox

### Krok po kroku:

1. Wejdź na: https://www.dropbox.com/developers/apps
2. **Create app**
   - API: **Scoped access**
   - Access type: **Full Dropbox**
   - Name: `Consultify`
3. **Settings:**
   - Redirect URIs: `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
4. **Permissions** tab → zaznacz:
   ```
   account_info.read
   files.content.read
   files.content.write
   files.metadata.read
   ```
5. Skopiuj `App key` (= Client ID) i `App secret` (= Client Secret)

### Zmienne .env:
```
DROPBOX_CLIENT_ID=xxxxxxxxxxxxxxx
DROPBOX_CLIENT_SECRET=xxxxxxxxxxxxxxx
```

---

## 13. Box

### Krok po kroku:

1. Wejdź na: https://developer.box.com
2. **My Apps → Create New App → Custom App → OAuth 2.0**
   - App Name: `Consultify`
3. **Configuration:**
   - Redirect URI: `https://TWOJA_DOMENA/api/settings/integrations/oauth/callback`
   - Application Scopes: Read/Write all files and folders
4. Skopiuj `Client ID` i `Client Secret`

### Zmienne .env:
```
BOX_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BOX_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 14. Trello

### Krok po kroku:

1. Wejdź na: https://trello.com/power-ups/admin
2. **New** → Create Power-Up
   - Name: `Consultify`
   - Allowed Origins: `https://TWOJA_DOMENA`
3. Przejdź do: https://trello.com/app-key
4. Skopiuj **API Key**

> **Uwaga:** Trello używa token-based auth (nie standardowy OAuth code exchange). Użytkownik autoryzuje i dostaje token bezpośrednio.

### Zmienne .env:
```
TRELLO_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 15. Apple Calendar (iCal)

**Nie wymaga rejestracji developerskiej.**

Apple Calendar łączy się przez CalDAV (Basic Auth). Użytkownik sam podaje:
- Apple ID (email)
- App-Specific Password (generuje w https://appleid.apple.com → Sign In & Security → App-Specific Passwords)

Nie trzeba żadnych zmiennych .env.

---

## 16. Zmienne .env — podsumowanie

Skopiuj i uzupełnij po rejestracji:

```env
# ─── App URL (wymagane dla callback) ───────────────────
APP_URL=https://TWOJA_DOMENA

# ─── Google (Gmail, Calendar, Drive) ───────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── Microsoft (Outlook, Teams, OneDrive, Calendar) ────
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# ─── Slack ─────────────────────────────────────────────
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# ─── Atlassian / Jira ─────────────────────────────────
ATLASSIAN_CLIENT_ID=
ATLASSIAN_CLIENT_SECRET=

# ─── Asana ─────────────────────────────────────────────
ASANA_CLIENT_ID=
ASANA_CLIENT_SECRET=

# ─── ClickUp ──────────────────────────────────────────
CLICKUP_CLIENT_ID=
CLICKUP_CLIENT_SECRET=

# ─── Monday.com ───────────────────────────────────────
MONDAY_CLIENT_ID=
MONDAY_CLIENT_SECRET=

# ─── Notion ───────────────────────────────────────────
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=

# ─── Todoist ──────────────────────────────────────────
TODOIST_CLIENT_ID=
TODOIST_CLIENT_SECRET=

# ─── Linear ───────────────────────────────────────────
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=

# ─── Calendly ─────────────────────────────────────────
CALENDLY_CLIENT_ID=
CALENDLY_CLIENT_SECRET=

# ─── Dropbox ──────────────────────────────────────────
DROPBOX_CLIENT_ID=
DROPBOX_CLIENT_SECRET=

# ─── Box ──────────────────────────────────────────────
BOX_CLIENT_ID=
BOX_CLIENT_SECRET=

# ─── Trello ───────────────────────────────────────────
TRELLO_API_KEY=
```

---

## 17. Weryfikacja Google OAuth

Google wymaga weryfikacji aby obsługiwać więcej niż 100 użytkowników.

### Co jest potrzebne:
1. **Polityka prywatności** — URL na stronie Consultify (np. `/privacy`)
2. **Regulamin** — URL (np. `/terms`)
3. **Domena zweryfikowana** w Google Search Console
4. **Logo aplikacji** (PNG, 120x120px)
5. **Film screencast** pokazujący flow autoryzacji użytkownika (30-60 sec)

### Proces:
1. W Google Cloud Console → OAuth consent screen → **Publish App**
2. Wypełnij formularz weryfikacji
3. Google reviewuje (2-6 tygodni)
4. Po akceptacji — bez limitu użytkowników

### Bez weryfikacji:
- Max 100 użytkowników (dodawanych ręcznie jako "test users")
- Pokazuje ostrzeżenie "This app isn't verified" (użytkownik może kliknąć "Advanced → Continue")
- Działa w pełni — tylko z ostrzeżeniem

---

## Checklist

- [ ] Google Cloud Console — projekt + credentials + włączone 3 API
- [ ] Microsoft Entra — rejestracja + permissions + admin consent
- [ ] Slack — app + scopes + redirect
- [ ] Atlassian — OAuth 2.0 integration + Jira permissions
- [ ] Asana — app + OAuth
- [ ] ClickUp — app
- [ ] Monday.com — app + scopes
- [ ] Notion — public integration + capabilities
- [ ] Todoist — app
- [ ] Linear — OAuth application
- [ ] Calendly — app
- [ ] Dropbox — scoped app + permissions
- [ ] Box — custom app
- [ ] Trello — power-up + API key
- [ ] Wszystkie klucze wpisane do `.env` / Railway env vars
- [ ] `APP_URL` ustawiony na produkcyjną domenę
- [ ] Callback URL ustawiony u każdego providera
- [ ] Test: połączenie z co najmniej jednym providerem działa end-to-end
