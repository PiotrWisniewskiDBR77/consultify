# Runbook — Konrad: zewnętrzne integracje (OAuth + Google Drive)

Cel: żeby integracje “zewnętrzne” (portale dostawców + ENV) były ustawione poprawnie dla:
- **OAuth login**: Google (T110), LinkedIn (T111) + connect flow (T112)
- **Cloud data (Google Drive)**: wymagane do T003, ale uwaga: obecna implementacja importu oczekuje tokenu w `cloud_sources` (pełny OAuth connect dla Drive jest do dopięcia osobno).

## 0) Co jest już w kodzie (backend endpoints)

### OAuth login (gotowe)
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `GET /api/auth/linkedin`
- `GET /api/auth/linkedin/callback`
- `GET /api/auth/linkedin/connect` *(connect flow dla zalogowanego usera)*
- `GET /api/auth/linkedin/connect/callback`
- `GET /api/auth/oauth/status` *(configured + loginUrl)*

### Connected accounts (T112)
- `GET /api/settings/connected-accounts`
- `DELETE /api/settings/connected-accounts/:provider`
- `GET /api/user/profile-completeness`

## 1) Wymagane ENV (backend)

W `server/.env` albo w środowisku deploy:

### Google
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` *(opcjonalne; domyślnie `http://localhost:3005/api/auth/google/callback`)*

### LinkedIn
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_CALLBACK_URL` *(opcjonalne; domyślnie `http://localhost:3005/api/auth/linkedin/callback`)*

### Frontend redirect target (dla callbacków)
- `FRONTEND_URL` *(domyślnie `http://localhost:3000`)*  
Backend redirectuje do: `${FRONTEND_URL}/oauth/callback?token=...&user=...`

## 2) Google Cloud Console — konfiguracja OAuth (Sign-in)

1. Wejdź w Google Cloud Console → wybierz / utwórz projekt.
2. **Enable APIs**:
   - dla samego loginu wystarczy standardowy OAuth + userinfo,
   - dla Drive (T003) włącz też **Google Drive API** (na przyszłość).
3. OAuth consent screen:
   - ustaw nazwę aplikacji, email support, domeny (staging/prod),
   - dodaj test users jeśli sandbox.
4. Credentials → **OAuth Client ID** → Web application:
   - Authorized redirect URIs:
     - Local: `http://localhost:3005/api/auth/google/callback`
     - Staging: `https://<api-staging>/api/auth/google/callback`
     - Prod: `https://<api-prod>/api/auth/google/callback`
5. Wklej `client_id` i `client_secret` do ENV.

## 3) LinkedIn Developer Portal — konfiguracja OAuth (OpenID Connect)

Kod używa LinkedIn OIDC userinfo (`https://api.linkedin.com/v2/userinfo`) i scopes: `openid profile email`.

1. Stwórz aplikację w LinkedIn Developer Portal.
2. Włącz produkt **“Sign In with LinkedIn using OpenID Connect”** (jeśli wymagane).
3. Ustaw redirect URLs:
   - Login:
     - Local: `http://localhost:3005/api/auth/linkedin/callback`
     - Staging: `https://<api-staging>/api/auth/linkedin/callback`
     - Prod: `https://<api-prod>/api/auth/linkedin/callback`
   - Connect flow (dla zalogowanego usera):
     - Local: `http://localhost:3005/api/auth/linkedin/connect/callback`
     - Staging: `https://<api-staging>/api/auth/linkedin/connect/callback`
     - Prod: `https://<api-prod>/api/auth/linkedin/connect/callback`
4. Wklej `client_id` i `client_secret` do ENV.

## 4) Test plan (manual)

### OAuth status
- Otwórz: `GET /api/auth/oauth/status`
- Sprawdź `google.configured=true` i/lub `linkedin.configured=true`

### Google login (T110)
1. Wejdź na ekran logowania w aplikacji.
2. Kliknij “Continue with Google”.
3. Po powrocie `oauth/callback` user ma być zalogowany (token w localStorage/cookie wg frontendu).
4. Sprawdź w DB wpis w `oauth_links` (provider=google, provider_user_id, provider_email, last_login_at).

### LinkedIn login (T111)
Analogicznie. Dodatkowo:
- jeśli LinkedIn nie zwróci email → powinien być redirect z `reason=no_email`.

### LinkedIn connect (T112)
1. Zaloguj się hasłem lub Google.
2. Settings → Connected Accounts → Connect LinkedIn.
3. Po connect status ma pokazywać “Connected”, a `oauth_links(provider='linkedin')` ma być zapisany.
4. Disconnect → `revoked_at` ustawione + security event.

## 5) Uwaga (known limitations)

- **State store jest in-memory (Map)** w `server/src/services/oauthService.ts`.  
  W multi-instance (kilka podów) może to powodować losowe “invalid_state”. To jest do przeniesienia na Redis (post‑V2).

- **Cloud Data (T003) — Google Drive OAuth**: aktualna warstwa importu listuje pliki tylko, jeśli `cloud_sources.access_token` jest zapisany.  
  Pełny “Connect Google Drive” OAuth flow (redirect/callback + refresh token) to osobny slice do dopięcia.

